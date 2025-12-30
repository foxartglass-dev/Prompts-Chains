/**
 * Image Generator Service
 * Supports OpenAI gpt-image-1.5 and multiple Replicate models:
 * - Flux 1.1 Pro (~$0.04/image) - Fast, good prompt adherence
 * - Seedream 4 (~$0.03/image) - Best value, 4K support
 * - Ideogram v3 Turbo (~$0.04/image) - Great realism, text rendering
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

  // gpt-image-1.5 doesn't support response_format - it always returns base64
  const response = await openai.images.generate({
    model: 'gpt-image-1.5',
    prompt: prompt,
    n: 1,
    size: finalSize,
    quality: quality
  });

  // gpt-image-1.5 returns base64 data, convert to data URL
  let imageUrl;
  const revisedPrompt = response.data[0].revised_prompt;

  if (response.data[0].b64_json) {
    imageUrl = `data:image/png;base64,${response.data[0].b64_json}`;
    console.log('[Image Generator] Got base64 image, converted to data URL');
  } else if (response.data[0].url) {
    imageUrl = response.data[0].url;
  }

  if (!imageUrl) {
    console.error('[Image Generator] No image data in response:', JSON.stringify(response.data[0]).substring(0, 200));
    throw new Error('OpenAI returned no image data');
  }
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
    quality = 'medium'  // low, medium, high - maps to output_quality
  } = options;

  // Map quality levels to Flux output_quality (0-100 WebP compression)
  const qualityMap = {
    low: 60,     // Smaller files, good for web
    medium: 80,  // Balanced (default)
    high: 100    // Max quality, larger files
  };
  const output_quality = qualityMap[quality] || 80;

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
        output_format: "png",
        output_quality: output_quality,
        safety_tolerance: 2,
        prompt_upsampling: true  // Enhances prompts for better results
      }
    }
  );

  // Flux returns a FileOutput object with url() method or ReadableStream
  console.log(`[Image Generator] Flux raw output type:`, typeof output);

  // Handle different output formats from Replicate
  let imageUrl;
  if (typeof output === 'string') {
    imageUrl = output;
  } else if (output && typeof output.url === 'function') {
    // FileOutput object - call url() to get the URL
    imageUrl = await output.url();
  } else if (output && typeof output.url === 'string') {
    imageUrl = output.url;
  } else if (Array.isArray(output) && output.length > 0) {
    // Could be array of FileOutput objects
    const first = output[0];
    if (typeof first === 'string') {
      imageUrl = first;
    } else if (first && typeof first.url === 'function') {
      imageUrl = await first.url();
    } else if (first && first.url) {
      imageUrl = first.url;
    }
  }

  if (!imageUrl) {
    console.error('[Image Generator] Could not extract URL from Flux output:', output);
    throw new Error('Could not extract URL from Flux output');
  }

  // Handle URL object (has href property) vs string
  if (typeof imageUrl === 'object' && imageUrl.href) {
    imageUrl = imageUrl.href;
  }

  console.log(`[Image Generator] Flux image URL:`, imageUrl);

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
 * Generate a single image using Seedream 4 via Replicate
 * Cost: ~$0.03 per image (cheapest option)
 */
async function generateWithSeedream(prompt, options, apiKey) {
  const replicate = new Replicate({ auth: apiKey });

  const { size = '1024x1024' } = options;

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

  console.log(`[Image Generator] Seedream 4, aspect: ${aspectRatio}`);

  const output = await replicate.run(
    "bytedance/seedream-4",
    {
      input: {
        prompt: prompt,
        aspect_ratio: aspectRatio,
        output_format: "png"
      }
    }
  );

  // Handle FileOutput object
  let imageUrl;
  if (typeof output === 'string') {
    imageUrl = output;
  } else if (output && typeof output.url === 'function') {
    imageUrl = await output.url();
  } else if (output && typeof output.url === 'string') {
    imageUrl = output.url;
  } else if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === 'string') {
      imageUrl = first;
    } else if (first && typeof first.url === 'function') {
      imageUrl = await first.url();
    } else if (first && first.url) {
      imageUrl = first.url;
    }
  }

  if (!imageUrl) {
    console.error('[Image Generator] Could not extract URL from Seedream output:', output);
    throw new Error('Could not extract URL from Seedream output');
  }

  // Handle URL object (has href property) vs string
  if (typeof imageUrl === 'object' && imageUrl.href) {
    imageUrl = imageUrl.href;
  }

  console.log(`[Image Generator] Seedream image URL:`, imageUrl);

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
    model: 'seedream-4'
  };
}

/**
 * Generate a single image using Ideogram v3 Turbo via Replicate
 * Cost: ~$0.04 per image
 */
async function generateWithIdeogram(prompt, options, apiKey) {
  const replicate = new Replicate({ auth: apiKey });

  const { size = '1024x1024' } = options;

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

  console.log(`[Image Generator] Ideogram v3 Turbo, aspect: ${aspectRatio}`);

  const output = await replicate.run(
    "ideogram-ai/ideogram-v3-turbo",
    {
      input: {
        prompt: prompt,
        aspect_ratio: aspectRatio,
        style_type: "Realistic"  // Options: Auto, General, Realistic, Design
      }
    }
  );

  // Handle FileOutput object
  let imageUrl;
  if (typeof output === 'string') {
    imageUrl = output;
  } else if (output && typeof output.url === 'function') {
    imageUrl = await output.url();
  } else if (output && typeof output.url === 'string') {
    imageUrl = output.url;
  } else if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === 'string') {
      imageUrl = first;
    } else if (first && typeof first.url === 'function') {
      imageUrl = await first.url();
    } else if (first && first.url) {
      imageUrl = first.url;
    }
  }

  if (!imageUrl) {
    console.error('[Image Generator] Could not extract URL from Ideogram output:', output);
    throw new Error('Could not extract URL from Ideogram output');
  }

  // Handle URL object (has href property) vs string
  if (typeof imageUrl === 'object' && imageUrl.href) {
    imageUrl = imageUrl.href;
  }

  console.log(`[Image Generator] Ideogram image URL:`, imageUrl);

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
    model: 'ideogram-v3-turbo'
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
    } else if (model === 'seedream-4') {
      return await generateWithSeedream(prompt, mergedOptions, apiKey);
    } else if (model === 'ideogram-v3-turbo') {
      return await generateWithIdeogram(prompt, mergedOptions, apiKey);
    } else {
      // Default to Flux for any other model value (including 'flux-1.1-pro')
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
 * Calculate optimal hero image size based on estimated line count
 * Uses line estimation for more accurate sizing than raw word count
 *
 * Line Estimation:
 * - Hero text is typically 50% of container width
 * - Average reading line: ~55-65 characters
 * - Average word: ~5 chars + 1 space = 6 characters
 * - Words per line ≈ 10
 *
 * @param {number} wordCount - Number of words in the intro
 * @returns {{size: string, lines: number, ratio: string}} Size info
 */
function calculateHeroSize(wordCount) {
  // Estimate line count: ~10 words per line in typical hero layout
  const WORDS_PER_LINE = 10;
  const estimatedLines = Math.ceil(wordCount / WORDS_PER_LINE);

  // 6-tier system for more precise matching
  // Aspect ratios available: 16:9, 3:2, 4:3, 1:1, 3:4, 2:3
  let size, ratio, label;

  if (estimatedLines <= 4) {
    // Very short - ultra wide
    size = '1536x1024';  // 3:2 landscape
    ratio = '3:2';
    label = 'WIDE LANDSCAPE';
  } else if (estimatedLines <= 6) {
    // Short - standard landscape
    size = '1536x1024';  // 3:2 landscape
    ratio = '3:2';
    label = 'LANDSCAPE';
  } else if (estimatedLines <= 8) {
    // Medium-short - slight landscape
    size = '1024x1024';  // Using square, CSS will handle
    ratio = '4:3';
    label = 'SLIGHT LANDSCAPE';
  } else if (estimatedLines <= 11) {
    // Medium - square
    size = '1024x1024';  // 1:1 square
    ratio = '1:1';
    label = 'SQUARE';
  } else if (estimatedLines <= 14) {
    // Medium-long - slight portrait
    size = '1024x1536';  // 2:3 portrait
    ratio = '3:4';
    label = 'SLIGHT PORTRAIT';
  } else {
    // Long - full portrait
    size = '1024x1536';  // 2:3 portrait
    ratio = '2:3';
    label = 'PORTRAIT';
  }

  console.log(`[Hero Auto-Size] ${wordCount} words ≈ ${estimatedLines} lines → ${label} (${size}, ${ratio})`);

  return size;
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
    quality = 'low',
    heroAutoSize = true  // NEW: Auto-size hero based on intro length
  } = options;

  // Collect prompts from chunks that need images
  const imageSlots = [];

  // Hero image from intro (if present)
  if (heroImage && chunks.intro) {
    // Calculate optimal hero size based on intro word count
    const introWordCount = chunks.intro.wordCount || 100; // Default to 100 if not set
    const heroSize = heroAutoSize ? calculateHeroSize(introWordCount) : '1024x1536';

    imageSlots.push({
      type: 'hero',
      chunkIndex: -1, // -1 indicates intro
      prompt: chunks.intro.imagePrompt || null,
      size: heroSize
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
          type: 'hero',
          requestedSize: slot.size, // Track auto-sized dimensions
          autoSized: true
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
 * Replicate model pricing:
 * - Flux 1.1 Pro: ~$0.04 per image
 * - Seedream 4: ~$0.03 per image (cheapest)
 * - Ideogram v3 Turbo: ~$0.04 per image
 *
 * @param {number} imageCount - Number of images to generate
 * @param {string} quality - 'low', 'medium', or 'high'
 * @param {string} model - model name
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
  } else if (model === 'seedream-4') {
    perImage = 0.03;  // Cheapest option
  } else if (model === 'ideogram-v3-turbo') {
    perImage = 0.04;
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

// Export calculateHeroSize (not exported inline like the others)
export { calculateHeroSize };

// Default export for convenience
export default {
  generateImage,
  generateBatchImages,
  generateArticleImages,
  estimateCost,
  calculateHeroSize
};
