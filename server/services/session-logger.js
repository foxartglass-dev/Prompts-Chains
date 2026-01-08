/**
 * Session Logger Service
 *
 * Captures and stores logs per publishing session/run.
 * Logs are kept in memory and can be retrieved via API.
 * Designed for debugging image generation and WordPress publishing issues.
 */

// In-memory storage for session logs
const sessionLogs = new Map();

// Maximum number of sessions to keep
const MAX_SESSIONS = 10;

// Maximum logs per session
const MAX_LOGS_PER_SESSION = 500;

// Current active session ID
let currentSessionId = null;

/**
 * Log entry structure
 */
class LogEntry {
  constructor(level, category, message, data = null) {
    this.timestamp = new Date().toISOString();
    this.level = level; // 'info', 'success', 'warn', 'error', 'debug'
    this.category = category; // 'IMAGE', 'WP', 'PIPELINE', 'BANK', 'SAVE', etc.
    this.message = message;
    this.data = data;
  }
}

/**
 * Session structure
 */
class Session {
  constructor(id) {
    this.id = id;
    this.startTime = new Date().toISOString();
    this.endTime = null;
    this.logs = [];
    this.summary = {
      articlesProcessed: 0,
      imagesGenerated: 0,
      imagesFromBank: 0,
      errors: 0,
      wpUploads: 0
    };
  }
}

/**
 * Start a new logging session
 */
export function startSession(keyword = null) {
  const sessionId = `session-${Date.now()}`;
  const session = new Session(sessionId);
  session.keyword = keyword;

  sessionLogs.set(sessionId, session);
  currentSessionId = sessionId;

  // Cleanup old sessions if we exceed the limit
  if (sessionLogs.size > MAX_SESSIONS) {
    const oldestKey = sessionLogs.keys().next().value;
    sessionLogs.delete(oldestKey);
  }

  log('info', 'SESSION', `Started new session: ${sessionId}`, { keyword });

  return sessionId;
}

/**
 * End the current session
 */
export function endSession(sessionId = null) {
  const sid = sessionId || currentSessionId;
  if (!sid) return;

  const session = sessionLogs.get(sid);
  if (session) {
    session.endTime = new Date().toISOString();
    log('info', 'SESSION', `Session ended: ${sid}`, { summary: session.summary });
  }

  if (sid === currentSessionId) {
    currentSessionId = null;
  }
}

/**
 * Log a message to the current session
 */
export function log(level, category, message, data = null) {
  const session = currentSessionId ? sessionLogs.get(currentSessionId) : null;

  const entry = new LogEntry(level, category, message, data);

  // Also log to console for Railway
  const prefix = `[${category}]`;
  const consoleMsg = `${prefix} ${message}`;

  switch (level) {
    case 'error':
      console.error(consoleMsg, data || '');
      break;
    case 'warn':
      console.warn(consoleMsg, data || '');
      break;
    case 'success':
      console.log(`✓ ${consoleMsg}`, data || '');
      break;
    case 'debug':
      if (process.env.DEBUG_LOGS === 'true') {
        console.log(`[DEBUG] ${consoleMsg}`, data || '');
      }
      break;
    default:
      console.log(consoleMsg, data || '');
  }

  // Add to session if active
  if (session) {
    session.logs.push(entry);

    // Trim logs if exceeding limit
    if (session.logs.length > MAX_LOGS_PER_SESSION) {
      session.logs.shift();
    }

    // Update summary counters based on category/level
    if (level === 'error') {
      session.summary.errors++;
    }
  }

  return entry;
}

// Convenience methods
export const logInfo = (category, message, data) => log('info', category, message, data);
export const logSuccess = (category, message, data) => log('success', category, message, data);
export const logWarn = (category, message, data) => log('warn', category, message, data);
export const logError = (category, message, data) => log('error', category, message, data);
export const logDebug = (category, message, data) => log('debug', category, message, data);

/**
 * Update session summary
 */
export function updateSummary(updates) {
  const session = currentSessionId ? sessionLogs.get(currentSessionId) : null;
  if (session) {
    Object.assign(session.summary, updates);
  }
}

/**
 * Get logs for a specific session
 */
export function getSessionLogs(sessionId) {
  return sessionLogs.get(sessionId) || null;
}

/**
 * Get the most recent N sessions
 */
export function getRecentSessions(count = 3) {
  const sessions = Array.from(sessionLogs.values());
  return sessions.slice(-count).reverse(); // Most recent first
}

/**
 * Get all sessions
 */
export function getAllSessions() {
  return Array.from(sessionLogs.values()).reverse();
}

/**
 * Get current session ID
 */
export function getCurrentSessionId() {
  return currentSessionId;
}

/**
 * Clear all sessions (for testing)
 */
export function clearAllSessions() {
  sessionLogs.clear();
  currentSessionId = null;
}

/**
 * Format logs for display/copy
 */
export function formatLogsForCopy(sessionId, options = {}) {
  const session = sessionLogs.get(sessionId);
  if (!session) return 'Session not found';

  const { includeTimestamp = true, includeData = false, filterLevel = null, filterCategory = null } = options;

  let logs = session.logs;

  // Apply filters
  if (filterLevel) {
    logs = logs.filter(l => l.level === filterLevel);
  }
  if (filterCategory) {
    logs = logs.filter(l => l.category === filterCategory);
  }

  const lines = [
    `=== Session: ${session.id} ===`,
    `Started: ${session.startTime}`,
    `Ended: ${session.endTime || 'In Progress'}`,
    `Keyword: ${session.keyword || 'N/A'}`,
    `Summary: ${JSON.stringify(session.summary)}`,
    ``,
    `--- Logs (${logs.length}) ---`,
    ``
  ];

  for (const entry of logs) {
    let line = '';
    if (includeTimestamp) {
      line += `[${entry.timestamp.substring(11, 23)}] `;
    }
    line += `[${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}`;
    if (includeData && entry.data) {
      line += ` | ${JSON.stringify(entry.data)}`;
    }
    lines.push(line);
  }

  return lines.join('\n');
}

export default {
  startSession,
  endSession,
  log,
  logInfo,
  logSuccess,
  logWarn,
  logError,
  logDebug,
  updateSummary,
  getSessionLogs,
  getRecentSessions,
  getAllSessions,
  getCurrentSessionId,
  clearAllSessions,
  formatLogsForCopy
};
