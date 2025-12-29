-- Migration: Add live_prompt_mode and smart_prompt_guidance columns
-- These columns support the "Main Prompt vs Smart Prompt" toggle in Generate Live mode

-- Add live_prompt_mode column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'live_prompt_mode') THEN
    ALTER TABLE image_creation_settings ADD COLUMN live_prompt_mode VARCHAR(20) DEFAULT 'smart_prompt';
    RAISE NOTICE 'Added live_prompt_mode column';
  END IF;
END $$;

-- Add smart_prompt_guidance column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'smart_prompt_guidance') THEN
    ALTER TABLE image_creation_settings ADD COLUMN smart_prompt_guidance TEXT DEFAULT '';
    RAISE NOTICE 'Added smart_prompt_guidance column';
  END IF;
END $$;

-- Add matching rules columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'matching_rule_1') THEN
    ALTER TABLE image_creation_settings ADD COLUMN matching_rule_1 TEXT DEFAULT 'Always try to match Primary Keywords first. Search for primary keywords within the word range around image placement.';
    RAISE NOTICE 'Added matching_rule_1 column';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'matching_rule_2') THEN
    ALTER TABLE image_creation_settings ADD COLUMN matching_rule_2 TEXT DEFAULT 'If no primary match, fall back to Secondary Keywords. Only if secondary keywords are enabled for that option.';
    RAISE NOTICE 'Added matching_rule_2 column';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'matching_rule_3') THEN
    ALTER TABLE image_creation_settings ADD COLUMN matching_rule_3 TEXT DEFAULT 'Never use the same Primary Keyword twice on a page. Each primary keyword can only appear once per article (no duplicate stove images).';
    RAISE NOTICE 'Added matching_rule_3 column';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'matching_rule_4') THEN
    ALTER TABLE image_creation_settings ADD COLUMN matching_rule_4 TEXT DEFAULT 'Secondary keyword matches must have different primaries. If "kitchen" matches twice, each must be a different primary (stove, then sink).';
    RAISE NOTICE 'Added matching_rule_4 column';
  END IF;
END $$;

-- Add image_decision_report column to articles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'image_decision_report') THEN
    ALTER TABLE articles ADD COLUMN image_decision_report JSONB DEFAULT NULL;
    RAISE NOTICE 'Added image_decision_report column to articles';
  END IF;
END $$;
