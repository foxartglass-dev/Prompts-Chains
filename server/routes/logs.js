/**
 * Logs API Routes
 *
 * Provides endpoints for retrieving session logs for in-app debugging.
 */

import express from 'express';
import logger from '../services/session-logger.js';

const router = express.Router();

/**
 * GET /api/logs/sessions
 * Get list of recent sessions
 */
router.get('/sessions', (req, res) => {
  const { count = 5 } = req.query;
  const sessions = logger.getRecentSessions(parseInt(count));

  // Return session metadata without full logs
  const sessionList = sessions.map(s => ({
    id: s.id,
    startTime: s.startTime,
    endTime: s.endTime,
    keyword: s.keyword,
    logCount: s.logs.length,
    summary: s.summary
  }));

  res.json({ success: true, sessions: sessionList });
});

/**
 * GET /api/logs/session/:sessionId
 * Get full logs for a specific session
 */
router.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const { filterLevel, filterCategory } = req.query;

  const session = logger.getSessionLogs(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  let logs = session.logs;

  // Apply filters
  if (filterLevel) {
    logs = logs.filter(l => l.level === filterLevel);
  }
  if (filterCategory) {
    logs = logs.filter(l => l.category === filterCategory);
  }

  res.json({
    success: true,
    session: {
      id: session.id,
      startTime: session.startTime,
      endTime: session.endTime,
      keyword: session.keyword,
      summary: session.summary,
      logs
    }
  });
});

/**
 * GET /api/logs/session/:sessionId/copy
 * Get formatted logs for copying to clipboard
 */
router.get('/session/:sessionId/copy', (req, res) => {
  const { sessionId } = req.params;
  const { includeTimestamp = 'true', includeData = 'false', filterLevel, filterCategory } = req.query;

  const formatted = logger.formatLogsForCopy(sessionId, {
    includeTimestamp: includeTimestamp === 'true',
    includeData: includeData === 'true',
    filterLevel,
    filterCategory
  });

  res.type('text/plain').send(formatted);
});

/**
 * GET /api/logs/current
 * Get current active session (if any)
 */
router.get('/current', (req, res) => {
  const sessionId = logger.getCurrentSessionId();

  if (!sessionId) {
    return res.json({ success: true, active: false, session: null });
  }

  const session = logger.getSessionLogs(sessionId);
  res.json({
    success: true,
    active: true,
    session: {
      id: session.id,
      startTime: session.startTime,
      keyword: session.keyword,
      logCount: session.logs.length,
      summary: session.summary,
      // Return last 50 logs for real-time view
      recentLogs: session.logs.slice(-50)
    }
  });
});

/**
 * DELETE /api/logs/sessions
 * Clear all session logs
 */
router.delete('/sessions', (req, res) => {
  logger.clearAllSessions();
  res.json({ success: true, message: 'All sessions cleared' });
});

export default router;
