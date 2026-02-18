
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, GeminiModel } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

export type GeminiErrorType = 'QUOTA_EXHAUSTED' | 'SAFETY_BLOCK' | 'NETWORK_ERROR' | 'INVALID_KEY' | 'UNKNOWN';

export class GeminiService {
  private getClient() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async *streamChat(
    model: GeminiModel,
    history: Message[],
    currentPrompt: string,
    useSearch: boolean,
    images: string[] = [],
    audio?: string // base64
  ) {
    const ai = this.getClient();

    const contents: any[] = history.map(m => {
      const parts: any[] = [{ text: m.content }];
      
      if (m.images && m.images.length > 0) {
        m.images.forEach(img => {
          const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) {
            parts.unshift({
              inlineData: {
                mimeType: match[1],
                data: match[2]
              }
            });
          }
        });
      }

      if (m.audio) {
        const match = m.audio.match(/^data:(audio\/\w+);base64,(.+)$/);
        if (match) {
          parts.unshift({
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          });
        }
      }

      return {
        role: m.role === 'user' ? 'user' : 'model',
        parts
      };
    });

    const currentParts: any[] = [];
    
    images.forEach(img => {
      const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        currentParts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      }
    });

    if (audio) {
      const match = audio.match(/^data:(audio\/\w+);base64,(.+)$/);
      if (match) {
        currentParts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      }
    }

    currentParts.push({ text: currentPrompt || (audio ? "Please transcribe and respond to this voice message." : "") });

    contents.push({
      role: 'user',
      parts: currentParts
    });

    try {
      const isFlash = model.includes('flash');
      
      const responseStream = await ai.models.generateContentStream({
        model: model || 'gemini-3-flash-preview',
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: isFlash ? 0.2 : 0.7,
          thinkingConfig: { thinkingBudget: 0 }, 
          ...(useSearch ? { tools: [{ googleSearch: { } }] } : {}),
        },
      });

      let fullText = "";
      let sources: { title?: string; uri?: string }[] = [];

      for await (const chunk of responseStream) {
        const response = chunk as GenerateContentResponse;
        
        if (response.candidates?.[0]?.finishReason === 'SAFETY') {
          throw new Error('SAFETY_BLOCK');
        }

        const text = response.text || "";
        fullText += text;
        
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
          groundingChunks.forEach((c: any) => {
            if (c.web && c.web.uri) {
              if (!sources.find(s => s.uri === c.web.uri)) {
                sources.push({
                  title: c.web.title || c.web.uri,
                  uri: c.web.uri
                });
              }
            }
          });
        }

        yield { text, fullText, sources: sources.length > 0 ? sources : undefined };
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error("Gemini API Error:", error);
      
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('safety')) throw new Error('SAFETY_BLOCK');
      if (msg.includes('429') || msg.includes('quota')) throw new Error('QUOTA_EXHAUSTED');
      if (msg.includes('entity was not found') || msg.includes('api key')) throw new Error('INVALID_KEY');
      if (msg.includes('fetch') || msg.includes('network')) throw new Error('NETWORK_ERROR');
      
      throw new Error('UNKNOWN');
    }
  }
}

export const gemini = new GeminiService();
