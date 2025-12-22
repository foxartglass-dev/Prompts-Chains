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
  wpPostId?: number;
  wpUrl?: string;
  websiteId: number;
  articleId?: number;
  onClose: () => void;
  onImageEdit?: (widgetId: string, element: ElementPosition) => void;
  onTextEdit?: (widgetId: string, element: ElementPosition) => void;
}

const VisualEditor: React.FC<VisualEditorProps> = ({
  pageUrl,
  wpPostId,
  wpUrl,
  websiteId,
  articleId,
  onClose,
  onImageEdit,
  onTextEdit
}) => {
  // Default to preview mode since it works reliably
  const [mode, setMode] = useState<'preview' | 'screenshot'>('preview');
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState(false);
  const [elements, setElements] = useState<ElementPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementPosition | null>(null);
  const [scale, setScale] = useState(1);

  // Construct the proper URL for drafts or published pages
  // For drafts: use WordPress preview URL format: ?p=POST_ID&preview=true
  // For published: use the public URL if available
  const getDraftPreviewUrl = () => {
    if (wpPostId && wpUrl) {
      const baseUrl = wpUrl.replace(/\/$/, '');
      return `${baseUrl}/?p=${wpPostId}&preview=true`;
    }
    return pageUrl;
  };

  const effectiveUrl = getDraftPreviewUrl();
  const [iframeUrl, setIframeUrl] = useState(effectiveUrl);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Try to load screenshot on mode switch
  useEffect(() => {
    if (mode === 'screenshot') {
      loadScreenshotAndElements();
    }
  }, [mode, effectiveUrl, websiteId]);

  const loadScreenshotAndElements = async () => {
    setLoading(true);
    setScreenshotError(false);

    try {
      // Use the effective URL (draft preview URL for drafts)
      const targetUrl = effectiveUrl;

      // Try to load screenshot with authentication for draft pages
      const screenshotParams = new URLSearchParams({
        url: targetUrl,
        websiteId: websiteId.toString(),
        authenticated: 'true'  // Always use auth for draft preview
      });

      // Check if screenshot service is available
      const healthRes = await fetch('/api/wp-browser/health');
      const healthData = await healthRes.json();

      if (!healthData.puppeteer) {
        console.warn('Puppeteer not available:', healthData);
        setScreenshotError(true);
        setLoading(false);
        return;
      }

      // Set screenshot URL - the img tag will load it
      setImageLoading(true);
      setScreenshotUrl(`/api/wp-browser/screenshot?${screenshotParams}`);

      // Load element positions (also uses authenticated access)
      const elementsParams = new URLSearchParams({
        url: targetUrl,
        websiteId: websiteId.toString()
      });

      // Add timeout for elements fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const elementsRes = await fetch(`/api/wp-browser/elements?${elementsParams}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (elementsRes.ok) {
          const data = await elementsRes.json();
          setElements(data.elements || []);
        }
      } catch (fetchErr) {
        console.warn('Elements fetch failed or timed out:', fetchErr);
        // Continue anyway - screenshot might still work
      }
    } catch (err) {
      console.error('Error loading visual editor:', err);
      setScreenshotError(true);
      setMode('preview');
    } finally {
      setLoading(false);
    }
  };

  const [imageLoading, setImageLoading] = useState(false);

  const handleImageLoad = () => {
    setImageLoading(false);
    setLoading(false);
    if (imageRef.current && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const imageWidth = imageRef.current.naturalWidth;

      if (imageWidth > containerWidth) {
        setScale(containerWidth / imageWidth);
      }
    }
  };

  const handleImageError = () => {
    setImageLoading(false);
    setLoading(false);
    setScreenshotError(true);
  };

  // Set timeout for screenshot loading
  useEffect(() => {
    if (imageLoading) {
      const timeout = setTimeout(() => {
        console.warn('Screenshot loading timed out after 45 seconds');
        setImageLoading(false);
        setLoading(false);
        setScreenshotError(true);
      }, 45000);
      return () => clearTimeout(timeout);
    }
  }, [imageLoading]);

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
    if (wpPostId && wpUrl) {
      const baseUrl = wpUrl.replace(/\/$/, '');
      return `${baseUrl}/wp-admin/post.php?post=${wpPostId}&action=elementor`;
    }
    // Fallback to pageUrl origin if available
    try {
      const url = new URL(pageUrl || effectiveUrl);
      return `${url.origin}/wp-admin/post.php?post=${wpPostId || articleId || 0}&action=elementor`;
    } catch {
      return effectiveUrl;
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

          {/* Mode indicator - Live Preview is the primary mode */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1">
            <span className="px-3 py-1.5 bg-brand-cyan text-slate-900 rounded text-sm font-medium">
              Live Preview
            </span>
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
            href={effectiveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition text-sm"
            title={wpPostId ? "Open draft preview (requires login)" : "Open page"}
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

      {/* Draft Page Notice */}
      {wpPostId && (
        <div className="mx-6 mt-4 p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-400 flex items-center gap-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-medium">Draft Preview</p>
            <p className="text-sm text-blue-400/70">
              You may need to log into WordPress in this browser first. Click <strong>Edit in Elementor</strong> to edit images and content directly.
            </p>
          </div>
        </div>
      )}

      {/* Main content - Live Preview */}
      <div className="flex-1 overflow-hidden flex flex-col">
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
            onClick={() => navigateIframe(effectiveUrl)}
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
      </div>

    </div>
  );
};

export default VisualEditor;
