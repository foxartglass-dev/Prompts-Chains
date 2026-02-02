// Articles API routes (stored outputs with full chain history)
import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';
import { megaImageStatus, trackImagesLoaded, trackApiResponse, banner, log, warning, success, error as logError } from '../services/image-tracker.js';
import chunkContent from '../services/content-chunker.js';
import buildElementorPage, { getElementorMetaFields } from '../services/elementor-builder.js';
import { updatePage, getPage, createElementorPage, uploadMedia } from '../services/wordpress-publisher.js';

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
             ws.wp_url, ws.wp_user, ws.wp_app_password, ws.seo_plugin
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

    // If article has a WP page, RE-CREATE it with images (same approach as Push All)
    // WordPress/Elementor doesn't properly update _elementor_data via REST API,
    // so we need to create a new page with the same slug
    let pageUpdated = false;
    let newPageResult = null;
    if (article.wp_post_id && article.final_content && updatedImages.length > 0) {
      try {
        console.log('[Push Images] Re-creating page with images (same approach as Push All)...');
        const wpCredentials = { url: wpUrl, user: wpUser, password: wpPassword };

        // Step 1: Get the existing page's slug to preserve the URL
        let existingSlug = null;
        try {
          const existingPage = await getPage(wpCredentials, article.wp_post_id);
          existingSlug = existingPage.slug;
          console.log('[Push Images] Existing page slug:', existingSlug);
        } catch (getPageError) {
          console.log('[Push Images] Could not get existing page, will generate new slug');
        }

        // Step 2: Chunk the content
        const chunked = chunkContent(article.final_content, { maxWords: 300 });

        // Step 3: Sort images by placement (hero first, then sections)
        const sortedImages = [...updatedImages].sort((a, b) => {
          if (a.placement === 'hero') return -1;
          if (b.placement === 'hero') return 1;
          const aNum = parseInt(a.placement?.replace('section-', '') || '99');
          const bNum = parseInt(b.placement?.replace('section-', '') || '99');
          return aNum - bNum;
        });

        // Step 4: Embed images into chunks (same as Push All does)
        sortedImages.forEach((img, imgIdx) => {
          const isHero = img.placement === 'hero';
          const imageUrl = img.wpMediaUrl || img.url;

          // Skip base64 images - they need to be uploaded first
          if (imageUrl?.startsWith('data:')) {
            console.log('[Push Images] Skipping base64 image:', img.id);
            return;
          }

          const imageData = {
            url: imageUrl,
            wpUrl: img.wpMediaUrl || img.url,
            wpMediaId: img.wpMediaId || null,
            alt: img.prompt?.substring(0, 50) || 'Article image',
            width: isHero ? 400 : 380,
            height: isHero ? 500 : 475,
            side: img.side || (isHero ? 'right' : 'left'),
            orientation: 'vertical'
          };

          console.log('[Push Images] Embedding image:', {
            placement: img.placement,
            hasWpUrl: !!img.wpMediaUrl,
            wpMediaId: img.wpMediaId
          });

          if (isHero && chunked.intro) {
            chunked.intro.imageData = imageData;
          } else {
            const sectionMatch = img.placement?.match(/section-(\d+)/);
            if (sectionMatch) {
              const sectionIdx = parseInt(sectionMatch[1]) - 1;
              if (chunked.chunks[sectionIdx]) {
                chunked.chunks[sectionIdx].imageData = imageData;
              }
            }
          }
        });

        // Step 5: Build new Elementor structure (same as Push All)
        const elementorData = buildElementorPage(chunked, {
          title: article.keyword || 'Article',
          heroImageSide: sortedImages.find(i => i.placement === 'hero')?.side || 'right'
        });

        const elementorMeta = getElementorMetaFields(elementorData);

        // Step 6: Delete the old page first (to free up the slug)
        if (existingSlug) {
          try {
            const deleteUrl = `${wpUrl.replace(/\/$/, '')}/wp-json/wp/v2/pages/${article.wp_post_id}?force=true`;
            const auth = Buffer.from(`${wpUser}:${wpPassword}`).toString('base64');
            const deleteRes = await fetch(deleteUrl, {
              method: 'DELETE',
              headers: { 'Authorization': `Basic ${auth}` }
            });
            if (deleteRes.ok) {
              console.log('[Push Images] ✅ Deleted old page to free up slug');
            } else {
              console.log('[Push Images] Could not delete old page, will use different slug');
              existingSlug = existingSlug + '-updated'; // Use modified slug
            }
          } catch (deleteError) {
            console.log('[Push Images] Delete failed, continuing with modified slug');
            existingSlug = existingSlug + '-updated';
          }
        }

        // Step 7: Create NEW page with images (same as Push All's createElementorPage)
        console.log('[Push Images] Creating new page with images...');
        newPageResult = await createElementorPage(wpCredentials, {
          title: article.keyword || 'Article',
          slug: existingSlug,
          elementorMeta,
          status: 'draft'
        });

        if (newPageResult.success) {
          pageUpdated = true;
          console.log('[Push Images] ✅ New page created with images!');
          console.log('[Push Images] New page ID:', newPageResult.id);
          console.log('[Push Images] New page URL:', newPageResult.link);

          // Step 8: Update article with new page info
          await sql`
            UPDATE articles
            SET wp_post_id = ${newPageResult.id},
                wp_post_url = ${newPageResult.link},
                wp_published_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${articleId}
          `;
          console.log('[Push Images] ✅ Article updated with new page info');
        } else {
          console.error('[Push Images] Failed to create new page');
        }
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

export default router;
