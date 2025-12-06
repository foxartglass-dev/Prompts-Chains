// Google Business Profile API routes
import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';

const router = express.Router();

// GBP API endpoints
const GBP_API_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const GBP_ACCOUNTS_API = 'https://mybusinessaccountmanagement.googleapis.com/v1';

// Middleware to check database availability
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// GET OAuth URL for client authorization
router.get('/oauth/url', (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/gbp/oauth/callback`;

    if (!clientId) {
      return res.status(500).json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID in environment.' });
    }

    const scope = encodeURIComponent('https://www.googleapis.com/auth/business.manage');
    const state = req.query.locationId || ''; // Pass location ID to link after auth

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${state}`;

    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET OAuth callback (handles redirect from Google)
router.get('/oauth/callback', requireDb, async (req, res) => {
  try {
    const { code, state: locationId } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code not provided' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/gbp/oauth/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      return res.status(400).json({ error: tokens.error_description || tokens.error });
    }

    // Store tokens if location ID provided
    if (locationId) {
      const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

      await sql`
        INSERT INTO gbp_oauth_tokens (location_id, access_token, refresh_token, expires_at, scope)
        VALUES (${locationId}, ${tokens.access_token}, ${tokens.refresh_token}, ${expiresAt}, ${tokens.scope})
        ON CONFLICT (location_id)
        DO UPDATE SET
          access_token = ${tokens.access_token},
          refresh_token = COALESCE(${tokens.refresh_token}, gbp_oauth_tokens.refresh_token),
          expires_at = ${expiresAt},
          updated_at = CURRENT_TIMESTAMP
      `;

      // Redirect back to app with success
      return res.redirect(`/?gbp_connected=true&location_id=${locationId}`);
    }

    // Return tokens if no location ID (manual handling)
    res.json({ tokens });
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Get valid access token (refresh if needed)
async function getAccessToken(locationId) {
  const tokens = await sql`
    SELECT * FROM gbp_oauth_tokens WHERE location_id = ${locationId}
  `;

  if (tokens.length === 0) {
    throw new Error('No OAuth tokens found for this location');
  }

  const tokenData = tokens[0];

  // Check if token is expired (with 5 min buffer)
  const isExpired = new Date(tokenData.expires_at) < new Date(Date.now() + 5 * 60 * 1000);

  if (!isExpired) {
    return tokenData.access_token;
  }

  // Refresh the token
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokenData.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    })
  });

  const newTokens = await refreshResponse.json();

  if (newTokens.error) {
    throw new Error(newTokens.error_description || newTokens.error);
  }

  // Update stored token
  const expiresAt = new Date(Date.now() + (newTokens.expires_in * 1000));
  await sql`
    UPDATE gbp_oauth_tokens
    SET access_token = ${newTokens.access_token},
        expires_at = ${expiresAt},
        updated_at = CURRENT_TIMESTAMP
    WHERE location_id = ${locationId}
  `;

  return newTokens.access_token;
}

// GET accounts (list all GBP accounts for authenticated user)
router.get('/accounts/:locationId', requireDb, async (req, res) => {
  try {
    const { locationId } = req.params;
    const accessToken = await getAccessToken(locationId);

    const response = await fetch(`${GBP_ACCOUNTS_API}/accounts`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const data = await response.json();

    if (data.error) {
      return res.status(data.error.code || 400).json({ error: data.error.message });
    }

    res.json({ accounts: data.accounts || [] });
  } catch (error) {
    console.error('Error fetching GBP accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET locations for an account
router.get('/accounts/:accountId/locations/:locationId', requireDb, async (req, res) => {
  try {
    const { accountId, locationId } = req.params;
    const accessToken = await getAccessToken(locationId);

    const response = await fetch(`${GBP_API_BASE}/accounts/${accountId}/locations?readMask=name,title,storefrontAddress,regularHours,phoneNumbers,categories,profile,websiteUri,metadata`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const data = await response.json();

    if (data.error) {
      return res.status(data.error.code || 400).json({ error: data.error.message });
    }

    res.json({ locations: data.locations || [] });
  } catch (error) {
    console.error('Error fetching GBP locations:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST sync GBP data for a location
router.post('/sync/:locationId', requireDb, async (req, res) => {
  try {
    const { locationId } = req.params;
    const { gbpAccountId, gbpLocationId } = req.body;

    if (!gbpAccountId || !gbpLocationId) {
      return res.status(400).json({ error: 'GBP account ID and location ID are required' });
    }

    const accessToken = await getAccessToken(locationId);

    // Fetch location details
    const response = await fetch(
      `${GBP_API_BASE}/${gbpLocationId}?readMask=name,title,storefrontAddress,regularHours,phoneNumbers,categories,profile,websiteUri,metadata,serviceItems`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    const gbpData = await response.json();

    if (gbpData.error) {
      return res.status(gbpData.error.code || 400).json({ error: gbpData.error.message });
    }

    // Extract and structure the data
    const primaryCategory = gbpData.categories?.primaryCategory?.displayName || null;
    const categories = gbpData.categories?.additionalCategories?.map(c => ({
      id: c.name,
      name: c.displayName
    })) || [];

    // Add primary category to the list
    if (primaryCategory) {
      categories.unshift({
        id: gbpData.categories?.primaryCategory?.name,
        name: primaryCategory,
        isPrimary: true
      });
    }

    const services = gbpData.serviceItems?.map(s => ({
      id: s.structuredServiceItem?.serviceTypeId || s.freeFormServiceItem?.label,
      name: s.structuredServiceItem?.description || s.freeFormServiceItem?.label,
      price: s.price
    })) || [];

    // Update location in database
    await sql`
      UPDATE locations
      SET
        gbp_account_id = ${gbpAccountId},
        gbp_location_id = ${gbpLocationId},
        gbp_primary_category = ${primaryCategory},
        gbp_categories = ${JSON.stringify(categories)},
        gbp_services = ${JSON.stringify(services)},
        gbp_description = ${gbpData.profile?.description || null},
        gbp_hours = ${JSON.stringify(gbpData.regularHours || {})},
        gbp_phone = ${gbpData.phoneNumbers?.primaryPhone || null},
        gbp_website = ${gbpData.websiteUri || null},
        gbp_data = ${JSON.stringify(gbpData)},
        gbp_last_synced = CURRENT_TIMESTAMP,
        has_gbp = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${locationId}
      RETURNING *
    `;

    res.json({
      success: true,
      data: {
        primaryCategory,
        categories,
        services,
        description: gbpData.profile?.description,
        hours: gbpData.regularHours,
        phone: gbpData.phoneNumbers?.primaryPhone,
        website: gbpData.websiteUri
      }
    });
  } catch (error) {
    console.error('Error syncing GBP data:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET generate placeholders from GBP data
router.get('/placeholders/:locationId', requireDb, async (req, res) => {
  try {
    const { locationId } = req.params;

    const locations = await sql`
      SELECT * FROM locations WHERE id = ${locationId}
    `;

    if (locations.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const location = locations[0];

    // Generate placeholders from GBP data
    const placeholders = {
      // Basic info
      business_name: location.name,
      address: location.address,
      city: location.city,
      state: location.state,
      zip: location.zip,
      phone: location.gbp_phone || location.phone,
      website: location.gbp_website,

      // GBP specific
      primary_category: location.gbp_primary_category,
      business_description: location.gbp_description,
    };

    // Add categories as individual placeholders
    const categories = location.gbp_categories || [];
    categories.forEach((cat, idx) => {
      placeholders[`category_${idx + 1}`] = cat.name;
    });

    // Add services as individual placeholders
    const services = location.gbp_services || [];
    services.forEach((svc, idx) => {
      placeholders[`service_${idx + 1}`] = svc.name;
    });

    // Add custom placeholders from location
    const customPlaceholders = location.custom_placeholders || {};
    Object.assign(placeholders, customPlaceholders);

    res.json({ placeholders, raw: location });
  } catch (error) {
    console.error('Error generating placeholders:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST update custom placeholders for location
router.post('/placeholders/:locationId', requireDb, async (req, res) => {
  try {
    const { locationId } = req.params;
    const { placeholders } = req.body;

    const result = await sql`
      UPDATE locations
      SET custom_placeholders = ${JSON.stringify(placeholders || {})},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${locationId}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json({ location: result[0] });
  } catch (error) {
    console.error('Error updating custom placeholders:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET download location data as JSON template
router.get('/export/:locationId', requireDb, async (req, res) => {
  try {
    const { locationId } = req.params;

    const locations = await sql`
      SELECT l.*, c.name as client_name
      FROM locations l
      LEFT JOIN clients c ON l.client_id = c.id
      WHERE l.id = ${locationId}
    `;

    if (locations.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const location = locations[0];

    // Build export template
    const template = {
      exportDate: new Date().toISOString(),
      client: location.client_name,
      location: {
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        zip: location.zip,
        phone: location.phone
      },
      googleBusinessProfile: {
        primaryCategory: location.gbp_primary_category,
        categories: location.gbp_categories,
        services: location.gbp_services,
        description: location.gbp_description,
        hours: location.gbp_hours,
        phone: location.gbp_phone,
        website: location.gbp_website,
        lastSynced: location.gbp_last_synced
      },
      placeholders: {
        // Auto-generated from GBP
        business_name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        zip: location.zip,
        phone: location.gbp_phone || location.phone,
        website: location.gbp_website,
        primary_category: location.gbp_primary_category,
        business_description: location.gbp_description,
        // Custom placeholders
        ...location.custom_placeholders
      }
    };

    // Add indexed categories and services
    (location.gbp_categories || []).forEach((cat, idx) => {
      template.placeholders[`category_${idx + 1}`] = cat.name;
    });
    (location.gbp_services || []).forEach((svc, idx) => {
      template.placeholders[`service_${idx + 1}`] = svc.name;
    });

    res.json(template);
  } catch (error) {
    console.error('Error exporting location data:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET check OAuth status for location
router.get('/status/:locationId', requireDb, async (req, res) => {
  try {
    const { locationId } = req.params;

    const tokens = await sql`
      SELECT id, expires_at, updated_at FROM gbp_oauth_tokens WHERE location_id = ${locationId}
    `;

    const location = await sql`
      SELECT has_gbp, gbp_last_synced, gbp_primary_category FROM locations WHERE id = ${locationId}
    `;

    if (location.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const isConnected = tokens.length > 0;
    const isExpired = isConnected && new Date(tokens[0].expires_at) < new Date();

    res.json({
      connected: isConnected && !isExpired,
      hasGbp: location[0].has_gbp,
      lastSynced: location[0].gbp_last_synced,
      primaryCategory: location[0].gbp_primary_category,
      tokenExpired: isExpired
    });
  } catch (error) {
    console.error('Error checking GBP status:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
