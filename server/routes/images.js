/**
 * Image API Routes
 * Endpoints for AI image generation, Style DNA management, and image processing
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { sql, isDatabaseEnabled } from '../db/index.js';
import { extractStyleDNA, extractAction, buildFluxPrompt, analyzeImageStyle } from '../services/image-prompt-generator.js';
import { generateImage, generateBatchImages, estimateCost } from '../services/image-generator.js';
import { processArticleWithImages, previewPrompts } from '../services/image-pipeline.js';

const router = express.Router();

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'reference-images');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const websiteId = req.body.websiteId || 'general';
    const websiteDir = path.join(uploadsDir, websiteId.toString());
    if (!fs.existsSync(websiteDir)) {
      fs.mkdirSync(websiteDir, { recursive: true });
    }
    cb(null, websiteDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 30 // Max 30 files at once
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Middleware to check database availability
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

/**
 * POST /api/images/upload
 * Upload reference images for Style DNA
 */
router.post('/upload', upload.array('images', 30), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const websiteId = req.body.websiteId || 'general';
    const images = req.files.map(file => {
      // Build the URL path for the uploaded file
      const relativePath = `/uploads/reference-images/${websiteId}/${file.filename}`;
      return {
        url: relativePath,
        filename: file.originalname,
        size: file.size,
        tags: [] // Can be populated by AI later
      };
    });

    res.json({
      success: true,
      images,
      count: images.length
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/images/uploaded/:websiteId
 * List all uploaded reference images for a website
 */
router.get('/uploaded/:websiteId', (req, res) => {
  try {
    const { websiteId } = req.params;
    const websiteDir = path.join(uploadsDir, websiteId);

    if (!fs.existsSync(websiteDir)) {
      return res.json({ success: true, images: [] });
    }

    const files = fs.readdirSync(websiteDir);
    const images = files
      .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
      .map(file => ({
        url: `/uploads/reference-images/${websiteId}/${file}`,
        filename: file,
        size: fs.statSync(path.join(websiteDir, file)).size
      }));

    res.json({
      success: true,
      images
    });
  } catch (error) {
    console.error('List uploaded images error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/images/uploaded/:websiteId/:filename
 * Delete an uploaded reference image
 */
router.delete('/uploaded/:websiteId/:filename', (req, res) => {
  try {
    const { websiteId, filename } = req.params;
    const filePath = path.join(uploadsDir, websiteId, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    fs.unlinkSync(filePath);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: error.message });
  }
});

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

// ========== STYLELOCK INTEGRATION ==========
// These endpoints provide access to the StyleLock engine from the images API

import {
  createStyleLockEngine,
  getEffectiveSettings,
  getGlobalSettings,
  extractStyleDNA as stylelockExtractStyleDNA
} from '../services/stylelock/index.js';

// In-memory job tracking for StyleLock jobs
const stylelockJobs = new Map();

/**
 * POST /api/images/stylelock/generate
 * Generate a high-quality image using the full StyleLock engine
 * This runs the complete voting and blind test workflow
 */
router.post('/stylelock/generate', async (req, res) => {
  try {
    const {
      websiteId,
      referenceImages,
      targetDescription,
      uniformConfig,
      settingsOverrides,
      openaiApiKey,
      replicateApiKey,
      anthropicApiKey
    } = req.body;

    // Validate required fields
    if (!referenceImages || referenceImages.length === 0) {
      return res.status(400).json({ error: 'At least one reference image is required' });
    }

    if (!targetDescription) {
      return res.status(400).json({ error: 'Target description is required' });
    }

    // Get API keys
    const apiKeys = {
      openai: openaiApiKey || process.env.OPENAI_API_KEY,
      replicate: replicateApiKey || process.env.REPLICATE_API_TOKEN,
      anthropic: anthropicApiKey || process.env.ANTHROPIC_API_KEY
    };

    if (!apiKeys.openai) {
      return res.status(400).json({ error: 'OpenAI API key is required' });
    }

    if (!apiKeys.replicate) {
      return res.status(400).json({ error: 'Replicate API key is required' });
    }

    // Get effective settings
    const settings = await getEffectiveSettings(websiteId, settingsOverrides);

    // Create engine
    const engine = createStyleLockEngine(apiKeys, settings);

    // Generate job ID
    const jobId = `sl-${Date.now().toString(36)}`;

    // Create job record
    const jobRecord = {
      id: jobId,
      websiteId,
      status: 'running',
      referenceImages,
      targetDescription,
      uniformConfig,
      settings,
      progress: [],
      result: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    stylelockJobs.set(jobId, jobRecord);

    // Start job in background
    (async () => {
      try {
        const result = await engine.run(
          {
            referenceImages,
            targetDescription,
            uniformConfig,
            websiteId
          },
          (progress) => {
            // Update job progress
            const job = stylelockJobs.get(jobId);
            if (job) {
              job.progress.push({ ...progress, timestamp: new Date() });
              job.updatedAt = new Date();
              if (progress.status === 'complete' || progress.status === 'error' || progress.status === 'max_rounds_reached') {
                job.status = progress.status === 'complete' ? 'complete' : 'failed';
              }
            }
          }
        );

        // Store result
        const job = stylelockJobs.get(jobId);
        if (job) {
          job.result = result;
          job.status = result.success ? 'complete' : 'failed';
          job.updatedAt = new Date();
        }
      } catch (error) {
        const job = stylelockJobs.get(jobId);
        if (job) {
          job.status = 'error';
          job.error = error.message;
          job.updatedAt = new Date();
        }
      }
    })();

    // Return immediately with job ID
    res.json({
      success: true,
      jobId,
      status: 'running',
      message: 'StyleLock job started. Poll /api/images/stylelock/job/:jobId for status.'
    });

  } catch (error) {
    console.error('StyleLock generate error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/images/stylelock/job/:jobId
 * Get StyleLock job status and result
 */
router.get('/stylelock/job/:jobId', (req, res) => {
  const { jobId } = req.params;

  const job = stylelockJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    id: job.id,
    status: job.status,
    websiteId: job.websiteId,
    targetDescription: job.targetDescription,
    progress: job.progress,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  });
});

/**
 * GET /api/images/stylelock/jobs
 * List recent StyleLock jobs
 */
router.get('/stylelock/jobs', (req, res) => {
  const { websiteId, status, limit = 20 } = req.query;

  let jobs = Array.from(stylelockJobs.values());

  if (websiteId) {
    jobs = jobs.filter(j => j.websiteId === parseInt(websiteId));
  }

  if (status) {
    jobs = jobs.filter(j => j.status === status);
  }

  // Sort by creation date, newest first
  jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Limit results
  jobs = jobs.slice(0, parseInt(limit));

  res.json({
    jobs: jobs.map(j => ({
      id: j.id,
      status: j.status,
      websiteId: j.websiteId,
      targetDescription: j.targetDescription,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
      result: j.result ? {
        success: j.result.success,
        score: j.result.score,
        tier: j.result.tier,
        imageUrl: j.result.imageUrl,
        totalCost: j.result.totalCost
      } : null
    })),
    total: jobs.length
  });
});

/**
 * POST /api/images/stylelock/extract-dna
 * Extract Style DNA using the StyleLock enhanced analysis
 */
router.post('/stylelock/extract-dna', async (req, res) => {
  try {
    const { referenceImages, openaiApiKey, websiteId } = req.body;

    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key is required' });
    }

    if (!referenceImages || !Array.isArray(referenceImages) || referenceImages.length === 0) {
      return res.status(400).json({ error: 'At least one reference image URL is required' });
    }

    // Convert simple URLs to proper format
    const images = referenceImages.map(img =>
      typeof img === 'string' ? img : img.url
    );

    // Use StyleLock's enhanced Style DNA extraction
    const result = await stylelockExtractStyleDNA(images, apiKey, {
      model: 'gpt-4o' // Use better model for enhanced analysis
    });

    // Save to database if websiteId provided
    if (websiteId && isDatabaseEnabled()) {
      try {
        await sql`
          UPDATE websites
          SET image_style_dna = ${JSON.stringify(result.styleDNA)},
              image_reference_urls = ${JSON.stringify(referenceImages)},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${websiteId}
        `;
      } catch (dbError) {
        console.error('Failed to save StyleLock DNA to database:', dbError);
      }
    }

    res.json({
      success: true,
      styleDNA: result.styleDNA,
      imagesAnalyzed: result.imagesAnalyzed,
      cost: result.cost
    });
  } catch (error) {
    console.error('StyleLock extract DNA error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/images/stylelock/cost-estimate
 * Get cost estimate for StyleLock generation
 */
router.get('/stylelock/cost-estimate', async (req, res) => {
  try {
    const { websiteId, referenceImageCount = 5 } = req.query;
    const settings = await getEffectiveSettings(websiteId ? parseInt(websiteId) : null);

    const costs = settings.costs;
    const gen = settings.generation;
    const voting = settings.voting;
    const blindTest = settings.blindTest;
    const limits = settings.limits;

    // Calculate estimates
    const styleDNACost = (parseInt(referenceImageCount) * 0.01) + 0.01;
    const promptGenCostPerRound = gen.numGenerators * 0.003;
    const imageGenCostPerRound = gen.numGenerators * costs['flux-1.1-pro'];
    const votingCostPerRound = gen.numGenerators * voting.numVoters * 0.01;
    const costPerRound = promptGenCostPerRound + imageGenCostPerRound + votingCostPerRound;
    const blindTestCost = blindTest.numJudges * 0.02;

    const minRounds = 2;
    const avgRounds = 5;

    res.json({
      success: true,
      estimate: {
        min: styleDNACost + (costPerRound * minRounds) + blindTestCost,
        average: styleDNACost + (costPerRound * avgRounds) + (blindTestCost * 1.5),
        max: limits.maxCost,
        currency: 'USD'
      },
      breakdown: {
        styleDNA: styleDNACost,
        perRound: costPerRound,
        blindTest: blindTestCost,
        components: {
          promptGeneration: promptGenCostPerRound,
          imageGeneration: imageGenCostPerRound,
          voting: votingCostPerRound
        }
      },
      settings: {
        numGenerators: gen.numGenerators,
        numVoters: voting.numVoters,
        numJudges: blindTest.numJudges,
        maxRounds: limits.maxRounds,
        advanceThreshold: voting.advanceThreshold
      }
    });
  } catch (error) {
    console.error('StyleLock cost estimate error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
