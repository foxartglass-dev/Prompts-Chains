// Location API routes
import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';

const router = express.Router();

const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// GET all locations for a client
router.get('/client/:clientId', requireDb, async (req, res) => {
  try {
    const { clientId } = req.params;
    const locations = await sql`
      SELECT l.*,
        COALESCE(
          (SELECT json_agg(json_build_object('id', w.id, 'name', w.name, 'url', w.url))
           FROM location_websites lw
           JOIN websites w ON lw.website_id = w.id
           WHERE lw.location_id = l.id), '[]'
        ) as linked_websites
      FROM locations l
      WHERE l.client_id = ${clientId}
      ORDER BY l.created_at DESC
    `;
    res.json({ locations });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single location
router.get('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const locations = await sql`
      SELECT * FROM locations WHERE id = ${id}
    `;
    if (locations.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Get linked websites
    const websites = await sql`
      SELECT w.*, lw.is_primary
      FROM websites w
      JOIN location_websites lw ON w.id = lw.website_id
      WHERE lw.location_id = ${id}
    `;

    res.json({ location: locations[0], linkedWebsites: websites });
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create location
router.post('/', requireDb, async (req, res) => {
  try {
    const { clientId, name, address, city, state, zip, country, hasGbp, gbpPlaceId, gbpCategories } = req.body;

    if (!clientId || !name) {
      return res.status(400).json({ error: 'Client ID and name are required' });
    }

    const result = await sql`
      INSERT INTO locations (client_id, name, address, city, state, zip, country, has_gbp, gbp_place_id, gbp_categories)
      VALUES (${clientId}, ${name}, ${address || ''}, ${city || ''}, ${state || ''}, ${zip || ''}, ${country || 'USA'}, ${hasGbp || false}, ${gbpPlaceId || null}, ${JSON.stringify(gbpCategories || [])})
      RETURNING *
    `;

    res.status(201).json({ location: result[0] });
  } catch (error) {
    console.error('Error creating location:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update location
router.put('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, city, state, zip, country, hasGbp, gbpPlaceId, gbpCategories, gbpData } = req.body;

    const result = await sql`
      UPDATE locations
      SET name = ${name},
          address = ${address || ''},
          city = ${city || ''},
          state = ${state || ''},
          zip = ${zip || ''},
          country = ${country || 'USA'},
          has_gbp = ${hasGbp || false},
          gbp_place_id = ${gbpPlaceId || null},
          gbp_categories = ${JSON.stringify(gbpCategories || [])},
          gbp_data = ${JSON.stringify(gbpData || {})},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json({ location: result[0] });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE location
router.delete('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await sql`
      DELETE FROM locations WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json({ deleted: result[0] });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ error: error.message });
  }
});

// Link location to website
router.post('/:id/link-website', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { websiteId, isPrimary } = req.body;

    const result = await sql`
      INSERT INTO location_websites (location_id, website_id, is_primary)
      VALUES (${id}, ${websiteId}, ${isPrimary || false})
      ON CONFLICT (location_id, website_id) DO UPDATE SET is_primary = ${isPrimary || false}
      RETURNING *
    `;

    res.json({ link: result[0] });
  } catch (error) {
    console.error('Error linking website:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unlink location from website
router.delete('/:id/unlink-website/:websiteId', requireDb, async (req, res) => {
  try {
    const { id, websiteId } = req.params;

    await sql`
      DELETE FROM location_websites
      WHERE location_id = ${id} AND website_id = ${websiteId}
    `;

    res.json({ success: true });
  } catch (error) {
    console.error('Error unlinking website:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
