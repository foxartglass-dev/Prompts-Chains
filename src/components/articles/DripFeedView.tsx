import React, { useState, useEffect, useCallback } from 'react';

interface DripFeedSettings {
  id: number;
  website_id: number;
  articles_per_day: number;
  variance_enabled: boolean;
  variance_min: number;
  variance_max: number;
  publish_time_start: string;
  publish_time_end: string;
  skip_weekdays: number[];
  skip_dates: string[];
  notification_hours: number[];
  first_day_monitor: boolean;
  is_enabled: boolean;
}

interface ScheduledArticle {
  id: number;
  article_id: number;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  keyword: string;
  selected_meta_title: string | null;
  wp_post_id: number | null;
  wp_post_url: string | null;
  error_message: string | null;
}

interface DripFeedStats {
  pending: number;
  published: number;
  failed: number;
  next_date: string | null;
  last_date: string | null;
  todayCount: number;
  needsAttention: number;
}

interface DripFeedViewProps {
  websiteId?: number;
}

const DripFeedView: React.FC<DripFeedViewProps> = ({ websiteId }) => {
  const [settings, setSettings] = useState<DripFeedSettings | null>(null);
  const [schedules, setSchedules] = useState<ScheduledArticle[]>([]);
  const [groupedSchedules, setGroupedSchedules] = useState<Record<string, ScheduledArticle[]>>({});
  const [stats, setStats] = useState<DripFeedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings form state
  const [articlesPerDay, setArticlesPerDay] = useState(7);
  const [varianceEnabled, setVarianceEnabled] = useState(true);
  const [varianceMin, setVarianceMin] = useState(6);
  const [varianceMax, setVarianceMax] = useState(8);
  const [publishTimeStart, setPublishTimeStart] = useState('07:00');
  const [publishTimeEnd, setPublishTimeEnd] = useState('19:00');
  const [skipWeekdays, setSkipWeekdays] = useState<number[]>([]);
  const [skipDates, setSkipDates] = useState<string[]>([]);
  const [firstDayMonitor, setFirstDayMonitor] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);

  // UI state
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const fetchData = useCallback(async () => {
    if (!websiteId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch settings, schedules, and stats in parallel
      const [settingsRes, schedulesRes, statsRes] = await Promise.all([
        fetch(`/api/drip-feed/settings/${websiteId}`),
        fetch(`/api/drip-feed/schedule/${websiteId}`),
        fetch(`/api/drip-feed/stats/${websiteId}`)
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings);
        // Update form state
        setArticlesPerDay(data.settings.articles_per_day || 7);
        setVarianceEnabled(data.settings.variance_enabled ?? true);
        setVarianceMin(data.settings.variance_min || 6);
        setVarianceMax(data.settings.variance_max || 8);
        setPublishTimeStart(data.settings.publish_time_start || '07:00');
        setPublishTimeEnd(data.settings.publish_time_end || '19:00');
        setSkipWeekdays(data.settings.skip_weekdays || []);
        setSkipDates(data.settings.skip_dates || []);
        setFirstDayMonitor(data.settings.first_day_monitor ?? true);
        setIsEnabled(data.settings.is_enabled ?? false);
      }

      if (schedulesRes.ok) {
        const data = await schedulesRes.json();
        setSchedules(data.schedules || []);
        setGroupedSchedules(data.groupedByDate || {});
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching drip feed data:', err);
      setError('Failed to load drip feed data');
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveSettings = async () => {
    if (!websiteId) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/drip-feed/settings/${websiteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articles_per_day: articlesPerDay,
          variance_enabled: varianceEnabled,
          variance_min: varianceMin,
          variance_max: varianceMax,
          publish_time_start: publishTimeStart,
          publish_time_end: publishTimeEnd,
          skip_weekdays: skipWeekdays,
          skip_dates: skipDates,
          first_day_monitor: firstDayMonitor,
          is_enabled: isEnabled
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save settings');
      }
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const removeFromSchedule = async (scheduleId: number) => {
    if (!websiteId) return;
    if (!confirm('Remove this article from the schedule?')) return;

    try {
      const res = await fetch(`/api/drip-feed/schedule/${websiteId}/${scheduleId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      setError('Failed to remove from schedule');
    }
  };

  const toggleWeekday = (day: number) => {
    if (skipWeekdays.includes(day)) {
      setSkipWeekdays(skipWeekdays.filter(d => d !== day));
    } else {
      setSkipWeekdays([...skipWeekdays, day]);
    }
  };

  const addSkipDate = (date: string) => {
    if (!skipDates.includes(date)) {
      setSkipDates([...skipDates, date].sort());
    }
  };

  const removeSkipDate = (date: string) => {
    setSkipDates(skipDates.filter(d => d !== date));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    // Add padding days from previous month
    for (let i = 0; i < firstDay.getDay(); i++) {
      const d = new Date(year, month, -i);
      days.unshift(d);
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    // Add padding days from next month
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  if (!websiteId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2 p-8">
        <svg className="w-16 h-16 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-lg">Select a website to configure Drip Feed</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-brand-cyan animate-pulse">Loading drip feed settings...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">&times;</button>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Enable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-brand-gold">Drip Feed</h2>
            <p className="text-gray-400 text-sm">Auto-publish articles on a schedule</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <span className={`text-sm font-medium ${isEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                {isEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <div
                onClick={() => setIsEnabled(!isEnabled)}
                className={`relative w-14 h-7 rounded-full transition-colors cursor-pointer ${
                  isEnabled ? 'bg-green-600' : 'bg-slate-600'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    isEnabled ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </div>
            </label>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 rounded-lg text-slate-900 font-medium text-sm transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="text-3xl font-bold text-amber-400">{stats.pending}</div>
              <div className="text-sm text-gray-400">Queued</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="text-3xl font-bold text-green-400">{stats.published}</div>
              <div className="text-sm text-gray-400">Published</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="text-3xl font-bold text-red-400">{stats.failed}</div>
              <div className="text-sm text-gray-400">Failed</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="text-3xl font-bold text-brand-cyan">{stats.todayCount}</div>
              <div className="text-sm text-gray-400">Today</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className={`text-3xl font-bold ${stats.needsAttention > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                {stats.needsAttention}
              </div>
              <div className="text-sm text-gray-400">Need Meta</div>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Schedule Settings</h3>

          <div className="grid grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Articles Per Day */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Articles Per Day
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={articlesPerDay}
                    onChange={(e) => setArticlesPerDay(parseInt(e.target.value) || 1)}
                    min="1"
                    max="50"
                    className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-center"
                  />
                  <div className="flex flex-col">
                    <button
                      onClick={() => setArticlesPerDay(Math.min(50, articlesPerDay + 1))}
                      className="px-2 py-0.5 bg-slate-600 hover:bg-slate-500 rounded-t text-gray-300 text-xs"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => setArticlesPerDay(Math.max(1, articlesPerDay - 1))}
                      className="px-2 py-0.5 bg-slate-600 hover:bg-slate-500 rounded-b text-gray-300 text-xs"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </div>

              {/* Variance */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={varianceEnabled}
                    onChange={(e) => setVarianceEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-slate-700 text-brand-cyan"
                  />
                  <span className="text-sm font-medium text-gray-300">Enable Variance</span>
                </label>
                {varianceEnabled && (
                  <div className="flex items-center gap-2 ml-6">
                    <span className="text-sm text-gray-400">Range:</span>
                    <input
                      type="number"
                      value={varianceMin}
                      onChange={(e) => setVarianceMin(parseInt(e.target.value) || 1)}
                      min="1"
                      max={articlesPerDay}
                      className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-center text-sm"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                      type="number"
                      value={varianceMax}
                      onChange={(e) => setVarianceMax(parseInt(e.target.value) || 1)}
                      min={varianceMin}
                      max="50"
                      className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-center text-sm"
                    />
                    <span className="text-sm text-gray-500">per day</span>
                  </div>
                )}
              </div>

              {/* Publish Time Window */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Publish Time Window
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={publishTimeStart}
                    onChange={(e) => setPublishTimeStart(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="time"
                    value={publishTimeEnd}
                    onChange={(e) => setPublishTimeEnd(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* First Day Monitor */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={firstDayMonitor}
                  onChange={(e) => setFirstDayMonitor(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-slate-700 text-brand-cyan"
                />
                <span className="text-sm text-gray-300">First Day Monitor</span>
                <span className="text-xs text-gray-500">(Notify on each publish for first 10 articles)</span>
              </label>
            </div>

            {/* Right Column - Skip Days */}
            <div className="space-y-4">
              {/* Skip Weekdays */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Skip Every Week
                </label>
                <div className="flex gap-2">
                  {weekdayNames.map((name, index) => (
                    <button
                      key={index}
                      onClick={() => toggleWeekday(index)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                        skipWeekdays.includes(index)
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skip Specific Dates */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Skip Specific Dates
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="date"
                    value={selectedDate || ''}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  />
                  <button
                    onClick={() => {
                      if (selectedDate) {
                        addSkipDate(selectedDate);
                        setSelectedDate(null);
                      }
                    }}
                    disabled={!selectedDate}
                    className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded text-white text-sm font-medium disabled:opacity-50"
                  >
                    Add Skip Day
                  </button>
                </div>
                {skipDates.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {skipDates.map((date) => (
                      <span
                        key={date}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-red-600/30 text-red-400 rounded text-sm"
                      >
                        {formatDate(date)}
                        <button
                          onClick={() => removeSkipDate(date)}
                          className="hover:text-red-300"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Queue (The Hopper) */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              Schedule Queue
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({schedules.filter(s => s.status === 'pending').length} pending)
              </span>
            </h3>
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-gray-300 text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {showCalendar ? 'Hide Calendar' : 'Show Calendar'}
            </button>
          </div>

          {/* Calendar View */}
          {showCalendar && (
            <div className="mb-6 bg-slate-900 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                  className="p-2 hover:bg-slate-700 rounded"
                >
                  &lt;
                </button>
                <span className="text-white font-medium">
                  {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                  className="p-2 hover:bg-slate-700 rounded"
                >
                  &gt;
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {weekdayNames.map((name) => (
                  <div key={name} className="text-center text-xs text-gray-500 py-2">
                    {name}
                  </div>
                ))}
                {getDaysInMonth(calendarMonth).map((date, index) => {
                  const dateStr = date.toISOString().split('T')[0];
                  const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
                  const isToday = dateStr === new Date().toISOString().split('T')[0];
                  const isSkipped = skipWeekdays.includes(date.getDay()) || skipDates.includes(dateStr);
                  const scheduledCount = groupedSchedules[dateStr]?.length || 0;

                  return (
                    <div
                      key={index}
                      className={`relative p-2 text-center rounded ${
                        !isCurrentMonth
                          ? 'text-gray-600'
                          : isSkipped
                            ? 'bg-red-900/30 text-red-400'
                            : isToday
                              ? 'bg-brand-cyan/20 text-brand-cyan'
                              : 'text-gray-300'
                      }`}
                    >
                      <span className="text-sm">{date.getDate()}</span>
                      {scheduledCount > 0 && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] text-amber-400 font-bold">
                          {scheduledCount}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grouped Schedule List */}
          {Object.keys(groupedSchedules).length > 0 ? (
            <div className="space-y-4 max-h-[500px] overflow-auto">
              {Object.entries(groupedSchedules)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, articles]) => {
                  const isSkipped = skipWeekdays.includes(new Date(date + 'T00:00:00').getDay()) ||
                                   skipDates.includes(date);

                  return (
                    <div key={date} className="bg-slate-900 rounded-lg overflow-hidden">
                      <div className={`px-4 py-2 flex items-center justify-between ${
                        isSkipped ? 'bg-red-900/30' : 'bg-slate-800'
                      }`}>
                        <span className={`font-medium ${isSkipped ? 'text-red-400' : 'text-white'}`}>
                          {formatDate(date)}
                          {isSkipped && ' - SKIPPED'}
                        </span>
                        <span className="text-sm text-gray-400">{articles.length} article{articles.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="divide-y divide-slate-800">
                        {articles.map((article) => (
                          <div
                            key={article.id}
                            className="px-4 py-3 flex items-center justify-between hover:bg-slate-800/50"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-gray-400 w-20">
                                {formatTime(article.scheduled_time)}
                              </span>
                              <span className="text-white">{article.keyword}</span>
                              {!article.selected_meta_title && (
                                <span className="px-2 py-0.5 bg-amber-600/30 text-amber-400 rounded text-xs">
                                  No Meta
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                article.status === 'pending' ? 'bg-blue-600/30 text-blue-400' :
                                article.status === 'published' ? 'bg-green-600/30 text-green-400' :
                                article.status === 'failed' ? 'bg-red-600/30 text-red-400' :
                                'bg-gray-600/30 text-gray-400'
                              }`}>
                                {article.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {article.wp_post_url && (
                                <a
                                  href={article.wp_post_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 rounded text-blue-400 text-xs"
                                >
                                  View
                                </a>
                              )}
                              {article.status === 'pending' && (
                                <button
                                  onClick={() => removeFromSchedule(article.id)}
                                  className="px-2 py-1 bg-red-600/30 hover:bg-red-600/50 rounded text-red-400 text-xs"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto opacity-30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>No articles scheduled yet</p>
              <p className="text-sm mt-1">Go to Articles tab and select articles to add to the drip feed</p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
          <h4 className="text-sm font-medium text-brand-gold mb-2">How to use Drip Feed</h4>
          <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
            <li>Configure your settings above (articles per day, time window, skip days)</li>
            <li>Go to the <strong className="text-white">Articles</strong> tab</li>
            <li>Select articles using the checkboxes</li>
            <li>Click <strong className="text-white">Add to Drip Feed</strong></li>
            <li>Enable the drip feed using the toggle above</li>
            <li>Articles will auto-publish according to your schedule</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default DripFeedView;
