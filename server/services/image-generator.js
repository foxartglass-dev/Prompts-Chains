/**
 * Image Generator Service
 * Uses OpenAI gpt-image-1.5 for all image generation
 * Migrated from Replicate/FLUX to OpenAI for consistency
 */

import OpenAI from 'openai';

// Default model - gpt-image-1.5 is the latest (Dec 2025)
const DEFAULT_MODEL = 'gpt-image-1.5';

// Default options for gpt-image-1.5
const DEFAULT_OPTIONS = {
  model: DEFAULT_MODEL,
  quality: 'low',  // low for websites (cheapest), medium, or high for print
  size: '1024x1024',  // gpt-image supports: 1024x1024, 1536x1024, 1024x1536
};

/**
 * Generate a single image using OpenAI gpt-image-1.5
 * @param {string} prompt - Image prompt
 * @param {object} options - Generation options (quality, size, model)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<{url: string, width: number, height: number, prompt: string}>}
 */
export async function generateImage(prompt, options = {}, apiKey) {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  if (!prompt) {
    throw new Error('Prompt is required');
  }

  const openai = new OpenAI({ apiKey });

  // Merge options with defaults
  const {
    model = DEFAULT_MODEL,
    quality = 'low',
    size = '1024x1024',
    width,
    height
  } = { ...DEFAULT_OPTIONS, ...options };

  // Determine size from width/height if provided (for backwards compatibility)
  let finalSize = size;
  if (width && height) {
    if (width > height) {
      finalSize = '1536x1024'; // Landscape
    } else if (height > width) {
      finalSize = '1024x1536'; // Portrait
    } else {
      finalSize = '1024x1024'; // Square
    }
  }

  try {
    console.log(`[Image Generator] Generating with ${model}, quality: ${quality}, size: ${finalSize}`);

    const response = await openai.images.generate({
      model: model,
      prompt: prompt,
      n: 1,
      size: finalSize,
      quality: quality
    });

    const imageUrl = response.data[0].url;
    const revisedPrompt = response.data[0].revised_prompt;

    // Parse dimensions from size
    const [w, h] = finalSize.split('x').map(Number);

    console.log(`[Image Generator] Success - URL received`);

    return {
      url: imageUrl,
      width: w,
      height: h,
      prompt: prompt,
      revisedPrompt: revisedPrompt,
      model: model
    };
  } catch (error) {
    console.error(`[Image Generator] Error with ${model}:`, error.message);
    throw error;
  }
}

/**
 * Generate multiple images in parallel (with concurrency limit)
 * @param {string[]} prompts - Array of prompt strings
 * @param {object} options - Generation options (applied to all)
 * @param {string} apiKey - OpenAI API key
 * @param {function} onProgress - Progress callback (index, total, result)
 * @returns {Promise<Array>} Array of image results
 */
export async function generateBatchImages(prompts, options = {}, apiKey, onProgress = null) {
  if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
    throw new Error('Prompts array is required');
  }

  const results = [];
  const concurrent = options.concurrent || 2; // Limit concurrent requests for rate limiting

  // Process in batches
  for (let i = 0; i < prompts.length; i += concurrent) {
    const batch = prompts.slice(i, i + concurrent);
    const batchPromises = batch.map((prompt, batchIndex) =>
      generateImage(prompt, options, apiKey)
        .then(result => {
          if (onProgress) {
            onProgress(i + batchIndex, prompts.length, result);
          }
          return result;
        })
        .catch(error => ({
          error: error.message,
          prompt,
          index: i + batchIndex
        }))
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Generate images for article chunks
 * @param {object} chunks - Chunked content with prompts
 * @param {object} options - Generation options
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<object>} Chunks with imageData filled
 */
export async function generateArticleImages(chunks, options = {}, apiKey) {
  const {
    heroImage = true,
    maxImages = 4,
    onProgress = null,
    model = DEFAULT_MODEL,
    quality = 'low'
  } = options;

  // Collect prompts from chunks that need images
  const imageSlots = [];

  // Hero image from intro (if present) - use portrait for hero
  if (heroImage && chunks.intro) {
    imageSlots.push({
      type: 'hero',
      chunkIndex: -1, // -1 indicates intro
      prompt: chunks.intro.imagePrompt || null,
      size: '1024x1536' // Portrait for hero
    });
  }

  // Inline images from body chunks
  for (let i = 0; i < chunks.chunks.length && imageSlots.length < maxImages; i++) {
    if (chunks.chunks[i].imagePrompt) {
      imageSlots.push({
        type: 'inline',
        chunkIndex: i,
        prompt: chunks.chunks[i].imagePrompt,
        side: chunks.chunks[i].imageSide || (imageSlots.length % 2 === 0 ? 'left' : 'right'),
        size: '1024x1024' // Square for inline
      });
    }
  }

  // Generate images for all slots
  const prompts = imageSlots.filter(slot => slot.prompt).map(slot => slot.prompt);

  if (prompts.length === 0) {
    console.log('[Image Generator] No image prompts provided, skipping generation');
    return chunks;
  }

  console.log(`[Image Generator] Generating ${prompts.length} images for article`);

  // Generate each image with its specific size
  let imageIndex = 0;
  for (const slot of imageSlots) {
    if (!slot.prompt) continue;

    try {
      const image = await generateImage(slot.prompt, {
        model,
        quality,
        size: slot.size
      }, apiKey);

      if (onProgress) {
        onProgress(imageIndex, imageSlots.length, image);
      }

      if (slot.chunkIndex === -1) {
        // Hero image goes in intro
        chunks.intro.imageData = {
          url: image.url,
          width: image.width,
          height: image.height,
          alt: 'Hero image',
          type: 'hero'
        };
      } else {
        // Inline image goes in chunk
        chunks.chunks[slot.chunkIndex].imageData = {
          url: image.url,
          width: image.width,
          height: image.height,
          alt: chunks.chunks[slot.chunkIndex].heading || '',
          type: 'inline',
          side: slot.side
        };
      }
    } catch (error) {
      console.error(`[Image Generator] Failed for ${slot.type}:`, error.message);
    }

    imageIndex++;
  }

  return chunks;
}

/**
 * Estimate cost for image generation using gpt-image-1.5
 * Pricing (Dec 2025):
 * - Low quality: ~$0.011 per 1024x1024
 * - Medium quality: ~$0.042 per 1024x1024
 * - High quality: ~$0.167 per 1024x1024
 *
 * @param {number} imageCount - Number of images to generate
 * @param {string} quality - 'low', 'medium', or 'high'
 * @returns {{perImage: number, total: number, currency: string}}
 */
export function estimateCost(imageCount, quality = 'low') {
  const pricing = {
    low: 0.011,
    medium: 0.042,
    high: 0.167
  };

  const perImage = pricing[quality] || pricing.low;

  return {
    perImage,
    total: perImage * imageCount,
    currency: 'USD',
    quality
  };
}

export default {
  generateImage,
  generateBatchImages,
  generateArticleImages,
  estimateCost
};
