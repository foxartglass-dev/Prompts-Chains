/**
 * WordPress Sync Service
 * Syncs page hierarchy from WordPress and caches for fast access
 * Used for mind map visualization and page browsing
 */

import { sql, isDatabaseEnabled } from '../db/index.js';

/**
 * Create Basic Auth header for WP REST API
 * @param {string} user - WordPress username
 * @param {string} password - WordPress application password
 * @returns {string} Base64 encoded auth header
 */
function createAuthHeader(user, password) {
  return 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
}

/**
 * Fetch all pages from WordPress with pagination
 * @param {Object} wpCredentials - { url, user, password }
 * @returns {Promise<Array>} Array of page objects from WP REST API
 */
async function fetchAllPages(wpCredentials) {
  const { url, user, password } = wpCredentials;
  const baseUrl = url.replace(/\/$/, '');
  const endpoint = `${baseUrl}/wp-json/wp/v2/pages`;

  let allPages = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${endpoint}?per_page=100&page=${page}&status=any`, {
      headers: { 'Authorization': createAuthHeader(user, password) }
    });

    if (!response.ok) {
      if (response.status === 400) {
        // No more pages (WP returns 400 when page param exceeds total)
        break;
      }
      throw new Error(`Failed to fetch pages: ${response.status} ${response.statusText}`);
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
 * Fetch all media items from WordPress
 * @param {Object} wpCredentials - { url, user, password }
 * @returns {Promise<Array>} Array of media objects
 */
async function fetchAllMedia(wpCredentials) {
  const { url, user, password } = wpCredentials;
  const baseUrl = url.replace(/\/$/, '');
  const endpoint = `${baseUrl}/wp-json/wp/v2/media`;

  let allMedia = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${endpoint}?per_page=100&page=${page}`, {
      headers: { 'Authorization': createAuthHeader(user, password) }
    });

    if (!response.ok) {
      if (response.status === 400) break;
      throw new Error(`Failed to fetch media: ${response.status}`);
    }

    const media = await response.json();
    allMedia = [...allMedia, ...media];

    const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1');
    hasMore = page < totalPages;
    page++;
  }

  return allMedia;
}

/**
 * Sync page hierarchy to database cache
 * @param {number} websiteId - Website ID in our database
 * @param {Object} wpCredentials - { url, user, password }
 * @returns {Promise<Object>} Sync result with count
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
    // Try to get Elementor data if available
    let elementorData = null;
    if (page.meta && page.meta._elementor_data) {
      try {
        elementorData = typeof page.meta._elementor_data === 'string'
          ? JSON.parse(page.meta._elementor_data)
          : page.meta._elementor_data;
      } catch (e) {
        // Ignore parse errors
      }
    }

    await sql`
      INSERT INTO wp_page_hierarchy (
        website_id, wp_page_id, wp_parent_id, title, slug, status, page_order, elementor_data
      ) VALUES (
        ${websiteId},
        ${page.id},
        ${page.parent || 0},
        ${page.title.rendered},
        ${page.slug},
        ${page.status},
        ${page.menu_order || 0},
        ${elementorData ? JSON.stringify(elementorData) : null}
      )
      ON CONFLICT (website_id, wp_page_id) DO UPDATE SET
        wp_parent_id = EXCLUDED.wp_parent_id,
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        status = EXCLUDED.status,
        page_order = EXCLUDED.page_order,
        elementor_data = EXCLUDED.elementor_data,
        synced_at = CURRENT_TIMESTAMP
    `;
  }

  return { synced: pages.length, websiteId };
}

/**
 * Get page hierarchy tree for mind map visualization
 * @param {number} websiteId - Website ID
 * @returns {Promise<Object>} Tree structure suitable for D3/react-flow
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

  // First pass: create map of all pages
  pages.forEach(page => {
    pageMap[page.wp_page_id] = {
      id: page.wp_page_id,
      dbId: page.id,
      title: page.title,
      slug: page.slug,
      status: page.status,
      children: []
    };
  });

  // Second pass: build tree by linking parents
  pages.forEach(page => {
    if (page.wp_parent_id === 0) {
      // Top-level page
      rootPages.push(pageMap[page.wp_page_id]);
    } else if (pageMap[page.wp_parent_id]) {
      // Has a parent we know about
      pageMap[page.wp_parent_id].children.push(pageMap[page.wp_page_id]);
    } else {
      // Orphan page (parent not found), add to root
      rootPages.push(pageMap[page.wp_page_id]);
    }
  });

  return {
    root: rootPages,
    total: pages.length,
    lastSynced: pages.length > 0 ? pages[0].synced_at : null
  };
}

/**
 * Get flat list of all pages for a website
 * @param {number} websiteId - Website ID
 * @returns {Promise<Array>} Flat array of pages
 */
async function getPageList(websiteId) {
  if (!isDatabaseEnabled()) {
    throw new Error('Database not configured');
  }

  const pages = await sql`
    SELECT * FROM wp_page_hierarchy
    WHERE website_id = ${websiteId}
    ORDER BY title
  `;

  return pages;
}

/**
 * Get Elementor data for a specific page (for overlay mapping)
 * @param {number} websiteId - Website ID
 * @param {number} wpPageId - WordPress page ID
 * @returns {Promise<Object|null>} Elementor data or null
 */
async function getPageElementorData(websiteId, wpPageId) {
  if (!isDatabaseEnabled()) {
    throw new Error('Database not configured');
  }

  const pages = await sql`
    SELECT elementor_data FROM wp_page_hierarchy
    WHERE website_id = ${websiteId} AND wp_page_id = ${wpPageId}
  `;

  if (pages.length === 0) return null;
  return pages[0].elementor_data;
}

export {
  fetchAllPages,
  fetchAllMedia,
  syncPageHierarchy,
  getHierarchyTree,
  getPageList,
  getPageElementorData
};

export default {
  fetchAllPages,
  fetchAllMedia,
  syncPageHierarchy,
  getHierarchyTree,
  getPageList,
  getPageElementorData
};
