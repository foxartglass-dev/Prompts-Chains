/**
 * LogViewer Component
 *
 * Displays session logs for debugging image generation and WordPress publishing.
 * Provides filtering, copy-to-clipboard, and real-time viewing features.
 */

import { useState, useEffect, useCallback } from 'react';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

interface SessionSummary {
  articlesProcessed: number;
  imagesGenerated: number;
  imagesFromBank: number;
  errors: number;
  wpUploads: number;
}

interface Session {
  id: string;
  startTime: string;
  endTime: string | null;
  keyword: string | null;
  logCount: number;
  summary: SessionSummary;
  logs?: LogEntry[];
}

interface LogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LogViewer({ isOpen, onClose }: LogViewerProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch available sessions
  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/logs/sessions?count=10');
      const data = await response.json();
      if (data.success) {
        setSessions(data.sessions);
        // Auto-select most recent session
        if (data.sessions.length > 0 && !selectedSession) {
          setSelectedSession(data.sessions[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  }, [selectedSession]);

  // Fetch logs for selected session
  const fetchLogs = useCallback(async () => {
    if (!selectedSession) return;

    setLoading(true);
    try {
      let url = `/api/logs/session/${selectedSession}`;
      const params = new URLSearchParams();
      if (filterLevel) params.set('filterLevel', filterLevel);
      if (filterCategory) params.set('filterCategory', filterCategory);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setLogs(data.session.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedSession, filterLevel, filterCategory]);

  // Copy logs to clipboard
  const copyLogs = async () => {
    if (!selectedSession) return;

    try {
      const response = await fetch(`/api/logs/session/${selectedSession}/copy?includeTimestamp=true&includeData=true`);
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy logs:', error);
    }
  };

  // Clear all sessions
  const clearSessions = async () => {
    if (!confirm('Clear all session logs?')) return;

    try {
      await fetch('/api/logs/sessions', { method: 'DELETE' });
      setSessions([]);
      setSelectedSession(null);
      setLogs([]);
    } catch (error) {
      console.error('Failed to clear sessions:', error);
    }
  };

  // Auto-refresh when open
  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen, fetchSessions]);

  // Fetch logs when session changes
  useEffect(() => {
    if (selectedSession) {
      fetchLogs();
    }
  }, [selectedSession, fetchLogs]);

  if (!isOpen) return null;

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'success': return 'text-green-400';
      case 'warn': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'debug': return 'text-gray-500';
      default: return 'text-blue-400';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'IMAGE': return 'bg-purple-600/30 text-purple-300';
      case 'BANK': return 'bg-blue-600/30 text-blue-300';
      case 'PIPELINE': return 'bg-green-600/30 text-green-300';
      case 'PUBLISH': return 'bg-amber-600/30 text-amber-300';
      case 'WP': return 'bg-cyan-600/30 text-cyan-300';
      case 'SAVE': return 'bg-pink-600/30 text-pink-300';
      default: return 'bg-slate-600/30 text-slate-300';
    }
  };

  const selectedSessionData = sessions.find(s => s.id === selectedSession);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Session Logs</h2>
            <span className="text-xs text-slate-400">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} available
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-700">
          {/* Session selector */}
          <select
            value={selectedSession || ''}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="bg-slate-700 text-white text-sm rounded px-3 py-1.5 border border-slate-600"
          >
            <option value="">Select Session</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.keyword || 'Session'} - {new Date(s.startTime).toLocaleTimeString()} ({s.logCount} logs)
              </option>
            ))}
          </select>

          {/* Level filter */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-slate-700 text-white text-sm rounded px-3 py-1.5 border border-slate-600"
          >
            <option value="">All Levels</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>

          {/* Category filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-700 text-white text-sm rounded px-3 py-1.5 border border-slate-600"
          >
            <option value="">All Categories</option>
            <option value="PUBLISH">Publish</option>
            <option value="IMAGE">Image</option>
            <option value="BANK">Bank</option>
            <option value="PIPELINE">Pipeline</option>
            <option value="WP">WordPress</option>
            <option value="SAVE">Save</option>
          </select>

          <div className="flex-1" />

          {/* Actions */}
          <button
            onClick={fetchLogs}
            disabled={!selectedSession}
            className="px-3 py-1.5 text-sm bg-slate-600 hover:bg-slate-500 disabled:opacity-50 rounded text-white"
          >
            Refresh
          </button>
          <button
            onClick={copyLogs}
            disabled={!selectedSession || logs.length === 0}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-white"
          >
            {copied ? 'Copied!' : 'Copy All'}
          </button>
          <button
            onClick={clearSessions}
            disabled={sessions.length === 0}
            className="px-3 py-1.5 text-sm bg-red-600/50 hover:bg-red-600 disabled:opacity-50 rounded text-white"
          >
            Clear
          </button>
        </div>

        {/* Summary */}
        {selectedSessionData && (
          <div className="flex flex-wrap gap-4 p-4 bg-slate-900/50 border-b border-slate-700">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{selectedSessionData.summary.articlesProcessed}</div>
              <div className="text-xs text-slate-400">Articles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{selectedSessionData.summary.imagesGenerated}</div>
              <div className="text-xs text-slate-400">Generated</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{selectedSessionData.summary.imagesFromBank}</div>
              <div className="text-xs text-slate-400">From Bank</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-400">{selectedSessionData.summary.wpUploads}</div>
              <div className="text-xs text-slate-400">WP Uploads</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${selectedSessionData.summary.errors > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {selectedSessionData.summary.errors}
              </div>
              <div className="text-xs text-slate-400">Errors</div>
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs">
          {loading ? (
            <div className="text-center text-slate-400 py-8">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              {selectedSession ? 'No logs found for this session' : 'Select a session to view logs'}
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2 hover:bg-slate-700/30 py-0.5 px-1 rounded">
                  <span className="text-slate-500 shrink-0 w-20">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`shrink-0 w-14 uppercase ${getLevelColor(log.level)}`}>
                    {log.level}
                  </span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] ${getCategoryColor(log.category)}`}>
                    {log.category}
                  </span>
                  <span className="text-slate-200 flex-1">{log.message}</span>
                  {log.data && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(log.data, null, 2));
                      }}
                      className="text-slate-500 hover:text-slate-300 shrink-0"
                      title="Copy data"
                    >
                      [+]
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
