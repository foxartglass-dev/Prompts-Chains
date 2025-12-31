import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';

const router = express.Router();

// Middleware to check database
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// GET /api/global-settings
// Returns global settings (creates row if doesn't exist)
router.get('/', requireDb, async (req, res) => {
  try {
    // First check if the table exists, create if not
    await sql`
      CREATE TABLE IF NOT EXISTS global_settings (
        id SERIAL PRIMARY KEY,
        local_viking_api_key VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Get or create the settings row
    let settings = await sql`SELECT * FROM global_settings WHERE id = 1`;

    if (settings.length === 0) {
      // Insert default row
      await sql`INSERT INTO global_settings (id) VALUES (1)`;
      settings = await sql`SELECT * FROM global_settings WHERE id = 1`;
    }

    res.json({
      success: true,
      settings: settings[0] || {}
    });
  } catch (error) {
    console.error('Error fetching global settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/global-settings
// Update global settings
router.put('/', requireDb, async (req, res) => {
  try {
    const { local_viking_api_key } = req.body;

    // First ensure the table and row exist
    await sql`
      CREATE TABLE IF NOT EXISTS global_settings (
        id SERIAL PRIMARY KEY,
        local_viking_api_key VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Check if row exists
    const existing = await sql`SELECT id FROM global_settings WHERE id = 1`;

    if (existing.length === 0) {
      // Insert with values
      await sql`
        INSERT INTO global_settings (id, local_viking_api_key)
        VALUES (1, ${local_viking_api_key || null})
      `;
    } else {
      // Update existing row
      await sql`
        UPDATE global_settings
        SET local_viking_api_key = ${local_viking_api_key || null},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `;
    }

    // Return updated settings
    const settings = await sql`SELECT * FROM global_settings WHERE id = 1`;

    res.json({
      success: true,
      settings: settings[0] || {}
    });
  } catch (error) {
    console.error('Error updating global settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/global-settings/local-viking-api-key
// Returns just the Local Viking API key (for internal use)
router.get('/local-viking-api-key', requireDb, async (req, res) => {
  try {
    // First check if the table exists
    await sql`
      CREATE TABLE IF NOT EXISTS global_settings (
        id SERIAL PRIMARY KEY,
        local_viking_api_key VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const settings = await sql`SELECT local_viking_api_key FROM global_settings WHERE id = 1`;

    res.json({
      success: true,
      apiKey: settings[0]?.local_viking_api_key || null
    });
  } catch (error) {
    console.error('Error fetching Local Viking API key:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
