
import React from 'react';
import { Icons } from '../constants';

interface CodePreviewProps {
  snippet: { code: string; lang: string } | null;
  onClose: () => void;
}

export const CodePreview: React.FC<CodePreviewProps> = ({ snippet, onClose }) => {
  const handleCopy = () => {
    if (snippet) {
      navigator.clipboard.writeText(snippet.code);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0D1117] w-full">
      <header className="h-14 border-b border-[#30363D] flex items-center justify-between px-4 bg-[#161B22] shrink-0">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-blue-500"></div>
           <span className="text-xs font-bold uppercase tracking-wider text-[#8B949E]">Code Preview</span>
        </div>
        <div className="flex items-center gap-2">
          {snippet && (
            <button 
              onClick={handleCopy}
              className="p-2 text-[#8B949E] hover:text-white hover:bg-[#21262D] rounded-md transition-all"
              title="Copy all code"
            >
              <Icons.Copy />
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-2 text-[#8B949E] hover:text-white hover:bg-[#21262D] rounded-md transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto custom-scrollbar p-0">
        {!snippet ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="text-[#30363D]">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            </div>
            <p className="text-[#484f58] text-sm font-medium">Generate code to see it previewed here.</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#161B22] border-b border-[#30363D]">
                <span className="text-[10px] font-black uppercase text-blue-400 font-mono">{snippet.lang}</span>
            </div>
            <pre className="flex-1 text-xs">
              <code>{snippet.code}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
