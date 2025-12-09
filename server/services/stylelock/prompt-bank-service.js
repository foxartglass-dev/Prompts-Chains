/**
 * StyleLock Prompt Bank Service
 * Manages reusable prompt templates across niches
 */

import { sql, isDatabaseEnabled } from '../../db/index.js';

// In-memory storage fallback
const promptsCache = new Map();

/**
 * Save a successful prompt to the bank
 */
export async function savePrompt(data) {
  const {
    promptTemplate,
    actionDescription,
    nicheId,
    styleDNA,
    score,
    tier,
    environment,
    tags = []
  } = data;

  if (!promptTemplate || !actionDescription) {
    throw new Error('Prompt template and action description are required');
  }

  if (!isDatabaseEnabled()) {
    const id = Date.now();
    const prompt = {
      id,
      promptTemplate,
      actionDescription,
      nicheId,
      styleDNA: styleDNA || {},
      score,
      tier,
      environment,
      tags,
      timesUsed: 0,
      averageScore: score,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    promptsCache.set(id, prompt);
    return { success: true, prompt, source: 'memory' };
  }

  try {
    const result = await sql`
      INSERT INTO stylelock_prompt_bank (
        prompt_template, action_description, niche_id, style_dna,
        score, tier, environment, tags
      )
      VALUES (
        ${promptTemplate}, ${actionDescription}, ${nicheId},
        ${JSON.stringify(styleDNA || {})}, ${score}, ${tier},
        ${environment}, ${JSON.stringify(tags)}
      )
      RETURNING *
    `;

    return { success: true, prompt: formatPrompt(result[0]), source: 'database' };
  } catch (error) {
    throw new Error(`Failed to save prompt: ${error.message}`);
  }
}

/**
 * Get all prompts (optionally filtered)
 */
export async function getPrompts(filters = {}) {
  const { nicheId, environment, minScore, limit = 100 } = filters;

  if (!isDatabaseEnabled()) {
    let prompts = Array.from(promptsCache.values());
    if (nicheId) {
      prompts = prompts.filter(p => p.nicheId === nicheId);
    }
    if (environment) {
      prompts = prompts.filter(p => p.environment === environment);
    }
    if (minScore) {
      prompts = prompts.filter(p => p.score >= minScore);
    }
    return prompts.slice(0, limit);
  }

  try {
    let query;
    if (nicheId) {
      query = await sql`
        SELECT * FROM stylelock_prompt_bank
        WHERE niche_id = ${nicheId}
        ORDER BY score DESC, times_used DESC
        LIMIT ${limit}
      `;
    } else if (environment && minScore) {
      query = await sql`
        SELECT * FROM stylelock_prompt_bank
        WHERE environment = ${environment} AND score >= ${minScore}
        ORDER BY score DESC, times_used DESC
        LIMIT ${limit}
      `;
    } else if (environment) {
      query = await sql`
        SELECT * FROM stylelock_prompt_bank
        WHERE environment = ${environment}
        ORDER BY score DESC, times_used DESC
        LIMIT ${limit}
      `;
    } else if (minScore) {
      query = await sql`
        SELECT * FROM stylelock_prompt_bank
        WHERE score >= ${minScore}
        ORDER BY score DESC, times_used DESC
        LIMIT ${limit}
      `;
    } else {
      query = await sql`
        SELECT * FROM stylelock_prompt_bank
        ORDER BY score DESC, times_used DESC
        LIMIT ${limit}
      `;
    }

    return query.map(formatPrompt);
  } catch (error) {
    throw new Error(`Failed to get prompts: ${error.message}`);
  }
}

/**
 * Get a single prompt by ID
 */
export async function getPrompt(promptId) {
  if (!isDatabaseEnabled()) {
    return promptsCache.get(promptId) || null;
  }

  try {
    const result = await sql`
      SELECT * FROM stylelock_prompt_bank WHERE id = ${promptId}
    `;

    return result.length > 0 ? formatPrompt(result[0]) : null;
  } catch (error) {
    throw new Error(`Failed to get prompt: ${error.message}`);
  }
}

/**
 * Find similar prompts by action description
 */
export async function findSimilarPrompts(actionDescription, options = {}) {
  const { environment, limit = 10 } = options;

  if (!isDatabaseEnabled()) {
    const lowerAction = actionDescription.toLowerCase();
    let prompts = Array.from(promptsCache.values());
    prompts = prompts.filter(p =>
      p.actionDescription.toLowerCase().includes(lowerAction) ||
      lowerAction.includes(p.actionDescription.toLowerCase())
    );
    if (environment) {
      prompts = prompts.filter(p => p.environment === environment);
    }
    // Sort by score
    prompts.sort((a, b) => (b.score || 0) - (a.score || 0));
    return prompts.slice(0, limit);
  }

  try {
    const searchPattern = `%${actionDescription}%`;
    let result;

    if (environment) {
      result = await sql`
        SELECT * FROM stylelock_prompt_bank
        WHERE action_description ILIKE ${searchPattern}
          AND environment = ${environment}
        ORDER BY score DESC, times_used DESC
        LIMIT ${limit}
      `;
    } else {
      result = await sql`
        SELECT * FROM stylelock_prompt_bank
        WHERE action_description ILIKE ${searchPattern}
        ORDER BY score DESC, times_used DESC
        LIMIT ${limit}
      `;
    }

    return result.map(formatPrompt);
  } catch (error) {
    throw new Error(`Failed to find similar prompts: ${error.message}`);
  }
}

/**
 * Record prompt usage and update average score
 */
export async function recordPromptUsage(promptId, newScore = null) {
  if (!isDatabaseEnabled()) {
    const prompt = promptsCache.get(promptId);
    if (prompt) {
      prompt.timesUsed = (prompt.timesUsed || 0) + 1;
      prompt.lastUsedAt = new Date();
      if (newScore !== null) {
        // Update running average
        const oldAvg = prompt.averageScore || prompt.score || 0;
        const n = prompt.timesUsed;
        prompt.averageScore = ((oldAvg * (n - 1)) + newScore) / n;
      }
    }
    return { success: true };
  }

  try {
    if (newScore !== null) {
      // Update with new score contribution to average
      await sql`
        UPDATE stylelock_prompt_bank
        SET
          times_used = times_used + 1,
          last_used_at = NOW(),
          average_score = COALESCE(
            ((average_score * times_used) + ${newScore}) / (times_used + 1),
            ${newScore}
          ),
          updated_at = NOW()
        WHERE id = ${promptId}
      `;
    } else {
      await sql`
        UPDATE stylelock_prompt_bank
        SET times_used = times_used + 1, last_used_at = NOW()
        WHERE id = ${promptId}
      `;
    }

    return { success: true };
  } catch (error) {
    console.warn('Failed to record prompt usage:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get top-performing prompts
 */
export async function getTopPrompts(options = {}) {
  const { environment, minScore = 80, limit = 20 } = options;

  if (!isDatabaseEnabled()) {
    let prompts = Array.from(promptsCache.values());
    prompts = prompts.filter(p => (p.score || 0) >= minScore);
    if (environment) {
      prompts = prompts.filter(p => p.environment === environment);
    }
    prompts.sort((a, b) => (b.score || 0) - (a.score || 0));
    return prompts.slice(0, limit);
  }

  try {
    let result;
    if (environment) {
      result = await sql`
        SELECT * FROM stylelock_prompt_bank
        WHERE score >= ${minScore} AND environment = ${environment}
        ORDER BY score DESC, average_score DESC, times_used DESC
        LIMIT ${limit}
      `;
    } else {
      result = await sql`
        SELECT * FROM stylelock_prompt_bank
        WHERE score >= ${minScore}
        ORDER BY score DESC, average_score DESC, times_used DESC
        LIMIT ${limit}
      `;
    }

    return result.map(formatPrompt);
  } catch (error) {
    throw new Error(`Failed to get top prompts: ${error.message}`);
  }
}

/**
 * Delete a prompt
 */
export async function deletePrompt(promptId) {
  if (!isDatabaseEnabled()) {
    promptsCache.delete(promptId);
    return { success: true, source: 'memory' };
  }

  try {
    await sql`DELETE FROM stylelock_prompt_bank WHERE id = ${promptId}`;
    return { success: true, source: 'database' };
  } catch (error) {
    throw new Error(`Failed to delete prompt: ${error.message}`);
  }
}

/**
 * Get prompts by niche
 */
export async function getNichePrompts(nicheId, limit = 50) {
  return getPrompts({ nicheId, limit });
}

/**
 * Get prompt statistics
 */
export async function getPromptStats() {
  if (!isDatabaseEnabled()) {
    const prompts = Array.from(promptsCache.values());
    const byEnvironment = {};
    const byTier = {};

    for (const p of prompts) {
      byEnvironment[p.environment] = (byEnvironment[p.environment] || 0) + 1;
      if (p.tier) {
        byTier[p.tier] = (byTier[p.tier] || 0) + 1;
      }
    }

    return {
      total: prompts.length,
      byEnvironment,
      byTier,
      averageScore: prompts.length > 0
        ? prompts.reduce((sum, p) => sum + (p.score || 0), 0) / prompts.length
        : 0
    };
  }

  try {
    const totalResult = await sql`SELECT COUNT(*) as count FROM stylelock_prompt_bank`;
    const avgResult = await sql`SELECT AVG(score) as avg FROM stylelock_prompt_bank`;
    const envResult = await sql`
      SELECT environment, COUNT(*) as count
      FROM stylelock_prompt_bank
      GROUP BY environment
    `;
    const tierResult = await sql`
      SELECT tier, COUNT(*) as count
      FROM stylelock_prompt_bank
      WHERE tier IS NOT NULL
      GROUP BY tier
    `;

    const byEnvironment = {};
    for (const row of envResult) {
      byEnvironment[row.environment] = parseInt(row.count);
    }

    const byTier = {};
    for (const row of tierResult) {
      byTier[row.tier] = parseInt(row.count);
    }

    return {
      total: parseInt(totalResult[0].count),
      byEnvironment,
      byTier,
      averageScore: avgResult[0].avg ? parseFloat(avgResult[0].avg) : 0
    };
  } catch (error) {
    throw new Error(`Failed to get prompt stats: ${error.message}`);
  }
}

/**
 * Format database row to prompt object
 */
function formatPrompt(row) {
  return {
    id: row.id,
    promptTemplate: row.prompt_template,
    actionDescription: row.action_description,
    nicheId: row.niche_id,
    styleDNA: row.style_dna || {},
    score: row.score ? parseFloat(row.score) : null,
    tier: row.tier,
    environment: row.environment,
    tags: row.tags || [],
    timesUsed: row.times_used || 0,
    averageScore: row.average_score ? parseFloat(row.average_score) : null,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
