/**
 * LogViewer Component
 *
 * Shows the EXACT same logs as Railway - all console output.
 * One-click copy for easy sharing.
 */

import { useState, useEffect, useCallback } from 'react';

interface LogEntry {
  timestamp: string;
  level: 'log' | 'error' | 'warn' | 'info';
  message: string;
}

interface LogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LogViewer({ isOpen, onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [filterText, setFilterText] = useState('');

  // Fetch logs from server
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/logs/console?count=1000');
      const data = await response.json();
      if (data.success) {
        setLogs(data.logs);
        setTotalCount(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Copy ALL logs to clipboard (formatted for easy reading)
  const copyLogs = async () => {
    try {
      const response = await fetch('/api/logs/console/copy?count=2000');
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy logs:', error);
    }
  };

  // Clear logs
  const clearLogs = async () => {
    if (!confirm('Clear all captured logs?')) return;
    try {
      await fetch('/api/logs/console', { method: 'DELETE' });
      setLogs([]);
      setTotalCount(0);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  // Auto-refresh when open
  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // Auto-refresh interval
  useEffect(() => {
    if (!isOpen || !autoRefresh) return;
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, fetchLogs]);

  if (!isOpen) return null;

  // Filter logs
  let filteredLogs = logs;
  if (filterLevel) {
    filteredLogs = filteredLogs.filter(log => log.level === filterLevel);
  }
  if (filterText) {
    const searchLower = filterText.toLowerCase();
    filteredLogs = filteredLogs.filter(log =>
      log.message.toLowerCase().includes(searchLower)
    );
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400 bg-red-900/20';
      case 'warn': return 'text-yellow-400 bg-yellow-900/20';
      case 'info': return 'text-blue-400';
      default: return 'text-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-start p-4">
      <div className="bg-slate-900 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col ml-4 mt-4 border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800 rounded-t-lg">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Server Logs</h2>
            <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
              {filteredLogs.length} / {totalCount} lines
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-700 bg-slate-800/50">
          {/* Filter by level */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-slate-700 text-white text-sm rounded px-2 py-1.5 border border-slate-600"
          >
            <option value="">All Levels</option>
            <option value="log">Log</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>

          {/* Search filter */}
          <input
            type="text"
            placeholder="Search logs..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="bg-slate-700 text-white text-sm rounded px-2 py-1.5 border border-slate-600 w-48"
          />

          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>

          <div className="flex-1" />

          {/* Actions */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-slate-600 hover:bg-slate-500 disabled:opacity-50 rounded text-white"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={copyLogs}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded text-white font-medium"
          >
            {copied ? '✓ Copied!' : 'Copy All'}
          </button>
          <button
            onClick={clearLogs}
            className="px-3 py-1.5 text-sm bg-red-600/50 hover:bg-red-600 rounded text-white"
          >
            Clear
          </button>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-auto p-2 font-mono text-xs leading-relaxed">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-slate-500 py-8">
              {loading ? 'Loading logs...' : 'No logs captured yet. Run a process to see logs here.'}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`py-0.5 px-1 rounded ${getLevelColor(log.level)} whitespace-pre-wrap break-all`}
                >
                  <span className="text-slate-500">[{log.timestamp.substring(11, 23)}]</span>{' '}
                  {log.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
