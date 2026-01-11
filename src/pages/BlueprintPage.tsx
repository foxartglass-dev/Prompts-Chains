import React, { useState, useEffect, useRef, useCallback } from 'react';

interface BlueprintPageProps {
  isOpen: boolean;
  onClose: () => void;
}

type BlueprintTab = 'start-here' | 'image-flow' | 'push-all' | 'individual-buttons' | 'data-sources' | 'golden-rules' | 'known-issues' | 'drip-feed' | 'notes' | 'agent-template';

const BlueprintPage: React.FC<BlueprintPageProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<BlueprintTab>('start-here');

  if (!isOpen) return null;

  const tabs: { id: BlueprintTab; label: string }[] = [
    { id: 'start-here', label: 'Start Here' },
    { id: 'image-flow', label: 'Image Flow' },
    { id: 'push-all', label: 'Push All to WP' },
    { id: 'individual-buttons', label: 'Individual Buttons' },
    { id: 'data-sources', label: 'Data Sources' },
    { id: 'golden-rules', label: 'Golden Rules' },
    { id: 'known-issues', label: 'Known Issues' },
    { id: 'drip-feed', label: 'Drip Feed' },
    { id: 'notes', label: 'Notes' },
    { id: 'agent-template', label: 'Agent Template' },
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
          {activeTab === 'start-here' && <NewAgentStartHere />}
          {activeTab === 'image-flow' && <ImageFlowDiagram />}
          {activeTab === 'push-all' && <PushAllDiagram />}
          {activeTab === 'individual-buttons' && <IndividualButtonsDiagram />}
          {activeTab === 'data-sources' && <DataSourcesDiagram />}
          {activeTab === 'golden-rules' && <GoldenRules />}
          {activeTab === 'known-issues' && <KnownIssuesDiagram />}
          {activeTab === 'drip-feed' && <DripFeedDiagram />}
          {activeTab === 'notes' && <NotesEditor />}
          {activeTab === 'agent-template' && <AgentTemplate />}
        </main>
      </div>
    </div>
  );
};

// New Agent Start Here - First tab, onboarding for AI agents
const NewAgentStartHere: React.FC = () => (
  <div className="space-y-6 max-w-4xl mx-auto">
    <div className="text-center mb-8">
      <h2 className="text-3xl font-bold text-brand-gold mb-2">New Agent? Start Here!</h2>
      <p className="text-gray-400 text-lg">Welcome to PromptFlow - SEO Page Factory. Follow this warm-up sequence before doing any work.</p>
    </div>

    {/* Important Notice - Documentation Expectation */}
    <div className="bg-purple-900/30 rounded-xl p-6 border-2 border-purple-500">
      <div className="flex items-start gap-4">
        <div className="text-3xl">📝</div>
        <div>
          <h3 className="text-lg font-bold text-purple-400 mb-2">You Will Be Documenting Your Work</h3>
          <p className="text-gray-300 mb-3">
            As you work, pay close attention to mechanisms you build or discover.
            <strong className="text-white"> When you complete a feature or fix</strong> (especially before shifting to something different),
            you'll add it to this Blueprint.
          </p>
          <div className="bg-slate-900 rounded-lg p-3 text-sm space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-purple-400">→</span>
              <span className="text-gray-300"><strong>Document when you COMPLETE a feature</strong>, not just at session end</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-400">→</span>
              <span className="text-gray-300">Details are fresh in your mind right after building something</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-400">→</span>
              <span className="text-gray-300">See the <strong>Agent Template</strong> tab for what to document</span>
            </div>
          </div>
          <p className="text-xs text-purple-300 mt-3">
            This Blueprint is how future agents (and the user) understand the system. Your documentation matters.
          </p>
        </div>
      </div>
    </div>

    {/* Step 1 */}
    <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-brand-cyan">
      <div className="flex items-center gap-4 mb-4">
        <div className="bg-brand-cyan text-slate-900 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl">1</div>
        <h3 className="text-xl font-bold text-brand-cyan">Read CLAUDE.md</h3>
      </div>
      <div className="ml-16 space-y-3">
        <p className="text-gray-300">This gives you critical rules and current state of the project.</p>
        <code className="block bg-slate-900 rounded-lg p-3 text-sm text-gray-300">
          Read /home/user/Prompts-Chains/CLAUDE.md
        </code>
        <div className="text-sm text-gray-400">
          Pay attention to: Critical Rules, Current State, Key Files
        </div>
      </div>
    </div>

    {/* Step 2 */}
    <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-brand-gold">
      <div className="flex items-center gap-4 mb-4">
        <div className="bg-brand-gold text-slate-900 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl">2</div>
        <h3 className="text-xl font-bold text-brand-gold">Explore Blueprint Tabs</h3>
      </div>
      <div className="ml-16 space-y-4">
        <p className="text-gray-300">Go through each of these tabs in order to understand the system:</p>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-slate-900 rounded-lg p-3 border border-brand-cyan/30">
            <span className="text-brand-cyan font-semibold">Image Flow</span>
            <p className="text-xs text-gray-400 mt-1">How images move: Replicate → WordPress Media → Elementor</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3 border border-brand-cyan/30">
            <span className="text-brand-cyan font-semibold">Push All to WP</span>
            <p className="text-xs text-gray-400 mt-1">The complete WordPress publishing mechanism</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3 border border-brand-cyan/30">
            <span className="text-brand-cyan font-semibold">Individual Buttons</span>
            <p className="text-xs text-gray-400 mt-1">How !Article, !Meta, !Images buttons work differently</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3 border border-red-500/30">
            <span className="text-red-400 font-semibold">Known Issues</span>
            <p className="text-xs text-gray-400 mt-1">Check this BEFORE investigating "weird" behavior</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3 border border-brand-cyan/30">
            <span className="text-brand-cyan font-semibold">Golden Rules</span>
            <p className="text-xs text-gray-400 mt-1">Rules that exist because things broke before</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3 border border-yellow-500/30">
            <span className="text-yellow-400 font-semibold">Drip Feed</span>
            <p className="text-xs text-gray-400 mt-1">Partial implementation - know what's missing</p>
          </div>
        </div>
      </div>
    </div>

    {/* Step 3 */}
    <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-purple-500">
      <div className="flex items-center gap-4 mb-4">
        <div className="bg-purple-500 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl">3</div>
        <h3 className="text-xl font-bold text-purple-400">Check Context (If Resuming Work)</h3>
      </div>
      <div className="ml-16 space-y-3">
        <p className="text-gray-300">If the user mentions previous work or you're continuing a session:</p>
        <div className="bg-slate-900 rounded-lg p-4 space-y-2">
          <code className="block text-sm text-gray-300">git log --oneline -10  <span className="text-gray-500"># See recent commits</span></code>
          <code className="block text-sm text-gray-300">git fetch origin main && git show origin/main:logs/server-latest.log | tail -100</code>
        </div>
        <div className="text-sm text-gray-400">
          Server logs are pushed to main branch - you can access them from any branch.
        </div>
      </div>
    </div>

    {/* Step 4 */}
    <div className="bg-green-900/30 rounded-xl p-6 border-l-4 border-green-500">
      <div className="flex items-center gap-4 mb-4">
        <div className="bg-green-500 text-slate-900 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl">4</div>
        <h3 className="text-xl font-bold text-green-400">Report Back</h3>
      </div>
      <div className="ml-16 space-y-3">
        <p className="text-gray-300">After completing Steps 1-3, tell the user:</p>
        <div className="bg-slate-900 rounded-lg p-4 text-sm text-gray-300 space-y-2">
          <p>"I've completed the warm-up and reviewed the Blueprint documentation."</p>
          <p>• Mention which tabs you read (Image Flow, Known Issues, etc.)</p>
          <p>• Ask what task they'd like you to work on</p>
        </div>
      </div>
    </div>

    {/* Key Mechanisms Quick Reference */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30 mt-8">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">Key Mechanisms Quick Reference</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-brand-gold mb-2">WordPress Publishing</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• <strong>Order matters:</strong> Images → Page → Meta</li>
            <li>• <strong>Elementor quirk:</strong> Can't update _elementor_data via REST</li>
            <li>• <strong>Images button:</strong> Deletes page → Recreates with same slug</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-brand-gold mb-2">State Management</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• <code className="bg-slate-900 px-1 rounded text-xs">articles.generated_images</code> → source of truth</li>
            <li>• <code className="bg-slate-900 px-1 rounded text-xs">website.seo_plugin</code> → which SEO plugin</li>
            <li>• Never overwrite images on UPDATE</li>
          </ul>
        </div>
      </div>
    </div>

    {/* Key Files */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">Key Files Reference</h3>
      <div className="grid md:grid-cols-2 gap-2 text-sm">
        <div className="flex justify-between py-1 border-b border-slate-700">
          <span className="text-gray-400">Publishing logic</span>
          <code className="text-brand-gold">server/routes/elementor.js</code>
        </div>
        <div className="flex justify-between py-1 border-b border-slate-700">
          <span className="text-gray-400">Individual buttons</span>
          <code className="text-brand-gold">server/routes/articles.js</code>
        </div>
        <div className="flex justify-between py-1 border-b border-slate-700">
          <span className="text-gray-400">Article UI</span>
          <code className="text-brand-gold">src/components/articles/ArticleListView.tsx</code>
        </div>
        <div className="flex justify-between py-1 border-b border-slate-700">
          <span className="text-gray-400">SEO meta push</span>
          <code className="text-brand-gold">server/routes/seo.js</code>
        </div>
        <div className="flex justify-between py-1 border-b border-slate-700">
          <span className="text-gray-400">Elementor builder</span>
          <code className="text-brand-gold">server/services/elementor-builder.js</code>
        </div>
        <div className="flex justify-between py-1 border-b border-slate-700">
          <span className="text-gray-400">This Blueprint</span>
          <code className="text-brand-gold">src/pages/BlueprintPage.tsx</code>
        </div>
      </div>
    </div>

    {/* Before Making Changes */}
    <div className="bg-red-900/20 rounded-xl p-6 border border-red-500">
      <h3 className="text-lg font-bold text-red-400 mb-4">Before Making Changes</h3>
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-green-400">✓</span>
            <span className="text-gray-300">Read the relevant Blueprint tab first</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-400">✓</span>
            <span className="text-gray-300">Check Known Issues tab</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-400">✓</span>
            <span className="text-gray-300">Explain your approach BEFORE implementing</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-red-400">✗</span>
            <span className="text-gray-300">Don't over-engineer or refactor surrounding code</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-red-400">✗</span>
            <span className="text-gray-300">Don't assume - check the code first</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-red-400">✗</span>
            <span className="text-gray-300">Don't skip reading Blueprint tabs</span>
          </div>
        </div>
      </div>
    </div>

    {/* Documentation Timing */}
    <div className="bg-purple-900/20 rounded-xl p-6 border border-purple-500">
      <h3 className="text-lg font-bold text-purple-400 mb-3">When to Document in Blueprint</h3>
      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-3">
          <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">DO</span>
          <span className="text-gray-300">Document immediately after completing a feature/fix, while details are fresh</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">DO</span>
          <span className="text-gray-300">Document before shifting to a completely different task area</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">DON'T</span>
          <span className="text-gray-300">Wait until the very end of session when context is lost</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">DON'T</span>
          <span className="text-gray-300">Document mid-feature while still iterating (wait until it works)</span>
        </div>
      </div>
    </div>

    {/* End of Session */}
    <div className="bg-brand-cyan/10 rounded-xl p-6 border border-brand-cyan">
      <h3 className="text-lg font-bold text-brand-cyan mb-3">End of Session</h3>
      <p className="text-gray-300 mb-3">
        Run <code className="bg-slate-900 px-2 py-1 rounded">/debrief</code> command to document what you worked on.
      </p>
      <p className="text-sm text-gray-400">
        If you already documented features as you completed them (as you should), the debrief is just a final check.
        See the <strong>Agent Template</strong> tab for the full documentation template.
      </p>
    </div>
  </div>
);

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

// Individual Buttons Diagram - Article, Meta, Images buttons
const IndividualButtonsDiagram: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-brand-cyan mb-2">Individual Push Buttons</h2>
      <p className="text-gray-400">These buttons allow pushing Article, Meta, and Images independently in ANY order.</p>
    </div>

    {/* Button Overview */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-gold mb-4">Article Header Buttons (ArticleListView.tsx)</h3>
      <div className="grid md:grid-cols-3 gap-4">
        {/* Article Button */}
        <div className="bg-slate-700 rounded-lg p-4 border-2 border-blue-500">
          <div className="text-blue-500 font-bold mb-2 flex items-center gap-2">
            <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs">!Article</span>
            Article Only
          </div>
          <div className="text-sm text-gray-300 space-y-2">
            <div className="text-xs text-gray-400">Endpoint:</div>
            <code className="text-xs bg-slate-800 px-1 rounded block">POST /api/elementor/publish</code>
            <div className="text-xs text-gray-400 mt-2">Special param:</div>
            <code className="text-xs bg-slate-800 px-1 rounded block">articleOnly: true</code>
            <div className="text-xs text-green-400 mt-2">Result: Creates WP page with text only, NO images</div>
          </div>
        </div>

        {/* Meta Button */}
        <div className="bg-slate-700 rounded-lg p-4 border-2 border-purple-500">
          <div className="text-purple-500 font-bold mb-2 flex items-center gap-2">
            <span className="bg-purple-500 text-white px-2 py-1 rounded text-xs">!Meta</span>
            Meta Only
          </div>
          <div className="text-sm text-gray-300 space-y-2">
            <div className="text-xs text-gray-400">Endpoint:</div>
            <code className="text-xs bg-slate-800 px-1 rounded block">POST /api/seo/push/:articleId</code>
            <div className="text-xs text-gray-400 mt-2">Reads from:</div>
            <code className="text-xs bg-slate-800 px-1 rounded block">websites.seo_plugin</code>
            <div className="text-xs text-green-400 mt-2">Result: Pushes meta to Rank Math/Yoast/etc.</div>
          </div>
        </div>

        {/* Images Button */}
        <div className="bg-slate-700 rounded-lg p-4 border-2 border-orange-500">
          <div className="text-orange-500 font-bold mb-2 flex items-center gap-2">
            <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs">!Images</span>
            Images Only
          </div>
          <div className="text-sm text-gray-300 space-y-2">
            <div className="text-xs text-gray-400">Endpoint:</div>
            <code className="text-xs bg-slate-800 px-1 rounded block">POST /api/articles/:id/push-images</code>
            <div className="text-xs text-gray-400 mt-2">Key behavior:</div>
            <div className="text-xs text-yellow-400">RE-CREATES the WP page with images!</div>
            <div className="text-xs text-green-400 mt-2">Result: Uploads to Media Library + embeds in page</div>
          </div>
        </div>
      </div>
    </div>

    {/* Images Button Deep Dive - This is the complex one */}
    <div className="bg-orange-900/20 rounded-xl p-6 border border-orange-500">
      <h3 className="text-lg font-bold text-orange-400 mb-4">Images Button - How It Actually Works</h3>
      <p className="text-sm text-gray-400 mb-4">
        This was tricky to implement. WordPress/Elementor doesn't allow updating _elementor_data via REST API,
        so we can't just "add images" to an existing page. Instead, the button RE-CREATES the page.
      </p>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
          <div className="text-sm text-gray-300">
            <strong>Upload images</strong> to WordPress Media Library (gets wpMediaUrl + wpMediaId)
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
          <div className="text-sm text-gray-300">
            <strong>Get existing page slug</strong> from WordPress (to preserve the URL)
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</span>
          <div className="text-sm text-gray-300">
            <strong>DELETE the old page</strong> (frees up the slug)
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">4</span>
          <div className="text-sm text-gray-300">
            <strong>CREATE new page</strong> with same slug + images embedded via Elementor structure
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">5</span>
          <div className="text-sm text-gray-300">
            <strong>Update article record</strong> with new wp_post_id and wp_post_url
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-slate-800 rounded-lg text-xs">
        <strong className="text-orange-400">Key File:</strong>{' '}
        <code className="text-gray-300">server/routes/articles.js</code> - push-images endpoint (lines 423-687)
      </div>
    </div>

    {/* Article Only Mode */}
    <div className="bg-blue-900/20 rounded-xl p-6 border border-blue-500">
      <h3 className="text-lg font-bold text-blue-400 mb-4">Article Only Mode - articleOnly Parameter</h3>
      <p className="text-sm text-gray-400 mb-4">
        When you click the Article button, it needs to skip ALL image processing. This is controlled by a special flag.
      </p>

      <div className="bg-slate-800 rounded-lg p-4 font-mono text-sm">
        <div className="text-gray-400 mb-2">// In frontend (ArticleListView.tsx):</div>
        <pre className="text-brand-cyan">{`fetch('/api/elementor/publish', {
  body: JSON.stringify({
    articleOnly: true,  // <-- This skips ALL image processing
    // ... other params
  })
})`}</pre>
      </div>

      <div className="mt-4 text-sm text-gray-300">
        <strong className="text-blue-400">In elementor.js:</strong> When <code className="bg-slate-800 px-1 rounded">articleOnly: true</code>,
        these steps are skipped:
        <ul className="mt-2 ml-4 space-y-1 text-xs text-gray-400">
          <li>- Image bank selection</li>
          <li>- Live image generation</li>
          <li>- Image upload to WordPress</li>
          <li>- Image embedding in Elementor structure</li>
        </ul>
      </div>
    </div>

    {/* Status Indicators */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">Status Indicators in UI</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-brand-gold mb-2">Article Header Status Tags</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="bg-slate-700 text-gray-400 px-2 py-1 rounded text-xs">Article: Draft</span>
              <span className="text-gray-400">→ Not pushed to WP yet</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-green-700 text-white px-2 py-1 rounded text-xs">Article: WP</span>
              <span className="text-gray-400">→ Page exists on WordPress</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-slate-700 text-gray-400 px-2 py-1 rounded text-xs">Meta: Draft</span>
              <span className="text-gray-400">→ Meta not pushed yet</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-green-700 text-white px-2 py-1 rounded text-xs">Meta: WP</span>
              <span className="text-gray-400">→ Meta pushed to SEO plugin</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-slate-700 text-gray-400 px-2 py-1 rounded text-xs">Image: Draft</span>
              <span className="text-gray-400">→ Images exist but not on page</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-green-700 text-white px-2 py-1 rounded text-xs">Image: WP</span>
              <span className="text-gray-400">→ Images embedded in WP page</span>
            </div>
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-brand-gold mb-2">Button State Changes</h4>
          <div className="text-sm text-gray-300 space-y-2">
            <div>After clicking <span className="text-blue-400">!Article</span>:</div>
            <div className="text-xs text-gray-400 ml-4">→ Article: Draft becomes Article: WP</div>
            <div>After clicking <span className="text-purple-400">!Meta</span>:</div>
            <div className="text-xs text-gray-400 ml-4">→ Meta: Draft becomes Meta: WP</div>
            <div>After clicking <span className="text-orange-400">!Images</span>:</div>
            <div className="text-xs text-gray-400 ml-4">→ Image: Draft becomes Image: WP</div>
            <div className="text-xs text-yellow-400 ml-4">→ Also re-creates page (new wp_post_id)</div>
          </div>
        </div>
      </div>
    </div>

    {/* Flexibility Box */}
    <div className="bg-green-900/20 rounded-xl p-6 border border-green-500">
      <h3 className="text-lg font-bold text-green-400 mb-3">Key Insight: Order Flexibility</h3>
      <p className="text-sm text-gray-300 mb-3">
        Unlike "Push All to WP" which requires Images → Page → Meta order, the individual buttons can be used in ANY order:
      </p>
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-green-400 font-semibold mb-1">Option 1:</div>
          <div className="text-gray-400">Article → Images → Meta</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-green-400 font-semibold mb-1">Option 2:</div>
          <div className="text-gray-400">Article → Meta → Images</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-green-400 font-semibold mb-1">Option 3:</div>
          <div className="text-gray-400">Meta first (after Push All)</div>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        The Images button handles the complexity by re-creating the page with images, so order doesn't matter.
      </p>
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

// Known Issues Diagram - Bugs and potential problems
const KnownIssuesDiagram: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-brand-cyan mb-2">Known Issues & Potential Bugs</h2>
      <p className="text-gray-400">Document issues here so future agents can reference and fix them</p>
    </div>

    {/* Active Issues */}
    <div className="bg-red-900/20 rounded-xl p-6 border border-red-500">
      <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Intermittent Issue: Missing workflowId
      </h3>

      <div className="space-y-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-red-400 font-semibold mb-2">Symptom:</div>
          <div className="text-sm text-gray-300">
            "WordPress publish failed: Unknown error" - happens randomly, worked on retry without code changes
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-yellow-400 font-semibold mb-2">Root Cause:</div>
          <div className="text-sm text-gray-300">
            The <code className="bg-slate-900 px-1 rounded">workflowId</code> is not being passed to the
            <code className="bg-slate-900 px-1 rounded">/api/elementor/publish</code> endpoint.
            This prevents the image bank lookup from working.
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Log shows: <code className="bg-slate-900 px-1 rounded">[Elementor Publish] No workflowId or database not enabled</code>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-blue-400 font-semibold mb-2">Likely Cause:</div>
          <div className="text-sm text-gray-300">
            Frontend state synchronization / race condition - the workflow state might not be fully loaded
            when the user clicks "Start Workflow" or "Push All".
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-green-400 font-semibold mb-2">Potential Fix (NOT IMPLEMENTED):</div>
          <div className="text-sm text-gray-300">
            Add validation in <code className="bg-slate-900 px-1 rounded">App.tsx</code> before calling publish endpoint:
          </div>
          <pre className="mt-2 text-xs bg-slate-900 p-2 rounded text-brand-cyan">{`if (!workflowId) {
  addLog('Error: Workflow not loaded. Please try again.', LogStatus.ERROR);
  return;
}`}</pre>
          <div className="mt-2 text-xs text-yellow-400">
            Note: This fix was NOT implemented because the system is currently working and we didn't want to risk breaking it.
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-purple-400 font-semibold mb-2">Frequency:</div>
          <div className="text-sm text-gray-300">
            Rare - observed once, did not reproduce on second attempt. May be related to:
            <ul className="mt-2 ml-4 text-xs text-gray-400 space-y-1">
              <li>- Browser caching</li>
              <li>- Page not fully loaded when clicking Run</li>
              <li>- Network timing issues</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    {/* Resolved Issues */}
    <div className="bg-green-900/20 rounded-xl p-6 border border-green-500">
      <h3 className="text-lg font-bold text-green-400 mb-4">Recently Resolved Issues (Jan 2026)</h3>

      <div className="space-y-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Article button was pushing images too</span>
          </div>
          <div className="text-sm text-gray-400">
            Fix: Added <code className="bg-slate-900 px-1 rounded">articleOnly: true</code> parameter to skip all image processing
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Meta push showing "Invalid post ID"</span>
          </div>
          <div className="text-sm text-gray-400">
            Fix: Changed endpoint to try <code className="bg-slate-900 px-1 rounded">/pages/</code> first, then fallback to <code className="bg-slate-900 px-1 rounded">/posts/</code> (Elementor creates pages, not posts)
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Meta not appearing in Rank Math</span>
          </div>
          <div className="text-sm text-gray-400">
            Fix: Changed frontend to call <code className="bg-slate-900 px-1 rounded">/api/seo/push/:articleId</code> which reads <code className="bg-slate-900 px-1 rounded">seo_plugin</code> from website settings (was hardcoding Yoast fields)
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Images button not embedding images in page</span>
          </div>
          <div className="text-sm text-gray-400">
            Fix: Changed approach to RE-CREATE the page (delete old → create new with same slug) because Elementor doesn't support updating _elementor_data via REST API
          </div>
        </div>
      </div>
    </div>

    {/* Things to Watch */}
    <div className="bg-yellow-900/20 rounded-xl p-6 border border-yellow-500">
      <h3 className="text-lg font-bold text-yellow-400 mb-4">Things to Watch</h3>

      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <span className="text-yellow-400">⚠</span>
          <div className="text-gray-300">
            <strong>Images button creates new page IDs:</strong> Each time you click !Images, the wp_post_id changes.
            Old page is deleted. URL slug is preserved but internal linking by ID would break.
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-yellow-400">⚠</span>
          <div className="text-gray-300">
            <strong>Base64 images in articles.generated_images:</strong> These are temporary and large.
            After push-images, they get wpMediaUrl. But if push-images fails, base64 data remains.
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-yellow-400">⚠</span>
          <div className="text-gray-300">
            <strong>Image: Off status showing unexpectedly:</strong> If workflow image settings aren't loaded,
            the UI might show "Image: Off" even when images are enabled. Usually resolves on page refresh.
          </div>
        </div>
      </div>
    </div>

    {/* How to Debug */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">How to Debug Issues</h3>

      <div className="space-y-4 text-sm">
        <div>
          <div className="font-semibold text-brand-gold mb-2">1. Check Server Logs (GitHub)</div>
          <p className="text-gray-400 mb-2">
            Logs are pushed to the <code className="bg-slate-900 px-1 rounded">main</code> branch automatically.
            You can access them from ANY branch by fetching from main:
          </p>
          <code className="text-xs bg-slate-900 px-2 py-1 rounded block text-gray-300">
            git fetch origin main && git show origin/main:logs/server-latest.log | tail -200
          </code>
          <p className="text-xs text-yellow-400 mt-2">
            Note: Your working branch doesn't matter - always fetch from origin/main to get logs.
          </p>
        </div>

        <div>
          <div className="font-semibold text-brand-gold mb-2">2. Key Log Patterns to Search</div>
          <div className="space-y-1">
            <code className="text-xs bg-slate-900 px-2 py-1 rounded block text-gray-300">[PUBLISH] Starting publish for:</code>
            <code className="text-xs bg-slate-900 px-2 py-1 rounded block text-gray-300">[ERR] NO IMAGES</code>
            <code className="text-xs bg-slate-900 px-2 py-1 rounded block text-gray-300">No workflowId</code>
            <code className="text-xs bg-slate-900 px-2 py-1 rounded block text-gray-300">[Push Images]</code>
          </div>
        </div>

        <div>
          <div className="font-semibold text-brand-gold mb-2">3. Check Frontend Console</div>
          <div className="text-gray-400">Browser DevTools → Console → Look for fetch errors or state issues</div>
        </div>

        <div>
          <div className="font-semibold text-brand-gold mb-2">4. Log File Location</div>
          <div className="text-gray-400">
            Server pushes to: <code className="bg-slate-900 px-1 rounded">logs/server-latest.log</code> on main branch.
            Max 500 lines, auto-rotated on each publish.
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Drip Feed Diagram - Scheduled publishing feature
const DripFeedDiagram: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-brand-cyan mb-2">Drip Feed System</h2>
      <p className="text-gray-400">Scheduled publishing of articles over time</p>
    </div>

    {/* Current Status */}
    <div className="bg-yellow-900/20 rounded-xl p-6 border border-yellow-500">
      <h3 className="text-lg font-bold text-yellow-400 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Current Status: Partially Implemented
      </h3>
      <p className="text-sm text-gray-300 mb-4">
        Database tables exist, but the full UI and automation are not yet complete.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-green-400 font-semibold mb-2">What Exists:</div>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>✓ Database table: <code className="bg-slate-900 px-1 rounded text-xs">drip_feed_schedules</code></li>
            <li>✓ Backend endpoint: <code className="bg-slate-900 px-1 rounded text-xs">/api/elementor/schedule-drip-feed</code></li>
            <li>✓ WordPress scheduled posts support</li>
          </ul>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-red-400 font-semibold mb-2">What's Missing:</div>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>✗ UI to configure drip feed schedule</li>
            <li>✗ Batch scheduling from article list</li>
            <li>✗ Schedule status dashboard</li>
            <li>✗ Automatic processing of scheduled items</li>
          </ul>
        </div>
      </div>
    </div>

    {/* Database Schema */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">Database Table: drip_feed_schedules</h3>

      <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
        <pre className="text-gray-300">{`CREATE TABLE drip_feed_schedules (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER REFERENCES workflows(id),
  website_id INTEGER REFERENCES websites(id),
  article_id INTEGER REFERENCES articles(id),
  scheduled_date TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',  -- pending, published, failed
  wp_post_id INTEGER,                     -- After publish
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);`}</pre>
      </div>
    </div>

    {/* How It Should Work */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-gold/30">
      <h3 className="text-lg font-bold text-brand-gold mb-4">Intended Flow (To Be Implemented)</h3>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="bg-brand-gold text-slate-900 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
          <div className="text-sm text-gray-300">
            <strong>User selects articles</strong> from the Articles page (checkbox selection)
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="bg-brand-gold text-slate-900 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
          <div className="text-sm text-gray-300">
            <strong>User clicks "Schedule Drip Feed"</strong> and sets parameters:
            <ul className="mt-1 ml-4 text-xs text-gray-400">
              <li>- Start date</li>
              <li>- Interval (e.g., every 2 days)</li>
              <li>- Time of day to publish</li>
            </ul>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="bg-brand-gold text-slate-900 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</span>
          <div className="text-sm text-gray-300">
            <strong>System creates schedule entries</strong> in drip_feed_schedules table
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="bg-brand-gold text-slate-900 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">4</span>
          <div className="text-sm text-gray-300">
            <strong>Cron job or manual trigger</strong> processes pending schedules:
            <ul className="mt-1 ml-4 text-xs text-gray-400">
              <li>- Checks for schedules where scheduled_date {"<="} now AND status = 'pending'</li>
              <li>- Calls /api/elementor/publish with status: 'publish' (not draft)</li>
              <li>- Updates schedule status to 'published' or 'failed'</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    {/* Backend Endpoint */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">Existing Backend Endpoint</h3>

      <div className="bg-slate-900 rounded-lg p-4">
        <code className="text-brand-cyan">POST /api/elementor/schedule-drip-feed</code>
        <div className="mt-3 text-sm text-gray-300">
          <div className="font-semibold text-brand-gold mb-2">Request Body:</div>
          <pre className="text-xs bg-slate-800 p-2 rounded">{`{
  "articleIds": [1, 2, 3],
  "startDate": "2026-01-15",
  "intervalDays": 2,
  "publishTime": "09:00",
  "wpUrl": "https://site.com",
  "wpUser": "admin",
  "wpPassword": "app-password"
}`}</pre>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-400">
        <strong className="text-brand-cyan">Key File:</strong>{' '}
        <code className="text-gray-300">server/routes/elementor.js</code> - schedule-drip-feed endpoint
      </div>
    </div>

    {/* WordPress Scheduled Posts */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
      <h3 className="text-lg font-bold text-purple-400 mb-4">WordPress Scheduled Posts</h3>

      <p className="text-sm text-gray-300 mb-4">
        WordPress natively supports scheduled posts. When creating a page/post via REST API,
        you can set a future date and status 'future':
      </p>

      <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs">
        <pre className="text-gray-300">{`// In createElementorPage():
const body = {
  title: title,
  status: 'future',           // Will be published at date_gmt
  date_gmt: '2026-01-15T09:00:00',
  content: '',
  meta: elementorMeta
};`}</pre>
      </div>

      <div className="mt-4 text-xs text-gray-400">
        WordPress wp-cron will automatically publish the post at the scheduled time.
        No server-side cron needed for the actual publishing.
      </div>
    </div>

    {/* Next Steps */}
    <div className="bg-brand-cyan/10 rounded-xl p-6 border border-brand-cyan">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">To Complete Drip Feed Feature</h3>

      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <span className="text-brand-cyan font-bold">1.</span>
          <div className="text-gray-300">
            <strong>Add UI in ArticleListView.tsx:</strong> Multi-select articles + "Schedule Drip Feed" button
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-brand-cyan font-bold">2.</span>
          <div className="text-gray-300">
            <strong>Create DripFeedModal component:</strong> Date picker, interval selector, preview of schedule
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-brand-cyan font-bold">3.</span>
          <div className="text-gray-300">
            <strong>Add schedule status view:</strong> Show pending/published/failed schedules
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-brand-cyan font-bold">4.</span>
          <div className="text-gray-300">
            <strong>Test with WordPress:</strong> Verify scheduled posts appear correctly
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Notes Editor - User-editable notes with image support
const NotesEditor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaved, setIsSaved] = useState(true);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('blueprint-notes');
    const savedTime = localStorage.getItem('blueprint-notes-time');
    if (savedNotes && editorRef.current) {
      editorRef.current.innerHTML = savedNotes;
    }
    if (savedTime) {
      setLastSaved(savedTime);
    }
  }, []);

  // Save notes to localStorage
  const saveNotes = useCallback(() => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      localStorage.setItem('blueprint-notes', content);
      const now = new Date().toLocaleString();
      localStorage.setItem('blueprint-notes-time', now);
      setLastSaved(now);
      setIsSaved(true);
    }
  }, []);

  // Handle content changes
  const handleInput = useCallback(() => {
    setIsSaved(false);
  }, []);

  // Handle paste (including images)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target?.result as string;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.margin = '10px 0';
            img.style.borderRadius = '8px';
            img.style.border = '1px solid #334155';

            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              range.insertNode(img);
              range.collapse(false);
            } else if (editorRef.current) {
              editorRef.current.appendChild(img);
            }
            setIsSaved(false);
          };
          reader.readAsDataURL(blob);
        }
        return;
      }
    }
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.src = event.target?.result as string;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.margin = '10px 0';
        img.style.borderRadius = '8px';
        img.style.border = '1px solid #334155';

        if (editorRef.current) {
          editorRef.current.appendChild(img);
          editorRef.current.appendChild(document.createElement('br'));
        }
        setIsSaved(false);
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Formatting commands
  const formatText = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    setIsSaved(false);
  }, []);

  // Insert bullet list
  const insertBulletList = useCallback(() => {
    formatText('insertUnorderedList');
  }, [formatText]);

  // Insert numbered list
  const insertNumberedList = useCallback(() => {
    formatText('insertOrderedList');
  }, [formatText]);

  // Clear all notes
  const clearNotes = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all notes? This cannot be undone.')) {
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      localStorage.removeItem('blueprint-notes');
      localStorage.removeItem('blueprint-notes-time');
      setLastSaved(null);
      setIsSaved(true);
    }
  }, []);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-brand-cyan mb-2">Notes</h2>
        <p className="text-gray-400">Add your own notes, diagrams, and images. Paste images directly or upload them.</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <button
          onClick={() => formatText('bold')}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm font-bold text-white"
          title="Bold"
        >
          B
        </button>
        <button
          onClick={() => formatText('italic')}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm italic text-white"
          title="Italic"
        >
          I
        </button>
        <button
          onClick={() => formatText('underline')}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm underline text-white"
          title="Underline"
        >
          U
        </button>
        <div className="w-px h-6 bg-slate-600 mx-1" />
        <button
          onClick={insertBulletList}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white"
          title="Bullet List"
        >
          • List
        </button>
        <button
          onClick={insertNumberedList}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white"
          title="Numbered List"
        >
          1. List
        </button>
        <div className="w-px h-6 bg-slate-600 mx-1" />
        <button
          onClick={() => formatText('formatBlock', 'h2')}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white font-semibold"
          title="Heading"
        >
          H2
        </button>
        <button
          onClick={() => formatText('formatBlock', 'h3')}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white"
          title="Subheading"
        >
          H3
        </button>
        <div className="w-px h-6 bg-slate-600 mx-1" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-brand-cyan/50 rounded text-sm text-brand-cyan"
          title="Upload Image"
        >
          + Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <div className="flex-1" />
        <button
          onClick={clearNotes}
          className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-500/50 rounded text-sm text-red-400"
          title="Clear All Notes"
        >
          Clear All
        </button>
        <button
          onClick={saveNotes}
          className={`px-4 py-1.5 rounded text-sm font-semibold ${
            isSaved
              ? 'bg-green-700 text-white'
              : 'bg-brand-gold text-slate-900 hover:bg-brand-gold/80'
          }`}
        >
          {isSaved ? 'Saved' : 'Save'}
        </button>
      </div>

      {/* Last saved indicator */}
      {lastSaved && (
        <div className="text-xs text-gray-500 text-right">
          Last saved: {lastSaved}
        </div>
      )}

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        className="flex-1 bg-slate-800/30 rounded-xl p-6 border border-slate-700 overflow-auto min-h-[400px] text-gray-200 focus:outline-none focus:border-brand-cyan/50 prose prose-invert max-w-none"
        style={{
          lineHeight: '1.6',
        }}
        suppressContentEditableWarning
      >
        <p className="text-gray-500 italic">Start typing your notes here... You can paste images directly (Ctrl+V) or use the + Image button.</p>
      </div>

      {/* Tips */}
      <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700 text-sm text-gray-400">
        <strong className="text-brand-cyan">Tips:</strong>
        <ul className="mt-2 space-y-1 ml-4">
          <li>• Paste images directly from clipboard (screenshots, diagrams)</li>
          <li>• Use the toolbar for formatting (bold, lists, headings)</li>
          <li>• Click Save to persist your notes (stored in browser localStorage)</li>
          <li>• Notes are stored locally in your browser - they won't sync across devices</li>
        </ul>
      </div>
    </div>
  );
};

// Agent Template - Instructions for documenting work
const AgentTemplate: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-brand-cyan mb-2">Agent Session Template</h2>
      <p className="text-gray-400">Before ending your session, document your work using this template</p>
    </div>

    {/* Big instruction box */}
    <div className="bg-red-900/30 rounded-xl p-6 border border-red-500 max-w-4xl mx-auto">
      <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        ATTENTION AI AGENT
      </h3>
      <p className="text-gray-300">
        You are about to end your session. Before you do, please add your changes to this Blueprint.
        The next agent will not have your context. Document everything important.
      </p>
    </div>

    {/* Template sections */}
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Section 1 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
        <h3 className="text-lg font-bold text-brand-cyan mb-4">1. What Did You Change?</h3>
        <div className="space-y-3 text-sm text-gray-300">
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-brand-gold font-semibold mb-2">Files Modified:</div>
            <code className="text-gray-400">- path/to/file.tsx (brief description)</code>
          </div>
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-brand-gold font-semibold mb-2">Files Created:</div>
            <code className="text-gray-400">- path/to/new/file.tsx (what it does)</code>
          </div>
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-brand-gold font-semibold mb-2">Files Deleted:</div>
            <code className="text-gray-400">- path/to/removed/file.tsx (why removed)</code>
          </div>
        </div>
      </div>

      {/* Section 2 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-gold/30">
        <h3 className="text-lg font-bold text-brand-gold mb-4">2. What Was The Bug/Feature?</h3>
        <div className="space-y-3 text-sm">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-red-400 font-semibold mb-2">Problem:</div>
              <div className="text-gray-400">What was broken or missing? (1-2 sentences)</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-yellow-400 font-semibold mb-2">Root Cause:</div>
              <div className="text-gray-400">Why was it happening? What was the actual issue?</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-green-400 font-semibold mb-2">Solution:</div>
              <div className="text-gray-400">How did you fix it? Be specific.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-lg font-bold text-purple-400 mb-4">3. Data Flow Changes</h3>
        <p className="text-sm text-gray-400 mb-4">If you changed how data moves through the system:</p>
        <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm">
          <div className="text-red-400 mb-2">BEFORE:</div>
          <div className="text-gray-400 mb-4">[Component] → [API] → [Database]</div>
          <div className="text-green-400 mb-2">AFTER:</div>
          <div className="text-gray-400">[Component] → [New Step] → [API] → [Database]</div>
        </div>
      </div>

      {/* Section 4 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
        <h3 className="text-lg font-bold text-brand-cyan mb-4">4. Critical Relationships Discovered</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-brand-gold font-semibold mb-2">Source of Truth:</div>
            <code className="text-gray-400 text-xs">field_name comes from table_name</code>
          </div>
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-brand-gold font-semibold mb-2">Order Dependencies:</div>
            <code className="text-gray-400 text-xs">Step A must happen before Step B</code>
          </div>
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-brand-gold font-semibold mb-2">Conditional Logic:</div>
            <code className="text-gray-400 text-xs">When X, then Y happens</code>
          </div>
        </div>
      </div>

      {/* Section 5 - Critical */}
      <div className="bg-red-900/20 rounded-xl p-6 border-2 border-red-500">
        <h3 className="text-lg font-bold text-red-400 mb-4">5. What Could Break This? (CRITICAL)</h3>
        <p className="text-sm text-gray-400 mb-4">Future agents NEED to know what NOT to do:</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-red-400 font-semibold mb-2">DO NOT:</div>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>- Don't do X because it causes Y</li>
              <li>- Don't change Z without updating W</li>
              <li>- Don't assume A about B</li>
            </ul>
          </div>
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-green-400 font-semibold mb-2">MUST ALWAYS:</div>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>- Always do A before B</li>
              <li>- Always check C when doing D</li>
              <li>- Always preserve E when updating F</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Section 6 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-green-500/30">
        <h3 className="text-lg font-bold text-green-400 mb-4">6. How To Test This</h3>
        <div className="bg-slate-900 rounded-lg p-4 text-sm">
          <ol className="text-gray-300 space-y-2">
            <li><span className="text-brand-cyan">1.</span> Do X in the UI</li>
            <li><span className="text-brand-cyan">2.</span> Check Y in the database/response</li>
            <li><span className="text-brand-cyan">3.</span> Expected result: Z should happen</li>
            <li><span className="text-brand-cyan">4.</span> Verify on WordPress: W should appear</li>
          </ol>
        </div>
      </div>

      {/* Section 7 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-yellow-500/30">
        <h3 className="text-lg font-bold text-yellow-400 mb-4">7. Unfinished Business</h3>
        <p className="text-sm text-gray-400 mb-4">Anything you noticed but didn't fix?</p>
        <div className="bg-slate-900 rounded-lg p-4 text-sm text-gray-300 space-y-2">
          <div><span className="text-yellow-400">TODO:</span> Description of what still needs work</div>
          <div><span className="text-red-400">WARNING:</span> Potential issue in related area</div>
          <div><span className="text-blue-400">IDEA:</span> Improvement that could be made later</div>
        </div>
      </div>

      {/* Where to add */}
      <div className="bg-brand-cyan/10 rounded-xl p-6 border border-brand-cyan">
        <h3 className="text-lg font-bold text-brand-cyan mb-4">Where To Add Your Documentation</h3>
        <div className="text-sm text-gray-300 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-brand-cyan font-bold">1.</span>
            <div>
              <strong className="text-white">If it's a data flow change:</strong> Add to the "Image Flow" or "Push All to WP" tabs
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-brand-cyan font-bold">2.</span>
            <div>
              <strong className="text-white">If you discovered a source of truth:</strong> Add to "Data Sources" tab
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-brand-cyan font-bold">3.</span>
            <div>
              <strong className="text-white">If something can easily break:</strong> Add to "Golden Rules" tab
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-brand-cyan font-bold">4.</span>
            <div>
              <strong className="text-white">Edit this file:</strong> <code className="bg-slate-900 px-2 py-1 rounded">src/pages/BlueprintPage.tsx</code>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
);

export default BlueprintPage;
