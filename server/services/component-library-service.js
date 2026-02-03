/**
 * Component Library Service
 * Shared logic for component library operations
 * Used by both API routes and elementor.js publish flow
 */

import { sql, isDatabaseEnabled } from '../db/index.js';

/**
 * Get all components for a workflow
 * @param {number} workflowId - The workflow ID
 * @returns {Promise<Array>} List of components
 */
export async function getComponentsForWorkflow(workflowId) {
  if (!isDatabaseEnabled()) {
    return [];
  }

  try {
    const components = await sql`
      SELECT * FROM component_library
      WHERE workflow_id = ${workflowId} AND is_active = true
      ORDER BY slot_number, sort_order, created_at
    `;
    return components;
  } catch (err) {
    // Table might not exist yet - return empty array
    console.error('[ComponentLibrary] Error fetching components:', err.message);
    return [];
  }
}

/**
 * Get component settings for a workflow
 * @param {number} workflowId - The workflow ID
 * @returns {Promise<Object>} Component settings
 */
export async function getComponentSettings(workflowId) {
  const defaultSettings = {
    enabled: false,
    slots: [
      { number: 1, name: 'Hero/Slider', position: 'top', rotation: 'sequential' },
      { number: 2, name: 'Stats Bar', position: 'middle', rotation: 'sequential' },
      { number: 3, name: 'Benefits', position: 'bottom', rotation: 'sequential' }
    ]
  };

  if (!isDatabaseEnabled()) {
    return defaultSettings;
  }

  try {
    const result = await sql`
      SELECT component_settings FROM workflows WHERE id = ${workflowId}
    `;

    if (result.length === 0 || !result[0].component_settings) {
      return defaultSettings;
    }

    return result[0].component_settings;
  } catch (err) {
    // Column might not exist yet - return defaults
    console.error('[ComponentLibrary] Error fetching settings:', err.message);
    return defaultSettings;
  }
}

/**
 * Update component settings for a workflow
 * @param {number} workflowId - The workflow ID
 * @param {Object} settings - New settings
 * @returns {Promise<Object>} Updated settings
 */
export async function updateComponentSettings(workflowId, settings) {
  if (!isDatabaseEnabled()) {
    throw new Error('Database not enabled');
  }

  await sql`
    UPDATE workflows
    SET component_settings = ${JSON.stringify(settings)}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${workflowId}
  `;

  return settings;
}

/**
 * Select components for an article based on tag
 * Handles fallback to Global and rotation
 * @param {number} workflowId - The workflow ID
 * @param {string|null} articleTag - The article's tag (H, J, C, or null)
 * @returns {Promise<Object>} Components for each slot { slot1: {...}, slot2: {...}, slot3: {...}, enabled: boolean }
 */
export async function selectComponentsForArticle(workflowId, articleTag) {
  const disabledResult = { enabled: false, slot1: null, slot2: null, slot3: null };

  if (!isDatabaseEnabled()) {
    return disabledResult;
  }

  try {
    // Get settings first to check if enabled
    const settings = await getComponentSettings(workflowId);
  if (!settings.enabled) {
    return { enabled: false, slot1: null, slot2: null, slot3: null };
  }

  // Get all active components for this workflow
  const allComponents = await getComponentsForWorkflow(workflowId);

  const result = {
    enabled: true,
    slot1: null,
    slot2: null,
    slot3: null
  };

  // Process each slot
  for (let slotNumber = 1; slotNumber <= 3; slotNumber++) {
    const slotConfig = settings.slots.find(s => s.number === slotNumber);
    const rotationMode = slotConfig?.rotation || 'sequential';

    // Get components for this slot
    const slotComponents = allComponents.filter(c => c.slot_number === slotNumber);

    // First try to find components matching the article tag
    let matchingComponents = articleTag
      ? slotComponents.filter(c => c.tag === articleTag)
      : [];

    // If no tag-specific components, fall back to Global (null tag)
    if (matchingComponents.length === 0) {
      matchingComponents = slotComponents.filter(c => c.tag === null || c.tag === '');
    }

    // If still no components, skip this slot
    if (matchingComponents.length === 0) {
      continue;
    }

    // Select component based on rotation mode
    let selectedComponent;
    if (matchingComponents.length === 1) {
      selectedComponent = matchingComponents[0];
    } else if (rotationMode === 'random') {
      // Random selection
      const randomIndex = Math.floor(Math.random() * matchingComponents.length);
      selectedComponent = matchingComponents[randomIndex];
    } else {
      // Sequential rotation - get next in order
      selectedComponent = await getNextInRotation(
        workflowId,
        slotNumber,
        articleTag,
        matchingComponents
      );
    }

    // Store the result
    const slotKey = `slot${slotNumber}`;
    result[slotKey] = {
      type: selectedComponent.component_type,
      ref: selectedComponent.component_ref,
      name: selectedComponent.name,
      id: selectedComponent.id
    };

    // Update rotation state
    await updateRotationState(workflowId, slotNumber, articleTag, selectedComponent.id);
  }

    return result;
  } catch (err) {
    // Any error - return disabled state to not break publish flow
    console.error('[ComponentLibrary] Error selecting components:', err.message);
    return disabledResult;
  }
}

/**
 * Get next component in sequential rotation
 * @param {number} workflowId
 * @param {number} slotNumber
 * @param {string|null} tag
 * @param {Array} components - Available components
 * @returns {Object} Next component to use
 */
async function getNextInRotation(workflowId, slotNumber, tag, components) {
  // Get current rotation state
  const stateResult = await sql`
    SELECT last_used_component_id FROM component_rotation_state
    WHERE workflow_id = ${workflowId}
      AND slot_number = ${slotNumber}
      AND (tag = ${tag} OR (tag IS NULL AND ${tag} IS NULL))
  `;

  const lastUsedId = stateResult.length > 0 ? stateResult[0].last_used_component_id : null;

  // Sort components by sort_order, then by id for consistency
  const sorted = [...components].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.id - b.id;
  });

  // Find the last used component's index
  const lastIndex = sorted.findIndex(c => c.id === lastUsedId);

  // Return the next one (or first if last was not found or was the last item)
  const nextIndex = (lastIndex + 1) % sorted.length;
  return sorted[nextIndex];
}

/**
 * Update rotation state after using a component
 * @param {number} workflowId
 * @param {number} slotNumber
 * @param {string|null} tag
 * @param {number} componentId
 */
async function updateRotationState(workflowId, slotNumber, tag, componentId) {
  await sql`
    INSERT INTO component_rotation_state (workflow_id, slot_number, tag, last_used_component_id, last_used_at)
    VALUES (${workflowId}, ${slotNumber}, ${tag}, ${componentId}, CURRENT_TIMESTAMP)
    ON CONFLICT (workflow_id, slot_number, tag)
    DO UPDATE SET last_used_component_id = ${componentId}, last_used_at = CURRENT_TIMESTAMP
  `;
}

/**
 * Add a component to the library
 * @param {Object} component - Component data
 * @returns {Promise<Object>} Created component
 */
export async function addComponent(component) {
  if (!isDatabaseEnabled()) {
    throw new Error('Database not enabled');
  }

  const {
    workflowId,
    slotNumber,
    slotName,
    componentType,
    componentRef,
    tag,
    name,
    sourcePageId,
    sourcePageUrl,
    sortOrder = 0
  } = component;

  const result = await sql`
    INSERT INTO component_library (
      workflow_id, slot_number, slot_name, component_type, component_ref,
      tag, name, source_page_id, source_page_url, sort_order
    )
    VALUES (
      ${workflowId}, ${slotNumber}, ${slotName}, ${componentType}, ${componentRef},
      ${tag || null}, ${name}, ${sourcePageId || null}, ${sourcePageUrl || null}, ${sortOrder}
    )
    RETURNING *
  `;

  return result[0];
}

/**
 * Delete a component (soft delete by setting is_active = false)
 * @param {number} componentId - Component ID
 * @returns {Promise<boolean>} Success
 */
export async function deleteComponent(componentId) {
  if (!isDatabaseEnabled()) {
    throw new Error('Database not enabled');
  }

  await sql`
    UPDATE component_library
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${componentId}
  `;

  return true;
}

/**
 * Hard delete a component
 * @param {number} componentId - Component ID
 * @returns {Promise<boolean>} Success
 */
export async function hardDeleteComponent(componentId) {
  if (!isDatabaseEnabled()) {
    throw new Error('Database not enabled');
  }

  await sql`DELETE FROM component_library WHERE id = ${componentId}`;
  return true;
}

/**
 * Detect components from Elementor page JSON
 * Finds Slider Revolution shortcodes and Elementor templates
 * @param {string} elementorDataJson - JSON string of _elementor_data
 * @returns {Object} Detected components { sliders: [], templates: [] }
 */
export function detectComponentsFromPageJson(elementorDataJson) {
  let elements;
  try {
    elements = typeof elementorDataJson === 'string'
      ? JSON.parse(elementorDataJson)
      : elementorDataJson;
  } catch (e) {
    console.error('[ComponentLibrary] Failed to parse Elementor data:', e.message);
    return { sliders: [], templates: [] };
  }

  const sliders = [];
  const templates = [];

  function traverse(el, depth = 0) {
    if (!el) return;

    // Check for Slider Revolution shortcode
    if (el.widgetType === 'shortcode' && el.settings?.shortcode) {
      const match = el.settings.shortcode.match(/\[rev_slider\s+alias="([^"]+)"\]/);
      if (match) {
        sliders.push({
          type: 'slider_revolution',
          alias: match[1],
          fullShortcode: el.settings.shortcode,
          elementorId: el.id,
          depth
        });
      }
    }

    // Check for Elementor template widget
    if (el.widgetType === 'template' && el.settings?.template_id) {
      templates.push({
        type: 'elementor_template',
        templateId: el.settings.template_id,
        elementorId: el.id,
        depth
      });
    }

    // Recursively check children
    if (el.elements && Array.isArray(el.elements)) {
      el.elements.forEach(child => traverse(child, depth + 1));
    }
  }

  // Handle both array and single element
  if (Array.isArray(elements)) {
    elements.forEach(el => traverse(el));
  } else {
    traverse(elements);
  }

  return { sliders, templates };
}

export default {
  getComponentsForWorkflow,
  getComponentSettings,
  updateComponentSettings,
  selectComponentsForArticle,
  addComponent,
  deleteComponent,
  hardDeleteComponent,
  detectComponentsFromPageJson
};
