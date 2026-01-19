-- Migration 021: Add template and snippet columns for prompt persistence
-- Run this SQL in your Neon database console

-- Prompt Templates: User-saved prompt templates for reuse
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS prompt_templates JSONB DEFAULT '[]'::jsonb;

-- Text Snippets: Reusable text snippets organized by category
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS text_snippets JSONB DEFAULT '[]'::jsonb;

-- Category Templates: Placeholder category templates for image matching
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS category_templates JSONB DEFAULT '[]'::jsonb;

-- Prompt Problem Areas: Problem areas for guided prompts
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS prompt_problem_areas JSONB DEFAULT '[]'::jsonb;

-- Image Quality: low/medium/high setting for generated images
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS image_quality VARCHAR(20) DEFAULT 'low';
