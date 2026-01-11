-- Add timezone column to drip_feed_settings
-- This allows users to configure their local timezone for accurate scheduling

ALTER TABLE drip_feed_settings
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Chicago';

-- Comment explaining the column
COMMENT ON COLUMN drip_feed_settings.timezone IS 'IANA timezone string (e.g., America/Chicago, America/New_York, UTC)';
