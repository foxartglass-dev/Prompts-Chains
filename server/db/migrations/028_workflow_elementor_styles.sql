-- Migration: Add workflow_elementor_styles table
-- Purpose: Store extracted Elementor styles per workflow for consistent page generation
-- Each workflow can have its own page template/styling

CREATE TABLE IF NOT EXISTS workflow_elementor_styles (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

  -- Source page info
  source_page_id INTEGER,           -- WordPress page ID we copied from
  source_page_url TEXT,             -- URL of the source page
  source_page_title TEXT,           -- Title of the source page for reference

  -- Button styles
  button_background_color TEXT,
  button_text_color TEXT,
  button_border_radius TEXT,
  button_padding JSONB,             -- {top, right, bottom, left}
  button_typography JSONB,          -- {font_family, font_size, font_weight, etc}

  -- Heading styles
  h1_color TEXT,
  h1_typography JSONB,
  h2_color TEXT,
  h2_typography JSONB,
  h3_color TEXT,
  h3_typography JSONB,

  -- Body text styles
  text_color TEXT,
  text_typography JSONB,            -- {font_family, font_size, line_height, etc}

  -- Container/Layout styles
  container_padding JSONB,
  section_gap TEXT,
  content_width INTEGER,            -- boxed width in pixels (e.g., 1140)

  -- Hero section specific
  hero_padding JSONB,
  hero_gap TEXT,

  -- Image styles
  image_border_radius TEXT,
  image_max_width TEXT,
  image_float_margin TEXT,

  -- Stats bar (if present)
  stats_background_color TEXT,
  stats_gradient JSONB,             -- {color_a, color_b, angle}
  stats_padding JSONB,

  -- Raw backup - the complete extracted data
  raw_elementor_data JSONB,
  extracted_styles JSONB,           -- Full extracted style object

  -- Status
  status VARCHAR(20) DEFAULT 'active',  -- active, archived

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookup by workflow
CREATE INDEX IF NOT EXISTS idx_workflow_elementor_styles_workflow
ON workflow_elementor_styles(workflow_id);

-- Only one active style per workflow
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_elementor_styles_active
ON workflow_elementor_styles(workflow_id)
WHERE status = 'active';

-- Comment explaining the table
COMMENT ON TABLE workflow_elementor_styles IS
'Stores extracted Elementor page styles per workflow. Allows users to copy styling from an existing WordPress page and apply it to all generated pages in that workflow.';
