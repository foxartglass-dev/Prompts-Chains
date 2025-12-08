import React, { useState, useEffect } from 'react';

interface Client {
  id: number;
  name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
  created_at: string;
  // Aggregated data
  websites?: Website[];
  locations?: Location[];
  workflows?: Workflow[];
  articles_count?: number;
}

interface Website {
  id: number;
  client_id: number;
  name: string;
  url: string;
  wp_username?: string;
  image_generation_enabled?: boolean;
  image_style_dna?: any;
}

interface Location {
  id: number;
  client_id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
}

interface Workflow {
  id: number;
  name: string;
  website_id?: number;
  website_name?: string;
  created_at: string;
}

interface ClientsPageProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWebsite?: (websiteId: number) => void;
}

const ClientsPage: React.FC<ClientsPageProps> = ({ isOpen, onClose, onSelectWebsite }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'client' | 'website'>('list');

  // Image generation settings for website
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
      fetchClients();
    }
  }, [isOpen]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();

      // Fetch additional data for each client
      const enrichedClients = await Promise.all(data.map(async (client: Client) => {
        const [websitesRes, locationsRes, workflowsRes] = await Promise.all([
          fetch(`/api/websites?clientId=${client.id}`),
          fetch(`/api/locations?clientId=${client.id}`),
          fetch(`/api/workflows?clientId=${client.id}`)
        ]);

        const websites = await websitesRes.json();
        const locations = await locationsRes.json();
        const workflows = await workflowsRes.json();

        return {
          ...client,
          websites: websites || [],
          locations: locations || [],
          workflows: workflows || []
        };
      }));

      setClients(enrichedClients);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setView('client');
  };

  const handleSelectWebsite = async (website: Website) => {
    setSelectedWebsite(website);
    setView('website');

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden border-2 border-brand-cyan shadow-glow-cyan">
        {/* Header */}
        <div className="bg-slate-800/50 px-6 py-4 border-b border-brand-cyan/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {view !== 'list' && (
              <button
                onClick={() => {
                  if (view === 'website') {
                    setView('client');
                    setSelectedWebsite(null);
                  } else {
                    setView('list');
                    setSelectedClient(null);
                  }
                }}
                className="p-2 hover:bg-slate-700 rounded-lg transition"
              >
                <svg className="w-5 h-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-2xl font-bold text-brand-gold">
              {view === 'list' && '👤 Clients'}
              {view === 'client' && selectedClient?.name}
              {view === 'website' && `🌐 ${selectedWebsite?.name}`}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Client List View */}
          {view === 'list' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? (
                <div className="col-span-full text-center text-gray-400 py-12">Loading clients...</div>
              ) : clients.length === 0 ? (
                <div className="col-span-full text-center text-gray-400 py-12">
                  No clients found. Add clients in the Agency Manager.
                </div>
              ) : (
                clients.map(client => (
                  <div
                    key={client.id}
                    onClick={() => handleSelectClient(client)}
                    className="bg-slate-800/50 rounded-xl p-5 border border-brand-gold/30 hover:border-brand-gold cursor-pointer transition-all hover:shadow-glow-gold"
                  >
                    <h3 className="text-xl font-bold text-white mb-2">{client.name}</h3>
                    {client.contact_name && (
                      <p className="text-sm text-gray-400">Contact: {client.contact_name}</p>
                    )}
                    <div className="mt-4 flex gap-4 text-xs">
                      <span className="px-2 py-1 bg-brand-cyan/20 text-brand-cyan rounded-full">
                        {client.websites?.length || 0} Websites
                      </span>
                      <span className="px-2 py-1 bg-brand-gold/20 text-brand-gold rounded-full">
                        {client.locations?.length || 0} Locations
                      </span>
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full">
                        {client.workflows?.length || 0} Workflows
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Client Detail View */}
          {view === 'client' && selectedClient && (
            <div className="space-y-6">
              {/* Client Info */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-gold/30">
                <h3 className="text-lg font-bold text-brand-gold mb-4">Client Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Contact:</span>
                    <span className="text-white ml-2">{selectedClient.contact_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Email:</span>
                    <span className="text-white ml-2">{selectedClient.contact_email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Phone:</span>
                    <span className="text-white ml-2">{selectedClient.contact_phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Created:</span>
                    <span className="text-white ml-2">{new Date(selectedClient.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {selectedClient.notes && (
                  <div className="mt-4">
                    <span className="text-gray-400">Notes:</span>
                    <p className="text-white mt-1">{selectedClient.notes}</p>
                  </div>
                )}
              </div>

              {/* Websites */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
                <h3 className="text-lg font-bold text-brand-cyan mb-4">🌐 Websites ({selectedClient.websites?.length || 0})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedClient.websites?.map(website => (
                    <div
                      key={website.id}
                      onClick={() => handleSelectWebsite(website)}
                      className="bg-slate-900/50 rounded-lg p-4 border border-brand-cyan/30 hover:border-brand-cyan cursor-pointer transition"
                    >
                      <h4 className="font-bold text-white">{website.name}</h4>
                      <p className="text-sm text-brand-cyan truncate">{website.url}</p>
                      {website.image_generation_enabled && (
                        <span className="inline-block mt-2 text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                          AI Images Enabled
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Locations */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
                <h3 className="text-lg font-bold text-purple-400 mb-4">📍 Locations ({selectedClient.locations?.length || 0})</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedClient.locations?.map(location => (
                    <div key={location.id} className="bg-slate-900/50 rounded-lg p-4 border border-purple-500/30">
                      <h4 className="font-bold text-white">{location.name}</h4>
                      <p className="text-sm text-gray-400">{location.city}, {location.state}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workflows */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-gold/30">
                <h3 className="text-lg font-bold text-brand-gold mb-4">⚡ Workflows ({selectedClient.workflows?.length || 0})</h3>
                <div className="space-y-2">
                  {selectedClient.workflows?.map(workflow => (
                    <div key={workflow.id} className="bg-slate-900/50 rounded-lg p-4 border border-brand-gold/30 flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-white">{workflow.name}</h4>
                        {workflow.website_name && (
                          <p className="text-sm text-gray-400">Website: {workflow.website_name}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(workflow.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Website Detail View with Image Generation Settings */}
          {view === 'website' && selectedWebsite && (
            <div className="space-y-6">
              {/* Website Info */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
                <h3 className="text-lg font-bold text-brand-cyan mb-4">Website Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">URL:</span>
                    <a href={selectedWebsite.url} target="_blank" rel="noopener noreferrer" className="text-brand-cyan ml-2 hover:underline">
                      {selectedWebsite.url}
                    </a>
                  </div>
                  <div>
                    <span className="text-gray-400">WordPress User:</span>
                    <span className="text-white ml-2">{selectedWebsite.wp_username || 'Not configured'}</span>
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
                        <label className="block text-sm text-brand-gold mb-2">OpenAI API Key (for prompts)</label>
                        <input
                          type="password"
                          placeholder="sk-..."
                          value={imageSettings.openaiKey}
                          onChange={e => setImageSettings(prev => ({ ...prev, openaiKey: e.target.value }))}
                          className="w-full bg-slate-900/50 border border-brand-gold/50 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-brand-gold mb-2">Replicate API Key (for FLUX)</label>
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

                    {/* Extract Style DNA Button */}
                    <button
                      onClick={handleExtractStyleDNA}
                      disabled={extractingDNA || imageSettings.referenceImages.length === 0}
                      className="w-full py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-lg text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {extractingDNA ? 'Extracting Style DNA...' : '🧬 Extract Style DNA from Reference Images'}
                    </button>

                    {/* Style DNA Preview */}
                    {imageSettings.styleDNA && (
                      <div className="bg-slate-900/50 rounded-lg p-4 border border-green-500/30">
                        <h4 className="text-sm font-bold text-green-400 mb-2">Style DNA Template</h4>
                        <p className="text-xs text-gray-300 font-mono bg-slate-800/50 p-3 rounded">
                          {imageSettings.styleDNA.styleTemplate}
                        </p>
                        {imageSettings.styleDNA.attributes && (
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-gray-400">Style:</span> <span className="text-white">{imageSettings.styleDNA.attributes.style}</span></div>
                            <div><span className="text-gray-400">Mood:</span> <span className="text-white">{imageSettings.styleDNA.attributes.mood}</span></div>
                            <div><span className="text-gray-400">Lighting:</span> <span className="text-white">{imageSettings.styleDNA.attributes.lighting}</span></div>
                            <div><span className="text-gray-400">Composition:</span> <span className="text-white">{imageSettings.styleDNA.attributes.composition}</span></div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Images per Article */}
                    <div>
                      <label className="block text-sm text-brand-gold mb-2">Images per Article</label>
                      <select
                        value={imageSettings.imagesPerArticle}
                        onChange={e => setImageSettings(prev => ({ ...prev, imagesPerArticle: parseInt(e.target.value) }))}
                        className="w-full bg-slate-900/50 border border-brand-gold/50 rounded-lg px-3 py-2 text-white"
                      >
                        <option value={1}>1 (Hero only)</option>
                        <option value={2}>2 (Hero + 1 inline)</option>
                        <option value={3}>3 (Hero + 2 inline)</option>
                        <option value={4}>4 (Hero + 3 inline)</option>
                      </select>
                    </div>

                    {/* Save Button */}
                    <button
                      onClick={handleSaveImageSettings}
                      className="w-full py-3 bg-brand-cyan hover:bg-brand-cyan-dark rounded-lg text-slate-900 font-bold transition"
                    >
                      💾 Save Image Settings
                    </button>

                    {/* Cost Estimate */}
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-brand-gold/30">
                      <h4 className="text-sm font-bold text-brand-gold mb-2">Cost Estimate</h4>
                      <p className="text-xs text-gray-400">
                        FLUX 1.1 Pro: <span className="text-white">$0.04/image</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        Per article ({imageSettings.imagesPerArticle} images): <span className="text-white">${(0.04 * imageSettings.imagesPerArticle).toFixed(2)}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        GPT-4o-mini prompting: <span className="text-white">~$0.001/article</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientsPage;
