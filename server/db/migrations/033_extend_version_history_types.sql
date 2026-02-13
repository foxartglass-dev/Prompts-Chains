-- Migration 033: Extend version_history entity_type CHECK constraint
-- Adds new entity types to support version history for all prompt fields:
--   main_prompt, guardrails, smart_prompt_guidance, legacy_prompt_rule, categories, matching_rule
-- Also adds composite index for efficient querying with retention policy

-- Drop the existing CHECK constraint and recreate with expanded types
-- PostgreSQL doesn't support ALTER CHECK directly, so we drop and re-add
ALTER TABLE version_history DROP CONSTRAINT IF EXISTS version_history_entity_type_check;

ALTER TABLE version_history ADD CONSTRAINT version_history_entity_type_check
  CHECK (entity_type IN (
    'avatar',
    'placeholder',
    'guided_gpt_prompt',
    'guided_gpt_rule',
    'smart_prompt_prompt',
    'smart_prompt_rule',
    'main_prompt',
    'guardrails',
    'smart_prompt_guidance',
    'legacy_prompt_rule',
    'categories',
    'matching_rule',
    'main_prompt_persistent',
    'guided_instructions_persistent',
    'smart_prompt_persistent'
  ));

-- Add composite index for efficient querying with retention policy (newest first)
CREATE INDEX IF NOT EXISTS idx_version_history_entity_date
  ON version_history(entity_type, entity_id, created_at DESC);
