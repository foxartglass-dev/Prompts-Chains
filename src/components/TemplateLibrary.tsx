import React, { useState, useEffect } from 'react';

interface Template {
  id: number;
  name: string;
  description: string;
  template_type: string;
  template_data: Record<string, any>;
  includes: Record<string, boolean>;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface TemplateLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate?: (template: Template) => void;
  currentWorkflowId?: number;
  currentWebsiteId?: number;
}

type ViewMode = 'browse' | 'create' | 'preview';

const TEMPLATE_TYPES = [
  { value: 'full_workflow', label: 'Full Workflow', description: 'Complete workflow with all settings' },
  { value: 'prompts', label: 'Prompts Only', description: 'Just the prompt templates' },
  { value: 'placeholders', label: 'Placeholders Only', description: 'Just placeholders' },
  { value: 'tags', label: 'Tags Only', description: 'Just audience tags' },
  { value: 'snippets', label: 'Snippets Only', description: 'Just tagged snippets' },
  { value: 'website_setup', label: 'Website Setup', description: 'Multiple workflows for a website' },
];

const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  isOpen,
  onClose,
  onApplyTemplate,
  currentWorkflowId,
  currentWebsiteId
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Create form
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    tags: ''
  });
  const [includes, setIncludes] = useState({
    prompts: true,
    placeholders: true,
    tags: true,
    snippets: true,
    settings: true
  });

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, typeFilter]);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/templates';
      const params = new URLSearchParams();
      if (typeFilter) params.append('type', typeFilter);
      if (searchTerm) params.append('search', searchTerm);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) {
        // Database tables may not exist
        setTemplates([]);
        return;
      }
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : (Array.isArray(data.templates) ? data.templates : []));
    } catch (err) {
      setTemplates([]);
      // Don't show error for missing tables
    } finally {
      setLoading(false);
    }
  };

  const createTemplateFromWorkflow = async () => {
    if (!currentWorkflowId) {
      setError('No workflow selected');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/templates/from-workflow/${currentWorkflowId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          description: createForm.description,
          includes,
          tags: createForm.tags.split(',').map(t => t.trim()).filter(Boolean)
        })
      });

      const data = await res.json();
      if (data.template) {
        setTemplates([data.template, ...templates]);
        setViewMode('browse');
        setCreateForm({ name: '', description: '', tags: '' });
      } else {
        setError(data.error || 'Failed to create template');
      }
    } catch (err) {
      setError('Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  const createTemplateFromWebsite = async () => {
    if (!currentWebsiteId) {
      setError('No website selected');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/templates/from-website/${currentWebsiteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          description: createForm.description,
          tags: createForm.tags.split(',').map(t => t.trim()).filter(Boolean)
        })
      });

      const data = await res.json();
      if (data.template) {
        setTemplates([data.template, ...templates]);
        setViewMode('browse');
        setCreateForm({ name: '', description: '', tags: '' });
      } else {
        setError(data.error || 'Failed to create template');
      }
    } catch (err) {
      setError('Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = async (template: Template, merge: boolean = false) => {
    if (!currentWorkflowId) {
      // Just pass the template data to parent
      onApplyTemplate?.(template);
      onClose();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/templates/${template.id}/apply/${currentWorkflowId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merge })
      });

      const data = await res.json();
      if (data.workflow) {
        onApplyTemplate?.(template);
        onClose();
      } else {
        setError(data.error || 'Failed to apply template');
      }
    } catch (err) {
      setError('Failed to apply template');
    } finally {
      setLoading(false);
    }
  };

  const applyWebsiteTemplate = async (template: Template) => {
    if (!currentWebsiteId) {
      setError('No website selected');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/templates/${template.id}/apply-to-website/${currentWebsiteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();
      if (data.workflows) {
        onApplyTemplate?.(template);
        onClose();
      } else {
        setError(data.error || 'Failed to apply template');
      }
    } catch (err) {
      setError('Failed to apply template');
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm('Delete this template?')) return;

    try {
      await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      setTemplates(templates.filter(t => t.id !== id));
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
        setViewMode('browse');
      }
    } catch (err) {
      setError('Failed to delete template');
    }
  };

  const getTypeLabel = (type: string) => {
    return TEMPLATE_TYPES.find(t => t.value === type)?.label || type;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'full_workflow': return 'bg-brand-gold';
      case 'prompts': return 'bg-brand-cyan';
      case 'placeholders': return 'bg-green-600';
      case 'tags': return 'bg-yellow-600';
      case 'snippets': return 'bg-brand-gold';
      case 'website_setup': return 'bg-indigo-600';
      default: return 'bg-gray-600';
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg w-[85vw] h-[80vh] flex flex-col overflow-hidden border border-brand-cyan/30">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-brand-cyan/30">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-white">Template Library</h2>
            {viewMode !== 'browse' && (
              <button
                onClick={() => { setViewMode('browse'); setSelectedTemplate(null); }}
                className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
              >
                <span>&larr;</span> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {viewMode === 'browse' && (
              <button
                onClick={() => setViewMode('create')}
                className="px-3 py-1.5 bg-brand-cyan hover:bg-brand-cyan-dark hover:shadow-glow-cyan rounded text-sm text-slate-900 font-medium"
              >
                + Save Current as Template
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {error && (
            <div className="absolute top-16 left-4 right-4 bg-red-500/20 text-red-400 p-3 rounded z-10">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
            </div>
          )}

          {viewMode === 'browse' && (
            <>
              {/* Sidebar filters */}
              <div className="w-56 border-r border-brand-cyan/30 p-4 flex flex-col gap-4">
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-800 border border-brand-cyan/30 rounded px-3 py-2 text-white text-sm"
                />
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Filter by Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full bg-gray-800 border border-brand-cyan/30 rounded px-2 py-1.5 text-white text-sm"
                  >
                    <option value="">All Types</option>
                    {TEMPLATE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1" />
                <div className="text-xs text-gray-500">
                  {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Template grid */}
              <div className="flex-1 p-4 overflow-auto">
                {loading ? (
                  <div className="text-center text-gray-400 py-8">Loading...</div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    No templates found. Create one from your current workflow!
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {filteredTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium text-white">{template.name}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs text-white ${getTypeColor(template.template_type)}`}>
                            {getTypeLabel(template.template_type)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                          {template.description || 'No description'}
                        </p>
                        {template.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {template.tags.map((tag, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                          <span>{new Date(template.created_at).toLocaleDateString()}</span>
                          {template.includes && (
                            <span>
                              {Object.entries(template.includes).filter(([_, v]) => v).length} sections
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setSelectedTemplate(template); setViewMode('preview'); }}
                            className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
                          >
                            Preview
                          </button>
                          {template.template_type === 'website_setup' ? (
                            <button
                              onClick={() => applyWebsiteTemplate(template)}
                              className="flex-1 px-2 py-1.5 bg-brand-cyan hover:bg-brand-cyan-dark hover:shadow-glow-cyan rounded text-sm text-slate-900 font-medium"
                            >
                              Apply to Website
                            </button>
                          ) : (
                            <button
                              onClick={() => applyTemplate(template)}
                              className="flex-1 px-2 py-1.5 bg-brand-cyan hover:bg-brand-cyan-dark hover:shadow-glow-cyan rounded text-sm text-slate-900 font-medium"
                            >
                              Apply
                            </button>
                          )}
                          <button
                            onClick={() => deleteTemplate(template.id)}
                            className="px-2 py-1.5 border border-brand-cyan rounded text-sm text-brand-cyan hover:bg-brand-cyan/10"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {viewMode === 'create' && (
            <div className="flex-1 p-6 overflow-auto">
              <div className="max-w-2xl mx-auto">
                <h3 className="text-lg font-medium text-white mb-6">Save Current Workflow as Template</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Template Name *</label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      placeholder="e.g., Single Audience SEO Workflow"
                      className="w-full bg-gray-800 border border-brand-cyan/30 rounded px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Description</label>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      placeholder="Describe what this template is for..."
                      rows={3}
                      className="w-full bg-gray-800 border border-brand-cyan/30 rounded px-3 py-2 text-white resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Tags (comma-separated)</label>
                    <input
                      type="text"
                      value={createForm.tags}
                      onChange={(e) => setCreateForm({ ...createForm, tags: e.target.value })}
                      placeholder="e.g., seo, single-audience, local-business"
                      className="w-full bg-gray-800 border border-brand-cyan/30 rounded px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-3">Include Sections</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'prompts', label: 'Prompt Templates', desc: 'The prompt chain structure' },
                        { key: 'placeholders', label: 'Placeholders', desc: 'Global and tagged placeholders' },
                        { key: 'tags', label: 'Tags', desc: 'Audience tags (B, E, G, etc.)' },
                        { key: 'snippets', label: 'Tagged Snippets', desc: 'Large reusable text blocks' },
                        { key: 'settings', label: 'Settings', desc: 'Model, provider, output settings' },
                      ].map(({ key, label, desc }) => (
                        <label
                          key={key}
                          className={`flex items-start gap-3 p-3 rounded cursor-pointer ${
                            includes[key as keyof typeof includes]
                              ? 'bg-brand-cyan/20 border border-brand-cyan'
                              : 'bg-gray-800 border border-brand-cyan/30'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={includes[key as keyof typeof includes]}
                            onChange={(e) => setIncludes({ ...includes, [key]: e.target.checked })}
                            className="mt-1"
                          />
                          <div>
                            <div className="text-white text-sm font-medium">{label}</div>
                            <div className="text-gray-400 text-xs">{desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={createTemplateFromWorkflow}
                      disabled={!createForm.name || loading}
                      className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan-dark hover:shadow-glow-cyan rounded text-slate-900 font-medium disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save Workflow Template'}
                    </button>
                    {currentWebsiteId && (
                      <button
                        onClick={createTemplateFromWebsite}
                        disabled={!createForm.name || loading}
                        className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark hover:shadow-glow-gold rounded text-slate-900 font-medium disabled:opacity-50"
                      >
                        Save All Website Workflows
                      </button>
                    )}
                    <button
                      onClick={() => setViewMode('browse')}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'preview' && selectedTemplate && (
            <div className="flex-1 p-6 overflow-auto">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-medium text-white">{selectedTemplate.name}</h3>
                    <p className="text-gray-400 mt-1">{selectedTemplate.description || 'No description'}</p>
                  </div>
                  <span className={`px-3 py-1 rounded text-sm text-white ${getTypeColor(selectedTemplate.template_type)}`}>
                    {getTypeLabel(selectedTemplate.template_type)}
                  </span>
                </div>

                {/* Included sections */}
                {selectedTemplate.includes && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Included Sections</h4>
                    <div className="flex gap-2">
                      {Object.entries(selectedTemplate.includes)
                        .filter(([_, v]) => v)
                        .map(([key]) => (
                          <span key={key} className="px-2 py-1 bg-gray-800 rounded text-sm text-white capitalize">
                            {key}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* Template data preview */}
                <div className="space-y-4">
                  {selectedTemplate.template_data?.promptTemplates && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-blue-400 mb-3">
                        Prompt Templates ({selectedTemplate.template_data.promptTemplates.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedTemplate.template_data.promptTemplates.map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-white">{p.name || `Prompt ${i + 1}`}</span>
                            <span className="text-gray-500">{p.outputKey}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTemplate.template_data?.placeholders && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-green-400 mb-3">
                        Placeholders ({selectedTemplate.template_data.placeholders.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedTemplate.template_data.placeholders.map((p: any, i: number) => (
                          <span key={i} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                            {'{' + p.key + (p.tag ? `{${p.tag}}` : '') + '}'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTemplate.template_data?.tags && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-yellow-400 mb-3">
                        Tags ({selectedTemplate.template_data.tags.length})
                      </h4>
                      <div className="flex gap-2">
                        {selectedTemplate.template_data.tags.map((t: any, i: number) => (
                          <span key={i} className="px-3 py-1 bg-brand-gold/30 border border-brand-gold rounded text-sm text-slate-900 font-medium">
                            {t.name} ({t.key})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTemplate.template_data?.taggedSnippets && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-brand-gold mb-3">
                        Tagged Snippets ({selectedTemplate.template_data.taggedSnippets.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedTemplate.template_data.taggedSnippets.map((s: any, i: number) => (
                          <div key={i} className="text-sm">
                            <span className="text-white">{'{{{' + s.key + '}}}'}</span>
                            <span className="text-gray-500 ml-2">
                              ({Object.keys(s.values || {}).length} variations)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTemplate.template_data?.workflows && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-indigo-400 mb-3">
                        Workflows ({selectedTemplate.template_data.workflows.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedTemplate.template_data.workflows.map((w: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-700 rounded">
                            <span className="text-white">{w.name}</span>
                            <span className="text-gray-500">
                              {w.state?.promptTemplates?.length || 0} prompts
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Apply buttons */}
                <div className="flex gap-3 mt-6">
                  {selectedTemplate.template_type === 'website_setup' ? (
                    <button
                      onClick={() => applyWebsiteTemplate(selectedTemplate)}
                      disabled={!currentWebsiteId || loading}
                      className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan-dark hover:shadow-glow-cyan rounded text-slate-900 font-medium disabled:opacity-50"
                    >
                      Apply to Current Website
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => applyTemplate(selectedTemplate, false)}
                        disabled={loading}
                        className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan-dark hover:shadow-glow-cyan rounded text-slate-900 font-medium disabled:opacity-50"
                      >
                        Replace Current
                      </button>
                      <button
                        onClick={() => applyTemplate(selectedTemplate, true)}
                        disabled={loading}
                        className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark hover:shadow-glow-gold rounded text-slate-900 font-medium disabled:opacity-50"
                      >
                        Merge with Current
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => deleteTemplate(selectedTemplate.id)}
                    className="px-4 py-2 border border-brand-cyan rounded text-brand-cyan hover:bg-brand-cyan/10"
                  >
                    Delete Template
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateLibrary;
