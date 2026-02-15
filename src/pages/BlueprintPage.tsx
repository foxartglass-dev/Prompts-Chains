import React, { useState, useEffect, useRef, useCallback } from 'react';

interface BlueprintPageProps {
  isOpen: boolean;
  onClose: () => void;
}

type BlueprintTab = 'start-here' | 'image-flow' | 'image-recycle' | 'push-all' | 'individual-buttons' | 'data-sources' | 'golden-rules' | 'known-issues' | 'drip-feed' | 'changelog' | 'notes' | 'agent-template' | 'system-archaeology';

const BlueprintPage: React.FC<BlueprintPageProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<BlueprintTab>('start-here');

  if (!isOpen) return null;

  const tabs: { id: BlueprintTab; label: string }[] = [
    { id: 'start-here', label: 'Start Here' },
    { id: 'image-flow', label: 'Image Flow' },
    { id: 'image-recycle', label: 'Image Recycle' },
    { id: 'push-all', label: 'Push All to WP' },
    { id: 'individual-buttons', label: 'Individual Buttons' },
    { id: 'data-sources', label: 'Data Sources' },
    { id: 'golden-rules', label: 'Golden Rules' },
    { id: 'known-issues', label: 'Known Issues' },
    { id: 'drip-feed', label: 'Drip Feed' },
    { id: 'changelog', label: 'Changelog' },
    { id: 'notes', label: 'Notes' },
    { id: 'agent-template', label: 'Agent Template' },
    { id: 'system-archaeology', label: '🏗️ System Archaeology' },
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
            <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-800 rounded-lg p-0.5 sm:p-1 overflow-x-auto max-w-[60vw] sm:max-w-none">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
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
          {activeTab === 'image-recycle' && <ImageRecycleDiagram />}
          {activeTab === 'push-all' && <PushAllDiagram />}
          {activeTab === 'individual-buttons' && <IndividualButtonsDiagram />}
          {activeTab === 'data-sources' && <DataSourcesDiagram />}
          {activeTab === 'golden-rules' && <GoldenRules />}
          {activeTab === 'known-issues' && <KnownIssuesDiagram />}
          {activeTab === 'drip-feed' && <DripFeedDiagram />}
          {activeTab === 'changelog' && <ChangelogDiagram />}
          {activeTab === 'notes' && <NotesEditor />}
          {activeTab === 'agent-template' && <AgentTemplate />}
          {activeTab === 'system-archaeology' && <SystemArchaeology />}
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
      <h2 className="text-2xl font-bold text-brand-cyan mb-2">Image Pipeline Architecture</h2>
      <p className="text-gray-400">The complete image flow - verified against source code Jan 2025</p>
    </div>

    {/* Main Flow Diagram */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <div className="flex flex-col items-center gap-4">

        {/* Two Sources Box */}
        <div className="flex gap-8 justify-center flex-wrap">
          {/* Image Bank Source */}
          <div className="bg-slate-700 rounded-lg p-4 border-2 border-brand-gold w-72 text-center">
            <div className="text-brand-gold font-bold mb-2">IMAGE BANK (Pre-made)</div>
            <div className="text-sm text-gray-300 space-y-1">
              <div>- Already have WordPress URLs</div>
              <div>- Tagged by avatar (H, J, C)</div>
              <div className="text-xs text-gray-400">Stored in: <code className="bg-slate-800 px-1 rounded">image_bank_items</code></div>
              <div className="text-xs text-gray-400">Has: url, wp_url, wp_media_id, avatar_tag</div>
            </div>
          </div>

          {/* Generate Live Source */}
          <div className="bg-slate-700 rounded-lg p-4 border-2 border-brand-cyan w-72 text-center">
            <div className="text-brand-cyan font-bold mb-2">GENERATE LIVE (On-demand)</div>
            <div className="text-sm text-gray-300 space-y-1">
              <div>- AI generates base64 first</div>
              <div>- Needs upload to get wpMediaUrl</div>
              <div className="text-xs text-gray-400">Uses OpenAI/Flux models</div>
              <div className="text-xs text-gray-400">Returns BASE64 data URLs initially</div>
            </div>
          </div>
        </div>

        {/* Arrow Down */}
        <div className="text-4xl text-brand-cyan animate-pulse">↓</div>

        {/* TOP-LEVEL: integration_mode Decision */}
        <div className="bg-purple-900/30 rounded-lg p-4 border-2 border-purple-500 w-full max-w-2xl">
          <div className="text-purple-400 font-bold mb-2 text-center">LEVEL 1: integration_mode (Top-Level Decision)</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-800 p-3 rounded border border-purple-500/50">
              <code className="text-purple-400">'bank'</code> <span className="text-gray-500 text-xs">(default)</span>
              <div className="text-gray-300 mt-1">Pull from Image Bank</div>
              <div className="text-brand-cyan text-xs mt-1">→ Then check smart_matching_mode for fallback</div>
            </div>
            <div className="bg-slate-800 p-3 rounded border border-purple-500/50">
              <code className="text-purple-400">'live'</code>
              <div className="text-gray-300 mt-1">Generate Live (skip bank entirely)</div>
              <div className="text-brand-cyan text-xs mt-1">→ Always creates new images with AI</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-purple-300 text-center">
            Code: <code className="bg-slate-800 px-1 rounded">elementor.js:520</code> - <code className="bg-slate-800 px-1 rounded">config.integration_mode || 'bank'</code>
          </div>
        </div>

        {/* Arrow Down */}
        <div className="text-4xl text-brand-cyan animate-pulse">↓</div>

        {/* LEVEL 2: smart_matching_mode (only when integration_mode='bank') */}
        <div className="bg-red-900/30 rounded-lg p-4 border-2 border-red-500 w-full max-w-2xl">
          <div className="text-red-400 font-bold mb-2 text-center">LEVEL 2: smart_matching_mode (Bank Fallback Behavior)</div>
          <div className="text-xs text-gray-400 text-center mb-3">Only applies when integration_mode = 'bank'</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-800 p-3 rounded border border-green-500/50">
              <code className="text-brand-gold">'bank_first'</code> <span className="text-gray-500 text-xs">(default)</span>
              <div className="text-gray-300 mt-1">Use bank, generate if empty</div>
              <div className="text-green-400 text-xs">fallbackToLive = TRUE</div>
            </div>
            <div className="bg-slate-800 p-3 rounded border border-red-500/50">
              <code className="text-brand-gold">'bank_only'</code>
              <div className="text-gray-300 mt-1">Only use bank, never generate</div>
              <div className="text-red-400 text-xs">fallbackToLive = FALSE</div>
            </div>
            <div className="bg-slate-800 p-3 rounded border border-yellow-500/30 opacity-70">
              <code className="text-brand-gold">'generate_first'</code>
              <div className="text-gray-300 mt-1">Generate first, bank as backup</div>
              <div className="text-yellow-400 text-xs">Uses legacy fallback_to_live</div>
            </div>
            <div className="bg-slate-800 p-3 rounded border border-yellow-500/30 opacity-70">
              <code className="text-brand-gold">'generate_only'</code>
              <div className="text-gray-300 mt-1">Only generate, never use bank</div>
              <div className="text-yellow-400 text-xs">Uses legacy fallback_to_live</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-red-300 text-center">
            Code: <code className="bg-slate-800 px-1 rounded">elementor.js:521-528</code> - Only bank_first/bank_only explicitly handled
          </div>
        </div>

        {/* Arrow Down */}
        <div className="text-4xl text-brand-cyan animate-pulse">↓</div>

        {/* Two Destinations */}
        <div className="flex gap-8 justify-center flex-wrap">
          {/* Draft Mode */}
          <div className="bg-slate-700 rounded-lg p-4 border-2 border-yellow-500 w-72 text-center">
            <div className="text-yellow-500 font-bold mb-2">DRAFT MODE</div>
            <div className="text-sm text-gray-300 space-y-1">
              <div><code className="bg-slate-800 px-1 rounded text-xs">imageDraftMode: true</code></div>
              <div className="text-xs text-gray-400 mt-2">Images go to:</div>
              <div className="text-xs text-brand-cyan">→ Uploaded to STAGING WP first</div>
              <div className="text-xs text-brand-cyan">→ articles.generated_images (WP URLs)</div>
              <div className="text-xs text-brand-cyan">→ Also to Draft Image Bank</div>
              <div className="text-xs text-green-400 mt-2">Stores WP URLs (~100 bytes)</div>
              <div className="text-xs text-green-400">wpMediaId preserved for final push</div>
            </div>
          </div>

          {/* WordPress Mode */}
          <div className="bg-slate-700 rounded-lg p-4 border-2 border-green-500 w-72 text-center">
            <div className="text-green-500 font-bold mb-2">WORDPRESS MODE</div>
            <div className="text-sm text-gray-300 space-y-1">
              <div><code className="bg-slate-800 px-1 rounded text-xs">imageDraftMode: false</code></div>
              <div className="text-xs text-gray-400 mt-2">Images go to:</div>
              <div className="text-xs text-brand-cyan">→ Embedded in Elementor page</div>
              <div className="text-xs text-brand-cyan">→ Page created immediately</div>
              <div className="text-xs text-red-400 mt-2">Requires wpMediaUrl!</div>
              <div className="text-xs text-gray-500">(Images without wpUrl skipped)</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Image Filtering Logic */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-gold mb-4">Image Filtering Logic</h3>
      <div className="text-xs text-gray-400 mb-4">Location: <code className="bg-slate-900 px-1 rounded">server/routes/elementor.js</code> (Lines 681-957)</div>

      <div className="space-y-3 text-sm">
        <div className="bg-slate-900 p-3 rounded">
          <span className="text-brand-cyan font-bold">1.</span> <span className="text-gray-300">Extract article tag from keyword:</span>
          <code className="bg-slate-800 px-2 py-1 rounded ml-2 text-brand-gold">"Standard Cleaning(H)" → "H"</code>
          <div className="text-xs text-gray-500 mt-1">Line 682: <code>keyword?.match(/\(([A-Z])\)/i)</code></div>
        </div>

        <div className="bg-slate-900 p-3 rounded">
          <span className="text-brand-cyan font-bold">2.</span> <span className="text-gray-300">Filter by avatar tag match (if article has tag, image must too)</span>
          <div className="text-xs text-gray-500 mt-1">Line 710-714: <code>img.avatarTag === articleTag</code></div>
        </div>

        <div className="bg-slate-900 p-3 rounded">
          <span className="text-brand-cyan font-bold">3.</span> <span className="text-gray-300">Skip already-used images</span>
          <div className="text-xs text-gray-500 mt-1">Line 700-701: <code>if (img.used) return false</code></div>
        </div>

        <div className="bg-slate-900 p-3 rounded">
          <span className="text-brand-cyan font-bold">4.</span> <span className="text-gray-300">Smart content matching:</span>
          <div className="ml-4 mt-2 space-y-1">
            <div className="text-brand-gold">- PRIMARY keywords = <span className="text-green-400">10 points</span> <span className="text-xs text-gray-500">(line 875)</span></div>
            <div className="text-brand-gold">- SECONDARY keywords = <span className="text-yellow-400">1 point</span> <span className="text-xs text-gray-500">(line 904)</span></div>
            <div className="text-red-400">- Never duplicate PRIMARY keywords on same page <span className="text-xs text-gray-500">(line 946)</span></div>
            <div className="text-purple-400">- Disambiguation: "sink" → check if "Kitchen" or "Bathroom" in article <span className="text-xs text-gray-500">(line 869-880)</span></div>
          </div>
        </div>

        <div className="bg-slate-900 p-3 rounded">
          <span className="text-brand-cyan font-bold">5.</span> <span className="text-gray-300">Plural form matching (enabled by default)</span>
          <div className="text-xs text-gray-500 mt-1">Lines 751-772: "counter" matches "counters", "city" matches "cities"</div>
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

    {/* Image Decision Report (Source Tracking) */}
    <div className="bg-teal-900/20 rounded-xl p-6 border border-teal-500">
      <h3 className="text-lg font-bold text-teal-400 mb-4">imageDecisionReport (Source Tracking)</h3>
      <div className="text-xs text-gray-400 mb-4">Added: Jan 20, 2026 | Stored in: <code className="bg-slate-900 px-1 rounded">articles.image_decision_report</code> (JSONB)</div>

      <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto mb-4">
        <pre className="text-gray-300">{`{
  "sourceMode": "bank" | "bank_fallback" | "live",  // WHERE images came from
  "promptMode": "main_prompt" | "guided_gpt" | "smart_prompt" | null,  // WHICH prompt was used
  "sourceSummary": "Bank → Main Prompt",  // Human-readable summary
  "imageCount": 5,
  "imagesUsed": ["img-1234-hero", ...],
  "fallbackReason": "Bank empty - no H-tagged images"  // Only if fallback occurred
}`}</pre>
      </div>

      <div className="space-y-3 text-sm">
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-teal-400 font-semibold mb-2">sourceMode Values:</div>
          <div className="space-y-1 text-gray-300 text-xs">
            <div><code className="text-brand-gold">'bank'</code> - All images from Image Bank (no live generation)</div>
            <div><code className="text-amber-400">'bank_fallback'</code> - Started with bank but fell back to live generation</div>
            <div><code className="text-brand-cyan">'live'</code> - Direct live generation (bank not used)</div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-teal-400 font-semibold mb-2">promptMode Values (when generating live):</div>
          <div className="space-y-1 text-gray-300 text-xs">
            <div><code className="text-brand-gold">'main_prompt'</code> - Avatar's mainPrompt with placeholder substitution</div>
            <div><code className="text-purple-400">'guided_gpt'</code> - AI assistant generated the prompt</div>
            <div><code className="text-brand-cyan">'smart_prompt'</code> - Automatic prompt selection</div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-teal-400 font-semibold mb-2">UI Display:</div>
          <div className="space-y-1 text-gray-300 text-xs">
            <div><strong>Article Library:</strong> "Source" column with color-coded badge</div>
            <div><strong>Article Detail:</strong> Source badge in header next to date/time</div>
            <div><strong>Processing Log:</strong> Image Path Log section shows simplified per-article decisions</div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-400">
        <strong className="text-teal-400">Key files:</strong> elementor.js (lines ~1100-1200 for tracking), ArticleListView.tsx (display)
      </div>
    </div>

    {/* Staging WordPress System */}
    <div className="bg-purple-900/20 rounded-xl p-6 border border-purple-500">
      <h3 className="text-lg font-bold text-purple-400 mb-4">Staging WordPress (Image Media Library)</h3>
      <div className="space-y-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-purple-400 font-semibold mb-2">Why Staging?</div>
          <div className="text-sm text-gray-300">
            WordPress hosts block large base64 image uploads via ModSecurity. Instead of weakening client site security,
            we use a central staging site to convert base64 → wpUrl, then use that URL everywhere.
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-brand-cyan font-semibold mb-2">Flow:</div>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-300 flex-wrap">
            <span className="bg-slate-700 px-2 py-1 rounded">AI generates base64</span>
            <span className="text-brand-cyan">→</span>
            <span className="bg-purple-800 px-2 py-1 rounded">Upload to Staging WP</span>
            <span className="text-brand-cyan">→</span>
            <span className="bg-slate-700 px-2 py-1 rounded">Get wpUrl back</span>
            <span className="text-brand-cyan">→</span>
            <span className="bg-slate-700 px-2 py-1 rounded">Use URL on client sites</span>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-green-400 font-semibold mb-2">Where Credentials Are Stored:</div>
          <div className="text-sm text-gray-300 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-green-400">✓</span>
              <div>
                <strong>Database:</strong> <code className="bg-slate-900 px-1 rounded">global_settings</code> table
                <div className="text-xs text-gray-400 mt-1">
                  Columns: <code className="bg-slate-900 px-1 rounded">staging_wp_url</code>,
                  <code className="bg-slate-900 px-1 rounded">staging_wp_user</code>,
                  <code className="bg-slate-900 px-1 rounded">staging_wp_password</code>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400">✓</span>
              <div>
                <strong>UI:</strong> WordPress Settings (top nav) → Staging WordPress section
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-yellow-400 font-semibold mb-2">Credential Priority Order:</div>
          <div className="text-sm text-gray-300 space-y-1">
            <div>1. <strong>Global staging credentials</strong> (from WordPress Settings) ← <span className="text-green-400">preferred</span></div>
            <div>2. Explicit params in request (legacy)</div>
            <div>3. Workflow's website credentials (fallback)</div>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Code: <code className="bg-slate-900 px-1 rounded">server/routes/image-creation.js</code> batch-generate endpoint
          </div>
        </div>
      </div>
    </div>

    {/* Key Files Reference Table */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-gold mb-4">Key Files for Image Flow</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-600">
              <th className="text-left py-2 px-3 text-brand-cyan">Area</th>
              <th className="text-left py-2 px-3 text-brand-cyan">File</th>
              <th className="text-left py-2 px-3 text-brand-cyan">Key Lines</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-slate-700">
              <td className="py-2 px-3">Image filtering/matching</td>
              <td className="py-2 px-3"><code className="bg-slate-900 px-1 rounded text-xs">server/routes/elementor.js</code></td>
              <td className="py-2 px-3 text-brand-gold">681-957</td>
            </tr>
            <tr className="border-b border-slate-700">
              <td className="py-2 px-3">Image generation orchestration</td>
              <td className="py-2 px-3"><code className="bg-slate-900 px-1 rounded text-xs">server/services/image-pipeline.js</code></td>
              <td className="py-2 px-3 text-brand-gold">310-520</td>
            </tr>
            <tr className="border-b border-slate-700">
              <td className="py-2 px-3">Image bank database access</td>
              <td className="py-2 px-3"><code className="bg-slate-900 px-1 rounded text-xs">server/services/image-bank.js</code></td>
              <td className="py-2 px-3 text-gray-400">All</td>
            </tr>
            <tr className="border-b border-slate-700">
              <td className="py-2 px-3">Push images to WP</td>
              <td className="py-2 px-3"><code className="bg-slate-900 px-1 rounded text-xs">server/routes/articles.js</code></td>
              <td className="py-2 px-3 text-brand-gold">423-687</td>
            </tr>
            <tr className="border-b border-slate-700">
              <td className="py-2 px-3">Image creation settings</td>
              <td className="py-2 px-3"><code className="bg-slate-900 px-1 rounded text-xs">server/routes/image-creation.js</code></td>
              <td className="py-2 px-3 text-gray-400">All</td>
            </tr>
            <tr>
              <td className="py-2 px-3">Article UI with buttons</td>
              <td className="py-2 px-3"><code className="bg-slate-900 px-1 rounded text-xs">src/components/articles/ArticleListView.tsx</code></td>
              <td className="py-2 px-3 text-brand-gold">372-483</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    {/* PROMPT MODE ARCHITECTURE - Critical for understanding image generation */}
    <div className="bg-teal-900/20 rounded-xl p-6 border border-teal-500">
      <h3 className="text-lg font-bold text-teal-400 mb-4">Prompt Mode Architecture (CRITICAL)</h3>
      <p className="text-gray-400 text-sm mb-4">
        When generating images live, the system must choose which prompt source to use.
        <strong className="text-teal-300"> This has TWO separate paths controlled by TWO separate settings.</strong>
      </p>

      <div className="space-y-4">
        {/* The Two Paths */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border-2 border-yellow-500/50">
            <div className="text-yellow-400 font-bold mb-2">PATH A: Bank Fallback</div>
            <div className="text-sm text-gray-300 space-y-2">
              <div className="text-xs bg-yellow-900/30 p-2 rounded">
                <strong>When:</strong> integration_mode='bank' BUT bank is empty
              </div>
              <div className="text-xs bg-slate-900 p-2 rounded">
                <strong>Setting used:</strong> <code className="text-yellow-400">fallback_prompt_mode</code>
              </div>
              <div className="text-xs text-gray-500">
                UI: "When bank is empty, generate using:" buttons
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border-2 border-cyan-500/50">
            <div className="text-brand-cyan font-bold mb-2">PATH B: Direct Live</div>
            <div className="text-sm text-gray-300 space-y-2">
              <div className="text-xs bg-cyan-900/30 p-2 rounded">
                <strong>When:</strong> integration_mode='live' (Generate Live button)
              </div>
              <div className="text-xs bg-slate-900 p-2 rounded">
                <strong>Setting used:</strong> <code className="text-brand-cyan">live_prompt_mode</code>
              </div>
              <div className="text-xs text-gray-500">
                UI: "Prompt Source for Generate Live:" buttons
              </div>
            </div>
          </div>
        </div>

        {/* The Three Prompt Sources */}
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-purple-400 font-bold mb-3">Three Prompt Source Options:</div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="bg-slate-900 p-3 rounded border border-purple-500/30">
              <code className="text-purple-400 font-bold">'main_prompt'</code>
              <div className="text-xs text-gray-400 mt-1">
                Uses avatar's <code>mainPrompt</code> field directly.
                <span className="text-red-400 block mt-1">Requires avatar.mainPrompt to be populated!</span>
              </div>
            </div>
            <div className="bg-slate-900 p-3 rounded border border-purple-500/30">
              <code className="text-purple-400 font-bold">'guided_gpt'</code>
              <div className="text-xs text-gray-400 mt-1">
                GPT reads article + guardrails to generate contextual prompt.
                <span className="text-green-400 block mt-1">Most flexible, uses AI interpretation.</span>
              </div>
            </div>
            <div className="bg-slate-900 p-3 rounded border border-purple-500/30">
              <code className="text-purple-400 font-bold">'smart_prompt'</code>
              <div className="text-xs text-gray-400 mt-1">
                Legacy smart prompt system (GPT-4o-mini).
                <span className="text-yellow-400 block mt-1">Default fallback if main_prompt has no data.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Critical Code Paths */}
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-red-400 font-bold mb-2">Code Path Reference:</div>
          <div className="text-xs text-gray-300 space-y-1">
            <div><code className="bg-slate-900 px-1 rounded">elementor.js:1307-1317</code> - Decides which setting to use (fallback vs live)</div>
            <div><code className="bg-slate-900 px-1 rounded">image-pipeline.js:308-320</code> - Logs prompt mode selection</div>
            <div><code className="bg-slate-900 px-1 rounded">image-pipeline.js:553-567</code> - Warns when falling through to smart_prompt</div>
            <div><code className="bg-slate-900 px-1 rounded">image-creation.js</code> - Saves/loads both settings (4 query locations each)</div>
          </div>
        </div>

        {/* Warning Box */}
        <div className="bg-red-950/50 rounded-lg p-4 border border-red-500">
          <div className="text-red-400 font-bold mb-2">Common Bugs in This Area:</div>
          <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
            <li><strong>Chaining with ||:</strong> Don't write <code className="bg-slate-900 px-1 rounded">fallback_prompt_mode || live_prompt_mode</code> - they're SEPARATE!</li>
            <li><strong>Missing database column:</strong> Column must exist in DB via setup-all.mjs migration</li>
            <li><strong>Empty mainPrompt:</strong> main_prompt mode requires avatar.mainPrompt to be populated</li>
            <li><strong>Wrong settings level:</strong> Check website_id BEFORE workflow_id (Golden Rule 8)</li>
          </ul>
        </div>
      </div>
    </div>

    {/* Push to WordPress Order - Critical Warning */}
    <div className="bg-red-900/30 rounded-xl p-6 border-2 border-red-500">
      <h3 className="text-lg font-bold text-red-400 mb-4">PUSH TO WORDPRESS (Strict Order!)</h3>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-brand-cyan text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold">1</div>
          <div className="text-gray-300">
            <code className="bg-slate-900 px-2 py-1 rounded text-brand-cyan">POST /api/articles/:id/push-images</code>
            <div className="text-xs text-gray-400 mt-1">Upload base64 → Get wpMediaUrl + wpMediaId</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-brand-gold text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold">2</div>
          <div className="text-gray-300">
            <code className="bg-slate-900 px-2 py-1 rounded text-brand-gold">POST /api/elementor/publish</code>
            <div className="text-xs text-gray-400 mt-1">Create page with embedded images</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-green-500 text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold">3</div>
          <div className="text-gray-300">
            <code className="bg-slate-900 px-2 py-1 rounded text-green-400">POST /api/seo/push-direct</code>
            <div className="text-xs text-gray-400 mt-1">Push meta to SEO plugin</div>
          </div>
        </div>
      </div>
      <div className="mt-4 p-3 bg-red-950 rounded-lg border border-red-700">
        <div className="text-red-300 text-sm font-bold">CRITICAL: Images → Page → Meta (NEVER change this order!)</div>
        <div className="text-xs text-gray-400 mt-1">If page is created before images are uploaded, images won't appear on WordPress.</div>
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
            <span className="text-gray-400">bank_first (default) / bank_only / generate_first / generate_only</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">integration_mode</code>
            <span className="text-gray-400">live (default since Jan 15) / bank</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">image_generation_model</code>
            <span className="text-gray-400">gpt-image-1.5/flux/etc</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">audience_avatars</code>
            <span className="text-gray-400">JSONB personas</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">website_id</code>
            <span className="text-gray-400">Links to website (preferred)</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">workflow_id</code>
            <span className="text-gray-400">Links to workflow (legacy)</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">prompt_templates</code>
            <span className="text-gray-400">JSONB saved prompts</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">text_snippets</code>
            <span className="text-gray-400">JSONB Text Bank items</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">category_templates</code>
            <span className="text-gray-400">JSONB placeholder categories</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">consultant_chat_files</code>
            <span className="text-gray-400">JSONB chat folders</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">consultant_chat_conversations</code>
            <span className="text-gray-400">JSONB chat sessions</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-700">
            <code className="text-brand-gold">calibration_entries</code>
            <span className="text-gray-400">JSONB CalibrationEntry[] (migration 035)</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <code className="text-brand-gold">calibration_version</code>
            <span className="text-gray-400">INT auto-increments on writes</span>
          </div>
        </div>
        <div className="mt-4 p-3 bg-red-900/30 rounded-lg text-xs text-red-300">
          <strong>NOTE:</strong> Derive fallback from smart_matching_mode, NOT from a separate fallback_to_live field!
        </div>
        <div className="mt-2 p-3 bg-yellow-900/30 rounded-lg text-xs text-yellow-300">
          <strong>CRITICAL - Settings Storage:</strong> Settings can be stored at WEBSITE or WORKFLOW level:
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li><strong>Save (PUT):</strong> Prefers website_id if workflow is linked to a website</li>
            <li><strong>Read (elementor.js):</strong> MUST check website_id first, then fall back to workflow_id</li>
            <li><strong>Bug Pattern:</strong> If UI edits don't reflect in generated content, check read/write mismatch!</li>
          </ul>
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

    {/* Calibration System Architecture (Cal-1) */}
    <div className="bg-gradient-to-r from-green-900/20 to-teal-900/20 rounded-xl p-6 border border-green-500/30 mt-8">
      <h3 className="text-xl font-bold text-green-400 mb-4">Calibration System (Cal-1 — Foundation Layer)</h3>
      <p className="text-gray-400 text-sm mb-4">
        Dynamic quality rules injected into image prompts. Each entry is a reusable instruction
        that gets compiled into a "Calibration Pack" filtered by tag.
        <strong className="text-white"> Cal-1 = backend only. Cal-2/Cal-3 will add UI.</strong>
      </p>

      {/* Data Flow Diagram */}
      <div className="bg-slate-900 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-bold text-brand-cyan mb-3">Data Flow</h4>
        <pre className="text-xs text-gray-300 overflow-x-auto">{`CalibrationEntry[] (JSONB on image_creation_settings)
  │
  ├─ CRUD Routes (/api/calibration/:workflowId)
  │    GET /              → all entries + version
  │    PUT /              → full replace (empty-array protected)
  │    POST /entry        → add single entry
  │    PATCH /entry/:id   → update single entry (ID locked)
  │    DELETE /entry/:id  → remove single entry
  │    GET /pack/:tag     → compiled pack for a tag
  │
  ├─ Settings Save/Load (image-creation.js)
  │    tryUpdateCalibration() pattern (graceful if migration 035 not run)
  │    Loaded in GET, saved in PUT alongside other settings
  │
  └─ Prompt Injection (two paths)
       ├─ Frontend: ImageCreationSection.tsx buildContext()
       │    Compiles pack client-side → sends as context.calibrationPack
       │
       └─ Backend: prompt-assistant.js context builder
            Renders "## Calibration Pack (Dynamic Quality Rules):" section
            Position: AFTER guardrails, BEFORE reference images`}</pre>
      </div>

      {/* Entry Schema */}
      <div className="bg-slate-900 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-bold text-brand-gold mb-3">CalibrationEntry Schema (15 fields)</h4>
        <pre className="text-xs text-gray-300 overflow-x-auto">{`{
  id: "CAL-007"                    // unique, e.g. CAL-001, CAL-002
  title: "Avoid model glam"        // short name
  tags: ["H", "J"]                 // which avatar tags; "All" = global
  priority: "hard"|"medium"|"soft" // injection sorting + conflict resolution
  human_note: "..."                // FOR USER: what's off and what we want
  model_instruction: "[CAL:Title | Priority] Do…; Avoid…; Prefer…"  // FOR AI: the injected line
  trigger: "when to apply"
  do_preferred: "preferred outcome"
  avoid_antipattern: "what to avoid"
  enforcement_tactics: ["tactic1", "tactic2"]
  negative_constraints?: ["don't do X"]
  evidence_bad_image_ids?: ["img-id"]  // near-miss references
  evidence_good_image_ids?: ["img-id"] // target/good references
  per_tag_test_status?: { "H": { pass: true, testedAt: "..." } }
  source_test_image_id?: "test-img-id" // links to test image that triggered it
  createdAt, updatedAt               // ISO timestamps
}`}</pre>
      </div>

      {/* Pack Compilation */}
      <div className="bg-slate-900 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-bold text-purple-400 mb-3">Pack Compilation (compileCalibrationPack)</h4>
        <div className="text-xs text-gray-300 space-y-2">
          <p><strong className="text-white">Input:</strong> all entries + active tag + max limit (12-20, default 16)</p>
          <p><strong className="text-white">Step 1:</strong> Filter — include entries where active tag in tags[] OR tags includes "All"</p>
          <p><strong className="text-white">Step 2:</strong> Sort — priority desc (hard{"→"}med{"→"}soft), then updatedAt desc (newest first)</p>
          <p><strong className="text-white">Step 3:</strong> Limit — cap to maxEntries (clamped 12-20)</p>
          <p><strong className="text-white">Step 4:</strong> Render Template 3 — numbered list with priority labels</p>
          <p><strong className="text-white">Output example:</strong></p>
          <pre className="bg-slate-800 p-2 rounded mt-1">{`Calibration Pack — Tag H (sorted by priority):
1. (Hard) [CAL:Safety gear | Hard] Include visible safety equipment...
2. (Hard) [CAL:Everyday look | Hard] Depict realistic worker...
3. (Medium) [CAL:Worn tools | Medium] Show tools with slight wear...

If a calibration item conflicts with guardrails, guardrails win.
If two calibration items conflict, higher priority wins; same priority, most recent wins.`}</pre>
        </div>
      </div>

      {/* Injection Stack */}
      <div className="bg-slate-900 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-bold text-red-400 mb-3">Prompt Injection Stack (CRITICAL ORDER)</h4>
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2"><span className="text-gray-500">1.</span><span className="text-gray-400">System / Role</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-500">2.</span><span className="text-gray-400">Global Guardrails (persistent instructions)</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-500">3.</span><span className="text-gray-400">Tag Guardrails (active tag only)</span></div>
          <div className="flex items-center gap-2"><span className="text-green-400 font-bold">4.</span><span className="text-green-400 font-bold">Calibration Pack (DYNAMIC) — filtered by tag, sorted, limited</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-500">5.</span><span className="text-gray-400">Page context (~75 words around image)</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-500">6.</span><span className="text-gray-400">Output contract ("Output ONLY the final prompt...")</span></div>
        </div>
        <p className="text-xs text-yellow-400 mt-3"><strong>WHY this order:</strong> Calibration refines output without overriding fundamentals. After guardrails prevents accidentally relaxing hard rules.</p>
      </div>

      {/* For Rebuild */}
      <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-500/30">
        <h4 className="text-sm font-bold text-yellow-400 mb-2">Notes for Rebuild</h4>
        <ul className="text-xs text-gray-300 space-y-2">
          <li><strong className="text-white">Keep:</strong> compileCalibrationPack() is clean, tested (35 tests), and does one thing. Port it directly.</li>
          <li><strong className="text-white">Consider changing:</strong> JSONB array on settings works but a dedicated <code className="bg-slate-800 px-1 rounded">calibration_entries</code> table with foreign key to settings would be cleaner. Enables SQL-level filtering/sorting instead of loading all entries into memory.</li>
          <li><strong className="text-white">Dual compilation:</strong> Currently compiled on BOTH frontend (for chat context) and backend (for /pack/:tag API). In rebuild, consider server-only compilation to keep single source of truth.</li>
          <li><strong className="text-white">Race condition:</strong> CRUD routes do read-then-write on JSONB array. Two simultaneous writes can conflict. Same limitation as testing_slots. A dedicated table with row-level operations would fix this.</li>
          <li><strong className="text-white">Version tracking:</strong> calibration_version auto-increments on every CRUD write. Could be enhanced with actual version history (store previous states for rollback) in rebuild.</li>
        </ul>
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

      {/* Rule 7 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-pink-500">
        <div className="flex items-start gap-4">
          <div className="bg-pink-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">7</div>
          <div>
            <h3 className="text-lg font-bold text-pink-400">ALL popup/modal windows MUST use React Portals</h3>
            <p className="text-gray-300 mt-2 text-sm">
              Never render modals inside the component tree with just <code className="bg-slate-900 px-1 rounded">position: fixed</code>.
              This causes flickering when the popup is inside a two-column layout or container with positioning.
            </p>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-red-400 font-medium mb-2">❌ DON'T (causes flickering):</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`{showPopup && (
  <div className="fixed inset-0 bg-black/80 z-50">
    ...modal content...
  </div>
)}`}</pre>
            </div>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-green-400 font-medium mb-2">✓ DO (correct way):</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`import { createPortal } from 'react-dom';

{showPopup && createPortal(
  <div className="fixed inset-0 bg-black/80 z-[9999]">
    ...modal content...
  </div>,
  document.body
)}`}</pre>
            </div>
            <p className="text-gray-400 mt-3 text-xs">
              <strong>Why:</strong> Portals render content outside the React component tree directly to document.body,
              bypassing any parent containers that could affect positioning. Use <code className="bg-slate-900 px-1 rounded">z-[9999]</code> for highest priority.
            </p>
          </div>
        </div>
      </div>

      {/* Rule 8 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-orange-500">
        <div className="flex items-start gap-4">
          <div className="bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">8</div>
          <div>
            <h3 className="text-lg font-bold text-orange-400">Settings hierarchy: website_id FIRST, then workflow_id</h3>
            <p className="text-gray-300 mt-2 text-sm">
              <code className="bg-slate-900 px-1 rounded">image_creation_settings</code> can be stored at EITHER level.
              When reading settings anywhere in the codebase, ALWAYS check <code className="bg-slate-900 px-1 rounded">website_id</code> first!
            </p>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-orange-400 font-medium mb-2">Pattern to follow (pseudo-code):</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`// 1. Get the website_id for the workflow
const workflow = await getWorkflow(workflowId);
const websiteId = workflow?.website_id;

// 2. Try website-level settings FIRST
let settings = null;
if (websiteId) {
  settings = await getSettingsByWebsiteId(websiteId);
}

// 3. Fall back to workflow-level if no website settings
if (!settings) {
  settings = await getSettingsByWorkflowId(workflowId);
}`}</pre>
            </div>
            <p className="text-red-400 mt-3 text-xs">
              <strong>BUG PATTERN:</strong> If UI changes don't reflect in behavior, check if code is reading from the wrong level!
              This has caused multiple bugs: Main Prompt not working, bank settings ignored, etc.
            </p>
          </div>
        </div>
      </div>

      {/* Rule 9 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-rose-500">
        <div className="flex items-start gap-4">
          <div className="bg-rose-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">9</div>
          <div>
            <h3 className="text-lg font-bold text-rose-400">NEVER silently swallow API errors</h3>
            <p className="text-gray-300 mt-2 text-sm">
              When an API call fails, ALWAYS show the error to the user. Empty catch blocks or catch-and-ignore patterns
              make debugging impossible and confuse users.
            </p>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-red-400 font-medium mb-2">Bad (DO NOT):</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`try {
  const data = await fetchTemplates();
  setTemplates(data);
} catch (e) {
  console.log(e);  // User sees nothing!
  setTemplates([]); // Looks like no templates exist
}`}</pre>
            </div>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-green-400 font-medium mb-2">Good (DO):</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`try {
  const data = await fetchTemplates();
  setTemplates(data);
  setError(null);
} catch (e) {
  console.error('Template fetch failed:', e);
  setError(e.message || 'Failed to load templates');
  // Show error in UI with retry button
}`}</pre>
            </div>
            <p className="text-gray-400 mt-3 text-xs">
              <strong>Why:</strong> Template Library had this bug - users saw empty state when server was erroring.
              Always give users visibility into what went wrong.
            </p>
          </div>
        </div>
      </div>

      {/* Rule 10 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-cyan-500">
        <div className="flex items-start gap-4">
          <div className="bg-cyan-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">10</div>
          <div>
            <h3 className="text-lg font-bold text-cyan-400">Full-Width Section Pattern for in-flow expansion</h3>
            <p className="text-gray-300 mt-2 text-sm">
              When a section needs to expand full-width but stay in the normal page flow (not overlay), use negative margins to break out of the container.
            </p>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-cyan-400 font-medium mb-2">✓ CSS technique for full-width breakout:</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`// When expanded, break out of container to span full viewport
<div className={\`transition-all \${
  isExpanded
    ? 'relative -ml-4 -mr-4 xl:-ml-[calc(50vw-50%+1rem)] xl:-mr-[calc(50vw-50%+1rem)] xl:w-[calc(100vw-2rem)]'
    : ''
}\`}>
  {/* Content stays in page flow, scrollable */}
</div>`}</pre>
            </div>
            <p className="text-gray-400 mt-3 text-xs">
              <strong>Use this pattern when:</strong> You need more horizontal space for complex content (like Audience Avatars with prompt + placeholders side-by-side)
              but the user should still be able to scroll the page normally. The expanded section pushes other content down.
            </p>
            <p className="text-gray-400 mt-2 text-xs">
              <strong>Examples:</strong> Audience Avatars dropdown in Image Creation section
            </p>
          </div>
        </div>
      </div>

      {/* Rule 11 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-emerald-500">
        <div className="flex items-start gap-4">
          <div className="bg-emerald-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">11</div>
          <div>
            <h3 className="text-lg font-bold text-emerald-400">PROTECT mainPrompt and avatar data from accidental erasure</h3>
            <p className="text-gray-300 mt-2 text-sm">
              User prompts are CRITICAL. They've been accidentally erased many times due to state updates, race conditions, and partial saves.
              Add protection at BOTH frontend AND server level.
            </p>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-red-400 font-medium mb-2">THE PROBLEM:</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`// When updating avatar with some fields, mainPrompt can get wiped:
updateAvatar({ name: "New Name" }) // might erase mainPrompt if state is stale!

// When loading stale state from React, rich prompt data gets lost
setSettings(current => ({ ...current, ...staleUpdates }))`}</pre>
            </div>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-emerald-400 font-medium mb-2">✓ FRONTEND PROTECTION (ImageCreationSection.tsx):</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`// In handleUpdateAvatar() - block suspicious erasure
if (currentAvatar && updates.mainPrompt !== undefined) {
  const currentLength = currentAvatar.mainPrompt?.length || 0;
  const newLength = updates.mainPrompt?.length || 0;
  // If going from 200+ chars to <100, that's erasure!
  if (currentLength > 200 && newLength < 100) {
    console.error('PROTECTION: Blocked attempt to erase mainPrompt!');
    const { mainPrompt: _blocked, ...safeUpdates } = updates;
    updates = safeUpdates; // Remove mainPrompt from updates
  }
}

// In updateSettings() - protect entire avatars array
if (updates.audience_avatars) {
  const protectedAvatars = updates.audience_avatars.map(newAvatar => {
    const currentAvatar = current.audience_avatars.find(a => a.id === newAvatar.id);
    if (!currentAvatar) return newAvatar;
    // Preserve mainPrompt if new is suspiciously empty
    if (currentAvatar.mainPrompt?.length > 200 &&
        (!newAvatar.mainPrompt || newAvatar.mainPrompt.length < 100)) {
      return { ...newAvatar, mainPrompt: currentAvatar.mainPrompt };
    }
    return newAvatar;
  });
}`}</pre>
            </div>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-emerald-400 font-medium mb-2">✓ SERVER PROTECTION (image-creation.js):</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`// Before saving, compare with existing database values
const currentSettings = await sql\`SELECT audience_avatars FROM ...\`;
const existingAvatars = currentSettings[0]?.audience_avatars || [];

protectedAvatars = audience_avatars.map(newAvatar => {
  const existing = existingAvatars.find(a => a.id === newAvatar.id);
  if (!existing) return newAvatar;

  // Server-side protection: preserve existing data if new is empty
  return {
    ...newAvatar,
    mainPrompt: (newAvatar.mainPrompt?.length > 50)
      ? newAvatar.mainPrompt
      : existing.mainPrompt || newAvatar.mainPrompt,
    placeholderCategories: newAvatar.placeholderCategories?.length > 0
      ? newAvatar.placeholderCategories
      : existing.placeholderCategories || [],
    variations: newAvatar.variations?.length > 0
      ? newAvatar.variations
      : existing.variations || []
  };
});`}</pre>
            </div>
            <p className="text-red-400 mt-3 text-xs">
              <strong>CRITICAL:</strong> This protection has saved user data multiple times! Don't remove it without understanding why it exists.
              The mainPrompt field contains the user's carefully crafted image generation prompts which can take hours to write.
            </p>
            <p className="text-gray-400 mt-2 text-xs">
              <strong>Key files:</strong> ImageCreationSection.tsx (~line 1547, 2506) and server/routes/image-creation.js (~line 1482)
            </p>
          </div>
        </div>
      </div>

      {/* Rule 12 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-teal-500">
        <div className="flex items-start gap-4">
          <div className="bg-teal-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">12</div>
          <div>
            <h3 className="text-lg font-bold text-teal-400">Chat/message history must SYNC with database on mount</h3>
            <p className="text-gray-300 mt-2 text-sm">
              Local React state like <code className="bg-slate-900 px-1 rounded">useState([])</code> is ephemeral - it's gone on refresh!
              If chat history or similar persistent data needs to survive page reloads, it MUST:
            </p>
            <div className="mt-3 space-y-2">
              <div className="bg-slate-900 rounded p-3">
                <p className="text-xs text-teal-400 font-medium mb-2">1. LOAD from database on mount:</p>
                <pre className="text-xs text-gray-400 overflow-x-auto">{`// NOT ENOUGH: const [messages, setMessages] = useState([]);

// CORRECT: Load from database when settings are available
useEffect(() => {
  if (loaded && settings.consultant_chat_history?.length > 0) {
    setGuidedAssistantMessages(settings.consultant_chat_history);
    console.log('Loaded', settings.consultant_chat_history.length, 'messages');
  }
}, [loaded]); // Run once when settings load`}</pre>
              </div>
              <div className="bg-slate-900 rounded p-3">
                <p className="text-xs text-teal-400 font-medium mb-2">2. SAVE to database after every change:</p>
                <pre className="text-xs text-gray-400 overflow-x-auto">{`// Every time messages change, persist immediately
setGuidedAssistantMessages(newMessages);
updateSettings({ consultant_chat_history: newMessages }); // PERSIST!`}</pre>
              </div>
            </div>
            <p className="text-red-400 mt-3 text-xs">
              <strong>BUG PATTERN:</strong> "Chat history keeps disappearing" = useState without database sync.
              This was the root cause of AI Prompt Assistant losing all conversation history on every refresh.
            </p>
            <p className="text-gray-400 mt-2 text-xs">
              <strong>Example fix:</strong> ImageCreationSection.tsx lines 1215-1222 (load) and 3352-3355 (save)
            </p>
          </div>
        </div>
      </div>

      {/* Rule 13 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-amber-500">
        <div className="flex items-start gap-4">
          <div className="bg-amber-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">13</div>
          <div>
            <h3 className="text-lg font-bold text-amber-400">ALL generated images MUST go through WordPress BEFORE storage</h3>
            <p className="text-gray-300 mt-2 text-sm">
              Base64 images are ~1MB each. WordPress URLs are ~100 bytes. Storing base64 in the database causes
              507 errors (response too large) and massive database bloat. Images MUST be uploaded to staging WordPress first.
            </p>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-red-400 font-medium mb-2">❌ BAD (stores base64 - causes 67MB+ responses):</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`// Generate image and save directly
const response = await openai.images.generate(...);
const imageUrl = \`data:image/png;base64,\${response.data[0].b64_json}\`;
saveToBank({ url: imageUrl }); // STORES 1MB PER IMAGE!`}</pre>
            </div>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-green-400 font-medium mb-2">✓ GOOD (uploads to WP first):</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`// Generate image → Upload to WP → Save URL
const response = await openai.images.generate(...);
const base64Data = response.data[0].b64_json;

// Upload to staging WordPress
const wpResult = await uploadMedia(stagingCredentials, base64Data, filename);

// Save WordPress URL (tiny, ~100 bytes)
saveToBank({ url: wpResult.url, wpMediaId: wpResult.id });`}</pre>
            </div>
            <p className="text-gray-400 mt-3 text-xs">
              <strong>Endpoints that do this correctly:</strong>
            </p>
            <ul className="text-gray-400 text-xs mt-1 space-y-1 ml-4 list-disc">
              <li><code className="bg-slate-900 px-1 rounded">/api/image-creation/batch-generate</code> - Requires staging creds, uploads first</li>
              <li><code className="bg-slate-900 px-1 rounded">/api/images/generate-for-article</code> - Uses pipeline with WP upload</li>
              <li><code className="bg-slate-900 px-1 rounded">/api/image-creation/upload-to-wp</code> - Utility endpoint for single uploads</li>
            </ul>
            <p className="text-green-400 mt-3 text-xs">
              <strong>ALL ENDPOINTS NOW COMPLIANT</strong> - <code className="bg-slate-900 px-1 rounded">/api/articles/:id/regenerate-image</code> was fixed Jan 20, 2026 to upload to WP first
            </p>
          </div>
        </div>
      </div>

      {/* Rule 14 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-fuchsia-500">
        <div className="flex items-start gap-4">
          <div className="bg-fuchsia-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">14</div>
          <div>
            <h3 className="text-lg font-bold text-fuchsia-400">Fallback INSERT/UPDATE queries MUST include ALL columns</h3>
            <p className="text-gray-300 mt-2 text-sm">
              When adding new JSONB columns to a table, you must update FOUR places in the code:
              main INSERT, fallback INSERT, main UPDATE, and fallback UPDATE. Missing any will cause data loss.
            </p>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-red-400 font-medium mb-2">THE TRAP:</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`// Main query has the new column:
await sql\`INSERT INTO settings (..., new_column) VALUES (..., \${newColumn})\`;

// BUT FALLBACK QUERY DOESN'T:
try { ... } catch {
  await sql\`INSERT INTO settings (old_cols_only) VALUES (...)\`;
  // new_column is LOST! Falls back to database default '[]'
}`}</pre>
            </div>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-fuchsia-400 font-medium mb-2">✓ CHECKLIST when adding columns:</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`1. Add column to database schema (migration)
2. Add to main INSERT query
3. Add to FALLBACK INSERT query  ← Easy to forget!
4. Add to main UPDATE query
5. Add to FALLBACK UPDATE query  ← Easy to forget!
6. Add to GET response extraction
7. Add to TypeScript interface`}</pre>
            </div>
            <p className="text-red-400 mt-3 text-xs">
              <strong>REAL BUG:</strong> Template persistence was broken for weeks because fallback queries in
              <code className="bg-slate-900 px-1 rounded">image-creation.js</code> were missing prompt_templates, text_snippets,
              category_templates columns. Main queries had them, but when fallback path executed, data was lost!
            </p>
            <p className="text-gray-400 mt-2 text-xs">
              <strong>Key file:</strong> server/routes/image-creation.js - search for "fallback" to find all 4 query locations
            </p>
          </div>
        </div>
      </div>

      {/* Rule 15 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-teal-500">
        <div className="flex items-start gap-4">
          <div className="bg-teal-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">15</div>
          <div>
            <h3 className="text-lg font-bold text-teal-400">fallback_prompt_mode and live_prompt_mode are SEPARATE settings</h3>
            <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded ml-2">CRITICAL - Jan 20, 2026</span>
            <p className="text-gray-300 mt-2 text-sm">
              These are TWO INDEPENDENT database columns. NEVER chain them with <code className="bg-slate-900 px-1 rounded">||</code>.
              Each controls a different code path and must be stored/retrieved separately.
            </p>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-teal-400 font-medium mb-2">THE TWO SETTINGS:</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`// SEPARATE purposes - don't mix!
fallback_prompt_mode  → Used when bank is empty, falling back to live
live_prompt_mode      → Used when directly generating (integration_mode='live')

// UI has TWO DIFFERENT button groups:
"When bank is empty, generate using:"  → saves fallback_prompt_mode
"Prompt Source for Generate Live:"     → saves live_prompt_mode`}</pre>
            </div>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-red-400 font-medium mb-2">❌ BAD (was causing bugs):</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`// This chains them - WRONG!
livePromptMode = config.fallback_prompt_mode || config.live_prompt_mode || 'main_prompt';
// If fallback_prompt_mode is undefined, falls through to live_prompt_mode!`}</pre>
            </div>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-green-400 font-medium mb-2">✓ GOOD (correct separation):</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`// elementor.js:1307-1317
if (isFallbackFromBank) {
  // Bank was tried but empty → use FALLBACK setting
  livePromptMode = config.fallback_prompt_mode || 'main_prompt';
} else {
  // Direct Generate Live mode → use LIVE setting
  livePromptMode = config.live_prompt_mode || 'main_prompt';
}`}</pre>
            </div>
            <p className="text-red-400 mt-3 text-xs">
              <strong>ROOT CAUSE BUG:</strong> The database column didn't exist! Code tried to save it, fell back to
              simpler query that omitted it, then read back undefined. Migration 022 adds the column properly.
            </p>
            <p className="text-gray-400 mt-2 text-xs">
              <strong>Key files:</strong> elementor.js:1307-1317, image-creation.js (4 query locations), setup-all.mjs (migration 022/023)
            </p>
          </div>
        </div>
      </div>

      {/* Rule 16 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-sky-500">
        <div className="flex items-start gap-4">
          <div className="bg-sky-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">16</div>
          <div>
            <h3 className="text-lg font-bold text-sky-400">Database columns MUST exist - schema.sql is NOT enough</h3>
            <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded ml-2">CRITICAL - Jan 20, 2026</span>
            <p className="text-gray-300 mt-2 text-sm">
              Adding a column to <code className="bg-slate-900 px-1 rounded">schema.sql</code> does NOT create it in production!
              Migrations run via <code className="bg-slate-900 px-1 rounded">setup-all.mjs</code> on server start.
            </p>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-red-400 font-medium mb-2">WHY CODE "WORKS" BUT DATA DOESN'T PERSIST:</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`// Code tries to save to non-existent column:
await sql\`UPDATE settings SET new_column = \${value}\`
// PostgreSQL ERROR: column "new_column" does not exist

// Fallback query runs WITHOUT the new column:
await sql\`UPDATE settings SET old_column = \${value}\`
// SUCCEEDS but new_column is never saved!

// When reading back:
const result = await sql\`SELECT * FROM settings\`
result.new_column // undefined - column doesn't exist!`}</pre>
            </div>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-sky-400 font-medium mb-2">✓ CHECKLIST for new columns:</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`1. Add to schema.sql (documentation only)
2. Add to setup-all.mjs migrations section:

   const hasNewCol = await sql\`
     SELECT column_name FROM information_schema.columns
     WHERE table_name = 'table' AND column_name = 'new_col'
   \`;
   if (hasNewCol.length === 0) {
     await sql\`ALTER TABLE table ADD COLUMN new_col TYPE DEFAULT val\`;
   }

3. Deploy/restart server to run migrations
4. VERIFY column exists before declaring fixed!`}</pre>
            </div>
            <p className="text-red-400 mt-3 text-xs">
              <strong>REAL BUG:</strong> fallback_prompt_mode was in schema.sql line 290 but never migrated.
              The column physically didn't exist. All saves silently failed to the fallback path.
            </p>
          </div>
        </div>
      </div>

      {/* Rule 17 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-violet-500">
        <div className="flex items-start gap-4">
          <div className="bg-violet-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">17</div>
          <div>
            <h3 className="text-lg font-bold text-violet-400">Article tags (H), (J), (C) are INTERNAL - strip from UI displays</h3>
            <span className="text-xs bg-violet-500/30 text-violet-300 px-2 py-0.5 rounded ml-2">UI Pattern - Jan 20, 2026</span>
            <p className="text-gray-300 mt-2 text-sm">
              Tags like <code className="bg-slate-900 px-1 rounded">(H)</code>, <code className="bg-slate-900 px-1 rounded">(J)</code>, <code className="bg-slate-900 px-1 rounded">(C)</code>
              at the end of keywords are for internal processing (they determine which avatar/placeholders to use).
              They should NEVER appear in the UI or WordPress.
            </p>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-violet-400 font-medium mb-2">✓ Use stripTagFromKeyword() for all keyword displays:</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`// ArticleListView.tsx - helper function
const stripTagFromKeyword = (keyword: string | null | undefined): string => {
  if (!keyword) return '';
  // Removes (H), (J), (C), etc. from end of string
  return keyword.replace(/\\s*\\([A-Za-z]\\)\\s*$/, '').trim();
};

// Example: "Standard Cleaning(H)" → "Standard Cleaning"
// Example: "Topic Name (J)" → "Topic Name"`}</pre>
            </div>
            <p className="text-gray-400 mt-3 text-xs">
              <strong>Places to use:</strong> Article list keyword column, article detail header, ElementorPreview title prop,
              WordPress publish calls (title parameter), Google Search Preview URL
            </p>
            <p className="text-gray-400 mt-2 text-xs">
              <strong>Key file:</strong> ArticleListView.tsx (~line 85 for function, applied in 6+ locations)
            </p>
          </div>
        </div>
      </div>

      {/* Rule 18 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border-l-4 border-emerald-500">
        <div className="flex items-start gap-4">
          <div className="bg-emerald-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">18</div>
          <div>
            <h3 className="text-lg font-bold text-emerald-400">H1 titles use em dash (—) not period for separators</h3>
            <span className="text-xs bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded ml-2">Formatting - Feb 4, 2026</span>
            <p className="text-gray-300 mt-2 text-sm">
              Page H1 titles should use em dashes to separate location from tagline, not periods.
              The AI sometimes generates periods which looks wrong.
            </p>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-red-400 font-medium mb-1">✗ Wrong:</p>
              <code className="text-xs text-gray-400">"Apartment Cleaning in Hendersonville, TN. Professional Service"</code>
              <p className="text-xs text-green-400 font-medium mb-1 mt-2">✓ Correct:</p>
              <code className="text-xs text-gray-400">"Apartment Cleaning in Hendersonville, TN — Professional Service"</code>
            </div>
            <div className="mt-3 bg-slate-900 rounded p-3">
              <p className="text-xs text-emerald-400 font-medium mb-2">Auto-fixed in formatHeadlineWithEmDash():</p>
              <pre className="text-xs text-gray-400 overflow-x-auto">{`// elementor-builder.js - converts ". " to " — " after state codes
headline.replace(/,\\s*([A-Z]{2})\\.\\s+/g, ', $1 — ')

// Matches: "TN. ", "FL. ", "CA. " etc.
// Result: "TN — ", "FL — ", "CA — " etc.`}</pre>
            </div>
            <p className="text-gray-400 mt-3 text-xs">
              <strong>Key file:</strong> server/services/elementor-builder.js (formatHeadlineWithEmDash function)
            </p>
            <p className="text-gray-400 mt-2 text-xs">
              <strong>Applies to:</strong> ALL workflows globally - this is in the core page builder
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* UI Patterns Quick Reference */}
    <div className="max-w-3xl mx-auto mt-8 bg-slate-800/50 rounded-xl p-6 border border-cyan-500/30">
      <h3 className="text-lg font-bold text-cyan-400 mb-4">UI Patterns Quick Reference</h3>
      <p className="text-gray-400 text-sm mb-4">Use these named patterns when communicating with AI agents about UI requirements.</p>
      <div className="space-y-4">
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-pink-400 font-bold">Pattern A:</span>
            <span className="text-white font-semibold">Portal Modal</span>
            <span className="text-xs bg-pink-600/30 text-pink-300 px-2 py-0.5 rounded">Full-screen overlay</span>
          </div>
          <p className="text-gray-400 text-xs">
            Covers entire viewport, blocks interaction with page behind it. Use for: Templates browser, image preview, settings popups, confirmations.
          </p>
          <p className="text-gray-500 text-xs mt-1">
            <strong>Key:</strong> Uses <code className="bg-slate-800 px-1 rounded">createPortal()</code> to render at document.body
          </p>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-cyan-400 font-bold">Pattern B:</span>
            <span className="text-white font-semibold">Full-Width Section</span>
            <span className="text-xs bg-cyan-600/30 text-cyan-300 px-2 py-0.5 rounded">In-flow expansion</span>
          </div>
          <p className="text-gray-400 text-xs">
            Expands to span full viewport width but stays in normal page flow. Content above/below shifts. Page remains scrollable.
          </p>
          <p className="text-gray-500 text-xs mt-1">
            <strong>Key:</strong> Uses negative margin CSS trick <code className="bg-slate-800 px-1 rounded">-ml-[calc(50vw-50%)]</code>
          </p>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-brand-gold font-bold">Pattern C:</span>
            <span className="text-white font-semibold">Standard Collapsible</span>
            <span className="text-xs bg-brand-gold/30 text-brand-gold px-2 py-0.5 rounded">Normal dropdown</span>
          </div>
          <p className="text-gray-400 text-xs">
            Standard collapsible section that expands/collapses in place. Stays within its container width.
          </p>
          <p className="text-gray-500 text-xs mt-1">
            <strong>Key:</strong> Simple conditional rendering with state toggle
          </p>
        </div>
      </div>
    </div>

    {/* File Reference */}
    <div className="max-w-3xl mx-auto mt-8 bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">Key Files Reference</h3>
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <div>
          <h4 className="font-semibold text-brand-gold mb-2">Frontend</h4>
          <ul className="space-y-1 text-gray-300">
            <li><code className="text-xs">src/components/articles/ArticleListView.tsx</code></li>
            <li><code className="text-xs">src/components/ImageCreationSection.tsx</code></li>
            <li><code className="text-xs">src/components/WebsitesPage.tsx</code></li>
            <li><code className="text-xs">src/App.tsx</code> <span className="text-gray-500">(export/import)</span></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-brand-gold mb-2">Backend</h4>
          <ul className="space-y-1 text-gray-300">
            <li><code className="text-xs">server/routes/elementor.js</code></li>
            <li><code className="text-xs">server/routes/articles.js</code></li>
            <li><code className="text-xs">server/routes/seo.js</code></li>
            <li><code className="text-xs">server/routes/image-creation.js</code> <span className="text-gray-500">(protection)</span></li>
            <li><code className="text-xs">server/routes/site-planning.js</code></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-brand-gold mb-2">Utilities</h4>
          <ul className="space-y-1 text-gray-300">
            <li><code className="text-xs">scripts/search-prompts.mjs</code> <span className="text-gray-500">(DB search)</span></li>
            <li><code className="text-xs">scripts/fix-mainprompt-direct.mjs</code> <span className="text-gray-500">(prompt fix)</span></li>
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
    {/* No current critical issues - workflowId issue was fixed Jan 2026 */}
    <div className="bg-green-900/20 rounded-xl p-6 border border-green-500/50">
      <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        No Critical Issues Currently
      </h3>
      <p className="text-gray-400 text-sm">
        All previously documented issues have been resolved. See "Recently Resolved" section below for history.
      </p>
    </div>

    {/* Resolved Issues */}
    <div className="bg-green-900/20 rounded-xl p-6 border border-green-500">
      <h3 className="text-lg font-bold text-green-400 mb-4">Recently Resolved Issues</h3>

      <div className="space-y-4">
        {/* Feb 6 - Batch retry logic & error logging */}
        <div className="bg-slate-800 rounded-lg p-4 border-2 border-green-500">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Batch processing fails with no retry on server restart</span>
            <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">CRITICAL - Feb 6, 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> Batch of 27 articles failed after article 8 when Railway server became unreachable.
            All 19 remaining articles instantly failed with "Failed to fetch" - zero retry logic existed.
            Additionally, three error logging spots output {'{}'} instead of actual error messages.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Root cause:</strong> Single fetch attempts with no retry mechanism. Server restarts or temporary
            network issues would cause immediate failure of all remaining batch items.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix (v1):</strong> Added <code className="bg-slate-900 px-1 rounded">retryFetch()</code> wrapper in llm-service.ts.
            Only retries on network errors, 502, 503, 429. Does NOT retry on 400/401/403/404.
            Pings /api/health before each retry to check server status.
            Applied to: LLM generate, article save, and WP publish fetches.
            Fixed error logging to use <code className="bg-slate-900 px-1 rounded">error.message</code> instead of raw error objects.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix (v2 - enhanced):</strong> Upgraded to 3-phase escalating retry that never gives up:
            Phase 1 (Quick recovery): 30s, 60s, 120s (~3.5 min).
            Phase 2 (Patient wait): 5min intervals x6 (~30 min).
            Phase 3 (Chill mode): 1 hour intervals forever.
            Health check pings before each wait - if server is back, retries immediately.
            Added Resume button: shows "Resume (N remaining)" after a batch stops, allowing
            users to continue from where they left off without re-running completed items.
          </div>
          <div className="text-sm text-green-400 mt-2">
            <strong>Key Files:</strong> src/services/llm-service.ts (retryFetch), App.tsx (resume state + button + article save + WP publish), src/services/zerogpt-service.ts (error log)
          </div>
        </div>

        {/* Feb 5 - Preview/WordPress content mismatch (ARCHITECTURE FIX) */}
        <div className="bg-slate-800 rounded-lg p-4 border-2 border-green-500">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Preview showed different content than WordPress (FAQs, formatting)</span>
            <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">ARCHITECTURE - Feb 5, 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> The Preview tab showed content formatted differently than WordPress.
            FAQs appeared as a wall of text in preview but properly formatted on WordPress.
            Bold, line breaks, paragraph handling all differed between the two.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Root cause:</strong> Two completely separate code paths doing similar-but-different processing:
            <ul className="list-disc ml-4 mt-1">
              <li><strong>Preview:</strong> ElementorPreview.tsx → cleanContent() → extractIntro() → splitByH2() → markdownToHtml()</li>
              <li><strong>WordPress:</strong> content-chunker.js → chunkContent() → elementor-builder.js → contentToHtml()</li>
            </ul>
            These were independently coded and did NOT produce identical output.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Created new endpoint <code className="bg-slate-900 px-1 rounded">/api/elementor/preview-html</code> that uses
            the SAME processing functions as WordPress (chunkContent, contentToHtml). ElementorPreview now calls this endpoint
            instead of doing its own client-side processing.
            <pre className="bg-slate-900 p-2 rounded mt-1 text-xs overflow-x-auto">{`// OLD (broken): Preview processes client-side, different from server
Content → ElementorPreview.tsx (own parsing) → Different output

// NEW (fixed): Preview calls server, uses same processing as WordPress
Content → /api/elementor/preview-html → chunkContent() + contentToHtml()
        → Preview displays server-processed HTML (identical to WordPress)`}</pre>
          </div>
          <div className="text-sm text-green-400 mt-2">
            <strong>Key Files:</strong> server/routes/elementor.js (new endpoint), src/components/articles/ElementorPreview.tsx (refactored)
          </div>
          <div className="text-sm text-amber-400 mt-2">
            <strong>ARCHITECTURE RULE:</strong> Never duplicate content processing logic. The server should be the single source
            of truth for how content is transformed. Preview should display what server produces, not its own interpretation.
          </div>
        </div>

        {/* Feb 5 - Image toggle Off not respected */}
        <div className="bg-slate-800 rounded-lg p-4 border-2 border-green-500">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Image toggle "Off" ignored - images still processed</span>
            <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">CRITICAL - Feb 5, 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> Setting the Image toggle to "Off" in Publishing to WordPress section didn't stop
            image processing. Images were still being generated/matched even with toggle showing "Off".
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Root cause:</strong> Field name mismatch between components:
            <ul className="list-disc ml-4 mt-1">
              <li>Main UI toggle updates <code className="bg-slate-900 px-1 rounded">wpPublishMode</code> ✓</li>
              <li><code className="bg-slate-900 px-1 rounded">processWorkflow()</code> reads from <code className="bg-slate-900 px-1 rounded">wpPublishMode</code> ✓</li>
              <li>SitePlanningSection was reading/writing <code className="bg-slate-900 px-1 rounded">imagePublishMode</code> ✗</li>
              <li>TestRunnerPopup was reading <code className="bg-slate-900 px-1 rounded">imagePublishMode</code> ✗</li>
            </ul>
            Two different state fields! Changes in SitePlanningSection didn't affect what processWorkflow read.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Changed SitePlanningSection and TestRunnerPopup to use <code className="bg-slate-900 px-1 rounded">wpPublishMode</code>:
            <pre className="bg-slate-900 p-2 rounded mt-1 text-xs overflow-x-auto">{`// App.tsx - SitePlanningSection props (was imagePublishMode)
imagePublishMode={currentProject?.state?.wpPublishMode || 'draft'}
onImagePublishModeChange={(mode) => setCurrentProjectState(prev => ({ ...prev, wpPublishMode: mode }))}

// App.tsx - TestRunnerPopup props (was imagePublishMode)
currentImageMode={currentProject?.state?.wpPublishMode || 'draft'}`}</pre>
          </div>
          <div className="text-sm text-green-400 mt-2">
            <strong>Key Files:</strong> App.tsx (lines 2235, 4357, 4360)
          </div>
          <div className="text-sm text-amber-400 mt-2">
            <strong>REMEMBER:</strong> The canonical field for image toggle is <code className="bg-slate-900 px-1 rounded">wpPublishMode</code>
            (values: 'off' | 'draft' | 'wordpress'). Never use imagePublishMode - it's a legacy field that causes this bug.
          </div>
        </div>

        {/* Feb 5 - Em dash formatting in titles */}
        <div className="bg-slate-800 rounded-lg p-4 border-2 border-green-500">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">H1 titles showing "TN." instead of "TN —" (em dash)</span>
            <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">Feb 5, 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> Page titles like "House Cleaning in Hendersonville, TN. Professional Services"
            should show "TN —" (em dash) but were showing "TN." (period).
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Root cause:</strong> Two issues in <code className="bg-slate-900 px-1 rounded">elementor-builder.js</code>:
            <ul className="list-disc ml-4 mt-1">
              <li>Title fallback path (line 713) didn't call <code className="bg-slate-900 px-1 rounded">formatHeadlineWithEmDash()</code></li>
              <li>First sentence extraction regex split titles at state abbreviation periods (e.g., "TN.")</li>
            </ul>
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong>
            <ul className="list-disc ml-4 mt-1">
              <li>Added <code className="bg-slate-900 px-1 rounded">formatHeadlineWithEmDash(title)</code> to fallback path</li>
              <li>Added state abbreviation detection to prevent splitting at ", STATE." patterns</li>
            </ul>
          </div>
          <div className="text-sm text-green-400 mt-2">
            <strong>Key Files:</strong> server/services/elementor-builder.js (lines 606-660, 713)
          </div>
          <div className="text-sm text-amber-400 mt-2">
            <strong>Pattern:</strong> <code className="bg-slate-900 px-1 rounded">,\\s*[A-Z]{'{2}'}\\.\\s+</code> matches ", TN. "
            and replaces with ", TN — ". The <code className="bg-slate-900 px-1 rounded">formatHeadlineWithEmDash()</code> function
            handles this globally.
          </div>
        </div>

        {/* Feb 4 - Tag stripping in prompt-filler.ts */}
        <div className="bg-slate-800 rounded-lg p-4 border-2 border-green-500">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Tags (H), (J), (C) appearing in AI-generated content headings</span>
            <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">CRITICAL - Feb 4, 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> Tags like "(C)" were appearing in H1/H2 headings on published WordPress pages.
            "Phase Cleaning Out(C)" showed up everywhere - hero title, all H2 headings, FAQ questions.
            H and J articles were clean, but C articles had tags throughout.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Root cause:</strong> In <code className="bg-slate-900 px-1 rounded">src/engine/prompt-filler.ts</code> line 76,
            <code className="bg-slate-900 px-1 rounded">{'{item_name}'}</code> was replaced with <code className="bg-slate-900 px-1 rounded">item.name</code>
            which included the tag. When prompts said "Write about {'{item_name}'}", the AI received "Phase Cleaning Out(C)"
            and included it in all generated headings. The tag is for INTERNAL routing (image matching, component selection),
            not for display.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Modified prompt-filler.ts to strip tag before inserting:
            <pre className="bg-slate-900 p-2 rounded mt-1 text-xs overflow-x-auto">{`const cleanItemName = item.name.replace(/\\s*\\([A-Za-z]\\)\\s*$/, '').trim();
filled = filled.replace(/{item_name}/g, cleanItemName);`}</pre>
          </div>
          <div className="text-sm text-green-400 mt-2">
            <strong>Key Files:</strong> src/engine/prompt-filler.ts (line 76-80), server/db/migrations/031_fix_c_article_tags.sql
          </div>
          <div className="text-sm text-amber-400 mt-2">
            <strong>NEVER UNDO:</strong> The tag stripping in prompt-filler.ts is CRITICAL. Tags must stay for internal use
            (stored in keyword field, used for image/component matching) but must NEVER reach the AI or WordPress.
          </div>
        </div>

        {/* Feb 4 - Slider Revolution module name */}
        <div className="bg-slate-800 rounded-lg p-4 border-2 border-green-500">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Slider Revolution widgets showing "alias not found" errors</span>
            <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">Feb 4, 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> SR sliders appeared on WordPress but showed error messages like "floridahellohome-1 not found".
            Component Library only had Alias + Display Name fields.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Root cause:</strong> Slider Revolution widgets need TWO settings:
            <ul className="list-disc ml-4 mt-1">
              <li><code className="bg-slate-900 px-1 rounded">revslidertitle</code> - Module Name (SR's internal name like "Residential")</li>
              <li><code className="bg-slate-900 px-1 rounded">shortcode</code> - Alias (like "home-1")</li>
            </ul>
            We only had one field, so the module name was wrong.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Added <code className="bg-slate-900 px-1 rounded">module_name</code> column (migration 030)
            and Module Name field in Component Library UI. Updated elementor-builder.js to use both values.
          </div>
          <div className="text-sm text-green-400 mt-2">
            <strong>Key Files:</strong> server/db/migrations/030_add_slider_module_name.sql, ComponentLibrarySection.tsx,
            component-library-service.js, elementor-builder.js (buildSliderRevolutionWidget)
          </div>
        </div>

        {/* Feb 4 - Keyword undefined in publish requests */}
        <div className="bg-slate-800 rounded-lg p-4 border border-green-500/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Component tag matching not working (keyword undefined)</span>
            <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded">Feb 4, 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> Component Library tag matching (H/J/C articles getting matching components) wasn't working.
            Server logs showed "keyword received: undefined".
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Root cause:</strong> Frontend publish requests weren't sending the <code className="bg-slate-900 px-1 rounded">keyword</code>
            parameter. The raw keyword (with tag) is needed to extract the tag for component matching.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Added <code className="bg-slate-900 px-1 rounded">keyword: selectedArticle.keyword</code> to ALL publish calls:
            ArticleListView.tsx (3 places), ArticleManager.tsx (1), drip-feed.js (1), drip-feed-scheduler.js (1).
          </div>
        </div>

        {/* Jan 20 - Template persistence FULLY FIXED */}
        <div className="bg-slate-800 rounded-lg p-4 border-2 border-green-500">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Prompt Templates not persisting ("No templates saved yet")</span>
            <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">CRITICAL - Jan 20, 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> Users saved templates in Prompt Templates popup, but after page refresh they saw
            "No templates saved yet". Templates appeared to save but weren't persisting to database.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Root cause (MULTI-LAYER):</strong>
            <ul className="list-disc ml-4 mt-1 space-y-1">
              <li>Frontend sent <code className="bg-slate-900 px-1 rounded">placeholder_category_templates</code> but server expected <code className="bg-slate-900 px-1 rounded">category_templates</code></li>
              <li>GET endpoint wasn't returning template fields in response</li>
              <li>MAIN ISSUE: Fallback INSERT/UPDATE queries were missing template columns! Main queries had them, but when fallback path executed, data was lost</li>
            </ul>
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> 1) Changed 9 occurrences in ImageCreationSection.tsx to use <code className="bg-slate-900 px-1 rounded">category_templates</code>.
            2) Added template fields to GET response. 3) Added template columns to ALL 4 fallback queries in image-creation.js.
          </div>
          <div className="text-sm text-green-400 mt-2">
            <strong>Pattern:</strong> See Golden Rule #14 - Fallback INSERT/UPDATE queries MUST include ALL columns
          </div>
        </div>

        {/* Jan 20 - Regenerate image fix */}
        <div className="bg-slate-800 rounded-lg p-4 border border-green-500/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Regenerate Image stored base64 instead of WP URL</span>
            <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded">Jan 20, 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> <code className="bg-slate-900 px-1 rounded">/api/articles/:id/regenerate-image</code> endpoint was storing
            raw base64 data (~1MB per image) instead of uploading to WordPress first.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Added uploadMedia import and call to upload base64 to staging WordPress before storing.
            Now stores WP URL (~100 bytes) with wpMediaId preserved for final push.
          </div>
          <div className="text-sm text-green-400 mt-2">
            <strong>Pattern:</strong> See Golden Rule #13 - ALL generated images MUST go through WordPress BEFORE storage
          </div>
        </div>

        {/* Jan 18 - Persistence fixes */}
        <div className="bg-slate-800 rounded-lg p-4 border border-emerald-500/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">AI Prompt Assistant chat history disappearing on refresh</span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Jan 18, 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> Every time the page refreshed, all conversation history with the AI Prompt Assistant was lost.
            User spent hours writing prompts in chat, only to lose everything on refresh. This happened MANY times despite multiple attempted fixes.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Root cause:</strong> <code className="bg-slate-900 px-1 rounded">useState([])</code> for messages never loaded from
            <code className="bg-slate-900 px-1 rounded">settings.consultant_chat_history</code>. The database HAD the data, but React just ignored it.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Added <code className="bg-slate-900 px-1 rounded">useEffect</code> to load messages from database on mount (lines 1215-1222).
            Added <code className="bg-slate-900 px-1 rounded">updateSettings()</code> call after every message change (line 3352-3355).
          </div>
          <div className="text-sm text-emerald-400 mt-2">
            <strong>Pattern:</strong> See Golden Rule #12 - Chat history must sync with database on mount
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-emerald-500/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">mainPrompt getting randomly erased</span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Jan 18, 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> User's carefully crafted mainPrompt (image generation prompt) would randomly get erased.
            Hours of work lost. User had to copy/paste prompt from external backup constantly.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Root cause:</strong> Race conditions, stale React state, and partial saves would overwrite the rich prompt with empty/partial data.
            When updating just one avatar field, sometimes the whole mainPrompt got wiped.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Dual-layer protection - Frontend blocks suspicious &gt;200 to &lt;100 char drops in handleUpdateAvatar() and updateSettings().
            Server preserves existing data in image-creation.js before any UPDATE.
          </div>
          <div className="text-sm text-emerald-400 mt-2">
            <strong>Pattern:</strong> See Golden Rule #11 - PROTECT mainPrompt and avatar data from accidental erasure
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-brand-cyan/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Template Library silent failures</span>
            <span className="text-xs bg-brand-cyan/20 text-brand-cyan px-2 py-0.5 rounded">Jan 15, 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> When Template Library API call failed, the UI showed nothing - no error message, just empty state.
            Users thought there were no templates when actually the server was returning errors.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Added proper error state and display in <code className="bg-slate-900 px-1 rounded">TemplateLibrary.tsx</code>.
            Now shows red error text with the actual error message and a "Retry" button.
          </div>
          <div className="text-sm text-red-400 mt-2">
            <strong>Pattern:</strong> Always catch and DISPLAY API errors - never silently swallow them!
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-brand-gold/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Image Bank settings read from wrong level</span>
            <span className="text-xs bg-brand-gold/20 text-brand-gold px-2 py-0.5 rounded">CRITICAL - Jan 15, 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> Image Bank matching code was only reading settings from <code className="bg-slate-900 px-1 rounded">workflow_id</code>.
            But settings are now saved at <code className="bg-slate-900 px-1 rounded">website_id</code> level. Result: changes in UI had no effect.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Updated all image bank service functions to check <code className="bg-slate-900 px-1 rounded">website_id</code> FIRST,
            then fall back to <code className="bg-slate-900 px-1 rounded">workflow_id</code>. Same pattern as elementor.js.
          </div>
          <div className="text-sm text-red-400 mt-2">
            <strong>CRITICAL:</strong> This is the same bug pattern as "Main Prompt not reflecting" - always check both levels!
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-brand-cyan/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">smart_matching_mode not persisting on save</span>
            <span className="text-xs bg-brand-cyan/20 text-brand-cyan px-2 py-0.5 rounded">Jan 15, 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> Changing bank fallback mode (bank_first vs bank_only) in UI didn't stick after page refresh.
            The toggle would flip back to default.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Added <code className="bg-slate-900 px-1 rounded">tryUpdateSmartMatchingMode()</code> as a separate
            function that explicitly updates just the smart_matching_mode column. Ensures it's saved even if other fields have issues.
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-brand-cyan/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Test Runner using wrong bank mode</span>
            <span className="text-xs bg-brand-cyan/20 text-brand-cyan px-2 py-0.5 rounded">Jan 15, 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> Test Runner "Pull from Bank" option was setting <code className="bg-slate-900 px-1 rounded">bank_only</code>
            which means if no bank images match, it returns nothing - no fallback to live generation.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Changed to <code className="bg-slate-900 px-1 rounded">bank_first</code> so it will try bank first,
            then fall back to live generation if bank is empty. This matches expected user behavior.
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">workflowId race condition causing "Unknown error"</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> On fresh page load, clicking "Start Workflow" too fast resulted in "WordPress publish failed: Unknown error"
            because <code className="bg-slate-900 px-1 rounded">currentWorkflowId</code> was still undefined.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Added validation in <code className="bg-slate-900 px-1 rounded">App.tsx</code> before publish calls.
            Now shows clear message: "Workflow not fully loaded. Please wait a moment and try again."
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Staging WordPress credentials fallback removed</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> The batch-generate endpoint was falling back to workflow's "Publishing to WordPress" credentials
            when staging credentials weren't configured. This is wrong - staging credentials should ONLY come from WordPress Settings.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Removed fallback logic in <code className="bg-slate-900 px-1 rounded">server/routes/image-creation.js</code>.
            Now returns 400 error if staging credentials not configured, with message directing to WordPress Settings.
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Image Creation settings 500 error on save</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> PUT <code className="bg-slate-900 px-1 rounded">/api/image-creation/settings/:workflowId</code> returned 500
            because code used invalid SQL syntax: nested template literals like <code className="bg-slate-900 px-1 rounded">WHERE $&#123;condition ? sql`col=X` : sql`col=Y`&#125;</code>
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Replaced with if/else blocks using separate SQL queries.
            File: <code className="bg-slate-900 px-1 rounded">server/routes/image-creation.js</code> lines ~1520-1680.
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">website_id column doesn't exist error</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> Image Creation settings save failed with "column website_id does not exist"
            because the website-level settings feature requires a migration that may not have run.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Added try-catch around website_id queries. If column doesn't exist, falls back to workflow-level settings.
            Migration file: <code className="bg-slate-900 px-1 rounded">server/db/migrations/012_image_creation_website_level.sql</code>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">guided_guardrails column doesn't exist error</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> INSERT into image_creation_settings failed because <code className="bg-slate-900 px-1 rounded">guided_guardrails</code>
            column doesn't exist. The fallback check only looked for <code className="bg-slate-900 px-1 rounded">live_prompt_mode</code>.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Added <code className="bg-slate-900 px-1 rounded">guided_guardrails</code> and <code className="bg-slate-900 px-1 rounded">prompt_problem_areas</code>
            to the INSERT fallback check at line ~1429 in <code className="bg-slate-900 px-1 rounded">server/routes/image-creation.js</code>.
          </div>
        </div>

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

        <div className="bg-slate-800 rounded-lg p-4 border border-brand-gold/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">502 Timeout "WordPress publish failed: Unknown error"</span>
            <span className="text-xs bg-brand-gold/20 text-brand-gold px-2 py-0.5 rounded">MAJOR FIX</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> Intermittent 502 gateway timeout errors when generating 5 images with gpt-image-1.5.
            The publish endpoint was generating images <em>sequentially</em> (one at a time), taking ~300 seconds for 5 images -
            far exceeding Railway's 100-second request timeout.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Added parallel image generation in <code className="bg-slate-900 px-1 rounded">server/services/image-generator.js</code>.
            Images now generate concurrently (5 at once for OpenAI, 3 for Replicate). Also parallelized WordPress uploads in
            <code className="bg-slate-900 px-1 rounded">server/services/image-pipeline.js</code>.
          </div>
          <div className="text-sm text-green-400 mt-2">
            <strong>Result:</strong> 5 images now generate in ~22 seconds (down from ~300 seconds).
            Total batch time dropped from ~5+ minutes to under 1 minute. <strong>13x speedup!</strong>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-brand-cyan/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Draft Image Bank not displaying images</span>
            <span className="text-xs bg-brand-cyan/20 text-brand-cyan px-2 py-0.5 rounded">Jan 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> Draft Image Bank showed stats (249 draft) but grid said "No draft images yet".
            Error log: <code className="bg-slate-900 px-1 rounded">[Draft Image Bank] Get error: {'{}'}</code>
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> <code className="bg-slate-900 px-1 rounded">sql.unsafe()</code> was throwing empty errors.
            Rewrote <code className="bg-slate-900 px-1 rounded">getDraftImageBank()</code> in <code className="bg-slate-900 px-1 rounded">server/services/draft-image-bank.js</code>
            to use tagged templates with conditional NULL checks (matching pattern used by working stats endpoint).
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-brand-cyan/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Draft Bank header showed 0 until opened</span>
            <span className="text-xs bg-brand-cyan/20 text-brand-cyan px-2 py-0.5 rounded">Jan 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> Header showed "Draft Image Bank (0 in draft)" even with 249 images,
            because stats only loaded when section was opened.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Added <code className="bg-slate-900 px-1 rounded">fetchDraftBankStatsOnly()</code> function
            that runs on component mount. Stats now display correctly in collapsed header.
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-brand-gold/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Main Prompt changes not reflected in generated images</span>
            <span className="text-xs bg-brand-gold/20 text-brand-gold px-2 py-0.5 rounded">MAJOR FIX - Jan 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> When editing the Main Prompt in Image Creation settings, the new prompt was saved
            but generated images still used the OLD prompt. This caused confusion where the UI showed one prompt
            but images were generated with a different (hardcoded-looking) prompt.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Root Cause:</strong> Settings were being saved to <code className="bg-slate-900 px-1 rounded">website_id</code> level
            (image-creation.js PUT endpoint), but <code className="bg-slate-900 px-1 rounded">elementor.js</code> was only reading from
            <code className="bg-slate-900 px-1 rounded">workflow_id</code> level - completely missing the website-level settings!
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Updated <code className="bg-slate-900 px-1 rounded">server/routes/elementor.js</code> in TWO places
            (~line 460 and ~line 1210) to:
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>First lookup the workflow's <code className="bg-slate-900 px-1 rounded">website_id</code></li>
              <li>Try fetching settings from <code className="bg-slate-900 px-1 rounded">website_id</code> first</li>
              <li>Only fall back to <code className="bg-slate-900 px-1 rounded">workflow_id</code> if no website settings exist</li>
            </ol>
          </div>
          <div className="text-sm text-red-400 mt-2">
            <strong>IMPORTANT:</strong> If this issue recurs, check that elementor.js checks website_id BEFORE workflow_id!
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-brand-gold/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">fallback_prompt_mode not being saved to database</span>
            <span className="text-xs bg-brand-gold/20 text-brand-gold px-2 py-0.5 rounded">MAJOR FIX - Jan 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> When selecting Main Prompt in "Generate Live" mode, images were generated using
            Legacy/Smart Prompt instead. The UI showed Main Prompt was selected, but wrong images were produced.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Root Cause:</strong> The <code className="bg-slate-900 px-1 rounded">fallback_prompt_mode</code> setting was completely missing from:
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Database schema (no column existed)</li>
              <li>Server PUT handler (not extracting from request body)</li>
              <li>Server INSERT/UPDATE queries (not saving to database)</li>
              <li>Server GET response (not returning to frontend)</li>
            </ol>
            The UI let users select it, but it was never persisted - defaulted to 'smart_prompt' on publish.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Added <code className="bg-slate-900 px-1 rounded">fallback_prompt_mode</code> column to:
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li><code className="bg-slate-900 px-1 rounded">server/db/schema.sql</code> - CREATE TABLE and migration</li>
              <li><code className="bg-slate-900 px-1 rounded">server/routes/image-creation.js</code> - GET, PUT, INSERT, UPDATE</li>
            </ul>
          </div>
          <div className="text-sm text-red-400 mt-2">
            <strong>IMPORTANT:</strong> When adding new settings, check: schema column, PUT extraction, INSERT/UPDATE queries, GET response!
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-brand-gold/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="font-semibold text-white">Test Mode toggles not working (draft pushed to WP)</span>
            <span className="text-xs bg-brand-gold/20 text-brand-gold px-2 py-0.5 rounded">Jan 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Problem:</strong> When using Test Mode, setting Article/Meta/Image to "Draft" mode still
            pushed content to WordPress. The toggles appeared to do nothing.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Root Cause:</strong> Two issues:
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li><strong>React async state:</strong> <code className="bg-slate-900 px-1 rounded">setCurrentProjectState()</code> doesn't update immediately.
                  When <code className="bg-slate-900 px-1 rounded">processWorkflow()</code> was called right after, it read STALE values from the closure.</li>
              <li><strong>Wrong field name:</strong> Test runner was setting <code className="bg-slate-900 px-1 rounded">imagePublishMode</code>
                  but processWorkflow reads <code className="bg-slate-900 px-1 rounded">wpPublishMode</code></li>
            </ol>
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Fix:</strong> Modified <code className="bg-slate-900 px-1 rounded">processWorkflow()</code> in <code className="bg-slate-900 px-1 rounded">App.tsx</code>
            to accept optional <code className="bg-slate-900 px-1 rounded">publishModeOverrides</code> parameter. Test runner now passes modes directly,
            bypassing React state entirely.
          </div>
        </div>
      </div>
    </div>

    {/* New Features Added */}
    <div className="bg-blue-900/20 rounded-xl p-6 border border-blue-500">
      <h3 className="text-lg font-bold text-blue-400 mb-4">New Features Added (Jan 2026)</h3>

      <div className="space-y-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-400">★</span>
            <span className="font-semibold text-white">Image Recycle Feature (Testing Mode)</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Purpose:</strong> Recycle test images back to Image Bank instead of wasting them.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Features:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li><strong>Draft Bank → Image Bank:</strong> "Recycle All to Image Bank" button copies draft images to reusable bank</li>
              <li><strong>Used/Archive → Available:</strong> "Restore All to Available" button marks used images as available again</li>
              <li>Images keep all metadata (tags, category, avatar tag, etc.)</li>
              <li>After recycle, images are removed from Draft Bank to prevent duplicates</li>
            </ul>
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Files:</strong> <code className="bg-slate-900 px-1 rounded">server/services/image-bank.js</code>,
            <code className="bg-slate-900 px-1 rounded">server/routes/image-bank.js</code>,
            <code className="bg-slate-900 px-1 rounded">src/components/ImageCreationSection.tsx</code>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-400">★</span>
            <span className="font-semibold text-white">Image Selection & Expand All View</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Purpose:</strong> Quickly review and select images for recycling/restoring.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Features:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li><strong>Selection checkboxes:</strong> Click images or checkboxes to select in Draft Bank and Used/Archive</li>
              <li><strong>Select All/Deselect All:</strong> Quick bulk selection buttons</li>
              <li><strong>Expand All button:</strong> Opens full-screen scrollable grid with full-size images</li>
              <li><strong>Single image expand:</strong> Click expand icon on any thumbnail to preview full-size</li>
              <li><strong>Refresh button:</strong> Manual refresh for Draft Bank images</li>
            </ul>
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Location:</strong> Image Bank section → Draft Image Bank / Used Archive panels
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-red-500/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-400">★</span>
            <span className="font-semibold text-white">Test Mode - Image Pipeline Tester</span>
            <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded">Jan 2026</span>
          </div>
          <div className="text-sm text-gray-400">
            <strong>Purpose:</strong> Test all 4 image source configurations without manually changing settings.
            Uses the REAL workflow paths to verify everything works end-to-end.
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>4 Image Sources:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li><strong>Pull from Bank:</strong> Uses existing images from Image Bank</li>
              <li><strong>Generate Live - Main Prompt:</strong> Uses avatar's mainPrompt template with smart matching</li>
              <li><strong>Generate Live - Guided GPT:</strong> Uses GPT-4o with guardrails to create prompts</li>
              <li><strong>Generate Live - Smart Prompt:</strong> Legacy mode, analyzes article content</li>
            </ul>
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Toggle Settings:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li><strong>Article:</strong> Draft (save to DB only) or WP (create WordPress page)</li>
              <li><strong>Meta:</strong> Draft (save to DB only) or WP (push SEO meta to page)</li>
              <li><strong>Image:</strong> Off, Draft (process but don't embed), or WP (full embed)</li>
            </ul>
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Files:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li><code className="bg-slate-900 px-1 rounded">src/components/TestRunnerPopup.tsx</code> - The popup UI</li>
              <li><code className="bg-slate-900 px-1 rounded">App.tsx</code> - <code className="bg-slate-900 px-1 rounded">runTestSequence()</code> function, <code className="bg-slate-900 px-1 rounded">processWorkflow()</code> with overrides</li>
            </ul>
          </div>
          <div className="text-sm text-yellow-400 mt-2">
            <strong>IMPORTANT:</strong> Toggles bypass React state - values are passed directly to processWorkflow()
            via <code className="bg-slate-900 px-1 rounded">publishModeOverrides</code> parameter. Do NOT rely on <code className="bg-slate-900 px-1 rounded">setCurrentProjectState()</code>
            for immediate reads!
          </div>
          <div className="text-sm text-gray-400 mt-2">
            <strong>Location:</strong> Small red "Test" button next to "Or, upload TXT file" in Site Planning section
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
        <div className="flex items-start gap-2">
          <span className="text-yellow-400">⚠</span>
          <div className="text-gray-300">
            <strong>React state is async - don't read after set!</strong> If you call <code className="bg-slate-900 px-1 rounded">setCurrentProjectState()</code>
            and immediately read from <code className="bg-slate-900 px-1 rounded">currentProject.state</code>, you get the OLD value.
            Use callback parameters or pass values directly to functions instead.
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-yellow-400">⚠</span>
          <div className="text-gray-300">
            <strong>Website vs Workflow settings mismatch:</strong> Settings can be stored at website_id OR workflow_id level.
            If UI edits don't reflect in backend behavior, check if the save is going to one table
            but the read is coming from another!
          </div>
        </div>
      </div>
    </div>

    {/* Smart Matching Mode Quick Reference */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-gold/30">
      <h3 className="text-lg font-bold text-brand-gold mb-4">smart_matching_mode Quick Reference</h3>
      <p className="text-gray-400 text-sm mb-4">This setting controls WHERE images come from and whether fallback is allowed. Very important!</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-600">
              <th className="text-left py-2 text-gray-400">Mode</th>
              <th className="text-left py-2 text-gray-400">Primary Source</th>
              <th className="text-left py-2 text-gray-400">If Empty...</th>
              <th className="text-left py-2 text-gray-400">Use Case</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-slate-700">
              <td className="py-2"><code className="text-brand-gold">bank_first</code></td>
              <td>Image Bank</td>
              <td className="text-green-400">Falls back to Live generation</td>
              <td>Best default - use bank when available, generate otherwise</td>
            </tr>
            <tr className="border-b border-slate-700">
              <td className="py-2"><code className="text-brand-gold">bank_only</code></td>
              <td>Image Bank</td>
              <td className="text-red-400">Fails / No images</td>
              <td>When you only want pre-approved bank images, no AI generation</td>
            </tr>
            <tr className="border-b border-slate-700">
              <td className="py-2"><code className="text-brand-gold">generate_first</code></td>
              <td>Live AI Generation</td>
              <td className="text-green-400">Falls back to Bank</td>
              <td>Prefer fresh AI images, use bank if generation fails</td>
            </tr>
            <tr className="border-b border-slate-700">
              <td className="py-2"><code className="text-brand-gold">generate_only</code></td>
              <td>Live AI Generation</td>
              <td className="text-red-400">Fails / No images</td>
              <td>Always generate fresh, never use bank</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 p-3 bg-yellow-900/30 rounded-lg text-xs text-yellow-300">
        <strong>TIP:</strong> Use <code className="bg-slate-900 px-1 rounded">bank_first</code> as the default for most workflows.
        It ensures you always get images - either from bank or freshly generated. Changed from <code className="bg-slate-900 px-1 rounded">bank_only</code>
        in Test Runner (Jan 15, 2026) because <code className="bg-slate-900 px-1 rounded">bank_only</code> was causing empty results when bank was empty.
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

// Drip Feed Diagram - Comprehensive documentation for auto-publishing system
const DripFeedDiagram: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-brand-cyan mb-2">Drip Feed System</h2>
      <p className="text-gray-400">Automated article publishing with smart scheduling and push notifications</p>
    </div>

    {/* Status: Fully Implemented */}
    <div className="bg-green-900/20 rounded-xl p-6 border border-green-500">
      <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
        Status: Fully Implemented (Jan 2026)
      </h3>
      <p className="text-sm text-gray-300 mb-4">
        Complete drip feed system with calendar view, smart scheduling, and Pushover push notifications.
      </p>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-green-400 font-semibold mb-2">Scheduling</div>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>✓ Articles per day with variance</li>
            <li>✓ Time window (e.g., 7am-7pm)</li>
            <li>✓ Skip specific dates</li>
            <li>✓ Skip weekly days</li>
          </ul>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-green-400 font-semibold mb-2">Automation</div>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>✓ Cron job every 5 minutes</li>
            <li>✓ <strong>Hybrid Sleep</strong> - skips heavy work when queue empty</li>
            <li>✓ Auto-publish due articles</li>
            <li>✓ Retry on failure</li>
            <li>✓ Startup catch-up</li>
          </ul>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-green-400 font-semibold mb-2">Notifications</div>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>✓ Pushover push notifications</li>
            <li>✓ Multi-user support</li>
            <li>✓ Configurable alert types</li>
            <li>✓ Test notification button</li>
          </ul>
        </div>
      </div>
    </div>

    {/* Architecture Overview */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">System Architecture</h3>
      <div className="bg-slate-900 rounded-lg p-4">
        <pre className="text-xs text-gray-300 overflow-x-auto">{`
┌─────────────────────────────────────────────────────────────────────────┐
│                           DRIP FEED FLOW                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐     │
│   │  Articles    │───▶│  Add to      │───▶│  drip_feed_schedules │     │
│   │  (selected)  │    │  Drip Feed   │    │  (database queue)    │     │
│   └──────────────┘    └──────────────┘    └──────────────────────┘     │
│                                                      │                  │
│                                                      ▼                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐     │
│   │  Pushover    │◀───│  Scheduler   │◀───│  node-cron           │     │
│   │  (notify)    │    │  (publishes) │    │  (every 5 min)       │     │
│   └──────────────┘    └──────────────┘    └──────────────────────┘     │
│          │                   │                                          │
│          ▼                   ▼                                          │
│   ┌──────────────┐    ┌──────────────┐                                 │
│   │  Phone App   │    │  WordPress   │                                 │
│   └──────────────┘    │  (Images →   │                                 │
│                       │   Page →     │                                 │
│                       │   Meta)      │                                 │
│                       └──────────────┘                                 │
└─────────────────────────────────────────────────────────────────────────┘
`}</pre>
      </div>
    </div>

    {/* Hybrid Sleep Optimization (Feb 2026) */}
    <div className="bg-purple-900/20 rounded-xl p-6 border border-purple-500/50">
      <h3 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
        Hybrid Sleep Optimization (Feb 2026)
      </h3>
      <p className="text-sm text-gray-300 mb-4">
        The cron still ticks every 5 minutes, but does a fast check first to avoid wasted cycles when queue is empty.
      </p>
      <div className="bg-slate-900 rounded-lg p-4 mb-4">
        <pre className="text-xs text-gray-300 overflow-x-auto">{`
// In drip-feed-scheduler.js runDripFeedCycle()

1. Fast COUNT(*) query: SELECT COUNT(*) FROM drip_feed_schedules WHERE status = 'pending'
   └─ Takes <1ms, no joins, no timezone calculations

2. If count === 0:
   └─ Log "💤 Queue empty, sleeping" (only first time, then hourly)
   └─ Return immediately - skip all heavy work
   └─ Notification checker also skips via consecutiveEmptyChecks counter

3. If count > 0:
   └─ Reset counter, proceed with full processing
   └─ Get pending articles with timezone settings
   └─ Filter by due date/time
   └─ Publish due articles (Images → Page → Meta)
`}</pre>
      </div>
      <div className="text-xs text-gray-400">
        <strong>Why:</strong> Saves Railway resources during development when drip feed isn't being used.
        The scheduler was firing every 5 minutes with expensive queries even with zero articles queued.
      </div>
    </div>

    {/* File Locations */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-gold/30">
      <h3 className="text-lg font-bold text-brand-gold mb-4">Key File Locations</h3>
      <div className="space-y-3">
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-brand-cyan font-mono text-sm">Frontend</span>
          </div>
          <ul className="text-xs text-gray-300 space-y-1 font-mono">
            <li><code className="text-brand-gold">src/components/articles/DripFeedView.tsx</code> - Main UI component</li>
          </ul>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-brand-cyan font-mono text-sm">Backend</span>
          </div>
          <ul className="text-xs text-gray-300 space-y-1 font-mono">
            <li><code className="text-brand-gold">server/routes/drip-feed.js</code> - API endpoints (17 routes)</li>
            <li><code className="text-brand-gold">server/services/drip-feed-scheduler.js</code> - Cron scheduler</li>
            <li><code className="text-brand-gold">server/services/pushover.js</code> - Push notification service</li>
          </ul>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-brand-cyan font-mono text-sm">Database</span>
          </div>
          <ul className="text-xs text-gray-300 space-y-1 font-mono">
            <li><code className="text-brand-gold">server/db/migrations/015_drip_feed_system.sql</code> - Main schema</li>
            <li><code className="text-brand-gold">server/db/migrations/016_add_pushover_columns.sql</code> - Pushover columns</li>
          </ul>
        </div>
      </div>
    </div>

    {/* Database Tables */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">Database Tables</h3>

      <div className="space-y-4">
        {/* drip_feed_settings */}
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-gold font-semibold mb-2">drip_feed_settings</h4>
          <p className="text-xs text-gray-400 mb-2">Per-website scheduling configuration</p>
          <pre className="text-xs text-gray-300 overflow-x-auto">{`articles_per_day INTEGER DEFAULT 7
variance_enabled BOOLEAN DEFAULT true      -- Random between min/max
variance_min INTEGER DEFAULT 6
variance_max INTEGER DEFAULT 8
publish_time_start TIME DEFAULT '07:00'   -- Earliest publish time
publish_time_end TIME DEFAULT '19:00'     -- Latest publish time
skip_weekdays JSONB DEFAULT '[]'          -- [0,6] for Sun, Sat
skip_dates JSONB DEFAULT '[]'             -- ["2026-01-20"]
is_enabled BOOLEAN DEFAULT false          -- Master toggle`}</pre>
        </div>

        {/* drip_feed_schedules */}
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-gold font-semibold mb-2">drip_feed_schedules</h4>
          <p className="text-xs text-gray-400 mb-2">The hopper - individual article schedules</p>
          <pre className="text-xs text-gray-300 overflow-x-auto">{`article_id INTEGER UNIQUE              -- One schedule per article
scheduled_date DATE NOT NULL
scheduled_time TIME NOT NULL
status VARCHAR(20) DEFAULT 'pending'   -- pending, publishing, published, failed
wp_post_id INTEGER                     -- WordPress post ID after publish
wp_post_url TEXT                       -- WordPress URL after publish
attempts INTEGER DEFAULT 0             -- Retry count
is_manual_time BOOLEAN DEFAULT false   -- User manually set time`}</pre>
        </div>

        {/* notification_settings */}
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-gold font-semibold mb-2">notification_settings</h4>
          <p className="text-xs text-gray-400 mb-2">Pushover push notification configuration</p>
          <pre className="text-xs text-gray-300 overflow-x-auto">{`pushover_enabled BOOLEAN DEFAULT false
pushover_user_keys JSONB DEFAULT '[]'  -- Array of { key, name, enabled }
notify_on_publish BOOLEAN DEFAULT false     -- Notify on success
notify_on_failure BOOLEAN DEFAULT true      -- Notify on failure
notify_on_missing_meta BOOLEAN DEFAULT true -- Meta not selected
notify_daily_summary BOOLEAN DEFAULT false  -- Daily stats
notify_queue_empty BOOLEAN DEFAULT true     -- Queue empty warning`}</pre>
        </div>
      </div>
    </div>

    {/* API Endpoints */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
      <h3 className="text-lg font-bold text-purple-400 mb-4">API Endpoints</h3>
      <p className="text-xs text-gray-400 mb-4">All routes prefixed with <code className="bg-slate-900 px-1 rounded">/api/drip-feed</code></p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-cyan font-semibold mb-2">Settings</h4>
          <ul className="text-xs text-gray-300 space-y-1 font-mono">
            <li><span className="text-green-400">GET</span> /settings/:websiteId</li>
            <li><span className="text-yellow-400">PUT</span> /settings/:websiteId</li>
          </ul>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-cyan font-semibold mb-2">Schedule Management</h4>
          <ul className="text-xs text-gray-300 space-y-1 font-mono">
            <li><span className="text-green-400">GET</span> /schedule/:websiteId</li>
            <li><span className="text-blue-400">POST</span> /schedule/:websiteId</li>
            <li><span className="text-yellow-400">PUT</span> /schedule/:websiteId/:scheduleId</li>
            <li><span className="text-red-400">DEL</span> /schedule/:websiteId/:scheduleId</li>
          </ul>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-cyan font-semibold mb-2">Calendar & Stats</h4>
          <ul className="text-xs text-gray-300 space-y-1 font-mono">
            <li><span className="text-green-400">GET</span> /calendar/:websiteId</li>
            <li><span className="text-green-400">GET</span> /stats/:websiteId</li>
            <li><span className="text-green-400">GET</span> /log/:websiteId</li>
          </ul>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-cyan font-semibold mb-2">Processing & Notifications</h4>
          <ul className="text-xs text-gray-300 space-y-1 font-mono">
            <li><span className="text-green-400">GET</span> /due</li>
            <li><span className="text-blue-400">POST</span> /process</li>
            <li><span className="text-green-400">GET</span> /notifications/settings</li>
            <li><span className="text-yellow-400">PUT</span> /notifications/settings</li>
            <li><span className="text-blue-400">POST</span> /notifications/test</li>
          </ul>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-cyan font-semibold mb-2">Test Mode</h4>
          <ul className="text-xs text-gray-300 space-y-1 font-mono">
            <li><span className="text-blue-400">POST</span> /test-schedule/:websiteId</li>
            <li><span className="text-blue-400">POST</span> /process-now</li>
            <li><span className="text-green-400">GET</span> /test-status</li>
          </ul>
        </div>
      </div>
    </div>

    {/* Cron Scheduler */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">Cron Scheduler Service</h3>
      <p className="text-sm text-gray-300 mb-4">
        The scheduler runs automatically when the server starts. It uses <code className="bg-slate-900 px-1 rounded">node-cron</code>
        to check for due articles every 5 minutes.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-gold font-semibold mb-2">How It Works</h4>
          <ol className="text-xs text-gray-300 space-y-2">
            <li><span className="text-brand-cyan">1.</span> Server starts → <code>initDripFeedScheduler()</code></li>
            <li><span className="text-brand-cyan">2.</span> Runs catch-up check (5 second delay)</li>
            <li><span className="text-brand-cyan">3.</span> Cron job runs every 5 minutes: <code>*/5 * * * *</code></li>
            <li><span className="text-brand-cyan">4.</span> Queries for pending articles where datetime ≤ now</li>
            <li><span className="text-brand-cyan">5.</span> Publishes each article: Images → Page → Meta</li>
            <li><span className="text-brand-cyan">6.</span> Updates status to 'published' or 'failed'</li>
            <li><span className="text-brand-cyan">7.</span> Sends Pushover notification if enabled</li>
          </ol>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-gold font-semibold mb-2">Railway Deployment</h4>
          <p className="text-xs text-gray-400 mb-2">For 24/7 operation, deploy to Railway:</p>
          <ol className="text-xs text-gray-300 space-y-1">
            <li>1. Push code to GitHub</li>
            <li>2. Connect Railway to your repo</li>
            <li>3. Add environment variables:
              <ul className="ml-3 mt-1 text-gray-400">
                <li>• <code>DATABASE_URL</code> - Neon connection string</li>
                <li>• <code>PUSHOVER_API_TOKEN</code> - From Pushover app</li>
              </ul>
            </li>
            <li>4. Deploy - server runs 24/7</li>
          </ol>
        </div>
      </div>
    </div>

    {/* Test Mode */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-orange-500/30">
      <h3 className="text-lg font-bold text-orange-400 mb-4">Test Mode - Quick Scheduling</h3>
      <p className="text-sm text-gray-300 mb-4">
        Test Mode allows you to schedule articles 1-4 minutes in the future to test the cron job without waiting.
        Click "Test Mode" button in the Drip Feed UI to access.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-cyan font-semibold mb-2">How to Use</h4>
          <ol className="text-xs text-gray-300 space-y-1">
            <li><span className="text-orange-400">1.</span> Click "Test Mode" button (top right)</li>
            <li><span className="text-orange-400">2.</span> Select articles using checkboxes</li>
            <li><span className="text-orange-400">3.</span> Click timing button: 1 min, 2 min, or Staggered</li>
            <li><span className="text-orange-400">4.</span> Pending box shows scheduled articles</li>
            <li><span className="text-orange-400">5.</span> Wait for cron OR click "Process Now"</li>
            <li><span className="text-orange-400">6.</span> "Process Now" publishes one article at a time</li>
          </ol>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-cyan font-semibold mb-2">Test Mode Panel</h4>
          <ul className="text-xs text-gray-300 space-y-1">
            <li><span className="text-green-400">Current Status</span> - Shows server time, pending count</li>
            <li><span className="text-yellow-400">Quick Schedule</span> - 1 min, 2 min, Staggered (1,2,3,4 min)</li>
            <li><span className="text-blue-400">Process Now</span> - Manually trigger one publish</li>
            <li><span className="text-cyan-400">Pending Box</span> - Horizontal list of scheduled articles</li>
            <li><span className="text-gray-400">Refresh</span> - Auto-updates every 30 seconds</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 bg-slate-900 rounded-lg p-4">
        <h4 className="text-brand-cyan font-semibold mb-2">API Endpoints</h4>
        <div className="grid md:grid-cols-3 gap-4 text-xs">
          <div>
            <code className="text-blue-400">POST</code> <code className="text-brand-gold">/test-schedule/:websiteId</code>
            <p className="text-gray-400 mt-1">Schedule articles for testing</p>
            <pre className="text-gray-500 mt-1">{`{ articleIds, minutesFromNow, clientTime }`}</pre>
          </div>
          <div>
            <code className="text-blue-400">POST</code> <code className="text-brand-gold">/process-now</code>
            <p className="text-gray-400 mt-1">Process ONE due article</p>
            <pre className="text-gray-500 mt-1">{`{ clientTime }`}</pre>
          </div>
          <div>
            <code className="text-green-400">GET</code> <code className="text-brand-gold">/test-status</code>
            <p className="text-gray-400 mt-1">Get pending articles status</p>
            <pre className="text-gray-500 mt-1">{`?clientTime=ISO`}</pre>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-amber-900/20 rounded-lg p-4 border border-amber-500/30">
        <h4 className="text-amber-400 font-semibold mb-2">Important Notes</h4>
        <ul className="text-xs text-gray-300 space-y-1">
          <li>• <strong>Timezone:</strong> Uses your browser's local time (sent as clientTime)</li>
          <li>• <strong>Process Now:</strong> Only processes ONE article per click (controlled testing)</li>
          <li>• <strong>Meta Required:</strong> Articles show "No Meta" if meta not saved</li>
          <li>• <strong>Auto-Save Meta:</strong> Clicking on a meta option auto-saves (no Save button needed)</li>
          <li>• <strong>Cron Still Runs:</strong> Regular cron every 5 min - Process Now is manual trigger</li>
        </ul>
      </div>
    </div>

    {/* Pushover Notifications */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-gold/30">
      <h3 className="text-lg font-bold text-brand-gold mb-4">Pushover Push Notifications</h3>
      <p className="text-sm text-gray-300 mb-4">
        Pushover ($5 one-time purchase per user) provides reliable push notifications to iOS/Android.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-cyan font-semibold mb-2">Setup Steps</h4>
          <ol className="text-xs text-gray-300 space-y-1">
            <li>1. Create account at <code>pushover.net</code></li>
            <li>2. Note your User Key (on dashboard)</li>
            <li>3. Create new application → get API Token</li>
            <li>4. Add <code>PUSHOVER_API_TOKEN</code> to .env</li>
            <li>5. Enable notifications in Drip Feed UI</li>
            <li>6. Add your User Key as a recipient</li>
            <li>7. Click "Test" to verify it works</li>
          </ol>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-cyan font-semibold mb-2">Notification Types</h4>
          <ul className="text-xs text-gray-300 space-y-1">
            <li><span className="text-green-400">published</span> - Article successfully published</li>
            <li><span className="text-red-400">failed</span> - Publish failed (high priority)</li>
            <li><span className="text-yellow-400">no_meta</span> - Missing meta title/description</li>
            <li><span className="text-blue-400">daily_summary</span> - Daily stats summary</li>
            <li><span className="text-orange-400">queue_empty</span> - No more articles queued</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 bg-slate-900 rounded-lg p-4">
        <h4 className="text-brand-cyan font-semibold mb-2">Environment Variable</h4>
        <pre className="text-xs text-gray-300">{`# .env or Railway environment variables
PUSHOVER_API_TOKEN=your-app-api-token-here`}</pre>
      </div>

      <div className="mt-4 bg-slate-900 rounded-lg p-4">
        <h4 className="text-brand-cyan font-semibold mb-2">Multi-User Support</h4>
        <p className="text-xs text-gray-400 mb-2">
          Each person who wants notifications needs their own Pushover account ($5 each).
          Add their User Key to the recipients list. You can enable/disable individual recipients.
        </p>
        <pre className="text-xs text-gray-300">{`// pushover_user_keys JSONB format:
[
  { "key": "uabc123...", "name": "John", "enabled": true },
  { "key": "uxyz789...", "name": "Jane", "enabled": true }
]`}</pre>
      </div>
    </div>

    {/* Pushover Service Code */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">Pushover Service Code</h3>
      <p className="text-xs text-gray-400 mb-2">server/services/pushover.js</p>
      <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs overflow-x-auto">
        <pre className="text-gray-300">{`// Priority levels
export const Priority = {
  LOWEST: -2,    // No notification, just in inbox
  LOW: -1,       // Quiet notification
  NORMAL: 0,     // Normal notification
  HIGH: 1,       // High priority, bypasses quiet hours
  EMERGENCY: 2   // Emergency, requires acknowledgment
};

// Send notification to one or more users
export async function sendPushover(options) {
  const { message, title, userKey, apiToken, priority, url } = options;
  // Sends POST to https://api.pushover.net/1/messages.json
  // Handles single user or array of users
  // Returns { success, partial, results }
}

// Drip feed specific notifications
export async function notifyDripFeed(type, data, userKeys) {
  // Types: published, failed, no_meta, daily_summary, queue_empty
  // Automatically formats message based on type
}`}</pre>
      </div>
    </div>

    {/* Email-to-SMS Notifications (FREE alternative) */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-gold/30">
      <h3 className="text-lg font-bold text-brand-gold mb-4">Email-to-SMS Notifications (FREE)</h3>
      <p className="text-sm text-gray-300 mb-4">
        As an alternative to Pushover, you can use carrier email gateways to send SMS for free.
        Each carrier provides an email address that converts to SMS.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-cyan font-semibold mb-2">How It Works</h4>
          <ol className="text-xs text-gray-300 space-y-1">
            <li>1. Configure SMTP credentials (Gmail, SendGrid)</li>
            <li>2. Add phone number + carrier to recipients</li>
            <li>3. System sends email to carrier gateway</li>
            <li>4. Carrier delivers as SMS to your phone</li>
          </ol>
          <p className="text-xs text-gray-400 mt-2">Example: 5551234567@vtext.com (Verizon)</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-cyan font-semibold mb-2">Supported Carriers</h4>
          <ul className="text-xs text-gray-300 space-y-1 grid grid-cols-2 gap-1">
            <li>• Verizon (@vtext.com)</li>
            <li>• AT&T (@txt.att.net)</li>
            <li>• T-Mobile (@tmomail.net)</li>
            <li>• Sprint (@messaging.sprintpcs.com)</li>
            <li>• US Cellular (@email.uscc.net)</li>
            <li>• Boost (@sms.myboostmobile.com)</li>
            <li>• Cricket (@sms.cricketwireless.net)</li>
            <li>• Metro (@mymetropcs.com)</li>
            <li>• Google Fi (@msg.fi.google.com)</li>
            <li>• Mint/Visible (use carrier network)</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 bg-slate-900 rounded-lg p-4">
        <h4 className="text-brand-cyan font-semibold mb-2">Environment Variables</h4>
        <pre className="text-xs text-gray-300">{`# SMTP config for Email-to-SMS (e.g., Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com`}</pre>
        <p className="text-xs text-gray-400 mt-2">
          For Gmail, use an App Password (not your regular password).
          Go to Google Account → Security → 2-Step Verification → App Passwords.
        </p>
      </div>

      <div className="mt-4 bg-slate-900 rounded-lg p-4">
        <h4 className="text-brand-cyan font-semibold mb-2">Database Schema</h4>
        <pre className="text-xs text-gray-300">{`-- In notification_settings table:
email_sms_enabled BOOLEAN DEFAULT false
email_sms_recipients JSONB DEFAULT '[]'

-- Recipients format:
[
  { "phone": "5551234567", "carrier": "verizon", "name": "John", "enabled": true },
  { "phone": "5559876543", "carrier": "att", "name": "Jane", "enabled": true }
]`}</pre>
      </div>

      <div className="mt-4 text-xs text-gray-400">
        <strong>Key Files:</strong>
        <ul className="mt-1 ml-4">
          <li>• <code className="text-brand-gold">server/services/email-sms.js</code> - Email-to-SMS service</li>
          <li>• <code className="text-brand-gold">server/db/migrations/017_add_email_sms_columns.sql</code> - DB migration</li>
        </ul>
      </div>
    </div>

    {/* UI Features */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
      <h3 className="text-lg font-bold text-purple-400 mb-4">UI Features (DripFeedView.tsx)</h3>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-cyan font-semibold mb-2">Top Bar</h4>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>• Enable/Disable toggle (master switch)</li>
            <li>• Stats (Published/Scheduled/Queue)</li>
            <li>• Notifications button (green when enabled)</li>
            <li>• Collapsible Schedule Settings</li>
            <li>• Collapsible Calendar View</li>
          </ul>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-cyan font-semibold mb-2">Schedule Settings</h4>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>• Articles per day slider</li>
            <li>• Variance toggle (randomize count)</li>
            <li>• Publish time window (start/end)</li>
            <li>• Skip weekdays checkboxes</li>
            <li>• Skip specific dates calendar</li>
          </ul>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-cyan font-semibold mb-2">Calendar View</h4>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>• Month navigation</li>
            <li>• Articles shown per day</li>
            <li>• Click day to see scheduled articles</li>
            <li>• Status indicators (pending, published)</li>
          </ul>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-brand-cyan font-semibold mb-2">Notifications Panel</h4>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>• Enable Pushover toggle</li>
            <li>• Add/remove recipients</li>
            <li>• Enable/disable per recipient</li>
            <li>• Notification type toggles</li>
            <li>• Test notification button</li>
          </ul>
        </div>
      </div>
    </div>

    {/* Troubleshooting */}
    <div className="bg-red-900/20 rounded-xl p-6 border border-red-500/50">
      <h3 className="text-lg font-bold text-red-400 mb-4">Troubleshooting Guide</h3>

      <div className="space-y-4">
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-yellow-400 font-semibold mb-2">Articles not publishing?</h4>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>1. Check if drip feed is enabled (master toggle)</li>
            <li>2. Check if scheduler is running (server logs)</li>
            <li>3. Check if articles have scheduled_date/time ≤ now</li>
            <li>4. Check drip_feed_log table for errors</li>
            <li>5. Verify WordPress credentials in website settings</li>
          </ul>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-yellow-400 font-semibold mb-2">No push notifications?</h4>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>1. Verify <code>PUSHOVER_API_TOKEN</code> is set in environment</li>
            <li>2. Check if Pushover is enabled in notification settings</li>
            <li>3. Verify at least one recipient is enabled</li>
            <li>4. Test using the "Test" button in UI</li>
            <li>5. Check server logs for Pushover errors</li>
          </ul>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="text-yellow-400 font-semibold mb-2">Useful SQL Queries</h4>
          <pre className="text-xs text-gray-300 overflow-x-auto">{`-- Check pending schedules
SELECT * FROM drip_feed_schedules WHERE status = 'pending';

-- Check notification settings
SELECT * FROM notification_settings WHERE id = 1;

-- Check recent log entries
SELECT * FROM drip_feed_log ORDER BY created_at DESC LIMIT 20;

-- Check drip feed settings
SELECT * FROM drip_feed_settings;`}</pre>
        </div>
      </div>
    </div>

    {/* Recovery Guide */}
    <div className="bg-brand-cyan/10 rounded-xl p-6 border border-brand-cyan">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">Complete Rebuild Guide</h3>
      <p className="text-xs text-gray-400 mb-4">If you need to rebuild the drip feed system from scratch:</p>

      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <span className="text-brand-cyan font-bold">1.</span>
          <div className="text-gray-300">
            <strong>Run migrations:</strong>
            <pre className="text-xs bg-slate-900 p-2 rounded mt-1">{`-- In order:
015_drip_feed_system.sql
016_add_pushover_columns.sql`}</pre>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-brand-cyan font-bold">2.</span>
          <div className="text-gray-300">
            <strong>Server files needed:</strong>
            <ul className="text-xs mt-1 ml-4 text-gray-400">
              <li>• server/routes/drip-feed.js</li>
              <li>• server/services/drip-feed-scheduler.js</li>
              <li>• server/services/pushover.js</li>
            </ul>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-brand-cyan font-bold">3.</span>
          <div className="text-gray-300">
            <strong>Register routes in server/index.js:</strong>
            <pre className="text-xs bg-slate-900 p-2 rounded mt-1">{`import dripFeedRoutes from './routes/drip-feed.js';
app.use('/api/drip-feed', dripFeedRoutes);

// Initialize scheduler
import { initDripFeedScheduler } from './services/drip-feed-scheduler.js';
initDripFeedScheduler();`}</pre>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-brand-cyan font-bold">4.</span>
          <div className="text-gray-300">
            <strong>Environment variables:</strong>
            <pre className="text-xs bg-slate-900 p-2 rounded mt-1">{`DATABASE_URL=postgres://...@neon.tech/...
PUSHOVER_API_TOKEN=your-api-token`}</pre>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-brand-cyan font-bold">5.</span>
          <div className="text-gray-300">
            <strong>Frontend:</strong> src/components/articles/DripFeedView.tsx
          </div>
        </div>
      </div>
    </div>

    {/* Jan 2026 Features - Clickable Keywords, Schedule Later, Auto-Refresh */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-green-500/30">
      <h3 className="text-lg font-bold text-green-400 mb-4">Jan 2026 Enhancements</h3>
      <p className="text-sm text-gray-300 mb-4">
        New features added to improve the Drip Feed workflow for managing articles that need meta.
      </p>

      {/* Clickable Keywords */}
      <div className="bg-slate-900 rounded-lg p-4 mb-4">
        <h4 className="text-brand-cyan font-semibold mb-2">Clickable Keywords - Article Editor Overlay</h4>
        <p className="text-xs text-gray-400 mb-3">
          Click any keyword in the Drip Feed to open the article editor as an overlay. Edit meta, close, you're right back on Drip Feed.
        </p>
        <div className="bg-slate-800 rounded p-3 text-xs">
          <div className="text-brand-gold mb-2">Architecture Flow:</div>
          <pre className="text-gray-300 overflow-x-auto">{`DripFeedView                ArticlesPage               ArticleListView
     │                            │                            │
     │  onOpenArticle(articleId)  │                            │
     │ ─────────────────────────► │                            │
     │                            │  setOpenArticleId(id)      │
     │                            │ ──────────────────────────►│
     │                            │                            │  fetchArticleDetails(id)
     │                            │                            │  → Opens modal overlay
     │                            │                            │
     │                            │  onArticleModalClose()     │
     │                            │ ◄──────────────────────────│
     │                            │  setDripFeedRefreshKey++   │
     │  refreshKey changed        │                            │
     │ ◄──────────────────────────│                            │
     │  fetchData() → UI updates  │                            │`}</pre>
        </div>
        <div className="mt-3 text-xs">
          <span className="text-brand-gold">Key Files:</span>
          <ul className="mt-1 ml-4 text-gray-400">
            <li>• <code>src/pages/ArticlesPage.tsx</code> - Manages openArticleId + refreshKey state</li>
            <li>• <code>src/components/articles/DripFeedView.tsx</code> - Has onOpenArticle prop, refreshKey triggers re-fetch</li>
            <li>• <code>src/components/articles/ArticleListView.tsx</code> - Has openArticleId prop, onArticleModalClose callback</li>
          </ul>
        </div>
        <div className="mt-3 bg-amber-900/20 rounded p-2 text-xs border border-amber-500/30">
          <span className="text-amber-400">Why this approach:</span>
          <span className="text-gray-300 ml-2">ArticleListView contains the article modal. We keep it mounted (hidden when not on list tab) but show it when openArticleId is set. Modal overlay blocks background anyway.</span>
        </div>
      </div>

      {/* Schedule Later */}
      <div className="bg-slate-900 rounded-lg p-4 mb-4">
        <h4 className="text-brand-cyan font-semibold mb-2">Schedule Later Option</h4>
        <p className="text-xs text-gray-400 mb-3">
          When adding articles to Drip Feed, users can choose "Schedule Later" to add to queue without scheduling dates.
        </p>
        <div className="grid md:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-brand-gold">Frontend (ArticleListView.tsx):</span>
            <pre className="mt-1 text-gray-300 bg-slate-800 p-2 rounded overflow-x-auto">{`// Two buttons in modal:
"Schedule Later" → addToDripFeed(true)
"Schedule Now"   → addToDripFeed(false)

// Sends to API:
{ articleIds, startDate, scheduleLater: true/false }`}</pre>
          </div>
          <div>
            <span className="text-brand-gold">Backend (drip-feed.js):</span>
            <pre className="mt-1 text-gray-300 bg-slate-800 p-2 rounded overflow-x-auto">{`if (scheduleLater) {
  // Insert with placeholder date
  scheduled_date: '9999-12-31'
  scheduled_time: '00:00'
  status: 'unscheduled'
  // Scheduler ignores 'unscheduled' status
}`}</pre>
          </div>
        </div>
      </div>

      {/* Auto-Refresh */}
      <div className="bg-slate-900 rounded-lg p-4 mb-4">
        <h4 className="text-brand-cyan font-semibold mb-2">Auto-Refresh After Meta Save</h4>
        <p className="text-xs text-gray-400 mb-3">
          When you close the article editor after saving meta, Drip Feed automatically refreshes to show updated status.
        </p>
        <pre className="text-xs text-gray-300 bg-slate-800 p-2 rounded overflow-x-auto">{`// ArticlesPage.tsx
const [dripFeedRefreshKey, setDripFeedRefreshKey] = useState(0);

// When modal closes:
onArticleModalClose={() => {
  setOpenArticleId(null);
  setDripFeedRefreshKey(k => k + 1);  // Increment key
}}

// Pass to DripFeedView:
<DripFeedView refreshKey={dripFeedRefreshKey} />

// DripFeedView.tsx - Re-fetch when key changes:
useEffect(() => {
  fetchData();
}, [fetchData, refreshKey]);`}</pre>
      </div>

      {/* Timezone */}
      <div className="bg-slate-900 rounded-lg p-4 mb-4">
        <h4 className="text-brand-cyan font-semibold mb-2">Timezone Handling</h4>
        <p className="text-xs text-gray-400 mb-3">
          User selects their timezone in Settings. All time displays and scheduling use this timezone.
        </p>
        <div className="grid md:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-brand-gold">Database:</span>
            <pre className="mt-1 text-gray-300 bg-slate-800 p-2 rounded">{`-- drip_feed_settings
timezone VARCHAR(50) DEFAULT 'America/Chicago'

-- Uses IANA timezone strings:
'America/New_York', 'America/Chicago',
'America/Denver', 'America/Los_Angeles', etc.`}</pre>
          </div>
          <div>
            <span className="text-brand-gold">Time Formatting:</span>
            <pre className="mt-1 text-gray-300 bg-slate-800 p-2 rounded">{`// getCurrentTimeInTimezone(timezone)
const now = new Date();
return now.toLocaleString('en-US', {
  timeZone: timezone,
  month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit',
  hour12: true  // Shows "5:01 PM"
});`}</pre>
          </div>
        </div>
        <div className="mt-3 bg-amber-900/20 rounded p-2 text-xs border border-amber-500/30">
          <span className="text-amber-400">PostgreSQL Fix:</span>
          <span className="text-gray-300 ml-2">Use TO_CHAR(scheduled_date, 'YYYY-MM-DD') in SQL for consistent string comparison. Native Date objects don't compare correctly with strings.</span>
        </div>
      </div>

      {/* Active/Paused Toggle */}
      <div className="bg-slate-900 rounded-lg p-4">
        <h4 className="text-brand-cyan font-semibold mb-2">Active/Paused Toggle Styling</h4>
        <p className="text-xs text-gray-400 mb-3">
          Toggle is always visible - green for Active, orange for Paused (never gray). Defaults to Active.
        </p>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-600/20 border border-green-500/50">
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span className="text-sm font-medium text-green-400">Active</span>
          </div>
          <span className="text-gray-500">vs</span>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-600/20 border border-orange-500/50">
            <div className="w-3 h-3 rounded-full bg-orange-400"></div>
            <span className="text-sm font-medium text-orange-400">Paused</span>
          </div>
        </div>
        <pre className="mt-3 text-xs text-gray-300 bg-slate-800 p-2 rounded overflow-x-auto">{`// DripFeedView.tsx - Toggle styling
className={\`... \${
  isEnabled
    ? 'bg-green-600/20 border border-green-500/50'
    : 'bg-orange-600/20 border border-orange-500/50'
}\`}

// Database default changed:
is_enabled BOOLEAN DEFAULT true  // Active by default`}</pre>
      </div>
    </div>

    {/* No Alerts Policy */}
    <div className="bg-red-900/20 rounded-xl p-6 border border-red-500/30">
      <h3 className="text-lg font-bold text-red-400 mb-4">No Confirmation Alerts Policy</h3>
      <p className="text-sm text-gray-300 mb-4">
        <strong>User pushed the button - they know what they did.</strong> Don't show confirmation alerts.
      </p>
      <div className="bg-slate-900 rounded-lg p-4 text-xs">
        <div className="text-red-400 mb-2">❌ DON'T do this:</div>
        <pre className="text-gray-500 line-through">{`alert(\`Added \${count} articles to queue!\`);
alert(\`Successfully scheduled \${count} articles!\`);`}</pre>
        <div className="text-green-400 mt-3 mb-2">✓ DO this instead:</div>
        <pre className="text-gray-300">{`// Just close the modal and let the UI update
setShowDripFeedModal(false);
// User sees the change in the list - no alert needed`}</pre>
      </div>
    </div>

    {/* Queue Behind Last Feature */}
    <div className="bg-green-900/20 rounded-xl p-6 border border-green-500/30">
      <h3 className="text-lg font-bold text-green-400 mb-4">Queue Behind Last Feature (Jan 2026)</h3>
      <p className="text-sm text-gray-300 mb-4">
        Allows adding articles directly behind the last scheduled article, following existing schedule settings.
        One-click queueing without needing to pick dates.
      </p>

      {/* Where the buttons appear */}
      <div className="bg-slate-900 rounded-lg p-4 mb-4">
        <h4 className="text-brand-cyan font-semibold mb-2">Two Locations</h4>
        <div className="grid md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-800 rounded p-3">
            <span className="text-brand-gold font-semibold">1. Add to Drip Feed Modal</span>
            <p className="text-gray-400 mt-1 mb-2">ArticleListView.tsx - Three radio options:</p>
            <div className="space-y-1 text-gray-300">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-brand-cyan"></div>
                <span>Schedule Now - Pick a start date</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span><strong>Queue Behind Last</strong> - Auto-calculate date</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                <span>Schedule Later - No date assigned</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 rounded p-3">
            <span className="text-brand-gold font-semibold">2. Unscheduled Articles Row</span>
            <p className="text-gray-400 mt-1 mb-2">DripFeedView.tsx - Button next to Schedule:</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 bg-green-600/30 text-green-400 text-xs rounded">Queue</span>
              <span className="px-2 py-0.5 bg-brand-cyan/30 text-brand-cyan text-xs rounded">Schedule</span>
              <span className="px-2 py-0.5 bg-red-600/30 text-red-400 text-xs rounded">Remove</span>
            </div>
            <p className="text-gray-500 mt-2 text-[10px]">Queue = one-click, Schedule = opens date/time picker</p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-slate-900 rounded-lg p-4 mb-4">
        <h4 className="text-brand-cyan font-semibold mb-2">How Queue Behind Last Works</h4>
        <ol className="text-xs text-gray-300 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-green-400 font-bold">1.</span>
            <span>Finds the last scheduled article (highest date/time where status is 'pending' or 'published')</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 font-bold">2.</span>
            <span>Counts how many articles are already on that day</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 font-bold">3.</span>
            <span>If under daily limit (variance_max), starts scheduling on same day</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 font-bold">4.</span>
            <span>If at limit, starts scheduling on the next valid day (respecting skip_weekdays, skip_dates)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 font-bold">5.</span>
            <span>Uses generateSchedule() to assign times within publish_time_start/end window</span>
          </li>
        </ol>
      </div>

      {/* Code implementation */}
      <div className="bg-slate-900 rounded-lg p-4 mb-4">
        <h4 className="text-brand-cyan font-semibold mb-2">Implementation Details</h4>
        <div className="space-y-4 text-xs">
          <div>
            <span className="text-brand-gold">Frontend - Modal (ArticleListView.tsx):</span>
            <pre className="mt-1 text-gray-300 bg-slate-800 p-2 rounded overflow-x-auto">{`// State: 'schedule_now' | 'queue_behind' | 'schedule_later'
const [dripFeedMode, setDripFeedMode] = useState('schedule_now');

// API call:
body: JSON.stringify({
  articleIds: Array.from(selectedIds),
  startDate: dripFeedStartDate,
  scheduleLater: dripFeedMode === 'schedule_later',
  queueBehindLast: dripFeedMode === 'queue_behind'  // ← New flag
})`}</pre>
          </div>
          <div>
            <span className="text-brand-gold">Frontend - Queue Button (DripFeedView.tsx):</span>
            <pre className="mt-1 text-gray-300 bg-slate-800 p-2 rounded overflow-x-auto">{`// State for loading indicator
const [queuingArticleId, setQueuingArticleId] = useState(null);

// One-click queue function
const queueArticleBehindLast = async (article) => {
  setQueuingArticleId(article.id);
  await fetch(\`/api/drip-feed/schedule/\${websiteId}\`, {
    method: 'POST',
    body: JSON.stringify({
      articleIds: [article.article_id],
      queueBehindLast: true
    })
  });
  // Shows toast with assigned date/time
  fetchData();
};`}</pre>
          </div>
          <div>
            <span className="text-brand-gold">Backend (drip-feed.js POST /schedule/:websiteId):</span>
            <pre className="mt-1 text-gray-300 bg-slate-800 p-2 rounded overflow-x-auto">{`// Extract new flag
const { articleIds, startDate, scheduleLater, queueBehindLast } = req.body;

// If queueBehindLast, find last scheduled and calculate start date
if (queueBehindLast) {
  const lastScheduled = await sql\`
    SELECT scheduled_date, scheduled_time
    FROM drip_feed_schedules
    WHERE website_id = \${websiteId}
      AND status IN ('pending', 'published')
      AND scheduled_date != '9999-12-31'
    ORDER BY scheduled_date DESC, scheduled_time DESC
    LIMIT 1
  \`;

  if (lastScheduled.length > 0) {
    const lastDate = lastScheduled[0].scheduled_date;
    const countOnLastDate = await sql\`SELECT COUNT(*) ...\`;
    const maxPerDay = settings.variance_enabled
      ? settings.variance_max
      : settings.articles_per_day;

    // If room on last day, use it; otherwise next day
    if (articlesOnLastDate < maxPerDay) {
      scheduleStartDate = new Date(lastDate);
    } else {
      scheduleStartDate = new Date(lastDate);
      scheduleStartDate.setDate(scheduleStartDate.getDate() + 1);
    }
  }
}

// Then call generateSchedule(articleIds, settings, scheduleStartDate)`}</pre>
          </div>
        </div>
      </div>

      {/* Key files */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h4 className="text-brand-gold font-semibold mb-2">Key Files Modified</h4>
        <ul className="text-xs text-gray-300 space-y-1 font-mono">
          <li>• <code className="text-brand-cyan">src/components/articles/ArticleListView.tsx</code> - Modal with 3 radio options</li>
          <li>• <code className="text-brand-cyan">src/components/articles/DripFeedView.tsx</code> - Queue button + queueArticleBehindLast()</li>
          <li>• <code className="text-brand-cyan">server/routes/drip-feed.js</code> - queueBehindLast flag handling (~lines 279-317)</li>
        </ul>
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

// Image Recycle System - Technical documentation for recycling test images
const ImageRecycleDiagram: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-brand-cyan mb-2">Image Recycle System</h2>
      <p className="text-gray-400">Recycle testing images back to Image Bank for reuse (Jan 2026)</p>
    </div>

    {/* Overview */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">System Overview</h3>
      <p className="text-gray-300 text-sm mb-4">
        When testing the system, images get "used" but never actually published to a live site.
        The Image Recycle system allows these test images to be moved back into the reusable Image Bank.
      </p>
      <div className="flex flex-col items-center gap-4 mt-6">
        {/* Flow Diagram */}
        <div className="flex gap-8 justify-center items-center flex-wrap">
          <div className="bg-slate-700 rounded-lg p-4 border-2 border-yellow-500 w-48 text-center">
            <div className="text-yellow-500 font-bold mb-2">DRAFT IMAGE BANK</div>
            <div className="text-xs text-gray-400">draft_image_bank table</div>
            <div className="text-xs text-gray-400 mt-1">249 draft images</div>
          </div>
          <div className="text-4xl text-brand-cyan">→</div>
          <div className="bg-slate-700 rounded-lg p-4 border-2 border-green-500 w-48 text-center">
            <div className="text-green-500 font-bold mb-2">IMAGE BANK</div>
            <div className="text-xs text-gray-400">image_bank_items table</div>
            <div className="text-xs text-gray-400 mt-1">Reusable images</div>
          </div>
        </div>
        <div className="flex gap-8 justify-center items-center flex-wrap mt-4">
          <div className="bg-slate-700 rounded-lg p-4 border-2 border-red-500 w-48 text-center">
            <div className="text-red-500 font-bold mb-2">USED/ARCHIVE</div>
            <div className="text-xs text-gray-400">image_bank_items (used=true)</div>
            <div className="text-xs text-gray-400 mt-1">44 used images</div>
          </div>
          <div className="text-4xl text-brand-cyan">→</div>
          <div className="bg-slate-700 rounded-lg p-4 border-2 border-green-500 w-48 text-center">
            <div className="text-green-500 font-bold mb-2">AVAILABLE</div>
            <div className="text-xs text-gray-400">image_bank_items (used=false)</div>
            <div className="text-xs text-gray-400 mt-1">Ready for reuse</div>
          </div>
        </div>
      </div>
    </div>

    {/* Database Field Mapping */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-gold/30">
      <h3 className="text-lg font-bold text-brand-gold mb-4">Field Mapping: draft_image_bank → image_bank_items</h3>
      <p className="text-sm text-gray-400 mb-4">When recycling from Draft Bank to Image Bank, fields are mapped as follows:</p>

      <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="py-2 text-yellow-500">draft_image_bank</th>
              <th className="py-2 text-green-500">image_bank_items</th>
              <th className="py-2 text-gray-400">Notes</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-slate-800">
              <td className="py-2">url</td>
              <td className="py-2">url</td>
              <td className="py-2 text-xs text-gray-500">Direct copy</td>
            </tr>
            <tr className="border-b border-slate-800">
              <td className="py-2">prompt</td>
              <td className="py-2">prompt</td>
              <td className="py-2 text-xs text-gray-500">Direct copy</td>
            </tr>
            <tr className="border-b border-slate-800">
              <td className="py-2">model</td>
              <td className="py-2">model</td>
              <td className="py-2 text-xs text-gray-500">Direct copy</td>
            </tr>
            <tr className="border-b border-slate-800">
              <td className="py-2">avatar_tag</td>
              <td className="py-2">avatar_tag</td>
              <td className="py-2 text-xs text-gray-500">Direct copy</td>
            </tr>
            <tr className="border-b border-slate-800">
              <td className="py-2 text-yellow-400">item_type</td>
              <td className="py-2 text-green-400">title + tags[]</td>
              <td className="py-2 text-xs text-gray-500">Used as title AND added to tags</td>
            </tr>
            <tr className="border-b border-slate-800">
              <td className="py-2 text-yellow-400">item_category</td>
              <td className="py-2 text-green-400">category</td>
              <td className="py-2 text-xs text-gray-500">Renamed field</td>
            </tr>
            <tr className="border-b border-slate-800">
              <td className="py-2 text-yellow-400">page_keyword</td>
              <td className="py-2 text-green-400">tags[]</td>
              <td className="py-2 text-xs text-gray-500">Added to tags array</td>
            </tr>
            <tr className="border-b border-slate-800">
              <td className="py-2">metadata</td>
              <td className="py-2">metadata</td>
              <td className="py-2 text-xs text-gray-500">Extended with recycle info</td>
            </tr>
            <tr>
              <td className="py-2 text-gray-500">-</td>
              <td className="py-2">'recycled' tag</td>
              <td className="py-2 text-xs text-gray-500">Always added to tags</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3 bg-slate-800 rounded-lg text-xs text-gray-400">
        <strong className="text-brand-gold">Metadata added on recycle:</strong>
        <code className="block mt-2 text-gray-300">{`{ recycledFrom: 'draft_image_bank', originalDraftId: 123, originalStatus: 'draft', recycledAt: '2026-01-11T...' }`}</code>
      </div>
    </div>

    {/* API Endpoints */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">API Endpoints</h3>

      <div className="space-y-6">
        {/* Endpoint 1 */}
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-green-600 text-white text-xs px-2 py-1 rounded font-bold">POST</span>
            <code className="text-brand-cyan">/api/image-bank/:workflowId/recycle-from-draft</code>
          </div>
          <div className="text-sm text-gray-400 mb-3">Copy images from Draft Image Bank to regular Image Bank</div>

          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-brand-gold mb-2">Request Body:</div>
              <pre className="bg-slate-800 p-2 rounded text-gray-300">{`{
  "statuses": ["draft", "sent"],  // Which statuses to include
  "deleteAfterRecycle": false     // Remove from draft after copy
}`}</pre>
            </div>
            <div>
              <div className="text-green-400 mb-2">Response:</div>
              <pre className="bg-slate-800 p-2 rounded text-gray-300">{`{
  "success": true,
  "data": {
    "recycled": 249,
    "deleted": 0,
    "message": "Recycled 249 images to Image Bank"
  }
}`}</pre>
            </div>
          </div>
        </div>

        {/* Endpoint 2 */}
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-green-600 text-white text-xs px-2 py-1 rounded font-bold">POST</span>
            <code className="text-brand-cyan">/api/image-bank/:workflowId/restore-all-used</code>
          </div>
          <div className="text-sm text-gray-400 mb-3">Mark all used images as available again (set used=false)</div>

          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-brand-gold mb-2">Request Body:</div>
              <pre className="bg-slate-800 p-2 rounded text-gray-300">{`{}`}</pre>
              <div className="text-gray-500 mt-1">No body required</div>
            </div>
            <div>
              <div className="text-green-400 mb-2">Response:</div>
              <pre className="bg-slate-800 p-2 rounded text-gray-300">{`{
  "success": true,
  "data": {
    "restored": 44
  }
}`}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Database Operations */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
      <h3 className="text-lg font-bold text-purple-400 mb-4">Database Operations</h3>

      <div className="space-y-4">
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="text-brand-gold font-semibold mb-2">Recycle from Draft Bank:</div>
          <div className="text-xs text-gray-400 mb-2">File: server/services/image-bank.js → recycleFromDraftBank()</div>
          <pre className="text-xs bg-slate-800 p-3 rounded text-gray-300 overflow-x-auto">{`// 1. Get draft images matching criteria
SELECT * FROM draft_image_bank
WHERE workflow_id = $1 AND status = ANY($2)

// 2. Insert into image_bank_items with field mapping
INSERT INTO image_bank_items (workflow_id, external_id, url, title, ...)

// 3. Optionally delete from draft bank
DELETE FROM draft_image_bank WHERE id = ANY($recycledIds)`}</pre>
        </div>

        <div className="bg-slate-900 rounded-lg p-4">
          <div className="text-brand-gold font-semibold mb-2">Restore Used Images:</div>
          <div className="text-xs text-gray-400 mb-2">File: server/services/image-bank.js → restoreAllUsedImages()</div>
          <pre className="text-xs bg-slate-800 p-3 rounded text-gray-300 overflow-x-auto">{`UPDATE image_bank_items
SET used = false, used_on = null, used_at = null, updated_at = NOW()
WHERE workflow_id = $1 AND used = true
RETURNING id`}</pre>
        </div>
      </div>
    </div>

    {/* Frontend State Management */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">Frontend State Management</h3>
      <div className="text-xs text-gray-400 mb-4">File: src/components/ImageCreationSection.tsx</div>

      <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs">
        <pre className="text-gray-300">{`// Selection state for Draft Bank images
const [selectedDraftImages, setSelectedDraftImages] = useState<Set<number>>(new Set());

// Selection state for Used/Archive images (string IDs)
const [selectedUsedImages, setSelectedUsedImages] = useState<Set<string>>(new Set());

// Quick preview modal
const [quickPreview, setQuickPreview] = useState<string | null>(null);

// Expand All view modals
const [draftBankExpandedView, setDraftBankExpandedView] = useState(false);
const [usedBankExpandedView, setUsedBankExpandedView] = useState(false);

// Stats loaded on mount (not just when opened)
const fetchDraftBankStatsOnly = async () => {
  const response = await fetch(\`/api/draft-image-bank/\${workflowId}/stats\`);
  // Updates header without loading full image data
};

useEffect(() => {
  if (workflowId) fetchDraftBankStatsOnly();
}, [workflowId]);`}</pre>
      </div>

      <div className="mt-4 p-3 bg-yellow-900/30 rounded-lg text-xs text-yellow-300">
        <strong>Note:</strong> Draft images use numeric IDs (from database), Used images use string IDs (external_id field).
        This is why we have separate Set types.
      </div>
    </div>

    {/* Key Files */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">Key Files Reference</h3>
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <h4 className="font-semibold text-brand-gold mb-2">Backend</h4>
          <ul className="space-y-2 text-gray-300">
            <li className="flex justify-between">
              <code className="text-xs">server/services/image-bank.js</code>
              <span className="text-xs text-gray-500">recycleFromDraftBank(), restoreAllUsedImages()</span>
            </li>
            <li className="flex justify-between">
              <code className="text-xs">server/routes/image-bank.js</code>
              <span className="text-xs text-gray-500">API endpoints</span>
            </li>
            <li className="flex justify-between">
              <code className="text-xs">server/services/draft-image-bank.js</code>
              <span className="text-xs text-gray-500">getDraftImageBank() - fixed sql.unsafe</span>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-brand-gold mb-2">Frontend</h4>
          <ul className="space-y-2 text-gray-300">
            <li className="flex justify-between">
              <code className="text-xs">src/components/ImageCreationSection.tsx</code>
              <span className="text-xs text-gray-500">All UI components</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    {/* Critical SQL Fix */}
    <div className="bg-red-900/20 rounded-xl p-6 border border-red-500">
      <h3 className="text-lg font-bold text-red-400 mb-4">Critical Fix: sql.unsafe() Pattern</h3>
      <p className="text-sm text-gray-300 mb-4">
        The Draft Image Bank was showing 0 images due to <code className="bg-slate-900 px-1 rounded">sql.unsafe()</code> throwing empty errors.
        This is the fix pattern to use for conditional filters:
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="text-red-400 font-semibold mb-2">BROKEN (sql.unsafe):</div>
          <pre className="text-xs text-gray-300 overflow-x-auto">{`// This throws empty {} errors
let query = 'SELECT * FROM table WHERE workflow_id = $1';
if (status) query += ' AND status = $2';
await sql.unsafe(query, [workflowId, status]);`}</pre>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="text-green-400 font-semibold mb-2">FIXED (tagged template):</div>
          <pre className="text-xs text-gray-300 overflow-x-auto">{`// Use NULL check pattern instead
await sql\`
  SELECT * FROM table
  WHERE workflow_id = \${workflowId}
    AND (\${status || null}::text IS NULL
         OR status = \${status || null})
\`;`}</pre>
        </div>
      </div>

      <div className="mt-4 p-3 bg-red-900/30 rounded-lg text-xs text-red-300">
        <strong>Rule:</strong> Never use <code>sql.unsafe()</code> in this codebase. Always use tagged templates with the NULL check pattern for optional filters.
      </div>
    </div>
  </div>
);

// Changelog - Searchable list of features and fixes with dates
const ChangelogDiagram: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-brand-cyan mb-2">Changelog</h2>
      <p className="text-gray-400">Searchable history of features and fixes</p>
    </div>

    {/* February 2026 */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-gold mb-4">February 2026</h3>

      <div className="space-y-4">
        {/* Feb 15 - Cal-1 Data Model + Backend Injection Layer IMPLEMENTED */}
        <div className="border-l-4 border-green-500 pl-4">
          <div className="text-sm text-green-400 font-semibold">Feb 15, 2026 - Cal-1: Data Model + Backend Injection Layer (IMPLEMENTED)</div>
          <p className="text-xs text-gray-500 mt-1 mb-2">Built the foundation layer for the calibration system from PRD-cal-1. Storage, CRUD API, pack compilation, and prompt injection pipeline. No UI yet — backend only.</p>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">DB</span>
              <div>
                <strong>Migration 035: calibration_entries (JSONB) + calibration_version (INT) on image_creation_settings</strong>
                <div className="text-xs text-gray-500">
                  Follows existing JSONB-column pattern (same as testing_slots, prompt_problem_areas, etc.). NOT a separate table.
                  Uses tryUpdateCalibration pattern for graceful degradation if migration hasn't run yet.
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">API</span>
              <div>
                <strong>Full CRUD at /api/calibration/:workflowId — 6 endpoints</strong>
                <div className="text-xs text-gray-500">
                  GET (all entries), PUT (full replace with empty-array protection), POST /entry (add one),
                  PATCH /entry/:id (update one, ID change prevented), DELETE /entry/:id (remove one),
                  GET /pack/:tag (compile pack for a tag). All follow Golden Rule 8 (website_id first, workflow_id fallback).
                  Version auto-increments on every write.
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">CORE</span>
              <div>
                <strong>Pack compiler: compileCalibrationPack() — exported, tested with 35 unit tests</strong>
                <div className="text-xs text-gray-500">
                  Filter by tag + "All" globals {"→"} sort priority desc (hard{"→"}med{"→"}soft) then recency desc {"→"} limit 12-20 {"→"} render Template 3.
                  Output: numbered list with meta-instruction about conflict resolution.
                  Same logic runs on both server (calibration.js) and client (ImageCreationSection.tsx buildContext).
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">INJECT</span>
              <div>
                <strong>Calibration pack injected into prompt-assistant.js context (after guardrails, before reference images)</strong>
                <div className="text-xs text-gray-500">
                  PRD injection stack: System {"→"} Guardrails {"→"} Tag Guardrails {"→"} Calibration Pack (DYNAMIC) {"→"} Page context {"→"} Output contract.
                  Frontend compiles pack in buildContext and sends as context.calibrationPack. Server renders it as "## Calibration Pack (Dynamic Quality Rules):" section.
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">TYPE</span>
              <div>
                <strong>CalibrationEntry interface + testImages extended with calibrationNote/correctedPrompt</strong>
                <div className="text-xs text-gray-500">
                  15-field CalibrationEntry interface in ImageCreationSection.tsx.
                  TestingSlotsSelector testImages array items now have calibrationNote and correctedPrompt optional fields
                  (a "near-miss" = test image + annotation, ready for Cal-2 "Promote to Calibration" UI).
                </div>
              </div>
            </li>
          </ul>
          <div className="mt-3 bg-slate-900/50 rounded p-2 text-xs">
            <span className="text-teal-400 font-semibold">Key Files:</span>
            <span className="text-gray-400 ml-2">
              server/routes/calibration.js (new), server/db/migrations/035_add_calibration_system.sql (new),
              server/routes/prompt-assistant.js (injection), server/routes/image-creation.js (save/load),
              src/components/ImageCreationSection.tsx (interface + context), src/components/TestingSlotsSelector.tsx (testImages fields),
              tests/calibration.test.js (35 unit tests)
            </span>
          </div>
          <div className="mt-2 bg-slate-900/50 rounded p-2 text-xs">
            <span className="text-teal-400 font-semibold">For rebuild:</span>
            <span className="text-gray-400 ml-2">
              The core logic worth keeping is compileCalibrationPack() — it's clean, tested, and does exactly one thing.
              The CRUD routes follow standard patterns. The JSONB storage approach works but a dedicated table might be cleaner
              in a rebuild since entries have a defined schema. The injection point in prompt-assistant.js is the critical integration
              — calibration MUST go after guardrails and before page context in the prompt stack.
            </span>
          </div>
        </div>

        {/* Feb 15 (late) - Calibration System PRD Expansion */}
        <div className="border-l-4 border-purple-500 pl-4">
          <div className="text-sm text-purple-400 font-semibold">Feb 15, 2026 (late session) - PRD 3 Calibration System Full Spec</div>
          <p className="text-xs text-gray-500 mt-1 mb-2">Documentation-only session. User brought detailed calibration design from external AI chat consultation. Coding agent reviewed, contributed design decisions, and documented everything in Blueprint PRDs.</p>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">DOCS</span>
              <div>
                <strong>PRD 3 expanded from simple text-box to full calibration system spec</strong>
                <div className="text-xs text-gray-500">
                  Original PRD 3 was just "a text box per prompt type that stores calibration corrections." Now a comprehensive
                  engineering spec with: 3-phase workflow (pre-calibration → near-miss logging → reusable entries),
                  15-field entry schema (id, title, tags[], priority hard/med/soft, human_note + model_instruction dual fields, trigger, do/avoid,
                  enforcement tactics, evidence images, per-tag test status), 3 templates (UI Card, Drop-in Line format, Calibration Pack),
                  injection stack order (System → Global Guardrails → Tag Guardrails → Calibration Pack → Page context → Output contract),
                  query logic (filter by tag, sort priority desc, limit 12-20), conflict resolution rules, two debug modes
                  (Show Injection + Disable Calibration A/B toggle), atomic entries rule (one idea per calibration for portability).
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">DESIGN</span>
              <div>
                <strong>Coding agent design contributions (not from external chat)</strong>
                <div className="text-xs text-gray-500">
                  Agent identified that calibration entries map directly to existing test slot infrastructure — a "near miss" IS a test image + annotation.
                  Proposed adding calibrationNote and correctedPrompt fields to existing testImages array items rather than building separate storage.
                  Proposed "Promote to Calibration" button flow: annotate test image → promote to calibration library (not the other direction).
                  Recommended calibration live as dedicated sub-section per prompt type, not buried in test slots.
                  Suggested calibration version numbers with changelog for rollback capability.
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">DESIGN</span>
              <div>
                <strong>Calibration tag model: per-tag with progressive expansion (agent-designed)</strong>
                <div className="text-xs text-gray-500">
                  External chat originally proposed binary "global vs per-tag" choice. Agent redesigned to multi-select progressive expansion:
                  each entry starts on ONE tested tag, accumulates tags as testing proves them out. "All" = verified global.
                  Flow: create on "H" → test "J" → works → add "J" → eventually "All". Can always remove a tag if it stops working.
                  per_tag_test_status field enables scientific tracking of whether a rule is niche or global over time.
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">DOCS</span>
              <div>
                <strong>Injection stack order documented (from external chat)</strong>
                <div className="text-xs text-gray-500">
                  Critical design: calibration is a DYNAMIC LAYER between guardrails and page context. Never bake into permanent guardrails.
                  Order: System/Role → Global Guardrails → Tag Guardrails → Calibration Pack (filtered, max 12-20) → Page context → Output contract.
                  Calibration after guardrails prevents it from accidentally relaxing hard rules. Conflict resolution: guardrails {">"} calibration,
                  higher priority wins, same priority → most recent wins.
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">DOCS</span>
              <div>
                <strong>Drop-in line format standardized (from external chat)</strong>
                <div className="text-xs text-gray-500">
                  Each calibration entry has TWO text fields: human_note (for user understanding) and model_instruction (the actual injected line).
                  Format: [CAL:Title | Strength] Do …; Avoid …; Prefer …
                  Example: [CAL:Everyday employee look | Hard] Depict a realistic worker with natural skin texture; avoid glam styling; prefer practical hair.
                  This is the key difference between "notes" and "usable calibration."
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">DOCS</span>
              <div>
                <strong>Two debug modes documented (from external chat)</strong>
                <div className="text-xs text-gray-500">
                  Mode A "Show Injection": display exact compiled context (guardrails + tag + calibration + page text) used for each generation, for diagnostics.
                  Mode B "Disable Calibration": A/B toggle to run same prompt with calibration off, proving whether a calibration entry actually matters.
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">DOCS</span>
              <div>
                <strong>Phase 3 summary updated in Phased Implementation Plan</strong>
                <div className="text-xs text-gray-500">Reflects expanded PRD 3 with schema details, injection stack, debug modes. Points to full PRD 3 section for complete spec.</div>
              </div>
            </li>
          </ul>
          <div className="mt-3 bg-slate-900/50 rounded p-2 text-xs">
            <span className="text-teal-400 font-semibold">Key Files:</span>
            <span className="text-gray-400 ml-2">BlueprintPage.tsx only (documentation session — no code changes)</span>
          </div>
          <div className="mt-2 bg-slate-900/50 rounded p-2 text-xs">
            <span className="text-teal-400 font-semibold">Commits:</span>
            <span className="text-gray-400 ml-2">f5121e3, fb6776a, 24dd9da, 9b47a21</span>
          </div>
          <div className="mt-2 bg-slate-900/50 rounded p-2 text-xs">
            <span className="text-teal-400 font-semibold">Source of truth:</span>
            <span className="text-gray-400 ml-2">PRD 3 in the HANDOFF PRDs section above is the single source of truth for calibration system design. All schema, templates, injection logic, and debug modes are documented there. Everything from the external AI chat has been captured.</span>
          </div>
          <div className="mt-2 bg-slate-900/50 rounded p-2 text-xs">
            <span className="text-teal-400 font-semibold">Context for future rebuild:</span>
            <span className="text-gray-400 ml-2">User plans to eventually use Opus 4.6 million-token context to reverse-engineer the entire spaghetti codebase into clean specs, then feed those specs into an auto-builder (Wiggins-based looper with Playwright + Claude computer-use testing) to rebuild everything properly. Calibration system will be part of that enterprise rebuild. For NOW: just get images working for the website with existing system.</span>
          </div>
          <div className="mt-2 bg-slate-900/50 rounded p-2 text-xs">
            <span className="text-teal-400 font-semibold">Next priority:</span>
            <span className="text-gray-400 ml-2">Get images working for the website AS-IS. Calibration is primarily for Guided GPT (where AI makes on-the-fly judgment calls). Main Prompt is more static and works well enough with existing guardrails. Do NOT start building calibration system yet.</span>
          </div>
        </div>

        {/* Feb 15 - Testing System Completion + Diff Modal + Username System */}
        <div className="border-l-4 border-orange-500 pl-4">
          <div className="text-sm text-orange-400 font-semibold">Feb 15, 2026 - Testing System UI Completion + Compare to Main Diff Modal + Username System</div>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>Testing Slots Bars for All 3 Prompt Types</strong>
                <div className="text-xs text-gray-500">
                  Added TestingSlotsSelector to top of Guided GPT prompt area (was missing - Smart Prompt already had one).
                  <br/>All 3 prompt modes (Main, Guided GPT, Smart Prompt) now have testing bars at their section top.
                  <br/>Files: <code className="bg-slate-900 px-1 rounded">ImageCreationSection.tsx:9875</code> (Guided GPT top bar)
                  <br/>Reference: Smart Prompt bar at <code className="bg-slate-900 px-1 rounded">ImageCreationSection.tsx:12543</code>
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>3-Button Testing Pill in AI Chat Toolbars (Main, Guided, Smart)</strong>
                <div className="text-xs text-gray-500">
                  Both chat assistants (Main Prompt AI + Guided GPT AI) now have 3 labeled buttons in a gold pill:
                  <br/>• "Main" (orange) - toggles Main Prompt testing bar
                  <br/>• "Guided" (emerald) - toggles Guided GPT testing bar
                  <br/>• "Smart" (purple) - toggles Smart Prompt testing bar
                  <br/>Gold pill with "Testing" label wraps all 3. Only one bar shows at a time (clicking one closes others).
                  <br/>Also renamed: "Testing" → "Testing Mode", "Bank" → "Image Bank" for clarity.
                  <br/>State: <code className="bg-slate-900 px-1 rounded">showMainPromptSlots</code>, <code className="bg-slate-900 px-1 rounded">showGuidedSlots</code>, <code className="bg-slate-900 px-1 rounded">showSmartSlots</code> (line ~1185)
                  <br/>Main chat toolbar: <code className="bg-slate-900 px-1 rounded">ImageCreationSection.tsx:~9507</code>
                  <br/>Guided chat toolbar: <code className="bg-slate-900 px-1 rounded">ImageCreationSection.tsx:~11331</code>
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>Compare to Main - Diff Preview Modal</strong>
                <div className="text-xs text-gray-500">
                  Blue "Compare to Main" button in active slot banner opens full-screen diff modal.
                  <br/>7 tabbed sections: Main Prompt, Categories, Guided Guardrails, Guided Rules, Smart Prompt, Persistent Text, Matching Rules.
                  <br/>Colored dots on tabs: green = identical, amber = modified, gray = empty in slot.
                  <br/>Side-by-side panels: green border (Main/Live) vs orange border (Test Slot).
                  <br/>File: <code className="bg-slate-900 px-1 rounded">TestingSlotsSelector.tsx:830-1068</code>
                  <br/>Button: <code className="bg-slate-900 px-1 rounded">TestingSlotsSelector.tsx:501-509</code>
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>Username System for Test Slots</strong>
                <div className="text-xs text-gray-500">
                  "Created by" dropdown in Create Slot dialog with "+ User" button to add names.
                  <br/>Purple badge on slot tabs and active banner. Tooltip shows creator + date/time.
                  <br/>Settings: <code className="bg-slate-900 px-1 rounded">testing_usernames: string[]</code> in ImageCreationSettings (line ~642)
                  <br/>Props: <code className="bg-slate-900 px-1 rounded">usernames</code> + <code className="bg-slate-900 px-1 rounded">onUsernamesChange</code> on all 12 TestingSlotsSelector instances
                  <br/>Create dialog: <code className="bg-slate-900 px-1 rounded">TestingSlotsSelector.tsx:630-706</code>
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold">DATA</span>
              <div>
                <strong>Test Image Data Model (for future gallery)</strong>
                <div className="text-xs text-gray-500">
                  Added <code className="bg-slate-900 px-1 rounded">testImages</code> field to <code className="bg-slate-900 px-1 rounded">TestingSlotContent</code> interface.
                  <br/>Structure: id, url, timestamp, number, projectName, createdBy, prompt, model
                  <br/>File: <code className="bg-slate-900 px-1 rounded">TestingSlotsSelector.tsx:114-123</code>
                  <br/>UI not yet built - see HANDOFF PRDs below.
                </div>
              </div>
            </li>
          </ul>
        </div>

        {/* HANDOFF PRDs for next agent */}
        <div className="border-l-4 border-red-500 pl-4 bg-red-900/10 rounded-r-lg p-4">
          <div className="text-sm text-red-400 font-semibold mb-2">HANDOFF PRDs - Feb 15, 2026 Session (for next agent)</div>
          <p className="text-xs text-gray-400 mb-3">These features were planned/requested but not yet implemented. Data models and infrastructure are in place.</p>

          <div className="space-y-4">
            {/* PRD 1: Test Image Gallery */}
            <div className="bg-slate-800/70 rounded-lg p-3 border border-slate-700">
              <div className="text-xs text-brand-cyan font-bold mb-1">PRD 1: Test Image Gallery UI</div>
              <div className="text-xs text-gray-400 space-y-1">
                <p><strong>What:</strong> Horizontal scrollable image strip showing test images per slot + per-project grouping.</p>
                <p><strong>Where it goes:</strong> Two locations: (1) Below the testing bar in the prompt area as a collapsible section. (2) Inside the "Compare to Main" diff modal as a new tab alongside the existing 7 tabs.</p>
                <p><strong>Data model ready:</strong> <code className="bg-slate-900 px-1 rounded">TestingSlotContent.testImages[]</code> in TestingSlotsSelector.tsx:114-123. Fields: id, url, timestamp, number, projectName, createdBy, prompt, model.</p>
                <p><strong>Each image shows:</strong> Sequential number (1, 2, 3), auto date/time stamp, project name, model used.</p>
                <p><strong>Grouping:</strong> Images from different test runs separated by a divider line. Above each group: timestamp, test number, model name.</p>
                <p><strong>Scrolling:</strong> Most recent centered, scroll left/right for older. Horizontal infinite scroll.</p>
                <p><strong>Click to expand:</strong> Clicking an image opens it larger.</p>
                <p><strong>Per-project buttons:</strong> Each project in the testing bar gets a button that scrolls to and highlights its images in the gallery.</p>
                <p><strong>Popup from tab:</strong> Clicking a test slot tab should open a popup showing: the prompt text that was in that test + the image gallery for that test. This reuses the existing diff modal infrastructure.</p>
                <p><strong>Image storage hook:</strong> Need to connect the image generation flow (handleBatchGenerate around line 7532) to store images in the active test slot's testImages array when a test is running.</p>
              </div>
            </div>

            {/* PRD 2: AI Chat Full Autonomy */}
            <div className="bg-slate-800/70 rounded-lg p-3 border border-slate-700">
              <div className="text-xs text-brand-cyan font-bold mb-1">PRD 2: AI Chat Full Autonomy Over Testing System</div>
              <div className="text-xs text-gray-400 space-y-1">
                <p><strong>What:</strong> The AI Prompt Assistant chat (both Main + Guided) should be able to programmatically control the entire testing workflow.</p>
                <p><strong>Currently it can:</strong> Read prompts via Set Scope grid, write to categories (add/edit), write to prompt text fields, see rules.</p>
                <p><strong>Needs to also:</strong></p>
                <p>• Create new test slots (programmatically call handleCreateSlot)</p>
                <p>• Switch between slots (call handleActiveSlotChange)</p>
                <p>• Fill in ALL fields: main prompt, categories, rules, guardrails, persistent text</p>
                <p>• Trigger "Run Test" (call handleRunTest)</p>
                <p>• See the test image gallery results and read image IDs</p>
                <p>• Match images back to which test prompt generated them (via shared timestamps/IDs)</p>
                <p>• See the current model dropdown selection (so it knows prompting style for that model)</p>
                <p><strong>Where to implement:</strong> The unified chat handler is at <code className="bg-slate-900 px-1 rounded">handleSendUnifiedChat</code> (~line 5200). The system prompt builder is around line 5386 (section: "GUIDED GPT PROMPT SETTINGS"). Add new "tool" capabilities the AI can invoke via structured responses, similar to how it already creates categories.</p>
                <p><strong>Model visibility:</strong> The model dropdown is <code className="bg-slate-900 px-1 rounded">settings.guided_model</code> for Guided GPT and the image model is <code className="bg-slate-900 px-1 rounded">settings.image_model</code>. Pass these into the system prompt so the AI knows.</p>
              </div>
            </div>

            {/* PRD 3: Calibration System (Full Workflow + Schema + Injection) */}
            <div className="bg-slate-800/70 rounded-lg p-3 border border-slate-700">
              <div className="text-xs text-brand-cyan font-bold mb-1">PRD 3: Calibration System (AI vs Human Perception — Full Spec)</div>
              <div className="text-xs text-gray-400 space-y-1">
                <p><strong>What:</strong> A living calibration system that evolves through real testing. NOT a one-time text box — it's an iterative workflow: see near-miss → annotate → distill into ranked rules → inject into AI prompts. Calibration = taste + acceptance criteria that only becomes clear when you see real outputs. Calibration items must be <strong>atomic</strong> (one idea per entry — don't bundle "logo suppression" with "non-model attractiveness").</p>

                <p className="text-orange-400/80 font-bold mt-3">═══ WORKFLOW PHASES ═══</p>

                <p className="text-yellow-400/80 font-medium mt-2">Phase 1 — Pre-Calibration (guardrails only):</p>
                <p>Already done via existing guardrails (uniform, pose, logo suppression, no text, realism, non-model directive). Gets to "mostly acceptable" images.</p>

                <p className="text-yellow-400/80 font-medium mt-2">Phase 2 — Calibration Triggers (near-miss logging):</p>
                <p>When user spots an image that's *nearly* right but slightly off, they log a calibration case from a test slot image. Each case captures: (1) reference image (the near-miss), (2) what's wrong (1-2 sentences), (3) what correct looks like (1-2 sentences), (4) optional corrected example image after prompt adjustment.</p>
                <p><strong>Integration with test slots:</strong> Add <code className="bg-slate-900 px-1 rounded">calibrationNote?: string</code> and <code className="bg-slate-900 px-1 rounded">correctedPrompt?: string</code> fields to the <code className="bg-slate-900 px-1 rounded">testImages</code> array items in TestingSlotContent (already at <code className="bg-slate-900 px-1 rounded">TestingSlotsSelector.tsx:114-123</code>). A near-miss is literally a test slot image + annotation. Add a <strong>"Create Calibration from This Result"</strong> button on each test image that pre-fills fields + attaches the image/prompt.</p>

                <p className="text-yellow-400/80 font-medium mt-2">Phase 3 — Reusable Calibration Entries:</p>
                <p>Each annotated near-miss gets distilled into a calibration entry. Entries must be <strong>atomic</strong> (one idea each) for easy portability across tags. Keep entries short and crisp — models comply better with concise constraints.</p>

                <p className="text-orange-400/80 font-bold mt-3">═══ DATA MODEL (CALIBRATION ENTRY SCHEMA) ═══</p>
                <p>Each calibration entry stores:</p>
                <p><code className="bg-slate-900 px-1 rounded">calibration_entries: Array&lt;{'{'}</code></p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">id: string</code> — unique ID (e.g. CAL-007)</p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">title: string</code> — short name (e.g. "Avoid model glam")</p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">tags: string[]</code> — multi-select tags this applies to; "All" = global</p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">priority: 'hard' | 'medium' | 'soft'</code> — enforcement strength (hard = non-negotiable)</p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">human_note: string</code> — FOR THE USER: what's off and what we want (human-readable description)</p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">model_instruction: string</code> — FOR THE AI: the actual drop-in line injected into prompts</p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">trigger: string</code> — when to apply (e.g. "any portrait with visible chest area")</p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">do_preferred: string</code> — what the preferred outcome looks like</p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">avoid_antipattern: string</code> — what to avoid</p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">enforcement_tactics: string[]</code> — 1-3 bullet tactics (camera/occlusion/crop/lighting wording)</p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">negative_constraints?: string[]</code> — optional short negative list</p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">evidence_bad_image_ids?: string[]</code> — near-miss image references</p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">evidence_good_image_ids?: string[]</code> — target/good image references</p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">per_tag_test_status?: Record&lt;string, {'{'} pass: boolean, testedAt: string {'}'}&gt;</code> — pass/fail + timestamp per tag</p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">createdAt: string, updatedAt: string</code></p>
                <p className="pl-4"><code className="bg-slate-900 px-1 rounded">source_test_image_id?: string</code> — links back to the test image that triggered it</p>
                <p><code className="bg-slate-900 px-1 rounded">{'}'}&gt;</code></p>
                <p><code className="bg-slate-900 px-1 rounded">calibration_version: number</code> — auto-increments when entries change (v1/v2/v3 tracking + rollback)</p>

                <p className="text-yellow-400/80 font-medium mt-2">Key difference — two text fields per entry:</p>
                <p>(1) <strong>human_note</strong> — for the user: "What's off and what we want" (readable description)</p>
                <p>(2) <strong>model_instruction</strong> — for the AI: the actual drop-in line used in prompts. This is the critical field.</p>

                <p className="text-yellow-400/80 font-medium mt-2">Tag management:</p>
                <p><strong>Per-tag with progressive expansion.</strong> Each entry starts attached to the ONE tag it was tested on. As you verify it works on more tags, add them via multi-select. Once verified on all tags, check "All" for global. You can always remove a tag if it stops working. The <code className="bg-slate-900 px-1 rounded">per_tag_test_status</code> field lets you scientifically track whether a rule is niche or global over time.</p>

                <p className="text-orange-400/80 font-bold mt-3">═══ UI TEMPLATES ═══</p>

                <p className="text-yellow-400/80 font-medium mt-2">Template 1 — Calibration Card (CRUD UI):</p>
                <p>Each entry renders as a card with these fields: Title | Tags (multi-select) | Priority (Hard/Med/Soft) | Trigger (when to apply) | Do (preferred) | Avoid (anti-pattern) | Enforcement wording (drop-in line) | Evidence (bad/good image IDs) | Status (pass/fail per tag + last tested). Forces each calibration to be actionable with literal injectable wording.</p>

                <p className="text-yellow-400/80 font-medium mt-2">Template 2 — Drop-in Line Format (what AI actually reads):</p>
                <p>Each entry's <code className="bg-slate-900 px-1 rounded">model_instruction</code> should follow this format:</p>
                <p><code className="bg-slate-900 px-1 rounded">[CAL:Title | Strength] Do …; Avoid …; Prefer …</code></p>
                <p>Example: <code className="bg-slate-900 px-1 rounded">[CAL:Everyday employee look | Hard] Depict a realistic worker with natural skin texture and minimal makeup; avoid glam/influencer styling; prefer practical hair and functional posture.</code></p>

                <p className="text-yellow-400/80 font-medium mt-2">Template 3 — Calibration Pack (compiled block for injection):</p>
                <p>When generating for a specific tag, compile a block like:</p>
                <p><code className="bg-slate-900 px-1 rounded">Calibration Pack — Tag H (sorted by priority):</code></p>
                <p><code className="bg-slate-900 px-1 rounded">1. (Hard) [drop-in line]</code></p>
                <p><code className="bg-slate-900 px-1 rounded">2. (Hard) [drop-in line]</code></p>
                <p><code className="bg-slate-900 px-1 rounded">3. (Medium) [drop-in line]</code></p>
                <p>Meta-instruction included: "If a calibration item conflicts with guardrails, guardrails win. If two calibration items conflict, higher priority wins; if same priority, most recent wins."</p>

                <p className="text-orange-400/80 font-bold mt-3">═══ INJECTION STACK (where calibration goes in the prompt) ═══</p>
                <p><strong>Critical: Calibration is a DYNAMIC LAYER between guardrails and page context. Never bake it into permanent guardrails.</strong></p>
                <p>When generating an image prompt (Guided GPT flow), build context in this exact order:</p>
                <p className="pl-4">1. <strong>System / Role</strong> (already exists)</p>
                <p className="pl-4">2. <strong>Global Guardrails</strong> (persistent instructions — always included)</p>
                <p className="pl-4">3. <strong>Tag Guardrails</strong> (only for the active tag)</p>
                <p className="pl-4">4. <strong>Calibration Pack (DYNAMIC)</strong> — filtered by tag, sorted by priority, limited to top 12-20</p>
                <p className="pl-4">5. <strong>Page context</strong> (the ~75 words around image placement)</p>
                <p className="pl-4">6. <strong>Output contract</strong> ("Output ONLY the final prompt…")</p>
                <p><strong>Why this order:</strong> Calibration refines output without overriding fundamentals. Placing it after guardrails prevents calibration from accidentally relaxing hard rules.</p>

                <p className="text-yellow-400/80 font-medium mt-2">Query Logic (what gets injected):</p>
                <p>Given <code className="bg-slate-900 px-1 rounded">active_tag</code>:</p>
                <p className="pl-4">1. Include items where <code className="bg-slate-900 px-1 rounded">active_tag in tags[]</code></p>
                <p className="pl-4">2. Also include items marked "All" (global)</p>
                <p className="pl-4">3. Sort by priority desc (Hard → Med → Soft), then updatedAt desc</p>
                <p className="pl-4">4. Limit to <strong>12-20 max</strong> (avoid prompt bloat)</p>
                <p className="pl-4">5. Render as numbered bullet list using Template 3 format</p>
                <p>Inject into system prompt builder at <code className="bg-slate-900 px-1 rounded">ImageCreationSection.tsx:~5386</code>.</p>

                <p className="text-yellow-400/80 font-medium mt-2">Conflict Resolution:</p>
                <p>Simple rule: (1) Guardrails always beat calibration. (2) Higher priority calibration wins. (3) Same priority → most recent wins.</p>

                <p className="text-orange-400/80 font-bold mt-3">═══ DEBUG MODES ═══</p>

                <p className="text-yellow-400/80 font-medium mt-2">Mode A — "Show Injection" (transparency):</p>
                <p>In the test viewer, show the <strong>exact compiled context</strong> that was used for a generation: guardrails block + tag block + calibration pack block + page text. If something goes wrong, you can see whether calibration was missing or ignored.</p>

                <p className="text-yellow-400/80 font-medium mt-2">Mode B — "Disable Calibration" (A/B toggle):</p>
                <p>Toggle to run the same prompt generation <strong>with calibration off</strong> for quick proof that a calibration item actually matters. Side-by-side comparison: with vs without.</p>

                <p className="text-orange-400/80 font-bold mt-3">═══ UI LAYOUT ═══</p>
                <p>Dedicated collapsible "Calibration Library" sub-section under each prompt type area (not buried in test slots). Populated FROM test slot evidence. Flow: see near-miss in test slot → annotate it → "Create Calibration from This Result" button pre-fills card fields + attaches image/prompt → entry appears in Calibration Library. Drag to reorder priority. Version history visible. Each tag page can show "calibration entries affecting this tag" filtered view.</p>

                <p className="text-yellow-400/80 font-medium mt-2">AI Chat Role in Calibration:</p>
                <p>When user pastes near-miss evidence (image + prompt), AI should: (1) diagnose why it happened (prompt phrasing, rule conflict, missing negative), (2) propose a calibration entry with both <code className="bg-slate-900 px-1 rounded">human_note</code> and <code className="bg-slate-900 px-1 rounded">model_instruction</code>, (3) suggest a targeted test to verify the fix. AI defaults to tagging new entries with only the current tag being tested.</p>
              </div>
            </div>

            {/* PRD 4: Article Image Visibility */}
            <div className="bg-slate-800/70 rounded-lg p-3 border border-slate-700">
              <div className="text-xs text-brand-cyan font-bold mb-1">PRD 4: Article Image Visibility for AI Chat</div>
              <div className="text-xs text-gray-400 space-y-1">
                <p><strong>What:</strong> Let the AI chat see images that were generated for actual published article pages.</p>
                <p><strong>Purpose:</strong> AI can evaluate real-world results, compare against what it thinks is ideal, feeds into calibration.</p>
                <p><strong>Where images live:</strong> <code className="bg-slate-900 px-1 rounded">settings.image_bank</code> has BankImage objects with url, wpUrl, prompt, model, variation, etc.</p>
                <p><strong>Article images:</strong> Stored in <code className="bg-slate-900 px-1 rounded">articles.generated_images</code> (per article, in the database).</p>
                <p><strong>Implementation:</strong> Add article images to the AI chat system prompt context when the "Image Bank" scope toggle is on. Could use the existing loadArticles mechanism (line ~11136).</p>
              </div>
            </div>

            {/* PRD 5: Chat Textarea Auto-Expand + Resize Handle */}
            <div className="bg-slate-800/70 rounded-lg p-3 border border-slate-700">
              <div className="text-xs text-brand-cyan font-bold mb-1">PRD 5: Chat Textarea Auto-Expand + Resize Handle</div>
              <div className="text-xs text-gray-400 space-y-1">
                <p><strong>What:</strong> (1) Textarea auto-expands with text as you type (grows taller). (2) Manual resize handle so user can drag to make it bigger/smaller. (3) Always show the BOTTOM of the text (newest typing) not the top.</p>
                <p><strong>Current behavior:</strong> Auto-expand exists but capped at 200px max. No manual resize handle. Top of text stays visible while new text disappears below.</p>
                <p><strong>Where:</strong> Guided GPT chat textarea at <code className="bg-slate-900 px-1 rounded">ImageCreationSection.tsx:~11546</code>. Main Prompt chat textarea similarly structured.</p>
                <p><strong>Fix:</strong> Increase max height (or remove cap). Add CSS <code className="bg-slate-900 px-1 rounded">resize: vertical</code> for manual handle. Set <code className="bg-slate-900 px-1 rounded">scrollTop = scrollHeight</code> after value change to keep bottom visible. Default small, grows with content.</p>
              </div>
            </div>

            {/* PRD 6: Auto-Approve Toggle for Confirmation Guards */}
            <div className="bg-slate-800/70 rounded-lg p-3 border border-slate-700">
              <div className="text-xs text-brand-cyan font-bold mb-1">PRD 6: Auto-Approve Toggle for Confirmation Guards</div>
              <div className="text-xs text-gray-400 space-y-1">
                <p><strong>What:</strong> Add a toggle switch in the AI chat toolbar that lets the user turn off confirmation guards (Apply/Skip buttons). When ON, the AI can write directly to fields without asking. When OFF (default), the existing Apply/Skip flow continues.</p>
                <p><strong>Current behavior:</strong> Every time the AI wants to write to a field, a PendingConfirmation object is created and the user must click Apply or Skip. This is safe but slow for power users who trust the AI.</p>
                <p><strong>Where:</strong> <code className="bg-slate-900 px-1 rounded">pendingConfirmations</code> state at <code className="bg-slate-900 px-1 rounded">ImageCreationSection.tsx:~893</code>. <code className="bg-slate-900 px-1 rounded">handleApplyConfirmation</code> at <code className="bg-slate-900 px-1 rounded">:~3210</code>. <code className="bg-slate-900 px-1 rounded">handleSkipConfirmation</code> at <code className="bg-slate-900 px-1 rounded">:~3226</code>. Guard UI rendered at <code className="bg-slate-900 px-1 rounded">:~11150</code>. PendingConfirmation type in <code className="bg-slate-900 px-1 rounded">src/utils/parseCodeBlocks.ts:47-55</code>.</p>
                <p><strong>Implementation:</strong> (1) Add <code className="bg-slate-900 px-1 rounded">autoApproveAI: boolean</code> to settings (default false). (2) Add toggle in chat toolbar (both Main Prompt and Guided GPT toolbars). (3) In the code that creates PendingConfirmation objects, check if autoApproveAI is true — if so, call handleApplyConfirmation immediately instead of queueing. (4) Visual indicator: gold/green glow when auto-approve is ON so user remembers.</p>
              </div>
            </div>

            {/* PRD 7: Chat Scope Grid "All" Column Reactionary Logic */}
            <div className="bg-slate-800/70 rounded-lg p-3 border border-slate-700">
              <div className="text-xs text-brand-cyan font-bold mb-1">PRD 7: Chat Scope Grid "All" Column Reactionary Logic</div>
              <div className="text-xs text-gray-400 space-y-1">
                <p><strong>What:</strong> Make the "All" column in the Chat Scope Grid bidirectionally linked with the individual tag columns (H, J, C). Currently "All" is just another independent column with no special behavior.</p>
                <p><strong>Current behavior:</strong> Clicking "All" for a row only toggles the "All-rowKey" cell. It does NOT check/uncheck H, J, C for that row. Similarly, checking all of H, J, C does NOT auto-check "All".</p>
                <p><strong>Where:</strong> <code className="bg-slate-900 px-1 rounded">src/components/shared/SetScopeGrid.tsx</code> — <code className="bg-slate-900 px-1 rounded">toggleCell</code> at line 43, <code className="bg-slate-900 px-1 rounded">toggleColumn</code> at line 51, <code className="bg-slate-900 px-1 rounded">toggleRow</code> at line 60. Cell ID format: <code className="bg-slate-900 px-1 rounded">"ColumnName-rowKey"</code> (e.g. "All-prompt", "H-guardrails").</p>
                <p><strong>Implementation:</strong> (1) In <code className="bg-slate-900 px-1 rounded">toggleCell</code>: if col is "All", also toggle all other columns for that row. If col is NOT "All" but after toggling, all non-"All" columns are now checked for that row, auto-check "All" too (and vice versa — if unchecking breaks the full set, uncheck "All"). (2) In <code className="bg-slate-900 px-1 rounded">toggleColumn</code>: if toggling "All" column, toggle every cell in every column. If toggling a non-"All" column, update "All" cells for any rows that now have all tags checked/unchecked. (3) The grid must know which columns are "regular" vs "All" — pass an <code className="bg-slate-900 px-1 rounded">allColumnName</code> prop (default "All") or detect it internally.</p>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* PHASED IMPLEMENTATION PLAN */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="mt-4 bg-slate-900/80 rounded-lg p-4 border-2 border-yellow-500/40">
              <div className="text-sm text-yellow-400 font-bold mb-1">PHASED IMPLEMENTATION PLAN</div>
              <p className="text-xs text-gray-400 mb-3">Each phase is sized to ~45% of an agent's context window. Give the agent ONLY its phase's PRDs plus the relevant file locations. Do NOT combine phases.</p>

              {/* Phase 1 */}
              <div className="bg-slate-800/70 rounded-lg p-3 border border-green-500/30 mb-3">
                <div className="text-xs text-green-400 font-bold mb-2">PHASE 1 — Quick Wins (PRDs 5, 6, 7)</div>
                <div className="text-xs text-gray-400 space-y-1">
                  <p><strong>PRD 5:</strong> Chat Textarea Auto-Expand + Resize Handle — remove 200px cap, add resize handle, scroll to bottom. Guided GPT textarea at <code className="bg-slate-900 px-1 rounded">ImageCreationSection.tsx:~11546</code>. Small CSS/JS change.</p>
                  <p><strong>PRD 6:</strong> Auto-Approve Toggle — add <code className="bg-slate-900 px-1 rounded">autoApproveAI</code> boolean to settings, toggle in both chat toolbars, short-circuit PendingConfirmation when ON. Touches settings interface (~line 642), toolbar (~9507 and ~11331), guard logic (~3210).</p>
                  <p><strong>PRD 7:</strong> Scope Grid "All" Reactionary Logic — update <code className="bg-slate-900 px-1 rounded">SetScopeGrid.tsx</code> toggleCell/toggleColumn/toggleRow to bidirectionally link "All" with individual columns. Self-contained in one 170-line file.</p>
                  <p><strong>Estimated scope:</strong> ~3 files touched. Mostly small, focused changes. Good warm-up phase.</p>
                </div>
              </div>

              {/* Phase 2 */}
              <div className="bg-slate-800/70 rounded-lg p-3 border border-blue-500/30 mb-3">
                <div className="text-xs text-blue-400 font-bold mb-2">PHASE 2 — Test Image System (PRD 1 expanded)</div>
                <div className="text-xs text-gray-400 space-y-1">
                  <p><strong>PRD 1a:</strong> Test Image Gallery UI — horizontal scrollable strip of numbered images inside each test slot. Auto date/time stamps. Per-project image buttons that filter/scroll to matching images. Data model already exists in <code className="bg-slate-900 px-1 rounded">TestingSlotsSelector.tsx</code> (testImages field on TestingSlotContent interface, lines 114-123).</p>
                  <p><strong>PRD 1b:</strong> Test Images Stored WITH Prompts — clicking a slot tab opens a popup showing the prompt text + associated test images for that slot. Gallery is inside the popup. Dividers between test runs (grouped by timestamp/run).</p>
                  <p><strong>PRD 1c:</strong> Test Image Tab in Diff Modal — add an "Images" tab to the existing Compare to Main diff modal (already built at <code className="bg-slate-900 px-1 rounded">TestingSlotsSelector.tsx:830-1068</code>). Shows test slot images vs main images side-by-side.</p>
                  <p><strong>PRD 1d:</strong> Connect Image Generation to Test Slots — when a test slot is active and user generates images, store them in that slot's <code className="bg-slate-900 px-1 rounded">testImages</code> array. Hook into the existing image generation flow in <code className="bg-slate-900 px-1 rounded">ImageCreationSection.tsx</code>.</p>
                  <p><strong>Estimated scope:</strong> Primarily <code className="bg-slate-900 px-1 rounded">TestingSlotsSelector.tsx</code> + some integration points in <code className="bg-slate-900 px-1 rounded">ImageCreationSection.tsx</code>. Medium complexity — new UI components + data flow.</p>
                </div>
              </div>

              {/* Phase 3 */}
              <div className="bg-slate-800/70 rounded-lg p-3 border border-purple-500/30">
                <div className="text-xs text-purple-400 font-bold mb-2">PHASE 3 — AI Chat Intelligence (PRDs 2, 3, 4)</div>
                <div className="text-xs text-gray-400 space-y-1">
                  <p><strong>PRD 2:</strong> AI Chat Full Autonomy Over Testing System — AI can create/switch/fill/duplicate/promote test slots. Needs new tool definitions in the system prompt builder (<code className="bg-slate-900 px-1 rounded">ImageCreationSection.tsx:~5386</code>), new handler functions, and integration with the slot management API. Biggest PRD.</p>
                  <p><strong>PRD 3:</strong> Calibration System (Full Spec) — complete schema with per-entry fields: title, tags (multi-select), priority (Hard/Med/Soft), human_note + model_instruction (two-field design), trigger, do/avoid, enforcement tactics, evidence images, per-tag test status. Three templates: UI Card, Drop-in Line format (<code className="bg-slate-900 px-1 rounded">[CAL:Title|Strength] Do…; Avoid…; Prefer…</code>), Calibration Pack (compiled injection block). Injection stack: System → Global Guardrails → Tag Guardrails → <strong>Calibration Pack (dynamic, 12-20 max)</strong> → Page context → Output contract. Two debug modes: "Show Injection" (see compiled context) + "Disable Calibration" (A/B toggle). See full PRD 3 above for complete spec.</p>
                  <p><strong>PRD 4:</strong> Article Image Visibility for AI Chat — let the AI see article images (thumbnails or URLs) in its context so it can reference previous results. Requires reading from <code className="bg-slate-900 px-1 rounded">articles.generated_images</code> and including in chat system prompt.</p>
                  <p><strong>Estimated scope:</strong> Largest phase — significant system prompt changes, new handler functions, new UI sections. AI autonomy (PRD 2) is the most complex single feature.</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Feb 5 - VibeCoder Notepad Image Consolidation + Drip Feed Hybrid + UI Fixes */}
        <div className="border-l-4 border-purple-500 pl-4">
          <div className="text-sm text-purple-400 font-semibold">Feb 5, 2026 - VibeCoder Notepad Image Consolidation + Drip Feed Optimization + UI Improvements</div>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>VibeCoder Notepad: Image Consolidation</strong>
                <div className="text-xs text-gray-500">
                  Combines ALL images from pending edits into ONE consolidated image. Uses HTML Canvas to:
                  <br/>• Group each edit's images in a row with purple numbered circles (1, 2, 3)
                  <br/>• Purple separator lines between edit sections
                  <br/>• Image labels (1a, 1b, 2a) overlaid on each image
                  <br/>• Preview thumbnail before sending
                  <br/>• Copy to clipboard or download as PNG
                  <br/>Workflow: Consolidate → Copy text → Paste text → Drag ONE image
                  <br/>Solves Claude's 5-image limit - now unlimited images in one submission.
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">PERF</span>
              <div>
                <strong>Drip Feed Scheduler: Hybrid Sleep Approach</strong>
                <div className="text-xs text-gray-500">
                  Cron still ticks every 5 minutes, but now does fast COUNT(*) check first.
                  <br/>• If queue empty → logs "sleeping" and returns immediately (&lt;1ms)
                  <br/>• Only logs once on first empty, then every hour (reduces noise)
                  <br/>• Notification checker also skips when queue empty
                  <br/>• Status endpoint shows sleepingFor duration
                  <br/>Saves Railway resources during development when drip feed isn't being used.
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Toast Notification: Moved to Bottom Right</strong>
                <div className="text-xs text-gray-500">
                  "Loaded default workflow" toast was blocking top nav buttons (WordPress, Articles, etc).
                  Changed from top-5 right-5 to bottom-5 right-20 in App.tsx.
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Template Library: Side-by-Side Layout</strong>
                <div className="text-xs text-gray-500">
                  Create template form now shows text inputs on left, Include Sections checkboxes on right.
                  Changed from max-w-2xl to max-w-6xl with flex layout. Eliminates wasted vertical space.
                </div>
              </div>
            </li>
          </ul>
          <div className="mt-3 bg-slate-900/50 rounded p-2 text-xs">
            <span className="text-purple-400 font-semibold">Key Files:</span>
            <span className="text-gray-400 ml-2">
              src/components/VibeCoderNotepad.tsx (consolidation with Canvas),
              server/services/drip-feed-scheduler.js (hybrid sleep),
              App.tsx (toast position),
              src/components/TemplateLibrary.tsx (side-by-side)
            </span>
          </div>
          <div className="mt-2 bg-slate-900/50 rounded p-2 text-xs">
            <span className="text-purple-400 font-semibold">Commits:</span>
            <span className="text-gray-400 ml-2">79efda4, 735d5ac, 29fe4fa, 3602d1d</span>
          </div>
        </div>
      </div>
    </div>

    {/* January 2026 */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-gold mb-4">January 2026</h3>

      <div className="space-y-4">
        {/* Jan 20 - Template Persistence & Image Flow Final Fixes */}
        <div className="border-l-4 border-green-500 pl-4">
          <div className="text-sm text-green-400 font-semibold">Jan 20, 2026 - Template Persistence FULLY FIXED + Prompt Mode Settings FIXED + Image Flow Confirmed</div>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-red-400 font-bold">CRITICAL</span>
              <div>
                <strong>fallback_prompt_mode NOT SAVING - database column didn't exist!</strong>
                <div className="text-xs text-gray-500">Root cause: Column was defined in schema.sql but never migrated to production. Code fell back to simpler queries that omitted it. Added migrations 022 (fallback_prompt_mode) and 023 (live_prompt_mode) to setup-all.mjs</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 font-bold">CRITICAL</span>
              <div>
                <strong>Template persistence finally working - fallback queries were missing columns!</strong>
                <div className="text-xs text-gray-500">Root cause: 4 fallback INSERT/UPDATE queries in image-creation.js were missing prompt_templates, text_snippets, category_templates columns. Main queries had them but fallbacks didn't.</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Field name mismatch: placeholder_category_templates → category_templates</strong>
                <div className="text-xs text-gray-500">Frontend was sending placeholder_category_templates but server expected category_templates. Fixed 9 occurrences in ImageCreationSection.tsx</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>GET /api/image-creation/settings now returns template fields</strong>
                <div className="text-xs text-gray-500">Added prompt_templates, text_snippets, category_templates, guided_guardrails, consultant_chat_files, consultant_chat_conversations to response</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>/api/articles/:id/regenerate-image now uploads to WP first</strong>
                <div className="text-xs text-gray-500">Uses staging WordPress credentials to upload base64 → WP URL before storing. Stores ~100 byte URL instead of ~1MB base64</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">DOCS</span>
              <div>
                <strong>Blueprint: Golden Rule 14 added - Fallback query checklist</strong>
                <div className="text-xs text-gray-500">When adding columns, MUST update 4 query locations: main INSERT, fallback INSERT, main UPDATE, fallback UPDATE</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">DOCS</span>
              <div>
                <strong>Confirmed: Draft mode stores WP URLs, not base64</strong>
                <div className="text-xs text-gray-500">Image draft flow verified correct: Generate → Upload to staging WP → Store WP URL (~100 bytes) with wpMediaId → Review → Final push uses existing wpMediaId</div>
              </div>
            </li>
          </ul>
          <div className="mt-3 bg-slate-900/50 rounded p-2 text-xs">
            <span className="text-green-400 font-semibold">Commits:</span>
            <span className="text-gray-400 ml-2">1ee1e0e, 2a769ff, e8da445, ae7c6ec, 5780550</span>
          </div>
        </div>

        {/* Jan 20 (Later) - Image Source Tracking & UI Improvements */}
        <div className="border-l-4 border-teal-500 pl-4">
          <div className="text-sm text-teal-400 font-semibold">Jan 20, 2026 (Later) - Image Source Tracking + Tag Stripping + Meta Parsing</div>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>Image Source Tracking in imageDecisionReport</strong>
                <div className="text-xs text-gray-500">Added sourceMode ('bank', 'bank_fallback', 'live'), promptMode ('main_prompt', 'guided_gpt', 'smart_prompt'), and sourceSummary fields. Shows exactly where images came from.</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>New "Source" column in Article Library</strong>
                <div className="text-xs text-gray-500">Color-coded: Gold=Bank, Amber=Bank+Fallback, Cyan=Live. Shows full path like "Bank → Main Prompt" or "Live/Guided GPT"</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>Image source badge in Article detail header</strong>
                <div className="text-xs text-gray-500">Shows sourceSummary next to date/time. Same color scheme as Source column.</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>Image Path Log in Processing Log section</strong>
                <div className="text-xs text-gray-500">Simple log file at logs/image-path-decisions.log. Shows timestamp, article ID, keyword, source summary in one line per article. Much easier to debug than Railway logs.</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Processing Log history now persists correctly</strong>
                <div className="text-xs text-gray-500">Added logsRef to capture current logs without React closure issues. History button now shows all logs from completed runs.</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>stripTagFromKeyword() - Tags hidden from UI</strong>
                <div className="text-xs text-gray-500">Tags like (H), (J), (C) are for internal processing (placeholders). Now stripped from: article list, article header, ElementorPreview, WordPress publish calls, Google Search Preview URL.</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Defensive parsing for meta_titles and meta_descriptions</strong>
                <div className="text-xs text-gray-500">If meta data comes back as JSON string instead of array, it's now properly parsed. Prevents "No meta titles generated" when data exists but has wrong type.</div>
              </div>
            </li>
          </ul>
          <div className="mt-3 bg-slate-900/50 rounded p-2 text-xs">
            <span className="text-teal-400 font-semibold">Key Files:</span>
            <span className="text-gray-400 ml-2">server/routes/elementor.js (source tracking, log), ArticleListView.tsx (stripTagFromKeyword, Source column, meta parsing), App.tsx (Image Path Log UI, logsRef fix)</span>
          </div>
          <div className="mt-2 bg-slate-900/50 rounded p-2 text-xs">
            <span className="text-teal-400 font-semibold">Commits:</span>
            <span className="text-gray-400 ml-2">dc95c7b, c25a6d2, 38be499, a9f9a07, 201c95c</span>
          </div>
        </div>

        {/* Jan 19 - Image Upload & Persistence Fixes */}
        <div className="border-l-4 border-amber-500 pl-4">
          <div className="text-sm text-amber-400 font-semibold">Jan 19, 2026 - Image Upload & Persistence Improvements</div>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Template Library 507 error - excluded template_data from list queries</strong>
                <div className="text-xs text-gray-500">templates.js SELECT now excludes template_data column which contained huge base64 blobs. Only fetched when loading single template by ID</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Testing Mode now uploads to WordPress before saving to bank</strong>
                <div className="text-xs text-gray-500">handleSaveTestImageToBank() calls /api/image-creation/upload-to-wp first, stores WP URL (~100 bytes) instead of base64 (~1MB)</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>New endpoint: /api/image-creation/upload-to-wp</strong>
                <div className="text-xs text-gray-500">Utility endpoint to upload base64 image to staging WordPress. Used by Testing Mode and available for other flows</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>Chat File System for AI Prompt Assistant</strong>
                <div className="text-xs text-gray-500">Claude Projects-like folders for organizing chat sessions. New columns: consultant_chat_files, consultant_chat_conversations</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">DB</span>
              <div>
                <strong>New columns in image_creation_settings</strong>
                <div className="text-xs text-gray-500">prompt_templates, text_snippets, category_templates (for persistence), consultant_chat_files, consultant_chat_conversations (for chat organization)</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">DOCS</span>
              <div>
                <strong>Blueprint: Golden Rule 13 added</strong>
                <div className="text-xs text-gray-500">All generated images MUST go through WordPress upload BEFORE database storage</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">DOCS</span>
              <div>
                <strong>AGENT_HANDOFF.md created for remaining fixes</strong>
                <div className="text-xs text-gray-500">Documents: placeholder_category_templates field name mismatch, regenerate-image base64 issue, testing checklist</div>
              </div>
            </li>
          </ul>
        </div>

        {/* Jan 18 - Persistence & Protection */}
        <div className="border-l-4 border-emerald-500 pl-4">
          <div className="text-sm text-emerald-400 font-semibold">Jan 18, 2026 - Persistence & Protection Fixes</div>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-red-400 font-bold">CRITICAL</span>
              <div>
                <strong>Dual-layer protection against mainPrompt erasure</strong>
                <div className="text-xs text-gray-500">Frontend: handleUpdateAvatar() + updateSettings() block &gt;200 to &lt;100 char drops. Server: image-creation.js preserves existing data</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>AI Prompt Assistant chat persistence - FINALLY WORKING</strong>
                <div className="text-xs text-gray-500">Root cause: useState([]) never loaded from consultant_chat_history. Added useEffect sync on mount + updateSettings() after every message</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>AI Prompt Assistant expanding textarea with image paste</strong>
                <div className="text-xs text-gray-500">Auto-grows to 200px max. Supports Ctrl+V for images (like Claude Code). Images appear as thumbnails below input</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>AI Prompt Assistant history browser</strong>
                <div className="text-xs text-gray-500">Search through chat history, sort by date/type, jump to specific messages. Shows role (user/assistant) and timestamps</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>Workflow Export/Import includes Image Creation + Site Planning</strong>
                <div className="text-xs text-gray-500">JSON export now includes audience_avatars, mainPrompt, variations, placeholders AND all site plans with nodes</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">API</span>
              <div>
                <strong>New endpoints: site-planning export/import</strong>
                <div className="text-xs text-gray-500">GET /api/site-planning/export/:workflowId, POST /api/site-planning/import/:workflowId</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">UTIL</span>
              <div>
                <strong>Database search script: scripts/search-prompts.mjs</strong>
                <div className="text-xs text-gray-500">Search ALL tables for text patterns. Usage: DATABASE_URL="..." node scripts/search-prompts.mjs "CRITICAL"</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">DOCS</span>
              <div>
                <strong>Blueprint: Golden Rules 11 & 12 added</strong>
                <div className="text-xs text-gray-500">Rule 11: mainPrompt protection pattern. Rule 12: Chat history database sync pattern</div>
              </div>
            </li>
          </ul>
          <div className="mt-3 bg-slate-900/50 rounded p-2 text-xs">
            <span className="text-emerald-400 font-semibold">Commits:</span>
            <span className="text-gray-400 ml-2">b604bc6, aee8898, c02343c, 6a5d6c7, 3edcca2</span>
          </div>
        </div>

        {/* Jan 18 - Tag-Based System */}
        <div className="border-l-4 border-purple-500 pl-4">
          <div className="text-sm text-purple-400 font-semibold">Jan 18, 2026 - Tag-Based Multi-Prompt System</div>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>Phase 1: Tag-Based Multi-Prompt System (Database + Types)</strong>
                <div className="text-xs text-gray-500">Foundation for Guided GPT and Smart Prompt to have multiple prompts per tag (H, J, C, Global)</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">DB</span>
              <div>
                <strong>New JSONB fields in image_creation_settings:</strong>
                <div className="text-xs text-gray-500">guided_gpt_prompts, smart_prompt_prompts, guided_gpt_rules, legacy_prompt_rules</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">DB</span>
              <div>
                <strong>Templates table: scope + website_id columns</strong>
                <div className="text-xs text-gray-500">Enables 'website' vs 'app' global templates</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">API</span>
              <div>
                <strong>image-creation.js updated for new fields</strong>
                <div className="text-xs text-gray-500">INSERT/UPDATE include guided_gpt_prompts, smart_prompt_prompts, guided_gpt_rules, legacy_prompt_rules</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">API</span>
              <div>
                <strong>templates.js: scope + websiteId filtering</strong>
                <div className="text-xs text-gray-500">GET supports ?websiteId to return app-global + website-specific templates</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold">TYPE</span>
              <div>
                <strong>TypeScript interfaces: GuidedGptPrompt, SmartPromptPrompt, TagBasedRule</strong>
                <div className="text-xs text-gray-500">ImageCreationSection.tsx lines 244-305</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 font-bold">NEXT</span>
              <div>
                <strong>Phases 2-4 pending: Rules UI, Tag tabs UI, Template scope toggle</strong>
                <div className="text-xs text-gray-500">See System Archaeology → Tag-Based Multi-Prompt System for full plan</div>
              </div>
            </li>
          </ul>
        </div>

        {/* Jan 15 */}
        <div className="border-l-4 border-brand-gold pl-4">
          <div className="text-sm text-brand-gold font-semibold">Jan 15, 2026</div>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Template Library now shows errors instead of silently failing</strong>
                <div className="text-xs text-gray-500">API errors were swallowed → Now displays error message in red text with retry option</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Image Bank reads from website-level settings first</strong>
                <div className="text-xs text-gray-500">Was only reading workflow_id → Now checks website_id FIRST, then falls back to workflow_id</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Bank fallback (smart_matching_mode) now saves correctly</strong>
                <div className="text-xs text-gray-500">Added tryUpdateSmartMatchingMode() separate function to ensure setting persists</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Test Runner bank mode changed from bank_only to bank_first</strong>
                <div className="text-xs text-gray-500">Was using 'bank_only' which never falls back → Now uses 'bank_first' for proper fallback behavior</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>Tabbed section for Problem Areas, Reference Images, Logo & Action Shots</strong>
                <div className="text-xs text-gray-500">Consolidated resource inputs into a clean tabbed interface in Image Creation section</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>Audience Avatars full-page modal with Portal</strong>
                <div className="text-xs text-gray-500">Expand button opens modal using createPortal() to avoid flickering issues</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>Default changed to Generate Live + Main Prompt</strong>
                <div className="text-xs text-gray-500">New workflows now default to live image generation instead of bank</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold">PERF</span>
              <div>
                <strong>Main Prompt textarea auto-resize with requestAnimationFrame</strong>
                <div className="text-xs text-gray-500">Smooth resize on section expand without layout thrashing</div>
              </div>
            </li>
          </ul>
        </div>

        {/* Jan 13 */}
        <div className="border-l-4 border-green-500 pl-4">
          <div className="text-sm text-green-400 font-semibold">Jan 13, 2026</div>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Console errors showing empty {} instead of message</strong>
                <div className="text-xs text-gray-500">Error objects don't serialize to JSON → Extract err.message in catch blocks</div>
              </div>
            </li>
          </ul>
        </div>

        {/* Jan 11 */}
        <div className="border-l-4 border-brand-cyan pl-4">
          <div className="text-sm text-brand-cyan font-semibold">Jan 11, 2026</div>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Draft Image Bank not displaying images</strong>
                <div className="text-xs text-gray-500">sql.unsafe() throwing empty errors → Rewrote with tagged templates</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Draft Bank header showed 0 until opened</strong>
                <div className="text-xs text-gray-500">Added fetchDraftBankStatsOnly() on component mount</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>Image Recycle Feature</strong>
                <div className="text-xs text-gray-500">Draft Bank → Image Bank recycling, Used → Available restore</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">FEAT</span>
              <div>
                <strong>Image Selection & Expand All</strong>
                <div className="text-xs text-gray-500">Checkboxes, Select All, full-screen grid view modal</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">DOCS</span>
              <div>
                <strong>Blueprint: Image Recycle tab</strong>
                <div className="text-xs text-gray-500">Technical documentation with field mappings, API endpoints, SQL patterns</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">DOCS</span>
              <div>
                <strong>Blueprint: Changelog tab</strong>
                <div className="text-xs text-gray-500">Searchable feature/fix history</div>
              </div>
            </li>
          </ul>
        </div>

        {/* Jan 10 */}
        <div className="border-l-4 border-brand-gold pl-4">
          <div className="text-sm text-brand-gold font-semibold">Jan 10, 2026</div>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>502 Timeout on image generation</strong>
                <div className="text-xs text-gray-500">Parallelized image generation: 5 images now ~22s instead of ~300s (13x speedup)</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>workflowId race condition</strong>
                <div className="text-xs text-gray-500">Added validation in App.tsx before publish calls</div>
              </div>
            </li>
          </ul>
        </div>

        {/* Earlier Jan */}
        <div className="border-l-4 border-gray-600 pl-4">
          <div className="text-sm text-gray-400 font-semibold">Earlier in January</div>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Image Creation settings 500 error</strong>
                <div className="text-xs text-gray-500">Invalid nested SQL template literals → if/else blocks</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>website_id column doesn't exist</strong>
                <div className="text-xs text-gray-500">Added try-catch fallback for missing migration</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>guided_guardrails column doesn't exist</strong>
                <div className="text-xs text-gray-500">Added to INSERT fallback check</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Staging WordPress credentials fallback</strong>
                <div className="text-xs text-gray-500">Removed incorrect fallback to workflow credentials</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Article button pushing images</strong>
                <div className="text-xs text-gray-500">Added articleOnly: true parameter</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Meta push "Invalid post ID"</strong>
                <div className="text-xs text-gray-500">Try /pages/ first, fallback to /posts/</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">FIX</span>
              <div>
                <strong>Images button not embedding images</strong>
                <div className="text-xs text-gray-500">Delete → Recreate page approach (Elementor can't update _elementor_data via REST)</div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>

    {/* Quick Reference */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-gold/30">
      <h3 className="text-lg font-bold text-brand-gold mb-4">Quick Reference: Common Patterns</h3>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="text-brand-cyan font-semibold mb-2">SQL Optional Filters</div>
          <code className="text-xs text-gray-300 block">{`(\${val || null}::text IS NULL OR col = \${val || null})`}</code>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="text-brand-cyan font-semibold mb-2">Stats on Mount</div>
          <code className="text-xs text-gray-300 block">useEffect fetch stats separately from data</code>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="text-brand-cyan font-semibold mb-2">WordPress Page Type</div>
          <code className="text-xs text-gray-300 block">Try /pages/ first, then /posts/</code>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="text-brand-cyan font-semibold mb-2">Elementor Updates</div>
          <code className="text-xs text-gray-300 block">Delete page → Recreate with same slug</code>
        </div>
      </div>
    </div>

    {/* Legend */}
    <div className="bg-slate-800/30 rounded-lg p-4 flex gap-6 justify-center text-sm">
      <div className="flex items-center gap-2">
        <span className="text-green-400 font-bold">FIX</span>
        <span className="text-gray-400">Bug fix</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-blue-400 font-bold">FEAT</span>
        <span className="text-gray-400">New feature</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-purple-400 font-bold">DOCS</span>
        <span className="text-gray-400">Documentation</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-yellow-400 font-bold">PERF</span>
        <span className="text-gray-400">Performance</span>
      </div>
    </div>
  </div>
);

// System Archaeology - Mapping all the ways systems have been built for clean SAS rewrite
const SystemArchaeology: React.FC = () => (
  <div className="space-y-8 max-w-6xl mx-auto">
    {/* Header */}
    <div className="text-center mb-8">
      <h2 className="text-3xl font-bold text-brand-gold mb-2">System Archaeology</h2>
      <p className="text-gray-400 text-lg">Map every layer before the clean rebuild</p>
    </div>

    {/* Why This Exists */}
    <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-6 border border-purple-500/50">
      <h3 className="text-xl font-bold text-purple-400 mb-4">Why We Need This</h3>
      <div className="text-gray-300 space-y-3">
        <p>
          This codebase is an <strong className="text-white">MVP built by multiple AI agents over time</strong>.
          Features were added incrementally - sometimes building on top of previous systems, sometimes partially replacing them.
          The result is <strong className="text-yellow-400">layers upon layers</strong> of code, some active, some dead, some half-built.
        </p>
        <p>
          Before we can do a <strong className="text-brand-cyan">clean SAS rewrite</strong>, we need a complete map of:
        </p>
        <ul className="list-disc list-inside ml-4 space-y-1 text-gray-400">
          <li><strong className="text-white">How it works RIGHT NOW</strong> - The current truth</li>
          <li><strong className="text-white">All the ways it WAS wired</strong> - Legacy code, stubs, dead paths</li>
          <li><strong className="text-white">What's actively used vs abandoned</strong> - What to keep vs delete</li>
          <li><strong className="text-white">The BEST way to rebuild it</strong> - If we could do it over, how?</li>
        </ul>
        <p className="text-brand-gold mt-4">
          This page is where we collect all system investigations. When we're ready for the rewrite,
          we'll have a complete 3D picture of everything and can pick the best architecture.
        </p>
      </div>
    </div>

    {/* Instructions for Agents */}
    <div className="bg-red-900/20 rounded-xl p-6 border border-red-500/50">
      <h3 className="text-xl font-bold text-red-400 mb-4">📋 Instructions for Agents</h3>
      <div className="text-gray-300 space-y-4">
        <p className="text-lg">
          <strong className="text-white">If you've been sent here to map out a system, follow these steps:</strong>
        </p>

        <div className="bg-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
            <div>
              <strong className="text-white">Trace the Full Path</strong>
              <p className="text-gray-400 text-sm">Start from UI → API → Database → Runtime. Don't just read code - trace actual execution.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
            <div>
              <strong className="text-white">Find ALL Configuration Options</strong>
              <p className="text-gray-400 text-sm">Where is each setting stored? Set? Read? What are valid values? What's the default?</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
            <div>
              <strong className="text-white">Dig for Historical Layers</strong>
              <p className="text-gray-400 text-sm">What was the original way? What was added later? What's dead code now?</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
            <div>
              <strong className="text-white">Document Inconsistencies</strong>
              <p className="text-gray-400 text-sm">UI settings not saved? Server reading wrong location? Duplicate logic?</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">5</span>
            <div>
              <strong className="text-white">Recommend the Clean Version</strong>
              <p className="text-gray-400 text-sm">If rebuilding from scratch, what's the simplest, cleanest architecture?</p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-900/30 rounded-lg p-4 border border-yellow-500/30">
          <p className="text-yellow-400 font-semibold">Output Format</p>
          <p className="text-gray-400 text-sm mt-1">
            Add your investigation to this page following the example below. Include: Purpose, Current Architecture Diagram,
            Configuration Matrix, Historical Layers, Issues Found, and Clean Version Recommendation.
          </p>
        </div>
      </div>
    </div>

    {/* Investigation Template */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-xl font-bold text-brand-cyan mb-4">📝 Investigation Template</h3>
      <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-gray-300 overflow-x-auto">
        <pre>{`## [System Name] - Archaeology Report

### Purpose
[One paragraph: What is this system supposed to do?]

### Current Architecture
[ASCII diagram showing UI → API → DB → Runtime flow]

### Configuration Matrix
| Setting | UI Location | DB Column | Server Read | Default | Status |
|---------|-------------|-----------|-------------|---------|--------|
| ...     | ...         | ...       | ...         | ...     | Active/Dead/Partial |

### Historical Layers
| Component | Original Way | Added Later | Current | Dead Code |
|-----------|-------------|-------------|---------|-----------|
| ...       | ...         | ...         | ...     | ...       |

### Issues Found
- [ ] Issue 1: Description
- [ ] Issue 2: Description

### Stubs & Half-Built Systems
- Name: What it is, why it's abandoned

### Clean Version Recommendation
[Proposed simplified architecture diagram]
[What to remove, what to keep, what to rename]

### Files Touched
- file1.ts - Description
- file2.js - Description`}</pre>
      </div>
    </div>

    {/* Divider */}
    <div className="border-t border-brand-gold/50 my-8"></div>
    <h2 className="text-2xl font-bold text-brand-gold text-center">Completed Investigations</h2>

    {/* INVESTIGATION 1: Image Prompt Mode System */}
    <div className="bg-slate-800 rounded-xl p-6 border border-brand-gold/50">
      <div className="flex items-center gap-3 mb-4">
        <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">COMPLETE</span>
        <h3 className="text-xl font-bold text-white">Image Prompt Mode System</h3>
        <span className="text-gray-400 text-sm">Jan 2026</span>
      </div>

      {/* Purpose */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Purpose</h4>
        <p className="text-gray-300">
          The Image Creation system has <strong className="text-white">3 prompt modes</strong> for generating images:
          <strong className="text-brand-gold"> Main Prompt</strong> (avatar template with smart matching),
          <strong className="text-emerald-400"> Guided GPT</strong> (AI with guardrails), and
          <strong className="text-purple-400"> Smart Prompt</strong> (legacy content analysis).
          These modes apply both to direct "Generate Live" and to fallback when bank is empty.
        </p>
      </div>

      {/* Current Architecture */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Current Architecture</h4>
        <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-gray-300 overflow-x-auto">
          <pre>{`┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (UI Layer)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  ImageCreationSection.tsx                                                │
│  ├── integration_mode: 'live' | 'bank'     ← Master toggle               │
│  ├── live_prompt_mode: 3 buttons           ← For direct "Generate Live"  │
│  ├── fallback_prompt_mode: 3 buttons       ← For bank→live fallback      │
│  └── updateSettings() → saves ALL to server                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVER (API Layer)                               │
├─────────────────────────────────────────────────────────────────────────┤
│  image-creation.js                                                       │
│  ├── GET  /settings/:workflowId → returns live_prompt_mode,              │
│  │                                 fallback_prompt_mode                  │
│  ├── PUT  /settings/:workflowId → saves to website_id OR workflow_id     │
│  └── Priority: website_id > workflow_id                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATABASE (Storage Layer)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  image_creation_settings table                                           │
│  ├── website_id OR workflow_id    ← Can store at EITHER level            │
│  ├── live_prompt_mode             ← 'main_prompt'|'guided_gpt'|'smart'   │
│  ├── fallback_prompt_mode         ← 'main_prompt'|'guided_gpt'|'smart'   │
│  ├── audience_avatars (JSONB)     ← Contains mainPrompt templates        │
│  └── guided_guardrails (JSONB)    ← Contains GPT instructions            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      PUBLISH ENGINE (Runtime)                            │
├─────────────────────────────────────────────────────────────────────────┤
│  elementor.js (2 separate reads!)                                        │
│  ├── ~Line 460: Initial settings read (integration_mode, model, etc)     │
│  ├── ~Line 1210: Generate Live settings read (prompt mode, avatar)       │
│  │                                                                       │
│  │  Decision Logic (FIXED Jan 20, 2026):                                 │
│  │  if (isFallbackFromBank) {                                           │
│  │    use fallback_prompt_mode || 'main_prompt'  ← SEPARATE setting!    │
│  │  } else {                                                            │
│  │    use live_prompt_mode || 'main_prompt'   ← Direct live mode        │
│  │  }                                                                   │
│  │  ⚠️  CRITICAL: Do NOT chain fallback || live - they are SEPARATE!   │
│  └── Passes mode to image-pipeline.js                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      IMAGE PIPELINE (Generator)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  image-pipeline.js                                                       │
│  ├── if livePromptMode === 'main_prompt':                               │
│  │     → smartMatchForPosition() + buildPromptWithReplacements()        │
│  ├── else if livePromptMode === 'guided_gpt':                           │
│  │     → generateGuidedPrompt() with guardrails                         │
│  ├── else (smart_prompt):                                               │
│  │     → extractImageAction() legacy content analysis                   │
│  └── All paths → generateImage() with final prompt                      │
└─────────────────────────────────────────────────────────────────────────┘`}</pre>
        </div>
      </div>

      {/* Configuration Matrix */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Configuration Matrix</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left py-2 text-gray-400">Setting</th>
                <th className="text-left py-2 text-gray-400">UI Location</th>
                <th className="text-left py-2 text-gray-400">DB Column</th>
                <th className="text-left py-2 text-gray-400">Server Read</th>
                <th className="text-left py-2 text-gray-400">Default</th>
                <th className="text-left py-2 text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-slate-700">
                <td className="py-2">integration_mode</td>
                <td>ImageCreationSection</td>
                <td>integration_mode</td>
                <td>elementor.js:510</td>
                <td>'bank'</td>
                <td><span className="text-green-400">Active</span></td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2">live_prompt_mode</td>
                <td>ImageCreationSection:5629</td>
                <td>live_prompt_mode</td>
                <td>elementor.js:524,1254</td>
                <td>'main_prompt'</td>
                <td><span className="text-green-400">Active (FIXED Jan 2026)</span></td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2">fallback_prompt_mode</td>
                <td>ImageCreationSection:7642</td>
                <td>fallback_prompt_mode</td>
                <td>elementor.js:1250</td>
                <td>'main_prompt'</td>
                <td><span className="text-green-400">Active (FIXED Jan 2026)</span></td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2">fallback_to_live</td>
                <td>ImageCreationSection</td>
                <td>fallback_to_live</td>
                <td>elementor.js:516-518</td>
                <td>true</td>
                <td><span className="text-yellow-400">LEGACY - overridden by smart_matching_mode</span></td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2">smart_matching_mode</td>
                <td>ImageCreationSection</td>
                <td>smart_matching_mode</td>
                <td>elementor.js:511</td>
                <td>'bank_first'</td>
                <td><span className="text-green-400">Active - SOURCE OF TRUTH for fallback</span></td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2">audience_avatars</td>
                <td>ImageCreationSection</td>
                <td>audience_avatars (JSONB)</td>
                <td>elementor.js:528,1262</td>
                <td>[default avatar]</td>
                <td><span className="text-green-400">Active</span></td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2">guided_guardrails</td>
                <td>ImageCreationSection</td>
                <td>guided_guardrails (JSONB)</td>
                <td>elementor.js:539,1268</td>
                <td>{'{}'}</td>
                <td><span className="text-green-400">Active</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Layers */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Historical Layers (Archaeology)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left py-2 text-gray-400">Component</th>
                <th className="text-left py-2 text-gray-400">Original Way</th>
                <th className="text-left py-2 text-gray-400">Added Later</th>
                <th className="text-left py-2 text-gray-400">Current</th>
                <th className="text-left py-2 text-gray-400">Dead Code</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-slate-700">
                <td className="py-2">Storage Level</td>
                <td>workflow_id only</td>
                <td>website_id added</td>
                <td className="text-green-400">Both, website preferred</td>
                <td>None</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2">Prompt Mode</td>
                <td>Hardcoded smart_prompt</td>
                <td>live_prompt_mode column</td>
                <td className="text-green-400">DB-driven, 3 modes</td>
                <td>None now</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2">Fallback Logic</td>
                <td>fallback_to_live boolean</td>
                <td>smart_matching_mode</td>
                <td className="text-green-400">smart_matching_mode is truth</td>
                <td className="text-yellow-400">fallback_to_live still read but ignored</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2">Avatar Selection</td>
                <td>Single default avatar</td>
                <td>Multi-avatar with tags</td>
                <td className="text-green-400">Tag-based selection</td>
                <td className="text-yellow-400">variations array partially orphaned</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2">Settings Read</td>
                <td>Single read workflow_id</td>
                <td>Added website_id check</td>
                <td className="text-yellow-400">TWO separate reads in elementor.js</td>
                <td>Could consolidate</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Stubs & Half-Built */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Stubs & Half-Built Systems</h4>
        <div className="space-y-2">
          <div className="bg-slate-900 rounded p-3">
            <span className="text-yellow-400 font-semibold">fallback_to_live boolean</span>
            <span className="text-gray-400 text-sm ml-2">- Still in schema/UI but overridden by smart_matching_mode</span>
          </div>
          <div className="bg-slate-900 rounded p-3">
            <span className="text-yellow-400 font-semibold">variations array in avatars</span>
            <span className="text-gray-400 text-sm ml-2">- Old system, mostly replaced by tag-based selection</span>
          </div>
          <div className="bg-slate-900 rounded p-3">
            <span className="text-yellow-400 font-semibold">smart_matching_enabled toggle</span>
            <span className="text-gray-400 text-sm ml-2">- Exists but behavior unclear vs smart_matching_mode</span>
          </div>
          <div className="bg-slate-900 rounded p-3">
            <span className="text-yellow-400 font-semibold">matching_rule_1-4</span>
            <span className="text-gray-400 text-sm ml-2">- Editable rules in DB but unclear if code reads them</span>
          </div>
          <div className="bg-slate-900 rounded p-3">
            <span className="text-yellow-400 font-semibold">Duplicate settings reads</span>
            <span className="text-gray-400 text-sm ml-2">- elementor.js lines 460 and 1210 both query same table</span>
          </div>
        </div>
      </div>

      {/* Issues Found & Resolved - Jan 20, 2026 */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Issues Found & Resolved (Jan 20, 2026)</h4>
        <div className="space-y-3">
          <div className="bg-green-900/30 rounded-lg p-4 border border-green-500">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-400">✓ FIXED</span>
              <span className="font-semibold text-white">Database column didn't exist</span>
            </div>
            <p className="text-gray-400 text-sm">
              <strong>Problem:</strong> <code className="bg-slate-900 px-1 rounded">fallback_prompt_mode</code> was in schema.sql but never migrated.
              Code fell back to simpler queries that omitted it. Column physically didn't exist in PostgreSQL.
            </p>
            <p className="text-gray-400 text-sm mt-2">
              <strong>Fix:</strong> Added migrations 022 and 023 to <code className="bg-slate-900 px-1 rounded">setup-all.mjs</code>.
              Runs on server restart via npm start → db:setup.
            </p>
          </div>
          <div className="bg-green-900/30 rounded-lg p-4 border border-green-500">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-400">✓ FIXED</span>
              <span className="font-semibold text-white">Settings were chained with ||</span>
            </div>
            <p className="text-gray-400 text-sm">
              <strong>Problem:</strong> Code at elementor.js:1307 was <code className="bg-slate-900 px-1 rounded">fallback_prompt_mode || live_prompt_mode || 'main_prompt'</code>.
              If fallback was undefined, it used live setting instead - mixing two independent configurations.
            </p>
            <p className="text-gray-400 text-sm mt-2">
              <strong>Fix:</strong> Changed to <code className="bg-slate-900 px-1 rounded">fallback_prompt_mode || 'main_prompt'</code>.
              Each path now uses its own setting exclusively.
            </p>
          </div>
          <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-500">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-400">ℹ️ DOCUMENTED</span>
              <span className="font-semibold text-white">main_prompt requires populated avatar.mainPrompt</span>
            </div>
            <p className="text-gray-400 text-sm">
              <strong>Behavior:</strong> When main_prompt mode is selected but the matched avatar has empty mainPrompt,
              the system falls through to smart_prompt. This is by design but logged as a warning.
            </p>
            <p className="text-gray-400 text-sm mt-2">
              <strong>User action:</strong> Ensure H/J/C tagged avatars have mainPrompt templates populated.
              See image-pipeline.js:553-567 for the warning logs.
            </p>
          </div>
        </div>
      </div>

      {/* Clean Version Recommendation */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Clean Version Recommendation</h4>
        <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-gray-300 overflow-x-auto">
          <pre>{`// RECOMMENDED: Unified Settings Object
imageSettings = {
  source: 'bank' | 'live',              // replaces integration_mode
  bankFallback: 'none' | 'live',        // replaces smart_matching_mode
  liveMode: 'template' | 'ai' | 'legacy',  // clearer names
  fallbackMode: 'template' | 'ai' | 'legacy',
  templates: [...],                      // replaces audience_avatars
  aiConfig: {                            // replaces guided_guardrails
    model: string,
    instructions: string,
    avoid: string[]
  }
}

REMOVE:
- fallback_to_live (replaced by bankFallback)
- smart_matching_enabled (confusing, consolidate)
- variations array (use tags only)
- matching_rule_1-4 (unless actively used)
- Duplicate settings reads in elementor.js (read ONCE, pass around)

RENAME FOR CLARITY:
- 'smart_prompt' → 'legacy' (it's the old way)
- 'main_prompt' → 'template' (clearer)
- 'guided_gpt' → 'ai' (model-agnostic)`}</pre>
        </div>
      </div>

      {/* Files Touched */}
      <div>
        <h4 className="text-brand-cyan font-semibold mb-2">Files Touched</h4>
        <div className="grid md:grid-cols-2 gap-2 text-sm">
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">src/components/ImageCreationSection.tsx</code>
            <span className="text-gray-400 block text-xs">UI for all settings, 3-button toggles</span>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">server/routes/image-creation.js</code>
            <span className="text-gray-400 block text-xs">GET/PUT API, DB queries</span>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">server/routes/elementor.js</code>
            <span className="text-gray-400 block text-xs">Publish engine, reads settings twice</span>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">server/services/image-pipeline.js</code>
            <span className="text-gray-400 block text-xs">Actual prompt generation per mode</span>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">server/db/schema.sql</code>
            <span className="text-gray-400 block text-xs">Table definition, migrations</span>
          </div>
        </div>
      </div>
    </div>

    {/* INVESTIGATION 2: Tag-Based Multi-Prompt System */}
    <div className="bg-slate-800 rounded-xl p-6 border border-purple-500/50">
      <div className="flex items-center gap-3 mb-4">
        <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-bold">IN PROGRESS</span>
        <h3 className="text-xl font-bold text-white">Tag-Based Multi-Prompt System</h3>
        <span className="text-gray-400 text-sm">Jan 18, 2026</span>
      </div>

      {/* Purpose */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Purpose</h4>
        <p className="text-gray-300">
          Extends <strong className="text-emerald-400">Guided GPT</strong> and <strong className="text-purple-400">Smart Prompt (Legacy)</strong> modes
          to support <strong className="text-white">multiple prompts per tag</strong> (H, J, C) plus Global prompts.
          Mirrors the existing <strong className="text-brand-gold">Audience Avatars</strong> tag-based system.
          Also adds <strong className="text-white">tag-based rules</strong> to replace the current Placement Rules in Smart Matching area.
        </p>
      </div>

      {/* Phase Status */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Implementation Status</h4>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-green-900/30 rounded-lg p-3 border border-green-500/50">
            <span className="text-green-400 font-bold">Phase 1: COMPLETE</span>
            <p className="text-gray-400 text-xs mt-1">Database schema, TypeScript types, backend routes</p>
          </div>
          <div className="bg-green-900/30 rounded-lg p-3 border border-green-500/50">
            <span className="text-green-400 font-bold">Phase 2: COMPLETE</span>
            <p className="text-gray-400 text-xs mt-1">Guided GPT Rules + Legacy Prompt Rules UI sections</p>
          </div>
          <div className="bg-green-900/30 rounded-lg p-3 border border-green-500/50">
            <span className="text-green-400 font-bold">Phase 3: COMPLETE</span>
            <p className="text-gray-400 text-xs mt-1">Tag tabs UI for Guided GPT and Smart Prompt</p>
          </div>
          <div className="bg-green-900/30 rounded-lg p-3 border border-green-500/50">
            <span className="text-green-400 font-bold">Phase 4: COMPLETE</span>
            <p className="text-gray-400 text-xs mt-1">Template scope toggle (Website Global / App Global)</p>
          </div>
        </div>
      </div>

      {/* New Database Fields */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">New Database Fields (image_creation_settings)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left py-2 text-gray-400">Column</th>
                <th className="text-left py-2 text-gray-400">Type</th>
                <th className="text-left py-2 text-gray-400">Structure</th>
                <th className="text-left py-2 text-gray-400">Purpose</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-slate-700">
                <td className="py-2 text-emerald-400">guided_gpt_prompts</td>
                <td>JSONB</td>
                <td className="text-xs font-mono">{'{id, tag, name, guidance, guardrails, model, globalAppliesTo}'}</td>
                <td>Multi-prompt per tag for Guided GPT</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 text-purple-400">smart_prompt_prompts</td>
                <td>JSONB</td>
                <td className="text-xs font-mono">{'{id, tag, name, guidance, globalAppliesTo}'}</td>
                <td>Multi-prompt per tag for Legacy Prompt</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 text-emerald-400">guided_gpt_rules</td>
                <td>JSONB</td>
                <td className="text-xs font-mono">{'{id, tag, title, text, order, globalAppliesTo}'}</td>
                <td>Rules per tag for Guided GPT mode</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 text-purple-400">legacy_prompt_rules</td>
                <td>JSONB</td>
                <td className="text-xs font-mono">{'{id, tag, title, text, order, globalAppliesTo}'}</td>
                <td>Rules per tag for Legacy Prompt mode</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Templates Table Changes */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Templates Table Changes</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left py-2 text-gray-400">Column</th>
                <th className="text-left py-2 text-gray-400">Type</th>
                <th className="text-left py-2 text-gray-400">Values</th>
                <th className="text-left py-2 text-gray-400">Purpose</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-slate-700">
                <td className="py-2 text-brand-gold">scope</td>
                <td>VARCHAR(20)</td>
                <td>'website' | 'app'</td>
                <td>Website-specific vs app-wide availability</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 text-brand-gold">website_id</td>
                <td>INTEGER FK</td>
                <td>NULL or websites.id</td>
                <td>For website-scoped templates</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Architecture Diagram */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Target Architecture (After Phase 3)</h4>
        <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-gray-300 overflow-x-auto">
          <pre>{`┌─────────────────────────────────────────────────────────────────────────┐
│                    TAG-BASED MULTI-PROMPT SYSTEM                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─ Guided GPT Section ─────────────────────────────────────────────┐   │
│  │                                                                   │   │
│  │  [H 3] ─ [J 2] ─ [C 1] ─ [🌐 Global]    [Model: gpt-4o ▼]       │   │
│  │   └─ H1, H2, H3    (tag tabs + multiple per tag)                 │   │
│  │                                                                   │   │
│  │  ┌─ Guardrails / Guidance ─────────────────────────────────────┐ │   │
│  │  │ [Per-tag content - switches when tab changes]               │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  │  [Copy From ▼]  ← Copy prompt from another tag                   │   │
│  │                                                                   │   │
│  │  ▼ Guided GPT Rules (collapsible) ──────────────────────────────│   │
│  │    • Editable rule titles and text                               │   │
│  │    • Per-tag rules (H, J, C, Global)                            │   │
│  │    • [+ Add Rule]                                                │   │
│  │    • Variation Order: [Sequential ▼] (includes "Follow rules")  │   │
│  │                                                                   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ Smart Prompt (Legacy) Section ──────────────────────────────────┐   │
│  │  (Same tag-based structure as Guided GPT)                        │   │
│  │                                                                   │   │
│  │  [H 2] ─ [J 1] ─ [C 1] ─ [🌐 Global]                            │   │
│  │                                                                   │   │
│  │  ┌─ Guidance Text ──────────────────────────────────────────────┐ │   │
│  │  │ [Per-tag content]                                            │ │   │
│  │  └──────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  │  ▼ Legacy Prompt Rules (collapsible)                             │   │
│  │                                                                   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ Global Tab Behavior ────────────────────────────────────────────┐   │
│  │  When "Global" is selected:                                      │   │
│  │  ☑ Apply to H  ☑ Apply to J  ☐ Apply to C                       │   │
│  │  (Checkboxes to specify which tags this global prompt covers)    │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘`}</pre>
        </div>
      </div>

      {/* Reference Implementation */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Reference Implementation (Copy This Pattern)</h4>
        <div className="bg-slate-900 rounded-lg p-4">
          <p className="text-gray-300 text-sm mb-2">
            <strong className="text-white">Audience Avatars</strong> already has the exact tag-based system needed.
            Use this as the template for Guided GPT and Smart Prompt sections:
          </p>
          <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
            <li><code className="text-brand-gold">ImageCreationSection.tsx:8930-9100</code> - Tag tabs UI</li>
            <li><code className="text-brand-gold">ImageCreationSection.tsx:244-305</code> - TypeScript interfaces</li>
            <li><code className="text-brand-gold">ImageCreationSection.tsx:646-653</code> - Default values</li>
          </ul>
        </div>
      </div>

      {/* Key Wiring Points */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Key Wiring Points (Don't Break These)</h4>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div className="bg-red-900/20 rounded-lg p-3 border border-red-500/30">
            <span className="text-red-400 font-semibold">image-creation.js INSERT</span>
            <p className="text-gray-400 text-xs mt-1">Line ~976: New fields in INSERT VALUES</p>
          </div>
          <div className="bg-red-900/20 rounded-lg p-3 border border-red-500/30">
            <span className="text-red-400 font-semibold">image-creation.js UPDATE</span>
            <p className="text-gray-400 text-xs mt-1">Line ~1034: COALESCE for new fields</p>
          </div>
          <div className="bg-red-900/20 rounded-lg p-3 border border-red-500/30">
            <span className="text-red-400 font-semibold">templates.js GET</span>
            <p className="text-gray-400 text-xs mt-1">Lines 24-67: websiteId filtering logic</p>
          </div>
          <div className="bg-red-900/20 rounded-lg p-3 border border-red-500/30">
            <span className="text-red-400 font-semibold">templates.js INSERT</span>
            <p className="text-gray-400 text-xs mt-1">Lines 144-155: scope + website_id columns</p>
          </div>
        </div>
      </div>

      {/* What Remains */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">What Remains (For Next Agent)</h4>
        <div className="space-y-3 text-sm">
          <div className="bg-slate-900 rounded-lg p-3">
            <span className="text-yellow-400 font-bold">Phase 2:</span>
            <span className="text-gray-300 ml-2">Build "Guided GPT Rules" and "Legacy Prompt Rules" collapsible sections</span>
            <p className="text-gray-500 text-xs mt-1">Position: Below guardrails, above AI Prompt Assistant. Same features as Smart Matching Rules.</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3">
            <span className="text-yellow-400 font-bold">Phase 3:</span>
            <span className="text-gray-300 ml-2">Add tag tabs to Guided GPT and Smart Prompt sections</span>
            <p className="text-gray-500 text-xs mt-1">Copy Audience Avatars pattern. Remove "Per Tag Context" boxes. Add "Copy From" button.</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3">
            <span className="text-yellow-400 font-bold">Phase 4:</span>
            <span className="text-gray-300 ml-2">Template scope toggle UI</span>
            <p className="text-gray-500 text-xs mt-1">Add "Website Global" | "App Global" toggle to template creation. Backend already done.</p>
          </div>
        </div>
      </div>

      {/* Files Touched */}
      <div>
        <h4 className="text-brand-cyan font-semibold mb-2">Files Touched (Phase 1)</h4>
        <div className="grid md:grid-cols-2 gap-2 text-sm">
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">server/db/schema.sql</code>
            <span className="text-gray-400 block text-xs">New JSONB columns + templates scope</span>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">server/db/setup-all.mjs</code>
            <span className="text-gray-400 block text-xs">Migration logic for new columns</span>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">server/routes/image-creation.js</code>
            <span className="text-gray-400 block text-xs">INSERT/UPDATE for new fields</span>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">server/routes/templates.js</code>
            <span className="text-gray-400 block text-xs">scope + websiteId filtering</span>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">src/components/ImageCreationSection.tsx</code>
            <span className="text-gray-400 block text-xs">TypeScript interfaces + defaults</span>
          </div>
        </div>
      </div>
    </div>

    {/* INVESTIGATION 3: Component Library System */}
    <div className="bg-slate-800 rounded-xl p-6 border border-brand-gold/50">
      <div className="flex items-center gap-3 mb-4">
        <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">COMPLETE</span>
        <h3 className="text-xl font-bold text-white">Component Library System</h3>
        <span className="text-gray-400 text-sm">Feb 2026</span>
      </div>

      {/* Purpose */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Purpose</h4>
        <p className="text-gray-300">
          Automatically inject <strong className="text-white">reusable Elementor components</strong> (hero sliders, stats bars, benefit sections)
          into generated SEO articles. Components are captured from existing WordPress pages and stored in a library. When publishing articles,
          the system selects appropriate components based on the article's <strong className="text-brand-gold">audience tag (H, J, C)</strong>
          and injects them at specific slot positions.
        </p>
      </div>

      {/* Architecture */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Architecture</h4>
        <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-gray-300 overflow-x-auto">
          <pre>{`┌─────────────────────────────────────────────────────────────────────────┐
│                     COMPONENT LIBRARY FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  CAPTURE (from WordPress):                                               │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────────┐   │
│  │ WP Page ID   │───▶│ Fetch Elementor  │───▶│ Detect Components:   │   │
│  │ (e.g., 1441) │    │ JSON (_data)     │    │ • slider_revolution  │   │
│  └──────────────┘    └──────────────────┘    │ • elementor_template │   │
│                                               └──────────┬───────────┘   │
│                                                          │               │
│  STORE (in component_library table):                     ▼               │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ id | workflow_id | slot | type | component_ref | module_name | tag │  │
│  │────┼─────────────┼──────┼──────┼───────────────┼─────────────┼─────│  │
│  │ 1  | 5           | 1    | SR   | home-1        | Residential | H   │  │
│  │ 2  | 5           | 2    | ET   | 1134          | NULL        | H   │  │
│  │ 3  | 5           | 1    | SR   | janitorial-1  | Commercial  | J   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  INJECT (during publish):                                                │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────────┐   │
│  │ Article with │───▶│ selectComponents │───▶│ buildElementorPage   │   │
│  │ tag="H"      │    │ ForArticle("H")  │    │ with slot1,2,3       │   │
│  └──────────────┘    └──────────────────┘    └──────────────────────┘   │
│                                                                          │
│  SLOT POSITIONS:                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  SLOT 1 (TOP)     ← Hero slider goes here                           │ │
│  │  ─────────────────────────────────────────                          │ │
│  │  [Hero Section]                                                     │ │
│  │  [Content Chunk 1]                                                  │ │
│  │  SLOT 2 (MIDDLE)  ← Stats bar goes here                             │ │
│  │  ─────────────────────────────────────────                          │ │
│  │  [Content Chunk 2]                                                  │ │
│  │  [Content Chunk 3]                                                  │ │
│  │  SLOT 3 (BOTTOM)  ← Benefits section goes here                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘`}</pre>
        </div>
      </div>

      {/* Component Types */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Component Types</h4>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-900 rounded-lg p-4">
            <span className="text-brand-gold font-bold">slider_revolution</span>
            <p className="text-gray-400 text-sm mt-1">Premium WordPress slider plugin. Referenced by alias (e.g., "home-1").</p>
            <div className="mt-2 text-xs">
              <span className="text-red-400">CRITICAL:</span>
              <span className="text-gray-300"> Requires BOTH <code>component_ref</code> (alias) AND <code>module_name</code> (display name like "Residential")</span>
            </div>
            <div className="bg-slate-800 rounded p-2 mt-2 text-xs font-mono">
              <span className="text-gray-400">widgetType:</span> <span className="text-green-400">'slider_revolution'</span><br/>
              <span className="text-gray-400">revslidertitle:</span> <span className="text-green-400">moduleName</span><br/>
              <span className="text-gray-400">shortcode:</span> <span className="text-green-400">'[rev_slider alias="..."]'</span>
            </div>
          </div>
          <div className="bg-slate-900 rounded-lg p-4">
            <span className="text-purple-400 font-bold">elementor_template</span>
            <p className="text-gray-400 text-sm mt-1">Saved Elementor section/template. Referenced by template ID.</p>
            <div className="bg-slate-800 rounded p-2 mt-2 text-xs font-mono">
              <span className="text-gray-400">widgetType:</span> <span className="text-green-400">'template'</span><br/>
              <span className="text-gray-400">template_id:</span> <span className="text-green-400">'1134'</span>
            </div>
          </div>
        </div>
      </div>

      {/* Database Tables */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Database Schema</h4>
        <div className="space-y-3 text-sm">
          <div className="bg-slate-900 rounded-lg p-3">
            <span className="text-brand-gold font-bold">component_library</span>
            <span className="text-gray-400 ml-2">Main storage table</span>
            <div className="text-xs text-gray-500 mt-1">
              Columns: id, workflow_id, slot_number (1-3), slot_name, component_type, component_ref,
              <span className="text-yellow-400"> module_name</span> (for SR), tag (H/J/C/NULL), name, source_page_id, source_page_url, sort_order, is_active
            </div>
          </div>
          <div className="bg-slate-900 rounded-lg p-3">
            <span className="text-brand-gold font-bold">component_rotation_state</span>
            <span className="text-gray-400 ml-2">Tracks sequential rotation</span>
            <div className="text-xs text-gray-500 mt-1">
              Columns: workflow_id, slot_number, tag, last_used_component_id
            </div>
            <div className="text-xs text-yellow-400 mt-1">
              ⚠️ NULL tags stored as empty string '' for UNIQUE constraint compatibility
            </div>
          </div>
          <div className="bg-slate-900 rounded-lg p-3">
            <span className="text-brand-gold font-bold">workflows.component_settings</span>
            <span className="text-gray-400 ml-2">JSONB column</span>
            <div className="text-xs text-gray-500 mt-1">
              Contains: enabled (boolean), slots[] (number, name, position, rotation mode, enabled)
            </div>
          </div>
        </div>
      </div>

      {/* Key Files */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Key Files</h4>
        <div className="grid md:grid-cols-2 gap-2 text-sm">
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">server/db/migrations/029_component_library.sql</code>
            <span className="text-gray-400 block text-xs">Database schema (includes module_name)</span>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">server/db/setup-all.mjs</code>
            <span className="text-gray-400 block text-xs">Auto-migration on deploy (lines 1033-1107)</span>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">server/services/component-library-service.js</code>
            <span className="text-gray-400 block text-xs">Core logic: CRUD, selection, detection</span>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">server/routes/component-library.js</code>
            <span className="text-gray-400 block text-xs">API endpoints</span>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">server/services/elementor-builder.js</code>
            <span className="text-gray-400 block text-xs">buildComponentWidget(), buildSliderRevolutionWidget()</span>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">server/routes/elementor.js</code>
            <span className="text-gray-400 block text-xs">Publish flow: selectComponentsForArticle()</span>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">src/components/ComponentLibrarySection.tsx</code>
            <span className="text-gray-400 block text-xs">Frontend UI component</span>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <code className="text-brand-gold">docs/COMPONENT_LIBRARY_SPEC.md</code>
            <span className="text-gray-400 block text-xs">Complete technical specification</span>
          </div>
        </div>
      </div>

      {/* API Endpoints */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">API Endpoints</h4>
        <div className="bg-slate-900 rounded-lg p-3 text-sm font-mono space-y-1">
          <div><span className="text-green-400">GET</span> <span className="text-gray-300">/api/component-library/:workflowId</span> <span className="text-gray-500">- Get all components + settings</span></div>
          <div><span className="text-yellow-400">PUT</span> <span className="text-gray-300">/api/component-library/:workflowId/settings</span> <span className="text-gray-500">- Update settings</span></div>
          <div><span className="text-blue-400">POST</span> <span className="text-gray-300">/api/component-library/:workflowId/fetch-page</span> <span className="text-gray-500">- Detect from WP page</span></div>
          <div><span className="text-blue-400">POST</span> <span className="text-gray-300">/api/component-library/:workflowId/add</span> <span className="text-gray-500">- Add single component</span></div>
          <div><span className="text-blue-400">POST</span> <span className="text-gray-300">/api/component-library/:workflowId/save-batch</span> <span className="text-gray-500">- Save multiple</span></div>
          <div><span className="text-yellow-400">PUT</span> <span className="text-gray-300">/api/component-library/:workflowId/:componentId</span> <span className="text-gray-500">- Update component</span></div>
          <div><span className="text-red-400">DELETE</span> <span className="text-gray-300">/api/component-library/:workflowId/:componentId</span> <span className="text-gray-500">- Soft delete</span></div>
        </div>
      </div>

      {/* Selection Logic */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Selection Logic</h4>
        <div className="bg-slate-900 rounded-lg p-4 text-sm">
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Get all active components for the slot (is_active = true)</li>
            <li>Filter by article's tag (e.g., if article is "Service (H)", look for H-tagged components)</li>
            <li>If no tag-specific match, <strong className="text-yellow-400">fall back to Global</strong> (tag = NULL)</li>
            <li>If multiple matches, use rotation mode:
              <ul className="list-disc list-inside ml-4 mt-1 text-gray-400">
                <li><strong>sequential</strong>: Track last_used_component_id, return next in order</li>
                <li><strong>random</strong>: Pick random from matches</li>
              </ul>
            </li>
          </ol>
        </div>
      </div>
    </div>

    {/* INVESTIGATION 4: LLM API Error Handling */}
    <div className="bg-slate-800 rounded-xl p-6 border border-brand-gold/50">
      <div className="flex items-center gap-3 mb-4">
        <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">COMPLETE</span>
        <h3 className="text-xl font-bold text-white">LLM API Error Handling (502 Fix)</h3>
        <span className="text-gray-400 text-sm">Feb 2026</span>
      </div>

      {/* Purpose */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Purpose</h4>
        <p className="text-gray-300">
          Handle <strong className="text-red-400">transient 502/503/504 errors</strong> from the Anthropic API and network timeouts
          during batch workflow processing. The last item in a batch would sometimes fail with "API error: 502" even when
          earlier items succeeded.
        </p>
      </div>

      {/* The Problem */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">The Problem</h4>
        <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/30">
          <p className="text-gray-300 text-sm">
            When running batch workflows (e.g., 3+ keywords), the <strong className="text-white">last item would fail</strong> with:
          </p>
          <code className="block bg-slate-900 rounded p-2 mt-2 text-red-400 text-sm">
            [Cleaning(C)] Failed: Error: API error: 502
          </code>
          <p className="text-gray-400 text-sm mt-2">
            This happened during long prompts like "Service Page Article" that take 30-60 seconds to generate.
          </p>
        </div>
      </div>

      {/* The Fix */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">The Fix</h4>
        <div className="bg-slate-900 rounded-lg p-4">
          <p className="text-gray-300 text-sm mb-3">Improved retry logic in <code className="text-brand-gold">server/providers/anthropic.js</code>:</p>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-green-900/20 rounded p-3 border border-green-500/30">
              <span className="text-green-400 font-bold">Before</span>
              <ul className="list-disc list-inside text-gray-400 mt-2 space-y-1">
                <li>MAX_RETRIES = 3</li>
                <li>RETRY_DELAY_MS = 2000</li>
                <li>Retryable codes: 502, 503, 504, 529</li>
                <li>Only retried TypeError (network errors)</li>
              </ul>
            </div>
            <div className="bg-blue-900/20 rounded p-3 border border-blue-500/30">
              <span className="text-blue-400 font-bold">After</span>
              <ul className="list-disc list-inside text-gray-400 mt-2 space-y-1">
                <li>MAX_RETRIES = <strong className="text-white">5</strong></li>
                <li>RETRY_DELAY_MS = <strong className="text-white">3000</strong></li>
                <li>Retryable codes: 502, 503, 504, 529, <strong className="text-white">500</strong></li>
                <li>Also retries <strong className="text-white">AbortError</strong> (timeouts)</li>
                <li>Added detailed error logging</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Key Code */}
      <div className="mb-6">
        <h4 className="text-brand-cyan font-semibold mb-2">Key Code Location</h4>
        <div className="bg-slate-900 rounded-lg p-3 text-sm">
          <code className="text-brand-gold">server/providers/anthropic.js</code>
          <span className="text-gray-400 block mt-1">Lines 7-10: Retry configuration constants</span>
          <span className="text-gray-400 block">Lines 98-127: Error handling with detailed logging</span>
        </div>
      </div>

      {/* How to Debug */}
      <div>
        <h4 className="text-brand-cyan font-semibold mb-2">How to Debug Future 502s</h4>
        <div className="bg-slate-900 rounded-lg p-3 text-sm">
          <ol className="list-decimal list-inside text-gray-300 space-y-2">
            <li>Check Railway logs for <code className="text-yellow-400">[Anthropic]</code> entries</li>
            <li>Look for retry attempt messages: <code className="text-gray-400">"attempt 1/5, Retrying in..."</code></li>
            <li>If all 5 retries fail, you'll see: <code className="text-red-400">"All 5 retries exhausted"</code></li>
            <li>Common causes:
              <ul className="list-disc list-inside ml-4 mt-1 text-gray-400">
                <li>Anthropic API overloaded (temporary)</li>
                <li>Railway proxy timeout (for very long generations)</li>
                <li>Rate limiting (too many requests)</li>
              </ul>
            </li>
          </ol>
        </div>
      </div>
    </div>

    {/* Placeholder for future investigations */}
    <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center">
      <p className="text-gray-500 text-lg">More investigations will be added here as systems are mapped.</p>
      <p className="text-gray-600 text-sm mt-2">Use the template above to document any system you're working on.</p>
    </div>

    {/* Quick Reference: Common Patterns to Look For */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
      <h3 className="text-lg font-bold text-brand-cyan mb-4">Quick Reference: Red Flags to Look For</h3>
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div className="bg-slate-900 rounded-lg p-3">
          <span className="text-red-400 font-semibold">UI saves but server ignores</span>
          <p className="text-gray-400 text-xs mt-1">Check req.body destructuring matches UI payload</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <span className="text-red-400 font-semibold">DB column doesn't exist</span>
          <p className="text-gray-400 text-xs mt-1">Check schema.sql AND run migrations</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <span className="text-red-400 font-semibold">website_id vs workflow_id mismatch</span>
          <p className="text-gray-400 text-xs mt-1">Save goes to one, read comes from other</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <span className="text-red-400 font-semibold">Default overrides DB value</span>
          <p className="text-gray-400 text-xs mt-1">Look for: value || 'default' when value is NULL</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <span className="text-red-400 font-semibold">Duplicate reads of same data</span>
          <p className="text-gray-400 text-xs mt-1">Multiple queries that could be one pass-through</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <span className="text-red-400 font-semibold">Boolean vs mode string confusion</span>
          <p className="text-gray-400 text-xs mt-1">e.g., fallback_to_live vs smart_matching_mode</p>
        </div>
      </div>
    </div>
  </div>
);

export default BlueprintPage;
