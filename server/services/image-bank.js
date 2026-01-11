/**
 * Image Bank Service
 *
 * Manages image bank items in the database instead of storing them
 * in the settings JSON blob. This solves the payload size issue.
 */

import { sql, isDatabaseEnabled } from '../db/index.js';

/**
 * Get all images for a workflow
 */
export async function getImageBank(workflowId, options = {}) {
  if (!isDatabaseEnabled()) return [];

  const { used, archived, avatarTag, limit = 500 } = options;

  // Build query based on filters
  if (used !== undefined && archived !== undefined) {
    return await sql`
      SELECT * FROM image_bank_items
      WHERE workflow_id = ${workflowId}
        AND used = ${used}
        AND archived = ${archived}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  } else if (used !== undefined) {
    return await sql`
      SELECT * FROM image_bank_items
      WHERE workflow_id = ${workflowId} AND used = ${used}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  } else if (archived !== undefined) {
    return await sql`
      SELECT * FROM image_bank_items
      WHERE workflow_id = ${workflowId} AND archived = ${archived}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  } else if (avatarTag) {
    return await sql`
      SELECT * FROM image_bank_items
      WHERE workflow_id = ${workflowId} AND avatar_tag = ${avatarTag}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }

  return await sql`
    SELECT * FROM image_bank_items
    WHERE workflow_id = ${workflowId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

/**
 * Add a single image to the bank
 */
export async function addImageToBank(workflowId, image) {
  if (!isDatabaseEnabled()) return null;

  const result = await sql`
    INSERT INTO image_bank_items (
      workflow_id, external_id, url, title, category,
      variation_name, variation_id, avatar_tag, orientation,
      prompt, model, used, used_on, used_at, archived, tags, metadata
    ) VALUES (
      ${workflowId},
      ${image.id || `img-${Date.now()}`},
      ${image.url},
      ${image.title || null},
      ${image.category || null},
      ${image.variation || null},
      ${image.variationId || null},
      ${image.avatarTag || null},
      ${image.orientation || 'vertical'},
      ${image.prompt || null},
      ${image.model || null},
      ${image.used || false},
      ${image.usedOn || null},
      ${image.usedAt ? new Date(image.usedAt) : null},
      ${image.archived || false},
      ${JSON.stringify(image.tags || [])},
      ${JSON.stringify(image.metadata || {})}
    )
    RETURNING *
  `;
  return result[0];
}

/**
 * Add multiple images to the bank (bulk insert)
 */
export async function addImagesToBank(workflowId, images) {
  if (!isDatabaseEnabled() || images.length === 0) return [];

  const results = [];
  for (const image of images) {
    const result = await addImageToBank(workflowId, image);
    if (result) results.push(result);
  }
  return results;
}

/**
 * Update an image in the bank
 */
export async function updateImageInBank(workflowId, imageId, updates) {
  if (!isDatabaseEnabled()) return null;

  // Use external_id (client-side ID) or database id
  const isNumericId = !isNaN(parseInt(imageId));

  if (isNumericId) {
    const result = await sql`
      UPDATE image_bank_items SET
        title = COALESCE(${updates.title}, title),
        category = COALESCE(${updates.category}, category),
        used = COALESCE(${updates.used}, used),
        used_on = COALESCE(${updates.usedOn}, used_on),
        used_at = CASE WHEN ${updates.used} = true THEN NOW() ELSE used_at END,
        archived = COALESCE(${updates.archived}, archived),
        tags = COALESCE(${updates.tags ? JSON.stringify(updates.tags) : null}::jsonb, tags),
        updated_at = NOW()
      WHERE id = ${parseInt(imageId)} AND workflow_id = ${workflowId}
      RETURNING *
    `;
    return result[0];
  } else {
    const result = await sql`
      UPDATE image_bank_items SET
        title = COALESCE(${updates.title}, title),
        category = COALESCE(${updates.category}, category),
        used = COALESCE(${updates.used}, used),
        used_on = COALESCE(${updates.usedOn}, used_on),
        used_at = CASE WHEN ${updates.used} = true THEN NOW() ELSE used_at END,
        archived = COALESCE(${updates.archived}, archived),
        tags = COALESCE(${updates.tags ? JSON.stringify(updates.tags) : null}::jsonb, tags),
        updated_at = NOW()
      WHERE external_id = ${imageId} AND workflow_id = ${workflowId}
      RETURNING *
    `;
    return result[0];
  }
}

/**
 * Delete an image from the bank
 */
export async function deleteImageFromBank(workflowId, imageId) {
  if (!isDatabaseEnabled()) return false;

  const isNumericId = !isNaN(parseInt(imageId));

  if (isNumericId) {
    await sql`DELETE FROM image_bank_items WHERE id = ${parseInt(imageId)} AND workflow_id = ${workflowId}`;
  } else {
    await sql`DELETE FROM image_bank_items WHERE external_id = ${imageId} AND workflow_id = ${workflowId}`;
  }
  return true;
}

/**
 * Mark an image as used
 */
export async function markImageAsUsed(workflowId, imageId, usedOn) {
  return updateImageInBank(workflowId, imageId, { used: true, usedOn });
}

/**
 * Archive an image
 */
export async function archiveImage(workflowId, imageId) {
  return updateImageInBank(workflowId, imageId, { archived: true });
}

/**
 * Get image bank stats
 */
export async function getImageBankStats(workflowId) {
  if (!isDatabaseEnabled()) return { total: 0, available: 0, used: 0, archived: 0 };

  const result = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE used = false AND archived = false) as available,
      COUNT(*) FILTER (WHERE used = true) as used,
      COUNT(*) FILTER (WHERE archived = true) as archived
    FROM image_bank_items
    WHERE workflow_id = ${workflowId}
  `;
  return result[0];
}

/**
 * Restore all used images back to available
 * Sets used=false for all images where used=true
 */
export async function restoreAllUsedImages(workflowId) {
  if (!isDatabaseEnabled()) return { restored: 0 };

  const result = await sql`
    UPDATE image_bank_items
    SET used = false, used_on = null, used_at = null, updated_at = NOW()
    WHERE workflow_id = ${workflowId} AND used = true
    RETURNING id
  `;

  return { restored: result.length };
}

/**
 * Recycle images from Draft Image Bank into the regular Image Bank
 * Copies images from draft_image_bank to image_bank_items, then optionally deletes from draft
 *
 * Field mapping:
 * - url → url
 * - prompt → prompt
 * - model → model
 * - avatar_tag → avatar_tag
 * - item_type → title (and added to tags)
 * - item_category → category
 * - metadata → metadata
 */
export async function recycleFromDraftBank(workflowId, options = {}) {
  if (!isDatabaseEnabled()) return { recycled: 0 };

  const { statuses = ['draft', 'sent'], deleteAfterRecycle = false } = options;

  // Get draft images to recycle
  const draftImages = await sql`
    SELECT * FROM draft_image_bank
    WHERE workflow_id = ${workflowId} AND status = ANY(${statuses})
  `;

  if (draftImages.length === 0) {
    return { recycled: 0, message: 'No draft images found to recycle' };
  }

  // Map draft images to image bank format
  const imagesToAdd = draftImages.map(draft => ({
    id: `recycled-${draft.id}-${Date.now()}`,
    url: draft.url,
    title: draft.item_type || draft.page_keyword || null,
    category: draft.item_category || null,
    avatarTag: draft.avatar_tag || null,
    prompt: draft.prompt || null,
    model: draft.model || null,
    orientation: 'vertical',
    used: false,
    archived: false,
    tags: [
      draft.item_type,
      draft.item_category,
      draft.page_keyword,
      'recycled'
    ].filter(Boolean),
    metadata: {
      ...draft.metadata,
      recycledFrom: 'draft_image_bank',
      originalDraftId: draft.id,
      originalStatus: draft.status,
      recycledAt: new Date().toISOString()
    }
  }));

  // Insert into image bank
  const recycled = await addImagesToBank(workflowId, imagesToAdd);

  // Optionally delete from draft bank
  if (deleteAfterRecycle && recycled.length > 0) {
    const recycledIds = draftImages.map(d => d.id);
    await sql`
      DELETE FROM draft_image_bank
      WHERE id = ANY(${recycledIds}) AND workflow_id = ${workflowId}
    `;
  }

  return {
    recycled: recycled.length,
    deleted: deleteAfterRecycle ? draftImages.length : 0,
    message: `Recycled ${recycled.length} images to Image Bank${deleteAfterRecycle ? ' and removed from Draft Bank' : ''}`
  };
}

/**
 * Migrate existing image_bank from settings JSON to new table
 */
export async function migrateImageBankFromSettings(workflowId) {
  if (!isDatabaseEnabled()) return { migrated: 0 };

  // Get existing settings
  const settings = await sql`
    SELECT image_bank FROM image_creation_settings WHERE workflow_id = ${workflowId}
  `;

  if (!settings.length || !settings[0].image_bank) {
    return { migrated: 0, message: 'No image bank found in settings' };
  }

  const imageBankJson = settings[0].image_bank;
  const images = typeof imageBankJson === 'string' ? JSON.parse(imageBankJson) : imageBankJson;

  if (!Array.isArray(images) || images.length === 0) {
    return { migrated: 0, message: 'Image bank is empty' };
  }

  // Check if already migrated
  const existing = await sql`
    SELECT COUNT(*) as count FROM image_bank_items WHERE workflow_id = ${workflowId}
  `;
  if (existing[0].count > 0) {
    return { migrated: 0, message: `Already have ${existing[0].count} images in new table` };
  }

  // Migrate images
  const migrated = await addImagesToBank(workflowId, images);

  // Clear the image_bank from settings to reduce payload
  await sql`
    UPDATE image_creation_settings
    SET image_bank = '[]'::jsonb, updated_at = NOW()
    WHERE workflow_id = ${workflowId}
  `;

  return { migrated: migrated.length, message: `Migrated ${migrated.length} images` };
}
