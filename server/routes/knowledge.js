/**
 * Course Engine / Knowledge System API Routes
 * Upload, view, and manage training JSON files
 */

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

// ============================================
// KNOWLEDGE FILE ENDPOINTS
// ============================================

/**
 * GET /api/knowledge/files
 * List all uploaded knowledge files
 */
router.get('/files', requireDb, async (req, res) => {
  try {
    const files = await sql`
      SELECT id, name, filename, file_type, description, item_count, created_at, updated_at
      FROM stylelock_knowledge
      ORDER BY created_at DESC
    `;

    res.json({
      success: true,
      files,
      count: files.length
    });
  } catch (error) {
    console.error('List knowledge files error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/knowledge/files/:id
 * Get a single knowledge file with content
 */
router.get('/files/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    const files = await sql`
      SELECT * FROM stylelock_knowledge WHERE id = ${id}
    `;

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      success: true,
      file: files[0]
    });
  } catch (error) {
    console.error('Get knowledge file error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/knowledge/upload
 * Upload a JSON knowledge file
 */
router.post('/upload', requireDb, async (req, res) => {
  try {
    const { name, filename, fileType, content, description } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }

    // Parse content if it's a string
    let parsedContent = content;
    if (typeof content === 'string') {
      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON content' });
      }
    }

    // Count items in the content
    let itemCount = 0;
    if (Array.isArray(parsedContent)) {
      itemCount = parsedContent.length;
    } else if (typeof parsedContent === 'object') {
      itemCount = Object.keys(parsedContent).length;
    }

    const result = await sql`
      INSERT INTO stylelock_knowledge (name, filename, file_type, content, description, item_count)
      VALUES (${name}, ${filename || name + '.json'}, ${fileType || 'training'}, ${JSON.stringify(parsedContent)}, ${description || ''}, ${itemCount})
      RETURNING id, name, filename, file_type, item_count, created_at
    `;

    res.json({
      success: true,
      file: result[0],
      message: `Uploaded ${itemCount} items`
    });
  } catch (error) {
    console.error('Upload knowledge file error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/knowledge/files/:id
 * Delete a knowledge file
 */
router.delete('/files/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    await sql`DELETE FROM stylelock_knowledge WHERE id = ${id}`;

    res.json({ success: true });
  } catch (error) {
    console.error('Delete knowledge file error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/knowledge/combined
 * Get all knowledge content combined for feeding to AI
 */
router.get('/combined', requireDb, async (req, res) => {
  try {
    const files = await sql`
      SELECT content FROM stylelock_knowledge WHERE file_type = 'training'
    `;

    // Combine all content
    let combined = [];
    for (const file of files) {
      if (Array.isArray(file.content)) {
        combined = combined.concat(file.content);
      }
    }

    res.json({
      success: true,
      knowledge: combined,
      itemCount: combined.length
    });
  } catch (error) {
    console.error('Get combined knowledge error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EDITABLE PROMPTS ENDPOINTS
// ============================================

/**
 * GET /api/knowledge/prompts
 * Get all editable prompts
 */
router.get('/prompts', requireDb, async (req, res) => {
  try {
    const prompts = await sql`
      SELECT id, prompt_type, name, description, prompt_text, is_active, updated_at
      FROM stylelock_prompts
      ORDER BY prompt_type
    `;

    res.json({
      success: true,
      prompts
    });
  } catch (error) {
    console.error('Get prompts error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/knowledge/prompts/:type
 * Get a specific prompt by type
 */
router.get('/prompts/:type', requireDb, async (req, res) => {
  try {
    const { type } = req.params;

    const prompts = await sql`
      SELECT * FROM stylelock_prompts WHERE prompt_type = ${type}
    `;

    if (prompts.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json({
      success: true,
      prompt: prompts[0]
    });
  } catch (error) {
    console.error('Get prompt error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/knowledge/prompts/:type
 * Update a prompt
 */
router.put('/prompts/:type', requireDb, async (req, res) => {
  try {
    const { type } = req.params;
    const { promptText, name, description } = req.body;

    if (!promptText) {
      return res.status(400).json({ error: 'promptText is required' });
    }

    const result = await sql`
      UPDATE stylelock_prompts
      SET prompt_text = ${promptText},
          name = COALESCE(${name}, name),
          description = COALESCE(${description}, description),
          updated_at = CURRENT_TIMESTAMP
      WHERE prompt_type = ${type}
      RETURNING *
    `;

    if (result.length === 0) {
      // Insert if doesn't exist
      const inserted = await sql`
        INSERT INTO stylelock_prompts (prompt_type, name, description, prompt_text)
        VALUES (${type}, ${name || type}, ${description || ''}, ${promptText})
        RETURNING *
      `;
      return res.json({ success: true, prompt: inserted[0] });
    }

    res.json({
      success: true,
      prompt: result[0]
    });
  } catch (error) {
    console.error('Update prompt error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUND LOGS ENDPOINTS
// ============================================

/**
 * GET /api/knowledge/logs/:jobId
 * Get detailed logs for a job including all images
 */
router.get('/logs/:jobId', requireDb, async (req, res) => {
  try {
    const { jobId } = req.params;

    // Get round images
    const images = await sql`
      SELECT * FROM stylelock_round_images
      WHERE job_id = ${jobId}
      ORDER BY round_num, generator_index
    `;

    // Get event logs
    const logs = await sql`
      SELECT * FROM stylelock_round_logs
      WHERE job_id = ${jobId}
      ORDER BY timestamp
    `;

    // Group images by round
    const rounds = {};
    for (const img of images) {
      if (!rounds[img.round_num]) {
        rounds[img.round_num] = { images: [], logs: [] };
      }
      rounds[img.round_num].images.push(img);
    }

    // Add logs to rounds
    for (const log of logs) {
      if (rounds[log.round_num]) {
        rounds[log.round_num].logs.push(log);
      }
    }

    res.json({
      success: true,
      jobId,
      rounds,
      totalImages: images.length,
      totalLogs: logs.length
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/knowledge/jobs
 * Get list of jobs with logs
 */
router.get('/jobs', requireDb, async (req, res) => {
  try {
    const jobs = await sql`
      SELECT DISTINCT job_id, MIN(timestamp) as started_at, MAX(timestamp) as ended_at,
             COUNT(DISTINCT round_num) as round_count
      FROM stylelock_round_logs
      GROUP BY job_id
      ORDER BY started_at DESC
      LIMIT 50
    `;

    res.json({
      success: true,
      jobs
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
