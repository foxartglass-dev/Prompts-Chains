-- Migration 032: Add persistent prompt portion columns
-- These columns store the "All Tags" shared prompt text that appears
-- below the unique per-tag prompt in each prompt mode's text area.
-- Run this SQL in your Neon database console

-- Main Prompt: persistent portion shared across all avatar tags
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS main_prompt_persistent TEXT DEFAULT '';

-- Guided GPT: persistent instructions/guardrails shared across all tags
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS guided_instructions_persistent TEXT DEFAULT '';

-- Smart Prompt: persistent guidance shared across all tags
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS smart_prompt_persistent TEXT DEFAULT '';
