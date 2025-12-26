/**
 * Image Generator Service
 * Supports both OpenAI gpt-image-1.5 and Flux 1.1 Pro via Replicate
 */

import OpenAI from 'openai';
import Replicate from 'replicate';

// Default model - Flux is default since gpt-image-1.5 requires org verification
const DEFAULT_MODEL = 'flux-1.1-pro';

// Default options
const DEFAULT_OPTIONS = {
  model: DEFAULT_MODEL,
  quality: 'low',  // low for websites (cheapest), medium, or high for print
  size: '1024x1024',
};

/**
 * Generate a single image using OpenAI gpt-image-1.5
 */
async function generateWithOpenAI(prompt, options, apiKey) {
  const openai = new OpenAI({ apiKey });

  const {
    quality = 'low',
    size = '1024x1024'
  } = options;

  // Determine size from width/height if provided
  let finalSize = size;
  if (options.width && options.height) {
    if (options.width > options.height) {
      finalSize = '1536x1024'; // Landscape
    } else if (options.height > options.width) {
      finalSize = '1024x1536'; // Portrait
    } else {
      finalSize = '1024x1024'; // Square
    }
  }

  console.log(`[Image Generator] OpenAI gpt-image-1.5, quality: ${quality}, size: ${finalSize}`);

  const response = await openai.images.generate({
    model: 'gpt-image-1.5',
    prompt: prompt,
    n: 1,
    size: finalSize,
    quality: quality
  });

  const imageUrl = response.data[0].url;
  const revisedPrompt = response.data[0].revised_prompt;
  const [w, h] = finalSize.split('x').map(Number);

  return {
    url: imageUrl,
    width: w,
    height: h,
    prompt: prompt,
    revisedPrompt: revisedPrompt,
    model: 'gpt-image-1.5'
  };
}

/**
 * Generate a single image using Flux 1.1 Pro via Replicate
 * Cost: ~$0.04 per image
 */
async function generateWithFlux(prompt, options, apiKey) {
  const replicate = new Replicate({ auth: apiKey });

  const {
    size = '1024x1024',
    output_quality = 80  // 0-100 compression quality for webp
  } = options;

  // Determine aspect ratio from size or width/height
  let aspectRatio = '1:1';
  if (options.width && options.height) {
    if (options.width > options.height) {
      aspectRatio = '16:9';
    } else if (options.height > options.width) {
      aspectRatio = '9:16';
    }
  } else if (size === '1536x1024') {
    aspectRatio = '16:9';
  } else if (size === '1024x1536') {
    aspectRatio = '9:16';
  }

  console.log(`[Image Generator] Flux 1.1 Pro, aspect: ${aspectRatio}, quality: ${output_quality}`);

  const output = await replicate.run(
    "black-forest-labs/flux-1.1-pro",
    {
      input: {
        prompt: prompt,
        aspect_ratio: aspectRatio,
        output_format: "webp",
        output_quality: output_quality,
        safety_tolerance: 2,
        prompt_upsampling: true  // Enhances prompts for better results
      }
    }
  );

  // Flux returns a URL directly
  const imageUrl = output;

  // Parse dimensions from aspect ratio
  let w = 1024, h = 1024;
  if (aspectRatio === '16:9') {
    w = 1344; h = 768;
  } else if (aspectRatio === '9:16') {
    w = 768; h = 1344;
  }

  return {
    url: imageUrl,
    width: w,
    height: h,
    prompt: prompt,
    model: 'flux-1.1-pro'
  };
}

/**
 * Generate a single image using the specified model
 * @param {string} prompt - Image prompt
 * @param {object} options - Generation options (model, quality, size)
 * @param {string} apiKey - API key (OpenAI or Replicate depending on model)
 * @returns {Promise<{url: string, width: number, height: number, prompt: string}>}
 */
export async function generateImage(prompt, options = {}, apiKey) {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!prompt) {
    throw new Error('Prompt is required');
  }

  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const model = mergedOptions.model || DEFAULT_MODEL;

  try {
    if (model === 'gpt-image-1.5') {
      return await generateWithOpenAI(prompt, mergedOptions, apiKey);
    } else {
      // Default to Flux for any other model value
      return await generateWithFlux(prompt, mergedOptions, apiKey);
    }
  } catch (error) {
    console.error(`[Image Generator] Error with ${model}:`, error.message);
    throw error;
  }
}

/**
 * Generate multiple images in parallel (with concurrency limit)
 * @param {string[]} prompts - Array of prompt strings
 * @param {object} options - Generation options (applied to all)
 * @param {string} apiKey - API key
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
 * @param {string} apiKey - API key
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

  console.log(`[Image Generator] Generating ${prompts.length} images with ${model}`);

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
 * Estimate cost for image generation
 *
 * OpenAI gpt-image-1.5 pricing (Dec 2025):
 * - Low quality: ~$0.011 per 1024x1024
 * - Medium quality: ~$0.042 per 1024x1024
 * - High quality: ~$0.167 per 1024x1024
 *
 * Flux 1.1 Pro pricing:
 * - ~$0.04 per image (all sizes)
 *
 * @param {number} imageCount - Number of images to generate
 * @param {string} quality - 'low', 'medium', or 'high'
 * @param {string} model - 'gpt-image-1.5' or 'flux-1.1-pro'
 * @returns {{perImage: number, total: number, currency: string}}
 */
export function estimateCost(imageCount, quality = 'low', model = DEFAULT_MODEL) {
  let perImage;

  if (model === 'gpt-image-1.5') {
    const pricing = {
      low: 0.011,
      medium: 0.042,
      high: 0.167
    };
    perImage = pricing[quality] || pricing.low;
  } else {
    // Flux 1.1 Pro - flat rate
    perImage = 0.04;
  }

  return {
    perImage,
    total: perImage * imageCount,
    currency: 'USD',
    quality,
    model
  };
}

export default {
  generateImage,
  generateBatchImages,
  generateArticleImages,
  estimateCost
};
