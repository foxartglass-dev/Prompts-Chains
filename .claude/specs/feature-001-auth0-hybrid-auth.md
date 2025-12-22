# Feature Spec: Auth0 Hybrid Authentication System

**Feature ID:** 001
**Status:** Blueprint
**Priority:** High
**Created:** 2024-12-22

---

## Overview

Implement enterprise-grade authentication using Auth0 with a hybrid session management approach optimized for internal business tools. The system combines long-lived sessions with IP whitelist bypass to minimize login friction while maintaining security.

---

## Business Requirements

### Context
- PromptFlow is an internal business tool used by a small team (2 users initially)
- Must be protected from public internet access
- Enterprise-grade auth required for future acquisition potential
- Current PIN-based auth to be replaced entirely

### Users
| User | Role | Access |
|------|------|--------|
| Owner | Admin | Full access, user management |
| Business Partner | Team Member | Full app access |
| Future Team | Team Members | Invite-based access |

### Success Criteria
- [ ] Users can log in with email/password via Auth0
- [ ] Sessions persist for 90 days on trusted devices
- [ ] Known IP addresses bypass session checks entirely
- [ ] Owner can invite business partner to shared workspace
- [ ] PIN system completely removed
- [ ] All API routes protected

---

## Technical Specification

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        REQUEST FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Incoming Request                                               │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────┐                                               │
│  │ IP Check    │──── Known IP? ──── YES ───► Access Granted    │
│  └─────────────┘                                               │
│       │ NO                                                      │
│       ▼                                                         │
│  ┌─────────────┐                                               │
│  │Session Check│──── Valid JWT? ─── YES ───► Access Granted    │
│  └─────────────┘                                               │
│       │ NO                                                      │
│       ▼                                                         │
│  ┌─────────────┐                                               │
│  │ Auth0 Login │──── Authenticate ─────────► Access Granted    │
│  └─────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Auth0 Configuration

#### Application Settings
| Setting | Value | Rationale |
|---------|-------|-----------|
| Application Type | Regular Web Application | Standard SPA with backend |
| Token Endpoint Auth | None (Public) | SPA client |
| Allowed Callback URLs | `http://localhost:3000/callback`, `https://[production-url]/callback` | OAuth redirect |
| Allowed Logout URLs | `http://localhost:3000`, `https://[production-url]` | Post-logout redirect |
| Allowed Web Origins | `http://localhost:3000`, `https://[production-url]` | CORS |

#### Session Settings (Auth0 Dashboard)
| Setting | Value | Rationale |
|---------|-------|-----------|
| Absolute Session Lifetime | 90 days (7776000 seconds) | Minimize re-login for internal tool |
| Inactivity Session Lifetime | 30 days (2592000 seconds) | Allow gaps in usage |
| Refresh Token Rotation | Enabled | Security best practice |
| Refresh Token Absolute Lifetime | 90 days | Match session lifetime |
| Refresh Token Inactivity Lifetime | 30 days | Match inactivity setting |

#### Organization Settings (Multi-User)
| Setting | Value |
|---------|-------|
| Organization Name | `promptflow-team` (or customizable) |
| Enable Organizations | Yes |
| User Invitation | Email-based |

---

## Implementation Layers

### Layer 1: Environment Configuration

#### New Environment Variables
```env
# Auth0 Configuration
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_AUDIENCE=https://api.promptflow.local
AUTH0_CALLBACK_URL=http://localhost:3000/callback

# Session Configuration
SESSION_SECRET=random-32-char-string-here
SESSION_MAX_AGE_DAYS=90

# IP Whitelist (comma-separated)
IP_WHITELIST=123.45.67.89,98.76.54.32

# Remove these (deprecated)
# APP_PIN=xxxx (remove)
```

#### .env.example Updates
Add Auth0 section with clear documentation:
```env
# ===========================================
# AUTHENTICATION (Auth0 - Enterprise)
# ===========================================
# Create account at: https://auth0.com
# Create "Regular Web Application"
# Configure callback URLs as shown in docs

AUTH0_DOMAIN=           # e.g., your-app.us.auth0.com
AUTH0_CLIENT_ID=        # From Auth0 Dashboard > Applications
AUTH0_CLIENT_SECRET=    # From Auth0 Dashboard > Applications
AUTH0_AUDIENCE=         # API identifier (create in Auth0 > APIs)
AUTH0_CALLBACK_URL=     # http://localhost:3000/callback (dev)

# Session
SESSION_SECRET=         # Generate: openssl rand -hex 32

# IP Whitelist (bypass auth for known IPs)
IP_WHITELIST=           # Comma-separated: 1.2.3.4,5.6.7.8
```

---

### Layer 2: Backend Authentication Middleware

#### File: `/server/middleware/auth.js`

**Responsibilities:**
1. Check IP whitelist first (fast path)
2. Validate Auth0 JWT token
3. Attach user info to request
4. Handle token refresh

**Middleware Chain:**
```javascript
// Pseudocode - structure only
const authMiddleware = async (req, res, next) => {
  // 1. Extract client IP
  const clientIP = getClientIP(req);

  // 2. Check IP whitelist (fast path - no token needed)
  if (isWhitelistedIP(clientIP)) {
    req.user = { type: 'whitelisted', ip: clientIP };
    return next();
  }

  // 3. Extract and validate JWT
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // 4. Verify with Auth0
  const decoded = await verifyAuth0Token(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // 5. Attach user to request
  req.user = decoded;
  next();
};
```

**Helper Functions Needed:**
| Function | Purpose |
|----------|---------|
| `getClientIP(req)` | Extract real IP (handle proxies, X-Forwarded-For) |
| `isWhitelistedIP(ip)` | Check against IP_WHITELIST env var |
| `extractBearerToken(req)` | Get token from Authorization header |
| `verifyAuth0Token(token)` | Validate JWT with Auth0 JWKS |

---

### Layer 3: Backend Routes

#### File: `/server/routes/auth.js`

**Endpoints:**

| Method | Endpoint | Purpose | Protected |
|--------|----------|---------|-----------|
| GET | `/api/auth/config` | Return Auth0 config for frontend | No |
| GET | `/api/auth/me` | Get current user info | Yes |
| POST | `/api/auth/logout` | Clear session (optional server-side) | Yes |
| GET | `/api/auth/ip-status` | Check if current IP is whitelisted | No |

**Response Structures:**

```javascript
// GET /api/auth/config
{
  domain: "your-tenant.auth0.com",
  clientId: "abc123",
  audience: "https://api.promptflow.local",
  redirectUri: "http://localhost:3000/callback"
}

// GET /api/auth/me
{
  authenticated: true,
  authType: "token" | "ip_whitelist",
  user: {
    sub: "auth0|123",
    email: "user@example.com",
    name: "John Doe",
    picture: "https://...",
    org_id: "org_abc123"
  }
}

// GET /api/auth/ip-status
{
  ip: "123.45.67.89",
  whitelisted: true
}
```

---

### Layer 4: Frontend Auth Integration

#### Package: `@auth0/auth0-react`

**Provider Setup (index.tsx or App.tsx wrapper):**
```typescript
// Pseudocode - structure only
<Auth0Provider
  domain={AUTH0_DOMAIN}
  clientId={AUTH0_CLIENT_ID}
  authorizationParams={{
    redirect_uri: window.location.origin + '/callback',
    audience: AUTH0_AUDIENCE,
  }}
  cacheLocation="localstorage"  // Persist across tabs/refreshes
  useRefreshTokens={true}        // Enable refresh token rotation
>
  <App />
</Auth0Provider>
```

#### Auth Hook Usage
```typescript
// In components that need auth
const {
  isAuthenticated,
  isLoading,
  user,
  loginWithRedirect,
  logout,
  getAccessTokenSilently
} = useAuth0();
```

#### Protected Route Component
```typescript
// Pseudocode
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth0();
  const { isIPWhitelisted } = useIPStatus(); // Custom hook

  if (isLoading) return <LoadingSpinner />;
  if (isIPWhitelisted) return children; // Bypass for known IPs
  if (!isAuthenticated) return <LoginPage />;

  return children;
};
```

---

### Layer 5: Frontend Components

#### New Components Required

| Component | Location | Purpose |
|-----------|----------|---------|
| `AuthProvider.tsx` | `/src/components/auth/` | Auth0 provider wrapper with config |
| `LoginPage.tsx` | `/src/components/auth/` | Login UI (can use Auth0 Universal Login or custom) |
| `AuthCallback.tsx` | `/src/components/auth/` | Handle OAuth callback redirect |
| `ProtectedRoute.tsx` | `/src/components/auth/` | Route wrapper for auth check |
| `UserMenu.tsx` | `/src/components/auth/` | User avatar, name, logout button |

#### LoginPage Options

**Option A: Auth0 Universal Login (Recommended)**
- Redirect to Auth0-hosted login page
- Zero UI code needed
- Handles password reset, MFA, etc.
- More secure (credentials never touch your app)

**Option B: Custom Login Form**
- Build your own form
- Use Auth0 SDK to authenticate
- More control over design
- More code to maintain

**Recommendation:** Start with Universal Login, customize later if needed.

---

### Layer 6: Database Changes

#### Users Table (Optional - for app-specific data)

If you want to store app-specific user preferences/settings:

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth0_id VARCHAR(255) UNIQUE NOT NULL,  -- "auth0|abc123"
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'member',  -- 'admin', 'member'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  preferences JSONB DEFAULT '{}'
);

CREATE INDEX idx_users_auth0_id ON users(auth0_id);
CREATE INDEX idx_users_email ON users(email);
```

#### Migration: Remove PIN-related Code

| Location | Action |
|----------|--------|
| `/server/index.js` | Remove PIN verification endpoint |
| `/server/index.js` | Remove PIN middleware |
| `/src/components/PinLock.tsx` | Delete file |
| `App.tsx` | Remove PinLock component usage |
| `.env` | Remove `APP_PIN` variable |

---

### Layer 7: API Client Updates

#### Axios/Fetch Interceptor

All API calls must include Auth0 token:

```typescript
// Pseudocode
const apiClient = axios.create({ baseURL: '/api' });

apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessTokenSilently();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `/server/middleware/auth.js` | Auth middleware (IP + JWT) |
| `/server/routes/auth.js` | Auth API endpoints |
| `/src/components/auth/AuthProvider.tsx` | Auth0 React provider |
| `/src/components/auth/LoginPage.tsx` | Login UI |
| `/src/components/auth/AuthCallback.tsx` | OAuth callback handler |
| `/src/components/auth/ProtectedRoute.tsx` | Route protection wrapper |
| `/src/components/auth/UserMenu.tsx` | User avatar/logout |
| `/src/hooks/useAuth.ts` | Custom auth hook (wraps Auth0) |
| `/src/services/auth-service.ts` | Auth API client |

### Modified Files
| File | Changes |
|------|---------|
| `/server/index.js` | Add auth middleware, remove PIN logic |
| `/src/index.tsx` | Wrap with AuthProvider |
| `App.tsx` | Remove PinLock, add ProtectedRoute |
| `/src/services/llm-service.ts` | Add auth token to requests |
| `.env.example` | Add Auth0 config section |
| `package.json` | Add Auth0 dependencies |

### Deleted Files
| File | Reason |
|------|--------|
| `/src/components/PinLock.tsx` | Replaced by Auth0 |

---

## Dependencies

### Backend (npm)
```json
{
  "express-oauth2-jwt-bearer": "^1.6.0",  // Auth0 JWT validation
  "jwks-rsa": "^3.1.0"                      // JWKS key fetching
}
```

### Frontend (npm)
```json
{
  "@auth0/auth0-react": "^2.2.4"  // Auth0 React SDK
}
```

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Token storage | Use `localStorage` with refresh tokens (acceptable for internal tool) |
| IP spoofing | Trust X-Forwarded-For only from known proxies |
| Token expiry | Short-lived access tokens (1 hour) + refresh tokens |
| CORS | Restrict to known origins |
| HTTPS | Required in production |

---

## Testing Checklist

### Manual Testing
- [ ] Login with email/password works
- [ ] Session persists after browser close/reopen
- [ ] Session persists after 24 hours
- [ ] Whitelisted IP bypasses login entirely
- [ ] Non-whitelisted IP requires login
- [ ] Logout clears session
- [ ] API calls include auth token
- [ ] Invalid token returns 401
- [ ] Expired token triggers refresh
- [ ] Multiple tabs work simultaneously

### Edge Cases
- [ ] Session expired + valid refresh token = silent refresh
- [ ] Session expired + invalid refresh token = redirect to login
- [ ] IP changes mid-session = still works (token valid)
- [ ] New device = login required
- [ ] Invite new user = receives email, can log in

---

## Rollout Plan

### Phase 1: Setup (No Code Changes)
1. Create Auth0 account and application
2. Configure Auth0 settings as specified
3. Set up organization for multi-user
4. Test Auth0 Universal Login manually
5. Document credentials in secure location

### Phase 2: Backend Implementation
1. Install dependencies
2. Create auth middleware
3. Create auth routes
4. Apply middleware to all `/api/*` routes
5. Test with Postman/curl

### Phase 3: Frontend Implementation
1. Install dependencies
2. Create AuthProvider wrapper
3. Create LoginPage component
4. Create ProtectedRoute wrapper
5. Update App.tsx with auth flow
6. Update API clients with token injection

### Phase 4: Cleanup
1. Remove PinLock component
2. Remove PIN-related code from server
3. Update .env.example
4. Update documentation

### Phase 5: Multi-User
1. Invite business partner via Auth0
2. Verify shared access works
3. Test concurrent sessions

---

## Future Enhancements (Out of Scope)

- [ ] Google/Social login
- [ ] Role-based access control (RBAC)
- [ ] Audit logging
- [ ] MFA/2FA enforcement
- [ ] Session management UI (view/revoke sessions)
- [ ] API rate limiting per user

---

## References

- Auth0 React SDK: https://auth0.com/docs/libraries/auth0-react
- Auth0 Express API: https://auth0.com/docs/quickstart/backend/nodejs
- JWT Validation: https://auth0.com/docs/secure/tokens/json-web-tokens/validate-json-web-tokens
- Organizations: https://auth0.com/docs/manage-users/organizations

---

**Blueprint Status:** Ready for implementation approval
