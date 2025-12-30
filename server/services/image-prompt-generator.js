/**
 * Image Prompt Generator Service
 * Uses GPT-4o-mini to analyze content and generate FLUX-optimized prompts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const MODEL_SMART = 'gpt-4o'; // Smarter model for guided mode

/**
 * Convert a local file path to base64 data URL
 */
function localFileToBase64(localPath) {
  // Remove leading slash and build full path
  const relativePath = localPath.startsWith('/') ? localPath.substring(1) : localPath;
  const fullPath = path.join(__dirname, '..', '..', relativePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${localPath}`);
  }

  const fileBuffer = fs.readFileSync(fullPath);
  const base64 = fileBuffer.toString('base64');

  // Determine MIME type from extension
  const ext = path.extname(fullPath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  const mimeType = mimeTypes[ext] || 'image/jpeg';

  return `data:${mimeType};base64,${base64}`;
}

/**
 * Check if a URL is a local file path
 */
function isLocalPath(url) {
  return url.startsWith('/uploads/') || url.startsWith('uploads/');
}

/**
 * Call OpenAI GPT API
 * @param {Array} messages - Chat messages
 * @param {string} apiKey - OpenAI API key
 * @param {object} options - Options including model, temperature, maxTokens
 */
async function callGPT(messages, apiKey, options = {}) {
  const model = options.model || MODEL; // Default to gpt-4o-mini

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1000
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Extract Style DNA from reference images
 * Analyzes reference images to create a reusable prompt template
 *
 * @param {Array<{url: string, description?: string}>} referenceImages - Reference images
 * @param {string} apiKey - OpenAI API key
 * @param {object} options - Additional options
 * @returns {Promise<{styleTemplate: string, attributes: object, rawAnalysis: string}>}
 */
export async function extractStyleDNA(referenceImages, apiKey, options = {}) {
  if (!referenceImages || referenceImages.length === 0) {
    throw new Error('At least one reference image is required');
  }

  // Build vision content with images - convert local paths to base64
  const imageContent = [];
  for (const img of referenceImages) {
    let imageUrl = img.url;

    // If it's a local file path, convert to base64
    if (isLocalPath(imageUrl)) {
      try {
        imageUrl = localFileToBase64(imageUrl);
      } catch (err) {
        console.error(`Failed to load local image ${img.url}:`, err.message);
        continue; // Skip this image but continue with others
      }
    }

    imageContent.push({
      type: 'image_url',
      image_url: {
        url: imageUrl,
        detail: 'low' // Use low detail to reduce tokens
      }
    });
  }

  if (imageContent.length === 0) {
    throw new Error('No valid images could be loaded');
  }

  const systemPrompt = `You are an expert at analyzing visual styles and creating image generation prompts.
Your task is to analyze reference images and extract a reusable "Style DNA" template for FLUX 1.1 Pro.`;

  const userPrompt = `Analyze these ${imageContent.length} reference images and extract a reusable style template.

Focus on identifying:
1. **Color Palette**: Dominant colors, tones, and color relationships
2. **Lighting**: Type (natural, studio, dramatic), direction, quality
3. **Composition**: How subjects are positioned, use of space, framing
4. **Artistic Style**: Photorealistic, illustration, 3D render, vintage, modern, etc.
5. **Mood/Atmosphere**: The emotional feel and energy
6. **Recurring Elements**: Any consistent visual elements or patterns

Create a prompt template optimized for FLUX 1.1 Pro image generation.
Use {ACTION} as a placeholder where the specific scene/subject would be inserted.

Respond in this exact JSON format:
{
  "styleTemplate": "A [style] image of {ACTION}, [lighting details], [composition], [color/mood], [quality descriptors]",
  "attributes": {
    "colorPalette": ["#hex1", "#hex2", "#hex3"],
    "lighting": "description of lighting style",
    "composition": "description of composition approach",
    "style": "artistic style category",
    "mood": "mood keywords separated by commas",
    "quality": "quality and detail keywords"
  },
  "negativePrompt": "things to avoid in generations"
}`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          ...imageContent
        ]
      }
    ];

    const rawResponse = await callGPT(messages, apiKey, { temperature: 0.5 });

    // Parse JSON from response
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse Style DNA response');
    }

    const styleDNA = JSON.parse(jsonMatch[0]);

    return {
      styleTemplate: styleDNA.styleTemplate,
      attributes: styleDNA.attributes,
      negativePrompt: styleDNA.negativePrompt || '',
      rawAnalysis: rawResponse
    };
  } catch (error) {
    console.error('Style DNA extraction error:', error);
    throw error;
  }
}

/**
 * Extract action/concept from an article section
 *
 * @param {string} sectionContent - Text content of the section
 * @param {object} context - Additional context
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<{action: string, mood: string, subjects: string[], setting: string}>}
 */
export async function extractAction(sectionContent, context = {}, apiKey) {
  if (!sectionContent) {
    throw new Error('Section content is required');
  }

  const { articleTitle = '', keyword = '', imageType = 'inline' } = context;

  const systemPrompt = `You are an expert at extracting visual concepts from text for image generation.
Your task is to identify the PRIMARY visual action or concept that should be illustrated.`;

  const userPrompt = `Read this article section and identify the visual concept to illustrate.

${articleTitle ? `Article Title: "${articleTitle}"` : ''}
${keyword ? `Topic/Business: "${keyword}"` : ''}
Image Type: ${imageType === 'hero' ? 'Hero image (abstract, atmospheric, represents overall theme)' : 'Inline image (specific, literal, action-oriented)'}

Section Content:
"""
${sectionContent.substring(0, 1500)}
"""

Extract a concise visual description (15-25 words) that captures:
1. The main action, process, or concept being discussed
2. Key objects, people, or elements mentioned
3. The appropriate setting or environment
4. The emotional tone

Respond in this exact JSON format:
{
  "action": "the main visual action/concept in 15-25 words",
  "mood": "the emotional tone (e.g., professional, warm, dynamic)",
  "subjects": ["main subject 1", "main subject 2"],
  "setting": "the environment or context"
}`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const rawResponse = await callGPT(messages, apiKey, { temperature: 0.6, maxTokens: 300 });

    // Parse JSON from response
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback: use the raw response as action
      return {
        action: rawResponse.substring(0, 100),
        mood: 'professional',
        subjects: [],
        setting: ''
      };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Action extraction error:', error);
    // Return fallback
    return {
      action: `professional scene related to ${keyword || 'the topic'}`,
      mood: 'professional',
      subjects: [],
      setting: 'modern environment'
    };
  }
}

/**
 * GUIDED GPT MODE: Generate a complete image prompt with guardrails
 * Uses GPT-4o (smarter model) with user-provided guardrails/instructions
 *
 * @param {string} sectionContent - Text content of the section
 * @param {object} context - Additional context
 * @param {object} guardrails - User-defined guardrails and instructions
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<{prompt: string, action: string, mood: string}>}
 */
export async function generateGuidedPrompt(sectionContent, context = {}, guardrails = {}, apiKey, options = {}) {
  if (!sectionContent) {
    throw new Error('Section content is required');
  }

  const {
    articleTitle = '',
    keyword = '',
    imageType = 'inline',
    businessType = ''
  } = context;

  const {
    instructions = '',      // Main guardrails: "Always show professional cleaners in uniform..."
    uniformDescription = '', // "Blue polo shirt with company logo, khaki pants"
    stylePreferences = '',   // "Photorealistic, warm lighting, modern interiors"
    avoidList = '',         // "No cartoon style, no stock photo feel"
    defaultSubject = ''     // "Professional house cleaner in their 30s"
  } = guardrails;

  // Model selection - default to GPT-4o for best results
  const guidedModel = options.guidedModel || 'gpt-4o';

  // Build guardrails section
  let guardrailsSection = '';
  if (instructions) {
    guardrailsSection += `\n## CRITICAL INSTRUCTIONS (MUST FOLLOW):\n${instructions}\n`;
  }
  if (uniformDescription) {
    guardrailsSection += `\n## UNIFORM/APPEARANCE:\n${uniformDescription}\n`;
  }
  if (stylePreferences) {
    guardrailsSection += `\n## STYLE PREFERENCES:\n${stylePreferences}\n`;
  }
  if (avoidList) {
    guardrailsSection += `\n## AVOID:\n${avoidList}\n`;
  }
  if (defaultSubject) {
    guardrailsSection += `\n## DEFAULT SUBJECT:\n${defaultSubject}\n`;
  }

  const systemPrompt = `You are an expert image prompt engineer for AI image generation (FLUX, DALL-E, GPT Image).
Your task is to create detailed, photorealistic image prompts based on article content.

${guardrailsSection || 'No specific guardrails provided - use professional judgment.'}

IMPORTANT RULES:
1. ALWAYS follow the guardrails/instructions above
2. Create prompts that are LITERAL and SPECIFIC - describe exactly what should appear
3. Focus on ACTIONS being performed related to the text content
4. Include specific details about people, objects, settings, and lighting
5. Match the content's context - what task/service is being discussed?
6. Output ONLY the image prompt - no explanation or JSON`;

  const userPrompt = `Create a photorealistic image prompt for this section.

${articleTitle ? `Article: "${articleTitle}"` : ''}
${keyword ? `Topic: "${keyword}"` : ''}
${businessType ? `Business: "${businessType}"` : ''}
Image Type: ${imageType === 'hero' ? 'HERO IMAGE (capture the overall theme, professional and aspirational)' : 'INLINE IMAGE (specific task shown in the section)'}

SECTION CONTENT:
"""
${sectionContent.substring(0, 1200)}
"""

Generate a detailed image prompt (30-60 words) that:
1. Shows the specific task/action discussed in this section
2. Follows ALL guardrails provided
3. Is optimized for photorealistic AI image generation

Output the prompt only, nothing else:`;

  try {
    console.log(`[Guided GPT] Generating prompt for "${imageType}" with ${guidedModel}`);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // Use selected model (configurable)
    const rawResponse = await callGPT(messages, apiKey, {
      model: guidedModel,
      temperature: 0.6,
      maxTokens: 500
    });

    // Clean up the response - remove any quotes or prefixes
    let prompt = rawResponse.trim()
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/^(prompt:|image prompt:|here is.*?:)/i, '') // Remove prefixes
      .trim();

    console.log(`[Guided GPT] Generated: ${prompt.substring(0, 100)}...`);

    return {
      prompt,
      action: 'Guided GPT generated prompt',
      mood: 'professional',
      subjects: [],
      setting: keyword || businessType || 'professional setting'
    };
  } catch (error) {
    console.error('[Guided GPT] Error:', error);
    // Fallback to a simple prompt
    const fallback = defaultSubject
      ? `${defaultSubject} ${keyword ? `performing ${keyword} service` : 'at work'}, professional photography, natural lighting`
      : `Professional service provider ${keyword ? `performing ${keyword}` : 'at work'}, photorealistic, high quality`;

    return {
      prompt: fallback,
      action: 'Fallback prompt (Guided GPT failed)',
      mood: 'professional',
      subjects: [],
      setting: 'professional environment'
    };
  }
}

/**
 * Build a FLUX-optimized prompt from Style DNA and action
 *
 * @param {object} styleDNA - Style DNA object with styleTemplate
 * @param {object} action - Extracted action object
 * @param {string} imageType - 'hero' or 'inline'
 * @returns {string} Complete FLUX prompt
 */
export function buildFluxPrompt(styleDNA, action, imageType = 'inline') {
  let prompt = '';

  if (styleDNA && styleDNA.styleTemplate) {
    // Use the style template with action inserted
    prompt = styleDNA.styleTemplate.replace('{ACTION}', action.action);

    // Add mood if not already present
    if (action.mood && !prompt.toLowerCase().includes(action.mood.toLowerCase())) {
      prompt += `, ${action.mood} atmosphere`;
    }
  } else {
    // Fallback: build prompt without style template
    prompt = buildFallbackPrompt(action, imageType);
  }

  // Add quality enhancers
  const qualityEnhancers = 'high quality, detailed, professional';
  if (!prompt.toLowerCase().includes('high quality')) {
    prompt += `, ${qualityEnhancers}`;
  }

  return prompt;
}

/**
 * Build a fallback prompt when no Style DNA is available
 */
function buildFallbackPrompt(action, imageType) {
  const base = action.action;
  const mood = action.mood || 'professional';
  const setting = action.setting || 'modern environment';

  if (imageType === 'hero') {
    return `Atmospheric, abstract visualization of ${base}, ${mood} mood, ${setting}, cinematic lighting, depth of field, high quality`;
  } else {
    return `Professional photograph of ${base}, ${mood} atmosphere, ${setting}, natural lighting, sharp focus, high quality`;
  }
}

/**
 * Generate prompts for all sections of an article
 *
 * @param {object} chunks - Chunked article content
 * @param {object} styleDNA - Style DNA template
 * @param {object} context - Article context (title, keyword)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<object>} Chunks with imagePrompt added
 */
export async function generatePromptsForArticle(chunks, styleDNA, context, apiKey) {
  const { keyword = '', title = '', maxImages = 4 } = context;

  // Track which chunks get images
  let imageCount = 0;

  // Process intro for hero image
  if (chunks.intro && chunks.intro.content && imageCount < maxImages) {
    try {
      const action = await extractAction(chunks.intro.content, {
        articleTitle: title,
        keyword,
        imageType: 'hero'
      }, apiKey);

      chunks.intro.imagePrompt = buildFluxPrompt(styleDNA, action, 'hero');
      chunks.intro.extractedAction = action;
      imageCount++;
    } catch (error) {
      console.error('Failed to generate hero prompt:', error);
    }
  }

  // Process body chunks for inline images
  for (let i = 0; i < chunks.chunks.length && imageCount < maxImages; i++) {
    const chunk = chunks.chunks[i];

    // Skip very short chunks
    if (chunk.wordCount < 50) continue;

    // Only add image to every other eligible chunk (creates variety)
    // Unless we're running low on image slots
    const remainingSlots = maxImages - imageCount;
    const remainingChunks = chunks.chunks.length - i;
    const shouldAddImage = remainingSlots >= remainingChunks || i % 2 === 0;

    if (shouldAddImage) {
      try {
        const action = await extractAction(chunk.content, {
          articleTitle: title,
          keyword,
          imageType: 'inline'
        }, apiKey);

        chunk.imagePrompt = buildFluxPrompt(styleDNA, action, 'inline');
        chunk.extractedAction = action;
        chunk.imageSide = imageCount % 2 === 0 ? 'left' : 'right';
        imageCount++;
      } catch (error) {
        console.error(`Failed to generate prompt for chunk ${i}:`, error);
      }
    }
  }

  return chunks;
}

/**
 * Analyze a single image and describe its style
 * Useful for building Style DNA from individual images
 *
 * @param {string} imageUrl - URL of the image
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<object>} Style analysis
 */
export async function analyzeImageStyle(imageUrl, apiKey) {
  const messages = [
    {
      role: 'system',
      content: 'You are an expert at analyzing image styles for reproduction in AI image generation.'
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Analyze this image and describe its visual style for FLUX image generation.

Provide details on:
1. Color palette and tones
2. Lighting style
3. Composition
4. Artistic style (photorealistic, illustration, etc.)
5. Mood and atmosphere
6. Key visual elements

Respond in JSON format:
{
  "colorPalette": "description of colors",
  "lighting": "lighting description",
  "composition": "composition description",
  "style": "artistic style",
  "mood": "mood/atmosphere",
  "elements": ["element1", "element2"],
  "promptFragment": "a phrase that could replicate this style"
}`
        },
        {
          type: 'image_url',
          image_url: {
            url: imageUrl,
            detail: 'low'
          }
        }
      ]
    }
  ];

  const response = await callGPT(messages, apiKey, { temperature: 0.5 });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Fall through to return raw
  }

  return { raw: response };
}

// Available GPT models for guided mode
export const GUIDED_GPT_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o (Smartest, Recommended)', description: 'Best at following complex instructions' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast)', description: 'Faster and cheaper, good for simple guardrails' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Very capable, good balance of speed and quality' }
];

export default {
  extractStyleDNA,
  generateGuidedPrompt,
  GUIDED_GPT_MODELS,
  extractAction,
  buildFluxPrompt,
  generatePromptsForArticle,
  analyzeImageStyle
};
