import React, { useState, useEffect, useRef } from 'react';

interface Client {
  id: number;
  name: string;
}

interface Website {
  id: number;
  name: string;
  url?: string;
  client_id: number;
}

interface Workflow {
  id: number;
  name: string;
  client_id?: number;
  website_id?: number;
  client_name?: string;
  website_name?: string;
}

export interface DefaultWorkflowConfig {
  workflowId: number;
  workflowName: string;
  clientId?: number;
  clientName?: string;
  websiteId?: number;
  websiteName?: string;
}

interface DefaultWorkflowSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentDefault: DefaultWorkflowConfig | null;
  onSetDefault: (config: DefaultWorkflowConfig | null) => void;
}

const DefaultWorkflowSelector: React.FC<DefaultWorkflowSelectorProps> = ({
  isOpen,
  onClose,
  currentDefault,
  onSetDefault,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load clients on open
  useEffect(() => {
    if (isOpen) {
      loadClients();
      loadAllWorkflows();
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Load websites when client changes
  useEffect(() => {
    if (selectedClientId) {
      loadWebsites(selectedClientId);
    } else {
      setWebsites([]);
      setSelectedWebsiteId(null);
    }
  }, [selectedClientId]);

  // Load workflows when website changes
  useEffect(() => {
    if (selectedWebsiteId) {
      loadWorkflowsForWebsite(selectedWebsiteId);
    } else if (selectedClientId) {
      loadWorkflowsForClient(selectedClientId);
    }
  }, [selectedWebsiteId, selectedClientId]);

  const loadClients = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      setClients(data.clients || []);
    } catch (err) {
      console.error('Failed to load clients:', err);
    }
  };

  const loadAllWorkflows = async () => {
    try {
      const res = await fetch('/api/workflows');
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    }
  };

  const loadWebsites = async (clientId: number) => {
    try {
      const res = await fetch(`/api/websites?clientId=${clientId}`);
      const data = await res.json();
      setWebsites(data.websites || []);
    } catch (err) {
      console.error('Failed to load websites:', err);
    }
  };

  const loadWorkflowsForClient = async (clientId: number) => {
    try {
      const res = await fetch(`/api/workflows?clientId=${clientId}`);
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    }
  };

  const loadWorkflowsForWebsite = async (websiteId: number) => {
    try {
      const res = await fetch(`/api/workflows?websiteId=${websiteId}`);
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    }
  };

  const handleSelectWorkflow = (workflow: Workflow) => {
    const config: DefaultWorkflowConfig = {
      workflowId: workflow.id,
      workflowName: workflow.name,
      clientId: workflow.client_id,
      clientName: workflow.client_name,
      websiteId: workflow.website_id,
      websiteName: workflow.website_name,
    };
    onSetDefault(config);
    onClose();
  };

  const handleClearDefault = () => {
    onSetDefault(null);
    onClose();
  };

  if (!isOpen) return null;

  // Filter workflows based on selection
  const filteredWorkflows = workflows.filter(w => {
    if (selectedWebsiteId) return w.website_id === selectedWebsiteId;
    if (selectedClientId) return w.client_id === selectedClientId;
    return true; // Show all if nothing selected
  });

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 mt-2 bg-slate-800 border border-brand-gold rounded-lg shadow-2xl z-50 min-w-[600px] max-w-[800px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-600">
        <h3 className="text-brand-gold font-semibold text-sm">Set Default Workflow</h3>
        <div className="flex gap-2">
          {currentDefault && (
            <button
              onClick={handleClearDefault}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-slate-700"
            >
              Clear Default
            </button>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 3-Column Selector */}
      <div className="grid grid-cols-3 divide-x divide-slate-600 max-h-[400px]">
        {/* Clients Column */}
        <div className="p-2">
          <h4 className="text-xs font-semibold text-brand-cyan mb-2 px-2">Clients</h4>
          <div className="space-y-1 max-h-[340px] overflow-y-auto">
            <button
              onClick={() => { setSelectedClientId(null); setSelectedWebsiteId(null); loadAllWorkflows(); }}
              className={`w-full text-left px-2 py-1.5 rounded text-sm transition ${
                !selectedClientId
                  ? 'bg-brand-cyan/20 text-brand-cyan'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              All Clients
            </button>
            {clients.map(client => (
              <button
                key={client.id}
                onClick={() => { setSelectedClientId(client.id); setSelectedWebsiteId(null); }}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition truncate ${
                  selectedClientId === client.id
                    ? 'bg-brand-cyan/20 text-brand-cyan'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
                title={client.name}
              >
                {client.name}
              </button>
            ))}
          </div>
        </div>

        {/* Websites Column */}
        <div className="p-2">
          <h4 className="text-xs font-semibold text-brand-cyan mb-2 px-2">Websites</h4>
          <div className="space-y-1 max-h-[340px] overflow-y-auto">
            {selectedClientId ? (
              <>
                <button
                  onClick={() => { setSelectedWebsiteId(null); loadWorkflowsForClient(selectedClientId); }}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition ${
                    !selectedWebsiteId
                      ? 'bg-brand-cyan/20 text-brand-cyan'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  All Websites
                </button>
                {websites.map(website => (
                  <button
                    key={website.id}
                    onClick={() => setSelectedWebsiteId(website.id)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm transition truncate ${
                      selectedWebsiteId === website.id
                        ? 'bg-brand-cyan/20 text-brand-cyan'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                    title={website.name}
                  >
                    {website.name}
                  </button>
                ))}
                {websites.length === 0 && (
                  <p className="text-slate-500 text-xs px-2 py-2">No websites for this client</p>
                )}
              </>
            ) : (
              <p className="text-slate-500 text-xs px-2 py-2">Select a client first</p>
            )}
          </div>
        </div>

        {/* Workflows Column */}
        <div className="p-2">
          <h4 className="text-xs font-semibold text-brand-cyan mb-2 px-2">Workflows</h4>
          <div className="space-y-1 max-h-[340px] overflow-y-auto">
            {filteredWorkflows.map(workflow => (
              <button
                key={workflow.id}
                onClick={() => handleSelectWorkflow(workflow)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition ${
                  currentDefault?.workflowId === workflow.id
                    ? 'bg-brand-gold/20 text-brand-gold border border-brand-gold/50'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <div className="truncate font-medium" title={workflow.name}>{workflow.name}</div>
                {!selectedClientId && workflow.client_name && (
                  <div className="text-xs text-slate-500 truncate">
                    {workflow.client_name} {workflow.website_name ? `→ ${workflow.website_name}` : ''}
                  </div>
                )}
              </button>
            ))}
            {filteredWorkflows.length === 0 && (
              <p className="text-slate-500 text-xs px-2 py-2">No workflows found</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="p-2 border-t border-slate-600 text-xs text-slate-500">
        Select a workflow to load it automatically on startup
      </div>
    </div>
  );
};

export default DefaultWorkflowSelector;
