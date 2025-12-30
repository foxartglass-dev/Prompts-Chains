/**
 * Prompt Engineering API Routes
 *
 * Endpoints for managing the AI Prompt Engineering system
 */

import express from 'express';
import {
  getPlaybook,
  addPlaybookEntry,
  getTricks,
  addTrick,
  recordTrickUsage,
  getReferencePhotos,
  addReferencePhoto,
  getResearch,
  saveResearch,
  recordGeneration,
  getGenerationHistory,
  createHandoff,
  getLatestHandoff,
  getAllHandoffs,
  getAgentOnboardingContext
} from '../services/prompt-engineering.js';

const router = express.Router();

// ============================================
// AGENT ONBOARDING - Full Context Load
// ============================================

/**
 * GET /api/prompt-engineering/onboard/:workflowId
 * Get everything a new agent needs to become an expert
 */
router.get('/onboard/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { avatarId } = req.query;

    const context = await getAgentOnboardingContext(
      parseInt(workflowId),
      avatarId ? parseInt(avatarId) : null
    );

    res.json({
      success: true,
      message: 'Agent onboarding context loaded',
      data: context
    });
  } catch (error) {
    console.error('[Prompt Engineering] Onboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PLAYBOOK
// ============================================

/**
 * GET /api/prompt-engineering/playbook
 * Get the full playbook
 */
router.get('/playbook', async (req, res) => {
  try {
    const { category } = req.query;
    const playbook = await getPlaybook(category || null);
    res.json({ success: true, data: playbook });
  } catch (error) {
    console.error('[Prompt Engineering] Playbook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prompt-engineering/playbook
 * Add a new playbook entry
 */
router.post('/playbook', async (req, res) => {
  try {
    const entry = await addPlaybookEntry(req.body);
    res.json({ success: true, data: entry });
  } catch (error) {
    console.error('[Prompt Engineering] Add playbook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TRICKS
// ============================================

/**
 * GET /api/prompt-engineering/tricks
 * Get all prompt tricks
 */
router.get('/tricks', async (req, res) => {
  try {
    const { tags, avatarId } = req.query;
    const tricks = await getTricks(
      tags ? tags.split(',') : null,
      avatarId ? parseInt(avatarId) : null
    );
    res.json({ success: true, data: tricks });
  } catch (error) {
    console.error('[Prompt Engineering] Tricks error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prompt-engineering/tricks
 * Add a new trick
 */
router.post('/tricks', async (req, res) => {
  try {
    const trick = await addTrick(req.body);
    res.json({ success: true, data: trick });
  } catch (error) {
    console.error('[Prompt Engineering] Add trick error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prompt-engineering/tricks/:id/usage
 * Record that a trick was used
 */
router.post('/tricks/:id/usage', async (req, res) => {
  try {
    const { id } = req.params;
    const { success } = req.body;
    const trick = await recordTrickUsage(parseInt(id), success !== false);
    res.json({ success: true, data: trick });
  } catch (error) {
    console.error('[Prompt Engineering] Record usage error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// REFERENCE PHOTOS
// ============================================

/**
 * GET /api/prompt-engineering/photos/:workflowId/:avatarId
 * Get reference photos for an avatar
 */
router.get('/photos/:workflowId/:avatarId', async (req, res) => {
  try {
    const { workflowId, avatarId } = req.params;
    const photos = await getReferencePhotos(parseInt(avatarId), parseInt(workflowId));
    res.json({ success: true, data: photos });
  } catch (error) {
    console.error('[Prompt Engineering] Photos error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prompt-engineering/photos
 * Add a reference photo
 */
router.post('/photos', async (req, res) => {
  try {
    const photo = await addReferencePhoto(req.body);
    res.json({ success: true, data: photo });
  } catch (error) {
    console.error('[Prompt Engineering] Add photo error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RESEARCH
// ============================================

/**
 * GET /api/prompt-engineering/research/:workflowId/:avatarId
 * Get research findings
 */
router.get('/research/:workflowId/:avatarId', async (req, res) => {
  try {
    const { workflowId, avatarId } = req.params;
    const research = await getResearch(parseInt(avatarId), parseInt(workflowId));
    res.json({ success: true, data: research });
  } catch (error) {
    console.error('[Prompt Engineering] Research error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prompt-engineering/research
 * Save research findings
 */
router.post('/research', async (req, res) => {
  try {
    const research = await saveResearch(req.body);
    res.json({ success: true, data: research });
  } catch (error) {
    console.error('[Prompt Engineering] Save research error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GENERATION HISTORY
// ============================================

/**
 * GET /api/prompt-engineering/history/:workflowId
 * Get generation history
 */
router.get('/history/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { avatarId, limit } = req.query;
    const history = await getGenerationHistory(
      parseInt(workflowId),
      avatarId ? parseInt(avatarId) : null,
      limit ? parseInt(limit) : 50
    );
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('[Prompt Engineering] History error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prompt-engineering/history
 * Record a generation with critique
 */
router.post('/history', async (req, res) => {
  try {
    const record = await recordGeneration(req.body);
    res.json({ success: true, data: record });
  } catch (error) {
    console.error('[Prompt Engineering] Record generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HANDOFFS
// ============================================

/**
 * GET /api/prompt-engineering/handoff/:workflowId
 * Get the latest handoff document
 */
router.get('/handoff/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { avatarId } = req.query;
    const handoff = await getLatestHandoff(
      parseInt(workflowId),
      avatarId ? parseInt(avatarId) : null
    );
    res.json({ success: true, data: handoff });
  } catch (error) {
    console.error('[Prompt Engineering] Handoff error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/prompt-engineering/handoffs/:workflowId
 * Get all handoffs for a workflow
 */
router.get('/handoffs/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const handoffs = await getAllHandoffs(parseInt(workflowId));
    res.json({ success: true, data: handoffs });
  } catch (error) {
    console.error('[Prompt Engineering] Handoffs error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prompt-engineering/handoff
 * Create a handoff document
 */
router.post('/handoff', async (req, res) => {
  try {
    const handoff = await createHandoff(req.body);
    res.json({ success: true, data: handoff });
  } catch (error) {
    console.error('[Prompt Engineering] Create handoff error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
