-- Migration 010: Add image_decision_report column to articles table
-- This column stores AI image selection decisions for debugging/auditing
-- Run this SQL directly in Neon SQL Editor or via psql

-- Check if column exists and add if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles'
    AND column_name = 'image_decision_report'
  ) THEN
    ALTER TABLE articles ADD COLUMN image_decision_report JSONB DEFAULT NULL;
    RAISE NOTICE 'Added image_decision_report column to articles table';
  ELSE
    RAISE NOTICE 'image_decision_report column already exists';
  END IF;
END $$;

-- Simple ALTER version (use if the DO block doesn't work):
-- ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_decision_report JSONB DEFAULT NULL;
