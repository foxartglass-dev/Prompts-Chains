import React, { useState, useEffect } from 'react';

interface SeoPlugin {
  id: string;
  name: string;
  isDefault: boolean;
}

interface WordPressSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_ELEMENTOR_PROMPT = `When generating content for Elementor pages, follow these formatting guidelines:

**FAQ Section Formatting:**
- Each FAQ must have "Question:" followed by the question text on its own line
- Followed by "Answer:" and the answer text on the next line
- Add a blank line between each question-answer pair for visual separation
- Do NOT use markdown formatting like # or ** in FAQ sections
- Example format:
  Question: What services do you offer?
  Answer: We offer comprehensive cleaning services including...

  Question: How do I book an appointment?
  Answer: You can book online through our website or call us at...

**Text Formatting Guidelines:**
- Avoid excessive use of hyphens/dashes between words in regular text
- Only use hyphens for established compound words and keywords (e.g., "move-ins", "deep-clean")
- Prefer spaces or rewording over hyphenated phrases in general text
- Do NOT use markdown header symbols (#) in the final output
- Keep formatting clean and SEO-friendly`;

const DEFAULT_SEO_PLUGINS: SeoPlugin[] = [
  { id: 'rankmath', name: 'Rank Math', isDefault: true },
  { id: 'yoast', name: 'Yoast SEO', isDefault: true },
  { id: 'aioseo', name: 'All in One SEO', isDefault: true },
  { id: 'seopress', name: 'SEOPress', isDefault: true },
];

interface StagingCredentials {
  wpUrl: string;
  wpUser: string;
  wpPassword: string;
}

const WordPressSettings: React.FC<WordPressSettingsProps> = ({ isOpen, onClose }) => {
  const [seoPlugins, setSeoPlugins] = useState<SeoPlugin[]>([]);
  const [defaultElementorPrompt, setDefaultElementorPrompt] = useState(DEFAULT_ELEMENTOR_PROMPT);
  const [newPluginName, setNewPluginName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Staging WordPress credentials for Image Bank uploads
  const [stagingCredentials, setStagingCredentials] = useState<StagingCredentials>({
    wpUrl: '',
    wpUser: '',
    wpPassword: ''
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      // Load SEO plugins and prompt from localStorage
      const savedPlugins = localStorage.getItem('promptflow_seo_plugins');
      const savedPrompt = localStorage.getItem('promptflow_default_elementor_prompt');

      if (savedPlugins) {
        setSeoPlugins(JSON.parse(savedPlugins));
      } else {
        setSeoPlugins(DEFAULT_SEO_PLUGINS);
      }

      if (savedPrompt) {
        setDefaultElementorPrompt(savedPrompt);
      }

      // Load staging credentials from database (global_settings table)
      try {
        const res = await fetch('/api/global-settings');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.settings) {
            setStagingCredentials({
              wpUrl: data.settings.staging_wp_url || '',
              wpUser: data.settings.staging_wp_user || '',
              wpPassword: data.settings.staging_wp_password || ''
            });
          }
        }
      } catch (apiErr) {
        console.error('Failed to load staging credentials from API:', apiErr);
      }
    } catch (err) {
      console.error('Failed to load WordPress settings:', err);
      setSeoPlugins(DEFAULT_SEO_PLUGINS);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Save SEO plugins and prompt to localStorage
      localStorage.setItem('promptflow_seo_plugins', JSON.stringify(seoPlugins));
      localStorage.setItem('promptflow_default_elementor_prompt', defaultElementorPrompt);

      // Save staging credentials to database (global_settings table)
      const res = await fetch('/api/global-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staging_wp_url: stagingCredentials.wpUrl,
          staging_wp_user: stagingCredentials.wpUser,
          staging_wp_password: stagingCredentials.wpPassword
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save staging credentials');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  // Test staging WordPress connection
  const testStagingConnection = async () => {
    if (!stagingCredentials.wpUrl || !stagingCredentials.wpUser || !stagingCredentials.wpPassword) {
      setConnectionStatus('error');
      setConnectionMessage('Please fill in all staging credentials');
      return;
    }

    setTestingConnection(true);
    setConnectionStatus('idle');
    setConnectionMessage('');

    try {
      const res = await fetch('/api/elementor/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpUrl: stagingCredentials.wpUrl,
          wpUser: stagingCredentials.wpUser,
          wpPassword: stagingCredentials.wpPassword
        })
      });

      const data = await res.json();

      if (data.success) {
        setConnectionStatus('success');
        setConnectionMessage(`Connected! ${data.canPublish ? 'Can create pages.' : 'Read-only access.'}`);
      } else {
        setConnectionStatus('error');
        setConnectionMessage(data.error || 'Connection failed');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionMessage(err.message || 'Connection test failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const addCustomPlugin = () => {
    if (!newPluginName.trim()) return;

    const id = newPluginName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seoPlugins.some(p => p.id === id)) {
      return; // Already exists
    }

    setSeoPlugins([...seoPlugins, { id, name: newPluginName.trim(), isDefault: false }]);
    setNewPluginName('');
  };

  const removePlugin = (id: string) => {
    setSeoPlugins(seoPlugins.filter(p => p.id !== id || p.isDefault));
  };

  const resetToDefaults = () => {
    setSeoPlugins(DEFAULT_SEO_PLUGINS);
    setDefaultElementorPrompt(DEFAULT_ELEMENTOR_PROMPT);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg w-[800px] max-h-[85vh] flex flex-col overflow-hidden border border-brand-cyan/30">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-brand-cyan/30">
          <div className="flex items-center gap-3">
            <svg className="h-6 w-6 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <h2 className="text-xl font-semibold text-brand-gold">WordPress Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SEO Plugins Section */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-brand-cyan/20">
            <h3 className="text-lg font-semibold text-brand-cyan mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              SEO Plugins
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Configure which SEO plugins are available for meta data pushing. Default plugins cannot be removed.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {seoPlugins.map(plugin => (
                <div
                  key={plugin.id}
                  className="flex items-center justify-between bg-slate-700/50 rounded px-3 py-2"
                >
                  <span className="text-white text-sm">{plugin.name}</span>
                  {!plugin.isDefault && (
                    <button
                      onClick={() => removePlugin(plugin.id)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Remove
                    </button>
                  )}
                  {plugin.isDefault && (
                    <span className="text-xs text-gray-500">Default</span>
                  )}
                </div>
              ))}
            </div>

            {/* Add Custom Plugin */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newPluginName}
                onChange={(e) => setNewPluginName(e.target.value)}
                placeholder="Add custom SEO plugin..."
                className="flex-1 bg-slate-700 border border-brand-cyan/30 rounded px-3 py-2 text-white text-sm"
                onKeyDown={(e) => e.key === 'Enter' && addCustomPlugin()}
              />
              <button
                onClick={addCustomPlugin}
                disabled={!newPluginName.trim()}
                className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan-dark rounded text-slate-900 font-medium text-sm disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Staging WordPress Credentials Section */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-purple-500/30">
            <h3 className="text-lg font-semibold text-purple-400 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Staging WordPress (Image Bank Uploads)
            </h3>
            <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-3 mb-4">
              <p className="text-sm text-purple-300/80">
                <strong>Why staging?</strong> Many WordPress hosts block large base64 image uploads via ModSecurity.
                The staging site acts as a media library that bypasses these restrictions.
              </p>
              <p className="text-xs text-purple-300/60 mt-2">
                <strong>Flow:</strong> AI generates base64 → Upload to Staging WP → Get URL → Use URL on customer sites
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-purple-300 mb-1 block">Staging WordPress URL</label>
                <input
                  type="url"
                  value={stagingCredentials.wpUrl}
                  onChange={(e) => setStagingCredentials({ ...stagingCredentials, wpUrl: e.target.value })}
                  placeholder="https://staging.example.com"
                  className="w-full bg-slate-700 border border-purple-500/30 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-purple-300 mb-1 block">Username</label>
                  <input
                    type="text"
                    value={stagingCredentials.wpUser}
                    onChange={(e) => setStagingCredentials({ ...stagingCredentials, wpUser: e.target.value })}
                    placeholder="admin"
                    className="w-full bg-slate-700 border border-purple-500/30 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-purple-300 mb-1 block">Application Password</label>
                  <input
                    type="password"
                    value={stagingCredentials.wpPassword}
                    onChange={(e) => setStagingCredentials({ ...stagingCredentials, wpPassword: e.target.value })}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full bg-slate-700 border border-purple-500/30 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={testStagingConnection}
                  disabled={testingConnection}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded text-white text-sm font-medium transition flex items-center gap-2"
                >
                  {testingConnection ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </button>
                {connectionStatus !== 'idle' && (
                  <span className={`text-sm ${connectionStatus === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {connectionMessage}
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-500">
                💡 Create an Application Password: WordPress → Users → Profile → Application Passwords
              </p>
            </div>
          </div>

          {/* Default Elementor Prompt Section */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-brand-gold/20">
            <h3 className="text-lg font-semibold text-brand-gold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Default Elementor Prompt
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              This prompt is used when generating content for Elementor pages. It defines formatting rules for FAQs, text styling, and more.
              New websites will inherit this default, but can customize their own version.
            </p>

            <textarea
              value={defaultElementorPrompt}
              onChange={(e) => setDefaultElementorPrompt(e.target.value)}
              className="w-full h-64 bg-slate-700 border border-brand-gold/30 rounded p-4 text-white text-sm font-mono resize-none"
              placeholder="Enter default Elementor prompt..."
            />

            <div className="mt-2 text-xs text-gray-500">
              <strong>Key formatting rules included:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>FAQ format: "Question:" and "Answer:" on separate lines</li>
                <li>Avoid excessive dashes in regular text</li>
                <li>No markdown symbols (#, **) in output</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-brand-cyan/30 bg-slate-800/30">
          <button
            onClick={resetToDefaults}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm"
          >
            Reset to Defaults
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm"
            >
              Cancel
            </button>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-6 py-2 bg-brand-cyan hover:bg-brand-cyan-dark rounded text-slate-900 font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : saved ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Saved!
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WordPressSettings;
