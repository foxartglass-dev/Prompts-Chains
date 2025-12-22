import express from 'express';
import { getClientIp, isIpWhitelisted, hybridAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/auth/config
 * Returns Auth0 configuration for frontend initialization
 * Public endpoint - no auth required
 */
router.get('/config', (req, res) => {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const audience = process.env.AUTH0_AUDIENCE;

  if (!domain || !clientId) {
    return res.status(500).json({
      error: 'configuration_error',
      message: 'Auth0 not configured on server'
    });
  }

  res.json({
    domain,
    clientId,
    audience,
    // Don't expose client secret to frontend!
  });
});

/**
 * GET /api/auth/ip-status
 * Check if current IP is whitelisted (for frontend to know if login is needed)
 * Public endpoint - no auth required
 */
router.get('/ip-status', (req, res) => {
  const clientIp = getClientIp(req);
  const whitelisted = isIpWhitelisted(clientIp);

  res.json({
    ip: clientIp,
    whitelisted,
    // If whitelisted, frontend can skip showing login
    requiresLogin: !whitelisted
  });
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 * Protected endpoint - requires auth (IP whitelist or token)
 */
router.get('/me', hybridAuth, (req, res) => {
  const { type, payload, ip } = req.auth || {};

  if (type === 'ip_whitelist') {
    return res.json({
      authenticated: true,
      authType: 'ip_whitelist',
      user: {
        sub: 'ip-whitelisted-user',
        ip: ip,
        name: 'Whitelisted User',
        email: null
      }
    });
  }

  if (type === 'token') {
    return res.json({
      authenticated: true,
      authType: 'token',
      user: {
        sub: payload.sub,
        email: payload.email || payload['https://promptflow.local/email'],
        name: payload.name || payload['https://promptflow.local/name'],
        picture: payload.picture || payload['https://promptflow.local/picture'],
        // Include any custom claims
        org_id: payload.org_id,
        permissions: payload.permissions || []
      }
    });
  }

  // Not authenticated
  res.json({
    authenticated: false,
    authType: 'none',
    user: null
  });
});

/**
 * POST /api/auth/logout
 * Server-side logout handler (optional - mainly for logging)
 * The actual logout happens client-side with Auth0
 */
router.post('/logout', hybridAuth, (req, res) => {
  // Log the logout for audit purposes
  const { type, payload } = req.auth || {};
  console.log(`User logged out: ${payload?.sub || 'unknown'} (${type})`);

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * GET /api/auth/check
 * Quick auth check endpoint - returns 200 if authenticated, 401 if not
 * Useful for frontend to verify auth state
 */
router.get('/check', hybridAuth, (req, res) => {
  res.json({
    authenticated: true,
    authType: req.auth?.type || 'unknown'
  });
});

export default router;
