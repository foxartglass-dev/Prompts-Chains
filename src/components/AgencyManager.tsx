import React, { useState, useEffect } from 'react';

interface Client {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

interface Location {
  id: number;
  client_id: number;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  has_gbp: boolean;
  gbp_place_id: string | null;
  gbp_categories: string[];
  gbp_data: Record<string, any>;
  created_at: string;
}

interface Website {
  id: number;
  client_id: number;
  name: string;
  url: string | null;
  wp_url: string | null;
  wp_user: string | null;
  wp_app_password: string | null;
  created_at: string;
}

interface AgencyManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWebsite?: (website: Website, client: Client, location?: Location) => void;
}

type Mode = 'agency' | 'personal';
type View = 'clients' | 'locations' | 'websites';

const AgencyManager: React.FC<AgencyManagerProps> = ({ isOpen, onClose, onSelectWebsite }) => {
  const [mode, setMode] = useState<Mode>('agency');
  const [view, setView] = useState<View>('clients');

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);

  // Selection
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  // Forms
  const [showClientForm, setShowClientForm] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [showWebsiteForm, setShowWebsiteForm] = useState(false);

  // Form data
  const [clientForm, setClientForm] = useState({ name: '', description: '' });
  const [locationForm, setLocationForm] = useState({
    name: '', address: '', city: '', state: '', zip: '', country: 'USA',
    has_gbp: false, gbp_place_id: ''
  });
  const [websiteForm, setWebsiteForm] = useState({
    name: '', url: '', wp_url: '', wp_user: '', wp_app_password: ''
  });

  // Loading states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch clients on mount
  useEffect(() => {
    if (isOpen && mode === 'agency') {
      fetchClients();
    }
  }, [isOpen, mode]);

  // Fetch locations when client selected
  useEffect(() => {
    if (selectedClient) {
      fetchLocations(selectedClient.id);
      fetchWebsites(selectedClient.id);
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clients');
      if (!res.ok) {
        setClients([]);
        setError('Database not configured. Run schema.sql in Neon.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      setClients([]);
      setError('Database not configured. Run schema.sql in Neon.');
    }
    setLoading(false);
  };

  const fetchLocations = async (clientId: number) => {
    try {
      const res = await fetch(`/api/locations?client_id=${clientId}`);
      if (!res.ok) {
        setLocations([]);
        return;
      }
      const data = await res.json();
      setLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      setLocations([]);
      setError('Failed to fetch locations');
    }
  };

  const fetchWebsites = async (clientId: number) => {
    try {
      const res = await fetch(`/api/websites?client_id=${clientId}`);
      if (!res.ok) {
        setWebsites([]);
        return;
      }
      const data = await res.json();
      setWebsites(Array.isArray(data) ? data : []);
    } catch (err) {
      setWebsites([]);
      setError('Failed to fetch websites');
    }
  };

  // CRUD operations
  const createClient = async () => {
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientForm)
      });
      if (res.ok) {
        setClientForm({ name: '', description: '' });
        setShowClientForm(false);
        fetchClients();
      }
    } catch (err) {
      setError('Failed to create client');
    }
  };

  const createLocation = async () => {
    if (!selectedClient) return;
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...locationForm, client_id: selectedClient.id })
      });
      if (res.ok) {
        setLocationForm({ name: '', address: '', city: '', state: '', zip: '', country: 'USA', has_gbp: false, gbp_place_id: '' });
        setShowLocationForm(false);
        fetchLocations(selectedClient.id);
      }
    } catch (err) {
      setError('Failed to create location');
    }
  };

  const createWebsite = async () => {
    if (!selectedClient) return;
    try {
      const res = await fetch('/api/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...websiteForm, client_id: selectedClient.id })
      });
      if (res.ok) {
        setWebsiteForm({ name: '', url: '', wp_url: '', wp_user: '', wp_app_password: '' });
        setShowWebsiteForm(false);
        fetchWebsites(selectedClient.id);
      }
    } catch (err) {
      setError('Failed to create website');
    }
  };

  const deleteClient = async (id: number) => {
    if (!confirm('Delete this client and all associated data?')) return;
    try {
      await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      fetchClients();
      if (selectedClient?.id === id) {
        setSelectedClient(null);
        setLocations([]);
        setWebsites([]);
      }
    } catch (err) {
      setError('Failed to delete client');
    }
  };

  const deleteLocation = async (id: number) => {
    if (!confirm('Delete this location?')) return;
    try {
      await fetch(`/api/locations/${id}`, { method: 'DELETE' });
      if (selectedClient) fetchLocations(selectedClient.id);
    } catch (err) {
      setError('Failed to delete location');
    }
  };

  const deleteWebsite = async (id: number) => {
    if (!confirm('Delete this website?')) return;
    try {
      await fetch(`/api/websites/${id}`, { method: 'DELETE' });
      if (selectedClient) fetchWebsites(selectedClient.id);
    } catch (err) {
      setError('Failed to delete website');
    }
  };

  const toggleGBP = async (location: Location) => {
    try {
      await fetch(`/api/locations/${location.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ has_gbp: !location.has_gbp })
      });
      if (selectedClient) fetchLocations(selectedClient.id);
    } catch (err) {
      setError('Failed to update location');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">Agency Manager</h2>
            {/* Mode Toggle */}
            <div className="flex bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setMode('agency')}
                className={`px-4 py-1 rounded-md text-sm font-medium transition ${
                  mode === 'agency' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Agency Mode
              </button>
              <button
                onClick={() => setMode('personal')}
                className={`px-4 py-1 rounded-md text-sm font-medium transition ${
                  mode === 'personal' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Personal Projects
              </button>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-600/20 border border-red-600 rounded-lg text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {mode === 'agency' ? (
            <>
              {/* Clients Panel */}
              <div className="w-1/3 border-r border-gray-700 flex flex-col">
                <div className="p-3 border-b border-gray-700 flex items-center justify-between bg-gray-900/50">
                  <h3 className="font-semibold text-cyan-400">Clients</h3>
                  <button
                    onClick={() => setShowClientForm(true)}
                    className="text-cyan-400 hover:text-cyan-300 text-sm"
                  >
                    + Add
                  </button>
                </div>

                {showClientForm && (
                  <div className="p-3 border-b border-gray-700 bg-gray-900/30 space-y-2">
                    <input
                      type="text"
                      placeholder="Client Name"
                      value={clientForm.name}
                      onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={clientForm.description}
                      onChange={(e) => setClientForm({ ...clientForm, description: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button onClick={createClient} className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded text-sm">
                        Save
                      </button>
                      <button onClick={() => setShowClientForm(false)} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-gray-400 text-center">Loading...</div>
                  ) : clients.length === 0 ? (
                    <div className="p-4 text-gray-500 text-center text-sm">No clients yet. Add one to get started.</div>
                  ) : (
                    clients.map((client) => (
                      <div
                        key={client.id}
                        onClick={() => {
                          setSelectedClient(client);
                          setSelectedLocation(null);
                        }}
                        className={`p-3 border-b border-gray-700 cursor-pointer hover:bg-gray-700/50 flex items-center justify-between ${
                          selectedClient?.id === client.id ? 'bg-gray-700' : ''
                        }`}
                      >
                        <div>
                          <p className="font-medium text-white">{client.name}</p>
                          {client.description && (
                            <p className="text-xs text-gray-400">{client.description}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteClient(client.id);
                          }}
                          className="text-gray-500 hover:text-red-400 p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Locations Panel */}
              <div className="w-1/3 border-r border-gray-700 flex flex-col">
                <div className="p-3 border-b border-gray-700 flex items-center justify-between bg-gray-900/50">
                  <h3 className="font-semibold text-cyan-400">Locations</h3>
                  {selectedClient && (
                    <button
                      onClick={() => setShowLocationForm(true)}
                      className="text-cyan-400 hover:text-cyan-300 text-sm"
                    >
                      + Add
                    </button>
                  )}
                </div>

                {showLocationForm && selectedClient && (
                  <div className="p-3 border-b border-gray-700 bg-gray-900/30 space-y-2">
                    <input
                      type="text"
                      placeholder="Location Name"
                      value={locationForm.name}
                      onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Address"
                      value={locationForm.address}
                      onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="City"
                        value={locationForm.city}
                        onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="State"
                        value={locationForm.state}
                        onChange={(e) => setLocationForm({ ...locationForm, state: e.target.value })}
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="ZIP"
                        value={locationForm.zip}
                        onChange={(e) => setLocationForm({ ...locationForm, zip: e.target.value })}
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Country"
                        value={locationForm.country}
                        onChange={(e) => setLocationForm({ ...locationForm, country: e.target.value })}
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={locationForm.has_gbp}
                        onChange={(e) => setLocationForm({ ...locationForm, has_gbp: e.target.checked })}
                        className="rounded bg-gray-700 border-gray-600"
                      />
                      Has Google Business Profile
                    </label>
                    {locationForm.has_gbp && (
                      <input
                        type="text"
                        placeholder="GBP Place ID (optional)"
                        value={locationForm.gbp_place_id}
                        onChange={(e) => setLocationForm({ ...locationForm, gbp_place_id: e.target.value })}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                      />
                    )}
                    <div className="flex gap-2">
                      <button onClick={createLocation} className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded text-sm">
                        Save
                      </button>
                      <button onClick={() => setShowLocationForm(false)} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto">
                  {!selectedClient ? (
                    <div className="p-4 text-gray-500 text-center text-sm">Select a client to see locations</div>
                  ) : locations.length === 0 ? (
                    <div className="p-4 text-gray-500 text-center text-sm">No locations yet</div>
                  ) : (
                    locations.map((location) => (
                      <div
                        key={location.id}
                        onClick={() => setSelectedLocation(location)}
                        className={`p-3 border-b border-gray-700 cursor-pointer hover:bg-gray-700/50 ${
                          selectedLocation?.id === location.id ? 'bg-gray-700' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white">{location.name}</p>
                              {location.has_gbp && (
                                <span className="px-2 py-0.5 bg-green-600/30 text-green-400 text-xs rounded-full">
                                  GBP
                                </span>
                              )}
                            </div>
                            {location.city && (
                              <p className="text-xs text-gray-400">
                                {location.city}{location.state ? `, ${location.state}` : ''}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleGBP(location);
                              }}
                              className={`p-1 rounded ${location.has_gbp ? 'text-green-400 hover:text-green-300' : 'text-gray-500 hover:text-gray-400'}`}
                              title="Toggle GBP"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteLocation(location.id);
                              }}
                              className="text-gray-500 hover:text-red-400 p-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Websites Panel */}
              <div className="w-1/3 flex flex-col">
                <div className="p-3 border-b border-gray-700 flex items-center justify-between bg-gray-900/50">
                  <h3 className="font-semibold text-cyan-400">Websites</h3>
                  {selectedClient && (
                    <button
                      onClick={() => setShowWebsiteForm(true)}
                      className="text-cyan-400 hover:text-cyan-300 text-sm"
                    >
                      + Add
                    </button>
                  )}
                </div>

                {showWebsiteForm && selectedClient && (
                  <div className="p-3 border-b border-gray-700 bg-gray-900/30 space-y-2">
                    <input
                      type="text"
                      placeholder="Website Name"
                      value={websiteForm.name}
                      onChange={(e) => setWebsiteForm({ ...websiteForm, name: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="URL (e.g., https://example.com)"
                      value={websiteForm.url}
                      onChange={(e) => setWebsiteForm({ ...websiteForm, url: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-gray-500 font-medium mt-2">WordPress Settings (optional)</p>
                    <input
                      type="text"
                      placeholder="WP Site URL"
                      value={websiteForm.wp_url}
                      onChange={(e) => setWebsiteForm({ ...websiteForm, wp_url: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="WP Username"
                        value={websiteForm.wp_user}
                        onChange={(e) => setWebsiteForm({ ...websiteForm, wp_user: e.target.value })}
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                      />
                      <input
                        type="password"
                        placeholder="WP App Password"
                        value={websiteForm.wp_app_password}
                        onChange={(e) => setWebsiteForm({ ...websiteForm, wp_app_password: e.target.value })}
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={createWebsite} className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded text-sm">
                        Save
                      </button>
                      <button onClick={() => setShowWebsiteForm(false)} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto">
                  {!selectedClient ? (
                    <div className="p-4 text-gray-500 text-center text-sm">Select a client to see websites</div>
                  ) : websites.length === 0 ? (
                    <div className="p-4 text-gray-500 text-center text-sm">No websites yet</div>
                  ) : (
                    websites.map((website) => (
                      <div
                        key={website.id}
                        className="p-3 border-b border-gray-700 hover:bg-gray-700/50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-white">{website.name}</p>
                            {website.url && (
                              <a
                                href={website.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-cyan-400 hover:underline"
                              >
                                {website.url}
                              </a>
                            )}
                            {website.wp_url && (
                              <p className="text-xs text-gray-500 mt-1">
                                WP: {website.wp_url}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {onSelectWebsite && (
                              <button
                                onClick={() => onSelectWebsite(website, selectedClient!, selectedLocation || undefined)}
                                className="px-2 py-1 bg-cyan-600 hover:bg-cyan-700 rounded text-xs"
                              >
                                Select
                              </button>
                            )}
                            <button
                              onClick={() => deleteWebsite(website.id)}
                              className="text-gray-500 hover:text-red-400 p-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Personal Projects Mode */
            <div className="flex-1 p-6">
              <div className="text-center text-gray-400">
                <p className="text-lg mb-4">Personal Projects Mode</p>
                <p className="text-sm">Your standalone projects that aren't tied to any agency client.</p>
                <p className="text-sm mt-2 text-gray-500">Coming soon - personal projects management</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer with breadcrumb */}
        {mode === 'agency' && (
          <div className="p-3 border-t border-gray-700 bg-gray-900/50 text-sm text-gray-400">
            <span>Current: </span>
            {selectedClient ? (
              <>
                <span className="text-cyan-400">{selectedClient.name}</span>
                {selectedLocation && (
                  <>
                    <span className="mx-2">&gt;</span>
                    <span className="text-cyan-400">{selectedLocation.name}</span>
                  </>
                )}
              </>
            ) : (
              <span>No client selected</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgencyManager;
