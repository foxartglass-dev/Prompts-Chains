-- Add Pushover columns to notification_settings
-- This migration adds support for Pushover push notifications

-- Add new columns (if they don't exist)
DO $$
BEGIN
  -- Add pushover_enabled
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'pushover_enabled') THEN
    ALTER TABLE notification_settings ADD COLUMN pushover_enabled BOOLEAN DEFAULT false;
  END IF;

  -- Add pushover_user_keys (array of recipients)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'pushover_user_keys') THEN
    ALTER TABLE notification_settings ADD COLUMN pushover_user_keys JSONB DEFAULT '[]';
  END IF;

  -- Add notification type toggles
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'notify_on_publish') THEN
    ALTER TABLE notification_settings ADD COLUMN notify_on_publish BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'notify_on_failure') THEN
    ALTER TABLE notification_settings ADD COLUMN notify_on_failure BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'notify_on_missing_meta') THEN
    ALTER TABLE notification_settings ADD COLUMN notify_on_missing_meta BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'notify_daily_summary') THEN
    ALTER TABLE notification_settings ADD COLUMN notify_daily_summary BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'notify_queue_empty') THEN
    ALTER TABLE notification_settings ADD COLUMN notify_queue_empty BOOLEAN DEFAULT true;
  END IF;
END $$;
