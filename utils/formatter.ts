
export const detectLanguage = (code: string): string => {
  const clean = code.trim();
  const lower = clean.toLowerCase();
  
  // High-confidence markers
  if (lower.includes('import react') || lower.includes('from "react"') || lower.includes('jsx')) return 'tsx';
  if (lower.includes('const [') && lower.includes('] = usestate')) return 'tsx';
  if (lower.includes('import ') || lower.includes('export ') || lower.includes('const ') || lower.includes('console.log')) return 'javascript';
  if (lower.includes('def ') || lower.includes('print(') || lower.includes('import os') || lower.includes('if __name__ ==')) return 'python';
  if (lower.includes('<html>') || lower.includes('<!doctype html') || lower.includes('<div') || lower.includes('<script')) return 'html';
  if (lower.includes('interface ') || lower.includes('type ') || lower.includes('enum ') || lower.includes('as string')) return 'typescript';
  
  // Structure-based detection
  if (clean.startsWith('{') || clean.startsWith('[')) {
    try { JSON.parse(clean); return 'json'; } catch(e) {}
  }
  
  if (lower.includes('struct ') || lower.includes('fn ') || lower.includes('impl ') || lower.includes('let mut')) return 'rust';
  if (lower.includes('void main(') || lower.includes('#include <') || lower.includes('std::')) return 'cpp';
  if (lower.includes('public class ') || lower.includes('system.out.println')) return 'java';
  if (lower.includes('<?php')) return 'php';
  if (lower.includes('select ') && lower.includes(' from ') && lower.includes('where ')) return 'sql';
  if (lower.includes('body {') || lower.includes('.class {') || lower.includes('@media')) return 'css';
  
  return 'plaintext';
};

export const formatMarkdown = (content: string): string => {
  if (!content) return '';
  
  const escaped = content.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m] || m);

  const highlightCode = (code: string, lang: string) => {
    const isHtml = lang === 'html' || lang === 'xml' || lang === 'svg';
    
    if (isHtml) {
      return code
        // Tags
        .replace(/(&lt;\/?[a-z1-6]+)(&gt;| )/gi, '<span class="hl-tag">$1</span>$2')
        .replace(/(&lt;\/?[a-z1-6]+$)/gi, '<span class="hl-tag">$1</span>')
        // Attributes
        .replace(/ ([a-z-]+)=/gi, ' <span class="hl-attr">$1</span>=')
        // Strings in attributes
        .replace(/(=")(.*?)(")/g, '$1<span class="hl-string">$2</span>$3')
        // Comments
        .replace(/&lt;!--[\s\S]*?--&gt;/g, '<span class="hl-comment">$&</span>');
    }

    return code
      // Comments
      .replace(/\/\/.*/g, '<span class="hl-comment">$&</span>')
      .replace(/\/\*[\s\S]*?\*\//g, '<span class="hl-comment">$&</span>')
      // Strings
      .replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, '<span class="hl-string">$&</span>')
      // Keywords
      .replace(/\b(const|let|var|function|return|if|else|for|while|import|export|from|class|extends|new|true|false|null|undefined|await|async|try|catch|finally|public|private|protected|static|readonly|interface|type|enum|default|as|is|in|of|void|any|number|string|boolean|object|unknown|never|def|print|elif|with|yield|lambda|pass|break|continue)\b/g, '<span class="hl-keyword">$1</span>')
      // Built-ins / Functions
      .replace(/\b(console|window|document|Math|JSON|Array|Object|String|Number|Boolean|Promise|Map|Set|Error|Date|Reflect|Proxy|setTimeout|setInterval|clearTimeout|clearInterval)\b/g, '<span class="hl-function">$1</span>')
      // Function calls (word before parenthesis)
      .replace(/\b([a-z_][a-z0-9_]*)(?=\s*\()/gi, '<span class="hl-function">$1</span>')
      // Numbers
      .replace(/\b(\d+)\b/g, '<span class="hl-number">$1</span>')
      // Operators
      .replace(/[+\-*\/=<>!&|]/g, '<span class="hl-operator">$&</span>');
  };

  let formatted = escaped
    // Tables
    .replace(/^\|(.+)\|$/gm, (match, content) => {
      const cells = content.split('|').map((c: string) => c.trim());
      const isHeader = match.includes('---');
      if (isHeader) return '';
      return `<tr>${cells.map((c: string) => `<td>${c}</td>`).join('')}</tr>`;
    })
    .replace(/(<tr>[\s\S]*?<\/tr>)+/g, '<table>$1</table>')
    // Blockquotes
    .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
    // Code blocks
    .replace(/```(\w+)?([\s\S]*?)```/g, (match, lang, code) => {
      const cleanCode = code.trim();
      let language = (lang || '').toLowerCase();
      
      if (!language) {
        language = detectLanguage(cleanCode);
      }
      
      const highlighted = language === 'plaintext' ? cleanCode : highlightCode(cleanCode, language);
      
      const copyIcon = `<svg class="btn-icon-copy" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
      const checkIcon = `<svg class="btn-icon-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      
      return `
        <div class="code-container">
          <div class="code-header">
            <span class="code-lang">${language || 'plaintext'}</span>
            <button class="copy-code-btn" onclick="
              const codeElem = this.closest('.code-container').querySelector('code');
              const btn = this;
              navigator.clipboard.writeText(codeElem.innerText).then(() => {
                btn.classList.add('copied');
                const label = btn.querySelector('.btn-label');
                label.innerText = 'Copied!';
                setTimeout(() => { 
                  btn.classList.remove('copied');
                  label.innerText = 'Copy'; 
                }, 2000);
              });
            ">
              <span class="btn-icon-wrapper" style="position:relative; width:14px; height:14px; display:inline-flex; align-items:center; justify-content:center;">
                <span class="icon-copy" style="position:absolute; transition: opacity 0.2s;">${copyIcon}</span>
                <span class="icon-check" style="position:absolute; opacity:0; transition: opacity 0.2s;">${checkIcon}</span>
              </span>
              <span class="btn-label" style="margin-left:4px;">Copy</span>
            </button>
          </div>
          <pre><code>${highlighted}</code></pre>
        </div>`;
    })
    // Headers
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold text-white mt-6 mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-white mt-8 mb-3">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-black text-white mt-10 mb-4">$1</h1>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-[13px]">$1</code>')
    // Bold/Italic
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em class="italic text-white/50">$1</em>')
    // Lists
    .replace(/^\*\s+(.*)$/gm, '<li class="ml-4 list-disc mb-2 text-white/80 leading-relaxed">$1</li>')
    .replace(/^\d+\.\s+(.*)$/gm, '<li class="ml-4 list-decimal mb-2 text-white/80 leading-relaxed">$1</li>');

  return formatted
    .split('\n\n')
    .map(p => {
      const trimmed = p.trim();
      if (trimmed.startsWith('<div') || trimmed.startsWith('<li') || trimmed.startsWith('<h') || trimmed.startsWith('<table') || trimmed.startsWith('<blockquote')) return trimmed;
      if (!trimmed) return '';
      return `<p class="mb-4 leading-relaxed text-white/80">${trimmed}</p>`;
    })
    .join('');
};
