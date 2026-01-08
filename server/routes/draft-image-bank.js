/**
 * Draft Image Bank API Routes
 *
 * Manages in-transit images for pages before they're sent to client website.
 * Separate from main Image Bank - these are page-specific draft images.
 */

import express from 'express';
import * as draftBankService from '../services/draft-image-bank.js';

const router = express.Router();

/**
 * GET /api/draft-image-bank/:workflowId
 * Get all draft images for a workflow with optional filters
 */
router.get('/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { status, articleId, itemType, itemCategory, avatarTag, pageKeyword, limit } = req.query;

    const options = {};
    if (status) options.status = status;
    if (articleId) options.articleId = parseInt(articleId);
    if (itemType) options.itemType = itemType;
    if (itemCategory) options.itemCategory = itemCategory;
    if (avatarTag) options.avatarTag = avatarTag;
    if (pageKeyword) options.pageKeyword = pageKeyword;
    if (limit) options.limit = parseInt(limit);

    const images = await draftBankService.getDraftImageBank(parseInt(workflowId), options);
    res.json({ success: true, data: images });
  } catch (error) {
    console.error('[Draft Image Bank] Get error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/draft-image-bank/:workflowId/by-page
 * Get draft images grouped by page
 */
router.get('/:workflowId/by-page', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { status } = req.query;

    const pages = await draftBankService.getDraftImagesByPage(parseInt(workflowId), status || null);
    res.json({ success: true, data: pages });
  } catch (error) {
    console.error('[Draft Image Bank] By page error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/draft-image-bank/:workflowId/stats
 * Get draft bank statistics and counters
 */
router.get('/:workflowId/stats', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const stats = await draftBankService.getDraftBankStats(parseInt(workflowId));
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[Draft Image Bank] Stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/draft-image-bank/:workflowId/item-types
 * Get unique item types for filtering
 */
router.get('/:workflowId/item-types', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const types = await draftBankService.getItemTypes(parseInt(workflowId));
    res.json({ success: true, data: types });
  } catch (error) {
    console.error('[Draft Image Bank] Item types error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/draft-image-bank/:workflowId/item-categories
 * Get unique item categories for filtering
 */
router.get('/:workflowId/item-categories', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const categories = await draftBankService.getItemCategories(parseInt(workflowId));
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('[Draft Image Bank] Categories error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/draft-image-bank/:workflowId
 * Add image(s) to the draft bank
 */
router.post('/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { image, images } = req.body;

    let result;
    if (images && Array.isArray(images)) {
      result = await draftBankService.addBatchToDraftBank(parseInt(workflowId), images);
    } else if (image) {
      result = await draftBankService.addToDraftBank(parseInt(workflowId), image);
    } else {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Draft Image Bank] Add error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/draft-image-bank/:workflowId/replace/:imageId
 * Replace an existing draft image with a new one
 */
router.post('/:workflowId/replace/:imageId', async (req, res) => {
  try {
    const { workflowId, imageId } = req.params;
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, error: 'No replacement image provided' });
    }

    const result = await draftBankService.replaceDraftImage(
      parseInt(workflowId),
      parseInt(imageId),
      image
    );

    if (!result) {
      return res.status(500).json({ success: false, error: 'Failed to replace image' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Draft Image Bank] Replace error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/draft-image-bank/:workflowId/mark-sent/:imageId
 * Mark a single draft image as sent
 */
router.post('/:workflowId/mark-sent/:imageId', async (req, res) => {
  try {
    const { workflowId, imageId } = req.params;

    const result = await draftBankService.markAsSent(parseInt(workflowId), parseInt(imageId));

    if (!result) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Draft Image Bank] Mark sent error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/draft-image-bank/:workflowId/mark-sent-batch
 * Mark multiple draft images as sent
 */
router.post('/:workflowId/mark-sent-batch', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { imageIds } = req.body;

    if (!imageIds || !Array.isArray(imageIds)) {
      return res.status(400).json({ success: false, error: 'No image IDs provided' });
    }

    const results = await draftBankService.markBatchAsSent(parseInt(workflowId), imageIds);
    res.json({ success: true, data: results, count: results.length });
  } catch (error) {
    console.error('[Draft Image Bank] Batch mark sent error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/draft-image-bank/:workflowId/:imageId
 * Delete a draft image (mainly for 'replaced' cleanup)
 */
router.delete('/:workflowId/:imageId', async (req, res) => {
  try {
    const { workflowId, imageId } = req.params;
    await draftBankService.deleteDraftImage(parseInt(workflowId), parseInt(imageId));
    res.json({ success: true });
  } catch (error) {
    console.error('[Draft Image Bank] Delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/draft-image-bank/:workflowId/cleanup
 * Clean up old replaced images
 */
router.post('/:workflowId/cleanup', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { keepDays } = req.body;

    const result = await draftBankService.cleanupReplacedImages(
      parseInt(workflowId),
      keepDays || 30
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Draft Image Bank] Cleanup error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
