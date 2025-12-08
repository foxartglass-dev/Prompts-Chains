/**
 * Image API Routes
 * Endpoints for AI image generation, Style DNA management, and image processing
 */

import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';
import { extractStyleDNA, extractAction, buildFluxPrompt, analyzeImageStyle } from '../services/image-prompt-generator.js';
import { generateImage, generateBatchImages, estimateCost } from '../services/image-generator.js';
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
 * POST /api/images/extract-style-dna
 * Extract Style DNA from reference images using GPT-4o-mini Vision
 */
router.post('/extract-style-dna', async (req, res) => {
  try {
    const { referenceImages, openaiApiKey, websiteId } = req.body;

    // Resolve API key
    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key is required' });
    }

    if (!referenceImages || !Array.isArray(referenceImages) || referenceImages.length === 0) {
      return res.status(400).json({ error: 'At least one reference image URL is required' });
    }

    // Convert simple URLs to objects if needed
    const images = referenceImages.map(img =>
      typeof img === 'string' ? { url: img } : img
    );

    const styleDNA = await extractStyleDNA(images, apiKey);

    // Save to database if websiteId provided
    if (websiteId && isDatabaseEnabled()) {
      try {
        await sql`
          UPDATE websites
          SET image_style_dna = ${JSON.stringify(styleDNA)},
              image_reference_urls = ${JSON.stringify(referenceImages)},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${websiteId}
        `;
      } catch (dbError) {
        console.error('Failed to save Style DNA to database:', dbError);
        // Don't fail the request
      }
    }

    res.json({
      success: true,
      styleDNA
    });
  } catch (error) {
    console.error('Style DNA extraction error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/images/analyze
 * Analyze a single image for style characteristics
 */
router.post('/analyze', async (req, res) => {
  try {
    const { imageUrl, openaiApiKey } = req.body;

    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key is required' });
    }

    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    const analysis = await analyzeImageStyle(imageUrl, apiKey);

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Image analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/images/preview-prompts
 * Generate and preview prompts without generating images
 * Useful for testing Style DNA quality
 */
router.post('/preview-prompts', async (req, res) => {
  try {
    const {
      content,
      styleDNA,
      openaiApiKey,
      keyword = '',
      title = '',
      maxImages = 4
    } = req.body;

    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const result = await previewPrompts(content, {
      styleDNA,
      openaiApiKey: apiKey,
      keyword,
      title,
      maxImages
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Preview prompts error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/images/generate
 * Generate a single image from a prompt
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt, replicateApiKey, options = {} } = req.body;

    const apiKey = replicateApiKey || process.env.REPLICATE_API_TOKEN;

    if (!apiKey) {
      return res.status(400).json({ error: 'Replicate API key is required' });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const image = await generateImage(prompt, options, apiKey);

    res.json({
      success: true,
      image,
      cost: estimateCost(1)
    });
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/images/generate-batch
 * Generate multiple images from prompts
 */
router.post('/generate-batch', async (req, res) => {
  try {
    const { prompts, replicateApiKey, options = {} } = req.body;

    const apiKey = replicateApiKey || process.env.REPLICATE_API_TOKEN;

    if (!apiKey) {
      return res.status(400).json({ error: 'Replicate API key is required' });
    }

    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ error: 'prompts array is required' });
    }

    const images = await generateBatchImages(prompts, options, apiKey);

    const successful = images.filter(img => !img.error);
    const failed = images.filter(img => img.error);

    res.json({
      success: true,
      images: successful,
      failed,
      cost: estimateCost(successful.length)
    });
  } catch (error) {
    console.error('Batch generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/images/generate-for-article
 * Full pipeline: article content → chunks with images
 */
router.post('/generate-for-article', async (req, res) => {
  try {
    const {
      content,
      title,
      keyword,
      styleDNA,
      referenceImages,
      openaiApiKey,
      replicateApiKey,
      wpUrl,
      wpUser,
      wpPassword,
      maxImages = 4,
      heroImage = true
    } = req.body;

    // Resolve API keys
    const openaiKey = openaiApiKey || process.env.OPENAI_API_KEY;
    const replicateKey = replicateApiKey || process.env.REPLICATE_API_TOKEN;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    // Build WP credentials if provided
    const wpCredentials = (wpUrl && wpUser && wpPassword)
      ? { url: wpUrl, user: wpUser, password: wpPassword }
      : null;

    const result = await processArticleWithImages(content, {
      title,
      keyword,
      styleDNA,
      referenceImages,
      openaiApiKey: openaiKey,
      replicateApiKey: replicateKey,
      wpCredentials,
      maxImages,
      heroImage
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Generate for article error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/images/style-dna/:websiteId
 * Get saved Style DNA for a website
 */
router.get('/style-dna/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;

    const websites = await sql`
      SELECT image_style_dna, image_reference_urls, image_generation_enabled
      FROM websites
      WHERE id = ${websiteId}
    `;

    if (websites.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const website = websites[0];

    res.json({
      success: true,
      styleDNA: website.image_style_dna || null,
      referenceImages: website.image_reference_urls || [],
      enabled: website.image_generation_enabled || false
    });
  } catch (error) {
    console.error('Get Style DNA error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/images/style-dna/:websiteId
 * Save Style DNA for a website
 */
router.put('/style-dna/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { styleDNA, referenceImages, enabled } = req.body;

    const updates = {};
    if (styleDNA !== undefined) {
      updates.image_style_dna = JSON.stringify(styleDNA);
    }
    if (referenceImages !== undefined) {
      updates.image_reference_urls = JSON.stringify(referenceImages);
    }
    if (enabled !== undefined) {
      updates.image_generation_enabled = enabled;
    }

    const result = await sql`
      UPDATE websites
      SET image_style_dna = COALESCE(${updates.image_style_dna}::jsonb, image_style_dna),
          image_reference_urls = COALESCE(${updates.image_reference_urls}::jsonb, image_reference_urls),
          image_generation_enabled = COALESCE(${updates.image_generation_enabled}, image_generation_enabled),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${websiteId}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Save Style DNA error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/images/build-prompt
 * Build a FLUX prompt from Style DNA and action (for testing)
 */
router.post('/build-prompt', async (req, res) => {
  try {
    const { styleDNA, action, imageType = 'inline' } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }

    // Normalize action to object if string
    const actionObj = typeof action === 'string'
      ? { action, mood: 'professional', subjects: [], setting: '' }
      : action;

    const prompt = buildFluxPrompt(styleDNA, actionObj, imageType);

    res.json({
      success: true,
      prompt
    });
  } catch (error) {
    console.error('Build prompt error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/images/extract-action
 * Extract action from content section (for testing)
 */
router.post('/extract-action', async (req, res) => {
  try {
    const { content, keyword, title, imageType, openaiApiKey } = req.body;

    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key is required' });
    }

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const action = await extractAction(content, {
      keyword,
      articleTitle: title,
      imageType
    }, apiKey);

    res.json({
      success: true,
      action
    });
  } catch (error) {
    console.error('Extract action error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/images/cost-estimate
 * Get cost estimate for generating images
 */
router.get('/cost-estimate', (req, res) => {
  const count = parseInt(req.query.count) || 4;

  res.json({
    success: true,
    estimate: estimateCost(count),
    breakdown: {
      fluxPerImage: '$0.04',
      gptPrompting: '~$0.001 per article',
      note: 'Actual costs may vary slightly'
    }
  });
});

export default router;
