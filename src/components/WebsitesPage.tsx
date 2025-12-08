import React, { useState, useEffect, useRef } from 'react';

interface Website {
  id: number;
  client_id: number;
  client_name?: string;
  name: string;
  url: string;
  wp_username?: string;
  wp_app_password?: string;
  image_generation_enabled?: boolean;
  image_style_dna?: any;
  image_reference_urls?: string[];
  articles_count?: number;
  pages_count?: number;
  created_at: string;
}

interface WebsitePage {
  id: number;
  title: string;
  url: string;
  status: 'published' | 'draft' | 'scheduled';
  scheduled_date?: string;
  published_at?: string;
}

interface ReferenceImage {
  url: string;
  filename?: string;
  tags?: string[];
}

interface WebsitesPageProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWebsite?: (websiteId: number) => void;
}

const WebsitesPage: React.FC<WebsitesPageProps> = ({ isOpen, onClose, onSelectWebsite }) => {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);

  // Website pages (for hierarchy view)
  const [pages, setPages] = useState<WebsitePage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);

  // Image settings for selected website
  const [imageSettings, setImageSettings] = useState({
    enabled: false,
    openaiKey: '',
    replicateKey: '',
    referenceImages: [] as ReferenceImage[],
    styleDNA: null as any,
    imagesPerArticle: 4
  });
  const [loadingImageSettings, setLoadingImageSettings] = useState(false);
  const [newReferenceUrl, setNewReferenceUrl] = useState('');
  const [extractingDNA, setExtractingDNA] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  // API Keys Modal
  const [showApiKeysModal, setShowApiKeysModal] = useState(false);
  const [tempApiKeys, setTempApiKeys] = useState({ openai: '', replicate: '' });

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchWebsites();
      fetchClients();
    }
  }, [isOpen]);

  const fetchWebsites = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/websites');
      const data = await res.json();
      setWebsites(data.websites || []);
    } catch (error) {
      console.error('Failed to fetch websites:', error);
      setWebsites([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      setClients(data.clients || []);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
      setClients([]);
    }
  };

  const handleSelectWebsite = async (website: Website) => {
    setSelectedWebsite(website);
    setView('detail');
    setLoadingPages(true);
    setLoadingImageSettings(true);

    // Load website's image settings
    try {
      const res = await fetch(`/api/images/style-dna/${website.id}`);
      if (res.ok) {
        const data = await res.json();
        // Convert simple URLs to ReferenceImage objects
        const images = (data.referenceImages || []).map((img: string | ReferenceImage) =>
          typeof img === 'string' ? { url: img } : img
        );
        setImageSettings({
          enabled: data.enabled || false,
          openaiKey: '',
          replicateKey: '',
          referenceImages: images,
          styleDNA: data.styleDNA || null,
          imagesPerArticle: 4
        });
      } else {
        setImageSettings({
          enabled: false,
          openaiKey: '',
          replicateKey: '',
          referenceImages: [],
          styleDNA: null,
          imagesPerArticle: 4
        });
      }
    } catch (error) {
      console.error('Failed to load image settings:', error);
      setImageSettings({
        enabled: false,
        openaiKey: '',
        replicateKey: '',
        referenceImages: [],
        styleDNA: null,
        imagesPerArticle: 4
      });
    } finally {
      setLoadingImageSettings(false);
    }

    setPages([]);
    setLoadingPages(false);
  };

  const handleExtractStyleDNA = async () => {
    if (imageSettings.referenceImages.length === 0) {
      alert('Please add at least one reference image');
      return;
    }

    setExtractingDNA(true);
    try {
      const res = await fetch('/api/images/extract-style-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceImages: imageSettings.referenceImages.map(img => img.url),
          websiteId: selectedWebsite?.id,
          openaiApiKey: imageSettings.openaiKey || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        setImageSettings(prev => ({ ...prev, styleDNA: data.styleDNA }));
        alert('Style DNA extracted successfully!');
      } else {
        alert('Failed to extract Style DNA: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to extract Style DNA:', error);
      alert('Failed to extract Style DNA');
    } finally {
      setExtractingDNA(false);
    }
  };

  const handleSaveImageSettings = async () => {
    if (!selectedWebsite) return;

    try {
      await fetch(`/api/images/style-dna/${selectedWebsite.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleDNA: imageSettings.styleDNA,
          referenceImages: imageSettings.referenceImages.map(img => img.url),
          enabled: imageSettings.enabled
        })
      });
      alert('Image settings saved!');
    } catch (error) {
      console.error('Failed to save image settings:', error);
      alert('Failed to save settings');
    }
  };

  const addReferenceUrl = () => {
    if (newReferenceUrl && !imageSettings.referenceImages.some(img => img.url === newReferenceUrl)) {
      setImageSettings(prev => ({
        ...prev,
        referenceImages: [...prev.referenceImages, { url: newReferenceUrl }]
      }));
      setNewReferenceUrl('');
    }
  };

  const removeReferenceImage = (url: string) => {
    setImageSettings(prev => ({
      ...prev,
      referenceImages: prev.referenceImages.filter(img => img.url !== url)
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedWebsite) return;

    setUploadingImages(true);
    const formData = new FormData();
    formData.append('websiteId', selectedWebsite.id.toString());

    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }

    try {
      const res = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.success && data.images) {
        const newImages: ReferenceImage[] = data.images.map((img: any) => ({
          url: img.url,
          filename: img.filename,
          tags: img.tags || []
        }));
        setImageSettings(prev => ({
          ...prev,
          referenceImages: [...prev.referenceImages, ...newImages]
        }));
      } else {
        alert('Failed to upload images: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to upload images:', error);
      alert('Failed to upload images');
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveApiKeys = () => {
    setImageSettings(prev => ({
      ...prev,
      openaiKey: tempApiKeys.openai,
      replicateKey: tempApiKeys.replicate
    }));
    setShowApiKeysModal(false);
  };

  const openApiKeysModal = () => {
    setTempApiKeys({
      openai: imageSettings.openaiKey,
      replicate: imageSettings.replicateKey
    });
    setShowApiKeysModal(true);
  };

  const filteredWebsites = filterClient === 'all'
    ? websites
    : websites.filter(w => w.client_id === parseInt(filterClient));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden border-2 border-brand-cyan shadow-glow-cyan">
        {/* Header */}
        <div className="bg-slate-800/50 px-6 py-4 border-b border-brand-cyan/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {view === 'detail' && (
              <button
                onClick={() => {
                  setView('list');
                  setSelectedWebsite(null);
                }}
                className="p-2 hover:bg-slate-700 rounded-lg transition"
              >
                <svg className="w-5 h-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-2xl font-bold text-brand-gold">
              {view === 'list' ? 'All Websites' : selectedWebsite?.name}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {view === 'list' && (
              <select
                value={filterClient}
                onChange={e => setFilterClient(e.target.value)}
                className="bg-slate-800 border border-brand-gold/50 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="all">All Clients</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Website List View */}
          {view === 'list' && (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center text-gray-400 py-12">Loading websites...</div>
              ) : filteredWebsites.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  No websites found. Add websites through the Agency Manager.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredWebsites.map(website => (
                    <div
                      key={website.id}
                      onClick={() => handleSelectWebsite(website)}
                      className="bg-slate-800/50 rounded-xl p-5 border border-brand-cyan/30 hover:border-brand-cyan cursor-pointer transition-all hover:shadow-glow-cyan"
                    >
                      <h3 className="text-lg font-bold text-white mb-1">{website.name}</h3>
                      <a
                        href={website.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-cyan hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        {website.url}
                      </a>
                      {website.client_name && (
                        <p className="text-xs text-gray-400 mt-2">Client: {website.client_name}</p>
                      )}
                      <div className="mt-3 flex gap-2">
                        {website.image_generation_enabled && (
                          <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                            AI Images
                          </span>
                        )}
                        {website.wp_username && (
                          <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full">
                            WP Connected
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Website Detail View */}
          {view === 'detail' && selectedWebsite && (
            <div className="space-y-6">
              {/* Website Info & Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-5 border border-brand-cyan/30">
                  <h4 className="text-sm text-gray-400 mb-1">Website URL</h4>
                  <a href={selectedWebsite.url} target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:underline">
                    {selectedWebsite.url}
                  </a>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-brand-gold/30">
                  <h4 className="text-sm text-gray-400 mb-1">Client</h4>
                  <p className="text-white font-semibold">{selectedWebsite.client_name || 'No client'}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-purple-500/30">
                  <h4 className="text-sm text-gray-400 mb-1">WordPress Status</h4>
                  <p className={`font-semibold ${selectedWebsite.wp_username ? 'text-green-400' : 'text-yellow-400'}`}>
                    {selectedWebsite.wp_username ? 'Connected' : 'Not Configured'}
                  </p>
                </div>
              </div>

              {/* Page Hierarchy - Placeholder */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-gold/30">
                <h3 className="text-lg font-bold text-brand-gold mb-4">Page Hierarchy</h3>
                <div className="bg-slate-900/50 rounded-lg p-4 border border-dashed border-brand-gold/30">
                  <p className="text-center text-gray-500">
                    Coming Soon: Website page tree with publish status, scheduled dates, and content preview
                  </p>
                </div>
              </div>

              {/* AI Image Generation Settings */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-green-500/30">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-green-400">AI Image Generation</h3>
                  <div className="flex items-center gap-4">
                    {/* API Keys Button */}
                    <button
                      onClick={openApiKeysModal}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-gray-300 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      API Keys
                      {(imageSettings.openaiKey || imageSettings.replicateKey) && (
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      )}
                    </button>
                    {loadingImageSettings ? (
                      <span className="text-sm text-gray-400">Loading...</span>
                    ) : (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <span className="text-sm text-gray-400">Enable</span>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={imageSettings.enabled}
                            onChange={e => setImageSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                            className="sr-only"
                          />
                          <div className={`w-12 h-6 rounded-full transition ${imageSettings.enabled ? 'bg-green-500' : 'bg-slate-600'}`}></div>
                          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition transform ${imageSettings.enabled ? 'translate-x-6' : ''}`}></div>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                {imageSettings.enabled && (
                  <div className="space-y-6">
                    {/* Reference Images Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm text-brand-gold font-medium">Reference Images for Style DNA</label>
                        <span className="text-xs text-gray-500">{imageSettings.referenceImages.length} images</span>
                      </div>

                      {/* Upload and URL Add Row */}
                      <div className="flex gap-2 mb-4">
                        {/* File Upload Button */}
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          multiple
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImages}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white font-semibold transition disabled:opacity-50"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          {uploadingImages ? 'Uploading...' : 'Upload Images'}
                        </button>

                        {/* URL Input */}
                        <div className="flex-1 flex gap-2">
                          <input
                            type="url"
                            placeholder="Or paste image URL..."
                            value={newReferenceUrl}
                            onChange={e => setNewReferenceUrl(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addReferenceUrl()}
                            className="flex-1 bg-slate-900/50 border border-brand-gold/50 rounded-lg px-3 py-2 text-white text-sm"
                          />
                          <button
                            onClick={addReferenceUrl}
                            className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark rounded-lg text-slate-900 font-semibold transition"
                          >
                            Add URL
                          </button>
                        </div>
                      </div>

                      {/* Image Gallery */}
                      {imageSettings.referenceImages.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {imageSettings.referenceImages.map((img, i) => (
                            <div key={i} className="relative group">
                              <div className="aspect-square bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                                <img
                                  src={img.url}
                                  alt={img.filename || `Reference ${i + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23374151" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="%239CA3AF" font-size="12">No Preview</text></svg>';
                                  }}
                                />
                              </div>
                              {/* Delete button */}
                              <button
                                onClick={() => removeReferenceImage(img.url)}
                                className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-400 rounded-full opacity-0 group-hover:opacity-100 transition"
                              >
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              {/* Filename */}
                              {img.filename && (
                                <p className="text-xs text-gray-500 truncate mt-1">{img.filename}</p>
                              )}
                              {/* Tags */}
                              {img.tags && img.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {img.tags.slice(0, 2).map((tag, ti) => (
                                    <span key={ti} className="text-[10px] px-1.5 py-0.5 bg-slate-700 rounded text-gray-400">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-slate-900/50 rounded-lg p-8 border-2 border-dashed border-slate-700 text-center">
                          <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-gray-500 text-sm">No reference images yet</p>
                          <p className="text-gray-600 text-xs mt-1">Upload images or add URLs to build your Style DNA</p>
                        </div>
                      )}
                    </div>

                    {/* Extract Style DNA */}
                    <button
                      onClick={handleExtractStyleDNA}
                      disabled={extractingDNA || imageSettings.referenceImages.length === 0}
                      className="w-full py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-lg text-white font-bold transition disabled:opacity-50"
                    >
                      {extractingDNA ? 'Extracting Style DNA...' : 'Extract Style DNA'}
                    </button>

                    {/* Style DNA Preview */}
                    {imageSettings.styleDNA && (
                      <div className="bg-slate-900/50 rounded-lg p-4 border border-green-500/30">
                        <h4 className="text-sm font-bold text-green-400 mb-2">Style DNA Template</h4>
                        <p className="text-xs text-gray-300 font-mono bg-slate-800/50 p-3 rounded">
                          {imageSettings.styleDNA.styleTemplate}
                        </p>
                      </div>
                    )}

                    {/* Save Button */}
                    <button
                      onClick={handleSaveImageSettings}
                      className="w-full py-3 bg-brand-cyan hover:bg-brand-cyan-dark rounded-lg text-slate-900 font-bold transition"
                    >
                      Save Image Settings
                    </button>
                  </div>
                )}
              </div>

              {/* Analytics Placeholder */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
                <h3 className="text-lg font-bold text-purple-400 mb-4">Analytics</h3>
                <div className="bg-slate-900/50 rounded-lg p-4 border border-dashed border-purple-500/30">
                  <p className="text-center text-gray-500">
                    Coming Soon: Rank tracking, keyword positions, and growth analytics
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* API Keys Modal */}
      {showApiKeysModal && (
        <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-md border border-brand-gold/50 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-brand-gold">API Keys</h3>
              <button onClick={() => setShowApiKeysModal(false)} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-400 mb-4">
                Enter your API keys for AI image generation. These are stored locally and used only for this session.
              </p>
              <div>
                <label className="block text-sm text-brand-gold mb-2">OpenAI API Key</label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={tempApiKeys.openai}
                  onChange={e => setTempApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                  className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Used for Style DNA extraction (GPT-4o-mini Vision)</p>
              </div>
              <div>
                <label className="block text-sm text-brand-gold mb-2">Replicate API Key</label>
                <input
                  type="password"
                  placeholder="r8_..."
                  value={tempApiKeys.replicate}
                  onChange={e => setTempApiKeys(prev => ({ ...prev, replicate: e.target.value }))}
                  className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Used for FLUX 1.1 Pro image generation (~$0.04/image)</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowApiKeysModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKeys}
                className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark rounded-lg text-slate-900 font-semibold transition"
              >
                Save Keys
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebsitesPage;
