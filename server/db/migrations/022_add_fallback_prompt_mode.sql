-- Migration 022: Add fallback_prompt_mode column
-- This column controls which prompt source to use when bank is empty and falls back to live generation

DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'fallback_prompt_mode') THEN
    ALTER TABLE image_creation_settings ADD COLUMN fallback_prompt_mode VARCHAR(20) DEFAULT 'main_prompt';
    RAISE NOTICE 'Added fallback_prompt_mode column';
  ELSE
    RAISE NOTICE 'fallback_prompt_mode column already exists, skipping';
  END IF;
END $;
