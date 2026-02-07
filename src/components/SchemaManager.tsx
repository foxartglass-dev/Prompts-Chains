import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// ============================================
// TYPES
// ============================================

interface SchemaManagerProps {
  isOpen: boolean;
  onClose: () => void;
  websiteId?: number;
  websiteName?: string;
}

interface SchemaSettings {
  schemaTypes: string[];
  bulkPrompt: string;
  model: string;
  muPluginDeployed: boolean;
}

interface CustomPage {
  id: number;
  website_id: number;
  article_id: number | null;
  wp_post_id: number | null;
  page_title: string;
  page_url: string;
  custom_prompt: string;
  generated_schema: any[] | null;
  schema_pushed: boolean;
  pushed_at: string | null;
  article_keyword?: string;
  article_wp_post_url?: string;
  article_wp_post_id?: number;
}

interface ArticleSchemaStatus {
  id: number;
  keyword: string;
  wpPostId: number;
  wpPostUrl: string;
  hasSchema: boolean;
  identifiedTypes: string[];
  schemaPushed: boolean;
  schemaPushedAt: string | null;
  schemaCount: number;
}

interface SchemaStats {
  articles: {
    totalPublished: number;
    withSchema: number;
    schemaPushed: number;
    pendingPush: number;
    withoutSchema: number;
  };
  customPages: {
    total: number;
    withSchema: number;
    pushed: number;
  };
}

// All standard Schema.org types users might want
const ALL_SCHEMA_TYPES = [
  'LocalBusiness', 'Service', 'FAQ', 'HowTo', 'BreadcrumbList',
  'Article', 'Product', 'Event', 'Recipe', 'Review',
  'VideoObject', 'Organization', 'WebPage', 'WebSite',
  'Person', 'Place', 'MedicalBusiness', 'LegalService',
  'FinancialService', 'RealEstateAgent', 'Restaurant'
];

const API_BASE = '/api/schema';

// ============================================
// MAIN COMPONENT
// ============================================

const SchemaManager: React.FC<SchemaManagerProps> = ({
  isOpen,
  onClose,
  websiteId,
  websiteName
}) => {
  // Settings state
  const [settings, setSettings] = useState<SchemaSettings>({
    schemaTypes: [],
    bulkPrompt: '',
    model: 'claude-sonnet-4-5-20250929',
    muPluginDeployed: false
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);

  // Custom pages state
  const [customPages, setCustomPages] = useState<CustomPage[]>([]);
  const [showAddCustomPage, setShowAddCustomPage] = useState(false);

  // Article schema status
  const [articles, setArticles] = useState<ArticleSchemaStatus[]>([]);
  const [stats, setStats] = useState<SchemaStats | null>(null);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [muPluginChecking, setMuPluginChecking] = useState(false);
  const [muPluginMessage, setMuPluginMessage] = useState('');
  const [showMuPluginCode, setShowMuPluginCode] = useState(false);
  const [muPluginCode, setMuPluginCode] = useState({ code: '', filename: '', instructions: '' });
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkPushing, setBulkPushing] = useState(false);
  const [progressData, setProgressData] = useState<{ current: number; total: number; pageTitle: string } | null>(null);
  const [previewArticleId, setPreviewArticleId] = useState<number | null>(null);
  const [previewSchema, setPreviewSchema] = useState<any[] | null>(null);
  const [previewCustomPageId, setPreviewCustomPageId] = useState<number | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadSettings = useCallback(async () => {
    if (!websiteId) return;
    setSettingsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/settings/${websiteId}`);
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      setSettings(data);
      setSettingsDirty(false);
      setError(null);
    } catch (err: any) {
      console.error('Schema settings load failed:', err);
      setError(err.message || 'Failed to load schema settings');
    } finally {
      setSettingsLoading(false);
    }
  }, [websiteId]);

  const loadCustomPages = useCallback(async () => {
    if (!websiteId) return;
    try {
      const res = await fetch(`${API_BASE}/custom-pages/${websiteId}`);
      if (!res.ok) throw new Error('Failed to load custom pages');
      const data = await res.json();
      setCustomPages(data.pages || []);
    } catch (err: any) {
      console.error('Custom pages load failed:', err);
      setError(err.message || 'Failed to load custom pages');
    }
  }, [websiteId]);

  const loadArticles = useCallback(async () => {
    if (!websiteId) return;
    try {
      const res = await fetch(`${API_BASE}/articles/${websiteId}`);
      if (!res.ok) throw new Error('Failed to load articles');
      const data = await res.json();
      setArticles(data.articles || []);
    } catch (err: any) {
      console.error('Articles load failed:', err);
      setError(err.message || 'Failed to load articles');
    }
  }, [websiteId]);

  const loadStats = useCallback(async () => {
    if (!websiteId) return;
    try {
      const res = await fetch(`${API_BASE}/status/${websiteId}`);
      if (!res.ok) throw new Error('Failed to load stats');
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      console.error('Stats load failed:', err);
    }
  }, [websiteId]);

  useEffect(() => {
    if (isOpen && websiteId) {
      loadSettings();
      loadCustomPages();
      loadArticles();
      loadStats();
    }
  }, [isOpen, websiteId, loadSettings, loadCustomPages, loadArticles, loadStats]);

  // ============================================
  // SETTINGS HANDLERS
  // ============================================

  const handleToggleSchemaType = (type: string) => {
    setSettings(prev => {
      const types = prev.schemaTypes.includes(type)
        ? prev.schemaTypes.filter(t => t !== type)
        : [...prev.schemaTypes, type];
      return { ...prev, schemaTypes: types };
    });
    setSettingsDirty(true);
  };

  const handleSaveSettings = async () => {
    if (!websiteId) return;
    setSavingSettings(true);
    try {
      const res = await fetch(`${API_BASE}/settings/${websiteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemaTypes: settings.schemaTypes,
          bulkPrompt: settings.bulkPrompt,
          model: settings.model
        })
      });
      if (!res.ok) throw new Error('Failed to save settings');
      setSettingsDirty(false);
      setError(null);
    } catch (err: any) {
      console.error('Save settings failed:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // ============================================
  // MU-PLUGIN HANDLERS
  // ============================================

  const handleCheckMuPlugin = async () => {
    if (!websiteId) return;
    setMuPluginChecking(true);
    setMuPluginMessage('');
    try {
      const res = await fetch(`${API_BASE}/check-mu-plugin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId })
      });
      if (!res.ok) throw new Error('Failed to check plugin status');
      const data = await res.json();
      setSettings(prev => ({ ...prev, muPluginDeployed: data.deployed }));
      setMuPluginMessage(data.testResult);
    } catch (err: any) {
      console.error('MU-plugin check failed:', err);
      setMuPluginMessage(`Error: ${err.message}`);
    } finally {
      setMuPluginChecking(false);
    }
  };

  const handleShowMuPluginCode = async () => {
    try {
      const res = await fetch(`${API_BASE}/mu-plugin-code`);
      if (!res.ok) throw new Error('Failed to get plugin code');
      const data = await res.json();
      setMuPluginCode(data);
      setShowMuPluginCode(true);
    } catch (err: any) {
      console.error('Get plugin code failed:', err);
      setError(err.message || 'Failed to get plugin code');
    }
  };

  // ============================================
  // BULK GENERATION
  // ============================================

  const handleBulkGenerate = async () => {
    if (!websiteId) return;

    // Save settings first if dirty
    if (settingsDirty) {
      await handleSaveSettings();
    }

    setBulkGenerating(true);
    setProgressData(null);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/generate-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId })
      });

      if (!res.ok && !res.headers.get('content-type')?.includes('text/event-stream')) {
        const err = await res.json().catch(() => ({ error: 'Bulk generation failed' }));
        throw new Error(err.error || 'Bulk generation failed');
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
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
                  setProgressData({
                    current: data.current,
                    total: data.total,
                    pageTitle: data.pageTitle
                  });
                } else if (data.type === 'complete') {
                  setProgressData(null);
                  if (data.errors?.length > 0) {
                    setError(`Generated ${data.generated}/${data.total} schemas. ${data.errors.length} errors.`);
                  }
                } else if (data.type === 'error') {
                  setError(data.error || 'Generation failed');
                }
              } catch (e) { /* skip invalid lines */ }
            }
          }
        }
      }

      // Reload data
      await loadArticles();
      await loadStats();
    } catch (err: any) {
      console.error('Bulk generation error:', err);
      setError(err.message || 'Bulk generation failed');
    } finally {
      setBulkGenerating(false);
      setProgressData(null);
    }
  };

  // ============================================
  // BULK PUSH
  // ============================================

  const handleBulkPush = async () => {
    if (!websiteId) return;

    if (!settings.muPluginDeployed) {
      setError('Deploy the PromptFlow Schema mu-plugin before pushing schema.');
      return;
    }

    setBulkPushing(true);
    setProgressData(null);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/push-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId })
      });

      if (!res.ok && !res.headers.get('content-type')?.includes('text/event-stream')) {
        const err = await res.json().catch(() => ({ error: 'Bulk push failed' }));
        throw new Error(err.error || 'Bulk push failed');
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
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
                  setProgressData({
                    current: data.current,
                    total: data.total,
                    pageTitle: data.pageTitle
                  });
                } else if (data.type === 'complete') {
                  setProgressData(null);
                  if (data.errors?.length > 0) {
                    setError(`Pushed ${data.pushed}/${data.total}. ${data.errors.length} errors.`);
                  }
                } else if (data.type === 'error') {
                  setError(data.error || 'Push failed');
                }
              } catch (e) { /* skip invalid lines */ }
            }
          }
        }
      }

      // Reload data
      await loadArticles();
      await loadStats();
      await loadCustomPages();
    } catch (err: any) {
      console.error('Bulk push error:', err);
      setError(err.message || 'Bulk push failed');
    } finally {
      setBulkPushing(false);
      setProgressData(null);
    }
  };

  // ============================================
  // CUSTOM PAGE HANDLERS
  // ============================================

  const handleGenerateCustomSchema = async (customPageId: number) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/generate-custom/${customPageId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Custom schema generation failed');
      }
      await loadCustomPages();
    } catch (err: any) {
      console.error('Custom schema generation error:', err);
      setError(err.message || 'Custom schema generation failed');
    }
  };

  const handlePushCustomSchema = async (customPageId: number) => {
    if (!settings.muPluginDeployed) {
      setError('Deploy the PromptFlow Schema mu-plugin before pushing schema.');
      return;
    }
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/push-custom/${customPageId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Custom schema push failed');
      }
      await loadCustomPages();
      await loadStats();
    } catch (err: any) {
      console.error('Custom schema push error:', err);
      setError(err.message || 'Custom schema push failed');
    }
  };

  const handleDeleteCustomPage = async (customPageId: number) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/custom-pages/${customPageId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to remove custom page');
      await loadCustomPages();
      await loadStats();
    } catch (err: any) {
      console.error('Delete custom page error:', err);
      setError(err.message || 'Failed to remove custom page');
    }
  };

  const handleUpdateCustomPrompt = async (customPageId: number, customPrompt: string) => {
    try {
      const res = await fetch(`${API_BASE}/custom-pages/${customPageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt })
      });
      if (!res.ok) throw new Error('Failed to update prompt');
      await loadCustomPages();
    } catch (err: any) {
      console.error('Update custom prompt error:', err);
      setError(err.message || 'Failed to update custom prompt');
    }
  };

  // ============================================
  // SINGLE ARTICLE HANDLERS
  // ============================================

  const handlePushSingleSchema = async (articleId: number) => {
    if (!settings.muPluginDeployed) {
      setError('Deploy the PromptFlow Schema mu-plugin before pushing schema.');
      return;
    }
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/push/${articleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Schema push failed');
      }
      await loadArticles();
      await loadStats();
    } catch (err: any) {
      console.error('Push single schema error:', err);
      setError(err.message || 'Schema push failed');
    }
  };

  const handlePreviewArticleSchema = async (articleId: number) => {
    try {
      const res = await fetch(`${API_BASE}/article-schema/${articleId}`);
      if (!res.ok) throw new Error('Failed to load schema');
      const data = await res.json();
      setPreviewSchema(data.schemas);
      setPreviewArticleId(articleId);
      setPreviewCustomPageId(null);
    } catch (err: any) {
      console.error('Preview schema error:', err);
      setError(err.message || 'Failed to load schema preview');
    }
  };

  const handleEditArticleSchema = async (articleId: number, schemas: any[]) => {
    try {
      const res = await fetch(`${API_BASE}/article-schema/${articleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemas })
      });
      if (!res.ok) throw new Error('Failed to save schema edits');
      setPreviewArticleId(null);
      setPreviewSchema(null);
      await loadArticles();
    } catch (err: any) {
      console.error('Edit schema error:', err);
      setError(err.message || 'Failed to save schema edits');
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (!isOpen) return null;

  // Golden Rule #7: Use React Portal for modal
  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center">
      <div className="bg-slate-900 rounded-lg w-[95vw] h-[90vh] overflow-hidden border border-brand-cyan/30 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-brand-cyan/30 bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <h1 className="text-xl font-bold text-brand-gold">Schema Manager</h1>
            {websiteName && (
              <span className="text-sm text-gray-400">— {websiteName}</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* Error Display - Golden Rule #9 */}
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 flex items-center justify-between">
              <span className="text-red-300">{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-white ml-4">&times;</button>
            </div>
          )}

          {!websiteId ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">Select a website first to manage schema.</p>
            </div>
          ) : settingsLoading ? (
            <div className="text-center py-12 text-gray-400">Loading schema settings...</div>
          ) : (
            <>
              {/* MU-PLUGIN STATUS */}
              <section className="bg-slate-800/50 rounded-lg p-5 border border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-3">MU-Plugin Status</h2>
                <div className="flex items-center gap-4">
                  {settings.muPluginDeployed ? (
                    <span className="flex items-center gap-2 text-green-400 font-medium">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      PromptFlow Schema Plugin: Deployed
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-yellow-400 font-medium">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      PromptFlow Schema Plugin: Not Detected
                    </span>
                  )}
                  <button
                    onClick={handleCheckMuPlugin}
                    disabled={muPluginChecking}
                    className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded text-white disabled:opacity-50"
                  >
                    {muPluginChecking ? 'Checking...' : 'Check Again'}
                  </button>
                  <button
                    onClick={handleShowMuPluginCode}
                    className="px-3 py-1.5 text-sm bg-brand-cyan/20 hover:bg-brand-cyan/30 rounded text-brand-cyan"
                  >
                    View Plugin Code & Instructions
                  </button>
                </div>
                {muPluginMessage && (
                  <p className="mt-2 text-sm text-gray-400">{muPluginMessage}</p>
                )}
              </section>

              {/* BULK SCHEMA SETTINGS */}
              <section className="bg-slate-800/50 rounded-lg p-5 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Bulk Schema Settings</h2>
                  {settingsDirty && (
                    <button
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="px-4 py-1.5 text-sm bg-brand-cyan hover:bg-brand-cyan-dark rounded text-slate-900 font-medium disabled:opacity-50"
                    >
                      {savingSettings ? 'Saving...' : 'Save Settings'}
                    </button>
                  )}
                </div>

                {/* Schema Types */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-300 mb-2">Schema Types to Look For:</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_SCHEMA_TYPES.map(type => (
                      <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.schemaTypes.includes(type)}
                          onChange={() => handleToggleSchemaType(type)}
                          className="rounded border-slate-600 bg-slate-700 text-brand-cyan focus:ring-brand-cyan"
                        />
                        <span className="text-sm text-gray-300">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Bulk Prompt */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-300 mb-2">
                    Bulk Schema Prompt (guides the LLM for all non-custom pages):
                  </label>
                  <textarea
                    value={settings.bulkPrompt}
                    onChange={e => {
                      setSettings(prev => ({ ...prev, bulkPrompt: e.target.value }));
                      setSettingsDirty(true);
                    }}
                    rows={4}
                    placeholder="e.g., Analyze each page's content and identify which schema types apply. For LocalBusiness, use: 'Your Business Name', (555) 123-4567, City ST. For Service schemas, include pricing if mentioned."
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white text-sm placeholder-gray-500 focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan"
                  />
                </div>

                {/* Model Selector */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-300 mb-2">LLM Model:</label>
                  <select
                    value={settings.model}
                    onChange={e => {
                      setSettings(prev => ({ ...prev, model: e.target.value }));
                      setSettingsDirty(true);
                    }}
                    className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-cyan"
                  >
                    <optgroup label="Anthropic">
                      <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
                      <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                    </optgroup>
                    <optgroup label="OpenAI">
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                    </optgroup>
                    <optgroup label="Google">
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    </optgroup>
                  </select>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleBulkGenerate}
                  disabled={bulkGenerating || settings.schemaTypes.length === 0}
                  className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold-dark text-slate-900 font-semibold rounded-lg disabled:opacity-50 transition"
                >
                  {bulkGenerating ? 'Generating...' : 'Generate Schema for All Pages'}
                </button>
                <span className="text-sm text-gray-500 ml-3">Processes all non-custom pages</span>

                {/* Progress */}
                {progressData && (bulkGenerating || bulkPushing) && (
                  <div className="mt-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-1 bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-brand-cyan rounded-full h-2 transition-all"
                          style={{ width: `${(progressData.current / progressData.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-400">{progressData.current}/{progressData.total}</span>
                    </div>
                    <p className="text-sm text-gray-400">
                      {bulkGenerating ? 'Generating' : 'Pushing'}: {progressData.pageTitle}
                    </p>
                  </div>
                )}
              </section>

              {/* CUSTOM SCHEMA PAGES */}
              <section className="bg-slate-800/50 rounded-lg p-5 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Custom Schema Pages</h2>
                    <p className="text-sm text-gray-400">These pages get their own custom prompt. The bulk process skips them.</p>
                  </div>
                  <button
                    onClick={() => setShowAddCustomPage(true)}
                    className="px-4 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan rounded-lg text-sm font-medium"
                  >
                    + Add Custom Schema Page
                  </button>
                </div>

                {customPages.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4">No custom schema pages configured yet.</p>
                ) : (
                  <div className="space-y-4">
                    {customPages.map(page => (
                      <CustomPageCard
                        key={page.id}
                        page={page}
                        onGenerate={() => handleGenerateCustomSchema(page.id)}
                        onPush={() => handlePushCustomSchema(page.id)}
                        onDelete={() => handleDeleteCustomPage(page.id)}
                        onUpdatePrompt={(prompt) => handleUpdateCustomPrompt(page.id, prompt)}
                        onPreview={() => {
                          setPreviewSchema(page.generated_schema);
                          setPreviewCustomPageId(page.id);
                          setPreviewArticleId(null);
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* BULK SCHEMA STATUS TABLE */}
              <section className="bg-slate-800/50 rounded-lg p-5 border border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-4">Bulk Schema Status</h2>

                {stats && (
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-slate-900 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-brand-cyan">{stats.articles.withSchema}</div>
                      <div className="text-xs text-gray-400">Pages with schema</div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-yellow-400">{stats.articles.withoutSchema}</div>
                      <div className="text-xs text-gray-400">Pending generation</div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-purple-400">{stats.customPages.total}</div>
                      <div className="text-xs text-gray-400">Custom pages (skipped by bulk)</div>
                    </div>
                  </div>
                )}

                {/* Articles Table */}
                {articles.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-slate-700">
                          <th className="pb-2 pr-4">Page</th>
                          <th className="pb-2 pr-4">Types Found</th>
                          <th className="pb-2 pr-4">Status</th>
                          <th className="pb-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {articles.map(article => (
                          <tr key={article.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="py-2 pr-4 text-white">{article.keyword}</td>
                            <td className="py-2 pr-4">
                              {article.identifiedTypes.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {article.identifiedTypes.map(t => (
                                    <span key={t} className="px-1.5 py-0.5 bg-brand-cyan/20 text-brand-cyan rounded text-xs">{t}</span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-500">—</span>
                              )}
                            </td>
                            <td className="py-2 pr-4">
                              {article.schemaPushed ? (
                                <span className="text-green-400 text-xs font-medium">Pushed</span>
                              ) : article.hasSchema ? (
                                <span className="text-yellow-400 text-xs font-medium">Generated</span>
                              ) : (
                                <span className="text-gray-500 text-xs">None</span>
                              )}
                            </td>
                            <td className="py-2">
                              <div className="flex gap-1">
                                {article.hasSchema && (
                                  <>
                                    <button
                                      onClick={() => handlePreviewArticleSchema(article.id)}
                                      className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-gray-300"
                                    >
                                      Preview
                                    </button>
                                    {!article.schemaPushed && (
                                      <button
                                        onClick={() => handlePushSingleSchema(article.id)}
                                        className="px-2 py-1 text-xs bg-brand-cyan/20 hover:bg-brand-cyan/30 rounded text-brand-cyan"
                                      >
                                        Push
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Push All Button */}
                {stats && stats.articles.pendingPush > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={handleBulkPush}
                      disabled={bulkPushing || !settings.muPluginDeployed}
                      className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50 transition"
                    >
                      {bulkPushing ? 'Pushing...' : `Push All Generated Schema to WordPress (${stats.articles.pendingPush})`}
                    </button>
                    {!settings.muPluginDeployed && (
                      <span className="text-sm text-yellow-400 ml-3">Deploy mu-plugin first</span>
                    )}
                  </div>
                )}

                <p className="mt-4 text-xs text-gray-500">
                  Schema is pushed via the PromptFlow mu-plugin. Make sure the plugin is deployed before pushing. Works with any SEO plugin.
                </p>
              </section>
            </>
          )}
        </main>
      </div>

      {/* MU-Plugin Code Modal */}
      {showMuPluginCode && (
        <MuPluginCodeModal
          code={muPluginCode.code}
          filename={muPluginCode.filename}
          instructions={muPluginCode.instructions}
          onClose={() => setShowMuPluginCode(false)}
        />
      )}

      {/* Add Custom Page Modal */}
      {showAddCustomPage && websiteId && (
        <AddCustomPageModal
          websiteId={websiteId}
          existingCustomArticleIds={customPages.map(p => p.article_id).filter(Boolean) as number[]}
          onAdd={async () => {
            await loadCustomPages();
            await loadStats();
            setShowAddCustomPage(false);
          }}
          onClose={() => setShowAddCustomPage(false)}
        />
      )}

      {/* Schema Preview Modal */}
      {previewSchema && (previewArticleId || previewCustomPageId) && (
        <SchemaPreviewModal
          schemas={previewSchema}
          articleId={previewArticleId}
          onSave={previewArticleId ? (schemas) => handleEditArticleSchema(previewArticleId, schemas) : undefined}
          onClose={() => {
            setPreviewSchema(null);
            setPreviewArticleId(null);
            setPreviewCustomPageId(null);
          }}
        />
      )}
    </div>,
    document.body
  );
};

// ============================================
// SUB-COMPONENTS
// ============================================

/** Custom Page Card */
const CustomPageCard: React.FC<{
  page: CustomPage;
  onGenerate: () => void;
  onPush: () => void;
  onDelete: () => void;
  onUpdatePrompt: (prompt: string) => void;
  onPreview: () => void;
}> = ({ page, onGenerate, onPush, onDelete, onUpdatePrompt, onPreview }) => {
  const [editing, setEditing] = useState(false);
  const [promptDraft, setPromptDraft] = useState(page.custom_prompt);

  const title = page.page_title || page.article_keyword || 'Untitled Page';
  const url = page.page_url || page.article_wp_post_url || '';
  const schemaCount = page.generated_schema ? page.generated_schema.length : 0;

  return (
    <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-medium text-white">{title}</span>
          {url && <span className="text-xs text-gray-500 ml-2">{url}</span>}
        </div>
        <button
          onClick={onDelete}
          className="text-gray-500 hover:text-red-400 text-sm"
          title="Remove from custom pages"
        >
          &times;
        </button>
      </div>

      {/* Custom Prompt */}
      <div className="mb-3">
        <label className="text-xs text-gray-400 block mb-1">Custom prompt:</label>
        {editing ? (
          <div>
            <textarea
              value={promptDraft}
              onChange={e => setPromptDraft(e.target.value)}
              rows={3}
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white"
            />
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => { onUpdatePrompt(promptDraft); setEditing(false); }}
                className="px-2 py-1 text-xs bg-brand-cyan/20 text-brand-cyan rounded"
              >
                Save
              </button>
              <button
                onClick={() => { setPromptDraft(page.custom_prompt); setEditing(false); }}
                className="px-2 py-1 text-xs bg-slate-700 text-gray-300 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setEditing(true)}
            className="bg-slate-800 rounded p-2 text-sm text-gray-300 cursor-pointer hover:border-brand-cyan border border-transparent max-h-20 overflow-hidden"
          >
            {page.custom_prompt || 'Click to add prompt...'}
          </div>
        )}
      </div>

      {/* Status + Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm">
          {page.schema_pushed ? (
            <span className="text-green-400">Pushed ({schemaCount} schemas)</span>
          ) : page.generated_schema ? (
            <span className="text-yellow-400">Generated ({schemaCount} schemas)</span>
          ) : (
            <span className="text-gray-500">Not generated yet</span>
          )}
        </div>
        <div className="flex gap-2">
          {page.generated_schema && (
            <button onClick={onPreview} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-gray-300">
              Preview JSON-LD
            </button>
          )}
          <button
            onClick={onGenerate}
            className="px-2 py-1 text-xs bg-brand-gold/20 hover:bg-brand-gold/30 rounded text-brand-gold"
          >
            {page.generated_schema ? 'Regenerate' : 'Generate'}
          </button>
          {page.generated_schema && !page.schema_pushed && (
            <button onClick={onPush} className="px-2 py-1 text-xs bg-green-600/20 hover:bg-green-600/30 rounded text-green-400">
              Push
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/** MU-Plugin Code Modal */
const MuPluginCodeModal: React.FC<{
  code: string;
  filename: string;
  instructions: string;
  onClose: () => void;
}> = ({ code, filename, instructions, onClose }) => {
  const [copied, setCopied] = useState(false);

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 rounded-lg w-[800px] max-h-[80vh] overflow-auto border border-brand-cyan/30 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-brand-gold">MU-Plugin: {filename}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-semibold text-white mb-2">Deployment Instructions:</h4>
          <pre className="bg-slate-800 rounded p-3 text-sm text-gray-300 whitespace-pre-wrap">{instructions}</pre>
        </div>

        <div className="relative">
          <h4 className="text-sm font-semibold text-white mb-2">PHP Code:</h4>
          <button
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="absolute top-0 right-0 px-3 py-1 text-xs bg-brand-cyan/20 hover:bg-brand-cyan/30 rounded text-brand-cyan"
          >
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <pre className="bg-slate-800 rounded p-4 text-sm text-green-300 overflow-x-auto whitespace-pre">{code}</pre>
        </div>
      </div>
    </div>,
    document.body
  );
};

/** Add Custom Page Modal */
const AddCustomPageModal: React.FC<{
  websiteId: number;
  existingCustomArticleIds: number[];
  onAdd: () => void;
  onClose: () => void;
}> = ({ websiteId, existingCustomArticleIds, onAdd, onClose }) => {
  const [allPages, setAllPages] = useState<Array<{ id: number; keyword: string; wp_post_id: number; wp_post_url: string }>>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    const loadPages = async () => {
      try {
        // Use the schema articles endpoint which returns published pages
        const res = await fetch(`${API_BASE}/articles/${websiteId}`);
        if (!res.ok) throw new Error('Failed to load pages');
        const data = await res.json();
        setAllPages((data.articles || []).map((a: any) => ({
          id: a.id,
          keyword: a.keyword,
          wp_post_id: a.wpPostId,
          wp_post_url: a.wpPostUrl
        })));
      } catch (err: any) {
        setAddError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadPages();
  }, [websiteId]);

  const filteredPages = allPages.filter(p =>
    !existingCustomArticleIds.includes(p.id) &&
    p.keyword.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleAdd = async () => {
    if (!selectedArticleId || !customPrompt.trim()) {
      setAddError('Select a page and write a custom prompt');
      return;
    }
    setSubmitting(true);
    setAddError(null);
    try {
      const selectedPage = allPages.find(p => p.id === selectedArticleId);
      const res = await fetch(`${API_BASE}/custom-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteId,
          articleId: selectedArticleId,
          wpPostId: selectedPage?.wp_post_id || null,
          pageTitle: selectedPage?.keyword || '',
          pageUrl: selectedPage?.wp_post_url || '',
          customPrompt: customPrompt.trim()
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add custom page');
      }
      onAdd();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[10001] flex items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 rounded-lg w-[600px] max-h-[80vh] overflow-auto border border-brand-cyan/30 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-brand-gold">Add Custom Schema Page</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        {addError && (
          <div className="bg-red-900/30 border border-red-500/50 rounded p-3 mb-4 text-sm text-red-300">{addError}</div>
        )}

        <div className="mb-4">
          <label className="block text-sm text-gray-300 mb-2">Select page:</label>
          <input
            type="text"
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            placeholder="Search pages..."
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm mb-2"
          />
          <div className="max-h-48 overflow-y-auto bg-slate-800 rounded border border-slate-600">
            {loading ? (
              <p className="p-3 text-gray-400 text-sm">Loading pages...</p>
            ) : filteredPages.length === 0 ? (
              <p className="p-3 text-gray-400 text-sm">No matching pages found</p>
            ) : (
              filteredPages.map(page => (
                <label
                  key={page.id}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-700 ${
                    selectedArticleId === page.id ? 'bg-brand-cyan/10 border-l-2 border-brand-cyan' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="customPage"
                    checked={selectedArticleId === page.id}
                    onChange={() => setSelectedArticleId(page.id)}
                    className="text-brand-cyan"
                  />
                  <div>
                    <span className="text-sm text-white">{page.keyword}</span>
                    {page.wp_post_url && (
                      <span className="text-xs text-gray-500 ml-2">{page.wp_post_url}</span>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-gray-300 mb-2">Custom prompt for this page:</label>
          <textarea
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            rows={4}
            placeholder="e.g., Generate comprehensive Organization + LocalBusiness + WebSite schema. Include: business name, address, phone, hours..."
            className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-white text-sm placeholder-gray-500"
          />
        </div>

        <p className="text-xs text-gray-500 mb-4">
          This page will be skipped by the bulk schema process and will use its own custom prompt instead.
        </p>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded text-gray-300">
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={submitting || !selectedArticleId || !customPrompt.trim()}
            className="px-4 py-2 text-sm bg-brand-cyan hover:bg-brand-cyan-dark rounded text-slate-900 font-medium disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add Page'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/** Schema Preview Modal */
const SchemaPreviewModal: React.FC<{
  schemas: any[];
  articleId?: number | null;
  onSave?: (schemas: any[]) => void;
  onClose: () => void;
}> = ({ schemas, articleId, onSave, onClose }) => {
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const formattedJson = JSON.stringify(schemas, null, 2);

  const handleSaveEdit = () => {
    try {
      const parsed = JSON.parse(editText);
      if (!Array.isArray(parsed)) {
        setEditError('Must be a valid JSON array');
        return;
      }
      // Validate each has @type
      for (const s of parsed) {
        if (!s['@type']) {
          setEditError('Each schema must have an @type property');
          return;
        }
      }
      setEditError(null);
      if (onSave) onSave(parsed);
      setEditMode(false);
    } catch (e) {
      setEditError('Invalid JSON');
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 rounded-lg w-[800px] max-h-[85vh] overflow-auto border border-brand-cyan/30 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-brand-gold">
            JSON-LD Preview ({schemas.length} schema{schemas.length !== 1 ? 's' : ''})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        {editError && (
          <div className="bg-red-900/30 border border-red-500/50 rounded p-3 mb-4 text-sm text-red-300">{editError}</div>
        )}

        {editMode ? (
          <div>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={20}
              className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-green-300 text-sm font-mono"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={handleSaveEdit} className="px-4 py-2 text-sm bg-brand-cyan hover:bg-brand-cyan-dark rounded text-slate-900 font-medium">
                Save Changes
              </button>
              <button onClick={() => { setEditMode(false); setEditError(null); }} className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded text-gray-300">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            {schemas.map((schema, idx) => (
              <div key={idx} className="mb-4">
                <h4 className="text-sm font-semibold text-brand-cyan mb-1">
                  Schema {idx + 1} of {schemas.length}: {schema['@type']}
                </h4>
                <pre className="bg-slate-800 rounded p-3 text-sm text-green-300 overflow-x-auto whitespace-pre font-mono max-h-60 overflow-y-auto">
                  {JSON.stringify(schema, null, 2)}
                </pre>
              </div>
            ))}

            <div className="flex gap-2 mt-3 flex-wrap">
              {onSave && (
                <button
                  onClick={() => { setEditText(formattedJson); setEditMode(true); }}
                  className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded text-gray-300"
                >
                  Edit JSON
                </button>
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(formattedJson);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded text-gray-300"
              >
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
              <a
                href="https://search.google.com/test/rich-results"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-sm bg-brand-gold/20 hover:bg-brand-gold/30 rounded text-brand-gold"
              >
                Validate with Google
              </a>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default SchemaManager;
