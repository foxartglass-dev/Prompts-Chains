/**
 * Site Planning Section (Section 8)
 * The Site Truth - Blueprint for website structure
 * Allows manual node creation or spreadsheet import
 */

import React, { useState, useEffect, useCallback } from 'react';
import PageDetailModal from './PageDetailModal';

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
  onOpenArticles?: () => void;
  imagePublishMode?: 'off' | 'draft' | 'wordpress';
  articlePublishMode?: 'draft' | 'wordpress';
  metaPublishMode?: 'draft' | 'wordpress';
  onImagePublishModeChange?: (mode: 'off' | 'draft' | 'wordpress') => void;
  onArticlePublishModeChange?: (mode: 'draft' | 'wordpress') => void;
  onMetaPublishModeChange?: (mode: 'draft' | 'wordpress') => void;
  // New: Connect to main workflow pipeline
  onStartWorkflow?: (items: Array<{ name: string; tag: string | null }>) => void;
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

const SitePlanningSection: React.FC<Props> = ({
  workflowId,
  websiteId,
  showNotification,
  onOpenArticles,
  imagePublishMode = 'draft',
  articlePublishMode = 'draft',
  metaPublishMode = 'draft',
  onImagePublishModeChange,
  onArticlePublishModeChange,
  onMetaPublishModeChange,
  onStartWorkflow
}) => {
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

  // Tab-based import state
  const [showTabImportModal, setShowTabImportModal] = useState(false);
  const [tabImportText, setTabImportText] = useState('');
  const [tabImportMode, setTabImportMode] = useState<'merge' | 'replace' | 'preview'>('merge');
  const [tabImportResult, setTabImportResult] = useState<any>(null);
  const [tabImporting, setTabImporting] = useState(false);

  // Multi-location state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [locations, setLocations] = useState<any[]>([]);
  const [addingLocation, setAddingLocation] = useState(false);

  // Bulk edit state
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditLocation, setBulkEditLocation] = useState<any>(null);
  const [bulkEditNodes, setBulkEditNodes] = useState<any[]>([]);

  // Gap analysis state
  const [showGapModal, setShowGapModal] = useState(false);
  const [gaps, setGaps] = useState<any[]>([]);
  const [analyzingGaps, setAnalyzingGaps] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Push to WordPress state
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<any>(null);

  // PageDetailModal state
  const [viewingNode, setViewingNode] = useState<SitePlanNode | null>(null);
  const [showPageDetailModal, setShowPageDetailModal] = useState(false);

  // Selection state for batch generation
  const [selectedNodes, setSelectedNodes] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; currentTitle: string } | null>(null);

  // Plan creation state
  const [creatingPlan, setCreatingPlan] = useState(false);

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
    if (!workflowId && !websiteId) {
      showNotification('Please select a workflow first to create a site plan', 'error');
      return;
    }

    setCreatingPlan(true);
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
      } else {
        showNotification(data.error || 'Failed to create plan', 'error');
      }
    } catch (error) {
      console.error('Create plan error:', error);
      showNotification('Failed to create plan - check console for details', 'error');
    }
    setCreatingPlan(false);
  };

  // Export site plan as JSON
  const exportSitePlan = () => {
    if (!plan || flatNodes.length === 0) {
      showNotification('No site plan to export', 'error');
      return;
    }

    const exportData = {
      plan: {
        name: plan.name,
        description: plan.description,
        exportedAt: new Date().toISOString(),
      },
      nodes: flatNodes.map(node => ({
        title: node.title,
        slug: node.slug,
        page_type: node.page_type,
        parent_id: node.parent_id,
        target_keyword: node.target_keyword,
        meta_title: node.meta_title,
        meta_description: node.meta_description,
        content_brief: node.content_brief,
        is_pillar_page: node.is_pillar_page,
        is_in_menu: node.is_in_menu,
        menu_order: node.menu_order,
        depth: node.depth,
        sort_order: node.sort_order,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site-plan-${plan.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Site plan exported!', 'success');
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

  // Load locations for multi-location support
  const loadLocations = useCallback(async () => {
    if (!plan) return;
    try {
      const res = await fetch(`/api/site-planning/locations/${plan.id}`);
      const data = await res.json();
      if (data.success) {
        setLocations(data.locations);
      }
    } catch (error) {
      console.error('Failed to load locations:', error);
    }
  }, [plan]);

  useEffect(() => {
    if (plan) {
      loadLocations();
    }
  }, [plan, loadLocations]);

  // Tab-based hierarchy import
  const importTabHierarchy = async (mode: 'merge' | 'replace' | 'preview' = 'merge') => {
    if (!plan || !tabImportText.trim()) return;

    setTabImporting(true);
    try {
      const res = await fetch('/api/site-planning/import-hierarchy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sitePlanId: plan.id,
          text: tabImportText,
          mode,
        }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.preview) {
          setTabImportResult(data);
        } else {
          showNotification(`Imported ${data.created} pages!`, 'success');
          setShowTabImportModal(false);
          setTabImportText('');
          setTabImportResult(null);
          loadNodes(plan.id);
        }
      } else {
        showNotification(data.error || 'Import failed', 'error');
      }
    } catch (error) {
      showNotification('Failed to import hierarchy', 'error');
    }
    setTabImporting(false);
  };

  // Add a new location
  const addLocation = async () => {
    if (!plan || !newLocationName.trim()) return;

    setAddingLocation(true);
    try {
      const res = await fetch(`/api/site-planning/add-location/${plan.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationName: newLocationName.trim(),
        }),
      });
      const data = await res.json();

      if (data.success) {
        showNotification(data.message, 'success');
        setShowLocationModal(false);
        setNewLocationName('');
        loadNodes(plan.id);
        loadLocations();
      } else {
        showNotification(data.error || 'Failed to add location', 'error');
      }
    } catch (error) {
      showNotification('Failed to add location', 'error');
    }
    setAddingLocation(false);
  };

  // Load nodes for bulk editing a location
  const loadLocationForEdit = async (location: any) => {
    if (!plan) return;

    try {
      const res = await fetch(`/api/site-planning/nodes/${plan.id}`);
      const data = await res.json();
      if (data.success) {
        // Find all nodes under this location
        const locationNodes = data.flatNodes.filter((n: any) => {
          let current = n;
          while (current) {
            if (current.id === location.id) return true;
            current = data.flatNodes.find((p: any) => p.id === current.parent_id);
          }
          return false;
        });
        setBulkEditNodes(locationNodes.map((n: any) => ({
          ...n,
          newTitle: n.title,
          newSlug: n.slug,
          sameAsOriginal: true,
        })));
        setBulkEditLocation(location);
        setShowBulkEditModal(true);
      }
    } catch (error) {
      showNotification('Failed to load location data', 'error');
    }
  };

  // Save bulk edits
  const saveBulkEdits = async () => {
    if (!plan) return;

    const edits = bulkEditNodes
      .filter(n => !n.sameAsOriginal)
      .map(n => ({
        nodeId: n.id,
        title: n.newTitle,
        slug: n.newSlug,
      }));

    if (edits.length === 0) {
      showNotification('No changes to save', 'info');
      return;
    }

    try {
      const res = await fetch(`/api/site-planning/bulk-edit/${plan.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edits }),
      });
      const data = await res.json();

      if (data.success) {
        showNotification(`Updated ${data.updated} pages`, 'success');
        setShowBulkEditModal(false);
        loadNodes(plan.id);
      } else {
        showNotification(data.error || 'Failed to save edits', 'error');
      }
    } catch (error) {
      showNotification('Failed to save bulk edits', 'error');
    }
  };

  // Analyze gaps from heat map
  const analyzeGaps = async () => {
    if (!plan) return;

    setAnalyzingGaps(true);
    try {
      const res = await fetch(`/api/site-planning/analyze-gaps/${plan.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: 15 }),
      });
      const data = await res.json();

      if (data.success) {
        setGaps(data.gaps);
        if (data.gaps.length === 0) {
          showNotification(data.message || 'No gaps found', 'info');
        }
      } else {
        showNotification(data.error || 'Analysis failed', 'error');
      }
    } catch (error) {
      showNotification('Failed to analyze gaps', 'error');
    }
    setAnalyzingGaps(false);
  };

  // Create neighborhood page from gap
  const createNeighborhoodPage = async (gap: any, name: string) => {
    if (!plan || !name.trim()) return;

    try {
      const res = await fetch(`/api/site-planning/create-neighborhood/${plan.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          lat: gap.lat,
          lng: gap.lng,
          keywords: [gap.keyword],
        }),
      });
      const data = await res.json();

      if (data.success) {
        showNotification(`Created neighborhood page: ${name}`, 'success');
        loadNodes(plan.id);
        // Remove from gaps list
        setGaps(prev => prev.filter(g => g !== gap));
      } else {
        showNotification(data.error || 'Failed to create page', 'error');
      }
    } catch (error) {
      showNotification('Failed to create neighborhood page', 'error');
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

  // Push hierarchy to WordPress
  const pushToWordPress = async (status: 'draft' | 'publish' = 'draft') => {
    if (!plan) return;

    setPushing(true);
    setPushResult(null);
    try {
      const res = await fetch(`/api/site-planning/push-hierarchy/${plan.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setPushResult(data);
        showNotification(`Pushed ${data.pushed?.length || 0} pages to WordPress!`, 'success');
        loadNodes(plan.id);
      } else {
        showNotification(data.error || 'Push failed', 'error');
      }
    } catch (error) {
      showNotification('Failed to push to WordPress', 'error');
    }
    setPushing(false);
  };

  // Unified Start button - sends items through the main workflow pipeline
  const startProcessing = (nodesToProcess: SitePlanNode[]) => {
    if (nodesToProcess.length === 0) {
      showNotification('No nodes selected for processing', 'info');
      return;
    }

    if (!onStartWorkflow) {
      showNotification('Workflow connection not available', 'error');
      return;
    }

    // Convert site plan nodes to workflow items
    // Each node title should already include the tag like "Deep Cleaning(H)"
    // The main workflow will parse the tag from the name
    const workflowItems = nodesToProcess.map(node => {
      // Extract tag from title if present (e.g., "Deep Cleaning(H)" -> tag: "H")
      const tagMatch = node.title.match(/\(([^)]+)\)$/);
      const tag = tagMatch ? tagMatch[1] : null;

      return {
        name: node.title, // Keep full name including tag for proper display
        tag
      };
    });

    showNotification(`Adding ${workflowItems.length} items to workflow...`, 'info');

    // Send to main workflow - this will load items and start processing
    onStartWorkflow(workflowItems);

    // Reset selection
    setSelectionMode(false);
    setSelectedNodes(new Set());
  };

  // Legacy function for single node generation (used by per-node button)
  const generateContent = async (nodesToGenerate: SitePlanNode[]) => {
    startProcessing(nodesToGenerate);
  };

  // Generate all pages
  const generateAll = () => {
    generateContent(flatNodes);
  };

  // Generate selected pages
  const generateSelected = () => {
    const selected = flatNodes.filter(n => selectedNodes.has(n.id));
    generateContent(selected);
  };

  // Toggle all selection
  const toggleSelectAll = () => {
    if (selectedNodes.size === flatNodes.length) {
      setSelectedNodes(new Set());
    } else {
      setSelectedNodes(new Set(flatNodes.map(n => n.id)));
    }
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
          {/* Selection checkbox (when in selection mode) */}
          {selectionMode && (
            <input
              type="checkbox"
              checked={selectedNodes.has(node.id)}
              onChange={(e) => {
                const newSelected = new Set(selectedNodes);
                if (e.target.checked) {
                  newSelected.add(node.id);
                } else {
                  newSelected.delete(node.id);
                }
                setSelectedNodes(newSelected);
              }}
              className="w-4 h-4 rounded border-slate-500 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
            />
          )}

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
            {/* View Content button */}
            <button
              onClick={() => { setViewingNode(node); setShowPageDetailModal(true); }}
              className="p-1 hover:bg-slate-700 rounded text-cyan-400"
              title="View Content"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            {/* Generate Single button */}
            <button
              onClick={() => generateContent([node])}
              disabled={generating}
              className="p-1 hover:bg-slate-700 rounded text-purple-400"
              title="Generate Content"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
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
          {!workflowId && !websiteId && (
            <p className="text-orange-400 text-sm mb-4">⚠️ Please select a workflow first</p>
          )}
          <button
            onClick={createPlan}
            disabled={creatingPlan || (!workflowId && !websiteId)}
            className="px-6 py-3 bg-brand-cyan hover:bg-brand-cyan/80 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-900 disabled:text-slate-400 font-semibold rounded-lg transition flex items-center gap-2 mx-auto"
          >
            {creatingPlan ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </>
            ) : (
              'Create Site Plan'
            )}
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

          {/* UNIFIED START BUTTON - Respects toggle settings */}
          <div className="flex items-center gap-2 border-r border-slate-600 pr-4 mr-2">
            {/* Toggle Selection Mode */}
            <button
              onClick={() => {
                setSelectionMode(!selectionMode);
                if (selectionMode) setSelectedNodes(new Set());
              }}
              className={`px-3 py-1.5 rounded text-white text-sm transition flex items-center gap-1 ${
                selectionMode ? 'bg-blue-600' : 'bg-slate-600 hover:bg-slate-500'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {selectionMode ? 'Cancel' : 'Select'}
            </button>

            {/* Select All (when in selection mode) */}
            {selectionMode && (
              <button
                onClick={toggleSelectAll}
                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-white text-sm transition"
              >
                {selectedNodes.size === flatNodes.length ? 'Deselect All' : 'Select All'}
              </button>
            )}

            {/* Start Selected (when in selection mode with items selected) */}
            {selectionMode && selectedNodes.size > 0 && (
              <button
                onClick={generateSelected}
                disabled={!onStartWorkflow}
                className={`px-4 py-1.5 rounded text-white text-sm font-semibold transition flex items-center gap-2 ${
                  articlePublishMode === 'wordpress'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start {selectedNodes.size}
              </button>
            )}

            {/* Main START Button (when not in selection mode) */}
            {!selectionMode && (
              <button
                onClick={generateAll}
                disabled={flatNodes.length === 0 || !onStartWorkflow}
                className={`px-5 py-2 rounded text-white font-bold transition flex items-center gap-2 shadow-lg ${
                  articlePublishMode === 'wordpress'
                    ? 'bg-green-600 hover:bg-green-700 disabled:bg-slate-600'
                    : 'bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600'
                }`}
                title="Adds items to workflow and starts processing through the Processing Log"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                START ({flatNodes.length})
              </button>
            )}
          </div>

          {/* Check sync button */}
          <button
            onClick={checkSync}
            disabled={syncing}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition disabled:opacity-50"
          >
            {syncing ? 'Checking...' : 'Check WP Sync'}
          </button>

          {/* Tab Import button */}
          <button
            onClick={() => setShowTabImportModal(true)}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm transition flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import List
          </button>

          {/* Multi-location button */}
          <button
            onClick={() => setShowLocationModal(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 rounded text-white text-sm transition flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            + Location
          </button>

          {/* Gap Analysis button */}
          <button
            onClick={() => { setShowGapModal(true); analyzeGaps(); }}
            className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 rounded text-white text-sm transition flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Neighborhoods
          </button>

          {/* Import CSV button */}
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 rounded text-white text-sm transition"
          >
            CSV
          </button>

          {/* Export Site Plan button */}
          <button
            onClick={exportSitePlan}
            disabled={flatNodes.length === 0}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:opacity-50 rounded text-white text-sm transition flex items-center gap-1"
            title="Export site plan as JSON"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
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

      {/* Articles & Publish Mode Control Bar */}
      <div className="flex items-center justify-between mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
        {/* Left: Articles Button */}
        <button
          onClick={onOpenArticles}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-2 border-brand-gold rounded-lg text-brand-gold font-semibold hover:shadow-glow-gold transition"
        >
          <svg className="w-5 h-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          Articles
        </button>

        {/* Right: Publish Mode Toggles */}
        <div className="flex items-center gap-4">
          {/* Image Mode */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Image:</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-600">
              <button
                onClick={() => onImagePublishModeChange?.('off')}
                className={`px-2.5 py-1 text-xs font-medium transition ${
                  imagePublishMode === 'off'
                    ? 'bg-slate-500 text-white'
                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                }`}
              >
                Off
              </button>
              <button
                onClick={() => onImagePublishModeChange?.('draft')}
                className={`px-2.5 py-1 text-xs font-medium transition border-l border-slate-600 ${
                  imagePublishMode === 'draft'
                    ? 'bg-brand-gold text-slate-900'
                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                }`}
              >
                Draft
              </button>
              <button
                onClick={() => onImagePublishModeChange?.('wordpress')}
                className={`px-2.5 py-1 text-xs font-medium transition border-l border-slate-600 ${
                  imagePublishMode === 'wordpress'
                    ? 'bg-brand-gold text-slate-900'
                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                }`}
              >
                WPress
              </button>
            </div>
          </div>

          {/* Article Mode */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Article:</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-600">
              <button
                onClick={() => onArticlePublishModeChange?.('draft')}
                className={`px-2.5 py-1 text-xs font-medium transition ${
                  articlePublishMode === 'draft'
                    ? 'bg-brand-gold text-slate-900'
                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                }`}
              >
                Draft
              </button>
              <button
                onClick={() => onArticlePublishModeChange?.('wordpress')}
                className={`px-2.5 py-1 text-xs font-medium transition border-l border-slate-600 ${
                  articlePublishMode === 'wordpress'
                    ? 'bg-brand-gold text-slate-900'
                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                }`}
              >
                WPress
              </button>
            </div>
          </div>

          {/* Meta Mode */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Meta:</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-600">
              <button
                onClick={() => onMetaPublishModeChange?.('draft')}
                className={`px-2.5 py-1 text-xs font-medium transition ${
                  metaPublishMode === 'draft'
                    ? 'bg-brand-gold text-slate-900'
                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                }`}
              >
                Draft
              </button>
              <button
                onClick={() => onMetaPublishModeChange?.('wordpress')}
                className={`px-2.5 py-1 text-xs font-medium transition border-l border-slate-600 ${
                  metaPublishMode === 'wordpress'
                    ? 'bg-brand-gold text-slate-900'
                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                }`}
              >
                WPress
              </button>
            </div>
          </div>
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

      {/* Push result */}
      {pushResult && (
        <div className="mb-4 p-3 bg-slate-800 rounded-lg border border-green-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-400">Push Complete</span>
            <button onClick={() => setPushResult(null)} className="text-gray-400 hover:text-white">&times;</button>
          </div>
          <div className="text-sm">
            <span className="text-green-400">{pushResult.pushed?.length || 0}</span>
            <span className="text-gray-400 ml-1">pages pushed to WordPress</span>
            {pushResult.errors?.length > 0 && (
              <div className="mt-2 text-orange-400">
                {pushResult.errors.length} errors occurred
              </div>
            )}
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-auto shadow-2xl">
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
                onClick={() => updateNode(editingNode.id, {
                  // Transform snake_case to camelCase for backend API
                  title: editingNode.title,
                  slug: editingNode.slug,
                  pageType: editingNode.page_type,
                  status: editingNode.status,
                  targetKeyword: editingNode.target_keyword,
                  metaTitle: editingNode.meta_title,
                  metaDescription: editingNode.meta_description,
                  contentBrief: editingNode.content_brief,
                  isPillarPage: editingNode.is_pillar_page,
                  isInMenu: editingNode.is_in_menu,
                  assignedArticleId: editingNode.assigned_article_id,
                })}
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

      {/* Tab-Based Import Modal */}
      {showTabImportModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Import Site Structure</h3>
              <button onClick={() => { setShowTabImportModal(false); setTabImportResult(null); }} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">
                  Paste your page list. Use <span className="text-brand-cyan font-semibold">tabs</span> for hierarchy:
                </p>
                <div className="bg-slate-800 p-3 rounded text-xs font-mono text-gray-300 mb-3">
                  <div>Home Cleaning Services</div>
                  <div className="ml-4">Deep Cleaning</div>
                  <div className="ml-4">Move-In Cleaning</div>
                  <div>Janitorial Services</div>
                  <div className="ml-4">Office Cleaning</div>
                  <div className="ml-4">Medical Facility</div>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Optional: Add audience tags like <code className="text-amber-400">[H]</code> <code className="text-amber-400">[J]</code> <code className="text-amber-400">[C]</code> after titles
                </p>
              </div>

              <textarea
                value={tabImportText}
                onChange={(e) => setTabImportText(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white font-mono text-sm"
                rows={12}
                placeholder="Home Cleaning Services&#10;&#9;Deep Cleaning [H]&#10;&#9;Move-In Cleaning [H]&#10;&#9;Regular Maid Service [H]&#10;Janitorial Services&#10;&#9;Office Cleaning [J]&#10;&#9;Medical Facility Cleaning [J]&#10;Construction Cleanup&#10;&#9;Post-Construction [C]&#10;&#9;Rough Clean [C]"
              />

              {/* Import mode selection */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="radio"
                    name="importMode"
                    checked={tabImportMode === 'merge'}
                    onChange={() => setTabImportMode('merge')}
                    className="accent-brand-cyan"
                  />
                  Merge (fill in blanks)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="radio"
                    name="importMode"
                    checked={tabImportMode === 'replace'}
                    onChange={() => setTabImportMode('replace')}
                    className="accent-brand-cyan"
                  />
                  Replace all
                </label>
              </div>

              {/* Preview results */}
              {tabImportResult && (
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
                  <h4 className="text-sm font-semibold text-white mb-2">Preview</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-green-400 font-bold">{tabImportResult.toCreate}</span>
                      <span className="text-gray-400 ml-1">to create</span>
                    </div>
                    <div>
                      <span className="text-blue-400 font-bold">{tabImportResult.existing}</span>
                      <span className="text-gray-400 ml-1">existing</span>
                    </div>
                    <div>
                      <span className="text-orange-400 font-bold">{tabImportResult.conflicts?.length || 0}</span>
                      <span className="text-gray-400 ml-1">conflicts</span>
                    </div>
                  </div>

                  {/* Conflict details */}
                  {tabImportResult.conflicts?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h5 className="text-xs font-semibold text-orange-400">Conflicts:</h5>
                      {tabImportResult.conflicts.map((c: any, i: number) => (
                        <div key={i} className="text-xs bg-slate-900 p-2 rounded">
                          <span className="text-white font-medium">{c.title}</span>
                          <div className="text-gray-400 mt-1">
                            Existing: <span className="text-blue-400">{c.existingParent || 'root'}</span>
                            {' → '}
                            Import: <span className="text-green-400">{c.importParent || 'root'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between p-4 border-t border-slate-700">
              <button
                onClick={() => importTabHierarchy('preview')}
                disabled={tabImporting || !tabImportText.trim()}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white transition disabled:opacity-50"
              >
                Preview
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowTabImportModal(false); setTabImportResult(null); }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => importTabHierarchy(tabImportMode)}
                  disabled={tabImporting || !tabImportText.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-medium transition disabled:opacity-50 flex items-center gap-2"
                >
                  {tabImporting && (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {tabImportMode === 'replace' ? 'Replace & Import' : 'Merge & Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Add Location</h3>
              <button onClick={() => setShowLocationModal(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-4 space-y-4">
              {/* Current locations */}
              {locations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Current Locations ({locations.length})</h4>
                  <div className="space-y-2">
                    {locations.map((loc) => (
                      <div key={loc.id} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                        <span className="text-white font-medium">{loc.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{loc.child_count} pages</span>
                          <button
                            onClick={() => loadLocationForEdit(loc)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add new location */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {locations.length === 0 ? 'Add Second Location (converts to multi-location structure)' : 'Add New Location'}
                </label>
                <input
                  type="text"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder="e.g., Phoenix, Scottsdale, Downtown"
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                />
                {locations.length === 0 && (
                  <p className="text-xs text-amber-400 mt-2">
                    This will shift your current structure under "Location 1" and create a duplicate for the new location.
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-700">
              <button
                onClick={() => setShowLocationModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={addLocation}
                disabled={addingLocation || !newLocationName.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded text-white font-medium transition disabled:opacity-50 flex items-center gap-2"
              >
                {addingLocation && (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Add Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && bulkEditLocation && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">
                Edit: {bulkEditLocation.title}
              </h3>
              <button onClick={() => setShowBulkEditModal(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-400 mb-4">
                Uncheck pages that should be different from the original location, then edit their names.
              </p>
              <div className="space-y-2 max-h-[400px] overflow-auto">
                {bulkEditNodes.map((node, idx) => (
                  <div key={node.id} className="flex items-center gap-3 p-2 bg-slate-800 rounded">
                    <input
                      type="checkbox"
                      checked={node.sameAsOriginal}
                      onChange={(e) => {
                        const updated = [...bulkEditNodes];
                        updated[idx].sameAsOriginal = e.target.checked;
                        setBulkEditNodes(updated);
                      }}
                      className="accent-brand-cyan"
                    />
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={node.newTitle}
                        onChange={(e) => {
                          const updated = [...bulkEditNodes];
                          updated[idx].newTitle = e.target.value;
                          updated[idx].sameAsOriginal = false;
                          setBulkEditNodes(updated);
                        }}
                        disabled={node.sameAsOriginal}
                        className={`flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm ${node.sameAsOriginal ? 'opacity-50' : ''}`}
                      />
                    </div>
                    <span className="text-xs text-gray-500" style={{ paddingLeft: `${node.depth * 8}px` }}>
                      L{node.depth}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between p-4 border-t border-slate-700">
              <span className="text-sm text-gray-400">
                {bulkEditNodes.filter(n => !n.sameAsOriginal).length} changes pending
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulkEditModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveBulkEdits}
                  className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 rounded text-slate-900 font-medium transition"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gap Analysis / Neighborhoods Modal */}
      {showGapModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Neighborhood Pages</h3>
              <button onClick={() => setShowGapModal(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-400 mb-4">
                Analyze your heat map data to find geographic gaps and create neighborhood pages to fill them.
              </p>

              {analyzingGaps ? (
                <div className="text-center py-8">
                  <svg className="animate-spin w-8 h-8 mx-auto text-pink-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-gray-400 mt-2">Analyzing heat map data...</p>
                </div>
              ) : gaps.length === 0 ? (
                <div className="text-center py-8 bg-slate-800 rounded-lg">
                  <svg className="w-12 h-12 mx-auto text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <p className="text-gray-400 mb-2">No gaps found in current data.</p>
                  <p className="text-xs text-gray-500">
                    Run GeoGrid scans in Local Viking first, then come back here to find coverage gaps.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-400">
                      Found <span className="text-pink-400 font-bold">{gaps.length}</span> geographic gaps
                    </span>
                    <button
                      onClick={analyzeGaps}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      Refresh
                    </button>
                  </div>

                  {gaps.map((gap, idx) => (
                    <GapItem key={idx} gap={gap} onCreate={(name) => createNeighborhoodPage(gap, name)} />
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-700">
              <button
                onClick={() => setShowGapModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generation Progress Overlay */}
      {generating && generationProgress && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9998]">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-8 max-w-md w-full mx-4">
            <div className="flex items-center justify-center mb-6">
              <svg className={`animate-spin h-12 w-12 ${articlePublishMode === 'wordpress' ? 'text-green-500' : 'text-purple-500'}`} viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white text-center mb-2">
              {articlePublishMode === 'wordpress' ? 'Processing → WordPress' : 'Processing → Draft'}
            </h3>
            <p className="text-gray-400 text-center mb-4">
              Step {generationProgress.current} of {generationProgress.total}
            </p>
            <div className="bg-slate-700 rounded-full h-3 mb-4 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${articlePublishMode === 'wordpress' ? 'bg-green-500' : 'bg-purple-500'}`}
                style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
              />
            </div>
            {generationProgress.currentTitle && (
              <p className="text-sm text-gray-500 text-center truncate">
                {generationProgress.currentTitle}
              </p>
            )}
          </div>
        </div>
      )}

      {/* PageDetailModal */}
      {showPageDetailModal && viewingNode && (
        <PageDetailModal
          node={viewingNode}
          onClose={() => { setShowPageDetailModal(false); setViewingNode(null); }}
          onNodeUpdate={(updatedNode) => {
            // Update the node in local state
            setFlatNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
            loadPlan();
          }}
          showNotification={showNotification}
        />
      )}
    </div>
  );
};

// Gap Item Component
const GapItem: React.FC<{ gap: any; onCreate: (name: string) => void }> = ({ gap, onCreate }) => {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = () => {
    if (!name.trim()) return;
    setCreating(true);
    onCreate(name);
  };

  return (
    <div className="p-3 bg-slate-800 rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-white font-medium">Position: #{gap.rank}</span>
          <span className="text-gray-500 ml-2 text-sm">for "{gap.keyword}"</span>
        </div>
        <span className="text-xs text-gray-500">
          {gap.lat?.toFixed(4)}, {gap.lng?.toFixed(4)}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Neighborhood name (e.g., Arcadia, Downtown)"
          className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className="px-3 py-1 bg-pink-600 hover:bg-pink-700 rounded text-white text-sm disabled:opacity-50"
        >
          {creating ? '...' : 'Create'}
        </button>
      </div>
    </div>
  );
};

export default SitePlanningSection;
