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
  local_viking_api_key: string | null;
  local_viking_location_id: string | null;
  created_at: string;
}

interface AgencyManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWebsite?: (website: Website, client: Client, location?: Location) => void;
}

interface PersonalProject {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
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
  const [personalProjects, setPersonalProjects] = useState<PersonalProject[]>([]);

  // Selection & Hover
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [hoveredClient, setHoveredClient] = useState<Client | null>(null);
  const [hoveredLocations, setHoveredLocations] = useState<Location[]>([]);
  const [hoveredWebsites, setHoveredWebsites] = useState<Website[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  // Hover glow for location-website connection
  const [hoveredLocationId, setHoveredLocationId] = useState<number | null>(null);
  const [hoveredWebsiteId, setHoveredWebsiteId] = useState<number | null>(null);

  // Forms
  const [showClientForm, setShowClientForm] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [showWebsiteForm, setShowWebsiteForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);

  // Edit mode - track which item is being edited
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [editingWebsiteId, setEditingWebsiteId] = useState<number | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);

  // Form data
  const [clientForm, setClientForm] = useState({ name: '', description: '' });
  const [locationForm, setLocationForm] = useState({
    name: '', address: '', city: '', state: '', zip: '', country: 'USA',
    has_gbp: false, gbp_place_id: ''
  });
  const [websiteForm, setWebsiteForm] = useState({
    name: '', url: '', wp_url: '', wp_user: '', wp_app_password: '',
    local_viking_api_key: '', local_viking_location_id: ''
  });
  const [projectForm, setProjectForm] = useState({ name: '', description: '' });

  // Loading states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch clients on mount
  useEffect(() => {
    if (isOpen && mode === 'agency') {
      fetchClients();
    } else if (isOpen && mode === 'personal') {
      fetchPersonalProjects();
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
      // API returns {clients: [...]}
      const clientsArray = data.clients || data;
      setClients(Array.isArray(clientsArray) ? clientsArray : []);
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
      // API returns {locations: [...]}
      const locationsArray = data.locations || data;
      setLocations(Array.isArray(locationsArray) ? locationsArray : []);
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
      // API returns {websites: [...]}
      const websitesArray = data.websites || data;
      setWebsites(Array.isArray(websitesArray) ? websitesArray : []);
    } catch (err) {
      setWebsites([]);
      setError('Failed to fetch websites');
    }
  };

  // Fetch data for hover preview
  const fetchHoverData = async (clientId: number) => {
    try {
      const [locRes, webRes] = await Promise.all([
        fetch(`/api/locations?client_id=${clientId}`),
        fetch(`/api/websites?client_id=${clientId}`)
      ]);

      if (locRes.ok) {
        const locData = await locRes.json();
        setHoveredLocations(Array.isArray(locData.locations || locData) ? (locData.locations || locData) : []);
      }
      if (webRes.ok) {
        const webData = await webRes.json();
        setHoveredWebsites(Array.isArray(webData.websites || webData) ? (webData.websites || webData) : []);
      }
    } catch (err) {
      setHoveredLocations([]);
      setHoveredWebsites([]);
    }
  };

  const handleClientHover = (client: Client | null) => {
    if (selectedClient) return; // Don't show hover preview if a client is already selected/clicked
    setHoveredClient(client);
    if (client) {
      fetchHoverData(client.id);
    } else {
      setHoveredLocations([]);
      setHoveredWebsites([]);
    }
  };

  const fetchPersonalProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/personal-projects');
      if (!res.ok) {
        setPersonalProjects([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const projectsArray = data.projects || data;
      setPersonalProjects(Array.isArray(projectsArray) ? projectsArray : []);
    } catch (err) {
      setPersonalProjects([]);
      setError('Failed to fetch personal projects');
    }
    setLoading(false);
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

  // Edit functions
  const startEditClient = (client: Client) => {
    setEditingClientId(client.id);
    setClientForm({ name: client.name, description: client.description || '' });
    setShowClientForm(true);
  };

  const startEditLocation = (location: Location) => {
    setEditingLocationId(location.id);
    setLocationForm({
      name: location.name,
      address: location.address || '',
      city: location.city || '',
      state: location.state || '',
      zip: location.zip || '',
      country: location.country || 'USA',
      has_gbp: location.has_gbp,
      gbp_place_id: location.gbp_place_id || ''
    });
    setShowLocationForm(true);
  };

  const startEditWebsite = (website: Website) => {
    setEditingWebsiteId(website.id);
    setWebsiteForm({
      name: website.name,
      url: website.url || '',
      wp_url: website.wp_url || '',
      wp_user: website.wp_user || '',
      wp_app_password: website.wp_app_password || '',
      local_viking_api_key: website.local_viking_api_key || '',
      local_viking_location_id: website.local_viking_location_id || ''
    });
    setShowWebsiteForm(true);
  };

  const updateClient = async () => {
    if (!editingClientId) return;
    try {
      const res = await fetch(`/api/clients/${editingClientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientForm)
      });
      if (res.ok) {
        setClientForm({ name: '', description: '' });
        setShowClientForm(false);
        setEditingClientId(null);
        fetchClients();
      }
    } catch (err) {
      setError('Failed to update client');
    }
  };

  const updateLocation = async () => {
    if (!editingLocationId || !selectedClient) return;
    try {
      const res = await fetch(`/api/locations/${editingLocationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationForm)
      });
      if (res.ok) {
        setLocationForm({ name: '', address: '', city: '', state: '', zip: '', country: 'USA', has_gbp: false, gbp_place_id: '' });
        setShowLocationForm(false);
        setEditingLocationId(null);
        fetchLocations(selectedClient.id);
      }
    } catch (err) {
      setError('Failed to update location');
    }
  };

  const updateWebsite = async () => {
    if (!editingWebsiteId || !selectedClient) return;
    try {
      const res = await fetch(`/api/websites/${editingWebsiteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(websiteForm)
      });
      if (res.ok) {
        setWebsiteForm({ name: '', url: '', wp_url: '', wp_user: '', wp_app_password: '' });
        setShowWebsiteForm(false);
        setEditingWebsiteId(null);
        fetchWebsites(selectedClient.id);
      }
    } catch (err) {
      setError('Failed to update website');
    }
  };

  const cancelClientForm = () => {
    setShowClientForm(false);
    setEditingClientId(null);
    setClientForm({ name: '', description: '' });
  };

  const cancelLocationForm = () => {
    setShowLocationForm(false);
    setEditingLocationId(null);
    setLocationForm({ name: '', address: '', city: '', state: '', zip: '', country: 'USA', has_gbp: false, gbp_place_id: '' });
  };

  const cancelWebsiteForm = () => {
    setShowWebsiteForm(false);
    setEditingWebsiteId(null);
    setWebsiteForm({ name: '', url: '', wp_url: '', wp_user: '', wp_app_password: '', local_viking_api_key: '', local_viking_location_id: '' });
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

  // Personal Project CRUD
  const createPersonalProject = async () => {
    try {
      const res = await fetch('/api/personal-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectForm)
      });
      if (res.ok) {
        setProjectForm({ name: '', description: '' });
        setShowProjectForm(false);
        fetchPersonalProjects();
      }
    } catch (err) {
      setError('Failed to create project');
    }
  };

  const startEditProject = (project: PersonalProject) => {
    setEditingProjectId(project.id);
    setProjectForm({ name: project.name, description: project.description || '' });
    setShowProjectForm(true);
  };

  const updatePersonalProject = async () => {
    if (!editingProjectId) return;
    try {
      const res = await fetch(`/api/personal-projects/${editingProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectForm)
      });
      if (res.ok) {
        setProjectForm({ name: '', description: '' });
        setShowProjectForm(false);
        setEditingProjectId(null);
        fetchPersonalProjects();
      }
    } catch (err) {
      setError('Failed to update project');
    }
  };

  const cancelProjectForm = () => {
    setShowProjectForm(false);
    setEditingProjectId(null);
    setProjectForm({ name: '', description: '' });
  };

  const deletePersonalProject = async (id: number) => {
    if (!confirm('Delete this project? Workflows inside will become ungrouped.')) return;
    try {
      await fetch(`/api/personal-projects/${id}`, { method: 'DELETE' });
      fetchPersonalProjects();
    } catch (err) {
      setError('Failed to delete project');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-brand-cyan/30">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-brand-cyan/30">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">Agency Manager</h2>
            {/* Mode Toggle */}
            <div className="flex bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setMode('agency')}
                className={`px-4 py-1 rounded-md text-sm font-medium transition ${
                  mode === 'agency' ? 'bg-brand-cyan text-slate-900' : 'text-gray-400 hover:text-white'
                }`}
              >
                Agency Mode
              </button>
              <button
                onClick={() => setMode('personal')}
                className={`px-4 py-1 rounded-md text-sm font-medium transition ${
                  mode === 'personal' ? 'bg-brand-cyan text-slate-900' : 'text-gray-400 hover:text-white'
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
        <div className="flex-1 overflow-hidden flex flex-col">
          {mode === 'agency' ? (
            <div className="flex-1 flex flex-col overflow-hidden relative">
              {/* Column Headers */}
              <div className="flex border-b border-brand-cyan/30 bg-gray-900/50">
                <div className="w-1/3 p-3 flex items-center justify-between border-r border-brand-cyan/30">
                  <h3 className="font-semibold text-brand-cyan">Clients</h3>
                  <button
                    onClick={() => setShowClientForm(true)}
                    className="text-brand-cyan hover:text-brand-cyan-light text-sm"
                  >
                    + Add
                  </button>
                </div>
                <div className="w-1/3 p-3 flex items-center justify-between border-r border-brand-cyan/30">
                  <h3 className="font-semibold text-brand-cyan">Locations</h3>
                  {selectedClient && (
                    <button
                      onClick={() => setShowLocationForm(true)}
                      className="text-brand-cyan hover:text-brand-cyan-light text-sm"
                    >
                      + Add
                    </button>
                  )}
                </div>
                <div className="w-1/3 p-3 flex items-center justify-between">
                  <h3 className="font-semibold text-brand-cyan">Websites</h3>
                  {selectedClient && (
                    <button
                      onClick={() => setShowWebsiteForm(true)}
                      className="text-brand-cyan hover:text-brand-cyan-light text-sm"
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>

              {/* Add Client Form */}
              {showClientForm && (
                <div className="p-4 border-b border-brand-cyan/30 bg-gray-900/30 space-y-3">
                  <p className="text-sm text-brand-cyan font-medium">{editingClientId ? 'Edit Client' : 'New Client'}</p>
                  <input
                    type="text"
                    placeholder="Client Name *"
                    value={clientForm.name}
                    onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={clientForm.description}
                    onChange={(e) => setClientForm({ ...clientForm, description: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                  <div className="flex gap-2">
                    <button onClick={editingClientId ? updateClient : createClient} className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan-dark hover:shadow-glow-cyan rounded text-slate-900 text-sm font-medium">
                      {editingClientId ? 'Update' : 'Save'}
                    </button>
                    <button onClick={cancelClientForm} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Three Column Content - Client List with Hover/Click Preview */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-gray-400">Loading...</div>
                ) : clients.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p className="mb-2">No clients yet</p>
                    <p className="text-sm">Add a client to get started.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-brand-cyan/30">
                    {clients.map((client) => {
                      const isHovered = hoveredClient?.id === client.id && !selectedClient;
                      const isSelected = selectedClient?.id === client.id;
                      const showAssets = isHovered || isSelected;
                      const displayLocations = isSelected ? locations : (isHovered ? hoveredLocations : []);
                      const displayWebsites = isSelected ? websites : (isHovered ? hoveredWebsites : []);

                      return (
                        <div
                          key={client.id}
                          className={`relative transition-all duration-200 ${
                            isSelected ? 'z-20' : isHovered ? 'z-10' : 'z-0'
                          }`}
                          onMouseEnter={() => handleClientHover(client)}
                          onMouseLeave={() => handleClientHover(null)}
                        >
                          {/* The Row - 3 columns */}
                          <div
                            className={`flex transition-all duration-300 ${
                              isSelected
                                ? 'border-4 border-brand-cyan rounded-xl shadow-[0_0_40px_rgba(0,180,216,0.7)] bg-gradient-to-b from-slate-800 to-slate-900 my-3 mx-3 min-h-[200px]'
                                : isHovered
                                ? 'border-2 border-brand-cyan rounded-lg shadow-[0_0_20px_rgba(0,180,216,0.4)] bg-slate-800'
                                : ''
                            }`}
                          >
                            {/* Client Column */}
                            <div
                              className={`w-1/3 p-4 border-r border-brand-cyan/30 cursor-pointer ${
                                !isSelected && !isHovered ? 'hover:bg-slate-700/50' : ''
                              }`}
                              onClick={() => {
                                if (isSelected) return;
                                setSelectedClient(client);
                                setSelectedLocation(null);
                                setHoveredClient(null);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-white truncate">{client.name}</p>
                                  {client.description && (
                                    <p className="text-xs text-gray-400 truncate">{client.description}</p>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); startEditClient(client); }}
                                    className="text-gray-500 hover:text-brand-cyan p-1"
                                    title="Edit"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deleteClient(client.id); }}
                                    className="text-gray-500 hover:text-red-400 p-1"
                                    title="Delete"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                  {isSelected && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedClient(null);
                                        setSelectedLocation(null);
                                        setLocations([]);
                                        setWebsites([]);
                                        setHoveredLocationId(null);
                                        setHoveredWebsiteId(null);
                                      }}
                                      className="text-gray-500 hover:text-white p-1 ml-2"
                                      title="Close"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Locations Column - Shows on hover/select */}
                            <div className={`w-1/3 border-r border-brand-cyan/30 transition-all duration-200 flex flex-col ${
                              showAssets ? 'opacity-100' : 'opacity-30'
                            }`}>
                              {showAssets ? (
                                <div className={`p-4 flex-1 ${isSelected ? 'max-h-[400px] overflow-y-auto' : 'min-h-[80px]'}`}>
                                  {displayLocations.length === 0 ? (
                                    <p className="text-gray-500 text-sm">No locations</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {displayLocations.map((loc) => {
                                        // Glow when a website is hovered (connection glow)
                                        const locationGlows = hoveredWebsiteId !== null && isSelected;
                                        const isLocationHovered = hoveredLocationId === loc.id;
                                        return (
                                        <div
                                          key={loc.id}
                                          onClick={() => isSelected && setSelectedLocation(loc)}
                                          onMouseEnter={() => isSelected && setHoveredLocationId(loc.id)}
                                          onMouseLeave={() => setHoveredLocationId(null)}
                                          className={`relative p-2 rounded transition-all duration-200 ${
                                            isSelected ? 'cursor-pointer' : ''
                                          } ${selectedLocation?.id === loc.id ? 'bg-brand-cyan/20 border border-brand-cyan' : ''} ${
                                            locationGlows ? 'border-2 border-brand-cyan shadow-[0_0_15px_rgba(0,180,216,0.5)]' : 'border border-transparent'
                                          } ${isLocationHovered ? 'border-2 border-brand-gold shadow-[0_0_15px_rgba(245,166,35,0.5)] bg-slate-800' : ''}`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <p className="text-white text-sm font-medium">{loc.name}</p>
                                              {loc.has_gbp && (
                                                <span className="px-1.5 py-0.5 bg-green-600/30 text-green-400 text-xs rounded">GBP</span>
                                              )}
                                            </div>
                                            {isSelected && (
                                              <div className="flex gap-1">
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); startEditLocation(loc); }}
                                                  className="text-gray-500 hover:text-brand-cyan p-1"
                                                >
                                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                  </svg>
                                                </button>
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); deleteLocation(loc.id); }}
                                                  className="text-gray-500 hover:text-red-400 p-1"
                                                >
                                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                  </svg>
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                          {/* Expanded details on hover */}
                                          {isLocationHovered && isSelected && (
                                            <div className="mt-2 pt-2 border-t border-gray-600 space-y-1 text-xs">
                                              {loc.address && (
                                                <p className="text-gray-300"><span className="text-gray-500">Address:</span> {loc.address}</p>
                                              )}
                                              {(loc.city || loc.state || loc.zip) && (
                                                <p className="text-gray-300">
                                                  <span className="text-gray-500">Location:</span> {[loc.city, loc.state, loc.zip].filter(Boolean).join(', ')}
                                                </p>
                                              )}
                                              {loc.country && loc.country !== 'USA' && (
                                                <p className="text-gray-300"><span className="text-gray-500">Country:</span> {loc.country}</p>
                                              )}
                                              {loc.has_gbp && (
                                                <p className="text-green-400 flex items-center gap-1">
                                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                  </svg>
                                                  Google Business Profile linked
                                                </p>
                                              )}
                                              {loc.created_at && (
                                                <p className="text-gray-500">Added: {new Date(loc.created_at).toLocaleDateString()}</p>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="p-4 text-gray-600 text-sm">Hover to preview</div>
                              )}
                            </div>

                            {/* Websites Column - Shows on hover/select */}
                            <div className={`w-1/3 transition-all duration-200 flex flex-col ${
                              showAssets ? 'opacity-100' : 'opacity-30'
                            }`}>
                              {showAssets ? (
                                <div className={`p-4 flex-1 ${isSelected ? 'max-h-[400px] overflow-y-auto' : 'min-h-[80px]'}`}>
                                  {displayWebsites.length === 0 ? (
                                    <p className="text-gray-500 text-sm">No websites</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {displayWebsites.map((web) => {
                                        // Glow when a location is hovered (connection glow)
                                        const websiteGlows = hoveredLocationId !== null && isSelected;
                                        const isWebsiteHovered = hoveredWebsiteId === web.id;
                                        return (
                                        <div
                                          key={web.id}
                                          onMouseEnter={() => isSelected && setHoveredWebsiteId(web.id)}
                                          onMouseLeave={() => setHoveredWebsiteId(null)}
                                          className={`relative p-2 rounded transition-all duration-200 ${
                                            websiteGlows ? 'border-2 border-brand-cyan shadow-[0_0_15px_rgba(0,180,216,0.5)]' : 'border border-transparent'
                                          } ${isWebsiteHovered ? 'border-2 border-brand-gold shadow-[0_0_15px_rgba(245,166,35,0.5)] bg-slate-800' : ''}`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                              <p className="text-white text-sm font-medium truncate">{web.name}</p>
                                              {web.url && (
                                                <a
                                                  href={web.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-xs text-brand-cyan hover:underline truncate block"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  {web.url}
                                                </a>
                                              )}
                                            </div>
                                            <div className="flex gap-1 items-center">
                                              {isSelected && onSelectWebsite && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectWebsite(web, client, selectedLocation || undefined);
                                                  }}
                                                  className="px-2 py-1 bg-brand-gold hover:bg-brand-gold-dark hover:shadow-glow-gold rounded text-slate-900 text-xs font-medium"
                                                >
                                                  Select
                                                </button>
                                              )}
                                              {isSelected && (
                                                <>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); startEditWebsite(web); }}
                                                    className="text-gray-500 hover:text-brand-cyan p-1"
                                                  >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                  </button>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); deleteWebsite(web.id); }}
                                                    className="text-gray-500 hover:text-red-400 p-1"
                                                  >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                          {/* Expanded details on hover */}
                                          {isWebsiteHovered && isSelected && (
                                            <div className="mt-2 pt-2 border-t border-gray-600 space-y-1 text-xs">
                                              {web.url && (
                                                <p className="text-gray-300">
                                                  <span className="text-gray-500">Website:</span>{' '}
                                                  <a href={web.url} target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:underline">
                                                    {web.url}
                                                  </a>
                                                </p>
                                              )}
                                              {web.wp_url && (
                                                <div className="pt-1 border-t border-gray-700 mt-1">
                                                  <p className="text-brand-gold font-medium mb-1">WordPress</p>
                                                  <p className="text-gray-300">
                                                    <span className="text-gray-500">Admin:</span>{' '}
                                                    <a href={web.wp_url} target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:underline">
                                                      {web.wp_url}
                                                    </a>
                                                  </p>
                                                  {web.wp_user && (
                                                    <p className="text-gray-300"><span className="text-gray-500">User:</span> {web.wp_user}</p>
                                                  )}
                                                  {web.wp_app_password && (
                                                    <p className="text-green-400 flex items-center gap-1">
                                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                      </svg>
                                                      App password configured
                                                    </p>
                                                  )}
                                                </div>
                                              )}
                                              {web.created_at && (
                                                <p className="text-gray-500">Added: {new Date(web.created_at).toLocaleDateString()}</p>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="p-4 text-gray-600 text-sm">Hover to preview</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Location Form Modal - Full Screen */}
              {showLocationForm && selectedClient && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                  <div className="bg-slate-800 rounded-lg p-6 w-full max-w-lg border-2 border-brand-cyan shadow-[0_0_30px_rgba(0,180,216,0.5)]">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-lg text-brand-cyan font-semibold">{editingLocationId ? 'Edit Location' : 'New Location'}</p>
                      <button onClick={cancelLocationForm} className="text-gray-400 hover:text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Location Name *</label>
                        <input
                          type="text"
                          placeholder="e.g., Downtown Office"
                          value={locationForm.name}
                          onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-brand-cyan focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Address</label>
                        <input
                          type="text"
                          placeholder="Street address"
                          value={locationForm.address}
                          onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-brand-cyan focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">City</label>
                          <input
                            type="text"
                            value={locationForm.city}
                            onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-brand-cyan focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">State</label>
                          <input
                            type="text"
                            value={locationForm.state}
                            onChange={(e) => setLocationForm({ ...locationForm, state: e.target.value })}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-brand-cyan focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">ZIP</label>
                          <input
                            type="text"
                            value={locationForm.zip}
                            onChange={(e) => setLocationForm({ ...locationForm, zip: e.target.value })}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-brand-cyan focus:outline-none"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-3 text-gray-300 p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700">
                        <input
                          type="checkbox"
                          checked={locationForm.has_gbp}
                          onChange={(e) => setLocationForm({ ...locationForm, has_gbp: e.target.checked })}
                          className="w-5 h-5 rounded bg-gray-600 border-gray-500 text-brand-cyan focus:ring-brand-cyan"
                        />
                        <div>
                          <span className="font-medium">Has Google Business Profile</span>
                          <p className="text-xs text-gray-500">Enable if this location has a GBP listing</p>
                        </div>
                      </label>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button onClick={editingLocationId ? updateLocation : createLocation} className="flex-1 px-4 py-3 bg-brand-cyan hover:bg-brand-cyan-dark hover:shadow-glow-cyan rounded text-slate-900 font-medium transition">
                        {editingLocationId ? 'Update Location' : 'Create Location'}
                      </button>
                      <button onClick={cancelLocationForm} className="px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded text-white transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Website Form Modal - Full Screen */}
              {showWebsiteForm && selectedClient && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                  <div className="bg-slate-800 rounded-lg p-6 w-full max-w-lg border-2 border-brand-cyan shadow-[0_0_30px_rgba(0,180,216,0.5)]">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-lg text-brand-cyan font-semibold">{editingWebsiteId ? 'Edit Website' : 'New Website'}</p>
                      <button onClick={cancelWebsiteForm} className="text-gray-400 hover:text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Website Name *</label>
                        <input
                          type="text"
                          placeholder="e.g., Main Website"
                          value={websiteForm.name}
                          onChange={(e) => setWebsiteForm({ ...websiteForm, name: e.target.value })}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-brand-cyan focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Website URL</label>
                        <input
                          type="text"
                          placeholder="https://example.com"
                          value={websiteForm.url}
                          onChange={(e) => setWebsiteForm({ ...websiteForm, url: e.target.value })}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-brand-cyan focus:outline-none"
                        />
                      </div>
                      <div className="border-t border-gray-700 pt-4 mt-4">
                        <p className="text-sm text-brand-gold font-medium mb-3">WordPress Settings (optional)</p>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">WordPress Admin URL</label>
                            <input
                              type="text"
                              placeholder="https://example.com/wp-admin"
                              value={websiteForm.wp_url}
                              onChange={(e) => setWebsiteForm({ ...websiteForm, wp_url: e.target.value })}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-brand-cyan focus:outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm text-gray-400 mb-1">Username</label>
                              <input
                                type="text"
                                value={websiteForm.wp_user}
                                onChange={(e) => setWebsiteForm({ ...websiteForm, wp_user: e.target.value })}
                                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-brand-cyan focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-1">App Password</label>
                              <input
                                type="password"
                                value={websiteForm.wp_app_password}
                                onChange={(e) => setWebsiteForm({ ...websiteForm, wp_app_password: e.target.value })}
                                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-brand-cyan focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-gray-700 pt-4 mt-4">
                        <p className="text-sm text-green-400 font-medium mb-3">Local Viking Settings (optional)</p>
                        <p className="text-xs text-gray-500 mb-3">Connect to Local Viking for rank tracking and GBP automation</p>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Local Viking API Key</label>
                            <input
                              type="password"
                              placeholder="Your Local Viking API key"
                              value={websiteForm.local_viking_api_key}
                              onChange={(e) => setWebsiteForm({ ...websiteForm, local_viking_api_key: e.target.value })}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Location ID (Campaign ID)</label>
                            <input
                              type="text"
                              placeholder="e.g., 12345"
                              value={websiteForm.local_viking_location_id}
                              onChange={(e) => setWebsiteForm({ ...websiteForm, local_viking_location_id: e.target.value })}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">Find this in your Local Viking campaign URL</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button onClick={editingWebsiteId ? updateWebsite : createWebsite} className="flex-1 px-4 py-3 bg-brand-cyan hover:bg-brand-cyan-dark hover:shadow-glow-cyan rounded text-slate-900 font-medium transition">
                        {editingWebsiteId ? 'Update Website' : 'Create Website'}
                      </button>
                      <button onClick={cancelWebsiteForm} className="px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded text-white transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Personal Projects Mode */
            <div className="flex-1 flex flex-col">
              {/* Header */}
              <div className="p-3 border-b border-brand-cyan/30 flex items-center justify-between bg-gray-900/50">
                <div>
                  <h3 className="font-semibold text-brand-gold">Personal Projects</h3>
                  <p className="text-xs text-gray-500">Organize your standalone workflows</p>
                </div>
                <button
                  onClick={() => setShowProjectForm(true)}
                  className="px-3 py-1.5 bg-brand-gold hover:bg-brand-gold-dark hover:shadow-glow-gold rounded text-sm text-slate-900 font-medium"
                >
                  + New Project
                </button>
              </div>

              {/* Add/Edit Form */}
              {showProjectForm && (
                <div className="p-4 border-b border-brand-cyan/30 bg-gray-900/30 space-y-3">
                  <p className="text-sm text-brand-gold font-medium">
                    {editingProjectId ? 'Edit Project' : 'Create New Project'}
                  </p>
                  <input
                    type="text"
                    placeholder="Project Name *"
                    value={projectForm.name}
                    onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={projectForm.description}
                    onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={editingProjectId ? updatePersonalProject : createPersonalProject}
                      disabled={!projectForm.name.trim()}
                      className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark hover:shadow-glow-gold rounded text-slate-900 text-sm font-medium disabled:opacity-50"
                    >
                      {editingProjectId ? 'Update' : 'Create'}
                    </button>
                    <button
                      onClick={cancelProjectForm}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Projects List */}
              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="text-center text-gray-400 py-8">Loading...</div>
                ) : personalProjects.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p className="mb-2">No projects yet</p>
                    <p className="text-sm">Create a project to organize your standalone workflows.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {personalProjects.map((project) => (
                      <div
                        key={project.id}
                        className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 hover:border-brand-gold/50 transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-white">{project.name}</h4>
                            {project.description && (
                              <p className="text-sm text-gray-400 mt-1">{project.description}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              Created {new Date(project.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEditProject(project)}
                              className="text-gray-400 hover:text-brand-gold p-1"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deletePersonalProject(project.id)}
                              className="text-gray-400 hover:text-red-400 p-1"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer info */}
              <div className="p-3 border-t border-brand-cyan/30 bg-gray-900/50 text-sm text-gray-400">
                <p>Projects organize your standalone workflows. Use the <strong>Workflows</strong> sidebar to create workflows inside projects.</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AgencyManager;
