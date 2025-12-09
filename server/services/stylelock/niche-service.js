/**
 * StyleLock Niche Service
 * Manages niches and their locked prompts
 */

import { sql, isDatabaseEnabled } from '../../db/index.js';

// Environment categories
export const ENVIRONMENTS = {
  'in-home': {
    name: 'In-Home',
    description: 'Services performed inside residential homes',
    examples: ['plumbing', 'electrical', 'house cleaning', 'carpet cleaning', 'interior painting']
  },
  'in-yard': {
    name: 'In-Yard',
    description: 'Services performed in residential yards/gardens',
    examples: ['landscaping', 'lawn care', 'tree service', 'pool cleaning', 'fence installation']
  },
  'in-office': {
    name: 'In-Office',
    description: 'Professional services in office settings',
    examples: ['accounting', 'legal services', 'consulting', 'real estate']
  },
  'on-site-field': {
    name: 'On-Site Field',
    description: 'Services at construction/industrial sites',
    examples: ['roofing', 'concrete', 'excavation', 'heavy equipment', 'solar installation']
  },
  'commercial': {
    name: 'Commercial',
    description: 'Services for commercial/business properties',
    examples: ['commercial cleaning', 'HVAC commercial', 'commercial plumbing', 'office maintenance']
  }
};

// In-memory storage fallback
const nichesCache = new Map();

/**
 * Create a new niche
 */
export async function createNiche(data) {
  const {
    name,
    description,
    environment,
    tags = []
  } = data;

  if (!name || !environment) {
    throw new Error('Name and environment are required');
  }

  if (!ENVIRONMENTS[environment]) {
    throw new Error(`Invalid environment: ${environment}. Valid: ${Object.keys(ENVIRONMENTS).join(', ')}`);
  }

  if (!isDatabaseEnabled()) {
    const id = Date.now();
    const niche = {
      id,
      name,
      description,
      environment,
      isLocked: false,
      lockedAt: null,
      lockedPrompt: null,
      lockedStyleDna: {},
      referenceImages: [],
      lockedByJobId: null,
      lockScore: null,
      lockTier: null,
      timesUsed: 0,
      lastUsedAt: null,
      tags,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    nichesCache.set(id, niche);
    return { success: true, niche, source: 'memory' };
  }

  try {
    const result = await sql`
      INSERT INTO stylelock_niches (name, description, environment, tags)
      VALUES (${name}, ${description}, ${environment}, ${JSON.stringify(tags)})
      RETURNING *
    `;

    return { success: true, niche: formatNiche(result[0]), source: 'database' };
  } catch (error) {
    throw new Error(`Failed to create niche: ${error.message}`);
  }
}

/**
 * Get all niches (optionally filtered)
 */
export async function getNiches(filters = {}) {
  const { environment, isLocked, limit = 100 } = filters;

  if (!isDatabaseEnabled()) {
    let niches = Array.from(nichesCache.values());
    if (environment) {
      niches = niches.filter(n => n.environment === environment);
    }
    if (isLocked !== undefined) {
      niches = niches.filter(n => n.isLocked === isLocked);
    }
    return niches.slice(0, limit);
  }

  try {
    let query;
    if (environment && isLocked !== undefined) {
      query = await sql`
        SELECT * FROM stylelock_niches
        WHERE environment = ${environment} AND is_locked = ${isLocked}
        ORDER BY times_used DESC, created_at DESC
        LIMIT ${limit}
      `;
    } else if (environment) {
      query = await sql`
        SELECT * FROM stylelock_niches
        WHERE environment = ${environment}
        ORDER BY times_used DESC, created_at DESC
        LIMIT ${limit}
      `;
    } else if (isLocked !== undefined) {
      query = await sql`
        SELECT * FROM stylelock_niches
        WHERE is_locked = ${isLocked}
        ORDER BY times_used DESC, created_at DESC
        LIMIT ${limit}
      `;
    } else {
      query = await sql`
        SELECT * FROM stylelock_niches
        ORDER BY times_used DESC, created_at DESC
        LIMIT ${limit}
      `;
    }

    return query.map(formatNiche);
  } catch (error) {
    throw new Error(`Failed to get niches: ${error.message}`);
  }
}

/**
 * Get a single niche by ID
 */
export async function getNiche(nicheId) {
  if (!isDatabaseEnabled()) {
    const niche = nichesCache.get(nicheId);
    return niche || null;
  }

  try {
    const result = await sql`
      SELECT * FROM stylelock_niches WHERE id = ${nicheId}
    `;

    return result.length > 0 ? formatNiche(result[0]) : null;
  } catch (error) {
    throw new Error(`Failed to get niche: ${error.message}`);
  }
}

/**
 * Lock a niche with a successful prompt
 */
export async function lockNiche(nicheId, lockData) {
  const {
    prompt,
    styleDNA,
    referenceImages,
    jobId,
    score,
    tier
  } = lockData;

  if (!isDatabaseEnabled()) {
    const niche = nichesCache.get(nicheId);
    if (!niche) throw new Error('Niche not found');

    niche.isLocked = true;
    niche.lockedAt = new Date();
    niche.lockedPrompt = prompt;
    niche.lockedStyleDna = styleDNA;
    niche.referenceImages = referenceImages;
    niche.lockedByJobId = jobId;
    niche.lockScore = score;
    niche.lockTier = tier;
    niche.updatedAt = new Date();

    return { success: true, niche, source: 'memory' };
  }

  try {
    const result = await sql`
      UPDATE stylelock_niches
      SET
        is_locked = true,
        locked_at = NOW(),
        locked_prompt = ${prompt},
        locked_style_dna = ${JSON.stringify(styleDNA)},
        reference_images = ${JSON.stringify(referenceImages)},
        locked_by_job_id = ${jobId},
        lock_score = ${score},
        lock_tier = ${tier},
        updated_at = NOW()
      WHERE id = ${nicheId}
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Niche not found');
    }

    return { success: true, niche: formatNiche(result[0]), source: 'database' };
  } catch (error) {
    throw new Error(`Failed to lock niche: ${error.message}`);
  }
}

/**
 * Unlock a niche (for re-solving)
 */
export async function unlockNiche(nicheId) {
  if (!isDatabaseEnabled()) {
    const niche = nichesCache.get(nicheId);
    if (!niche) throw new Error('Niche not found');

    niche.isLocked = false;
    niche.updatedAt = new Date();

    return { success: true, niche, source: 'memory' };
  }

  try {
    const result = await sql`
      UPDATE stylelock_niches
      SET is_locked = false, updated_at = NOW()
      WHERE id = ${nicheId}
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Niche not found');
    }

    return { success: true, niche: formatNiche(result[0]), source: 'database' };
  } catch (error) {
    throw new Error(`Failed to unlock niche: ${error.message}`);
  }
}

/**
 * Record niche usage
 */
export async function recordNicheUsage(nicheId) {
  if (!isDatabaseEnabled()) {
    const niche = nichesCache.get(nicheId);
    if (niche) {
      niche.timesUsed = (niche.timesUsed || 0) + 1;
      niche.lastUsedAt = new Date();
    }
    return { success: true };
  }

  try {
    await sql`
      UPDATE stylelock_niches
      SET times_used = times_used + 1, last_used_at = NOW()
      WHERE id = ${nicheId}
    `;

    return { success: true };
  } catch (error) {
    console.warn('Failed to record niche usage:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Find niche by name (case-insensitive partial match)
 */
export async function searchNiches(query, environment = null) {
  if (!isDatabaseEnabled()) {
    const lowerQuery = query.toLowerCase();
    let niches = Array.from(nichesCache.values());
    niches = niches.filter(n =>
      n.name.toLowerCase().includes(lowerQuery) ||
      (n.description && n.description.toLowerCase().includes(lowerQuery))
    );
    if (environment) {
      niches = niches.filter(n => n.environment === environment);
    }
    return niches;
  }

  try {
    const searchPattern = `%${query}%`;
    let result;

    if (environment) {
      result = await sql`
        SELECT * FROM stylelock_niches
        WHERE (name ILIKE ${searchPattern} OR description ILIKE ${searchPattern})
          AND environment = ${environment}
        ORDER BY times_used DESC
        LIMIT 20
      `;
    } else {
      result = await sql`
        SELECT * FROM stylelock_niches
        WHERE name ILIKE ${searchPattern} OR description ILIKE ${searchPattern}
        ORDER BY times_used DESC
        LIMIT 20
      `;
    }

    return result.map(formatNiche);
  } catch (error) {
    throw new Error(`Failed to search niches: ${error.message}`);
  }
}

/**
 * Delete a niche
 */
export async function deleteNiche(nicheId) {
  if (!isDatabaseEnabled()) {
    nichesCache.delete(nicheId);
    return { success: true, source: 'memory' };
  }

  try {
    await sql`DELETE FROM stylelock_niches WHERE id = ${nicheId}`;
    return { success: true, source: 'database' };
  } catch (error) {
    throw new Error(`Failed to delete niche: ${error.message}`);
  }
}

/**
 * Get environment list
 */
export function getEnvironments() {
  return Object.entries(ENVIRONMENTS).map(([key, value]) => ({
    key,
    ...value
  }));
}

/**
 * Format database row to niche object
 */
function formatNiche(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    environment: row.environment,
    isLocked: row.is_locked,
    lockedAt: row.locked_at,
    lockedPrompt: row.locked_prompt,
    lockedStyleDna: row.locked_style_dna || {},
    referenceImages: row.reference_images || [],
    lockedByJobId: row.locked_by_job_id,
    lockScore: row.lock_score ? parseFloat(row.lock_score) : null,
    lockTier: row.lock_tier,
    timesUsed: row.times_used || 0,
    lastUsedAt: row.last_used_at,
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
