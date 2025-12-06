// Workflow API routes (prompt chains)
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

// GET all workflows (optionally filter by client or website)
router.get('/', requireDb, async (req, res) => {
  try {
    const { clientId, websiteId } = req.query;

    let workflows;
    if (clientId && websiteId) {
      workflows = await sql`
        SELECT w.*, c.name as client_name, ws.name as website_name, ws.url as website_url
        FROM workflows w
        LEFT JOIN clients c ON w.client_id = c.id
        LEFT JOIN websites ws ON w.website_id = ws.id
        WHERE w.client_id = ${clientId} AND w.website_id = ${websiteId}
        ORDER BY w.updated_at DESC
      `;
    } else if (clientId) {
      workflows = await sql`
        SELECT w.*, c.name as client_name, ws.name as website_name, ws.url as website_url
        FROM workflows w
        LEFT JOIN clients c ON w.client_id = c.id
        LEFT JOIN websites ws ON w.website_id = ws.id
        WHERE w.client_id = ${clientId}
        ORDER BY w.updated_at DESC
      `;
    } else if (websiteId) {
      workflows = await sql`
        SELECT w.*, c.name as client_name, ws.name as website_name, ws.url as website_url
        FROM workflows w
        LEFT JOIN clients c ON w.client_id = c.id
        LEFT JOIN websites ws ON w.website_id = ws.id
        WHERE w.website_id = ${websiteId}
        ORDER BY w.updated_at DESC
      `;
    } else {
      workflows = await sql`
        SELECT w.*, c.name as client_name, ws.name as website_name, ws.url as website_url
        FROM workflows w
        LEFT JOIN clients c ON w.client_id = c.id
        LEFT JOIN websites ws ON w.website_id = ws.id
        ORDER BY w.updated_at DESC
      `;
    }

    res.json({ workflows });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET standalone workflows (not linked to any client)
router.get('/standalone', requireDb, async (req, res) => {
  try {
    const workflows = await sql`
      SELECT * FROM workflows
      WHERE client_id IS NULL
      ORDER BY updated_at DESC
    `;

    res.json({ workflows });
  } catch (error) {
    console.error('Error fetching standalone workflows:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single workflow
router.get('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    const workflows = await sql`
      SELECT w.*, c.name as client_name, ws.name as website_name, ws.url as website_url,
             ws.wp_url, ws.wp_user, ws.wp_app_password,
             ws.elementor_connected, ws.elementor_api_key
      FROM workflows w
      LEFT JOIN clients c ON w.client_id = c.id
      LEFT JOIN websites ws ON w.website_id = ws.id
      WHERE w.id = ${id}
    `;

    if (workflows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json({ workflow: workflows[0] });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new workflow
router.post('/', requireDb, async (req, res) => {
  try {
    const { clientId, websiteId, name, description, state } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Workflow name is required' });
    }

    const result = await sql`
      INSERT INTO workflows (client_id, website_id, name, description, state)
      VALUES (${clientId || null}, ${websiteId || null}, ${name}, ${description || null}, ${JSON.stringify(state || {})})
      RETURNING *
    `;

    res.status(201).json({ workflow: result[0] });
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST duplicate workflow
router.post('/:id/duplicate', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, clientId, websiteId } = req.body;

    // Get the source workflow
    const source = await sql`SELECT * FROM workflows WHERE id = ${id}`;
    if (source.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const sourceWorkflow = source[0];
    const newName = name || `${sourceWorkflow.name} (Copy)`;

    const result = await sql`
      INSERT INTO workflows (client_id, website_id, name, description, state)
      VALUES (
        ${clientId !== undefined ? clientId : sourceWorkflow.client_id},
        ${websiteId !== undefined ? websiteId : sourceWorkflow.website_id},
        ${newName},
        ${sourceWorkflow.description},
        ${JSON.stringify(sourceWorkflow.state)}
      )
      RETURNING *
    `;

    res.status(201).json({ workflow: result[0] });
  } catch (error) {
    console.error('Error duplicating workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update workflow
router.put('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId, websiteId, name, description, state } = req.body;

    const result = await sql`
      UPDATE workflows
      SET client_id = ${clientId || null},
          website_id = ${websiteId || null},
          name = ${name},
          description = ${description || null},
          state = ${JSON.stringify(state || {})},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json({ workflow: result[0] });
  } catch (error) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH update workflow state only (for frequent saves)
router.patch('/:id/state', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { state } = req.body;

    const result = await sql`
      UPDATE workflows
      SET state = ${JSON.stringify(state || {})},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json({ workflow: result[0] });
  } catch (error) {
    console.error('Error updating workflow state:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE workflow
router.delete('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM workflows WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json({ deleted: result[0] });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
