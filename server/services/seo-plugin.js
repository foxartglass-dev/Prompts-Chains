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
    // DIRECT TO WP (no SEO plugin) - Use WordPress excerpt for description
    // and custom meta fields for direct SEO control
    if (seoPlugin === 'none') {
      console.log(`Pushing directly to WordPress: ${baseUrl}/wp-json/wp/v2/${postType}/${postId}`);

      // Build payload with excerpt for description (many themes use this for meta description)
      const payload = {};
      if (metaDescription) {
        payload.excerpt = metaDescription;
      }

      // Also try to set custom meta fields that some themes read
      const metaPayload = {};
      if (metaTitle) metaPayload['_seo_title'] = metaTitle;
      if (metaDescription) metaPayload['_seo_description'] = metaDescription;

      // Update the post
      const response = await fetch(`${baseUrl}/wp-json/wp/v2/${postType}/${postId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          ...payload,
          meta: metaPayload
        })
      });

      const responseData = await response.json().catch(() => ({}));

      if (response.ok) {
        return {
          success: true,
          message: `Meta saved directly to WordPress. The description is stored in the excerpt field. Note: For proper SEO meta tags, you may need an SEO plugin or theme that reads these values.`,
          postId: responseData.id,
          link: responseData.link
        };
      }

      return {
        success: false,
        error: `WordPress API error: ${response.status} - ${responseData.message || 'Unknown error'}`
      };
    }

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
        // Check if meta was actually saved by looking at the response
        const metaSaved = responseData.meta &&
          (responseData.meta._yoast_wpseo_title || responseData.meta._yoast_wpseo_metadesc);

        if (metaSaved) {
          return {
            success: true,
            message: `Meta pushed to Yoast SEO successfully.`,
            postId: responseData.id,
            link: responseData.link
          };
        }

        // Request succeeded but meta may not have been saved
        return {
          success: true,
          message: `Request sent to WordPress. Note: Yoast requires registering meta fields in functions.php for REST API access. Add this code:\n\nadd_action('init', function() {\n  register_post_meta('page', '_yoast_wpseo_title', ['show_in_rest' => true, 'single' => true, 'type' => 'string']);\n  register_post_meta('page', '_yoast_wpseo_metadesc', ['show_in_rest' => true, 'single' => true, 'type' => 'string']);\n});`,
          postId: responseData.id,
          link: responseData.link,
          requiresSetup: true
        };
      }

      // If meta approach failed, return helpful error
      return {
        success: false,
        error: `Yoast API error: ${response.status}. Yoast's REST API is read-only by default. Add register_post_meta() calls in functions.php to enable writing.`
      };
    }

    // RANK MATH - Use post meta approach (most reliable)
    // Rank Math exposes these fields via REST API when "Headless CMS Support" is enabled
    if (seoPlugin === 'rankmath') {
      const targetUrl = `${baseUrl}/wp-json/wp/v2/${postType}/${postId}`;
      console.log(`Pushing to Rank Math: ${targetUrl}`);

      // First, verify the page exists by doing a GET request
      // IMPORTANT: Use context=edit for draft pages - they're not visible without it
      try {
        const verifyUrl = `${targetUrl}?context=edit`;
        console.log(`Verifying page at: ${verifyUrl}`);
        const verifyResponse = await fetch(verifyUrl, {
          method: 'GET',
          headers: {
            'Authorization': authHeader
          }
        });

        if (!verifyResponse.ok) {
          console.log(`Page verification failed: ${verifyResponse.status}`);

          // Try the other post type (posts vs pages)
          const altPostType = postType === 'pages' ? 'posts' : 'pages';
          const altUrl = `${baseUrl}/wp-json/wp/v2/${altPostType}/${postId}?context=edit`;
          console.log(`Trying alternate post type: ${altUrl}`);

          const altResponse = await fetch(altUrl, {
            method: 'GET',
            headers: { 'Authorization': authHeader }
          });

          if (altResponse.ok) {
            return {
              success: false,
              error: `Page ID ${postId} exists but as a "${altPostType.slice(0, -1)}" not a "${postType.slice(0, -1)}". The content was published as a ${altPostType.slice(0, -1)}. Try changing the post type setting.`
            };
          }

          // Neither worked - check if REST API is accessible at all
          const apiCheck = await fetch(`${baseUrl}/wp-json/wp/v2/`, {
            headers: { 'Authorization': authHeader }
          }).catch(() => null);

          if (!apiCheck || !apiCheck.ok) {
            return {
              success: false,
              error: `Cannot reach WordPress REST API at ${baseUrl}. Check that the REST API is not blocked by security plugins (Wordfence, Sucuri, etc.) or .htaccess rules.`
            };
          }

          return {
            success: false,
            error: `WordPress ${postType.slice(0, -1)} not found (ID: ${postId}). Verified REST API is working. The page may have been deleted or the ID stored incorrectly.`
          };
        }

        const pageData = await verifyResponse.json();
        console.log(`Page verified: "${pageData.title?.rendered}" (status: ${pageData.status})`);
      } catch (verifyErr) {
        console.log('Page verification error:', verifyErr.message);
      }

      // Primary approach: Post meta (works when Headless CMS Support is enabled)
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
        // Check if meta was actually saved
        const metaSaved = responseData.meta &&
          (responseData.meta.rank_math_title || responseData.meta.rank_math_description);

        if (metaSaved) {
          return {
            success: true,
            message: `Meta pushed to Rank Math successfully.`,
            postId: responseData.id,
            link: responseData.link
          };
        }

        // Request succeeded but meta may not have been saved - try internal API as fallback
        console.log('Post meta may not have saved, trying Rank Math internal API...');
        try {
          const rmResponse = await fetch(`${baseUrl}/wp-json/rankmath/v1/updateMeta`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              objectID: parseInt(postId),
              objectType: postType === 'pages' ? 'page' : 'post',
              meta: {
                rank_math_title: metaTitle || '',
                rank_math_description: metaDescription || ''
              }
            })
          });

          if (rmResponse.ok) {
            return {
              success: true,
              message: 'Meta pushed to Rank Math via internal API.',
              postId: responseData.id,
              link: responseData.link
            };
          }
        } catch (rmErr) {
          console.log('Rank Math internal API also failed:', rmErr.message);
        }

        // Neither worked - but the WordPress request succeeded, so return success
        // The meta fields may have been saved even if not returned in the response
        return {
          success: true,
          message: `Meta sent to Rank Math. Note: If meta doesn't appear, verify "Headless CMS Support" is enabled in Rank Math > General Settings > Others.`,
          postId: responseData.id,
          link: responseData.link
        };
      }

      // Response NOT ok - provide specific error based on status code
      if (response.status === 404) {
        return {
          success: false,
          error: `WordPress page/post not found (ID: ${postId}). The page may have been deleted or the post type may be wrong. Check that the page exists in WordPress.`
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: `Authentication failed (${response.status}). Check your WordPress username and app password.`
        };
      }

      return {
        success: false,
        error: `Rank Math API error: ${response.status} - ${responseData.message || 'Unknown error'}. If Headless CMS Support is already enabled, try saving the Rank Math settings again.`
      };
    }

    // SEOPRESS - Uses specific meta fields
    if (seoPlugin === 'seopress') {
      console.log(`Pushing to SEOPress: ${baseUrl}/wp-json/wp/v2/${postType}/${postId}`);

      const metaPayload = {};
      if (metaTitle) metaPayload['_seopress_titles_title'] = metaTitle;
      if (metaDescription) metaPayload['_seopress_titles_desc'] = metaDescription;

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
        // Check if meta was saved
        const metaSaved = responseData.meta &&
          (responseData.meta._seopress_titles_title || responseData.meta._seopress_titles_desc);

        if (metaSaved) {
          return {
            success: true,
            message: `Meta pushed to SEOPress successfully.`,
            postId: responseData.id,
            link: responseData.link
          };
        }

        // Request succeeded but meta may need REST API enabled
        return {
          success: true,
          message: `Request sent to WordPress. If meta doesn't appear in SEOPress:\n1. Go to SEOPress > Advanced\n2. Ensure REST API is enabled\n3. Check that meta fields are exposed to REST API.`,
          postId: responseData.id,
          link: responseData.link,
          requiresSetup: true
        };
      }

      return {
        success: false,
        error: `SEOPress API error: ${response.status}. Check that SEOPress REST API is enabled in SEOPress > Advanced.`
      };
    }

    // For any other/unknown plugins, use the generic meta field approach
    const metaFields = getMetaFieldNames(seoPlugin);

    if (!metaFields) {
      return { success: false, error: `Unsupported SEO plugin: ${seoPlugin}. Supported plugins: yoast, rankmath, aioseo, seopress, none` };
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
 * Get the list of supported SEO plugins with setup requirements
 */
export function getSupportedPlugins() {
  return [
    {
      id: 'aioseo',
      name: 'All in One SEO',
      description: 'Requires Plus/Pro/Elite for REST API',
      setupNotes: 'AIOSEO REST API requires a paid version (Plus, Pro, or Elite). Free version will not receive API updates.'
    },
    {
      id: 'yoast',
      name: 'Yoast SEO',
      description: 'Requires functions.php code',
      setupNotes: 'Add register_post_meta() calls to functions.php to enable REST API writing for Yoast meta fields.'
    },
    {
      id: 'rankmath',
      name: 'Rank Math',
      description: 'Enable "Headless CMS Support"',
      setupNotes: 'Go to Rank Math > General Settings > Others and enable "Headless CMS Support".'
    },
    {
      id: 'seopress',
      name: 'SEOPress',
      description: 'Enable REST API in settings',
      setupNotes: 'Check SEOPress > Advanced to ensure REST API is enabled.'
    },
    {
      id: 'none',
      name: 'Direct to WP',
      description: 'Uses excerpt field for description',
      setupNotes: 'Saves meta title to custom field and description to WordPress excerpt. Some themes use excerpt as meta description.'
    }
  ];
}

export default {
  pushMetaToSeoPlugin,
  detectSeoPlugin,
  getSupportedPlugins
};
