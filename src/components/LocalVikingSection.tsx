/**
 * Local Viking Section
 * Rank tracking, heat maps, and GBP automation for local SEO
 */
import React, { useState, useEffect, useCallback } from 'react';

// Types
interface RankSnapshot {
  id: number;
  website_id: number;
  keyword: string;
  grid_data: GridCell[];
  avg_rank: number;
  best_rank: number;
  in_top_3: number;
  in_top_10: number;
  total_points: number;
  scan_id: string;
  created_at: string;
}

interface GridCell {
  lat: number;
  lng: number;
  rank: number;
  competitor?: string;
}

interface GBPTemplate {
  id: number;
  website_id: number;
  name: string;
  template_type: 'update' | 'offer' | 'event' | 'product';
  content: string;
  cta_type: string;
  cta_url: string;
  schedule_enabled: boolean;
  schedule_days: number[];
  schedule_time: string;
  is_active: boolean;
}

interface SheepOpportunity {
  keyword: string;
  currentRank: number;
  targetRank: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
  suggestedAction: string;
  parentPage?: string;
}

interface Props {
  websiteId?: number;
  showNotification: (message: string, type: 'success' | 'info' | 'error') => void;
}

// Color scale for rank visualization
const getRankColor = (rank: number): string => {
  if (rank === 0) return 'bg-gray-700'; // Not ranking
  if (rank <= 3) return 'bg-green-500';  // Top 3 (map pack)
  if (rank <= 10) return 'bg-yellow-500'; // Page 1
  if (rank <= 20) return 'bg-orange-500'; // Page 2
  return 'bg-red-500'; // Beyond page 2
};

const getRankTextColor = (rank: number): string => {
  if (rank === 0) return 'text-gray-400';
  if (rank <= 3) return 'text-green-400';
  if (rank <= 10) return 'text-yellow-400';
  if (rank <= 20) return 'text-orange-400';
  return 'text-red-400';
};

const LocalVikingSection: React.FC<Props> = ({ websiteId, showNotification }) => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [credits, setCredits] = useState<{ remaining: number; total: number } | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'heatmap' | 'sheep' | 'templates' | 'automation'>('overview');

  // Rank data
  const [snapshots, setSnapshots] = useState<RankSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<RankSnapshot | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string>('');
  const [loadingRanks, setLoadingRanks] = useState(false);

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanKeyword, setScanKeyword] = useState('');

  // Sheep analysis
  const [sheepOpportunities, setSheepOpportunities] = useState<SheepOpportunity[]>([]);
  const [loadingSheep, setLoadingSheep] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<GBPTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<GBPTemplate | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Check connection status
  const checkConnection = useCallback(async () => {
    if (!websiteId) {
      setConnectionLoading(false);
      return;
    }

    setConnectionLoading(true);
    try {
      // Use account endpoint to check connection
      const res = await fetch(`/api/local-viking/account/${websiteId}`);
      const data = await res.json();

      if (data.success && data.account) {
        setIsConnected(true);
        // Also fetch credits
        const creditsRes = await fetch(`/api/local-viking/credits/${websiteId}`);
        const creditsData = await creditsRes.json();
        if (creditsData.success) {
          setCredits({ remaining: creditsData.credits, total: creditsData.credits });
        }
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Failed to check Local Viking connection:', error);
      setIsConnected(false);
    }
    setConnectionLoading(false);
  }, [websiteId]);

  // Load rank snapshots
  const loadSnapshots = useCallback(async () => {
    if (!websiteId || !isConnected) return;

    setLoadingRanks(true);
    try {
      const res = await fetch(`/api/local-viking/geogrid/history/${websiteId}`);
      const data = await res.json();

      if (data.success) {
        setSnapshots(data.snapshots || []);
        // Extract unique keywords
        const uniqueKeywords = [...new Set(data.snapshots?.map((s: RankSnapshot) => s.keyword) || [])] as string[];
        setKeywords(uniqueKeywords);
        if (uniqueKeywords.length > 0 && !selectedKeyword) {
          setSelectedKeyword(uniqueKeywords[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load snapshots:', error);
    }
    setLoadingRanks(false);
  }, [websiteId, isConnected, selectedKeyword]);

  // Run a new GeoGrid scan
  const runScan = async () => {
    if (!websiteId || !scanKeyword.trim()) return;

    setScanning(true);
    try {
      const res = await fetch(`/api/local-viking/geogrid/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteId,
          keyword: scanKeyword.trim(),
          gridSize: 7,
          saveToDb: true
        }),
      });
      const data = await res.json();

      if (data.success) {
        showNotification('Scan complete! Refreshing results.', 'success');
        setScanKeyword('');
        loadSnapshots();
      } else {
        showNotification(data.error || 'Scan failed', 'error');
      }
    } catch (error) {
      showNotification('Failed to start scan', 'error');
    }
    setScanning(false);
  };

  // Load sheep analysis
  const loadSheepAnalysis = useCallback(async () => {
    if (!websiteId || !isConnected) return;

    setLoadingSheep(true);
    try {
      const res = await fetch(`/api/local-viking/sheep-opportunities/${websiteId}`);
      const data = await res.json();

      if (data.success) {
        setSheepOpportunities(data.opportunities || []);
      }
    } catch (error) {
      console.error('Failed to load sheep analysis:', error);
    }
    setLoadingSheep(false);
  }, [websiteId, isConnected]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    if (!websiteId) return;

    try {
      const res = await fetch(`/api/local-viking/templates/${websiteId}`);
      const data = await res.json();

      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }, [websiteId]);

  // Save template
  const saveTemplate = async (template: Partial<GBPTemplate>) => {
    if (!websiteId) return;

    try {
      const method = template.id ? 'PUT' : 'POST';
      const url = template.id
        ? `/api/local-viking/templates/${template.id}`
        : `/api/local-viking/templates`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...template, website_id: websiteId }),
      });
      const data = await res.json();

      if (data.success) {
        showNotification('Template saved!', 'success');
        setShowTemplateModal(false);
        setEditingTemplate(null);
        loadTemplates();
      } else {
        showNotification(data.error || 'Failed to save template', 'error');
      }
    } catch (error) {
      showNotification('Failed to save template', 'error');
    }
  };

  // Delete template
  const deleteTemplate = async (templateId: number) => {
    if (!confirm('Delete this template?')) return;

    try {
      const res = await fetch(`/api/local-viking/templates/${templateId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        showNotification('Template deleted', 'success');
        loadTemplates();
      }
    } catch (error) {
      showNotification('Failed to delete template', 'error');
    }
  };

  // Post to GBP
  const postToGBP = async (templateId: number) => {
    if (!websiteId) return;

    try {
      // Get the template content
      const template = templates.find(t => t.id === templateId);
      if (!template) {
        showNotification('Template not found', 'error');
        return;
      }

      const res = await fetch(`/api/local-viking/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteId,
          postType: template.template_type,
          content: template.content,
          ctaType: template.cta_type,
          ctaUrl: template.cta_url
        }),
      });
      const data = await res.json();

      if (data.success) {
        showNotification('Posted to Google Business Profile!', 'success');
      } else {
        showNotification(data.error || 'Failed to post', 'error');
      }
    } catch (error) {
      showNotification('Failed to post to GBP', 'error');
    }
  };

  // Effects
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    if (isConnected) {
      loadSnapshots();
      loadTemplates();
    }
  }, [isConnected, loadSnapshots, loadTemplates]);

  useEffect(() => {
    if (activeTab === 'sheep' && isConnected) {
      loadSheepAnalysis();
    }
  }, [activeTab, isConnected, loadSheepAnalysis]);

  // Get latest snapshot for selected keyword
  const currentSnapshot = snapshots.find(s => s.keyword === selectedKeyword);

  // Loading state
  if (connectionLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-brand-cyan animate-pulse">Checking Local Viking connection...</div>
      </div>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="p-6">
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-dashed border-slate-600">
          <svg className="w-16 h-16 mx-auto text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h3 className="text-xl font-semibold text-white mb-2">Local Viking Not Connected</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Connect your Local Viking account to enable rank tracking, heat maps, and GBP automation.
          </p>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Add your Local Viking API key and Location ID in the website settings (Agency Manager).
            </p>
            <a
              href="https://localviking.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-brand-cyan hover:underline"
            >
              Get Local Viking
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-white">Local Viking</h3>
          <span className="flex items-center gap-2 px-2 py-1 bg-green-600/20 text-green-400 rounded text-sm">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Connected
          </span>
          {credits && (
            <span className="text-sm text-gray-400">
              {credits.remaining} / {credits.total} credits
            </span>
          )}
        </div>
        <button
          onClick={checkConnection}
          className="text-gray-400 hover:text-white text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'heatmap', label: 'Heat Map' },
          { id: 'sheep', label: 'Sheep Analysis' },
          { id: 'templates', label: 'GBP Templates' },
          { id: 'automation', label: 'Automation' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-brand-cyan text-slate-900'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-slate-900 rounded-lg border border-slate-700 min-h-[500px]">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="p-4 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-3xl font-bold text-white">{keywords.length}</div>
                <div className="text-sm text-gray-400">Keywords Tracked</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-3xl font-bold text-green-400">
                  {snapshots.filter(s => s.best_rank <= 3).length}
                </div>
                <div className="text-sm text-gray-400">In Map Pack</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-3xl font-bold text-yellow-400">
                  {snapshots.filter(s => s.best_rank > 3 && s.best_rank <= 10).length}
                </div>
                <div className="text-sm text-gray-400">Page 1</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-3xl font-bold text-brand-cyan">{templates.length}</div>
                <div className="text-sm text-gray-400">GBP Templates</div>
              </div>
            </div>

            {/* New Scan */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Run New Keyword Scan</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={scanKeyword}
                  onChange={(e) => setScanKeyword(e.target.value)}
                  placeholder="Enter keyword to scan..."
                  className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                  onKeyDown={(e) => e.key === 'Enter' && runScan()}
                />
                <button
                  onClick={runScan}
                  disabled={scanning || !scanKeyword.trim()}
                  className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 rounded text-slate-900 font-medium disabled:opacity-50"
                >
                  {scanning ? 'Scanning...' : 'Scan'}
                </button>
              </div>
            </div>

            {/* Recent Keywords */}
            <div>
              <h4 className="text-white font-medium mb-3">Recent Keyword Performance</h4>
              {loadingRanks ? (
                <div className="text-gray-400 text-center py-8">Loading...</div>
              ) : snapshots.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  No rank data yet. Run a scan to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {keywords.slice(0, 10).map((keyword) => {
                    const snapshot = snapshots.find(s => s.keyword === keyword);
                    if (!snapshot) return null;
                    return (
                      <div
                        key={keyword}
                        className="flex items-center justify-between p-3 bg-slate-800 rounded-lg hover:bg-slate-700 cursor-pointer"
                        onClick={() => {
                          setSelectedKeyword(keyword);
                          setActiveTab('heatmap');
                        }}
                      >
                        <div className="flex-1">
                          <div className="text-white font-medium">{keyword}</div>
                          <div className="text-xs text-gray-400">
                            Scanned {new Date(snapshot.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className={`text-lg font-bold ${getRankTextColor(snapshot.best_rank)}`}>
                              #{snapshot.best_rank || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">Best</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-white">
                              {snapshot.avg_rank?.toFixed(1) || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">Avg</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-green-400">
                              {snapshot.in_top_3 || 0}
                            </div>
                            <div className="text-xs text-gray-500">Top 3</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Heat Map Tab */}
        {activeTab === 'heatmap' && (
          <div className="p-4 space-y-4">
            {/* Keyword Selector */}
            <div className="flex items-center gap-4">
              <label className="text-gray-400 text-sm">Keyword:</label>
              <select
                value={selectedKeyword}
                onChange={(e) => setSelectedKeyword(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
              >
                {keywords.map((kw) => (
                  <option key={kw} value={kw}>{kw}</option>
                ))}
              </select>
              <button
                onClick={loadSnapshots}
                disabled={loadingRanks}
                className="text-brand-cyan hover:underline text-sm"
              >
                {loadingRanks ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {/* Grid Display */}
            {currentSnapshot ? (
              <div className="space-y-4">
                {/* Stats Bar */}
                <div className="flex items-center gap-6 p-3 bg-slate-800 rounded-lg">
                  <div>
                    <span className="text-gray-400 text-sm">Best Rank:</span>
                    <span className={`ml-2 font-bold ${getRankTextColor(currentSnapshot.best_rank)}`}>
                      #{currentSnapshot.best_rank}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Average:</span>
                    <span className="ml-2 font-bold text-white">{currentSnapshot.avg_rank?.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">In Top 3:</span>
                    <span className="ml-2 font-bold text-green-400">{currentSnapshot.in_top_3}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">In Top 10:</span>
                    <span className="ml-2 font-bold text-yellow-400">{currentSnapshot.in_top_10}</span>
                  </div>
                </div>

                {/* Heat Map Grid */}
                <div className="bg-slate-800 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-4">GeoGrid Heat Map</h4>
                  <div className="grid grid-cols-7 gap-1">
                    {(currentSnapshot.grid_data || []).map((cell, i) => (
                      <div
                        key={i}
                        className={`aspect-square rounded flex items-center justify-center text-xs font-bold text-white ${getRankColor(cell.rank)}`}
                        title={`Lat: ${cell.lat}, Lng: ${cell.lng}, Rank: ${cell.rank || 'N/R'}`}
                      >
                        {cell.rank || '-'}
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-4 text-xs">
                    <span className="text-gray-400">Legend:</span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-green-500"></span>
                      Top 3
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-yellow-500"></span>
                      4-10
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-orange-500"></span>
                      11-20
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-red-500"></span>
                      20+
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-gray-700"></span>
                      Not Ranking
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                {keywords.length === 0
                  ? 'No keywords tracked. Run a scan from the Overview tab.'
                  : 'Select a keyword to view its heat map.'
                }
              </div>
            )}
          </div>
        )}

        {/* Sheep Analysis Tab */}
        {activeTab === 'sheep' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">Sheep Herding Opportunities</h4>
                <p className="text-sm text-gray-400">Keywords closest to the map pack that need a push</p>
              </div>
              <button
                onClick={loadSheepAnalysis}
                disabled={loadingSheep}
                className="px-3 py-1.5 bg-brand-cyan hover:bg-brand-cyan/80 rounded text-slate-900 text-sm font-medium"
              >
                {loadingSheep ? 'Analyzing...' : 'Refresh Analysis'}
              </button>
            </div>

            {loadingSheep ? (
              <div className="text-gray-400 text-center py-12">Analyzing rank data...</div>
            ) : sheepOpportunities.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No sheep opportunities found.</p>
                <p className="text-sm mt-2">Run more keyword scans to identify ranking opportunities.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sheepOpportunities.map((opp, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-lg border ${
                      opp.priority === 'high'
                        ? 'bg-green-900/20 border-green-700'
                        : opp.priority === 'medium'
                        ? 'bg-yellow-900/20 border-yellow-700'
                        : 'bg-slate-800 border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{opp.keyword}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            opp.priority === 'high'
                              ? 'bg-green-600 text-white'
                              : opp.priority === 'medium'
                              ? 'bg-yellow-600 text-white'
                              : 'bg-gray-600 text-white'
                          }`}>
                            {opp.priority} priority
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          {opp.suggestedAction}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-bold ${getRankTextColor(opp.currentRank)}`}>
                            #{opp.currentRank}
                          </span>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <span className="text-lg font-bold text-green-400">
                            #{opp.targetRank}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {opp.gap} positions to go
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* GBP Templates Tab */}
        {activeTab === 'templates' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-white font-medium">GBP Post Templates</h4>
              <button
                onClick={() => {
                  setEditingTemplate({
                    id: 0,
                    website_id: websiteId || 0,
                    name: '',
                    template_type: 'update',
                    content: '',
                    cta_type: 'LEARN_MORE',
                    cta_url: '',
                    schedule_enabled: false,
                    schedule_days: [],
                    schedule_time: '09:00',
                    is_active: true,
                  });
                  setShowTemplateModal(true);
                }}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
              >
                + New Template
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No templates yet.</p>
                <p className="text-sm mt-2">Create templates to automate your GBP posts.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-slate-800 rounded-lg p-4 border border-slate-700"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{template.name}</span>
                          <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-gray-400">
                            {template.template_type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mt-2 line-clamp-2">
                          {template.content}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => postToGBP(template.id)}
                          className="p-1 hover:bg-slate-700 rounded text-green-400"
                          title="Post Now"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowTemplateModal(true);
                          }}
                          className="p-1 hover:bg-slate-700 rounded text-blue-400"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          className="p-1 hover:bg-slate-700 rounded text-red-400"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {template.schedule_enabled && (
                      <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-gray-400">
                        Scheduled: {template.schedule_time}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Automation Tab */}
        {activeTab === 'automation' && (
          <div className="p-4 space-y-6">
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-white font-medium mb-4">Rinse & Repeat Automation</h4>
              <p className="text-gray-400 text-sm mb-4">
                Automatically cycle through your GBP templates to keep your profile active and engaging.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                  <div>
                    <div className="text-white">Auto-posting</div>
                    <div className="text-sm text-gray-400">Post templates on a rotating schedule</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                  <div>
                    <div className="text-white">Scan Scheduling</div>
                    <div className="text-sm text-gray-400">Automatically run GeoGrid scans weekly</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                  <div>
                    <div className="text-white">Sheep Alerts</div>
                    <div className="text-sm text-gray-400">Get notified when keywords are close to map pack</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-white font-medium mb-4">Activity Log</h4>
              <div className="text-gray-500 text-center py-8">
                No automation activity yet. Enable features above to get started.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Template Edit Modal */}
      {showTemplateModal && editingTemplate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">
                {editingTemplate.id ? 'Edit Template' : 'New Template'}
              </h3>
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setEditingTemplate(null);
                }}
                className="text-gray-400 hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Template Name</label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                  placeholder="e.g., Weekly Update"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Post Type</label>
                <select
                  value={editingTemplate.template_type}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, template_type: e.target.value as any })}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                >
                  <option value="update">Update</option>
                  <option value="offer">Offer</option>
                  <option value="event">Event</option>
                  <option value="product">Product</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Content</label>
                <textarea
                  value={editingTemplate.content}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                  rows={4}
                  placeholder="Write your GBP post content..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">CTA Button Type</label>
                  <select
                    value={editingTemplate.cta_type}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, cta_type: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                  >
                    <option value="LEARN_MORE">Learn More</option>
                    <option value="BOOK">Book</option>
                    <option value="ORDER">Order Online</option>
                    <option value="SHOP">Shop</option>
                    <option value="SIGN_UP">Sign Up</option>
                    <option value="CALL">Call Now</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">CTA URL</label>
                  <input
                    type="text"
                    value={editingTemplate.cta_url}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, cta_url: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-700">
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setEditingTemplate(null);
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => saveTemplate(editingTemplate)}
                className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 rounded text-slate-900 font-medium"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocalVikingSection;
