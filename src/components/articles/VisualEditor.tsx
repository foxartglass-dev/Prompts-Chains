import React, { useState, useEffect, useRef } from 'react';

interface ElementPosition {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isImage: boolean;
  isText: boolean;
  hasBackground: boolean;
}

interface VisualEditorProps {
  pageUrl: string;
  websiteId: number;
  articleId?: number;
  onClose: () => void;
  onImageEdit?: (widgetId: string, element: ElementPosition) => void;
  onTextEdit?: (widgetId: string, element: ElementPosition) => void;
}

const VisualEditor: React.FC<VisualEditorProps> = ({
  pageUrl,
  websiteId,
  articleId,
  onClose,
  onImageEdit,
  onTextEdit
}) => {
  const [mode, setMode] = useState<'preview' | 'screenshot'>('preview');
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState(false);
  const [elements, setElements] = useState<ElementPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementPosition | null>(null);
  const [scale, setScale] = useState(1);
  const [iframeUrl, setIframeUrl] = useState(pageUrl);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Try to load screenshot on mode switch
  useEffect(() => {
    if (mode === 'screenshot') {
      loadScreenshotAndElements();
    }
  }, [mode, pageUrl, websiteId]);

  const loadScreenshotAndElements = async () => {
    setLoading(true);
    setScreenshotError(false);

    try {
      // Try to load screenshot
      const screenshotParams = new URLSearchParams({
        url: pageUrl,
        websiteId: websiteId.toString(),
        authenticated: 'true'
      });

      // Check if screenshot service is available
      const healthRes = await fetch('/api/wp-browser/health');
      const healthData = await healthRes.json();

      if (!healthData.puppeteerAvailable) {
        setScreenshotError(true);
        setMode('preview');
        return;
      }

      setScreenshotUrl(`/api/wp-browser/screenshot?${screenshotParams}`);

      // Load element positions
      const elementsParams = new URLSearchParams({
        url: pageUrl,
        websiteId: websiteId.toString()
      });
      const elementsRes = await fetch(`/api/wp-browser/elements?${elementsParams}`);

      if (elementsRes.ok) {
        const data = await elementsRes.json();
        setElements(data.elements || []);
      }
    } catch (err) {
      console.error('Error loading visual editor:', err);
      setScreenshotError(true);
      setMode('preview');
    } finally {
      setLoading(false);
    }
  };

  const handleImageLoad = () => {
    if (imageRef.current && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const imageWidth = imageRef.current.naturalWidth;

      if (imageWidth > containerWidth) {
        setScale(containerWidth / imageWidth);
      }
    }
  };

  const handleElementClick = (element: ElementPosition) => {
    setSelectedElement(element);

    if (element.isImage || element.hasBackground) {
      if (onImageEdit) {
        onImageEdit(element.id, element);
      }
    } else if (element.isText) {
      if (onTextEdit) {
        onTextEdit(element.id, element);
      }
    }
  };

  const getElementStyle = (element: ElementPosition): React.CSSProperties => {
    return {
      position: 'absolute',
      left: `${element.x * scale}px`,
      top: `${element.y * scale}px`,
      width: `${element.width * scale}px`,
      height: `${element.height * scale}px`,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      zIndex: hoveredElement === element.id || selectedElement?.id === element.id ? 10 : 1
    };
  };

  const getElementOverlayClass = (element: ElementPosition): string => {
    const isHovered = hoveredElement === element.id;
    const isSelected = selectedElement?.id === element.id;

    let baseClass = 'border-2 rounded-sm';

    if (element.isImage || element.hasBackground) {
      if (isSelected) {
        baseClass += ' border-brand-gold bg-brand-gold/20';
      } else if (isHovered) {
        baseClass += ' border-brand-gold/70 bg-brand-gold/10';
      } else {
        baseClass += ' border-transparent hover:border-brand-gold/50';
      }
    } else if (element.isText) {
      if (isSelected) {
        baseClass += ' border-brand-cyan bg-brand-cyan/20';
      } else if (isHovered) {
        baseClass += ' border-brand-cyan/70 bg-brand-cyan/10';
      } else {
        baseClass += ' border-transparent hover:border-brand-cyan/50';
      }
    } else {
      baseClass += ' border-transparent';
    }

    return baseClass;
  };

  // Get Elementor edit URL for this page
  const getElementorEditUrl = () => {
    try {
      const url = new URL(pageUrl);
      // Extract post ID from URL if it's a WordPress page
      // Default to wp-admin for editing
      return `${url.origin}/wp-admin/post.php?post=${articleId || 0}&action=elementor`;
    } catch {
      return pageUrl;
    }
  };

  const navigateIframe = (url: string) => {
    setIframeUrl(url);
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-brand-cyan/30 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Visual Editor</h2>

          {/* Mode toggle */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setMode('preview')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                mode === 'preview'
                  ? 'bg-brand-cyan text-slate-900'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Live Preview
            </button>
            <button
              onClick={() => setMode('screenshot')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                mode === 'screenshot'
                  ? 'bg-brand-cyan text-slate-900'
                  : 'text-gray-400 hover:text-white'
              }`}
              title={screenshotError ? 'Screenshot mode requires Puppeteer' : 'Screenshot with overlays'}
            >
              Screenshot Mode
              {screenshotError && <span className="ml-1 text-red-400">*</span>}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Open in Elementor */}
          <a
            href={getElementorEditUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded transition text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit in Elementor
          </a>

          <a
            href={pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition text-sm"
          >
            Open in New Tab
          </a>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl ml-2"
          >
            &times;
          </button>
        </div>
      </header>

      {/* Screenshot Error Banner */}
      {screenshotError && mode === 'screenshot' && (
        <div className="mx-6 mt-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-400 flex items-center gap-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium">Screenshot mode unavailable</p>
            <p className="text-sm text-yellow-400/70">Puppeteer is not installed. Using Live Preview mode instead.</p>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {mode === 'preview' ? (
          /* Live Preview Mode - iframe */
          <>
            {/* URL bar */}
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border-b border-slate-700">
              <button
                onClick={() => iframeRef.current?.contentWindow?.location.reload()}
                className="p-1.5 hover:bg-slate-700 rounded transition"
                title="Refresh"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={() => navigateIframe(pageUrl)}
                className="p-1.5 hover:bg-slate-700 rounded transition"
                title="Home"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </button>
              <input
                type="text"
                value={iframeUrl}
                onChange={(e) => setIframeUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navigateIframe(iframeUrl);
                  }
                }}
                className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
              />
              <button
                onClick={() => navigateIframe(iframeUrl)}
                className="px-3 py-1.5 bg-brand-cyan text-slate-900 rounded text-sm font-medium"
              >
                Go
              </button>
            </div>

            {/* iframe */}
            <div className="flex-1 bg-white">
              <iframe
                ref={iframeRef}
                src={iframeUrl}
                className="w-full h-full border-0"
                title="Page Preview"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
            </div>

            {/* Bottom action bar */}
            <div className="bg-slate-900 border-t border-slate-700 px-4 py-3 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Viewing: <span className="text-white">{iframeUrl}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={getElementorEditUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit in Elementor
                </a>
              </div>
            </div>
          </>
        ) : (
          /* Screenshot Mode */
          <div
            ref={containerRef}
            className="flex-1 overflow-auto p-6"
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-cyan border-t-transparent mb-4" />
                <p className="text-white">Loading screenshot...</p>
              </div>
            ) : screenshotUrl ? (
              <div className="relative inline-block">
                {/* Screenshot */}
                <img
                  ref={imageRef}
                  src={screenshotUrl}
                  alt="Page screenshot"
                  className="max-w-full"
                  onLoad={handleImageLoad}
                  onError={() => {
                    setScreenshotError(true);
                    setMode('preview');
                  }}
                />

                {/* Element overlays */}
                {elements
                  .filter(el => el.isImage || el.isText || el.hasBackground)
                  .map((element) => (
                    <div
                      key={element.id}
                      className={getElementOverlayClass(element)}
                      style={getElementStyle(element)}
                      onMouseEnter={() => setHoveredElement(element.id)}
                      onMouseLeave={() => setHoveredElement(null)}
                      onClick={() => handleElementClick(element)}
                      title={`${element.type} - Click to edit`}
                    >
                      {hoveredElement === element.id && (
                        <div className="absolute -top-6 left-0 px-2 py-0.5 bg-slate-900/90 text-xs text-white rounded whitespace-nowrap">
                          {element.isImage ? 'Image' : element.isText ? 'Text' : 'Element'} ({element.id})
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <svg className="w-16 h-16 opacity-50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>Could not load screenshot</p>
                <button
                  onClick={() => setMode('preview')}
                  className="mt-4 px-4 py-2 bg-brand-cyan text-slate-900 rounded font-medium"
                >
                  Switch to Live Preview
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected element panel (screenshot mode only) */}
      {mode === 'screenshot' && selectedElement && (
        <div className="bg-slate-900 border-t border-brand-cyan/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-white font-medium">
                Selected: {selectedElement.isImage ? 'Image' : 'Text'} Element
              </span>
              <span className="text-gray-500 text-sm font-mono">
                ID: {selectedElement.id}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {selectedElement.isImage && (
                <button
                  onClick={() => onImageEdit && onImageEdit(selectedElement.id, selectedElement)}
                  className="px-4 py-2 bg-brand-gold hover:bg-brand-gold/80 text-slate-900 font-medium rounded transition"
                >
                  Replace Image
                </button>
              )}
              {selectedElement.isText && (
                <button
                  onClick={() => onTextEdit && onTextEdit(selectedElement.id, selectedElement)}
                  className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 text-slate-900 font-medium rounded transition"
                >
                  Edit Text
                </button>
              )}
              <button
                onClick={() => setSelectedElement(null)}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualEditor;
