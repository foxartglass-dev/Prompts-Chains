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
  -- Version tracking
  version INTEGER DEFAULT 1,
  parent_article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL, -- For version history
  -- AI-generated images
  generated_images JSONB DEFAULT '[]', -- Array of {url, prompt, placement, wpMediaId}
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
CREATE TABLE IF NOT EXISTS image_creation_settings (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE UNIQUE,
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
  -- Page integration settings
  integration_mode VARCHAR(20) DEFAULT 'bank', -- 'live' or 'bank'
  fallback_to_live BOOLEAN DEFAULT true, -- Make from scratch if bank empty
  image_order JSONB DEFAULT '[]', -- Order of variation IDs for page placement
  -- Variation order settings
  variation_order_mode VARCHAR(20) DEFAULT 'sequential', -- 'sequential', 'random', 'manual'
  manual_variation_order JSONB DEFAULT '[]', -- Array of variation IDs in manual order
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_image_creation_workflow ON image_creation_settings(workflow_id);
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
