/**
 * Image Prompt Generator Service
 * Uses GPT-4o-mini to analyze content and generate FLUX-optimized prompts
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

/**
 * Call OpenAI GPT-4o-mini API
 */
async function callGPT(messages, apiKey, options = {}) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
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

  // Build vision content with images
  const imageContent = referenceImages.map(img => ({
    type: 'image_url',
    image_url: {
      url: img.url,
      detail: 'low' // Use low detail to reduce tokens
    }
  }));

  const systemPrompt = `You are an expert at analyzing visual styles and creating image generation prompts.
Your task is to analyze reference images and extract a reusable "Style DNA" template for FLUX 1.1 Pro.`;

  const userPrompt = `Analyze these ${referenceImages.length} reference images and extract a reusable style template.

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

export default {
  extractStyleDNA,
  extractAction,
  buildFluxPrompt,
  generatePromptsForArticle,
  analyzeImageStyle
};
