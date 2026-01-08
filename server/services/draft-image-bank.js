/**
 * Draft Image Bank Service
 *
 * Manages in-transit images for pages before they're sent to client website.
 * Separate from main Image Bank - these are page-specific draft images.
 */

import { sql, isDatabaseEnabled } from '../db/index.js';

/**
 * Get all draft images for a workflow
 */
export async function getDraftImageBank(workflowId, options = {}) {
  if (!isDatabaseEnabled()) return [];

  const { status, articleId, itemType, itemCategory, avatarTag, pageKeyword, limit = 500 } = options;

  // Build dynamic query based on filters
  let query = `
    SELECT * FROM draft_image_bank
    WHERE workflow_id = $1
  `;
  const params = [workflowId];
  let paramIndex = 2;

  if (status) {
    query += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (articleId) {
    query += ` AND article_id = $${paramIndex}`;
    params.push(articleId);
    paramIndex++;
  }

  if (itemType) {
    query += ` AND item_type = $${paramIndex}`;
    params.push(itemType);
    paramIndex++;
  }

  if (itemCategory) {
    query += ` AND item_category = $${paramIndex}`;
    params.push(itemCategory);
    paramIndex++;
  }

  if (avatarTag) {
    query += ` AND avatar_tag = $${paramIndex}`;
    params.push(avatarTag);
    paramIndex++;
  }

  if (pageKeyword) {
    query += ` AND page_keyword = $${paramIndex}`;
    params.push(pageKeyword);
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
  params.push(limit);

  // Neon serverless uses sql(query, params) for dynamic queries
  console.log('[Draft Bank Service] Query:', query);
  console.log('[Draft Bank Service] Params:', params);
  const result = await sql(query, params);
  console.log('[Draft Bank Service] Result count:', result?.length || 0);
  console.log('[Draft Bank Service] First row sample:', result?.[0] ? JSON.stringify(result[0]).substring(0, 200) : 'none');
  return result;
}

/**
 * Get draft images grouped by page
 */
export async function getDraftImagesByPage(workflowId, status = null) {
  if (!isDatabaseEnabled()) return [];

  if (status) {
    return await sql`
      SELECT
        page_keyword,
        page_title,
        article_id,
        json_agg(
          json_build_object(
            'id', id,
            'url', url,
            'item_type', item_type,
            'item_category', item_category,
            'status', status,
            'placement', placement,
            'created_at', created_at
          ) ORDER BY created_at DESC
        ) as images,
        COUNT(*) as image_count
      FROM draft_image_bank
      WHERE workflow_id = ${workflowId} AND status = ${status}
      GROUP BY page_keyword, page_title, article_id
      ORDER BY MAX(created_at) DESC
    `;
  }

  return await sql`
    SELECT
      page_keyword,
      page_title,
      article_id,
      json_agg(
        json_build_object(
          'id', id,
          'url', url,
          'item_type', item_type,
          'item_category', item_category,
          'status', status,
          'placement', placement,
          'created_at', created_at
        ) ORDER BY created_at DESC
      ) as images,
      COUNT(*) as image_count
    FROM draft_image_bank
    WHERE workflow_id = ${workflowId}
    GROUP BY page_keyword, page_title, article_id
    ORDER BY MAX(created_at) DESC
  `;
}

/**
 * Get unique item types for filtering dropdown
 */
export async function getItemTypes(workflowId) {
  if (!isDatabaseEnabled()) return [];

  const result = await sql`
    SELECT DISTINCT item_type, COUNT(*) as count
    FROM draft_image_bank
    WHERE workflow_id = ${workflowId} AND item_type IS NOT NULL
    GROUP BY item_type
    ORDER BY count DESC
  `;
  return result;
}

/**
 * Get unique item categories for filtering dropdown
 */
export async function getItemCategories(workflowId) {
  if (!isDatabaseEnabled()) return [];

  const result = await sql`
    SELECT DISTINCT item_category, COUNT(*) as count
    FROM draft_image_bank
    WHERE workflow_id = ${workflowId} AND item_category IS NOT NULL
    GROUP BY item_category
    ORDER BY count DESC
  `;
  return result;
}

/**
 * Add a single image to the draft bank
 */
export async function addToDraftBank(workflowId, image) {
  if (!isDatabaseEnabled()) return null;

  // Validate URL - must be a real URL, not base64 (which would exceed VARCHAR(1000))
  const url = image.url || '';
  if (!url || url.startsWith('data:') || url.length > 1000) {
    console.warn('[Draft Bank] Skipping image - invalid or too long URL:', url.substring(0, 50) + '...');
    return null;
  }

  const result = await sql`
    INSERT INTO draft_image_bank (
      workflow_id, article_id, url, wp_media_id,
      item_type, item_category, avatar_tag,
      page_keyword, page_title,
      prompt, model, placement, status, metadata
    ) VALUES (
      ${workflowId},
      ${image.articleId || null},
      ${url},
      ${image.wpMediaId || null},
      ${image.itemType || null},
      ${image.itemCategory || null},
      ${image.avatarTag || null},
      ${image.pageKeyword || null},
      ${image.pageTitle || null},
      ${image.prompt || null},
      ${image.model || null},
      ${image.placement || null},
      'draft',
      ${JSON.stringify(image.metadata || {})}
    )
    RETURNING *
  `;

  // Increment the total_made counter
  await incrementMadeCount(workflowId);

  return result[0];
}

/**
 * Add multiple images to the draft bank (bulk insert)
 */
export async function addBatchToDraftBank(workflowId, images) {
  if (!isDatabaseEnabled() || images.length === 0) return [];

  const results = [];
  for (const image of images) {
    const result = await addToDraftBank(workflowId, image);
    if (result) results.push(result);
  }
  return results;
}

/**
 * Replace an existing draft image with a new one
 * - Marks old image as 'replaced'
 * - Creates new image in 'draft' status
 * - Links the old image to the new one
 * - Increments replaced counter
 */
export async function replaceDraftImage(workflowId, oldImageId, newImage) {
  if (!isDatabaseEnabled()) return null;

  // First, add the new image
  const newResult = await addToDraftBank(workflowId, newImage);
  if (!newResult) return null;

  // Mark the old image as replaced and link to new one
  await sql`
    UPDATE draft_image_bank
    SET status = 'replaced',
        replaced_by = ${newResult.id},
        replaced_at = NOW()
    WHERE id = ${oldImageId} AND workflow_id = ${workflowId}
  `;

  // Increment the replaced counter
  await incrementReplacedCount(workflowId);

  return newResult;
}

/**
 * Mark draft image as sent to client
 */
export async function markAsSent(workflowId, imageId) {
  if (!isDatabaseEnabled()) return null;

  const result = await sql`
    UPDATE draft_image_bank
    SET status = 'sent', sent_at = NOW()
    WHERE id = ${imageId} AND workflow_id = ${workflowId}
    RETURNING *
  `;

  if (result[0]) {
    await incrementSentCount(workflowId);
  }

  return result[0];
}

/**
 * Mark multiple draft images as sent
 */
export async function markBatchAsSent(workflowId, imageIds) {
  if (!isDatabaseEnabled() || imageIds.length === 0) return [];

  const results = [];
  for (const imageId of imageIds) {
    const result = await markAsSent(workflowId, imageId);
    if (result) results.push(result);
  }
  return results;
}

/**
 * Delete a draft image (hard delete for 'replaced' images)
 */
export async function deleteDraftImage(workflowId, imageId) {
  if (!isDatabaseEnabled()) return false;

  await sql`
    DELETE FROM draft_image_bank
    WHERE id = ${imageId} AND workflow_id = ${workflowId}
  `;
  return true;
}

/**
 * Get draft bank stats for a workflow
 */
export async function getDraftBankStats(workflowId) {
  if (!isDatabaseEnabled()) return { total: 0, draft: 0, sent: 0, replaced: 0, totalMade: 0, totalReplaced: 0 };

  console.log('[Draft Bank Stats] Getting stats for workflow:', workflowId);

  // Get current counts
  const counts = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'draft') as draft,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'replaced') as replaced
    FROM draft_image_bank
    WHERE workflow_id = ${workflowId}
  `;

  // Get lifetime counters
  const stats = await sql`
    SELECT total_made, total_replaced, total_sent
    FROM draft_image_bank_stats
    WHERE workflow_id = ${workflowId}
  `;

  const lifetimeStats = stats[0] || { total_made: 0, total_replaced: 0, total_sent: 0 };

  console.log('[Draft Bank Stats] Counts from draft_image_bank table:', counts[0]);
  console.log('[Draft Bank Stats] Lifetime stats from draft_image_bank_stats:', lifetimeStats);

  return {
    total: parseInt(counts[0].total),
    draft: parseInt(counts[0].draft),
    sent: parseInt(counts[0].sent),
    replaced: parseInt(counts[0].replaced),
    totalMade: lifetimeStats.total_made,
    totalReplaced: lifetimeStats.total_replaced,
    totalSent: lifetimeStats.total_sent
  };
}

/**
 * Initialize or get stats record for workflow
 */
async function ensureStatsRecord(workflowId) {
  const existing = await sql`
    SELECT id FROM draft_image_bank_stats WHERE workflow_id = ${workflowId}
  `;

  if (existing.length === 0) {
    await sql`
      INSERT INTO draft_image_bank_stats (workflow_id, total_made, total_replaced, total_sent)
      VALUES (${workflowId}, 0, 0, 0)
    `;
  }
}

/**
 * Increment the total_made counter
 */
async function incrementMadeCount(workflowId) {
  await ensureStatsRecord(workflowId);
  await sql`
    UPDATE draft_image_bank_stats
    SET total_made = total_made + 1, updated_at = NOW()
    WHERE workflow_id = ${workflowId}
  `;
}

/**
 * Increment the total_replaced counter
 */
async function incrementReplacedCount(workflowId) {
  await ensureStatsRecord(workflowId);
  await sql`
    UPDATE draft_image_bank_stats
    SET total_replaced = total_replaced + 1, updated_at = NOW()
    WHERE workflow_id = ${workflowId}
  `;
}

/**
 * Increment the total_sent counter
 */
async function incrementSentCount(workflowId) {
  await ensureStatsRecord(workflowId);
  await sql`
    UPDATE draft_image_bank_stats
    SET total_sent = total_sent + 1, updated_at = NOW()
    WHERE workflow_id = ${workflowId}
  `;
}

/**
 * Clean up old replaced images (optional maintenance task)
 * Keep the last N days of replaced images for reference
 */
export async function cleanupReplacedImages(workflowId, keepDays = 30) {
  if (!isDatabaseEnabled()) return { deleted: 0 };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - keepDays);

  const result = await sql`
    DELETE FROM draft_image_bank
    WHERE workflow_id = ${workflowId}
      AND status = 'replaced'
      AND replaced_at < ${cutoffDate}
    RETURNING id
  `;

  return { deleted: result.length };
}
