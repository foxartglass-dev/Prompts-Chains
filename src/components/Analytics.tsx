import React, { useState, useEffect } from 'react';

interface AnalyticsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Website {
  id: number;
  name: string;
  url: string;
  client_name?: string;
}

interface KeywordRank {
  keyword: string;
  currentRank: number;
  previousRank: number;
  change: number;
  lastChecked: string;
}

const Analytics: React.FC<AnalyticsProps> = ({ isOpen, onClose }) => {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'rankmap' | 'keywords' | 'reports'>('overview');
  const [dateRange, setDateRange] = useState<'week' | 'month' | '3months' | 'all'>('month');

  useEffect(() => {
    if (isOpen) {
      fetchWebsites();
    }
  }, [isOpen]);

  const fetchWebsites = async () => {
    try {
      const res = await fetch('/api/websites');
      const data = await res.json();
      setWebsites(data || []);
      if (data && data.length > 0) {
        setSelectedWebsite(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch websites:', error);
    }
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Placeholder data for visualization
  const placeholderKeywords: KeywordRank[] = [
    { keyword: 'stained glass repair', currentRank: 3, previousRank: 5, change: 2, lastChecked: '2024-01-15' },
    { keyword: 'glass restoration near me', currentRank: 7, previousRank: 12, change: 5, lastChecked: '2024-01-15' },
    { keyword: 'church window repair', currentRank: 2, previousRank: 2, change: 0, lastChecked: '2024-01-15' },
    { keyword: 'antique glass restoration', currentRank: 15, previousRank: 22, change: 7, lastChecked: '2024-01-15' },
  ];

  const getRankColor = (rank: number) => {
    if (rank <= 3) return 'text-green-400 bg-green-500/20';
    if (rank <= 10) return 'text-yellow-400 bg-yellow-500/20';
    if (rank <= 20) return 'text-orange-400 bg-orange-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const getChangeIndicator = (change: number) => {
    if (change > 0) return <span className="text-green-400">↑{change}</span>;
    if (change < 0) return <span className="text-red-400">↓{Math.abs(change)}</span>;
    return <span className="text-gray-400">—</span>;
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-900 rounded-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden border-2 border-purple-500 shadow-lg">
        {/* Header */}
        <div className="bg-slate-800/50 px-6 py-4 border-b border-purple-500/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-purple-400">📊 Analytics</h2>
            {selectedWebsite && (
              <select
                value={selectedWebsite.id}
                onChange={e => {
                  const website = websites.find(w => w.id === parseInt(e.target.value));
                  if (website) setSelectedWebsite(website);
                }}
                className="bg-slate-800 border border-purple-500/50 rounded-lg px-3 py-2 text-sm text-white"
              >
                {websites.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-slate-800/30 px-6 py-2 border-b border-purple-500/20 flex gap-2">
          {[
            { id: 'overview', label: 'Overview', icon: '📈' },
            { id: 'rankmap', label: 'Rank Map', icon: '🗺️' },
            { id: 'keywords', label: 'Keywords', icon: '🔑' },
            { id: 'reports', label: 'Reports', icon: '📋' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
          <div className="ml-auto">
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value as any)}
              className="bg-slate-800 border border-purple-500/50 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="3months">Last 3 Months</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-5 border border-green-500/30">
                  <h4 className="text-sm text-gray-400 mb-1">Pages Published</h4>
                  <p className="text-3xl font-bold text-green-400">--</p>
                  <p className="text-xs text-gray-500 mt-1">Coming soon</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-blue-500/30">
                  <h4 className="text-sm text-gray-400 mb-1">Scheduled Pages</h4>
                  <p className="text-3xl font-bold text-blue-400">--</p>
                  <p className="text-xs text-gray-500 mt-1">Drip feed queue</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-yellow-500/30">
                  <h4 className="text-sm text-gray-400 mb-1">Keywords Tracked</h4>
                  <p className="text-3xl font-bold text-yellow-400">--</p>
                  <p className="text-xs text-gray-500 mt-1">Connect rank tracker</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-purple-500/30">
                  <h4 className="text-sm text-gray-400 mb-1">Avg. Rank Position</h4>
                  <p className="text-3xl font-bold text-purple-400">--</p>
                  <p className="text-xs text-gray-500 mt-1">Local 3-pack</p>
                </div>
              </div>

              {/* Growth Chart Placeholder */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
                <h3 className="text-lg font-bold text-purple-400 mb-4">📈 Ranking Growth Over Time</h3>
                <div className="h-64 bg-slate-900/50 rounded-lg border border-dashed border-purple-500/30 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <p className="text-4xl mb-2">📊</p>
                    <p className="font-semibold">Growth Chart Coming Soon</p>
                    <p className="text-xs mt-2">Week-over-week ranking improvements</p>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-gold/30">
                <h3 className="text-lg font-bold text-brand-gold mb-4">🕐 Recent Activity</h3>
                <div className="space-y-3">
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Page hierarchy view</p>
                      <p className="text-xs text-gray-500">See all pages with publish status</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">Coming Soon</span>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Drip feed schedule</p>
                      <p className="text-xs text-gray-500">View and manage scheduled posts</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">Coming Soon</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rank Map Tab */}
          {activeTab === 'rankmap' && (
            <div className="space-y-6">
              <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
                <h3 className="text-lg font-bold text-purple-400 mb-4">🗺️ Local Rank Map</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Visualize your Google Maps rankings from different grid points around your target city.
                </p>
                <div className="h-96 bg-slate-900/50 rounded-lg border border-dashed border-purple-500/30 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <p className="text-6xl mb-4">🗺️</p>
                    <p className="font-semibold text-lg">Rank Map Coming Soon</p>
                    <p className="text-sm mt-2 max-w-md">
                      Connect a rank tracking API to visualize your position in the local 3-pack
                      from multiple geographic points around your service area.
                    </p>
                    <div className="mt-4 flex justify-center gap-4 text-xs">
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full">🟢 Rank 1-3</span>
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">🟡 Rank 4-10</span>
                      <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full">🔴 Rank 11+</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Historical Toggle */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-gold/30">
                <h3 className="text-lg font-bold text-brand-gold mb-4">📅 Historical Comparison</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Compare rank maps month-over-month to show clients their growth.
                </p>
                <div className="flex gap-4">
                  <button className="flex-1 py-3 bg-slate-700/50 rounded-lg text-gray-400 border border-dashed border-slate-600">
                    Select Start Date
                  </button>
                  <button className="flex-1 py-3 bg-slate-700/50 rounded-lg text-gray-400 border border-dashed border-slate-600">
                    Select End Date
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Keywords Tab */}
          {activeTab === 'keywords' && (
            <div className="space-y-6">
              <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-purple-400">🔑 Tracked Keywords</h3>
                  <button className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-400 font-semibold transition border border-purple-500/50">
                    + Add Keyword
                  </button>
                </div>

                {/* Keyword Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-sm text-gray-400 font-medium">Keyword</th>
                        <th className="text-center py-3 px-4 text-sm text-gray-400 font-medium">Current Rank</th>
                        <th className="text-center py-3 px-4 text-sm text-gray-400 font-medium">Change</th>
                        <th className="text-center py-3 px-4 text-sm text-gray-400 font-medium">Last Checked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {placeholderKeywords.map((kw, i) => (
                        <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                          <td className="py-3 px-4 text-white font-medium">{kw.keyword}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-3 py-1 rounded-full font-bold ${getRankColor(kw.currentRank)}`}>
                              #{kw.currentRank}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-semibold">
                            {getChangeIndicator(kw.change)}
                          </td>
                          <td className="py-3 px-4 text-center text-gray-400 text-sm">{kw.lastChecked}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-gray-500 mt-4 text-center">
                  * Demo data - Connect a rank tracking API to see real data
                </p>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/30">
                <h3 className="text-lg font-bold text-purple-400 mb-4">📋 Client Reports</h3>
                <p className="text-sm text-gray-400 mb-6">
                  Generate and send monthly progress reports to clients showing their ranking improvements.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Report Template */}
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-purple-500/30">
                    <h4 className="font-bold text-white mb-2">Monthly Progress Report</h4>
                    <p className="text-xs text-gray-400 mb-4">
                      Shows rank map comparison from start date to current month
                    </p>
                    <button className="w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-400 font-semibold transition border border-purple-500/50">
                      Generate Report
                    </button>
                  </div>

                  {/* Email Template */}
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-brand-gold/30">
                    <h4 className="font-bold text-white mb-2">Email Template</h4>
                    <p className="text-xs text-gray-400 mb-4">
                      Pre-formatted email with progress summary and rank visuals
                    </p>
                    <button className="w-full py-2 bg-brand-gold/20 hover:bg-brand-gold/30 rounded-lg text-brand-gold font-semibold transition border border-brand-gold/50">
                      Configure Email
                    </button>
                  </div>
                </div>
              </div>

              {/* Auto-Send Settings */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-brand-cyan/30">
                <h3 className="text-lg font-bold text-brand-cyan mb-4">🤖 Auto-Send Reports</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Monthly Report Auto-Send</p>
                    <p className="text-xs text-gray-400">Automatically email clients on the 1st of each month</p>
                  </div>
                  <div className="relative">
                    <div className="w-12 h-6 bg-slate-600 rounded-full cursor-not-allowed"></div>
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full"></div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">Coming soon - requires email service integration</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
