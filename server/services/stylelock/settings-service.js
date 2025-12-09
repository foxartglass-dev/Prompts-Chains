/**
 * StyleLock Settings Service
 * Manages persistent settings with presets and per-website overrides
 */

import { sql, isDatabaseEnabled } from '../../db/index.js';
import { DEFAULT_SETTINGS, mergeSettings, validateSettings } from './default-settings.js';

// In-memory cache for settings (fallback when DB not available)
const settingsCache = new Map();
let globalSettingsCache = null;

// Preset definitions
export const PRESETS = {
  conservative: {
    name: 'conservative',
    description: 'Lower cost, fewer rounds - good for simple niches',
    settings: {
      generation: { numGenerators: 2, maxRounds: 5 },
      voting: { numVoters: 3, advanceThreshold: 80 },
      blindTest: { numJudges: 3, passThreshold: 0.5 },
      limits: { maxCost: 2.00 }
    }
  },
  balanced: {
    name: 'balanced',
    description: 'Default settings - good balance of quality and cost',
    settings: {
      generation: { numGenerators: 3, maxRounds: 10 },
      voting: { numVoters: 3, advanceThreshold: 85 },
      blindTest: { numJudges: 3, passThreshold: 0.66 },
      limits: { maxCost: 5.00 }
    }
  },
  aggressive: {
    name: 'aggressive',
    description: 'Higher quality, more cost - for difficult niches',
    settings: {
      generation: { numGenerators: 5, maxRounds: 15 },
      voting: { numVoters: 5, advanceThreshold: 90 },
      blindTest: { numJudges: 5, passThreshold: 0.8 },
      limits: { maxCost: 10.00 }
    }
  }
};

/**
 * Get global settings
 * Returns database settings if available, otherwise defaults
 */
export async function getGlobalSettings() {
  // Check cache first
  if (globalSettingsCache) {
    return globalSettingsCache;
  }

  if (!isDatabaseEnabled()) {
    return DEFAULT_SETTINGS;
  }

  try {
    const result = await sql`
      SELECT settings, preset_name
      FROM stylelock_settings
      WHERE website_id IS NULL AND is_active = true
      LIMIT 1
    `;

    if (result.length > 0) {
      const dbSettings = mergeSettings(result[0].settings);
      globalSettingsCache = dbSettings;
      return dbSettings;
    }

    return DEFAULT_SETTINGS;
  } catch (error) {
    console.warn('Failed to load global settings from DB:', error.message);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Get settings for a specific website
 * Falls back to global settings if no website-specific settings
 */
export async function getWebsiteSettings(websiteId) {
  if (!websiteId) {
    return getGlobalSettings();
  }

  // Check cache
  const cacheKey = `website_${websiteId}`;
  if (settingsCache.has(cacheKey)) {
    return settingsCache.get(cacheKey);
  }

  if (!isDatabaseEnabled()) {
    return DEFAULT_SETTINGS;
  }

  try {
    // Get website-specific settings
    const result = await sql`
      SELECT settings, preset_name
      FROM stylelock_settings
      WHERE website_id = ${websiteId} AND is_active = true
      LIMIT 1
    `;

    if (result.length > 0) {
      const globalSettings = await getGlobalSettings();
      const websiteOverrides = result[0].settings;
      const merged = mergeSettings({ ...globalSettings, ...websiteOverrides });
      settingsCache.set(cacheKey, merged);
      return merged;
    }

    // Fall back to global
    return getGlobalSettings();
  } catch (error) {
    console.warn('Failed to load website settings from DB:', error.message);
    return getGlobalSettings();
  }
}

/**
 * Save global settings
 */
export async function saveGlobalSettings(settings, presetName = 'custom') {
  const validation = validateSettings(mergeSettings(settings));
  if (!validation.valid) {
    throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
  }

  // Clear cache
  globalSettingsCache = null;

  if (!isDatabaseEnabled()) {
    // Store in memory only
    globalSettingsCache = mergeSettings(settings);
    return { success: true, source: 'memory' };
  }

  try {
    // Deactivate current global settings
    await sql`
      UPDATE stylelock_settings
      SET is_active = false, updated_at = NOW()
      WHERE website_id IS NULL AND is_active = true
    `;

    // Insert new settings
    await sql`
      INSERT INTO stylelock_settings (website_id, preset_name, settings, is_active)
      VALUES (NULL, ${presetName}, ${JSON.stringify(settings)}, true)
    `;

    globalSettingsCache = mergeSettings(settings);
    return { success: true, source: 'database' };
  } catch (error) {
    throw new Error(`Failed to save settings: ${error.message}`);
  }
}

/**
 * Save website-specific settings
 */
export async function saveWebsiteSettings(websiteId, settings, presetName = 'custom') {
  if (!websiteId) {
    throw new Error('Website ID is required');
  }

  const validation = validateSettings(mergeSettings(settings));
  if (!validation.valid) {
    throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
  }

  // Clear cache
  settingsCache.delete(`website_${websiteId}`);

  if (!isDatabaseEnabled()) {
    settingsCache.set(`website_${websiteId}`, mergeSettings(settings));
    return { success: true, source: 'memory' };
  }

  try {
    // Deactivate current website settings
    await sql`
      UPDATE stylelock_settings
      SET is_active = false, updated_at = NOW()
      WHERE website_id = ${websiteId} AND is_active = true
    `;

    // Insert new settings
    await sql`
      INSERT INTO stylelock_settings (website_id, preset_name, settings, is_active)
      VALUES (${websiteId}, ${presetName}, ${JSON.stringify(settings)}, true)
    `;

    return { success: true, source: 'database' };
  } catch (error) {
    throw new Error(`Failed to save website settings: ${error.message}`);
  }
}

/**
 * Apply a preset to global settings
 */
export async function applyPreset(presetName) {
  const preset = PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`);
  }

  return saveGlobalSettings(preset.settings, presetName);
}

/**
 * Apply a preset to website settings
 */
export async function applyWebsitePreset(websiteId, presetName) {
  const preset = PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`);
  }

  return saveWebsiteSettings(websiteId, preset.settings, presetName);
}

/**
 * Get all available presets
 */
export function getPresets() {
  return Object.values(PRESETS).map(p => ({
    name: p.name,
    description: p.description,
    settings: mergeSettings(p.settings)
  }));
}

/**
 * Delete website-specific settings (revert to global)
 */
export async function deleteWebsiteSettings(websiteId) {
  if (!websiteId) {
    throw new Error('Website ID is required');
  }

  settingsCache.delete(`website_${websiteId}`);

  if (!isDatabaseEnabled()) {
    return { success: true, source: 'memory' };
  }

  try {
    await sql`
      DELETE FROM stylelock_settings
      WHERE website_id = ${websiteId}
    `;

    return { success: true, source: 'database' };
  } catch (error) {
    throw new Error(`Failed to delete website settings: ${error.message}`);
  }
}

/**
 * Get settings history for a website or global
 */
export async function getSettingsHistory(websiteId = null, limit = 10) {
  if (!isDatabaseEnabled()) {
    return [];
  }

  try {
    if (websiteId) {
      const result = await sql`
        SELECT id, preset_name, settings, is_active, created_at, updated_at
        FROM stylelock_settings
        WHERE website_id = ${websiteId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return result;
    } else {
      const result = await sql`
        SELECT id, preset_name, settings, is_active, created_at, updated_at
        FROM stylelock_settings
        WHERE website_id IS NULL
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return result;
    }
  } catch (error) {
    console.warn('Failed to get settings history:', error.message);
    return [];
  }
}

/**
 * Clear all caches (useful after bulk operations)
 */
export function clearSettingsCache() {
  globalSettingsCache = null;
  settingsCache.clear();
}

/**
 * Get effective settings for a job
 * Merges: defaults -> global -> website -> job overrides
 */
export async function getEffectiveSettings(websiteId = null, jobOverrides = {}) {
  const baseSettings = websiteId
    ? await getWebsiteSettings(websiteId)
    : await getGlobalSettings();

  return mergeSettings({ ...baseSettings, ...jobOverrides });
}
