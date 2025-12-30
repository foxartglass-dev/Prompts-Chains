/**
 * Complete Database Setup Script
 * Run this once on Railway to ensure all tables and columns exist
 *
 * Usage: node server/db/setup-all.mjs
 */

import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_FEAdokp4C1IQ@ep-dark-bar-adgtv25x-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function setup() {
  const sql = neon(connectionString);

  console.log('🔧 PromptFlow Database Setup\n');
  console.log('================================\n');

  try {
    // Test connection
    const testResult = await sql`SELECT NOW() as time`;
    console.log('✓ Connected to database at', testResult[0].time);
    console.log('');

    // ================================
    // CORE TABLES
    // ================================
    console.log('📦 Creating core tables...\n');

    // Clients
    await sql`
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
      )
    `;
    console.log('  ✓ clients');

    // Personal Projects (must come before workflows)
    await sql`
      CREATE TABLE IF NOT EXISTS personal_projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        state JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ personal_projects');

    // Websites
    await sql`
      CREATE TABLE IF NOT EXISTS websites (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(500),
        wp_url VARCHAR(500),
        wp_user VARCHAR(255),
        wp_app_password VARCHAR(255),
        elementor_connected BOOLEAN DEFAULT false,
        elementor_api_key VARCHAR(255),
        elementor_api_secret TEXT,
        drip_feed_pages_per_day INTEGER DEFAULT 5,
        drip_feed_randomize BOOLEAN DEFAULT true,
        drip_feed_publish_time VARCHAR(10) DEFAULT '09:00',
        elementor_cta_text VARCHAR(255) DEFAULT 'Book Now!',
        elementor_cta_url VARCHAR(500) DEFAULT '#',
        elementor_include_stats_bar BOOLEAN DEFAULT false,
        image_generation_enabled BOOLEAN DEFAULT false,
        image_provider VARCHAR(50) DEFAULT 'flux',
        image_provider_api_key VARCHAR(255),
        image_style_dna JSONB DEFAULT '{}',
        image_reference_urls JSONB DEFAULT '[]',
        images_per_article INTEGER DEFAULT 4,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ websites');

    // Workflows
    await sql`
      CREATE TABLE IF NOT EXISTS workflows (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        website_id INTEGER REFERENCES websites(id) ON DELETE SET NULL,
        personal_project_id INTEGER REFERENCES personal_projects(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        state JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ workflows');

    // Templates
    await sql`
      CREATE TABLE IF NOT EXISTS templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        template_type VARCHAR(50) NOT NULL,
        template_data JSONB NOT NULL DEFAULT '{}',
        includes JSONB DEFAULT '{"prompts": true, "placeholders": true, "tags": true, "snippets": true, "settings": true}',
        tags JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ templates');

    // Articles
    await sql`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE SET NULL,
        website_id INTEGER REFERENCES websites(id) ON DELETE SET NULL,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        keyword VARCHAR(500) NOT NULL,
        tag VARCHAR(50),
        final_content TEXT,
        meta_titles JSONB DEFAULT '[]',
        meta_descriptions JSONB DEFAULT '[]',
        chain_outputs JSONB DEFAULT '{}',
        ai_score DECIMAL(5,2),
        word_count INTEGER,
        status VARCHAR(20) DEFAULT 'generated',
        wp_post_id INTEGER,
        wp_post_url VARCHAR(500),
        wp_published_at TIMESTAMP,
        version INTEGER DEFAULT 1,
        parent_article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
        generated_images JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ articles');

    // Image Creation Settings
    await sql`
      CREATE TABLE IF NOT EXISTS image_creation_settings (
        id SERIAL PRIMARY KEY,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE UNIQUE,
        enabled BOOLEAN DEFAULT false,
        prompt_assistant_model VARCHAR(100) DEFAULT 'gpt-4o',
        image_generation_model VARCHAR(100) DEFAULT 'gpt-image-1.5',
        reference_images JSONB DEFAULT '[]',
        logo_images JSONB DEFAULT '[]',
        audience_avatars JSONB DEFAULT '[{"id": 1, "name": "Default", "mainPrompt": "", "variations": []}]',
        image_bank JSONB DEFAULT '[]',
        image_categories JSONB DEFAULT '["Hero", "Service", "Team", "Equipment", "Before/After", "Other"]',
        auto_tag_enabled BOOLEAN DEFAULT true,
        chat_history JSONB DEFAULT '[]',
        consultant_chat_history JSONB DEFAULT '[]',
        consultant_model VARCHAR(100) DEFAULT 'gpt-4o',
        worker_chat_history JSONB DEFAULT '[]',
        worker_model VARCHAR(100) DEFAULT 'gpt-4o-mini',
        integration_mode VARCHAR(20) DEFAULT 'bank',
        fallback_to_live BOOLEAN DEFAULT true,
        image_order JSONB DEFAULT '[]',
        variation_order_mode VARCHAR(20) DEFAULT 'sequential',
        manual_variation_order JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ image_creation_settings');

    // Image Bank Items - Separate table to avoid payload bloat
    await sql`
      CREATE TABLE IF NOT EXISTS image_bank_items (
        id SERIAL PRIMARY KEY,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
        external_id VARCHAR(100), -- Client-side ID like 'img-1234567890'
        url TEXT NOT NULL,
        title VARCHAR(500),
        category VARCHAR(100),
        variation_name VARCHAR(255),
        variation_id VARCHAR(100),
        avatar_tag VARCHAR(50),
        orientation VARCHAR(20) DEFAULT 'vertical',
        prompt TEXT,
        model VARCHAR(100),
        used BOOLEAN DEFAULT false,
        used_on TEXT, -- URL where image was used
        used_at TIMESTAMP,
        archived BOOLEAN DEFAULT false,
        tags JSONB DEFAULT '[]',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ image_bank_items');

    // Index for faster queries
    await sql`CREATE INDEX IF NOT EXISTS idx_image_bank_workflow ON image_bank_items(workflow_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_image_bank_used ON image_bank_items(workflow_id, used)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_image_bank_avatar ON image_bank_items(workflow_id, avatar_tag)`;
    console.log('  ✓ image_bank indexes');

    console.log('');

    // ================================
    // MIGRATIONS (add columns if missing)
    // ================================
    console.log('🔄 Running migrations...\n');

    // Migration 005: image_generation_model column
    const hasImageGenModel = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'image_creation_settings' AND column_name = 'image_generation_model'
    `;
    if (hasImageGenModel.length === 0) {
      await sql`ALTER TABLE image_creation_settings ADD COLUMN image_generation_model VARCHAR(100) DEFAULT 'gpt-image-1.5'`;
      console.log('  ✓ Added image_generation_model column');
    } else {
      console.log('  - image_generation_model already exists');
    }

    // Migration 006: smart_matching columns
    const hasSmartMatching = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'image_creation_settings' AND column_name = 'smart_matching_enabled'
    `;
    if (hasSmartMatching.length === 0) {
      await sql`ALTER TABLE image_creation_settings ADD COLUMN smart_matching_enabled BOOLEAN DEFAULT false`;
      console.log('  ✓ Added smart_matching_enabled column');
    } else {
      console.log('  - smart_matching_enabled already exists');
    }

    const hasSmartMode = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'image_creation_settings' AND column_name = 'smart_matching_mode'
    `;
    if (hasSmartMode.length === 0) {
      await sql`ALTER TABLE image_creation_settings ADD COLUMN smart_matching_mode VARCHAR(50) DEFAULT 'bank_first'`;
      console.log('  ✓ Added smart_matching_mode column');
    } else {
      console.log('  - smart_matching_mode already exists');
    }

    // Migration 007: image_quality column
    const hasImageQuality = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'image_creation_settings' AND column_name = 'image_quality'
    `;
    if (hasImageQuality.length === 0) {
      await sql`ALTER TABLE image_creation_settings ADD COLUMN image_quality VARCHAR(20) DEFAULT 'low'`;
      console.log('  ✓ Added image_quality column');
    } else {
      console.log('  - image_quality already exists');
    }

    // Articles table additional columns
    const hasArticlePushAuto = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'articles' AND column_name = 'article_push_auto_at'
    `;
    if (hasArticlePushAuto.length === 0) {
      await sql`ALTER TABLE articles ADD COLUMN article_push_auto_at TIMESTAMP`;
      console.log('  ✓ Added article_push_auto_at column');
    } else {
      console.log('  - article_push_auto_at already exists');
    }

    const hasArticlePushManualCount = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'articles' AND column_name = 'article_push_manual_count'
    `;
    if (hasArticlePushManualCount.length === 0) {
      await sql`ALTER TABLE articles ADD COLUMN article_push_manual_count INTEGER DEFAULT 0`;
      await sql`ALTER TABLE articles ADD COLUMN article_push_manual_dates JSONB DEFAULT '[]'`;
      console.log('  ✓ Added article push tracking columns');
    } else {
      console.log('  - article push tracking columns already exist');
    }

    // Migration: prompt_problem_areas column for Image Creation
    const hasPromptProblemAreas = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'image_creation_settings' AND column_name = 'prompt_problem_areas'
    `;
    if (hasPromptProblemAreas.length === 0) {
      await sql`ALTER TABLE image_creation_settings ADD COLUMN prompt_problem_areas JSONB DEFAULT '[]'`;
      console.log('  ✓ Added prompt_problem_areas column');
    } else {
      console.log('  - prompt_problem_areas already exists');
    }

    console.log('');

    // ================================
    // PROMPT ENGINEERING SYSTEM
    // ================================
    console.log('🧠 Creating Prompt Engineering tables...\n');

    // Prompt Engineering Playbook - Master knowledge base for new agents
    await sql`
      CREATE TABLE IF NOT EXISTS prompt_engineering_playbook (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        applicable_to JSONB DEFAULT '["all"]',
        created_by VARCHAR(100) DEFAULT 'system',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ prompt_engineering_playbook');

    // Prompt Tricks Library - Specific techniques that work
    await sql`
      CREATE TABLE IF NOT EXISTS prompt_tricks (
        id SERIAL PRIMARY KEY,
        problem VARCHAR(255) NOT NULL,
        solution_prompt TEXT NOT NULL,
        explanation TEXT,
        example_before TEXT,
        example_after TEXT,
        success_rate INTEGER DEFAULT 0,
        times_used INTEGER DEFAULT 0,
        tags JSONB DEFAULT '[]',
        discovered_by VARCHAR(100) DEFAULT 'agent',
        avatar_id INTEGER,
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ prompt_tricks');

    // Avatar Reference Photos - Real crew photos for context
    await sql`
      CREATE TABLE IF NOT EXISTS avatar_reference_photos (
        id SERIAL PRIMARY KEY,
        avatar_id INTEGER NOT NULL,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        image_type VARCHAR(50) DEFAULT 'general',
        description TEXT,
        ai_analysis TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ avatar_reference_photos');

    // Avatar Research - Web research findings
    await sql`
      CREATE TABLE IF NOT EXISTS avatar_research (
        id SERIAL PRIMARY KEY,
        avatar_id INTEGER NOT NULL,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
        research_query TEXT,
        findings JSONB NOT NULL DEFAULT '{}',
        sources JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ avatar_research');

    // Prompt Generation History - Track results and critiques
    await sql`
      CREATE TABLE IF NOT EXISTS prompt_generation_history (
        id SERIAL PRIMARY KEY,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
        avatar_id INTEGER,
        prompt_used TEXT NOT NULL,
        generated_image_url TEXT,
        ai_critique TEXT,
        rating INTEGER,
        what_worked TEXT,
        what_to_improve TEXT,
        adjusted_prompt TEXT,
        model_used VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ prompt_generation_history');

    // Agent Handoff Documents - Knowledge transfer between sessions
    await sql`
      CREATE TABLE IF NOT EXISTS agent_handoffs (
        id SERIAL PRIMARY KEY,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
        avatar_id INTEGER,
        session_summary TEXT,
        key_learnings JSONB DEFAULT '[]',
        unresolved_issues JSONB DEFAULT '[]',
        recommendations JSONB DEFAULT '[]',
        tricks_discovered JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ agent_handoffs');

    // Human Feedback System - The center of the learning loop
    await sql`
      CREATE TABLE IF NOT EXISTS human_feedback (
        id SERIAL PRIMARY KEY,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
        avatar_id INTEGER,
        article_id INTEGER,
        run_type VARCHAR(50) DEFAULT 'batch',

        -- The images that were generated
        generated_images JSONB DEFAULT '[]',
        prompts_used JSONB DEFAULT '[]',

        -- Quick feedback
        rating VARCHAR(20),
        quick_tags JSONB DEFAULT '[]',

        -- Detailed feedback
        detailed_feedback TEXT,

        -- AI questions answered
        questions_answered JSONB DEFAULT '[]',

        -- Tracking
        feedback_given BOOLEAN DEFAULT false,
        skipped BOOLEAN DEFAULT false,
        perfect_streak INTEGER DEFAULT 0,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ human_feedback');

    // AI Questions Queue - Things the AI is uncertain about
    await sql`
      CREATE TABLE IF NOT EXISTS ai_questions (
        id SERIAL PRIMARY KEY,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
        avatar_id INTEGER,
        question TEXT NOT NULL,
        context TEXT,
        options JSONB DEFAULT '[]',
        priority INTEGER DEFAULT 0,
        answered BOOLEAN DEFAULT false,
        answer TEXT,
        answered_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ ai_questions');

    // Feedback Settings - When to show/hide the popup
    await sql`
      CREATE TABLE IF NOT EXISTS feedback_settings (
        id SERIAL PRIMARY KEY,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE UNIQUE,
        show_after_every_run BOOLEAN DEFAULT true,
        perfect_streak_threshold INTEGER DEFAULT 10,
        current_perfect_streak INTEGER DEFAULT 0,
        auto_disabled BOOLEAN DEFAULT false,
        never_ask_again BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ feedback_settings');

    console.log('');

    // ================================
    // INDEXES
    // ================================
    console.log('📊 Creating indexes...\n');

    await sql`CREATE INDEX IF NOT EXISTS idx_image_creation_workflow ON image_creation_settings(workflow_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_workflows_client_id ON workflows(client_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_workflows_website_id ON workflows(website_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_workflows_personal_project_id ON workflows(personal_project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_articles_workflow_id ON articles(workflow_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_articles_website_id ON articles(website_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)`;
    console.log('  ✓ All indexes created');

    console.log('');
    console.log('================================');
    console.log('✅ Database setup complete!');
    console.log('================================');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

setup();
