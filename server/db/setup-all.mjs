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

    // Migration 009: generated_images column for articles
    const hasGeneratedImages = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'articles' AND column_name = 'generated_images'
    `;
    if (hasGeneratedImages.length === 0) {
      await sql`ALTER TABLE articles ADD COLUMN generated_images JSONB DEFAULT '[]'`;
      console.log('  ✓ Added generated_images column to articles');
    } else {
      console.log('  - generated_images column already exists');
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

    // Image Versions - Track history of image replacements
    await sql`
      CREATE TABLE IF NOT EXISTS image_versions (
        id SERIAL PRIMARY KEY,
        article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
        elementor_widget_id VARCHAR(50) NOT NULL,
        version INTEGER DEFAULT 1,
        image_url TEXT NOT NULL,
        wp_media_id INTEGER,
        image_prompt TEXT,
        replacement_source VARCHAR(50) DEFAULT 'upload',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ image_versions');

    // WordPress Page Hierarchy - Cache page structure for site map
    await sql`
      CREATE TABLE IF NOT EXISTS wp_page_hierarchy (
        id SERIAL PRIMARY KEY,
        website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
        wp_page_id INTEGER NOT NULL,
        wp_parent_id INTEGER DEFAULT 0,
        title VARCHAR(500),
        slug VARCHAR(500),
        status VARCHAR(50) DEFAULT 'publish',
        page_order INTEGER DEFAULT 0,
        elementor_data JSONB,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(website_id, wp_page_id)
      )
    `;
    console.log('  ✓ wp_page_hierarchy');

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
    await sql`CREATE INDEX IF NOT EXISTS idx_image_versions_article ON image_versions(article_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_image_versions_widget ON image_versions(elementor_widget_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_wp_hierarchy_website ON wp_page_hierarchy(website_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_wp_hierarchy_parent ON wp_page_hierarchy(wp_parent_id)`;
    console.log('  ✓ All indexes created');

    console.log('');

    // ================================
    // SITE PLANNING TABLES
    // ================================
    console.log('🗺️  Creating Site Planning tables...\n');

    // Site Plans
    await sql`
      CREATE TABLE IF NOT EXISTS site_plans (
        id SERIAL PRIMARY KEY,
        website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE SET NULL,
        name VARCHAR(255) DEFAULT 'Site Structure',
        description TEXT,
        total_pages INTEGER DEFAULT 0,
        max_depth INTEGER DEFAULT 0,
        sync_status VARCHAR(20) DEFAULT 'unknown',
        last_sync_check TIMESTAMP,
        auto_sync_check BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ site_plans');

    // Site Plan Nodes
    await sql`
      CREATE TABLE IF NOT EXISTS site_plan_nodes (
        id SERIAL PRIMARY KEY,
        site_plan_id INTEGER REFERENCES site_plans(id) ON DELETE CASCADE,
        parent_id INTEGER REFERENCES site_plan_nodes(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255),
        page_type VARCHAR(50) DEFAULT 'page',
        status VARCHAR(20) DEFAULT 'planned',
        target_keyword VARCHAR(255),
        meta_title VARCHAR(255),
        meta_description TEXT,
        content_brief TEXT,
        assigned_article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
        is_pillar_page BOOLEAN DEFAULT false,
        is_in_menu BOOLEAN DEFAULT true,
        menu_order INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        depth INTEGER DEFAULT 0,
        wp_page_id INTEGER,
        wp_post_url VARCHAR(500),
        built_at TIMESTAMP,
        published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ site_plan_nodes');

    await sql`CREATE INDEX IF NOT EXISTS idx_site_plans_website ON site_plans(website_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_site_plans_workflow ON site_plans(workflow_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_site_plan_nodes_plan ON site_plan_nodes(site_plan_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_site_plan_nodes_parent ON site_plan_nodes(parent_id)`;
    console.log('  ✓ site planning indexes');

    console.log('');

    // ================================
    // LOCAL VIKING INTEGRATION
    // ================================
    console.log('🛡️  Creating Local Viking tables...\n');

    // Add Local Viking columns to websites table
    const hasLocalVikingApiKey = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'websites' AND column_name = 'local_viking_api_key'
    `;
    if (hasLocalVikingApiKey.length === 0) {
      await sql`ALTER TABLE websites ADD COLUMN local_viking_api_key VARCHAR(255)`;
      await sql`ALTER TABLE websites ADD COLUMN local_viking_location_id VARCHAR(255)`;
      console.log('  ✓ Added Local Viking columns to websites');
    } else {
      console.log('  - Local Viking website columns already exist');
    }

    // Rank Snapshots - Store GeoGrid scan results over time
    await sql`
      CREATE TABLE IF NOT EXISTS rank_snapshots (
        id SERIAL PRIMARY KEY,
        website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
        keyword VARCHAR(255) NOT NULL,
        grid_size INTEGER DEFAULT 7,
        scan_id VARCHAR(255),
        average_rank DECIMAL(5,2),
        best_rank INTEGER,
        top_3_count INTEGER DEFAULT 0,
        sheep_score DECIMAL(5,2) DEFAULT 0,
        grid_data JSONB DEFAULT '[]',
        analysis JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ rank_snapshots');

    // GBP Post Templates - Templates for rinse and repeat
    await sql`
      CREATE TABLE IF NOT EXISTS gbp_post_templates (
        id SERIAL PRIMARY KEY,
        website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        call_to_action VARCHAR(50) DEFAULT 'LEARN_MORE',
        cta_url VARCHAR(500),
        image_url TEXT,
        rotation_day INTEGER,
        is_active BOOLEAN DEFAULT true,
        times_posted INTEGER DEFAULT 0,
        last_posted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(website_id, name)
      )
    `;
    console.log('  ✓ gbp_post_templates');

    // GBP Post History - Track all posts made
    await sql`
      CREATE TABLE IF NOT EXISTS gbp_post_history (
        id SERIAL PRIMARY KEY,
        website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
        post_id VARCHAR(255),
        template_id INTEGER REFERENCES gbp_post_templates(id) ON DELETE SET NULL,
        content TEXT,
        call_to_action VARCHAR(50),
        cta_url VARCHAR(500),
        image_url TEXT,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ gbp_post_history');

    // Indexes for Local Viking tables
    await sql`CREATE INDEX IF NOT EXISTS idx_rank_snapshots_website ON rank_snapshots(website_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rank_snapshots_keyword ON rank_snapshots(website_id, keyword)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rank_snapshots_date ON rank_snapshots(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_gbp_templates_website ON gbp_post_templates(website_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_gbp_history_website ON gbp_post_history(website_id)`;
    console.log('  ✓ Local Viking indexes');

    console.log('');

    // ================================
    // GLOBAL SETTINGS TABLE
    // ================================
    console.log('🌐 Creating Global Settings table...\n');

    // Global settings (singleton table for account-level settings)
    await sql`
      CREATE TABLE IF NOT EXISTS global_settings (
        id SERIAL PRIMARY KEY,
        local_viking_api_key VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Ensure the row exists
    const hasGlobalSettings = await sql`SELECT id FROM global_settings WHERE id = 1`;
    if (hasGlobalSettings.length === 0) {
      await sql`INSERT INTO global_settings (id) VALUES (1)`;
      console.log('  ✓ Created global_settings with initial row');
    } else {
      console.log('  - global_settings already exists');
    }

    console.log('');

    // ================================
    // DRIP FEED SYSTEM
    // ================================
    console.log('📅 Creating Drip Feed tables...\n');

    // Drip Feed Settings (per-website configuration)
    await sql`
      CREATE TABLE IF NOT EXISTS drip_feed_settings (
        id SERIAL PRIMARY KEY,
        website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE UNIQUE,
        articles_per_day INTEGER DEFAULT 7,
        variance_enabled BOOLEAN DEFAULT true,
        variance_min INTEGER DEFAULT 6,
        variance_max INTEGER DEFAULT 8,
        publish_time_start TIME DEFAULT '07:00',
        publish_time_end TIME DEFAULT '19:00',
        skip_weekdays JSONB DEFAULT '[]',
        skip_dates JSONB DEFAULT '[]',
        notification_hours JSONB DEFAULT '[24, 12, 6]',
        first_day_monitor BOOLEAN DEFAULT true,
        is_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ drip_feed_settings');

    // Drip Feed Schedules (the hopper)
    await sql`
      CREATE TABLE IF NOT EXISTS drip_feed_schedules (
        id SERIAL PRIMARY KEY,
        website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
        article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE UNIQUE,
        scheduled_date DATE NOT NULL,
        scheduled_time TIME NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        wp_post_id INTEGER,
        wp_post_url TEXT,
        attempts INTEGER DEFAULT 0,
        last_attempt_at TIMESTAMP,
        published_at TIMESTAMP,
        error_message TEXT,
        is_manual_time BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ drip_feed_schedules');

    // Drip Feed Notifications
    await sql`
      CREATE TABLE IF NOT EXISTS drip_feed_notifications (
        id SERIAL PRIMARY KEY,
        website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
        schedule_id INTEGER REFERENCES drip_feed_schedules(id) ON DELETE CASCADE,
        article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        notify_at TIMESTAMP NOT NULL,
        sent_at TIMESTAMP,
        dismissed_at TIMESTAMP,
        snooze_until TIMESTAMP,
        channels_sent JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ drip_feed_notifications');

    // Custom Watches
    await sql`
      CREATE TABLE IF NOT EXISTS drip_feed_watches (
        id SERIAL PRIMARY KEY,
        website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        schedule_ids JSONB DEFAULT '[]',
        notify_offsets JSONB DEFAULT '[-30, 0, 15]',
        channels JSONB DEFAULT '["toast"]',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ drip_feed_watches');

    // Notification Settings (global)
    await sql`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id SERIAL PRIMARY KEY,
        toast_enabled BOOLEAN DEFAULT true,
        browser_enabled BOOLEAN DEFAULT false,
        sms_enabled BOOLEAN DEFAULT false,
        sms_phone_number VARCHAR(20),
        sms_verified BOOLEAN DEFAULT false,
        twilio_account_sid TEXT,
        twilio_auth_token TEXT,
        twilio_phone_number VARCHAR(20),
        error_repeat_interval INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    // Ensure notification settings row exists
    const hasNotifSettings = await sql`SELECT id FROM notification_settings WHERE id = 1`;
    if (hasNotifSettings.length === 0) {
      await sql`INSERT INTO notification_settings (id) VALUES (1)`;
      console.log('  ✓ notification_settings (created initial row)');
    } else {
      console.log('  ✓ notification_settings');
    }

    // Drip Feed Log (audit trail)
    await sql`
      CREATE TABLE IF NOT EXISTS drip_feed_log (
        id SERIAL PRIMARY KEY,
        schedule_id INTEGER REFERENCES drip_feed_schedules(id) ON DELETE SET NULL,
        website_id INTEGER REFERENCES websites(id) ON DELETE SET NULL,
        article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL,
        details JSONB,
        error_message TEXT,
        wp_response JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ drip_feed_log');

    // Drip Feed indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_drip_schedules_due ON drip_feed_schedules(scheduled_date, scheduled_time, status) WHERE status = 'pending'`;
    await sql`CREATE INDEX IF NOT EXISTS idx_drip_schedules_website ON drip_feed_schedules(website_id, scheduled_date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_drip_notifications_pending ON drip_feed_notifications(notify_at, status) WHERE status = 'pending'`;
    await sql`CREATE INDEX IF NOT EXISTS idx_drip_log_website ON drip_feed_log(website_id, created_at DESC)`;
    console.log('  ✓ drip feed indexes');

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
