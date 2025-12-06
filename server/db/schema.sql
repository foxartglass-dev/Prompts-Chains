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
  -- Google Business Profile
  has_gbp BOOLEAN DEFAULT false,
  gbp_place_id VARCHAR(255),
  gbp_categories JSONB DEFAULT '[]',
  gbp_data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Websites table
CREATE TABLE IF NOT EXISTS websites (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500),
  wp_url VARCHAR(500),
  wp_user VARCHAR(255),
  wp_app_password VARCHAR(255),
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

-- Projects/Workflows table (linked to websites or standalone)
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
-- PERSONAL PROJECTS MODE (non-agency)
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

-- ============================================
-- TEMPLATES (reusable at any level)
-- ============================================

CREATE TABLE IF NOT EXISTS templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  -- What level is this template for?
  template_type VARCHAR(50) NOT NULL, -- 'client', 'location', 'website', 'project', 'workflow'
  -- The actual template data (prompts, placeholders, snippets, etc.)
  template_data JSONB NOT NULL DEFAULT '{}',
  -- Tags for organization
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_locations_client_id ON locations(client_id);
CREATE INDEX IF NOT EXISTS idx_websites_client_id ON websites(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_website_id ON projects(website_id);
CREATE INDEX IF NOT EXISTS idx_location_websites_location ON location_websites(location_id);
CREATE INDEX IF NOT EXISTS idx_location_websites_website ON location_websites(website_id);
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(template_type);
