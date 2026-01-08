-- Migration 010: Create draft_image_bank table
-- This stores in-transit images for pages before they're sent to client website
-- Run this in Neon SQL Editor

-- Draft Image Bank Items table
CREATE TABLE IF NOT EXISTS draft_image_bank (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,

  -- Image data (wpUrl only, never base64)
  url VARCHAR(1000) NOT NULL, -- WordPress media URL (wpUrl)
  wp_media_id INTEGER, -- WordPress media library ID

  -- Tagging for sorting/filtering
  item_type VARCHAR(100), -- Primary keyword/subject (e.g., "kitchen sink", "oven")
  item_category VARCHAR(100), -- Category grouping (e.g., "Kitchen", "Bathroom")
  avatar_tag VARCHAR(50), -- Linked audience avatar tag (e.g., "B", "E", "G")
  page_keyword VARCHAR(255), -- The page keyword this image is for
  page_title VARCHAR(255), -- The page/article title

  -- Prompt data
  prompt TEXT, -- The prompt used to generate this image
  model VARCHAR(100), -- Image generation model used
  placement VARCHAR(50), -- Where in page (hero, body, footer)

  -- Status tracking
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'sent', 'replaced'
  replaced_by INTEGER REFERENCES draft_image_bank(id) ON DELETE SET NULL, -- Points to replacement image

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP, -- When pushed to client site
  replaced_at TIMESTAMP, -- When this image was replaced

  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Workflow-level stats table for tracking made/replaced counts
CREATE TABLE IF NOT EXISTS draft_image_bank_stats (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE UNIQUE,
  total_made INTEGER DEFAULT 0, -- Total images generated
  total_replaced INTEGER DEFAULT 0, -- Total images that were replaced/ditched
  total_sent INTEGER DEFAULT 0, -- Total images sent to client site
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_draft_image_bank_workflow ON draft_image_bank(workflow_id);
CREATE INDEX IF NOT EXISTS idx_draft_image_bank_article ON draft_image_bank(article_id);
CREATE INDEX IF NOT EXISTS idx_draft_image_bank_status ON draft_image_bank(status);
CREATE INDEX IF NOT EXISTS idx_draft_image_bank_item_type ON draft_image_bank(item_type);
CREATE INDEX IF NOT EXISTS idx_draft_image_bank_category ON draft_image_bank(item_category);
CREATE INDEX IF NOT EXISTS idx_draft_image_bank_avatar ON draft_image_bank(avatar_tag);
CREATE INDEX IF NOT EXISTS idx_draft_image_bank_page ON draft_image_bank(page_keyword);

-- Comments
COMMENT ON TABLE draft_image_bank IS 'In-transit images for pages before sent to client site';
COMMENT ON COLUMN draft_image_bank.status IS 'draft = in-transit, sent = pushed to client, replaced = ditched for new image';
COMMENT ON COLUMN draft_image_bank.replaced_by IS 'If status=replaced, points to the new image that replaced this one';
COMMENT ON TABLE draft_image_bank_stats IS 'Workflow-level counters for tracking generation efficiency';
