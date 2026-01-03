-- Migration 008: Add global settings table
-- Purpose: Store account-level settings like Local Viking API key
-- Local Viking API key is per-account, not per-website

-- Global settings table (singleton - only one row)
CREATE TABLE IF NOT EXISTS global_settings (
  id SERIAL PRIMARY KEY,
  -- Local Viking API key (account level, not per-website)
  local_viking_api_key VARCHAR(255),
  -- Future global settings can be added here
  -- e.g., default_timezone, notification_email, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert the initial row if it doesn't exist
INSERT INTO global_settings (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM global_settings WHERE id = 1);

-- Create index
CREATE INDEX IF NOT EXISTS idx_global_settings_id ON global_settings(id);
