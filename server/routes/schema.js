/**
 * Schema / JSON-LD API Routes (Phase 8)
 *
 * Endpoints for schema settings, generation, custom pages, and WordPress push.
 * Uses SSE for bulk operations with progress streaming.
 */

import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';
import {
  generateBulkSchema,
  generateCustomSchema,
  pushSchemaToWordPress,
  checkMuPluginDeployed,
  getMuPluginCode
} from '../services/schema-generator.js';
import { setupSSE } from '../services/sse-progress.js';

const router = express.Router();

// Middleware to check database availability
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// ============================================
// SCHEMA SETTINGS
// ============================================

/**
 * GET /api/schema/settings/:websiteId
 * Get schema settings for a website
 */
router.get('/settings/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;

    const websites = await sql`
      SELECT id, schema_types, schema_bulk_prompt, schema_model, schema_mu_plugin_deployed
      FROM websites WHERE id = ${websiteId}
    `;

    if (websites.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const website = websites[0];

    // Parse schema_types from JSON string
    let schemaTypes = [];
    try {
      schemaTypes = website.schema_types ? JSON.parse(website.schema_types) : [];
    } catch (e) {
      schemaTypes = [];
    }

    res.json({
      schemaTypes,
      bulkPrompt: website.schema_bulk_prompt || '',
      model: website.schema_model || 'claude-sonnet-4-5-20250929',
      muPluginDeployed: website.schema_mu_plugin_deployed || false
    });
  } catch (error) {
    console.error('Error fetching schema settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/schema/settings/:websiteId
 * Update schema settings
 */
router.put('/settings/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { schemaTypes, bulkPrompt, model } = req.body;

    await sql`
      UPDATE websites SET
        schema_types = ${schemaTypes ? JSON.stringify(schemaTypes) : null},
        schema_bulk_prompt = ${bulkPrompt || null},
        schema_model = ${model || 'claude-sonnet-4-5-20250929'},
        updated_at = NOW()
      WHERE id = ${websiteId}
    `;

    res.json({ success: true, message: 'Schema settings updated' });
  } catch (error) {
    console.error('Error updating schema settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MU-PLUGIN
// ============================================

/**
 * POST /api/schema/check-mu-plugin
 * Check if the mu-plugin is deployed on the WordPress site
 */
router.post('/check-mu-plugin', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.body;

    if (!websiteId) {
      return res.status(400).json({ error: 'websiteId required' });
    }

    const websites = await sql`
      SELECT wp_url, wp_user, wp_app_password
      FROM websites WHERE id = ${websiteId}
    `;

    if (websites.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const site = websites[0];

    if (!site.wp_url || !site.wp_user || !site.wp_app_password) {
      return res.status(400).json({ error: 'WordPress credentials not configured for this website' });
    }

    const result = await checkMuPluginDeployed({
      wpUrl: site.wp_url,
      username: site.wp_user,
      appPassword: site.wp_app_password
    });

    // Update the deployment status in DB
    await sql`
      UPDATE websites SET
        schema_mu_plugin_deployed = ${result.deployed},
        updated_at = NOW()
      WHERE id = ${websiteId}
    `;

    res.json(result);
  } catch (error) {
    console.error('Error checking mu-plugin:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/schema/mu-plugin-code
 * Returns the mu-plugin PHP code for the user to deploy
 */
router.get('/mu-plugin-code', (req, res) => {
  res.json(getMuPluginCode());
});

// ============================================
// SCHEMA GENERATION
// ============================================

/**
 * POST /api/schema/generate-bulk
 * Generate schema for all pages (except custom-designated ones). Uses SSE for progress.
 */
router.post('/generate-bulk', requireDb, async (req, res) => {
  const { websiteId } = req.body;

  if (!websiteId) {
    return res.status(400).json({ error: 'websiteId required' });
  }

  const { sendProgress, sendComplete, sendError } = setupSSE(res);

  try {
    // Get website schema settings
    const websites = await sql`
      SELECT schema_types, schema_bulk_prompt, schema_model
      FROM websites WHERE id = ${websiteId}
    `;

    if (websites.length === 0) {
      return sendError({ message: 'Website not found' });
    }

    const site = websites[0];
    let schemaTypes = [];
    try {
      schemaTypes = site.schema_types ? JSON.parse(site.schema_types) : [];
    } catch (e) {
      schemaTypes = [];
    }

    if (schemaTypes.length === 0) {
      return sendError({ message: 'No schema types configured. Select at least one schema type.' });
    }

    const bulkPrompt = site.schema_bulk_prompt || '';
    const model = site.schema_model || 'claude-sonnet-4-5-20250929';

    // Get custom page article IDs to exclude
    const customPages = await sql`
      SELECT article_id FROM schema_custom_pages
      WHERE website_id = ${websiteId} AND article_id IS NOT NULL
    `;
    const customArticleIds = customPages.map(p => p.article_id).filter(Boolean);

    // Get all articles with wp_post_id (published) that have content
    let articles;
    if (customArticleIds.length > 0) {
      articles = await sql`
        SELECT id, keyword, final_content, wp_post_id
        FROM articles
        WHERE website_id = ${websiteId}
          AND wp_post_id IS NOT NULL
          AND final_content IS NOT NULL
          AND final_content != ''
          AND id != ALL(${customArticleIds})
        ORDER BY id
      `;
    } else {
      articles = await sql`
        SELECT id, keyword, final_content, wp_post_id
        FROM articles
        WHERE website_id = ${websiteId}
          AND wp_post_id IS NOT NULL
          AND final_content IS NOT NULL
          AND final_content != ''
        ORDER BY id
      `;
    }

    if (articles.length === 0) {
      return sendComplete({
        generated: 0,
        skipped: customArticleIds.length,
        errors: [],
        message: 'No articles found to generate schema for'
      });
    }

    const total = articles.length;
    let generated = 0;
    const errors = [];

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];

      sendProgress({
        current: i + 1,
        total,
        pageTitle: article.keyword,
        status: 'generating'
      });

      try {
        await generateBulkSchema(article.id, schemaTypes, bulkPrompt, model);
        generated++;
      } catch (err) {
        console.error(`Schema generation failed for article ${article.id}:`, err.message);
        errors.push({
          articleId: article.id,
          keyword: article.keyword,
          error: err.message
        });
      }
    }

    sendComplete({
      generated,
      skipped: customArticleIds.length,
      total,
      errors
    });
  } catch (error) {
    console.error('Bulk schema generation error:', error);
    sendError(error);
  }
});

/**
 * POST /api/schema/generate-single/:articleId
 * Generate schema for a single article using bulk settings
 */
router.post('/generate-single/:articleId', requireDb, async (req, res) => {
  try {
    const { articleId } = req.params;

    // Get the article's website
    const articles = await sql`
      SELECT a.website_id FROM articles a WHERE a.id = ${articleId}
    `;

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const websiteId = articles[0].website_id;

    // Get website schema settings
    const websites = await sql`
      SELECT schema_types, schema_bulk_prompt, schema_model
      FROM websites WHERE id = ${websiteId}
    `;

    if (websites.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const site = websites[0];
    let schemaTypes = [];
    try {
      schemaTypes = site.schema_types ? JSON.parse(site.schema_types) : [];
    } catch (e) {
      schemaTypes = [];
    }

    if (schemaTypes.length === 0) {
      return res.status(400).json({ error: 'No schema types configured. Select at least one schema type.' });
    }

    const result = await generateBulkSchema(
      parseInt(articleId),
      schemaTypes,
      site.schema_bulk_prompt || '',
      site.schema_model || 'claude-sonnet-4-5-20250929'
    );

    res.json({
      success: true,
      schemas: result.schemas,
      identifiedTypes: result.identifiedTypes
    });
  } catch (error) {
    console.error('Single schema generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/schema/generate-custom/:customPageId
 * Generate schema for a custom-designated page using its custom prompt
 */
router.post('/generate-custom/:customPageId', requireDb, async (req, res) => {
  try {
    const { customPageId } = req.params;

    // Get the custom page's website for model setting
    const pages = await sql`
      SELECT scp.website_id, scp.custom_prompt
      FROM schema_custom_pages scp
      WHERE scp.id = ${customPageId}
    `;

    if (pages.length === 0) {
      return res.status(404).json({ error: 'Custom schema page not found' });
    }

    const websites = await sql`
      SELECT schema_model FROM websites WHERE id = ${pages[0].website_id}
    `;

    const model = websites[0]?.schema_model || 'claude-sonnet-4-5-20250929';

    const result = await generateCustomSchema(
      parseInt(customPageId),
      pages[0].custom_prompt,
      model
    );

    res.json({
      success: true,
      schemas: result.schemas
    });
  } catch (error) {
    console.error('Custom schema generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SCHEMA PUSH TO WORDPRESS
// ============================================

/**
 * POST /api/schema/push/:articleId
 * Push generated schema to WordPress for one article
 */
router.post('/push/:articleId', requireDb, async (req, res) => {
  try {
    const { articleId } = req.params;

    const articles = await sql`
      SELECT a.id, a.wp_post_id, a.generated_schema,
             w.wp_url, w.wp_user, w.wp_app_password, w.schema_mu_plugin_deployed
      FROM articles a
      LEFT JOIN websites w ON a.website_id = w.id
      WHERE a.id = ${articleId}
    `;

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = articles[0];

    if (!article.wp_post_id) {
      return res.status(400).json({ error: 'Article not published to WordPress yet' });
    }

    if (!article.generated_schema) {
      return res.status(400).json({ error: 'No schema generated for this article. Generate schema first.' });
    }

    if (!article.schema_mu_plugin_deployed) {
      return res.status(400).json({
        error: 'PromptFlow Schema mu-plugin not deployed. Deploy the plugin before pushing schema.'
      });
    }

    let schemas;
    try {
      schemas = JSON.parse(article.generated_schema);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid schema data stored for this article' });
    }

    const result = await pushSchemaToWordPress(
      article.wp_post_id,
      schemas,
      {
        wpUrl: article.wp_url,
        username: article.wp_user,
        appPassword: article.wp_app_password
      }
    );

    if (result.success) {
      await sql`
        UPDATE articles SET
          schema_pushed = true,
          schema_pushed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${articleId}
      `;
    }

    res.json(result);
  } catch (error) {
    console.error('Schema push error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/schema/push-custom/:customPageId
 * Push generated schema to WordPress for one custom page
 */
router.post('/push-custom/:customPageId', requireDb, async (req, res) => {
  try {
    const { customPageId } = req.params;

    const pages = await sql`
      SELECT scp.*, w.wp_url, w.wp_user, w.wp_app_password, w.schema_mu_plugin_deployed
      FROM schema_custom_pages scp
      LEFT JOIN websites w ON scp.website_id = w.id
      WHERE scp.id = ${customPageId}
    `;

    if (pages.length === 0) {
      return res.status(404).json({ error: 'Custom schema page not found' });
    }

    const page = pages[0];

    // Determine the wp_post_id to push to
    let wpPostId = page.wp_post_id;
    if (!wpPostId && page.article_id) {
      const articles = await sql`
        SELECT wp_post_id FROM articles WHERE id = ${page.article_id}
      `;
      wpPostId = articles[0]?.wp_post_id;
    }

    if (!wpPostId) {
      return res.status(400).json({ error: 'No WordPress page ID associated with this custom page' });
    }

    if (!page.generated_schema) {
      return res.status(400).json({ error: 'No schema generated for this page. Generate schema first.' });
    }

    if (!page.schema_mu_plugin_deployed) {
      return res.status(400).json({
        error: 'PromptFlow Schema mu-plugin not deployed. Deploy the plugin before pushing schema.'
      });
    }

    let schemas;
    try {
      schemas = JSON.parse(page.generated_schema);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid schema data stored for this page' });
    }

    const result = await pushSchemaToWordPress(
      wpPostId,
      schemas,
      {
        wpUrl: page.wp_url,
        username: page.wp_user,
        appPassword: page.wp_app_password
      }
    );

    if (result.success) {
      await sql`
        UPDATE schema_custom_pages SET
          schema_pushed = true,
          pushed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${customPageId}
      `;
    }

    res.json(result);
  } catch (error) {
    console.error('Custom schema push error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/schema/push-bulk
 * Push schema for all articles that have generated but unpushed schema. Uses SSE.
 */
router.post('/push-bulk', requireDb, async (req, res) => {
  const { websiteId } = req.body;

  if (!websiteId) {
    return res.status(400).json({ error: 'websiteId required' });
  }

  const { sendProgress, sendComplete, sendError } = setupSSE(res);

  try {
    // Get website credentials and mu-plugin status
    const websites = await sql`
      SELECT wp_url, wp_user, wp_app_password, schema_mu_plugin_deployed
      FROM websites WHERE id = ${websiteId}
    `;

    if (websites.length === 0) {
      return sendError({ message: 'Website not found' });
    }

    const site = websites[0];

    if (!site.schema_mu_plugin_deployed) {
      return sendError({
        message: 'PromptFlow Schema mu-plugin not deployed. Deploy the plugin before pushing schema.'
      });
    }

    // Get all articles with generated but unpushed schema
    const articles = await sql`
      SELECT id, keyword, wp_post_id, generated_schema
      FROM articles
      WHERE website_id = ${websiteId}
        AND wp_post_id IS NOT NULL
        AND generated_schema IS NOT NULL
        AND (schema_pushed = false OR schema_pushed IS NULL)
      ORDER BY id
    `;

    // Also get custom pages with generated but unpushed schema
    const customPages = await sql`
      SELECT scp.id, scp.page_title, scp.wp_post_id, scp.article_id, scp.generated_schema,
             a.wp_post_id as article_wp_post_id
      FROM schema_custom_pages scp
      LEFT JOIN articles a ON scp.article_id = a.id
      WHERE scp.website_id = ${websiteId}
        AND scp.generated_schema IS NOT NULL
        AND (scp.schema_pushed = false OR scp.schema_pushed IS NULL)
      ORDER BY scp.id
    `;

    const totalItems = articles.length + customPages.length;

    if (totalItems === 0) {
      return sendComplete({
        pushed: 0,
        failed: 0,
        errors: [],
        message: 'No unpushed schema found'
      });
    }

    let pushed = 0;
    const errors = [];
    let current = 0;

    const credentials = {
      wpUrl: site.wp_url,
      username: site.wp_user,
      appPassword: site.wp_app_password
    };

    // Push articles
    for (const article of articles) {
      current++;
      sendProgress({
        current,
        total: totalItems,
        pageTitle: article.keyword,
        status: 'pushing'
      });

      try {
        const schemas = JSON.parse(article.generated_schema);
        const result = await pushSchemaToWordPress(article.wp_post_id, schemas, credentials);

        if (result.success) {
          await sql`
            UPDATE articles SET
              schema_pushed = true,
              schema_pushed_at = NOW(),
              updated_at = NOW()
            WHERE id = ${article.id}
          `;
          pushed++;
        } else {
          errors.push({
            articleId: article.id,
            keyword: article.keyword,
            error: result.message
          });
        }
      } catch (err) {
        errors.push({
          articleId: article.id,
          keyword: article.keyword,
          error: err.message
        });
      }
    }

    // Push custom pages
    for (const page of customPages) {
      current++;
      sendProgress({
        current,
        total: totalItems,
        pageTitle: page.page_title || 'Custom page',
        status: 'pushing'
      });

      try {
        const wpPostId = page.wp_post_id || page.article_wp_post_id;
        if (!wpPostId) {
          errors.push({
            customPageId: page.id,
            pageTitle: page.page_title,
            error: 'No WordPress page ID'
          });
          continue;
        }

        const schemas = JSON.parse(page.generated_schema);
        const result = await pushSchemaToWordPress(wpPostId, schemas, credentials);

        if (result.success) {
          await sql`
            UPDATE schema_custom_pages SET
              schema_pushed = true,
              pushed_at = NOW(),
              updated_at = NOW()
            WHERE id = ${page.id}
          `;
          pushed++;
        } else {
          errors.push({
            customPageId: page.id,
            pageTitle: page.page_title,
            error: result.message
          });
        }
      } catch (err) {
        errors.push({
          customPageId: page.id,
          pageTitle: page.page_title,
          error: err.message
        });
      }
    }

    sendComplete({
      pushed,
      failed: errors.length,
      total: totalItems,
      errors
    });
  } catch (error) {
    console.error('Bulk schema push error:', error);
    sendError(error);
  }
});

// ============================================
// CUSTOM PAGES MANAGEMENT
// ============================================

/**
 * GET /api/schema/custom-pages/:websiteId
 * Get all custom-designated pages for a website
 */
router.get('/custom-pages/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;

    const pages = await sql`
      SELECT scp.*,
             a.keyword as article_keyword,
             a.wp_post_url as article_wp_post_url,
             a.wp_post_id as article_wp_post_id
      FROM schema_custom_pages scp
      LEFT JOIN articles a ON scp.article_id = a.id
      WHERE scp.website_id = ${websiteId}
      ORDER BY scp.created_at
    `;

    // Parse generated_schema for each page
    const parsed = pages.map(p => ({
      ...p,
      generated_schema: p.generated_schema ? JSON.parse(p.generated_schema) : null
    }));

    res.json({ pages: parsed });
  } catch (error) {
    console.error('Error fetching custom pages:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/schema/custom-pages
 * Add a custom schema page
 */
router.post('/custom-pages', requireDb, async (req, res) => {
  try {
    const { websiteId, articleId, wpPostId, pageTitle, pageUrl, customPrompt } = req.body;

    if (!websiteId || !customPrompt) {
      return res.status(400).json({ error: 'websiteId and customPrompt are required' });
    }

    const result = await sql`
      INSERT INTO schema_custom_pages (website_id, article_id, wp_post_id, page_title, page_url, custom_prompt)
      VALUES (${websiteId}, ${articleId || null}, ${wpPostId || null}, ${pageTitle || ''}, ${pageUrl || ''}, ${customPrompt})
      RETURNING *
    `;

    res.json({ success: true, page: result[0] });
  } catch (error) {
    console.error('Error adding custom page:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/schema/custom-pages/:customPageId
 * Update a custom page's prompt or details
 */
router.put('/custom-pages/:customPageId', requireDb, async (req, res) => {
  try {
    const { customPageId } = req.params;
    const { customPrompt, pageTitle, pageUrl, generatedSchema } = req.body;

    // Get current values first
    const current = await sql`SELECT * FROM schema_custom_pages WHERE id = ${customPageId}`;
    if (current.length === 0) {
      return res.status(404).json({ error: 'Custom page not found' });
    }

    const newPrompt = customPrompt !== undefined ? customPrompt : current[0].custom_prompt;
    const newTitle = pageTitle !== undefined ? pageTitle : current[0].page_title;
    const newUrl = pageUrl !== undefined ? pageUrl : current[0].page_url;

    // If generatedSchema is provided, update it and reset push status
    let newSchema = current[0].generated_schema;
    let newPushed = current[0].schema_pushed;
    if (generatedSchema !== undefined) {
      newSchema = typeof generatedSchema === 'string' ? generatedSchema : JSON.stringify(generatedSchema);
      newPushed = false; // Reset push status when schema changes
    }

    await sql`
      UPDATE schema_custom_pages SET
        custom_prompt = ${newPrompt},
        page_title = ${newTitle},
        page_url = ${newUrl},
        generated_schema = ${newSchema},
        schema_pushed = ${newPushed},
        updated_at = NOW()
      WHERE id = ${customPageId}
    `;

    res.json({ success: true, message: 'Custom page updated' });
  } catch (error) {
    console.error('Error updating custom page:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/schema/custom-pages/:customPageId
 * Remove a page from custom designation
 */
router.delete('/custom-pages/:customPageId', requireDb, async (req, res) => {
  try {
    const { customPageId } = req.params;

    await sql`DELETE FROM schema_custom_pages WHERE id = ${customPageId}`;

    res.json({ success: true, message: 'Custom page removed. It will be included in bulk processing next time.' });
  } catch (error) {
    console.error('Error deleting custom page:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STATUS / STATS
// ============================================

/**
 * GET /api/schema/status/:websiteId
 * Get schema generation and push status for a website
 */
router.get('/status/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;

    // Count articles with various schema states
    const stats = await sql`
      SELECT
        COUNT(*) FILTER (WHERE wp_post_id IS NOT NULL) as total_published,
        COUNT(*) FILTER (WHERE wp_post_id IS NOT NULL AND generated_schema IS NOT NULL) as with_schema,
        COUNT(*) FILTER (WHERE wp_post_id IS NOT NULL AND generated_schema IS NOT NULL AND schema_pushed = true) as schema_pushed,
        COUNT(*) FILTER (WHERE wp_post_id IS NOT NULL AND generated_schema IS NOT NULL AND (schema_pushed = false OR schema_pushed IS NULL)) as schema_pending_push,
        COUNT(*) FILTER (WHERE wp_post_id IS NOT NULL AND (generated_schema IS NULL OR generated_schema = '')) as without_schema
      FROM articles
      WHERE website_id = ${websiteId}
    `;

    // Count custom pages
    const customStats = await sql`
      SELECT
        COUNT(*) as total_custom,
        COUNT(*) FILTER (WHERE generated_schema IS NOT NULL) as custom_with_schema,
        COUNT(*) FILTER (WHERE schema_pushed = true) as custom_pushed
      FROM schema_custom_pages
      WHERE website_id = ${websiteId}
    `;

    res.json({
      articles: {
        totalPublished: parseInt(stats[0].total_published),
        withSchema: parseInt(stats[0].with_schema),
        schemaPushed: parseInt(stats[0].schema_pushed),
        pendingPush: parseInt(stats[0].schema_pending_push),
        withoutSchema: parseInt(stats[0].without_schema)
      },
      customPages: {
        total: parseInt(customStats[0].total_custom),
        withSchema: parseInt(customStats[0].custom_with_schema),
        pushed: parseInt(customStats[0].custom_pushed)
      }
    });
  } catch (error) {
    console.error('Error fetching schema status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/schema/articles/:websiteId
 * Get all articles with their schema status for the bulk table view
 */
router.get('/articles/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;

    const articles = await sql`
      SELECT id, keyword, wp_post_id, wp_post_url, generated_schema, schema_pushed, schema_pushed_at
      FROM articles
      WHERE website_id = ${websiteId}
        AND wp_post_id IS NOT NULL
      ORDER BY keyword
    `;

    // Parse schema and extract types
    const parsed = articles.map(a => {
      let schemas = null;
      let identifiedTypes = [];
      if (a.generated_schema) {
        try {
          schemas = JSON.parse(a.generated_schema);
          identifiedTypes = schemas.map(s => s['@type']).filter(Boolean);
        } catch (e) {
          // Invalid JSON stored
        }
      }
      return {
        id: a.id,
        keyword: a.keyword,
        wpPostId: a.wp_post_id,
        wpPostUrl: a.wp_post_url,
        hasSchema: !!a.generated_schema,
        identifiedTypes,
        schemaPushed: a.schema_pushed || false,
        schemaPushedAt: a.schema_pushed_at,
        schemaCount: schemas ? schemas.length : 0
      };
    });

    res.json({ articles: parsed });
  } catch (error) {
    console.error('Error fetching schema articles:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/schema/article-schema/:articleId
 * Get the full generated schema for a single article (for preview)
 */
router.get('/article-schema/:articleId', requireDb, async (req, res) => {
  try {
    const { articleId } = req.params;

    const articles = await sql`
      SELECT generated_schema, keyword, schema_pushed, schema_pushed_at
      FROM articles WHERE id = ${articleId}
    `;

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = articles[0];
    let schemas = null;
    try {
      schemas = article.generated_schema ? JSON.parse(article.generated_schema) : null;
    } catch (e) {
      schemas = null;
    }

    res.json({
      schemas,
      keyword: article.keyword,
      schemaPushed: article.schema_pushed || false,
      schemaPushedAt: article.schema_pushed_at
    });
  } catch (error) {
    console.error('Error fetching article schema:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/schema/article-schema/:articleId
 * Update the generated schema for a single article (manual edit)
 */
router.put('/article-schema/:articleId', requireDb, async (req, res) => {
  try {
    const { articleId } = req.params;
    const { schemas } = req.body;

    if (!schemas || !Array.isArray(schemas)) {
      return res.status(400).json({ error: 'schemas must be a valid array' });
    }

    await sql`
      UPDATE articles SET
        generated_schema = ${JSON.stringify(schemas)},
        schema_pushed = false,
        updated_at = NOW()
      WHERE id = ${articleId}
    `;

    res.json({ success: true, message: 'Schema updated' });
  } catch (error) {
    console.error('Error updating article schema:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
