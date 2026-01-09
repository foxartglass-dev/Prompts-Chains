import React, { useState } from 'react';

interface BlueprintPageProps {
  isOpen: boolean;
  onClose: () => void;
}

type BlueprintTab = 'image-flow' | 'push-all' | 'data-sources' | 'golden-rules';

const BlueprintPage: React.FC<BlueprintPageProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<BlueprintTab>('image-flow');

  if (!isOpen) return null;

  const tabs: { id: BlueprintTab; label: string }[] = [
    { id: 'image-flow', label: 'Image Flow' },
    { id: 'push-all', label: 'Push All to WP' },
    { id: 'data-sources', label: 'Data Sources' },
    { id: 'golden-rules', label: 'Golden Rules' },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-900 rounded-lg w-[95vw] h-[90vh] overflow-hidden border border-brand-cyan/30 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-brand-cyan/30 bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-brand-gold flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              System Blueprint
            </h1>
            <span className="text-sm text-gray-400">
              Reference for AI agents and developers
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab Navigation */}
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-brand-cyan text-slate-900'
                      : 'text-gray-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl ml-2"
              title="Close"
            >
              &times;
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {activeTab === 'image-flow' && <ImageFlowDiagram />}
          {activeTab === 'push-all' && <PushAllDiagram />}
          {activeTab === 'data-sources' && <DataSourcesDiagram />}
          {activeTab === 'golden-rules' && <GoldenRules />}
        </main>
      </div>
    </div>
  );
};

// Image Flow Diagram - The most critical diagram
const ImageFlowDiagram: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-brand-cyan mb-2">Image Pipeline</h2>
      <p className="text-gray-400">This is the flow that keeps getting broken. Pay attention!</p>
    </div>

    {/* Main Flow Diagram */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <div className="flex flex-col items-center gap-4">

        {/* Two Sources Box */}
        <div className="flex gap-8 justify-center">
          {/* Image Bank Source */}
          <div className="bg-slate-700 rounded-lg p-4 border-2 border-brand-gold w-64 text-center">
            <div className="text-brand-gold font-bold mb-2">IMAGE BANK</div>
            <div className="text-sm text-gray-300 space-y-1">
              <div>Pre-generated images</div>
              <div className="text-xs text-gray-400">Stored in: <code className="bg-slate-800 px-1 rounded">image_bank_items</code></div>
              <div className="text-xs text-gray-400">Already have WordPress URLs</div>
            </div>
          </div>

          {/* Generate Live Source */}
          <div className="bg-slate-700 rounded-lg p-4 border-2 border-brand-cyan w-64 text-center">
            <div className="text-brand-cyan font-bold mb-2">GENERATE LIVE</div>
            <div className="text-sm text-gray-300 space-y-1">
              <div>On-the-fly AI generation</div>
              <div className="text-xs text-gray-400">Returns BASE64 data URLs</div>
              <div className="text-xs text-gray-400">Needs upload to get wpUrl</div>
            </div>
          </div>
        </div>

        {/* Arrow Down */}
        <div className="text-4xl text-brand-cyan animate-pulse">↓</div>

        {/* Smart Matching Mode Decision */}
        <div className="bg-red-900/30 rounded-lg p-4 border-2 border-red-500 w-full max-w-xl">
          <div className="text-red-400 font-bold mb-2 text-center">CRITICAL: smart_matching_mode</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-800 p-3 rounded">
              <code className="text-brand-gold">'bank_first'</code>
              <div className="text-gray-300 mt-1">Use bank, generate if empty</div>
              <div className="text-green-400 text-xs">fallback = TRUE</div>
            </div>
            <div className="bg-slate-800 p-3 rounded">
              <code className="text-brand-gold">'bank_only'</code>
              <div className="text-gray-300 mt-1">Only use bank, never generate</div>
              <div className="text-red-400 text-xs">fallback = FALSE</div>
            </div>
            <div className="bg-slate-800 p-3 rounded">
              <code className="text-brand-gold">'generate_first'</code>
              <div className="text-gray-300 mt-1">Generate first, bank as backup</div>
              <div className="text-green-400 text-xs">fallback = TRUE</div>
            </div>
            <div className="bg-slate-800 p-3 rounded">
              <code className="text-brand-gold">'generate_only'</code>
              <div className="text-gray-300 mt-1">Only generate, never use bank</div>
              <div className="text-red-400 text-xs">fallback = FALSE</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-red-300 text-center">
            Source of truth: <code className="bg-slate-800 px-1 rounded">image_creation_settings.smart_matching_mode</code>
          </div>
        </div>

        {/* Arrow Down */}
        <div className="text-4xl text-brand-cyan animate-pulse">↓</div>

        {/* Two Destinations */}
        <div className="flex gap-8 justify-center">
          {/* Draft Mode */}
          <div className="bg-slate-700 rounded-lg p-4 border-2 border-yellow-500 w-64 text-center">
            <div className="text-yellow-500 font-bold mb-2">DRAFT MODE</div>
            <div className="text-sm text-gray-300 space-y-1">
              <div><code className="bg-slate-800 px-1 rounded text-xs">imageDraftMode: true</code></div>
              <div className="text-xs text-gray-400 mt-2">Images go to:</div>
              <div className="text-xs text-brand-cyan">→ articles.generated_images</div>
              <div className="text-xs text-brand-cyan">→ Draft Image Bank</div>
              <div className="text-xs text-gray-500 mt-1">NO WordPress page yet</div>
            </div>
          </div>

          {/* WordPress Mode */}
          <div className="bg-slate-700 rounded-lg p-4 border-2 border-green-500 w-64 text-center">
            <div className="text-green-500 font-bold mb-2">WORDPRESS MODE</div>
            <div className="text-sm text-gray-300 space-y-1">
              <div><code className="bg-slate-800 px-1 rounded text-xs">imageDraftMode: false</code></div>
              <div className="text-xs text-gray-400 mt-2">Images go to:</div>
              <div className="text-xs text-brand-cyan">→ Embedded in WP page</div>
              <div className="text-xs text-brand-cyan">→ Via Elementor structure</div>
              <div className="text-xs text-gray-500 mt-1">Page created on WordPress</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Image Object Structure */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-gold mb-4">Image Object Structure</h3>
      <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
        <pre className="text-gray-300">{`{
  "id": "img-1234567890-hero",
  "placement": "hero" | "section-1" | "section-3" | etc.,
  "url": "data:image/png;base64,..." OR "https://site.com/wp-content/...",
  "wpMediaUrl": "https://site.com/wp-content/uploads/...",  // AFTER push-images
  "wpMediaId": 123,                                         // WordPress Media ID
  "prompt": "The generation prompt used",
  "pushedToWp": true | false,
  "side": "left" | "right",
  "keywords": ["matched", "keywords"]
}`}</pre>
      </div>
      <div className="mt-4 text-sm text-gray-400">
        <strong className="text-brand-cyan">Key insight:</strong> Images start as base64 (url field).
        After <code className="bg-slate-800 px-1 rounded">/api/articles/:id/push-images</code>, they get <code className="bg-slate-800 px-1 rounded">wpMediaUrl</code>.
        The Elementor publish step uses <code className="bg-slate-800 px-1 rounded">wpMediaUrl</code> to embed in the page.
      </div>
    </div>
  </div>
);

// Push All to WP Diagram
const PushAllDiagram: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-brand-cyan mb-2">Push All to WordPress Flow</h2>
      <p className="text-gray-400">ORDER MATTERS! This is the exact sequence that must happen.</p>
    </div>

    {/* Step by Step Flow */}
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Step 1 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-brand-cyan">
        <div className="flex items-center gap-4">
          <div className="bg-brand-cyan text-slate-900 w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl">1</div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-brand-cyan">Upload Images to WP Media Library</h3>
            <code className="text-sm text-gray-400 bg-slate-900 px-2 py-1 rounded mt-1 inline-block">
              POST /api/articles/:id/push-images
            </code>
          </div>
        </div>
        <div className="mt-4 ml-14 space-y-2 text-sm text-gray-300">
          <div>• Reads <code className="bg-slate-900 px-1 rounded">articles.generated_images</code> (base64 data URLs)</div>
          <div>• Uploads each to WordPress Media Library</div>
          <div>• Gets back <code className="bg-slate-900 px-1 rounded">wpMediaUrl</code> and <code className="bg-slate-900 px-1 rounded">wpMediaId</code></div>
          <div>• Updates the article record with the new URLs</div>
        </div>
      </div>

      {/* Arrow */}
      <div className="text-center text-3xl text-brand-cyan">↓</div>

      {/* Step 2 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-brand-gold">
        <div className="flex items-center gap-4">
          <div className="bg-brand-gold text-slate-900 w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl">2</div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-brand-gold">Create WordPress Page with Embedded Images</h3>
            <code className="text-sm text-gray-400 bg-slate-900 px-2 py-1 rounded mt-1 inline-block">
              POST /api/elementor/publish
            </code>
          </div>
        </div>
        <div className="mt-4 ml-14 space-y-2 text-sm text-gray-300">
          <div>• Fetches article with <code className="bg-slate-900 px-1 rounded">generated_images</code> (now has wpMediaUrl!)</div>
          <div>• Builds Elementor page structure</div>
          <div>• Embeds images at correct placements (hero, section-1, etc.)</div>
          <div>• Creates the page on WordPress</div>
          <div>• Returns <code className="bg-slate-900 px-1 rounded">wp_post_id</code> and <code className="bg-slate-900 px-1 rounded">wp_post_url</code></div>
        </div>
      </div>

      {/* Arrow */}
      <div className="text-center text-3xl text-brand-cyan">↓</div>

      {/* Step 3 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-green-500">
        <div className="flex items-center gap-4">
          <div className="bg-green-500 text-slate-900 w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl">3</div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-green-500">Push Meta to SEO Plugin</h3>
            <code className="text-sm text-gray-400 bg-slate-900 px-2 py-1 rounded mt-1 inline-block">
              POST /api/seo/push-direct
            </code>
          </div>
        </div>
        <div className="mt-4 ml-14 space-y-2 text-sm text-gray-300">
          <div>• Sends <code className="bg-slate-900 px-1 rounded">selected_meta_title</code> and <code className="bg-slate-900 px-1 rounded">selected_meta_description</code></div>
          <div>• Must pass correct <code className="bg-slate-900 px-1 rounded">seoPlugin</code> from <code className="bg-slate-900 px-1 rounded">websites.seo_plugin</code></div>
          <div>• Supported: rankmath, yoast, aioseo, seopress, direct</div>
        </div>
      </div>
    </div>

    {/* Warning Box */}
    <div className="bg-red-900/30 rounded-xl p-6 border border-red-500 max-w-2xl mx-auto mt-8">
      <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Common Mistakes
      </h3>
      <ul className="space-y-2 text-sm text-gray-300">
        <li className="flex items-start gap-2">
          <span className="text-red-400">✗</span>
          Creating page BEFORE uploading images = images don't appear on page
        </li>
        <li className="flex items-start gap-2">
          <span className="text-red-400">✗</span>
          Overwriting <code className="bg-slate-800 px-1 rounded">generated_images</code> with empty array = images vanish
        </li>
        <li className="flex items-start gap-2">
          <span className="text-red-400">✗</span>
          Using wrong SEO plugin = meta doesn't appear in WordPress
        </li>
        <li className="flex items-start gap-2">
          <span className="text-red-400">✗</span>
          Resetting <code className="bg-slate-800 px-1 rounded">metaSaved</code> state on refresh = UI shows unsaved
        </li>
      </ul>
    </div>
  </div>
);

// Data Sources Diagram
const DataSourcesDiagram: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-brand-cyan mb-2">Data Sources & Settings</h2>
      <p className="text-gray-400">Where each piece of data comes from (source of truth)</p>
    </div>

    <div className="grid md:grid-cols-2 gap-6">
      {/* articles table */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
        <h3 className="text-lg font-bold text-brand-cyan mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          articles
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">generated_images</code>
            <span className="text-gray-400">JSONB array of images</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">selected_meta_title</code>
            <span className="text-gray-400">User's chosen title</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">selected_meta_description</code>
            <span className="text-gray-400">User's chosen desc</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">wp_post_id</code>
            <span className="text-gray-400">WordPress page ID</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <code className="text-brand-gold">final_content</code>
            <span className="text-gray-400">Generated HTML</span>
          </div>
        </div>
      </div>

      {/* websites table */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-gold/30">
        <h3 className="text-lg font-bold text-brand-gold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
          </svg>
          websites
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">seo_plugin</code>
            <span className="text-gray-400">rankmath/yoast/etc</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">wp_url</code>
            <span className="text-gray-400">WordPress site URL</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">wp_user</code>
            <span className="text-gray-400">WordPress username</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <code className="text-brand-gold">wp_app_password</code>
            <span className="text-gray-400">WP app password</span>
          </div>
        </div>
      </div>

      {/* image_creation_settings table */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-red-500/30">
        <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          image_creation_settings
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">smart_matching_mode</code>
            <span className="text-gray-400">bank_first/bank_only/etc</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">integration_mode</code>
            <span className="text-gray-400">bank or live</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">image_generation_model</code>
            <span className="text-gray-400">gpt-image-1.5/flux/etc</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <code className="text-brand-gold">audience_avatars</code>
            <span className="text-gray-400">JSONB personas</span>
          </div>
        </div>
        <div className="mt-4 p-3 bg-red-900/30 rounded-lg text-xs text-red-300">
          <strong>NOTE:</strong> Derive fallback from smart_matching_mode, NOT from a separate fallback_to_live field!
        </div>
      </div>

      {/* image_bank_items table */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          image_bank_items
        </h3>
        <div className="space-y-2 text-sm">
          <div className="text-gray-400 mb-2">Pre-generated images for Smart Content Matching</div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">workflow_id</code>
            <span className="text-gray-400">Links to workflow</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">url</code>
            <span className="text-gray-400">Already has WP URL!</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <code className="text-brand-gold">keywords</code>
            <span className="text-gray-400">For matching</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Golden Rules
const GoldenRules: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-brand-cyan mb-2">Golden Rules</h2>
      <p className="text-gray-400">Do not violate these. They exist because things broke.</p>
    </div>

    <div className="max-w-3xl mx-auto space-y-4">
      {/* Rule 1 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-red-500">
        <div className="flex items-start gap-4">
          <div className="bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">1</div>
          <div>
            <h3 className="text-lg font-bold text-red-400">NEVER overwrite generated_images with empty array</h3>
            <p className="text-gray-300 mt-2 text-sm">
              Before any UPDATE on articles table, check if there are existing images.
              Look for <code className="bg-slate-900 px-1 rounded">shouldUpdateImages</code> pattern in elementor.js
            </p>
          </div>
        </div>
      </div>

      {/* Rule 2 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-brand-gold">
        <div className="flex items-start gap-4">
          <div className="bg-brand-gold text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold">2</div>
          <div>
            <h3 className="text-lg font-bold text-brand-gold">Step order for Push All: Images → Page → Meta</h3>
            <p className="text-gray-300 mt-2 text-sm">
              If you create the page before uploading images, the images won't be on the page.
              The page must be created AFTER images are uploaded so it can use wpMediaUrl.
            </p>
          </div>
        </div>
      </div>

      {/* Rule 3 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-brand-cyan">
        <div className="flex items-start gap-4">
          <div className="bg-brand-cyan text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold">3</div>
          <div>
            <h3 className="text-lg font-bold text-brand-cyan">smart_matching_mode is the source of truth for bank/live fallback</h3>
            <p className="text-gray-300 mt-2 text-sm">
              Do NOT read a separate <code className="bg-slate-900 px-1 rounded">fallback_to_live</code> field.
              Derive it: <code className="bg-slate-900 px-1 rounded">bank_first</code> = fallback true, <code className="bg-slate-900 px-1 rounded">bank_only</code> = fallback false.
            </p>
          </div>
        </div>
      </div>

      {/* Rule 4 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-green-500">
        <div className="flex items-start gap-4">
          <div className="bg-green-500 text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold">4</div>
          <div>
            <h3 className="text-lg font-bold text-green-500">website.seo_plugin is the source of truth for SEO plugin</h3>
            <p className="text-gray-300 mt-2 text-sm">
              Always pass the correct plugin to push-direct endpoint. Don't default to 'aioseo'.
              User might use Rank Math, Yoast, or others.
            </p>
          </div>
        </div>
      </div>

      {/* Rule 5 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-purple-500">
        <div className="flex items-start gap-4">
          <div className="bg-purple-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">5</div>
          <div>
            <h3 className="text-lg font-bold text-purple-400">Always preserve selected_meta_title/description</h3>
            <p className="text-gray-300 mt-2 text-sm">
              When refreshing article data, check if the article already has saved meta.
              Don't reset <code className="bg-slate-900 px-1 rounded">metaSaved</code> state to false if there's saved data.
            </p>
          </div>
        </div>
      </div>

      {/* Rule 6 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-yellow-500">
        <div className="flex items-start gap-4">
          <div className="bg-yellow-500 text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold">6</div>
          <div>
            <h3 className="text-lg font-bold text-yellow-500">Test the full flow before saying something is fixed</h3>
            <p className="text-gray-300 mt-2 text-sm">
              Unit testing a single function is not enough. Test the complete flow:
              Run workflow → Check images in preview → Push All to WP → Check images ON WordPress page.
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* File Reference */}
    <div className="max-w-3xl mx-auto mt-8 bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">Key Files Reference</h3>
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <h4 className="font-semibold text-brand-gold mb-2">Frontend</h4>
          <ul className="space-y-1 text-gray-300">
            <li><code className="text-xs">src/components/articles/ArticleListView.tsx</code></li>
            <li><code className="text-xs">src/components/ImageCreationSection.tsx</code></li>
            <li><code className="text-xs">src/components/WebsitesPage.tsx</code></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-brand-gold mb-2">Backend</h4>
          <ul className="space-y-1 text-gray-300">
            <li><code className="text-xs">server/routes/elementor.js</code></li>
            <li><code className="text-xs">server/routes/articles.js</code></li>
            <li><code className="text-xs">server/routes/seo.js</code></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
);

export default BlueprintPage;
