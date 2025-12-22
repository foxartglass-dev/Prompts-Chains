/**
 * Image Versions API Routes
 * Tracks image replacement history for articles
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

/**
 * GET /api/image-versions/:articleId
 * Get all image versions for an article
 */
router.get('/:articleId', requireDb, async (req, res) => {
  try {
    const versions = await sql`
      SELECT * FROM image_versions
      WHERE article_id = ${req.params.articleId}
      ORDER BY elementor_widget_id, version DESC
    `;

    // Group by widget ID for easier consumption
    const grouped = {};
    versions.forEach(v => {
      if (!grouped[v.elementor_widget_id]) {
        grouped[v.elementor_widget_id] = [];
      }
      grouped[v.elementor_widget_id].push(v);
    });

    res.json({ versions, grouped });
  } catch (error) {
    console.error('Error getting image versions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/image-versions/:articleId/widget/:widgetId
 * Get version history for a specific widget
 */
router.get('/:articleId/widget/:widgetId', requireDb, async (req, res) => {
  try {
    const versions = await sql`
      SELECT * FROM image_versions
      WHERE article_id = ${req.params.articleId}
        AND elementor_widget_id = ${req.params.widgetId}
      ORDER BY version DESC
    `;

    res.json({
      widgetId: req.params.widgetId,
      versions,
      currentVersion: versions.length > 0 ? versions[0] : null
    });
  } catch (error) {
    console.error('Error getting widget versions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/image-versions
 * Create new image version (when replacing an image)
 */
router.post('/', requireDb, async (req, res) => {
  try {
    const { articleId, elementorWidgetId, imageUrl, wpMediaId, imagePrompt, source } = req.body;

    if (!articleId || !elementorWidgetId || !imageUrl) {
      return res.status(400).json({
        error: 'articleId, elementorWidgetId, and imageUrl are required'
      });
    }

    // Get current max version for this widget
    const maxVersion = await sql`
      SELECT COALESCE(MAX(version), 0) as max_version
      FROM image_versions
      WHERE article_id = ${articleId} AND elementor_widget_id = ${elementorWidgetId}
    `;

    const newVersion = maxVersion[0].max_version + 1;

    const result = await sql`
      INSERT INTO image_versions (
        article_id, elementor_widget_id, version, image_url, wp_media_id, image_prompt, replacement_source
      ) VALUES (
        ${articleId},
        ${elementorWidgetId},
        ${newVersion},
        ${imageUrl},
        ${wpMediaId || null},
        ${imagePrompt || null},
        ${source || 'upload'}
      )
      RETURNING *
    `;

    res.status(201).json({
      success: true,
      version: result[0]
    });
  } catch (error) {
    console.error('Error creating image version:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/image-versions/by-website/:websiteId
 * Get all image versions for all articles in a website
 */
router.get('/by-website/:websiteId', requireDb, async (req, res) => {
  try {
    const versions = await sql`
      SELECT iv.*, a.keyword as article_keyword, a.wp_post_url
      FROM image_versions iv
      JOIN articles a ON iv.article_id = a.id
      WHERE a.website_id = ${req.params.websiteId}
      ORDER BY iv.created_at DESC
    `;

    res.json({ versions });
  } catch (error) {
    console.error('Error getting website image versions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/image-versions/:id
 * Delete a specific image version (rollback capability)
 */
router.delete('/:id', requireDb, async (req, res) => {
  try {
    const result = await sql`
      DELETE FROM image_versions
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Image version not found' });
    }

    res.json({ success: true, deleted: result[0] });
  } catch (error) {
    console.error('Error deleting image version:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
