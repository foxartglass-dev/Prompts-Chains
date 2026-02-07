/**
 * LinkPoolManager (Phase 7 - SEO Link Management)
 *
 * A persistent management interface for the link pool.
 * Shows every link a website has, which page each is linked to.
 * Allows discovery, review, assignment, and distribution.
 *
 * Golden Rules followed:
 *   #7 - React Portals for modals
 *   #9 - Never silently swallow errors
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// ============================================
// TYPES
// ============================================

interface LinkPoolItem {
  id: number;
  website_id: number;
  url: string;
  anchor_text: string | null;
  description: string | null;
  link_type: string;
  status: string;
  assigned_article_id: number | null;
  used_on_article_id: number | null;
  rel_attribute: string;
  target: string;
  discovery_run: number | null;
  created_at: string;
  used_at: string | null;
  assigned_keyword?: string | null;
  used_on_keyword?: string | null;
}

interface LinkCounts {
  approved: number;
  pending: number;
  rejected: number;
  used: number;
  total: number;
}

interface LinkSettings {
  link_discovery_prompt: string | null;
  link_discovery_model: string;
  link_discovery_count: number;
  links_per_page: number;
  link_discovery_runs: number;
}

interface LinkPoolManagerProps {
  isOpen: boolean;
  onClose: () => void;
  websiteId?: number;
  workflowId?: number;
  websiteName?: string;
}

type TabFilter = 'all' | 'approved' | 'pending' | 'rejected';

// ============================================
// COMPONENT
// ============================================

const LinkPoolManager: React.FC<LinkPoolManagerProps> = ({
  isOpen,
  onClose,
  websiteId,
  workflowId,
  websiteName
}) => {
  // State
  const [links, setLinks] = useState<LinkPoolItem[]>([]);
  const [counts, setCounts] = useState<LinkCounts>({ approved: 0, pending: 0, rejected: 0, used: 0, total: 0 });
  const [settings, setSettings] = useState<LinkSettings>({
    link_discovery_prompt: null,
    link_discovery_model: 'claude-sonnet-4-5-20250929',
    link_discovery_count: 70,
    links_per_page: 1,
    link_discovery_runs: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [discovering, setDiscovering] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLinkId, setPreviewLinkId] = useState<number | null>(null);
  const [showBatchEntry, setShowBatchEntry] = useState(false);
  const [batchUrls, setBatchUrls] = useState('');
  const [showSettings, setShowSettings] = useState(true);
  const [editingLink, setEditingLink] = useState<LinkPoolItem | null>(null);
  const [discoveryStatus, setDiscoveryStatus] = useState<string | null>(null);
  const [distributeResult, setDistributeResult] = useState<string | null>(null);

  // Editable settings
  const [editPrompt, setEditPrompt] = useState('');
  const [editModel, setEditModel] = useState('claude-sonnet-4-5-20250929');
  const [editCount, setEditCount] = useState(70);
  const [editLinksPerPage, setEditLinksPerPage] = useState(1);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchLinks = useCallback(async () => {
    if (!websiteId) return;
    setLoading(true);
    setError(null);
    try {
      const statusParam = activeTab !== 'all' ? `&status=${activeTab}` : '';
      const res = await fetch(`/api/links/pool/${websiteId}?limit=500${statusParam}`);
      if (!res.ok) throw new Error(`Failed to fetch links: ${res.statusText}`);
      const data = await res.json();
      setLinks(data.links || []);
      setCounts(data.counts || { approved: 0, pending: 0, rejected: 0, used: 0, total: 0 });
    } catch (err: any) {
      console.error('[LinkPool] Fetch error:', err);
      setError(err.message || 'Failed to load links');
    } finally {
      setLoading(false);
    }
  }, [websiteId, activeTab]);

  const fetchSettings = useCallback(async () => {
    if (!websiteId) return;
    try {
      const res = await fetch(`/api/links/settings/${websiteId}`);
      if (!res.ok) throw new Error(`Failed to fetch settings: ${res.statusText}`);
      const data = await res.json();
      const s = data.settings;
      setSettings(s);
      setEditPrompt(s.link_discovery_prompt || '');
      setEditModel(s.link_discovery_model || 'claude-sonnet-4-5-20250929');
      setEditCount(s.link_discovery_count || 70);
      setEditLinksPerPage(s.links_per_page || 1);
    } catch (err: any) {
      console.error('[LinkPool] Settings fetch error:', err);
      // Non-fatal - use defaults
    }
  }, [websiteId]);

  useEffect(() => {
    if (isOpen && websiteId) {
      fetchLinks();
      fetchSettings();
    }
  }, [isOpen, websiteId, fetchLinks, fetchSettings]);

  // ============================================
  // ACTIONS
  // ============================================

  const saveSettings = async () => {
    if (!websiteId) return;
    try {
      const res = await fetch(`/api/links/settings/${websiteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discoveryPrompt: editPrompt,
          discoveryModel: editModel,
          discoveryCount: editCount,
          linksPerPage: editLinksPerPage
        })
      });
      if (!res.ok) throw new Error('Failed to save settings');
      const data = await res.json();
      setSettings(data.settings);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    }
  };

  const updateLink = async (linkId: number, updates: Partial<LinkPoolItem>) => {
    try {
      const res = await fetch(`/api/links/pool/${linkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to update link');
      await fetchLinks();
    } catch (err: any) {
      setError(err.message || 'Failed to update link');
    }
  };

  const deleteLink = async (linkId: number) => {
    try {
      const res = await fetch(`/api/links/pool/${linkId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete link');
      await fetchLinks();
    } catch (err: any) {
      setError(err.message || 'Failed to delete link');
    }
  };

  const approveLink = (linkId: number) => updateLink(linkId, { status: 'approved' } as any);
  const rejectLink = (linkId: number) => updateLink(linkId, { status: 'rejected' } as any);

  const runDiscovery = async () => {
    if (!websiteId) return;
    setDiscovering(true);
    setDiscoveryStatus('Running AI discovery...');
    setError(null);
    try {
      // Save settings first
      await saveSettings();

      const res = await fetch('/api/links/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteId,
          count: editCount,
          prompt: editPrompt || undefined,
          model: editModel
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Discovery failed: ${res.statusText}`);
      }
      const data = await res.json();
      setDiscoveryStatus(`Discovery complete! Found ${data.added} new links (${data.skipped} duplicates skipped). Run #${data.discoveryRun}`);
      await fetchLinks();
      await fetchSettings();
    } catch (err: any) {
      console.error('[LinkPool] Discovery error:', err);
      setError(err.message || 'Discovery failed');
      setDiscoveryStatus(null);
    } finally {
      setDiscovering(false);
    }
  };

  const distributeLinks = async () => {
    if (!websiteId) return;
    setDistributing(true);
    setDistributeResult(null);
    setError(null);
    try {
      const res = await fetch('/api/links/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId, workflowId })
      });
      if (!res.ok) throw new Error('Distribution failed');
      const data = await res.json();
      setDistributeResult(
        `Distributed ${data.distributed} links to ${data.articlesServed} articles. ` +
        `${data.articlesPending} articles still need links. ${data.skipped} links remaining in pool.`
      );
      await fetchLinks();
    } catch (err: any) {
      setError(err.message || 'Distribution failed');
    } finally {
      setDistributing(false);
    }
  };

  const addBatchLinks = async () => {
    if (!websiteId || !batchUrls.trim()) return;
    const urls = batchUrls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length === 0) return;

    try {
      const res = await fetch('/api/links/pool/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteId,
          links: urls.map(url => ({ url }))
        })
      });
      if (!res.ok) throw new Error('Batch add failed');
      const data = await res.json();
      setBatchUrls('');
      setShowBatchEntry(false);
      setDiscoveryStatus(`Added ${data.added} links (${data.skipped} duplicates skipped)`);
      await fetchLinks();
    } catch (err: any) {
      setError(err.message || 'Batch add failed');
    }
  };

  const bulkApprove = async () => {
    const pendingIds = links.filter(l => l.status === 'pending').map(l => l.id);
    if (pendingIds.length === 0) return;
    try {
      const res = await fetch('/api/links/pool/bulk-approve', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkIds: pendingIds })
      });
      if (!res.ok) throw new Error('Bulk approve failed');
      await fetchLinks();
    } catch (err: any) {
      setError(err.message || 'Bulk approve failed');
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (!isOpen) return null;

  const filteredLinks = activeTab === 'all' ? links : links.filter(l => l.status === activeTab);

  const content = (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center">
      <div className="bg-slate-900 rounded-lg w-[95vw] h-[90vh] overflow-hidden border border-brand-cyan/30 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-brand-cyan/30 bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-brand-gold flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Link Pool {websiteName ? `- ${websiteName}` : ''}
            </h1>
            <span className="text-sm text-gray-400">
              {counts.total} total | {counts.approved} approved | {counts.used} used
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl" title="Close">&times;</button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Error Display */}
          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 flex items-center justify-between">
              <span className="text-red-300 text-sm">{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 text-sm">Dismiss</button>
            </div>
          )}

          {/* Status Messages */}
          {discoveryStatus && (
            <div className="bg-green-500/20 border border-green-500 rounded-lg p-3 flex items-center justify-between">
              <span className="text-green-300 text-sm">{discoveryStatus}</span>
              <button onClick={() => setDiscoveryStatus(null)} className="text-green-400 hover:text-green-200 text-sm">Dismiss</button>
            </div>
          )}
          {distributeResult && (
            <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-3 flex items-center justify-between">
              <span className="text-blue-300 text-sm">{distributeResult}</span>
              <button onClick={() => setDistributeResult(null)} className="text-blue-400 hover:text-blue-200 text-sm">Dismiss</button>
            </div>
          )}

          {/* Discovery Settings Section */}
          <div className="bg-slate-800/50 rounded-xl border border-brand-cyan/20">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center justify-between px-5 py-3 text-left"
            >
              <h2 className="text-lg font-bold text-brand-cyan">Discovery Settings</h2>
              <span className="text-gray-400 text-sm">{showSettings ? 'Hide' : 'Show'}</span>
            </button>

            {showSettings && (
              <div className="px-5 pb-5 space-y-4">
                {/* Discovery Prompt */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">AI Discovery Prompt</label>
                  <textarea
                    value={editPrompt}
                    onChange={e => setEditPrompt(e.target.value)}
                    placeholder="Find high-quality local organizations, industry associations, and government/education sites..."
                    className="w-full bg-slate-900 border border-brand-cyan/30 rounded-lg px-3 py-2 text-white text-sm min-h-[80px] focus:ring-2 focus:ring-brand-cyan"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Model Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">LLM Model</label>
                    <select
                      value={editModel}
                      onChange={e => setEditModel(e.target.value)}
                      className="w-full bg-slate-900 border border-brand-cyan/30 rounded-lg px-2 py-2 text-white text-xs focus:ring-2 focus:ring-brand-cyan"
                    >
                      <optgroup label="Claude (Anthropic)">
                        <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
                        <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                        <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                      </optgroup>
                      <optgroup label="GPT (OpenAI)">
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                      </optgroup>
                      <optgroup label="Gemini (Google)">
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Links to find */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Links to find</label>
                    <input
                      type="number"
                      value={editCount}
                      onChange={e => setEditCount(parseInt(e.target.value) || 70)}
                      min={5}
                      max={200}
                      className="w-full bg-slate-900 border border-brand-cyan/30 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-brand-cyan"
                    />
                    <p className="text-xs text-gray-500 mt-1">Search 40% more than needed</p>
                  </div>

                  {/* Links per page */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Links per page</label>
                    <input
                      type="number"
                      value={editLinksPerPage}
                      onChange={e => setEditLinksPerPage(parseInt(e.target.value) || 1)}
                      min={1}
                      max={5}
                      className="w-full bg-slate-900 border border-brand-cyan/30 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-brand-cyan"
                    />
                  </div>

                  {/* Discovery runs */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Discovery runs</label>
                    <div className="bg-slate-900 border border-brand-cyan/30 rounded-lg px-3 py-2 text-gray-400 text-sm">
                      {settings.link_discovery_runs || 0}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Total: {counts.total} links</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={saveSettings}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition"
                  >
                    Save Settings
                  </button>
                  <button
                    onClick={runDiscovery}
                    disabled={discovering}
                    className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 text-slate-900 font-medium rounded-lg text-sm transition disabled:opacity-50"
                  >
                    {discovering ? 'Discovering...' : 'Run AI Discovery'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tab Filters */}
          <div className="flex items-center gap-4 border-b border-slate-700 pb-2">
            {(['all', 'approved', 'pending', 'rejected'] as TabFilter[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  activeTab === tab
                    ? 'bg-brand-cyan text-slate-900'
                    : 'text-gray-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {tab === 'all' ? `All (${counts.total})` :
                 tab === 'approved' ? `Approved (${counts.approved})` :
                 tab === 'pending' ? `Pending (${counts.pending})` :
                 `Rejected (${counts.rejected})`}
              </button>
            ))}
            <div className="flex-1" />
            {counts.pending > 0 && (
              <button
                onClick={bulkApprove}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm transition"
              >
                Approve All Pending ({counts.pending})
              </button>
            )}
            <button
              onClick={() => setShowBatchEntry(!showBatchEntry)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-sm transition"
            >
              + Batch Add
            </button>
          </div>

          {/* Batch Entry */}
          {showBatchEntry && (
            <div className="bg-slate-800/50 rounded-lg p-4 border border-brand-cyan/20">
              <label className="block text-sm font-medium text-gray-300 mb-2">Paste URLs (one per line)</label>
              <textarea
                value={batchUrls}
                onChange={e => setBatchUrls(e.target.value)}
                placeholder="https://example.com/page1&#10;https://example.com/page2"
                className="w-full bg-slate-900 border border-brand-cyan/30 rounded-lg px-3 py-2 text-white text-sm min-h-[100px] focus:ring-2 focus:ring-brand-cyan"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={addBatchLinks}
                  className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 text-slate-900 font-medium rounded-lg text-sm transition"
                >
                  Add to Pool
                </button>
                <button
                  onClick={() => { setShowBatchEntry(false); setBatchUrls(''); }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Link List */}
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading links...</div>
          ) : filteredLinks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg mb-2">No links available</p>
              <p className="text-gray-500 text-sm">Add links manually, paste URLs, or run AI discovery.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLinks.map(link => (
                <LinkCard
                  key={link.id}
                  link={link}
                  onApprove={() => approveLink(link.id)}
                  onReject={() => rejectLink(link.id)}
                  onDelete={() => deleteLink(link.id)}
                  onPreview={() => { setPreviewUrl(link.url); setPreviewLinkId(link.id); }}
                  onEdit={() => setEditingLink(link)}
                  onUnassign={() => updateLink(link.id, { assignedArticleId: null, used_on_article_id: null } as any)}
                />
              ))}
            </div>
          )}

          {/* Distribution Section */}
          <div className="bg-slate-800/50 rounded-xl p-5 border border-brand-cyan/20">
            <h3 className="text-lg font-bold text-brand-gold mb-3">Distribution</h3>
            <div className="flex items-center gap-4 text-sm text-gray-300">
              <span>Links per page: <strong className="text-white">{editLinksPerPage}</strong></span>
              <span>Unassigned approved: <strong className="text-white">{counts.approved - counts.used}</strong></span>
            </div>
            <button
              onClick={distributeLinks}
              disabled={distributing || counts.approved - counts.used === 0}
              className="mt-3 px-4 py-2 bg-brand-gold hover:bg-brand-gold/80 text-slate-900 font-medium rounded-lg text-sm transition disabled:opacity-50"
            >
              {distributing ? 'Distributing...' : 'Auto-Distribute Links to Articles'}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Each article gets up to {editLinksPerPage} outbound link{editLinksPerPage > 1 ? 's' : ''}. Links are randomly assigned.
            </p>
          </div>
        </div>

        {/* Iframe Preview Panel */}
        {previewUrl && (
          <PreviewPanel
            url={previewUrl}
            linkId={previewLinkId}
            onClose={() => { setPreviewUrl(null); setPreviewLinkId(null); }}
            onApprove={previewLinkId ? () => { approveLink(previewLinkId); advancePreview('next'); } : undefined}
            onReject={previewLinkId ? () => { rejectLink(previewLinkId); advancePreview('next'); } : undefined}
          />
        )}

        {/* Edit Link Modal */}
        {editingLink && (
          <EditLinkModal
            link={editingLink}
            onClose={() => setEditingLink(null)}
            onSave={async (updates) => {
              await updateLink(editingLink.id, updates);
              setEditingLink(null);
            }}
          />
        )}
      </div>
    </div>
  );

  // Helper to advance preview to next pending link
  function advancePreview(direction: 'next') {
    const pendingLinks = links.filter(l => l.status === 'pending');
    const currentIdx = pendingLinks.findIndex(l => l.id === previewLinkId);
    if (currentIdx >= 0 && currentIdx < pendingLinks.length - 1) {
      const next = pendingLinks[currentIdx + 1];
      setPreviewUrl(next.url);
      setPreviewLinkId(next.id);
    } else {
      setPreviewUrl(null);
      setPreviewLinkId(null);
    }
  }

  // Golden Rule #7: Use React Portal
  return createPortal(content, document.body);
};

// ============================================
// SUB-COMPONENTS
// ============================================

interface LinkCardProps {
  link: LinkPoolItem;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onUnassign: () => void;
}

const LinkCard: React.FC<LinkCardProps> = ({ link, onApprove, onReject, onDelete, onPreview, onEdit, onUnassign }) => {
  const statusColor = link.status === 'approved' ? 'green' : link.status === 'pending' ? 'yellow' : 'red';
  const statusIcon = link.status === 'approved' ? '✓' : link.status === 'pending' ? '?' : '✗';

  return (
    <div className={`bg-slate-800/50 rounded-lg p-4 border-l-4 ${
      link.status === 'approved' ? 'border-green-500' :
      link.status === 'pending' ? 'border-yellow-500' :
      'border-red-500'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-${statusColor}-400 font-bold text-sm`}>{statusIcon}</span>
            <span className="text-white font-medium text-sm truncate">{link.description || link.url}</span>
            {link.discovery_run && (
              <span className="text-xs text-gray-500 bg-slate-700 px-1.5 py-0.5 rounded">Run #{link.discovery_run}</span>
            )}
          </div>
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-brand-cyan text-xs hover:underline truncate block">
            {link.url}
          </a>
          {link.anchor_text && (
            <div className="text-xs text-gray-400 mt-1">
              Anchor: <span className="text-gray-300">"{link.anchor_text}"</span>
            </div>
          )}
          {(link.assigned_keyword || link.used_on_keyword) && (
            <div className="text-xs text-gray-400 mt-1">
              {link.assigned_keyword ? `Assigned to: ${link.assigned_keyword}` : ''}
              {link.used_on_keyword ? `Used on: ${link.used_on_keyword}` : ''}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onPreview} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded text-xs transition" title="Preview">
            Preview
          </button>
          {link.status === 'pending' && (
            <>
              <button onClick={onApprove} className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs transition">Approve</button>
              <button onClick={onReject} className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs transition">Reject</button>
            </>
          )}
          {link.status === 'approved' && !link.used_on_article_id && (
            <button onClick={onReject} className="px-2 py-1 bg-red-600/50 hover:bg-red-600 text-white rounded text-xs transition">Reject</button>
          )}
          {(link.assigned_article_id || link.used_on_article_id) && (
            <button onClick={onUnassign} className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-xs transition">Unassign</button>
          )}
          <button onClick={onEdit} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded text-xs transition">Edit</button>
          <button onClick={onDelete} className="px-2 py-1 bg-red-900/50 hover:bg-red-900 text-red-300 rounded text-xs transition">Delete</button>
        </div>
      </div>
    </div>
  );
};

interface PreviewPanelProps {
  url: string;
  linkId: number | null;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ url, linkId, onClose, onApprove, onReject }) => {
  const [iframeError, setIframeError] = useState(false);

  return (
    <div className="border-t border-brand-cyan/30 bg-slate-800/80 flex-shrink-0" style={{ height: '40vh' }}>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-700/50">
        <span className="text-sm text-gray-300 truncate">Previewing: {url}</span>
        <div className="flex items-center gap-2">
          {onApprove && (
            <button onClick={onApprove} className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs transition">Approve</button>
          )}
          {onReject && (
            <button onClick={onReject} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs transition">Reject</button>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-xs transition">
            Open in New Tab
          </a>
          <button onClick={onClose} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-xs transition">Close</button>
        </div>
      </div>
      {iframeError ? (
        <div className="flex items-center justify-center h-full bg-slate-900">
          <div className="text-center">
            <p className="text-gray-400 mb-2">This site blocks iframe preview</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:underline text-sm">Open in New Tab</a>
          </div>
        </div>
      ) : (
        <iframe
          src={url}
          className="w-full h-full border-0"
          onError={() => setIframeError(true)}
          sandbox="allow-same-origin allow-scripts"
          title="Link Preview"
        />
      )}
    </div>
  );
};

interface EditLinkModalProps {
  link: LinkPoolItem;
  onClose: () => void;
  onSave: (updates: Partial<LinkPoolItem>) => void;
}

const EditLinkModal: React.FC<EditLinkModalProps> = ({ link, onClose, onSave }) => {
  const [url, setUrl] = useState(link.url);
  const [anchorText, setAnchorText] = useState(link.anchor_text || '');
  const [description, setDescription] = useState(link.description || '');
  const [relAttribute, setRelAttribute] = useState(link.rel_attribute || 'noopener');
  const [target, setTarget] = useState(link.target || '_blank');

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center">
      <div className="bg-slate-800 rounded-lg p-6 w-full max-w-lg border border-brand-cyan/30">
        <h3 className="text-lg font-bold text-brand-gold mb-4">Edit Link</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-300 mb-1">URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="w-full bg-slate-900 border border-brand-cyan/30 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Anchor Text</label>
            <input
              type="text"
              value={anchorText}
              onChange={e => setAnchorText(e.target.value)}
              placeholder="Suggested anchor text for this link"
              className="w-full bg-slate-900 border border-brand-cyan/30 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What this link is about"
              className="w-full bg-slate-900 border border-brand-cyan/30 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Rel</label>
              <select
                value={relAttribute}
                onChange={e => setRelAttribute(e.target.value)}
                className="w-full bg-slate-900 border border-brand-cyan/30 rounded-lg px-2 py-2 text-white text-sm"
              >
                <option value="noopener">noopener</option>
                <option value="noopener nofollow">noopener nofollow</option>
                <option value="nofollow">nofollow</option>
                <option value="">none (dofollow)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Target</label>
              <select
                value={target}
                onChange={e => setTarget(e.target.value)}
                className="w-full bg-slate-900 border border-brand-cyan/30 rounded-lg px-2 py-2 text-white text-sm"
              >
                <option value="_blank">New Tab (_blank)</option>
                <option value="_self">Same Tab (_self)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => onSave({ url, anchorText, description, relAttribute, target } as any)}
            className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 text-slate-900 font-medium rounded-lg text-sm transition"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LinkPoolManager;
