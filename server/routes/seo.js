// SEO Plugin API routes
import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';
import { pushMetaToSeoPlugin, detectSeoPlugin, getSupportedPlugins } from '../services/seo-plugin.js';

const router = express.Router();

// Middleware to check database availability
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// GET supported SEO plugins list
router.get('/plugins', (req, res) => {
  res.json({ plugins: getSupportedPlugins() });
});

// POST detect SEO plugin on a website
router.post('/detect', async (req, res) => {
  try {
    const { wpUrl, wpUser, wpPassword } = req.body;

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const result = await detectSeoPlugin({ wpUrl, wpUser, wpPassword });
    res.json(result);
  } catch (error) {
    console.error('Error detecting SEO plugin:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST push meta to SEO plugin for an article
router.post('/push/:articleId', requireDb, async (req, res) => {
  try {
    const { articleId } = req.params;
    const { metaTitle, metaDescription } = req.body;

    // Get article with website info
    const articles = await sql`
      SELECT a.*, ws.wp_url, ws.wp_user, ws.wp_app_password, ws.seo_plugin
      FROM articles a
      LEFT JOIN websites ws ON a.website_id = ws.id
      WHERE a.id = ${articleId}
    `;

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = articles[0];

    if (!article.wp_post_id) {
      return res.status(400).json({
        error: 'Article has not been published to WordPress yet. Publish the page first.'
      });
    }

    if (!article.wp_url || !article.wp_user || !article.wp_app_password) {
      return res.status(400).json({
        error: 'WordPress credentials not configured for this website'
      });
    }

    const seoPlugin = article.seo_plugin || 'yoast';

    if (seoPlugin === 'none') {
      return res.status(400).json({
        error: 'SEO plugin is set to "none" for this website. Configure an SEO plugin first.'
      });
    }

    // Push to SEO plugin
    const pushResult = await pushMetaToSeoPlugin({
      wpUrl: article.wp_url,
      wpUser: article.wp_user,
      wpPassword: article.wp_app_password,
      postId: article.wp_post_id,
      metaTitle: metaTitle || article.selected_meta_title,
      metaDescription: metaDescription || article.selected_meta_description,
      seoPlugin
    });

    if (!pushResult.success) {
      return res.status(500).json({ error: pushResult.error });
    }

    // Update article with push status
    await sql`
      UPDATE articles
      SET selected_meta_title = ${metaTitle || article.selected_meta_title},
          selected_meta_description = ${metaDescription || article.selected_meta_description},
          meta_seo_status = 'pushed',
          meta_pushed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${articleId}
    `;

    res.json({
      success: true,
      message: pushResult.message,
      seoPlugin,
      postId: article.wp_post_id
    });

  } catch (error) {
    console.error('Error pushing meta to SEO:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST direct push meta to SEO plugin (without needing an article in database)
router.post('/push-direct', async (req, res) => {
  try {
    const { wpUrl, wpUser, wpPassword, postId, metaTitle, metaDescription, seoPlugin, postType, articleId, isManualPush = true } = req.body;

    if (!wpUrl || !wpUser || !wpPassword || !postId) {
      return res.status(400).json({ error: 'WordPress credentials and post ID are required' });
    }

    const pushResult = await pushMetaToSeoPlugin({
      wpUrl,
      wpUser,
      wpPassword,
      postId,
      metaTitle,
      metaDescription,
      seoPlugin: seoPlugin || 'aioseo',
      postType: postType || 'pages'
    });

    if (!pushResult.success) {
      return res.status(500).json({ error: pushResult.error });
    }

    // Track meta push if articleId provided and database enabled
    if (articleId && isDatabaseEnabled()) {
      try {
        if (isManualPush) {
          // Manual push: increment count and append date
          await sql`
            UPDATE articles
            SET meta_push_manual_count = COALESCE(meta_push_manual_count, 0) + 1,
                meta_push_manual_dates = COALESCE(meta_push_manual_dates, '[]'::jsonb) || to_jsonb(to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${articleId}
          `;
        } else {
          // Auto push: set auto_at timestamp (only if not already set)
          await sql`
            UPDATE articles
            SET meta_push_auto_at = COALESCE(meta_push_auto_at, CURRENT_TIMESTAMP),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${articleId}
          `;
        }
      } catch (dbError) {
        console.error('Failed to update article meta push tracking:', dbError);
      }
    }

    res.json({
      success: true,
      message: pushResult.message,
      postId
    });

  } catch (error) {
    console.error('Error pushing meta directly:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH select meta title/description for an article (without pushing yet)
router.patch('/select/:articleId', requireDb, async (req, res) => {
  try {
    const { articleId } = req.params;
    const { selectedMetaTitle, selectedMetaDescription, metaSeoStatus } = req.body;

    // Use provided status or default to 'selected'
    const status = metaSeoStatus || 'selected';

    // Only update meta_pushed_at when status is 'pushed', otherwise keep existing value
    let result;
    if (status === 'pushed') {
      result = await sql`
        UPDATE articles
        SET selected_meta_title = COALESCE(${selectedMetaTitle}, selected_meta_title),
            selected_meta_description = COALESCE(${selectedMetaDescription}, selected_meta_description),
            meta_seo_status = ${status},
            meta_pushed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${articleId}
        RETURNING *
      `;
    } else {
      result = await sql`
        UPDATE articles
        SET selected_meta_title = COALESCE(${selectedMetaTitle}, selected_meta_title),
            selected_meta_description = COALESCE(${selectedMetaDescription}, selected_meta_description),
            meta_seo_status = ${status},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${articleId}
        RETURNING *
      `;
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ article: result[0] });
  } catch (error) {
    console.error('Error selecting meta:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET articles with pending meta selections (for notification system)
router.get('/pending', requireDb, async (req, res) => {
  try {
    const { websiteId, clientId } = req.query;

    let articles;

    if (websiteId) {
      articles = await sql`
        SELECT a.id, a.keyword, a.tag, a.meta_titles, a.meta_descriptions,
               a.selected_meta_title, a.selected_meta_description, a.meta_seo_status,
               a.wp_post_id, a.wp_post_url, a.created_at,
               ws.name as website_name, ws.seo_plugin,
               c.name as client_name
        FROM articles a
        LEFT JOIN websites ws ON a.website_id = ws.id
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE a.website_id = ${websiteId}
          AND a.meta_seo_status IN ('pending', 'selected')
          AND (a.meta_titles IS NOT NULL AND jsonb_array_length(a.meta_titles) > 0)
        ORDER BY a.created_at DESC
      `;
    } else if (clientId) {
      articles = await sql`
        SELECT a.id, a.keyword, a.tag, a.meta_titles, a.meta_descriptions,
               a.selected_meta_title, a.selected_meta_description, a.meta_seo_status,
               a.wp_post_id, a.wp_post_url, a.created_at,
               ws.name as website_name, ws.seo_plugin,
               c.name as client_name
        FROM articles a
        LEFT JOIN websites ws ON a.website_id = ws.id
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE a.client_id = ${clientId}
          AND a.meta_seo_status IN ('pending', 'selected')
          AND (a.meta_titles IS NOT NULL AND jsonb_array_length(a.meta_titles) > 0)
        ORDER BY a.created_at DESC
      `;
    } else {
      articles = await sql`
        SELECT a.id, a.keyword, a.tag, a.meta_titles, a.meta_descriptions,
               a.selected_meta_title, a.selected_meta_description, a.meta_seo_status,
               a.wp_post_id, a.wp_post_url, a.created_at,
               ws.name as website_name, ws.seo_plugin,
               c.name as client_name
        FROM articles a
        LEFT JOIN websites ws ON a.website_id = ws.id
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE a.meta_seo_status IN ('pending', 'selected')
          AND (a.meta_titles IS NOT NULL AND jsonb_array_length(a.meta_titles) > 0)
        ORDER BY a.created_at DESC
      `;
    }

    res.json({
      pendingCount: articles.length,
      articles
    });
  } catch (error) {
    console.error('Error fetching pending meta articles:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
