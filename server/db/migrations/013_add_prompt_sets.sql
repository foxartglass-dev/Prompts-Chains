-- Migration 013: Add prompt_sets column for multiple prompt collections
-- Allows creating additional prompt sets beyond the main audience avatars
-- (e.g., Universal prompts for landmarks, neighborhood images, etc.)
-- Run this in Neon SQL Editor

-- Add prompt_sets JSONB column
ALTER TABLE image_creation_settings
ADD COLUMN IF NOT EXISTS prompt_sets JSONB DEFAULT '[]';

-- Add comment explaining the structure
COMMENT ON COLUMN image_creation_settings.prompt_sets IS 'Array of PromptSet objects: {id, name, isUniversal, universalPrompt?, avatars, description?}. Allows multiple prompt collections beyond main avatars.';
