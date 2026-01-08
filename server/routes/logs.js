/**
 * Logs API Routes
 *
 * Provides endpoints for retrieving ALL console output - same as Railway logs.
 */

import express from 'express';
import consoleCapture from '../services/console-capture.js';

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

export default router;
