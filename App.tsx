
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatHistory } from './components/ChatHistory';
import { ChatMessage } from './components/ChatMessage';
import { CodePreview } from './components/CodePreview';
import { LoginPortal } from './components/LoginPortal';
import { Icons } from './constants';
import { Message, ChatSession, GeminiModel, User } from './types';
import { gemini } from './services/geminiService';
import { detectLanguage } from './utils/formatter';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 15);
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('chatpro_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('chatpro_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) { return []; }
    }
    return [];
  });
  
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return localStorage.getItem('chatpro_active_id') || null;
  });

  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<GeminiModel>(GeminiModel.FLASH);
  const [useSearch, setUseSearch] = useState(false);
  const [useEnhance, setUseEnhance] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeCodeSnippet, setActiveCodeSnippet] = useState<{code: string, lang: string} | null>(null);

  const [confirmPinMessage, setConfirmPinMessage] = useState<Message | null>(null);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stopGeneratingRef = useRef<boolean>(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const saveSessionsToDisk = useCallback((data: ChatSession[]) => {
    try {
      localStorage.setItem('chatpro_sessions', JSON.stringify(data));
      localStorage.setItem('chatpro_active_id', activeSessionId || '');
    } catch (e) { }
  }, [activeSessionId]);

  useEffect(() => {
    saveSessionsToDisk(sessions);
  }, [sessions, saveSessionsToDisk]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  useEffect(() => {
    if (activeSession && activeSession.messages.length > 0) {
      const lastAiMsg = [...activeSession.messages].reverse().find(m => m.role === 'assistant' && !m.isStreaming);
      if (lastAiMsg) {
        const codeMatch = lastAiMsg.content.match(/```(\w+)?([\s\S]*?)```/);
        if (codeMatch) {
          const rawCode = codeMatch[2].trim();
          const language = codeMatch[1] || detectLanguage(rawCode);
          setActiveCodeSnippet({ lang: language, code: rawCode });
        }
      }
    }
  }, [activeSession?.messages]);

  useEffect(() => {
    if (isProcessing) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.messages, isProcessing]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      showToast("Could not access microphone.");
      console.error(err);
    }
  };

  const stopRecording = (send: boolean = true) => {
    if (!mediaRecorderRef.current) return;
    
    mediaRecorderRef.current.onstop = async () => {
      if (send) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          handleSendMessage("", base64Audio);
        };
        reader.readAsDataURL(audioBlob);
      }
      
      const tracks = mediaRecorderRef.current?.stream.getTracks();
      tracks?.forEach(track => track.stop());
      mediaRecorderRef.current = null;
    };

    mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const executeChatStream = async (sessionId: string, currentPrompt: string, images: string[] = [], audio?: string, customHistory?: Message[]) => {
    stopGeneratingRef.current = false;
    let assistantMsgId = generateId();
    const assistantMessage: Message = { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true };

    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, assistantMessage] } : s));

    let finalPrompt = currentPrompt;
    if (useEnhance && !audio) {
      finalPrompt = `Refine and improve this prompt for better AI output, then answer it: "${currentPrompt}"`;
    }

    try {
      const historyToUse = customHistory || sessions.find(s => s.id === sessionId)?.messages.slice(0, -1) || [];
      const stream = gemini.streamChat(selectedModel, historyToUse, finalPrompt, useSearch, images, audio);

      for await (const chunk of stream) {
        if (stopGeneratingRef.current) break;
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: s.messages.map(m => m.id === assistantMsgId ? { 
            ...m, 
            content: chunk.fullText, 
            sources: chunk.sources 
          } : m)
        } : s));
      }

      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        messages: s.messages.map(m => m.id === assistantMsgId ? { ...m, isStreaming: false } : m)
      } : s));
    } catch (error: any) {
      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        messages: s.messages.map(m => m.id === assistantMsgId ? { ...m, content: "Error: I'm having trouble processing your request right now.", isStreaming: false } : m)
      } : s));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (overridePrompt?: string, voiceAudio?: string) => {
    if (isProcessing) {
      stopGeneratingRef.current = true;
      return;
    }

    const promptToSend = overridePrompt !== undefined ? overridePrompt : input;
    if ((!promptToSend.trim() && pendingImages.length === 0 && !voiceAudio)) return;
    
    let sessionId = activeSessionId;
    if (!sessionId) {
      const newSess: ChatSession = { id: generateId(), title: promptToSend.slice(0, 30) || (voiceAudio ? "Voice Message" : "Conversation"), messages: [], createdAt: Date.now(), model: selectedModel, useSearch };
      setSessions(prev => [newSess, ...prev]);
      setActiveSessionId(newSess.id);
      sessionId = newSess.id;
    }

    const currentImages = [...pendingImages];
    const userMessage: Message = { 
      id: generateId(), 
      role: 'user', 
      content: promptToSend, 
      timestamp: Date.now(), 
      images: currentImages,
      audio: voiceAudio
    };
    
    setSessions(prev => prev.map(s => s.id === sessionId ? {
      ...s,
      title: s.messages.length === 0 ? (promptToSend.slice(0, 40) || (voiceAudio ? "Voice Message" : "New Discussion")) : s.title,
      messages: [...s.messages, userMessage]
    } : s));

    setInput('');
    setPendingImages([]);
    setIsProcessing(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await executeChatStream(sessionId, promptToSend, currentImages, voiceAudio);
  };

  const handleRegenerate = async (messageId: string) => {
    if (!activeSessionId || isProcessing) return;
    
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;

    const msgIndex = session.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const userMsg = session.messages[msgIndex - 1];
    if (!userMsg || userMsg.role !== 'user') return;

    const newHistory = session.messages.slice(0, msgIndex);
    
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: newHistory } : s));
    setIsProcessing(true);
    await executeChatStream(activeSessionId, userMsg.content, userMsg.images, userMsg.audio, newHistory);
  };

  const handlePinRequest = (message: Message) => {
    if (message.isPinned) {
      togglePin(message.id);
    } else {
      setConfirmPinMessage(message);
    }
  };

  const togglePin = (messageId: string) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? {
      ...s,
      messages: s.messages.map(m => m.id === messageId ? { ...m, isPinned: !m.isPinned } : m)
    } : s));
    setConfirmPinMessage(null);
    showToast("Update applied");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPendingImages(prev => [...prev, event.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePendingImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setInput('');
    setActiveCodeSnippet(null);
    setPendingImages([]);
    setIsSidebarOpen(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  if (!user) return <LoginPortal onLogin={setUser} />;

  return (
    <div className="flex h-full w-full bg-[#0b0c10] text-[#ececec] overflow-hidden font-sans">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-[#4f46e5] text-white px-5 py-2 rounded-full text-xs font-bold shadow-xl animate-fade-in border border-white/10">
          {toast}
        </div>
      )}

      {confirmPinMessage && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-[#13151a] border border-white/10 rounded-[32px] p-8 shadow-2xl w-full max-w-sm text-center">
            <div className="w-14 h-14 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Icons.Pin />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Pin Message?</h3>
            <p className="text-sm text-white/40 mb-8">This message will be highlighted and saved to your pinned list for quick reference.</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => togglePin(confirmPinMessage.id)} 
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95"
              >
                Yes, Pin Message
              </button>
              <button 
                onClick={() => setConfirmPinMessage(null)} 
                className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-sm font-bold transition-all active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isSidebarOpen && <div className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <div className={`fixed lg:relative inset-y-0 left-0 z-50 w-72 bg-[#0d0f14] border-r border-white/5 transform transition-transform duration-300 ease-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <ChatHistory 
          sessions={sessions} activeId={activeSessionId} user={user}
          onSelect={(id) => { setActiveSessionId(id); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} 
          onNew={handleNewChat}
          onDelete={(id) => setSessions(prev => prev.filter(s => s.id !== id))}
          onDeleteAll={() => { setSessions([]); setActiveSessionId(null); showToast("History cleared"); }}
          onSignOut={() => { setUser(null); localStorage.removeItem('chatpro_user'); }} 
          onReorder={() => {}}
        />
      </div>

      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-16 flex items-center justify-between px-6 shrink-0 z-30">
          <div className="flex items-center gap-4">
            <button className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 transition-all active:scale-95 lg:hidden" onClick={() => setIsSidebarOpen(true)}>
              <Icons.Sidebar />
            </button>
            {activeSession && activeSession.messages.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-white/70 truncate max-w-[200px]">{activeSession.title}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-[9px] font-black uppercase tracking-widest text-white/30 border border-white/5">
                  {selectedModel === GeminiModel.PRO ? 'Pro' : 'Flash'}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
             <button className={`p-2 rounded-xl transition-all ${isRightPanelOpen ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-white/20 hover:text-white'}`} onClick={() => setIsRightPanelOpen(!isRightPanelOpen)} title="Preview Panel">
               <Icons.Code />
             </button>
             <div className="w-9 h-9 rounded-full border border-white/10 p-0.5 overflow-hidden">
                <img src={user.picture} alt="Profile" className="w-full h-full object-cover rounded-full" />
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative px-4 lg:px-0">
          <div className="max-w-3xl mx-auto h-full flex flex-col">
            {!activeSession || activeSession.messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center animate-fade-in py-12">
                <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white mb-10 shadow-lg shadow-blue-500/20 border border-white/10">
                  <Icons.Sparkles />
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 text-center tracking-tight leading-tight">
                  {getTimeGreeting()}, <span className="text-white/50">{user.name.split(' ')[0]}</span>
                </h2>
                <p className="text-white/30 text-base font-medium mb-12 text-center tracking-wide">How can I help you today?</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-4">
                  {[
                    { title: "ChatPro AI", desc: "Fast & precise intelligence", icon: <Icons.Robot />, action: "Introduce yourself." },
                    { title: "Code Helper", desc: "Expert at building & debugging", icon: <Icons.Code />, action: "Analyze this logic: [paste code]" },
                    { title: "Research Mode", desc: "Get real-time web info", icon: <Icons.Search />, action: "Find the latest tech news." },
                    { title: "Creative Story", desc: "Brainstorm new ideas", icon: <Icons.Creative />, action: "Write a short cyberpunk story." }
                  ].map((card, i) => (
                    <button key={i} onClick={() => handleSendMessage(card.action)} className="glass-card p-5 rounded-2xl flex items-center gap-5 text-left group">
                      <div className="w-10 h-10 rounded-xl bg-white/5 text-white/30 flex items-center justify-center shrink-0 border border-white/5 group-hover:scale-110 group-hover:bg-indigo-600/20 group-hover:text-indigo-400 group-hover:border-indigo-500/20 transition-all duration-300">
                        {card.icon}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white/90 group-hover:text-white transition-colors">{card.title}</h3>
                        <p className="text-[11px] text-white/20 font-bold uppercase tracking-wider group-hover:text-white/40 transition-colors truncate">{card.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-12 py-10 w-full">
                {activeSession.messages.map((m) => (
                  <ChatMessage 
                    key={m.id} 
                    message={m} 
                    isProcessing={isProcessing} 
                    onPin={handlePinRequest} 
                    onRegenerate={handleRegenerate}
                  />
                ))}
              </div>
            )}
            <div ref={messagesEndRef} className="h-44 shrink-0" />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-10 z-40 bg-gradient-to-t from-[#0b0c10] via-[#0b0c10]/95 to-transparent">
          <div className="max-w-3xl mx-auto">
            
            {pendingImages.length > 0 && (
              <div className="flex gap-3 mb-5 animate-fade-in overflow-x-auto pb-2 px-2 no-scrollbar">
                {pendingImages.map((img, idx) => (
                  <div key={idx} className="relative group shrink-0">
                    <img src={img} className="w-20 h-20 rounded-xl object-cover border border-white/10 shadow-2xl" alt="Preview" />
                    <button onClick={() => handleRemovePendingImage(idx)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-xl ring-2 ring-[#0b0c10] active:scale-90 transition-transform">
                      <Icons.Trash />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              {isRecording ? (
                <div className="bg-[#1c1e26] border border-indigo-500/30 rounded-[28px] p-4 flex items-center justify-between shadow-2xl animate-fade-in">
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center justify-center w-8 h-8">
                       <div className="absolute w-full h-full rounded-full bg-red-500/20 animate-ping" />
                       <div className="w-3 h-3 rounded-full bg-red-500" />
                    </div>
                    <span className="text-white font-mono text-sm tracking-widest">{formatDuration(recordingDuration)}</span>
                    <span className="text-white/30 text-xs font-bold uppercase tracking-wider hidden sm:block">Recording voice message...</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => stopRecording(false)} className="px-4 py-2 rounded-xl hover:bg-white/5 text-white/30 hover:text-white transition-all text-xs font-bold uppercase tracking-widest">Cancel</button>
                    <button onClick={() => stopRecording(true)} className="w-12 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all">
                       <Icons.Send />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#16181d]/90 input-blur border border-white/5 rounded-[28px] p-2.5 shadow-[0_25px_80px_-20px_rgba(0,0,0,0.8)] focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                  <textarea
                    ref={textareaRef} value={input}
                    onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`; }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder="Message ChatPro..."
                    className="w-full bg-transparent px-5 pt-3 pb-2 text-[16px] focus:outline-none resize-none custom-scrollbar min-h-[48px] text-white placeholder-white/20 font-medium leading-relaxed"
                    rows={1}
                  />
                  
                  <div className="flex flex-wrap items-center justify-between mt-2 pt-2 border-t border-white/5 px-2">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => fileInputRef.current?.click()} className="p-2 text-white/30 hover:text-white transition-all active:scale-90" title="Attach"><Icons.Attach /></button>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                      
                      <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block"></div>

                      <button 
                        onClick={() => setUseSearch(!useSearch)} 
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 ${useSearch ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'bg-white/5 text-white/30 border border-white/5 hover:bg-white/10'}`}
                      >
                        <Icons.Search /> Search
                      </button>
                      <button 
                        onClick={() => setUseEnhance(!useEnhance)} 
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 ${useEnhance ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : 'bg-white/5 text-white/30 border border-white/5 hover:bg-white/10'}`}
                      >
                        <Icons.Enhance /> Enhance
                      </button>
                    </div>

                    <div className="flex items-center gap-4 ml-auto">
                      <button 
                        onClick={startRecording}
                        className="p-2 text-white/30 hover:text-white transition-all active:scale-90" 
                        title="Record Voice"
                      >
                        <Icons.Mic />
                      </button>
                      
                      <button 
                        onClick={() => handleSendMessage()} 
                        className={`w-10 h-10 flex items-center justify-center rounded-full shadow-lg transition-all active:scale-90 ${isProcessing ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 ring-2 ring-red-500/50' : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-5'}`}
                        disabled={!isProcessing && !input.trim() && pendingImages.length === 0}
                        title={isProcessing ? "Stop generating" : "Send message"}
                      >
                        {isProcessing ? (
                           <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                        ) : (
                          <Icons.Send />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <p className="mt-4 text-[10px] text-white/10 text-center font-bold tracking-tight uppercase">ChatPro can make mistakes. Check important info.</p>
          </div>
        </div>
      </main>

      <div className={`${isRightPanelOpen ? 'w-[500px]' : 'w-0'} border-l border-white/5 bg-[#0b0c10] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col shrink-0 overflow-hidden shadow-2xl z-50`}>
        <CodePreview snippet={activeCodeSnippet} onClose={() => setIsRightPanelOpen(false)} />
      </div>
    </div>
  );
};

export default App;
