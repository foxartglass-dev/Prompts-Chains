/**
 * HelpButton - Floating help button that opens the user manual
 */
import React, { useState, useEffect } from 'react';

interface HelpButtonProps {
  position?: 'bottom-right' | 'bottom-left';
}

const HelpButton: React.FC<HelpButtonProps> = ({ position = 'bottom-right' }) => {
  const [showModal, setShowModal] = useState(false);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Parse table of contents from markdown
  const extractTOC = (markdown: string): { title: string; id: string; level: number }[] => {
    const lines = markdown.split('\n');
    const toc: { title: string; id: string; level: number }[] = [];

    for (const line of lines) {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const title = match[2];
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        toc.push({ title, id, level });
      }
    }

    return toc;
  };

  // Simple markdown to HTML converter
  const renderMarkdown = (markdown: string): string => {
    let html = markdown
      // Headers with IDs
      .replace(/^### (.+)$/gm, '<h3 id="$1" class="text-lg font-bold text-brand-gold mt-6 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 id="$1" class="text-xl font-bold text-brand-cyan mt-8 mb-3 border-b border-slate-700 pb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 id="$1" class="text-2xl font-bold text-white mb-4">$1</h1>')
      // Code blocks
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-slate-900 p-3 rounded-lg overflow-x-auto text-xs my-3"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="bg-slate-800 px-1 py-0.5 rounded text-brand-cyan text-sm">$1</code>')
      // Tables
      .replace(/^\|(.+)\|$/gm, (match, content) => {
        const cells = content.split('|').map((c: string) => c.trim());
        const isHeader = cells.some((c: string) => c.includes('---'));
        if (isHeader) return '';
        const tag = 'td';
        return `<tr>${cells.map((c: string) => `<${tag} class="border border-slate-700 px-3 py-1">${c}</${tag}>`).join('')}</tr>`;
      })
      // Bold and italic
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-brand-cyan hover:underline">$1</a>')
      // Lists
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
      // Checkboxes
      .replace(/^- \[ \] (.+)$/gm, '<li class="ml-4 flex items-center gap-2"><input type="checkbox" disabled class="opacity-50" /> $1</li>')
      .replace(/^- \[x\] (.+)$/gm, '<li class="ml-4 flex items-center gap-2"><input type="checkbox" checked disabled class="opacity-50" /> $1</li>')
      // Horizontal rules
      .replace(/^---$/gm, '<hr class="border-slate-700 my-6" />')
      // Paragraphs
      .replace(/\n\n/g, '</p><p class="my-2 text-slate-300">');

    // Wrap in paragraph
    html = `<p class="my-2 text-slate-300">${html}</p>`;

    // Fix table wrapping
    html = html.replace(/(<tr>[\s\S]*?<\/tr>)+/g, '<table class="w-full border-collapse my-4">$&</table>');

    return html;
  };

  const loadContent = async () => {
    setLoading(true);
    try {
      const response = await fetch('/USER-MANUAL.md');
      if (response.ok) {
        const text = await response.text();
        setContent(text);
      } else {
        setContent('# User Manual\n\nManual file not found. Check that USER-MANUAL.md is in the public folder.');
      }
    } catch (error) {
      setContent('# Error\n\nFailed to load user manual.');
    }
    setLoading(false);
  };

  const handleOpen = () => {
    setShowModal(true);
    if (!content) {
      loadContent();
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(id);
    }
  };

  const toc = content ? extractTOC(content) : [];

  const positionClasses = position === 'bottom-left'
    ? 'left-4 bottom-20'
    : 'right-4 bottom-20';

  return (
    <>
      {/* Floating Help Button */}
      <button
        onClick={handleOpen}
        className={`fixed ${positionClasses} w-12 h-12 bg-brand-cyan text-slate-900 rounded-full shadow-lg flex items-center justify-center text-xl font-bold hover:bg-brand-cyan/80 transition-all hover:scale-110 z-40`}
        title="Open User Manual"
      >
        ?
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl border border-slate-700">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900 rounded-t-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📚</span>
                <h2 className="font-bold text-xl text-white">PromptFlow User Manual</h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-2xl w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-700 transition"
              >
                ×
              </button>
            </div>

            {/* Body with sidebar */}
            <div className="flex flex-1 overflow-hidden">
              {/* Table of Contents Sidebar */}
              <div className="w-64 border-r border-slate-700 overflow-y-auto p-4 bg-slate-900/50">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Contents</h3>
                <nav className="space-y-1">
                  {toc.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => scrollToSection(item.title)}
                      className={`block w-full text-left px-2 py-1 rounded text-sm transition ${
                        item.level === 1
                          ? 'font-bold text-brand-gold hover:bg-slate-800'
                          : item.level === 2
                          ? 'pl-4 text-brand-cyan hover:bg-slate-800'
                          : 'pl-6 text-slate-400 hover:bg-slate-800 text-xs'
                      } ${activeSection === item.title ? 'bg-slate-700' : ''}`}
                    >
                      {item.title}
                    </button>
                  ))}
                </nav>

                {/* Quick Links */}
                <div className="mt-6 pt-4 border-t border-slate-700">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Links</h3>
                  <div className="space-y-2">
                    <a
                      href="https://github.com/foxartglass-dev/Prompts-Chains"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-slate-300 hover:text-brand-cyan"
                    >
                      <span>📦</span> GitHub Repo
                    </a>
                    <a
                      href="/FRONTEND-IMPLEMENTATION-SPECS.md"
                      target="_blank"
                      className="flex items-center gap-2 text-sm text-slate-300 hover:text-brand-cyan"
                    >
                      <span>🔧</span> Dev Specs
                    </a>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin w-8 h-8 border-2 border-brand-cyan border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div
                    className="prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                  />
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-700 bg-slate-900 rounded-b-xl flex justify-between items-center text-sm text-slate-400">
              <span>Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">ESC</kbd> or click outside to close</span>
              <button
                onClick={() => window.open('/USER-MANUAL.md', '_blank')}
                className="text-brand-cyan hover:underline"
              >
                Open in new tab ↗
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HelpButton;
