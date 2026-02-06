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

// Template types:
// - full_workflow: Complete workflow with all sections
// - prompts: Just the prompt templates
// - placeholders: Just placeholders
// - tags: Just tags
// - snippets: Just tagged snippets
// - website_setup: Multiple workflows for a website
// - client_setup: Full client with all websites/workflows

// GET all templates (optionally filter by type, tag, scope, or website)
// NOTE: Does NOT return template_data in list view to avoid huge responses.
// Use GET /:id to fetch full template with data.
router.get('/', requireDb, async (req, res) => {
  try {
    const { type, tag, search, scope, websiteId } = req.query;

    let templates;

    // Build dynamic query based on filters
    // NOTE: Exclude template_data from list queries - it can be huge (contains image_bank with base64)
    // Use GET /:id to fetch full template with data when applying
    // For websiteId filter: return templates that are either:
    // - App global (scope = 'app')
    // - Website specific (scope = 'website' AND website_id matches)
    // - Legacy templates without scope (treat as app global)
    if (websiteId) {
      // Return app-global templates + website-specific templates for this website
      if (type) {
        templates = await sql`
          SELECT id, name, description, template_type, includes, tags, scope, website_id, created_at, updated_at FROM templates
          WHERE template_type = ${type}
          AND (scope = 'app' OR scope IS NULL OR (scope = 'website' AND website_id = ${websiteId}))
          ORDER BY scope DESC, created_at DESC
        `;
      } else {
        templates = await sql`
          SELECT id, name, description, template_type, includes, tags, scope, website_id, created_at, updated_at FROM templates
          WHERE (scope = 'app' OR scope IS NULL OR (scope = 'website' AND website_id = ${websiteId}))
          ORDER BY template_type, scope DESC, created_at DESC
        `;
      }
    } else if (scope === 'app') {
      // Only app-global templates
      templates = await sql`
        SELECT id, name, description, template_type, includes, tags, scope, website_id, created_at, updated_at FROM templates
        WHERE scope = 'app' OR scope IS NULL
        ORDER BY template_type, created_at DESC
      `;
    } else if (type && tag) {
      templates = await sql`
        SELECT id, name, description, template_type, includes, tags, scope, website_id, created_at, updated_at FROM templates
        WHERE template_type = ${type}
        AND tags @> ${JSON.stringify([tag])}
        ORDER BY created_at DESC
      `;
    } else if (type) {
      templates = await sql`
        SELECT id, name, description, template_type, includes, tags, scope, website_id, created_at, updated_at FROM templates
        WHERE template_type = ${type}
        ORDER BY created_at DESC
      `;
    } else if (tag) {
      templates = await sql`
        SELECT id, name, description, template_type, includes, tags, scope, website_id, created_at, updated_at FROM templates
        WHERE tags @> ${JSON.stringify([tag])}
        ORDER BY created_at DESC
      `;
    } else if (search) {
      templates = await sql`
        SELECT id, name, description, template_type, includes, tags, scope, website_id, created_at, updated_at FROM templates
        WHERE name ILIKE ${'%' + search + '%'}
        OR description ILIKE ${'%' + search + '%'}
        ORDER BY template_type, created_at DESC
      `;
    } else {
      templates = await sql`
        SELECT id, name, description, template_type, includes, tags, scope, website_id, created_at, updated_at FROM templates
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
    const { name, description, templateType, templateData, includes, tags, sourceWorkflowId, scope, websiteId } = req.body;

    if (!name || !templateType) {
      return res.status(400).json({ error: 'Name and template type are required' });
    }

    // Default includes based on what's being saved
    const defaultIncludes = {
      prompts: true,
      placeholders: true,
      tags: true,
      snippets: true,
      settings: true,
      imageCreation: true
    };

    // Build final template data
    let finalTemplateData = templateData || {};

    // If imageCreation is included and we have a source workflow, copy image settings
    const finalIncludes = includes || defaultIncludes;
    if (finalIncludes.imageCreation && sourceWorkflowId) {
      try {
        const imageSettings = await sql`
          SELECT * FROM image_creation_settings WHERE workflow_id = ${sourceWorkflowId}
        `;
        if (imageSettings.length > 0) {
          const settings = imageSettings[0];
          // Store image creation settings in template data (excluding workflow_id and id)
          finalTemplateData.imageCreation = {
            enabled: settings.enabled,
            prompt_assistant_model: settings.prompt_assistant_model,
            image_generation_model: settings.image_generation_model,
            image_quality: settings.image_quality,
            reference_images: settings.reference_images || [],
            logo_images: settings.logo_images || [],
            audience_avatars: settings.audience_avatars || [],
            image_bank: settings.image_bank || [],
            image_categories: settings.image_categories || [],
            auto_tag_enabled: settings.auto_tag_enabled,
            smart_matching_enabled: settings.smart_matching_enabled,
            image_to_variation_map: settings.image_to_variation_map || {},
            fallback_to_live: settings.fallback_to_live,
            image_order: settings.image_order || [],
            variation_order_mode: settings.variation_order_mode
          };
          console.log('[Templates] Included image creation settings from workflow:', sourceWorkflowId);
        }
      } catch (imgErr) {
        console.error('[Templates] Failed to include image settings:', imgErr.message);
      }
    }

    const result = await sql`
      INSERT INTO templates (name, description, template_type, template_data, includes, tags, scope, website_id)
      VALUES (
        ${name},
        ${description || ''},
        ${templateType},
        ${JSON.stringify(finalTemplateData)},
        ${JSON.stringify(finalIncludes)},
        ${JSON.stringify(tags || [])},
        ${scope || 'website'},
        ${websiteId || null}
      )
      RETURNING *
    `;

    res.status(201).json({ template: result[0] });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create template from workflow (with section selection)
router.post('/from-workflow/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { name, description, includes, tags, scope, websiteId } = req.body;

    // includes = { prompts: true, placeholders: true, tags: false, snippets: true, settings: false }

    // Get the workflow
    const workflows = await sql`SELECT * FROM workflows WHERE id = ${workflowId}`;
    if (workflows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const workflow = workflows[0];
    const state = workflow.state || {};

    // Build template data based on selected sections
    const templateData = {};
    const warnings = []; // Track partial save issues
    const selectedIncludes = includes || { prompts: true, placeholders: true, tags: true, snippets: true, settings: true, imageCreation: true, sitePlanning: true, componentLibrary: true };

    if (selectedIncludes.prompts && state.promptTemplates) {
      templateData.promptTemplates = state.promptTemplates;
    }
    if (selectedIncludes.placeholders && state.placeholders) {
      templateData.placeholders = state.placeholders;
    }
    if (selectedIncludes.tags && state.tags) {
      templateData.tags = state.tags;
    }
    if (selectedIncludes.snippets && state.taggedSnippets) {
      templateData.taggedSnippets = state.taggedSnippets;
    }
    if (selectedIncludes.settings) {
      templateData.settings = {
        provider: state.provider,
        model: state.model,
        fileNameTemplate: state.fileNameTemplate,
        wpContentType: state.wpContentType,
        wpTitleTemplate: state.wpTitleTemplate
      };
    }

    // Include Image Creation settings if selected
    if (selectedIncludes.imageCreation) {
      try {
        const imageSettings = await sql`
          SELECT * FROM image_creation_settings WHERE workflow_id = ${workflowId}
        `;
        if (imageSettings.length > 0) {
          const settings = imageSettings[0];
          templateData.imageCreation = {
            enabled: settings.enabled,
            prompt_assistant_model: settings.prompt_assistant_model,
            image_generation_model: settings.image_generation_model,
            image_quality: settings.image_quality,
            reference_images: settings.reference_images || [],
            logo_images: settings.logo_images || [],
            audience_avatars: settings.audience_avatars || [],
            image_bank: settings.image_bank || [],
            image_categories: settings.image_categories || [],
            auto_tag_enabled: settings.auto_tag_enabled,
            smart_matching_enabled: settings.smart_matching_enabled,
            fallback_to_live: settings.fallback_to_live,
            variation_order_mode: settings.variation_order_mode
          };
          console.log('[Template] Included image creation settings');
        } else {
          console.log('[Template] No image creation settings found for workflow', workflowId);
          warnings.push('Image Creation: No settings found for this workflow');
        }
      } catch (err) {
        console.error('[Template] Failed to load image creation settings:', err.message);
        warnings.push(`Image Creation: ${err.message}`);
      }
    }

    // Include Site Planning if selected
    if (selectedIncludes.sitePlanning) {
      try {
        const sitePlans = await sql`
          SELECT * FROM site_plans WHERE workflow_id = ${workflowId}
        `;
        if (sitePlans.length > 0) {
          const plan = sitePlans[0];
          const nodes = await sql`
            SELECT * FROM site_plan_nodes WHERE site_plan_id = ${plan.id} ORDER BY depth, sort_order
          `;
          templateData.sitePlanning = {
            plan: {
              name: plan.name,
              description: plan.description,
              auto_sync_check: plan.auto_sync_check
            },
            nodes: nodes.map(n => ({
              title: n.title,
              slug: n.slug,
              page_type: n.page_type,
              target_keyword: n.target_keyword,
              meta_title: n.meta_title,
              meta_description: n.meta_description,
              content_brief: n.content_brief,
              sort_order: n.sort_order,
              depth: n.depth,
              is_pillar_page: n.is_pillar_page,
              is_in_menu: n.is_in_menu,
              menu_order: n.menu_order,
              parent_slug: nodes.find(p => p.id === n.parent_id)?.slug || null
            }))
          };
          console.log('[Template] Included site planning with', nodes.length, 'nodes');
        } else {
          console.log('[Template] No site planning found for workflow', workflowId);
          warnings.push('Site Planning: No site plan found for this workflow');
        }
      } catch (err) {
        console.error('[Template] Failed to load site planning:', err.message);
        warnings.push(`Site Planning: ${err.message}`);
      }
    }

    // Include Component Library if selected
    if (selectedIncludes.componentLibrary) {
      try {
        // Get components from component_library table
        const components = await sql`
          SELECT slot_number, slot_name, component_type, component_ref, module_name,
                 tag, name, source_page_id, source_page_url, sort_order, is_active
          FROM component_library
          WHERE workflow_id = ${workflowId} AND is_active = true
          ORDER BY slot_number, sort_order
        `;

        // Get component settings from workflow
        const workflowSettings = await sql`
          SELECT component_settings FROM workflows WHERE id = ${workflowId}
        `;
        const componentSettings = workflowSettings[0]?.component_settings || {
          enabled: false,
          slots: [
            { number: 1, name: 'Hero/Slider', position: 'top', rotation: 'sequential', enabled: true },
            { number: 2, name: 'Stats Bar', position: 'middle', rotation: 'sequential', enabled: true },
            { number: 3, name: 'Benefits', position: 'bottom', rotation: 'sequential', enabled: true }
          ]
        };

        if (components.length > 0 || componentSettings.enabled) {
          templateData.componentLibrary = {
            settings: componentSettings,
            components: components.map(c => ({
              slot_number: c.slot_number,
              slot_name: c.slot_name,
              component_type: c.component_type,
              component_ref: c.component_ref,
              module_name: c.module_name,
              tag: c.tag,
              name: c.name,
              source_page_id: c.source_page_id,
              source_page_url: c.source_page_url,
              sort_order: c.sort_order
            }))
          };
          console.log('[Template] Included component library with', components.length, 'components');
        } else {
          console.log('[Template] No component library data found for workflow', workflowId);
          warnings.push('Component Library: No components found for this workflow');
        }
      } catch (err) {
        console.error('[Template] Failed to load component library:', err.message);
        warnings.push(`Component Library: ${err.message}`);
      }
    }

    // Determine template type based on what's included
    let templateType = 'full_workflow';
    const includedSections = Object.entries(selectedIncludes).filter(([_, v]) => v).map(([k]) => k);
    if (includedSections.length === 1) {
      templateType = includedSections[0]; // 'prompts', 'placeholders', 'tags', or 'snippets'
    }

    const result = await sql`
      INSERT INTO templates (name, description, template_type, template_data, includes, tags, scope, website_id)
      VALUES (
        ${name || `${workflow.name} Template`},
        ${description || `Template created from workflow: ${workflow.name}`},
        ${templateType},
        ${JSON.stringify(templateData)},
        ${JSON.stringify(selectedIncludes)},
        ${JSON.stringify(tags || [])},
        ${scope || 'website'},
        ${websiteId || null}
      )
      RETURNING *
    `;

    // Include warnings in response if any sections had issues
    const response = { template: result[0] };
    if (warnings.length > 0) {
      response.warnings = warnings;
      console.log('[Template] Saved with warnings:', warnings);
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating template from workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create template from website (all workflows)
router.post('/from-website/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { name, description, tags } = req.body;

    // Get all workflows for this website
    const workflows = await sql`
      SELECT * FROM workflows WHERE website_id = ${websiteId}
    `;

    if (workflows.length === 0) {
      return res.status(404).json({ error: 'No workflows found for this website' });
    }

    // Get website info
    const websites = await sql`SELECT * FROM websites WHERE id = ${websiteId}`;
    const website = websites[0];

    const templateData = {
      workflows: workflows.map(w => ({
        name: w.name,
        description: w.description,
        state: w.state
      }))
    };

    const result = await sql`
      INSERT INTO templates (name, description, template_type, template_data, includes, tags)
      VALUES (
        ${name || `${website?.name || 'Website'} Setup Template`},
        ${description || `Complete setup with ${workflows.length} workflows`},
        'website_setup',
        ${JSON.stringify(templateData)},
        ${JSON.stringify({ workflows: true })},
        ${JSON.stringify(tags || [])}
      )
      RETURNING *
    `;

    res.status(201).json({ template: result[0] });
  } catch (error) {
    console.error('Error creating template from website:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST apply template to workflow
router.post('/:id/apply/:workflowId', requireDb, async (req, res) => {
  try {
    const { id, workflowId } = req.params;
    const { merge = false } = req.body; // If true, merge with existing. If false, replace.

    // Get template
    const templates = await sql`SELECT * FROM templates WHERE id = ${id}`;
    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Get workflow
    const workflows = await sql`SELECT * FROM workflows WHERE id = ${workflowId}`;
    if (workflows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const template = templates[0];
    const workflow = workflows[0];
    const templateData = template.template_data || {};
    const includes = template.includes || {};

    let newState = merge ? { ...workflow.state } : {};

    // Apply template sections based on includes
    if (includes.prompts && templateData.promptTemplates) {
      newState.promptTemplates = merge
        ? [...(workflow.state?.promptTemplates || []), ...templateData.promptTemplates]
        : templateData.promptTemplates;
    }
    if (includes.placeholders && templateData.placeholders) {
      newState.placeholders = merge
        ? [...(workflow.state?.placeholders || []), ...templateData.placeholders]
        : templateData.placeholders;
    }
    if (includes.tags && templateData.tags) {
      newState.tags = merge
        ? [...(workflow.state?.tags || []), ...templateData.tags]
        : templateData.tags;
    }
    if (includes.snippets && templateData.taggedSnippets) {
      newState.taggedSnippets = merge
        ? [...(workflow.state?.taggedSnippets || []), ...templateData.taggedSnippets]
        : templateData.taggedSnippets;
    }
    if (includes.settings && templateData.settings) {
      newState = { ...newState, ...templateData.settings };
    }

    // Update workflow state
    const result = await sql`
      UPDATE workflows
      SET state = ${JSON.stringify(newState)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${workflowId}
      RETURNING *
    `;

    // Apply Image Creation settings if included
    if (includes.imageCreation && templateData.imageCreation) {
      try {
        const img = templateData.imageCreation;
        // Check if settings already exist for this workflow
        const existingSettings = await sql`
          SELECT id FROM image_creation_settings WHERE workflow_id = ${workflowId}
        `;

        if (existingSettings.length > 0) {
          // Update existing settings
          if (merge) {
            // Merge: Combine arrays (image_bank, reference_images, etc.)
            const current = await sql`SELECT * FROM image_creation_settings WHERE workflow_id = ${workflowId}`;
            const currentSettings = current[0];
            await sql`
              UPDATE image_creation_settings
              SET
                enabled = COALESCE(${img.enabled}, enabled),
                prompt_assistant_model = COALESCE(${img.prompt_assistant_model}, prompt_assistant_model),
                image_generation_model = COALESCE(${img.image_generation_model}, image_generation_model),
                image_quality = COALESCE(${img.image_quality}, image_quality),
                reference_images = ${JSON.stringify([...(currentSettings.reference_images || []), ...(img.reference_images || [])])},
                logo_images = ${JSON.stringify([...(currentSettings.logo_images || []), ...(img.logo_images || [])])},
                audience_avatars = ${JSON.stringify([...(currentSettings.audience_avatars || []), ...(img.audience_avatars || [])])},
                image_bank = ${JSON.stringify([...(currentSettings.image_bank || []), ...(img.image_bank || [])])},
                image_categories = ${JSON.stringify([...new Set([...(currentSettings.image_categories || []), ...(img.image_categories || [])])])},
                auto_tag_enabled = COALESCE(${img.auto_tag_enabled}, auto_tag_enabled),
                smart_matching_enabled = COALESCE(${img.smart_matching_enabled}, smart_matching_enabled),
                fallback_to_live = COALESCE(${img.fallback_to_live}, fallback_to_live),
                variation_order_mode = COALESCE(${img.variation_order_mode}, variation_order_mode),
                updated_at = CURRENT_TIMESTAMP
              WHERE workflow_id = ${workflowId}
            `;
          } else {
            // Replace: Overwrite all settings
            await sql`
              UPDATE image_creation_settings
              SET
                enabled = ${img.enabled ?? false},
                prompt_assistant_model = ${img.prompt_assistant_model || 'gpt-4o'},
                image_generation_model = ${img.image_generation_model || 'gpt-image-1.5'},
                image_quality = ${img.image_quality || 'low'},
                reference_images = ${JSON.stringify(img.reference_images || [])},
                logo_images = ${JSON.stringify(img.logo_images || [])},
                audience_avatars = ${JSON.stringify(img.audience_avatars || [])},
                image_bank = ${JSON.stringify(img.image_bank || [])},
                image_categories = ${JSON.stringify(img.image_categories || [])},
                auto_tag_enabled = ${img.auto_tag_enabled ?? true},
                smart_matching_enabled = ${img.smart_matching_enabled ?? true},
                fallback_to_live = ${img.fallback_to_live ?? true},
                variation_order_mode = ${img.variation_order_mode || 'sequential'},
                updated_at = CURRENT_TIMESTAMP
              WHERE workflow_id = ${workflowId}
            `;
          }
        } else {
          // Insert new settings
          await sql`
            INSERT INTO image_creation_settings (
              workflow_id, enabled, prompt_assistant_model, image_generation_model,
              image_quality, reference_images, logo_images, audience_avatars,
              image_bank, image_categories, auto_tag_enabled, smart_matching_enabled,
              fallback_to_live, variation_order_mode
            ) VALUES (
              ${workflowId},
              ${img.enabled ?? false},
              ${img.prompt_assistant_model || 'gpt-4o'},
              ${img.image_generation_model || 'gpt-image-1.5'},
              ${img.image_quality || 'low'},
              ${JSON.stringify(img.reference_images || [])},
              ${JSON.stringify(img.logo_images || [])},
              ${JSON.stringify(img.audience_avatars || [])},
              ${JSON.stringify(img.image_bank || [])},
              ${JSON.stringify(img.image_categories || [])},
              ${img.auto_tag_enabled ?? true},
              ${img.smart_matching_enabled ?? true},
              ${img.fallback_to_live ?? true},
              ${img.variation_order_mode || 'sequential'}
            )
          `;
        }
        console.log('[Templates] Applied image creation settings to workflow:', workflowId);
      } catch (imgErr) {
        console.error('[Templates] Failed to apply image creation settings:', imgErr.message);
      }
    }

    // Apply Site Planning if included
    if (includes.sitePlanning && templateData.sitePlanning) {
      try {
        const sitePlanData = templateData.sitePlanning;

        if (!merge) {
          // Replace mode: Delete existing site plan for this workflow
          const existingPlans = await sql`
            SELECT id FROM site_plans WHERE workflow_id = ${workflowId}
          `;
          for (const plan of existingPlans) {
            await sql`DELETE FROM site_plan_nodes WHERE site_plan_id = ${plan.id}`;
            await sql`DELETE FROM site_plans WHERE id = ${plan.id}`;
          }
        }

        // Get the workflow's website_id for the site plan
        const workflowData = result[0];
        const websiteId = workflowData.website_id;

        // Create new site plan
        const planInfo = sitePlanData.plan || {};
        const newPlan = await sql`
          INSERT INTO site_plans (website_id, workflow_id, name, description, auto_sync_check)
          VALUES (
            ${websiteId},
            ${workflowId},
            ${planInfo.name || 'Site Structure'},
            ${planInfo.description || ''},
            ${planInfo.auto_sync_check ?? true}
          )
          RETURNING *
        `;
        const sitePlanId = newPlan[0].id;

        // Create nodes with proper parent relationships
        const nodes = sitePlanData.nodes || [];
        const slugToIdMap = {}; // Map slug -> new node ID for parent lookups

        // First pass: Create all nodes without parent_id
        for (const node of nodes) {
          const newNode = await sql`
            INSERT INTO site_plan_nodes (
              site_plan_id, title, slug, page_type, target_keyword,
              meta_title, meta_description, content_brief, sort_order,
              depth, is_pillar_page, is_in_menu, menu_order
            ) VALUES (
              ${sitePlanId},
              ${node.title},
              ${node.slug || ''},
              ${node.page_type || 'page'},
              ${node.target_keyword || ''},
              ${node.meta_title || ''},
              ${node.meta_description || ''},
              ${node.content_brief || ''},
              ${node.sort_order || 0},
              ${node.depth || 0},
              ${node.is_pillar_page ?? false},
              ${node.is_in_menu ?? true},
              ${node.menu_order || null}
            )
            RETURNING *
          `;
          slugToIdMap[node.slug] = newNode[0].id;
        }

        // Second pass: Update parent_id based on parent_slug
        for (const node of nodes) {
          if (node.parent_slug && slugToIdMap[node.parent_slug] && slugToIdMap[node.slug]) {
            await sql`
              UPDATE site_plan_nodes
              SET parent_id = ${slugToIdMap[node.parent_slug]}
              WHERE id = ${slugToIdMap[node.slug]}
            `;
          }
        }

        // Update site plan metadata
        const maxDepth = Math.max(0, ...nodes.map(n => n.depth || 0));
        await sql`
          UPDATE site_plans
          SET total_pages = ${nodes.length}, max_depth = ${maxDepth}
          WHERE id = ${sitePlanId}
        `;

        console.log('[Templates] Applied site planning to workflow:', workflowId, '- Created', nodes.length, 'nodes');
      } catch (siteErr) {
        console.error('[Templates] Failed to apply site planning:', siteErr.message);
      }
    }

    // Apply Component Library if included
    if (includes.componentLibrary && templateData.componentLibrary) {
      try {
        const compData = templateData.componentLibrary;

        if (!merge) {
          // Replace mode: Delete existing components for this workflow
          await sql`DELETE FROM component_library WHERE workflow_id = ${workflowId}`;
          // Reset rotation state
          await sql`DELETE FROM component_rotation_state WHERE workflow_id = ${workflowId}`;
        }

        // Insert components from template
        const components = compData.components || [];
        for (const comp of components) {
          if (merge) {
            // Merge mode: Check if component with same ref already exists
            const existing = await sql`
              SELECT id FROM component_library
              WHERE workflow_id = ${workflowId}
                AND component_type = ${comp.component_type}
                AND component_ref = ${comp.component_ref}
                AND COALESCE(tag, '') = COALESCE(${comp.tag}, '')
            `;
            if (existing.length > 0) {
              // Skip existing component
              continue;
            }
          }

          await sql`
            INSERT INTO component_library (
              workflow_id, slot_number, slot_name, component_type, component_ref,
              module_name, tag, name, source_page_id, source_page_url, sort_order, is_active
            ) VALUES (
              ${workflowId},
              ${comp.slot_number},
              ${comp.slot_name || null},
              ${comp.component_type},
              ${comp.component_ref},
              ${comp.module_name || null},
              ${comp.tag || null},
              ${comp.name},
              ${comp.source_page_id || null},
              ${comp.source_page_url || null},
              ${comp.sort_order || 0},
              true
            )
          `;
        }

        // Update component settings on workflow
        if (compData.settings) {
          if (merge) {
            // Merge mode: Only enable if template enables it, keep existing slot config
            const currentSettings = await sql`SELECT component_settings FROM workflows WHERE id = ${workflowId}`;
            const existingSettings = currentSettings[0]?.component_settings || { enabled: false, slots: [] };
            const mergedSettings = {
              ...existingSettings,
              enabled: existingSettings.enabled || compData.settings.enabled
            };
            await sql`
              UPDATE workflows
              SET component_settings = ${JSON.stringify(mergedSettings)}, updated_at = CURRENT_TIMESTAMP
              WHERE id = ${workflowId}
            `;
          } else {
            // Replace mode: Use template settings
            await sql`
              UPDATE workflows
              SET component_settings = ${JSON.stringify(compData.settings)}, updated_at = CURRENT_TIMESTAMP
              WHERE id = ${workflowId}
            `;
          }
        }

        console.log('[Templates] Applied component library to workflow:', workflowId, '- Added', components.length, 'components');
      } catch (compErr) {
        console.error('[Templates] Failed to apply component library:', compErr.message);
      }
    }

    res.json({ workflow: result[0] });
  } catch (error) {
    console.error('Error applying template:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST apply website template (creates multiple workflows)
router.post('/:id/apply-to-website/:websiteId', requireDb, async (req, res) => {
  try {
    const { id, websiteId } = req.params;

    // Get template
    const templates = await sql`SELECT * FROM templates WHERE id = ${id}`;
    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Get website
    const websites = await sql`SELECT * FROM websites WHERE id = ${websiteId}`;
    if (websites.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const template = templates[0];
    const website = websites[0];
    const templateData = template.template_data || {};

    if (!templateData.workflows || !Array.isArray(templateData.workflows)) {
      return res.status(400).json({ error: 'Template does not contain workflows' });
    }

    // Create workflows from template
    const createdWorkflows = [];
    for (const wf of templateData.workflows) {
      const result = await sql`
        INSERT INTO workflows (client_id, website_id, name, description, state)
        VALUES (
          ${website.client_id},
          ${websiteId},
          ${wf.name},
          ${wf.description || null},
          ${JSON.stringify(wf.state || {})}
        )
        RETURNING *
      `;
      createdWorkflows.push(result[0]);
    }

    res.status(201).json({ workflows: createdWorkflows });
  } catch (error) {
    console.error('Error applying website template:', error);
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

// ============================================
// REVERT POINT ENDPOINTS
// Stores workflow state before template application
// so users can undo accidental template applies
// ============================================

// GET check if revert point exists for workflow
router.get('/revert-point/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;

    // Check if workflow has a revert point stored
    const result = await sql`
      SELECT revert_point, revert_template_name, revert_created_at
      FROM workflows WHERE id = ${workflowId}
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const workflow = result[0];
    if (workflow.revert_point) {
      res.json({
        hasRevertPoint: true,
        templateName: workflow.revert_template_name,
        createdAt: workflow.revert_created_at
      });
    } else {
      res.json({ hasRevertPoint: false });
    }
  } catch (error) {
    // Column might not exist yet - return no revert point
    console.error('Error checking revert point:', error);
    res.json({ hasRevertPoint: false });
  }
});

// POST save current workflow state as revert point
router.post('/revert-point/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { templateName } = req.body;

    // Get current workflow state
    const workflows = await sql`SELECT * FROM workflows WHERE id = ${workflowId}`;
    if (workflows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const workflow = workflows[0];

    // Also get current image creation settings
    let imageCreationSettings = null;
    try {
      const imgSettings = await sql`SELECT * FROM image_creation_settings WHERE workflow_id = ${workflowId}`;
      if (imgSettings.length > 0) {
        imageCreationSettings = imgSettings[0];
      }
    } catch (e) {
      // Ignore if table doesn't exist
    }

    // Get current component library
    let componentLibrary = null;
    try {
      const components = await sql`SELECT * FROM component_library WHERE workflow_id = ${workflowId}`;
      componentLibrary = components;
    } catch (e) {
      // Ignore if table doesn't exist
    }

    // Get current site planning
    let sitePlanning = null;
    try {
      const plans = await sql`SELECT * FROM site_plans WHERE workflow_id = ${workflowId}`;
      if (plans.length > 0) {
        const nodes = await sql`SELECT * FROM site_plan_nodes WHERE site_plan_id = ${plans[0].id}`;
        sitePlanning = { plan: plans[0], nodes };
      }
    } catch (e) {
      // Ignore if table doesn't exist
    }

    // Store everything as revert point
    const revertPoint = {
      state: workflow.state,
      component_settings: workflow.component_settings,
      imageCreationSettings,
      componentLibrary,
      sitePlanning
    };

    // Ensure revert columns exist (migration)
    try {
      await sql`
        ALTER TABLE workflows
        ADD COLUMN IF NOT EXISTS revert_point JSONB,
        ADD COLUMN IF NOT EXISTS revert_template_name TEXT,
        ADD COLUMN IF NOT EXISTS revert_created_at TIMESTAMP
      `;
    } catch (e) {
      // Columns might already exist or migration might fail - continue anyway
    }

    await sql`
      UPDATE workflows
      SET revert_point = ${JSON.stringify(revertPoint)},
          revert_template_name = ${templateName || 'Unknown template'},
          revert_created_at = CURRENT_TIMESTAMP
      WHERE id = ${workflowId}
    `;

    console.log('[Templates] Saved revert point for workflow:', workflowId);
    res.json({ success: true, message: 'Revert point saved' });
  } catch (error) {
    console.error('Error saving revert point:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST restore workflow from revert point
router.post('/revert/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;

    // Get workflow with revert point
    const workflows = await sql`SELECT * FROM workflows WHERE id = ${workflowId}`;
    if (workflows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const workflow = workflows[0];
    if (!workflow.revert_point) {
      return res.status(400).json({ error: 'No revert point found' });
    }

    const revertData = workflow.revert_point;

    // Restore workflow state
    await sql`
      UPDATE workflows
      SET state = ${JSON.stringify(revertData.state || {})},
          component_settings = ${JSON.stringify(revertData.component_settings || {})},
          revert_point = NULL,
          revert_template_name = NULL,
          revert_created_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${workflowId}
    `;

    // Restore image creation settings if present
    if (revertData.imageCreationSettings) {
      const img = revertData.imageCreationSettings;
      const existingImg = await sql`SELECT id FROM image_creation_settings WHERE workflow_id = ${workflowId}`;
      if (existingImg.length > 0) {
        await sql`
          UPDATE image_creation_settings
          SET enabled = ${img.enabled},
              prompt_assistant_model = ${img.prompt_assistant_model},
              image_generation_model = ${img.image_generation_model},
              image_quality = ${img.image_quality},
              reference_images = ${JSON.stringify(img.reference_images || [])},
              logo_images = ${JSON.stringify(img.logo_images || [])},
              audience_avatars = ${JSON.stringify(img.audience_avatars || [])},
              image_bank = ${JSON.stringify(img.image_bank || [])},
              image_categories = ${JSON.stringify(img.image_categories || [])},
              auto_tag_enabled = ${img.auto_tag_enabled},
              smart_matching_enabled = ${img.smart_matching_enabled},
              fallback_to_live = ${img.fallback_to_live},
              variation_order_mode = ${img.variation_order_mode},
              updated_at = CURRENT_TIMESTAMP
          WHERE workflow_id = ${workflowId}
        `;
      }
    }

    // Restore component library if present
    if (revertData.componentLibrary && Array.isArray(revertData.componentLibrary)) {
      // Delete current components
      await sql`DELETE FROM component_library WHERE workflow_id = ${workflowId}`;
      await sql`DELETE FROM component_rotation_state WHERE workflow_id = ${workflowId}`;

      // Restore components
      for (const comp of revertData.componentLibrary) {
        await sql`
          INSERT INTO component_library (
            workflow_id, slot_number, slot_name, component_type, component_ref,
            module_name, tag, name, source_page_id, source_page_url, sort_order, is_active
          ) VALUES (
            ${workflowId},
            ${comp.slot_number},
            ${comp.slot_name},
            ${comp.component_type},
            ${comp.component_ref},
            ${comp.module_name},
            ${comp.tag},
            ${comp.name},
            ${comp.source_page_id},
            ${comp.source_page_url},
            ${comp.sort_order},
            ${comp.is_active}
          )
        `;
      }
    }

    // Restore site planning if present
    if (revertData.sitePlanning) {
      // Delete current site plan
      const existingPlans = await sql`SELECT id FROM site_plans WHERE workflow_id = ${workflowId}`;
      for (const plan of existingPlans) {
        await sql`DELETE FROM site_plan_nodes WHERE site_plan_id = ${plan.id}`;
        await sql`DELETE FROM site_plans WHERE id = ${plan.id}`;
      }

      // Restore site plan
      const planData = revertData.sitePlanning.plan;
      if (planData) {
        const newPlan = await sql`
          INSERT INTO site_plans (website_id, workflow_id, name, description, auto_sync_check, total_pages, max_depth)
          VALUES (
            ${planData.website_id},
            ${workflowId},
            ${planData.name},
            ${planData.description},
            ${planData.auto_sync_check},
            ${planData.total_pages || 0},
            ${planData.max_depth || 0}
          )
          RETURNING *
        `;

        // Restore nodes
        const nodes = revertData.sitePlanning.nodes || [];
        const oldIdToNewId = {};

        for (const node of nodes) {
          const newNode = await sql`
            INSERT INTO site_plan_nodes (
              site_plan_id, title, slug, page_type, target_keyword,
              meta_title, meta_description, content_brief, sort_order,
              depth, is_pillar_page, is_in_menu, menu_order
            ) VALUES (
              ${newPlan[0].id},
              ${node.title},
              ${node.slug},
              ${node.page_type},
              ${node.target_keyword},
              ${node.meta_title},
              ${node.meta_description},
              ${node.content_brief},
              ${node.sort_order},
              ${node.depth},
              ${node.is_pillar_page},
              ${node.is_in_menu},
              ${node.menu_order}
            )
            RETURNING *
          `;
          oldIdToNewId[node.id] = newNode[0].id;
        }

        // Update parent relationships
        for (const node of nodes) {
          if (node.parent_id && oldIdToNewId[node.parent_id]) {
            await sql`
              UPDATE site_plan_nodes
              SET parent_id = ${oldIdToNewId[node.parent_id]}
              WHERE id = ${oldIdToNewId[node.id]}
            `;
          }
        }
      }
    }

    console.log('[Templates] Reverted workflow:', workflowId);
    res.json({ success: true, message: 'Workflow reverted successfully' });
  } catch (error) {
    console.error('Error reverting workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
