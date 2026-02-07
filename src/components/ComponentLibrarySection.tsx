/**
 * ComponentLibrarySection Component
 * UI for managing reusable page components (sliders, stats bars, benefits)
 * Components are captured from WordPress pages and auto-injected based on audience tags
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Tag {
  id: number;
  name: string;
}

interface Component {
  id: number;
  workflow_id: number;
  slot_number: number;
  slot_name: string;
  component_type: 'slider_revolution' | 'elementor_template';
  component_ref: string;
  tag: string | null;
  name: string;
  source_page_id: number | null;
  source_page_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

interface SlotConfig {
  number: number;
  name: string;
  position: string;
  rotation: 'sequential' | 'random';
  enabled?: boolean; // Whether this slot is active (default true)
}

interface ComponentSettings {
  enabled: boolean;
  slots: SlotConfig[];
}

interface DetectedComponent {
  type: 'slider_revolution' | 'elementor_template';
  alias?: string;
  templateId?: string;
  elementorId?: string;
  depth?: number;
}

interface ComponentLibraryProps {
  workflowId: number | null;
  websiteId?: number | null;
  tags?: Tag[];
  websiteUrl?: string;
}

// Sub-component for detected component row with slot/tag selection
// Must be defined BEFORE ComponentLibrarySection to avoid hoisting issues
const DetectedComponentRow: React.FC<{
  detected: DetectedComponent;
  label: string;
  tags: Tag[];
  onSave: (detected: DetectedComponent, slot: number, tag: string, name: string) => void;
}> = ({ detected, label, tags, onSave }) => {
  const [slot, setSlot] = useState(1);
  const [tag, setTag] = useState('');
  const [name, setName] = useState(detected.alias || detected.templateId || '');

  return (
    <div className="flex items-center gap-2 bg-slate-900 rounded p-2">
      <span className="text-xs text-gray-300 flex-shrink-0">{label}</span>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="flex-1 bg-slate-800 border border-gray-600 rounded px-2 py-1 text-xs text-white"
      />
      <select
        value={slot}
        onChange={(e) => setSlot(parseInt(e.target.value))}
        className="bg-slate-800 border border-gray-600 rounded px-1 py-1 text-xs text-white"
      >
        <option value={1}>Slot 1</option>
        <option value={2}>Slot 2</option>
        <option value={3}>Slot 3</option>
      </select>
      <select
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        className="bg-slate-800 border border-gray-600 rounded px-1 py-1 text-xs text-white"
      >
        <option value="">Global</option>
        {tags.map(t => (
          <option key={t.id} value={t.name}>{t.name}</option>
        ))}
      </select>
      <button
        onClick={() => onSave(detected, slot, tag, name)}
        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-500"
      >
        Add
      </button>
    </div>
  );
};

const ComponentLibrarySection: React.FC<ComponentLibraryProps> = ({
  workflowId,
  websiteId,
  tags = [],
  websiteUrl
}) => {
  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [components, setComponents] = useState<Component[]>([]);
  const [settings, setSettings] = useState<ComponentSettings>({
    enabled: false,
    slots: [
      { number: 1, name: 'Hero/Slider', position: 'top', rotation: 'sequential', enabled: true },
      { number: 2, name: 'Stats Bar', position: 'middle', rotation: 'sequential', enabled: true },
      { number: 3, name: 'Benefits', position: 'bottom', rotation: 'sequential', enabled: true }
    ]
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Capture from page state
  const [pageIdInput, setPageIdInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [detectedComponents, setDetectedComponents] = useState<{
    sliders: DetectedComponent[];
    templates: DetectedComponent[];
    pageInfo?: { id: number; title: string; url: string };
  } | null>(null);

  // Manual add state
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualForm, setManualForm] = useState({
    componentType: 'slider_revolution' as 'slider_revolution' | 'elementor_template',
    componentRef: '',
    moduleName: '', // SR Module Name (only for slider_revolution)
    name: '',
    slotNumber: 1,
    tag: '' // Empty string = Global
  });

  // Bulk component refresh state
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [resetRotation, setResetRotation] = useState(true);
  const [publishedCount, setPublishedCount] = useState<number | null>(null);
  const [refreshProgress, setRefreshProgress] = useState<{
    active: boolean;
    total: number;
    current: number;
    succeeded: number;
    failed: number;
    errors: Array<{ articleId: number; keyword: string; error: string }>;
    complete: boolean;
    phase: string;
    currentKeyword?: string;
  } | null>(null);

  // Fetch components and settings
  const fetchData = useCallback(async () => {
    if (!workflowId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/component-library/${workflowId}`);
      const data = await response.json();

      if (data.success) {
        setComponents(data.components || []);
        if (data.settings) {
          // Ensure slots array exists and has enabled property
          const slots = (data.settings.slots || [
            { number: 1, name: 'Hero/Slider', position: 'top', rotation: 'sequential', enabled: true },
            { number: 2, name: 'Stats Bar', position: 'middle', rotation: 'sequential', enabled: true },
            { number: 3, name: 'Benefits', position: 'bottom', rotation: 'sequential', enabled: true }
          ]).map((s: SlotConfig) => ({ ...s, enabled: s.enabled !== false })); // Default enabled to true
          setSettings({
            ...data.settings,
            slots
          });
        }
      } else {
        setError(data.error || 'Failed to load components');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setIsLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle enabled
  const handleToggleEnabled = async () => {
    if (!workflowId) return;

    const newSettings = { ...settings, enabled: !settings.enabled };
    try {
      const response = await fetch(`/api/component-library/${workflowId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings })
      });

      const data = await response.json();
      if (data.success) {
        setSettings(newSettings);
        setSuccessMessage(newSettings.enabled ? 'Component Library enabled' : 'Component Library disabled');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Update slot rotation
  const handleSlotRotationChange = async (slotNumber: number, rotation: 'sequential' | 'random') => {
    if (!workflowId) return;

    const newSlots = (settings.slots || []).map(s =>
      s.number === slotNumber ? { ...s, rotation } : s
    );
    const newSettings = { ...settings, slots: newSlots };

    try {
      await fetch(`/api/component-library/${workflowId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings })
      });
      setSettings(newSettings);
    } catch (err) {
      // Ignore errors for rotation toggle
    }
  };

  // Toggle individual slot enabled/disabled
  const handleSlotToggle = async (slotNumber: number) => {
    if (!workflowId) return;

    const newSlots = (settings.slots || []).map(s =>
      s.number === slotNumber ? { ...s, enabled: !(s.enabled !== false) } : s
    );
    const newSettings = { ...settings, slots: newSlots };

    try {
      await fetch(`/api/component-library/${workflowId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings })
      });
      setSettings(newSettings);
    } catch (err) {
      // Ignore errors for slot toggle
    }
  };

  // Master toggle - turn all slots on or off
  const handleMasterSlotToggle = async () => {
    if (!workflowId) return;

    // Check if ALL slots are currently enabled
    const allEnabled = (settings.slots || []).every(s => s.enabled !== false);
    // If all are on, turn all off. Otherwise, turn all on.
    const newEnabled = !allEnabled;

    const newSlots = (settings.slots || []).map(s => ({ ...s, enabled: newEnabled }));
    const newSettings = { ...settings, slots: newSlots };

    try {
      await fetch(`/api/component-library/${workflowId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings })
      });
      setSettings(newSettings);
      setSuccessMessage(newEnabled ? 'All slots enabled' : 'All slots disabled');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err) {
      // Ignore errors
    }
  };

  // Fetch page and detect components
  const handleFetchPage = async () => {
    if (!workflowId || !pageIdInput.trim()) {
      setError('Please enter a WordPress page ID');
      return;
    }

    setIsFetching(true);
    setError(null);
    setDetectedComponents(null);

    try {
      const response = await fetch(`/api/component-library/${workflowId}/fetch-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: parseInt(pageIdInput.trim()) })
      });

      const data = await response.json();

      if (data.success) {
        setDetectedComponents({
          sliders: data.detected.sliders,
          templates: data.detected.templates,
          pageInfo: data.pageInfo
        });

        if (data.detected.total === 0) {
          setError('No Slider Revolution or Elementor Template widgets found on this page');
        }
      } else {
        setError(data.error || 'Failed to fetch page');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setIsFetching(false);
    }
  };

  // Save detected component
  const handleSaveDetected = async (
    detected: DetectedComponent,
    slotNumber: number,
    tag: string,
    customName: string
  ) => {
    if (!workflowId) return;

    try {
      const response = await fetch(`/api/component-library/${workflowId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentType: detected.type,
          componentRef: detected.type === 'slider_revolution' ? detected.alias : detected.templateId,
          name: customName,
          slotNumber,
          tag: tag || null,
          sourcePageId: detectedComponents?.pageInfo?.id,
          sourcePageUrl: detectedComponents?.pageInfo?.url
        })
      });

      const data = await response.json();
      if (data.success) {
        setSuccessMessage(`Added: ${customName}`);
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchData(); // Refresh list
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Manual add component
  const handleManualAdd = async () => {
    if (!workflowId || !manualForm.componentRef || !manualForm.name) {
      setError('Please fill in all required fields');
      return;
    }

    // For slider_revolution, module name is required
    if (manualForm.componentType === 'slider_revolution' && !manualForm.moduleName) {
      setError('Module Name is required for Slider Revolution widgets');
      return;
    }

    try {
      const response = await fetch(`/api/component-library/${workflowId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentType: manualForm.componentType,
          componentRef: manualForm.componentRef,
          moduleName: manualForm.componentType === 'slider_revolution' ? manualForm.moduleName : null,
          name: manualForm.name,
          slotNumber: manualForm.slotNumber,
          tag: manualForm.tag || null
        })
      });

      const data = await response.json();
      if (data.success) {
        setSuccessMessage(`Added: ${manualForm.name}`);
        setManualForm({
          componentType: 'slider_revolution',
          componentRef: '',
          moduleName: '',
          name: '',
          slotNumber: 1,
          tag: ''
        });
        setShowManualAdd(false);
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchData();
      } else {
        setError(data.error || 'Failed to add');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Delete component
  const handleDelete = async (componentId: number) => {
    if (!workflowId || !confirm('Remove this component?')) return;

    try {
      await fetch(`/api/component-library/${workflowId}/${componentId}`, {
        method: 'DELETE'
      });
      setSuccessMessage('Component removed');
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Fetch published page count for refresh modal
  const fetchPublishedCount = useCallback(async () => {
    if (!workflowId) return;
    try {
      const url = `/api/articles?workflowId=${workflowId}`;
      const res = await fetch(url);
      const data = await res.json();
      const published = (data.articles || []).filter((a: any) => a.wp_post_id).length;
      setPublishedCount(published);
    } catch {
      setPublishedCount(null);
    }
  }, [workflowId]);

  // Open refresh modal
  const handleOpenRefreshModal = () => {
    setShowRefreshModal(true);
    fetchPublishedCount();
  };

  // Bulk refresh components via SSE
  const handleBulkRefreshComponents = async () => {
    if (!workflowId) return;

    setShowRefreshModal(false);
    setRefreshProgress({
      active: true, total: 0, current: 0, succeeded: 0, failed: 0,
      errors: [], complete: false, phase: 'starting'
    });
    setError(null);

    try {
      // Fetch website credentials
      let wpUrl = '', wpUser = '', wpPassword = '';
      if (websiteId) {
        const wsRes = await fetch(`/api/websites/${websiteId}`);
        const wsData = await wsRes.json();
        const website = wsData.website;
        if (!website || !website.wp_url || !website.wp_user || !website.wp_app_password) {
          setError('WordPress credentials not configured for this website');
          setRefreshProgress(null);
          return;
        }
        wpUrl = website.wp_url;
        wpUser = website.wp_user;
        wpPassword = website.wp_app_password;
      } else {
        setError('No website associated with this workflow');
        setRefreshProgress(null);
        return;
      }

      const response = await fetch('/api/elementor/bulk-update-components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          websiteId,
          resetRotation,
          wpUrl,
          wpUser,
          wpPassword
        })
      });

      if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
        const errData = await response.json();
        setError(errData.error || 'Failed to start component refresh');
        setRefreshProgress(null);
        return;
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setError('Failed to read response stream');
        setRefreshProgress(null);
        return;
      }

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'progress') {
                setRefreshProgress(prev => prev ? {
                  ...prev,
                  total: data.total ?? prev.total,
                  current: (data.succeeded ?? 0) + (data.failed ?? 0),
                  succeeded: data.succeeded ?? prev.succeeded,
                  failed: data.failed ?? prev.failed,
                  errors: data.errors ?? prev.errors,
                  phase: data.phase ?? prev.phase,
                  currentKeyword: data.currentKeyword
                } : null);
              } else if (data.type === 'complete') {
                setRefreshProgress(prev => prev ? {
                  ...prev,
                  total: data.total ?? prev.total,
                  current: data.total ?? prev.total,
                  succeeded: data.succeeded ?? prev.succeeded,
                  failed: data.failed ?? prev.failed,
                  errors: data.errors ?? prev.errors,
                  complete: true,
                  phase: 'complete'
                } : null);
              } else if (data.type === 'error') {
                setError(data.error || 'Unknown error during component refresh');
                setRefreshProgress(prev => prev ? { ...prev, complete: true, phase: 'error' } : null);
              }
            } catch {
              // Ignore malformed SSE data
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh components on pages');
      setRefreshProgress(prev => prev ? { ...prev, complete: true, phase: 'error' } : null);
    }
  };

  // Get components for a slot
  const getComponentsForSlot = (slotNumber: number) => {
    return components.filter(c => c.slot_number === slotNumber);
  };

  // Get tag badge color
  const getTagColor = (tag: string | null) => {
    if (!tag) return 'bg-gray-500'; // Global
    const colors: Record<string, string> = {
      'H': 'bg-blue-500',
      'J': 'bg-amber-500',
      'C': 'bg-green-500'
    };
    return colors[tag] || 'bg-purple-500';
  };

  if (!workflowId) {
    return (
      <div className="text-gray-500 text-sm italic p-3">
        Select a workflow to configure Component Library
      </div>
    );
  }

  return (
    <div className="border-t border-brand-gold/30 pt-3">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-brand-gold transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          <h4 className="text-sm font-semibold text-brand-gold flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Component Library
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              settings.enabled && components.length > 0
                ? 'bg-green-500 shadow-lg shadow-green-500/50'
                : 'bg-gray-500'
            }`}
            title={settings.enabled ? 'Enabled' : 'Disabled'}
          />
          <span className="text-xs text-gray-400">
            {components.length} component{components.length !== 1 ? 's' : ''}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
            <div>
              <span className="text-sm text-white">Enable Component Injection</span>
              <p className="text-xs text-gray-400">Auto-inject components based on article tags</p>
            </div>
            <button
              onClick={handleToggleEnabled}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.enabled ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.enabled ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Capture from Page */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <h5 className="text-sm font-medium text-brand-cyan mb-2">Capture from Page</h5>
            <div className="flex gap-2">
              <input
                type="text"
                value={pageIdInput}
                onChange={(e) => setPageIdInput(e.target.value)}
                placeholder="Page ID (e.g., 1441)"
                className="flex-1 bg-slate-900 border border-brand-gold/50 rounded px-2 py-1.5 text-white text-sm"
              />
              <button
                onClick={handleFetchPage}
                disabled={isFetching || !pageIdInput.trim()}
                className="px-3 py-1.5 bg-brand-cyan text-black rounded text-sm font-medium hover:bg-brand-cyan/90 disabled:opacity-50"
              >
                {isFetching ? 'Fetching...' : 'Fetch & Analyze'}
              </button>
            </div>

            {/* Detected Components */}
            {detectedComponents && (detectedComponents.sliders.length > 0 || detectedComponents.templates.length > 0) && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-400">
                  Found on "{detectedComponents.pageInfo?.title}":
                </p>

                {/* Sliders */}
                {detectedComponents.sliders.map((slider, idx) => (
                  <DetectedComponentRow
                    key={`slider-${idx}`}
                    detected={slider}
                    label={`Slider: ${slider.alias}`}
                    tags={tags}
                    onSave={handleSaveDetected}
                  />
                ))}

                {/* Templates */}
                {detectedComponents.templates.map((template, idx) => (
                  <DetectedComponentRow
                    key={`template-${idx}`}
                    detected={template}
                    label={`Template: ${template.templateId}`}
                    tags={tags}
                    onSave={handleSaveDetected}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Manual Add */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <button
              onClick={() => setShowManualAdd(!showManualAdd)}
              className="flex items-center gap-2 text-sm text-brand-gold hover:text-brand-gold/80"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Manually
            </button>

            {showManualAdd && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={manualForm.componentType}
                    onChange={(e) => setManualForm({ ...manualForm, componentType: e.target.value as any, moduleName: '' })}
                    className="bg-slate-900 border border-brand-gold/50 rounded px-2 py-1.5 text-white text-sm"
                  >
                    <option value="slider_revolution">Slider Revolution</option>
                    <option value="elementor_template">Elementor Template</option>
                  </select>
                  <input
                    type="text"
                    value={manualForm.componentRef}
                    onChange={(e) => setManualForm({ ...manualForm, componentRef: e.target.value })}
                    placeholder={manualForm.componentType === 'slider_revolution' ? 'Alias (e.g., home-1)' : 'Template ID'}
                    className="bg-slate-900 border border-brand-gold/50 rounded px-2 py-1.5 text-white text-sm"
                  />
                </div>
                {/* Module Name field - only for Slider Revolution */}
                {manualForm.componentType === 'slider_revolution' && (
                  <input
                    type="text"
                    value={manualForm.moduleName}
                    onChange={(e) => setManualForm({ ...manualForm, moduleName: e.target.value })}
                    placeholder="Module Name (SR's internal name, e.g., Residential)"
                    className="w-full bg-slate-900 border border-orange-500/50 rounded px-2 py-1.5 text-white text-sm"
                  />
                )}
                <input
                  type="text"
                  value={manualForm.name}
                  onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                  placeholder="Display Name (your label)"
                  className="w-full bg-slate-900 border border-brand-gold/50 rounded px-2 py-1.5 text-white text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={manualForm.slotNumber}
                    onChange={(e) => setManualForm({ ...manualForm, slotNumber: parseInt(e.target.value) })}
                    className="bg-slate-900 border border-brand-gold/50 rounded px-2 py-1.5 text-white text-sm"
                  >
                    <option value={1}>Slot 1 - Top (Hero/Slider)</option>
                    <option value={2}>Slot 2 - Middle (Stats Bar)</option>
                    <option value={3}>Slot 3 - Bottom (Benefits)</option>
                  </select>
                  <select
                    value={manualForm.tag}
                    onChange={(e) => setManualForm({ ...manualForm, tag: e.target.value })}
                    className="bg-slate-900 border border-brand-gold/50 rounded px-2 py-1.5 text-white text-sm"
                  >
                    <option value="">Global (All)</option>
                    {tags.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleManualAdd}
                  className="w-full py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-500"
                >
                  Add to Library
                </button>
              </div>
            )}
          </div>

          {/* Master Slot Toggle */}
          <div className="flex items-center justify-between bg-slate-700/50 rounded-lg p-2">
            <span className="text-sm text-gray-300">All Slots</span>
            <button
              onClick={handleMasterSlotToggle}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                (settings.slots || []).every(s => s.enabled !== false) ? 'bg-brand-cyan' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  (settings.slots || []).every(s => s.enabled !== false) ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* Component Library by Slot */}
          {[1, 2, 3].map(slotNumber => {
            const slotComponents = getComponentsForSlot(slotNumber);
            const slotConfig = (settings.slots || []).find(s => s.number === slotNumber);

            const slotEnabled = slotConfig?.enabled !== false;

            return (
              <div key={slotNumber} className={`bg-slate-800/50 rounded-lg p-3 ${!slotEnabled ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {/* Slot Toggle */}
                    <button
                      onClick={() => handleSlotToggle(slotNumber)}
                      className={`relative w-8 h-4 rounded-full transition-colors ${
                        slotEnabled ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                      title={slotEnabled ? 'Disable slot' : 'Enable slot'}
                    >
                      <div
                        className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                          slotEnabled ? 'left-4' : 'left-0.5'
                        }`}
                      />
                    </button>
                    <h5 className="text-sm font-medium text-white">
                      Slot {slotNumber} - {slotConfig?.name || 'Unknown'}
                      <span className="text-xs text-gray-400 ml-2">({slotConfig?.position})</span>
                    </h5>
                  </div>
                  {slotComponents.length > 1 && (
                    <select
                      value={slotConfig?.rotation || 'sequential'}
                      onChange={(e) => handleSlotRotationChange(slotNumber, e.target.value as any)}
                      className="bg-slate-900 border border-gray-600 rounded px-2 py-0.5 text-xs text-gray-300"
                      disabled={!slotEnabled}
                    >
                      <option value="sequential">Sequential</option>
                      <option value="random">Random</option>
                    </select>
                  )}
                </div>

                {slotComponents.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No components for this slot</p>
                ) : (
                  <div className="space-y-1">
                    {slotComponents.map(comp => (
                      <div
                        key={comp.id}
                        className="flex items-center justify-between bg-slate-900 rounded px-2 py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs text-white ${getTagColor(comp.tag)}`}
                          >
                            {comp.tag || 'Global'}
                          </span>
                          <span className="text-sm text-white">{comp.name}</span>
                          <span className="text-xs text-gray-500">
                            [{comp.component_type === 'slider_revolution' ? 'slider' : 'template'}: {comp.component_ref}]
                          </span>
                        </div>
                        <button
                          onClick={() => handleDelete(comp.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Refresh Components on All Pages */}
          {settings.enabled && components.length > 0 && websiteId && (
            <button
              onClick={handleOpenRefreshModal}
              disabled={refreshProgress?.active && !refreshProgress?.complete}
              className="w-full py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-brand-cyan/50 rounded-lg text-brand-cyan text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshProgress?.active && !refreshProgress?.complete
                ? `Refreshing... ${refreshProgress.current}/${refreshProgress.total}`
                : 'Refresh Components on All Pages'}
            </button>
          )}

          {/* Messages */}
          {error && (
            <div className="p-2 bg-red-900/30 border border-red-500/50 rounded text-red-400 text-sm">
              {error}
              <button onClick={() => setError(null)} className="ml-2 text-red-300">&times;</button>
            </div>
          )}

          {successMessage && (
            <div className="p-2 bg-green-900/30 border border-green-500/50 rounded text-green-400 text-sm">
              {successMessage}
            </div>
          )}
        </div>
      )}

      {/* Refresh Components Confirmation Modal — React Portal (Golden Rule #7) */}
      {showRefreshModal && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-brand-cyan/30 shadow-2xl">
            <h3 className="text-xl font-bold text-brand-cyan mb-4">Refresh Components on All Pages</h3>
            <p className="text-gray-300 text-sm mb-3">
              This will rebuild {publishedCount !== null ? publishedCount : '...'} published page{publishedCount !== 1 ? 's' : ''} with
              updated component assignments from the current library.
            </p>
            <p className="text-gray-400 text-xs mb-4">
              Page URLs will be preserved.
            </p>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={resetRotation}
                onChange={(e) => setResetRotation(e.target.checked)}
                className="w-4 h-4 rounded border-gray-500 text-brand-cyan focus:ring-brand-cyan bg-slate-800"
              />
              <span className="text-sm text-white">Reset rotation (redistribute components evenly)</span>
            </label>

            <div className="bg-slate-800/50 rounded p-3 mb-4 border border-gray-700">
              <p className="text-xs text-gray-400">
                <strong className="text-gray-300">Note:</strong> If you only changed a template's content
                (not which template is assigned), you don't need this — template changes appear automatically.
              </p>
            </div>

            {publishedCount === 0 && (
              <div className="p-2 bg-amber-900/30 border border-amber-500/50 rounded text-amber-400 text-xs mb-4">
                No published pages to update.
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleBulkRefreshComponents}
                disabled={publishedCount === 0}
                className="flex-1 px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 rounded text-slate-900 font-medium transition disabled:opacity-50"
              >
                Refresh All Pages
              </button>
              <button
                onClick={() => setShowRefreshModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Component Refresh Progress Modal — React Portal (Golden Rule #7) */}
      {refreshProgress?.active && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl w-full max-w-lg border border-brand-cyan/30 shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Component Refresh
                </h3>
                {refreshProgress.complete && (
                  <button
                    onClick={() => setRefreshProgress(null)}
                    className="text-gray-400 hover:text-white text-xl"
                  >
                    &times;
                  </button>
                )}
              </div>

              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  {refreshProgress.complete ? 'Complete' : `Rebuilding pages...`}
                </span>
                <span className="text-white font-medium">
                  {refreshProgress.current} / {refreshProgress.total || '...'}
                </span>
              </div>

              {refreshProgress.currentKeyword && !refreshProgress.complete && (
                <p className="text-xs text-gray-500 mb-2 truncate">
                  Current: {refreshProgress.currentKeyword}
                </p>
              )}

              {/* Progress bar */}
              <div className="w-full bg-slate-700 rounded-full h-3 mb-4">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    refreshProgress.complete
                      ? refreshProgress.failed > 0 ? 'bg-amber-500' : 'bg-green-500'
                      : 'bg-brand-cyan'
                  }`}
                  style={{ width: `${refreshProgress.total ? (refreshProgress.current / refreshProgress.total) * 100 : 0}%` }}
                />
              </div>

              {/* Results summary */}
              {refreshProgress.complete && (
                <div className="space-y-2">
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-400">{refreshProgress.succeeded} succeeded</span>
                    {refreshProgress.failed > 0 && (
                      <span className="text-red-400">{refreshProgress.failed} failed</span>
                    )}
                  </div>

                  {/* Error details — Golden Rule #9: never silently swallow errors */}
                  {refreshProgress.errors.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      {refreshProgress.errors.map((err, idx) => (
                        <div key={idx} className="text-xs text-red-400 py-1 border-t border-slate-700">
                          <span className="text-gray-400">{err.keyword}:</span> {err.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ComponentLibrarySection;
