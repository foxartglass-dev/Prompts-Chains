-- Migration 035: Add calibration system
-- Stores calibration entries (image quality rules) and version tracking.
-- Entries are injected as a "Calibration Pack" into image generation prompts.
-- Each entry has a model_instruction (drop-in line for AI) and human_note (for user).

ALTER TABLE image_creation_settings
  ADD COLUMN IF NOT EXISTS calibration_entries JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS calibration_version INTEGER DEFAULT 0;
