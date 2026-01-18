/**
 * Site Planning Routes
 * Section 8 - The Site Truth
 * Manages the planned site structure that becomes the blueprint for building
 */

import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';

const router = express.Router();

// Middleware to check if database is enabled
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// ============================================
// SITE PLANS
// ============================================

/**
 * GET /api/site-planning/plans
 * Get all site plans, optionally filtered by website or workflow
 */
router.get('/plans', requireDb, async (req, res) => {
  try {
    const { websiteId, workflowId } = req.query;

    let plans;
    if (websiteId) {
      plans = await sql`
        SELECT sp.*, w.name as website_name, wf.name as workflow_name
        FROM site_plans sp
        LEFT JOIN websites w ON sp.website_id = w.id
        LEFT JOIN workflows wf ON sp.workflow_id = wf.id
        WHERE sp.website_id = ${websiteId}
        ORDER BY sp.created_at DESC
      `;
    } else if (workflowId) {
      plans = await sql`
        SELECT sp.*, w.name as website_name, wf.name as workflow_name
        FROM site_plans sp
        LEFT JOIN websites w ON sp.website_id = w.id
        LEFT JOIN workflows wf ON sp.workflow_id = wf.id
        WHERE sp.workflow_id = ${workflowId}
        ORDER BY sp.created_at DESC
      `;
    } else {
      plans = await sql`
        SELECT sp.*, w.name as website_name, wf.name as workflow_name
        FROM site_plans sp
        LEFT JOIN websites w ON sp.website_id = w.id
        LEFT JOIN workflows wf ON sp.workflow_id = wf.id
        ORDER BY sp.created_at DESC
      `;
    }

    res.json({ success: true, plans });
  } catch (error) {
    console.error('[Site Planning] Error fetching plans:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/site-planning/plans/:planId
 * Get a single site plan with all its nodes
 */
router.get('/plans/:planId', requireDb, async (req, res) => {
  try {
    const { planId } = req.params;

    const plans = await sql`
      SELECT sp.*, w.name as website_name, wf.name as workflow_name
      FROM site_plans sp
      LEFT JOIN websites w ON sp.website_id = w.id
      LEFT JOIN workflows wf ON sp.workflow_id = wf.id
      WHERE sp.id = ${planId}
    `;

    if (plans.length === 0) {
      return res.status(404).json({ error: 'Site plan not found' });
    }

    const nodes = await sql`
      SELECT * FROM site_plan_nodes
      WHERE site_plan_id = ${planId}
      ORDER BY depth, sort_order, title
    `;

    res.json({ success: true, plan: plans[0], nodes });
  } catch (error) {
    console.error('[Site Planning] Error fetching plan:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/site-planning/plans
 * Create a new site plan
 */
router.post('/plans', requireDb, async (req, res) => {
  try {
    const { websiteId, workflowId, name, description } = req.body;

    if (!websiteId && !workflowId) {
      return res.status(400).json({ error: 'Either websiteId or workflowId is required' });
    }

    const result = await sql`
      INSERT INTO site_plans (website_id, workflow_id, name, description)
      VALUES (${websiteId || null}, ${workflowId || null}, ${name || 'Site Structure'}, ${description || null})
      RETURNING *
    `;

    const plan = result[0];

    // Create default homepage node
    await sql`
      INSERT INTO site_plan_nodes (site_plan_id, title, slug, page_type, is_pillar_page, depth, sort_order)
      VALUES (${plan.id}, 'Homepage', '', 'page', true, 0, 0)
    `;

    // Update total pages count
    await sql`UPDATE site_plans SET total_pages = 1 WHERE id = ${plan.id}`;

    res.json({ success: true, plan });
  } catch (error) {
    console.error('[Site Planning] Error creating plan:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/site-planning/plans/:planId
 * Update a site plan (including linking to a website)
 */
router.put('/plans/:planId', requireDb, async (req, res) => {
  try {
    const { planId } = req.params;
    const { name, description, autoSyncCheck, websiteId } = req.body;

    const result = await sql`
      UPDATE site_plans
      SET
        name = COALESCE(${name}, name),
        description = COALESCE(${description}, description),
        auto_sync_check = COALESCE(${autoSyncCheck}, auto_sync_check),
        website_id = COALESCE(${websiteId}, website_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${planId}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Site plan not found' });
    }

    res.json({ success: true, plan: result[0] });
  } catch (error) {
    console.error('[Site Planning] Error updating plan:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/site-planning/plans/:planId
 * Delete a site plan and all its nodes
 */
router.delete('/plans/:planId', requireDb, async (req, res) => {
  try {
    const { planId } = req.params;

    await sql`DELETE FROM site_plans WHERE id = ${planId}`;

    res.json({ success: true });
  } catch (error) {
    console.error('[Site Planning] Error deleting plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SITE PLAN NODES
// ============================================

/**
 * GET /api/site-planning/nodes/:planId
 * Get all nodes for a site plan as a tree structure
 */
router.get('/nodes/:planId', requireDb, async (req, res) => {
  try {
    const { planId } = req.params;

    const nodes = await sql`
      SELECT spn.*, a.keyword as article_keyword, a.status as article_status
      FROM site_plan_nodes spn
      LEFT JOIN articles a ON spn.assigned_article_id = a.id
      WHERE spn.site_plan_id = ${planId}
      ORDER BY spn.depth, spn.sort_order, spn.title
    `;

    // Build tree structure
    const nodeMap = {};
    const rootNodes = [];

    // First pass: create map
    nodes.forEach(node => {
      nodeMap[node.id] = { ...node, children: [] };
    });

    // Second pass: build tree
    nodes.forEach(node => {
      if (node.parent_id === null) {
        rootNodes.push(nodeMap[node.id]);
      } else if (nodeMap[node.parent_id]) {
        nodeMap[node.parent_id].children.push(nodeMap[node.id]);
      } else {
        // Orphan node, add to root
        rootNodes.push(nodeMap[node.id]);
      }
    });

    res.json({ success: true, nodes: rootNodes, flatNodes: nodes });
  } catch (error) {
    console.error('[Site Planning] Error fetching nodes:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/site-planning/nodes
 * Create a new node
 */
router.post('/nodes', requireDb, async (req, res) => {
  try {
    const {
      sitePlanId,
      parentId,
      title,
      slug,
      pageType,
      targetKeyword,
      metaTitle,
      metaDescription,
      contentBrief,
      isPillarPage,
      isInMenu,
      sortOrder
    } = req.body;

    if (!sitePlanId || !title) {
      return res.status(400).json({ error: 'sitePlanId and title are required' });
    }

    // Calculate depth based on parent
    let depth = 0;
    if (parentId) {
      const parent = await sql`SELECT depth FROM site_plan_nodes WHERE id = ${parentId}`;
      if (parent.length > 0) {
        depth = parent[0].depth + 1;
      }
    }

    // Generate slug from title if not provided
    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const result = await sql`
      INSERT INTO site_plan_nodes (
        site_plan_id, parent_id, title, slug, page_type,
        target_keyword, meta_title, meta_description, content_brief,
        is_pillar_page, is_in_menu, sort_order, depth
      ) VALUES (
        ${sitePlanId}, ${parentId || null}, ${title}, ${finalSlug}, ${pageType || 'page'},
        ${targetKeyword || null}, ${metaTitle || null}, ${metaDescription || null}, ${contentBrief || null},
        ${isPillarPage || false}, ${isInMenu !== false}, ${sortOrder || 0}, ${depth}
      )
      RETURNING *
    `;

    // Update plan stats
    await updatePlanStats(sitePlanId);

    res.json({ success: true, node: result[0] });
  } catch (error) {
    console.error('[Site Planning] Error creating node:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/site-planning/nodes/:nodeId
 * Update a node
 */
router.put('/nodes/:nodeId', requireDb, async (req, res) => {
  try {
    const { nodeId } = req.params;
    const {
      parentId,
      title,
      slug,
      pageType,
      status,
      targetKeyword,
      metaTitle,
      metaDescription,
      contentBrief,
      assignedArticleId,
      isPillarPage,
      isInMenu,
      menuOrder,
      sortOrder,
      wpPageId,
      wpPostUrl
    } = req.body;

    // Get current node to find plan ID
    const current = await sql`SELECT * FROM site_plan_nodes WHERE id = ${nodeId}`;
    if (current.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // Calculate new depth if parent changed
    let depth = current[0].depth;
    if (parentId !== undefined && parentId !== current[0].parent_id) {
      if (parentId === null) {
        depth = 0;
      } else {
        const parent = await sql`SELECT depth FROM site_plan_nodes WHERE id = ${parentId}`;
        if (parent.length > 0) {
          depth = parent[0].depth + 1;
        }
      }
    }

    const result = await sql`
      UPDATE site_plan_nodes SET
        parent_id = COALESCE(${parentId}, parent_id),
        title = COALESCE(${title}, title),
        slug = COALESCE(${slug}, slug),
        page_type = COALESCE(${pageType}, page_type),
        status = COALESCE(${status}, status),
        target_keyword = COALESCE(${targetKeyword}, target_keyword),
        meta_title = COALESCE(${metaTitle}, meta_title),
        meta_description = COALESCE(${metaDescription}, meta_description),
        content_brief = COALESCE(${contentBrief}, content_brief),
        assigned_article_id = COALESCE(${assignedArticleId}, assigned_article_id),
        is_pillar_page = COALESCE(${isPillarPage}, is_pillar_page),
        is_in_menu = COALESCE(${isInMenu}, is_in_menu),
        menu_order = COALESCE(${menuOrder}, menu_order),
        sort_order = COALESCE(${sortOrder}, sort_order),
        depth = ${depth},
        wp_page_id = COALESCE(${wpPageId}, wp_page_id),
        wp_post_url = COALESCE(${wpPostUrl}, wp_post_url),
        updated_at = CURRENT_TIMESTAMP,
        built_at = CASE WHEN ${wpPageId}::INTEGER IS NOT NULL THEN CURRENT_TIMESTAMP ELSE built_at END,
        published_at = CASE WHEN ${status} = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END
      WHERE id = ${nodeId}
      RETURNING *
    `;

    // Update plan stats
    await updatePlanStats(current[0].site_plan_id);

    res.json({ success: true, node: result[0] });
  } catch (error) {
    console.error('[Site Planning] Error updating node:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/site-planning/nodes/:nodeId
 * Delete a node (children become orphans at root level)
 */
router.delete('/nodes/:nodeId', requireDb, async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { deleteChildren } = req.query;

    // Get node to find plan ID
    const node = await sql`SELECT * FROM site_plan_nodes WHERE id = ${nodeId}`;
    if (node.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }

    if (deleteChildren === 'true') {
      // Delete all descendants recursively
      await deleteNodeAndChildren(nodeId);
    } else {
      // Move children to root level
      await sql`
        UPDATE site_plan_nodes
        SET parent_id = NULL, depth = 0, updated_at = CURRENT_TIMESTAMP
        WHERE parent_id = ${nodeId}
      `;
      await sql`DELETE FROM site_plan_nodes WHERE id = ${nodeId}`;
    }

    // Update plan stats
    await updatePlanStats(node[0].site_plan_id);

    res.json({ success: true });
  } catch (error) {
    console.error('[Site Planning] Error deleting node:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/site-planning/nodes/:nodeId/move
 * Move a node to a new parent
 */
router.post('/nodes/:nodeId/move', requireDb, async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { newParentId, newSortOrder } = req.body;

    // Get current node
    const current = await sql`SELECT * FROM site_plan_nodes WHERE id = ${nodeId}`;
    if (current.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // Calculate new depth
    let newDepth = 0;
    if (newParentId) {
      const parent = await sql`SELECT depth FROM site_plan_nodes WHERE id = ${newParentId}`;
      if (parent.length > 0) {
        newDepth = parent[0].depth + 1;
      }
    }

    // Update node
    await sql`
      UPDATE site_plan_nodes
      SET parent_id = ${newParentId || null}, depth = ${newDepth}, sort_order = ${newSortOrder || 0}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${nodeId}
    `;

    // Update children depths recursively
    await updateChildrenDepths(nodeId, newDepth);

    // Update plan stats
    await updatePlanStats(current[0].site_plan_id);

    res.json({ success: true });
  } catch (error) {
    console.error('[Site Planning] Error moving node:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// IMPORT/EXPORT
// ============================================

/**
 * POST /api/site-planning/import
 * Import site structure from spreadsheet data (CSV/JSON)
 */
router.post('/import', requireDb, async (req, res) => {
  try {
    const { sitePlanId, data, format } = req.body;

    if (!sitePlanId || !data) {
      return res.status(400).json({ error: 'sitePlanId and data are required' });
    }

    let rows = [];

    if (format === 'csv' || typeof data === 'string') {
      // Parse CSV
      const lines = data.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });
        rows.push(row);
      }
    } else if (Array.isArray(data)) {
      rows = data;
    }

    // Process rows and create nodes
    const nodeMap = {}; // Map of title/slug to node ID for parent lookups
    let created = 0;

    for (const row of rows) {
      const title = row.title || row.page || row.name;
      if (!title) continue;

      const parentTitle = row.parent || row.parent_page || null;
      let parentId = null;

      if (parentTitle && nodeMap[parentTitle.toLowerCase()]) {
        parentId = nodeMap[parentTitle.toLowerCase()];
      }

      // Calculate depth
      let depth = 0;
      if (parentId) {
        const parent = await sql`SELECT depth FROM site_plan_nodes WHERE id = ${parentId}`;
        if (parent.length > 0) depth = parent[0].depth + 1;
      }

      const slug = row.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const result = await sql`
        INSERT INTO site_plan_nodes (
          site_plan_id, parent_id, title, slug, page_type,
          target_keyword, meta_title, meta_description,
          is_pillar_page, depth, sort_order
        ) VALUES (
          ${sitePlanId}, ${parentId}, ${title}, ${slug}, ${row.type || row.page_type || 'page'},
          ${row.keyword || row.target_keyword || null}, ${row.meta_title || null}, ${row.meta_description || null},
          ${row.pillar === 'true' || row.is_pillar === 'true' || false}, ${depth}, ${created}
        )
        RETURNING *
      `;

      nodeMap[title.toLowerCase()] = result[0].id;
      created++;
    }

    // Update plan stats
    await updatePlanStats(sitePlanId);

    res.json({ success: true, imported: created });
  } catch (error) {
    console.error('[Site Planning] Error importing:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/site-planning/export/:planId
 * Export site plan as JSON or CSV
 */
router.get('/export/:planId', requireDb, async (req, res) => {
  try {
    const { planId } = req.params;
    const { format } = req.query;

    const plan = await sql`SELECT * FROM site_plans WHERE id = ${planId}`;
    if (plan.length === 0) {
      return res.status(404).json({ error: 'Site plan not found' });
    }

    const nodes = await sql`
      SELECT * FROM site_plan_nodes
      WHERE site_plan_id = ${planId}
      ORDER BY depth, sort_order, title
    `;

    // Build parent title lookup
    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.id] = n; });

    const exportData = nodes.map(n => ({
      title: n.title,
      slug: n.slug,
      parent: n.parent_id ? nodeMap[n.parent_id]?.title : '',
      type: n.page_type,
      status: n.status,
      keyword: n.target_keyword || '',
      meta_title: n.meta_title || '',
      meta_description: n.meta_description || '',
      is_pillar: n.is_pillar_page ? 'true' : 'false',
      depth: n.depth
    }));

    if (format === 'csv') {
      const headers = ['title', 'slug', 'parent', 'type', 'status', 'keyword', 'meta_title', 'meta_description', 'is_pillar', 'depth'];
      const csv = [
        headers.join(','),
        ...exportData.map(row => headers.map(h => `"${(row[h] || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="site-plan-${planId}.csv"`);
      res.send(csv);
    } else {
      res.json({ success: true, plan: plan[0], nodes: exportData });
    }
  } catch (error) {
    console.error('[Site Planning] Error exporting:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SYNC CHECK
// ============================================

/**
 * POST /api/site-planning/sync-check/:planId
 * Compare plan with actual WordPress site structure
 */
router.post('/sync-check/:planId', requireDb, async (req, res) => {
  try {
    const { planId } = req.params;

    // Get plan with website info
    const plans = await sql`
      SELECT sp.*, w.wp_url, w.wp_user, w.wp_app_password
      FROM site_plans sp
      JOIN websites w ON sp.website_id = w.id
      WHERE sp.id = ${planId}
    `;

    if (plans.length === 0) {
      return res.status(404).json({ error: 'Site plan not found or no website linked' });
    }

    const plan = plans[0];

    if (!plan.wp_url || !plan.wp_user || !plan.wp_app_password) {
      return res.status(400).json({ error: 'Website WordPress credentials not configured' });
    }

    // Get planned nodes
    const plannedNodes = await sql`
      SELECT * FROM site_plan_nodes WHERE site_plan_id = ${planId}
    `;

    // Get actual WordPress pages
    const auth = Buffer.from(`${plan.wp_user}:${plan.wp_app_password}`).toString('base64');
    const wpRes = await fetch(`${plan.wp_url}/wp-json/wp/v2/pages?per_page=100&status=any`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });

    if (!wpRes.ok) {
      return res.status(500).json({ error: 'Failed to fetch WordPress pages' });
    }

    const wpPages = await wpRes.json();

    // Compare
    const differences = [];
    const matched = [];
    const missingInWP = [];
    const extraInWP = [];

    // Check each planned node
    for (const node of plannedNodes) {
      const wpPage = wpPages.find(p =>
        p.slug === node.slug ||
        p.id === node.wp_page_id ||
        p.title.rendered.toLowerCase() === node.title.toLowerCase()
      );

      if (wpPage) {
        matched.push({ planned: node, actual: wpPage });

        // Update node with WP page ID if not set
        if (!node.wp_page_id) {
          await sql`
            UPDATE site_plan_nodes
            SET wp_page_id = ${wpPage.id}, wp_post_url = ${wpPage.link}, status = 'built'
            WHERE id = ${node.id}
          `;
        }
      } else if (node.status !== 'planned') {
        missingInWP.push(node);
      }
    }

    // Check for extra pages in WP not in plan
    for (const wpPage of wpPages) {
      const planned = plannedNodes.find(n =>
        n.slug === wpPage.slug ||
        n.wp_page_id === wpPage.id ||
        n.title.toLowerCase() === wpPage.title.rendered.toLowerCase()
      );

      if (!planned) {
        extraInWP.push(wpPage);
      }
    }

    const syncStatus = (missingInWP.length === 0 && extraInWP.length === 0) ? 'synced' : 'differs';

    // Update plan sync status
    await sql`
      UPDATE site_plans
      SET sync_status = ${syncStatus}, last_sync_check = CURRENT_TIMESTAMP
      WHERE id = ${planId}
    `;

    res.json({
      success: true,
      syncStatus,
      matched: matched.length,
      missingInWP: missingInWP.map(n => ({ id: n.id, title: n.title, slug: n.slug })),
      extraInWP: extraInWP.map(p => ({ id: p.id, title: p.title.rendered, slug: p.slug })),
      differences
    });
  } catch (error) {
    console.error('[Site Planning] Error checking sync:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HIERARCHICAL PUSH TO WORDPRESS
// ============================================

/**
 * POST /api/site-planning/push-hierarchy/:planId
 * Push all pages in hierarchical order - parents first, then children
 * This ensures parent pages exist before children reference them
 */
router.post('/push-hierarchy/:planId', requireDb, async (req, res) => {
  try {
    const { planId } = req.params;
    const {
      status = 'draft',           // 'draft' or 'publish'
      nodeIds,                     // Optional: specific nodes to push (if not provided, push all)
      dripFeed = false,           // Whether to schedule posts over time
      dripIntervalHours = 24      // Hours between each post if drip feeding
    } = req.body;

    console.log(`[Site Planning] Starting hierarchical push for plan ${planId}`);

    // Get plan - first try direct website link, then try via workflow
    let plans = await sql`
      SELECT sp.*, w.wp_url, w.wp_user, w.wp_app_password, w.name as website_name, w.id as resolved_website_id
      FROM site_plans sp
      LEFT JOIN websites w ON sp.website_id = w.id
      WHERE sp.id = ${planId}
    `;

    if (plans.length === 0) {
      return res.status(404).json({ error: 'Site plan not found' });
    }

    let plan = plans[0];

    // If no direct website link, try to get website from workflow
    if (!plan.wp_url && plan.workflow_id) {
      console.log(`[Site Planning] No direct website link, trying workflow ${plan.workflow_id}`);
      const workflowWebsite = await sql`
        SELECT w.wp_url, w.wp_user, w.wp_app_password, w.name as website_name, w.id as website_id
        FROM workflows wf
        JOIN websites w ON wf.website_id = w.id
        WHERE wf.id = ${plan.workflow_id}
      `;
      if (workflowWebsite.length > 0) {
        plan.wp_url = workflowWebsite[0].wp_url;
        plan.wp_user = workflowWebsite[0].wp_user;
        plan.wp_app_password = workflowWebsite[0].wp_app_password;
        plan.website_name = workflowWebsite[0].website_name;
        plan.resolved_website_id = workflowWebsite[0].website_id;

        // Also update the site plan to link directly for future calls
        await sql`UPDATE site_plans SET website_id = ${workflowWebsite[0].website_id} WHERE id = ${planId}`;
        console.log(`[Site Planning] Linked plan ${planId} to website ${workflowWebsite[0].website_id} via workflow`);
      }
    }

    if (!plan.wp_url || !plan.wp_user || !plan.wp_app_password) {
      return res.status(400).json({
        error: 'No website linked to this site plan. Please link a website first.',
        hint: 'Go to Site Planning settings or update the site plan with a website_id'
      });
    }

    // Import WordPress publisher
    const { createElementorPage } = await import('../services/wordpress-publisher.js');
    const { getElementorMetaFields } = await import('../services/elementor-builder.js');

    const wpCredentials = {
      url: plan.wp_url,
      user: plan.wp_user,
      password: plan.wp_app_password
    };

    // Get nodes to push - ordered by depth so parents come first
    let nodes;
    if (nodeIds && nodeIds.length > 0) {
      nodes = await sql`
        SELECT * FROM site_plan_nodes
        WHERE site_plan_id = ${planId} AND id = ANY(${nodeIds})
        ORDER BY depth ASC, sort_order ASC, title ASC
      `;
    } else {
      nodes = await sql`
        SELECT * FROM site_plan_nodes
        WHERE site_plan_id = ${planId} AND (wp_page_id IS NULL OR wp_page_id = 0)
        ORDER BY depth ASC, sort_order ASC, title ASC
      `;
    }

    if (nodes.length === 0) {
      return res.json({ success: true, message: 'No pages to push', pushed: [] });
    }

    console.log(`[Site Planning] Pushing ${nodes.length} nodes in hierarchical order`);

    // Track mapping from our node IDs to WordPress page IDs
    const nodeToWpId = {};

    // First, load any existing WP IDs from nodes that are already pushed
    const existingNodes = await sql`
      SELECT id, wp_page_id FROM site_plan_nodes
      WHERE site_plan_id = ${planId} AND wp_page_id IS NOT NULL AND wp_page_id > 0
    `;
    existingNodes.forEach(n => { nodeToWpId[n.id] = n.wp_page_id; });

    const results = [];
    let publishDate = new Date();

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      try {
        // Determine parent WordPress ID
        let parentWpId = null;
        if (node.parent_id) {
          parentWpId = nodeToWpId[node.parent_id];
          if (!parentWpId) {
            // Try to fetch from database in case it was pushed earlier
            const parentNode = await sql`
              SELECT wp_page_id FROM site_plan_nodes WHERE id = ${node.parent_id}
            `;
            if (parentNode.length > 0 && parentNode[0].wp_page_id) {
              parentWpId = parentNode[0].wp_page_id;
              nodeToWpId[node.parent_id] = parentWpId;
            }
          }
        }

        // Calculate publish date for drip feed
        let pageStatus = status;
        let scheduledDate = null;
        if (dripFeed && status === 'publish') {
          scheduledDate = new Date(publishDate.getTime() + (i * dripIntervalHours * 60 * 60 * 1000));
          pageStatus = 'future';
        }

        // Build basic Elementor meta (placeholder page - content comes from articles)
        const elementorMeta = getElementorMetaFields([]);

        // Create the page with hierarchy
        const pageResult = await createElementorPage(wpCredentials, {
          title: node.title,
          slug: node.slug || node.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          elementorMeta,
          status: pageStatus,
          publishDate: scheduledDate?.toISOString(),
          parent: parentWpId,
          menuOrder: node.sort_order || 0
        });

        // Store the WordPress ID in our mapping
        nodeToWpId[node.id] = pageResult.id;

        // Update the node in database with WordPress info
        await sql`
          UPDATE site_plan_nodes
          SET wp_page_id = ${pageResult.id},
              wp_post_url = ${pageResult.link},
              status = 'built',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${node.id}
        `;

        results.push({
          nodeId: node.id,
          title: node.title,
          success: true,
          wpPageId: pageResult.id,
          wpUrl: pageResult.link,
          parentWpId: parentWpId,
          depth: node.depth,
          scheduledFor: scheduledDate
        });

        console.log(`[Site Planning] ✓ Pushed "${node.title}" (depth ${node.depth}) → WP ID ${pageResult.id}${parentWpId ? ` (parent: ${parentWpId})` : ''}`);

      } catch (nodeError) {
        console.error(`[Site Planning] ✗ Failed to push "${node.title}":`, nodeError.message);
        results.push({
          nodeId: node.id,
          title: node.title,
          success: false,
          error: nodeError.message
        });
      }
    }

    // Update plan stats
    await updatePlanStats(planId);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Pushed ${successCount} pages${failCount > 0 ? `, ${failCount} failed` : ''}`,
      pushed: results,
      summary: {
        total: nodes.length,
        success: successCount,
        failed: failCount,
        dripFeed: dripFeed,
        dripIntervalHours: dripFeed ? dripIntervalHours : null
      }
    });

  } catch (error) {
    console.error('[Site Planning] Error in hierarchical push:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/site-planning/link-article/:nodeId
 * Link a site plan node to an existing article
 */
router.post('/link-article/:nodeId', requireDb, async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { articleId } = req.body;

    // Update the node
    await sql`
      UPDATE site_plan_nodes
      SET assigned_article_id = ${articleId},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${nodeId}
    `;

    // Also update the article with the target keyword from the node
    const node = await sql`SELECT target_keyword FROM site_plan_nodes WHERE id = ${nodeId}`;
    if (node.length > 0 && node[0].target_keyword) {
      await sql`
        UPDATE articles
        SET keyword = ${node[0].target_keyword}
        WHERE id = ${articleId} AND (keyword IS NULL OR keyword = '')
      `;
    }

    res.json({ success: true, message: 'Article linked to site plan node' });

  } catch (error) {
    console.error('[Site Planning] Error linking article:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/site-planning/push-with-content/:nodeId
 * Push a single node with its linked article content
 */
router.post('/push-with-content/:nodeId', requireDb, async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { status = 'draft' } = req.body;

    // Get node with article and website info
    const nodes = await sql`
      SELECT
        spn.*,
        a.content, a.keyword, a.generated_images,
        w.wp_url, w.wp_user, w.wp_app_password
      FROM site_plan_nodes spn
      JOIN site_plans sp ON spn.site_plan_id = sp.id
      JOIN websites w ON sp.website_id = w.id
      LEFT JOIN articles a ON spn.assigned_article_id = a.id
      WHERE spn.id = ${nodeId}
    `;

    if (nodes.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const node = nodes[0];

    if (!node.wp_url || !node.wp_user || !node.wp_app_password) {
      return res.status(400).json({ error: 'WordPress credentials not configured' });
    }

    // Import services
    const { createElementorPage, updatePage } = await import('../services/wordpress-publisher.js');
    const buildElementorPage = (await import('../services/elementor-builder.js')).default;
    const { getElementorMetaFields } = await import('../services/elementor-builder.js');
    const chunkContent = (await import('../services/content-chunker.js')).default;

    const wpCredentials = {
      url: node.wp_url,
      user: node.wp_user,
      password: node.wp_app_password
    };

    // Get parent WordPress ID if this is a child page
    let parentWpId = null;
    if (node.parent_id) {
      const parentNode = await sql`
        SELECT wp_page_id FROM site_plan_nodes WHERE id = ${node.parent_id}
      `;
      if (parentNode.length > 0 && parentNode[0].wp_page_id) {
        parentWpId = parentNode[0].wp_page_id;
      }
    }

    // Build page content
    let elementorData = [];
    let elementorMeta = {};

    if (node.content) {
      // Chunk and build Elementor structure from article content
      const chunked = chunkContent(node.content, { maxWordsPerChunk: 300 });
      elementorData = buildElementorPage(chunked, {
        templateId: 'classic_blog'
      });
      elementorMeta = getElementorMetaFields(elementorData);
    } else {
      // Placeholder page
      elementorMeta = getElementorMetaFields([]);
    }

    let pageResult;

    if (node.wp_page_id) {
      // Update existing page
      pageResult = await updatePage(wpCredentials, node.wp_page_id, {
        title: node.title,
        status,
        parent: parentWpId,
        meta: elementorMeta
      });
      pageResult.id = node.wp_page_id;
    } else {
      // Create new page with hierarchy
      pageResult = await createElementorPage(wpCredentials, {
        title: node.title,
        slug: node.slug,
        elementorMeta,
        status,
        parent: parentWpId,
        menuOrder: node.sort_order || 0
      });
    }

    // Update node
    await sql`
      UPDATE site_plan_nodes
      SET wp_page_id = ${pageResult.id},
          wp_post_url = ${pageResult.link || node.wp_post_url},
          status = ${status === 'publish' ? 'published' : 'built'},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${nodeId}
    `;

    res.json({
      success: true,
      page: {
        id: pageResult.id,
        url: pageResult.link,
        title: node.title,
        parent: parentWpId,
        hasContent: !!node.content
      }
    });

  } catch (error) {
    console.error('[Site Planning] Error pushing with content:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TAB-BASED HIERARCHY IMPORT
// ============================================

/**
 * POST /api/site-planning/import-hierarchy
 * Import site structure from tab-indented text
 * Each tab level = one depth level in hierarchy
 */
router.post('/import-hierarchy', requireDb, async (req, res) => {
  try {
    const { sitePlanId, text, mode = 'merge', audienceTag } = req.body;

    if (!sitePlanId || !text) {
      return res.status(400).json({ error: 'sitePlanId and text are required' });
    }

    // Parse the tab-indented text
    const lines = text.split('\n').filter(line => line.trim());
    const parsedNodes = [];

    for (const line of lines) {
      // Count leading tabs (or 2-space groups)
      const tabMatch = line.match(/^(\t*)/);
      const spaceMatch = line.match(/^( *)/);

      let depth = 0;
      if (tabMatch && tabMatch[1]) {
        depth = tabMatch[1].length;
      } else if (spaceMatch && spaceMatch[1]) {
        depth = Math.floor(spaceMatch[1].length / 2);
      }

      const title = line.trim();
      if (!title) continue;

      // Check for audience tag suffix (e.g., "Deep Cleaning [H]")
      let extractedTag = null;
      let cleanTitle = title;
      const tagMatch = title.match(/\s*\[([A-Z]+)\]\s*$/i);
      if (tagMatch) {
        extractedTag = tagMatch[1].toUpperCase();
        cleanTitle = title.replace(/\s*\[[A-Z]+\]\s*$/i, '').trim();
      }

      parsedNodes.push({
        title: cleanTitle,
        depth,
        audienceTag: extractedTag || audienceTag,
        slug: cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      });
    }

    // Get existing nodes for conflict detection
    const existingNodes = await sql`
      SELECT id, title, slug, parent_id, depth
      FROM site_plan_nodes
      WHERE site_plan_id = ${sitePlanId}
    `;

    const existingByTitle = {};
    const existingBySlug = {};
    existingNodes.forEach(n => {
      existingByTitle[n.title.toLowerCase()] = n;
      existingBySlug[n.slug] = n;
    });

    // Detect conflicts
    const conflicts = [];
    const toCreate = [];
    const toUpdate = [];

    // Track parents by depth for hierarchy building
    const parentStack = [null]; // Index = depth, value = parent node ID or pending title

    for (let i = 0; i < parsedNodes.length; i++) {
      const node = parsedNodes[i];
      const existing = existingByTitle[node.title.toLowerCase()] || existingBySlug[node.slug];

      // Determine parent
      const parentDepth = node.depth - 1;
      let parentRef = parentDepth >= 0 ? parentStack[parentDepth] : null;

      if (existing) {
        // Check if there's a conflict (different parent)
        if (mode === 'merge') {
          // Check if existing has different parent
          const existingParentTitle = existing.parent_id ?
            existingNodes.find(n => n.id === existing.parent_id)?.title : null;

          // Find expected parent title
          let expectedParentTitle = null;
          for (let j = i - 1; j >= 0; j--) {
            if (parsedNodes[j].depth === parentDepth) {
              expectedParentTitle = parsedNodes[j].title;
              break;
            }
          }

          if (existingParentTitle?.toLowerCase() !== expectedParentTitle?.toLowerCase()) {
            conflicts.push({
              title: node.title,
              existingParent: existingParentTitle,
              importParent: expectedParentTitle,
              existingId: existing.id,
              action: 'skip' // Default action
            });
          }
        }
      } else {
        toCreate.push({
          ...node,
          parentRef,
          index: i
        });
      }

      // Update parent stack
      parentStack[node.depth] = node.title;
      // Clear deeper levels
      for (let d = node.depth + 1; d < parentStack.length; d++) {
        parentStack[d] = undefined;
      }
    }

    // If there are conflicts and mode is 'preview', return them
    if (conflicts.length > 0 && mode === 'preview') {
      return res.json({
        success: true,
        preview: true,
        parsed: parsedNodes.length,
        conflicts,
        toCreate: toCreate.length,
        existing: existingNodes.length
      });
    }

    // If mode is 'replace', clear all existing nodes first
    if (mode === 'replace') {
      await sql`DELETE FROM site_plan_nodes WHERE site_plan_id = ${sitePlanId}`;
    }

    // Create nodes in order, tracking IDs for parent references
    const createdMap = {}; // title -> id
    let created = 0;

    // First, map existing nodes
    existingNodes.forEach(n => {
      createdMap[n.title.toLowerCase()] = n.id;
    });

    for (const nodeData of parsedNodes) {
      // Skip if already exists in merge mode
      if (mode === 'merge' && createdMap[nodeData.title.toLowerCase()]) {
        continue;
      }

      // Find parent ID
      let parentId = null;
      if (nodeData.depth > 0) {
        // Look for parent in previous nodes at depth - 1
        for (let j = parsedNodes.indexOf(nodeData) - 1; j >= 0; j--) {
          if (parsedNodes[j].depth === nodeData.depth - 1) {
            parentId = createdMap[parsedNodes[j].title.toLowerCase()];
            break;
          }
        }
      }

      // Determine page type based on depth and content
      let pageType = 'page';
      if (nodeData.depth === 0) {
        pageType = 'category';
      } else if (nodeData.depth === 1) {
        pageType = 'service';
      }

      const result = await sql`
        INSERT INTO site_plan_nodes (
          site_plan_id, parent_id, title, slug, page_type,
          depth, sort_order, content_brief
        ) VALUES (
          ${sitePlanId}, ${parentId}, ${nodeData.title}, ${nodeData.slug}, ${pageType},
          ${nodeData.depth}, ${created}, ${nodeData.audienceTag ? `Audience: ${nodeData.audienceTag}` : null}
        )
        RETURNING *
      `;

      createdMap[nodeData.title.toLowerCase()] = result[0].id;
      created++;
    }

    // Update plan stats
    await updatePlanStats(sitePlanId);

    res.json({
      success: true,
      created,
      total: parsedNodes.length,
      conflicts: conflicts.length,
      mode
    });

  } catch (error) {
    console.error('[Site Planning] Error importing hierarchy:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MULTI-LOCATION SUPPORT
// ============================================

/**
 * POST /api/site-planning/add-location/:planId
 * Add a new location to the site structure
 * This duplicates the existing structure under a new location landing page
 */
router.post('/add-location/:planId', requireDb, async (req, res) => {
  try {
    const { planId } = req.params;
    const { locationName, duplicateFrom } = req.body;

    if (!locationName) {
      return res.status(400).json({ error: 'locationName is required' });
    }

    // Get plan
    const plans = await sql`SELECT * FROM site_plans WHERE id = ${planId}`;
    if (plans.length === 0) {
      return res.status(404).json({ error: 'Site plan not found' });
    }

    // Get current location count
    const locationNodes = await sql`
      SELECT * FROM site_plan_nodes
      WHERE site_plan_id = ${planId}
        AND page_type = 'location'
        AND parent_id IS NULL
    `;

    const isFirstExpansion = locationNodes.length === 0;

    // Get all root level nodes (to be duplicated or shifted)
    const rootNodes = await sql`
      SELECT * FROM site_plan_nodes
      WHERE site_plan_id = ${planId}
        AND parent_id IS NULL
      ORDER BY sort_order
    `;

    // Get the homepage
    const homepage = rootNodes.find(n => n.slug === '' || n.slug === 'home' || n.title.toLowerCase() === 'homepage');

    if (isFirstExpansion) {
      // FIRST EXPANSION: Convert from single-location to multi-location structure

      // 1. Find category/service nodes at root level (not About, Contact, etc.)
      const businessNodes = rootNodes.filter(n =>
        n.page_type === 'category' ||
        n.page_type === 'service' ||
        (n.title.toLowerCase() !== 'about' &&
         n.title.toLowerCase() !== 'contact' &&
         n.title.toLowerCase() !== 'homepage' &&
         !n.title.toLowerCase().includes('about') &&
         !n.title.toLowerCase().includes('contact'))
      );

      // 2. Create Location 1 landing page (for existing structure)
      const location1 = await sql`
        INSERT INTO site_plan_nodes (
          site_plan_id, parent_id, title, slug, page_type,
          depth, sort_order, is_pillar_page
        ) VALUES (
          ${planId}, NULL, 'Location 1', 'location-1', 'location',
          0, 0, true
        )
        RETURNING *
      `;

      // 3. Move business nodes under Location 1
      for (const node of businessNodes) {
        await sql`
          UPDATE site_plan_nodes
          SET parent_id = ${location1[0].id}, depth = depth + 1
          WHERE id = ${node.id}
        `;
        // Also update all children's depths
        await updateChildrenDepths(node.id, 1);
      }

      // 4. Create Location 2 (the new one)
      const location2 = await sql`
        INSERT INTO site_plan_nodes (
          site_plan_id, parent_id, title, slug, page_type,
          depth, sort_order, is_pillar_page
        ) VALUES (
          ${planId}, NULL, ${locationName}, ${locationName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}, 'location',
          0, 1, true
        )
        RETURNING *
      `;

      // 5. Duplicate the business structure under Location 2
      const duplicated = await duplicateSubtree(planId, location1[0].id, location2[0].id);

      await updatePlanStats(planId);

      res.json({
        success: true,
        message: 'Expanded to multi-location structure',
        firstExpansion: true,
        location1: location1[0],
        location2: location2[0],
        duplicatedNodes: duplicated
      });

    } else {
      // SUBSEQUENT EXPANSION: Add another location

      // 1. Determine which location to duplicate from
      let sourceLocationId = duplicateFrom;
      if (!sourceLocationId) {
        // Default to first location
        sourceLocationId = locationNodes[0].id;
      }

      // 2. Create new location landing page
      const newLocation = await sql`
        INSERT INTO site_plan_nodes (
          site_plan_id, parent_id, title, slug, page_type,
          depth, sort_order, is_pillar_page
        ) VALUES (
          ${planId}, NULL, ${locationName}, ${locationName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}, 'location',
          0, ${locationNodes.length}, true
        )
        RETURNING *
      `;

      // 3. Duplicate the structure from source location
      const duplicated = await duplicateSubtree(planId, sourceLocationId, newLocation[0].id);

      await updatePlanStats(planId);

      res.json({
        success: true,
        message: `Added location: ${locationName}`,
        firstExpansion: false,
        newLocation: newLocation[0],
        duplicatedFrom: sourceLocationId,
        duplicatedNodes: duplicated
      });
    }

  } catch (error) {
    console.error('[Site Planning] Error adding location:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/site-planning/locations/:planId
 * Get all locations in a plan
 */
router.get('/locations/:planId', requireDb, async (req, res) => {
  try {
    const { planId } = req.params;

    const locations = await sql`
      SELECT spn.*,
        (SELECT COUNT(*) FROM site_plan_nodes WHERE parent_id = spn.id) as child_count
      FROM site_plan_nodes spn
      WHERE spn.site_plan_id = ${planId}
        AND spn.page_type = 'location'
        AND spn.parent_id IS NULL
      ORDER BY spn.sort_order
    `;

    res.json({
      success: true,
      locations,
      isMultiLocation: locations.length > 0
    });

  } catch (error) {
    console.error('[Site Planning] Error getting locations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/site-planning/bulk-edit/:planId
 * Bulk edit nodes (for editing duplicated location structure)
 */
router.post('/bulk-edit/:planId', requireDb, async (req, res) => {
  try {
    const { planId } = req.params;
    const { edits } = req.body;

    if (!Array.isArray(edits)) {
      return res.status(400).json({ error: 'edits must be an array' });
    }

    const results = [];

    for (const edit of edits) {
      if (!edit.nodeId) continue;

      const updates = {};
      if (edit.title) updates.title = edit.title;
      if (edit.slug) updates.slug = edit.slug;
      if (edit.targetKeyword) updates.target_keyword = edit.targetKeyword;

      if (Object.keys(updates).length === 0) continue;

      const result = await sql`
        UPDATE site_plan_nodes
        SET
          title = COALESCE(${edit.title}, title),
          slug = COALESCE(${edit.slug}, slug),
          target_keyword = COALESCE(${edit.targetKeyword}, target_keyword),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${edit.nodeId} AND site_plan_id = ${planId}
        RETURNING *
      `;

      if (result.length > 0) {
        results.push(result[0]);
      }
    }

    res.json({
      success: true,
      updated: results.length
    });

  } catch (error) {
    console.error('[Site Planning] Error bulk editing:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NEIGHBORHOOD PAGES (GAP ANALYSIS)
// ============================================

/**
 * POST /api/site-planning/analyze-gaps/:planId
 * Analyze heat map data to find geographic gaps and suggest neighborhood pages
 */
router.post('/analyze-gaps/:planId', requireDb, async (req, res) => {
  try {
    const { planId } = req.params;
    const { websiteId, threshold = 15 } = req.body;

    // Get plan
    const plans = await sql`
      SELECT sp.*, w.id as website_id
      FROM site_plans sp
      LEFT JOIN websites w ON sp.website_id = w.id
      WHERE sp.id = ${planId}
    `;

    if (plans.length === 0) {
      return res.status(404).json({ error: 'Site plan not found' });
    }

    const plan = plans[0];
    const targetWebsiteId = websiteId || plan.website_id;

    if (!targetWebsiteId) {
      return res.status(400).json({ error: 'No website associated with this plan' });
    }

    // Get recent GeoGrid scans from local_viking_scans table
    const scans = await sql`
      SELECT * FROM local_viking_scans
      WHERE website_id = ${targetWebsiteId}
        AND created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC
      LIMIT 10
    `;

    if (scans.length === 0) {
      return res.json({
        success: true,
        gaps: [],
        message: 'No recent scan data available. Run a GeoGrid scan first.'
      });
    }

    // Analyze grid data for gaps (positions > threshold)
    const gaps = [];
    const seen = new Set();

    for (const scan of scans) {
      if (!scan.grid_data) continue;

      let gridData;
      try {
        gridData = typeof scan.grid_data === 'string' ? JSON.parse(scan.grid_data) : scan.grid_data;
      } catch (e) {
        continue;
      }

      // Find cells where rank > threshold (gaps)
      if (Array.isArray(gridData)) {
        for (const cell of gridData) {
          if (cell.rank && cell.rank > threshold) {
            const key = `${cell.lat?.toFixed(3)},${cell.lng?.toFixed(3)}`;
            if (!seen.has(key) && cell.lat && cell.lng) {
              gaps.push({
                lat: cell.lat,
                lng: cell.lng,
                rank: cell.rank,
                keyword: scan.keyword,
                scanDate: scan.created_at
              });
              seen.add(key);
            }
          }
        }
      }
    }

    // Sort gaps by rank (worst first)
    gaps.sort((a, b) => b.rank - a.rank);

    // Limit to top 20 gaps
    const topGaps = gaps.slice(0, 20);

    res.json({
      success: true,
      gaps: topGaps,
      total: gaps.length,
      threshold,
      scansAnalyzed: scans.length
    });

  } catch (error) {
    console.error('[Site Planning] Error analyzing gaps:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/site-planning/create-neighborhood/:planId
 * Create a neighborhood page for a gap area
 */
router.post('/create-neighborhood/:planId', requireDb, async (req, res) => {
  try {
    const { planId } = req.params;
    const { name, lat, lng, landmark, keywords } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Check if Neighborhoods parent exists, create if not
    let neighborhoodsParent = await sql`
      SELECT * FROM site_plan_nodes
      WHERE site_plan_id = ${planId}
        AND (slug = 'neighborhoods' OR slug = 'service-areas' OR slug = 'areas-we-serve')
        AND parent_id IS NULL
      LIMIT 1
    `;

    if (neighborhoodsParent.length === 0) {
      // Create the Neighborhoods parent node
      const created = await sql`
        INSERT INTO site_plan_nodes (
          site_plan_id, parent_id, title, slug, page_type,
          depth, sort_order, is_pillar_page
        ) VALUES (
          ${planId}, NULL, 'Neighborhoods', 'neighborhoods', 'category',
          0, 99, true
        )
        RETURNING *
      `;
      neighborhoodsParent = created;
    }

    const parentId = neighborhoodsParent[0].id;

    // Create the neighborhood page
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const contentBrief = [
      landmark ? `Featured landmark: ${landmark}` : null,
      lat && lng ? `Coordinates: ${lat}, ${lng}` : null,
      keywords?.length ? `Target keywords: ${keywords.join(', ')}` : null
    ].filter(Boolean).join('\n');

    const result = await sql`
      INSERT INTO site_plan_nodes (
        site_plan_id, parent_id, title, slug, page_type,
        target_keyword, depth, sort_order, content_brief
      ) VALUES (
        ${planId}, ${parentId}, ${name}, ${slug}, 'location',
        ${keywords?.[0] || name}, 1, 0, ${contentBrief || null}
      )
      RETURNING *
    `;

    await updatePlanStats(planId);

    res.json({
      success: true,
      node: result[0],
      parentId
    });

  } catch (error) {
    console.error('[Site Planning] Error creating neighborhood:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/site-planning/suggest-landmarks
 * Query for landmark suggestions in a geographic area
 * Note: This is a placeholder - in production would use Google Places API
 */
router.post('/suggest-landmarks', requireDb, async (req, res) => {
  try {
    const { lat, lng, radius = 2 } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    // In production, this would call Google Places API
    // For now, return a placeholder response
    res.json({
      success: true,
      suggestions: [
        {
          name: 'Area near coordinates',
          type: 'neighborhood',
          distance: 0,
          relevance: 'high',
          note: 'Google Places API integration needed for actual landmarks'
        }
      ],
      message: 'Landmark suggestions require Google Places API integration'
    });

  } catch (error) {
    console.error('[Site Planning] Error suggesting landmarks:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Duplicate a subtree under a new parent
 */
async function duplicateSubtree(planId, sourceParentId, newParentId) {
  const children = await sql`
    SELECT * FROM site_plan_nodes
    WHERE site_plan_id = ${planId} AND parent_id = ${sourceParentId}
    ORDER BY sort_order
  `;

  const duplicated = [];

  for (const child of children) {
    // Create copy under new parent
    const copy = await sql`
      INSERT INTO site_plan_nodes (
        site_plan_id, parent_id, title, slug, page_type,
        target_keyword, meta_title, meta_description, content_brief,
        is_pillar_page, is_in_menu, sort_order, depth
      ) VALUES (
        ${planId}, ${newParentId}, ${child.title}, ${child.slug}, ${child.page_type},
        ${child.target_keyword}, ${child.meta_title}, ${child.meta_description}, ${child.content_brief},
        ${child.is_pillar_page}, ${child.is_in_menu}, ${child.sort_order}, ${child.depth}
      )
      RETURNING *
    `;

    duplicated.push(copy[0]);

    // Recursively duplicate children
    const childDups = await duplicateSubtree(planId, child.id, copy[0].id);
    duplicated.push(...childDups);
  }

  return duplicated;
}

async function updatePlanStats(planId) {
  const stats = await sql`
    SELECT
      COUNT(*) as total,
      MAX(depth) as max_depth
    FROM site_plan_nodes
    WHERE site_plan_id = ${planId}
  `;

  await sql`
    UPDATE site_plans
    SET total_pages = ${stats[0].total || 0}, max_depth = ${stats[0].max_depth || 0}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${planId}
  `;
}

async function updateChildrenDepths(parentId, parentDepth) {
  const children = await sql`SELECT id FROM site_plan_nodes WHERE parent_id = ${parentId}`;

  for (const child of children) {
    const newDepth = parentDepth + 1;
    await sql`UPDATE site_plan_nodes SET depth = ${newDepth} WHERE id = ${child.id}`;
    await updateChildrenDepths(child.id, newDepth);
  }
}

async function deleteNodeAndChildren(nodeId) {
  const children = await sql`SELECT id FROM site_plan_nodes WHERE parent_id = ${nodeId}`;

  for (const child of children) {
    await deleteNodeAndChildren(child.id);
  }

  await sql`DELETE FROM site_plan_nodes WHERE id = ${nodeId}`;
}

// ============================================
// EXPORT / IMPORT FOR WORKFLOW BACKUP
// ============================================

/**
 * GET /api/site-planning/export/:workflowId
 * Export all site plans and nodes for a workflow
 */
router.get('/export/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;
    console.log('[Site Planning] Exporting plans for workflow:', workflowId);

    // Get all plans for this workflow
    const plans = await sql`
      SELECT * FROM site_plans
      WHERE workflow_id = ${workflowId}
      ORDER BY created_at
    `;

    // For each plan, get its nodes
    const plansWithNodes = [];
    for (const plan of plans) {
      const nodes = await sql`
        SELECT * FROM site_plan_nodes
        WHERE site_plan_id = ${plan.id}
        ORDER BY depth, sort_order, title
      `;
      plansWithNodes.push({
        ...plan,
        nodes
      });
    }

    console.log(`[Site Planning] Exported ${plans.length} plans with their nodes`);
    res.json({ success: true, plans: plansWithNodes });
  } catch (error) {
    console.error('[Site Planning] Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/site-planning/import/:workflowId
 * Import site plans and nodes for a workflow (replaces existing)
 */
router.post('/import/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { plans } = req.body;

    if (!plans || !Array.isArray(plans)) {
      return res.status(400).json({ error: 'plans array required' });
    }

    console.log(`[Site Planning] Importing ${plans.length} plans for workflow:`, workflowId);

    // Get the workflow's website_id
    const workflow = await sql`SELECT website_id FROM workflows WHERE id = ${workflowId}`;
    const websiteId = workflow.length > 0 ? workflow[0].website_id : null;

    // Delete existing plans for this workflow first
    const existingPlans = await sql`SELECT id FROM site_plans WHERE workflow_id = ${workflowId}`;
    for (const existingPlan of existingPlans) {
      await sql`DELETE FROM site_plan_nodes WHERE site_plan_id = ${existingPlan.id}`;
      await sql`DELETE FROM site_plans WHERE id = ${existingPlan.id}`;
    }

    const importedPlans = [];

    for (const planData of plans) {
      const { nodes, id: _oldId, ...planFields } = planData;

      // Create the plan with new workflow_id and website_id
      const newPlan = await sql`
        INSERT INTO site_plans (
          workflow_id,
          website_id,
          name,
          description,
          root_structure,
          total_pages,
          max_depth
        ) VALUES (
          ${workflowId},
          ${websiteId},
          ${planFields.name || 'Imported Plan'},
          ${planFields.description || ''},
          ${planFields.root_structure || 'service'},
          ${planFields.total_pages || 0},
          ${planFields.max_depth || 0}
        )
        RETURNING *
      `;

      const newPlanId = newPlan[0].id;

      // Import nodes with ID mapping for parent relationships
      const idMap = new Map(); // old_id -> new_id

      // First pass: insert all nodes without parent relationships
      for (const node of (nodes || [])) {
        const newNode = await sql`
          INSERT INTO site_plan_nodes (
            site_plan_id,
            parent_id,
            title,
            slug,
            page_type,
            depth,
            sort_order,
            url_path,
            status,
            meta_title,
            meta_description,
            notes,
            is_location,
            location_type,
            location_data
          ) VALUES (
            ${newPlanId},
            NULL,
            ${node.title || 'Untitled'},
            ${node.slug || ''},
            ${node.page_type || 'page'},
            ${node.depth || 0},
            ${node.sort_order || 0},
            ${node.url_path || ''},
            ${node.status || 'planned'},
            ${node.meta_title || ''},
            ${node.meta_description || ''},
            ${node.notes || ''},
            ${node.is_location || false},
            ${node.location_type || null},
            ${node.location_data ? JSON.stringify(node.location_data) : null}
          )
          RETURNING *
        `;
        idMap.set(node.id, newNode[0].id);
      }

      // Second pass: update parent relationships
      for (const node of (nodes || [])) {
        if (node.parent_id && idMap.has(node.parent_id)) {
          const newNodeId = idMap.get(node.id);
          const newParentId = idMap.get(node.parent_id);
          await sql`
            UPDATE site_plan_nodes
            SET parent_id = ${newParentId}
            WHERE id = ${newNodeId}
          `;
        }
      }

      importedPlans.push({ ...newPlan[0], nodesImported: (nodes || []).length });
    }

    console.log(`[Site Planning] Successfully imported ${importedPlans.length} plans`);
    res.json({ success: true, plans: importedPlans });
  } catch (error) {
    console.error('[Site Planning] Import error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
