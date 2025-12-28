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

// GET all templates (optionally filter by type or search by tag)
router.get('/', requireDb, async (req, res) => {
  try {
    const { type, tag, search } = req.query;

    let templates;
    if (type && tag) {
      templates = await sql`
        SELECT * FROM templates
        WHERE template_type = ${type}
        AND tags @> ${JSON.stringify([tag])}
        ORDER BY created_at DESC
      `;
    } else if (type) {
      templates = await sql`
        SELECT * FROM templates
        WHERE template_type = ${type}
        ORDER BY created_at DESC
      `;
    } else if (tag) {
      templates = await sql`
        SELECT * FROM templates
        WHERE tags @> ${JSON.stringify([tag])}
        ORDER BY created_at DESC
      `;
    } else if (search) {
      templates = await sql`
        SELECT * FROM templates
        WHERE name ILIKE ${'%' + search + '%'}
        OR description ILIKE ${'%' + search + '%'}
        ORDER BY template_type, created_at DESC
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
    const { name, description, templateType, templateData, includes, tags, sourceWorkflowId } = req.body;

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
      INSERT INTO templates (name, description, template_type, template_data, includes, tags)
      VALUES (
        ${name},
        ${description || ''},
        ${templateType},
        ${JSON.stringify(finalTemplateData)},
        ${JSON.stringify(finalIncludes)},
        ${JSON.stringify(tags || [])}
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
    const { name, description, includes, tags } = req.body;

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
    const selectedIncludes = includes || { prompts: true, placeholders: true, tags: true, snippets: true, settings: true };

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
        }
      } catch (err) {
        console.log('[Template] No image creation settings found for workflow');
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
        }
      } catch (err) {
        console.log('[Template] No site planning found for workflow');
      }
    }

    // Determine template type based on what's included
    let templateType = 'full_workflow';
    const includedSections = Object.entries(selectedIncludes).filter(([_, v]) => v).map(([k]) => k);
    if (includedSections.length === 1) {
      templateType = includedSections[0]; // 'prompts', 'placeholders', 'tags', or 'snippets'
    }

    const result = await sql`
      INSERT INTO templates (name, description, template_type, template_data, includes, tags)
      VALUES (
        ${name || `${workflow.name} Template`},
        ${description || `Template created from workflow: ${workflow.name}`},
        ${templateType},
        ${JSON.stringify(templateData)},
        ${JSON.stringify(selectedIncludes)},
        ${JSON.stringify(tags || [])}
      )
      RETURNING *
    `;

    res.status(201).json({ template: result[0] });
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

    // Update workflow
    const result = await sql`
      UPDATE workflows
      SET state = ${JSON.stringify(newState)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${workflowId}
      RETURNING *
    `;

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

export default router;
