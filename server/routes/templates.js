// Template API routes
import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';

const router = express.Router();

const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// GET all templates (optionally filter by type)
router.get('/', requireDb, async (req, res) => {
  try {
    const { type } = req.query;

    let templates;
    if (type) {
      templates = await sql`
        SELECT * FROM templates
        WHERE template_type = ${type}
        ORDER BY created_at DESC
      `;
    } else {
      templates = await sql`
        SELECT * FROM templates
        ORDER BY template_type, created_at DESC
      `;
    }

    res.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single template
router.get('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const templates = await sql`
      SELECT * FROM templates WHERE id = ${id}
    `;

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: templates[0] });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create template
router.post('/', requireDb, async (req, res) => {
  try {
    const { name, description, templateType, templateData, tags } = req.body;

    if (!name || !templateType) {
      return res.status(400).json({ error: 'Name and template type are required' });
    }

    const result = await sql`
      INSERT INTO templates (name, description, template_type, template_data, tags)
      VALUES (${name}, ${description || ''}, ${templateType}, ${JSON.stringify(templateData || {})}, ${JSON.stringify(tags || [])})
      RETURNING *
    `;

    res.status(201).json({ template: result[0] });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update template
router.put('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, templateType, templateData, tags } = req.body;

    const result = await sql`
      UPDATE templates
      SET name = ${name},
          description = ${description || ''},
          template_type = ${templateType},
          template_data = ${JSON.stringify(templateData || {})},
          tags = ${JSON.stringify(tags || [])},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: result[0] });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE template
router.delete('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await sql`
      DELETE FROM templates WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ deleted: result[0] });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
