-- Migration 019: Reverse Image System
-- Allows reverse-engineering prompts from reference images
-- Includes: Projects, Conversations, Messages, Templates, Prompt Drafts, Image-Prompt Pairs
-- Run this in Neon SQL Editor

-- ============================================
-- REVERSE IMAGE PROJECTS (per website)
-- ============================================

CREATE TABLE IF NOT EXISTS reverse_image_projects (
  id SERIAL PRIMARY KEY,
  website_id INTEGER NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  -- Settings
  default_model VARCHAR(100) DEFAULT 'gpt-5.2', -- Vision model for analysis
  image_model VARCHAR(100) DEFAULT 'gpt-image-1.5', -- Image generation model for testing
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CONVERSATIONS (multiple chat stations per project)
-- ============================================

CREATE TABLE IF NOT EXISTS reverse_image_conversations (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES reverse_image_projects(id) ON DELETE CASCADE,
  name VARCHAR(255) DEFAULT 'Untitled',
  purpose TEXT, -- e.g., "Worker photos", "Interior shots", "Logo testing"
  -- Processing settings
  process_order VARCHAR(20) DEFAULT 'image_first', -- 'image_first' or 'bank_first'
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MESSAGES (persistent chat history)
-- ============================================

CREATE TABLE IF NOT EXISTS reverse_image_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES reverse_image_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT,
  -- Attached images (for user messages with reference images)
  images JSONB DEFAULT '[]', -- Array of {url, base64, filename}
  -- Generated prompt output (for assistant messages)
  generated_prompt JSONB DEFAULT NULL, -- {sections: [{id, title, content, enabled}], fullPrompt: "..."}
  -- Generated test image (if requested)
  test_image JSONB DEFAULT NULL, -- {url, wpUrl, prompt}
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROMPT TEMPLATES (with editable sections)
-- ============================================

CREATE TABLE IF NOT EXISTS reverse_image_templates (
  id SERIAL PRIMARY KEY,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE, -- NULL = global baseline
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_baseline BOOLEAN DEFAULT FALSE, -- System-wide baseline template
  -- Template sections
  sections JSONB NOT NULL DEFAULT '[
    {"id": "lighting", "title": "Lighting", "content": "", "enabled": true, "order": 1},
    {"id": "subject", "title": "Subject/Worker", "content": "", "enabled": true, "order": 2},
    {"id": "eyes", "title": "Eyes/Face", "content": "", "enabled": true, "order": 3},
    {"id": "logo", "title": "Logo/Branding", "content": "", "enabled": true, "order": 4},
    {"id": "environment", "title": "Environment/Setting", "content": "", "enabled": true, "order": 5},
    {"id": "composition", "title": "Composition/Framing", "content": "", "enabled": true, "order": 6},
    {"id": "style", "title": "Style/Mood", "content": "", "enabled": true, "order": 7},
    {"id": "technical", "title": "Technical Details", "content": "", "enabled": true, "order": 8}
  ]',
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROMPT DRAFTS (version control board)
-- ============================================

CREATE TABLE IF NOT EXISTS reverse_image_drafts (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES reverse_image_conversations(id) ON DELETE CASCADE,
  -- Auto-incrementing draft number within conversation
  draft_number INTEGER NOT NULL,
  -- Tag for filtering/sorting (e.g., "lighting", "logo", "eyes")
  tag VARCHAR(100),
  -- Optional description/note
  description TEXT,
  -- The prompt content (can be full text or sections)
  prompt_text TEXT NOT NULL,
  prompt_sections JSONB DEFAULT NULL, -- Structured {sections: [...]}
  -- Default status
  is_default BOOLEAN DEFAULT FALSE,
  default_label VARCHAR(100), -- e.g., "Default 1", "Final Logo Version"
  -- Associated test image (if generated)
  test_image_url TEXT,
  test_image_wp_url TEXT,
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROMPT-IMAGE PAIRS (training database)
-- ============================================

CREATE TABLE IF NOT EXISTS prompt_image_pairs (
  id SERIAL PRIMARY KEY,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE, -- NULL = global
  -- Image data
  image_url TEXT NOT NULL,
  image_thumbnail TEXT,
  wp_media_id INTEGER,
  -- Prompt data
  prompt TEXT NOT NULL,
  prompt_sections JSONB DEFAULT NULL, -- Parsed into sections if available
  -- Categorization
  tags JSONB DEFAULT '[]', -- For filtering: ["interior", "worker", "cleaning", "kitchen"]
  category VARCHAR(100), -- Primary category
  -- Source tracking
  source VARCHAR(50) DEFAULT 'manual', -- 'generated', 'imported', 'manual', 'article'
  source_article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
  -- Quality/usage tracking
  quality_score INTEGER, -- 1-5 rating
  times_used INTEGER DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ri_projects_website ON reverse_image_projects(website_id);
CREATE INDEX IF NOT EXISTS idx_ri_conversations_project ON reverse_image_conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_ri_messages_conversation ON reverse_image_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ri_templates_website ON reverse_image_templates(website_id);
CREATE INDEX IF NOT EXISTS idx_ri_templates_baseline ON reverse_image_templates(is_baseline);
CREATE INDEX IF NOT EXISTS idx_ri_drafts_conversation ON reverse_image_drafts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ri_drafts_tag ON reverse_image_drafts(tag);
CREATE INDEX IF NOT EXISTS idx_ri_drafts_default ON reverse_image_drafts(is_default);
CREATE INDEX IF NOT EXISTS idx_pip_website ON prompt_image_pairs(website_id);
CREATE INDEX IF NOT EXISTS idx_pip_category ON prompt_image_pairs(category);
CREATE INDEX IF NOT EXISTS idx_pip_source ON prompt_image_pairs(source);

-- ============================================
-- INSERT DEFAULT BASELINE TEMPLATE
-- ============================================

INSERT INTO reverse_image_templates (name, description, is_baseline, sections)
VALUES (
  'Default Baseline',
  'Standard template for reverse-engineering prompts from images. Covers all major aspects of image generation.',
  TRUE,
  '[
    {"id": "lighting", "title": "Lighting", "content": "Describe the lighting: natural/artificial, direction, intensity, color temperature, shadows", "enabled": true, "order": 1},
    {"id": "subject", "title": "Subject/Worker", "content": "Describe the main subject: person, object, action, pose, clothing, expression", "enabled": true, "order": 2},
    {"id": "eyes", "title": "Eyes/Face", "content": "Eyes clearly visible and open, natural expression, looking at camera or task. Avoid closed eyes or unnatural stares.", "enabled": true, "order": 3},
    {"id": "logo", "title": "Logo/Branding", "content": "Logo placement, size, visibility. Uniform/shirt details if applicable.", "enabled": true, "order": 4},
    {"id": "environment", "title": "Environment/Setting", "content": "Background, location, props, atmosphere, context", "enabled": true, "order": 5},
    {"id": "composition", "title": "Composition/Framing", "content": "Camera angle, distance, focal point, rule of thirds, depth of field", "enabled": true, "order": 6},
    {"id": "style", "title": "Style/Mood", "content": "Overall aesthetic, mood, color palette, photographic style", "enabled": true, "order": 7},
    {"id": "technical", "title": "Technical Details", "content": "Resolution, aspect ratio, quality level, any specific technical requirements", "enabled": true, "order": 8}
  ]'
)
ON CONFLICT DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE reverse_image_projects IS 'Projects for reverse-engineering prompts from images, organized per website';
COMMENT ON TABLE reverse_image_conversations IS 'Chat stations within a project - each can work on different image types';
COMMENT ON TABLE reverse_image_messages IS 'Persistent chat history with GPT-5.2 for prompt refinement';
COMMENT ON TABLE reverse_image_templates IS 'Reusable prompt templates with editable sections';
COMMENT ON TABLE reverse_image_drafts IS 'Version-controlled prompt drafts with tags for organizing iterations';
COMMENT ON TABLE prompt_image_pairs IS 'Training database of successful prompt+image pairs for reference';
