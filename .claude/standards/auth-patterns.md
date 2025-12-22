# Authentication Standards

**Version:** 1.0
**Last Updated:** 2024-12-22
**Applies To:** All enterprise-grade applications

---

## Enterprise Auth Provider: Auth0

### Why Auth0
| Requirement | Auth0 Capability |
|-------------|------------------|
| Enterprise-accepted | Owned by Okta (public company) |
| SOC 2/HIPAA/PCI | Fully compliant |
| Acquisition-ready | Corporations already use it |
| Multi-tenant | Organizations feature |
| Social login | Built-in (when needed) |
| MFA | Built-in (when needed) |

### Configuration Standards

#### Token Lifetimes (Internal Business Tools)
```
Access Token: 3600 seconds (1 hour)
Refresh Token: 7776000 seconds (90 days)
Session Absolute: 7776000 seconds (90 days)
Session Inactivity: 2592000 seconds (30 days)
```

#### Token Lifetimes (Public SaaS)
```
Access Token: 3600 seconds (1 hour)
Refresh Token: 1209600 seconds (14 days)
Session Absolute: 604800 seconds (7 days)
Session Inactivity: 86400 seconds (1 day)
```

---

## Authentication Flow Patterns

### Pattern 1: Hybrid IP + Token Auth (Internal Tools)

Best for: Internal business tools, admin panels, team apps

```
Request → IP Whitelist Check → [PASS] → Access Granted
                ↓ [FAIL]
         Token Validation → [PASS] → Access Granted
                ↓ [FAIL]
         Redirect to Auth0 Login
```

**Implementation:**
- Check IP first (zero latency for known IPs)
- Fall back to JWT validation
- Long session lifetimes (90 days)

### Pattern 2: Token-Only Auth (Public SaaS)

Best for: Customer-facing applications

```
Request → Token Validation → [PASS] → Access Granted
                ↓ [FAIL]
         Redirect to Auth0 Login
```

**Implementation:**
- No IP whitelist
- Shorter session lifetimes
- Require re-auth for sensitive actions

### Pattern 3: API Key Auth (Integrations)

Best for: Third-party integrations, webhooks, API access

```
Request → API Key Header Check → [PASS] → Access Granted
                ↓ [FAIL]
         Return 401 Unauthorized
```

**Implementation:**
- Separate from user auth
- Keys stored hashed in database
- Rate limiting per key
- Scoped permissions

---

## Middleware Structure

### Standard Auth Middleware
```javascript
// /server/middleware/auth.js

const authMiddleware = async (req, res, next) => {
  // Layer 1: IP Whitelist (optional, for internal tools)
  if (config.enableIPWhitelist) {
    const clientIP = getClientIP(req);
    if (isWhitelistedIP(clientIP)) {
      req.auth = { type: 'ip_whitelist', ip: clientIP };
      return next();
    }
  }

  // Layer 2: JWT Validation
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Authentication required'
    });
  }

  try {
    const decoded = await verifyToken(token);
    req.auth = { type: 'token', user: decoded };
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'invalid_token',
      message: 'Token invalid or expired'
    });
  }
};
```

### IP Extraction (Proxy-Aware)
```javascript
const getClientIP = (req) => {
  // Trust X-Forwarded-For only in production behind known proxy
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
  }
  return req.socket.remoteAddress;
};
```

---

## Frontend Auth Standards

### Provider Wrapper Pattern
```typescript
// /src/components/auth/AuthProvider.tsx
import { Auth0Provider } from '@auth0/auth0-react';

export const AuthProvider = ({ children }) => {
  const config = useAuthConfig(); // Fetch from /api/auth/config

  return (
    <Auth0Provider
      domain={config.domain}
      clientId={config.clientId}
      authorizationParams={{
        redirect_uri: `${window.location.origin}/callback`,
        audience: config.audience,
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      {children}
    </Auth0Provider>
  );
};
```

### Protected Route Pattern
```typescript
// /src/components/auth/ProtectedRoute.tsx
export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth0();
  const { data: ipStatus } = useIPStatus();

  if (isLoading) return <LoadingSpinner />;
  if (ipStatus?.whitelisted) return <>{children}</>;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
```

### API Client Token Injection
```typescript
// /src/services/api-client.ts
import axios from 'axios';

const createApiClient = (getToken: () => Promise<string>) => {
  const client = axios.create({ baseURL: '/api' });

  client.interceptors.request.use(async (config) => {
    try {
      const token = await getToken();
      config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // Token fetch failed, request will get 401
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Trigger re-auth flow
        window.dispatchEvent(new Event('auth:expired'));
      }
      return Promise.reject(error);
    }
  );

  return client;
};
```

---

## Environment Variables Standard

### Naming Convention
```env
# Auth provider config
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=

# Session config
SESSION_SECRET=
SESSION_MAX_AGE_DAYS=

# Security
IP_WHITELIST=
TRUST_PROXY=
```

### Required vs Optional
| Variable | Required | Default |
|----------|----------|---------|
| AUTH0_DOMAIN | Yes | - |
| AUTH0_CLIENT_ID | Yes | - |
| AUTH0_CLIENT_SECRET | Yes (backend) | - |
| AUTH0_AUDIENCE | Yes | - |
| SESSION_SECRET | Yes | - |
| SESSION_MAX_AGE_DAYS | No | 90 |
| IP_WHITELIST | No | "" (disabled) |
| TRUST_PROXY | No | false |

---

## Error Response Standards

### Authentication Errors
```javascript
// 401 Unauthorized - Not authenticated
{
  error: 'unauthorized',
  message: 'Authentication required',
  code: 'AUTH_REQUIRED'
}

// 401 Unauthorized - Invalid token
{
  error: 'invalid_token',
  message: 'Token invalid or expired',
  code: 'TOKEN_INVALID'
}

// 403 Forbidden - Authenticated but not authorized
{
  error: 'forbidden',
  message: 'Insufficient permissions',
  code: 'PERMISSION_DENIED'
}
```

---

## Security Checklist

### Backend
- [ ] JWT signature validated with Auth0 JWKS
- [ ] Token audience validated
- [ ] Token issuer validated
- [ ] Expired tokens rejected
- [ ] HTTPS enforced in production
- [ ] CORS restricted to known origins
- [ ] Rate limiting applied

### Frontend
- [ ] Tokens stored in localStorage (with refresh tokens)
- [ ] Token refreshed silently before expiry
- [ ] Logout clears all stored tokens
- [ ] Auth state not persisted in URL
- [ ] Sensitive routes wrapped in ProtectedRoute

### Infrastructure
- [ ] Auth0 tenant configured correctly
- [ ] Callback URLs restricted
- [ ] Logout URLs restricted
- [ ] API audience defined
- [ ] Refresh token rotation enabled

---

## Multi-User / Organizations

### Auth0 Organizations Setup
1. Enable Organizations in Auth0 Dashboard
2. Create organization for each "workspace" or "team"
3. Invite users to organization via email
4. Access organization ID in token claims

### Token Claims with Organizations
```javascript
{
  sub: "auth0|abc123",
  email: "user@example.com",
  org_id: "org_abc123",
  org_name: "My Team",
  permissions: ["read:articles", "write:articles"]
}
```

---

## References

- Auth0 Architecture Scenarios: https://auth0.com/docs/architecture-scenarios
- Auth0 Security Best Practices: https://auth0.com/docs/security
- OWASP Authentication Cheatsheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
