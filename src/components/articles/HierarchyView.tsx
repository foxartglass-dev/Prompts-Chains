import React, { useState, useEffect } from 'react';

interface PageNode {
  id: number;
  title: string;
  slug: string;
  status: string;
  children: PageNode[];
}

interface HierarchyViewProps {
  websiteId: number;
}

const HierarchyView: React.FC<HierarchyViewProps> = ({ websiteId }) => {
  const [hierarchy, setHierarchy] = useState<{ root: PageNode[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchHierarchy();
  }, [websiteId]);

  const fetchHierarchy = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wp-browser/hierarchy/${websiteId}`);
      if (res.ok) {
        const data = await res.json();
        setHierarchy(data);
        // Expand root nodes by default
        if (data.root) {
          setExpandedNodes(new Set(data.root.map((n: PageNode) => n.id)));
        }
      } else {
        setError('Failed to load hierarchy. Try syncing first.');
      }
    } catch (err) {
      setError('Failed to load hierarchy');
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (id: number) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'publish': return 'bg-green-500';
      case 'draft': return 'bg-yellow-500';
      case 'private': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const renderNode = (node: PageNode, depth: number = 0): JSX.Element => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center gap-2 py-2 px-3 hover:bg-slate-800 rounded-lg cursor-pointer transition group`}
          style={{ marginLeft: `${depth * 24}px` }}
          onClick={() => hasChildren && toggleNode(node.id)}
        >
          {/* Expand/collapse toggle */}
          <span className="w-5 h-5 flex items-center justify-center">
            {hasChildren ? (
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <span className="w-2 h-2 rounded-full bg-brand-cyan/50" />
            )}
          </span>

          {/* Page icon */}
          <svg className="w-4 h-4 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>

          {/* Title */}
          <span className="text-white font-medium flex-1">{node.title || '(Untitled)'}</span>

          {/* Status indicator */}
          <span className={`w-2 h-2 rounded-full ${getStatusColor(node.status)}`} title={node.status} />

          {/* Child count */}
          {hasChildren && (
            <span className="text-xs text-gray-500">
              {node.children.length}
            </span>
          )}

          {/* Hover actions */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
            <button
              className="p-1 hover:bg-slate-700 rounded"
              title="Edit page"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Open in visual editor
              }}
            >
              <svg className="w-3 h-3 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-brand-cyan animate-pulse">Loading hierarchy...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
        <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p>{error}</p>
        <button
          onClick={fetchHierarchy}
          className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 text-slate-900 font-medium rounded-lg transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!hierarchy || hierarchy.root.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
        <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p>No pages synced yet</p>
        <p className="text-sm">Click the "Sync" button to fetch pages from WordPress</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-400">
          {hierarchy.total} page{hierarchy.total !== 1 ? 's' : ''}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setExpandedNodes(new Set())}
            className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-gray-300 rounded transition"
          >
            Collapse All
          </button>
          <button
            onClick={() => {
              const allIds = new Set<number>();
              const collectIds = (nodes: PageNode[]) => {
                nodes.forEach(n => {
                  allIds.add(n.id);
                  if (n.children) collectIds(n.children);
                });
              };
              collectIds(hierarchy.root);
              setExpandedNodes(allIds);
            }}
            className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-gray-300 rounded transition"
          >
            Expand All
          </button>
        </div>
      </div>

      {/* Tree view */}
      <div className="flex-1 overflow-auto bg-slate-900 rounded-lg border border-brand-cyan/20 p-2">
        {hierarchy.root.map(node => renderNode(node))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Published
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500" /> Draft
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-500" /> Private
        </span>
      </div>
    </div>
  );
};

export default HierarchyView;
