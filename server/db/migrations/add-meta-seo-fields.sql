-- Migration: Add meta SEO selection and plugin fields
-- Run this in Neon SQL Editor to add the new columns

-- ============================================
-- ARTICLES TABLE: Meta selection tracking
-- ============================================

-- Selected meta title (the one user chose from options, or custom)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS selected_meta_title TEXT;

-- Selected meta description (the one user chose from options, or custom)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS selected_meta_description TEXT;

-- Meta SEO status: tracks the workflow state
-- 'pending' = has options but user hasn't chosen yet
-- 'selected' = user has chosen but not pushed to SEO plugin
-- 'pushed' = successfully pushed to SEO plugin
ALTER TABLE articles ADD COLUMN IF NOT EXISTS meta_seo_status VARCHAR(20) DEFAULT 'pending';

-- Timestamp when meta was pushed to SEO plugin
ALTER TABLE articles ADD COLUMN IF NOT EXISTS meta_pushed_at TIMESTAMP;

-- ============================================
-- WEBSITES TABLE: SEO plugin configuration
-- ============================================

-- Which SEO plugin this website uses
-- Options: 'yoast', 'rankmath', 'aioseo', 'seopress', 'none'
ALTER TABLE websites ADD COLUMN IF NOT EXISTS seo_plugin VARCHAR(50) DEFAULT 'yoast';

-- Whether to auto-push meta after AI selection (when toggle is on)
ALTER TABLE websites ADD COLUMN IF NOT EXISTS seo_auto_push BOOLEAN DEFAULT false;

-- ============================================
-- INDEX for finding pending meta selections
-- ============================================

CREATE INDEX IF NOT EXISTS idx_articles_meta_seo_status ON articles(meta_seo_status);
