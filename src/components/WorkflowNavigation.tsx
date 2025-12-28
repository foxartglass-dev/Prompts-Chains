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
  personal_project_id: number | null;
  name: string;
  description: string | null;
  client_name?: string;
  website_name?: string;
}

interface StandaloneProject {
  id: number;
  name: string;
  description: string | null;
}

interface WorkflowNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkflow: (workflow: Workflow) => void;
  onCreateWorkflow: (name: string, clientId?: number, websiteId?: number, personalProjectId?: number) => void;
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
  const [standaloneProjects, setStandaloneProjects] = useState<StandaloneProject[]>([]);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());
  const [expandedWebsites, setExpandedWebsites] = useState<Set<number>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Create/Edit workflow dialog
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);
  const [workflowDialogMode, setWorkflowDialogMode] = useState<'create' | 'edit'>('create');
  const [workflowName, setWorkflowName] = useState('');
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [createContext, setCreateContext] = useState<{
    clientId?: number;
    websiteId?: number;
    projectId?: number;
  }>({});

  // Create/Edit project dialog (standalone)
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [projectDialogMode, setProjectDialogMode] = useState<'create' | 'edit'>('create');
  const [projectName, setProjectName] = useState('');
  const [editingProject, setEditingProject] = useState<StandaloneProject | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchClients();
      fetchStandaloneWorkflows();
      fetchStandaloneProjects();
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
      const res = await fetch(`/api/websites?client_id=${clientId}`);
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

  const fetchStandaloneProjects = async () => {
    try {
      const res = await fetch('/api/personal-projects');
      if (!res.ok) {
        setStandaloneProjects([]);
        return;
      }
      const data = await res.json();
      setStandaloneProjects(Array.isArray(data) ? data : (Array.isArray(data.projects) ? data.projects : []));
    } catch (err) {
      setStandaloneProjects([]);
      console.error('Failed to fetch standalone projects:', err);
    }
  };

  const fetchProjectWorkflows = async (projectId: number) => {
    try {
      const res = await fetch(`/api/workflows/by-project/${projectId}`);
      if (!res.ok) return;
      const data = await res.json();
      setStandaloneWorkflows(prev => {
        const otherWorkflows = prev.filter(w => w.personal_project_id !== projectId);
        return [...otherWorkflows, ...(data.workflows || [])];
      });
    } catch (err) {
      console.error('Failed to fetch project workflows:', err);
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

  const toggleProject = async (project: StandaloneProject) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(project.id)) {
      newExpanded.delete(project.id);
    } else {
      newExpanded.add(project.id);
      await fetchProjectWorkflows(project.id);
    }
    setExpandedProjects(newExpanded);
  };

  const handleSelectWorkflow = (workflow: Workflow) => {
    onSelectWorkflow(workflow);
    onClose();
  };

  // Open dialog to create new workflow
  const openCreateWorkflowDialog = (clientId?: number, websiteId?: number, projectId?: number) => {
    setWorkflowDialogMode('create');
    setWorkflowName('');
    setEditingWorkflow(null);
    setCreateContext({ clientId, websiteId, projectId });
    setShowWorkflowDialog(true);
  };

  // Open dialog to edit workflow name
  const openEditWorkflowDialog = (workflow: Workflow) => {
    setWorkflowDialogMode('edit');
    setWorkflowName(workflow.name);
    setEditingWorkflow(workflow);
    setShowWorkflowDialog(true);
  };

  // Save workflow (create or update)
  const handleSaveWorkflow = async () => {
    if (!workflowName.trim()) {
      setError('Please enter a workflow name');
      return;
    }

    if (workflowDialogMode === 'edit' && editingWorkflow) {
      // Update existing workflow name
      try {
        const res = await fetch(`/api/workflows/${editingWorkflow.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: workflowName.trim(),
            clientId: editingWorkflow.client_id,
            websiteId: editingWorkflow.website_id,
            personalProjectId: editingWorkflow.personal_project_id,
            state: {} // Preserve state on backend
          })
        });
        if (res.ok) {
          // Refresh appropriate list
          if (editingWorkflow.website_id) {
            await fetchWorkflows(editingWorkflow.website_id);
          } else if (editingWorkflow.personal_project_id) {
            await fetchProjectWorkflows(editingWorkflow.personal_project_id);
          } else {
            await fetchStandaloneWorkflows();
          }
          setShowWorkflowDialog(false);
        } else {
          setError('Failed to update workflow');
        }
      } catch (err) {
        setError('Failed to update workflow');
      }
    } else {
      // Create new workflow
      onCreateWorkflow(workflowName.trim(), createContext.clientId, createContext.websiteId, createContext.projectId);
      setShowWorkflowDialog(false);
    }
  };

  // Open dialog to create new project
  const openCreateProjectDialog = () => {
    setProjectDialogMode('create');
    setProjectName('');
    setEditingProject(null);
    setShowProjectDialog(true);
  };

  // Open dialog to edit project name
  const openEditProjectDialog = (project: StandaloneProject) => {
    setProjectDialogMode('edit');
    setProjectName(project.name);
    setEditingProject(project);
    setShowProjectDialog(true);
  };

  // Save project (create or update)
  const handleSaveProject = async () => {
    if (!projectName.trim()) {
      setError('Please enter a project name');
      return;
    }

    if (projectDialogMode === 'edit' && editingProject) {
      // Update existing project
      try {
        const res = await fetch(`/api/personal-projects/${editingProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: projectName.trim() })
        });
        if (res.ok) {
          await fetchStandaloneProjects();
          setShowProjectDialog(false);
        } else {
          setError('Failed to update project');
        }
      } catch (err) {
        setError('Failed to update project');
      }
    } else {
      // Create new project
      try {
        const res = await fetch('/api/personal-projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: projectName.trim() })
        });
        if (res.ok) {
          await fetchStandaloneProjects();
          setShowProjectDialog(false);
        } else {
          setError('Failed to create project');
        }
      } catch (err) {
        setError('Failed to create project');
      }
    }
  };

  // Delete project
  const deleteProject = async (project: StandaloneProject) => {
    if (!confirm(`Delete project "${project.name}"? All workflows inside will become ungrouped.`)) return;
    try {
      await fetch(`/api/personal-projects/${project.id}`, { method: 'DELETE' });
      await fetchStandaloneProjects();
      await fetchStandaloneWorkflows();
    } catch (err) {
      setError('Failed to delete project');
    }
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

  const getProjectWorkflows = (projectId: number) => {
    return standaloneWorkflows.filter(w => w.personal_project_id === projectId);
  };

  const getUngroupedWorkflows = () => {
    return standaloneWorkflows.filter(w => !w.personal_project_id);
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProjects = standaloneProjects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUngroupedWorkflows = getUngroupedWorkflows().filter(w =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 left-0 w-80 bg-slate-900 border-r-2 border-brand-cyan flex flex-col z-40 shadow-xl shadow-brand-cyan/30" style={{ boxShadow: '4px 0 20px rgba(0, 255, 255, 0.3), inset -2px 0 10px rgba(0, 255, 255, 0.1)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-brand-cyan/30">
        <h2 className="text-lg font-semibold text-white">Workflows</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xl"
        >
          &times;
        </button>
      </div>

      {/* View mode tabs */}
      <div className="flex border-b border-brand-cyan/30">
        <button
          onClick={() => setViewMode('clients')}
          className={`flex-1 py-2 text-sm font-medium ${
            viewMode === 'clients'
              ? 'text-brand-cyan border-b-2 border-brand-cyan'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Clients
        </button>
        <button
          onClick={() => setViewMode('standalone')}
          className={`flex-1 py-2 text-sm font-medium ${
            viewMode === 'standalone'
              ? 'text-brand-cyan border-b-2 border-brand-cyan'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Standalone
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-brand-cyan/30">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-800 border border-brand-cyan/50 rounded px-3 py-1.5 text-white text-sm focus:ring-1 focus:ring-brand-cyan"
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
                    <div className="ml-4 border-l border-brand-cyan/30">
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
                            <span className="text-brand-cyan text-sm">{website.name}</span>
                          </div>

                          {/* Workflows under website */}
                          {expandedWebsites.has(website.id) && (
                            <div className="ml-4 border-l border-brand-cyan/30">
                              {getWebsiteWorkflows(website.id).map((workflow) => (
                                <div
                                  key={workflow.id}
                                  className={`group flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-800 ${
                                    currentWorkflowId === workflow.id ? 'bg-brand-cyan/20 border-l-2 border-brand-cyan' : ''
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
                                      onClick={(e) => { e.stopPropagation(); openEditWorkflowDialog(workflow); }}
                                      className="text-sm text-cyan-400 hover:text-cyan-300 px-1.5 drop-shadow-[0_0_4px_rgba(0,255,255,0.6)]"
                                      title="Rename"
                                    >
                                      ✎
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); duplicateWorkflow(workflow); }}
                                      className="text-sm text-brand-gold hover:text-brand-gold-light px-1.5 drop-shadow-[0_0_4px_rgba(255,215,0,0.6)]"
                                      title="Duplicate"
                                    >
                                      ⧉
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteWorkflow(workflow); }}
                                      className="text-sm text-red-400 hover:text-red-300 px-1.5 drop-shadow-[0_0_4px_rgba(255,100,100,0.6)]"
                                      title="Delete"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {/* Add workflow button */}
                              <button
                                onClick={() => openCreateWorkflowDialog(client.id, website.id)}
                                className="w-full text-left px-4 py-2 text-gray-500 hover:text-brand-cyan text-sm"
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
            {/* Projects section */}
            {filteredProjects.map((project) => (
              <div key={project.id}>
                {/* Project row */}
                <div
                  className={`group flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-gray-800`}
                >
                  <span
                    onClick={() => toggleProject(project)}
                    className={`text-xs transition-transform ${expandedProjects.has(project.id) ? 'rotate-90' : ''}`}
                  >
                    ▶
                  </span>
                  <span onClick={() => toggleProject(project)} className="text-brand-gold font-medium flex-1">
                    {project.name}
                  </span>
                  <div className="hidden group-hover:flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditProjectDialog(project); }}
                      className="text-xs text-gray-500 hover:text-cyan-400 px-1"
                      title="Rename Project"
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteProject(project); }}
                      className="text-xs text-gray-500 hover:text-red-400 px-1"
                      title="Delete Project"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Workflows under project */}
                {expandedProjects.has(project.id) && (
                  <div className="ml-4 border-l border-brand-cyan/30">
                    {getProjectWorkflows(project.id).map((workflow) => (
                      <div
                        key={workflow.id}
                        className={`group flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-800 ${
                          currentWorkflowId === workflow.id ? 'bg-brand-cyan/20 border-l-2 border-brand-cyan' : ''
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
                            onClick={(e) => { e.stopPropagation(); openEditWorkflowDialog(workflow); }}
                            className="text-sm text-cyan-400 hover:text-cyan-300 px-1.5 drop-shadow-[0_0_4px_rgba(0,255,255,0.6)]"
                            title="Rename"
                          >
                            ✎
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); duplicateWorkflow(workflow); }}
                            className="text-sm text-brand-gold hover:text-brand-gold-light px-1.5 drop-shadow-[0_0_4px_rgba(255,215,0,0.6)]"
                            title="Duplicate"
                          >
                            ⧉
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteWorkflow(workflow); }}
                            className="text-sm text-red-400 hover:text-red-300 px-1.5 drop-shadow-[0_0_4px_rgba(255,100,100,0.6)]"
                            title="Delete"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    {/* Add workflow to project */}
                    <button
                      onClick={() => openCreateWorkflowDialog(undefined, undefined, project.id)}
                      className="w-full text-left px-4 py-2 text-gray-500 hover:text-brand-cyan text-sm"
                    >
                      + New Workflow
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Ungrouped workflows section */}
            {filteredUngroupedWorkflows.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs text-gray-500 uppercase mt-2 border-t border-brand-cyan/30">
                  Ungrouped Workflows
                </div>
                {filteredUngroupedWorkflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    className={`group flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-800 ${
                      currentWorkflowId === workflow.id ? 'bg-brand-cyan/20 border-l-2 border-brand-cyan' : ''
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
                        onClick={(e) => { e.stopPropagation(); openEditWorkflowDialog(workflow); }}
                        className="text-sm text-cyan-400 hover:text-cyan-300 px-1.5 drop-shadow-[0_0_4px_rgba(0,255,255,0.6)]"
                        title="Rename"
                      >
                        ✎
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); duplicateWorkflow(workflow); }}
                        className="text-sm text-brand-gold hover:text-brand-gold-light px-1.5 drop-shadow-[0_0_4px_rgba(255,215,0,0.6)]"
                        title="Duplicate"
                      >
                        ⧉
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteWorkflow(workflow); }}
                        className="text-sm text-red-400 hover:text-red-300 px-1.5 drop-shadow-[0_0_4px_rgba(255,100,100,0.6)]"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Empty state */}
            {filteredProjects.length === 0 && filteredUngroupedWorkflows.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                No projects or workflows yet
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer - Create new */}
      <div className="border-t border-brand-cyan/30 p-3 space-y-2">
        {viewMode === 'standalone' && (
          <button
            onClick={openCreateProjectDialog}
            className="w-full py-2 bg-brand-gold hover:bg-brand-gold-dark hover:shadow-glow-gold rounded text-slate-900 text-sm font-medium"
          >
            + New Project
          </button>
        )}
        <button
          onClick={() => openCreateWorkflowDialog()}
          className="w-full py-2 bg-brand-cyan hover:bg-brand-cyan-dark hover:shadow-glow-cyan rounded text-slate-900 text-sm font-medium"
        >
          + New {viewMode === 'standalone' ? 'Ungrouped ' : 'Standalone '}Workflow
        </button>
      </div>

      {/* Workflow Name Dialog */}
      {showWorkflowDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              {workflowDialogMode === 'create' ? 'Create New Workflow' : 'Rename Workflow'}
            </h3>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveWorkflow()}
              placeholder="Enter workflow name..."
              autoFocus
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowWorkflowDialog(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWorkflow}
                className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan-dark rounded text-slate-900 text-sm font-medium"
              >
                {workflowDialogMode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Name Dialog */}
      {showProjectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              {projectDialogMode === 'create' ? 'Create New Project' : 'Rename Project'}
            </h3>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveProject()}
              placeholder="Enter project name..."
              autoFocus
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowProjectDialog(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProject}
                className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark hover:shadow-glow-gold rounded text-slate-900 text-sm font-medium"
              >
                {projectDialogMode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowNavigation;
