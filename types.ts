
export type Role = 'user' | 'assistant' | 'system';

export interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
}

export interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface GroundingSource {
  title?: string;
  uri?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  isEdited?: boolean;
  isPinned?: boolean;
  images?: string[]; // base64 strings
  audio?: string;    // base64 string
  sources?: GroundingSource[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  model: string;
  useSearch: boolean;
}

export enum GeminiModel {
  FLASH = 'gemini-3-flash-preview',
  PRO = 'gemini-3-pro-preview',
}
