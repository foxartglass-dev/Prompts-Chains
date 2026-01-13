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
        console.log('[Workflow Duplicate] Source settings keys:', Object.keys(srcSettings));

        await sql`
          INSERT INTO image_creation_settings (
            workflow_id,
            enabled,
            prompt_assistant_model,
            image_generation_model,
            reference_images,
            logo_images,
            audience_avatars,
            image_bank,
            image_categories,
            auto_tag_enabled,
            chat_history,
            consultant_chat_history,
            consultant_model,
            worker_chat_history,
            worker_model,
            integration_mode,
            fallback_to_live,
            image_order,
            variation_order_mode,
            manual_variation_order
          )
          VALUES (
            ${newWorkflowId},
            ${srcSettings.enabled},
            ${srcSettings.prompt_assistant_model},
            ${srcSettings.image_generation_model},
            ${JSON.stringify(srcSettings.reference_images || [])},
            ${JSON.stringify(srcSettings.logo_images || [])},
            ${JSON.stringify(srcSettings.audience_avatars || [])},
            ${JSON.stringify(srcSettings.image_bank || [])},
            ${JSON.stringify(srcSettings.image_categories || [])},
            ${srcSettings.auto_tag_enabled},
            ${JSON.stringify(srcSettings.chat_history || [])},
            ${JSON.stringify(srcSettings.consultant_chat_history || [])},
            ${srcSettings.consultant_model || 'gpt-4o'},
            ${JSON.stringify(srcSettings.worker_chat_history || [])},
            ${srcSettings.worker_model || 'gpt-4o-mini'},
            ${srcSettings.integration_mode || 'bank'},
            ${srcSettings.fallback_to_live},
            ${JSON.stringify(srcSettings.image_order || [])},
            ${srcSettings.variation_order_mode || 'sequential'},
            ${JSON.stringify(srcSettings.manual_variation_order || [])}
          )
        `;
        console.log('[Workflow Duplicate] Image settings copied successfully');
      }
    } catch (imgErr) {
      // Log but don't fail the whole operation if image settings copy fails
      console.error('[Workflow Duplicate] Failed to copy image settings:', imgErr.message);
    }

    // Also copy site_plans and site_plan_nodes if they exist for the source workflow
    try {
      const sitePlans = await sql`
        SELECT * FROM site_plans WHERE workflow_id = ${id}
      `;

      if (sitePlans.length > 0) {
        const srcPlan = sitePlans[0];
        console.log('[Workflow Duplicate] Copying site_plan to new workflow:', newWorkflowId);

        // Create new site plan
        const newPlanResult = await sql`
          INSERT INTO site_plans (
            website_id,
            workflow_id,
            name,
            description,
            auto_sync_check,
            sync_status,
            total_pages,
            max_depth
          )
          VALUES (
            ${srcPlan.website_id},
            ${newWorkflowId},
            ${srcPlan.name},
            ${srcPlan.description},
            ${srcPlan.auto_sync_check},
            ${srcPlan.sync_status},
            ${srcPlan.total_pages},
            ${srcPlan.max_depth}
          )
          RETURNING *
        `;

        const newPlanId = newPlanResult[0].id;

        // Copy all nodes - need to handle parent_id mapping
        const srcNodes = await sql`
          SELECT * FROM site_plan_nodes WHERE site_plan_id = ${srcPlan.id} ORDER BY id
        `;

        if (srcNodes.length > 0) {
          const oldToNewIdMap = {};

          // First pass: insert nodes without parent_id
          for (const node of srcNodes) {
            const newNodeResult = await sql`
              INSERT INTO site_plan_nodes (
                site_plan_id,
                parent_id,
                title,
                slug,
                page_type,
                status,
                target_keyword,
                meta_title,
                meta_description,
                content_brief,
                sort_order,
                depth,
                is_pillar_page,
                is_in_menu,
                menu_order
              )
              VALUES (
                ${newPlanId},
                ${null},
                ${node.title},
                ${node.slug},
                ${node.page_type},
                ${'planned'},
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
            oldToNewIdMap[node.id] = newNodeResult[0].id;
          }

          // Second pass: update parent_id references
          for (const node of srcNodes) {
            if (node.parent_id && oldToNewIdMap[node.parent_id]) {
              await sql`
                UPDATE site_plan_nodes
                SET parent_id = ${oldToNewIdMap[node.parent_id]}
                WHERE id = ${oldToNewIdMap[node.id]}
              `;
            }
          }

          console.log('[Workflow Duplicate] Site plan nodes copied successfully:', srcNodes.length, 'nodes');
        }

        console.log('[Workflow Duplicate] Site plan copied successfully');
      }
    } catch (sitePlanErr) {
      // Log but don't fail the whole operation if site plan copy fails
      console.error('[Workflow Duplicate] Failed to copy site plan:', sitePlanErr.message);
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

/**
 * POST /api/workflows/generate-for-node
 * Generate article content for a site plan node using the workflow's prompt chain
 * Used by Site Planning "Generate All" button
 */
router.post('/generate-for-node', requireDb, async (req, res) => {
  try {
    const { workflowId, nodeId, nodeTitle, targetKeyword, pageType } = req.body;

    if (!workflowId) {
      return res.status(400).json({ error: 'workflowId is required' });
    }
    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId is required' });
    }

    console.log(`[Generate for Node] Starting generation for node ${nodeId}: "${nodeTitle}"`);

    // 1. Get the workflow with website info
    const workflows = await sql`
      SELECT w.*, ws.id as website_id, ws.name as website_name,
             c.id as client_id, c.name as client_name
      FROM workflows w
      LEFT JOIN websites ws ON w.website_id = ws.id
      LEFT JOIN clients c ON w.client_id = c.id
      WHERE w.id = ${workflowId}
    `;

    if (workflows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const workflow = workflows[0];
    const workflowState = JSON.parse(workflow.state || '{}');

    // 2. Get the prompt chain configuration
    const promptTemplates = workflowState.promptTemplates || [];

    if (promptTemplates.length === 0) {
      return res.status(400).json({ error: 'Workflow has no prompt templates configured' });
    }

    // 3. Build placeholders/config for this node
    const placeholders = workflowState.placeholders || [];
    const taggedSnippets = workflowState.taggedSnippets || [];

    // Create item context for prompt filling
    const item = {
      name: targetKeyword || nodeTitle,
      tag: null, // Site plan nodes don't have tags currently
    };

    const config = {
      placeholders,
      taggedSnippets,
    };

    // 4. Execute prompt chain
    const chainOutputs = {};
    let finalContent = '';
    let metaTitles = [];
    let metaDescriptions = [];

    // Get default model from workflow state or use fallback
    const defaultModel = workflowState.defaultModel || 'claude-sonnet-4-5-20250929';

    console.log(`[Generate for Node] Found ${promptTemplates.length} prompt templates`);

    for (const promptConfig of promptTemplates) {
      // PromptTemplate structure: { id, name, template, outputKey, outputAction }
      const { name: promptName, template, outputKey, outputAction } = promptConfig;

      if (!template) {
        console.log(`[Generate for Node] Skipping prompt "${promptName}" - no template`);
        continue;
      }

      // Fill the prompt template with placeholders and previous outputs
      let filledPrompt = template;

      // Replace {item_name} or {keyword} with the target keyword
      filledPrompt = filledPrompt.replace(/{item_name}/g, targetKeyword || nodeTitle);
      filledPrompt = filledPrompt.replace(/{keyword}/g, targetKeyword || nodeTitle);
      filledPrompt = filledPrompt.replace(/{page_type}/g, pageType || 'service');

      // Replace [output_key] with previous outputs
      filledPrompt = filledPrompt.replace(/\[([^\]]+)\]/g, (match, prevOutputKey) => {
        return chainOutputs[prevOutputKey.trim()] || match;
      });

      // Replace global placeholders {key}
      placeholders.forEach(p => {
        if (!p.tag) {
          const regex = new RegExp(`\\{${p.key}\\}`, 'g');
          filledPrompt = filledPrompt.replace(regex, p.value || '');
        }
      });

      console.log(`[Generate for Node] Running prompt "${promptName}" (outputKey: ${outputKey}) for "${nodeTitle}"`);

      // Call LLM
      try {
        const llmResponse = await fetch(`http://localhost:${process.env.PORT || 3001}/api/llm/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: defaultModel,
            prompt: filledPrompt,
            maxTokens: 4096,
          }),
        });

        const llmResult = await llmResponse.json();

        if (llmResult.success && llmResult.content) {
          chainOutputs[outputKey] = llmResult.content;
          console.log(`[Generate for Node] ✓ Got output for "${outputKey}" (${llmResult.content.length} chars)`);

          // Check if this should be added to final content
          if (outputAction === 'addToFinal' || promptConfig === promptTemplates[promptTemplates.length - 1]) {
            finalContent += (finalContent ? '\n\n' : '') + llmResult.content;

            // Try to parse meta titles and descriptions
            const metaTitleMatch = finalContent.match(/---META TITLES---\s*([\s\S]*?)(?:---META DESCRIPTIONS---|$)/i);
            const metaDescMatch = finalContent.match(/---META DESCRIPTIONS---\s*([\s\S]*?)$/i);

            if (metaTitleMatch) {
              metaTitles = metaTitleMatch[1]
                .split('\n')
                .map(line => line.replace(/^\d+\.\s*/, '').trim())
                .filter(Boolean);
              // Remove meta section from content
              finalContent = finalContent.split('---META TITLES---')[0].trim();
            }

            if (metaDescMatch) {
              metaDescriptions = metaDescMatch[1]
                .split('\n')
                .map(line => line.replace(/^\d+\.\s*/, '').trim())
                .filter(Boolean);
            }
          }
        } else {
          console.error(`[Generate for Node] LLM error for prompt "${promptName}":`, llmResult.error || 'Unknown error');
        }
      } catch (llmError) {
        console.error(`[Generate for Node] LLM call failed for "${promptName}":`, llmError.message || llmError);
      }
    }

    if (!finalContent) {
      return res.status(500).json({ error: 'Failed to generate content - no output from prompt chain' });
    }

    // 5. Calculate word count
    const wordCount = finalContent.split(/\s+/).filter(Boolean).length;

    // 6. Create the article
    const articleResult = await sql`
      INSERT INTO articles (
        workflow_id, website_id, client_id,
        keyword, tag,
        final_content, meta_titles, meta_descriptions,
        chain_outputs,
        word_count, status
      )
      VALUES (
        ${workflowId},
        ${workflow.website_id || null},
        ${workflow.client_id || null},
        ${targetKeyword || nodeTitle},
        ${null},
        ${finalContent},
        ${JSON.stringify(metaTitles)},
        ${JSON.stringify(metaDescriptions)},
        ${JSON.stringify(chainOutputs)},
        ${wordCount},
        'generated'
      )
      RETURNING *
    `;

    const newArticle = articleResult[0];
    console.log(`[Generate for Node] Created article ${newArticle.id} for "${nodeTitle}"`);

    // 7. Link article to the site plan node
    await sql`
      UPDATE site_plan_nodes
      SET assigned_article_id = ${newArticle.id}
      WHERE id = ${nodeId}
    `;

    console.log(`[Generate for Node] Linked article ${newArticle.id} to node ${nodeId}`);

    res.json({
      success: true,
      articleId: newArticle.id,
      wordCount,
      metaTitles: metaTitles.length,
      metaDescriptions: metaDescriptions.length,
    });

  } catch (error) {
    console.error('[Generate for Node] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
