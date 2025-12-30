/**
 * WordPress Publisher Service
 * Handles publishing pages to WordPress with Elementor formatting
 *
 * Features:
 * - Create pages with Elementor meta data
 * - Upload media to WordPress media library
 * - Schedule pages for future publishing (drip feed)
 * - Update existing pages
 */

/**
 * Create Basic Auth header for WordPress REST API
 * @param {string} username - WordPress username
 * @param {string} appPassword - WordPress application password
 * @returns {string} Base64 encoded auth string
 */
function createAuthHeader(username, appPassword) {
  return 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64');
}

/**
 * Upload an image to WordPress media library
 * @param {Object} wpCredentials - { url, user, password }
 * @param {Buffer|string} imageData - Image data (Buffer or base64 string)
 * @param {string} filename - Filename for the image
 * @param {Object} options - Additional options { alt, caption, description }
 * @returns {Promise<Object>} WordPress media object with id and url
 */
async function uploadMedia(wpCredentials, imageData, filename, options = {}) {
  const { url, user, password } = wpCredentials;
  const { alt = '', caption = '', description = '' } = options;

  const endpoint = `${url.replace(/\/$/, '')}/wp-json/wp/v2/media`;

  // Convert base64 to buffer if needed
  let buffer = imageData;
  if (typeof imageData === 'string') {
    buffer = Buffer.from(imageData, 'base64');
  }

  // Determine content type from filename
  const ext = filename.split('.').pop().toLowerCase();
  const contentTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };
  const contentType = contentTypes[ext] || 'image/jpeg';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': createAuthHeader(user, password),
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`
      },
      body: buffer
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WordPress media upload failed: ${response.status} - ${errorText}`);
    }

    const mediaData = await response.json();

    // Update media with alt text and other metadata if provided
    if (alt || caption || description) {
      await fetch(`${endpoint}/${mediaData.id}`, {
        method: 'POST',
        headers: {
          'Authorization': createAuthHeader(user, password),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alt_text: alt,
          caption: caption,
          description: description
        })
      });
    }

    return {
      id: mediaData.id,
      url: mediaData.source_url || mediaData.guid?.rendered,
      width: mediaData.media_details?.width,
      height: mediaData.media_details?.height,
      alt: alt
    };
  } catch (error) {
    console.error('Media upload error:', error);
    throw error;
  }
}

/**
 * Create a new WordPress page with Elementor formatting
 * @param {Object} wpCredentials - { url, user, password }
 * @param {Object} pageData - Page data
 * @param {string} pageData.title - Page title
 * @param {string} pageData.slug - URL slug (optional)
 * @param {Object} pageData.elementorData - Elementor JSON structure
 * @param {string} pageData.status - 'draft', 'publish', or 'future'
 * @param {string} pageData.publishDate - ISO date for scheduled publishing
 * @param {number} pageData.featuredImage - Media ID for featured image
 * @param {number} pageData.parent - Parent page WordPress ID for hierarchy (optional)
 * @param {number} pageData.menuOrder - Menu order/sort position (optional)
 * @returns {Promise<Object>} Created page data
 */
async function createElementorPage(wpCredentials, pageData) {
  const { url, user, password } = wpCredentials;
  const {
    title,
    slug,
    elementorData,
    elementorMeta,
    status = 'draft',
    publishDate,
    featuredImage,
    parent,      // WordPress page ID of parent page for hierarchy
    menuOrder    // Sort order within parent
  } = pageData;

  const endpoint = `${url.replace(/\/$/, '')}/wp-json/wp/v2/pages`;

  // Build the request body
  const body = {
    title: title,
    status: status,
    content: '', // Elementor pages have empty content field
    meta: elementorMeta || {}
  };

  // Add slug if provided
  if (slug) {
    body.slug = slug;
  }

  // Add parent page for hierarchy (critical for site structure)
  if (parent) {
    body.parent = parent;
  }

  // Add menu order for sorting within siblings
  if (menuOrder !== undefined) {
    body.menu_order = menuOrder;
  }

  // Add scheduled date if publishing in future
  if (status === 'future' && publishDate) {
    body.date_gmt = publishDate;
  }

  // Add featured image if provided
  if (featuredImage) {
    body.featured_media = featuredImage;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': createAuthHeader(user, password),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WordPress page creation failed: ${response.status} - ${errorText}`);
    }

    const pageResult = await response.json();

    return {
      success: true,
      id: pageResult.id,
      link: pageResult.link,
      editLink: `${url.replace(/\/$/, '')}/wp-admin/post.php?post=${pageResult.id}&action=elementor`,
      status: pageResult.status,
      slug: pageResult.slug,
      parent: pageResult.parent || 0,
      menuOrder: pageResult.menu_order || 0
    };
  } catch (error) {
    console.error('Page creation error:', error);
    throw error;
  }
}

/**
 * Update an existing WordPress page
 * @param {Object} wpCredentials - { url, user, password }
 * @param {number} pageId - WordPress page ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated page data
 */
async function updatePage(wpCredentials, pageId, updateData) {
  const { url, user, password } = wpCredentials;
  const endpoint = `${url.replace(/\/$/, '')}/wp-json/wp/v2/pages/${pageId}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST', // WordPress uses POST for updates
      headers: {
        'Authorization': createAuthHeader(user, password),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WordPress page update failed: ${response.status} - ${errorText}`);
    }

    const pageResult = await response.json();

    return {
      success: true,
      id: pageResult.id,
      link: pageResult.link,
      status: pageResult.status
    };
  } catch (error) {
    console.error('Page update error:', error);
    throw error;
  }
}

/**
 * Get a page by ID to check its current state
 * @param {Object} wpCredentials - { url, user, password }
 * @param {number} pageId - WordPress page ID
 * @returns {Promise<Object>} Page data
 */
async function getPage(wpCredentials, pageId) {
  const { url, user, password } = wpCredentials;
  const endpoint = `${url.replace(/\/$/, '')}/wp-json/wp/v2/pages/${pageId}`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': createAuthHeader(user, password)
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get page: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get page error:', error);
    throw error;
  }
}

/**
 * Get all draft pages from WordPress
 * @param {Object} wpCredentials - { url, user, password }
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of draft pages
 */
async function getDraftPages(wpCredentials, options = {}) {
  const { url, user, password } = wpCredentials;
  const { perPage = 100, page = 1 } = options;

  const endpoint = `${url.replace(/\/$/, '')}/wp-json/wp/v2/pages?status=draft&per_page=${perPage}&page=${page}`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': createAuthHeader(user, password)
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get draft pages: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get draft pages error:', error);
    throw error;
  }
}

/**
 * Schedule multiple pages for drip feed publishing
 * @param {Object} wpCredentials - { url, user, password }
 * @param {Array<number>} pageIds - Array of page IDs to schedule
 * @param {Object} options - Scheduling options
 * @returns {Promise<Array>} Results for each page
 */
async function scheduleDripFeed(wpCredentials, pageIds, options = {}) {
  const {
    pagesPerDay = 5,
    startDate = new Date(),
    publishTime = '09:00',
    randomize = true
  } = options;

  const results = [];
  let currentDate = new Date(startDate);
  let pagesScheduledToday = 0;

  // Helper to get randomized count
  const getRandomizedCount = (target) => {
    if (!randomize) return target;
    const offset = Math.floor(Math.random() * 5) - 2; // -2, -1, 0, +1, +2
    return Math.max(1, Math.min(target + offset, target + 2));
  };

  let dailyTarget = getRandomizedCount(pagesPerDay);

  for (const pageId of pageIds) {
    // Move to next day if we've hit the daily target
    if (pagesScheduledToday >= dailyTarget) {
      currentDate.setDate(currentDate.getDate() + 1);
      pagesScheduledToday = 0;
      dailyTarget = getRandomizedCount(pagesPerDay);
    }

    // Build publish datetime
    const [hours, minutes] = publishTime.split(':');
    const publishDateTime = new Date(currentDate);
    publishDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // Add some randomization to the time (within 2 hours)
    if (randomize) {
      const randomMinutes = Math.floor(Math.random() * 120);
      publishDateTime.setMinutes(publishDateTime.getMinutes() + randomMinutes);
    }

    try {
      const result = await updatePage(wpCredentials, pageId, {
        status: 'future',
        date_gmt: publishDateTime.toISOString()
      });

      results.push({
        pageId,
        success: true,
        scheduledDate: publishDateTime.toISOString(),
        ...result
      });
    } catch (error) {
      results.push({
        pageId,
        success: false,
        error: error.message
      });
    }

    pagesScheduledToday++;
  }

  return results;
}

/**
 * Test WordPress connection
 * @param {Object} wpCredentials - { url, user, password }
 * @returns {Promise<Object>} Connection test result
 */
async function testConnection(wpCredentials) {
  const { url, user, password } = wpCredentials;
  const endpoint = `${url.replace(/\/$/, '')}/wp-json/wp/v2/users/me`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': createAuthHeader(user, password)
      }
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Authentication failed: ${response.status}`
      };
    }

    const userData = await response.json();

    return {
      success: true,
      user: userData.name,
      capabilities: userData.capabilities
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export {
  createElementorPage,
  updatePage,
  getPage,
  getDraftPages,
  uploadMedia,
  scheduleDripFeed,
  testConnection,
  createAuthHeader
};

export default {
  createElementorPage,
  updatePage,
  getPage,
  getDraftPages,
  uploadMedia,
  scheduleDripFeed,
  testConnection
};
