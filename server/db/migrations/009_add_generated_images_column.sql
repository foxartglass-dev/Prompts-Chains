-- Migration 009: Add generated_images column to articles table
-- This stores the array of generated images for each article
-- Run this in Neon SQL Editor

-- Add generated_images column to articles table
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS generated_images JSONB DEFAULT '[]';

-- Add comment explaining the structure
COMMENT ON COLUMN articles.generated_images IS 'Array of {id, url, prompt, placement, wpMediaId, createdAt, pushedToWp}';
