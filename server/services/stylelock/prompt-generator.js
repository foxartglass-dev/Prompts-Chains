/**
 * StyleLock - Prompt Generator Service
 * Generates diverse FLUX prompts based on Style DNA
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load prompt template
const GENERATOR_PROMPT = fs.readFileSync(
  path.join(__dirname, 'prompts', 'generator.txt'),
  'utf-8'
);

/**
 * Generate multiple prompt variations
 * @param {object} styleDNA - Extracted style DNA
 * @param {string} targetDescription - What to generate
 * @param {object} options - Configuration options
 * @returns {object} - Generated prompts and cost
 */
export async function generatePrompts(styleDNA, targetDescription, apiKey, options = {}) {
  const {
    model = 'gpt-4o',
    count = 3,
    previousFeedback = '',
    uniformConfig = null,
    diversityStrategies = ['literal', 'lighting_focus', 'composition_focus']
  } = options;

  const openai = new OpenAI({ apiKey });

  // Format style DNA for prompt
  const styleDNAString = typeof styleDNA === 'string'
    ? styleDNA
    : JSON.stringify(styleDNA, null, 2);

  // Format uniform config if present
  let uniformString = 'None specified';
  if (uniformConfig && uniformConfig.enabled) {
    uniformString = `Worker wearing: ${uniformConfig.description}`;
    if (uniformConfig.colorHex) {
      uniformString += ` (primary color: ${uniformConfig.colorHex})`;
    }
  }

  // Generate prompts in parallel with different diversity strategies
  const tasks = [];

  for (let i = 0; i < count; i++) {
    const strategy = diversityStrategies[i % diversityStrategies.length];

    const filledPrompt = GENERATOR_PROMPT
      .replace('{STYLE_DNA}', styleDNAString)
      .replace('{TARGET_DESCRIPTION}', targetDescription)
      .replace('{UNIFORM_CONFIG}', uniformString)
      .replace('{DIVERSITY_STRATEGY}', strategy)
      .replace('{PREVIOUS_FEEDBACK}', previousFeedback || 'None - this is the first attempt');

    const task = openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: filledPrompt }],
      max_tokens: 500,
      temperature: 0.7 + (i * 0.1) // Slightly vary temperature for diversity
    });

    tasks.push({ task, strategy });
  }

  // Await all tasks
  const results = await Promise.allSettled(tasks.map(t => t.task));

  const prompts = [];
  let totalCost = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const strategy = tasks[i].strategy;

    if (result.status === 'fulfilled') {
      const response = result.value;
      const promptText = response.choices[0].message.content.trim();

      // Remove any quotes if the model wrapped the prompt
      const cleanedPrompt = promptText
        .replace(/^["']|["']$/g, '')
        .trim();

      prompts.push({
        prompt: cleanedPrompt,
        strategy,
        index: i
      });

      // Calculate cost
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      totalCost += (inputTokens * 0.005 / 1000) + (outputTokens * 0.015 / 1000);
    } else {
      console.warn(`Prompt generation ${i} failed:`, result.reason?.message);
      // Add a fallback prompt based on style DNA template
      if (styleDNA.styleTemplate) {
        prompts.push({
          prompt: styleDNA.styleTemplate.replace('{SUBJECT}', targetDescription),
          strategy: 'fallback',
          index: i
        });
      }
    }
  }

  return {
    prompts,
    count: prompts.length,
    cost: totalCost
  };
}

/**
 * Build a FLUX prompt from Style DNA and an action
 * For batch mode when style is already locked
 */
export function buildPromptFromTemplate(styleDNA, action, options = {}) {
  const { uniformConfig = null, imageType = 'inline' } = options;

  // Start with style template if available
  let prompt = styleDNA.styleTemplate
    ? styleDNA.styleTemplate.replace('{SUBJECT}', action)
    : action;

  // Add lighting from style DNA
  if (styleDNA.lighting) {
    const lighting = styleDNA.lighting;
    prompt += `, ${lighting.quality} ${lighting.type} lighting from ${lighting.direction}`;
    if (lighting.mood) {
      prompt += `, ${lighting.mood} mood`;
    }
  }

  // Add color characteristics
  if (styleDNA.color) {
    const color = styleDNA.color;
    if (color.palette) prompt += `, ${color.palette} color palette`;
    if (color.saturation) prompt += `, ${color.saturation} saturation`;
    if (color.gradingStyle) prompt += `, ${color.gradingStyle} color grading`;
  }

  // Add composition
  if (styleDNA.composition) {
    const comp = styleDNA.composition;
    if (comp.framing) prompt += `, ${comp.framing} shot`;
    if (comp.depthOfField) prompt += `, ${comp.depthOfField} depth of field`;
    if (comp.cameraAngle) prompt += `, ${comp.cameraAngle} angle`;
  }

  // Add technical details
  if (styleDNA.technical) {
    const tech = styleDNA.technical;
    if (tech.cameraType) prompt += `, shot on ${tech.cameraType}`;
    if (tech.lensType) prompt += `, ${tech.lensType} lens`;
  }

  // Add uniform if specified
  if (uniformConfig && uniformConfig.enabled && uniformConfig.description) {
    // Insert uniform description near the beginning
    const parts = prompt.split(',');
    if (parts.length > 1) {
      parts.splice(1, 0, ` worker wearing ${uniformConfig.description}`);
      prompt = parts.join(',');
    } else {
      prompt += `, worker wearing ${uniformConfig.description}`;
    }
  }

  // Add image type specific modifiers
  if (imageType === 'hero') {
    prompt += ', hero image, atmospheric, establishing shot';
  }

  // Add quality markers
  prompt += ', professional photography, sharp focus, high quality';

  return prompt;
}

/**
 * Refine a prompt based on feedback
 */
export async function refinePrompt(originalPrompt, feedback, styleDNA, apiKey, options = {}) {
  const { model = 'gpt-4o' } = options;

  const openai = new OpenAI({ apiKey });

  const refinementPrompt = `You are refining an AI image generation prompt based on feedback.

ORIGINAL PROMPT:
${originalPrompt}

STYLE DNA (target style):
${JSON.stringify(styleDNA, null, 2)}

FEEDBACK (what needs to change):
${feedback}

Your task: Rewrite the prompt incorporating the feedback to better match the style DNA.
Keep the same subject matter but adjust the technical details.
Output ONLY the new prompt, nothing else.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: refinementPrompt }],
      max_tokens: 500,
      temperature: 0.6
    });

    const refinedPrompt = response.choices[0].message.content.trim()
      .replace(/^["']|["']$/g, '');

    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const cost = (inputTokens * 0.005 / 1000) + (outputTokens * 0.015 / 1000);

    return {
      prompt: refinedPrompt,
      cost
    };

  } catch (error) {
    throw new Error(`Prompt refinement failed: ${error.message}`);
  }
}
