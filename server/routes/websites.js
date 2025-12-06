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

// GET all websites for a client
router.get('/client/:clientId', requireDb, async (req, res) => {
  try {
    const { clientId } = req.params;
    const websites = await sql`
      SELECT w.*,
        COALESCE(
          (SELECT json_agg(json_build_object('id', l.id, 'name', l.name, 'city', l.city, 'has_gbp', l.has_gbp))
           FROM location_websites lw
           JOIN locations l ON lw.location_id = l.id
           WHERE lw.website_id = w.id), '[]'
        ) as linked_locations
      FROM websites w
      WHERE w.client_id = ${clientId}
      ORDER BY w.created_at DESC
    `;
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
    const { clientId, name, url, wpUrl, wpUser, wpAppPassword } = req.body;

    if (!clientId || !name) {
      return res.status(400).json({ error: 'Client ID and name are required' });
    }

    const result = await sql`
      INSERT INTO websites (client_id, name, url, wp_url, wp_user, wp_app_password)
      VALUES (${clientId}, ${name}, ${url || ''}, ${wpUrl || ''}, ${wpUser || ''}, ${wpAppPassword || ''})
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
    const { name, url, wpUrl, wpUser, wpAppPassword } = req.body;

    const result = await sql`
      UPDATE websites
      SET name = ${name},
          url = ${url || ''},
          wp_url = ${wpUrl || ''},
          wp_user = ${wpUser || ''},
          wp_app_password = ${wpAppPassword || ''},
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
