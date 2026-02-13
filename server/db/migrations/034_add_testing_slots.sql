-- Migration 034: Add testing slots system
-- Allows users to create numbered/named test versions of prompt content
-- without affecting the live/main prompts. Slots can be promoted to main.

ALTER TABLE image_creation_settings
  ADD COLUMN IF NOT EXISTS testing_slots JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS active_testing_slot VARCHAR(255) DEFAULT NULL;
