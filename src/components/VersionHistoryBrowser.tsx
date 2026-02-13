/**
 * VersionHistoryBrowser Component
 *
 * A small clock icon button that opens a dropdown showing version history
 * for any prompt field. Supports preview, restore, and delete.
 *
 * Usage:
 *   <VersionHistoryBrowser
 *     entityType="main_prompt"
 *     entityId="H"
 *     workflowId={workflowId}
 *     onRestore={(content) => handleUpdateAvatar(id, { mainPrompt: content })}
 *   />
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVersionControl, VersionEntry, VersionEntityType, VersionSource } from '../hooks/useVersionControl';

interface Props {
  entityType: VersionEntityType;
  entityId: string;
  workflowId?: number;
  onRestore: (content: any) => void;
  showNotification?: (message: string, type: 'success' | 'info' | 'error') => void;
  /** Optional color theme to match surrounding UI */
  accentColor?: 'amber' | 'emerald' | 'purple' | 'blue' | 'slate';
}

/** Format a date string for display */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/** Source badge colors */
function getSourceBadge(source: string): { label: string; className: string } {
  switch (source) {
    case 'manual':
      return { label: 'Manual', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
    case 'auto-save':
      return { label: 'Auto', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    case 'ai-assistant':
      return { label: 'AI', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
    default:
      return { label: source, className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
  }
}

/** Extract display text from version content */
function getContentPreview(content: any): string {
  if (!content) return '(empty)';
  if (typeof content === 'string') return content;
  if (content.text) return content.text;
  // For complex objects (guardrails, categories), show a summary
  if (typeof content === 'object') {
    const json = JSON.stringify(content);
    if (json.length > 150) return json.substring(0, 147) + '...';
    return json;
  }
  return String(content);
}

/** Extract restorable value from version content */
function getRestorableContent(content: any): any {
  if (!content) return '';
  // If it was stored as { text: "..." }, unwrap it
  if (content.text !== undefined && Object.keys(content).length === 1) {
    return content.text;
  }
  return content;
}

const VersionHistoryBrowser: React.FC<Props> = ({
  entityType,
  entityId,
  workflowId,
  onRestore,
  showNotification,
  accentColor = 'slate'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<number | null>(null);
  const [fetched, setFetched] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { fetchVersionHistory, deleteVersion, loading } = useVersionControl(workflowId);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setPreviewId(null);
        setConfirmRestoreId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Fetch versions when opened
  const handleOpen = useCallback(async () => {
    if (isOpen) {
      setIsOpen(false);
      setPreviewId(null);
      setConfirmRestoreId(null);
      return;
    }

    setIsOpen(true);
    setFetched(false);
    const history = await fetchVersionHistory(entityType, entityId);
    setVersions(history);
    setFetched(true);
  }, [isOpen, entityType, entityId, fetchVersionHistory]);

  // Handle restore
  const handleRestore = useCallback((version: VersionEntry) => {
    const restorable = getRestorableContent(version.content);
    onRestore(restorable);
    setIsOpen(false);
    setPreviewId(null);
    setConfirmRestoreId(null);
    showNotification?.(`Restored version from ${formatDate(version.created_at)}`, 'success');
  }, [onRestore, showNotification]);

  // Handle delete
  const handleDelete = useCallback(async (versionId: number) => {
    const success = await deleteVersion(versionId);
    if (success) {
      setVersions(prev => prev.filter(v => v.id !== versionId));
      if (previewId === versionId) setPreviewId(null);
      showNotification?.('Version deleted', 'info');
    } else {
      showNotification?.('Failed to delete version', 'error');
    }
  }, [deleteVersion, previewId, showNotification]);

  const previewVersion = previewId ? versions.find(v => v.id === previewId) : null;

  // Accent color classes
  const accentMap: Record<string, { iconHover: string; border: string }> = {
    amber: { iconHover: 'hover:text-amber-400', border: 'border-amber-500/30' },
    emerald: { iconHover: 'hover:text-emerald-400', border: 'border-emerald-500/30' },
    purple: { iconHover: 'hover:text-purple-400', border: 'border-purple-500/30' },
    blue: { iconHover: 'hover:text-blue-400', border: 'border-blue-500/30' },
    slate: { iconHover: 'hover:text-blue-400', border: 'border-slate-600' },
  };
  const accent = accentMap[accentColor] || accentMap.slate;

  return (
    <div className="relative inline-flex">
      {/* Clock icon button */}
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className={`p-0.5 rounded text-slate-500 ${accent.iconHover} transition-colors`}
        title="Version history"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={`absolute z-50 top-full right-0 mt-1 w-80 bg-slate-800 border ${accent.border} rounded-lg shadow-xl`}
          style={{ maxHeight: '420px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
            <span className="text-xs font-medium text-slate-300">
              Version History
            </span>
            <span className="text-[10px] text-slate-500">
              {entityType} / {entityId}
            </span>
          </div>

          {/* Loading state */}
          {loading && !fetched && (
            <div className="px-3 py-6 text-center text-xs text-slate-500">
              Loading versions...
            </div>
          )}

          {/* Empty state */}
          {fetched && versions.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-slate-500">
              No version history yet.
              <br />
              <span className="text-slate-600">Versions are saved automatically when you edit.</span>
            </div>
          )}

          {/* Preview pane */}
          {previewVersion && (
            <div className="border-b border-slate-700 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">Preview</span>
                <button
                  onClick={() => setPreviewId(null)}
                  className="text-[10px] text-slate-500 hover:text-slate-300"
                >
                  Close
                </button>
              </div>
              <div className="bg-slate-900 rounded p-2 text-xs text-slate-300 font-mono max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words">
                {getContentPreview(previewVersion.content)}
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {confirmRestoreId === previewVersion.id ? (
                  <>
                    <span className="text-[10px] text-amber-400 flex-1">Replace current content?</span>
                    <button
                      onClick={() => handleRestore(previewVersion)}
                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] rounded transition"
                    >
                      Yes, Restore
                    </button>
                    <button
                      onClick={() => setConfirmRestoreId(null)}
                      className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] rounded transition"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmRestoreId(previewVersion.id)}
                    className="px-2 py-0.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 text-[10px] rounded border border-blue-500/30 transition"
                  >
                    Restore this version
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Versions list */}
          {fetched && versions.length > 0 && (
            <div className="overflow-y-auto" style={{ maxHeight: previewVersion ? '180px' : '320px' }}>
              {versions.map((v) => {
                const badge = getSourceBadge(v.created_by);
                const isSelected = previewId === v.id;

                return (
                  <div
                    key={v.id}
                    className={`flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700/50 cursor-pointer border-b border-slate-700/50 transition ${
                      isSelected ? 'bg-slate-700/70' : ''
                    }`}
                    onClick={() => setPreviewId(isSelected ? null : v.id)}
                  >
                    {/* Date & time */}
                    <div className="flex-shrink-0 w-16">
                      <div className="text-[10px] text-slate-300 leading-tight">{formatDate(v.created_at)}</div>
                      <div className="text-[9px] text-slate-500">{formatTime(v.created_at)}</div>
                    </div>

                    {/* Source badge */}
                    <span className={`flex-shrink-0 px-1.5 py-0.5 text-[9px] rounded border ${badge.className}`}>
                      {badge.label}
                    </span>

                    {/* Version name or content snippet */}
                    <div className="flex-1 min-w-0">
                      {v.version_name ? (
                        <div className="text-[10px] text-slate-300 truncate">{v.version_name}</div>
                      ) : (
                        <div className="text-[10px] text-slate-500 truncate">
                          {getContentPreview(v.content).substring(0, 60)}
                        </div>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(v.id);
                      }}
                      className="flex-shrink-0 p-0.5 text-slate-600 hover:text-red-400 transition"
                      title="Delete this version"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          {fetched && versions.length > 0 && (
            <div className="px-3 py-1.5 border-t border-slate-700 text-[9px] text-slate-600">
              {versions.length} version{versions.length !== 1 ? 's' : ''} (max 50 kept)
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VersionHistoryBrowser;
