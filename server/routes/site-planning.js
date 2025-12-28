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
 * Update a site plan
 */
router.put('/plans/:planId', requireDb, async (req, res) => {
  try {
    const { planId } = req.params;
    const { name, description, autoSyncCheck } = req.body;

    const result = await sql`
      UPDATE site_plans
      SET
        name = COALESCE(${name}, name),
        description = COALESCE(${description}, description),
        auto_sync_check = COALESCE(${autoSyncCheck}, auto_sync_check),
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
        built_at = ${wpPageId ? 'CURRENT_TIMESTAMP' : null},
        published_at = ${status === 'published' ? 'CURRENT_TIMESTAMP' : null}
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
// HELPER FUNCTIONS
// ============================================

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

export default router;
