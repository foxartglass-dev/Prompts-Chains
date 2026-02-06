import React, { useState, useEffect, useRef, useCallback } from 'react';

interface VisionColumn {
  id: string;
  title: string;
  color: string; // tailwind border color class
  sections: VisionSection[];
}

interface VisionSection {
  id: string;
  label: string;
  content: string; // HTML content (contenteditable)
}

interface VisionBoardProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'promptflow_vision_board';

const defaultColumns: VisionColumn[] = [
  {
    id: 'enterprise',
    title: 'Enterprise Agency Platform',
    color: 'border-yellow-500',
    sections: [
      { id: 'enterprise-vision', label: 'Vision', content: '<p>Evolve PromptFlow from prompting/SEO tool → full multi-platform CMS for agencies.</p><p>The path: <b>Prompting Tool → SEO/WordPress → Content Editor → Multi-Platform CMS</b></p>' },
      { id: 'enterprise-details', label: 'Key Details', content: '<ul><li>White-label for agencies</li><li>Multi-platform: Elementor, Shopify, partner\'s new lightweight platform</li><li>Bulletproof agency dashboard — different customers/websites/platforms</li><li>Enterprise-grade reliable — zero bugs, zero crashes, zero data loss</li><li>Agencies that don\'t use AI articles still need the editing/publishing workflow</li></ul>' },
      { id: 'enterprise-adoption', label: 'Adoption & Revenue', content: '<p>Agencies test with a couple clients → see results → transfer entire business in.</p><p>Target: <b>$1K+/mo</b> for 50+ client agencies. Each new platform = ~couple weeks with Claude.</p>' },
      { id: 'enterprise-notes', label: 'My Notes', content: '<p><i>Add your thoughts here...</i></p>' },
    ]
  },
  {
    id: 'automation-engine',
    title: 'Supporting Content Automation',
    color: 'border-green-500',
    sections: [
      { id: 'auto-vision', label: 'Vision', content: '<p>Fully automate the SEO supporting content cycle. <b>"Beach mode"</b> — the algorithm runs the entire SEO strategy autonomously.</p>' },
      { id: 'auto-strategy', label: 'Strategy', content: '<ol><li>Build 30 core pages → wait for index + settle in rankings (1-100)</li><li>Viking heat maps track positions — visualize as horse race / EQ board</li><li>Algorithm identifies pages closest to Google 3-pack</li><li>Auto-generate supporting content (People Also Ask questions)</li><li>Push articles → monitor movement → repeat until all dominate 3-pack</li></ol><p>The 3-pack magnetically pulls the rest up — more you get in, more it draws from behind.</p>' },
      { id: 'auto-advantage', label: 'Cost Advantage', content: '<p>~30 cents/article vs competitors at $2K/mo manual. Could do <b>all 200 pages in one day</b> vs drip-feeding over 18 months.</p><p>Viking GBP automation: auto-post images/updates to Google Business Profile.</p>' },
      { id: 'auto-notes', label: 'My Notes', content: '<p><i>Add your thoughts here...</i></p>' },
    ]
  },
  {
    id: 'pricing',
    title: 'Tiered Agency Pricing',
    color: 'border-cyan-500',
    sections: [
      { id: 'pricing-tiers', label: 'Tiers', content: '<p><b>Tier 1 (~$1K/mo):</b> Editing/publishing (The Desk, content management)</p><p><b>Tier 2 (~$2K/mo):</b> + Core page generation + image pipeline</p><p><b>Tier 3 (~$3.5K+/mo):</b> + Full automation engine (supporting content algorithm, Viking heat maps, auto-boost to 3-pack, GBP posting)</p>' },
      { id: 'pricing-top', label: 'Top Tier', content: '<p>"Sipping Pina Coladas on the Beach" package — fully automated agency, just check your phone.</p><p>Agencies just need a sales team + this platform = fully automated business.</p>' },
      { id: 'pricing-notes', label: 'My Notes', content: '<p><i>Add your thoughts here...</i></p>' },
    ]
  },
  {
    id: 'the-desk',
    title: 'The Desk / Command Center',
    color: 'border-purple-500',
    sections: [
      { id: 'desk-what', label: 'What It Is', content: '<p>Single editing workspace. Dropdown goes full-page (React Portal overlay). <b>Always-live contenteditable</b> — no review/edit mode toggle.</p>' },
      { id: 'desk-features', label: 'Features', content: '<ul><li>Swipe/arrow navigation between articles</li><li>Find & Replace across articles</li><li>Clickable keyword tabs</li><li>Revert button for safety (snapshot before save/push)</li></ul>' },
      { id: 'desk-architecture', label: '3-Desktop Architecture', content: '<p><b>Prompt Flows</b> (factory) | <b>Image Prompts</b> (art studio) | <b>The Desk</b> (editing/shipping)</p><p>PRD: PRD-COMMAND-CENTER.md</p>' },
      { id: 'desk-notes', label: 'My Notes', content: '<p><i>Add your thoughts here...</i></p>' },
    ]
  },
  {
    id: 'post-publish',
    title: 'Post-Publish Visual Control',
    color: 'border-orange-500',
    sections: [
      { id: 'pp-phases', label: 'Phases', content: '<p><b>Phase 1:</b> Push/Replace images on existing pages</p><p><b>Phase 2:</b> Replace article content on existing pages</p><p><b>Phase 3:</b> Component graphics control (swap headers, CTAs)</p><p><b>Phase 4:</b> Unified page rebuild service</p>' },
      { id: 'pp-tech', label: 'Technical', content: '<p>Delete-and-recreate pattern (already proven in push-images). Shared rebuildPage() service.</p><p>PRD: PRD-POST-PUBLISH-VISUAL-CONTROL.md</p>' },
      { id: 'pp-notes', label: 'My Notes', content: '<p><i>Add your thoughts here...</i></p>' },
    ]
  },
  {
    id: 'quick-wins',
    title: 'Quick Wins & PRDs',
    color: 'border-red-500',
    sections: [
      { id: 'qw-cta', label: 'CTA Button URL', content: '<p>Wire up existing DB/API/builder infrastructure with UI fields. DB columns already exist. Just needs UI in AgencyManager + frontend wiring during publish.</p><p>PRD: PRD-CTA-BUTTON-URL.md</p>' },
      { id: 'qw-logs', label: 'Processing Log Summary', content: '<p>Fix "Unnamed Project" naming. Keyword grid with status colors. Click pill → detail logs. System & Error logs section.</p><p>PRD: PRD-PROCESSING-LOG-SUMMARY.md</p>' },
      { id: 'qw-notes', label: 'My Notes', content: '<p><i>Add your thoughts here...</i></p>' },
    ]
  },
];

const VisionBoard: React.FC<VisionBoardProps> = ({ isOpen, onClose }) => {
  const [columns, setColumns] = useState<VisionColumn[]>(defaultColumns);
  const [isSaved, setIsSaved] = useState(true);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const newColInputRef = useRef<HTMLInputElement>(null);

  // Load saved state
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem(STORAGE_KEY);
      const savedTime = localStorage.getItem(STORAGE_KEY + '_time');
      if (saved) {
        try {
          setColumns(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse vision board data:', e);
        }
      }
      if (savedTime) {
        setLastSaved(savedTime);
      }
    }
  }, [isOpen]);

  // Auto-focus title input
  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    if (showAddColumn && newColInputRef.current) {
      newColInputRef.current.focus();
    }
  }, [showAddColumn]);

  const save = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
    const now = new Date().toLocaleString();
    localStorage.setItem(STORAGE_KEY + '_time', now);
    setLastSaved(now);
    setIsSaved(true);
  }, [columns]);

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!isSaved) {
      const timeout = setTimeout(save, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isSaved, save]);

  const handleSectionEdit = (columnId: string, sectionId: string, newContent: string) => {
    setColumns(prev => prev.map(col =>
      col.id === columnId
        ? { ...col, sections: col.sections.map(sec =>
            sec.id === sectionId ? { ...sec, content: newContent } : sec
          )}
        : col
    ));
    setIsSaved(false);
  };

  const handleTitleChange = (columnId: string, newTitle: string) => {
    setColumns(prev => prev.map(col =>
      col.id === columnId ? { ...col, title: newTitle } : col
    ));
    setEditingTitle(null);
    setIsSaved(false);
  };

  const addSection = (columnId: string) => {
    setColumns(prev => prev.map(col =>
      col.id === columnId
        ? { ...col, sections: [...col.sections, {
            id: `${columnId}-${Date.now()}`,
            label: 'New Section',
            content: '<p><i>Click to edit...</i></p>'
          }]}
        : col
    ));
    setIsSaved(false);
  };

  const removeSection = (columnId: string, sectionId: string) => {
    setColumns(prev => prev.map(col =>
      col.id === columnId
        ? { ...col, sections: col.sections.filter(s => s.id !== sectionId) }
        : col
    ));
    setIsSaved(false);
  };

  const addColumn = () => {
    if (!newColumnTitle.trim()) return;
    const colors = ['border-yellow-500', 'border-green-500', 'border-cyan-500', 'border-purple-500', 'border-orange-500', 'border-red-500', 'border-pink-500', 'border-blue-500'];
    const newCol: VisionColumn = {
      id: `col-${Date.now()}`,
      title: newColumnTitle.trim(),
      color: colors[columns.length % colors.length],
      sections: [
        { id: `col-${Date.now()}-notes`, label: 'Notes', content: '<p><i>Start writing...</i></p>' }
      ]
    };
    setColumns(prev => [...prev, newCol]);
    setNewColumnTitle('');
    setShowAddColumn(false);
    setIsSaved(false);
  };

  const removeColumn = (columnId: string) => {
    if (confirm('Delete this entire column and all its sections?')) {
      setColumns(prev => prev.filter(c => c.id !== columnId));
      if (expandedColumn === columnId) setExpandedColumn(null);
      setIsSaved(false);
    }
  };

  const resetToDefaults = () => {
    if (confirm('Reset vision board to defaults? This will erase all your edits.')) {
      setColumns(defaultColumns);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY + '_time');
      setLastSaved(null);
      setIsSaved(true);
    }
  };

  const updateSectionLabel = (columnId: string, sectionId: string, newLabel: string) => {
    setColumns(prev => prev.map(col =>
      col.id === columnId
        ? { ...col, sections: col.sections.map(sec =>
            sec.id === sectionId ? { ...sec, label: newLabel } : sec
          )}
        : col
    ));
    setIsSaved(false);
  };

  if (!isOpen) return null;

  // Expanded single-column view
  if (expandedColumn) {
    const col = columns.find(c => c.id === expandedColumn);
    if (!col) { setExpandedColumn(null); return null; }

    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700 bg-slate-900 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setExpandedColumn(null)}
              className="text-gray-400 hover:text-white transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Board
            </button>
            <div className={`w-3 h-3 rounded-full ${col.color.replace('border-', 'bg-')}`} />
            <h2 className="text-xl font-bold text-white">{col.title}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => addSection(col.id)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Section
            </button>
            {!isSaved && (
              <button onClick={save} className="px-3 py-1.5 bg-brand-gold text-slate-900 rounded-lg text-sm font-medium">
                Save
              </button>
            )}
          </div>
        </div>

        {/* Expanded content - two column layout for sections */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
            {col.sections.map(section => (
              <div key={section.id} className={`bg-slate-800/80 rounded-xl border ${col.color}/30 overflow-hidden`}>
                <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                  <input
                    className="text-sm font-semibold text-brand-cyan bg-transparent border-none outline-none w-full"
                    defaultValue={section.label}
                    onBlur={(e) => updateSectionLabel(col.id, section.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  />
                  <button
                    onClick={() => removeSection(col.id, section.id)}
                    className="text-gray-500 hover:text-red-400 transition ml-2 flex-shrink-0"
                    title="Remove section"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  className="p-4 text-gray-300 text-sm min-h-[150px] focus:outline-none focus:ring-1 focus:ring-brand-cyan/30 rounded-b-xl prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                  onBlur={(e) => handleSectionEdit(col.id, section.id, e.currentTarget.innerHTML)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Main board view
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700 bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-brand-gold flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Vision Board
          </h1>
          <span className="text-sm text-gray-400">
            Click any column to expand. Edit anything directly.
          </span>
        </div>

        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-xs text-gray-500">
              {isSaved ? `Saved ${lastSaved}` : 'Unsaved changes...'}
            </span>
          )}
          {!isSaved && (
            <button onClick={save} className="px-3 py-1.5 bg-brand-gold text-slate-900 rounded-lg text-sm font-medium transition hover:bg-brand-gold/80">
              Save
            </button>
          )}
          <button
            onClick={() => setShowAddColumn(true)}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Column
          </button>
          <button
            onClick={resetToDefaults}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-gray-400 rounded-lg text-sm transition"
            title="Reset to defaults"
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl ml-2"
            title="Close"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Add Column Modal */}
      {showAddColumn && (
        <div className="absolute top-14 right-40 z-60 bg-slate-800 rounded-xl border border-brand-gold/50 shadow-2xl p-4 w-72">
          <label className="text-sm text-gray-400 block mb-2">Column Title</label>
          <input
            ref={newColInputRef}
            type="text"
            value={newColumnTitle}
            onChange={e => setNewColumnTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') setShowAddColumn(false); }}
            placeholder="e.g. Rant-to-Tree Mapper"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-gold focus:outline-none mb-3"
          />
          <div className="flex gap-2">
            <button onClick={addColumn} disabled={!newColumnTitle.trim()} className="flex-1 px-3 py-1.5 bg-brand-gold text-slate-900 rounded-lg text-sm font-medium disabled:opacity-50">Add</button>
            <button onClick={() => setShowAddColumn(false)} className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div className="flex gap-4 h-full min-w-max">
          {columns.map(col => (
            <div
              key={col.id}
              className={`w-[380px] flex-shrink-0 bg-slate-800/50 rounded-xl border-2 ${col.color}/40 flex flex-col overflow-hidden hover:border-opacity-80 transition-all`}
            >
              {/* Column Header */}
              <div className={`px-4 py-3 border-b ${col.color}/20 bg-slate-800/80 flex items-center justify-between flex-shrink-0`}>
                {editingTitle === col.id ? (
                  <input
                    ref={titleInputRef}
                    defaultValue={col.title}
                    onBlur={(e) => handleTitleChange(col.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingTitle(null); }}
                    className="text-lg font-bold text-white bg-transparent border-b border-brand-gold outline-none w-full"
                  />
                ) : (
                  <h2
                    className="text-lg font-bold text-white cursor-pointer hover:text-brand-gold transition"
                    onClick={() => setEditingTitle(col.id)}
                    title="Click to rename"
                  >
                    {col.title}
                  </h2>
                )}
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <button
                    onClick={() => setExpandedColumn(col.id)}
                    className="p-1 text-gray-400 hover:text-brand-cyan transition"
                    title="Expand column"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeColumn(col.id)}
                    className="p-1 text-gray-500 hover:text-red-400 transition"
                    title="Delete column"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Column Sections */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {col.sections.map(section => (
                  <div key={section.id} className="bg-slate-900/60 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80">
                      <input
                        className="text-xs font-semibold text-brand-cyan bg-transparent border-none outline-none uppercase tracking-wide w-full"
                        defaultValue={section.label}
                        onBlur={(e) => updateSectionLabel(col.id, section.id, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      />
                      <button
                        onClick={() => removeSection(col.id, section.id)}
                        className="text-gray-600 hover:text-red-400 transition ml-1 flex-shrink-0"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      className="px-3 py-2 text-gray-300 text-xs min-h-[60px] focus:outline-none focus:bg-slate-800/50 transition prose prose-invert prose-xs max-w-none"
                      dangerouslySetInnerHTML={{ __html: section.content }}
                      onBlur={(e) => handleSectionEdit(col.id, section.id, e.currentTarget.innerHTML)}
                    />
                  </div>
                ))}

                {/* Add Section Button */}
                <button
                  onClick={() => addSection(col.id)}
                  className="w-full py-2 border border-dashed border-slate-600 rounded-lg text-gray-500 hover:text-brand-cyan hover:border-brand-cyan/50 transition text-xs flex items-center justify-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Section
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VisionBoard;
