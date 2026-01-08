/**
 * WordPress Health Monitoring API Routes
 *
 * Provides endpoints for monitoring WordPress media library health,
 * storage usage, and cleanup capabilities.
 */

import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

/**
 * Helper function to call WordPress REST API
 */
async function wpApiCall(wpUrl, endpoint, credentials, method = 'GET', body = null) {
  const url = `${wpUrl}/wp-json/wp/v2${endpoint}`;
  const auth = Buffer.from(`${credentials.user}:${credentials.password}`).toString('base64');

  const options = {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`WP API error: ${response.status} ${response.statusText}`);
  }

  return response;
}

/**
 * GET /api/wp-health/media-stats
 * Get media library statistics from WordPress
 */
router.get('/media-stats', async (req, res) => {
  try {
    const { wpUrl, wpUser, wpPassword } = req.query;

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required (wpUrl, wpUser, wpPassword)' });
    }

    const credentials = { user: wpUser, password: wpPassword };

    // Get total media count
    const mediaResponse = await wpApiCall(wpUrl, '/media?per_page=1', credentials);
    const totalMedia = parseInt(mediaResponse.headers.get('x-wp-total') || '0');
    const totalPages = parseInt(mediaResponse.headers.get('x-wp-totalpages') || '0');

    // Get recent media (last 10 items)
    const recentResponse = await wpApiCall(wpUrl, '/media?per_page=10&orderby=date&order=desc', credentials);
    const recentMedia = await recentResponse.json();

    // Calculate estimated storage (based on media details if available)
    let estimatedStorageMB = 0;
    let mediaByType = { image: 0, video: 0, audio: 0, document: 0, other: 0 };

    // Sample the recent items to estimate average file size
    if (recentMedia.length > 0) {
      for (const item of recentMedia) {
        const mimeType = item.mime_type || '';
        if (mimeType.startsWith('image/')) {
          mediaByType.image++;
        } else if (mimeType.startsWith('video/')) {
          mediaByType.video++;
        } else if (mimeType.startsWith('audio/')) {
          mediaByType.audio++;
        } else if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text/')) {
          mediaByType.document++;
        } else {
          mediaByType.other++;
        }
      }

      // Rough estimation: 200KB average per image, scale by total
      const imageRatio = mediaByType.image / recentMedia.length;
      estimatedStorageMB = Math.round((totalMedia * imageRatio * 0.2) + (totalMedia * (1 - imageRatio) * 0.5));
    }

    res.json({
      success: true,
      stats: {
        totalMedia,
        totalPages,
        estimatedStorageMB,
        mediaByType,
        recentItems: recentMedia.map(m => ({
          id: m.id,
          title: m.title?.rendered || 'Untitled',
          url: m.source_url,
          mimeType: m.mime_type,
          date: m.date
        })),
        checkedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[WP Health] Media stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/wp-health/cleanup-unused
 * Find and optionally delete unused media in WordPress
 * (Media not attached to any post/page)
 */
router.post('/cleanup-unused', async (req, res) => {
  try {
    const { wpUrl, wpUser, wpPassword, dryRun = true, limit = 50 } = req.body;

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const credentials = { user: wpUser, password: wpPassword };

    // Get unattached media (parent = 0)
    const unattachedResponse = await wpApiCall(
      wpUrl,
      `/media?per_page=${Math.min(limit, 100)}&parent=0`,
      credentials
    );
    const unattachedMedia = await unattachedResponse.json();

    const result = {
      found: unattachedMedia.length,
      items: unattachedMedia.map(m => ({
        id: m.id,
        title: m.title?.rendered || 'Untitled',
        url: m.source_url,
        mimeType: m.mime_type,
        date: m.date
      })),
      deleted: 0,
      dryRun
    };

    // If not a dry run, delete the unattached media
    if (!dryRun && unattachedMedia.length > 0) {
      let deleted = 0;
      for (const media of unattachedMedia) {
        try {
          await wpApiCall(wpUrl, `/media/${media.id}?force=true`, credentials, 'DELETE');
          deleted++;
        } catch (delError) {
          console.error(`[WP Health] Failed to delete media ${media.id}:`, delError.message);
        }
      }
      result.deleted = deleted;
    }

    res.json({ success: true, result });

  } catch (error) {
    console.error('[WP Health] Cleanup error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/wp-health/media/:mediaId
 * Delete a specific media item from WordPress
 */
router.delete('/media/:mediaId', async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { wpUrl, wpUser, wpPassword } = req.body;

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const credentials = { user: wpUser, password: wpPassword };

    await wpApiCall(wpUrl, `/media/${mediaId}?force=true`, credentials, 'DELETE');

    res.json({ success: true, deleted: mediaId });

  } catch (error) {
    console.error('[WP Health] Delete media error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wp-health/check-connection
 * Test WordPress connection and credentials
 */
router.get('/check-connection', async (req, res) => {
  try {
    const { wpUrl, wpUser, wpPassword } = req.query;

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const credentials = { user: wpUser, password: wpPassword };

    // Try to get current user info
    const url = `${wpUrl}/wp-json/wp/v2/users/me`;
    const auth = Buffer.from(`${credentials.user}:${credentials.password}`).toString('base64');

    const response = await fetch(url, {
      headers: { 'Authorization': `Basic ${auth}` }
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const userData = await response.json();

    res.json({
      success: true,
      connection: {
        connected: true,
        user: userData.name,
        capabilities: userData.capabilities ? Object.keys(userData.capabilities).filter(k => userData.capabilities[k]).slice(0, 10) : []
      }
    });

  } catch (error) {
    console.error('[WP Health] Connection check error:', error);
    res.json({
      success: false,
      connection: {
        connected: false,
        error: error.message
      }
    });
  }
});

export default router;
