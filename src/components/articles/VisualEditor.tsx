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
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [elements, setElements] = useState<ElementPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementPosition | null>(null);
  const [editMode, setEditMode] = useState<'image' | 'text' | null>(null);
  const [scale, setScale] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    loadScreenshotAndElements();
  }, [pageUrl, websiteId]);

  const loadScreenshotAndElements = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load screenshot
      const screenshotParams = new URLSearchParams({
        url: pageUrl,
        websiteId: websiteId.toString(),
        authenticated: 'true'
      });
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
      } else {
        console.warn('Could not load element positions - overlay editing will be limited');
      }
    } catch (err) {
      console.error('Error loading visual editor:', err);
      setError('Failed to load page for editing');
    } finally {
      setLoading(false);
    }
  };

  const handleImageLoad = () => {
    if (imageRef.current && containerRef.current) {
      // Calculate scale factor if image is larger than container
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
      setEditMode('image');
      if (onImageEdit) {
        onImageEdit(element.id, element);
      }
    } else if (element.isText) {
      setEditMode('text');
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-lg p-8 flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-cyan border-t-transparent" />
          <p className="text-white">Loading visual editor...</p>
          <p className="text-gray-500 text-sm">Capturing page screenshot</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-brand-cyan/30">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Visual Editor</h2>
          <span className="text-sm text-gray-400 truncate max-w-md">
            {pageUrl}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-400 mr-4">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 border-2 border-brand-gold rounded-sm" />
              Images
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 border-2 border-brand-cyan rounded-sm" />
              Text
            </span>
          </div>

          <button
            onClick={loadScreenshotAndElements}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded transition flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>

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

      {/* Error message */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Main content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-6"
      >
        {screenshotUrl ? (
          <div className="relative inline-block">
            {/* Screenshot */}
            <img
              ref={imageRef}
              src={screenshotUrl}
              alt="Page screenshot"
              className="max-w-full"
              onLoad={handleImageLoad}
              onError={() => setError('Failed to load screenshot. Puppeteer may not be available.')}
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
                  {/* Element label on hover */}
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
            <p className="text-sm mt-2">Make sure Puppeteer is installed and the page is accessible</p>
          </div>
        )}
      </div>

      {/* Selected element panel */}
      {selectedElement && (
        <div className="bg-slate-900 border-t border-brand-cyan/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-white font-medium">
                Selected: {selectedElement.isImage ? 'Image' : 'Text'} Element
              </span>
              <span className="text-gray-500 text-sm font-mono">
                ID: {selectedElement.id}
              </span>
              <span className="text-gray-500 text-sm">
                {Math.round(selectedElement.width)} x {Math.round(selectedElement.height)}
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
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions if no elements */}
      {elements.length === 0 && !loading && screenshotUrl && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-slate-800/90 rounded-lg px-6 py-3 text-center">
          <p className="text-gray-300 text-sm">
            Element detection requires Puppeteer to be installed
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Screenshot is available for reference, but clickable editing is disabled
          </p>
        </div>
      )}
    </div>
  );
};

export default VisualEditor;
