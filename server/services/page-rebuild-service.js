/**
 * Page Rebuild Service
 * Shared service for rebuilding WordPress/Elementor pages while preserving URL slugs.
 *
 * WordPress/Elementor's REST API cannot reliably update _elementor_data in-place.
 * Every page update requires: delete old page → build new content → create new page with same slug.
 *
 * This pattern was duplicated in:
 *   - server/routes/articles.js (push-images, lines 560-825)
 *   - server/routes/elementor.js (bulk-update-cta, lines 2757-2920)
 *
 * Golden Rules enforced:
 *   #1 - Never overwrite generated_images with empty array (re-uses existing by default)
 *   #2 - Images → Page → Meta order (images embedded in chunks BEFORE buildElementorPage)
 *   #9 - Never silently swallow errors (all errors logged and collected)
 *   #13 - All images through WP first (rebuild service does NOT upload — caller's responsibility)
 */

import { sql } from '../db/index.js';
import chunkContent from './content-chunker.js';
import buildElementorPage, { getElementorMetaFields } from './elementor-builder.js';
import { createElementorPage, getPage } from './wordpress-publisher.js';
import { selectComponentsForArticle } from './component-library-service.js';

/**
 * Strip tag identifier like (H), (J), (C) from end of keyword string.
 * "Standard Cleaning(H)" → "Standard Cleaning"
 * "Topic (J)" → "Topic"
 * @param {string} keyword
 * @returns {string}
 */
function stripTagFromKeyword(keyword) {
  if (!keyword) return keyword;
  return keyword.replace(/\s*\([A-Za-z0-9]+\)\s*$/, '').trim();
}

/**
 * Delete a WordPress page directly via REST API.
 * Extracted from the inline DELETE pattern in elementor.js:2871.
 *
 * @param {Object} wpCredentials - { url, user, password } (or { wpUrl, wpUser, wpPassword })
 * @param {number} pageId - WordPress page ID to delete
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function deletePageDirect(wpCredentials, pageId) {
  // Support both credential naming conventions used across the codebase
  const wpUrl = wpCredentials.url || wpCredentials.wpUrl;
  const wpUser = wpCredentials.user || wpCredentials.wpUser;
  const wpPassword = wpCredentials.password || wpCredentials.wpPassword;

  const deleteUrl = `${wpUrl.replace(/\/$/, '')}/wp-json/wp/v2/pages/${pageId}?force=true`;
  const auth = Buffer.from(`${wpUser}:${wpPassword}`).toString('base64');

  try {
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: { 'Authorization': `Basic ${auth}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PageRebuild] Delete page ${pageId} failed: ${response.status} - ${errorText}`);
      return { success: false, error: `Delete failed: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error(`[PageRebuild] Delete page ${pageId} error:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Embed images into chunked content.
 * Sorts by placement (hero first, then sections), attaches imageData to matching chunks.
 * Reference: elementor.js lines 2818-2856.
 *
 * GOLDEN RULE #2: This MUST happen BEFORE buildElementorPage() is called.
 *
 * @param {Object} chunked - Output from chunkContent() with .intro and .chunks
 * @param {Array} images - Array of image objects with placement, wpMediaUrl, etc.
 */
function embedImagesInChunks(chunked, images) {
  if (!images || images.length === 0) return;

  const sortedImages = [...images].sort((a, b) => {
    if (a.placement === 'hero') return -1;
    if (b.placement === 'hero') return 1;
    const aNum = parseInt(a.placement?.replace('section-', '') || '99');
    const bNum = parseInt(b.placement?.replace('section-', '') || '99');
    return aNum - bNum;
  });

  sortedImages.forEach(img => {
    const imageUrl = img.wpMediaUrl || img.url;
    // Skip base64 images — they should have been uploaded to WP first (Golden Rule #13)
    if (imageUrl?.startsWith('data:')) return;

    const isHero = img.placement === 'hero';
    const imageData = {
      url: imageUrl,
      wpUrl: img.wpMediaUrl || img.url,
      wpMediaId: img.wpMediaId || null,
      alt: img.prompt?.substring(0, 50) || 'Article image',
      width: isHero ? 400 : 380,
      height: isHero ? 500 : 475,
      side: img.side || (isHero ? 'right' : 'left'),
      orientation: 'vertical'
    };

    if (isHero && chunked.intro) {
      chunked.intro.imageData = imageData;
    } else {
      const sectionMatch = img.placement?.match(/section-(\d+)/);
      if (sectionMatch) {
        const sectionIdx = parseInt(sectionMatch[1]) - 1;
        if (chunked.chunks[sectionIdx]) {
          chunked.chunks[sectionIdx].imageData = imageData;
        }
      }
    }
  });
}

/**
 * Rebuild a WordPress/Elementor page while preserving its URL slug.
 *
 * Flow:
 *   1. getPage() → save slug and status
 *   2. chunkContent()
 *   3. Embed images into chunks (BEFORE buildElementorPage — Golden Rule #2)
 *   4. Select components (use provided or call selectComponentsForArticle)
 *   5. buildElementorPage()
 *   6. getElementorMetaFields()
 *   7. Delete old page (append '-updated' to slug on failure — don't crash)
 *   8. createElementorPage() with same slug
 *   9. UPDATE articles SET wp_post_id, wp_post_url, wp_published_at
 *  10. Return { oldPageId, newPageId, slug }
 *
 * @param {Object} article - DB record with: id, final_content, keyword, workflow_id, wp_post_id, generated_images
 * @param {Object} wpCredentials - { url, user, password }
 * @param {Object} options
 * @param {Array|null} options.images - New images, or null to re-use article.generated_images
 * @param {Object|null} options.components - Component assignments, or null to re-select via library
 * @param {string|null} options.ctaText - CTA button text, or null to keep current
 * @param {string|null} options.ctaUrl - CTA URL, or null to keep current
 * @param {string|null} options.status - Page status (draft/publish), or null to keep current
 * @param {Object|null} options.templateStyles - From workflow_elementor_styles, or null to skip
 * @param {string} options.heroImageSide - 'left' or 'right', default 'right'
 * @returns {Promise<{ oldPageId: number, newPageId: number, slug: string }>}
 */
async function rebuildPage(article, wpCredentials, options = {}) {
  const {
    images = null,
    components = null,
    ctaText = null,
    ctaUrl = null,
    status = null,
    templateStyles = null,
    heroImageSide = 'right'
  } = options;

  // Validate required fields
  if (!article.final_content) {
    throw new Error(`Article ${article.id} has no final_content — cannot rebuild page`);
  }
  if (!article.wp_post_id) {
    throw new Error(`Article ${article.id} has no wp_post_id — no existing page to rebuild`);
  }

  const oldPageId = article.wp_post_id;
  console.log(`[PageRebuild] Starting rebuild for article ${article.id}: "${article.keyword}"`);

  // Normalize credentials to { url, user, password } format
  const creds = {
    url: wpCredentials.url || wpCredentials.wpUrl,
    user: wpCredentials.user || wpCredentials.wpUser,
    password: wpCredentials.password || wpCredentials.wpPassword
  };

  // Step 1: Get existing page slug and status
  let existingSlug = null;
  let existingStatus = null;
  try {
    const existingPage = await getPage(creds, article.wp_post_id);
    existingSlug = existingPage.slug;
    existingStatus = existingPage.status;
    console.log(`[PageRebuild] Existing page slug: "${existingSlug}", status: "${existingStatus}"`);
  } catch (err) {
    console.warn(`[PageRebuild] Could not get existing page ${article.wp_post_id}: ${err.message}`);
  }

  // Step 2: Chunk the content
  const chunked = chunkContent(article.final_content, { maxWords: 300 });

  // Step 3: Embed images into chunks (Golden Rule #2: images BEFORE page build)
  // Golden Rule #1: re-use existing generated_images by default
  const activeImages = images !== null ? images : (article.generated_images || []);
  embedImagesInChunks(chunked, activeImages);

  // Step 4: Select components (use provided or call selectComponentsForArticle)
  let articleComponents = components;
  if (!articleComponents && article.workflow_id) {
    try {
      const tagMatch = article.keyword?.match(/\(([A-Z])\)/i);
      const articleTag = tagMatch ? tagMatch[1].toUpperCase() : null;
      const componentSelection = await selectComponentsForArticle(article.workflow_id, articleTag);
      if (componentSelection.enabled) {
        articleComponents = componentSelection;
        console.log(`[PageRebuild] Component Library selected for article ${article.id}`);
      }
    } catch (compErr) {
      console.warn(`[PageRebuild] Component selection failed: ${compErr.message}`);
    }
  }

  // Step 5: Build Elementor page structure
  const pageTitle = stripTagFromKeyword(article.keyword) || 'Untitled Page';
  const heroSide = activeImages.find(i => i.placement === 'hero')?.side || heroImageSide;

  const elementorData = buildElementorPage(chunked, {
    title: pageTitle,
    ctaText: ctaText || 'Book Now!',
    ctaUrl: ctaUrl || '#',
    components: articleComponents,
    templateStyles: templateStyles,
    heroImageSide: heroSide
  });

  // Step 6: Get Elementor meta fields
  const elementorMeta = getElementorMetaFields(elementorData);

  // Step 7: Delete old page (don't crash on failure — append '-updated' to slug)
  if (existingSlug) {
    const deleteResult = await deletePageDirect(creds, article.wp_post_id);
    if (!deleteResult.success) {
      console.warn(`[PageRebuild] Delete failed for page ${article.wp_post_id}, appending '-updated' to slug`);
      existingSlug = existingSlug + '-updated';
    } else {
      console.log(`[PageRebuild] Deleted old page ${article.wp_post_id}`);
    }
  }

  // Step 8: Create new page with same slug
  const pageStatus = status || existingStatus || 'draft';
  const newPage = await createElementorPage(creds, {
    title: pageTitle,
    slug: existingSlug,
    elementorMeta,
    status: pageStatus
  });

  if (!newPage.success && !newPage.id) {
    throw new Error(`Failed to create new page for article ${article.id}`);
  }

  console.log(`[PageRebuild] New page created: id=${newPage.id}, slug="${newPage.slug}", url="${newPage.link}"`);

  // Step 9: Update article record in database
  await sql`
    UPDATE articles
    SET wp_post_id = ${newPage.id},
        wp_post_url = ${newPage.link},
        wp_published_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${article.id}
  `;

  console.log(`[PageRebuild] Article ${article.id} updated with new page id ${newPage.id}`);

  // Step 10: Return result
  return {
    oldPageId,
    newPageId: newPage.id,
    slug: newPage.slug || existingSlug
  };
}

/**
 * Rebuild multiple pages in sequence, collecting results and errors.
 * Golden Rule #9: All errors are collected and returned, never silently swallowed.
 *
 * @param {Array} articles - Array of DB article records
 * @param {Object} wpCredentials - { url, user, password }
 * @param {Object} options - Same as rebuildPage options, plus:
 * @param {boolean} options.resetRotation - Reset component rotation before starting
 * @param {number} options.workflowId - Required if resetRotation is true
 * @param {Function} progressCallback - Called after each article with progress data
 * @returns {Promise<{ total: number, succeeded: number, failed: number, errors: Array }>}
 */
async function bulkRebuildPages(articles, wpCredentials, options = {}, progressCallback) {
  const results = { total: articles.length, succeeded: 0, failed: 0, errors: [] };

  // Optional: reset component rotation for even redistribution
  if (options.resetRotation && options.workflowId) {
    try {
      await sql`
        DELETE FROM component_rotation_state
        WHERE workflow_id = ${options.workflowId}
      `;
      console.log(`[PageRebuild] Reset component rotation for workflow ${options.workflowId}`);
    } catch (rotErr) {
      console.warn(`[PageRebuild] Could not reset rotation state: ${rotErr.message}`);
    }
  }

  for (const article of articles) {
    try {
      await rebuildPage(article, wpCredentials, options);
      results.succeeded++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        articleId: article.id,
        keyword: article.keyword,
        error: error.message
      });
      console.error(`[PageRebuild] Failed article ${article.id} "${article.keyword}": ${error.message}`);
    }

    if (progressCallback) {
      progressCallback({
        ...results,
        currentKeyword: article.keyword
      });
    }
  }

  console.log(`[PageRebuild] Bulk complete: ${results.succeeded} succeeded, ${results.failed} failed out of ${results.total}`);
  return results;
}

export { rebuildPage, bulkRebuildPages, deletePageDirect, embedImagesInChunks, stripTagFromKeyword };
export default rebuildPage;
