-- Migration 024: Add Prompt Library table
-- Stores reusable prompts and rules for Guided GPT and Smart Prompt modes
-- Supports website-level (default) and global scope

CREATE TABLE IF NOT EXISTS prompt_library (
  id SERIAL PRIMARY KEY,

  -- Scope: website_id = NULL means global, otherwise website-specific
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  is_global BOOLEAN DEFAULT false,

  -- Type: 'prompt' or 'rule'
  type VARCHAR(20) NOT NULL CHECK (type IN ('prompt', 'rule')),

  -- Mode: 'guided_gpt' or 'smart_prompt'
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('guided_gpt', 'smart_prompt')),

  -- Content
  name VARCHAR(255) NOT NULL,
  description TEXT,
  content TEXT NOT NULL,

  -- Metadata
  tag VARCHAR(10),  -- H, J, C, or Global
  tags TEXT[],      -- Additional tags for categorization

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_prompt_library_website ON prompt_library(website_id);
CREATE INDEX IF NOT EXISTS idx_prompt_library_global ON prompt_library(is_global) WHERE is_global = true;
CREATE INDEX IF NOT EXISTS idx_prompt_library_type_mode ON prompt_library(type, mode);
