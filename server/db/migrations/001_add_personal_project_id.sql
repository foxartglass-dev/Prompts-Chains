-- Migration: Add personal_project_id to workflows table
-- Run this if you have an existing database that needs updating

-- Add the column (this will fail silently if it already exists due to IF NOT EXISTS workaround)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflows' AND column_name = 'personal_project_id'
  ) THEN
    ALTER TABLE workflows ADD COLUMN personal_project_id INTEGER REFERENCES personal_projects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add the index
CREATE INDEX IF NOT EXISTS idx_workflows_personal_project_id ON workflows(personal_project_id);
