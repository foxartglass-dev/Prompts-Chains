import React, { useState, useEffect } from 'react';

interface ImageVersion {
  id: number;
  article_id: number;
  elementor_widget_id: string;
  version: number;
  image_url: string;
  wp_media_id: number | null;
  image_prompt: string | null;
  replacement_source: string;
  created_at: string;
  article_keyword?: string;
  wp_post_url?: string;
}

interface MediaLibraryViewProps {
  websiteId?: number;
}

const MediaLibraryView: React.FC<MediaLibraryViewProps> = ({ websiteId }) => {
  const [images, setImages] = useState<ImageVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ImageVersion | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [versionHistory, setVersionHistory] = useState<ImageVersion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (websiteId) {
      fetchImages();
    } else {
      setImages([]);
      setLoading(false);
    }
  }, [websiteId]);

  const fetchImages = async () => {
    if (!websiteId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/image-versions/by-website/${websiteId}`);
      if (res.ok) {
        const data = await res.json();
        setImages(data.versions || []);
      }
    } catch (err) {
      console.error('Failed to fetch images:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVersionHistory = async (articleId: number, widgetId: string) => {
    try {
      const res = await fetch(`/api/image-versions/${articleId}/widget/${widgetId}`);
      if (res.ok) {
        const data = await res.json();
        setVersionHistory(data.versions || []);
        setShowHistory(true);
      }
    } catch (err) {
      console.error('Failed to fetch version history:', err);
    }
  };

  const restoreVersion = async (version: ImageVersion) => {
    if (!confirm(`Restore to version ${version.version}? This will create a new version with this image.`)) return;

    setRestoring(true);
    try {
      // Create a new version with the old image
      await fetch('/api/image-versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: version.article_id,
          elementorWidgetId: version.elementor_widget_id,
          imageUrl: version.image_url,
          source: 'url' // Restored from history
        })
      });

      // Refresh
      fetchImages();
      if (selectedImage) {
        fetchVersionHistory(selectedImage.article_id, selectedImage.elementor_widget_id);
      }
    } catch (err) {
      console.error('Failed to restore version:', err);
    } finally {
      setRestoring(false);
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'ai_generated':
        return <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">AI Generated</span>;
      case 'upload':
        return <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">Uploaded</span>;
      case 'url':
        return <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">URL</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-brand-cyan animate-pulse">Loading media...</div>
      </div>
    );
  }

  if (!websiteId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
        <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p>Select a website to view media</p>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
        <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p>No image versions found</p>
        <p className="text-sm">Image versions will appear here when you replace images in articles</p>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Main content */}
      <div className="flex-1 flex flex-col p-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-400">
            {images.length} image version{images.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition ${viewMode === 'grid' ? 'bg-brand-cyan text-slate-900' : 'bg-slate-700 text-gray-400 hover:text-white'}`}
              title="Grid view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition ${viewMode === 'list' ? 'bg-brand-cyan text-slate-900' : 'bg-slate-700 text-gray-400 hover:text-white'}`}
              title="List view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Grid/List view */}
        <div className="flex-1 overflow-auto">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {images.map((img) => (
                <div
                  key={img.id}
                  onClick={() => setSelectedImage(img)}
                  className={`group relative aspect-square bg-slate-800 rounded-lg overflow-hidden cursor-pointer border-2 transition ${
                    selectedImage?.id === img.id ? 'border-brand-cyan' : 'border-transparent hover:border-brand-cyan/50'
                  }`}
                >
                  <img
                    src={img.image_url}
                    alt={img.article_keyword || 'Image'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition">
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-white text-xs font-medium truncate">
                        {img.article_keyword || 'Unknown'}
                      </p>
                      <p className="text-gray-400 text-xs">v{img.version}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {images.map((img) => (
                <div
                  key={img.id}
                  onClick={() => setSelectedImage(img)}
                  className={`flex items-center gap-4 p-3 bg-slate-800 rounded-lg cursor-pointer border-2 transition ${
                    selectedImage?.id === img.id ? 'border-brand-cyan' : 'border-transparent hover:border-brand-cyan/50'
                  }`}
                >
                  <img
                    src={img.image_url}
                    alt={img.article_keyword || 'Image'}
                    className="w-16 h-16 object-cover rounded"
                    loading="lazy"
                  />
                  <div className="flex-1">
                    <p className="text-white font-medium">{img.article_keyword || 'Unknown'}</p>
                    <p className="text-gray-400 text-sm">Widget: {img.elementor_widget_id}</p>
                    <p className="text-gray-500 text-xs">
                      {new Date(img.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-brand-cyan text-sm font-medium">v{img.version}</span>
                    {getSourceBadge(img.replacement_source)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details sidebar */}
      {selectedImage && (
        <div className="w-80 border-l border-brand-cyan/30 bg-slate-900 p-4 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Details</h3>
            <button
              onClick={() => setSelectedImage(null)}
              className="text-gray-400 hover:text-white"
            >
              &times;
            </button>
          </div>

          <img
            src={selectedImage.image_url}
            alt="Selected"
            className="w-full rounded-lg mb-4"
          />

          <div className="space-y-3 text-sm">
            <div>
              <label className="text-gray-500">Article</label>
              <p className="text-white">{selectedImage.article_keyword || 'Unknown'}</p>
            </div>

            <div>
              <label className="text-gray-500">Version</label>
              <p className="text-white">{selectedImage.version}</p>
            </div>

            <div>
              <label className="text-gray-500">Widget ID</label>
              <p className="text-white font-mono text-xs">{selectedImage.elementor_widget_id}</p>
            </div>

            <div>
              <label className="text-gray-500">Source</label>
              <div className="mt-1">{getSourceBadge(selectedImage.replacement_source)}</div>
            </div>

            {selectedImage.image_prompt && (
              <div>
                <label className="text-gray-500">AI Prompt</label>
                <p className="text-white text-xs bg-slate-800 p-2 rounded mt-1">
                  {selectedImage.image_prompt}
                </p>
              </div>
            )}

            <div>
              <label className="text-gray-500">Created</label>
              <p className="text-white">{new Date(selectedImage.created_at).toLocaleString()}</p>
            </div>

            {selectedImage.wp_post_url && (
              <a
                href={selectedImage.wp_post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full mt-4 px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 text-slate-900 font-medium text-center rounded-lg transition"
              >
                View Page
              </a>
            )}

            {/* Version History Button */}
            <button
              onClick={() => fetchVersionHistory(selectedImage.article_id, selectedImage.elementor_widget_id)}
              className="w-full mt-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium text-center rounded-lg transition"
            >
              View History
            </button>
          </div>

          {/* Version History Panel */}
          {showHistory && versionHistory.length > 0 && (
            <div className="mt-4 pt-4 border-t border-brand-cyan/20">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-400">Version History</h4>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-500 hover:text-white text-sm"
                >
                  Hide
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {versionHistory.map((ver) => (
                  <div
                    key={ver.id}
                    className={`flex items-center gap-2 p-2 rounded-lg transition ${
                      ver.id === selectedImage.id
                        ? 'bg-brand-cyan/20 border border-brand-cyan'
                        : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  >
                    <img
                      src={ver.image_url}
                      alt={`v${ver.version}`}
                      className="w-10 h-10 object-cover rounded"
                    />
                    <div className="flex-1">
                      <p className="text-white text-xs font-medium">v{ver.version}</p>
                      <p className="text-gray-500 text-xs">
                        {new Date(ver.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {ver.id !== selectedImage.id && (
                      <button
                        onClick={() => restoreVersion(ver)}
                        disabled={restoring}
                        className="px-2 py-1 bg-brand-gold/20 hover:bg-brand-gold/30 text-brand-gold text-xs rounded transition disabled:opacity-50"
                      >
                        {restoring ? '...' : 'Restore'}
                      </button>
                    )}
                    {ver.id === selectedImage.id && (
                      <span className="px-2 py-1 bg-brand-cyan/20 text-brand-cyan text-xs rounded">
                        Current
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MediaLibraryView;
