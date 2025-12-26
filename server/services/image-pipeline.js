/**
 * Image Pipeline Service
 * Orchestrates the full image generation flow:
 * Article Content → Chunks → Actions → Prompts → Images → WordPress
 *
 * Supports both OpenAI gpt-image-1.5 and Flux 1.1 Pro via Replicate
 */

import chunkContent, { extractTitle, countWords } from './content-chunker.js';
import { generatePromptsForArticle, extractStyleDNA, buildFluxPrompt } from './image-prompt-generator.js';
import { generateArticleImages, generateImage, estimateCost } from './image-generator.js';
import { uploadMedia } from './wordpress-publisher.js';

/**
 * Full pipeline: process article content and generate images
 *
 * @param {string} content - Raw article content
 * @param {object} options - Pipeline options
 * @returns {Promise<object>} Processed chunks with images
 */
export async function processArticleWithImages(content, options = {}) {
  const {
    // Article metadata
    title = null,
    keyword = '',

    // API keys
    openaiApiKey,
    replicateApiKey,  // Used for Flux 1.1 Pro

    // Style DNA
    styleDNA = null,
    referenceImages = null,

    // WordPress (optional, for uploading)
    wpCredentials = null,

    // Image options
    maxImages = 4,
    heroImage = true,
    maxWords = 300,

    // Model options
    model = 'flux-1.1-pro',  // Default to Flux since gpt-image-1.5 requires org verification
    quality = 'low', // low for websites, medium, high for print

    // Callbacks
    onProgress = null
  } = options;

  const progress = (step, data = {}) => {
    if (onProgress) onProgress({ step, ...data });
  };

  try {
    // Step 1: Chunk the content
    progress('chunking', { message: 'Splitting content into sections...' });
    const chunks = chunkContent(content, { maxWords });
    const pageTitle = title || extractTitle(content) || 'Untitled Page';

    progress('chunked', {
      message: `Content split into ${chunks.chunkCount} sections`,
      chunks: chunks.chunkCount,
      words: chunks.totalWords
    });

    // Step 2: Get or create Style DNA
    let activeStyleDNA = styleDNA;

    if (!activeStyleDNA && referenceImages && referenceImages.length > 0 && openaiApiKey) {
      progress('extracting_style', { message: 'Analyzing reference images...' });

      activeStyleDNA = await extractStyleDNA(referenceImages, openaiApiKey);

      progress('style_extracted', {
        message: 'Style DNA extracted',
        template: activeStyleDNA.styleTemplate
      });
    }

    if (!activeStyleDNA) {
      progress('no_style', { message: 'No Style DNA configured, using defaults' });
      activeStyleDNA = {
        styleTemplate: 'Professional photograph of {ACTION}, natural lighting, clean composition, high quality, detailed',
        attributes: { style: 'professional photography', mood: 'modern' }
      };
    }

    // Step 3: Generate prompts for each section
    if (!openaiApiKey) {
      progress('skipping_prompts', { message: 'No OpenAI key, using basic prompts' });
      // Add basic prompts without GPT analysis
      addBasicPrompts(chunks, activeStyleDNA, keyword, maxImages);
    } else {
      progress('generating_prompts', { message: 'Analyzing content for image prompts...' });

      await generatePromptsForArticle(chunks, activeStyleDNA, {
        title: pageTitle,
        keyword,
        maxImages
      }, openaiApiKey);

      const promptCount = countPromptsInChunks(chunks);
      progress('prompts_generated', {
        message: `Generated ${promptCount} image prompts`,
        count: promptCount
      });
    }

    // Step 4: Generate images using selected model
    // Select correct API key based on model
    const imageApiKey = model === 'gpt-image-1.5' ? openaiApiKey : replicateApiKey;

    if (!imageApiKey) {
      const keyType = model === 'gpt-image-1.5' ? 'OpenAI' : 'Replicate';
      progress('skipping_images', { message: `No ${keyType} key, skipping image generation` });
      return {
        chunks,
        title: pageTitle,
        styleDNA: activeStyleDNA,
        imagesGenerated: 0
      };
    }

    progress('generating_images', { message: `Generating images with ${model}...` });

    const chunksWithImages = await generateArticleImages(
      chunks,
      { maxImages, heroImage, model, quality },
      imageApiKey,  // Use appropriate API key for the model
      (index, total, result) => {
        progress('image_progress', {
          message: `Generated image ${index + 1} of ${total}`,
          current: index + 1,
          total,
          url: result.url
        });
      }
    );

    const imageCount = countImagesInChunks(chunksWithImages);
    progress('images_generated', {
      message: `Generated ${imageCount} images`,
      count: imageCount,
      cost: estimateCost(imageCount, quality, model)
    });

    // Step 5: Upload to WordPress (optional)
    if (wpCredentials && wpCredentials.url) {
      progress('uploading', { message: 'Uploading images to WordPress...' });

      await uploadImagesToWordPress(chunksWithImages, wpCredentials, (current, total) => {
        progress('upload_progress', {
          message: `Uploaded ${current} of ${total} images`,
          current,
          total
        });
      });

      progress('uploaded', { message: 'Images uploaded to WordPress' });
    }

    return {
      chunks: chunksWithImages,
      title: pageTitle,
      styleDNA: activeStyleDNA,
      imagesGenerated: imageCount,
      estimatedCost: estimateCost(imageCount, quality)
    };

  } catch (error) {
    progress('error', { message: error.message, error });
    throw error;
  }
}

/**
 * Add basic prompts without GPT analysis (fallback)
 */
function addBasicPrompts(chunks, styleDNA, keyword, maxImages) {
  let imageCount = 0;

  // Hero image
  if (chunks.intro && imageCount < maxImages) {
    chunks.intro.imagePrompt = buildFluxPrompt(
      styleDNA,
      { action: `${keyword} concept, professional business scene`, mood: 'professional' },
      'hero'
    );
    imageCount++;
  }

  // Inline images
  for (let i = 0; i < chunks.chunks.length && imageCount < maxImages; i++) {
    if (chunks.chunks[i].wordCount >= 50 && (i % 2 === 0 || maxImages - imageCount >= chunks.chunks.length - i)) {
      chunks.chunks[i].imagePrompt = buildFluxPrompt(
        styleDNA,
        {
          action: chunks.chunks[i].heading || `${keyword} process`,
          mood: 'professional'
        },
        'inline'
      );
      chunks.chunks[i].imageSide = imageCount % 2 === 0 ? 'left' : 'right';
      imageCount++;
    }
  }
}

/**
 * Count prompts in chunks
 */
function countPromptsInChunks(chunks) {
  let count = 0;
  if (chunks.intro?.imagePrompt) count++;
  for (const chunk of chunks.chunks) {
    if (chunk.imagePrompt) count++;
  }
  return count;
}

/**
 * Count images in chunks
 */
function countImagesInChunks(chunks) {
  let count = 0;
  if (chunks.intro?.imageData?.url) count++;
  for (const chunk of chunks.chunks) {
    if (chunk.imageData?.url) count++;
  }
  return count;
}

/**
 * Upload generated images to WordPress Media Library
 */
async function uploadImagesToWordPress(chunks, wpCredentials, onProgress = null) {
  let current = 0;
  const total = countImagesInChunks(chunks);

  // Helper to upload and update chunk
  async function uploadChunkImage(chunk, namePrefix) {
    if (!chunk.imageData?.url) return;

    try {
      // Download image from OpenAI URL
      const imageResponse = await fetch(chunk.imageData.url);
      if (!imageResponse.ok) throw new Error('Failed to download image');

      const imageBuffer = await imageResponse.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString('base64');

      // Generate filename
      const filename = `${namePrefix}-${Date.now()}.webp`;

      // Upload to WordPress
      const media = await uploadMedia(
        wpCredentials,
        base64,
        filename,
        { alt: chunk.imageData.alt || namePrefix }
      );

      // Update chunk with WordPress URL
      chunk.imageData.wpUrl = media.url;
      chunk.imageData.wpMediaId = media.id;

      current++;
      if (onProgress) onProgress(current, total);
    } catch (error) {
      console.error(`Failed to upload image for ${namePrefix}:`, error);
      // Don't fail the whole process, keep OpenAI URL as fallback
    }
  }

  // Upload intro/hero image
  if (chunks.intro?.imageData?.url) {
    await uploadChunkImage(chunks.intro, 'hero');
  }

  // Upload chunk images
  for (let i = 0; i < chunks.chunks.length; i++) {
    if (chunks.chunks[i].imageData?.url) {
      await uploadChunkImage(chunks.chunks[i], `section-${i + 1}`);
    }
  }

  return chunks;
}

/**
 * Generate images for existing chunks (no content processing)
 * Useful when chunks are already prepared
 */
export async function generateImagesForChunks(chunks, options = {}) {
  const {
    styleDNA,
    openaiApiKey,
    replicateApiKey,
    keyword = '',
    title = '',
    maxImages = 4,
    model = 'flux-1.1-pro',  // Default to Flux
    quality = 'low'
  } = options;

  // Generate prompts if needed
  const needPrompts = !chunks.intro?.imagePrompt &&
    !chunks.chunks.some(c => c.imagePrompt);

  if (needPrompts && openaiApiKey) {
    await generatePromptsForArticle(chunks, styleDNA, {
      title,
      keyword,
      maxImages
    }, openaiApiKey);
  } else if (needPrompts) {
    addBasicPrompts(chunks, styleDNA || {}, keyword, maxImages);
  }

  // Select correct API key based on model
  const imageApiKey = model === 'gpt-image-1.5' ? openaiApiKey : replicateApiKey;

  // Generate images using selected model
  if (imageApiKey) {
    await generateArticleImages(chunks, { maxImages, model, quality }, imageApiKey);
  }

  return chunks;
}

/**
 * Preview prompts without generating images
 * Useful for testing/debugging prompt quality
 */
export async function previewPrompts(content, options = {}) {
  const {
    styleDNA = null,
    openaiApiKey,
    keyword = '',
    title = null,
    maxImages = 4,
    maxWords = 300,
    quality = 'low',
    model = 'flux-1.1-pro'  // Default to Flux
  } = options;

  // Chunk content
  const chunks = chunkContent(content, { maxWords });
  const pageTitle = title || extractTitle(content) || 'Untitled';

  // Use provided or default Style DNA
  const activeStyleDNA = styleDNA || {
    styleTemplate: 'Professional photograph of {ACTION}, natural lighting, high quality',
    attributes: { style: 'professional' }
  };

  // Generate prompts
  if (openaiApiKey) {
    await generatePromptsForArticle(chunks, activeStyleDNA, {
      title: pageTitle,
      keyword,
      maxImages
    }, openaiApiKey);
  } else {
    addBasicPrompts(chunks, activeStyleDNA, keyword, maxImages);
  }

  // Extract prompts for preview
  const prompts = [];

  if (chunks.intro?.imagePrompt) {
    prompts.push({
      type: 'hero',
      section: 'Introduction',
      prompt: chunks.intro.imagePrompt,
      action: chunks.intro.extractedAction
    });
  }

  for (let i = 0; i < chunks.chunks.length; i++) {
    if (chunks.chunks[i].imagePrompt) {
      prompts.push({
        type: 'inline',
        section: chunks.chunks[i].heading || `Section ${i + 1}`,
        side: chunks.chunks[i].imageSide,
        prompt: chunks.chunks[i].imagePrompt,
        action: chunks.chunks[i].extractedAction
      });
    }
  }

  return {
    title: pageTitle,
    styleDNA: activeStyleDNA,
    prompts,
    chunks,
    estimatedCost: estimateCost(prompts.length, quality, model)
  };
}

export default {
  processArticleWithImages,
  generateImagesForChunks,
  previewPrompts
};
