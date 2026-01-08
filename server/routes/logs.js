/**
 * Logs API Routes
 *
 * Provides endpoints for retrieving ALL console output - same as Railway logs.
 * Also supports pushing logs to GitHub for Claude to access directly.
 */

import express from 'express';
import consoleCapture from '../services/console-capture.js';
import githubLogger from '../services/github-logger.js';

const router = express.Router();

/**
 * GET /api/logs/console
 * Get captured console logs (same as Railway)
 */
router.get('/console', (req, res) => {
  const { count = 500, since } = req.query;

  let logs;
  if (since) {
    logs = consoleCapture.getLogsSince(since);
  } else {
    logs = consoleCapture.getLastLogs(parseInt(count));
  }

  res.json({
    success: true,
    count: logs.length,
    total: consoleCapture.getLogCount(),
    logs
  });
});

/**
 * GET /api/logs/console/copy
 * Get formatted logs for copying (plain text - same as Railway)
 */
router.get('/console/copy', (req, res) => {
  const { count = 500 } = req.query;
  const logs = consoleCapture.getLastLogs(parseInt(count));
  const formatted = consoleCapture.formatLogsForCopy(logs);
  res.type('text/plain').send(formatted);
});

/**
 * DELETE /api/logs/console
 * Clear all captured logs
 */
router.delete('/console', (req, res) => {
  consoleCapture.clearLogs();
  res.json({ success: true, message: 'Logs cleared' });
});

/**
 * GET /api/logs/console/count
 * Get total log count
 */
router.get('/console/count', (req, res) => {
  res.json({ count: consoleCapture.getLogCount() });
});

// ═══════════════════════════════════════════════════════════════
// GitHub Logging Endpoints
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/logs/github/push
 * Push current logs to GitHub repository
 */
router.post('/github/push', async (req, res) => {
  const { context = 'manual' } = req.body;

  if (!githubLogger.isConfigured()) {
    return res.status(400).json({
      success: false,
      error: 'GitHub logging not configured. Set GITHUB_TOKEN environment variable.'
    });
  }

  const result = await githubLogger.pushLogsToGitHub(context);
  res.json(result);
});

/**
 * GET /api/logs/github/status
 * Check GitHub logging configuration status
 */
router.get('/github/status', (req, res) => {
  res.json(githubLogger.getStatus());
});

export default router;
