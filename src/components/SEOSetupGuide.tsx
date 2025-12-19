import React, { useState } from 'react';

interface SEOSetupGuideProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlugin?: string;
}

const SEOSetupGuide: React.FC<SEOSetupGuideProps> = ({ isOpen, onClose, initialPlugin = 'aioseo' }) => {
  const [activePlugin, setActivePlugin] = useState(initialPlugin);

  if (!isOpen) return null;

  const plugins = [
    { id: 'aioseo', name: 'All in One SEO', icon: '🔍' },
    { id: 'yoast', name: 'Yoast SEO', icon: '🟢' },
    { id: 'rankmath', name: 'Rank Math', icon: '📊' },
    { id: 'seopress', name: 'SEOPress', icon: '🚀' },
    { id: 'none', name: 'Direct to WP', icon: '📝' },
  ];

  const guides: Record<string, { title: string; requirements: string[]; steps: { title: string; description: string }[]; notes: string[]; troubleshooting: string[] }> = {
    aioseo: {
      title: 'All in One SEO (AIOSEO)',
      requirements: [
        'AIOSEO Plus, Pro, or Elite license (REST API not available in free version)',
        'WordPress REST API enabled',
        'Application Password or valid admin credentials'
      ],
      steps: [
        {
          title: '1. Verify License',
          description: 'Go to All in One SEO → General Settings and verify you have Plus, Pro, or Elite. The free version does not support REST API updates.'
        },
        {
          title: '2. Check REST API',
          description: 'AIOSEO automatically exposes its data via REST API for paid versions. No additional configuration needed.'
        },
        {
          title: '3. Configure PromptFlow',
          description: 'In PromptFlow, ensure your WordPress credentials have administrator privileges. AIOSEO requires admin access for API updates.'
        }
      ],
      notes: [
        'AIOSEO uses the aioseo_meta_data object in the WordPress REST API',
        'Meta title and description sync automatically when updating posts',
        'If using caching plugins, clear cache after updates'
      ],
      troubleshooting: [
        'Getting 403 errors? Verify your license is active and not expired',
        'Meta not updating? Check that your WordPress user has administrator role',
        'Empty response? Ensure REST API is not blocked by security plugins'
      ]
    },
    yoast: {
      title: 'Yoast SEO',
      requirements: [
        'Yoast SEO plugin installed (free or premium)',
        'Custom code added to functions.php',
        'WordPress REST API enabled'
      ],
      steps: [
        {
          title: '1. Add Code to functions.php',
          description: 'Yoast\'s meta fields are protected by default. Add this code to your theme\'s functions.php file (or use a code snippets plugin):'
        },
        {
          title: '2. Code Snippet',
          description: `add_action('init', function() {
  // For posts
  register_post_meta('post', '_yoast_wpseo_title', [
    'show_in_rest' => true,
    'single' => true,
    'type' => 'string',
    'auth_callback' => function() { return current_user_can('edit_posts'); }
  ]);
  register_post_meta('post', '_yoast_wpseo_metadesc', [
    'show_in_rest' => true,
    'single' => true,
    'type' => 'string',
    'auth_callback' => function() { return current_user_can('edit_posts'); }
  ]);

  // For pages
  register_post_meta('page', '_yoast_wpseo_title', [
    'show_in_rest' => true,
    'single' => true,
    'type' => 'string',
    'auth_callback' => function() { return current_user_can('edit_pages'); }
  ]);
  register_post_meta('page', '_yoast_wpseo_metadesc', [
    'show_in_rest' => true,
    'single' => true,
    'type' => 'string',
    'auth_callback' => function() { return current_user_can('edit_pages'); }
  ]);
});`
        },
        {
          title: '3. Clear Caches',
          description: 'After adding the code, clear any caching (WordPress cache, CDN, browser cache) and test the connection.'
        }
      ],
      notes: [
        'The code snippet works with both free and premium Yoast',
        'If using a child theme, add to the child theme\'s functions.php',
        'Code Snippets plugin is a safe alternative to editing functions.php directly'
      ],
      troubleshooting: [
        'Meta not saving? Double-check the code was added correctly with no PHP errors',
        'Getting 401/403? Verify your WordPress user has edit_posts/edit_pages capability',
        'After theme update, code disappeared? Use Code Snippets plugin instead'
      ]
    },
    rankmath: {
      title: 'Rank Math SEO',
      requirements: [
        'Rank Math plugin installed (free version works!)',
        'Headless CMS Support enabled',
        'WordPress REST API enabled'
      ],
      steps: [
        {
          title: '1. Open Rank Math Settings',
          description: 'In WordPress admin, go to Rank Math → General Settings → Others (scroll down or click the "Others" tab).'
        },
        {
          title: '2. Enable Headless CMS Support',
          description: 'Find the "Headless CMS Support" toggle and turn it ON. This exposes Rank Math\'s meta fields to the REST API.'
        },
        {
          title: '3. Save Changes',
          description: 'Click "Save Changes" at the bottom of the page. That\'s it! Rank Math is now ready to receive API updates.'
        }
      ],
      notes: [
        'Rank Math free version fully supports REST API (best free option!)',
        'Meta fields exposed: rank_math_title, rank_math_description',
        'Rank Math also has an internal API at /wp-json/rankmath/v1/ for advanced use'
      ],
      troubleshooting: [
        'Setting not visible? Update Rank Math to the latest version',
        'Still not working? Check Rank Math → Status & Tools for any errors',
        'Conflicting with other SEO plugin? Disable other SEO plugins first'
      ]
    },
    seopress: {
      title: 'SEOPress',
      requirements: [
        'SEOPress plugin installed (free or pro)',
        'REST API enabled in SEOPress settings',
        'WordPress REST API enabled'
      ],
      steps: [
        {
          title: '1. Open SEOPress Settings',
          description: 'In WordPress admin, go to SEOPress → Advanced.'
        },
        {
          title: '2. Check REST API Settings',
          description: 'Look for REST API related settings and ensure they are enabled. SEOPress generally exposes meta fields by default.'
        },
        {
          title: '3. Verify Permissions',
          description: 'Ensure your WordPress user has proper editing permissions for posts/pages.'
        }
      ],
      notes: [
        'SEOPress uses _seopress_titles_title and _seopress_titles_desc meta fields',
        'Both free and pro versions support REST API',
        'SEOPress is lightweight and generally has fewer conflicts'
      ],
      troubleshooting: [
        'Meta not updating? Check if any security plugins are blocking REST API',
        'Getting errors? Verify SEOPress is up to date',
        'Conflicting data? Check if another SEO plugin is installed'
      ]
    },
    none: {
      title: 'Direct to WordPress (No SEO Plugin)',
      requirements: [
        'WordPress REST API enabled',
        'Theme that uses excerpt for meta description (optional)'
      ],
      steps: [
        {
          title: '1. How It Works',
          description: 'This option bypasses SEO plugins and writes directly to WordPress. The meta description is saved to the post/page excerpt field.'
        },
        {
          title: '2. Theme Compatibility',
          description: 'Some themes automatically use the excerpt as the meta description. Check your theme\'s SEO settings or documentation.'
        },
        {
          title: '3. Manual Meta Tags',
          description: 'For full control, you can add meta tags to your theme\'s header.php or use the wp_head hook in functions.php.'
        }
      ],
      notes: [
        'Good for simple sites without SEO plugins',
        'Excerpt field is a standard WordPress feature',
        'Some page builders (Elementor, etc.) have their own SEO settings'
      ],
      troubleshooting: [
        'Meta not showing? Check if your theme outputs the excerpt as meta description',
        'Need custom meta tags? Consider installing a lightweight SEO plugin',
        'Using Elementor? Check Elementor\'s SEO settings under Site Settings'
      ]
    }
  };

  const currentGuide = guides[activePlugin];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl border border-brand-cyan/30 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-brand-cyan">SEO Plugin Setup Guide</h2>
              <p className="text-gray-400 text-sm mt-1">Step-by-step instructions for each SEO plugin</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Plugin Tabs */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {plugins.map(plugin => (
              <button
                key={plugin.id}
                onClick={() => setActivePlugin(plugin.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activePlugin === plugin.id
                    ? 'bg-brand-cyan text-slate-900'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                <span className="mr-2">{plugin.icon}</span>
                {plugin.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-xl font-bold text-white mb-4">{currentGuide.title}</h3>

          {/* Requirements */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-brand-cyan uppercase tracking-wider mb-2">Requirements</h4>
            <ul className="space-y-1">
              {currentGuide.requirements.map((req, idx) => (
                <li key={idx} className="text-gray-300 text-sm flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  {req}
                </li>
              ))}
            </ul>
          </div>

          {/* Steps */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-brand-cyan uppercase tracking-wider mb-3">Setup Steps</h4>
            <div className="space-y-4">
              {currentGuide.steps.map((step, idx) => (
                <div key={idx} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <h5 className="font-semibold text-white mb-2">{step.title}</h5>
                  {step.description.includes('\n') ? (
                    <pre className="text-gray-300 text-sm whitespace-pre-wrap bg-slate-900 p-3 rounded-lg overflow-x-auto font-mono text-xs">
                      {step.description}
                    </pre>
                  ) : (
                    <p className="text-gray-300 text-sm">{step.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-2">Important Notes</h4>
            <ul className="space-y-1">
              {currentGuide.notes.map((note, idx) => (
                <li key={idx} className="text-gray-300 text-sm flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5">•</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>

          {/* Troubleshooting */}
          <div>
            <h4 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2">Troubleshooting</h4>
            <ul className="space-y-2">
              {currentGuide.troubleshooting.map((tip, idx) => (
                <li key={idx} className="text-gray-300 text-sm flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">!</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Need more help? Consider using the Tech Support assistant (coming soon)
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-brand-cyan text-slate-900 rounded-lg font-medium hover:bg-brand-cyan/80 transition-colors"
            >
              Close Guide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SEOSetupGuide;
