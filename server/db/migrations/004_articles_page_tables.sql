-- Migration 004: Articles Page Tables
-- Adds tables for image version tracking and WordPress page hierarchy caching
-- Run this in Neon SQL Editor to add the new tables

-- ============================================
-- IMAGE VERSIONS TABLE
-- Tracks history of image replacements in articles
-- ============================================

CREATE TABLE IF NOT EXISTS image_versions (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  elementor_widget_id VARCHAR(50) NOT NULL,  -- 8-char hex ID from Elementor widget
  version INTEGER DEFAULT 1,
  image_url TEXT NOT NULL,
  wp_media_id INTEGER,                       -- WordPress media library ID if uploaded
  image_prompt TEXT,                         -- AI prompt used to generate (if AI-generated)
  replacement_source VARCHAR(50) DEFAULT 'upload', -- 'upload', 'ai_generated', 'url'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- WORDPRESS PAGE HIERARCHY TABLE
-- Caches page structure for mind map visualization
-- ============================================

CREATE TABLE IF NOT EXISTS wp_page_hierarchy (
  id SERIAL PRIMARY KEY,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  wp_page_id INTEGER NOT NULL,               -- WordPress page ID
  wp_parent_id INTEGER DEFAULT 0,            -- Parent page ID (0 = top level)
  title VARCHAR(500),
  slug VARCHAR(500),
  status VARCHAR(50) DEFAULT 'publish',      -- publish, draft, private, etc.
  page_order INTEGER DEFAULT 0,              -- Menu order
  elementor_data JSONB,                      -- Cached Elementor structure for overlay mapping
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(website_id, wp_page_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_image_versions_article ON image_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_image_versions_widget ON image_versions(elementor_widget_id);
CREATE INDEX IF NOT EXISTS idx_wp_hierarchy_website ON wp_page_hierarchy(website_id);
CREATE INDEX IF NOT EXISTS idx_wp_hierarchy_parent ON wp_page_hierarchy(wp_parent_id);
