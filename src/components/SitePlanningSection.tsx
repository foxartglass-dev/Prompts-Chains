/**
 * Site Planning Section (Section 8)
 * The Site Truth - Blueprint for website structure
 * Allows manual node creation or spreadsheet import
 */

import React, { useState, useEffect, useCallback } from 'react';

interface SitePlanNode {
  id: number;
  site_plan_id: number;
  parent_id: number | null;
  title: string;
  slug: string;
  page_type: string;
  status: string;
  wp_page_id: number | null;
  wp_post_url: string | null;
  target_keyword: string | null;
  meta_title: string | null;
  meta_description: string | null;
  content_brief: string | null;
  assigned_article_id: number | null;
  sort_order: number;
  depth: number;
  is_pillar_page: boolean;
  is_in_menu: boolean;
  menu_order: number | null;
  children: SitePlanNode[];
}

interface SitePlan {
  id: number;
  website_id: number | null;
  workflow_id: number | null;
  name: string;
  description: string | null;
  auto_sync_check: boolean;
  sync_status: string;
  total_pages: number;
  max_depth: number;
}

interface Props {
  workflowId?: number;
  websiteId?: number;
  showNotification: (message: string, type: 'success' | 'info' | 'error') => void;
}

const PAGE_TYPES = [
  { id: 'page', name: 'Page', color: 'bg-blue-500' },
  { id: 'landing', name: 'Landing Page', color: 'bg-purple-500' },
  { id: 'service', name: 'Service Page', color: 'bg-green-500' },
  { id: 'location', name: 'Location Page', color: 'bg-amber-500' },
  { id: 'blog', name: 'Blog Post', color: 'bg-pink-500' },
  { id: 'category', name: 'Category', color: 'bg-cyan-500' },
];

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-slate-500',
  in_progress: 'bg-yellow-500',
  built: 'bg-blue-500',
  published: 'bg-green-500',
  needs_update: 'bg-orange-500',
};

const SitePlanningSection: React.FC<Props> = ({ workflowId, websiteId, showNotification }) => {
  const [plan, setPlan] = useState<SitePlan | null>(null);
  const [nodes, setNodes] = useState<SitePlanNode[]>([]);
  const [flatNodes, setFlatNodes] = useState<SitePlanNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  // Edit modal state
  const [editingNode, setEditingNode] = useState<SitePlanNode | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Add node state
  const [addingToParent, setAddingToParent] = useState<number | null>(null);
  const [newNodeTitle, setNewNodeTitle] = useState('');

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Load plan and nodes
  const loadPlan = useCallback(async () => {
    if (!workflowId && !websiteId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Try to get existing plan
      const query = workflowId ? `workflowId=${workflowId}` : `websiteId=${websiteId}`;
      const res = await fetch(`/api/site-planning/plans?${query}`);
      const data = await res.json();

      if (data.success && data.plans.length > 0) {
        setPlan(data.plans[0]);
        await loadNodes(data.plans[0].id);
      } else {
        setPlan(null);
        setNodes([]);
      }
    } catch (error) {
      console.error('Failed to load site plan:', error);
    }
    setLoading(false);
  }, [workflowId, websiteId]);

  const loadNodes = async (planId: number) => {
    try {
      const res = await fetch(`/api/site-planning/nodes/${planId}`);
      const data = await res.json();
      if (data.success) {
        setNodes(data.nodes);
        setFlatNodes(data.flatNodes);
        // Expand root nodes by default
        const rootIds = new Set(data.nodes.map((n: SitePlanNode) => n.id));
        setExpandedNodes(rootIds);
      }
    } catch (error) {
      console.error('Failed to load nodes:', error);
    }
  };

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  // Create a new plan
  const createPlan = async () => {
    try {
      const res = await fetch('/api/site-planning/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          websiteId,
          name: 'Site Structure',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Site plan created!', 'success');
        loadPlan();
      }
    } catch (error) {
      showNotification('Failed to create plan', 'error');
    }
  };

  // Add a new node
  const addNode = async (parentId: number | null) => {
    if (!plan || !newNodeTitle.trim()) return;

    try {
      const res = await fetch('/api/site-planning/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sitePlanId: plan.id,
          parentId,
          title: newNodeTitle.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Page added!', 'success');
        setNewNodeTitle('');
        setAddingToParent(null);
        loadNodes(plan.id);
      }
    } catch (error) {
      showNotification('Failed to add page', 'error');
    }
  };

  // Update a node
  const updateNode = async (nodeId: number, updates: Partial<SitePlanNode>) => {
    try {
      const res = await fetch(`/api/site-planning/nodes/${nodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Page updated!', 'success');
        setShowEditModal(false);
        setEditingNode(null);
        if (plan) loadNodes(plan.id);
      }
    } catch (error) {
      showNotification('Failed to update page', 'error');
    }
  };

  // Delete a node
  const deleteNode = async (nodeId: number, deleteChildren: boolean = false) => {
    if (!confirm('Delete this page from the plan?')) return;

    try {
      const res = await fetch(`/api/site-planning/nodes/${nodeId}?deleteChildren=${deleteChildren}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Page removed!', 'success');
        if (plan) loadNodes(plan.id);
      }
    } catch (error) {
      showNotification('Failed to delete page', 'error');
    }
  };

  // Import from spreadsheet
  const importFromSpreadsheet = async () => {
    if (!plan || !importData.trim()) return;

    try {
      const res = await fetch('/api/site-planning/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sitePlanId: plan.id,
          data: importData,
          format: 'csv',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Imported ${data.imported} pages!`, 'success');
        setShowImportModal(false);
        setImportData('');
        loadNodes(plan.id);
      } else {
        showNotification(data.error || 'Import failed', 'error');
      }
    } catch (error) {
      showNotification('Failed to import', 'error');
    }
  };

  // Sync check with WordPress
  const checkSync = async () => {
    if (!plan) return;

    setSyncing(true);
    try {
      const res = await fetch(`/api/site-planning/sync-check/${plan.id}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setSyncResult(data);
        loadPlan();
      } else {
        showNotification(data.error || 'Sync check failed', 'error');
      }
    } catch (error) {
      showNotification('Failed to check sync', 'error');
    }
    setSyncing(false);
  };

  // Toggle node expansion
  const toggleExpand = (nodeId: number) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  // Render a tree node
  const renderNode = (node: SitePlanNode, depth: number = 0): JSX.Element => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const pageType = PAGE_TYPES.find(t => t.id === node.page_type) || PAGE_TYPES[0];
    const statusColor = STATUS_COLORS[node.status] || STATUS_COLORS.planned;

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center gap-2 py-2 px-3 hover:bg-slate-800/50 rounded-lg group transition ${depth > 0 ? 'ml-6' : ''}`}
          style={{ marginLeft: `${depth * 24}px` }}
        >
          {/* Expand/collapse */}
          <button
            onClick={() => hasChildren && toggleExpand(node.id)}
            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white"
          >
            {hasChildren ? (
              <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            )}
          </button>

          {/* Page type indicator */}
          <span className={`w-2 h-2 rounded-full ${pageType.color}`} title={pageType.name} />

          {/* Title */}
          <span className="flex-1 text-white font-medium">{node.title}</span>

          {/* Slug */}
          <span className="text-xs text-gray-500">/{node.slug}</span>

          {/* Status badge */}
          <span className={`px-2 py-0.5 rounded text-xs ${statusColor} text-white`}>
            {node.status}
          </span>

          {/* Pillar badge */}
          {node.is_pillar_page && (
            <span className="px-1.5 py-0.5 bg-purple-600 rounded text-xs text-white">Pillar</span>
          )}

          {/* WP link */}
          {node.wp_post_url && (
            <a
              href={node.wp_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
              title="View in WordPress"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={() => { setAddingToParent(node.id); }}
              className="p-1 hover:bg-slate-700 rounded text-green-400"
              title="Add child page"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => { setEditingNode(node); setShowEditModal(true); }}
              className="p-1 hover:bg-slate-700 rounded text-blue-400"
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => deleteNode(node.id)}
              className="p-1 hover:bg-slate-700 rounded text-red-400"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Add child input */}
        {addingToParent === node.id && (
          <div className="flex items-center gap-2 py-2 px-3 ml-12" style={{ marginLeft: `${(depth + 1) * 24}px` }}>
            <input
              type="text"
              value={newNodeTitle}
              onChange={(e) => setNewNodeTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNode(node.id)}
              placeholder="Page title..."
              className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm"
              autoFocus
            />
            <button
              onClick={() => addNode(node.id)}
              className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-white text-sm"
            >
              Add
            </button>
            <button
              onClick={() => { setAddingToParent(null); setNewNodeTitle(''); }}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="border-l border-slate-700 ml-5">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-brand-cyan animate-pulse">Loading site plan...</div>
      </div>
    );
  }

  // No plan yet
  if (!plan) {
    return (
      <div className="p-6">
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-dashed border-slate-600">
          <svg className="w-16 h-16 mx-auto text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <h3 className="text-xl font-semibold text-white mb-2">No Site Plan Yet</h3>
          <p className="text-gray-400 mb-6">Create a site structure plan to organize your website pages.</p>
          <button
            onClick={createPlan}
            className="px-6 py-3 bg-brand-cyan hover:bg-brand-cyan/80 text-slate-900 font-semibold rounded-lg transition"
          >
            Create Site Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
          <p className="text-sm text-gray-400">
            {plan.total_pages} pages · {plan.max_depth + 1} levels deep
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sync status */}
          {plan.sync_status && plan.sync_status !== 'unknown' && (
            <span className={`px-2 py-1 rounded text-xs ${plan.sync_status === 'synced' ? 'bg-green-600' : 'bg-orange-600'} text-white`}>
              {plan.sync_status === 'synced' ? 'In Sync' : 'Differs from WP'}
            </span>
          )}

          {/* Check sync button */}
          <button
            onClick={checkSync}
            disabled={syncing}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition disabled:opacity-50"
          >
            {syncing ? 'Checking...' : 'Check WP Sync'}
          </button>

          {/* Import button */}
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm transition"
          >
            Import CSV
          </button>

          {/* Add root page */}
          <button
            onClick={() => setAddingToParent(0)}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-white text-sm transition"
          >
            + Add Page
          </button>
        </div>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div className="mb-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">Sync Results</span>
            <button onClick={() => setSyncResult(null)} className="text-gray-400 hover:text-white">&times;</button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-green-400">{syncResult.matched}</span>
              <span className="text-gray-400 ml-1">Matched</span>
            </div>
            <div>
              <span className="text-orange-400">{syncResult.missingInWP?.length || 0}</span>
              <span className="text-gray-400 ml-1">Missing in WP</span>
            </div>
            <div>
              <span className="text-blue-400">{syncResult.extraInWP?.length || 0}</span>
              <span className="text-gray-400 ml-1">Extra in WP</span>
            </div>
          </div>
        </div>
      )}

      {/* Add root page input */}
      {addingToParent === 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-slate-800 rounded-lg">
          <input
            type="text"
            value={newNodeTitle}
            onChange={(e) => setNewNodeTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNode(null)}
            placeholder="Page title..."
            className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
            autoFocus
          />
          <button
            onClick={() => addNode(null)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white transition"
          >
            Add Root Page
          </button>
          <button
            onClick={() => { setAddingToParent(null); setNewNodeTitle(''); }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white transition"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Tree view */}
      <div className="bg-slate-900 rounded-lg border border-slate-700 p-4 min-h-[400px]">
        {nodes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No pages in plan yet.</p>
            <p className="text-sm mt-2">Click "Add Page" to start building your site structure.</p>
          </div>
        ) : (
          nodes.map(node => renderNode(node))
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-400">
        <span className="font-medium">Page Types:</span>
        {PAGE_TYPES.map(type => (
          <span key={type.id} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${type.color}`} />
            {type.name}
          </span>
        ))}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingNode && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Edit Page</h3>
              <button onClick={() => { setShowEditModal(false); setEditingNode(null); }} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Title</label>
                  <input
                    type="text"
                    value={editingNode.title}
                    onChange={(e) => setEditingNode({ ...editingNode, title: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Slug</label>
                  <input
                    type="text"
                    value={editingNode.slug}
                    onChange={(e) => setEditingNode({ ...editingNode, slug: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Page Type</label>
                  <select
                    value={editingNode.page_type}
                    onChange={(e) => setEditingNode({ ...editingNode, page_type: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                  >
                    {PAGE_TYPES.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Status</label>
                  <select
                    value={editingNode.status}
                    onChange={(e) => setEditingNode({ ...editingNode, status: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                  >
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="built">Built</option>
                    <option value="published">Published</option>
                    <option value="needs_update">Needs Update</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Target Keyword</label>
                <input
                  type="text"
                  value={editingNode.target_keyword || ''}
                  onChange={(e) => setEditingNode({ ...editingNode, target_keyword: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                  placeholder="Main keyword for this page..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Meta Title</label>
                <input
                  type="text"
                  value={editingNode.meta_title || ''}
                  onChange={(e) => setEditingNode({ ...editingNode, meta_title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Meta Description</label>
                <textarea
                  value={editingNode.meta_description || ''}
                  onChange={(e) => setEditingNode({ ...editingNode, meta_description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Content Brief</label>
                <textarea
                  value={editingNode.content_brief || ''}
                  onChange={(e) => setEditingNode({ ...editingNode, content_brief: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                  rows={3}
                  placeholder="What should this page contain..."
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingNode.is_pillar_page}
                    onChange={(e) => setEditingNode({ ...editingNode, is_pillar_page: e.target.checked })}
                    className="rounded border-slate-600"
                  />
                  <span className="text-sm text-gray-300">Pillar Page</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingNode.is_in_menu}
                    onChange={(e) => setEditingNode({ ...editingNode, is_in_menu: e.target.checked })}
                    className="rounded border-slate-600"
                  />
                  <span className="text-sm text-gray-300">Show in Menu</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-700">
              <button
                onClick={() => { setShowEditModal(false); setEditingNode(null); }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={() => updateNode(editingNode.id, editingNode)}
                className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 rounded text-slate-900 font-medium transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Import from CSV</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-400 mb-4">
                Paste CSV data with columns: <code className="text-brand-cyan">title, parent, slug, type, keyword, meta_title, meta_description, pillar</code>
              </p>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white font-mono text-sm"
                rows={10}
                placeholder="title,parent,slug,type,keyword&#10;Homepage,,home,page,&#10;Services,Homepage,services,category,our services&#10;Cleaning,Services,cleaning,service,cleaning service"
              />
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-700">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={importFromSpreadsheet}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-medium transition"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SitePlanningSection;
