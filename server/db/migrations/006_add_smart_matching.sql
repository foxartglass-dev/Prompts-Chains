-- Migration 006: Add smart content matching columns
-- This adds support for AI-driven content-aware image selection

-- Add smart_matching_enabled column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'image_creation_settings'
        AND column_name = 'smart_matching_enabled'
    ) THEN
        ALTER TABLE image_creation_settings
        ADD COLUMN smart_matching_enabled BOOLEAN DEFAULT false;

        RAISE NOTICE 'Added smart_matching_enabled column to image_creation_settings';
    ELSE
        RAISE NOTICE 'Column smart_matching_enabled already exists';
    END IF;
END $$;

-- Add smart_matching_mode column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'image_creation_settings'
        AND column_name = 'smart_matching_mode'
    ) THEN
        ALTER TABLE image_creation_settings
        ADD COLUMN smart_matching_mode VARCHAR(50) DEFAULT 'bank_first';

        RAISE NOTICE 'Added smart_matching_mode column to image_creation_settings';
    ELSE
        RAISE NOTICE 'Column smart_matching_mode already exists';
    END IF;
END $$;

-- Update comments
COMMENT ON COLUMN image_creation_settings.smart_matching_enabled IS 'Enable AI content-aware image matching for SEO optimization';
COMMENT ON COLUMN image_creation_settings.smart_matching_mode IS 'Mode: bank_first (check bank, generate if no match), generate_first (always generate), bank_only (no generation), generate_only (always new)';
