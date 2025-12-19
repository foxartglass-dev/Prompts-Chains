// SEO Plugin Integration Service
// Supports pushing meta titles/descriptions to WordPress SEO plugins
// Currently supports: Yoast, Rank Math, AIOSEO, SEOPress

/**
 * Push meta title and description to the SEO plugin on a WordPress page
 * @param {Object} options
 * @param {string} options.wpUrl - WordPress site URL
 * @param {string} options.wpUser - WordPress username
 * @param {string} options.wpPassword - WordPress app password
 * @param {number} options.postId - WordPress post/page ID
 * @param {string} options.metaTitle - The meta title to set
 * @param {string} options.metaDescription - The meta description to set
 * @param {string} options.seoPlugin - Which SEO plugin ('yoast', 'rankmath', 'aioseo', 'seopress')
 * @param {string} options.postType - WordPress post type ('posts' or 'pages'), defaults to 'pages'
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function pushMetaToSeoPlugin({
  wpUrl,
  wpUser,
  wpPassword,
  postId,
  metaTitle,
  metaDescription,
  seoPlugin = 'aioseo',
  postType = 'pages'
}) {
  if (!wpUrl || !wpUser || !wpPassword || !postId) {
    return { success: false, error: 'Missing required WordPress credentials or post ID' };
  }

  // Normalize the WP URL
  const baseUrl = wpUrl.replace(/\/+$/, '');
  const authHeader = 'Basic ' + Buffer.from(`${wpUser}:${wpPassword}`).toString('base64');

  try {
    // AIOSEO uses a different approach - aioseo_meta_data in the request body
    // NOTE: This requires AIOSEO Plus/Pro/Elite. Free version ignores this field.
    if (seoPlugin === 'aioseo') {
      // First try the premium aioseo_meta_data approach
      const aioseoPayload = {
        aioseo_meta_data: {}
      };

      if (metaTitle) {
        aioseoPayload.aioseo_meta_data.title = metaTitle;
      }

      if (metaDescription) {
        aioseoPayload.aioseo_meta_data.description = metaDescription;
      }

      console.log(`Pushing to AIOSEO: ${baseUrl}/wp-json/wp/v2/${postType}/${postId}`, aioseoPayload);

      const response = await fetch(`${baseUrl}/wp-json/wp/v2/${postType}/${postId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(aioseoPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('AIOSEO push failed:', errorData);
        return {
          success: false,
          error: `AIOSEO API error: ${response.status} - ${errorData.message || 'Unknown error'}. Note: AIOSEO REST API requires Plus plan or higher.`
        };
      }

      // Also try to set via post meta as fallback (for free version)
      // This may help if AIOSEO reads from these fields
      try {
        await fetch(`${baseUrl}/wp-json/wp/v2/${postType}/${postId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            meta: {
              _aioseo_title: metaTitle || '',
              _aioseo_description: metaDescription || ''
            }
          })
        });
        console.log('Also attempted post meta fallback for AIOSEO');
      } catch (metaErr) {
        console.log('Post meta fallback failed (expected for protected fields):', metaErr.message);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Meta sent to AIOSEO. Note: If using AIOSEO Free, you may need AIOSEO Plus/Pro for REST API support, or clear any AIOSEO template tags in the page settings.`,
        postId: result.id,
        link: result.link
      };
    }

    // YOAST SEO - Try multiple approaches
    // Note: Yoast's official REST API is read-only, so we try post meta directly
    if (seoPlugin === 'yoast') {
      console.log(`Pushing to Yoast: ${baseUrl}/wp-json/wp/v2/${postType}/${postId}`);

      // Try setting post meta directly (requires meta fields to be registered)
      const metaPayload = {};
      if (metaTitle) metaPayload['_yoast_wpseo_title'] = metaTitle;
      if (metaDescription) metaPayload['_yoast_wpseo_metadesc'] = metaDescription;

      const response = await fetch(`${baseUrl}/wp-json/wp/v2/${postType}/${postId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({ meta: metaPayload })
      });

      const responseData = await response.json().catch(() => ({}));

      if (response.ok) {
        return {
          success: true,
          message: `Meta sent to Yoast. Note: Yoast may require you to add code to functions.php to register these meta fields for REST API. If meta doesn't appear, check Yoast settings in the post editor.`,
          postId: responseData.id,
          link: responseData.link
        };
      }

      // If meta approach failed, return helpful error
      return {
        success: false,
        error: `Yoast API error: ${response.status}. Yoast's REST API is read-only by default. You may need to add register_post_meta() calls in functions.php, or use the Yoast SEO API Manager plugin.`
      };
    }

    // RANK MATH - Try their internal API endpoint first
    if (seoPlugin === 'rankmath') {
      console.log(`Pushing to Rank Math: ${baseUrl}/wp-json/rankmath/v1/updateMeta`);

      // First try Rank Math's internal updateMeta endpoint
      try {
        const rmResponse = await fetch(`${baseUrl}/wp-json/rankmath/v1/updateMeta`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            objectID: postId,
            objectType: postType === 'pages' ? 'page' : 'post',
            meta: {
              rank_math_title: metaTitle || '',
              rank_math_description: metaDescription || ''
            }
          })
        });

        if (rmResponse.ok) {
          const rmData = await rmResponse.json().catch(() => ({}));
          return {
            success: true,
            message: 'Meta pushed to Rank Math successfully via internal API',
            data: rmData
          };
        }
      } catch (rmErr) {
        console.log('Rank Math internal API failed, trying post meta fallback:', rmErr.message);
      }

      // Fallback: Try post meta directly
      const metaPayload = {};
      if (metaTitle) metaPayload['rank_math_title'] = metaTitle;
      if (metaDescription) metaPayload['rank_math_description'] = metaDescription;

      const response = await fetch(`${baseUrl}/wp-json/wp/v2/${postType}/${postId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({ meta: metaPayload })
      });

      const responseData = await response.json().catch(() => ({}));

      if (response.ok) {
        return {
          success: true,
          message: `Meta sent to Rank Math. Note: Make sure "Headless CMS Support" is enabled in Rank Math settings (Global Meta > Advanced). If meta doesn't appear, the fields may need to be registered.`,
          postId: responseData.id,
          link: responseData.link
        };
      }

      return {
        success: false,
        error: `Rank Math API error: ${response.status}. Try enabling "Headless CMS Support" in Rank Math > Global Meta > Advanced settings, or install the Rank Math API Manager plugin.`
      };
    }

    // For other plugins (SEOPress, etc.), use the generic meta field approach
    const metaFields = getMetaFieldNames(seoPlugin);

    if (!metaFields) {
      return { success: false, error: `Unsupported SEO plugin: ${seoPlugin}` };
    }

    // Build the meta update payload
    const metaPayload = {};

    if (metaTitle) {
      metaPayload[metaFields.title] = metaTitle;
    }

    if (metaDescription) {
      metaPayload[metaFields.description] = metaDescription;
    }

    // Update the post meta via WordPress REST API
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/${postType}/${postId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        meta: metaPayload
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `WordPress API error: ${response.status} - ${errorData.message || 'Unknown error'}`
      };
    }

    const result = await response.json();

    return {
      success: true,
      message: `Meta pushed to ${seoPlugin} successfully`,
      postId: result.id,
      link: result.link
    };

  } catch (error) {
    console.error('Error pushing meta to SEO plugin:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the meta field names used by each SEO plugin
 */
function getMetaFieldNames(seoPlugin) {
  const pluginFields = {
    yoast: {
      title: '_yoast_wpseo_title',
      description: '_yoast_wpseo_metadesc',
      // Additional Yoast fields if needed
      focusKeyword: '_yoast_wpseo_focuskw',
      canonical: '_yoast_wpseo_canonical'
    },
    rankmath: {
      title: 'rank_math_title',
      description: 'rank_math_description',
      focusKeyword: 'rank_math_focus_keyword',
      canonical: 'rank_math_canonical_url'
    },
    aioseo: {
      title: '_aioseo_title',
      description: '_aioseo_description',
      // AIOSEO also uses a JSON structure
      ogTitle: '_aioseo_og_title',
      ogDescription: '_aioseo_og_description'
    },
    seopress: {
      title: '_seopress_titles_title',
      description: '_seopress_titles_desc',
      canonical: '_seopress_robots_canonical'
    }
  };

  return pluginFields[seoPlugin] || null;
}

/**
 * Detect which SEO plugin is installed on a WordPress site
 * @param {Object} options
 * @param {string} options.wpUrl - WordPress site URL
 * @param {string} options.wpUser - WordPress username
 * @param {string} options.wpPassword - WordPress app password
 * @returns {Promise<{plugin: string|null, detected: boolean}>}
 */
export async function detectSeoPlugin({ wpUrl, wpUser, wpPassword }) {
  const baseUrl = wpUrl.replace(/\/+$/, '');
  const authHeader = 'Basic ' + Buffer.from(`${wpUser}:${wpPassword}`).toString('base64');

  try {
    // Check for active plugins via REST API
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/plugins`, {
      headers: { 'Authorization': authHeader }
    });

    if (response.ok) {
      const plugins = await response.json();

      // Check for known SEO plugins
      for (const plugin of plugins) {
        const pluginSlug = plugin.plugin?.toLowerCase() || '';

        if (pluginSlug.includes('wordpress-seo') || pluginSlug.includes('yoast')) {
          return { plugin: 'yoast', detected: true };
        }
        if (pluginSlug.includes('seo-by-rank-math') || pluginSlug.includes('rankmath')) {
          return { plugin: 'rankmath', detected: true };
        }
        if (pluginSlug.includes('all-in-one-seo') || pluginSlug.includes('aioseo')) {
          return { plugin: 'aioseo', detected: true };
        }
        if (pluginSlug.includes('wp-seopress') || pluginSlug.includes('seopress')) {
          return { plugin: 'seopress', detected: true };
        }
      }
    }

    // Fallback: Check for plugin-specific REST routes
    const yoastCheck = await fetch(`${baseUrl}/wp-json/yoast/v1/`).catch(() => null);
    if (yoastCheck?.ok) {
      return { plugin: 'yoast', detected: true };
    }

    const rmCheck = await fetch(`${baseUrl}/wp-json/rankmath/v1/`).catch(() => null);
    if (rmCheck?.ok) {
      return { plugin: 'rankmath', detected: true };
    }

    return { plugin: null, detected: false };
  } catch (error) {
    console.error('Error detecting SEO plugin:', error);
    return { plugin: null, detected: false };
  }
}

/**
 * Get the list of supported SEO plugins
 */
export function getSupportedPlugins() {
  return [
    { id: 'aioseo', name: 'All in One SEO', description: 'Comprehensive SEO toolkit (default)' },
    { id: 'yoast', name: 'Yoast SEO', description: 'Most popular WordPress SEO plugin' },
    { id: 'rankmath', name: 'Rank Math', description: 'Feature-rich SEO plugin' },
    { id: 'seopress', name: 'SEOPress', description: 'Lightweight SEO plugin' },
    { id: 'none', name: 'None / Manual', description: 'No automatic SEO pushing' }
  ];
}

export default {
  pushMetaToSeoPlugin,
  detectSeoPlugin,
  getSupportedPlugins
};
