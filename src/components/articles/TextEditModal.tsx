import React, { useState, useRef, useEffect } from 'react';

interface TextEditModalProps {
  widgetId: string;
  articleId?: number;
  websiteId: number;
  currentContent?: string;
  onClose: () => void;
  onSave: (newContent: string) => void;
}

const TextEditModal: React.FC<TextEditModalProps> = ({
  widgetId,
  articleId,
  websiteId,
  currentContent = '',
  onClose,
  onSave
}) => {
  const [content, setContent] = useState(currentContent);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = currentContent;
    }
  }, [currentContent]);

  const handleFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleSave = async () => {
    if (!editorRef.current) return;

    setSaving(true);
    try {
      const newContent = editorRef.current.innerHTML;
      onSave(newContent);
    } finally {
      setSaving(false);
    }
  };

  const toolbarButtons = [
    { command: 'bold', icon: 'B', title: 'Bold', style: 'font-bold' },
    { command: 'italic', icon: 'I', title: 'Italic', style: 'italic' },
    { command: 'underline', icon: 'U', title: 'Underline', style: 'underline' },
    { command: 'strikeThrough', icon: 'S', title: 'Strikethrough', style: 'line-through' },
    { type: 'divider' },
    { command: 'insertUnorderedList', icon: '•', title: 'Bullet List' },
    { command: 'insertOrderedList', icon: '1.', title: 'Numbered List' },
    { type: 'divider' },
    { command: 'justifyLeft', icon: '⫷', title: 'Align Left' },
    { command: 'justifyCenter', icon: '⫿', title: 'Align Center' },
    { command: 'justifyRight', icon: '⫸', title: 'Align Right' },
    { type: 'divider' },
    { command: 'removeFormat', icon: '✕', title: 'Clear Formatting' }
  ];

  const headingOptions = [
    { value: 'p', label: 'Paragraph' },
    { value: 'h1', label: 'Heading 1' },
    { value: 'h2', label: 'Heading 2' },
    { value: 'h3', label: 'Heading 3' },
    { value: 'h4', label: 'Heading 4' }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
      <div className="bg-slate-900 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col border border-brand-cyan/30">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-brand-cyan/30">
          <div>
            <h3 className="text-lg font-semibold text-white">Edit Text</h3>
            <p className="text-sm text-gray-500 font-mono">Widget: {widgetId}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 text-slate-900 font-medium rounded transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl ml-2"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 p-3 border-b border-brand-cyan/20 bg-slate-800/50 flex-wrap">
          {/* Heading selector */}
          <select
            onChange={(e) => handleFormat('formatBlock', e.target.value)}
            className="bg-slate-700 border border-brand-cyan/30 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-brand-cyan"
            defaultValue="p"
          >
            {headingOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="w-px h-6 bg-gray-600 mx-2" />

          {toolbarButtons.map((btn, i) => {
            if (btn.type === 'divider') {
              return <div key={i} className="w-px h-6 bg-gray-600 mx-1" />;
            }
            return (
              <button
                key={btn.command}
                onClick={() => handleFormat(btn.command!)}
                title={btn.title}
                className={`w-8 h-8 flex items-center justify-center rounded hover:bg-slate-600 text-gray-300 hover:text-white transition ${btn.style || ''}`}
              >
                {btn.icon}
              </button>
            );
          })}

          <div className="w-px h-6 bg-gray-600 mx-2" />

          {/* Link button */}
          <button
            onClick={() => {
              const url = prompt('Enter URL:');
              if (url) handleFormat('createLink', url);
            }}
            title="Insert Link"
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-600 text-gray-300 hover:text-white transition"
          >
            🔗
          </button>

          {/* Unlink button */}
          <button
            onClick={() => handleFormat('unlink')}
            title="Remove Link"
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-600 text-gray-300 hover:text-white transition"
          >
            ⛓️‍💥
          </button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-auto p-4">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[300px] bg-slate-800 border border-brand-cyan/30 rounded-lg p-4 text-white focus:outline-none focus:border-brand-cyan prose prose-invert max-w-none"
            style={{
              lineHeight: 1.6
            }}
            onInput={(e) => setContent((e.target as HTMLDivElement).innerHTML)}
          />
        </div>

        {/* Footer with HTML view toggle */}
        <div className="p-4 border-t border-brand-cyan/20">
          <details className="text-sm">
            <summary className="text-gray-500 cursor-pointer hover:text-gray-400">
              View HTML Source
            </summary>
            <pre className="mt-2 p-3 bg-slate-800 rounded-lg text-gray-400 text-xs overflow-auto max-h-32">
              {editorRef.current?.innerHTML || content}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
};

export default TextEditModal;
