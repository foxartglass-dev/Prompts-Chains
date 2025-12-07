// Personal Projects API routes (for standalone workflow organization)
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

// GET all personal projects
router.get('/', requireDb, async (req, res) => {
  try {
    const projects = await sql`
      SELECT * FROM personal_projects
      ORDER BY updated_at DESC
    `;
    res.json({ projects });
  } catch (error) {
    console.error('Error fetching personal projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single personal project
router.get('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const projects = await sql`
      SELECT * FROM personal_projects WHERE id = ${id}
    `;

    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project: projects[0] });
  } catch (error) {
    console.error('Error fetching personal project:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new personal project
router.post('/', requireDb, async (req, res) => {
  try {
    const { name, description, category } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = await sql`
      INSERT INTO personal_projects (name, description, category)
      VALUES (${name}, ${description || null}, ${category || null})
      RETURNING *
    `;

    res.status(201).json({ project: result[0] });
  } catch (error) {
    console.error('Error creating personal project:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update personal project
router.put('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category } = req.body;

    const result = await sql`
      UPDATE personal_projects
      SET name = ${name},
          description = ${description || null},
          category = ${category || null},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project: result[0] });
  } catch (error) {
    console.error('Error updating personal project:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE personal project (workflows become ungrouped)
router.delete('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    // First, unlink any workflows from this project
    await sql`
      UPDATE workflows
      SET personal_project_id = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE personal_project_id = ${id}
    `;

    // Then delete the project
    const result = await sql`
      DELETE FROM personal_projects WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ deleted: result[0] });
  } catch (error) {
    console.error('Error deleting personal project:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
