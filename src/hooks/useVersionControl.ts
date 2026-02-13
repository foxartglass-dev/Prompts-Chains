/**
 * useVersionControl Hook
 *
 * Provides version history functionality for prompt fields:
 * - Save snapshots (manual, auto-save, ai-assistant)
 * - Fetch version history for any entity
 * - Delete old versions
 * - Auto-prune to keep last 50 versions per entity
 */

import { useState, useCallback, useRef } from 'react';

export interface VersionEntry {
  id: number;
  website_id: number | null;
  workflow_id: number | null;
  entity_type: string;
  entity_id: string;
  version_name: string | null;
  content: any; // JSONB - flexible
  notes: string | null;
  created_by: string;
  created_at: string;
}

export type VersionSource = 'manual' | 'auto-save' | 'ai-assistant';

export type VersionEntityType =
  | 'avatar'
  | 'placeholder'
  | 'guided_gpt_prompt'
  | 'guided_gpt_rule'
  | 'smart_prompt_prompt'
  | 'smart_prompt_rule'
  | 'main_prompt'
  | 'guardrails'
  | 'smart_prompt_guidance'
  | 'legacy_prompt_rule'
  | 'categories'
  | 'matching_rule'
  | 'main_prompt_persistent'
  | 'guided_instructions_persistent'
  | 'smart_prompt_persistent';

const MAX_VERSIONS_PER_ENTITY = 50;

// Debounce map to avoid duplicate snapshots within a short window
const snapshotDebounceMap = new Map<string, number>();
const SNAPSHOT_DEBOUNCE_MS = 3000; // 3 seconds between snapshots of same entity

export function useVersionControl(workflowId?: number) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pruneInFlightRef = useRef<Set<string>>(new Set());

  /**
   * Save a version snapshot to history.
   * Includes debounce to prevent rapid duplicate snapshots.
   */
  const saveVersionSnapshot = useCallback(async (
    entityType: VersionEntityType,
    entityId: string,
    content: any,
    source: VersionSource = 'auto-save',
    versionName?: string,
    notes?: string
  ): Promise<VersionEntry | null> => {
    if (!workflowId) return null;

    // Skip if content is empty/null
    if (!content || (typeof content === 'string' && content.trim() === '')) return null;

    // Debounce: skip if we recently saved for this exact entity
    const debounceKey = `${entityType}:${entityId}`;
    const lastSnapshot = snapshotDebounceMap.get(debounceKey);
    if (lastSnapshot && Date.now() - lastSnapshot < SNAPSHOT_DEBOUNCE_MS) {
      return null;
    }
    snapshotDebounceMap.set(debounceKey, Date.now());

    try {
      const res = await fetch('/api/image-creation/version-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          entityType,
          entityId,
          versionName: versionName || null,
          content: typeof content === 'string' ? { text: content } : content,
          notes: notes || null,
          createdBy: source
        })
      });

      if (!res.ok) return null;

      const data = await res.json();
      if (data.success) {
        // Auto-prune in background (don't await)
        pruneOldVersions(entityType, entityId);
        return data.version;
      }
      return null;
    } catch (err) {
      console.error('[Version History] Save error:', err);
      return null;
    }
  }, [workflowId]);

  /**
   * Fetch version history for an entity.
   */
  const fetchVersionHistory = useCallback(async (
    entityType: VersionEntityType,
    entityId: string,
    limit: number = MAX_VERSIONS_PER_ENTITY
  ): Promise<VersionEntry[]> => {
    if (!workflowId) return [];

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        workflowId: String(workflowId),
        entityType,
        entityId,
        limit: String(limit)
      });

      const res = await fetch(`/api/image-creation/version-history?${params}`);
      if (!res.ok) {
        setError('Failed to fetch version history');
        setLoading(false);
        return [];
      }

      const data = await res.json();
      setLoading(false);

      if (data.success) {
        return data.versions || [];
      }
      return [];
    } catch (err) {
      console.error('[Version History] Fetch error:', err);
      setError('Network error fetching version history');
      setLoading(false);
      return [];
    }
  }, [workflowId]);

  /**
   * Delete a specific version.
   */
  const deleteVersion = useCallback(async (versionId: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/image-creation/version-history/${versionId}`, {
        method: 'DELETE'
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.success || false;
    } catch (err) {
      console.error('[Version History] Delete error:', err);
      return false;
    }
  }, []);

  /**
   * Auto-prune: keep only the last MAX_VERSIONS_PER_ENTITY versions.
   * Deletes oldest versions beyond the limit.
   * Runs in background, won't block the UI.
   */
  const pruneOldVersions = useCallback(async (
    entityType: VersionEntityType,
    entityId: string
  ) => {
    if (!workflowId) return;

    // Prevent concurrent prunes for the same entity
    const pruneKey = `${entityType}:${entityId}`;
    if (pruneInFlightRef.current.has(pruneKey)) return;
    pruneInFlightRef.current.add(pruneKey);

    try {
      // Fetch all versions (up to a reasonable limit)
      const params = new URLSearchParams({
        workflowId: String(workflowId),
        entityType,
        entityId,
        limit: '200'
      });

      const res = await fetch(`/api/image-creation/version-history?${params}`);
      if (!res.ok) return;

      const data = await res.json();
      const versions: VersionEntry[] = data.versions || [];

      // If within limit, nothing to prune
      if (versions.length <= MAX_VERSIONS_PER_ENTITY) return;

      // Delete oldest versions (they come sorted newest-first from API)
      const toDelete = versions.slice(MAX_VERSIONS_PER_ENTITY);
      for (const v of toDelete) {
        await fetch(`/api/image-creation/version-history/${v.id}`, { method: 'DELETE' });
      }

      console.log(`[Version History] Pruned ${toDelete.length} old versions for ${entityType}:${entityId}`);
    } catch (err) {
      console.error('[Version History] Prune error:', err);
    } finally {
      pruneInFlightRef.current.delete(pruneKey);
    }
  }, [workflowId]);

  return {
    saveVersionSnapshot,
    fetchVersionHistory,
    deleteVersion,
    pruneOldVersions,
    loading,
    error
  };
}
