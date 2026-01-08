-- Migration 011: Add guided_guardrails column for Guided GPT settings persistence
-- This stores the guardrails object (instructions, uniformDescription, defaultSubject, avoidList)
-- Run this in Neon SQL Editor

-- Add guided_guardrails JSONB column
ALTER TABLE image_creation_settings
ADD COLUMN IF NOT EXISTS guided_guardrails JSONB DEFAULT '{}';

-- Add comment explaining the structure
COMMENT ON COLUMN image_creation_settings.guided_guardrails IS 'Object containing {instructions, uniformDescription, defaultSubject, avoidList} for Guided GPT mode';
