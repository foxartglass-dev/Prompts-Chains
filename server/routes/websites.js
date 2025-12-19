// Website API routes
import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';

const router = express.Router();

const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// GET all websites for a client (supports ?client_id=X) or ALL websites
router.get('/', requireDb, async (req, res) => {
  try {
    const clientId = req.query.client_id || req.query.clientId;

    let websites;
    if (clientId) {
      // Get websites for specific client
      websites = await sql`
        SELECT w.*,
          c.name as client_name,
          COALESCE(
            (SELECT json_agg(json_build_object('id', l.id, 'name', l.name, 'city', l.city, 'has_gbp', l.has_gbp))
             FROM location_websites lw
             JOIN locations l ON lw.location_id = l.id
             WHERE lw.website_id = w.id), '[]'
          ) as linked_locations
        FROM websites w
        LEFT JOIN clients c ON w.client_id = c.id
        WHERE w.client_id = ${clientId}
        ORDER BY w.created_at DESC
      `;
    } else {
      // Get ALL websites across all clients
      websites = await sql`
        SELECT w.*,
          c.name as client_name,
          COALESCE(
            (SELECT json_agg(json_build_object('id', l.id, 'name', l.name, 'city', l.city, 'has_gbp', l.has_gbp))
             FROM location_websites lw
             JOIN locations l ON lw.location_id = l.id
             WHERE lw.website_id = w.id), '[]'
          ) as linked_locations
        FROM websites w
        LEFT JOIN clients c ON w.client_id = c.id
        ORDER BY w.created_at DESC
      `;
    }
    res.json({ websites });
  } catch (error) {
    console.error('Error fetching websites:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single website
router.get('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const websites = await sql`
      SELECT * FROM websites WHERE id = ${id}
    `;
    if (websites.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }

    // Get linked locations
    const locations = await sql`
      SELECT l.*, lw.is_primary
      FROM locations l
      JOIN location_websites lw ON l.id = lw.location_id
      WHERE lw.website_id = ${id}
    `;

    // Get projects for this website
    const projects = await sql`
      SELECT * FROM projects WHERE website_id = ${id}
      ORDER BY updated_at DESC
    `;

    res.json({ website: websites[0], linkedLocations: locations, projects });
  } catch (error) {
    console.error('Error fetching website:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create website
router.post('/', requireDb, async (req, res) => {
  try {
    // Support both camelCase and snake_case
    const clientId = req.body.client_id || req.body.clientId;
    const { name, url } = req.body;
    const wpUrl = req.body.wp_url || req.body.wpUrl;
    const wpUser = req.body.wp_user || req.body.wpUser;
    const wpAppPassword = req.body.wp_app_password || req.body.wpAppPassword;

    // Drip feed settings
    const dripFeedPagesPerDay = req.body.drip_feed_pages_per_day || req.body.dripFeedPagesPerDay || 5;
    const dripFeedRandomize = req.body.drip_feed_randomize ?? req.body.dripFeedRandomize ?? true;
    const dripFeedPublishTime = req.body.drip_feed_publish_time || req.body.dripFeedPublishTime || '09:00';

    // Elementor settings
    const elementorCtaText = req.body.elementor_cta_text || req.body.elementorCtaText || 'Book Now!';
    const elementorCtaUrl = req.body.elementor_cta_url || req.body.elementorCtaUrl || '#';
    const elementorIncludeStatsBar = req.body.elementor_include_stats_bar ?? req.body.elementorIncludeStatsBar ?? false;

    if (!clientId || !name) {
      return res.status(400).json({ error: 'Client ID and name are required' });
    }

    const result = await sql`
      INSERT INTO websites (
        client_id, name, url, wp_url, wp_user, wp_app_password,
        drip_feed_pages_per_day, drip_feed_randomize, drip_feed_publish_time,
        elementor_cta_text, elementor_cta_url, elementor_include_stats_bar
      )
      VALUES (
        ${clientId}, ${name}, ${url || ''}, ${wpUrl || ''}, ${wpUser || ''}, ${wpAppPassword || ''},
        ${dripFeedPagesPerDay}, ${dripFeedRandomize}, ${dripFeedPublishTime},
        ${elementorCtaText}, ${elementorCtaUrl}, ${elementorIncludeStatsBar}
      )
      RETURNING *
    `;

    res.status(201).json({ website: result[0] });
  } catch (error) {
    console.error('Error creating website:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update website
router.put('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    // Support both camelCase and snake_case
    const { name, url } = req.body;
    const wpUrl = req.body.wpUrl || req.body.wp_url;
    const wpUser = req.body.wpUser || req.body.wp_user;
    const wpAppPassword = req.body.wpAppPassword || req.body.wp_app_password;

    // Drip feed settings
    const dripFeedPagesPerDay = req.body.drip_feed_pages_per_day || req.body.dripFeedPagesPerDay;
    const dripFeedRandomize = req.body.drip_feed_randomize ?? req.body.dripFeedRandomize;
    const dripFeedPublishTime = req.body.drip_feed_publish_time || req.body.dripFeedPublishTime;

    // Elementor settings
    const elementorCtaText = req.body.elementor_cta_text || req.body.elementorCtaText;
    const elementorCtaUrl = req.body.elementor_cta_url || req.body.elementorCtaUrl;
    const elementorIncludeStatsBar = req.body.elementor_include_stats_bar ?? req.body.elementorIncludeStatsBar;

    const result = await sql`
      UPDATE websites
      SET name = ${name},
          url = ${url || ''},
          wp_url = ${wpUrl || ''},
          wp_user = ${wpUser || ''},
          wp_app_password = ${wpAppPassword || ''},
          drip_feed_pages_per_day = COALESCE(${dripFeedPagesPerDay}, drip_feed_pages_per_day),
          drip_feed_randomize = COALESCE(${dripFeedRandomize}, drip_feed_randomize),
          drip_feed_publish_time = COALESCE(${dripFeedPublishTime}, drip_feed_publish_time),
          elementor_cta_text = COALESCE(${elementorCtaText}, elementor_cta_text),
          elementor_cta_url = COALESCE(${elementorCtaUrl}, elementor_cta_url),
          elementor_include_stats_bar = COALESCE(${elementorIncludeStatsBar}, elementor_include_stats_bar),
          seo_plugin = COALESCE(${req.body.seoPlugin || req.body.seo_plugin}, seo_plugin),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }

    res.json({ website: result[0] });
  } catch (error) {
    console.error('Error updating website:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE website
router.delete('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await sql`
      DELETE FROM websites WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }

    res.json({ deleted: result[0] });
  } catch (error) {
    console.error('Error deleting website:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
