-- Migration 010: Add missing columns to articles table
-- These columns are required for the article publish flow to work correctly
-- Run this SQL directly in Neon SQL Editor or via psql

-- Add image_decision_report column (stores AI image selection decisions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'image_decision_report'
  ) THEN
    ALTER TABLE articles ADD COLUMN image_decision_report JSONB DEFAULT NULL;
    RAISE NOTICE 'Added image_decision_report column';
  END IF;
END $$;

-- Add article_push_auto_at column (timestamp of auto push)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'article_push_auto_at'
  ) THEN
    ALTER TABLE articles ADD COLUMN article_push_auto_at TIMESTAMP;
    RAISE NOTICE 'Added article_push_auto_at column';
  END IF;
END $$;

-- Add article_push_manual_count column (count of manual pushes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'article_push_manual_count'
  ) THEN
    ALTER TABLE articles ADD COLUMN article_push_manual_count INTEGER DEFAULT 0;
    RAISE NOTICE 'Added article_push_manual_count column';
  END IF;
END $$;

-- Add article_push_manual_dates column (array of manual push timestamps)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'article_push_manual_dates'
  ) THEN
    ALTER TABLE articles ADD COLUMN article_push_manual_dates JSONB DEFAULT '[]';
    RAISE NOTICE 'Added article_push_manual_dates column';
  END IF;
END $$;

-- Simple version (run these if DO blocks don't work):
-- ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_decision_report JSONB DEFAULT NULL;
-- ALTER TABLE articles ADD COLUMN IF NOT EXISTS article_push_auto_at TIMESTAMP;
-- ALTER TABLE articles ADD COLUMN IF NOT EXISTS article_push_manual_count INTEGER DEFAULT 0;
-- ALTER TABLE articles ADD COLUMN IF NOT EXISTS article_push_manual_dates JSONB DEFAULT '[]';
