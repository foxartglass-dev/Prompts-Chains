-- Migration 005: Add image_generation_model column
-- This adds support for selecting different image generation models (gpt-image-1.5, dall-e-3, etc.)

-- Add the image_generation_model column to image_creation_settings if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'image_creation_settings'
        AND column_name = 'image_generation_model'
    ) THEN
        ALTER TABLE image_creation_settings
        ADD COLUMN image_generation_model VARCHAR(100) DEFAULT 'gpt-image-1.5';

        RAISE NOTICE 'Added image_generation_model column to image_creation_settings';
    ELSE
        RAISE NOTICE 'Column image_generation_model already exists';
    END IF;
END $$;

-- Update comment
COMMENT ON COLUMN image_creation_settings.image_generation_model IS 'Model for generating images (gpt-image-1.5, gpt-image-1, dall-e-3, flux, etc.)';
