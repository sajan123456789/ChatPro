
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { Icons } from '../constants';
import { formatMarkdown } from '../utils/formatter';

interface ChatMessageProps {
  message: Message;
  isProcessing?: boolean;
  onPin?: (message: Message) => void;
  onRegenerate?: (messageId: string) => void;
}

const AudioPlayer: React.FC<{ src: string }> = ({ src }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateProgress = () => setProgress((audio.currentTime / audio.duration) * 100);
    const onEnded = () => { setIsPlaying(false); setProgress(0); };
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) audioRef.current?.pause();
    else audioRef.current?.play();
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex items-center gap-4 bg-white/5 border border-white/5 p-4 rounded-2xl w-full max-w-[340px] mt-4 shadow-xl">
      <audio ref={audioRef} src={src} hidden />
      <button onClick={togglePlay} className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 hover:bg-indigo-500 transition-all shadow-lg active:scale-95">
        {isPlaying ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>
      <div className="flex-1">
        <div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">Voice Response</div>
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all duration-100" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onPin, onRegenerate, isProcessing }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { }
  };

  return (
    <div className={`flex w-full animate-fade-in group ${isUser ? 'justify-end' : 'justify-start'} py-2`}>
      <div className={`flex items-start gap-4 ${isUser ? 'flex-row-reverse max-w-[85%]' : 'w-full'}`}>
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${isUser ? 'bg-indigo-600 border-indigo-400 hidden' : 'bg-[#1a1c22] border-white/5'}`}>
          {!isUser && <Icons.Robot />}
        </div>

        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full`}>
          <div className={`${isUser ? 'user-bubble px-5 py-3 text-white' : 'ai-bubble-wrap w-full p-6'} relative transition-all`}>
            {message.content && (
              <div 
                className="prose prose-invert prose-sm max-w-none break-words text-white/90 font-normal leading-relaxed text-[15px]"
                dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
              />
            )}

            {message.audio && <AudioPlayer src={message.audio} />}
            
            {message.isStreaming && (
              <span className="inline-block w-2 h-2 ml-2 bg-indigo-500 rounded-full animate-pulse align-middle shadow-[0_0_10px_#4f46e5]" />
            )}

            {message.images && message.images.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-4">
                {message.images.map((img, idx) => (
                  <div key={idx} className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl group/img transition-transform hover:scale-[1.02]">
                     <img src={img} className="max-w-full sm:max-w-[400px] max-h-[500px] object-cover" alt="Uploaded" />
                  </div>
                ))}
              </div>
            )}

            {!isUser && message.sources && message.sources.length > 0 && !message.isStreaming && (
              <div className="mt-10 pt-6 border-t border-white/5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-4">Research References</p>
                <div className="flex flex-wrap gap-2">
                  {message.sources.map((source, idx) => (
                    <a 
                      key={idx} 
                      href={source.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-[11px] text-white/50 hover:text-indigo-400 transition-all active:scale-95"
                    >
                      <Icons.Research />
                      <span className="max-w-[150px] truncate">{source.title || source.uri}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          {!message.isStreaming && (
            <div className={`flex items-center gap-3 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isUser ? 'mr-2' : 'ml-1'}`}>
              <button onClick={handleCopy} className="p-2 text-white/10 hover:text-white/60 transition-all active:scale-90" title="Copy">
                {copied ? <Icons.Check /> : <Icons.Copy />}
              </button>
              {!isUser && onRegenerate && (
                <button 
                  onClick={() => onRegenerate(message.id)} 
                  disabled={isProcessing}
                  className="p-2 text-white/10 hover:text-white/60 transition-all active:scale-90 disabled:opacity-30" 
                  title="Try again"
                >
                  <Icons.Refresh />
                </button>
              )}
              <button onClick={() => onPin?.(message)} className={`p-2 transition-all active:scale-90 ${message.isPinned ? 'text-blue-500' : 'text-white/10 hover:text-white/60'}`} title={message.isPinned ? "Unpin" : "Pin"}>
                {message.isPinned ? <Icons.PinOff /> : <Icons.Pin />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
