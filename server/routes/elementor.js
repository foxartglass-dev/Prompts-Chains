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

/**
 * Clean content before processing
 * - Remove markdown # at start of text
 * - Remove stray dashes (keep keyword dashes like "move-in")
 * - Ensure proper H2 title separation
 */
function cleanContent(content) {
  if (!content) return content;

  let cleaned = content;

  // Remove markdown # at the very start (but not ## which is H2)
  cleaned = cleaned.replace(/^#\s+/gm, '');

  // Remove stray dashes at end of sentences/paragraphs (not within words)
  // Keep dashes in compound words like "move-in", "full-time"
  cleaned = cleaned.replace(/\s+[-–—]\s*$/gm, ''); // End of line dashes
  cleaned = cleaned.replace(/\s+[-–—]\s+(?=[A-Z])/g, '. '); // Mid-sentence break dashes before capital

  // Ensure H2 titles are on their own line (not run-on with body text)
  // If H2 is followed by text without line break, add one
  cleaned = cleaned.replace(/(<\/h2>)([^\n<])/g, '$1\n$2');
  cleaned = cleaned.replace(/(##\s+[^\n]+)([^\n#])/g, '$1\n$2');

  return cleaned.trim();
}

/**
 * Calculate number of images needed based on word count
 * Rule: 1 image per 200-300 words, at H2 breaks
 */
function calculateImagesNeeded(wordCount, chunkCount) {
  // Minimum 1 (hero), then 1 per ~250 words after that
  const baseImages = Math.ceil(wordCount / 250);
  // But can't exceed number of chunks (each chunk can have max 1 image)
  return Math.min(baseImages, chunkCount);
}

/**
 * Determine hero image side - alternates based on some identifier
 * @param {string} identifier - Article ID, keyword, or timestamp to determine side
 */
function getHeroImageSide(identifier) {
  // Use simple hash of identifier to alternate
  if (!identifier) return 'right';
  const hash = identifier.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return hash % 2 === 0 ? 'right' : 'left';
}

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
 * Supports:
 * 1. Pull from Image Bank (uses pre-made images by tag)
 * 2. Generate live images with Style DNA
 * 3. No images (text only)
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
      workflowId, // NEW: For Image Bank integration
      // Push tracking (manual vs auto)
      isManualPush = false,
      // Image options
      useImageBank = true, // NEW: Pull from Image Bank by tag
      generateImages = false, // Fallback to live generation
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

    // Step 0: Clean content (remove markdown #, stray dashes, fix H2 titles)
    const cleanedContent = cleanContent(content);

    // Step 1: Chunk the content first
    let chunked = chunkContent(cleanedContent, { maxWords });
    let imagesGenerated = 0;
    let imagesFromBank = 0;
    let estimatedCost = null;

    // Calculate dynamic image count based on word count (no arbitrary cap)
    const dynamicMaxImages = calculateImagesNeeded(chunked.totalWords, chunked.chunkCount);

    // Determine hero image side (alternates per article based on keyword/title)
    const heroImageSide = getHeroImageSide(keyword || title || `${Date.now()}`);

    // Body images start on OPPOSITE side of hero
    const bodyStartSide = heroImageSide === 'right' ? 'left' : 'right';

    // Step 2: Try to get images from Image Bank if workflowId provided
    if (useImageBank && workflowId && isDatabaseEnabled()) {
      try {
        const bankImages = await sql`
          SELECT * FROM image_creation_settings WHERE workflow_id = ${workflowId}
        `;

        if (bankImages.length > 0 && bankImages[0].enabled) {
          const config = bankImages[0];
          const imageBank = config.image_bank || [];
          const avatars = config.audience_avatars || [];
          const variationOrderMode = config.variation_order_mode || 'sequential';
          const manualOrder = config.manual_variation_order || [];

          // Extract tag from keyword (e.g., "Standard Cleaning(H)" -> "H")
          const tagMatch = keyword?.match(/\(([A-Z])\)/i);
          const articleTag = tagMatch ? tagMatch[1].toUpperCase() : null;

          // Find matching avatar by tag
          let targetAvatar = articleTag ? avatars.find(a => a.tag === articleTag) : avatars[0];

          // Get available images from bank matching the tag
          let availableImages = imageBank.filter(img => {
            if (img.used) return false;
            if (articleTag && img.avatarTag) return img.avatarTag === articleTag;
            if (targetAvatar?.variations?.length > 0) {
              return targetAvatar.variations.some(v => v.id === img.variationId);
            }
            return true;
          });

          // Sort by variation order
          if (variationOrderMode === 'manual' && manualOrder.length > 0) {
            availableImages = availableImages.sort((a, b) => {
              const aIdx = manualOrder.indexOf(a.variationId);
              const bIdx = manualOrder.indexOf(b.variationId);
              return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
            });
          } else if (variationOrderMode === 'random') {
            availableImages = availableImages.sort(() => Math.random() - 0.5);
          }

          // === IMAGE SELECTION LOGIC ===
          // Rule 1: First image (hero) MUST be vertical for side-by-side layout
          // Rule 2: Remaining images can be either orientation (word wrap in content)
          // Rule 3: Body images start on OPPOSITE side of hero, then alternate

          // Separate vertical and non-vertical images
          const verticalImages = availableImages.filter(img => img.orientation === 'vertical');
          const otherImages = availableImages.filter(img => img.orientation !== 'vertical');

          // Select hero image (must be vertical)
          const heroImage = verticalImages.length > 0 ? verticalImages[0] : null;

          // Select remaining images (can be any orientation, prefer landscape for word wrap)
          const remainingVertical = heroImage ? verticalImages.slice(1) : verticalImages;
          const remainingImages = [...otherImages, ...remainingVertical]; // Landscape first, then remaining vertical

          // Build final image list: hero first, then remaining
          const imagesToUse = [];
          if (heroImage) {
            imagesToUse.push(heroImage);
          }

          // Add remaining images based on DYNAMIC word count (no arbitrary cap)
          const chunksNeedingImages = [chunked.intro, ...chunked.chunks].filter(c => c);
          const maxNeeded = Math.min(dynamicMaxImages, chunksNeedingImages.length);
          const remainingNeeded = maxNeeded - imagesToUse.length;
          imagesToUse.push(...remainingImages.slice(0, remainingNeeded));

          // Assign images to chunks
          imagesToUse.forEach((img, idx) => {
            const isHero = idx === 0;

            // Body image side alternation: starts opposite of hero, then alternates
            // bodyStartSide is opposite of heroImageSide
            const bodyImageIndex = idx - 1; // 0-indexed for body images
            const bodySide = bodyImageIndex % 2 === 0 ? bodyStartSide : (bodyStartSide === 'left' ? 'right' : 'left');

            // Hero image: vertical (tall) for side-by-side with intro text
            // Body images: dimensions based on orientation for word wrap
            const imageData = {
              url: img.url,
              alt: img.variation || 'Article image',
              width: isHero
                ? (img.orientation === 'vertical' ? 400 : 500)  // Hero: narrower for side-by-side
                : (img.orientation === 'landscape' ? 450 : 300), // Body: sized for word wrap
              height: isHero
                ? (img.orientation === 'vertical' ? 600 : 400)  // Hero: taller
                : (img.orientation === 'landscape' ? 300 : 400), // Body: for word wrap
              side: isHero ? heroImageSide : bodySide,
              orientation: img.orientation // Pass through for debugging
            };

            if (isHero && chunked.intro) {
              chunked.intro.imageData = imageData;
            } else if (chunked.chunks[idx - (chunked.intro ? 1 : 0)]) {
              chunked.chunks[idx - (chunked.intro ? 1 : 0)].imageData = imageData;
            }
          });

          imagesFromBank = imagesToUse.length;

          // Mark images as used
          if (imagesToUse.length > 0) {
            const usedIds = new Set(imagesToUse.map(i => i.id));
            const updatedBank = imageBank.map(img => {
              if (usedIds.has(img.id)) {
                return { ...img, used: true, usedOn: keyword, usedAt: new Date().toISOString() };
              }
              return img;
            });

            await sql`
              UPDATE image_creation_settings
              SET image_bank = ${JSON.stringify(updatedBank)}::jsonb,
                  updated_at = CURRENT_TIMESTAMP
              WHERE workflow_id = ${workflowId}
            `;
          }
        }
      } catch (bankError) {
        console.error('Image Bank error (continuing without bank):', bankError);
      }
    }

    // Step 3: Fall back to live generation if needed
    if (generateImages && imagesFromBank < dynamicMaxImages) {
      // Use the image pipeline for remaining images
      const pipelineResult = await processArticleWithImages(cleanedContent, {
        title,
        keyword,
        styleDNA,
        referenceImages,
        openaiApiKey: openaiApiKey || process.env.OPENAI_API_KEY,
        replicateApiKey: replicateApiKey || process.env.REPLICATE_API_TOKEN,
        wpCredentials,
        maxImages: dynamicMaxImages - imagesFromBank,
        maxWords
      });

      // Merge pipeline images with bank images
      if (!chunked.intro?.imageData && pipelineResult.chunks.intro?.imageData) {
        chunked.intro.imageData = pipelineResult.chunks.intro.imageData;
      }
      pipelineResult.chunks.chunks.forEach((pChunk, idx) => {
        if (pChunk.imageData && chunked.chunks[idx] && !chunked.chunks[idx].imageData) {
          chunked.chunks[idx].imageData = pChunk.imageData;
        }
      });

      imagesGenerated = pipelineResult.imagesGenerated || 0;
      estimatedCost = pipelineResult.estimatedCost;
    }

    // Step 4: Extract or use provided title
    const pageTitle = title || extractTitle(cleanedContent) || 'Untitled Page';

    // Step 5: Build Elementor structure
    const elementorData = buildElementorPage(chunked, {
      title: pageTitle,
      includeStatsBar,
      statsBarPosition,
      heroImageSide // Pass hero side for alternating layout
    });

    // Step 6: Get Elementor meta fields
    const elementorMeta = getElementorMetaFields(elementorData);

    // Step 7: Create WordPress page
    const pageResult = await createElementorPage(wpCredentials, {
      title: pageTitle,
      slug,
      elementorMeta,
      status,
      publishDate
    });

    // Step 8: Update article in database if articleId provided
    if (articleId && isDatabaseEnabled()) {
      try {
        if (isManualPush) {
          // Manual push: increment count and append date
          await sql`
            UPDATE articles
            SET wp_post_id = ${pageResult.id},
                wp_post_url = ${pageResult.link},
                wp_published_at = CURRENT_TIMESTAMP,
                status = ${status === 'publish' ? 'published' : 'draft'},
                article_push_manual_count = COALESCE(article_push_manual_count, 0) + 1,
                article_push_manual_dates = COALESCE(article_push_manual_dates, '[]'::jsonb) || to_jsonb(to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${articleId}
          `;
        } else {
          // Auto push: set auto_at timestamp (only if not already set)
          await sql`
            UPDATE articles
            SET wp_post_id = ${pageResult.id},
                wp_post_url = ${pageResult.link},
                wp_published_at = CURRENT_TIMESTAMP,
                status = ${status === 'publish' ? 'published' : 'draft'},
                article_push_auto_at = COALESCE(article_push_auto_at, CURRENT_TIMESTAMP),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${articleId}
          `;
        }
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
      imagesFromBank,
      imagesGenerated,
      totalImages: imagesFromBank + imagesGenerated,
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
