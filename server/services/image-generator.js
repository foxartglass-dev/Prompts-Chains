/**
 * Image Generator Service
 * Interfaces with Replicate API to generate images using FLUX 1.1 Pro
 */

const FLUX_MODEL = "black-forest-labs/flux-1.1-pro";

const DEFAULT_OPTIONS = {
  width: 1024,
  height: 768,
  num_outputs: 1,
  output_format: "webp",
  output_quality: 80,
  aspect_ratio: "4:3",
  safety_tolerance: 2,
  prompt_upsampling: true
};

/**
 * Generate a single image using FLUX 1.1 Pro via Replicate
 * @param {string} prompt - FLUX-optimized prompt string
 * @param {object} options - Generation options
 * @param {string} apiToken - Replicate API token
 * @returns {Promise<{url: string, width: number, height: number, prompt: string}>}
 */
export async function generateImage(prompt, options = {}, apiToken) {
  if (!apiToken) {
    throw new Error('Replicate API token is required');
  }

  if (!prompt) {
    throw new Error('Prompt is required');
  }

  const input = {
    prompt,
    ...DEFAULT_OPTIONS,
    ...options
  };

  // Remove any undefined values
  Object.keys(input).forEach(key => {
    if (input[key] === undefined) delete input[key];
  });

  try {
    // Create prediction
    const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait' // Wait for result instead of polling
      },
      body: JSON.stringify({
        model: FLUX_MODEL,
        input
      })
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(error.detail || `Replicate API error: ${createResponse.status}`);
    }

    let prediction = await createResponse.json();

    // If not completed, poll for result
    if (prediction.status !== 'succeeded') {
      prediction = await pollForCompletion(prediction.id, apiToken);
    }

    if (prediction.status === 'failed') {
      throw new Error(prediction.error || 'Image generation failed');
    }

    const imageUrl = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;

    return {
      url: imageUrl,
      width: input.width,
      height: input.height,
      prompt,
      replicateId: prediction.id
    };
  } catch (error) {
    console.error('FLUX generation error:', error);
    throw error;
  }
}

/**
 * Poll Replicate API for prediction completion
 */
async function pollForCompletion(predictionId, apiToken, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to check prediction status: ${response.status}`);
    }

    const prediction = await response.json();

    if (prediction.status === 'succeeded' || prediction.status === 'failed') {
      return prediction;
    }
  }

  throw new Error('Image generation timed out');
}

/**
 * Generate multiple images in parallel
 * @param {string[]} prompts - Array of prompt strings
 * @param {object} options - Generation options (applied to all)
 * @param {string} apiToken - Replicate API token
 * @param {function} onProgress - Progress callback (index, total, result)
 * @returns {Promise<Array>} Array of image results
 */
export async function generateBatchImages(prompts, options = {}, apiToken, onProgress = null) {
  if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
    throw new Error('Prompts array is required');
  }

  const results = [];
  const concurrent = options.concurrent || 2; // Limit concurrent requests

  // Process in batches to avoid rate limiting
  for (let i = 0; i < prompts.length; i += concurrent) {
    const batch = prompts.slice(i, i + concurrent);
    const batchPromises = batch.map((prompt, batchIndex) =>
      generateImage(prompt, options, apiToken)
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
 * @param {object[]} chunks - Chunked content with prompts
 * @param {object} options - Generation options
 * @param {string} apiToken - Replicate API token
 * @returns {Promise<object[]>} Chunks with imageData filled
 */
export async function generateArticleImages(chunks, options = {}, apiToken) {
  const {
    heroImage = true,
    maxImages = 4,
    onProgress = null
  } = options;

  // Collect prompts from chunks that need images
  const imageSlots = [];

  // Hero image from intro (if present)
  if (heroImage && chunks.intro) {
    imageSlots.push({
      type: 'hero',
      chunkIndex: -1, // -1 indicates intro
      prompt: chunks.intro.imagePrompt || null
    });
  }

  // Inline images from body chunks
  for (let i = 0; i < chunks.chunks.length && imageSlots.length < maxImages; i++) {
    if (chunks.chunks[i].imagePrompt) {
      imageSlots.push({
        type: 'inline',
        chunkIndex: i,
        prompt: chunks.chunks[i].imagePrompt,
        side: chunks.chunks[i].imageSide || (imageSlots.length % 2 === 0 ? 'left' : 'right')
      });
    }
  }

  // Generate images for all slots
  const prompts = imageSlots.map(slot => slot.prompt).filter(Boolean);

  if (prompts.length === 0) {
    console.log('No image prompts provided, skipping generation');
    return chunks;
  }

  const generatedImages = await generateBatchImages(prompts, options, apiToken, onProgress);

  // Map generated images back to chunks
  let imageIndex = 0;
  for (const slot of imageSlots) {
    if (!slot.prompt) continue;

    const image = generatedImages[imageIndex];
    imageIndex++;

    if (image.error) {
      console.error(`Image generation failed for ${slot.type}:`, image.error);
      continue;
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
  }

  return chunks;
}

/**
 * Estimate cost for image generation
 * @param {number} imageCount - Number of images to generate
 * @returns {{perImage: number, total: number, currency: string}}
 */
export function estimateCost(imageCount) {
  const perImage = 0.04; // FLUX 1.1 Pro cost
  return {
    perImage,
    total: perImage * imageCount,
    currency: 'USD'
  };
}

export default {
  generateImage,
  generateBatchImages,
  generateArticleImages,
  estimateCost
};
