-- Component Library: Reusable Elementor sections for page generation
-- Captures sliders, stats bars, benefit sections from existing pages
-- Injects them into generated articles based on audience tags (H, J, C)

-- Main component library table
CREATE TABLE IF NOT EXISTS component_library (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

  -- Slot assignment (1=TOP, 2=MIDDLE, 3=BOTTOM)
  slot_number INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 3),
  slot_name VARCHAR(100),  -- "Hero Slider", "Stats Bar", "Benefits"

  -- Component type and reference
  -- 'slider_revolution' = shortcode widget with alias
  -- 'elementor_template' = template widget with template_id
  component_type VARCHAR(50) NOT NULL,
  component_ref VARCHAR(200) NOT NULL,  -- alias for sliders, template_id for templates

  -- Audience tagging (H, J, C, or NULL for global)
  tag VARCHAR(10),

  -- Display info
  name VARCHAR(200) NOT NULL,  -- User-friendly name shown in UI

  -- Source tracking
  source_page_id INTEGER,
  source_page_url TEXT,

  -- Rotation ordering
  sort_order INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups during page generation
CREATE INDEX IF NOT EXISTS idx_component_library_lookup
ON component_library(workflow_id, slot_number, tag) WHERE is_active = true;

-- Index for workflow listing
CREATE INDEX IF NOT EXISTS idx_component_library_workflow
ON component_library(workflow_id);

-- Rotation state tracking (per slot, tracks which component was used last)
CREATE TABLE IF NOT EXISTS component_rotation_state (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,
  tag VARCHAR(10),  -- NULL for global rotation
  last_used_component_id INTEGER REFERENCES component_library(id) ON DELETE SET NULL,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workflow_id, slot_number, tag)
);

-- Component library settings per workflow
-- Stored as JSONB column on workflows table for simplicity
-- Default structure:
-- {
--   "enabled": false,
--   "slots": [
--     {"number": 1, "name": "Hero/Slider", "position": "top", "rotation": "sequential"},
--     {"number": 2, "name": "Stats Bar", "position": "middle", "rotation": "sequential"},
--     {"number": 3, "name": "Benefits", "position": "bottom", "rotation": "sequential"}
--   ]
-- }

-- Add component_settings column to workflows if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflows' AND column_name = 'component_settings'
  ) THEN
    ALTER TABLE workflows ADD COLUMN component_settings JSONB DEFAULT '{
      "enabled": false,
      "slots": [
        {"number": 1, "name": "Hero/Slider", "position": "top", "rotation": "sequential"},
        {"number": 2, "name": "Stats Bar", "position": "middle", "rotation": "sequential"},
        {"number": 3, "name": "Benefits", "position": "bottom", "rotation": "sequential"}
      ]
    }';
  END IF;
END $$;
