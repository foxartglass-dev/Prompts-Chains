# Agent OS Blueprint: WordPress Articles Management Page

## Executive Summary

Build a comprehensive **Articles Page** for managing WordPress-published content. The page provides visual editing capabilities using screenshots with click-to-edit overlays, iframe browsing of live sites, hierarchical mind map visualization, and media library management.

---

## Standards Layer (Existing Tech Stack)

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** with custom brand colors (`brand-gold`, `brand-cyan`, `slate-900`)
- **Component Pattern**: Functional components with hooks
- **State Management**: Local state with `useState`, `useEffect`
- **API Pattern**: `fetch()` to `/api/*` endpoints

### Backend
- **Express.js** (ESM modules)
- **PostgreSQL** via `postgres` (Neon serverless)
- **File Pattern**: `server/routes/*.js` for API routes, `server/services/*.js` for business logic
- **WordPress Integration**: REST API with Basic Auth

### Existing Relevant Code
- `server/services/wordpress-publisher.js` - WP REST API integration
- `server/services/elementor-builder.js` - Elementor JSON structure building
- `src/components/ArticleManager.tsx` - Existing article list/editing (modal-based)
- `server/routes/articles.js` - Article CRUD operations

---

## Product Layer (Vision & Use Cases)

### Core Vision
Replace the current modal-based ArticleManager with a dedicated full-page Articles view that provides:
1. **Visual Editing** - Screenshot with overlays for clicking images/text to edit
2. **Site Navigation** - iframe browser for viewing any page on the WordPress site
3. **Hierarchy Visualization** - Mind map of parent/child page relationships
4. **Media Management** - View all images linked to pages, version history
5. **Batch Operations** - Multi-select for scheduling, publishing, deleting

### User Stories

#### US-1: View All Published Articles
> As a content manager, I want to see all WordPress-published articles across websites with filtering and search.

#### US-2: Edit Images via Visual Overlay
> As an editor, I want to click on an image in a page screenshot and replace it with a new AI-generated or uploaded image.

#### US-3: Edit Text via Visual Overlay
> As an editor, I want to click on text sections in a page screenshot and edit the content with a rich text editor.

#### US-4: Browse Live Site in iframe
> As a content manager, I want to navigate the actual WordPress site within PromptFlow to understand page context.

#### US-5: View Site Hierarchy
> As a content manager, I want to see a visual mind map of all pages showing parent/child relationships.

#### US-6: Manage Page Media
> As an editor, I want to see all images used on a page and view their version history.

---

## Specs Layer (Detailed Requirements)

### 1. Database Schema Additions

```sql
-- Image versions table for tracking replacements
CREATE TABLE IF NOT EXISTS image_versions (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  elementor_widget_id VARCHAR(50) NOT NULL,  -- 8-char hex ID from Elementor
  version INTEGER DEFAULT 1,
  image_url TEXT NOT NULL,
  wp_media_id INTEGER,
  image_prompt TEXT,                         -- AI prompt used to generate
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Page hierarchy cache (synced from WordPress)
CREATE TABLE IF NOT EXISTS wp_page_hierarchy (
  id SERIAL PRIMARY KEY,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  wp_page_id INTEGER NOT NULL,
  wp_parent_id INTEGER DEFAULT 0,
  title VARCHAR(500),
  slug VARCHAR(500),
  status VARCHAR(50),
  page_order INTEGER DEFAULT 0,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(website_id, wp_page_id)
);

CREATE INDEX IF NOT EXISTS idx_image_versions_article ON image_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_wp_hierarchy_website ON wp_page_hierarchy(website_id);
```

### 2. New API Routes

#### `server/routes/wp-browser.js`
```
GET  /api/wp-browser/pages/:websiteId       - Get all pages for website
GET  /api/wp-browser/hierarchy/:websiteId   - Get page hierarchy tree
POST /api/wp-browser/sync/:websiteId        - Sync hierarchy from WordPress
GET  /api/wp-browser/screenshot             - Capture page screenshot
```

#### `server/routes/image-versions.js`
```
GET  /api/image-versions/:articleId         - Get all image versions for article
POST /api/image-versions                    - Create new image version
GET  /api/image-versions/:id/history        - Get version history for specific widget
```

### 3. New Service Files

#### `server/services/screenshot-service.js`
- Uses Puppeteer for headless Chrome screenshots
- Supports authenticated capture for draft pages
- Returns base64 or saves to temp file

#### `server/services/wp-sync-service.js`
- Syncs page hierarchy from WordPress
- Caches to database for fast mind map rendering
- Handles parent/child relationships

### 4. Frontend Components

#### `src/pages/ArticlesPage.tsx` (Main Page)
- Tab-based navigation: List | Browser | Mind Map | Media
- Header with website selector dropdown
- Full-page layout (not modal)

#### `src/components/articles/ArticleListView.tsx`
- Enhanced table view (existing ArticleManager logic refactored)
- Batch selection checkboxes
- Inline quick actions

#### `src/components/articles/SiteBrowserView.tsx`
- iframe wrapper for WordPress site
- Navigation bar with URL display
- "Edit This Page" button integration

#### `src/components/articles/HierarchyView.tsx`
- D3.js or react-flow mind map
- Zoom/pan controls
- Click to navigate to page

#### `src/components/articles/VisualEditor.tsx`
- Screenshot display with overlay detection
- Click regions mapped to Elementor widget IDs
- Modal for image upload/generation
- Modal for text editing (TipTap)

#### `src/components/articles/MediaLibraryView.tsx`
- Grid of all images for selected page/website
- Version history sidebar
- Click to see which pages use each image

---

## Implementation Phases

### Phase 1: Core Infrastructure
1. Database migration for new tables
2. Screenshot service with Puppeteer
3. WP sync service for hierarchy
4. Basic ArticlesPage shell with tabs

### Phase 2: List & Browser Views
1. Refactor ArticleManager into ArticleListView
2. Implement SiteBrowserView with iframe
3. Add website selector and routing

### Phase 3: Visual Editor
1. Screenshot capture integration
2. Overlay system mapping Elementor IDs
3. Image replacement modal
4. Text editing modal with TipTap

### Phase 4: Hierarchy & Media
1. Mind map visualization
2. Media library grid
3. Version history tracking

---

## Code Snippets & Planned Changes

### File 1: `server/db/migrations/004_articles_page_tables.sql` (NEW)

```sql
-- Image versions for tracking edits
CREATE TABLE IF NOT EXISTS image_versions (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  elementor_widget_id VARCHAR(50) NOT NULL,
  version INTEGER DEFAULT 1,
  image_url TEXT NOT NULL,
  wp_media_id INTEGER,
  image_prompt TEXT,
  replacement_source VARCHAR(50) DEFAULT 'upload', -- 'upload', 'ai_generated', 'url'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WordPress page hierarchy cache
CREATE TABLE IF NOT EXISTS wp_page_hierarchy (
  id SERIAL PRIMARY KEY,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  wp_page_id INTEGER NOT NULL,
  wp_parent_id INTEGER DEFAULT 0,
  title VARCHAR(500),
  slug VARCHAR(500),
  status VARCHAR(50) DEFAULT 'publish',
  page_order INTEGER DEFAULT 0,
  elementor_data JSONB,  -- Cached Elementor structure for overlay mapping
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(website_id, wp_page_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_image_versions_article ON image_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_image_versions_widget ON image_versions(elementor_widget_id);
CREATE INDEX IF NOT EXISTS idx_wp_hierarchy_website ON wp_page_hierarchy(website_id);
CREATE INDEX IF NOT EXISTS idx_wp_hierarchy_parent ON wp_page_hierarchy(wp_parent_id);
```

---

### File 2: `server/services/screenshot-service.js` (NEW)

```javascript
/**
 * Screenshot Service
 * Captures WordPress page screenshots using Puppeteer
 */

import puppeteer from 'puppeteer';

/**
 * Capture a public page screenshot
 * @param {string} pageUrl - Full URL to capture
 * @param {Object} options - Screenshot options
 * @returns {Promise<Buffer>} PNG screenshot buffer
 */
async function captureScreenshot(pageUrl, options = {}) {
  const {
    width = 1280,
    height = 800,
    fullPage = true,
    waitFor = 2000  // Wait for page to render
  } = options;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait additional time for JS rendering
    await new Promise(r => setTimeout(r, waitFor));

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage
    });

    return screenshot;
  } finally {
    await browser.close();
  }
}

/**
 * Capture a draft/private page (requires WP authentication)
 * @param {string} pageUrl - URL to capture
 * @param {Object} wpCredentials - { url, user, password }
 * @param {Object} options - Screenshot options
 * @returns {Promise<Buffer>} PNG screenshot buffer
 */
async function captureAuthenticatedPage(pageUrl, wpCredentials, options = {}) {
  const { url: wpUrl, user, password } = wpCredentials;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: options.width || 1280, height: options.height || 800 });

    // Navigate to WP login
    const loginUrl = `${wpUrl.replace(/\/$/, '')}/wp-login.php`;
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });

    // Fill login form
    await page.type('#user_login', user);
    await page.type('#user_pass', password);
    await page.click('#wp-submit');

    // Wait for redirect after login
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Now navigate to the actual page
    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, options.waitFor || 2000));

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: options.fullPage !== false
    });

    return screenshot;
  } finally {
    await browser.close();
  }
}

/**
 * Get element positions from page for overlay mapping
 * @param {string} pageUrl - URL to analyze
 * @param {Object} wpCredentials - Optional auth credentials
 * @returns {Promise<Array>} Array of element positions with IDs
 */
async function getElementPositions(pageUrl, wpCredentials = null) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    if (wpCredentials) {
      // Login first
      const loginUrl = `${wpCredentials.url.replace(/\/$/, '')}/wp-login.php`;
      await page.goto(loginUrl, { waitUntil: 'networkidle2' });
      await page.type('#user_login', wpCredentials.user);
      await page.type('#user_pass', wpCredentials.password);
      await page.click('#wp-submit');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }

    await page.goto(pageUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Extract Elementor widget positions
    const positions = await page.evaluate(() => {
      const elements = [];

      // Find all Elementor widgets with images
      document.querySelectorAll('[data-id]').forEach(el => {
        const rect = el.getBoundingClientRect();
        const widgetType = el.dataset.widget_type || el.dataset.element_type;

        if (rect.width > 0 && rect.height > 0) {
          elements.push({
            id: el.dataset.id,
            type: widgetType,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            isImage: el.querySelector('img') !== null,
            isText: el.querySelector('.elementor-text-editor, .elementor-heading-title') !== null
          });
        }
      });

      return elements;
    });

    return positions;
  } finally {
    await browser.close();
  }
}

export {
  captureScreenshot,
  captureAuthenticatedPage,
  getElementPositions
};

export default {
  captureScreenshot,
  captureAuthenticatedPage,
  getElementPositions
};
```

---

### File 3: `server/services/wp-sync-service.js` (NEW)

```javascript
/**
 * WordPress Sync Service
 * Syncs page hierarchy and caches for fast access
 */

import { sql, isDatabaseEnabled } from '../db/index.js';

/**
 * Create auth header for WP REST API
 */
function createAuthHeader(user, password) {
  return 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
}

/**
 * Fetch all pages from WordPress
 * @param {Object} wpCredentials - { url, user, password }
 * @returns {Promise<Array>} Array of page objects
 */
async function fetchAllPages(wpCredentials) {
  const { url, user, password } = wpCredentials;
  const endpoint = `${url.replace(/\/$/, '')}/wp-json/wp/v2/pages`;

  let allPages = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${endpoint}?per_page=100&page=${page}&status=any`, {
      headers: { 'Authorization': createAuthHeader(user, password) }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch pages: ${response.status}`);
    }

    const pages = await response.json();
    allPages = [...allPages, ...pages];

    // Check if there are more pages
    const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1');
    hasMore = page < totalPages;
    page++;
  }

  return allPages;
}

/**
 * Sync page hierarchy to database
 * @param {number} websiteId - Website ID in our database
 * @param {Object} wpCredentials - { url, user, password }
 * @returns {Promise<Object>} Sync result
 */
async function syncPageHierarchy(websiteId, wpCredentials) {
  if (!isDatabaseEnabled()) {
    throw new Error('Database not configured');
  }

  const pages = await fetchAllPages(wpCredentials);

  // Clear existing hierarchy for this website
  await sql`DELETE FROM wp_page_hierarchy WHERE website_id = ${websiteId}`;

  // Insert new hierarchy
  for (const page of pages) {
    await sql`
      INSERT INTO wp_page_hierarchy (
        website_id, wp_page_id, wp_parent_id, title, slug, status, page_order
      ) VALUES (
        ${websiteId},
        ${page.id},
        ${page.parent || 0},
        ${page.title.rendered},
        ${page.slug},
        ${page.status},
        ${page.menu_order || 0}
      )
      ON CONFLICT (website_id, wp_page_id) DO UPDATE SET
        wp_parent_id = EXCLUDED.wp_parent_id,
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        status = EXCLUDED.status,
        page_order = EXCLUDED.page_order,
        synced_at = CURRENT_TIMESTAMP
    `;
  }

  return { synced: pages.length, websiteId };
}

/**
 * Get page hierarchy tree for visualization
 * @param {number} websiteId - Website ID
 * @returns {Promise<Object>} Tree structure for mind map
 */
async function getHierarchyTree(websiteId) {
  if (!isDatabaseEnabled()) {
    throw new Error('Database not configured');
  }

  const pages = await sql`
    SELECT * FROM wp_page_hierarchy
    WHERE website_id = ${websiteId}
    ORDER BY page_order, title
  `;

  // Build tree structure
  const pageMap = {};
  const rootPages = [];

  // First pass: create map
  pages.forEach(page => {
    pageMap[page.wp_page_id] = {
      id: page.wp_page_id,
      title: page.title,
      slug: page.slug,
      status: page.status,
      children: []
    };
  });

  // Second pass: build tree
  pages.forEach(page => {
    if (page.wp_parent_id === 0) {
      rootPages.push(pageMap[page.wp_page_id]);
    } else if (pageMap[page.wp_parent_id]) {
      pageMap[page.wp_parent_id].children.push(pageMap[page.wp_page_id]);
    } else {
      // Orphan page, add to root
      rootPages.push(pageMap[page.wp_page_id]);
    }
  });

  return { root: rootPages, total: pages.length };
}

export {
  fetchAllPages,
  syncPageHierarchy,
  getHierarchyTree
};

export default {
  fetchAllPages,
  syncPageHierarchy,
  getHierarchyTree
};
```

---

### File 4: `server/routes/wp-browser.js` (NEW)

```javascript
/**
 * WordPress Browser API Routes
 * Handles page hierarchy, screenshots, and sync
 */

import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';
import { syncPageHierarchy, getHierarchyTree } from '../services/wp-sync-service.js';
import { captureScreenshot, captureAuthenticatedPage, getElementPositions } from '../services/screenshot-service.js';

const router = express.Router();

// Middleware
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// GET hierarchy tree for mind map
router.get('/hierarchy/:websiteId', requireDb, async (req, res) => {
  try {
    const tree = await getHierarchyTree(parseInt(req.params.websiteId));
    res.json(tree);
  } catch (error) {
    console.error('Error getting hierarchy:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST sync hierarchy from WordPress
router.post('/sync/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;

    // Get website credentials
    const websites = await sql`
      SELECT wp_url, wp_user, wp_app_password
      FROM websites WHERE id = ${websiteId}
    `;

    if (websites.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const { wp_url, wp_user, wp_app_password } = websites[0];

    if (!wp_url || !wp_user || !wp_app_password) {
      return res.status(400).json({ error: 'WordPress credentials not configured' });
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

// GET screenshot of a page
router.get('/screenshot', async (req, res) => {
  try {
    const { url, websiteId, authenticated } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    let screenshot;

    if (authenticated === 'true' && websiteId) {
      // Get credentials
      const websites = await sql`
        SELECT wp_url, wp_user, wp_app_password
        FROM websites WHERE id = ${websiteId}
      `;

      if (websites.length > 0 && websites[0].wp_user) {
        screenshot = await captureAuthenticatedPage(url, {
          url: websites[0].wp_url,
          user: websites[0].wp_user,
          password: websites[0].wp_app_password
        });
      } else {
        screenshot = await captureScreenshot(url);
      }
    } else {
      screenshot = await captureScreenshot(url);
    }

    res.setHeader('Content-Type', 'image/png');
    res.send(screenshot);
  } catch (error) {
    console.error('Screenshot error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET element positions for overlay mapping
router.get('/elements', async (req, res) => {
  try {
    const { url, websiteId } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    let credentials = null;

    if (websiteId) {
      const websites = await sql`
        SELECT wp_url, wp_user, wp_app_password
        FROM websites WHERE id = ${websiteId}
      `;

      if (websites.length > 0 && websites[0].wp_user) {
        credentials = {
          url: websites[0].wp_url,
          user: websites[0].wp_user,
          password: websites[0].wp_app_password
        };
      }
    }

    const positions = await getElementPositions(url, credentials);
    res.json({ elements: positions });
  } catch (error) {
    console.error('Element positions error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

### File 5: `server/routes/image-versions.js` (NEW)

```javascript
/**
 * Image Versions API Routes
 * Tracks image replacement history
 */

import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';

const router = express.Router();

const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// GET all image versions for an article
router.get('/:articleId', requireDb, async (req, res) => {
  try {
    const versions = await sql`
      SELECT * FROM image_versions
      WHERE article_id = ${req.params.articleId}
      ORDER BY elementor_widget_id, version DESC
    `;
    res.json({ versions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET version history for specific widget
router.get('/:articleId/widget/:widgetId', requireDb, async (req, res) => {
  try {
    const versions = await sql`
      SELECT * FROM image_versions
      WHERE article_id = ${req.params.articleId}
        AND elementor_widget_id = ${req.params.widgetId}
      ORDER BY version DESC
    `;
    res.json({ versions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create new image version
router.post('/', requireDb, async (req, res) => {
  try {
    const { articleId, elementorWidgetId, imageUrl, wpMediaId, imagePrompt, source } = req.body;

    // Get current max version
    const maxVersion = await sql`
      SELECT COALESCE(MAX(version), 0) as max_version
      FROM image_versions
      WHERE article_id = ${articleId} AND elementor_widget_id = ${elementorWidgetId}
    `;

    const newVersion = maxVersion[0].max_version + 1;

    const result = await sql`
      INSERT INTO image_versions (
        article_id, elementor_widget_id, version, image_url, wp_media_id, image_prompt, replacement_source
      ) VALUES (
        ${articleId}, ${elementorWidgetId}, ${newVersion}, ${imageUrl}, ${wpMediaId || null}, ${imagePrompt || null}, ${source || 'upload'}
      )
      RETURNING *
    `;

    res.status(201).json({ version: result[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

### File 6: `src/pages/ArticlesPage.tsx` (NEW)

```tsx
import React, { useState, useEffect } from 'react';
import ArticleListView from '../components/articles/ArticleListView';
import SiteBrowserView from '../components/articles/SiteBrowserView';
import HierarchyView from '../components/articles/HierarchyView';
import MediaLibraryView from '../components/articles/MediaLibraryView';

interface Website {
  id: number;
  name: string;
  wp_url: string;
  client_name?: string;
}

type ViewTab = 'list' | 'browser' | 'hierarchy' | 'media';

const ArticlesPage: React.FC = () => {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('list');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWebsites();
  }, []);

  const fetchWebsites = async () => {
    try {
      const res = await fetch('/api/websites');
      if (res.ok) {
        const data = await res.json();
        setWebsites(data);
        if (data.length > 0) {
          setSelectedWebsite(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch websites:', err);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: ViewTab; label: string; icon: JSX.Element }[] = [
    {
      id: 'list',
      label: 'Articles',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      )
    },
    {
      id: 'browser',
      label: 'Browse Site',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      )
    },
    {
      id: 'hierarchy',
      label: 'Site Map',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'media',
      label: 'Media',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    }
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <div className="text-brand-cyan">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-brand-cyan/30 bg-slate-900">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-brand-gold">Articles</h1>

          {/* Website Selector */}
          <select
            value={selectedWebsite?.id || ''}
            onChange={(e) => {
              const website = websites.find(w => w.id === parseInt(e.target.value));
              setSelectedWebsite(website || null);
            }}
            className="bg-slate-800 border border-brand-cyan/30 rounded-lg px-3 py-1.5 text-white text-sm"
          >
            <option value="">All Websites</option>
            {websites.map(w => (
              <option key={w.id} value={w.id}>
                {w.name} {w.client_name ? `(${w.client_name})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-cyan text-slate-900'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'list' && (
          <ArticleListView websiteId={selectedWebsite?.id} />
        )}
        {activeTab === 'browser' && selectedWebsite && (
          <SiteBrowserView website={selectedWebsite} />
        )}
        {activeTab === 'hierarchy' && selectedWebsite && (
          <HierarchyView websiteId={selectedWebsite.id} />
        )}
        {activeTab === 'media' && (
          <MediaLibraryView websiteId={selectedWebsite?.id} />
        )}

        {/* No website selected warnings */}
        {(activeTab === 'browser' || activeTab === 'hierarchy') && !selectedWebsite && (
          <div className="h-full flex items-center justify-center text-gray-500">
            Please select a website to view this tab
          </div>
        )}
      </main>
    </div>
  );
};

export default ArticlesPage;
```

---

### File 7: `server/index.js` (MODIFY - add new routes)

**Add imports at top:**
```javascript
import wpBrowserRoutes from './routes/wp-browser.js';
import imageVersionRoutes from './routes/image-versions.js';
```

**Add routes before final middleware:**
```javascript
app.use('/api/wp-browser', wpBrowserRoutes);
app.use('/api/image-versions', imageVersionRoutes);
```

---

### File 8: `package.json` (MODIFY - add puppeteer)

**Add to dependencies:**
```json
{
  "dependencies": {
    "puppeteer": "^21.6.1"
  }
}
```

---

## Summary of All Changes

| File | Action | Description |
|------|--------|-------------|
| `server/db/migrations/004_articles_page_tables.sql` | CREATE | New tables for image versions and page hierarchy |
| `server/services/screenshot-service.js` | CREATE | Puppeteer-based screenshot capture |
| `server/services/wp-sync-service.js` | CREATE | WordPress hierarchy sync service |
| `server/routes/wp-browser.js` | CREATE | API routes for browsing/screenshots |
| `server/routes/image-versions.js` | CREATE | API routes for image version tracking |
| `src/pages/ArticlesPage.tsx` | CREATE | Main Articles page with tabs |
| `src/components/articles/ArticleListView.tsx` | CREATE | Refactored list from ArticleManager |
| `src/components/articles/SiteBrowserView.tsx` | CREATE | iframe wrapper for site browsing |
| `src/components/articles/HierarchyView.tsx` | CREATE | Mind map visualization |
| `src/components/articles/MediaLibraryView.tsx` | CREATE | Media grid with history |
| `src/components/articles/VisualEditor.tsx` | CREATE | Screenshot overlay editor |
| `server/index.js` | MODIFY | Add new route imports |
| `package.json` | MODIFY | Add puppeteer dependency |

---

## Approval Checklist

Before implementation, please confirm:

- [ ] Database schema additions are acceptable
- [ ] Puppeteer dependency is approved for deployment environment
- [ ] Tab structure (List, Browser, Site Map, Media) meets needs
- [ ] Screenshot-based visual editing approach is confirmed
- [ ] Phase order is acceptable (infrastructure → views → editor → media)

---

*Blueprint created: December 22, 2025*
*Ready for user approval before implementation*
