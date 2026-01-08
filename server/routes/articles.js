// Articles API routes (stored outputs with full chain history)
import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';
import { megaImageStatus, trackImagesLoaded, trackApiResponse, banner, log, warning, success, error as logError } from '../services/image-tracker.js';

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

    const result = await sql`
      UPDATE articles
      SET wp_post_id = ${wpPostId || null},
          wp_post_url = ${wpPostUrl || null},
          wp_published_at = ${wpPostId ? 'CURRENT_TIMESTAMP' : null},
          status = ${status || 'published'},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

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

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'Missing WordPress credentials' });
    }

    // Get article with images from database
    const articles = await sql`SELECT * FROM articles WHERE id = ${articleId}`;
    if (articles.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = articles[0];
    const images = article.generated_images || [];

    if (images.length === 0) {
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
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${articleId}
    `;

    const successCount = results.filter(r => r.status === 'success').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    res.json({
      success: true,
      pushed: successCount,
      skipped: skippedCount,
      message: `${successCount} images uploaded, ${skippedCount} skipped`,
      results
    });

  } catch (error) {
    console.error('[Push Images] Error:', error);
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

    // Handle response format
    let imageUrl;
    if (response.data[0].b64_json) {
      imageUrl = `data:image/png;base64,${response.data[0].b64_json}`;
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
      pushedToWp: false, // Reset since it's a new image
      wpMediaId: undefined
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
    const wpApiUrl = `${wpUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts/${wpPostId}`;

    const updateRes = await fetch(wpApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      console.error('[Push Meta] WordPress API error:', errorText);
      return res.status(updateRes.status).json({ error: `WordPress error: ${errorText}` });
    }

    // Update article with selected meta
    await sql`
      UPDATE articles
      SET selected_meta_title = ${metaTitle || null},
          selected_meta_description = ${metaDescription || null},
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
