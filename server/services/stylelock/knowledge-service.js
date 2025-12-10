/**
 * Knowledge Service
 * Loads training data and prompts for StyleLock engine
 */

import { sql, isDatabaseEnabled } from '../../db/index.js';

// In-memory cache
let knowledgeCache = null;
let promptsCache = {};
let cacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Get all training knowledge combined
 */
export async function getKnowledge() {
  if (!isDatabaseEnabled()) {
    return [];
  }

  // Check cache
  if (knowledgeCache && Date.now() - cacheTime < CACHE_TTL) {
    return knowledgeCache;
  }

  try {
    const files = await sql`
      SELECT content FROM stylelock_knowledge
      WHERE file_type = 'training'
    `;

    let combined = [];
    for (const file of files) {
      if (Array.isArray(file.content)) {
        combined = combined.concat(file.content);
      }
    }

    knowledgeCache = combined;
    cacheTime = Date.now();
    return combined;
  } catch (error) {
    console.error('Failed to load knowledge:', error);
    return [];
  }
}

/**
 * Format knowledge for inclusion in prompts
 */
export async function getKnowledgeText() {
  const knowledge = await getKnowledge();

  if (knowledge.length === 0) {
    return 'No training data loaded.';
  }

  // Format knowledge items for prompt
  return knowledge.map((item, i) => {
    if (typeof item === 'string') return item;
    if (item.prompt && item.image) {
      return `Example ${i + 1}:\nPrompt: ${item.prompt}\nImage: ${item.image}`;
    }
    if (item.text) return item.text;
    return JSON.stringify(item);
  }).join('\n\n');
}

/**
 * Get editable prompt by type
 */
export async function getPrompt(promptType) {
  if (!isDatabaseEnabled()) {
    return getDefaultPrompt(promptType);
  }

  // Check cache
  if (promptsCache[promptType] && Date.now() - promptsCache[promptType].time < CACHE_TTL) {
    return promptsCache[promptType].text;
  }

  try {
    const prompts = await sql`
      SELECT prompt_text FROM stylelock_prompts
      WHERE prompt_type = ${promptType} AND is_active = true
    `;

    if (prompts.length > 0) {
      promptsCache[promptType] = { text: prompts[0].prompt_text, time: Date.now() };
      return prompts[0].prompt_text;
    }
  } catch (error) {
    console.error(`Failed to load prompt ${promptType}:`, error);
  }

  return getDefaultPrompt(promptType);
}

/**
 * Default prompts (fallback)
 */
function getDefaultPrompt(promptType) {
  const defaults = {
    style_dna: `Analyze these reference images and extract the visual style DNA. Focus on lighting, colors, composition, mood, and technical style. Output as JSON with styleTemplate, lighting, colors, composition, mood, technicalNotes.`,

    generator: `You are a master AI image prompt engineer. Create a detailed FLUX prompt that matches the given Style DNA for the target action. Use specific photography terminology. The prompt should be 3-4 sentences minimum with precise descriptions of lighting, colors, composition, and mood.`,

    voter: `Score this generated image 0-100 based on how well it matches the reference style. Be strict - only 90+ if nearly indistinguishable. Provide specific feedback on what matches and what needs improvement. Give actionable suggestions for the next attempt.`,

    judge: `Blind test: Look at these images. Some are real reference photos, one is AI-generated. Try to identify which is AI. If you cannot tell, the AI passes. Report your guess, confidence, and reasoning.`
  };

  return defaults[promptType] || '';
}

/**
 * Fill prompt template with variables
 */
export function fillPromptTemplate(template, variables) {
  let filled = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    filled = filled.replace(new RegExp(placeholder, 'g'), value || '');
  }
  return filled;
}

/**
 * Clear caches (useful after updates)
 */
export function clearKnowledgeCache() {
  knowledgeCache = null;
  promptsCache = {};
  cacheTime = 0;
}

// ============================================
// ROUND LOGGING
// ============================================

/**
 * Log a round image to database
 */
export async function logRoundImage(jobId, roundNum, generatorIndex, prompt, imageUrl, imageData = null) {
  if (!isDatabaseEnabled()) return null;

  try {
    const result = await sql`
      INSERT INTO stylelock_round_images (job_id, round_num, generator_index, prompt_used, image_url, image_data)
      VALUES (${jobId}, ${roundNum}, ${generatorIndex}, ${prompt}, ${imageUrl}, ${imageData})
      RETURNING id
    `;
    return result[0]?.id;
  } catch (error) {
    console.error('Failed to log round image:', error);
    return null;
  }
}

/**
 * Update image with votes
 */
export async function updateImageVotes(imageId, votes, avgScore, isWinner = false) {
  if (!isDatabaseEnabled() || !imageId) return;

  try {
    await sql`
      UPDATE stylelock_round_images
      SET votes = ${JSON.stringify(votes)}, avg_score = ${avgScore}, is_winner = ${isWinner}
      WHERE id = ${imageId}
    `;
  } catch (error) {
    console.error('Failed to update image votes:', error);
  }
}

/**
 * Log a round event
 */
export async function logRoundEvent(jobId, roundNum, eventType, details) {
  if (!isDatabaseEnabled()) return;

  try {
    await sql`
      INSERT INTO stylelock_round_logs (job_id, round_num, event_type, details)
      VALUES (${jobId}, ${roundNum}, ${eventType}, ${JSON.stringify(details)})
    `;
  } catch (error) {
    console.error('Failed to log round event:', error);
  }
}

/**
 * Download and store image as base64
 */
export async function downloadAndStoreImage(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('Failed to download image:', error);
    return null;
  }
}

export default {
  getKnowledge,
  getKnowledgeText,
  getPrompt,
  fillPromptTemplate,
  clearKnowledgeCache,
  logRoundImage,
  updateImageVotes,
  logRoundEvent,
  downloadAndStoreImage
};
