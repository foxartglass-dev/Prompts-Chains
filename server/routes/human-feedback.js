/**
 * Human Feedback API Routes
 *
 * Endpoints for the human-in-the-loop feedback system
 */

import express from 'express';
import {
  QUICK_TAGS,
  RATINGS,
  getFeedbackSettings,
  updateFeedbackSettings,
  shouldShowFeedback,
  createFeedbackRequest,
  submitFeedback,
  skipFeedback,
  getPendingFeedback,
  getFeedbackHistory,
  queueQuestion,
  getUnansweredQuestions,
  answerQuestion,
  getFeedbackInsights
} from '../services/human-feedback.js';

const router = express.Router();

// ============================================
// CONSTANTS
// ============================================

/**
 * GET /api/feedback/options
 * Get available quick tags and ratings
 */
router.get('/options', (req, res) => {
  res.json({
    success: true,
    data: {
      quickTags: QUICK_TAGS,
      ratings: RATINGS
    }
  });
});

// ============================================
// SETTINGS
// ============================================

/**
 * GET /api/feedback/settings/:workflowId
 * Get feedback settings for a workflow
 */
router.get('/settings/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const settings = await getFeedbackSettings(parseInt(workflowId));
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('[Feedback] Settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/feedback/settings/:workflowId
 * Update feedback settings
 */
router.put('/settings/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const settings = await updateFeedbackSettings(parseInt(workflowId), req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('[Feedback] Update settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feedback/should-show/:workflowId
 * Check if feedback popup should be shown
 */
router.get('/should-show/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const result = await shouldShowFeedback(parseInt(workflowId));
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Feedback] Should show error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// FEEDBACK REQUESTS
// ============================================

/**
 * POST /api/feedback/request
 * Create a feedback request after image generation
 */
router.post('/request', async (req, res) => {
  try {
    const request = await createFeedbackRequest(req.body);

    // Also get any pending questions to include
    const questions = await getUnansweredQuestions(
      req.body.workflow_id,
      req.body.avatar_id
    );

    res.json({
      success: true,
      data: {
        feedbackRequest: request,
        pendingQuestions: questions
      }
    });
  } catch (error) {
    console.error('[Feedback] Create request error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feedback/pending/:workflowId
 * Get pending feedback requests
 */
router.get('/pending/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const pending = await getPendingFeedback(parseInt(workflowId));

    // Include questions for each pending request
    const pendingWithQuestions = await Promise.all(
      pending.map(async (p) => ({
        ...p,
        pendingQuestions: await getUnansweredQuestions(parseInt(workflowId), p.avatar_id)
      }))
    );

    res.json({ success: true, data: pendingWithQuestions });
  } catch (error) {
    console.error('[Feedback] Pending error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feedback/submit/:id
 * Submit feedback for a request
 */
router.post('/submit/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const feedback = await submitFeedback(parseInt(id), req.body);
    res.json({ success: true, data: feedback });
  } catch (error) {
    console.error('[Feedback] Submit error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feedback/skip/:id
 * Skip feedback for a request
 */
router.post('/skip/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const feedback = await skipFeedback(parseInt(id));
    res.json({ success: true, data: feedback });
  } catch (error) {
    console.error('[Feedback] Skip error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feedback/history/:workflowId
 * Get feedback history
 */
router.get('/history/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { limit } = req.query;
    const history = await getFeedbackHistory(
      parseInt(workflowId),
      limit ? parseInt(limit) : 50
    );
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('[Feedback] History error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AI QUESTIONS
// ============================================

/**
 * POST /api/feedback/question
 * Queue a question for the human
 */
router.post('/question', async (req, res) => {
  try {
    const question = await queueQuestion(req.body);
    res.json({ success: true, data: question });
  } catch (error) {
    console.error('[Feedback] Queue question error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feedback/questions/:workflowId
 * Get unanswered questions
 */
router.get('/questions/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { avatarId } = req.query;
    const questions = await getUnansweredQuestions(
      parseInt(workflowId),
      avatarId ? parseInt(avatarId) : null
    );
    res.json({ success: true, data: questions });
  } catch (error) {
    console.error('[Feedback] Questions error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feedback/questions/:id/answer
 * Answer a question
 */
router.post('/questions/:id/answer', async (req, res) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;
    const question = await answerQuestion(parseInt(id), answer);
    res.json({ success: true, data: question });
  } catch (error) {
    console.error('[Feedback] Answer error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// INSIGHTS
// ============================================

/**
 * GET /api/feedback/insights/:workflowId
 * Get aggregated feedback insights
 */
router.get('/insights/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { avatarId } = req.query;
    const insights = await getFeedbackInsights(
      parseInt(workflowId),
      avatarId ? parseInt(avatarId) : null
    );
    res.json({ success: true, data: insights });
  } catch (error) {
    console.error('[Feedback] Insights error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
