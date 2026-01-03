/**
 * Local Viking API Routes
 *
 * Provides REST endpoints for:
 * - GeoGrid rank tracking (the "sheep herding" heat maps)
 * - GBP posting and automation
 * - "Rinse and Repeat" post cycling
 * - Photo uploads to GBP
 * - Integration with Site Planning for rank-driven strategy
 */

import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';
import * as localViking from '../services/local-viking.js';

const router = express.Router();

// Middleware to check if database is enabled
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// Helper to get Local Viking credentials for a website
// API key is stored globally (account-level), Location ID is per-website
async function getLocalVikingCredentials(websiteId) {
  // Get API key from global settings
  // First ensure the table exists
  await sql`
    CREATE TABLE IF NOT EXISTS global_settings (
      id SERIAL PRIMARY KEY,
      local_viking_api_key VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const globalSettings = await sql`
    SELECT local_viking_api_key FROM global_settings WHERE id = 1
  `;

  const apiKey = globalSettings[0]?.local_viking_api_key;

  if (!apiKey) {
    throw new Error('Local Viking API key not configured. Set it in Settings.');
  }

  // Get location ID from website (per-website)
  const websites = await sql`
    SELECT local_viking_location_id
    FROM websites
    WHERE id = ${websiteId}
  `;

  if (websites.length === 0) {
    throw new Error('Website not found');
  }

  return {
    apiKey: apiKey,
    locationId: websites[0].local_viking_location_id
  };
}

// ============================================================================
// CONNECTION & ACCOUNT
// ============================================================================

// Helper to get just the global API key (for test-connection without websiteId)
async function getGlobalApiKey() {
  await sql`
    CREATE TABLE IF NOT EXISTS global_settings (
      id SERIAL PRIMARY KEY,
      local_viking_api_key VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const globalSettings = await sql`
    SELECT local_viking_api_key FROM global_settings WHERE id = 1
  `;

  return globalSettings[0]?.local_viking_api_key || null;
}

/**
 * POST /api/local-viking/test-connection
 * Test Local Viking API connection
 */
router.post('/test-connection', requireDb, async (req, res) => {
  try {
    const { apiKey } = req.body;

    // Use provided API key or get from global settings
    let testKey = apiKey;
    if (!testKey) {
      testKey = await getGlobalApiKey();
    }

    if (!testKey) {
      return res.status(400).json({ error: 'API key required. Set it in Settings.' });
    }

    const result = await localViking.testConnection(testKey);
    res.json(result);

  } catch (error) {
    console.error('[Local Viking] Connection test failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/local-viking/account/:websiteId
 * Get account info and credit balance
 */
router.get('/account/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const creds = await getLocalVikingCredentials(websiteId);

    const account = await localViking.getAccountInfo(creds.apiKey);
    res.json({ success: true, account });

  } catch (error) {
    console.error('[Local Viking] Error fetching account:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local-viking/credits/:websiteId
 * Get credit balance for quick checks
 */
router.get('/credits/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const creds = await getLocalVikingCredentials(websiteId);

    const balance = await localViking.getCreditBalance(creds.apiKey);
    res.json({ success: true, ...balance });

  } catch (error) {
    console.error('[Local Viking] Error fetching credits:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// LOCATIONS (GBP Profiles)
// ============================================================================

/**
 * GET /api/local-viking/locations/:websiteId
 * Get all connected GBP locations for this account
 */
router.get('/locations/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const creds = await getLocalVikingCredentials(websiteId);

    const locations = await localViking.getLocations(creds.apiKey);
    res.json({ success: true, locations });

  } catch (error) {
    console.error('[Local Viking] Error fetching locations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/local-viking/set-location/:websiteId
 * Set the default GBP location for a website
 */
router.put('/set-location/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { locationId } = req.body;

    await sql`
      UPDATE websites
      SET local_viking_location_id = ${locationId},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${websiteId}
    `;

    res.json({ success: true, message: 'Location set successfully' });

  } catch (error) {
    console.error('[Local Viking] Error setting location:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GEOGRID RANK TRACKING
// ============================================================================

/**
 * POST /api/local-viking/geogrid/scan
 * Create a new GeoGrid rank tracking scan
 */
router.post('/geogrid/scan', requireDb, async (req, res) => {
  try {
    const {
      websiteId,
      keyword,
      gridSize = 7,
      distance = 1,
      lat,
      lng,
      saveToDb = true
    } = req.body;

    const creds = await getLocalVikingCredentials(websiteId);

    if (!creds.locationId) {
      return res.status(400).json({
        error: 'No GBP location set for this website. Configure it in website settings.'
      });
    }

    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

    // Calculate credit cost
    const creditCost = gridSize * gridSize;
    console.log(`[Local Viking] Creating ${gridSize}x${gridSize} scan for "${keyword}" (${creditCost} credits)`);

    const scanResult = await localViking.createGeoGridScan(creds.apiKey, {
      locationId: creds.locationId,
      keyword,
      gridSize,
      distance,
      lat,
      lng
    });

    // Save snapshot to database for tracking
    if (saveToDb && scanResult.id) {
      const analysis = localViking.analyzeForSheepOpportunities(scanResult);

      await sql`
        INSERT INTO rank_snapshots (
          website_id, keyword, grid_size, scan_id,
          average_rank, best_rank, top_3_count, sheep_score,
          grid_data, analysis
        ) VALUES (
          ${websiteId}, ${keyword}, ${gridSize}, ${scanResult.id},
          ${analysis.average_rank || 0}, ${analysis.best_rank || 20}, ${analysis.top_3 || 0}, ${analysis.sheep_opportunity_score || 0},
          ${JSON.stringify(scanResult.grid_data || [])}, ${JSON.stringify(analysis)}
        )
      `;
    }

    // Analyze the results for sheep herding opportunities
    const analysis = localViking.analyzeForSheepOpportunities(scanResult);

    res.json({
      success: true,
      scan: scanResult,
      analysis,
      creditCost
    });

  } catch (error) {
    console.error('[Local Viking] GeoGrid scan error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local-viking/geogrid/scan/:scanId
 * Get results of a specific scan
 */
router.get('/geogrid/scan/:scanId', requireDb, async (req, res) => {
  try {
    const { scanId } = req.params;
    const { websiteId } = req.query;

    const creds = await getLocalVikingCredentials(websiteId);
    const scanResult = await localViking.getGeoGridResults(creds.apiKey, scanId);

    const analysis = localViking.analyzeForSheepOpportunities(scanResult);

    res.json({
      success: true,
      scan: scanResult,
      analysis
    });

  } catch (error) {
    console.error('[Local Viking] Error fetching scan:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local-viking/geogrid/history/:websiteId
 * Get rank history for trend analysis
 */
router.get('/geogrid/history/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { keyword, days = 30 } = req.query;

    // Get from local database
    let snapshots;
    if (keyword) {
      snapshots = await sql`
        SELECT * FROM rank_snapshots
        WHERE website_id = ${websiteId} AND keyword = ${keyword}
        ORDER BY created_at DESC
        LIMIT ${parseInt(days)}
      `;
    } else {
      snapshots = await sql`
        SELECT * FROM rank_snapshots
        WHERE website_id = ${websiteId}
        ORDER BY created_at DESC
        LIMIT ${parseInt(days) * 5}
      `;
    }

    // Group by keyword for trend view
    const byKeyword = {};
    for (const snap of snapshots) {
      if (!byKeyword[snap.keyword]) {
        byKeyword[snap.keyword] = [];
      }
      byKeyword[snap.keyword].push({
        date: snap.created_at,
        avgRank: parseFloat(snap.average_rank),
        bestRank: snap.best_rank,
        top3Count: snap.top_3_count,
        sheepScore: parseFloat(snap.sheep_score)
      });
    }

    res.json({
      success: true,
      history: byKeyword,
      totalSnapshots: snapshots.length
    });

  } catch (error) {
    console.error('[Local Viking] Error fetching history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/local-viking/geogrid/bulk-scan
 * Scan multiple keywords at once
 */
router.post('/geogrid/bulk-scan', requireDb, async (req, res) => {
  try {
    const {
      websiteId,
      keywords,
      gridSize = 7,
      distance = 1
    } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: 'Keywords array is required' });
    }

    const creds = await getLocalVikingCredentials(websiteId);

    if (!creds.locationId) {
      return res.status(400).json({ error: 'No GBP location set for this website' });
    }

    // Calculate total credits
    const creditPerScan = gridSize * gridSize;
    const totalCredits = creditPerScan * keywords.length;

    // Check credit balance
    const balance = await localViking.getCreditBalance(creds.apiKey);
    if (balance.credits < totalCredits) {
      return res.status(400).json({
        error: `Insufficient credits. Need ${totalCredits}, have ${balance.credits}`,
        required: totalCredits,
        available: balance.credits
      });
    }

    const results = [];

    for (const keyword of keywords) {
      try {
        const scanResult = await localViking.createGeoGridScan(creds.apiKey, {
          locationId: creds.locationId,
          keyword,
          gridSize,
          distance
        });

        const analysis = localViking.analyzeForSheepOpportunities(scanResult);

        // Save to database
        await sql`
          INSERT INTO rank_snapshots (
            website_id, keyword, grid_size, scan_id,
            average_rank, best_rank, top_3_count, sheep_score,
            grid_data, analysis
          ) VALUES (
            ${websiteId}, ${keyword}, ${gridSize}, ${scanResult.id || ''},
            ${analysis.average_rank || 0}, ${analysis.best_rank || 20}, ${analysis.top_3 || 0}, ${analysis.sheep_opportunity_score || 0},
            ${JSON.stringify(scanResult.grid_data || [])}, ${JSON.stringify(analysis)}
          )
        `;

        results.push({
          keyword,
          success: true,
          analysis
        });

      } catch (scanError) {
        results.push({
          keyword,
          success: false,
          error: scanError.message
        });
      }
    }

    res.json({
      success: true,
      results,
      summary: {
        total: keywords.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        creditsUsed: results.filter(r => r.success).length * creditPerScan
      }
    });

  } catch (error) {
    console.error('[Local Viking] Bulk scan error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GBP POSTING
// ============================================================================

/**
 * POST /api/local-viking/posts
 * Create a new GBP post
 */
router.post('/posts', requireDb, async (req, res) => {
  try {
    const {
      websiteId,
      content,
      callToAction = 'LEARN_MORE',
      ctaUrl,
      imageUrl,
      saveAsTemplate = true,
      templateName
    } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Post content is required' });
    }

    const creds = await getLocalVikingCredentials(websiteId);

    if (!creds.locationId) {
      return res.status(400).json({ error: 'No GBP location set for this website' });
    }

    const postResult = await localViking.createGBPPost(creds.apiKey, {
      locationId: creds.locationId,
      content,
      callToAction,
      ctaUrl,
      imageUrl
    });

    // Save to history
    await sql`
      INSERT INTO gbp_post_history (
        website_id, post_id, content, call_to_action, cta_url, image_url
      ) VALUES (
        ${websiteId}, ${postResult.id || ''}, ${content}, ${callToAction}, ${ctaUrl || null}, ${imageUrl || null}
      )
    `;

    // Save as template for rinse and repeat
    if (saveAsTemplate) {
      await sql`
        INSERT INTO gbp_post_templates (
          website_id, name, content, call_to_action, cta_url, image_url
        ) VALUES (
          ${websiteId}, ${templateName || `Post ${new Date().toLocaleDateString()}`}, ${content}, ${callToAction}, ${ctaUrl || null}, ${imageUrl || null}
        )
        ON CONFLICT (website_id, name)
        DO UPDATE SET content = ${content}, call_to_action = ${callToAction}, cta_url = ${ctaUrl || null}, updated_at = CURRENT_TIMESTAMP
      `;
    }

    res.json({
      success: true,
      post: postResult
    });

  } catch (error) {
    console.error('[Local Viking] Error creating post:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local-viking/posts/:websiteId
 * Get all GBP posts for a location
 */
router.get('/posts/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const creds = await getLocalVikingCredentials(websiteId);

    if (!creds.locationId) {
      return res.status(400).json({ error: 'No GBP location set for this website' });
    }

    const posts = await localViking.getGBPPosts(creds.apiKey, creds.locationId);
    res.json({ success: true, posts });

  } catch (error) {
    console.error('[Local Viking] Error fetching posts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/local-viking/posts/:postId
 * Delete a GBP post
 */
router.delete('/posts/:postId', requireDb, async (req, res) => {
  try {
    const { postId } = req.params;
    const { websiteId } = req.query;

    const creds = await getLocalVikingCredentials(websiteId);

    await localViking.deleteGBPPost(creds.apiKey, postId);

    // Update history
    await sql`
      UPDATE gbp_post_history
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE post_id = ${postId}
    `;

    res.json({ success: true });

  } catch (error) {
    console.error('[Local Viking] Error deleting post:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// POST TEMPLATES (for Rinse and Repeat)
// ============================================================================

/**
 * GET /api/local-viking/templates/:websiteId
 * Get all post templates for rinse and repeat
 */
router.get('/templates/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;

    const templates = await sql`
      SELECT * FROM gbp_post_templates
      WHERE website_id = ${websiteId}
      ORDER BY created_at DESC
    `;

    res.json({ success: true, templates });

  } catch (error) {
    console.error('[Local Viking] Error fetching templates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/local-viking/templates
 * Create a new post template
 */
router.post('/templates', requireDb, async (req, res) => {
  try {
    const {
      websiteId,
      name,
      content,
      callToAction = 'LEARN_MORE',
      ctaUrl,
      imageUrl,
      rotationDay  // 1-7 for weekly rotation
    } = req.body;

    if (!websiteId || !name || !content) {
      return res.status(400).json({ error: 'websiteId, name, and content are required' });
    }

    const result = await sql`
      INSERT INTO gbp_post_templates (
        website_id, name, content, call_to_action, cta_url, image_url, rotation_day
      ) VALUES (
        ${websiteId}, ${name}, ${content}, ${callToAction}, ${ctaUrl || null}, ${imageUrl || null}, ${rotationDay || null}
      )
      RETURNING *
    `;

    res.json({ success: true, template: result[0] });

  } catch (error) {
    console.error('[Local Viking] Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/local-viking/templates/:templateId
 * Update a post template
 */
router.put('/templates/:templateId', requireDb, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { name, content, callToAction, ctaUrl, imageUrl, rotationDay, isActive } = req.body;

    const result = await sql`
      UPDATE gbp_post_templates
      SET
        name = COALESCE(${name}, name),
        content = COALESCE(${content}, content),
        call_to_action = COALESCE(${callToAction}, call_to_action),
        cta_url = COALESCE(${ctaUrl}, cta_url),
        image_url = COALESCE(${imageUrl}, image_url),
        rotation_day = COALESCE(${rotationDay}, rotation_day),
        is_active = COALESCE(${isActive}, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${templateId}
      RETURNING *
    `;

    res.json({ success: true, template: result[0] });

  } catch (error) {
    console.error('[Local Viking] Error updating template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/local-viking/templates/:templateId
 * Delete a post template
 */
router.delete('/templates/:templateId', requireDb, async (req, res) => {
  try {
    const { templateId } = req.params;

    await sql`DELETE FROM gbp_post_templates WHERE id = ${templateId}`;

    res.json({ success: true });

  } catch (error) {
    console.error('[Local Viking] Error deleting template:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// RINSE AND REPEAT AUTOMATION
// ============================================================================

/**
 * POST /api/local-viking/rinse-repeat/:websiteId
 * Execute the rinse and repeat cycle: delete old posts, repost templates
 */
router.post('/rinse-repeat/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const {
      maxAgeDays = 7,
      repostImmediately = true,
      useTemplates = true  // Use stored templates instead of reposting same content
    } = req.body;

    const creds = await getLocalVikingCredentials(websiteId);

    if (!creds.locationId) {
      return res.status(400).json({ error: 'No GBP location set for this website' });
    }

    let result;

    if (useTemplates) {
      // Get today's day of week (1-7, Monday = 1)
      const dayOfWeek = new Date().getDay() || 7;

      // Get template for today
      const templates = await sql`
        SELECT * FROM gbp_post_templates
        WHERE website_id = ${websiteId}
          AND is_active = true
          AND (rotation_day = ${dayOfWeek} OR rotation_day IS NULL)
        ORDER BY rotation_day NULLS LAST, last_posted_at ASC NULLS FIRST
        LIMIT 1
      `;

      if (templates.length === 0) {
        return res.json({
          success: true,
          message: 'No active templates for today',
          deleted: [],
          posted: []
        });
      }

      const template = templates[0];

      // Delete posts older than maxAgeDays
      result = await localViking.executeRinseAndRepeat(creds.apiKey, creds.locationId, {
        maxAgeDays,
        repostImmediately: false  // We'll post from template instead
      });

      // Post from template
      if (repostImmediately) {
        const postResult = await localViking.createGBPPost(creds.apiKey, {
          locationId: creds.locationId,
          content: template.content,
          callToAction: template.call_to_action,
          ctaUrl: template.cta_url,
          imageUrl: template.image_url
        });

        result.reposted.push({
          id: postResult.id,
          template: template.name,
          content: template.content.substring(0, 50) + '...'
        });
        result.creditsUsed++;

        // Update template last posted
        await sql`
          UPDATE gbp_post_templates
          SET last_posted_at = CURRENT_TIMESTAMP, times_posted = times_posted + 1
          WHERE id = ${template.id}
        `;

        // Log to history
        await sql`
          INSERT INTO gbp_post_history (
            website_id, post_id, template_id, content, call_to_action, cta_url
          ) VALUES (
            ${websiteId}, ${postResult.id || ''}, ${template.id}, ${template.content}, ${template.call_to_action}, ${template.cta_url}
          )
        `;
      }

    } else {
      // Standard rinse and repeat (repost same content)
      result = await localViking.executeRinseAndRepeat(creds.apiKey, creds.locationId, {
        maxAgeDays,
        repostImmediately
      });
    }

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[Local Viking] Rinse and repeat error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local-viking/rinse-repeat/status/:websiteId
 * Get rinse and repeat status - what posts are due for cycling
 */
router.get('/rinse-repeat/status/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { maxAgeDays = 7 } = req.query;

    const creds = await getLocalVikingCredentials(websiteId);

    if (!creds.locationId) {
      return res.status(400).json({ error: 'No GBP location set' });
    }

    // Get current posts
    const posts = await localViking.getGBPPosts(creds.apiKey, creds.locationId);

    const now = new Date();
    const maxAgeMs = parseInt(maxAgeDays) * 24 * 60 * 60 * 1000;

    const analysis = posts.map(post => {
      const postDate = new Date(post.created_at);
      const age = now - postDate;
      const ageInDays = Math.floor(age / (24 * 60 * 60 * 1000));
      const dueForRefresh = age > maxAgeMs;

      return {
        id: post.id,
        content: post.summary?.substring(0, 50) + '...',
        createdAt: post.created_at,
        ageInDays,
        dueForRefresh
      };
    });

    const dueCount = analysis.filter(p => p.dueForRefresh).length;

    // Get templates ready for posting
    const dayOfWeek = new Date().getDay() || 7;
    const templates = await sql`
      SELECT id, name, last_posted_at, times_posted
      FROM gbp_post_templates
      WHERE website_id = ${websiteId} AND is_active = true
      AND (rotation_day = ${dayOfWeek} OR rotation_day IS NULL)
    `;

    res.json({
      success: true,
      posts: analysis,
      summary: {
        total: posts.length,
        dueForRefresh: dueCount,
        fresh: posts.length - dueCount
      },
      templatesReady: templates.length,
      templates
    });

  } catch (error) {
    console.error('[Local Viking] Status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GBP PHOTOS
// ============================================================================

/**
 * POST /api/local-viking/photos
 * Upload a photo to GBP
 */
router.post('/photos', requireDb, async (req, res) => {
  try {
    const {
      websiteId,
      imageUrl,
      imageBase64,
      category = 'ADDITIONAL'
    } = req.body;

    const creds = await getLocalVikingCredentials(websiteId);

    if (!creds.locationId) {
      return res.status(400).json({ error: 'No GBP location set' });
    }

    let imageData = imageBase64;

    // If URL provided, fetch the image
    if (imageUrl && !imageBase64) {
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      imageData = Buffer.from(buffer);
    }

    if (!imageData) {
      return res.status(400).json({ error: 'Image data or URL required' });
    }

    const result = await localViking.uploadGBPPhoto(creds.apiKey, {
      locationId: creds.locationId,
      imageData,
      category
    });

    res.json({ success: true, photo: result });

  } catch (error) {
    console.error('[Local Viking] Photo upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local-viking/photos/:websiteId
 * Get all photos for a GBP location
 */
router.get('/photos/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const creds = await getLocalVikingCredentials(websiteId);

    if (!creds.locationId) {
      return res.status(400).json({ error: 'No GBP location set' });
    }

    const photos = await localViking.getGBPPhotos(creds.apiKey, creds.locationId);
    res.json({ success: true, photos });

  } catch (error) {
    console.error('[Local Viking] Error fetching photos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SITE PLANNING INTEGRATION - SHEEP HERDING STRATEGY
// ============================================================================

/**
 * POST /api/local-viking/analyze-site-plan/:planId
 * Analyze a site plan against rank data to identify sheep herding opportunities
 */
router.post('/analyze-site-plan/:planId', requireDb, async (req, res) => {
  try {
    const { planId } = req.params;
    const { scanKeywords = true, gridSize = 7 } = req.body;

    // Get global API key
    const apiKey = await getGlobalApiKey();
    if (!apiKey) {
      return res.status(400).json({
        error: 'Local Viking API key not configured. Set it in Settings.',
        needsConfiguration: true
      });
    }

    // Get site plan with website
    const plans = await sql`
      SELECT sp.*, w.id as website_id, w.local_viking_location_id
      FROM site_plans sp
      JOIN websites w ON sp.website_id = w.id
      WHERE sp.id = ${planId}
    `;

    if (plans.length === 0) {
      return res.status(404).json({ error: 'Site plan not found' });
    }

    const plan = plans[0];

    if (!plan.local_viking_location_id) {
      return res.status(400).json({
        error: 'Local Viking Location ID not configured for this website',
        needsConfiguration: true
      });
    }

    // Get site plan nodes with target keywords
    const nodes = await sql`
      SELECT * FROM site_plan_nodes
      WHERE site_plan_id = ${planId}
        AND target_keyword IS NOT NULL
        AND target_keyword != ''
      ORDER BY depth, sort_order
    `;

    const results = [];

    for (const node of nodes) {
      // Check if we already have recent rank data
      const recentSnapshot = await sql`
        SELECT * FROM rank_snapshots
        WHERE website_id = ${plan.website_id}
          AND keyword = ${node.target_keyword}
          AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      let analysis;

      if (recentSnapshot.length > 0) {
        // Use existing data
        analysis = recentSnapshot[0].analysis;
      } else if (scanKeywords) {
        // Run new scan
        try {
          const scanResult = await localViking.createGeoGridScan(apiKey, {
            locationId: plan.local_viking_location_id,
            keyword: node.target_keyword,
            gridSize
          });

          analysis = localViking.analyzeForSheepOpportunities(scanResult);

          // Save snapshot
          await sql`
            INSERT INTO rank_snapshots (
              website_id, keyword, grid_size, scan_id,
              average_rank, best_rank, top_3_count, sheep_score,
              grid_data, analysis
            ) VALUES (
              ${plan.website_id}, ${node.target_keyword}, ${gridSize}, ${scanResult.id || ''},
              ${analysis.average_rank || 0}, ${analysis.best_rank || 20}, ${analysis.top_3 || 0}, ${analysis.sheep_opportunity_score || 0},
              ${JSON.stringify(scanResult.grid_data || [])}, ${JSON.stringify(analysis)}
            )
          `;

        } catch (scanError) {
          analysis = { error: scanError.message };
        }
      } else {
        analysis = { noData: true, message: 'No recent rank data available' };
      }

      results.push({
        nodeId: node.id,
        title: node.title,
        keyword: node.target_keyword,
        depth: node.depth,
        isPillar: node.is_pillar_page,
        analysis
      });
    }

    // Sort by sheep opportunity score to prioritize content creation
    const prioritized = results
      .filter(r => r.analysis && r.analysis.sheep_opportunity_score)
      .sort((a, b) => parseFloat(b.analysis.sheep_opportunity_score) - parseFloat(a.analysis.sheep_opportunity_score));

    res.json({
      success: true,
      planId,
      totalNodes: nodes.length,
      analyzed: results.length,
      prioritizedForContent: prioritized.slice(0, 10).map(r => ({
        title: r.title,
        keyword: r.keyword,
        sheepScore: r.analysis.sheep_opportunity_score,
        recommendation: r.analysis.recommendation
      })),
      allResults: results
    });

  } catch (error) {
    console.error('[Local Viking] Site plan analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local-viking/sheep-opportunities/:websiteId
 * Get all keywords ready for "sheep herding" - close to top 3 but not there yet
 */
router.get('/sheep-opportunities/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;

    // Get latest snapshots grouped by keyword
    const snapshots = await sql`
      SELECT DISTINCT ON (keyword)
        keyword, average_rank, best_rank, top_3_count, sheep_score, analysis, created_at
      FROM rank_snapshots
      WHERE website_id = ${websiteId}
      ORDER BY keyword, created_at DESC
    `;

    // Filter for sheep opportunities (high sheep score = ready to push to top 3)
    const opportunities = snapshots
      .filter(s => parseFloat(s.sheep_score) > 5)  // Meaningful opportunity score
      .sort((a, b) => parseFloat(b.sheep_score) - parseFloat(a.sheep_score));

    res.json({
      success: true,
      opportunities: opportunities.map(s => ({
        keyword: s.keyword,
        sheepScore: s.sheep_score,
        avgRank: s.average_rank,
        bestRank: s.best_rank,
        top3Count: s.top_3_count,
        recommendation: s.analysis?.recommendation || 'Create supporting content',
        lastScanned: s.created_at
      })),
      totalKeywords: snapshots.length
    });

  } catch (error) {
    console.error('[Local Viking] Error fetching opportunities:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CREDIT ESTIMATION
// ============================================================================

/**
 * POST /api/local-viking/estimate-credits
 * Estimate monthly credit usage for planning
 */
router.post('/estimate-credits', async (req, res) => {
  try {
    const config = req.body;
    const estimate = localViking.estimateMonthlyCreditUsage(config);

    res.json({
      success: true,
      ...estimate
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
