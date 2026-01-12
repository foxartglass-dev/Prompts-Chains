-- Drip Feed System Tables
-- Comprehensive scheduling system for auto-publishing articles to WordPress

-- ============================================
-- DRIP FEED SETTINGS (per-website configuration)
-- ============================================
CREATE TABLE IF NOT EXISTS drip_feed_settings (
  id SERIAL PRIMARY KEY,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE UNIQUE,

  -- Articles per day with variance
  articles_per_day INTEGER DEFAULT 7,
  variance_enabled BOOLEAN DEFAULT true,
  variance_min INTEGER DEFAULT 6,
  variance_max INTEGER DEFAULT 8,

  -- Publish time window
  publish_time_start TIME DEFAULT '07:00',
  publish_time_end TIME DEFAULT '19:00',

  -- Skip days configuration
  skip_weekdays JSONB DEFAULT '[]',        -- Array of weekday numbers [0,6] for Sun, Sat
  skip_dates JSONB DEFAULT '[]',           -- Array of date strings ["2026-01-20", "2026-12-25"]

  -- Notification settings
  notification_hours JSONB DEFAULT '[24, 12, 6]',  -- Hours before publish to notify if meta not chosen

  -- First day monitor
  first_day_monitor BOOLEAN DEFAULT true,

  -- Master toggle
  is_enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- DRIP FEED SCHEDULES (the hopper - individual article schedules)
-- ============================================
CREATE TABLE IF NOT EXISTS drip_feed_schedules (
  id SERIAL PRIMARY KEY,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE UNIQUE,

  -- Scheduling
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  scheduled_datetime TIMESTAMP GENERATED ALWAYS AS (scheduled_date + scheduled_time) STORED,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending',    -- pending, publishing, published, failed, cancelled

  -- WordPress tracking
  wp_post_id INTEGER,
  wp_post_url TEXT,

  -- Execution tracking
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP,
  published_at TIMESTAMP,
  error_message TEXT,

  -- Manual override
  is_manual_time BOOLEAN DEFAULT false,    -- User manually set this time (don't auto-adjust)

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient querying of due articles
CREATE INDEX IF NOT EXISTS idx_drip_schedules_due
ON drip_feed_schedules(scheduled_datetime, status)
WHERE status = 'pending';

-- Index for website lookups
CREATE INDEX IF NOT EXISTS idx_drip_schedules_website
ON drip_feed_schedules(website_id, scheduled_date);

-- ============================================
-- DRIP FEED NOTIFICATIONS (notification log and custom watches)
-- ============================================
CREATE TABLE IF NOT EXISTS drip_feed_notifications (
  id SERIAL PRIMARY KEY,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  schedule_id INTEGER REFERENCES drip_feed_schedules(id) ON DELETE CASCADE,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,

  -- Notification type
  type VARCHAR(50) NOT NULL,               -- meta_not_chosen, publish_failed, first_day, custom_watch

  -- Content
  title VARCHAR(255) NOT NULL,
  message TEXT,

  -- Status
  status VARCHAR(20) DEFAULT 'pending',    -- pending, sent, dismissed, snoozed

  -- Timing
  notify_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  snooze_until TIMESTAMP,

  -- Channels used
  channels_sent JSONB DEFAULT '[]',        -- ["toast", "browser", "sms"]

  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for pending notifications
CREATE INDEX IF NOT EXISTS idx_drip_notifications_pending
ON drip_feed_notifications(notify_at, status)
WHERE status = 'pending';

-- ============================================
-- CUSTOM WATCHES (user-defined notification groups)
-- ============================================
CREATE TABLE IF NOT EXISTS drip_feed_watches (
  id SERIAL PRIMARY KEY,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,

  -- Watch configuration
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Which articles to watch (array of schedule IDs)
  schedule_ids JSONB DEFAULT '[]',

  -- When to notify (minutes relative to scheduled time)
  -- Negative = before, Positive = after, 0 = at publish time
  notify_offsets JSONB DEFAULT '[-30, 0, 15]',  -- 30 min before, at time, 15 min after

  -- Which channels
  channels JSONB DEFAULT '["toast"]',      -- ["toast", "browser", "sms"]

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- NOTIFICATION SETTINGS (global user preferences)
-- ============================================
CREATE TABLE IF NOT EXISTS notification_settings (
  id SERIAL PRIMARY KEY,

  -- Channel toggles
  toast_enabled BOOLEAN DEFAULT true,
  browser_enabled BOOLEAN DEFAULT false,

  -- Pushover configuration (push notifications - $5 one-time)
  pushover_enabled BOOLEAN DEFAULT false,
  pushover_user_keys JSONB DEFAULT '[]',   -- Array of { key, name, enabled } for multiple recipients

  -- What to notify about
  notify_on_publish BOOLEAN DEFAULT false, -- Notify on successful publish
  notify_on_failure BOOLEAN DEFAULT true,  -- Notify on publish failure
  notify_on_missing_meta BOOLEAN DEFAULT true,  -- Notify when meta not selected before publish
  notify_daily_summary BOOLEAN DEFAULT false,   -- Daily summary of drip feed activity
  notify_queue_empty BOOLEAN DEFAULT true,      -- Notify when queue is empty

  -- Error notification settings
  error_repeat_interval INTEGER DEFAULT 5, -- Minutes between repeat error notifications

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default notification settings if not exists
INSERT INTO notification_settings (id, pushover_enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DRIP FEED EXECUTION LOG (audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS drip_feed_log (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES drip_feed_schedules(id) ON DELETE SET NULL,
  website_id INTEGER REFERENCES websites(id) ON DELETE SET NULL,
  article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,

  -- What happened
  action VARCHAR(50) NOT NULL,             -- scheduled, published, failed, retried, cancelled

  -- Details
  details JSONB,
  error_message TEXT,

  -- WordPress response
  wp_response JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for log lookups
CREATE INDEX IF NOT EXISTS idx_drip_log_website
ON drip_feed_log(website_id, created_at DESC);
