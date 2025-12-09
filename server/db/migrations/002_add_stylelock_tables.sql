-- StyleLock Database Tables Migration
-- Run this in Neon SQL Editor to add StyleLock support

-- ============================================
-- STYLELOCK SETTINGS TABLE
-- Global settings with per-website overrides
-- ============================================

CREATE TABLE IF NOT EXISTS stylelock_settings (
  id SERIAL PRIMARY KEY,
  -- Scope: NULL for global, website_id for per-website override
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  -- Settings name (e.g., 'default', 'conservative', 'aggressive')
  preset_name VARCHAR(50) DEFAULT 'custom',
  -- Full settings JSON
  settings JSONB NOT NULL DEFAULT '{}',
  -- Is this the active setting for its scope?
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Only one active setting per scope
  UNIQUE(website_id, is_active) WHERE is_active = TRUE
);

-- ============================================
-- STYLELOCK JOBS TABLE
-- Track all StyleLock job runs for history/analytics
-- ============================================

CREATE TABLE IF NOT EXISTS stylelock_jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(20) UNIQUE NOT NULL, -- Short UUID from engine
  -- Links
  website_id INTEGER REFERENCES websites(id) ON DELETE SET NULL,
  niche_id INTEGER, -- Will reference stylelock_niches when created
  article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
  -- Job configuration
  target_description TEXT NOT NULL,
  reference_images JSONB DEFAULT '[]',
  uniform_config JSONB DEFAULT '{}',
  settings_used JSONB DEFAULT '{}', -- Snapshot of settings used
  -- Results
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, complete, failed, cancelled
  tier VARCHAR(20), -- PERFECT, GOOD_ENOUGH, PARTIAL, FAILED
  final_score DECIMAL(5,2),
  winning_prompt TEXT,
  winning_image_url VARCHAR(1000),
  style_dna JSONB DEFAULT '{}',
  blind_test_passed BOOLEAN DEFAULT false,
  -- Progress tracking
  current_round INTEGER DEFAULT 0,
  total_rounds INTEGER,
  progress_log JSONB DEFAULT '[]', -- Array of progress events
  -- Costs
  total_cost DECIMAL(8,4),
  cost_breakdown JSONB DEFAULT '{}',
  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  -- Error tracking
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- STYLELOCK NICHES TABLE
-- Niche declarations with locked prompts
-- ============================================

CREATE TABLE IF NOT EXISTS stylelock_niches (
  id SERIAL PRIMARY KEY,
  -- Niche identification
  name VARCHAR(255) NOT NULL,
  description TEXT,
  -- Environment category (in-home, in-yard, in-office, on-site-field, commercial)
  environment VARCHAR(50) NOT NULL,
  -- Style lock status
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMP,
  -- Locked prompt template (when niche is solved)
  locked_prompt TEXT,
  locked_style_dna JSONB DEFAULT '{}',
  -- Reference images used to solve this niche
  reference_images JSONB DEFAULT '[]',
  -- Best job that locked this niche
  locked_by_job_id INTEGER REFERENCES stylelock_jobs(id) ON DELETE SET NULL,
  -- Quality metrics at lock time
  lock_score DECIMAL(5,2),
  lock_tier VARCHAR(20),
  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  -- Tags for organization
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key for niche_id in stylelock_jobs
ALTER TABLE stylelock_jobs
ADD CONSTRAINT fk_stylelock_jobs_niche
FOREIGN KEY (niche_id) REFERENCES stylelock_niches(id) ON DELETE SET NULL;

-- ============================================
-- STYLELOCK PROMPT BANK TABLE
-- Shared prompt templates across niches
-- ============================================

CREATE TABLE IF NOT EXISTS stylelock_prompt_bank (
  id SERIAL PRIMARY KEY,
  -- Prompt content
  prompt_template TEXT NOT NULL,
  -- The action/subject this prompt is for
  action_description VARCHAR(500) NOT NULL,
  -- Which niche created/locked this prompt
  niche_id INTEGER REFERENCES stylelock_niches(id) ON DELETE SET NULL,
  -- Style DNA this prompt was created with
  style_dna JSONB DEFAULT '{}',
  -- Quality score when this prompt was locked
  score DECIMAL(5,2),
  tier VARCHAR(20),
  -- Environment type
  environment VARCHAR(50),
  -- Tags for searchability
  tags JSONB DEFAULT '[]',
  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  average_score DECIMAL(5,2),
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- COST TRACKING TABLE
-- Detailed cost tracking per entity
-- ============================================

CREATE TABLE IF NOT EXISTS stylelock_costs (
  id SERIAL PRIMARY KEY,
  -- Entity being tracked
  entity_type VARCHAR(50) NOT NULL, -- 'job', 'article', 'website', 'client', 'niche'
  entity_id INTEGER NOT NULL,
  -- Cost details
  cost_type VARCHAR(50) NOT NULL, -- 'style_dna', 'prompt_gen', 'image_gen', 'voting', 'blind_test'
  amount DECIMAL(8,4) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  -- What generated this cost
  model_used VARCHAR(50),
  tokens_input INTEGER,
  tokens_output INTEGER,
  -- Timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_stylelock_settings_website ON stylelock_settings(website_id);
CREATE INDEX IF NOT EXISTS idx_stylelock_settings_active ON stylelock_settings(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_stylelock_jobs_website ON stylelock_jobs(website_id);
CREATE INDEX IF NOT EXISTS idx_stylelock_jobs_status ON stylelock_jobs(status);
CREATE INDEX IF NOT EXISTS idx_stylelock_jobs_job_id ON stylelock_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_stylelock_niches_environment ON stylelock_niches(environment);
CREATE INDEX IF NOT EXISTS idx_stylelock_niches_locked ON stylelock_niches(is_locked);
CREATE INDEX IF NOT EXISTS idx_stylelock_prompt_bank_niche ON stylelock_prompt_bank(niche_id);
CREATE INDEX IF NOT EXISTS idx_stylelock_prompt_bank_env ON stylelock_prompt_bank(environment);
CREATE INDEX IF NOT EXISTS idx_stylelock_costs_entity ON stylelock_costs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_stylelock_costs_type ON stylelock_costs(cost_type);

-- ============================================
-- SEED DEFAULT SETTINGS PRESETS
-- ============================================

-- Global conservative preset (lower cost, fewer rounds)
INSERT INTO stylelock_settings (website_id, preset_name, settings, is_active) VALUES (
  NULL,
  'conservative',
  '{
    "generation": {"numGenerators": 2, "maxRounds": 5},
    "voting": {"numVoters": 3, "advanceThreshold": 80},
    "blindTest": {"numJudges": 3, "passThreshold": 0.5},
    "limits": {"maxCost": 2.00}
  }',
  false
);

-- Global balanced preset (default)
INSERT INTO stylelock_settings (website_id, preset_name, settings, is_active) VALUES (
  NULL,
  'balanced',
  '{
    "generation": {"numGenerators": 3, "maxRounds": 10},
    "voting": {"numVoters": 3, "advanceThreshold": 85},
    "blindTest": {"numJudges": 3, "passThreshold": 0.66},
    "limits": {"maxCost": 5.00}
  }',
  true
);

-- Global aggressive preset (higher quality, more cost)
INSERT INTO stylelock_settings (website_id, preset_name, settings, is_active) VALUES (
  NULL,
  'aggressive',
  '{
    "generation": {"numGenerators": 5, "maxRounds": 15},
    "voting": {"numVoters": 5, "advanceThreshold": 90},
    "blindTest": {"numJudges": 5, "passThreshold": 0.8},
    "limits": {"maxCost": 10.00}
  }',
  false
);
