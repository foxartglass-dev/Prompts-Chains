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
      SELECT w.*, pp.name as project_name
      FROM workflows w
      LEFT JOIN personal_projects pp ON w.personal_project_id = pp.id
      WHERE w.client_id IS NULL
      ORDER BY w.updated_at DESC
    `;

    res.json({ workflows });
  } catch (error) {
    console.error('Error fetching standalone workflows:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET workflows by personal project
router.get('/by-project/:projectId', requireDb, async (req, res) => {
  try {
    const { projectId } = req.params;
    const workflows = await sql`
      SELECT w.*, pp.name as project_name
      FROM workflows w
      LEFT JOIN personal_projects pp ON w.personal_project_id = pp.id
      WHERE w.personal_project_id = ${projectId}
      ORDER BY w.updated_at DESC
    `;

    res.json({ workflows });
  } catch (error) {
    console.error('Error fetching project workflows:', error);
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
             ws.elementor_connected, ws.elementor_api_key,
             pp.name as project_name
      FROM workflows w
      LEFT JOIN clients c ON w.client_id = c.id
      LEFT JOIN websites ws ON w.website_id = ws.id
      LEFT JOIN personal_projects pp ON w.personal_project_id = pp.id
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
    const { clientId, websiteId, personalProjectId, name, description, state } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Workflow name is required' });
    }

    const result = await sql`
      INSERT INTO workflows (client_id, website_id, personal_project_id, name, description, state)
      VALUES (${clientId || null}, ${websiteId || null}, ${personalProjectId || null}, ${name}, ${description || null}, ${JSON.stringify(state || {})})
      RETURNING *
    `;

    // Fetch with joined data to return project_name, etc.
    const workflows = await sql`
      SELECT w.*, c.name as client_name, ws.name as website_name, pp.name as project_name
      FROM workflows w
      LEFT JOIN clients c ON w.client_id = c.id
      LEFT JOIN websites ws ON w.website_id = ws.id
      LEFT JOIN personal_projects pp ON w.personal_project_id = pp.id
      WHERE w.id = ${result[0].id}
    `;

    res.status(201).json({ workflow: workflows[0] });
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

    const newWorkflowId = result[0].id;

    // Also copy image_creation_settings if they exist for the source workflow
    try {
      const imageSettings = await sql`
        SELECT * FROM image_creation_settings WHERE workflow_id = ${id}
      `;

      if (imageSettings.length > 0) {
        const srcSettings = imageSettings[0];
        console.log('[Workflow Duplicate] Copying image_creation_settings to new workflow:', newWorkflowId);

        await sql`
          INSERT INTO image_creation_settings (
            workflow_id,
            enabled,
            prompt_assistant_model,
            image_generation_model,
            image_quality,
            reference_images,
            logo_images,
            audience_avatars,
            image_bank,
            image_categories,
            auto_tag_enabled,
            chat_history,
            dual_chat_left_model,
            dual_chat_right_model,
            dual_chat_left_history,
            dual_chat_right_history,
            smart_matching_enabled,
            image_to_variation_map,
            fallback_to_live,
            image_order,
            variation_order_mode
          )
          VALUES (
            ${newWorkflowId},
            ${srcSettings.enabled},
            ${srcSettings.prompt_assistant_model},
            ${srcSettings.image_generation_model},
            ${srcSettings.image_quality},
            ${JSON.stringify(srcSettings.reference_images || [])},
            ${JSON.stringify(srcSettings.logo_images || [])},
            ${JSON.stringify(srcSettings.audience_avatars || [])},
            ${JSON.stringify(srcSettings.image_bank || [])},
            ${JSON.stringify(srcSettings.image_categories || [])},
            ${srcSettings.auto_tag_enabled},
            ${JSON.stringify(srcSettings.chat_history || [])},
            ${srcSettings.dual_chat_left_model},
            ${srcSettings.dual_chat_right_model},
            ${JSON.stringify(srcSettings.dual_chat_left_history || [])},
            ${JSON.stringify(srcSettings.dual_chat_right_history || [])},
            ${srcSettings.smart_matching_enabled},
            ${JSON.stringify(srcSettings.image_to_variation_map || {})},
            ${srcSettings.fallback_to_live},
            ${JSON.stringify(srcSettings.image_order || [])},
            ${srcSettings.variation_order_mode}
          )
        `;
        console.log('[Workflow Duplicate] Image settings copied successfully');
      }
    } catch (imgErr) {
      // Log but don't fail the whole operation if image settings copy fails
      console.error('[Workflow Duplicate] Failed to copy image settings:', imgErr.message);
    }

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
    const { clientId, websiteId, personalProjectId, name, description, state } = req.body;

    // First get existing workflow to preserve state if not provided
    const existing = await sql`SELECT * FROM workflows WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const existingWorkflow = existing[0];
    const newState = state && Object.keys(state).length > 0 ? state : existingWorkflow.state;

    const result = await sql`
      UPDATE workflows
      SET client_id = ${clientId !== undefined ? clientId : existingWorkflow.client_id},
          website_id = ${websiteId !== undefined ? websiteId : existingWorkflow.website_id},
          personal_project_id = ${personalProjectId !== undefined ? personalProjectId : existingWorkflow.personal_project_id},
          name = ${name || existingWorkflow.name},
          description = ${description !== undefined ? description : existingWorkflow.description},
          state = ${JSON.stringify(newState || {})},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

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
