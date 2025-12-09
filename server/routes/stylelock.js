/**
 * StyleLock API Routes
 * Endpoints for the StyleLock image generation engine
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createStyleLockEngine,
  extractStyleDNA,
  analyzeReferenceConsistency,
  DEFAULT_SETTINGS,
  mergeSettings,
  validateSettings
} from '../services/stylelock/index.js';
import {
  getGlobalSettings,
  getWebsiteSettings,
  saveGlobalSettings,
  saveWebsiteSettings,
  applyPreset,
  applyWebsitePreset,
  getPresets,
  deleteWebsiteSettings,
  getSettingsHistory,
  getEffectiveSettings
} from '../services/stylelock/settings-service.js';

const router = express.Router();

// In-memory job storage (will be replaced with database in Phase 3)
const jobs = new Map();

// ========== JOB ENDPOINTS ==========

/**
 * Start a new StyleLock job
 * POST /api/stylelock/jobs
 */
router.post('/jobs', async (req, res) => {
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

    // Get effective settings (global -> website -> overrides)
    const settings = await getEffectiveSettings(websiteId, settingsOverrides);

    // Create engine
    const engine = createStyleLockEngine(apiKeys, settings);

    // Estimate cost before starting
    const estimatedCost = estimateJobCost(referenceImages.length, settings);

    // Create job record
    const jobId = uuidv4().slice(0, 8);
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

    jobs.set(jobId, jobRecord);

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
            const job = jobs.get(jobId);
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
        const job = jobs.get(jobId);
        if (job) {
          job.result = result;
          job.status = result.success ? 'complete' : 'failed';
          job.updatedAt = new Date();
        }
      } catch (error) {
        const job = jobs.get(jobId);
        if (job) {
          job.status = 'error';
          job.error = error.message;
          job.updatedAt = new Date();
        }
      }
    })();

    // Return immediately with job ID
    res.json({
      jobId,
      status: 'running',
      estimatedCost,
      estimatedRounds: Math.ceil(estimatedCost.max / 0.5) // Rough estimate
    });

  } catch (error) {
    console.error('Error starting StyleLock job:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get job status and progress
 * GET /api/stylelock/jobs/:jobId
 */
router.get('/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;

  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    id: job.id,
    status: job.status,
    websiteId: job.websiteId,
    progress: job.progress,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  });
});

/**
 * List jobs (optionally filtered by websiteId)
 * GET /api/stylelock/jobs?websiteId=X
 */
router.get('/jobs', (req, res) => {
  const { websiteId, status, limit = 50 } = req.query;

  let jobList = Array.from(jobs.values());

  if (websiteId) {
    jobList = jobList.filter(j => j.websiteId === parseInt(websiteId));
  }

  if (status) {
    jobList = jobList.filter(j => j.status === status);
  }

  // Sort by creation date, newest first
  jobList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Limit results
  jobList = jobList.slice(0, parseInt(limit));

  res.json({
    jobs: jobList.map(j => ({
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
        totalCost: j.result.totalCost
      } : null
    })),
    total: jobList.length
  });
});

/**
 * Cancel a running job
 * POST /api/stylelock/jobs/:jobId/cancel
 */
router.post('/jobs/:jobId/cancel', (req, res) => {
  const { jobId } = req.params;

  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status !== 'running') {
    return res.status(400).json({ error: 'Job is not running' });
  }

  job.status = 'cancelled';
  job.updatedAt = new Date();

  res.json({ success: true, status: 'cancelled' });
});

// ========== STYLE DNA ENDPOINTS ==========

/**
 * Extract Style DNA from images (standalone, without full job)
 * POST /api/stylelock/style-dna/extract
 */
router.post('/style-dna/extract', async (req, res) => {
  try {
    const { referenceImages, openaiApiKey } = req.body;

    if (!referenceImages || referenceImages.length === 0) {
      return res.status(400).json({ error: 'At least one reference image is required' });
    }

    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key is required' });
    }

    const result = await extractStyleDNA(referenceImages, apiKey);

    res.json({
      styleDNA: result.styleDNA,
      imagesAnalyzed: result.imagesAnalyzed,
      cost: result.cost
    });

  } catch (error) {
    console.error('Error extracting Style DNA:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Analyze reference image consistency
 * POST /api/stylelock/style-dna/analyze-consistency
 */
router.post('/style-dna/analyze-consistency', async (req, res) => {
  try {
    const { referenceImages, openaiApiKey } = req.body;

    if (!referenceImages || referenceImages.length < 2) {
      return res.status(400).json({ error: 'At least two reference images are required' });
    }

    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key is required' });
    }

    const result = await analyzeReferenceConsistency(referenceImages, apiKey);

    res.json(result);

  } catch (error) {
    console.error('Error analyzing consistency:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== SETTINGS ENDPOINTS ==========

/**
 * Get global StyleLock settings
 * GET /api/stylelock/settings
 */
router.get('/settings', async (req, res) => {
  try {
    const settings = await getGlobalSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get settings for a specific website
 * GET /api/stylelock/settings/website/:websiteId
 */
router.get('/settings/website/:websiteId', async (req, res) => {
  try {
    const { websiteId } = req.params;
    const settings = await getWebsiteSettings(parseInt(websiteId));
    res.json(settings);
  } catch (error) {
    console.error('Error getting website settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update global StyleLock settings
 * PUT /api/stylelock/settings
 */
router.put('/settings', async (req, res) => {
  try {
    const { settings, presetName } = req.body;
    const result = await saveGlobalSettings(settings, presetName);
    const updatedSettings = await getGlobalSettings();
    res.json({ ...result, settings: updatedSettings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Update website-specific settings
 * PUT /api/stylelock/settings/website/:websiteId
 */
router.put('/settings/website/:websiteId', async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { settings, presetName } = req.body;
    const result = await saveWebsiteSettings(parseInt(websiteId), settings, presetName);
    const updatedSettings = await getWebsiteSettings(parseInt(websiteId));
    res.json({ ...result, settings: updatedSettings });
  } catch (error) {
    console.error('Error updating website settings:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Delete website-specific settings (revert to global)
 * DELETE /api/stylelock/settings/website/:websiteId
 */
router.delete('/settings/website/:websiteId', async (req, res) => {
  try {
    const { websiteId } = req.params;
    const result = await deleteWebsiteSettings(parseInt(websiteId));
    res.json(result);
  } catch (error) {
    console.error('Error deleting website settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get available presets
 * GET /api/stylelock/settings/presets
 */
router.get('/settings/presets', (req, res) => {
  res.json(getPresets());
});

/**
 * Apply a preset to global settings
 * POST /api/stylelock/settings/presets/:presetName
 */
router.post('/settings/presets/:presetName', async (req, res) => {
  try {
    const { presetName } = req.params;
    const result = await applyPreset(presetName);
    const settings = await getGlobalSettings();
    res.json({ ...result, settings });
  } catch (error) {
    console.error('Error applying preset:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Apply a preset to website settings
 * POST /api/stylelock/settings/website/:websiteId/presets/:presetName
 */
router.post('/settings/website/:websiteId/presets/:presetName', async (req, res) => {
  try {
    const { websiteId, presetName } = req.params;
    const result = await applyWebsitePreset(parseInt(websiteId), presetName);
    const settings = await getWebsiteSettings(parseInt(websiteId));
    res.json({ ...result, settings });
  } catch (error) {
    console.error('Error applying preset to website:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get settings history
 * GET /api/stylelock/settings/history
 * GET /api/stylelock/settings/history?websiteId=X
 */
router.get('/settings/history', async (req, res) => {
  try {
    const { websiteId, limit } = req.query;
    const history = await getSettingsHistory(
      websiteId ? parseInt(websiteId) : null,
      limit ? parseInt(limit) : 10
    );
    res.json(history);
  } catch (error) {
    console.error('Error getting settings history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get default settings
 * GET /api/stylelock/settings/defaults
 */
router.get('/settings/defaults', (req, res) => {
  res.json(DEFAULT_SETTINGS);
});

/**
 * Validate settings without saving
 * POST /api/stylelock/settings/validate
 */
router.post('/settings/validate', (req, res) => {
  const settings = req.body;
  const merged = mergeSettings(settings);
  const validation = validateSettings(merged);

  res.json(validation);
});

// ========== COST ESTIMATION ==========

/**
 * Estimate cost for a job
 * POST /api/stylelock/estimate-cost
 */
router.post('/estimate-cost', async (req, res) => {
  try {
    const { referenceImageCount = 5, websiteId, settingsOverrides } = req.body;
    const settings = await getEffectiveSettings(websiteId, settingsOverrides);
    const estimate = estimateJobCost(referenceImageCount, settings);
    res.json(estimate);
  } catch (error) {
    console.error('Error estimating cost:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Calculate cost estimate
 */
function estimateJobCost(referenceImageCount, settings) {
  const costs = settings.costs || DEFAULT_SETTINGS.costs;
  const gen = settings.generation || DEFAULT_SETTINGS.generation;
  const voting = settings.voting || DEFAULT_SETTINGS.voting;
  const blindTest = settings.blindTest || DEFAULT_SETTINGS.blindTest;
  const limits = settings.limits || DEFAULT_SETTINGS.limits;

  // Style DNA extraction
  const styleDNACost = (referenceImageCount * 0.01) + 0.01; // ~$0.05 for 5 images

  // Per round costs
  const promptGenCostPerRound = gen.numGenerators * 0.003;
  const imageGenCostPerRound = gen.numGenerators * costs['flux-1.1-pro'];
  const votingCostPerRound = gen.numGenerators * voting.numVoters * 0.01;

  const costPerRound = promptGenCostPerRound + imageGenCostPerRound + votingCostPerRound;

  // Blind test cost (assume 1-2 attempts)
  const blindTestCost = blindTest.numJudges * 0.02;

  // Estimate rounds
  const minRounds = 2;
  const avgRounds = 5;
  const maxRounds = limits.maxRounds;

  return {
    styleDNA: styleDNACost,
    perRound: costPerRound,
    blindTest: blindTestCost,
    min: styleDNACost + (costPerRound * minRounds) + blindTestCost,
    average: styleDNACost + (costPerRound * avgRounds) + (blindTestCost * 1.5),
    max: Math.min(
      styleDNACost + (costPerRound * maxRounds) + (blindTestCost * 3),
      limits.maxCost
    ),
    currency: 'USD',
    breakdown: {
      styleDNAExtraction: styleDNACost,
      promptGeneration: promptGenCostPerRound,
      imageGeneration: imageGenCostPerRound,
      voting: votingCostPerRound,
      blindTest: blindTestCost
    }
  };
}

// ========== BATCH GENERATION ==========

/**
 * Generate batch images using existing Style DNA
 * POST /api/stylelock/batch
 */
router.post('/batch', async (req, res) => {
  try {
    const {
      styleDNA,
      actions,
      uniformConfig,
      referenceImages,
      openaiApiKey,
      replicateApiKey
    } = req.body;

    if (!styleDNA) {
      return res.status(400).json({ error: 'Style DNA is required' });
    }

    if (!actions || actions.length === 0) {
      return res.status(400).json({ error: 'At least one action is required' });
    }

    const apiKeys = {
      openai: openaiApiKey || process.env.OPENAI_API_KEY,
      replicate: replicateApiKey || process.env.REPLICATE_API_TOKEN
    };

    if (!apiKeys.replicate) {
      return res.status(400).json({ error: 'Replicate API key is required' });
    }

    const settings = await getGlobalSettings();
    const engine = createStyleLockEngine(apiKeys, settings);

    const result = await engine.generateBatch(styleDNA, actions, {
      uniformConfig,
      referenceImages,
      onProgress: () => {} // Could stream progress via SSE
    });

    res.json(result);

  } catch (error) {
    console.error('Error in batch generation:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== NICHE ENDPOINTS ==========

import {
  createNiche,
  getNiches,
  getNiche,
  lockNiche,
  unlockNiche,
  searchNiches,
  deleteNiche,
  getEnvironments
} from '../services/stylelock/niche-service.js';

import {
  savePrompt,
  getPrompts,
  getPrompt,
  findSimilarPrompts,
  getTopPrompts,
  deletePrompt,
  getPromptStats
} from '../services/stylelock/prompt-bank-service.js';

/**
 * Get available environments
 * GET /api/stylelock/niches/environments
 */
router.get('/niches/environments', (req, res) => {
  res.json(getEnvironments());
});

/**
 * Create a new niche
 * POST /api/stylelock/niches
 */
router.post('/niches', async (req, res) => {
  try {
    const result = await createNiche(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get all niches
 * GET /api/stylelock/niches?environment=X&isLocked=true
 */
router.get('/niches', async (req, res) => {
  try {
    const { environment, isLocked, limit } = req.query;
    const filters = {};
    if (environment) filters.environment = environment;
    if (isLocked !== undefined) filters.isLocked = isLocked === 'true';
    if (limit) filters.limit = parseInt(limit);

    const niches = await getNiches(filters);
    res.json(niches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Search niches
 * GET /api/stylelock/niches/search?q=plumbing&environment=in-home
 */
router.get('/niches/search', async (req, res) => {
  try {
    const { q, environment } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }
    const niches = await searchNiches(q, environment);
    res.json(niches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a single niche
 * GET /api/stylelock/niches/:nicheId
 */
router.get('/niches/:nicheId', async (req, res) => {
  try {
    const { nicheId } = req.params;
    const niche = await getNiche(parseInt(nicheId));
    if (!niche) {
      return res.status(404).json({ error: 'Niche not found' });
    }
    res.json(niche);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Lock a niche with a successful prompt
 * POST /api/stylelock/niches/:nicheId/lock
 */
router.post('/niches/:nicheId/lock', async (req, res) => {
  try {
    const { nicheId } = req.params;
    const result = await lockNiche(parseInt(nicheId), req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Unlock a niche for re-solving
 * POST /api/stylelock/niches/:nicheId/unlock
 */
router.post('/niches/:nicheId/unlock', async (req, res) => {
  try {
    const { nicheId } = req.params;
    const result = await unlockNiche(parseInt(nicheId));
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Delete a niche
 * DELETE /api/stylelock/niches/:nicheId
 */
router.delete('/niches/:nicheId', async (req, res) => {
  try {
    const { nicheId } = req.params;
    const result = await deleteNiche(parseInt(nicheId));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PROMPT BANK ENDPOINTS ==========

/**
 * Get prompt bank statistics
 * GET /api/stylelock/prompts/stats
 */
router.get('/prompts/stats', async (req, res) => {
  try {
    const stats = await getPromptStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get top prompts
 * GET /api/stylelock/prompts/top?environment=X&minScore=80
 */
router.get('/prompts/top', async (req, res) => {
  try {
    const { environment, minScore, limit } = req.query;
    const options = {};
    if (environment) options.environment = environment;
    if (minScore) options.minScore = parseFloat(minScore);
    if (limit) options.limit = parseInt(limit);

    const prompts = await getTopPrompts(options);
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Search for similar prompts
 * GET /api/stylelock/prompts/similar?action=plumber+fixing+sink&environment=in-home
 */
router.get('/prompts/similar', async (req, res) => {
  try {
    const { action, environment, limit } = req.query;
    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }
    const options = {};
    if (environment) options.environment = environment;
    if (limit) options.limit = parseInt(limit);

    const prompts = await findSimilarPrompts(action, options);
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Save a new prompt to the bank
 * POST /api/stylelock/prompts
 */
router.post('/prompts', async (req, res) => {
  try {
    const result = await savePrompt(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get all prompts
 * GET /api/stylelock/prompts?nicheId=X&environment=Y&minScore=Z
 */
router.get('/prompts', async (req, res) => {
  try {
    const { nicheId, environment, minScore, limit } = req.query;
    const filters = {};
    if (nicheId) filters.nicheId = parseInt(nicheId);
    if (environment) filters.environment = environment;
    if (minScore) filters.minScore = parseFloat(minScore);
    if (limit) filters.limit = parseInt(limit);

    const prompts = await getPrompts(filters);
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a single prompt
 * GET /api/stylelock/prompts/:promptId
 */
router.get('/prompts/:promptId', async (req, res) => {
  try {
    const { promptId } = req.params;
    const prompt = await getPrompt(parseInt(promptId));
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    res.json(prompt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a prompt
 * DELETE /api/stylelock/prompts/:promptId
 */
router.delete('/prompts/:promptId', async (req, res) => {
  try {
    const { promptId } = req.params;
    const result = await deletePrompt(parseInt(promptId));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
