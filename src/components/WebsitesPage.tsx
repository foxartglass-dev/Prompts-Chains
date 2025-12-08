import React, { useState, useEffect } from 'react';

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
    referenceImages: [] as string[],
    styleDNA: null as any,
    imagesPerArticle: 4
  });
  const [newReferenceUrl, setNewReferenceUrl] = useState('');
  const [extractingDNA, setExtractingDNA] = useState(false);

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
      // API returns { websites: [...] }
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
      // API returns { clients: [...] }
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

    // Load website's image settings
    try {
      const res = await fetch(`/api/images/style-dna/${website.id}`);
      if (res.ok) {
        const data = await res.json();
        setImageSettings({
          enabled: data.enabled || false,
          openaiKey: '',
          replicateKey: '',
          referenceImages: data.referenceImages || [],
          styleDNA: data.styleDNA || null,
          imagesPerArticle: 4
        });
      }
    } catch (error) {
      console.error('Failed to load image settings:', error);
    }

    // Load published pages (placeholder - would need to fetch from WP or database)
    setPages([]);
    setLoadingPages(false);
  };

  const handleExtractStyleDNA = async () => {
    if (imageSettings.referenceImages.length === 0) {
      alert('Please add at least one reference image URL');
      return;
    }

    setExtractingDNA(true);
    try {
      const res = await fetch('/api/images/extract-style-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceImages: imageSettings.referenceImages,
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
          referenceImages: imageSettings.referenceImages,
          enabled: imageSettings.enabled
        })
      });
      alert('Image settings saved!');
    } catch (error) {
      console.error('Failed to save image settings:', error);
      alert('Failed to save settings');
    }
  };

  const addReferenceImage = () => {
    if (newReferenceUrl && !imageSettings.referenceImages.includes(newReferenceUrl)) {
      setImageSettings(prev => ({
        ...prev,
        referenceImages: [...prev.referenceImages, newReferenceUrl]
      }));
      setNewReferenceUrl('');
    }
  };

  const removeReferenceImage = (url: string) => {
    setImageSettings(prev => ({
      ...prev,
      referenceImages: prev.referenceImages.filter(u => u !== url)
    }));
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
              {view === 'list' ? '🌐 All Websites' : `🌐 ${selectedWebsite?.name}`}
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

              {/* Page Hierarchy - Placeholder for Analytics */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-gold/30">
                <h3 className="text-lg font-bold text-brand-gold mb-4">📄 Page Hierarchy</h3>
                <p className="text-gray-400 text-sm mb-4">
                  This section will show all pages on your website with their publishing status.
                </p>
                <div className="bg-slate-900/50 rounded-lg p-4 border border-dashed border-brand-gold/30">
                  <p className="text-center text-gray-500">
                    🚧 Coming Soon: Website page tree with publish status, scheduled dates, and content preview
                  </p>
                  <div className="mt-4 text-xs text-gray-600 space-y-1">
                    <p>• Published pages (green)</p>
                    <p>• Draft pages (yellow)</p>
                    <p>• Scheduled pages with drip feed dates (blue)</p>
                    <p>• Click to preview or edit in Elementor</p>
                  </div>
                </div>
              </div>

              {/* AI Image Generation Settings */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-green-500/30">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-green-400">🎨 AI Image Generation</h3>
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
                </div>

                {imageSettings.enabled && (
                  <div className="space-y-6">
                    {/* API Keys */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-brand-gold mb-2">OpenAI API Key</label>
                        <input
                          type="password"
                          placeholder="sk-..."
                          value={imageSettings.openaiKey}
                          onChange={e => setImageSettings(prev => ({ ...prev, openaiKey: e.target.value }))}
                          className="w-full bg-slate-900/50 border border-brand-gold/50 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-brand-gold mb-2">Replicate API Key</label>
                        <input
                          type="password"
                          placeholder="r8_..."
                          value={imageSettings.replicateKey}
                          onChange={e => setImageSettings(prev => ({ ...prev, replicateKey: e.target.value }))}
                          className="w-full bg-slate-900/50 border border-brand-gold/50 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                    </div>

                    {/* Reference Images */}
                    <div>
                      <label className="block text-sm text-brand-gold mb-2">Reference Images for Style DNA</label>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="url"
                          placeholder="https://example.com/image.jpg"
                          value={newReferenceUrl}
                          onChange={e => setNewReferenceUrl(e.target.value)}
                          className="flex-1 bg-slate-900/50 border border-brand-gold/50 rounded-lg px-3 py-2 text-white"
                        />
                        <button
                          onClick={addReferenceImage}
                          className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark rounded-lg text-slate-900 font-semibold transition"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {imageSettings.referenceImages.map((url, i) => (
                          <div key={i} className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-3 py-1 border border-brand-gold/30">
                            <span className="text-xs text-gray-400 truncate max-w-[200px]">{url}</span>
                            <button onClick={() => removeReferenceImage(url)} className="text-red-400 hover:text-red-300">×</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Extract Style DNA */}
                    <button
                      onClick={handleExtractStyleDNA}
                      disabled={extractingDNA || imageSettings.referenceImages.length === 0}
                      className="w-full py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-lg text-white font-bold transition disabled:opacity-50"
                    >
                      {extractingDNA ? 'Extracting...' : '🧬 Extract Style DNA'}
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
                      💾 Save Image Settings
                    </button>
                  </div>
                )}
              </div>

              {/* Analytics Placeholder */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
                <h3 className="text-lg font-bold text-purple-400 mb-4">📊 Analytics</h3>
                <div className="bg-slate-900/50 rounded-lg p-4 border border-dashed border-purple-500/30">
                  <p className="text-center text-gray-500">
                    🚧 Coming Soon: Rank tracking, keyword positions, and growth analytics
                  </p>
                  <div className="mt-4 text-xs text-gray-600 space-y-1">
                    <p>• Google Maps rank tracking grid</p>
                    <p>• Keyword position history</p>
                    <p>• Week-over-week growth graphs</p>
                    <p>• Monthly client reports</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebsitesPage;
