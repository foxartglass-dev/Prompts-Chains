-- Migration 025: Add Version History table
-- Stores version history for avatars, placeholders, prompts, and rules
-- Run this SQL in your Neon database console

CREATE TABLE IF NOT EXISTS version_history (
  id SERIAL PRIMARY KEY,

  -- Scope
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,

  -- What type of entity this is
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
    'avatar',
    'placeholder',
    'guided_gpt_prompt',
    'guided_gpt_rule',
    'smart_prompt_prompt',
    'smart_prompt_rule'
  )),

  -- Identifier for the specific entity (e.g., avatar name, placeholder letter)
  entity_id VARCHAR(255) NOT NULL,

  -- Human-readable name for the version
  version_name VARCHAR(255),

  -- The content at this point in time (JSONB for flexibility)
  content JSONB NOT NULL,

  -- Optional notes about this version
  notes TEXT,

  -- Who/what created this version
  created_by VARCHAR(100) DEFAULT 'manual',  -- 'manual', 'auto-save', 'ai-assistant'

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_version_history_website ON version_history(website_id);
CREATE INDEX IF NOT EXISTS idx_version_history_workflow ON version_history(workflow_id);
CREATE INDEX IF NOT EXISTS idx_version_history_entity ON version_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_version_history_created ON version_history(created_at DESC);
