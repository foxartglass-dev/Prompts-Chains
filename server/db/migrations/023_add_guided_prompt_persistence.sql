-- Migration 023: Add Guided GPT and Smart Prompt persistence columns
-- These columns store the prompts and rules for Generate Live mode
-- Run this SQL in your Neon database console

-- Guided GPT Prompts: Tag-based prompts for Guided GPT mode
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS guided_gpt_prompts JSONB DEFAULT '[]'::jsonb;

-- Smart Prompt Prompts: Tag-based prompts for Smart Prompt (legacy) mode
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS smart_prompt_prompts JSONB DEFAULT '[]'::jsonb;

-- Guided GPT Rules: Tag-based rules for Guided GPT mode
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS guided_gpt_rules JSONB DEFAULT '[]'::jsonb;

-- Legacy Prompt Rules: Tag-based rules for Smart Prompt mode
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS legacy_prompt_rules JSONB DEFAULT '[]'::jsonb;
