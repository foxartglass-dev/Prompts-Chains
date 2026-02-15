/**
 * Calibration Routes
 * CRUD for calibration entries + pack compilation for prompt injection.
 *
 * Calibration entries are stored as a JSONB array on image_creation_settings.
 * Each entry follows the CalibrationEntry schema defined in the PRD.
 *
 * Settings hierarchy: website_id FIRST, then workflow_id (Golden Rule 8).
 */

import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';

const router = express.Router();

// Middleware to check database availability
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// ========================================
// HELPERS
// ========================================

/**
 * Resolve settings row following Golden Rule 8: website_id FIRST, then workflow_id.
 * Returns { row, isWebsiteLevel, websiteId }
 */
async function resolveSettings(workflowId) {
  // 1. Get website_id for this workflow
  let websiteId = null;
  try {
    const wfResult = await sql`SELECT website_id FROM workflows WHERE id = ${workflowId}`;
    if (wfResult.length > 0 && wfResult[0].website_id) {
      websiteId = wfResult[0].website_id;
    }
  } catch (err) {
    console.log('[Calibration] Could not lookup website:', err.message);
  }

  // 2. Try website-level settings FIRST
  if (websiteId) {
    try {
      const rows = await sql`
        SELECT id, calibration_entries, calibration_version
        FROM image_creation_settings
        WHERE website_id = ${websiteId}
      `;
      if (rows.length > 0) {
        return { row: rows[0], isWebsiteLevel: true, websiteId };
      }
    } catch (err) {
      // calibration columns may not exist yet
      if (err.message?.includes('calibration_entries') || err.message?.includes('calibration_version')) {
        console.log('[Calibration] Columns not available yet (run migration 035)');
        return { row: null, isWebsiteLevel: true, websiteId, migrationNeeded: true };
      }
      throw err;
    }
  }

  // 3. Fall back to workflow-level
  try {
    const rows = await sql`
      SELECT id, calibration_entries, calibration_version
      FROM image_creation_settings
      WHERE workflow_id = ${workflowId}
    `;
    if (rows.length > 0) {
      return { row: rows[0], isWebsiteLevel: false, websiteId: null };
    }
  } catch (err) {
    if (err.message?.includes('calibration_entries') || err.message?.includes('calibration_version')) {
      console.log('[Calibration] Columns not available yet (run migration 035)');
      return { row: null, isWebsiteLevel: false, websiteId: null, migrationNeeded: true };
    }
    throw err;
  }

  return { row: null, isWebsiteLevel: false, websiteId: null };
}

/**
 * Persist calibration_entries + calibration_version back to DB.
 */
async function saveCalibration(workflowId, isWebsiteLevel, websiteId, entries, version) {
  const entriesJson = JSON.stringify(entries);
  if (isWebsiteLevel && websiteId) {
    await sql`
      UPDATE image_creation_settings
      SET calibration_entries = ${entriesJson}::jsonb,
          calibration_version = ${version},
          updated_at = CURRENT_TIMESTAMP
      WHERE website_id = ${websiteId}
    `;
  } else {
    await sql`
      UPDATE image_creation_settings
      SET calibration_entries = ${entriesJson}::jsonb,
          calibration_version = ${version},
          updated_at = CURRENT_TIMESTAMP
      WHERE workflow_id = ${workflowId}
    `;
  }
}

// ========================================
// GET /api/calibration/:workflowId
// Returns all calibration entries + version
// ========================================
router.get('/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { row, migrationNeeded } = await resolveSettings(workflowId);

    if (migrationNeeded) {
      return res.json({
        entries: [],
        version: 0,
        migrationNeeded: true
      });
    }

    if (!row) {
      return res.json({ entries: [], version: 0 });
    }

    res.json({
      entries: row.calibration_entries || [],
      version: row.calibration_version || 0
    });
  } catch (error) {
    console.error('[Calibration] GET error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// PUT /api/calibration/:workflowId
// Full replace of calibration entries array.
// Auto-increments calibration_version.
// ========================================
router.put('/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { entries } = req.body;

    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'entries must be an array' });
    }

    const { row, isWebsiteLevel, websiteId, migrationNeeded } = await resolveSettings(workflowId);

    if (migrationNeeded) {
      return res.status(503).json({ error: 'Migration 035 has not been run. Please run the calibration migration first.' });
    }

    if (!row) {
      return res.status(404).json({ error: 'No settings found for this workflow. Create image creation settings first.' });
    }

    // Protection: don't let a non-empty calibration set be replaced with empty
    // unless explicitly confirmed (Golden Rule 1 spirit — never overwrite with empty)
    const currentEntries = row.calibration_entries || [];
    if (currentEntries.length > 0 && entries.length === 0) {
      const { confirmClear } = req.body;
      if (!confirmClear) {
        return res.status(400).json({
          error: 'Refusing to replace non-empty calibration entries with empty array. Send confirmClear: true to force.',
          currentCount: currentEntries.length
        });
      }
    }

    const newVersion = (row.calibration_version || 0) + 1;
    await saveCalibration(workflowId, isWebsiteLevel, websiteId, entries, newVersion);

    console.log(`[Calibration] Saved ${entries.length} entries (v${newVersion}) for workflow ${workflowId} (${isWebsiteLevel ? 'website' : 'workflow'}-level)`);

    res.json({
      success: true,
      version: newVersion,
      count: entries.length
    });
  } catch (error) {
    console.error('[Calibration] PUT error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// POST /api/calibration/:workflowId/entry
// Add a single new calibration entry.
// ========================================
router.post('/:workflowId/entry', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const entry = req.body;

    // Validate required fields
    if (!entry.id || !entry.title || !entry.model_instruction) {
      return res.status(400).json({
        error: 'Required fields: id, title, model_instruction'
      });
    }

    const { row, isWebsiteLevel, websiteId, migrationNeeded } = await resolveSettings(workflowId);

    if (migrationNeeded) {
      return res.status(503).json({ error: 'Migration 035 has not been run.' });
    }

    if (!row) {
      return res.status(404).json({ error: 'No settings found for this workflow.' });
    }

    const entries = row.calibration_entries || [];

    // Check for duplicate ID
    if (entries.some(e => e.id === entry.id)) {
      return res.status(409).json({ error: `Entry with id "${entry.id}" already exists` });
    }

    // Ensure timestamps
    const now = new Date().toISOString();
    const newEntry = {
      ...entry,
      tags: entry.tags || ['All'],
      priority: entry.priority || 'medium',
      human_note: entry.human_note || '',
      trigger: entry.trigger || '',
      do_preferred: entry.do_preferred || '',
      avoid_antipattern: entry.avoid_antipattern || '',
      enforcement_tactics: entry.enforcement_tactics || [],
      createdAt: entry.createdAt || now,
      updatedAt: now
    };

    entries.push(newEntry);
    const newVersion = (row.calibration_version || 0) + 1;
    await saveCalibration(workflowId, isWebsiteLevel, websiteId, entries, newVersion);

    console.log(`[Calibration] Added entry "${entry.id}: ${entry.title}" (v${newVersion})`);

    res.json({
      success: true,
      entry: newEntry,
      version: newVersion,
      count: entries.length
    });
  } catch (error) {
    console.error('[Calibration] POST entry error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// PATCH /api/calibration/:workflowId/entry/:entryId
// Update a single calibration entry by ID.
// ========================================
router.patch('/:workflowId/entry/:entryId', requireDb, async (req, res) => {
  try {
    const { workflowId, entryId } = req.params;
    const updates = req.body;

    const { row, isWebsiteLevel, websiteId, migrationNeeded } = await resolveSettings(workflowId);

    if (migrationNeeded) {
      return res.status(503).json({ error: 'Migration 035 has not been run.' });
    }

    if (!row) {
      return res.status(404).json({ error: 'No settings found for this workflow.' });
    }

    const entries = row.calibration_entries || [];
    const idx = entries.findIndex(e => e.id === entryId);

    if (idx === -1) {
      return res.status(404).json({ error: `Entry "${entryId}" not found` });
    }

    // Merge updates, refresh updatedAt
    entries[idx] = {
      ...entries[idx],
      ...updates,
      id: entryId, // prevent ID change
      updatedAt: new Date().toISOString()
    };

    const newVersion = (row.calibration_version || 0) + 1;
    await saveCalibration(workflowId, isWebsiteLevel, websiteId, entries, newVersion);

    console.log(`[Calibration] Updated entry "${entryId}" (v${newVersion})`);

    res.json({
      success: true,
      entry: entries[idx],
      version: newVersion
    });
  } catch (error) {
    console.error('[Calibration] PATCH entry error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// DELETE /api/calibration/:workflowId/entry/:entryId
// Remove a single calibration entry by ID.
// ========================================
router.delete('/:workflowId/entry/:entryId', requireDb, async (req, res) => {
  try {
    const { workflowId, entryId } = req.params;

    const { row, isWebsiteLevel, websiteId, migrationNeeded } = await resolveSettings(workflowId);

    if (migrationNeeded) {
      return res.status(503).json({ error: 'Migration 035 has not been run.' });
    }

    if (!row) {
      return res.status(404).json({ error: 'No settings found for this workflow.' });
    }

    const entries = row.calibration_entries || [];
    const idx = entries.findIndex(e => e.id === entryId);

    if (idx === -1) {
      return res.status(404).json({ error: `Entry "${entryId}" not found` });
    }

    const removed = entries.splice(idx, 1)[0];
    const newVersion = (row.calibration_version || 0) + 1;
    await saveCalibration(workflowId, isWebsiteLevel, websiteId, entries, newVersion);

    console.log(`[Calibration] Deleted entry "${entryId}" (v${newVersion})`);

    res.json({
      success: true,
      deleted: removed,
      version: newVersion,
      count: entries.length
    });
  } catch (error) {
    console.error('[Calibration] DELETE entry error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// GET /api/calibration/:workflowId/pack/:tag
// Compile calibration pack for a specific tag.
// Query logic from PRD:
//   1. Include items where tag in tags[]
//   2. Include items marked "All" (global)
//   3. Sort by priority desc (Hard > Med > Soft), then updatedAt desc
//   4. Limit to 12-20 max
//   5. Render as numbered bullet list (Template 3)
// ========================================
router.get('/:workflowId/pack/:tag', requireDb, async (req, res) => {
  try {
    const { workflowId, tag } = req.params;
    const { limit: maxEntries = 16 } = req.query; // default 16, configurable 12-20

    const { row, migrationNeeded } = await resolveSettings(workflowId);

    if (migrationNeeded || !row) {
      return res.json({ pack: '', entries: [], version: 0 });
    }

    const entries = row.calibration_entries || [];
    const compiled = compileCalibrationPack(entries, tag, parseInt(maxEntries));

    res.json({
      pack: compiled.text,
      entries: compiled.entries,
      count: compiled.entries.length,
      version: row.calibration_version || 0
    });
  } catch (error) {
    console.error('[Calibration] GET pack error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CALIBRATION PACK COMPILER
// ========================================

const PRIORITY_ORDER = { hard: 0, medium: 1, soft: 2 };

/**
 * Compile calibration entries into a formatted pack for prompt injection.
 *
 * @param {Array} entries - All calibration entries
 * @param {string} activeTag - The tag being generated for
 * @param {number} maxEntries - Max entries to include (12-20 range, default 16)
 * @returns {{ text: string, entries: Array }} Compiled pack text + included entries
 */
export function compileCalibrationPack(entries, activeTag, maxEntries = 16) {
  // Clamp to valid range
  maxEntries = Math.max(12, Math.min(20, maxEntries));

  // 1. Filter: include entries matching activeTag OR marked "All" (global)
  const matched = entries.filter(entry => {
    const tags = entry.tags || [];
    return tags.includes('All') || tags.includes(activeTag);
  });

  // 2. Sort: priority desc (hard first), then updatedAt desc (newest first)
  matched.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 1;
    const pb = PRIORITY_ORDER[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    // Same priority: most recent wins
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });

  // 3. Limit
  const selected = matched.slice(0, maxEntries);

  if (selected.length === 0) {
    return { text: '', entries: [] };
  }

  // 4. Render as Template 3 (Calibration Pack)
  const lines = [`Calibration Pack — Tag ${activeTag} (sorted by priority):`];

  selected.forEach((entry, idx) => {
    const priorityLabel = (entry.priority || 'medium').charAt(0).toUpperCase() + (entry.priority || 'medium').slice(1);
    lines.push(`${idx + 1}. (${priorityLabel}) ${entry.model_instruction}`);
  });

  // Meta-instruction per PRD
  lines.push('');
  lines.push('If a calibration item conflicts with guardrails, guardrails win. If two calibration items conflict, higher priority wins; if same priority, most recent wins.');

  return {
    text: lines.join('\n'),
    entries: selected
  };
}

export default router;
