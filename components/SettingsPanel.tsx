import React, { useState } from 'react';
import { AppSettings, WpConnection } from '../types.ts';
import Icon from './Icon.tsx';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onReset: () => void;
}

type TabId = 'zerogpt' | 'wordpress' | 'execution' | 'providers' | 'files';

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, settings, onSave, onReset }) => {
  const [activeTab, setActiveTab] = useState<TabId>('zerogpt');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleCancel = () => {
    setLocalSettings(settings); // Reset to original
    onClose();
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      onReset();
      onClose();
    }
  };

  const updateZeroGpt = <K extends keyof AppSettings['zeroGpt']>(key: K, value: AppSettings['zeroGpt'][K]) => {
    setLocalSettings(prev => ({
      ...prev,
      zeroGpt: { ...prev.zeroGpt, [key]: value },
    }));
  };

  const updateWordPress = <K extends keyof AppSettings['wordpress']>(key: K, value: AppSettings['wordpress'][K]) => {
    setLocalSettings(prev => ({
      ...prev,
      wordpress: { ...prev.wordpress, [key]: value },
    }));
  };

  const updateExecution = <K extends keyof AppSettings['execution']>(key: K, value: AppSettings['execution'][K]) => {
    setLocalSettings(prev => ({
      ...prev,
      execution: { ...prev.execution, [key]: value },
    }));
  };

  const updateProviders = <K extends keyof AppSettings['providers']>(key: K, value: AppSettings['providers'][K]) => {
    setLocalSettings(prev => ({
      ...prev,
      providers: { ...prev.providers, [key]: value },
    }));
  };

  const updateFiles = <K extends keyof AppSettings['files']>(key: K, value: AppSettings['files'][K]) => {
    setLocalSettings(prev => ({
      ...prev,
      files: { ...prev.files, [key]: value },
    }));
  };

  const addWpConnection = () => {
    const newConnection: WpConnection = {
      id: `wp_${Date.now()}`,
      name: 'New WordPress Site',
      url: '',
      username: '',
      password: '',
    };
    updateWordPress('connections', [...localSettings.wordpress.connections, newConnection]);
  };

  const updateWpConnection = (id: string, field: keyof WpConnection, value: string) => {
    updateWordPress(
      'connections',
      localSettings.wordpress.connections.map(conn =>
        conn.id === id ? { ...conn, [field]: value } : conn
      )
    );
  };

  const deleteWpConnection = (id: string) => {
    updateWordPress(
      'connections',
      localSettings.wordpress.connections.filter(conn => conn.id !== id)
    );
  };

  const tabs = [
    { id: 'zerogpt' as TabId, label: 'ZeroGPT', icon: 'info' as const },
    { id: 'wordpress' as TabId, label: 'WordPress', icon: 'upload' as const },
    { id: 'execution' as TabId, label: 'Execution', icon: 'play' as const },
    { id: 'providers' as TabId, label: 'Providers', icon: 'settings' as const },
    { id: 'files' as TabId, label: 'Files', icon: 'document' as const },
  ];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-cyan-500/30">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-3">
            <Icon type="settings" className="h-6 w-6" />
            Settings
          </h2>
          <button
            onClick={handleCancel}
            className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </header>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-gray-900/50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-gray-700 text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <Icon type={tab.icon} className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="p-6 overflow-y-auto flex-1">
          {/* ZeroGPT Tab */}
          {activeTab === 'zerogpt' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="zerogpt-enabled"
                  checked={localSettings.zeroGpt.enabled}
                  onChange={e => updateZeroGpt('enabled', e.target.checked)}
                  className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 text-cyan-600 focus:ring-cyan-500 rounded"
                />
                <label htmlFor="zerogpt-enabled" className="text-white font-semibold">
                  Enable ZeroGPT AI Detection
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">ZeroGPT API Key</label>
                <input
                  type="password"
                  value={localSettings.zeroGpt.apiKey}
                  onChange={e => updateZeroGpt('apiKey', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                  placeholder="Enter your ZeroGPT API key"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  AI Detection Threshold (%) <span className="text-gray-500">- Content flagged if score ≥ this value</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={localSettings.zeroGpt.threshold}
                  onChange={e => updateZeroGpt('threshold', parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Max Retry Attempts</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={localSettings.zeroGpt.maxRetries}
                  onChange={e => updateZeroGpt('maxRetries', parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">When Content is Flagged</label>
                <select
                  value={localSettings.zeroGpt.onFlagged}
                  onChange={e => updateZeroGpt('onFlagged', e.target.value as AppSettings['zeroGpt']['onFlagged'])}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="include_with_flag">Include with flag</option>
                  <option value="exclude">Exclude from results</option>
                  <option value="regenerate">Regenerate content</option>
                </select>
              </div>
            </div>
          )}

          {/* WordPress Tab */}
          {activeTab === 'wordpress' && (
            <div className="space-y-6">
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                <p className="text-yellow-300 text-sm">
                  <strong>Note:</strong> WordPress connections are stored locally in your browser. For production use, manage credentials server-side.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">WordPress Connections</h3>
                  <button
                    onClick={addWpConnection}
                    className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white text-sm font-semibold"
                  >
                    + Add Connection
                  </button>
                </div>

                {localSettings.wordpress.connections.length === 0 ? (
                  <p className="text-gray-400 text-sm">No connections configured yet.</p>
                ) : (
                  <div className="space-y-3">
                    {localSettings.wordpress.connections.map(conn => (
                      <div key={conn.id} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Connection Name</label>
                            <input
                              type="text"
                              value={conn.name}
                              onChange={e => updateWpConnection(conn.id, 'name', e.target.value)}
                              className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Site URL</label>
                            <input
                              type="text"
                              value={conn.url}
                              onChange={e => updateWpConnection(conn.id, 'url', e.target.value)}
                              placeholder="https://example.com"
                              className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Username</label>
                            <input
                              type="text"
                              value={conn.username}
                              onChange={e => updateWpConnection(conn.id, 'username', e.target.value)}
                              className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Application Password</label>
                            <input
                              type="password"
                              value={conn.password}
                              onChange={e => updateWpConnection(conn.id, 'password', e.target.value)}
                              className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => deleteWpConnection(conn.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Delete Connection
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Default Post Type</label>
                  <select
                    value={localSettings.wordpress.defaultPostType}
                    onChange={e => updateWordPress('defaultPostType', e.target.value as 'posts' | 'pages')}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="posts">Posts</option>
                    <option value="pages">Pages</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Default Status</label>
                  <select
                    value={localSettings.wordpress.defaultStatus}
                    onChange={e => updateWordPress('defaultStatus', e.target.value as 'draft' | 'publish' | 'private')}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="publish">Publish</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Title Template</label>
                <input
                  type="text"
                  value={localSettings.wordpress.titleTemplate}
                  onChange={e => updateWordPress('titleTemplate', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono text-sm focus:ring-2 focus:ring-cyan-500"
                  placeholder="{item_name}"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Max Retries</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={localSettings.wordpress.retries}
                    onChange={e => updateWordPress('retries', parseInt(e.target.value) || 0)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Retry Delay (ms)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={localSettings.wordpress.retryDelay}
                    onChange={e => updateWordPress('retryDelay', parseInt(e.target.value) || 0)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Execution Tab */}
          {activeTab === 'execution' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Concurrency <span className="text-gray-500">(items in parallel)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={localSettings.execution.concurrency}
                    onChange={e => updateExecution('concurrency', parseInt(e.target.value) || 1)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Batch Size</label>
                  <input
                    type="number"
                    min="1"
                    value={localSettings.execution.batchSize}
                    onChange={e => updateExecution('batchSize', parseInt(e.target.value) || 1)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Batch Delay (ms)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={localSettings.execution.batchDelay}
                    onChange={e => updateExecution('batchDelay', parseInt(e.target.value) || 0)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Timeout per Prompt (ms)</label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    value={localSettings.execution.timeout}
                    onChange={e => updateExecution('timeout', parseInt(e.target.value) || 60000)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Log Verbosity</label>
                <select
                  value={localSettings.execution.logVerbosity}
                  onChange={e => updateExecution('logVerbosity', e.target.value as 'minimal' | 'normal' | 'verbose')}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="minimal">Minimal</option>
                  <option value="normal">Normal</option>
                  <option value="verbose">Verbose</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="stop-on-error"
                  checked={localSettings.execution.stopOnError}
                  onChange={e => updateExecution('stopOnError', e.target.checked)}
                  className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 text-cyan-600 focus:ring-cyan-500 rounded"
                />
                <label htmlFor="stop-on-error" className="text-white">
                  Stop workflow on first error
                </label>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700 space-y-3">
                <h3 className="text-white font-semibold">Provider Retry Configuration</h3>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="provider-retry-enabled"
                    checked={localSettings.execution.providerRetry.enabled}
                    onChange={e => updateExecution('providerRetry', { ...localSettings.execution.providerRetry, enabled: e.target.checked })}
                    className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 text-cyan-600 focus:ring-cyan-500 rounded"
                  />
                  <label htmlFor="provider-retry-enabled" className="text-white">
                    Enable automatic retry on provider errors
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Max Retry Attempts</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={localSettings.execution.providerRetry.maxAttempts}
                      onChange={e => updateExecution('providerRetry', { ...localSettings.execution.providerRetry, maxAttempts: parseInt(e.target.value) || 1 })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Backoff Base (ms)</label>
                    <input
                      type="number"
                      min="100"
                      step="100"
                      value={localSettings.execution.providerRetry.backoffMs}
                      onChange={e => updateExecution('providerRetry', { ...localSettings.execution.providerRetry, backoffMs: parseInt(e.target.value) || 1000 })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Providers Tab */}
          {activeTab === 'providers' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Default AI Provider</label>
                <select
                  value={localSettings.providers.defaultProvider}
                  onChange={e => updateProviders('defaultProvider', e.target.value as 'gemini' | 'claude' | 'openai')}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="claude">Anthropic Claude</option>
                  <option value="openai">OpenAI GPT</option>
                </select>
              </div>

              <div className="space-y-3">
                <h3 className="text-white font-semibold border-b border-gray-700 pb-2">API Keys</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Google Gemini API Key</label>
                  <input
                    type="password"
                    value={localSettings.providers.apiKeys.gemini}
                    onChange={e => updateProviders('apiKeys', { ...localSettings.providers.apiKeys, gemini: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                    placeholder="Enter Gemini API key"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Anthropic Claude API Key</label>
                  <input
                    type="password"
                    value={localSettings.providers.apiKeys.claude}
                    onChange={e => updateProviders('apiKeys', { ...localSettings.providers.apiKeys, claude: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                    placeholder="Enter Claude API key"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">OpenAI API Key (Optional)</label>
                  <input
                    type="password"
                    value={localSettings.providers.apiKeys.openai || ''}
                    onChange={e => updateProviders('apiKeys', { ...localSettings.providers.apiKeys, openai: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                    placeholder="Enter OpenAI API key"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-white font-semibold border-b border-gray-700 pb-2">Model Overrides</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Gemini Model</label>
                  <input
                    type="text"
                    value={localSettings.providers.modelOverrides.gemini}
                    onChange={e => updateProviders('modelOverrides', { ...localSettings.providers.modelOverrides, gemini: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono text-sm focus:ring-2 focus:ring-cyan-500"
                    placeholder="gemini-2.5-flash"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Claude Model</label>
                  <input
                    type="text"
                    value={localSettings.providers.modelOverrides.claude}
                    onChange={e => updateProviders('modelOverrides', { ...localSettings.providers.modelOverrides, claude: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono text-sm focus:ring-2 focus:ring-cyan-500"
                    placeholder="claude-3-sonnet-20240229"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">OpenAI Model (Optional)</label>
                  <input
                    type="text"
                    value={localSettings.providers.modelOverrides.openai || ''}
                    onChange={e => updateProviders('modelOverrides', { ...localSettings.providers.modelOverrides, openai: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono text-sm focus:ring-2 focus:ring-cyan-500"
                    placeholder="gpt-4"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Files Tab */}
          {activeTab === 'files' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Filename Template</label>
                <input
                  type="text"
                  value={localSettings.files.nameTemplate}
                  onChange={e => updateFiles('nameTemplate', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono text-sm focus:ring-2 focus:ring-cyan-500"
                  placeholder="{tag}-{item_name}-output"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available variables: {'{tag}'}, {'{item_name}'}, {'{status}'}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-white font-semibold">Download Formats</h3>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="format-txt"
                    checked={localSettings.files.formats.txt}
                    onChange={e => updateFiles('formats', { ...localSettings.files.formats, txt: e.target.checked })}
                    className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 text-cyan-600 focus:ring-cyan-500 rounded"
                  />
                  <label htmlFor="format-txt" className="text-white">Include .txt files</label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="format-json"
                    checked={localSettings.files.formats.json}
                    onChange={e => updateFiles('formats', { ...localSettings.files.formats, json: e.target.checked })}
                    className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 text-cyan-600 focus:ring-cyan-500 rounded"
                  />
                  <label htmlFor="format-json" className="text-white">Include .json files</label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="format-csv"
                    checked={localSettings.files.formats.csv}
                    onChange={e => updateFiles('formats', { ...localSettings.files.formats, csv: e.target.checked })}
                    className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 text-cyan-600 focus:ring-cyan-500 rounded"
                  />
                  <label htmlFor="format-csv" className="text-white">Include .csv export</label>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="zip-compression"
                  checked={localSettings.files.zipCompression}
                  onChange={e => updateFiles('zipCompression', e.target.checked)}
                  className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 text-cyan-600 focus:ring-cyan-500 rounded"
                />
                <label htmlFor="zip-compression" className="text-white">Enable ZIP compression</label>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="flex items-center justify-between p-4 border-t border-gray-700 bg-gray-900/50">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-md transition text-sm font-semibold border border-red-600/50"
          >
            Reset to Defaults
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md transition font-semibold"
            >
              Save Settings
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SettingsPanel;
