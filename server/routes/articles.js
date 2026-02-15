// Articles API routes (stored outputs with full chain history)
import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';
import { megaImageStatus, trackImagesLoaded, trackApiResponse, banner, log, warning, success, error as logError } from '../services/image-tracker.js';
import chunkContent from '../services/content-chunker.js';
import buildElementorPage, { getElementorMetaFields } from '../services/elementor-builder.js';
import { updatePage, getPage, createElementorPage, uploadMedia } from '../services/wordpress-publisher.js';
import { processArticleWithImages } from '../services/image-pipeline.js';
import { rebuildPage } from '../services/page-rebuild-service.js';

/**
 * Select avatar for a given tag from the audience_avatars array.
 * Matches tag-specific avatars and global avatars that apply to the tag.
 * Randomly selects one if multiple match.
 */
function selectAvatarForTag(avatars, targetTag) {
  if (!avatars || avatars.length === 0) return null;
  if (!targetTag) return avatars[0];

  const matchingAvatars = avatars.filter(avatar => {
    if (avatar.tag === targetTag && !avatar.isGlobal) return true;
    if (avatar.isGlobal && avatar.appliesTo?.includes(targetTag)) return true;
    return false;
  });

  if (matchingAvatars.length === 0) {
    return avatars[0];
  }

  return matchingAvatars[Math.floor(Math.random() * matchingAvatars.length)];
}

/**
 * Fetch image creation settings for a given workflow.
 * Tries website-level settings first, falls back to workflow-level.
 * Returns the config object or null if not found.
 */
async function fetchImageSettings(workflowId) {
  if (!workflowId || !isDatabaseEnabled()) return null;

  // Look up the workflow's associated website_id
  let websiteId = null;
  try {
    const workflowResult = await sql`SELECT website_id FROM workflows WHERE id = ${workflowId}`;
    if (workflowResult.length > 0 && workflowResult[0].website_id) {
      websiteId = workflowResult[0].website_id;
    }
  } catch (err) {
    console.log('[fetchImageSettings] Could not lookup website:', err.message);
  }

  // Try website-level settings first
  let settingsResult = [];
  if (websiteId) {
    try {
      settingsResult = await sql`SELECT * FROM image_creation_settings WHERE website_id = ${websiteId}`;
    } catch (err) {
      console.log('[fetchImageSettings] website_id column not available');
    }
  }

  // Fall back to workflow-level settings
  if (settingsResult.length === 0) {
    settingsResult = await sql`SELECT * FROM image_creation_settings WHERE workflow_id = ${workflowId}`;
  }

  return settingsResult.length > 0 ? settingsResult[0] : null;
}

/**
 * Build pipeline options from image creation settings config and article data.
 */
function buildPipelineOptions(config, article) {
  const keyword = article.keyword || '';
  const tagMatch = keyword.match(/\(([A-Z])\)/i);
  const articleTag = tagMatch ? tagMatch[1].toUpperCase() : null;

  const avatars = config.audience_avatars || [];
  const targetAvatar = selectAvatarForTag(avatars, articleTag);

  const livePromptMode = config.live_prompt_mode || 'main_prompt';
  const smartPromptGuidance = config.smart_prompt_guidance || '';

  // Build guardrails
  const baseGuardrails = config.guided_guardrails || {};
  const perTagDescription = articleTag && config.guided_guardrails_by_tag?.[articleTag]
    ? config.guided_guardrails_by_tag[articleTag]
    : '';
  const guidedGuardrails = perTagDescription ? {
    ...baseGuardrails,
    instructions: `${baseGuardrails.instructions || ''}\n\nContext for this audience (${articleTag}): ${perTagDescription}`.trim()
  } : baseGuardrails;

  const smartMatchingConfig = config.smart_matching_config || { wordRange: 75, primaryWeight: 10, secondaryWeight: 1 };
  const matchPlurals = config.match_plurals !== false;

  return {
    title: keyword.replace(/\s*\([A-Za-z]\)\s*$/, '').trim(),
    keyword,
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    replicateApiKey: process.env.REPLICATE_API_TOKEN,
    maxImages: 4,
    maxWords: 300,
    model: config.image_generation_model || 'gpt-image-1.5',
    quality: config.image_quality || 'low',
    livePromptMode,
    targetAvatar,
    smartPromptGuidance,
    matchPlurals,
    heroImageSide: 'right',
    smartMatchingConfig,
    guidedGuardrails,
    guidedModel: config.guided_model || 'gpt-4o',
    // Persistent prompt portions (shared across ALL tags)
    mainPromptPersistent: config.main_prompt_persistent || '',
    guidedInstructionsPersistent: config.guided_instructions_persistent || '',
    smartPromptPersistent: config.smart_prompt_persistent || ''
  };
}

const router = express.Router();

// Middleware to check database availability
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// GET all articles (with filtering options)
router.get('/', requireDb, async (req, res) => {
  try {
    const { workflowId, websiteId, clientId, status, limit = 50, offset = 0 } = req.query;

    let articles;

    // Build dynamic query based on filters
    if (workflowId) {
      articles = await sql`
        SELECT a.*, w.name as workflow_name, ws.name as website_name, c.name as client_name
        FROM articles a
        LEFT JOIN workflows w ON a.workflow_id = w.id
        LEFT JOIN websites ws ON a.website_id = ws.id
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE a.workflow_id = ${workflowId}
        ORDER BY a.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    } else if (websiteId) {
      articles = await sql`
        SELECT a.*, w.name as workflow_name, ws.name as website_name, c.name as client_name
        FROM articles a
        LEFT JOIN workflows w ON a.workflow_id = w.id
        LEFT JOIN websites ws ON a.website_id = ws.id
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE a.website_id = ${websiteId}
        ORDER BY a.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    } else if (clientId) {
      articles = await sql`
        SELECT a.*, w.name as workflow_name, ws.name as website_name, c.name as client_name
        FROM articles a
        LEFT JOIN workflows w ON a.workflow_id = w.id
        LEFT JOIN websites ws ON a.website_id = ws.id
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE a.client_id = ${clientId}
        ORDER BY a.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    } else if (status) {
      articles = await sql`
        SELECT a.*, w.name as workflow_name, ws.name as website_name, c.name as client_name
        FROM articles a
        LEFT JOIN workflows w ON a.workflow_id = w.id
        LEFT JOIN websites ws ON a.website_id = ws.id
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE a.status = ${status}
        ORDER BY a.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    } else {
      articles = await sql`
        SELECT a.*, w.name as workflow_name, ws.name as website_name, c.name as client_name
        FROM articles a
        LEFT JOIN workflows w ON a.workflow_id = w.id
        LEFT JOIN websites ws ON a.website_id = ws.id
        LEFT JOIN clients c ON a.client_id = c.id
        ORDER BY a.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    }

    // Get total count for pagination
    const countResult = await sql`SELECT COUNT(*) as total FROM articles`;
    const total = parseInt(countResult[0].total);

    res.json({ articles, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single article with full details
router.get('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    banner(`FETCHING ARTICLE ${id}`);

    const articles = await sql`
      SELECT a.*, w.name as workflow_name, w.state as workflow_state,
             ws.name as website_name, c.name as client_name,
             ws.wp_url, ws.wp_user, ws.wp_app_password, ws.seo_plugin,
             ws.elementor_cta_text, ws.elementor_cta_url
      FROM articles a
      LEFT JOIN workflows w ON a.workflow_id = w.id
      LEFT JOIN websites ws ON a.website_id = ws.id
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE a.id = ${id}
    `;

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = articles[0];

    // 🔍 CREDENTIAL FALLBACK: If website credentials are missing, try workflow credentials
    // Following Golden Rule #8: Settings hierarchy - website_id FIRST, then workflow_id
    if (!article.wp_url || !article.wp_user || !article.wp_app_password) {
      try {
        const workflowState = article.workflow_state ?
          (typeof article.workflow_state === 'string' ? JSON.parse(article.workflow_state) : article.workflow_state)
          : null;

        if (workflowState?.wpCredentials) {
          const wfCreds = workflowState.wpCredentials;
          // Only fill in missing values, don't overwrite existing website-level credentials
          if (!article.wp_url && wfCreds.url) {
            article.wp_url = wfCreds.url;
          }
          if (!article.wp_user && wfCreds.user) {
            article.wp_user = wfCreds.user;
          }
          if (!article.wp_app_password && wfCreds.password) {
            article.wp_app_password = wfCreds.password;
          }
          console.log(`[Article ${id}] Using workflow-level WordPress credentials as fallback`);
        }
      } catch (parseError) {
        console.error(`[Article ${id}] Failed to parse workflow_state for credential fallback:`, parseError);
      }
    }

    // 🔍 MEGA IMAGE STATUS CHECK - See EVERYTHING about images for this article
    megaImageStatus(id, article);

    // Track what images we're loading
    trackImagesLoaded('GET /api/articles/:id', article.generated_images, { articleId: id });

    // Track the full API response
    trackApiResponse('GET /api/articles/:id', { article }, { articleId: id });

    res.json({ article });
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET article version history
router.get('/:id/history', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the article first
    const articles = await sql`SELECT * FROM articles WHERE id = ${id}`;
    if (articles.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = articles[0];

    // Find all versions (go up to parent, then find all children)
    let rootId = article.id;
    let current = article;

    // Find the root (first version)
    while (current.parent_article_id) {
      const parent = await sql`SELECT * FROM articles WHERE id = ${current.parent_article_id}`;
      if (parent.length > 0) {
        current = parent[0];
        rootId = current.id;
      } else {
        break;
      }
    }

    // Now get all versions starting from root
    const allVersions = await sql`
      WITH RECURSIVE version_tree AS (
        SELECT *, 1 as depth FROM articles WHERE id = ${rootId}
        UNION ALL
        SELECT a.*, vt.depth + 1
        FROM articles a
        JOIN version_tree vt ON a.parent_article_id = vt.id
      )
      SELECT * FROM version_tree ORDER BY version ASC
    `;

    res.json({ versions: allVersions, currentId: parseInt(id) });
  } catch (error) {
    console.error('Error fetching article history:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new article (when workflow generates output)
router.post('/', requireDb, async (req, res) => {
  try {
    const {
      workflowId,
      websiteId,
      clientId,
      keyword,
      tag,
      finalContent,
      metaTitles,
      metaDescriptions,
      chainOutputs,
      aiScore,
      wordCount,
      status
    } = req.body;

    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

    const result = await sql`
      INSERT INTO articles (
        workflow_id, website_id, client_id,
        keyword, tag,
        final_content, meta_titles, meta_descriptions,
        chain_outputs,
        ai_score, word_count, status
      )
      VALUES (
        ${workflowId || null},
        ${websiteId || null},
        ${clientId || null},
        ${keyword},
        ${tag || null},
        ${finalContent || null},
        ${JSON.stringify(metaTitles || [])},
        ${JSON.stringify(metaDescriptions || [])},
        ${JSON.stringify(chainOutputs || {})},
        ${aiScore || null},
        ${wordCount || null},
        ${status || 'generated'}
      )
      RETURNING *
    `;

    res.status(201).json({ article: result[0] });
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new version of article (for edits)
router.post('/:id/new-version', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { finalContent, metaTitles, metaDescriptions } = req.body;

    // Get the original article
    const original = await sql`SELECT * FROM articles WHERE id = ${id}`;
    if (original.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const parentArticle = original[0];
    const newVersion = parentArticle.version + 1;

    const result = await sql`
      INSERT INTO articles (
        workflow_id, website_id, client_id,
        keyword, tag,
        final_content, meta_titles, meta_descriptions,
        chain_outputs,
        ai_score, word_count, status,
        version, parent_article_id
      )
      VALUES (
        ${parentArticle.workflow_id},
        ${parentArticle.website_id},
        ${parentArticle.client_id},
        ${parentArticle.keyword},
        ${parentArticle.tag},
        ${finalContent || parentArticle.final_content},
        ${JSON.stringify(metaTitles || parentArticle.meta_titles)},
        ${JSON.stringify(metaDescriptions || parentArticle.meta_descriptions)},
        ${JSON.stringify(parentArticle.chain_outputs)},
        ${parentArticle.ai_score},
        ${parentArticle.word_count},
        'edited',
        ${newVersion},
        ${id}
      )
      RETURNING *
    `;

    res.status(201).json({ article: result[0] });
  } catch (error) {
    console.error('Error creating article version:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update article (for inline edits without creating new version)
router.put('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { finalContent, metaTitles, metaDescriptions, status, selectedMetaTitle, selectedMetaDescription } = req.body;

    const result = await sql`
      UPDATE articles
      SET final_content = COALESCE(${finalContent}, final_content),
          meta_titles = COALESCE(${metaTitles ? JSON.stringify(metaTitles) : null}, meta_titles),
          meta_descriptions = COALESCE(${metaDescriptions ? JSON.stringify(metaDescriptions) : null}, meta_descriptions),
          selected_meta_title = COALESCE(${selectedMetaTitle}, selected_meta_title),
          selected_meta_description = COALESCE(${selectedMetaDescription}, selected_meta_description),
          status = COALESCE(${status}, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ article: result[0] });
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH update WordPress publish status
router.patch('/:id/wp-status', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { wpPostId, wpPostUrl, status } = req.body;

    // Use conditional SQL to set wp_published_at only when wpPostId is provided
    let result;
    if (wpPostId) {
      result = await sql`
        UPDATE articles
        SET wp_post_id = ${wpPostId},
            wp_post_url = ${wpPostUrl || null},
            wp_published_at = CURRENT_TIMESTAMP,
            status = ${status || 'published'},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    } else {
      result = await sql`
        UPDATE articles
        SET wp_post_id = NULL,
            wp_post_url = ${wpPostUrl || null},
            wp_published_at = NULL,
            status = ${status || 'published'},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ article: result[0] });
  } catch (error) {
    console.error('Error updating article WP status:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE article
router.delete('/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM articles WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ deleted: result[0] });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET articles by keyword search
router.get('/search/:keyword', requireDb, async (req, res) => {
  try {
    const { keyword } = req.params;
    const { websiteId, clientId } = req.query;

    let articles;
    if (websiteId) {
      articles = await sql`
        SELECT a.*, w.name as workflow_name, ws.name as website_name
        FROM articles a
        LEFT JOIN workflows w ON a.workflow_id = w.id
        LEFT JOIN websites ws ON a.website_id = ws.id
        WHERE a.keyword ILIKE ${'%' + keyword + '%'} AND a.website_id = ${websiteId}
        ORDER BY a.created_at DESC
      `;
    } else if (clientId) {
      articles = await sql`
        SELECT a.*, w.name as workflow_name, ws.name as website_name
        FROM articles a
        LEFT JOIN workflows w ON a.workflow_id = w.id
        LEFT JOIN websites ws ON a.website_id = ws.id
        WHERE a.keyword ILIKE ${'%' + keyword + '%'} AND a.client_id = ${clientId}
        ORDER BY a.created_at DESC
      `;
    } else {
      articles = await sql`
        SELECT a.*, w.name as workflow_name, ws.name as website_name
        FROM articles a
        LEFT JOIN workflows w ON a.workflow_id = w.id
        LEFT JOIN websites ws ON a.website_id = ws.id
        WHERE a.keyword ILIKE ${'%' + keyword + '%'}
        ORDER BY a.created_at DESC
      `;
    }

    res.json({ articles });
  } catch (error) {
    console.error('Error searching articles:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST push images to WordPress media library
router.post('/:articleId/push-images', requireDb, async (req, res) => {
  try {
    const { articleId } = req.params;
    const { wpUrl, wpUser, wpPassword } = req.body;

    console.log('[Push Images] ========== STARTING ==========');
    console.log('[Push Images] Article ID:', articleId);
    console.log('[Push Images] Target WP:', wpUrl);

    if (!wpUrl || !wpUser || !wpPassword) {
      console.log('[Push Images] ❌ Missing credentials - aborting');
      return res.status(400).json({ error: 'Missing WordPress credentials' });
    }

    // Get article with images from database
    const articles = await sql`SELECT * FROM articles WHERE id = ${articleId}`;
    if (articles.length === 0) {
      console.log('[Push Images] ❌ Article not found');
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = articles[0];
    const images = article.generated_images || [];

    console.log('[Push Images] Found', images.length, 'images in article');

    if (images.length === 0) {
      console.log('[Push Images] ❌ No images to push - aborting');
      return res.status(400).json({ error: 'No images to push' });
    }

    const results = [];
    const updatedImages = [];

    for (const image of images) {
      try {
        // Skip if already pushed
        if (image.pushedToWp && image.wpMediaId) {
          updatedImages.push(image);
          results.push({ id: image.id, status: 'skipped', wpMediaId: image.wpMediaId });
          continue;
        }

        // Fetch the image data
        let imageBuffer;
        if (image.url.startsWith('data:')) {
          // Base64 data URL
          const base64Data = image.url.replace(/^data:image\/\w+;base64,/, '');
          imageBuffer = Buffer.from(base64Data, 'base64');
        } else {
          // Remote URL - fetch it
          const imageRes = await fetch(image.url);
          const arrayBuffer = await imageRes.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
        }

        // Upload to WordPress
        const filename = `article-${articleId}-${image.id}.png`;
        const wpMediaUrl = `${wpUrl}/wp-json/wp/v2/media`;
        const auth = Buffer.from(`${wpUser}:${wpPassword}`).toString('base64');

        const uploadRes = await fetch(wpMediaUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Type': 'image/png'
          },
          body: imageBuffer
        });

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();
          console.error(`[Push Images] Failed to upload ${image.id}:`, errorText);
          updatedImages.push({ ...image, pushedToWp: false });
          results.push({ id: image.id, status: 'failed', error: errorText });
          continue;
        }

        const mediaData = await uploadRes.json();

        // Update image with WordPress media ID
        updatedImages.push({
          ...image,
          pushedToWp: true,
          wpMediaId: mediaData.id,
          wpMediaUrl: mediaData.source_url
        });
        results.push({ id: image.id, status: 'success', wpMediaId: mediaData.id });

      } catch (imgError) {
        console.error(`[Push Images] Error processing ${image.id}:`, imgError.message);
        updatedImages.push({ ...image, pushedToWp: false });
        results.push({ id: image.id, status: 'failed', error: imgError.message });
      }
    }

    // Update article with new image data
    await sql`
      UPDATE articles
      SET generated_images = ${JSON.stringify(updatedImages)},
          images_wp_pushed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${articleId}
    `;

    const successCount = results.filter(r => r.status === 'success').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    console.log('[Push Images] ========== COMPLETE ==========');
    console.log('[Push Images] ✅ Success:', successCount);
    console.log('[Push Images] ⏭️ Skipped:', skippedCount);
    console.log('[Push Images] ❌ Failed:', failedCount);

    // If article has a WP page, RE-CREATE it with images using shared rebuild service
    // WordPress/Elementor can't reliably update _elementor_data via REST API,
    // so rebuild = delete old page → create new page with same slug
    let pageUpdated = false;
    let newPageResult = null;
    if (article.wp_post_id && article.final_content && updatedImages.length > 0) {
      try {
        console.log('[Push Images] Re-creating page with images via rebuildPage()...');
        const wpCredentials = { url: wpUrl, user: wpUser, password: wpPassword };

        // Fetch template styles for rebuild
        let templateStyles = null;
        if (article.workflow_id) {
          try {
            const [styleRecord] = await sql`
              SELECT extracted_styles
              FROM workflow_elementor_styles
              WHERE workflow_id = ${article.workflow_id}
                AND status = 'active'
              LIMIT 1
            `;
            if (styleRecord?.extracted_styles) {
              templateStyles = styleRecord.extracted_styles;
            }
          } catch (styleErr) {
            console.warn('[Push Images] Could not fetch template styles:', styleErr.message);
          }
        }

        // Re-read article from DB with updated images
        const [freshArticle] = await sql`SELECT * FROM articles WHERE id = ${articleId}`;

        const rebuildResult = await rebuildPage(freshArticle, wpCredentials, {
          images: updatedImages,
          templateStyles
        });

        pageUpdated = true;
        newPageResult = { id: rebuildResult.newPageId, link: null };

        // Fetch URL of the new page
        try {
          const newPage = await getPage(wpCredentials, rebuildResult.newPageId);
          newPageResult.link = newPage.link;
        } catch (linkErr) {
          console.warn('[Push Images] Could not fetch new page URL:', linkErr.message);
        }

        console.log('[Push Images] Page rebuilt via shared service, new page ID:', rebuildResult.newPageId);
      } catch (updateError) {
        console.error('[Push Images] Error re-creating page:', updateError.message);
      }
    }

    res.json({
      success: true,
      pushed: successCount,
      skipped: skippedCount,
      pageUpdated,
      newPageId: newPageResult?.id || null,
      newPageUrl: newPageResult?.link || null,
      message: `${successCount} images uploaded, ${skippedCount} skipped${pageUpdated ? ', page re-created with images' : ''}`,
      results
    });

  } catch (error) {
    console.error('[Push Images] ❌ ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST regenerate a single image for an article
router.post('/:articleId/regenerate-image', requireDb, async (req, res) => {
  try {
    const { articleId } = req.params;
    const { imageId, prompt, workflowId } = req.body;

    if (!articleId || !imageId || !prompt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get current article
    const articles = await sql`SELECT * FROM articles WHERE id = ${articleId}`;
    if (articles.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = articles[0];
    const currentImages = article.generated_images || [];
    const imageIndex = currentImages.findIndex(img => img.id === imageId);

    if (imageIndex === -1) {
      return res.status(404).json({ error: 'Image not found in article' });
    }

    // Get workflow's image generation settings
    let imageModel = 'gpt-image-1.5';
    let apiKey = process.env.OPENAI_API_KEY;

    if (workflowId) {
      const settings = await sql`
        SELECT image_generation_model FROM image_creation_settings WHERE workflow_id = ${workflowId}
      `;
      if (settings.length > 0 && settings[0].image_generation_model) {
        imageModel = settings[0].image_generation_model;
      }
    }

    // Generate new image using OpenAI
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey });

    console.log(`[Regenerate Image] Generating with ${imageModel}: ${prompt.substring(0, 50)}...`);

    const response = await openai.images.generate({
      model: imageModel.startsWith('gpt-image') ? imageModel : 'gpt-image-1.5',
      prompt: prompt,
      n: 1,
      size: '1024x1536',
      quality: 'low'
    });

    // Handle response format - upload to WordPress instead of storing base64
    let imageUrl;
    let wpMediaId = null;

    if (response.data[0].b64_json) {
      const base64Data = response.data[0].b64_json;

      // Get staging WordPress credentials to upload the image
      const stagingResult = await sql`
        SELECT staging_wp_url, staging_wp_user, staging_wp_password
        FROM global_settings WHERE id = 1
      `;

      if (stagingResult.length > 0 && stagingResult[0].staging_wp_url) {
        const { staging_wp_url, staging_wp_user, staging_wp_password } = stagingResult[0];
        const filename = `regenerated-${imageId}-${Date.now()}.png`;

        try {
          console.log(`[Regenerate Image] Uploading to WordPress: ${filename}`);
          const wpResult = await uploadMedia(
            { url: staging_wp_url, user: staging_wp_user, password: staging_wp_password },
            base64Data,
            filename,
            { alt: prompt.substring(0, 100) }
          );

          if (wpResult && wpResult.url) {
            imageUrl = wpResult.url;
            wpMediaId = wpResult.id;
            console.log(`[Regenerate Image] ✓ Uploaded to WP: ${wpResult.url}`);
          } else {
            // Fallback to base64 if upload fails
            imageUrl = `data:image/png;base64,${base64Data}`;
            console.log(`[Regenerate Image] ⚠️ WP upload returned no URL, using base64`);
          }
        } catch (uploadError) {
          console.error(`[Regenerate Image] ⚠️ WP upload failed:`, uploadError.message);
          imageUrl = `data:image/png;base64,${base64Data}`;
        }
      } else {
        // No staging credentials - fallback to base64
        imageUrl = `data:image/png;base64,${base64Data}`;
        console.log(`[Regenerate Image] ⚠️ No staging credentials, using base64`);
      }
    } else if (response.data[0].url) {
      imageUrl = response.data[0].url;
    }

    if (!imageUrl) {
      return res.status(500).json({ error: 'Image generation returned no data' });
    }

    // Update the image in the array
    const oldImage = currentImages[imageIndex];
    currentImages[imageIndex] = {
      ...oldImage,
      url: imageUrl,
      createdAt: new Date().toISOString(),
      pushedToWp: !!wpMediaId,
      wpMediaId: wpMediaId || undefined
    };

    // Save to database
    await sql`
      UPDATE articles
      SET generated_images = ${JSON.stringify(currentImages)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${articleId}
    `;

    res.json({
      success: true,
      image: currentImages[imageIndex]
    });

  } catch (error) {
    console.error('[Regenerate Image] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST generate images for an article that has content but no images
// Use case: Article was published without images, now image prompts are ready
router.post('/:articleId/generate-images', requireDb, async (req, res) => {
  try {
    const { articleId } = req.params;
    const { workflowId } = req.body;

    console.log(`[Generate Images] Starting for article ${articleId}`);

    // 1. Fetch article
    const articles = await sql`SELECT * FROM articles WHERE id = ${articleId}`;
    if (articles.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = articles[0];

    if (!article.final_content) {
      return res.status(400).json({ error: 'Article has no content to generate images for' });
    }

    // Check if article already has images (use regenerate-all-images for replacement)
    const existingImages = article.generated_images || [];
    if (Array.isArray(existingImages) && existingImages.length > 0) {
      return res.status(400).json({ error: 'Article already has images. Use regenerate-all-images to replace them.' });
    }

    // 2. Fetch image settings
    const effectiveWorkflowId = workflowId || article.workflow_id;
    const config = await fetchImageSettings(effectiveWorkflowId);
    if (!config) {
      return res.status(400).json({ error: 'No image creation settings found for this workflow/website' });
    }

    // 3. Build pipeline options
    const pipelineOptions = buildPipelineOptions(config, article);

    console.log(`[Generate Images] Pipeline options: model=${pipelineOptions.model}, mode=${pipelineOptions.livePromptMode}, avatar=${pipelineOptions.targetAvatar?.name || 'none'}`);

    // 4. Get WP credentials for uploading images to WordPress
    // Try to get from article's website first
    let wpCredentials = null;
    if (article.website_id) {
      const websiteResult = await sql`SELECT wp_url, wp_user, wp_app_password FROM websites WHERE id = ${article.website_id}`;
      if (websiteResult.length > 0 && websiteResult[0].wp_url) {
        wpCredentials = {
          url: websiteResult[0].wp_url,
          user: websiteResult[0].wp_user,
          password: websiteResult[0].wp_app_password
        };
      }
    }

    // Fall back to staging credentials if no website credentials
    if (!wpCredentials) {
      const stagingResult = await sql`SELECT staging_wp_url, staging_wp_user, staging_wp_password FROM global_settings WHERE id = 1`;
      if (stagingResult.length > 0 && stagingResult[0].staging_wp_url) {
        wpCredentials = {
          url: stagingResult[0].staging_wp_url,
          user: stagingResult[0].staging_wp_user,
          password: stagingResult[0].staging_wp_password
        };
      }
    }

    // Pass WP credentials to pipeline so images upload during generation
    pipelineOptions.wpCredentials = wpCredentials;

    // 5. Run image pipeline
    const pipelineResult = await processArticleWithImages(article.final_content, pipelineOptions);

    // 6. Extract images from pipeline result and build generated_images array
    const generatedImages = [];
    let imageIndex = 0;

    // Hero image from intro
    if (pipelineResult.chunks.intro?.imageData) {
      const imgData = pipelineResult.chunks.intro.imageData;
      generatedImages.push({
        id: `img-${Date.now()}-hero`,
        url: imgData.wpUrl || imgData.url,
        prompt: pipelineResult.chunks.intro.imagePrompt || '',
        placement: 'hero',
        side: imgData.side || 'right',
        wpMediaId: imgData.wpMediaId || null,
        wpMediaUrl: imgData.wpUrl || null,
        pushedToWp: !!imgData.wpMediaId,
        createdAt: new Date().toISOString()
      });
      imageIndex++;
    }

    // Section images from chunks
    if (pipelineResult.chunks.chunks) {
      pipelineResult.chunks.chunks.forEach((chunk, idx) => {
        if (chunk.imageData) {
          const imgData = chunk.imageData;
          generatedImages.push({
            id: `img-${Date.now()}-section-${idx + 1}`,
            url: imgData.wpUrl || imgData.url,
            prompt: chunk.imagePrompt || '',
            placement: `section-${idx + 1}`,
            side: imgData.side || (idx % 2 === 0 ? 'left' : 'right'),
            wpMediaId: imgData.wpMediaId || null,
            wpMediaUrl: imgData.wpUrl || null,
            pushedToWp: !!imgData.wpMediaId,
            createdAt: new Date().toISOString()
          });
          imageIndex++;
        }
      });
    }

    console.log(`[Generate Images] Generated ${generatedImages.length} images`);

    // 7. Save to article (intentionally setting generated_images)
    await sql`
      UPDATE articles
      SET generated_images = ${JSON.stringify(generatedImages)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${articleId}
    `;

    res.json({
      success: true,
      images: generatedImages,
      imagesGenerated: generatedImages.length,
      message: `Generated ${generatedImages.length} images for article`
    });

  } catch (error) {
    console.error('[Generate Images] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST regenerate ALL images for an article (replace existing images with fresh set)
// Use case: Better prompts discovered, want to replace all images
router.post('/:articleId/regenerate-all-images', requireDb, async (req, res) => {
  try {
    const { articleId } = req.params;
    const { workflowId } = req.body;

    console.log(`[Regenerate All Images] Starting for article ${articleId}`);

    // 1. Fetch article
    const articles = await sql`SELECT * FROM articles WHERE id = ${articleId}`;
    if (articles.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = articles[0];

    if (!article.final_content) {
      return res.status(400).json({ error: 'Article has no content to generate images for' });
    }

    // 2. Fetch image settings
    const effectiveWorkflowId = workflowId || article.workflow_id;
    const config = await fetchImageSettings(effectiveWorkflowId);
    if (!config) {
      return res.status(400).json({ error: 'No image creation settings found for this workflow/website' });
    }

    // 3. Build pipeline options
    const pipelineOptions = buildPipelineOptions(config, article);

    console.log(`[Regenerate All Images] Pipeline options: model=${pipelineOptions.model}, mode=${pipelineOptions.livePromptMode}, forceReplace=true`);

    // 4. Get WP credentials
    let wpCredentials = null;
    if (article.website_id) {
      const websiteResult = await sql`SELECT wp_url, wp_user, wp_app_password FROM websites WHERE id = ${article.website_id}`;
      if (websiteResult.length > 0 && websiteResult[0].wp_url) {
        wpCredentials = {
          url: websiteResult[0].wp_url,
          user: websiteResult[0].wp_user,
          password: websiteResult[0].wp_app_password
        };
      }
    }

    if (!wpCredentials) {
      const stagingResult = await sql`SELECT staging_wp_url, staging_wp_user, staging_wp_password FROM global_settings WHERE id = 1`;
      if (stagingResult.length > 0 && stagingResult[0].staging_wp_url) {
        wpCredentials = {
          url: stagingResult[0].staging_wp_url,
          user: stagingResult[0].staging_wp_user,
          password: stagingResult[0].staging_wp_password
        };
      }
    }

    pipelineOptions.wpCredentials = wpCredentials;

    // 5. Run image pipeline (generates completely new set)
    const pipelineResult = await processArticleWithImages(article.final_content, pipelineOptions);

    // 6. Extract images from pipeline result
    const generatedImages = [];

    if (pipelineResult.chunks.intro?.imageData) {
      const imgData = pipelineResult.chunks.intro.imageData;
      generatedImages.push({
        id: `img-${Date.now()}-hero`,
        url: imgData.wpUrl || imgData.url,
        prompt: pipelineResult.chunks.intro.imagePrompt || '',
        placement: 'hero',
        side: imgData.side || 'right',
        wpMediaId: imgData.wpMediaId || null,
        wpMediaUrl: imgData.wpUrl || null,
        pushedToWp: !!imgData.wpMediaId,
        createdAt: new Date().toISOString()
      });
    }

    if (pipelineResult.chunks.chunks) {
      pipelineResult.chunks.chunks.forEach((chunk, idx) => {
        if (chunk.imageData) {
          const imgData = chunk.imageData;
          generatedImages.push({
            id: `img-${Date.now()}-section-${idx + 1}`,
            url: imgData.wpUrl || imgData.url,
            prompt: chunk.imagePrompt || '',
            placement: `section-${idx + 1}`,
            side: imgData.side || (idx % 2 === 0 ? 'left' : 'right'),
            wpMediaId: imgData.wpMediaId || null,
            wpMediaUrl: imgData.wpUrl || null,
            pushedToWp: !!imgData.wpMediaId,
            createdAt: new Date().toISOString()
          });
        }
      });
    }

    console.log(`[Regenerate All Images] Generated ${generatedImages.length} new images (replacing old set)`);

    // 7. Save to article — INTENTIONAL overwrite with forceReplace pattern
    // Old images preserved in WP Media Library (not deleted)
    await sql`
      UPDATE articles
      SET generated_images = ${JSON.stringify(generatedImages)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${articleId}
    `;

    res.json({
      success: true,
      images: generatedImages,
      imagesGenerated: generatedImages.length,
      message: `Regenerated ${generatedImages.length} images (old images preserved in WP Media Library)`
    });

  } catch (error) {
    console.error('[Regenerate All Images] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST bulk generate images for multiple articles in a workflow
// Supports SSE for progress reporting
router.post('/bulk-generate-images', requireDb, async (req, res) => {
  try {
    const { workflowId, websiteId, mode = 'missing', articleIds } = req.body;
    // mode: 'missing' (only articles without images) or 'all' (regenerate everything)

    if (!workflowId && !websiteId && !articleIds) {
      return res.status(400).json({ error: 'Must provide workflowId, websiteId, or articleIds' });
    }

    console.log(`[Bulk Generate Images] mode=${mode}, workflowId=${workflowId}, websiteId=${websiteId}`);

    // Set up SSE for progress reporting
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const sendProgress = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // 1. Fetch articles based on filters
    let articles;
    if (articleIds && Array.isArray(articleIds) && articleIds.length > 0) {
      articles = await sql`SELECT * FROM articles WHERE id = ANY(${articleIds})`;
    } else if (workflowId) {
      if (mode === 'missing') {
        articles = await sql`
          SELECT * FROM articles
          WHERE workflow_id = ${workflowId}
            AND final_content IS NOT NULL
            AND (generated_images IS NULL OR generated_images = '[]' OR generated_images = 'null')
          ORDER BY created_at ASC
        `;
      } else {
        articles = await sql`
          SELECT * FROM articles
          WHERE workflow_id = ${workflowId}
            AND final_content IS NOT NULL
          ORDER BY created_at ASC
        `;
      }
    } else if (websiteId) {
      if (mode === 'missing') {
        articles = await sql`
          SELECT * FROM articles
          WHERE website_id = ${websiteId}
            AND final_content IS NOT NULL
            AND (generated_images IS NULL OR generated_images = '[]' OR generated_images = 'null')
          ORDER BY created_at ASC
        `;
      } else {
        articles = await sql`
          SELECT * FROM articles
          WHERE website_id = ${websiteId}
            AND final_content IS NOT NULL
          ORDER BY created_at ASC
        `;
      }
    }

    if (!articles || articles.length === 0) {
      sendProgress({ type: 'complete', total: 0, succeeded: 0, failed: 0, message: 'No articles found matching criteria' });
      res.end();
      return;
    }

    // 2. Fetch image settings (once, shared across all articles)
    const effectiveWorkflowId = workflowId || articles[0].workflow_id;
    const config = await fetchImageSettings(effectiveWorkflowId);
    if (!config) {
      sendProgress({ type: 'error', message: 'No image creation settings found for this workflow/website' });
      res.end();
      return;
    }

    // 3. Get WP credentials
    let wpCredentials = null;
    const effectiveWebsiteId = websiteId || articles[0].website_id;
    if (effectiveWebsiteId) {
      const websiteResult = await sql`SELECT wp_url, wp_user, wp_app_password FROM websites WHERE id = ${effectiveWebsiteId}`;
      if (websiteResult.length > 0 && websiteResult[0].wp_url) {
        wpCredentials = {
          url: websiteResult[0].wp_url,
          user: websiteResult[0].wp_user,
          password: websiteResult[0].wp_app_password
        };
      }
    }

    if (!wpCredentials) {
      const stagingResult = await sql`SELECT staging_wp_url, staging_wp_user, staging_wp_password FROM global_settings WHERE id = 1`;
      if (stagingResult.length > 0 && stagingResult[0].staging_wp_url) {
        wpCredentials = {
          url: stagingResult[0].staging_wp_url,
          user: stagingResult[0].staging_wp_user,
          password: stagingResult[0].staging_wp_password
        };
      }
    }

    const total = articles.length;
    let succeeded = 0;
    let failed = 0;
    const errors = [];

    sendProgress({ type: 'start', total, mode });

    // 4. Process articles SEQUENTIALLY (API rate limits)
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];

      sendProgress({
        type: 'progress',
        current: i + 1,
        total,
        articleId: article.id,
        keyword: article.keyword,
        succeeded,
        failed
      });

      try {
        // Build per-article pipeline options
        const pipelineOptions = buildPipelineOptions(config, article);
        pipelineOptions.wpCredentials = wpCredentials;

        // Run pipeline
        const pipelineResult = await processArticleWithImages(article.final_content, pipelineOptions);

        // Extract images
        const generatedImages = [];

        if (pipelineResult.chunks.intro?.imageData) {
          const imgData = pipelineResult.chunks.intro.imageData;
          generatedImages.push({
            id: `img-${Date.now()}-hero`,
            url: imgData.wpUrl || imgData.url,
            prompt: pipelineResult.chunks.intro.imagePrompt || '',
            placement: 'hero',
            side: imgData.side || 'right',
            wpMediaId: imgData.wpMediaId || null,
            wpMediaUrl: imgData.wpUrl || null,
            pushedToWp: !!imgData.wpMediaId,
            createdAt: new Date().toISOString()
          });
        }

        if (pipelineResult.chunks.chunks) {
          pipelineResult.chunks.chunks.forEach((chunk, idx) => {
            if (chunk.imageData) {
              const imgData = chunk.imageData;
              generatedImages.push({
                id: `img-${Date.now()}-section-${idx + 1}`,
                url: imgData.wpUrl || imgData.url,
                prompt: chunk.imagePrompt || '',
                placement: `section-${idx + 1}`,
                side: imgData.side || (idx % 2 === 0 ? 'left' : 'right'),
                wpMediaId: imgData.wpMediaId || null,
                wpMediaUrl: imgData.wpUrl || null,
                pushedToWp: !!imgData.wpMediaId,
                createdAt: new Date().toISOString()
              });
            }
          });
        }

        // Save to article
        await sql`
          UPDATE articles
          SET generated_images = ${JSON.stringify(generatedImages)},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${article.id}
        `;

        succeeded++;
        sendProgress({
          type: 'article_complete',
          current: i + 1,
          total,
          articleId: article.id,
          keyword: article.keyword,
          imagesGenerated: generatedImages.length,
          succeeded,
          failed
        });

      } catch (articleError) {
        failed++;
        const errorMsg = `Article ${article.id} (${article.keyword}): ${articleError.message}`;
        errors.push(errorMsg);
        console.error(`[Bulk Generate Images] ${errorMsg}`);

        sendProgress({
          type: 'article_error',
          current: i + 1,
          total,
          articleId: article.id,
          keyword: article.keyword,
          error: articleError.message,
          succeeded,
          failed
        });
      }
    }

    // 5. Send completion
    sendProgress({
      type: 'complete',
      total,
      succeeded,
      failed,
      errors,
      message: `Bulk image generation complete: ${succeeded}/${total} succeeded, ${failed} failed`
    });
    res.end();

  } catch (error) {
    console.error('[Bulk Generate Images] Error:', error);
    // If SSE headers already sent, send error event
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    } catch (writeError) {
      res.status(500).json({ error: error.message });
    }
  }
});

// POST push meta title and description to WordPress
router.post('/:articleId/push-meta', requireDb, async (req, res) => {
  try {
    const { articleId } = req.params;
    const { wpUrl, wpUser, wpPassword, wpPostId, metaTitle, metaDescription } = req.body;

    if (!wpUrl || !wpUser || !wpPassword || !wpPostId) {
      return res.status(400).json({ error: 'Missing WordPress credentials or post ID' });
    }

    if (!metaTitle && !metaDescription) {
      return res.status(400).json({ error: 'No meta data to push' });
    }

    // Build the update payload for Yoast SEO
    const updatePayload = {};
    if (metaTitle) {
      updatePayload.yoast_head_json = updatePayload.yoast_head_json || {};
      updatePayload.meta = updatePayload.meta || {};
      updatePayload.meta._yoast_wpseo_title = metaTitle;
    }
    if (metaDescription) {
      updatePayload.meta = updatePayload.meta || {};
      updatePayload.meta._yoast_wpseo_metadesc = metaDescription;
    }

    // Also try updating the standard excerpt as fallback
    if (metaDescription) {
      updatePayload.excerpt = metaDescription;
    }

    const auth = Buffer.from(`${wpUser}:${wpPassword}`).toString('base64');

    // Try pages first (Elementor creates pages), then fall back to posts
    let wpApiUrl = `${wpUrl.replace(/\/$/, '')}/wp-json/wp/v2/pages/${wpPostId}`;

    console.log('[Push Meta] Trying pages endpoint:', wpApiUrl);

    let updateRes = await fetch(wpApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    });

    // If pages fails with 404, try posts
    if (!updateRes.ok && updateRes.status === 404) {
      console.log('[Push Meta] Pages failed, trying posts endpoint...');
      wpApiUrl = `${wpUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts/${wpPostId}`;

      updateRes = await fetch(wpApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });
    }

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      console.error('[Push Meta] WordPress API error:', errorText);
      return res.status(updateRes.status).json({ error: `WordPress error: ${errorText}` });
    }

    // Update article with selected meta and mark as pushed to WP
    await sql`
      UPDATE articles
      SET selected_meta_title = ${metaTitle || null},
          selected_meta_description = ${metaDescription || null},
          meta_wp_pushed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${articleId}
    `;

    res.json({
      success: true,
      message: 'Meta data pushed to WordPress'
    });

  } catch (error) {
    console.error('[Push Meta] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST regenerate meta titles and/or descriptions for an article
// Uses the article's final_content + keyword to generate fresh options via LLM
router.post('/:articleId/regenerate-meta', requireDb, async (req, res) => {
  try {
    const { articleId } = req.params;
    const { titleCount = 0, descriptionCount = 0 } = req.body;

    console.log(`[Regenerate Meta] Article ${articleId}: titles=${titleCount}, descriptions=${descriptionCount}`);

    if (titleCount === 0 && descriptionCount === 0) {
      return res.status(400).json({ error: 'Set at least one count above 0' });
    }

    if (titleCount > 5 || descriptionCount > 5) {
      return res.status(400).json({ error: 'Maximum 5 options per field' });
    }

    // 1. Fetch article
    const articles = await sql`SELECT * FROM articles WHERE id = ${articleId}`;
    if (articles.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = articles[0];
    if (!article.final_content) {
      return res.status(400).json({ error: 'Article has no content to generate meta from' });
    }

    // 2. Build a focused meta-generation prompt
    // Use first ~500 words of content for context (enough for meta, saves tokens)
    const contentPreview = article.final_content.split(/\s+/).slice(0, 500).join(' ');
    const keyword = article.keyword || 'the topic';

    let promptParts = [];
    promptParts.push(`You are an SEO expert. Based on the article content below, generate optimized meta data for the keyword "${keyword}".`);
    promptParts.push('');

    if (titleCount > 0) {
      promptParts.push(`Generate exactly ${titleCount} meta title${titleCount > 1 ? 's' : ''}.`);
      promptParts.push('- Each should be 50-60 characters for optimal display in search results');
      promptParts.push('- Include the primary keyword naturally');
      promptParts.push('- Make each variation distinct in approach (e.g., benefit-focused, action-oriented, question-based)');
      promptParts.push('');
    }

    if (descriptionCount > 0) {
      promptParts.push(`Generate exactly ${descriptionCount} meta description${descriptionCount > 1 ? 's' : ''}.`);
      promptParts.push('- Each should be 150-160 characters for optimal display in search results');
      promptParts.push('- Include the primary keyword naturally');
      promptParts.push('- Include a call to action');
      promptParts.push('- Make each variation distinct');
      promptParts.push('');
    }

    promptParts.push('Format your response EXACTLY like this (include only the sections requested):');
    if (titleCount > 0) {
      promptParts.push('---META TITLES---');
      promptParts.push('1. First title');
      if (titleCount > 1) promptParts.push(`2. Second title`);
      if (titleCount > 2) promptParts.push('...');
    }
    if (descriptionCount > 0) {
      promptParts.push('---META DESCRIPTIONS---');
      promptParts.push('1. First description');
      if (descriptionCount > 1) promptParts.push('2. Second description');
      if (descriptionCount > 2) promptParts.push('...');
    }

    promptParts.push('');
    promptParts.push('Article content:');
    promptParts.push(contentPreview);

    const prompt = promptParts.join('\n');

    // 3. Get model from workflow or use default
    let model = 'claude-sonnet-4-5-20250929';
    if (article.workflow_id) {
      try {
        const [workflow] = await sql`SELECT state FROM workflows WHERE id = ${article.workflow_id}`;
        if (workflow?.state) {
          const workflowState = JSON.parse(workflow.state || '{}');
          model = workflowState.defaultModel || model;
        }
      } catch (e) {
        console.warn('[Regenerate Meta] Could not fetch workflow model:', e.message);
      }
    }

    // 4. Call LLM
    console.log(`[Regenerate Meta] Calling LLM with model: ${model}`);
    const llmResponse = await fetch(`http://localhost:${process.env.PORT || 3001}/api/llm/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        maxTokens: 1024,
      }),
    });

    const llmResult = await llmResponse.json();

    if (!llmResult.success || !llmResult.content) {
      console.error('[Regenerate Meta] LLM error:', llmResult.error);
      return res.status(500).json({ error: llmResult.error || 'LLM failed to generate meta' });
    }

    const output = llmResult.content;

    // 5. Parse the response (same pattern as workflow generation)
    let newTitles = null;
    let newDescriptions = null;

    if (titleCount > 0) {
      const titleMatch = output.match(/---META TITLES---\s*([\s\S]*?)(?:---META DESCRIPTIONS---|$)/i);
      if (titleMatch) {
        newTitles = titleMatch[1]
          .split('\n')
          .map(line => line.replace(/^\d+\.\s*/, '').trim())
          .filter(Boolean);
      }
    }

    if (descriptionCount > 0) {
      const descMatch = output.match(/---META DESCRIPTIONS---\s*([\s\S]*?)$/i);
      if (descMatch) {
        newDescriptions = descMatch[1]
          .split('\n')
          .map(line => line.replace(/^\d+\.\s*/, '').trim())
          .filter(Boolean);
      }
    }

    if (!newTitles && titleCount > 0) newTitles = [];
    if (!newDescriptions && descriptionCount > 0) newDescriptions = [];

    console.log(`[Regenerate Meta] Parsed: ${newTitles?.length || 0} titles, ${newDescriptions?.length || 0} descriptions`);

    // 6. Update article in database
    // Only update the fields that were requested (0 = leave unchanged)
    if (newTitles !== null && newDescriptions !== null) {
      await sql`
        UPDATE articles
        SET meta_titles = ${JSON.stringify(newTitles)},
            meta_descriptions = ${JSON.stringify(newDescriptions)},
            selected_meta_title = NULL,
            selected_meta_description = NULL,
            meta_seo_status = 'pending',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${articleId}
      `;
    } else if (newTitles !== null) {
      await sql`
        UPDATE articles
        SET meta_titles = ${JSON.stringify(newTitles)},
            selected_meta_title = NULL,
            meta_seo_status = 'pending',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${articleId}
      `;
    } else if (newDescriptions !== null) {
      await sql`
        UPDATE articles
        SET meta_descriptions = ${JSON.stringify(newDescriptions)},
            selected_meta_description = NULL,
            meta_seo_status = 'pending',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${articleId}
      `;
    }

    res.json({
      success: true,
      metaTitles: newTitles,
      metaDescriptions: newDescriptions,
      message: `Generated ${newTitles?.length || 0} titles and ${newDescriptions?.length || 0} descriptions`
    });

  } catch (error) {
    console.error('[Regenerate Meta] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST regenerate article content (re-run prompt chain with same keyword)
router.post('/:articleId/regenerate-article', requireDb, async (req, res) => {
  try {
    const { articleId } = req.params;

    console.log(`[Regenerate Article] Starting for article ${articleId}`);

    // 1. Fetch article
    const articles = await sql`SELECT * FROM articles WHERE id = ${articleId}`;
    if (articles.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = articles[0];
    if (!article.workflow_id) {
      return res.status(400).json({ error: 'Article has no linked workflow — cannot regenerate' });
    }

    // 2. Fetch workflow with prompt chain
    const workflows = await sql`
      SELECT w.*, ws.id as website_id, c.id as client_id
      FROM workflows w
      LEFT JOIN websites ws ON w.website_id = ws.id
      LEFT JOIN clients c ON w.client_id = c.id
      WHERE w.id = ${article.workflow_id}
    `;

    if (workflows.length === 0) {
      return res.status(404).json({ error: 'Linked workflow not found' });
    }

    const workflow = workflows[0];
    const workflowState = JSON.parse(workflow.state || '{}');
    const promptTemplates = workflowState.promptTemplates || [];

    if (promptTemplates.length === 0) {
      return res.status(400).json({ error: 'Workflow has no prompt templates configured' });
    }

    // 3. Build placeholder context (same as generate-for-node)
    const placeholders = workflowState.placeholders || [];
    const keyword = article.keyword || 'Untitled';
    const defaultModel = workflowState.defaultModel || 'claude-sonnet-4-5-20250929';

    // 4. Execute prompt chain
    const chainOutputs = {};
    let finalContent = '';
    let metaTitles = [];
    let metaDescriptions = [];

    for (const promptConfig of promptTemplates) {
      const { key, systemPrompt, userPrompt, model, maxTokens } = promptConfig;

      if (!userPrompt) continue;

      // Fill placeholders
      let filledPrompt = userPrompt;
      filledPrompt = filledPrompt.replace(/{item_name}/g, keyword);
      filledPrompt = filledPrompt.replace(/{keyword}/g, keyword);
      filledPrompt = filledPrompt.replace(/{page_type}/g, 'service');

      // Replace [output_key] with previous outputs
      filledPrompt = filledPrompt.replace(/\[([^\]]+)\]/g, (match, outputKey) => {
        return chainOutputs[outputKey.trim()] || match;
      });

      // Replace global placeholders {key}
      placeholders.forEach(p => {
        if (!p.tag) {
          const regex = new RegExp(`\\{${p.key}\\}`, 'g');
          filledPrompt = filledPrompt.replace(regex, p.value || '');
        }
      });

      const fullPrompt = systemPrompt
        ? `${systemPrompt}\n\n${filledPrompt}`
        : filledPrompt;

      console.log(`[Regenerate Article] Running prompt "${key}" for "${keyword}"`);

      try {
        const llmResponse = await fetch(`http://localhost:${process.env.PORT || 3001}/api/llm/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model || defaultModel,
            prompt: fullPrompt,
            maxTokens: maxTokens || 4096,
          }),
        });

        const llmResult = await llmResponse.json();

        if (llmResult.success && llmResult.content) {
          chainOutputs[key] = llmResult.content;

          // Check if this is the final output
          if (key === 'final' || key === 'article' || key === 'content' ||
              promptConfig === promptTemplates[promptTemplates.length - 1]) {
            finalContent = llmResult.content;

            // Parse meta titles and descriptions
            const metaTitleMatch = finalContent.match(/---META TITLES---\s*([\s\S]*?)(?:---META DESCRIPTIONS---|$)/i);
            const metaDescMatch = finalContent.match(/---META DESCRIPTIONS---\s*([\s\S]*?)$/i);

            if (metaTitleMatch) {
              metaTitles = metaTitleMatch[1]
                .split('\n')
                .map(line => line.replace(/^\d+\.\s*/, '').trim())
                .filter(Boolean);
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
          console.error(`[Regenerate Article] LLM error for prompt "${key}":`, llmResult.error);
        }
      } catch (llmError) {
        console.error(`[Regenerate Article] LLM call failed for "${key}":`, llmError.message);
      }
    }

    if (!finalContent) {
      return res.status(500).json({ error: 'Failed to regenerate — no output from prompt chain' });
    }

    const wordCount = finalContent.split(/\s+/).filter(Boolean).length;

    // 5. Update the article (preserve images, clear meta selections for re-review)
    await sql`
      UPDATE articles
      SET final_content = ${finalContent},
          meta_titles = ${JSON.stringify(metaTitles)},
          meta_descriptions = ${JSON.stringify(metaDescriptions)},
          chain_outputs = ${JSON.stringify(chainOutputs)},
          word_count = ${wordCount},
          selected_meta_title = NULL,
          selected_meta_description = NULL,
          meta_seo_status = 'pending',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${articleId}
    `;

    console.log(`[Regenerate Article] Complete: ${wordCount} words, ${metaTitles.length} titles, ${metaDescriptions.length} descriptions`);

    res.json({
      success: true,
      wordCount,
      metaTitles: metaTitles.length,
      metaDescriptions: metaDescriptions.length,
      message: `Article regenerated: ${wordCount} words`
    });

  } catch (error) {
    console.error('[Regenerate Article] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
