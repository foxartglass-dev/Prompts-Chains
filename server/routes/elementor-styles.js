/**
 * Elementor Styles Routes
 * API endpoints for importing and managing Elementor page styles per workflow
 */

import express from 'express';
import sql from '../db/index.js';
import {
  fetchWordPressPage,
  extractStylesFromElementorData,
  stylesToDatabaseFormat,
  formatStylesForPreview
} from '../services/elementor-style-extractor.js';

const router = express.Router();

/**
 * GET /api/workflows/:workflowId/elementor-style
 * Get the current Elementor style for a workflow
 */
router.get('/workflows/:workflowId/elementor-style', async (req, res) => {
  const { workflowId } = req.params;

  try {
    const [style] = await sql`
      SELECT *
      FROM workflow_elementor_styles
      WHERE workflow_id = ${workflowId}
        AND status = 'active'
      LIMIT 1
    `;

    if (!style) {
      return res.json({
        success: true,
        hasTemplate: false,
        style: null
      });
    }

    res.json({
      success: true,
      hasTemplate: true,
      style: {
        id: style.id,
        sourcePageId: style.source_page_id,
        sourcePageUrl: style.source_page_url,
        sourcePageTitle: style.source_page_title,
        createdAt: style.created_at,
        updatedAt: style.updated_at,
        extractedStyles: style.extracted_styles
      }
    });
  } catch (error) {
    console.error('[ElementorStyles] Error fetching style:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflows/:workflowId/elementor-style/preview
 * Preview styles from a WordPress page WITHOUT saving
 */
router.post('/workflows/:workflowId/elementor-style/preview', async (req, res) => {
  const { workflowId } = req.params;
  const { pageId, pageUrl } = req.body;

  if (!pageId && !pageUrl) {
    return res.status(400).json({
      success: false,
      error: 'Please provide either pageId or pageUrl'
    });
  }

  try {
    // Get workflow to find website credentials
    const [workflow] = await sql`
      SELECT w.id, w.website_id, ws.wp_url, ws.wp_user, ws.wp_app_password
      FROM workflows w
      JOIN websites ws ON w.website_id = ws.id
      WHERE w.id = ${workflowId}
    `;

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    if (!workflow.wp_url || !workflow.wp_user || !workflow.wp_app_password) {
      return res.status(400).json({
        success: false,
        error: 'WordPress credentials not configured for this website'
      });
    }

    // Extract page ID from URL if needed
    let targetPageId = pageId;
    if (!targetPageId && pageUrl) {
      // Try to extract page ID from URL - user might need to provide it manually
      // For now, require pageId
      return res.status(400).json({
        success: false,
        error: 'Please provide the WordPress page ID. You can find it in the URL when editing the page (e.g., post=1481)'
      });
    }

    // Fetch the page from WordPress
    const pageData = await fetchWordPressPage({
      wpUrl: workflow.wp_url,
      wpUser: workflow.wp_user,
      wpPassword: workflow.wp_app_password,
      pageId: targetPageId
    });

    // Extract styles
    const styles = extractStylesFromElementorData(pageData.elementorData);

    // Format for preview
    const preview = formatStylesForPreview(styles);

    res.json({
      success: true,
      pageInfo: {
        id: pageData.id,
        title: pageData.title,
        url: pageData.link
      },
      preview,
      rawStyles: styles
    });
  } catch (error) {
    console.error('[ElementorStyles] Preview error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflows/:workflowId/elementor-style/import
 * Import and save styles from a WordPress page
 */
router.post('/workflows/:workflowId/elementor-style/import', async (req, res) => {
  const { workflowId } = req.params;
  const { pageId, pageUrl } = req.body;

  if (!pageId && !pageUrl) {
    return res.status(400).json({
      success: false,
      error: 'Please provide either pageId or pageUrl'
    });
  }

  try {
    // Get workflow to find website credentials
    const [workflow] = await sql`
      SELECT w.id, w.website_id, ws.wp_url, ws.wp_user, ws.wp_app_password
      FROM workflows w
      JOIN websites ws ON w.website_id = ws.id
      WHERE w.id = ${workflowId}
    `;

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    if (!workflow.wp_url || !workflow.wp_user || !workflow.wp_app_password) {
      return res.status(400).json({
        success: false,
        error: 'WordPress credentials not configured for this website'
      });
    }

    let targetPageId = pageId;
    if (!targetPageId && pageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Please provide the WordPress page ID'
      });
    }

    // Fetch the page from WordPress
    const pageData = await fetchWordPressPage({
      wpUrl: workflow.wp_url,
      wpUser: workflow.wp_user,
      wpPassword: workflow.wp_app_password,
      pageId: targetPageId
    });

    // Extract styles
    const styles = extractStylesFromElementorData(pageData.elementorData);

    // Convert to database format
    const dbData = stylesToDatabaseFormat(styles, {
      pageId: pageData.id,
      url: pageData.link,
      title: pageData.title
    });

    // Archive any existing active style for this workflow
    await sql`
      UPDATE workflow_elementor_styles
      SET status = 'archived', updated_at = NOW()
      WHERE workflow_id = ${workflowId}
        AND status = 'active'
    `;

    // Insert new style
    const [newStyle] = await sql`
      INSERT INTO workflow_elementor_styles (
        workflow_id,
        source_page_id,
        source_page_url,
        source_page_title,
        button_background_color,
        button_text_color,
        button_border_radius,
        button_padding,
        button_typography,
        h1_color,
        h1_typography,
        h2_color,
        h2_typography,
        h3_color,
        h3_typography,
        text_color,
        text_typography,
        container_padding,
        section_gap,
        content_width,
        hero_padding,
        hero_gap,
        image_border_radius,
        stats_background_color,
        stats_gradient,
        stats_padding,
        raw_elementor_data,
        extracted_styles,
        status
      ) VALUES (
        ${workflowId},
        ${dbData.source_page_id},
        ${dbData.source_page_url},
        ${dbData.source_page_title},
        ${dbData.button_background_color},
        ${dbData.button_text_color},
        ${dbData.button_border_radius},
        ${JSON.stringify(dbData.button_padding)},
        ${JSON.stringify(dbData.button_typography)},
        ${dbData.h1_color},
        ${JSON.stringify(dbData.h1_typography)},
        ${dbData.h2_color},
        ${JSON.stringify(dbData.h2_typography)},
        ${dbData.h3_color},
        ${JSON.stringify(dbData.h3_typography)},
        ${dbData.text_color},
        ${JSON.stringify(dbData.text_typography)},
        ${JSON.stringify(dbData.container_padding)},
        ${dbData.section_gap},
        ${dbData.content_width},
        ${JSON.stringify(dbData.hero_padding)},
        ${dbData.hero_gap},
        ${dbData.image_border_radius},
        ${dbData.stats_background_color},
        ${JSON.stringify(dbData.stats_gradient)},
        ${JSON.stringify(dbData.stats_padding)},
        ${pageData.elementorData},
        ${JSON.stringify(dbData.extracted_styles)},
        'active'
      )
      RETURNING id, created_at
    `;

    // Format for preview
    const preview = formatStylesForPreview(styles);

    res.json({
      success: true,
      message: 'Elementor style template saved successfully',
      styleId: newStyle.id,
      pageInfo: {
        id: pageData.id,
        title: pageData.title,
        url: pageData.link
      },
      preview,
      foundElements: styles.foundElements
    });
  } catch (error) {
    console.error('[ElementorStyles] Import error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/workflows/:workflowId/elementor-style
 * Remove the active style template for a workflow
 */
router.delete('/workflows/:workflowId/elementor-style', async (req, res) => {
  const { workflowId } = req.params;

  try {
    const result = await sql`
      UPDATE workflow_elementor_styles
      SET status = 'archived', updated_at = NOW()
      WHERE workflow_id = ${workflowId}
        AND status = 'active'
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active style template found for this workflow'
      });
    }

    res.json({
      success: true,
      message: 'Style template archived'
    });
  } catch (error) {
    console.error('[ElementorStyles] Delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
