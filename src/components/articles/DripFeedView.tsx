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
  timezone: string;
}

// Common US timezones for the dropdown
const TIMEZONES = [
  { id: 'America/New_York', label: 'Eastern (ET)', offset: 'UTC-5/UTC-4' },
  { id: 'America/Chicago', label: 'Central (CT)', offset: 'UTC-6/UTC-5' },
  { id: 'America/Denver', label: 'Mountain (MT)', offset: 'UTC-7/UTC-6' },
  { id: 'America/Los_Angeles', label: 'Pacific (PT)', offset: 'UTC-8/UTC-7' },
  { id: 'America/Anchorage', label: 'Alaska (AKT)', offset: 'UTC-9/UTC-8' },
  { id: 'Pacific/Honolulu', label: 'Hawaii (HST)', offset: 'UTC-10' },
  { id: 'UTC', label: 'UTC', offset: 'UTC' },
];

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

interface PushoverUser {
  key: string;
  name: string;
  enabled: boolean;
}

interface SmsRecipient {
  phone: string;
  carrier: string;
  name: string;
  enabled: boolean;
}

interface NotificationSettings {
  pushover_enabled: boolean;
  pushover_user_keys: PushoverUser[];
  email_sms_enabled: boolean;
  email_sms_recipients: SmsRecipient[];
  notify_on_publish: boolean;
  notify_on_failure: boolean;
  notify_on_missing_meta: boolean;
  notify_daily_summary: boolean;
  notify_queue_empty: boolean;
}

// Carrier options for Email-to-SMS
const SMS_CARRIERS = [
  { id: 'verizon', name: 'Verizon' },
  { id: 'att', name: 'AT&T' },
  { id: 'tmobile', name: 'T-Mobile' },
  { id: 'sprint', name: 'Sprint' },
  { id: 'uscellular', name: 'US Cellular' },
  { id: 'boost', name: 'Boost Mobile' },
  { id: 'cricket', name: 'Cricket' },
  { id: 'metropcs', name: 'MetroPCS' },
  { id: 'googlefi', name: 'Google Fi' },
  { id: 'mint', name: 'Mint Mobile' },
  { id: 'visible', name: 'Visible' }
];

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
  const [isEnabled, setIsEnabled] = useState(true);
  const [timezone, setTimezone] = useState('America/Chicago');

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Notification settings state
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    pushover_enabled: false,
    pushover_user_keys: [],
    email_sms_enabled: false,
    email_sms_recipients: [],
    notify_on_publish: false,
    notify_on_failure: true,
    notify_on_missing_meta: true,
    notify_daily_summary: false,
    notify_queue_empty: true
  });
  // Pushover state
  const [newUserKey, setNewUserKey] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [testingNotification, setTestingNotification] = useState(false);
  // Email-to-SMS state
  const [newSmsPhone, setNewSmsPhone] = useState('');
  const [newSmsCarrier, setNewSmsCarrier] = useState('verizon');
  const [newSmsName, setNewSmsName] = useState('');
  const [testingSms, setTestingSms] = useState(false);

  // Test mode state
  const [showTestMode, setShowTestMode] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    currentTime: string;
    pendingCount: number;
    dueNowCount: number;
    pending: Array<{ id: number; articleId: number; keyword: string; scheduledFor: string; isDueNow: boolean }>;
  } | null>(null);
  const [processingTest, setProcessingTest] = useState(false);
  const [schedulingTest, setSchedulingTest] = useState(false);
  const [selectedTestArticles, setSelectedTestArticles] = useState<number[]>([]);

  // Toast message state (auto-dismissing)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000); // Auto-dismiss after 4 seconds
  };

  const fetchData = useCallback(async () => {
    if (!websiteId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [settingsRes, schedulesRes, statsRes, notifRes] = await Promise.all([
        fetch(`/api/drip-feed/settings/${websiteId}`),
        fetch(`/api/drip-feed/schedule/${websiteId}`),
        fetch(`/api/drip-feed/stats/${websiteId}`),
        fetch('/api/drip-feed/notifications/settings')
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings);
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
        setTimezone(data.settings.timezone || 'America/Chicago');
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

      if (notifRes.ok) {
        const data = await notifRes.json();
        if (data.settings) {
          setNotifSettings({
            pushover_enabled: data.settings.pushover_enabled ?? false,
            pushover_user_keys: data.settings.pushover_user_keys || [],
            notify_on_publish: data.settings.notify_on_publish ?? false,
            notify_on_failure: data.settings.notify_on_failure ?? true,
            notify_on_missing_meta: data.settings.notify_on_missing_meta ?? true,
            notify_daily_summary: data.settings.notify_daily_summary ?? false,
            notify_queue_empty: data.settings.notify_queue_empty ?? true
          });
        }
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
          is_enabled: isEnabled,
          timezone: timezone
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setShowSettings(false);
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

  // Notification settings functions
  const saveNotificationSettings = async () => {
    try {
      const res = await fetch('/api/drip-feed/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifSettings)
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save notification settings');
      }
    } catch (err) {
      setError('Failed to save notification settings');
    }
  };

  const addPushoverUser = () => {
    if (!newUserKey.trim()) return;

    const newUser: PushoverUser = {
      key: newUserKey.trim(),
      name: newUserName.trim() || 'User ' + (notifSettings.pushover_user_keys.length + 1),
      enabled: true
    };

    setNotifSettings({
      ...notifSettings,
      pushover_user_keys: [...notifSettings.pushover_user_keys, newUser]
    });
    setNewUserKey('');
    setNewUserName('');
  };

  const removePushoverUser = (key: string) => {
    setNotifSettings({
      ...notifSettings,
      pushover_user_keys: notifSettings.pushover_user_keys.filter(u => u.key !== key)
    });
  };

  const togglePushoverUser = (key: string) => {
    setNotifSettings({
      ...notifSettings,
      pushover_user_keys: notifSettings.pushover_user_keys.map(u =>
        u.key === key ? { ...u, enabled: !u.enabled } : u
      )
    });
  };

  const testNotification = async (userKey: string) => {
    setTestingNotification(true);
    try {
      const res = await fetch('/api/drip-feed/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userKey })
      });

      if (res.ok) {
        showToast('Test notification sent! Check your Pushover app.', 'success');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to send test notification');
      }
    } catch (err) {
      setError('Failed to send test notification');
    } finally {
      setTestingNotification(false);
    }
  };

  // Email-to-SMS functions
  const addSmsRecipient = () => {
    if (!newSmsPhone.trim()) return;

    // Clean phone number - remove non-digits
    const cleanPhone = newSmsPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10 && !(cleanPhone.length === 11 && cleanPhone.startsWith('1'))) {
      setError('Phone number must be 10 digits');
      return;
    }

    const newRecipient: SmsRecipient = {
      phone: cleanPhone.length === 11 ? cleanPhone.slice(1) : cleanPhone,
      carrier: newSmsCarrier,
      name: newSmsName.trim() || 'Recipient ' + (notifSettings.email_sms_recipients.length + 1),
      enabled: true
    };

    setNotifSettings({
      ...notifSettings,
      email_sms_recipients: [...notifSettings.email_sms_recipients, newRecipient]
    });
    setNewSmsPhone('');
    setNewSmsName('');
  };

  const removeSmsRecipient = (phone: string) => {
    setNotifSettings({
      ...notifSettings,
      email_sms_recipients: notifSettings.email_sms_recipients.filter(r => r.phone !== phone)
    });
  };

  const toggleSmsRecipient = (phone: string) => {
    setNotifSettings({
      ...notifSettings,
      email_sms_recipients: notifSettings.email_sms_recipients.map(r =>
        r.phone === phone ? { ...r, enabled: !r.enabled } : r
      )
    });
  };

  const testSmsNotification = async (phone: string, carrier: string) => {
    setTestingSms(true);
    try {
      const res = await fetch('/api/drip-feed/notifications/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, carrier })
      });

      if (res.ok) {
        showToast('Test SMS sent! Check your phone.', 'success');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to send test SMS');
      }
    } catch (err) {
      setError('Failed to send test SMS');
    } finally {
      setTestingSms(false);
    }
  };

  // Test Mode functions
  const fetchTestStatus = async () => {
    try {
      // Send client's local time to server
      const clientTime = new Date().toISOString();
      const res = await fetch(`/api/drip-feed/test-status?clientTime=${encodeURIComponent(clientTime)}`);
      if (res.ok) {
        const data = await res.json();
        setTestStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch test status:', err);
    }
  };

  const scheduleTestArticles = async (minuteOffsets: number[]) => {
    if (!websiteId || selectedTestArticles.length === 0) {
      setError('Select articles to schedule for testing');
      return;
    }

    setSchedulingTest(true);
    try {
      const res = await fetch(`/api/drip-feed/test-schedule/${websiteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleIds: selectedTestArticles,
          minutesFromNow: minuteOffsets,
          clientTime: new Date().toISOString() // Send client's local time
        })
      });

      const data = await res.json();
      if (res.ok) {
        const count = data.results.filter((r: { success: boolean }) => r.success).length;
        showToast(`Scheduled ${count} article(s) for testing`, 'success');
        setSelectedTestArticles([]);
        fetchTestStatus();
        fetchData();
      } else {
        setError(data.error || 'Failed to schedule test');
      }
    } catch (err) {
      setError('Failed to schedule test');
    } finally {
      setSchedulingTest(false);
    }
  };

  const processNow = async () => {
    setProcessingTest(true);
    try {
      const res = await fetch('/api/drip-feed/process-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTime: new Date().toISOString() }) // Send client's local time
      });

      const data = await res.json();
      if (res.ok) {
        if (data.processed === 0) {
          showToast('No articles due for publishing', 'info');
        } else {
          showToast(`Published: ${data.results[0]?.keyword || 'article'}`, data.failed > 0 ? 'error' : 'success');
        }
        fetchTestStatus();
        fetchData();
      } else {
        setError(data.error || 'Failed to process');
      }
    } catch (err) {
      setError('Failed to process');
    } finally {
      setProcessingTest(false);
    }
  };

  // Fetch test status when test mode is opened
  useEffect(() => {
    if (showTestMode) {
      fetchTestStatus();
      const interval = setInterval(fetchTestStatus, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [showTestMode]);

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

  // Get current time in the user's configured timezone
  const getCurrentTimeInTimezone = () => {
    const now = new Date();
    return now.toLocaleString('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Format a datetime for display (used in test status)
  const formatDateTimeInTimezone = (dateStr: string, timeStr: string) => {
    // Create date in UTC, then format in user's timezone
    const dateTime = new Date(`${dateStr}T${timeStr}:00Z`);
    return dateTime.toLocaleString('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      const d = new Date(year, month, -i);
      days.unshift(d);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

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
    <div className="h-full flex flex-col">
      {/* Compact Top Bar */}
      <div className="flex-shrink-0 bg-slate-800/80 border-b border-slate-700 px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Toggle + Stats */}
          <div className="flex items-center gap-4">
            {/* Enable Toggle */}
            <div
              onClick={() => setIsEnabled(!isEnabled)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition ${
                isEnabled ? 'bg-green-600/20 border border-green-500/50' : 'bg-orange-600/20 border border-orange-500/50'
              }`}
            >
              <div className={`w-3 h-3 rounded-full ${isEnabled ? 'bg-green-400' : 'bg-orange-400'}`} />
              <span className={`text-sm font-medium ${isEnabled ? 'text-green-400' : 'text-orange-400'}`}>
                {isEnabled ? 'Active' : 'Paused'}
              </span>
            </div>

            {/* Inline Stats */}
            {stats && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-amber-400 font-medium">{stats.pending} queued</span>
                <span className="text-gray-500">|</span>
                <span className="text-green-400">{stats.published} published</span>
                {stats.failed > 0 && (
                  <>
                    <span className="text-gray-500">|</span>
                    <span className="text-red-400">{stats.failed} failed</span>
                  </>
                )}
                {stats.needsAttention > 0 && (
                  <>
                    <span className="text-gray-500">|</span>
                    <span className="text-amber-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {stats.needsAttention} need meta
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right: Time Display + Settings Dropdown + Actions */}
          <div className="flex items-center gap-2">
            {/* Current Time Display */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 rounded-lg text-sm">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-white font-mono">{getCurrentTimeInTimezone()}</span>
              <span className="text-gray-500 text-xs">({TIMEZONES.find(t => t.id === timezone)?.label?.split(' ')[0] || 'CT'})</span>
            </div>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                showSettings
                  ? 'bg-brand-cyan text-slate-900'
                  : 'bg-slate-700 hover:bg-slate-600 text-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Schedule Settings
              <svg className={`w-3 h-3 transition-transform ${showSettings ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                showCalendar
                  ? 'bg-brand-cyan text-slate-900'
                  : 'bg-slate-700 hover:bg-slate-600 text-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Calendar
            </button>

            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                showNotifications
                  ? 'bg-brand-cyan text-slate-900'
                  : (notifSettings.pushover_enabled || notifSettings.email_sms_enabled)
                    ? 'bg-green-600/20 border border-green-500/50 text-green-400'
                    : 'bg-slate-700 hover:bg-slate-600 text-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Notifications
            </button>

            {/* Test Mode Button */}
            <button
              onClick={() => setShowTestMode(!showTestMode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                showTestMode
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-600/20 border border-orange-500/50 text-orange-400 hover:bg-orange-600/30'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Test Mode
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mt-2 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">&times;</button>
          </div>
        )}

        {/* Toast Message (auto-dismissing) */}
        {toast && (
          <div className={`mt-2 p-2 rounded text-sm flex items-center justify-between ${
            toast.type === 'success' ? 'bg-green-500/20 border border-green-500/50 text-green-400' :
            toast.type === 'error' ? 'bg-red-500/20 border border-red-500/50 text-red-400' :
            'bg-blue-500/20 border border-blue-500/50 text-blue-400'
          }`}>
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100">&times;</button>
          </div>
        )}
      </div>

      {/* Collapsible Settings Panel */}
      {showSettings && (
        <div className="flex-shrink-0 bg-slate-800/50 border-b border-slate-700 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            {/* Articles Per Day + Variance */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Articles/day:</span>
              <input
                type="number"
                value={articlesPerDay}
                onChange={(e) => setArticlesPerDay(parseInt(e.target.value) || 1)}
                min="1"
                max="50"
                className="w-12 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-white text-center text-xs"
              />
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={varianceEnabled}
                  onChange={(e) => setVarianceEnabled(e.target.checked)}
                  className="w-3 h-3 rounded border-gray-600 bg-slate-700 text-brand-cyan"
                />
                <span className="text-xs text-gray-400">Variance</span>
              </label>
              {varianceEnabled && (
                <div className="flex items-center gap-0.5">
                  <input
                    type="number"
                    value={varianceMin}
                    onChange={(e) => setVarianceMin(parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-10 bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-white text-center text-xs"
                  />
                  <span className="text-gray-500 text-xs">-</span>
                  <input
                    type="number"
                    value={varianceMax}
                    onChange={(e) => setVarianceMax(parseInt(e.target.value) || 1)}
                    min={varianceMin}
                    className="w-10 bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-white text-center text-xs"
                  />
                </div>
              )}
            </div>

            {/* Time Window */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Time:</span>
              <input
                type="time"
                value={publishTimeStart}
                onChange={(e) => setPublishTimeStart(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-white text-xs"
              />
              <span className="text-gray-500 text-xs">to</span>
              <input
                type="time"
                value={publishTimeEnd}
                onChange={(e) => setPublishTimeEnd(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-white text-xs"
              />
            </div>

            {/* Skip Weekdays */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Skip:</span>
              <div className="flex gap-0.5">
                {weekdayNames.map((name, index) => (
                  <button
                    key={index}
                    onClick={() => toggleWeekday(index)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                      skipWeekdays.includes(index)
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Skip Dates */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Skip dates:</span>
              <input
                type="date"
                value={selectedDate || ''}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-white text-xs"
              />
              <button
                onClick={() => {
                  if (selectedDate) {
                    addSkipDate(selectedDate);
                    setSelectedDate(null);
                  }
                }}
                disabled={!selectedDate}
                className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white text-[10px] font-medium disabled:opacity-50"
              >
                + Add
              </button>
              {skipDates.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {skipDates.map((date) => (
                    <span
                      key={date}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-600/30 text-red-400 rounded text-[10px]"
                    >
                      {formatDate(date)}
                      <button onClick={() => removeSkipDate(date)} className="hover:text-red-300">&times;</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* First Day Monitor */}
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={firstDayMonitor}
                onChange={(e) => setFirstDayMonitor(e.target.checked)}
                className="w-3 h-3 rounded border-gray-600 bg-slate-700 text-brand-cyan"
              />
              <span className="text-xs text-gray-400">First Day Monitor</span>
            </label>

            {/* Timezone */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Timezone:</span>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-white text-xs"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.id} value={tz.id}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Save Button */}
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-3 py-1 bg-brand-cyan hover:bg-brand-cyan/80 rounded text-slate-900 font-medium text-xs transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Calendar Panel (collapsible) */}
      {showCalendar && (
        <div className="flex-shrink-0 bg-slate-800/30 border-b border-slate-700 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
              className="p-1 hover:bg-slate-700 rounded text-gray-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-white font-medium text-sm">
              {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
              className="p-1 hover:bg-slate-700 rounded text-gray-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekdayNames.map((name) => (
              <div key={name} className="text-center text-xs text-gray-500 py-1">
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
                  className={`relative p-1.5 text-center rounded text-sm ${
                    !isCurrentMonth
                      ? 'text-gray-600'
                      : isSkipped
                        ? 'bg-red-900/30 text-red-400'
                        : isToday
                          ? 'bg-brand-cyan/20 text-brand-cyan font-medium'
                          : 'text-gray-300'
                  }`}
                >
                  {date.getDate()}
                  {scheduledCount > 0 && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] text-amber-400 font-bold">
                      {scheduledCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Notifications Panel (collapsible) */}
      {showNotifications && (
        <div className="flex-shrink-0 bg-slate-800/30 border-b border-slate-700 px-4 py-3">
          {/* Top Row: Notification Types + Save */}
          <div className="flex flex-wrap items-center gap-6 mb-3">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">Notify on:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifSettings.notify_on_failure}
                  onChange={(e) => setNotifSettings({ ...notifSettings, notify_on_failure: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-gray-600 bg-slate-700 text-brand-cyan"
                />
                <span className="text-xs text-gray-300">Failures</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifSettings.notify_on_missing_meta}
                  onChange={(e) => setNotifSettings({ ...notifSettings, notify_on_missing_meta: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-gray-600 bg-slate-700 text-brand-cyan"
                />
                <span className="text-xs text-gray-300">Missing Meta</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifSettings.notify_on_publish}
                  onChange={(e) => setNotifSettings({ ...notifSettings, notify_on_publish: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-gray-600 bg-slate-700 text-brand-cyan"
                />
                <span className="text-xs text-gray-300">Publishes</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifSettings.notify_queue_empty}
                  onChange={(e) => setNotifSettings({ ...notifSettings, notify_queue_empty: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-gray-600 bg-slate-700 text-brand-cyan"
                />
                <span className="text-xs text-gray-300">Queue Empty</span>
              </label>
            </div>
            <button
              onClick={saveNotificationSettings}
              className="px-3 py-1 bg-brand-cyan hover:bg-brand-cyan/80 rounded text-slate-900 font-medium text-sm"
            >
              Save
            </button>
          </div>

          {/* Two notification methods side by side */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Pushover Section ($5 app) */}
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifSettings.pushover_enabled}
                    onChange={(e) => setNotifSettings({ ...notifSettings, pushover_enabled: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 bg-slate-700 text-brand-cyan"
                  />
                  <span className="text-sm text-white font-medium">Pushover</span>
                </label>
                <span className="text-xs text-gray-500">($5 one-time)</span>
              </div>

              {/* Pushover Recipients */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {notifSettings.pushover_user_keys.map((user) => (
                  <div
                    key={user.key}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs ${
                      user.enabled ? 'bg-green-600/20 text-green-400' : 'bg-slate-700 text-gray-400'
                    }`}
                  >
                    <button onClick={() => togglePushoverUser(user.key)} className="hover:opacity-75">
                      {user.enabled ? '●' : '○'}
                    </button>
                    <span>{user.name}</span>
                    <button
                      onClick={() => testNotification(user.key)}
                      disabled={testingNotification}
                      className="px-1 py-0.5 bg-blue-600/30 hover:bg-blue-600/50 rounded text-blue-400"
                    >
                      Test
                    </button>
                    <button onClick={() => removePushoverUser(user.key)} className="text-red-400 hover:text-red-300">
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Pushover User */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Name"
                  className="w-20 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-white text-xs"
                />
                <input
                  type="text"
                  value={newUserKey}
                  onChange={(e) => setNewUserKey(e.target.value)}
                  placeholder="User Key"
                  className="flex-1 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-white text-xs font-mono"
                />
                <button
                  onClick={addPushoverUser}
                  disabled={!newUserKey.trim()}
                  className="px-2 py-0.5 bg-green-600 hover:bg-green-500 rounded text-white text-xs font-medium disabled:opacity-50"
                >
                  +
                </button>
              </div>
            </div>

            {/* Email-to-SMS Section (FREE) */}
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifSettings.email_sms_enabled}
                    onChange={(e) => setNotifSettings({ ...notifSettings, email_sms_enabled: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 bg-slate-700 text-brand-gold"
                  />
                  <span className="text-sm text-white font-medium">Email-to-SMS</span>
                </label>
                <span className="text-xs text-green-400">(FREE)</span>
              </div>

              {/* SMS Recipients */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {notifSettings.email_sms_recipients.map((recipient) => (
                  <div
                    key={recipient.phone}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs ${
                      recipient.enabled ? 'bg-brand-gold/20 text-brand-gold' : 'bg-slate-700 text-gray-400'
                    }`}
                  >
                    <button onClick={() => toggleSmsRecipient(recipient.phone)} className="hover:opacity-75">
                      {recipient.enabled ? '●' : '○'}
                    </button>
                    <span>{recipient.name}</span>
                    <span className="text-gray-500">({SMS_CARRIERS.find(c => c.id === recipient.carrier)?.name})</span>
                    <button
                      onClick={() => testSmsNotification(recipient.phone, recipient.carrier)}
                      disabled={testingSms}
                      className="px-1 py-0.5 bg-blue-600/30 hover:bg-blue-600/50 rounded text-blue-400"
                    >
                      Test
                    </button>
                    <button onClick={() => removeSmsRecipient(recipient.phone)} className="text-red-400 hover:text-red-300">
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Add SMS Recipient */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newSmsName}
                  onChange={(e) => setNewSmsName(e.target.value)}
                  placeholder="Name"
                  className="w-20 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-white text-xs"
                />
                <input
                  type="tel"
                  value={newSmsPhone}
                  onChange={(e) => setNewSmsPhone(e.target.value)}
                  placeholder="Phone (10 digits)"
                  className="w-28 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-white text-xs"
                />
                <select
                  value={newSmsCarrier}
                  onChange={(e) => setNewSmsCarrier(e.target.value)}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-white text-xs"
                >
                  {SMS_CARRIERS.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
                  ))}
                </select>
                <button
                  onClick={addSmsRecipient}
                  disabled={!newSmsPhone.trim()}
                  className="px-2 py-0.5 bg-brand-gold hover:bg-brand-gold/80 rounded text-slate-900 text-xs font-medium disabled:opacity-50"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Mode Panel */}
      {showTestMode && (
        <div className="flex-shrink-0 bg-orange-900/20 border-b border-orange-500/30 px-4 py-3">
          <div className="flex flex-wrap items-start gap-4">
            {/* Current Status */}
            <div className="bg-slate-900/50 rounded-lg p-3 min-w-[200px]">
              <div className="text-xs text-orange-400 font-semibold mb-2">Current Status</div>
              {testStatus ? (
                <div className="space-y-1 text-xs">
                  <div className="text-gray-300">
                    Time: <span className="text-white font-mono">{getCurrentTimeInTimezone()}</span>
                    <span className="text-gray-500 ml-1">({TIMEZONES.find(t => t.id === timezone)?.label || timezone})</span>
                  </div>
                  <div className="text-gray-300">
                    Pending: <span className="text-yellow-400">{testStatus.pendingCount}</span>
                  </div>
                  <div className="text-gray-300">
                    Due Now: <span className={testStatus.dueNowCount > 0 ? 'text-green-400' : 'text-gray-500'}>{testStatus.dueNowCount}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500">Loading...</div>
              )}
              <button
                onClick={fetchTestStatus}
                className="mt-2 text-xs text-orange-400 hover:text-orange-300"
              >
                Refresh
              </button>
            </div>

            {/* Quick Schedule Buttons */}
            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="text-xs text-orange-400 font-semibold mb-2">Quick Schedule Selected</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => scheduleTestArticles([1])}
                  disabled={schedulingTest || selectedTestArticles.length === 0}
                  className="px-3 py-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded text-white text-xs font-medium"
                >
                  1 min
                </button>
                <button
                  onClick={() => scheduleTestArticles([2])}
                  disabled={schedulingTest || selectedTestArticles.length === 0}
                  className="px-3 py-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded text-white text-xs font-medium"
                >
                  2 min
                </button>
                <button
                  onClick={() => scheduleTestArticles([1, 2, 3, 4])}
                  disabled={schedulingTest || selectedTestArticles.length < 2}
                  className="px-3 py-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded text-white text-xs font-medium"
                >
                  Staggered (1,2,3,4)
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {selectedTestArticles.length === 0
                  ? 'Select articles from queue below'
                  : `${selectedTestArticles.length} article(s) selected`}
              </div>
            </div>

            {/* Process Now Button */}
            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="text-xs text-orange-400 font-semibold mb-2">Manual Trigger</div>
              <button
                onClick={processNow}
                disabled={processingTest}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded text-white text-sm font-medium flex items-center gap-2"
              >
                {processingTest ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Process Now
                  </>
                )}
              </button>
              <div className="mt-1 text-xs text-gray-500">
                Publish all due articles immediately
              </div>
            </div>

            {/* Pending Articles - Horizontal scrolling */}
            {testStatus && testStatus.pending.length > 0 && (
              <div className="bg-slate-900/50 rounded-lg p-2 flex-1">
                <div className="text-xs text-orange-400 font-semibold mb-1">Pending ({testStatus.pendingCount})</div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {testStatus.pending.map((p) => {
                    // Extract time from scheduledFor (handles various formats)
                    const timeMatch = p.scheduledFor?.match(/(\d{1,2}:\d{2})/);
                    const displayTime = timeMatch ? formatTime(timeMatch[1]) : p.scheduledFor;

                    return (
                      <div
                        key={p.id}
                        className={`flex-shrink-0 flex items-center gap-2 text-xs px-2 py-1.5 rounded ${
                          p.isDueNow ? 'bg-green-600/20 text-green-400 border border-green-500/50' : 'bg-slate-800 text-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTestArticles.includes(p.articleId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTestArticles([...selectedTestArticles, p.articleId]);
                            } else {
                              setSelectedTestArticles(selectedTestArticles.filter(id => id !== p.articleId));
                            }
                          }}
                          className="w-3 h-3"
                        />
                        <span className={`font-mono ${p.isDueNow ? 'text-green-400' : 'text-amber-400'}`}>{displayTime}</span>
                        <span className="max-w-[150px] truncate text-white">{p.keyword || 'No keyword'}</span>
                        {p.isDueNow && <span className="bg-green-500 text-white px-1 rounded text-[10px] font-bold">DUE</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 text-xs text-gray-500">
            <strong className="text-orange-400">How to test:</strong> Select articles → Click time button → Click "Process Now" (publishes one at a time)
          </div>
        </div>
      )}

      {/* Main Content: Schedule Queue */}
      <div className="flex-1 overflow-auto p-4">
        {Object.keys(groupedSchedules).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(groupedSchedules)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, articles]) => {
                const isSkipped = skipWeekdays.includes(new Date(date + 'T00:00:00').getDay()) ||
                                 skipDates.includes(date);

                return (
                  <div key={date} className="bg-slate-800/50 rounded-lg overflow-hidden border border-slate-700/50">
                    <div className={`px-3 py-1.5 flex items-center justify-between ${
                      isSkipped ? 'bg-red-900/20' : 'bg-slate-700/50'
                    }`}>
                      <span className={`text-sm font-medium ${isSkipped ? 'text-red-400' : 'text-white'}`}>
                        {formatDate(date)}
                        {isSkipped && <span className="ml-2 text-xs opacity-75">SKIPPED</span>}
                      </span>
                      <span className="text-xs text-gray-400">{articles.length} article{articles.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="divide-y divide-slate-700/50">
                      {articles.map((article) => (
                        <div
                          key={article.id}
                          className="px-3 py-2 flex items-center justify-between hover:bg-slate-700/30"
                        >
                          <div className="flex items-center gap-3">
                            {/* Test Mode Checkbox */}
                            {showTestMode && article.status === 'pending' && (
                              <input
                                type="checkbox"
                                checked={selectedTestArticles.includes(article.article_id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTestArticles([...selectedTestArticles, article.article_id]);
                                  } else {
                                    setSelectedTestArticles(selectedTestArticles.filter(id => id !== article.article_id));
                                  }
                                }}
                                className="w-4 h-4 rounded border-orange-500 bg-slate-700 text-orange-500"
                              />
                            )}
                            <span className="text-xs text-gray-500 w-16">
                              {formatTime(article.scheduled_time)}
                            </span>
                            <span className="text-sm text-white">{article.keyword}</span>
                            {!article.selected_meta_title && (
                              <span className="px-1.5 py-0.5 bg-amber-600/30 text-amber-400 rounded text-[10px]">
                                No Meta
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              article.status === 'pending' ? 'bg-blue-600/30 text-blue-400' :
                              article.status === 'published' ? 'bg-green-600/30 text-green-400' :
                              article.status === 'failed' ? 'bg-red-600/30 text-red-400' :
                              'bg-gray-600/30 text-gray-400'
                            }`}>
                              {article.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {article.wp_post_url && (
                              <a
                                href={article.wp_post_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 bg-blue-600/30 hover:bg-blue-600/50 rounded text-blue-400 text-xs"
                              >
                                View
                              </a>
                            )}
                            {article.status === 'pending' && (
                              <button
                                onClick={() => removeFromSchedule(article.id)}
                                className="px-2 py-0.5 bg-red-600/30 hover:bg-red-600/50 rounded text-red-400 text-xs"
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
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
            <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>No articles scheduled</p>
            <p className="text-sm text-gray-600">Select articles in the Articles tab and click "Add to Drip Feed"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DripFeedView;
