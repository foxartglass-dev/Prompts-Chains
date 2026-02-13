-- Migration 033: Add unified chat system columns
-- Merges 3 separate chat systems into one shared conversation
-- with Set Scope grid for granular context control

ALTER TABLE image_creation_settings
  ADD COLUMN IF NOT EXISTS unified_chat_history JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS unified_chat_conversations JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS unified_chat_files JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS chat_scope_selections JSONB DEFAULT '[]';
