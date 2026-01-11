-- Add Email-to-SMS columns to notification_settings
-- This migration adds support for free SMS notifications via carrier email gateways

-- Add new columns (if they don't exist)
DO $$
BEGIN
  -- Add email_sms_enabled
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'email_sms_enabled') THEN
    ALTER TABLE notification_settings ADD COLUMN email_sms_enabled BOOLEAN DEFAULT false;
  END IF;

  -- Add email_sms_recipients (array of recipients with phone, carrier, name, enabled)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_settings' AND column_name = 'email_sms_recipients') THEN
    ALTER TABLE notification_settings ADD COLUMN email_sms_recipients JSONB DEFAULT '[]';
  END IF;

  -- Example format for email_sms_recipients:
  -- [
  --   { "phone": "5551234567", "carrier": "verizon", "name": "John", "enabled": true },
  --   { "phone": "5559876543", "carrier": "att", "name": "Jane", "enabled": true }
  -- ]
  --
  -- Supported carriers:
  -- verizon, att, tmobile, sprint, uscellular, boost, cricket, metropcs, googlefi, mint, visible

END $$;
