/**
 * Prompt Engineering Service
 *
 * Manages the AI Prompt Engineering system:
 * - Playbook: Master knowledge base for new agents
 * - Tricks: Specific techniques that work
 * - Research: Web research findings
 * - History: Track results and critiques
 * - Handoffs: Knowledge transfer between sessions
 */

import { sql, isDatabaseEnabled } from '../db/index.js';

// ============================================
// PLAYBOOK - Master Knowledge Base
// ============================================

/**
 * Get the full playbook for agent onboarding
 */
export async function getPlaybook(category = null) {
  if (!isDatabaseEnabled()) return [];

  if (category) {
    return await sql`
      SELECT * FROM prompt_engineering_playbook
      WHERE is_active = true AND category = ${category}
      ORDER BY priority DESC, created_at ASC
    `;
  }

  return await sql`
    SELECT * FROM prompt_engineering_playbook
    WHERE is_active = true
    ORDER BY priority DESC, created_at ASC
  `;
}

/**
 * Add a new playbook entry
 */
export async function addPlaybookEntry({ category, title, content, priority = 0, applicable_to = ['all'], created_by = 'agent' }) {
  if (!isDatabaseEnabled()) return null;

  const result = await sql`
    INSERT INTO prompt_engineering_playbook (category, title, content, priority, applicable_to, created_by)
    VALUES (${category}, ${title}, ${content}, ${priority}, ${JSON.stringify(applicable_to)}, ${created_by})
    RETURNING *
  `;
  return result[0];
}

// ============================================
// TRICKS - Specific Techniques
// ============================================

/**
 * Get all prompt tricks, optionally filtered by tags
 */
export async function getTricks(tags = null, avatarId = null) {
  if (!isDatabaseEnabled()) return [];

  let query = sql`SELECT * FROM prompt_tricks WHERE 1=1`;

  if (avatarId) {
    return await sql`
      SELECT * FROM prompt_tricks
      WHERE avatar_id = ${avatarId} OR avatar_id IS NULL
      ORDER BY success_rate DESC, times_used DESC
    `;
  }

  return await sql`
    SELECT * FROM prompt_tricks
    ORDER BY success_rate DESC, times_used DESC
  `;
}

/**
 * Add a new prompt trick
 */
export async function addTrick({
  problem,
  solution_prompt,
  explanation = null,
  example_before = null,
  example_after = null,
  tags = [],
  discovered_by = 'agent',
  avatar_id = null
}) {
  if (!isDatabaseEnabled()) return null;

  const result = await sql`
    INSERT INTO prompt_tricks (problem, solution_prompt, explanation, example_before, example_after, tags, discovered_by, avatar_id)
    VALUES (${problem}, ${solution_prompt}, ${explanation}, ${example_before}, ${example_after}, ${JSON.stringify(tags)}, ${discovered_by}, ${avatar_id})
    RETURNING *
  `;
  return result[0];
}

/**
 * Record that a trick was used and whether it worked
 */
export async function recordTrickUsage(trickId, success = true) {
  if (!isDatabaseEnabled()) return null;

  // Update times_used and adjust success_rate
  const result = await sql`
    UPDATE prompt_tricks
    SET
      times_used = times_used + 1,
      success_rate = CASE
        WHEN ${success} THEN LEAST(success_rate + 5, 100)
        ELSE GREATEST(success_rate - 10, 0)
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${trickId}
    RETURNING *
  `;
  return result[0];
}

// ============================================
// REFERENCE PHOTOS - Avatar Crew Photos
// ============================================

/**
 * Get reference photos for an avatar
 */
export async function getReferencePhotos(avatarId, workflowId) {
  if (!isDatabaseEnabled()) return [];

  return await sql`
    SELECT * FROM avatar_reference_photos
    WHERE avatar_id = ${avatarId} AND workflow_id = ${workflowId}
    ORDER BY created_at DESC
  `;
}

/**
 * Add a reference photo
 */
export async function addReferencePhoto({ avatar_id, workflow_id, image_url, image_type = 'general', description = null, ai_analysis = null }) {
  if (!isDatabaseEnabled()) return null;

  const result = await sql`
    INSERT INTO avatar_reference_photos (avatar_id, workflow_id, image_url, image_type, description, ai_analysis)
    VALUES (${avatar_id}, ${workflow_id}, ${image_url}, ${image_type}, ${description}, ${ai_analysis})
    RETURNING *
  `;
  return result[0];
}

// ============================================
// RESEARCH - Web Research Findings
// ============================================

/**
 * Get research for an avatar
 */
export async function getResearch(avatarId, workflowId) {
  if (!isDatabaseEnabled()) return [];

  return await sql`
    SELECT * FROM avatar_research
    WHERE avatar_id = ${avatarId} AND workflow_id = ${workflowId}
    ORDER BY created_at DESC
  `;
}

/**
 * Save research findings
 */
export async function saveResearch({ avatar_id, workflow_id, research_query, findings, sources = [] }) {
  if (!isDatabaseEnabled()) return null;

  const result = await sql`
    INSERT INTO avatar_research (avatar_id, workflow_id, research_query, findings, sources)
    VALUES (${avatar_id}, ${workflow_id}, ${research_query}, ${JSON.stringify(findings)}, ${JSON.stringify(sources)})
    RETURNING *
  `;
  return result[0];
}

// ============================================
// HISTORY - Generation History & Critiques
// ============================================

/**
 * Record a prompt generation with optional critique
 */
export async function recordGeneration({
  workflow_id,
  avatar_id,
  prompt_used,
  generated_image_url = null,
  ai_critique = null,
  rating = null,
  what_worked = null,
  what_to_improve = null,
  adjusted_prompt = null,
  model_used = null
}) {
  if (!isDatabaseEnabled()) return null;

  const result = await sql`
    INSERT INTO prompt_generation_history
    (workflow_id, avatar_id, prompt_used, generated_image_url, ai_critique, rating, what_worked, what_to_improve, adjusted_prompt, model_used)
    VALUES (${workflow_id}, ${avatar_id}, ${prompt_used}, ${generated_image_url}, ${ai_critique}, ${rating}, ${what_worked}, ${what_to_improve}, ${adjusted_prompt}, ${model_used})
    RETURNING *
  `;
  return result[0];
}

/**
 * Get generation history for learning
 */
export async function getGenerationHistory(workflowId, avatarId = null, limit = 50) {
  if (!isDatabaseEnabled()) return [];

  if (avatarId) {
    return await sql`
      SELECT * FROM prompt_generation_history
      WHERE workflow_id = ${workflowId} AND avatar_id = ${avatarId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }

  return await sql`
    SELECT * FROM prompt_generation_history
    WHERE workflow_id = ${workflowId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

// ============================================
// HANDOFFS - Agent Knowledge Transfer
// ============================================

/**
 * Create an agent handoff document
 */
export async function createHandoff({
  workflow_id,
  avatar_id = null,
  session_summary,
  key_learnings = [],
  unresolved_issues = [],
  recommendations = [],
  tricks_discovered = []
}) {
  if (!isDatabaseEnabled()) return null;

  const result = await sql`
    INSERT INTO agent_handoffs
    (workflow_id, avatar_id, session_summary, key_learnings, unresolved_issues, recommendations, tricks_discovered)
    VALUES (${workflow_id}, ${avatar_id}, ${session_summary}, ${JSON.stringify(key_learnings)}, ${JSON.stringify(unresolved_issues)}, ${JSON.stringify(recommendations)}, ${JSON.stringify(tricks_discovered)})
    RETURNING *
  `;
  return result[0];
}

/**
 * Get the latest handoff for an agent to read
 */
export async function getLatestHandoff(workflowId, avatarId = null) {
  if (!isDatabaseEnabled()) return null;

  const result = await sql`
    SELECT * FROM agent_handoffs
    WHERE workflow_id = ${workflowId}
    ${avatarId ? sql`AND avatar_id = ${avatarId}` : sql``}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return result[0] || null;
}

/**
 * Get all handoffs for comprehensive learning
 */
export async function getAllHandoffs(workflowId) {
  if (!isDatabaseEnabled()) return [];

  return await sql`
    SELECT * FROM agent_handoffs
    WHERE workflow_id = ${workflowId}
    ORDER BY created_at DESC
  `;
}

// ============================================
// AGENT ONBOARDING - Full Context Load
// ============================================

/**
 * Get everything a new agent needs to become an expert
 * This is the "cockpit" - all knowledge loaded at once
 */
export async function getAgentOnboardingContext(workflowId, avatarId = null) {
  const [playbook, tricks, handoffs, history] = await Promise.all([
    getPlaybook(),
    getTricks(null, avatarId),
    getAllHandoffs(workflowId),
    getGenerationHistory(workflowId, avatarId, 20)
  ]);

  // Get avatar-specific data if provided
  let referencePhotos = [];
  let research = [];
  if (avatarId) {
    [referencePhotos, research] = await Promise.all([
      getReferencePhotos(avatarId, workflowId),
      getResearch(avatarId, workflowId)
    ]);
  }

  return {
    playbook,
    tricks,
    handoffs,
    recentHistory: history,
    referencePhotos,
    research,
    summary: {
      playbookEntries: playbook.length,
      tricksAvailable: tricks.length,
      pastSessions: handoffs.length,
      generationsToLearnFrom: history.length,
      referencePhotosAvailable: referencePhotos.length,
      researchFindings: research.length
    }
  };
}

export default {
  // Playbook
  getPlaybook,
  addPlaybookEntry,
  // Tricks
  getTricks,
  addTrick,
  recordTrickUsage,
  // Reference Photos
  getReferencePhotos,
  addReferencePhoto,
  // Research
  getResearch,
  saveResearch,
  // History
  recordGeneration,
  getGenerationHistory,
  // Handoffs
  createHandoff,
  getLatestHandoff,
  getAllHandoffs,
  // Onboarding
  getAgentOnboardingContext
};
