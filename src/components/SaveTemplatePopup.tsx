import React, { useState } from 'react';

interface SaveTemplatePopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentState: any;
  workflowName: string;
  workflowId?: number; // For copying image creation settings
  onSave: (templateData: any) => Promise<void>;
}

const SECTION_OPTIONS = [
  { key: 'prompts', label: 'Prompt Templates', desc: 'The prompt chain structure', stateKey: 'promptTemplates' },
  { key: 'placeholders', label: 'Placeholders', desc: 'Global and tagged placeholders', stateKey: 'placeholders' },
  { key: 'tags', label: 'Tags', desc: 'Audience tags (B, E, G, etc.)', stateKey: 'tags' },
  { key: 'snippets', label: 'Tagged Snippets', desc: 'Large reusable text blocks', stateKey: 'taggedSnippets' },
  { key: 'settings', label: 'Settings', desc: 'Model, provider, output settings', stateKey: null },
  { key: 'imageCreation', label: 'Image Creation', desc: 'Avatars, reference images, bank, categories', stateKey: null, isExternal: true },
];

const SaveTemplatePopup: React.FC<SaveTemplatePopupProps> = ({
  isOpen,
  onClose,
  currentState,
  workflowName,
  workflowId,
  onSave
}) => {
  const [name, setName] = useState(`${workflowName} Template`);
  const [description, setDescription] = useState(`Template created from workflow: ${workflowName}`);
  const [saving, setSaving] = useState(false);
  const [includes, setIncludes] = useState({
    prompts: true,
    placeholders: true,
    tags: true,
    snippets: true,
    settings: true,
    imageCreation: true
  });

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) return;

    setSaving(true);

    // Build template data based on selected sections
    const templateData: Record<string, any> = {};

    if (includes.prompts && currentState.promptTemplates) {
      templateData.promptTemplates = currentState.promptTemplates;
    }
    if (includes.placeholders && currentState.placeholders) {
      templateData.placeholders = currentState.placeholders;
    }
    if (includes.tags && currentState.tags) {
      templateData.tags = currentState.tags;
    }
    if (includes.snippets && currentState.taggedSnippets) {
      templateData.taggedSnippets = currentState.taggedSnippets;
    }
    if (includes.settings) {
      templateData.settings = {
        provider: currentState.provider,
        model: currentState.model,
        fileNameTemplate: currentState.fileNameTemplate,
        wpContentType: currentState.wpContentType,
        wpTitleTemplate: currentState.wpTitleTemplate
      };
    }

    // Determine template type based on what's included
    const includedSections = Object.entries(includes).filter(([_, v]) => v).map(([k]) => k);
    let templateType = 'full_workflow';
    if (includedSections.length === 1) {
      templateType = includedSections[0];
    }

    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        templateType,
        templateData,
        includes,
        tags: [],
        sourceWorkflowId: workflowId // For copying image creation settings
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleAll = (checked: boolean) => {
    setIncludes({
      prompts: checked,
      placeholders: checked,
      tags: checked,
      snippets: checked,
      settings: checked,
      imageCreation: checked
    });
  };

  const allSelected = Object.values(includes).every(v => v);
  const someSelected = Object.values(includes).some(v => v);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl w-[500px] max-h-[80vh] flex flex-col border border-brand-gold/30">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-brand-gold/30">
          <h2 className="text-lg font-semibold text-brand-gold">Save as Template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Template Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Service Page Workflow"
              className="w-full bg-slate-800 border border-brand-gold/50 rounded px-3 py-2 text-white focus:ring-1 focus:ring-brand-gold"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this template is for..."
              rows={2}
              className="w-full bg-slate-800 border border-brand-gold/50 rounded px-3 py-2 text-white resize-none focus:ring-1 focus:ring-brand-gold"
            />
          </div>

          {/* Section Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400">Include Sections</label>
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="accent-brand-gold"
                />
                Select All
              </label>
            </div>
            <div className="space-y-2">
              {SECTION_OPTIONS.map(({ key, label, desc, stateKey }) => {
                const hasData = stateKey ? (currentState[stateKey]?.length > 0) : true;
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-3 p-3 rounded cursor-pointer transition ${
                      includes[key as keyof typeof includes]
                        ? 'bg-brand-gold/20 border border-brand-gold'
                        : 'bg-slate-800 border border-slate-700'
                    } ${!hasData ? 'opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={includes[key as keyof typeof includes]}
                      onChange={(e) => setIncludes({ ...includes, [key]: e.target.checked })}
                      className="mt-0.5 accent-brand-gold"
                      disabled={!hasData}
                    />
                    <div className="flex-1">
                      <div className="text-white text-sm font-medium flex items-center gap-2">
                        {label}
                        {stateKey && currentState[stateKey] && (
                          <span className="text-xs text-gray-400">
                            ({currentState[stateKey].length})
                          </span>
                        )}
                      </div>
                      <div className="text-gray-400 text-xs">{desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-brand-gold/30">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !someSelected || saving}
            className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark rounded text-slate-900 font-medium text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveTemplatePopup;
