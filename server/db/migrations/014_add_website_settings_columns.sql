-- Add missing website settings columns
-- These columns are used by the PUT /api/websites/:id endpoint

-- Drip feed settings
ALTER TABLE websites ADD COLUMN IF NOT EXISTS drip_feed_pages_per_day INTEGER DEFAULT 5;
ALTER TABLE websites ADD COLUMN IF NOT EXISTS drip_feed_randomize BOOLEAN DEFAULT true;
ALTER TABLE websites ADD COLUMN IF NOT EXISTS drip_feed_publish_time VARCHAR(10) DEFAULT '09:00';

-- Elementor settings
ALTER TABLE websites ADD COLUMN IF NOT EXISTS elementor_cta_text VARCHAR(255) DEFAULT 'Book Now!';
ALTER TABLE websites ADD COLUMN IF NOT EXISTS elementor_cta_url VARCHAR(500) DEFAULT '#';
ALTER TABLE websites ADD COLUMN IF NOT EXISTS elementor_include_stats_bar BOOLEAN DEFAULT false;

-- SEO plugin setting
ALTER TABLE websites ADD COLUMN IF NOT EXISTS seo_plugin VARCHAR(50) DEFAULT 'yoast';
