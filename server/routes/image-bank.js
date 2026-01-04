/**
 * Image Bank API Routes
 *
 * Manages image bank items stored in database instead of settings JSON.
 * This solves the payload size bloat issue.
 */

import express from 'express';
import * as imageBankService from '../services/image-bank.js';

const router = express.Router();

/**
 * GET /api/image-bank/:workflowId
 * Get images for a workflow with pagination
 * Query params:
 *   - limit: number of images (default 50)
 *   - offset: pagination offset (default 0)
 *   - excludeUrl: 'true' to skip URL column (much smaller response)
 *   - used, archived, avatarTag: filters
 */
router.get('/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { used, archived, avatarTag, limit, offset, excludeUrl } = req.query;

    const options = {};
    if (used !== undefined) options.used = used === 'true';
    if (archived !== undefined) options.archived = archived === 'true';
    if (avatarTag) options.avatarTag = avatarTag;
    if (limit) options.limit = Math.min(parseInt(limit), 100); // Cap at 100
    if (offset) options.offset = parseInt(offset);
    if (excludeUrl === 'true') options.excludeUrl = true;

    const images = await imageBankService.getImageBank(parseInt(workflowId), options);

    // Also get total count for pagination info
    const stats = await imageBankService.getImageBankStats(parseInt(workflowId));

    res.json({
      success: true,
      data: images,
      pagination: {
        limit: options.limit || 50,
        offset: options.offset || 0,
        total: parseInt(stats.total),
        hasMore: (options.offset || 0) + images.length < parseInt(stats.total)
      }
    });
  } catch (error) {
    console.error('[Image Bank] Get error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/image-bank/:workflowId/image/:imageId
 * Get a single image by ID (including URL)
 */
router.get('/:workflowId/image/:imageId', async (req, res) => {
  try {
    const { workflowId, imageId } = req.params;
    const image = await imageBankService.getImageById(parseInt(workflowId), imageId);

    if (!image) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    res.json({ success: true, data: image });
  } catch (error) {
    console.error('[Image Bank] Get single error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/image-bank/:workflowId/batch-get
 * Get multiple images by IDs (for loading URLs on demand)
 */
router.post('/:workflowId/batch-get', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'ids array required' });
    }

    // Limit batch size to prevent huge responses
    const limitedIds = ids.slice(0, 20);
    const images = await imageBankService.getImagesByIds(parseInt(workflowId), limitedIds);

    res.json({ success: true, data: images });
  } catch (error) {
    console.error('[Image Bank] Batch get error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/image-bank/:workflowId/stats
 * Get image bank statistics
 */
router.get('/:workflowId/stats', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const stats = await imageBankService.getImageBankStats(parseInt(workflowId));
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[Image Bank] Stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/image-bank/:workflowId
 * Add image(s) to the bank
 */
router.post('/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { image, images } = req.body;

    let result;
    if (images && Array.isArray(images)) {
      result = await imageBankService.addImagesToBank(parseInt(workflowId), images);
    } else if (image) {
      result = await imageBankService.addImageToBank(parseInt(workflowId), image);
    } else {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Image Bank] Add error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/image-bank/:workflowId/:imageId
 * Update an image in the bank
 */
router.put('/:workflowId/:imageId', async (req, res) => {
  try {
    const { workflowId, imageId } = req.params;
    const updates = req.body;

    const result = await imageBankService.updateImageInBank(
      parseInt(workflowId),
      imageId,
      updates
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Image Bank] Update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/image-bank/:workflowId/:imageId
 * Delete an image from the bank
 */
router.delete('/:workflowId/:imageId', async (req, res) => {
  try {
    const { workflowId, imageId } = req.params;
    await imageBankService.deleteImageFromBank(parseInt(workflowId), imageId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Image Bank] Delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/image-bank/:workflowId/mark-used/:imageId
 * Mark an image as used
 */
router.post('/:workflowId/mark-used/:imageId', async (req, res) => {
  try {
    const { workflowId, imageId } = req.params;
    const { usedOn } = req.body;

    const result = await imageBankService.markImageAsUsed(
      parseInt(workflowId),
      imageId,
      usedOn
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Image Bank] Mark used error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/image-bank/:workflowId/archive/:imageId
 * Archive an image
 */
router.post('/:workflowId/archive/:imageId', async (req, res) => {
  try {
    const { workflowId, imageId } = req.params;
    const result = await imageBankService.archiveImage(parseInt(workflowId), imageId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Image Bank] Archive error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/image-bank/:workflowId/migrate
 * Migrate existing image_bank from settings to new table
 */
router.post('/:workflowId/migrate', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const result = await imageBankService.migrateImageBankFromSettings(parseInt(workflowId));
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Image Bank] Migration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
