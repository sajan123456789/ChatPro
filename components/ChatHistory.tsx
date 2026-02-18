
import React, { useState, useMemo } from 'react';
import { ChatSession, User } from '../types';
import { Icons } from '../constants';

interface ChatHistoryProps {
  sessions: ChatSession[];
  activeId: string | null;
  user: User | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onSignOut: () => void;
  onReorder: (startIndex: number, endIndex: number) => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  sessions,
  activeId,
  user,
  onSelect,
  onNew,
  onDelete,
  onDeleteAll,
  onSignOut,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => 
      s.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sessions, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-[#0d0f14] w-full relative">
      {showConfirm && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#16181d] border border-white/5 rounded-3xl p-6 shadow-2xl w-full">
            <h3 className="text-lg font-bold text-white mb-2">Wipe history?</h3>
            <p className="text-sm text-white/30 mb-6">This action cannot be undone. All conversations will be lost.</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => { onDeleteAll(); setShowConfirm(false); }} className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-sm font-bold transition-all">Delete all</button>
              <button onClick={() => setShowConfirm(false)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-sm font-bold transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Brand & New Chat */}
      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-xs">CP</div>
            <span className="text-sm font-black tracking-tight text-white/90">ChatPro</span>
          </div>
          <button onClick={onNew} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all active:scale-95 border border-white/5" title="New Chat"><Icons.Plus /></button>
        </div>

        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20"><Icons.Search /></div>
          <input
            type="text"
            placeholder="Find threads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-2xl py-2.5 pl-10 pr-4 text-xs focus:outline-none focus:border-indigo-500/30 transition-all placeholder-white/10"
          />
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1 pb-4">
        <div className="px-3 mb-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/10">Recent chats</span>
        </div>
        {filteredSessions.map((session) => (
          <div
            key={session.id}
            className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border ${
              activeId === session.id 
                ? 'bg-indigo-600/10 text-white border-indigo-500/20' 
                : 'text-white/40 hover:bg-white/5 hover:text-white/80 border-transparent'
            }`}
            onClick={() => onSelect(session.id)}
          >
            <div className="flex items-center gap-3 truncate">
               <Icons.Robot />
               <span className="truncate text-xs font-semibold">{session.title || 'Untitled'}</span>
            </div>
            <button className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-white/10 hover:text-red-500 transition-all" onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}>
              <Icons.Trash />
            </button>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center opacity-10">
            <Icons.Sparkles />
            <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-center">Your workspace is empty</p>
          </div>
        )}
      </div>

      {/* User & Settings */}
      <div className="p-4 border-t border-white/5">
        {sessions.length > 3 && (
          <button onClick={() => setShowConfirm(true)} className="w-full mb-4 py-2 text-[10px] font-black text-white/10 hover:text-red-400 uppercase tracking-widest text-center transition-colors">Clear history</button>
        )}
        <div className="flex items-center gap-4 p-3 rounded-[1.5rem] bg-white/5 hover:bg-white/10 border border-white/5 transition-colors cursor-pointer group">
          <div className="relative">
            <img src={user?.picture} className="w-9 h-9 rounded-full border border-white/10" alt="Avatar" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#0d0f14] rounded-full"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate text-white/90">{user?.name}</p>
            <p className="text-[10px] text-white/20 font-black uppercase tracking-tighter">Premium Workspace</p>
          </div>
          <button onClick={onSignOut} className="p-1.5 text-white/10 hover:text-white transition-colors" title="Log out"><Icons.Logout /></button>
        </div>
      </div>
    </div>
  );
};
