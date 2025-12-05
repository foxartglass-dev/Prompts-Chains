// Project API routes
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

// GET all projects (optionally filter by client)
router.get('/', requireDb, async (req, res) => {
  try {
    const { clientId } = req.query;

    let projects;
    if (clientId) {
      projects = await sql`
        SELECT p.*, c.name as client_name
        FROM projects p
        LEFT JOIN clients c ON p.client_id = c.id
        WHERE p.client_id = ${clientId}
        ORDER BY p.updated_at DESC
      `;
    } else {
      projects = await sql`
        SELECT p.*, c.name as client_name
        FROM projects p
        LEFT JOIN clients c ON p.client_id = c.id
        ORDER BY p.updated_at DESC
      `;
    }

    res.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single project
router.get('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    const projects = await sql`
      SELECT p.*, c.name as client_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.id = ${id}
    `;

    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project: projects[0] });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new project
router.post('/', requireDb, async (req, res) => {
  try {
    const { clientId, name, state } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = await sql`
      INSERT INTO projects (client_id, name, state)
      VALUES (${clientId || null}, ${name}, ${JSON.stringify(state || {})})
      RETURNING *
    `;

    res.status(201).json({ project: result[0] });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update project
router.put('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId, name, state } = req.body;

    const result = await sql`
      UPDATE projects
      SET client_id = ${clientId || null},
          name = ${name},
          state = ${JSON.stringify(state || {})},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project: result[0] });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE project
router.delete('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM projects WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ deleted: result[0] });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
