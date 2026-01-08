-- Migration 012: Add website_id to image_creation_settings for website-level sharing
-- This allows Image Creation settings to be shared across all workflows in a website
-- Run this in Neon SQL Editor

-- Add website_id column (nullable - allows both workflow-level and website-level settings)
ALTER TABLE image_creation_settings
ADD COLUMN IF NOT EXISTS website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE;

-- Create unique constraint for website_id (one settings record per website)
-- Note: We keep workflow_id for backwards compatibility, but new records should use website_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_image_creation_website_unique
ON image_creation_settings(website_id) WHERE website_id IS NOT NULL;

-- Add index for faster lookups by website
CREATE INDEX IF NOT EXISTS idx_image_creation_website ON image_creation_settings(website_id);

-- Add comment explaining the dual mode
COMMENT ON COLUMN image_creation_settings.website_id IS 'When set, this settings record is shared across all workflows in the website. When null, uses workflow_id for legacy per-workflow settings.';
