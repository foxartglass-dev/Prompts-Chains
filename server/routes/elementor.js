/**
 * Elementor API Routes
 * Handles the full pipeline: Article → Elementor Page
 */

import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';
import chunkContent, { extractTitle, countWords } from '../services/content-chunker.js';
import buildElementorPage, { getElementorMetaFields } from '../services/elementor-builder.js';
import {
  createElementorPage,
  updatePage,
  getPage,
  getDraftPages,
  uploadMedia,
  scheduleDripFeed,
  testConnection
} from '../services/wordpress-publisher.js';
import { processArticleWithImages, previewPrompts } from '../services/image-pipeline.js';

const router = express.Router();

// Middleware to check database availability
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

/**
 * POST /api/elementor/test-connection
 * Test WordPress connection with provided credentials
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { wpUrl, wpUser, wpPassword } = req.body;

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const result = await testConnection({
      url: wpUrl,
      user: wpUser,
      password: wpPassword
    });

    res.json(result);
  } catch (error) {
    console.error('Connection test error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/elementor/chunk-content
 * Chunk content for preview (doesn't save anything)
 */
router.post('/chunk-content', async (req, res) => {
  try {
    const { content, maxWords = 300 } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const chunked = chunkContent(content, { maxWords });
    const title = extractTitle(content);

    res.json({
      success: true,
      title,
      ...chunked
    });
  } catch (error) {
    console.error('Chunk content error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/elementor/preview
 * Generate Elementor JSON for preview (doesn't publish)
 */
router.post('/preview', async (req, res) => {
  try {
    const {
      content,
      title,
      maxWords = 300,
      ctaText = 'Book Now!',
      ctaUrl = '#',
      includeStatsBar = false,
      statsBarPosition = 'middle'
    } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Chunk the content
    const chunked = chunkContent(content, { maxWords });

    // Extract title from content if not provided
    const pageTitle = title || extractTitle(content) || 'Untitled Page';

    // Build Elementor structure
    const elementorData = buildElementorPage(chunked, {
      title: pageTitle,
      ctaText,
      ctaUrl,
      includeStatsBar,
      statsBarPosition
    });

    res.json({
      success: true,
      elementorData,
      meta: getElementorMetaFields(elementorData),
      chunks: chunked
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/elementor/publish
 * Full pipeline: Article → Elementor Page on WordPress
 * Optionally generates AI images with Style DNA
 */
router.post('/publish', async (req, res) => {
  try {
    const {
      // Article content
      content,
      title,
      slug,
      keyword,
      // WordPress credentials
      wpUrl,
      wpUser,
      wpPassword,
      // Elementor options
      maxWords = 300,
      ctaText = 'Book Now!',
      ctaUrl = '#',
      includeStatsBar = false,
      statsBarPosition = 'middle',
      // Publishing options
      status = 'draft',
      publishDate,
      // Database tracking
      articleId,
      // Image generation options (NEW)
      generateImages = false,
      styleDNA = null,
      referenceImages = null,
      openaiApiKey = null,
      replicateApiKey = null,
      maxImages = 4
    } = req.body;

    // Validate required fields
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const wpCredentials = { url: wpUrl, user: wpUser, password: wpPassword };

    let chunked;
    let imagesGenerated = 0;
    let estimatedCost = null;

    // Step 1: Process content with or without images
    if (generateImages) {
      // Use the image pipeline for full processing
      const pipelineResult = await processArticleWithImages(content, {
        title,
        keyword,
        styleDNA,
        referenceImages,
        openaiApiKey: openaiApiKey || process.env.OPENAI_API_KEY,
        replicateApiKey: replicateApiKey || process.env.REPLICATE_API_TOKEN,
        wpCredentials,
        maxImages,
        maxWords
      });

      chunked = pipelineResult.chunks;
      imagesGenerated = pipelineResult.imagesGenerated || 0;
      estimatedCost = pipelineResult.estimatedCost;
    } else {
      // Standard chunking without images
      chunked = chunkContent(content, { maxWords });
    }

    // Step 2: Extract or use provided title
    const pageTitle = title || extractTitle(content) || 'Untitled Page';

    // Step 3: Build Elementor structure
    const elementorData = buildElementorPage(chunked, {
      title: pageTitle,
      ctaText,
      ctaUrl,
      includeStatsBar,
      statsBarPosition
    });

    // Step 4: Get Elementor meta fields
    const elementorMeta = getElementorMetaFields(elementorData);

    // Step 5: Create WordPress page
    const pageResult = await createElementorPage(wpCredentials, {
      title: pageTitle,
      slug,
      elementorMeta,
      status,
      publishDate
    });

    // Step 6: Update article in database if articleId provided
    if (articleId && isDatabaseEnabled()) {
      try {
        await sql`
          UPDATE articles
          SET wp_post_id = ${pageResult.id},
              wp_post_url = ${pageResult.link},
              wp_published_at = CURRENT_TIMESTAMP,
              status = ${status === 'publish' ? 'published' : 'draft'},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${articleId}
        `;
      } catch (dbError) {
        console.error('Failed to update article:', dbError);
        // Don't fail the request, page was created successfully
      }
    }

    res.json({
      success: true,
      page: pageResult,
      chunks: chunked.chunkCount,
      wordCount: chunked.totalWords,
      imagesGenerated,
      estimatedCost
    });
  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/elementor/publish-article/:id
 * Publish an existing article from the database as an Elementor page
 */
router.post('/publish-article/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      wpUrl,
      wpUser,
      wpPassword,
      maxWords = 300,
      ctaText = 'Book Now!',
      ctaUrl = '#',
      includeStatsBar = false,
      status = 'draft',
      publishDate
    } = req.body;

    // Fetch article with website credentials
    const articles = await sql`
      SELECT a.*,
             ws.wp_url as website_wp_url,
             ws.wp_user as website_wp_user,
             ws.wp_app_password as website_wp_password
      FROM articles a
      LEFT JOIN websites ws ON a.website_id = ws.id
      WHERE a.id = ${id}
    `;

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = articles[0];

    // Use provided credentials or fall back to website credentials
    const wpCredentials = {
      url: wpUrl || article.website_wp_url,
      user: wpUser || article.website_wp_user,
      password: wpPassword || article.website_wp_password
    };

    if (!wpCredentials.url || !wpCredentials.user || !wpCredentials.password) {
      return res.status(400).json({
        error: 'WordPress credentials required. Either provide them in the request or configure them on the website.'
      });
    }

    // Get content from article
    const content = article.final_content;
    if (!content) {
      return res.status(400).json({ error: 'Article has no content' });
    }

    // Chunk the content
    const chunked = chunkContent(content, { maxWords });

    // Use keyword as title, or first meta title
    const pageTitle = article.keyword ||
      (article.meta_titles && article.meta_titles[0]) ||
      'Untitled Page';

    // Build Elementor structure
    const elementorData = buildElementorPage(chunked, {
      title: pageTitle,
      ctaText,
      ctaUrl,
      includeStatsBar
    });

    // Get Elementor meta fields
    const elementorMeta = getElementorMetaFields(elementorData);

    // Create WordPress page
    const pageResult = await createElementorPage(wpCredentials, {
      title: pageTitle,
      elementorMeta,
      status,
      publishDate
    });

    // Update article in database
    await sql`
      UPDATE articles
      SET wp_post_id = ${pageResult.id},
          wp_post_url = ${pageResult.link},
          wp_published_at = CURRENT_TIMESTAMP,
          status = ${status === 'publish' ? 'published' : 'draft'},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    res.json({
      success: true,
      page: pageResult,
      article: {
        id: article.id,
        keyword: article.keyword
      },
      chunks: chunked.chunkCount,
      wordCount: chunked.totalWords
    });
  } catch (error) {
    console.error('Publish article error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/elementor/drafts
 * Get all draft pages from WordPress
 */
router.get('/drafts', async (req, res) => {
  try {
    const { wpUrl, wpUser, wpPassword } = req.query;

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const drafts = await getDraftPages({
      url: wpUrl,
      user: wpUser,
      password: wpPassword
    });

    res.json({
      success: true,
      drafts,
      count: drafts.length
    });
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/elementor/schedule-drip-feed
 * Schedule multiple pages for drip feed publishing
 */
router.post('/schedule-drip-feed', async (req, res) => {
  try {
    const {
      pageIds,
      wpUrl,
      wpUser,
      wpPassword,
      pagesPerDay = 5,
      startDate,
      publishTime = '09:00',
      randomize = true
    } = req.body;

    if (!pageIds || !Array.isArray(pageIds) || pageIds.length === 0) {
      return res.status(400).json({ error: 'pageIds array is required' });
    }

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const results = await scheduleDripFeed(
      { url: wpUrl, user: wpUser, password: wpPassword },
      pageIds,
      {
        pagesPerDay,
        startDate: startDate ? new Date(startDate) : new Date(),
        publishTime,
        randomize
      }
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      scheduled: successful,
      failed,
      results
    });
  } catch (error) {
    console.error('Schedule drip feed error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/elementor/upload-media
 * Upload an image to WordPress media library
 */
router.post('/upload-media', async (req, res) => {
  try {
    const {
      wpUrl,
      wpUser,
      wpPassword,
      imageData, // base64 encoded image
      filename,
      alt = '',
      caption = ''
    } = req.body;

    if (!imageData || !filename) {
      return res.status(400).json({ error: 'imageData and filename are required' });
    }

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const media = await uploadMedia(
      { url: wpUrl, user: wpUser, password: wpPassword },
      imageData,
      filename,
      { alt, caption }
    );

    res.json({
      success: true,
      media
    });
  } catch (error) {
    console.error('Upload media error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/elementor/batch-publish
 * Publish multiple articles as Elementor pages
 */
router.post('/batch-publish', requireDb, async (req, res) => {
  try {
    const {
      articleIds,
      wpUrl,
      wpUser,
      wpPassword,
      maxWords = 300,
      ctaText = 'Book Now!',
      ctaUrl = '#',
      status = 'draft'
    } = req.body;

    if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return res.status(400).json({ error: 'articleIds array is required' });
    }

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const wpCredentials = { url: wpUrl, user: wpUser, password: wpPassword };
    const results = [];

    for (const articleId of articleIds) {
      try {
        // Fetch article
        const articles = await sql`
          SELECT * FROM articles WHERE id = ${articleId}
        `;

        if (articles.length === 0) {
          results.push({ articleId, success: false, error: 'Article not found' });
          continue;
        }

        const article = articles[0];
        const content = article.final_content;

        if (!content) {
          results.push({ articleId, success: false, error: 'No content' });
          continue;
        }

        // Chunk and build
        const chunked = chunkContent(content, { maxWords });
        const pageTitle = article.keyword || 'Untitled';
        const elementorData = buildElementorPage(chunked, {
          title: pageTitle,
          ctaText,
          ctaUrl
        });
        const elementorMeta = getElementorMetaFields(elementorData);

        // Create page
        const pageResult = await createElementorPage(wpCredentials, {
          title: pageTitle,
          elementorMeta,
          status
        });

        // Update article
        await sql`
          UPDATE articles
          SET wp_post_id = ${pageResult.id},
              wp_post_url = ${pageResult.link},
              wp_published_at = CURRENT_TIMESTAMP,
              status = ${status === 'publish' ? 'published' : 'draft'},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${articleId}
        `;

        results.push({
          articleId,
          success: true,
          pageId: pageResult.id,
          link: pageResult.link
        });
      } catch (error) {
        results.push({
          articleId,
          success: false,
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      published: successful,
      failed,
      results
    });
  } catch (error) {
    console.error('Batch publish error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
