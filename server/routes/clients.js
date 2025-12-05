// Client API routes
import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';

const router = express.Router();

// Middleware to check database availability
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// GET all clients
router.get('/', requireDb, async (req, res) => {
  try {
    const clients = await sql`
      SELECT * FROM clients
      ORDER BY created_at DESC
    `;
    res.json({ clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single client with projects
router.get('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    const clients = await sql`
      SELECT * FROM clients WHERE id = ${id}
    `;

    if (clients.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const projects = await sql`
      SELECT * FROM projects
      WHERE client_id = ${id}
      ORDER BY updated_at DESC
    `;

    res.json({ client: clients[0], projects });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new client
router.post('/', requireDb, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Client name is required' });
    }

    const result = await sql`
      INSERT INTO clients (name, description)
      VALUES (${name}, ${description || ''})
      RETURNING *
    `;

    res.status(201).json({ client: result[0] });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update client
router.put('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const result = await sql`
      UPDATE clients
      SET name = ${name},
          description = ${description || ''},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ client: result[0] });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE client (cascades to projects)
router.delete('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM clients WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ deleted: result[0] });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
