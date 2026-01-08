/**
 * Console Capture Service
 *
 * Intercepts ALL console.log/error/warn output and stores it for retrieval.
 * This gives you the EXACT same logs as Railway, accessible in the app.
 */

// Store captured logs
const capturedLogs = [];
const MAX_LOGS = 2000; // Keep last 2000 lines

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console)
};

// Format arguments to string (like console does)
function formatArgs(args) {
  return args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
}

// Capture and store log
function captureLog(level, args) {
  const timestamp = new Date().toISOString();
  const message = formatArgs(args);

  capturedLogs.push({
    timestamp,
    level,
    message
  });

  // Trim if too many
  if (capturedLogs.length > MAX_LOGS) {
    capturedLogs.shift();
  }
}

// Override console methods
console.log = (...args) => {
  captureLog('log', args);
  originalConsole.log(...args);
};

console.error = (...args) => {
  captureLog('error', args);
  originalConsole.error(...args);
};

console.warn = (...args) => {
  captureLog('warn', args);
  originalConsole.warn(...args);
};

console.info = (...args) => {
  captureLog('info', args);
  originalConsole.info(...args);
};

/**
 * Get all captured logs
 */
export function getAllLogs() {
  return [...capturedLogs];
}

/**
 * Get logs since a timestamp
 */
export function getLogsSince(timestamp) {
  return capturedLogs.filter(log => log.timestamp > timestamp);
}

/**
 * Get last N logs
 */
export function getLastLogs(count = 500) {
  return capturedLogs.slice(-count);
}

/**
 * Clear all logs
 */
export function clearLogs() {
  capturedLogs.length = 0;
}

/**
 * Format logs for copying (plain text)
 */
export function formatLogsForCopy(logs = capturedLogs) {
  return logs.map(log => {
    const time = log.timestamp.substring(11, 23); // HH:MM:SS.mmm
    const level = log.level.toUpperCase().padEnd(5);
    return `[${time}] ${level} ${log.message}`;
  }).join('\n');
}

/**
 * Get log count
 */
export function getLogCount() {
  return capturedLogs.length;
}

export default {
  getAllLogs,
  getLogsSince,
  getLastLogs,
  clearLogs,
  formatLogsForCopy,
  getLogCount
};
