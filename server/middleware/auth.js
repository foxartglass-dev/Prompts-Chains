import { auth } from 'express-oauth2-jwt-bearer';

/**
 * Auth0 Hybrid Authentication Middleware
 *
 * Authentication flow:
 * 1. Check if IP is whitelisted (fast path - no token needed)
 * 2. If not whitelisted, validate Auth0 JWT token
 *
 * This allows internal users on known IPs to bypass login
 * while still requiring authentication from unknown locations.
 */

// Get client IP address (handles proxies like Railway)
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
}

// Check if IP is in whitelist
export function isIpWhitelisted(ip) {
  const whitelist = process.env.IP_WHITELIST || '';
  if (!whitelist) return false;

  const whitelistedIps = whitelist.split(',').map(ip => ip.trim()).filter(Boolean);
  if (whitelistedIps.length === 0) return false;

  // Normalize IPv6-mapped IPv4 addresses
  const normalizedIp = ip?.replace('::ffff:', '') || '';

  return whitelistedIps.some(wip =>
    wip === ip || wip === normalizedIp || normalizedIp.endsWith(wip)
  );
}

// Create Auth0 JWT validator (lazy initialization)
let jwtValidator = null;

function getJwtValidator() {
  if (!jwtValidator && process.env.AUTH0_DOMAIN && process.env.AUTH0_AUDIENCE) {
    jwtValidator = auth({
      audience: process.env.AUTH0_AUDIENCE,
      issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
      tokenSigningAlg: 'RS256'
    });
  }
  return jwtValidator;
}

/**
 * Hybrid auth middleware - IP whitelist OR JWT token
 *
 * Use this for routes that should be accessible to:
 * - Users on whitelisted IPs (no login required)
 * - Users with valid Auth0 JWT tokens
 */
export function hybridAuth(req, res, next) {
  const clientIp = getClientIp(req);

  // Fast path: IP whitelist bypass
  if (isIpWhitelisted(clientIp)) {
    req.auth = {
      type: 'ip_whitelist',
      ip: clientIp,
      payload: { sub: 'ip-whitelisted-user' }
    };
    return next();
  }

  // Check if Auth0 is configured
  const validator = getJwtValidator();
  if (!validator) {
    // Auth0 not configured - allow access but log warning
    console.warn('Auth0 not configured - allowing unauthenticated access');
    req.auth = {
      type: 'none',
      payload: { sub: 'anonymous' }
    };
    return next();
  }

  // Validate JWT token
  validator(req, res, (err) => {
    if (err) {
      // Token invalid or missing
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Token valid - attach auth info
    req.auth = {
      type: 'token',
      payload: req.auth?.payload || {}
    };
    next();
  });
}

/**
 * Strict auth middleware - JWT token required (no IP bypass)
 *
 * Use this for sensitive operations that should always require login,
 * even from whitelisted IPs.
 */
export function strictAuth(req, res, next) {
  const validator = getJwtValidator();

  if (!validator) {
    return res.status(500).json({
      error: 'configuration_error',
      message: 'Auth0 not configured',
      code: 'AUTH_NOT_CONFIGURED'
    });
  }

  validator(req, res, (err) => {
    if (err) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    req.auth = {
      type: 'token',
      payload: req.auth?.payload || {}
    };
    next();
  });
}

/**
 * Optional auth middleware - validates token if present, but doesn't require it
 *
 * Use this for routes that work differently for authenticated vs anonymous users.
 */
export function optionalAuth(req, res, next) {
  const clientIp = getClientIp(req);

  // Check IP whitelist first
  if (isIpWhitelisted(clientIp)) {
    req.auth = {
      type: 'ip_whitelist',
      ip: clientIp,
      payload: { sub: 'ip-whitelisted-user' }
    };
    return next();
  }

  // Check for Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token - continue as anonymous
    req.auth = {
      type: 'none',
      payload: { sub: 'anonymous' }
    };
    return next();
  }

  // Validate token if present
  const validator = getJwtValidator();
  if (!validator) {
    req.auth = {
      type: 'none',
      payload: { sub: 'anonymous' }
    };
    return next();
  }

  validator(req, res, (err) => {
    if (err) {
      // Invalid token - continue as anonymous rather than failing
      req.auth = {
        type: 'none',
        payload: { sub: 'anonymous' }
      };
      return next();
    }

    req.auth = {
      type: 'token',
      payload: req.auth?.payload || {}
    };
    next();
  });
}

export default hybridAuth;
