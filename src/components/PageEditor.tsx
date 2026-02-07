import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// ============================================================
// Phase 6: Interactive Page Editor
// Surgical editing of ANY Elementor page — modify widget values
// in-place without changing page structure.
// ============================================================

interface Widget {
  id: string;
  path: string[];
  widgetType: string;
  sectionIndex: number;
  order: number;
  category: 'text' | 'heading' | 'image' | 'button' | 'template' | 'unknown';
  // Text
  content?: string;
  // Heading
  text?: string;
  tag?: string;
  // Image
  url?: string;
  mediaId?: number | null;
  // Button
  // text and url used for button too
  // Template
  templateId?: number | null;
  shortcode?: string;
  isShortcode?: boolean;
}

interface AuditData {
  auditedAt: string;
  page: {
    id: number;
    title: string;
    slug: string;
    status: string;
    url: string;
  };
  summary: {
    totalWidgets: number;
    textWidgets: number;
    imageWidgets: number;
    headingWidgets: number;
    buttonWidgets: number;
    templateWidgets: number;
  };
}

interface WidgetEdit {
  widgetId: string;
  widgetType: string;
  category: string;
  // text-editor
  newContent?: string;
  // heading
  newTitle?: string;
  // button
  newText?: string;
  newUrl?: string;
  // image
  newImageUrl?: string;
  newMediaId?: number;
}

interface PageEditorProps {
  // WordPress credentials
  wpUrl: string;
  wpUser: string;
  wpPassword: string;
  // Page to edit
  pageId: number;
  // Optional article context
  articleKeyword?: string;
  // Callbacks
  onClose: () => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info') => void;
}

type WidgetState = 'keep' | 'editing' | 'modified';

interface WidgetEditState {
  state: WidgetState;
  editValue: string;       // For text/heading
  editUrl: string;         // For button URL
  editImageUrl: string;    // For image swap
  editMediaId: number | null;
}

const PageEditor: React.FC<PageEditorProps> = ({
  wpUrl,
  wpUser,
  wpPassword,
  pageId,
  articleKeyword,
  onClose,
  showNotification
}) => {
  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [pageTitle, setPageTitle] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [pageStatus, setPageStatus] = useState('');
  const [pageUrl, setPageUrl] = useState('');

  // Edit state per widget
  const [editStates, setEditStates] = useState<Record<string, WidgetEditState>>({});

  // Push state
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);

  // Replace All Text state
  const [showReplaceAll, setShowReplaceAll] = useState(false);
  const [replaceAllText, setReplaceAllText] = useState('');
  const [replacingAll, setReplacingAll] = useState(false);

  // Image upload state
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  // Load page data on mount
  useEffect(() => {
    loadPage();
  }, [pageId]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/elementor/audit-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wpUrl, wpUser, wpPassword, pageId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to audit page');
      }

      setWidgets(data.widgets || []);
      setAudit(data.audit);
      setPageTitle(data.pageTitle || '');
      setPageSlug(data.pageSlug || '');
      setPageStatus(data.pageStatus || '');
      setPageUrl(data.pageUrl || '');

      // Initialize edit states
      const states: Record<string, WidgetEditState> = {};
      for (const w of data.widgets || []) {
        states[w.id] = {
          state: 'keep',
          editValue: getWidgetDisplayValue(w),
          editUrl: w.category === 'button' ? (w.url || '') : '',
          editImageUrl: w.category === 'image' ? (w.url || '') : '',
          editMediaId: w.category === 'image' ? (w.mediaId || null) : null
        };
      }
      setEditStates(states);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [wpUrl, wpUser, wpPassword, pageId]);

  // Helper: Get the displayable text value for a widget
  function getWidgetDisplayValue(w: Widget): string {
    switch (w.category) {
      case 'text': return w.content || '';
      case 'heading': return w.text || '';
      case 'button': return w.text || '';
      default: return '';
    }
  }

  // Helper: Get the original value from the widget list
  function getOriginalValue(widgetId: string): string {
    const w = widgets.find(w => w.id === widgetId);
    return w ? getWidgetDisplayValue(w) : '';
  }

  function getOriginalUrl(widgetId: string): string {
    const w = widgets.find(w => w.id === widgetId);
    return w?.url || '';
  }

  // Count modified widgets
  const modifiedCount = (Object.values(editStates) as WidgetEditState[]).filter(s => s.state === 'modified').length;

  // Toggle editing for a widget
  function startEditing(widgetId: string) {
    setEditStates(prev => ({
      ...prev,
      [widgetId]: { ...prev[widgetId], state: 'editing' }
    }));
  }

  // Save edit (mark as modified)
  function saveEdit(widgetId: string) {
    const es = editStates[widgetId];
    if (!es) return;

    // Check if value actually changed
    const original = getOriginalValue(widgetId);
    const originalUrl = getOriginalUrl(widgetId);
    const w = widgets.find(w => w.id === widgetId);

    let hasChanges = false;
    if (w?.category === 'text' || w?.category === 'heading') {
      hasChanges = es.editValue !== original;
    } else if (w?.category === 'button') {
      hasChanges = es.editValue !== original || es.editUrl !== originalUrl;
    } else if (w?.category === 'image') {
      hasChanges = es.editImageUrl !== (w?.url || '');
    }

    setEditStates(prev => ({
      ...prev,
      [widgetId]: { ...prev[widgetId], state: hasChanges ? 'modified' : 'keep' }
    }));
  }

  // Revert a widget to original
  function revertEdit(widgetId: string) {
    const w = widgets.find(w => w.id === widgetId);
    if (!w) return;

    setEditStates(prev => ({
      ...prev,
      [widgetId]: {
        state: 'keep',
        editValue: getWidgetDisplayValue(w),
        editUrl: w.category === 'button' ? (w.url || '') : '',
        editImageUrl: w.category === 'image' ? (w.url || '') : '',
        editMediaId: w.category === 'image' ? (w.mediaId || null) : null
      }
    }));
  }

  // Update edit value
  function updateEditValue(widgetId: string, value: string) {
    setEditStates(prev => ({
      ...prev,
      [widgetId]: { ...prev[widgetId], editValue: value }
    }));
  }

  function updateEditUrl(widgetId: string, url: string) {
    setEditStates(prev => ({
      ...prev,
      [widgetId]: { ...prev[widgetId], editUrl: url }
    }));
  }

  // Handle image file upload for swap
  async function handleImageUpload(widgetId: string, file: File) {
    setUploadingImage(widgetId);
    try {
      // Read file as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data URL prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload to WP Media Library
      const response = await fetch('/api/elementor/upload-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpUrl, wpUser, wpPassword,
          imageData: base64,
          filename: file.name,
          alt: articleKeyword || pageTitle || ''
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');

      // Update edit state with new image
      setEditStates(prev => ({
        ...prev,
        [widgetId]: {
          ...prev[widgetId],
          state: 'modified',
          editImageUrl: data.media.url,
          editMediaId: data.media.id
        }
      }));

      showNotification?.('Image uploaded to Media Library', 'success');
    } catch (err: any) {
      showNotification?.(err.message, 'error');
    } finally {
      setUploadingImage(null);
    }
  }

  // Push changes to WordPress
  async function pushChanges() {
    setPushing(true);
    setPushResult(null);
    try {
      const textEdits: any[] = [];
      const headingEdits: any[] = [];
      const buttonEdits: any[] = [];
      const imageSwaps: any[] = [];

      for (const [widgetId, es] of Object.entries(editStates) as [string, WidgetEditState][]) {
        if (es.state !== 'modified') continue;
        const w = widgets.find(w => w.id === widgetId);
        if (!w) continue;

        switch (w.category) {
          case 'text':
            textEdits.push({ widgetId, newContent: es.editValue });
            break;
          case 'heading':
            headingEdits.push({ widgetId, newTitle: es.editValue });
            break;
          case 'button':
            buttonEdits.push({ widgetId, newText: es.editValue, newUrl: es.editUrl });
            break;
          case 'image':
            imageSwaps.push({ widgetId, newUrl: es.editImageUrl, newMediaId: es.editMediaId });
            break;
        }
      }

      const response = await fetch('/api/elementor/surgical-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpUrl, wpUser, wpPassword,
          pageId,
          textEdits,
          headingEdits,
          buttonEdits,
          imageSwaps
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Push failed');

      setPushResult(`${data.widgetsModified} widget(s) updated successfully.`);
      showNotification?.(`Page updated: ${data.widgetsModified} widget(s) modified`, 'success');

      // Reload page to reflect new state
      await loadPage();
    } catch (err: any) {
      setPushResult(`Error: ${err.message}`);
      showNotification?.(err.message, 'error');
    } finally {
      setPushing(false);
    }
  }

  // Replace all text action
  async function handleReplaceAllText() {
    if (!replaceAllText.trim()) return;
    setReplacingAll(true);
    try {
      const response = await fetch('/api/elementor/replace-all-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpUrl, wpUser, wpPassword,
          pageId,
          newContent: replaceAllText
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Replace failed');

      showNotification?.(data.message, 'success');
      setShowReplaceAll(false);
      setReplaceAllText('');

      // Reload to show new state
      await loadPage();
    } catch (err: any) {
      showNotification?.(err.message, 'error');
    } finally {
      setReplacingAll(false);
    }
  }

  // Strip HTML for preview
  function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Truncate text for preview
  function truncate(text: string, max: number): string {
    const clean = stripHtml(text);
    if (clean.length <= max) return clean;
    return clean.substring(0, max) + '...';
  }

  // Widget badge component
  function WidgetBadge({ state }: { state: WidgetState }) {
    switch (state) {
      case 'keep':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-600/20 text-green-400">Keep</span>;
      case 'editing':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-600/20 text-blue-400">Editing</span>;
      case 'modified':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-600/20 text-amber-400">Modified</span>;
    }
  }

  // Category label
  function getCategoryLabel(w: Widget): string {
    switch (w.category) {
      case 'text': return 'TEXT';
      case 'heading': return `HEADING (${(w.tag || 'H2').toUpperCase()})`;
      case 'image': return 'IMAGE';
      case 'button': return 'BUTTON';
      case 'template': return w.isShortcode ? 'SHORTCODE' : 'TEMPLATE';
      case 'unknown': return `WIDGET (${w.widgetType})`;
      default: return 'WIDGET';
    }
  }

  // Render individual widget card
  function renderWidgetCard(w: Widget) {
    const es = editStates[w.id];
    if (!es) return null;

    const isEditing = es.state === 'editing';
    const isModified = es.state === 'modified';

    return (
      <div
        key={w.id}
        className={`rounded-lg border p-4 transition-all ${
          isModified
            ? 'border-amber-500/50 bg-amber-900/10'
            : isEditing
              ? 'border-blue-500/50 bg-blue-900/10'
              : 'border-slate-700 bg-slate-800/50'
        }`}
      >
        {/* Card header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-500 bg-slate-800 px-1.5 py-0.5 rounded">
              {getCategoryLabel(w)}
            </span>
          </div>
          <WidgetBadge state={es.state} />
        </div>

        {/* Card body by category */}
        {w.category === 'text' && renderTextCard(w, es)}
        {w.category === 'heading' && renderHeadingCard(w, es)}
        {w.category === 'image' && renderImageCard(w, es)}
        {w.category === 'button' && renderButtonCard(w, es)}
        {w.category === 'template' && renderTemplateCard(w)}
        {w.category === 'unknown' && (
          <div className="text-gray-500 text-sm italic">
            Widget type "{w.widgetType}" — not editable
          </div>
        )}

        {/* Card actions */}
        {w.category !== 'template' && w.category !== 'unknown' && (
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-700/50">
            {!isEditing && !isModified && (
              <button
                onClick={() => startEditing(w.id)}
                className="px-3 py-1 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-gray-300 transition"
              >
                Edit
              </button>
            )}
            {isEditing && (
              <button
                onClick={() => saveEdit(w.id)}
                className="px-3 py-1 rounded text-xs font-medium bg-brand-cyan text-slate-900 hover:bg-cyan-400 transition"
              >
                Save
              </button>
            )}
            {(isEditing || isModified) && (
              <button
                onClick={() => revertEdit(w.id)}
                className="px-3 py-1 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-gray-300 transition"
              >
                Revert
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Text widget card content
  function renderTextCard(w: Widget, es: WidgetEditState) {
    if (es.state === 'editing') {
      return (
        <textarea
          value={es.editValue}
          onChange={(e) => updateEditValue(w.id, e.target.value)}
          className="w-full h-48 bg-slate-900 border border-slate-600 rounded p-3 text-sm text-gray-200 font-mono resize-y focus:outline-none focus:border-brand-cyan"
          placeholder="Enter new text content (HTML supported)..."
        />
      );
    }

    if (es.state === 'modified') {
      return (
        <div>
          <div className="text-sm text-gray-200 bg-slate-900 rounded p-3 max-h-32 overflow-y-auto">
            {truncate(es.editValue, 300)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Was: {truncate(w.content || '', 100)}
          </div>
        </div>
      );
    }

    // Keep state - show preview
    return (
      <div className="text-sm text-gray-300 max-h-20 overflow-hidden">
        {truncate(w.content || '', 150)}
      </div>
    );
  }

  // Heading widget card content
  function renderHeadingCard(w: Widget, es: WidgetEditState) {
    if (es.state === 'editing') {
      return (
        <input
          type="text"
          value={es.editValue}
          onChange={(e) => updateEditValue(w.id, e.target.value)}
          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-cyan"
          placeholder="Enter new heading text..."
        />
      );
    }

    const displayText = es.state === 'modified' ? es.editValue : (w.text || '');
    return (
      <div>
        <div className="text-gray-200 font-semibold text-sm">
          "{displayText}"
        </div>
        {es.state === 'modified' && (
          <div className="text-xs text-gray-500 mt-1">Was: "{w.text}"</div>
        )}
      </div>
    );
  }

  // Image widget card content
  function renderImageCard(w: Widget, es: WidgetEditState) {
    const displayUrl = es.state === 'modified' ? es.editImageUrl : (w.url || '');
    const isUploading = uploadingImage === w.id;

    return (
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <div className="w-20 h-16 bg-slate-900 rounded border border-slate-700 flex-shrink-0 overflow-hidden">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Widget image"
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
              No image
            </div>
          )}
        </div>

        {/* Image info */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400 truncate">
            {displayUrl ? displayUrl.split('/').pop() : 'No image URL'}
          </div>
          {w.mediaId && (
            <div className="text-xs text-gray-500">ID: #{w.mediaId}</div>
          )}
          {es.state === 'modified' && (
            <div className="text-xs text-amber-400 mt-1">
              Was: {(w.url || '').split('/').pop() || 'none'}
            </div>
          )}

          {/* Swap image action */}
          <div className="mt-2">
            <label className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium cursor-pointer transition ${
              isUploading ? 'bg-gray-600 text-gray-400' : 'bg-purple-600/80 hover:bg-purple-500 text-white'
            }`}>
              {isUploading ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                'Swap Image'
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(w.id, file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  // Button widget card content
  function renderButtonCard(w: Widget, es: WidgetEditState) {
    if (es.state === 'editing') {
      return (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Button Text</label>
            <input
              type="text"
              value={es.editValue}
              onChange={(e) => updateEditValue(w.id, e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-brand-cyan"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Button URL</label>
            <input
              type="text"
              value={es.editUrl}
              onChange={(e) => updateEditUrl(w.id, e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-brand-cyan"
            />
          </div>
        </div>
      );
    }

    const displayText = es.state === 'modified' ? es.editValue : (w.text || '');
    const displayUrl = es.state === 'modified' ? es.editUrl : (w.url || '');

    return (
      <div>
        <div className="text-sm text-gray-200">
          "{displayText}" &rarr; <span className="text-blue-400 text-xs">{displayUrl || 'no url'}</span>
        </div>
        {es.state === 'modified' && (
          <div className="text-xs text-gray-500 mt-1">
            Was: "{w.text}" &rarr; {w.url || 'no url'}
          </div>
        )}
      </div>
    );
  }

  // Template widget card content (read-only)
  function renderTemplateCard(w: Widget) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-blue-400 text-sm">&#9432;</span>
        <div className="text-sm text-gray-400">
          {w.isShortcode
            ? `Shortcode: ${w.shortcode || 'unknown'}`
            : `Elementor Template #${w.templateId || 'unknown'}`
          }
          <div className="text-xs text-gray-500 mt-0.5">
            Templates can't be edited here — update the template in WordPress
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER
  // ==========================================
  const editorContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col mx-4">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Edit Live Page: "{pageTitle}"
              </h2>
              <div className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>Page ID: {pageId}</span>
                <span className="text-gray-600">|</span>
                <span>{pageSlug}</span>
                <span className="text-gray-600">|</span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  pageStatus === 'publish' ? 'bg-green-600/20 text-green-400' : 'bg-amber-600/20 text-amber-400'
                }`}>
                  {pageStatus}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded transition"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Quick Actions Toolbar */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              onClick={() => setShowReplaceAll(true)}
              disabled={loading || widgets.filter(w => w.category === 'text').length === 0}
              className="px-3 py-1.5 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
              title="Paste new article content, auto-distributes across text widgets"
            >
              Replace All Text
            </button>
            <button
              onClick={loadPage}
              disabled={loading}
              className="px-3 py-1.5 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-gray-300 transition disabled:opacity-40"
              title="Refresh page data from WordPress"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Body - scrollable widget list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <svg className="w-8 h-8 animate-spin text-brand-cyan mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <div className="text-gray-400 text-sm">Loading page widgets...</div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 text-sm">
              <div className="font-medium mb-1">Failed to load page</div>
              <div className="text-red-400">{error}</div>
              <button
                onClick={loadPage}
                className="mt-2 px-3 py-1 rounded text-xs bg-red-800 hover:bg-red-700 text-red-200 transition"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && widgets.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-lg mb-2">No editable widgets found</div>
              <div className="text-sm">This page may not be built with Elementor, or has no editable content.</div>
            </div>
          )}

          {!loading && !error && widgets.map(w => renderWidgetCard(w))}

          {/* Limitations notice */}
          {!loading && !error && widgets.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-xs text-gray-500 mt-4">
              <span className="text-blue-400 mr-1">&#9432;</span>
              Page structure will be preserved. Only modified widget values change.
              Text and images can be edited; layout, sections, and widget arrangement cannot be changed here.
              If changes don't appear immediately on the live site, try regenerating Elementor CSS
              (Settings &rarr; Elementor &rarr; Tools &rarr; Regenerate CSS).
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">
              {audit && (
                <span>{audit.summary.totalWidgets} widgets &middot; {modifiedCount} modified &middot; {audit.summary.totalWidgets - modifiedCount} unchanged</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded text-sm font-medium text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={pushChanges}
                disabled={pushing || modifiedCount === 0}
                className={`px-4 py-2 rounded text-sm font-medium transition flex items-center gap-2 ${
                  modifiedCount > 0
                    ? 'bg-brand-cyan text-slate-900 hover:bg-cyan-400'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {pushing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Pushing...
                  </>
                ) : (
                  `Push ${modifiedCount} Change${modifiedCount !== 1 ? 's' : ''} to Page`
                )}
              </button>
            </div>
          </div>
          {pushResult && (
            <div className={`text-xs mt-2 ${pushResult.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
              {pushResult}
            </div>
          )}
        </div>
      </div>

      {/* Replace All Text Modal */}
      {showReplaceAll && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowReplaceAll(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Replace All Text</h3>
            <p className="text-sm text-gray-400 mb-4">
              Paste your new article content below. It will be automatically split and distributed
              across the existing {widgets.filter(w => w.category === 'text').length} text widget(s) on this page.
              Heading widgets will also be updated if the content contains H2 headings.
            </p>
            <textarea
              value={replaceAllText}
              onChange={(e) => setReplaceAllText(e.target.value)}
              className="w-full h-64 bg-slate-800 border border-slate-600 rounded-lg p-4 text-sm text-gray-200 resize-y focus:outline-none focus:border-brand-cyan"
              placeholder="Paste full article content here (HTML or markdown)..."
              autoFocus
            />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => setShowReplaceAll(false)}
                className="px-4 py-2 rounded text-sm text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReplaceAllText}
                disabled={replacingAll || !replaceAllText.trim()}
                className="px-4 py-2 rounded text-sm font-medium bg-brand-cyan text-slate-900 hover:bg-cyan-400 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {replacingAll ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Replacing...
                  </>
                ) : (
                  'Replace All Text & Push'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(editorContent, document.body);
};

export default PageEditor;
