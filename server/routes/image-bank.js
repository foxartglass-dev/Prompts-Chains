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
 * Get all images for a workflow
 */
router.get('/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { used, archived, avatarTag, limit } = req.query;

    const options = {};
    if (used !== undefined) options.used = used === 'true';
    if (archived !== undefined) options.archived = archived === 'true';
    if (avatarTag) options.avatarTag = avatarTag;
    if (limit) options.limit = parseInt(limit);

    const images = await imageBankService.getImageBank(parseInt(workflowId), options);
    res.json({ success: true, data: images });
  } catch (error) {
    console.error('[Image Bank] Get error:', error);
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
