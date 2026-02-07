-- PromptFlow Database Schema
-- Run this in Neon SQL Editor to create tables

-- ============================================
-- AGENCY MODE TABLES
-- ============================================

-- Clients table (agency clients/businesses)
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Locations table (physical business locations)
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(255),
  state VARCHAR(100),
  zip VARCHAR(20),
  country VARCHAR(100) DEFAULT 'USA',
  phone VARCHAR(50),
  -- Google Business Profile
  has_gbp BOOLEAN DEFAULT false,
  gbp_place_id VARCHAR(255),
  gbp_account_id VARCHAR(255),
  gbp_location_id VARCHAR(255),
  gbp_refresh_token TEXT, -- OAuth refresh token for API access
  gbp_primary_category VARCHAR(255),
  gbp_categories JSONB DEFAULT '[]', -- Array of category objects
  gbp_services JSONB DEFAULT '[]', -- Array of service items
  gbp_description TEXT,
  gbp_hours JSONB DEFAULT '{}', -- Regular hours object
  gbp_phone VARCHAR(50),
  gbp_website VARCHAR(500),
  gbp_data JSONB DEFAULT '{}', -- Full raw GBP data for reference
  gbp_last_synced TIMESTAMP,
  -- Custom placeholders for this location (beyond GBP data)
  custom_placeholders JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Websites table
CREATE TABLE IF NOT EXISTS websites (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500),
  -- WordPress credentials
  wp_url VARCHAR(500),
  wp_user VARCHAR(255),
  wp_app_password VARCHAR(255),
  -- Elementor integration
  elementor_connected BOOLEAN DEFAULT false,
  elementor_api_key VARCHAR(255),
  elementor_api_secret TEXT,
  -- Drip feed settings
  drip_feed_pages_per_day INTEGER DEFAULT 5,
  drip_feed_randomize BOOLEAN DEFAULT true,
  drip_feed_publish_time VARCHAR(10) DEFAULT '09:00',
  -- Elementor page settings
  elementor_cta_text VARCHAR(255) DEFAULT 'Book Now!',
  elementor_cta_url VARCHAR(500) DEFAULT '#',
  elementor_include_stats_bar BOOLEAN DEFAULT false,
  -- Image generation settings
  image_generation_enabled BOOLEAN DEFAULT false,
  image_provider VARCHAR(50) DEFAULT 'flux', -- flux, stability, dalle
  image_provider_api_key VARCHAR(255),
  -- Style DNA for consistent image generation
  image_style_dna JSONB DEFAULT '{}', -- Extracted style template and attributes
  image_reference_urls JSONB DEFAULT '[]', -- Reference images used for Style DNA
  images_per_article INTEGER DEFAULT 4,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Junction table: Locations <-> Websites (many-to-many)
CREATE TABLE IF NOT EXISTS location_websites (
  id SERIAL PRIMARY KEY,
  location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(location_id, website_id)
);

-- ============================================
-- PERSONAL PROJECTS MODE (non-agency)
-- Must be defined BEFORE workflows since workflows references it
-- ============================================

-- Personal projects (standalone, not linked to clients)
CREATE TABLE IF NOT EXISTS personal_projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  state JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflows table (prompt chains - linked to websites or standalone)
-- Each workflow = one full dashboard/prompt chain setup
CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  website_id INTEGER REFERENCES websites(id) ON DELETE SET NULL,
  personal_project_id INTEGER REFERENCES personal_projects(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  -- Full workflow state (prompts, placeholders, tags, snippets, settings)
  state JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Keep projects table for backwards compatibility (alias to workflows)
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  website_id INTEGER REFERENCES websites(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  state JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TEMPLATES (reusable at any level)
-- ============================================

CREATE TABLE IF NOT EXISTS templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  -- What level is this template for?
  template_type VARCHAR(50) NOT NULL, -- 'full_workflow', 'prompts', 'placeholders', 'tags', 'snippets', 'website_setup', 'client_setup'
  -- The actual template data (prompts, placeholders, snippets, etc.)
  template_data JSONB NOT NULL DEFAULT '{}',
  -- Which sections are included (for granular templates)
  includes JSONB DEFAULT '{"prompts": true, "placeholders": true, "tags": true, "snippets": true, "settings": true}',
  -- Tags for organization/search
  tags JSONB DEFAULT '[]',
  -- Scope: 'website' (available to workflows in same website) or 'app' (available to all websites)
  scope VARCHAR(20) DEFAULT 'website',
  -- For website-scoped templates, which website they belong to
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ARTICLES TABLE (stored outputs)
-- ============================================

-- Articles table (stores all generated content with full history)
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  -- Link to workflow and optionally website/client
  workflow_id INTEGER REFERENCES workflows(id) ON DELETE SET NULL,
  website_id INTEGER REFERENCES websites(id) ON DELETE SET NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  -- Article identification
  keyword VARCHAR(500) NOT NULL, -- The page keyword that started the chain
  tag VARCHAR(50), -- The audience tag (B, E, G, etc.) if applicable
  -- Final output
  final_content TEXT,
  meta_titles JSONB DEFAULT '[]', -- Array of generated meta titles
  meta_descriptions JSONB DEFAULT '[]', -- Array of generated meta descriptions
  -- All intermediate outputs from the chain
  chain_outputs JSONB DEFAULT '{}', -- {"output_1": "...", "output_2": "...", "output_3": "..."}
  -- AI detection results
  ai_score DECIMAL(5,2), -- 0.00 to 100.00
  word_count INTEGER,
  status VARCHAR(20) DEFAULT 'generated', -- 'generated', 'passed', 'flagged', 'edited', 'published'
  -- WordPress publishing
  wp_post_id INTEGER,
  wp_post_url VARCHAR(500),
  wp_published_at TIMESTAMP,
  -- Selected meta (user's final choice)
  selected_meta_title TEXT,
  selected_meta_description TEXT,
  meta_wp_pushed_at TIMESTAMP, -- When meta was pushed to WordPress
  images_wp_pushed_at TIMESTAMP, -- When images were pushed to WordPress
  -- Version tracking
  version INTEGER DEFAULT 1,
  parent_article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL, -- For version history
  -- AI-generated images
  generated_images JSONB DEFAULT '[]', -- Array of {url, prompt, placement, wpMediaId}
  -- Image decision report (for debugging/understanding AI choices)
  image_decision_report JSONB DEFAULT NULL, -- {mode, model, quality, images: [...]}
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- WORDPRESS PAGE HIERARCHY (for Site Map visualization)
-- ============================================

-- Cached WordPress page hierarchy for mind map/site map visualization
CREATE TABLE IF NOT EXISTS wp_page_hierarchy (
  id SERIAL PRIMARY KEY,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  wp_page_id INTEGER NOT NULL, -- WordPress page ID
  wp_parent_id INTEGER DEFAULT 0, -- Parent page ID (0 = top-level)
  title VARCHAR(500),
  slug VARCHAR(500),
  status VARCHAR(20) DEFAULT 'publish', -- publish, draft, private, etc.
  page_order INTEGER DEFAULT 0, -- Menu order from WordPress
  elementor_data JSONB DEFAULT NULL, -- Cached Elementor page structure
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(website_id, wp_page_id)
);

-- ============================================
-- GBP OAUTH TOKENS (for Google Business Profile API)
-- ============================================

CREATE TABLE IF NOT EXISTS gbp_oauth_tokens (
  id SERIAL PRIMARY KEY,
  location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expires_at TIMESTAMP,
  scope TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- IMAGE CREATION SETTINGS (per workflow)
-- ============================================

-- Image Creation settings for the "7. Image Creation" section
-- Can be linked to either workflow_id (legacy) or website_id (preferred - shared across workflows)
CREATE TABLE IF NOT EXISTS image_creation_settings (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE, -- When set, shared across all workflows in website
  -- Enable/disable image creation for this workflow
  enabled BOOLEAN DEFAULT false,
  -- LLM Models
  prompt_assistant_model VARCHAR(100) DEFAULT 'gpt-4o', -- Model for helping craft prompts (chat)
  image_generation_model VARCHAR(100) DEFAULT 'gpt-image-1.5', -- Model for generating images (gpt-image-1.5, dall-e-3, etc.)
  -- Reference images for style consistency
  reference_images JSONB DEFAULT '[]', -- Array of {url, filename, tags}
  -- Logo images (logo itself and action shots showing logo in use)
  logo_images JSONB DEFAULT '[]', -- Array of {url, filename, type: 'logo'|'action'}
  -- Audience avatars (each has own main prompt + variations, linked to Tag Manager)
  audience_avatars JSONB DEFAULT '[{"id": 1, "name": "Default", "mainPrompt": "", "variations": []}]',
  -- Pre-made image bank
  image_bank JSONB DEFAULT '[]', -- Array of {id, url, title, category, variation, avatarTag, orientation, prompt, createdAt}
  -- Custom categories for sorting uploaded images
  image_categories JSONB DEFAULT '["Hero", "Service", "Team", "Equipment", "Before/After", "Other"]',
  -- LLM auto-tagging for uploads
  auto_tag_enabled BOOLEAN DEFAULT true,
  -- Legacy chat history (for backwards compatibility)
  chat_history JSONB DEFAULT '[]', -- Array of {role, content, images?, timestamp}
  -- DUAL CHAT SYSTEM
  -- Consultant Chat: Strategic partner with vision for dialing in image style
  consultant_chat_history JSONB DEFAULT '[]', -- Array of {role, content, images?, timestamp}
  consultant_model VARCHAR(100) DEFAULT 'gpt-4o', -- Vision-capable model for consultant
  -- Worker Chat: Operational helper that sees consultant context + setup
  worker_chat_history JSONB DEFAULT '[]', -- Array of {role, content, images?, timestamp}
  worker_model VARCHAR(100) DEFAULT 'gpt-4o-mini', -- Can use cheaper model for operations
  -- Main Prompt AI Assistant (separate from Guided GPT assistant)
  main_prompt_chat_history JSONB DEFAULT '[]', -- Active chat messages
  main_prompt_chat_files JSONB DEFAULT '[]', -- Folder structure for organization
  main_prompt_chat_conversations JSONB DEFAULT '[]', -- Saved conversations
  main_prompt_chat_model VARCHAR(100) DEFAULT 'gpt-4o', -- Vision-capable model
  -- Cross-chat references for ping system between assistants
  chat_cross_references JSONB DEFAULT '[]', -- [{fromAssistant, toAssistant, conversationId, message, timestamp}]
  -- Page integration settings
  integration_mode VARCHAR(20) DEFAULT 'bank', -- 'live' or 'bank'
  fallback_to_live BOOLEAN DEFAULT true, -- Make from scratch if bank empty
  image_order JSONB DEFAULT '[]', -- Order of variation IDs for page placement
  -- Variation order settings
  variation_order_mode VARCHAR(20) DEFAULT 'sequential', -- 'sequential', 'random', 'manual'
  manual_variation_order JSONB DEFAULT '[]', -- Array of variation IDs in manual order
  -- Generate Live prompt mode settings
  live_prompt_mode VARCHAR(20) DEFAULT 'main_prompt', -- 'main_prompt', 'guided_gpt', or 'smart_prompt'
  fallback_prompt_mode VARCHAR(20) DEFAULT 'main_prompt', -- Prompt mode when bank fallback to live generation
  smart_prompt_guidance TEXT DEFAULT '', -- Guidance/guardrails for GPT-4o when using smart_prompt mode
  -- Guided GPT guardrails (instructions, uniformDescription, defaultSubject, avoidList)
  guided_guardrails JSONB DEFAULT '{}',
  -- Editable Smart Matching Rules (the 4 core rules)
  matching_rule_1 TEXT DEFAULT 'Always try to match Primary Keywords first. Search for primary keywords within the word range around image placement.',
  matching_rule_2 TEXT DEFAULT 'If no primary match, fall back to Secondary Keywords. Only if secondary keywords are enabled for that option.',
  matching_rule_3 TEXT DEFAULT 'Never use the same Primary Keyword twice on a page. Each primary keyword can only appear once per article (no duplicate stove images).',
  matching_rule_4 TEXT DEFAULT 'Secondary keyword matches must have different primaries. If "kitchen" matches twice, each must be a different primary (stove, then sink).',
  -- Smart Matching Config (configurable parameters that code ACTUALLY reads)
  smart_matching_config JSONB DEFAULT '{"wordRange": 75, "primaryWeight": 10, "secondaryWeight": 1}',
  -- Tag-based multi-prompt system for Guided GPT
  -- Array of {id, tag, name, guidance, guardrails, model, globalAppliesTo}
  guided_gpt_prompts JSONB DEFAULT '[]',
  -- Tag-based multi-prompt system for Smart/Legacy Prompt
  -- Array of {id, tag, name, guidance, globalAppliesTo}
  smart_prompt_prompts JSONB DEFAULT '[]',
  -- Tag-based rules for Guided GPT (similar to Smart Matching Rules)
  -- Array of {id, tag, title, text, order, globalAppliesTo}
  guided_gpt_rules JSONB DEFAULT '[]',
  -- Tag-based rules for Smart/Legacy Prompt
  -- Array of {id, tag, title, text, order, globalAppliesTo}
  legacy_prompt_rules JSONB DEFAULT '[]',
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns if they don't exist (for existing databases)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'live_prompt_mode') THEN
    ALTER TABLE image_creation_settings ADD COLUMN live_prompt_mode VARCHAR(20) DEFAULT 'main_prompt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'fallback_prompt_mode') THEN
    ALTER TABLE image_creation_settings ADD COLUMN fallback_prompt_mode VARCHAR(20) DEFAULT 'main_prompt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'smart_prompt_guidance') THEN
    ALTER TABLE image_creation_settings ADD COLUMN smart_prompt_guidance TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'guided_guardrails') THEN
    ALTER TABLE image_creation_settings ADD COLUMN guided_guardrails JSONB DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'image_decision_report') THEN
    ALTER TABLE articles ADD COLUMN image_decision_report JSONB DEFAULT NULL;
  END IF;
  -- Add editable matching rules columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'matching_rule_1') THEN
    ALTER TABLE image_creation_settings ADD COLUMN matching_rule_1 TEXT DEFAULT 'Always try to match Primary Keywords first. Search for primary keywords within the word range around image placement.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'matching_rule_2') THEN
    ALTER TABLE image_creation_settings ADD COLUMN matching_rule_2 TEXT DEFAULT 'If no primary match, fall back to Secondary Keywords. Only if secondary keywords are enabled for that option.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'matching_rule_3') THEN
    ALTER TABLE image_creation_settings ADD COLUMN matching_rule_3 TEXT DEFAULT 'Never use the same Primary Keyword twice on a page. Each primary keyword can only appear once per article (no duplicate stove images).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'matching_rule_4') THEN
    ALTER TABLE image_creation_settings ADD COLUMN matching_rule_4 TEXT DEFAULT 'Secondary keyword matches must have different primaries. If "kitchen" matches twice, each must be a different primary (stove, then sink).';
  END IF;
  -- Smart Matching Config (configurable parameters that code ACTUALLY reads)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'smart_matching_config') THEN
    ALTER TABLE image_creation_settings ADD COLUMN smart_matching_config JSONB DEFAULT '{"wordRange": 75, "primaryWeight": 10, "secondaryWeight": 1}';
  END IF;
  -- Tag-based multi-prompt system for Guided GPT
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'guided_gpt_prompts') THEN
    ALTER TABLE image_creation_settings ADD COLUMN guided_gpt_prompts JSONB DEFAULT '[]';
  END IF;
  -- Tag-based multi-prompt system for Smart/Legacy Prompt
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'smart_prompt_prompts') THEN
    ALTER TABLE image_creation_settings ADD COLUMN smart_prompt_prompts JSONB DEFAULT '[]';
  END IF;
  -- Tag-based rules for Guided GPT
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'guided_gpt_rules') THEN
    ALTER TABLE image_creation_settings ADD COLUMN guided_gpt_rules JSONB DEFAULT '[]';
  END IF;
  -- Tag-based rules for Smart/Legacy Prompt
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'legacy_prompt_rules') THEN
    ALTER TABLE image_creation_settings ADD COLUMN legacy_prompt_rules JSONB DEFAULT '[]';
  END IF;
  -- Prompt Templates for Template Library
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'prompt_templates') THEN
    ALTER TABLE image_creation_settings ADD COLUMN prompt_templates JSONB DEFAULT '[]';
  END IF;
  -- Text Snippets for Text Bank
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'text_snippets') THEN
    ALTER TABLE image_creation_settings ADD COLUMN text_snippets JSONB DEFAULT '[]';
  END IF;
  -- Category Templates for Placeholder Categories
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'category_templates') THEN
    ALTER TABLE image_creation_settings ADD COLUMN category_templates JSONB DEFAULT '[]';
  END IF;
  -- Prompt Problem Areas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'prompt_problem_areas') THEN
    ALTER TABLE image_creation_settings ADD COLUMN prompt_problem_areas JSONB DEFAULT '[]';
  END IF;
  -- Image Quality setting
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_creation_settings' AND column_name = 'image_quality') THEN
    ALTER TABLE image_creation_settings ADD COLUMN image_quality VARCHAR(20) DEFAULT 'low';
  END IF;
  -- Add scope to templates (website or app global)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'scope') THEN
    ALTER TABLE templates ADD COLUMN scope VARCHAR(20) DEFAULT 'website';
  END IF;
  -- Add website_id to templates for website-scoped templates
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'website_id') THEN
    ALTER TABLE templates ADD COLUMN website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- TEST MODE PRESETS
-- ============================================

-- Test presets for Test Mode - saved per workflow
CREATE TABLE IF NOT EXISTS test_presets (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]', -- Array of {articleMode, metaMode, imageMode, imageSource, keyword, tag}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by workflow
CREATE INDEX IF NOT EXISTS idx_test_presets_workflow ON test_presets(workflow_id);

-- ============================================
-- SITE PLANNING (Section 8 - The Site Truth)
-- ============================================

-- Site Plan - The master plan for a website's structure
CREATE TABLE IF NOT EXISTS site_plans (
  id SERIAL PRIMARY KEY,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  workflow_id INTEGER REFERENCES workflows(id) ON DELETE SET NULL,
  name VARCHAR(255) DEFAULT 'Site Structure',
  description TEXT,
  -- Settings
  auto_sync_check BOOLEAN DEFAULT true, -- Alert if WP structure differs from plan
  last_sync_check TIMESTAMP,
  sync_status VARCHAR(20) DEFAULT 'unknown', -- 'synced', 'differs', 'unknown'
  -- Metadata
  total_pages INTEGER DEFAULT 0,
  max_depth INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Site Plan Nodes - Individual pages/nodes in the site structure
CREATE TABLE IF NOT EXISTS site_plan_nodes (
  id SERIAL PRIMARY KEY,
  site_plan_id INTEGER REFERENCES site_plans(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES site_plan_nodes(id) ON DELETE CASCADE, -- NULL = root node
  -- Page info
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255),
  page_type VARCHAR(50) DEFAULT 'page', -- 'page', 'post', 'category', 'landing', 'service', 'location', 'blog'
  -- Status tracking
  status VARCHAR(20) DEFAULT 'planned', -- 'planned', 'in_progress', 'built', 'published', 'needs_update'
  wp_page_id INTEGER, -- Linked WordPress page ID once built
  wp_post_url VARCHAR(500),
  -- Content planning
  target_keyword VARCHAR(255),
  meta_title VARCHAR(255),
  meta_description TEXT,
  content_brief TEXT,
  assigned_article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
  -- Position in tree
  sort_order INTEGER DEFAULT 0,
  depth INTEGER DEFAULT 0, -- 0 = root, 1 = first level, etc.
  -- SEO/Structure
  is_pillar_page BOOLEAN DEFAULT false, -- Main category/pillar page
  is_in_menu BOOLEAN DEFAULT true,
  menu_order INTEGER,
  -- Phase 2: Prompt Assignment
  bank_first BOOLEAN DEFAULT false, -- Check image bank before generating
  assigned_mode VARCHAR(20), -- 'main_prompt', 'guided_gpt', 'smart_prompt'
  assigned_prompt_id VARCHAR(10), -- Specific prompt ID: 'H1', 'H2', 'J1', 'Global1', etc.
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  built_at TIMESTAMP, -- When page was actually created in WP
  published_at TIMESTAMP
);

-- ============================================
-- DRAFT IMAGE BANK (In-transit images for pages)
-- ============================================

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

-- ============================================
-- LINK POOL (SEO Link Management - Phase 7)
-- ============================================

-- Link Pool - stores all outbound and internal links per website
CREATE TABLE IF NOT EXISTS link_pool (
  id SERIAL PRIMARY KEY,
  website_id INTEGER NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  anchor_text VARCHAR(255),
  description TEXT,
  link_type VARCHAR(20) DEFAULT 'outbound',
  status VARCHAR(20) DEFAULT 'pending',
  assigned_article_id INTEGER REFERENCES articles(id),
  used_on_article_id INTEGER REFERENCES articles(id),
  rel_attribute VARCHAR(50) DEFAULT 'noopener',
  target VARCHAR(20) DEFAULT '_blank',
  discovery_run INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_link_pool_website ON link_pool(website_id);
CREATE INDEX IF NOT EXISTS idx_link_pool_status ON link_pool(status);
CREATE INDEX IF NOT EXISTS idx_link_pool_assigned ON link_pool(assigned_article_id);

-- Link discovery settings on websites table
-- ALTER TABLE websites ADD COLUMN link_discovery_prompt TEXT;
-- ALTER TABLE websites ADD COLUMN link_discovery_model VARCHAR(100) DEFAULT 'claude-sonnet-4-5-20250929';
-- ALTER TABLE websites ADD COLUMN link_discovery_count INTEGER DEFAULT 70;
-- ALTER TABLE websites ADD COLUMN links_per_page INTEGER DEFAULT 1;
-- ALTER TABLE websites ADD COLUMN link_discovery_runs INTEGER DEFAULT 0;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_image_creation_workflow ON image_creation_settings(workflow_id);
CREATE INDEX IF NOT EXISTS idx_draft_image_bank_workflow ON draft_image_bank(workflow_id);
CREATE INDEX IF NOT EXISTS idx_draft_image_bank_article ON draft_image_bank(article_id);
CREATE INDEX IF NOT EXISTS idx_draft_image_bank_status ON draft_image_bank(status);
CREATE INDEX IF NOT EXISTS idx_draft_image_bank_item_type ON draft_image_bank(item_type);
CREATE INDEX IF NOT EXISTS idx_draft_image_bank_category ON draft_image_bank(item_category);
CREATE INDEX IF NOT EXISTS idx_draft_image_bank_avatar ON draft_image_bank(avatar_tag);
CREATE INDEX IF NOT EXISTS idx_draft_image_bank_page ON draft_image_bank(page_keyword);
CREATE INDEX IF NOT EXISTS idx_site_plans_website ON site_plans(website_id);
CREATE INDEX IF NOT EXISTS idx_site_plans_workflow ON site_plans(workflow_id);
CREATE INDEX IF NOT EXISTS idx_site_plan_nodes_plan ON site_plan_nodes(site_plan_id);
CREATE INDEX IF NOT EXISTS idx_site_plan_nodes_parent ON site_plan_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_site_plan_nodes_wp_page ON site_plan_nodes(wp_page_id);
CREATE INDEX IF NOT EXISTS idx_locations_client_id ON locations(client_id);
CREATE INDEX IF NOT EXISTS idx_websites_client_id ON websites(client_id);
CREATE INDEX IF NOT EXISTS idx_workflows_client_id ON workflows(client_id);
CREATE INDEX IF NOT EXISTS idx_workflows_website_id ON workflows(website_id);
CREATE INDEX IF NOT EXISTS idx_workflows_personal_project_id ON workflows(personal_project_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_website_id ON projects(website_id);
CREATE INDEX IF NOT EXISTS idx_location_websites_location ON location_websites(location_id);
CREATE INDEX IF NOT EXISTS idx_location_websites_website ON location_websites(website_id);
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(template_type);
CREATE INDEX IF NOT EXISTS idx_articles_workflow_id ON articles(workflow_id);
CREATE INDEX IF NOT EXISTS idx_articles_website_id ON articles(website_id);
CREATE INDEX IF NOT EXISTS idx_articles_client_id ON articles(client_id);
CREATE INDEX IF NOT EXISTS idx_articles_keyword ON articles(keyword);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_gbp_oauth_location ON gbp_oauth_tokens(location_id);
CREATE INDEX IF NOT EXISTS idx_wp_hierarchy_website ON wp_page_hierarchy(website_id);
CREATE INDEX IF NOT EXISTS idx_wp_hierarchy_parent ON wp_page_hierarchy(wp_parent_id);


-- ============================================
-- MIGRATIONS: Add columns if they don't exist
-- ============================================

-- Add meta tracking columns to articles table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='selected_meta_title') THEN
        ALTER TABLE articles ADD COLUMN selected_meta_title TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='selected_meta_description') THEN
        ALTER TABLE articles ADD COLUMN selected_meta_description TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='meta_wp_pushed_at') THEN
        ALTER TABLE articles ADD COLUMN meta_wp_pushed_at TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='images_wp_pushed_at') THEN
        ALTER TABLE articles ADD COLUMN images_wp_pushed_at TIMESTAMP;
    END IF;
END
$$;
