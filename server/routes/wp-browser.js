/**
 * WordPress Browser API Routes
 * Handles page hierarchy, screenshots, and site sync
 */

import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';
import { syncPageHierarchy, getHierarchyTree, getPageList, getPageElementorData } from '../services/wp-sync-service.js';

// Screenshot service - optional, gracefully degrades if puppeteer unavailable
let screenshotService = null;
try {
  screenshotService = await import('../services/screenshot-service.js');
} catch (e) {
  console.warn('Screenshot service unavailable:', e.message);
}

const router = express.Router();

// Middleware to check database availability
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

/**
 * GET /api/wp-browser/health
 * Check if screenshot service is working (with debug info for Railway)
 */
router.get('/health', async (req, res) => {
  try {
    const fs = await import('fs');
    const { execSync } = await import('child_process');

    let puppeteerOk = false;
    let chromiumPath = null;
    let errorMsg = null;

    if (screenshotService?.checkPuppeteerHealth) {
      try {
        puppeteerOk = await screenshotService.checkPuppeteerHealth();
      } catch (e) {
        errorMsg = e.message;
      }
    }

    if (screenshotService?.getChromiumInfo) {
      chromiumPath = screenshotService.getChromiumInfo();
    }

    // Debug: Check which paths actually exist
    const pathsToCheck = [
      '/root/.nix-profile/bin/chromium',
      '/nix/var/nix/profiles/default/bin/chromium',
      '/home/nixuser/.nix-profile/bin/chromium',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      process.env.PUPPETEER_EXECUTABLE_PATH
    ].filter(Boolean);

    const pathStatus = {};
    for (const p of pathsToCheck) {
      try {
        pathStatus[p] = fs.existsSync(p) ? 'EXISTS' : 'not found';
      } catch {
        pathStatus[p] = 'error';
      }
    }

    // Try which command
    let whichResult = 'not found';
    try {
      whichResult = execSync('which chromium chromium-browser google-chrome 2>/dev/null || echo "none found"', { encoding: 'utf8' }).trim();
    } catch { }

    // Check /nix/store for chromium
    let nixStoreChromium = null;
    try {
      nixStoreChromium = execSync('find /nix/store -maxdepth 2 -name "chromium" -type d 2>/dev/null | head -3', { encoding: 'utf8' }).trim() || 'none found';
    } catch { }

    res.json({
      status: puppeteerOk ? 'ok' : 'degraded',
      puppeteer: puppeteerOk,
      puppeteerAvailable: !!screenshotService,
      chromiumPath: chromiumPath,
      error: errorMsg,
      database: isDatabaseEnabled(),
      env: {
        PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || null,
        PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD || null
      },
      debug: {
        pathStatus,
        whichResult,
        nixStoreChromium
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wp-browser/pages/:websiteId
 * Get all cached pages for a website
 */
router.get('/pages/:websiteId', requireDb, async (req, res) => {
  try {
    const pages = await getPageList(parseInt(req.params.websiteId));
    res.json({ pages });
  } catch (error) {
    console.error('Error getting pages:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wp-browser/hierarchy/:websiteId
 * Get page hierarchy tree for mind map visualization
 */
router.get('/hierarchy/:websiteId', requireDb, async (req, res) => {
  try {
    const tree = await getHierarchyTree(parseInt(req.params.websiteId));
    res.json(tree);
  } catch (error) {
    console.error('Error getting hierarchy:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/wp-browser/sync/:websiteId
 * Sync page hierarchy from WordPress to local cache
 */
router.post('/sync/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;

    // Get website credentials from database
    const websites = await sql`
      SELECT wp_url, wp_user, wp_app_password
      FROM websites WHERE id = ${websiteId}
    `;

    if (websites.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const { wp_url, wp_user, wp_app_password } = websites[0];

    if (!wp_url || !wp_user || !wp_app_password) {
      return res.status(400).json({ error: 'WordPress credentials not configured for this website' });
    }

    const result = await syncPageHierarchy(parseInt(websiteId), {
      url: wp_url,
      user: wp_user,
      password: wp_app_password
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error syncing hierarchy:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wp-browser/screenshot
 * Capture a screenshot of a page
 * Query params: url, websiteId (optional), authenticated (optional)
 */
router.get('/screenshot', async (req, res) => {
  try {
    if (!screenshotService) {
      return res.status(503).json({ error: 'Screenshot service not available. Puppeteer not installed.' });
    }

    const { url, websiteId, authenticated, width, height, fullPage } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const options = {
      width: width ? parseInt(width) : 1280,
      height: height ? parseInt(height) : 800,
      fullPage: fullPage !== 'false'
    };

    let screenshot;

    if (authenticated === 'true' && websiteId) {
      // Get website URL from database
      const websites = await sql`
        SELECT wp_url FROM websites WHERE id = ${websiteId}
      `;

      // Use WP_LOGIN_* env vars for browser authentication (separate from REST API app passwords)
      const loginUser = process.env.WP_LOGIN_USER;
      const loginPassword = process.env.WP_LOGIN_PASSWORD;

      if (websites.length > 0 && loginUser && loginPassword) {
        screenshot = await screenshotService.captureAuthenticatedPage(url, {
          url: websites[0].wp_url,
          user: loginUser,
          password: loginPassword
        }, options);
      } else {
        // Fall back to public capture
        screenshot = await screenshotService.captureScreenshot(url, options);
      }
    } else {
      screenshot = await screenshotService.captureScreenshot(url, options);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(screenshot);
  } catch (error) {
    console.error('Screenshot error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wp-browser/elements
 * Get element positions for overlay mapping
 * Query params: url, websiteId (optional)
 */
router.get('/elements', async (req, res) => {
  try {
    if (!screenshotService) {
      return res.status(503).json({ error: 'Screenshot service not available. Puppeteer not installed.' });
    }

    const { url, websiteId } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    let credentials = null;

    if (websiteId) {
      const websites = await sql`
        SELECT wp_url FROM websites WHERE id = ${websiteId}
      `;

      // Use WP_LOGIN_* env vars for browser authentication
      const loginUser = process.env.WP_LOGIN_USER;
      const loginPassword = process.env.WP_LOGIN_PASSWORD;

      if (websites.length > 0 && loginUser && loginPassword) {
        credentials = {
          url: websites[0].wp_url,
          user: loginUser,
          password: loginPassword
        };
      }
    }

    const result = await screenshotService.getElementPositions(url, credentials);
    res.json(result);
  } catch (error) {
    console.error('Element positions error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wp-browser/elementor-data/:websiteId/:wpPageId
 * Get cached Elementor data for a specific page
 */
router.get('/elementor-data/:websiteId/:wpPageId', requireDb, async (req, res) => {
  try {
    const { websiteId, wpPageId } = req.params;
    const data = await getPageElementorData(parseInt(websiteId), parseInt(wpPageId));

    if (!data) {
      return res.status(404).json({ error: 'Elementor data not found. Try syncing the site first.' });
    }

    res.json({ elementorData: data });
  } catch (error) {
    console.error('Elementor data error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
