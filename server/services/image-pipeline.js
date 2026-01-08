/**
 * Image Pipeline Service
 * Orchestrates the full image generation flow:
 * Article Content → Chunks → Actions → Prompts → Images → WordPress
 *
 * Supports both OpenAI gpt-image-1.5 and Flux 1.1 Pro via Replicate
 *
 * Generate Live Modes:
 * - main_prompt: Uses avatar's mainPrompt with placeholders filled via smart matching
 * - guided_gpt: Uses GPT-4o with guardrails/instructions to generate contextual prompts
 * - smart_prompt: Uses GPT-4o-mini to analyze article content (legacy behavior)
 */

import chunkContent, { extractTitle, countWords } from './content-chunker.js';
import { generatePromptsForArticle, extractStyleDNA, buildFluxPrompt, generateGuidedPrompt } from './image-prompt-generator.js';
import { generateArticleImages, generateImage, estimateCost } from './image-generator.js';
import { uploadMedia } from './wordpress-publisher.js';

/**
 * Helper: Generate plural forms of a word
 */
function getPluralForms(word, matchPlurals = true) {
  if (!matchPlurals) return [word];
  const forms = [word];
  const w = word.toLowerCase().trim();
  // Add common plural forms
  if (w.endsWith('s') || w.endsWith('x') || w.endsWith('ch') || w.endsWith('sh')) {
    forms.push(w + 'es'); // box → boxes, dish → dishes
  } else if (w.endsWith('y') && !['a','e','i','o','u'].includes(w[w.length-2])) {
    forms.push(w.slice(0, -1) + 'ies'); // city → cities
  } else {
    forms.push(w + 's'); // counter → counters
  }
  // Also check if word is already plural, add singular
  if (w.endsWith('ies')) {
    forms.push(w.slice(0, -3) + 'y'); // cities → city
  } else if (w.endsWith('es')) {
    forms.push(w.slice(0, -2)); // boxes → box
  } else if (w.endsWith('s') && w.length > 2) {
    forms.push(w.slice(0, -1)); // counters → counter
  }
  return [...new Set(forms)]; // Remove duplicates
}

/**
 * Extract local content around a position in the article
 * @param {string} fullContent - Full article content
 * @param {number} position - Approximate word position in article
 * @param {number} wordRange - How many words before and after to include
 * @returns {string} Local content excerpt
 */
function extractLocalContent(fullContent, position, wordRange = 75) {
  // Strip HTML tags for word counting
  const textOnly = fullContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = textOnly.split(/\s+/);

  const startWord = Math.max(0, position - wordRange);
  const endWord = Math.min(words.length, position + wordRange);

  return words.slice(startWord, endWord).join(' ');
}

/**
 * Smart Content Matching for a single image position
 * Matches LOCAL content around image position to placeholder options
 *
 * @param {string} localContent - Content around the image position
 * @param {object} avatar - Audience avatar with placeholderCategories
 * @param {Set} usedPrimaries - Set of already-used primary keywords (shared across positions)
 * @param {boolean} matchPlurals - Whether to match plural forms
 * @param {number} positionIndex - Which image position (0=hero, 1=first inline, etc)
 * @returns {object} { replacements, matchedPrimaries: [] }
 */
function smartMatchForPosition(localContent, avatar, usedPrimaries, matchPlurals = true, positionIndex = 0) {
  if (!avatar?.placeholderCategories?.length) {
    console.log(`[Smart Match #${positionIndex}] No placeholder categories found in avatar`);
    return { replacements: {}, matchedPrimaries: [] };
  }

  const contentLower = localContent.toLowerCase();
  const replacements = {};
  const newlyMatchedPrimaries = [];

  // Process each placeholder category
  for (const category of avatar.placeholderCategories) {
    // Skip randomized categories - pick randomly
    if (category.isRandomized) {
      const randomOption = category.options?.[Math.floor(Math.random() * (category.options?.length || 1))];
      if (randomOption) {
        replacements[category.placeholder] = randomOption.text;
        console.log(`[Smart Match #${positionIndex}] ${category.name}: Random → "${randomOption.text}"`);
      }
      continue;
    }

    let bestMatch = null;
    let bestScore = 0;

    // Score each option based on keyword matches in LOCAL content
    for (const option of category.options || []) {
      let score = 0;
      const matchedPrimary = [];
      const matchedSecondary = [];

      // Check PRIMARY keywords first (Rule 1)
      for (const kw of (option.primaryKeywords || [])) {
        const kwLower = kw.toLowerCase().trim();
        if (!kwLower) continue;

        // Check if already used by previous image (Rule 3: no duplicate primaries across page)
        if (usedPrimaries.has(kwLower)) continue;

        // Check keyword and its plural forms
        const forms = getPluralForms(kwLower, matchPlurals);
        for (const form of forms) {
          if (contentLower.includes(form)) {
            score += 10;
            matchedPrimary.push(kwLower);
            break;
          }
        }
      }

      // Check SECONDARY keywords if enabled (Rule 2)
      if (option.useSecondaryKeywords !== false) {
        // Auto-include category name as secondary keyword
        const categoryKeyword = category.name.toLowerCase().replace(/_/g, ' ');
        const secondaryKeywords = [categoryKeyword, ...(option.secondaryKeywords || [])];

        for (const kw of secondaryKeywords) {
          const kwLower = kw.toLowerCase().trim();
          if (!kwLower || matchedPrimary.includes(kwLower)) continue;

          const forms = getPluralForms(kwLower, matchPlurals);
          for (const form of forms) {
            if (contentLower.includes(form)) {
              score += 1; // Secondary matches worth less
              matchedSecondary.push(kwLower);
              break;
            }
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          option,
          matchedPrimary,
          matchedSecondary,
          score
        };
      }
    }

    // Use best match or fall back to first option
    if (bestMatch) {
      replacements[category.placeholder] = bestMatch.option.text;
      // Track primaries matched at this position
      newlyMatchedPrimaries.push(...bestMatch.matchedPrimary);
      console.log(`[Smart Match #${positionIndex}] ${category.name}: "${bestMatch.option.text}" (score: ${bestMatch.score}, primary: ${bestMatch.matchedPrimary.join(', ')}, secondary: ${bestMatch.matchedSecondary.join(', ')})`);
    } else if (category.options?.length > 0) {
      // Fallback to first option
      replacements[category.placeholder] = category.options[0].text;
      console.log(`[Smart Match #${positionIndex}] ${category.name}: Fallback → "${category.options[0].text}"`);
    }
  }

  return { replacements, matchedPrimaries: newlyMatchedPrimaries };
}

/**
 * Legacy: Smart Content Matching for entire article (deprecated - use smartMatchForPosition)
 * Kept for backwards compatibility
 */
function smartMatchPlaceholders(content, avatar, wordRange = 75, matchPlurals = true) {
  const usedPrimaries = new Set();
  const { replacements } = smartMatchForPosition(content, avatar, usedPrimaries, matchPlurals, 0);
  return replacements;
}

/**
 * Build prompt by replacing placeholders with values
 * Mirrors frontend buildAdvancedPrompt function
 */
function buildPromptWithReplacements(mainPrompt, replacements) {
  let result = mainPrompt;
  Object.entries(replacements).forEach(([placeholder, value]) => {
    // Escape curly braces for regex
    const escapedPlaceholder = placeholder.replace(/[{}]/g, '\\$&');
    result = result.replace(new RegExp(escapedPlaceholder, 'g'), value);
  });
  return result;
}

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
    anthropicApiKey,  // Used for Claude models in Guided GPT
    geminiApiKey,     // Used for Gemini models in Guided GPT
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

    // Generate Live Prompt Mode Options
    livePromptMode = 'smart_prompt', // 'main_prompt', 'guided_gpt', or 'smart_prompt'
    targetAvatar = null, // Audience avatar with mainPrompt and placeholderCategories
    smartPromptGuidance = '', // Optional guidance for smart_prompt mode
    matchPlurals = true, // Whether to match plural forms in smart matching
    heroImageSide = 'right', // Hero image side - inline images will alternate starting from opposite

    // Guided GPT Mode Options
    guidedGuardrails = null, // { instructions, uniformDescription, stylePreferences, avoidList, defaultSubject }
    guidedModel = 'gpt-4o', // GPT model for guided mode: gpt-4o, gpt-4o-mini, gpt-4-turbo

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
    // Check if we should use main_prompt mode (avatar's mainPrompt with smart matching)
    const useMainPromptMode = livePromptMode === 'main_prompt' && targetAvatar?.mainPrompt;

    if (useMainPromptMode) {
      // MAIN_PROMPT MODE: Use avatar's mainPrompt with smart-matched placeholders
      // KEY FIX: Match EACH image position to LOCAL content (75 words around it)
      progress('smart_matching', { message: 'Smart matching content to placeholders per image position...' });

      console.log('\n╔══════════════════════════════════════════════════════════════╗');
      console.log('║     GENERATE LIVE: MAIN PROMPT MODE (Per-Position Matching)  ║');
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log(`║ Avatar: ${(targetAvatar.name || 'Unknown').padEnd(52)} ║`);
      console.log(`║ Main Prompt: ${targetAvatar.mainPrompt?.substring(0, 47).padEnd(47)}... ║`);
      console.log(`║ Hero Side: ${heroImageSide.padEnd(10)} | Inline starts: ${(heroImageSide === 'right' ? 'left' : 'right').padEnd(25)} ║`);
      console.log('╚══════════════════════════════════════════════════════════════╝');

      // Shared state across all image positions
      const usedPrimaries = new Set(); // Rule 3: No duplicate primaries across page
      const allReplacements = []; // Track replacements for each position
      let imageCount = 0;
      let cumulativeWordPosition = 0; // Track position in article

      // Calculate inline image starting side (opposite of hero)
      const inlineStartSide = heroImageSide === 'right' ? 'left' : 'right';

      // HERO IMAGE - Match against intro content
      if (chunks.intro && imageCount < maxImages) {
        const heroWordPosition = Math.floor((chunks.intro.wordCount || 100) / 2);
        const heroLocalContent = extractLocalContent(content, heroWordPosition, 75);

        console.log(`\n[Hero Image] Position ${heroWordPosition} words, local content: ${heroLocalContent.substring(0, 80)}...`);

        const { replacements, matchedPrimaries } = smartMatchForPosition(
          heroLocalContent,
          targetAvatar,
          usedPrimaries,
          matchPlurals,
          0 // Position index 0 = hero
        );

        // Mark primaries as used for next images
        matchedPrimaries.forEach(kw => usedPrimaries.add(kw));

        const heroPrompt = buildPromptWithReplacements(targetAvatar.mainPrompt, replacements);
        allReplacements.push({ position: 'hero', replacements, prompt: heroPrompt });

        chunks.intro.imagePrompt = heroPrompt;
        chunks.intro.extractedAction = {
          action: 'Smart matched from main prompt',
          mood: 'professional',
          subjects: Object.values(replacements),
          setting: keyword || 'service context',
          matchedKeywords: matchedPrimaries
        };
        chunks.intro.imageSide = heroImageSide;

        cumulativeWordPosition = chunks.intro.wordCount || 100;
        imageCount++;

        console.log(`[Hero] Prompt: ${heroPrompt.substring(0, 100)}...`);
      }

      // INLINE IMAGES - Match each against LOCAL content around its position
      let inlineImageIndex = 0;
      for (let i = 0; i < chunks.chunks.length && imageCount < maxImages; i++) {
        const chunk = chunks.chunks[i];

        // Skip very short chunks
        if (chunk.wordCount < 50) {
          cumulativeWordPosition += chunk.wordCount || 0;
          continue;
        }

        // Only add image to every other eligible chunk
        const remainingSlots = maxImages - imageCount;
        const remainingChunks = chunks.chunks.length - i;
        const shouldAddImage = remainingSlots >= remainingChunks || i % 2 === 0;

        if (shouldAddImage) {
          // Calculate word position for this chunk (middle of chunk)
          const chunkMiddle = cumulativeWordPosition + Math.floor((chunk.wordCount || 100) / 2);
          const localContent = extractLocalContent(content, chunkMiddle, 75);

          console.log(`\n[Image #${imageCount}] Section "${chunk.heading || 'Untitled'}" at word ${chunkMiddle}`);
          console.log(`[Image #${imageCount}] Local: ${localContent.substring(0, 80)}...`);

          const { replacements, matchedPrimaries } = smartMatchForPosition(
            localContent,
            targetAvatar,
            usedPrimaries,
            matchPlurals,
            imageCount // Position index
          );

          // Mark primaries as used for next images
          matchedPrimaries.forEach(kw => usedPrimaries.add(kw));

          const imagePrompt = buildPromptWithReplacements(targetAvatar.mainPrompt, replacements);
          allReplacements.push({ position: `inline-${i}`, heading: chunk.heading, replacements, prompt: imagePrompt });

          chunk.imagePrompt = imagePrompt;
          chunk.extractedAction = {
            action: 'Smart matched from main prompt',
            mood: 'professional',
            subjects: Object.values(replacements),
            setting: chunk.heading || 'service section',
            matchedKeywords: matchedPrimaries
          };

          // Alternate sides starting from opposite of hero
          chunk.imageSide = inlineImageIndex % 2 === 0 ? inlineStartSide : heroImageSide;
          inlineImageIndex++;
          imageCount++;

          console.log(`[Image #${imageCount - 1}] Side: ${chunk.imageSide} | Prompt: ${imagePrompt.substring(0, 80)}...`);
        }

        cumulativeWordPosition += chunk.wordCount || 0;
      }

      // Summary log
      console.log('\n╔══════════════════════════════════════════════════════════════╗');
      console.log('║                   SMART MATCHING SUMMARY                     ║');
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log(`║ Total Images: ${String(imageCount).padEnd(3)} | Used Primaries: ${Array.from(usedPrimaries).slice(0, 3).join(', ').padEnd(30)} ║`);
      allReplacements.forEach((r, idx) => {
        const values = Object.values(r.replacements).join(', ').substring(0, 50);
        console.log(`║ #${idx}: ${values.padEnd(56)} ║`);
      });
      console.log('╚══════════════════════════════════════════════════════════════╝\n');

      const promptCount = countPromptsInChunks(chunks);
      progress('prompts_generated', {
        message: `Generated ${promptCount} unique image prompts using main prompt mode`,
        count: promptCount,
        mode: 'main_prompt',
        replacements: allReplacements
      });

    } else if (livePromptMode === 'guided_gpt' && openaiApiKey) {
      // GUIDED GPT MODE: Use GPT-4o with guardrails to generate contextual prompts
      progress('guided_prompts', { message: `Generating prompts with ${guidedModel} + guardrails...` });

      console.log('\n╔══════════════════════════════════════════════════════════════╗');
      console.log('║        GENERATE LIVE: GUIDED GPT MODE                        ║');
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log(`║ Model: ${guidedModel.padEnd(53)} ║`);
      console.log(`║ Avatar: ${(targetAvatar?.name || 'Default').padEnd(52)} ║`);
      if (guidedGuardrails?.instructions) {
        console.log(`║ Instructions: ${guidedGuardrails.instructions.substring(0, 45).padEnd(45)}... ║`);
      }
      console.log('╚══════════════════════════════════════════════════════════════╝');

      const guardrails = guidedGuardrails || targetAvatar?.guardrails || {};
      let imageCount = 0;
      let cumulativeWordPosition = 0;
      const inlineStartSide = heroImageSide === 'right' ? 'left' : 'right';
      const generatedPrompts = [];

      // HERO IMAGE
      if (chunks.intro && imageCount < maxImages) {
        const heroContent = chunks.intro.content || '';

        const result = await generateGuidedPrompt(
          heroContent,
          {
            articleTitle: pageTitle,
            keyword,
            imageType: 'hero',
            businessType: targetAvatar?.businessType || ''
          },
          guardrails,
          { openai: openaiApiKey, anthropic: anthropicApiKey, gemini: geminiApiKey },
          { guidedModel }
        );

        chunks.intro.imagePrompt = result.prompt;
        chunks.intro.extractedAction = {
          action: result.action,
          mood: result.mood,
          subjects: result.subjects || [],
          setting: result.setting
        };
        chunks.intro.imageSide = heroImageSide;
        generatedPrompts.push({ position: 'hero', prompt: result.prompt });

        cumulativeWordPosition = chunks.intro.wordCount || 100;
        imageCount++;
        console.log(`[Guided GPT] Hero: ${result.prompt.substring(0, 80)}...`);
      }

      // INLINE IMAGES
      let inlineImageIndex = 0;
      for (let i = 0; i < chunks.chunks.length && imageCount < maxImages; i++) {
        const chunk = chunks.chunks[i];

        if (chunk.wordCount < 50) {
          cumulativeWordPosition += chunk.wordCount || 0;
          continue;
        }

        const remainingSlots = maxImages - imageCount;
        const remainingChunks = chunks.chunks.length - i;
        const shouldAddImage = remainingSlots >= remainingChunks || i % 2 === 0;

        if (shouldAddImage) {
          const result = await generateGuidedPrompt(
            chunk.content || '',
            {
              articleTitle: pageTitle,
              keyword,
              imageType: 'inline',
              businessType: targetAvatar?.businessType || ''
            },
            guardrails,
            { openai: openaiApiKey, anthropic: anthropicApiKey, gemini: geminiApiKey },
            { guidedModel }
          );

          chunk.imagePrompt = result.prompt;
          chunk.extractedAction = {
            action: result.action,
            mood: result.mood,
            subjects: result.subjects || [],
            setting: result.setting
          };
          chunk.imageSide = inlineImageIndex % 2 === 0 ? inlineStartSide : heroImageSide;
          generatedPrompts.push({ position: `inline-${i}`, heading: chunk.heading, prompt: result.prompt });

          inlineImageIndex++;
          imageCount++;
          console.log(`[Guided GPT] #${imageCount}: ${result.prompt.substring(0, 80)}...`);
        }

        cumulativeWordPosition += chunk.wordCount || 0;
      }

      const promptCount = countPromptsInChunks(chunks);
      progress('prompts_generated', {
        message: `Generated ${promptCount} unique image prompts using guided GPT mode`,
        count: promptCount,
        mode: 'guided_gpt',
        model: guidedModel,
        prompts: generatedPrompts
      });

    } else if (!openaiApiKey) {
      progress('skipping_prompts', { message: 'No OpenAI key, using basic prompts' });
      // Add basic prompts without GPT analysis
      addBasicPrompts(chunks, activeStyleDNA, keyword, maxImages);
    } else {
      // SMART_PROMPT MODE: Use GPT-4o-mini to analyze content (legacy behavior)
      progress('generating_prompts', { message: 'Analyzing content for image prompts (smart prompt mode)...' });

      // If there's guidance provided, we could pass it to the prompt generator
      // For now, log it for visibility
      if (smartPromptGuidance) {
        console.log('[Smart Prompt Mode] Guidance provided:', smartPromptGuidance.substring(0, 100));
      }

      await generatePromptsForArticle(chunks, activeStyleDNA, {
        title: pageTitle,
        keyword,
        maxImages
      }, openaiApiKey);

      const promptCount = countPromptsInChunks(chunks);
      progress('prompts_generated', {
        message: `Generated ${promptCount} image prompts`,
        count: promptCount,
        mode: 'smart_prompt'
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

    // DIAGNOSTIC: What are we returning from pipeline?
    console.log('\n[PIPELINE] ========== RETURNING FROM PIPELINE ==========');
    console.log('[PIPELINE] imageCount:', imageCount);
    console.log('[PIPELINE] intro.imageData exists:', !!chunksWithImages.intro?.imageData);
    if (chunksWithImages.intro?.imageData) {
      console.log('[PIPELINE] intro.imageData.url:', chunksWithImages.intro.imageData.url ? 'YES' : 'NO');
      console.log('[PIPELINE] intro.imageData.wpUrl:', chunksWithImages.intro.imageData.wpUrl ? 'YES' : 'NO');
      console.log('[PIPELINE] intro.imageData.wpMediaId:', chunksWithImages.intro.imageData.wpMediaId || 'NONE');
    }
    chunksWithImages.chunks?.forEach((c, i) => {
      if (c.imageData) {
        console.log(`[PIPELINE] chunk[${i}].imageData: url=${c.imageData.url ? 'YES' : 'NO'}, wpUrl=${c.imageData.wpUrl ? 'YES' : 'NO'}`);
      }
    });
    console.log('[PIPELINE] ===================================================\n');

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
      let base64;
      const imageUrl = chunk.imageData.url;

      // Handle base64 data URLs directly (fetch cannot download them)
      if (imageUrl.startsWith('data:')) {
        console.log(`[WP Upload] Processing base64 data URL for ${namePrefix}`);
        // Extract base64 from data URL: data:image/png;base64,<base64data>
        const base64Match = imageUrl.match(/^data:[^;]+;base64,(.+)$/);
        if (!base64Match) throw new Error('Invalid base64 data URL format');
        base64 = base64Match[1];
      } else {
        // Download image from HTTP URL
        console.log(`[WP Upload] Downloading HTTP image for ${namePrefix}: ${imageUrl.substring(0, 60)}...`);
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) throw new Error(`Failed to download image: ${imageResponse.status}`);
        const imageBuffer = await imageResponse.arrayBuffer();
        base64 = Buffer.from(imageBuffer).toString('base64');
      }

      // Generate filename
      const filename = `${namePrefix}-${Date.now()}.webp`;

      // Upload to WordPress
      console.log(`[WP Upload] Uploading ${namePrefix} to WordPress Media Library...`);
      const media = await uploadMedia(
        wpCredentials,
        base64,
        filename,
        { alt: chunk.imageData.alt || namePrefix }
      );

      // Update chunk with WordPress URL
      chunk.imageData.wpUrl = media.url;
      chunk.imageData.wpMediaId = media.id;
      console.log(`[WP Upload] ✓ ${namePrefix} uploaded: ${media.url}`);

      current++;
      if (onProgress) onProgress(current, total);
    } catch (error) {
      console.error(`[WP Upload] ✗ Failed to upload ${namePrefix}:`, error.message);
      // Don't fail the whole process, keep original URL as fallback
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
