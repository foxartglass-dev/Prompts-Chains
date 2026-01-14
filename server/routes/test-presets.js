import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';

const router = express.Router();

// Middleware to check database
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

/**
 * GET /api/test-presets/:workflowId
 * Get all test presets for a workflow
 */
router.get('/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;

    const presets = await sql`
      SELECT id, name, steps, created_at, updated_at
      FROM test_presets
      WHERE workflow_id = ${workflowId}
      ORDER BY created_at DESC
    `;

    res.json({ success: true, presets });
  } catch (error) {
    console.error('[Test Presets] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/test-presets/:workflowId
 * Create a new test preset
 */
router.post('/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { name, steps } = req.body;

    if (!name || !steps) {
      return res.status(400).json({ error: 'Name and steps are required' });
    }

    const result = await sql`
      INSERT INTO test_presets (workflow_id, name, steps)
      VALUES (${workflowId}, ${name}, ${JSON.stringify(steps)})
      RETURNING id, name, steps, created_at
    `;

    res.json({ success: true, preset: result[0] });
  } catch (error) {
    console.error('[Test Presets] POST error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/test-presets/:presetId
 * Update a test preset
 */
router.put('/:presetId', requireDb, async (req, res) => {
  try {
    const { presetId } = req.params;
    const { name, steps } = req.body;

    const result = await sql`
      UPDATE test_presets
      SET
        name = COALESCE(${name}, name),
        steps = COALESCE(${steps ? JSON.stringify(steps) : null}::jsonb, steps),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${presetId}
      RETURNING id, name, steps, updated_at
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    res.json({ success: true, preset: result[0] });
  } catch (error) {
    console.error('[Test Presets] PUT error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/test-presets/:presetId
 * Delete a test preset
 */
router.delete('/:presetId', requireDb, async (req, res) => {
  try {
    const { presetId } = req.params;

    const result = await sql`
      DELETE FROM test_presets
      WHERE id = ${presetId}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    res.json({ success: true, deleted: true });
  } catch (error) {
    console.error('[Test Presets] DELETE error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
