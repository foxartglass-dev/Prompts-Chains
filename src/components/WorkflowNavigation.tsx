import React, { useState, useEffect } from 'react';

interface Client {
  id: number;
  name: string;
  description: string | null;
}

interface Website {
  id: number;
  client_id: number;
  name: string;
  url: string | null;
}

interface Workflow {
  id: number;
  client_id: number | null;
  website_id: number | null;
  name: string;
  description: string | null;
  client_name?: string;
  website_name?: string;
}

interface WorkflowNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkflow: (workflow: Workflow) => void;
  onCreateWorkflow: (clientId?: number, websiteId?: number) => void;
  currentWorkflowId?: number;
}

type ViewMode = 'clients' | 'standalone';

const WorkflowNavigation: React.FC<WorkflowNavigationProps> = ({
  isOpen,
  onClose,
  onSelectWorkflow,
  onCreateWorkflow,
  currentWorkflowId
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [standaloneWorkflows, setStandaloneWorkflows] = useState<Workflow[]>([]);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());
  const [expandedWebsites, setExpandedWebsites] = useState<Set<number>>(new Set());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchClients();
      fetchStandaloneWorkflows();
    }
  }, [isOpen]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clients');
      if (!res.ok) {
        // Database tables may not exist yet
        setClients([]);
        return;
      }
      const data = await res.json();
      setClients(Array.isArray(data) ? data : (Array.isArray(data.clients) ? data.clients : []));
    } catch (err) {
      setClients([]);
      setError('Database not configured. Run schema.sql in Neon.');
    } finally {
      setLoading(false);
    }
  };

  const fetchWebsites = async (clientId: number) => {
    try {
      const res = await fetch(`/api/websites/client/${clientId}`);
      const data = await res.json();
      setWebsites(prev => {
        const otherWebsites = prev.filter(w => w.client_id !== clientId);
        return [...otherWebsites, ...(data.websites || [])];
      });
    } catch (err) {
      console.error('Failed to fetch websites:', err);
    }
  };

  const fetchWorkflows = async (websiteId: number) => {
    try {
      const res = await fetch(`/api/workflows?websiteId=${websiteId}`);
      const data = await res.json();
      setWorkflows(prev => {
        const otherWorkflows = prev.filter(w => w.website_id !== websiteId);
        return [...otherWorkflows, ...(data.workflows || [])];
      });
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
    }
  };

  const fetchStandaloneWorkflows = async () => {
    try {
      const res = await fetch('/api/workflows/standalone');
      if (!res.ok) {
        setStandaloneWorkflows([]);
        return;
      }
      const data = await res.json();
      setStandaloneWorkflows(Array.isArray(data) ? data : (Array.isArray(data.workflows) ? data.workflows : []));
    } catch (err) {
      setStandaloneWorkflows([]);
      console.error('Failed to fetch standalone workflows:', err);
    }
  };

  const toggleClient = async (client: Client) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(client.id)) {
      newExpanded.delete(client.id);
    } else {
      newExpanded.add(client.id);
      await fetchWebsites(client.id);
    }
    setExpandedClients(newExpanded);
    setSelectedClient(client);
  };

  const toggleWebsite = async (website: Website) => {
    const newExpanded = new Set(expandedWebsites);
    if (newExpanded.has(website.id)) {
      newExpanded.delete(website.id);
    } else {
      newExpanded.add(website.id);
      await fetchWorkflows(website.id);
    }
    setExpandedWebsites(newExpanded);
    setSelectedWebsite(website);
  };

  const handleSelectWorkflow = (workflow: Workflow) => {
    onSelectWorkflow(workflow);
    onClose();
  };

  const handleCreateWorkflow = (clientId?: number, websiteId?: number) => {
    onCreateWorkflow(clientId, websiteId);
  };

  const duplicateWorkflow = async (workflow: Workflow) => {
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.workflow) {
        if (workflow.website_id) {
          await fetchWorkflows(workflow.website_id);
        } else {
          await fetchStandaloneWorkflows();
        }
      }
    } catch (err) {
      setError('Failed to duplicate workflow');
    }
  };

  const deleteWorkflow = async (workflow: Workflow) => {
    if (!confirm(`Delete workflow "${workflow.name}"?`)) return;
    try {
      await fetch(`/api/workflows/${workflow.id}`, { method: 'DELETE' });
      if (workflow.website_id) {
        await fetchWorkflows(workflow.website_id);
      } else {
        await fetchStandaloneWorkflows();
      }
    } catch (err) {
      setError('Failed to delete workflow');
    }
  };

  const getClientWebsites = (clientId: number) => {
    return websites.filter(w => w.client_id === clientId);
  };

  const getWebsiteWorkflows = (websiteId: number) => {
    return workflows.filter(w => w.website_id === websiteId);
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredStandalone = standaloneWorkflows.filter(w =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 left-0 w-80 bg-gray-900 border-r border-gray-700 flex flex-col z-40 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Workflows</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xl"
        >
          &times;
        </button>
      </div>

      {/* View mode tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setViewMode('clients')}
          className={`flex-1 py-2 text-sm font-medium ${
            viewMode === 'clients'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Clients
        </button>
        <button
          onClick={() => setViewMode('standalone')}
          className={`flex-1 py-2 text-sm font-medium ${
            viewMode === 'standalone'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Standalone
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-700">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white text-sm"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/20 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">×</button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-400">Loading...</div>
        ) : viewMode === 'clients' ? (
          <div className="py-2">
            {filteredClients.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No clients found
              </div>
            ) : (
              filteredClients.map((client) => (
                <div key={client.id}>
                  {/* Client row */}
                  <div
                    onClick={() => toggleClient(client)}
                    className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-gray-800 ${
                      selectedClient?.id === client.id ? 'bg-gray-800/50' : ''
                    }`}
                  >
                    <span className={`text-xs transition-transform ${expandedClients.has(client.id) ? 'rotate-90' : ''}`}>
                      ▶
                    </span>
                    <span className="text-white font-medium">{client.name}</span>
                  </div>

                  {/* Websites under client */}
                  {expandedClients.has(client.id) && (
                    <div className="ml-4 border-l border-gray-700">
                      {getClientWebsites(client.id).map((website) => (
                        <div key={website.id}>
                          {/* Website row */}
                          <div
                            onClick={() => toggleWebsite(website)}
                            className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-gray-800 ${
                              selectedWebsite?.id === website.id ? 'bg-gray-800/50' : ''
                            }`}
                          >
                            <span className={`text-xs transition-transform ${expandedWebsites.has(website.id) ? 'rotate-90' : ''}`}>
                              ▶
                            </span>
                            <span className="text-blue-400 text-sm">{website.name}</span>
                          </div>

                          {/* Workflows under website */}
                          {expandedWebsites.has(website.id) && (
                            <div className="ml-4 border-l border-gray-700">
                              {getWebsiteWorkflows(website.id).map((workflow) => (
                                <div
                                  key={workflow.id}
                                  className={`group flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-800 ${
                                    currentWorkflowId === workflow.id ? 'bg-blue-600/20 border-l-2 border-blue-500' : ''
                                  }`}
                                >
                                  <span
                                    onClick={() => handleSelectWorkflow(workflow)}
                                    className="text-gray-300 text-sm flex-1"
                                  >
                                    {workflow.name}
                                  </span>
                                  <div className="hidden group-hover:flex gap-1">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); duplicateWorkflow(workflow); }}
                                      className="text-xs text-gray-500 hover:text-white px-1"
                                      title="Duplicate"
                                    >
                                      ⧉
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteWorkflow(workflow); }}
                                      className="text-xs text-gray-500 hover:text-red-400 px-1"
                                      title="Delete"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {/* Add workflow button */}
                              <button
                                onClick={() => handleCreateWorkflow(client.id, website.id)}
                                className="w-full text-left px-4 py-2 text-gray-500 hover:text-blue-400 text-sm"
                              >
                                + New Workflow
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {getClientWebsites(client.id).length === 0 && (
                        <div className="px-4 py-2 text-gray-500 text-xs">
                          No websites
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="py-2">
            {filteredStandalone.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No standalone workflows
              </div>
            ) : (
              filteredStandalone.map((workflow) => (
                <div
                  key={workflow.id}
                  className={`group flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-800 ${
                    currentWorkflowId === workflow.id ? 'bg-blue-600/20 border-l-2 border-blue-500' : ''
                  }`}
                >
                  <span
                    onClick={() => handleSelectWorkflow(workflow)}
                    className="text-gray-300 flex-1"
                  >
                    {workflow.name}
                  </span>
                  <div className="hidden group-hover:flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); duplicateWorkflow(workflow); }}
                      className="text-xs text-gray-500 hover:text-white px-1"
                      title="Duplicate"
                    >
                      ⧉
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteWorkflow(workflow); }}
                      className="text-xs text-gray-500 hover:text-red-400 px-1"
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer - Create new */}
      <div className="border-t border-gray-700 p-3">
        <button
          onClick={() => handleCreateWorkflow()}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium"
        >
          + New Standalone Workflow
        </button>
      </div>
    </div>
  );
};

export default WorkflowNavigation;
