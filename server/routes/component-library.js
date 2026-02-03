/**
 * Component Library Routes
 * API endpoints for managing reusable page components
 */

import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';
import {
  getComponentsForWorkflow,
  getComponentSettings,
  updateComponentSettings,
  selectComponentsForArticle,
  addComponent,
  deleteComponent,
  detectComponentsFromPageJson
} from '../services/component-library-service.js';
import { fetchWordPressPage } from '../services/elementor-style-extractor.js';

const router = express.Router();

/**
 * GET /api/component-library/:workflowId
 * Get all components and settings for a workflow
 */
router.get('/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;

    if (!isDatabaseEnabled()) {
      return res.json({ success: true, components: [], settings: { enabled: false } });
    }

    const components = await getComponentsForWorkflow(parseInt(workflowId));
    const settings = await getComponentSettings(parseInt(workflowId));

    // Group components by slot for easier UI rendering
    const bySlot = {
      1: components.filter(c => c.slot_number === 1),
      2: components.filter(c => c.slot_number === 2),
      3: components.filter(c => c.slot_number === 3)
    };

    res.json({
      success: true,
      components,
      bySlot,
      settings
    });
  } catch (error) {
    console.error('[ComponentLibrary] Error fetching components:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/component-library/:workflowId/settings
 * Update component settings for a workflow
 */
router.put('/:workflowId/settings', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { settings } = req.body;

    if (!isDatabaseEnabled()) {
      return res.status(400).json({ success: false, error: 'Database not enabled' });
    }

    const updated = await updateComponentSettings(parseInt(workflowId), settings);

    res.json({ success: true, settings: updated });
  } catch (error) {
    console.error('[ComponentLibrary] Error updating settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/component-library/:workflowId/fetch-page
 * Fetch a WordPress page and detect components
 */
router.post('/:workflowId/fetch-page', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { pageId } = req.body;

    if (!pageId) {
      return res.status(400).json({ success: false, error: 'Page ID is required' });
    }

    // Get website credentials from workflow
    const workflowResult = await sql`
      SELECT w.id, ws.wp_url, ws.wp_user, ws.wp_app_password
      FROM workflows w
      JOIN websites ws ON w.website_id = ws.id
      WHERE w.id = ${parseInt(workflowId)}
    `;

    if (workflowResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow not found or no website linked' });
    }

    const { wp_url, wp_user, wp_app_password } = workflowResult[0];

    if (!wp_url || !wp_user || !wp_app_password) {
      return res.status(400).json({ success: false, error: 'WordPress credentials not configured for this website' });
    }

    // Fetch page from WordPress
    console.log(`[ComponentLibrary] Fetching page ${pageId} from ${wp_url}`);
    const pageData = await fetchWordPressPage({
      wpUrl: wp_url,
      wpUser: wp_user,
      wpPassword: wp_app_password,
      pageId: parseInt(pageId)
    });

    // Detect components from the page
    const detected = detectComponentsFromPageJson(pageData.elementorData);

    res.json({
      success: true,
      pageInfo: {
        id: pageData.id,
        title: pageData.title,
        url: pageData.link
      },
      detected: {
        sliders: detected.sliders,
        templates: detected.templates,
        total: detected.sliders.length + detected.templates.length
      }
    });
  } catch (error) {
    console.error('[ComponentLibrary] Error fetching page:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/component-library/:workflowId/add
 * Add a component to the library (manual or from detected)
 */
router.post('/:workflowId/add', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const {
      slotNumber,
      slotName,
      componentType,
      componentRef,
      tag,
      name,
      sourcePageId,
      sourcePageUrl
    } = req.body;

    // Validate required fields
    if (!slotNumber || !componentType || !componentRef || !name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: slotNumber, componentType, componentRef, name'
      });
    }

    // Validate slot number
    if (slotNumber < 1 || slotNumber > 3) {
      return res.status(400).json({ success: false, error: 'Slot number must be 1, 2, or 3' });
    }

    // Validate component type
    if (!['slider_revolution', 'elementor_template'].includes(componentType)) {
      return res.status(400).json({
        success: false,
        error: 'Component type must be slider_revolution or elementor_template'
      });
    }

    const component = await addComponent({
      workflowId: parseInt(workflowId),
      slotNumber,
      slotName: slotName || getDefaultSlotName(slotNumber),
      componentType,
      componentRef,
      tag: tag || null, // null = Global
      name,
      sourcePageId,
      sourcePageUrl
    });

    res.json({ success: true, component });
  } catch (error) {
    console.error('[ComponentLibrary] Error adding component:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/component-library/:workflowId/save-batch
 * Save multiple components at once (from page detection)
 */
router.post('/:workflowId/save-batch', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { components, sourcePageId, sourcePageUrl } = req.body;

    if (!components || !Array.isArray(components)) {
      return res.status(400).json({ success: false, error: 'Components array is required' });
    }

    const saved = [];
    for (const comp of components) {
      const component = await addComponent({
        workflowId: parseInt(workflowId),
        slotNumber: comp.slotNumber,
        slotName: comp.slotName || getDefaultSlotName(comp.slotNumber),
        componentType: comp.componentType,
        componentRef: comp.componentRef,
        tag: comp.tag || null,
        name: comp.name,
        sourcePageId: sourcePageId || null,
        sourcePageUrl: sourcePageUrl || null
      });
      saved.push(component);
    }

    res.json({ success: true, components: saved, count: saved.length });
  } catch (error) {
    console.error('[ComponentLibrary] Error saving batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/component-library/:workflowId/:componentId
 * Delete a component (soft delete)
 */
router.delete('/:workflowId/:componentId', async (req, res) => {
  try {
    const { componentId } = req.params;

    await deleteComponent(parseInt(componentId));

    res.json({ success: true });
  } catch (error) {
    console.error('[ComponentLibrary] Error deleting component:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/component-library/:workflowId/select/:articleTag
 * Select components for article generation (used by publish flow)
 * This is mainly for testing - the actual selection happens in elementor.js via the service
 */
router.get('/:workflowId/select/:articleTag', async (req, res) => {
  try {
    const { workflowId, articleTag } = req.params;

    const tag = articleTag === 'null' || articleTag === 'undefined' ? null : articleTag;
    const selection = await selectComponentsForArticle(parseInt(workflowId), tag);

    res.json({ success: true, ...selection });
  } catch (error) {
    console.error('[ComponentLibrary] Error selecting components:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/component-library/:workflowId/:componentId
 * Update a component
 */
router.put('/:workflowId/:componentId', async (req, res) => {
  try {
    const { componentId } = req.params;
    const updates = req.body;

    if (!isDatabaseEnabled()) {
      return res.status(400).json({ success: false, error: 'Database not enabled' });
    }

    // Build update query dynamically based on provided fields
    const allowedFields = ['slot_number', 'slot_name', 'component_type', 'component_ref', 'tag', 'name', 'sort_order'];
    const updateParts = [];
    const values = {};

    for (const field of allowedFields) {
      // Handle camelCase to snake_case conversion
      const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      if (updates[field] !== undefined || updates[camelField] !== undefined) {
        const value = updates[field] !== undefined ? updates[field] : updates[camelField];
        values[field] = value;
      }
    }

    if (Object.keys(values).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    // Use individual update for each field since we can't do dynamic SQL with template literals easily
    for (const [field, value] of Object.entries(values)) {
      if (field === 'slot_number') await sql`UPDATE component_library SET slot_number = ${value}, updated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(componentId)}`;
      if (field === 'slot_name') await sql`UPDATE component_library SET slot_name = ${value}, updated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(componentId)}`;
      if (field === 'component_type') await sql`UPDATE component_library SET component_type = ${value}, updated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(componentId)}`;
      if (field === 'component_ref') await sql`UPDATE component_library SET component_ref = ${value}, updated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(componentId)}`;
      if (field === 'tag') await sql`UPDATE component_library SET tag = ${value}, updated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(componentId)}`;
      if (field === 'name') await sql`UPDATE component_library SET name = ${value}, updated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(componentId)}`;
      if (field === 'sort_order') await sql`UPDATE component_library SET sort_order = ${value}, updated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(componentId)}`;
    }

    // Fetch updated component
    const result = await sql`SELECT * FROM component_library WHERE id = ${parseInt(componentId)}`;

    res.json({ success: true, component: result[0] });
  } catch (error) {
    console.error('[ComponentLibrary] Error updating component:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Helper: Get default slot name
 */
function getDefaultSlotName(slotNumber) {
  const names = {
    1: 'Hero/Slider',
    2: 'Stats Bar',
    3: 'Benefits'
  };
  return names[slotNumber] || `Slot ${slotNumber}`;
}

export default router;
