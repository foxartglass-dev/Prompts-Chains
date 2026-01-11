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

/**
 * POST /api/image-bank/:workflowId/restore-all-used
 * Restore all used images back to available (set used=false)
 * Use case: Testing mode - recycle images that were marked as used but never went to a live site
 */
router.post('/:workflowId/restore-all-used', async (req, res) => {
  try {
    const { workflowId } = req.params;
    console.log(`[Image Bank] Restoring all used images for workflow ${workflowId}`);

    const result = await imageBankService.restoreAllUsedImages(parseInt(workflowId));

    console.log(`[Image Bank] Restored ${result.restored} images`);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Image Bank] Restore all used error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/image-bank/:workflowId/recycle-from-draft
 * Copy images from Draft Image Bank to regular Image Bank
 * Use case: Testing mode - recycle draft images that were never used on a live site
 *
 * Body options:
 * - statuses: Array of statuses to include (default: ['draft', 'sent'])
 * - deleteAfterRecycle: Boolean - remove from draft bank after copying (default: false)
 */
router.post('/:workflowId/recycle-from-draft', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { statuses, deleteAfterRecycle } = req.body;

    console.log(`[Image Bank] Recycling from draft bank for workflow ${workflowId}`);
    console.log(`[Image Bank] Options: statuses=${JSON.stringify(statuses)}, deleteAfterRecycle=${deleteAfterRecycle}`);

    const result = await imageBankService.recycleFromDraftBank(parseInt(workflowId), {
      statuses: statuses || ['draft', 'sent'],
      deleteAfterRecycle: deleteAfterRecycle || false
    });

    console.log(`[Image Bank] ${result.message}`);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Image Bank] Recycle from draft error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
