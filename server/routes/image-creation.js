/**
 * Image Creation Routes
 * Routes for "7. Image Creation" section - GPT Image API + settings management
 */

import express from 'express';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Replicate from 'replicate';
import { sql, isDatabaseEnabled } from '../db/index.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateImage } from '../services/image-generator.js';
import { uploadMedia } from '../services/wordpress-publisher.js';
import githubLogger from '../services/github-logger.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware to check database availability
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// ========================================
// GPT IMAGE API (gpt-image-1)
// ========================================

/**
 * POST /api/image-creation/generate
 * Generate image using GPT Image model (gpt-image-1)
 * Supports text prompt + optional reference images
 */
router.post('/generate', async (req, res) => {
  try {
    const {
      prompt,
      model = 'gpt-image-1.5', // gpt-image-1.5, gpt-image-1, dall-e-3, etc.
      referenceImages = [], // Array of image URLs or base64 strings
      size = '1024x1024', // 1024x1024, 1024x1536, 1536x1024
      quality = 'high', // 'low', 'medium', 'high'
      style = 'vivid', // 'vivid' or 'natural'
      openaiApiKey
    } = req.body;

    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key is required' });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const openai = new OpenAI({ apiKey });

    // Build the request
    let fullPrompt = prompt;

    // If reference images provided, add style guidance
    if (referenceImages.length > 0) {
      fullPrompt = `Create an image in the exact same style as the reference images provided. Style consistency is critical. ${prompt}`;
    }

    // Determine the actual model to use and build params accordingly
    const selectedModel = model || 'gpt-image-1.5';
    console.log(`[Image Generation] Using model: ${selectedModel}`);

    // GPT-Image-1.5 and GPT-Image-1 specific sizes (1024x1024, 1536x1024, 1024x1536)
    // Convert old DALL-E sizes if needed
    let adjustedSize = size;
    if (selectedModel.startsWith('gpt-image')) {
      const sizeMap = {
        '1792x1024': '1536x1024', // Landscape
        '1024x1792': '1024x1536', // Portrait
      };
      adjustedSize = sizeMap[size] || size;
    }

    // Build generation params - different models have different capabilities
    const generateParams = {
      model: selectedModel,
      prompt: fullPrompt,
      n: 1,
      size: adjustedSize,
    };

    // Add quality/style params based on model capabilities
    if (selectedModel === 'dall-e-3') {
      generateParams.quality = quality === 'high' ? 'hd' : 'standard';
      generateParams.style = style;
    } else if (selectedModel.startsWith('gpt-image')) {
      // GPT-Image models use quality differently
      generateParams.quality = quality;
    }

    // Only add response_format for models that support it (not gpt-image-1.5)
    if (!selectedModel.startsWith('gpt-image')) {
      generateParams.response_format = 'url';
    }

    const response = await openai.images.generate(generateParams);

    // Handle both URL and base64 response formats
    // gpt-image-1.5 returns base64, DALL-E returns URL
    let imageUrl;
    const revisedPrompt = response.data[0].revised_prompt;

    if (response.data[0].b64_json) {
      imageUrl = `data:image/png;base64,${response.data[0].b64_json}`;
      console.log('[Image Generation] Got base64 image, converted to data URL');
    } else if (response.data[0].url) {
      imageUrl = response.data[0].url;
    }

    if (!imageUrl) {
      console.error('[Image Generation] No image data in response');
      return res.status(500).json({ error: 'OpenAI returned no image data' });
    }

    res.json({
      success: true,
      image: {
        url: imageUrl,
        prompt: fullPrompt,
        revisedPrompt,
        model: selectedModel,
        size: adjustedSize,
        quality,
        style
      }
    });

  } catch (error) {
    console.error('[Image Generation] Error:', error.message);
    res.status(500).json({
      error: error.message,
      model: req.body.model || 'gpt-image-1.5'
    });
  }
});

/**
 * POST /api/image-creation/generate-with-reference
 * Generate image using reference images for style consistency
 * Uses OpenAI's image edit endpoint with gpt-image-1
 */
router.post('/generate-with-reference', async (req, res) => {
  try {
    const {
      prompt,
      model = 'gpt-image-1.5', // Default to latest model
      referenceImageUrls = [],
      size = '1024x1024',
      openaiApiKey
    } = req.body;

    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key is required' });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const selectedModel = model || 'gpt-image-1.5';
    console.log(`[Image Generation with Reference] Using model: ${selectedModel}`);

    // GPT-Image models use different sizes
    let adjustedSize = size;
    if (selectedModel.startsWith('gpt-image')) {
      const sizeMap = {
        '1792x1024': '1536x1024', // Landscape
        '1024x1792': '1024x1536', // Portrait
      };
      adjustedSize = sizeMap[size] || size;
    }

    // For reference-based generation, we build a comprehensive prompt
    // that describes the desired style based on reference analysis
    let stylePrompt = prompt;

    if (referenceImageUrls.length > 0) {
      // Analyze reference images first using GPT-4o Vision
      const openai = new OpenAI({ apiKey });

      // Build vision messages with reference images
      const imageContent = referenceImageUrls.slice(0, 4).map(url => ({
        type: 'image_url',
        image_url: { url, detail: 'low' }
      }));

      const analysisResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze these reference images and describe their visual style in detail. Focus on:
- Color palette (specific colors, saturation, warmth)
- Lighting style (direction, softness, mood)
- Composition patterns
- Subject presentation
- Overall aesthetic/mood
- Any consistent visual elements

Be specific and technical so this description can guide image generation.`
              },
              ...imageContent
            ]
          }
        ],
        max_tokens: 500
      });

      const styleDescription = analysisResponse.choices[0].message.content;

      // Combine style description with user prompt
      stylePrompt = `STYLE REQUIREMENTS (match exactly):
${styleDescription}

CONTENT:
${prompt}

Generate an image that matches the described style exactly while depicting the content specified.`;
    }

    // Generate the image
    const openai = new OpenAI({ apiKey });

    // Build generation params based on model
    const generateParams = {
      model: selectedModel,
      prompt: stylePrompt,
      n: 1,
      size: adjustedSize,
    };

    // Add quality param based on model
    if (selectedModel === 'dall-e-3') {
      generateParams.quality = 'hd';
    } else if (selectedModel.startsWith('gpt-image')) {
      generateParams.quality = 'high';
    }

    // Only add response_format for models that support it (not gpt-image-1.5)
    if (!selectedModel.startsWith('gpt-image')) {
      generateParams.response_format = 'url';
    }

    const response = await openai.images.generate(generateParams);

    // Handle both URL and base64 response formats
    let imageUrl;
    if (response.data[0].b64_json) {
      imageUrl = `data:image/png;base64,${response.data[0].b64_json}`;
    } else if (response.data[0].url) {
      imageUrl = response.data[0].url;
    }

    if (!imageUrl) {
      return res.status(500).json({ error: 'OpenAI returned no image data' });
    }

    res.json({
      success: true,
      image: {
        url: imageUrl,
        prompt: stylePrompt,
        revisedPrompt: response.data[0].revised_prompt,
        model: selectedModel,
        size: adjustedSize
      }
    });

  } catch (error) {
    console.error('[Reference Generation] Error:', error.message);
    res.status(500).json({
      error: error.message,
      model: req.body.model || 'gpt-image-1.5'
    });
  }
});

/**
 * POST /api/image-creation/upload-to-wp
 * Upload a base64 image to WordPress staging site and return the WP URL.
 * This ensures images are stored as URLs (small) not base64 (huge).
 *
 * Used by: Testing Mode "Save to Bank", and any other flow that generates
 * base64 images that need to be persisted.
 */
router.post('/upload-to-wp', async (req, res) => {
  try {
    const { imageUrl, filename, alt } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    // Get staging WordPress credentials
    let wpUrl, wpUser, wpPassword;

    if (isDatabaseEnabled()) {
      try {
        const stagingResult = await sql`
          SELECT staging_wp_url, staging_wp_user, staging_wp_password
          FROM global_settings WHERE id = 1
        `;
        if (stagingResult.length > 0 && stagingResult[0].staging_wp_url) {
          wpUrl = stagingResult[0].staging_wp_url;
          wpUser = stagingResult[0].staging_wp_user;
          wpPassword = stagingResult[0].staging_wp_password;
        }
      } catch (dbError) {
        console.error('[Upload to WP] Failed to get staging credentials:', dbError.message);
      }
    }

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({
        error: 'Staging WordPress credentials not configured. Go to WordPress Settings > Staging WordPress to configure.',
        code: 'NO_STAGING_CREDENTIALS'
      });
    }

    // Handle base64 data URL
    const base64Match = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (base64Match) {
      const base64Data = base64Match[2];
      const extension = base64Match[1] || 'png';
      const finalFilename = filename || `test-image-${Date.now()}.${extension}`;

      console.log(`[Upload to WP] Uploading base64 image: ${finalFilename}`);

      const wpResult = await uploadMedia(
        { url: wpUrl, user: wpUser, password: wpPassword },
        base64Data,
        finalFilename,
        { alt: alt || 'AI Generated Test Image' }
      );

      if (wpResult && wpResult.url) {
        console.log(`[Upload to WP] ✓ Success: ${wpResult.url}`);
        return res.json({
          success: true,
          url: wpResult.url,
          wpMediaId: wpResult.id,
          originalWasBase64: true
        });
      } else {
        console.error('[Upload to WP] Upload returned but no URL:', wpResult);
        return res.status(500).json({ error: 'WordPress upload failed - no URL returned' });
      }
    }

    // Handle external URL (re-upload to our WP)
    if (imageUrl.startsWith('http')) {
      try {
        console.log(`[Upload to WP] Fetching external URL to re-upload: ${imageUrl.substring(0, 50)}...`);
        const imageRes = await fetch(imageUrl);
        const arrayBuffer = await imageRes.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        const finalFilename = filename || `reupload-${Date.now()}.png`;

        const wpResult = await uploadMedia(
          { url: wpUrl, user: wpUser, password: wpPassword },
          base64Data,
          finalFilename,
          { alt: alt || 'AI Generated Test Image' }
        );

        if (wpResult && wpResult.url) {
          console.log(`[Upload to WP] ✓ Re-uploaded: ${wpResult.url}`);
          return res.json({
            success: true,
            url: wpResult.url,
            wpMediaId: wpResult.id,
            originalWasBase64: false
          });
        } else {
          return res.status(500).json({ error: 'WordPress upload failed - no URL returned' });
        }
      } catch (fetchErr) {
        console.error('[Upload to WP] Failed to fetch/re-upload external URL:', fetchErr.message);
        return res.status(500).json({ error: `Failed to fetch image: ${fetchErr.message}` });
      }
    }

    return res.status(400).json({ error: 'Invalid imageUrl format. Must be base64 data URL or HTTP URL.' });

  } catch (error) {
    console.error('[Upload to WP] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/image-creation/batch-generate
 * Generate multiple images from prompts + variations
 *
 * IMPORTANT: Images are immediately uploaded to WordPress Media Library.
 * This is the preferred approach to avoid storing huge base64 data in the database.
 */
router.post('/batch-generate', async (req, res) => {
  try {
    const {
      mainPrompt,
      variations = [], // Array of {id, name, prompt, orientation}
      referenceImageUrls = [],
      quantity = 1, // How many of each variation
      model = 'flux-1.1-pro', // Default to Flux (gpt-image-1.5 requires org verification)
      quality = 'low',
      openaiApiKey,
      replicateApiKey,
      // WorkflowId to auto-lookup WP credentials (preferred)
      workflowId,
      // Or explicit WordPress credentials (fallback)
      wpUrl: explicitWpUrl,
      wpUser: explicitWpUser,
      wpPassword: explicitWpPassword
    } = req.body;

    console.log(`[Batch Generate] Starting batch for workflow ${workflowId || 'NOT PROVIDED'}`);

    // Try to get WordPress credentials - PRIORITY ORDER:
    // 1. Global staging credentials (from WordPress Settings > Staging WordPress)
    // 2. Explicit params passed in request
    // 3. Workflow's associated website (legacy fallback)
    let wpUrl = explicitWpUrl;
    let wpUser = explicitWpUser;
    let wpPassword = explicitWpPassword;

    // Get GLOBAL staging credentials from global_settings (ONLY source - no fallback)
    if (isDatabaseEnabled()) {
      console.log(`[Batch Generate] Checking for global staging credentials...`);
      try {
        const stagingResult = await sql`
          SELECT staging_wp_url, staging_wp_user, staging_wp_password
          FROM global_settings WHERE id = 1
        `;
        if (stagingResult.length > 0 && stagingResult[0].staging_wp_url) {
          wpUrl = stagingResult[0].staging_wp_url;
          wpUser = stagingResult[0].staging_wp_user;
          wpPassword = stagingResult[0].staging_wp_password;
          console.log(`[Batch Generate] ✓ Using GLOBAL staging credentials: ${wpUrl}`);
        } else {
          console.log(`[Batch Generate] ❌ No global staging credentials configured`);
        }
      } catch (dbError) {
        console.error('[Batch Generate] Failed to lookup staging credentials:', dbError.message);
      }
    }

    // STRICT: Staging credentials are REQUIRED - no fallback to workflow website
    // Images must upload to staging site (bypasses ModSecurity), not customer sites
    const shouldUploadToWp = wpUrl && wpUser && wpPassword;
    if (!shouldUploadToWp) {
      console.log('[Batch Generate] ❌ STAGING CREDENTIALS REQUIRED - Cannot proceed without them');
      return res.status(400).json({
        error: 'Staging WordPress credentials not configured. Go to WordPress Settings > Staging WordPress to configure.',
        hint: 'Images must upload to the staging site to bypass ModSecurity restrictions on customer sites.'
      });
    }
    console.log('[Batch Generate] ✓ Staging credentials configured - will upload images to staging WP Media Library');

    // Select correct API key based on model
    const apiKey = model === 'gpt-image-1.5'
      ? (openaiApiKey || process.env.OPENAI_API_KEY)
      : (replicateApiKey || process.env.REPLICATE_API_TOKEN);

    const keyType = model === 'gpt-image-1.5' ? 'OpenAI' : 'Replicate';

    if (!apiKey) {
      return res.status(400).json({ error: `${keyType} API key is required for ${model}` });
    }

    if (!mainPrompt && variations.length === 0) {
      return res.status(400).json({ error: 'Main prompt or variations required' });
    }

    const results = [];
    const errors = [];

    // Build prompts for each variation
    const promptsToGenerate = [];

    for (const variation of variations) {
      for (let i = 0; i < quantity; i++) {
        const fullPrompt = mainPrompt
          ? `${mainPrompt}\n\nVariation: ${variation.prompt}`
          : variation.prompt;

        // Determine size based on orientation
        let size;
        if (model.startsWith('gpt-image')) {
          size = variation.orientation === 'vertical'
            ? '1024x1536'
            : variation.orientation === 'landscape'
              ? '1536x1024'
              : '1024x1024';
        } else {
          // Flux uses aspect ratios, we'll pass size and let image-generator handle it
          size = variation.orientation === 'vertical'
            ? '1024x1536'
            : variation.orientation === 'landscape'
              ? '1536x1024'
              : '1024x1024';
        }

        promptsToGenerate.push({
          prompt: fullPrompt,
          size,
          variation: variation.name,
          variationId: variation.id,
          orientation: variation.orientation || 'square'
        });
      }
    }

    // Generate images using unified generateImage function
    // Use sequential processing with delay to avoid rate limits for all providers
    const isReplicateModel = ['flux-1.1-pro', 'seedream-4', 'ideogram-v3-turbo'].includes(model);
    const concurrencyLimit = isReplicateModel ? 1 : 2; // Sequential for Replicate, 2 concurrent for OpenAI
    // Replicate: 6/min limit = 11s delay; OpenAI: ~7/min limit = 9s delay between batches
    const delayBetweenRequests = isReplicateModel ? 11000 : 9000;

    for (let i = 0; i < promptsToGenerate.length; i += concurrencyLimit) {
      const batch = promptsToGenerate.slice(i, i + concurrencyLimit);

      // Add delay between batches (except for the first one) to avoid rate limits
      if (i > 0 && delayBetweenRequests > 0) {
        console.log(`[Batch Generate] Waiting ${delayBetweenRequests/1000}s to avoid rate limit...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }

      const batchResults = await Promise.all(
        batch.map(async (item) => {
          try {
            console.log(`[Batch Generate] Using model: ${model}, size: ${item.size}`);

            // Use unified generateImage function that handles both OpenAI and Flux
            const result = await generateImage(item.prompt, {
              model,
              quality,
              size: item.size
            }, apiKey);

            let finalUrl = result.url;
            let wpMediaId = null;
            let wpMediaUrl = null;

            // Upload to WordPress if credentials provided
            if (shouldUploadToWp && result.url) {
              try {
                // Extract base64 data from data URL
                const base64Match = result.url.match(/^data:image\/\w+;base64,(.+)$/);
                if (base64Match) {
                  const base64Data = base64Match[1];
                  const filename = `generated-${item.variation || 'image'}-${Date.now()}.png`;

                  console.log(`[Batch Generate] Uploading to WordPress: ${filename}`);

                  const wpResult = await uploadMedia(
                    { url: wpUrl, user: wpUser, password: wpPassword },
                    base64Data,
                    filename,
                    { alt: item.variation || 'AI Generated Image' }
                  );

                  if (wpResult && wpResult.url) {
                    wpMediaId = wpResult.id;
                    wpMediaUrl = wpResult.url;
                    finalUrl = wpResult.url; // Use WP URL instead of base64
                    console.log(`[Batch Generate] ✓ Uploaded to WP: ${wpResult.url}`);
                  } else {
                    console.log(`[Batch Generate] ⚠️ Upload returned but no URL:`, JSON.stringify(wpResult));
                  }
                } else if (result.url.startsWith('http')) {
                  // Already a URL (from Flux/Replicate) - still upload to our WP
                  try {
                    const imageRes = await fetch(result.url);
                    const arrayBuffer = await imageRes.arrayBuffer();
                    const base64Data = Buffer.from(arrayBuffer).toString('base64');
                    const filename = `generated-${item.variation || 'image'}-${Date.now()}.png`;

                    console.log(`[Batch Generate] Re-uploading external URL to WordPress: ${filename}`);

                    const wpResult = await uploadMedia(
                      { url: wpUrl, user: wpUser, password: wpPassword },
                      base64Data,
                      filename,
                      { alt: item.variation || 'AI Generated Image' }
                    );

                    if (wpResult && wpResult.url) {
                      wpMediaId = wpResult.id;
                      wpMediaUrl = wpResult.url;
                      finalUrl = wpResult.url;
                      console.log(`[Batch Generate] ✓ Re-uploaded to WP: ${wpResult.url}`);
                    } else {
                      console.log(`[Batch Generate] ⚠️ Re-upload returned but no URL:`, JSON.stringify(wpResult));
                    }
                  } catch (reuploadErr) {
                    console.error(`[Batch Generate] Failed to re-upload external URL:`, reuploadErr.message);
                    // Keep original URL as fallback
                  }
                }
              } catch (uploadError) {
                console.error(`[Batch Generate] WP upload failed:`, uploadError.message);
                // Continue with base64 URL as fallback
              }
            }

            return {
              success: true,
              url: finalUrl,
              wpUrl: wpMediaUrl,
              wpMediaId: wpMediaId,
              prompt: item.prompt,
              revisedPrompt: result.revisedPrompt,
              variation: item.variation,
              variationId: item.variationId,
              orientation: item.orientation,
              size: item.size,
              model: model
            };
          } catch (error) {
            console.error(`[Batch Generate] Error with ${model}:`, error.message);
            return {
              success: false,
              error: error.message,
              variation: item.variation,
              variationId: item.variationId,
              model: model
            };
          }
        })
      );

      results.push(...batchResults.filter(r => r.success));
      errors.push(...batchResults.filter(r => !r.success));
    }

    res.json({
      success: true,
      images: results,
      errors,
      total: results.length,
      failed: errors.length
    });

  } catch (error) {
    console.error('Batch generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CHAT WITH IMAGE MODEL
// ========================================

/**
 * POST /api/image-creation/chat
 * Chat with AI about image prompts, get critiques, suggestions
 * Supports multiple providers: OpenAI, Anthropic (Claude), Google (Gemini)
 * Supports image attachments for analysis
 */
router.post('/chat', async (req, res) => {
  try {
    const {
      messages = [], // Array of {role, content, images?}
      model = 'gpt-4o',
      contextImages = [], // Additional context images to include
      openaiApiKey
    } = req.body;

    if (!messages.length) {
      return res.status(400).json({ error: 'Messages required' });
    }

    // Determine provider based on model name
    const isAnthropicModel = model.includes('claude');
    const isGeminiModel = model.includes('gemini');
    const isOpenAIModel = !isAnthropicModel && !isGeminiModel;

    // Validate we have the right API key
    let apiKey;
    if (isAnthropicModel) {
      apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: 'Anthropic API key not configured. Please add ANTHROPIC_API_KEY to your environment variables.' });
      }
    } else if (isGeminiModel) {
      apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: 'Gemini API key not configured. Please add GEMINI_API_KEY to your environment variables.' });
      }
    } else {
      apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: 'OpenAI API key not configured' });
      }
    }

    // Default system message for image prompt assistance
    const defaultSystemContent = `You are an expert image prompt engineer helping create consistent, high-quality image generation prompts for a business marketing context.

Your role:
1. Analyze reference images to understand visual style
2. Help craft detailed, effective prompts for image generation
3. Suggest variations for different use cases (hero images, inline images, different scenes)
4. Critique and improve prompts for better results
5. Ensure style consistency across all generated images

When analyzing images, focus on:
- Color palette (specific colors, saturation levels)
- Lighting (direction, quality, mood)
- Composition (rule of thirds, leading lines, etc.)
- Subject presentation (angle, distance, framing)
- Background treatment
- Overall aesthetic/mood

When creating prompts, be specific and technical. Include details about lighting, camera angle, color grading, and mood.`;

    // Check if first message is already a system message (custom context injection)
    const hasCustomSystemMessage = messages.length > 0 && messages[0].role === 'system';

    console.log(`[Image Chat] Using provider: ${isAnthropicModel ? 'Anthropic' : isGeminiModel ? 'Google' : 'OpenAI'}, model: ${model}`);

    // ========== ANTHROPIC CLAUDE ==========
    if (isAnthropicModel) {
      const anthropic = new Anthropic({ apiKey });

      // Format messages for Claude
      // Claude uses 'system' as a top-level param, not in messages array
      let systemPrompt = hasCustomSystemMessage ? messages[0].content : defaultSystemContent;
      let claudeMessages = hasCustomSystemMessage ? messages.slice(1) : messages;

      // Format for Claude API
      const formattedMessages = claudeMessages.map(msg => {
        if (msg.images && msg.images.length > 0) {
          // Message with images - Claude uses different format
          const content = [
            { type: 'text', text: msg.content || '' }
          ];

          for (const img of msg.images) {
            // Claude expects base64 data without the data URL prefix
            if (img.startsWith('data:')) {
              const [header, base64Data] = img.split(',');
              const mediaType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
              content.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data
                }
              });
            }
          }
          return { role: msg.role === 'assistant' ? 'assistant' : 'user', content };
        }
        return { role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content };
      });

      // Inject context images (reference images, logos, etc.) into first user message for Claude
      if (contextImages.length > 0 && !hasCustomSystemMessage) {
        const firstUserIdx = formattedMessages.findIndex(m => m.role === 'user');
        if (firstUserIdx >= 0) {
          const userMsg = formattedMessages[firstUserIdx];
          const existingContent = typeof userMsg.content === 'string'
            ? [{ type: 'text', text: userMsg.content }]
            : Array.isArray(userMsg.content) ? userMsg.content : [{ type: 'text', text: String(userMsg.content) }];

          const contextImageBlocks = contextImages
            .filter(img => img.startsWith('data:'))
            .map(img => {
              const [header, base64Data] = img.split(',');
              const mediaType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
              return {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Data }
              };
            });

          if (contextImageBlocks.length > 0) {
            formattedMessages[firstUserIdx] = {
              role: 'user',
              content: [...existingContent, ...contextImageBlocks]
            };
          }
        }
      }

      const response = await anthropic.messages.create({
        model: model,
        max_tokens: 2000,
        system: systemPrompt,
        messages: formattedMessages
      });

      return res.json({
        success: true,
        message: {
          role: 'assistant',
          content: response.content[0].text
        },
        usage: { input_tokens: response.usage?.input_tokens, output_tokens: response.usage?.output_tokens }
      });
    }

    // ========== GOOGLE GEMINI ==========
    if (isGeminiModel) {
      // Use Google's Gemini API via REST
      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      // Build Gemini format messages
      const systemContent = hasCustomSystemMessage ? messages[0].content : defaultSystemContent;
      const chatMessages = hasCustomSystemMessage ? messages.slice(1) : messages;

      const contents = chatMessages.map(msg => {
        const parts = [{ text: msg.content || '' }];

        if (msg.images && msg.images.length > 0) {
          for (const img of msg.images) {
            if (img.startsWith('data:')) {
              const [header, base64Data] = img.split(',');
              const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
              parts.push({
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              });
            }
          }
        }

        return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts
        };
      });

      // Inject context images (reference images, logos, etc.) into first user message for Gemini
      if (contextImages.length > 0 && !hasCustomSystemMessage) {
        const firstUserIdx = contents.findIndex(m => m.role === 'user');
        if (firstUserIdx >= 0) {
          const contextParts = contextImages
            .filter(img => img.startsWith('data:'))
            .map(img => {
              const [header, base64Data] = img.split(',');
              const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
              return { inline_data: { mime_type: mimeType, data: base64Data } };
            });

          if (contextParts.length > 0) {
            contents[firstUserIdx] = {
              ...contents[firstUserIdx],
              parts: [...contents[firstUserIdx].parts, ...contextParts]
            };
          }
        }
      }

      const geminiResponse = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemContent }] },
          contents,
          generationConfig: { maxOutputTokens: 2000 }
        })
      });

      const geminiData = await geminiResponse.json();

      if (geminiData.error) {
        throw new Error(geminiData.error.message || 'Gemini API error');
      }

      const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

      return res.json({
        success: true,
        message: {
          role: 'assistant',
          content: responseText
        },
        usage: geminiData.usageMetadata
      });
    }

    // ========== OPENAI ==========
    const openai = new OpenAI({ apiKey });

    // Format messages for OpenAI API
    const formattedMessages = messages.map(msg => {
      if (msg.images && msg.images.length > 0) {
        return {
          role: msg.role,
          content: [
            { type: 'text', text: msg.content },
            ...msg.images.map(img => ({
              type: 'image_url',
              image_url: { url: img, detail: 'auto' }
            }))
          ]
        };
      }
      return { role: msg.role, content: msg.content };
    });

    const defaultSystemMessage = { role: 'system', content: defaultSystemContent };

    let finalMessages = hasCustomSystemMessage
      ? formattedMessages
      : [defaultSystemMessage, ...formattedMessages];

    // Add context images to first user message if provided
    if (contextImages.length > 0 && !hasCustomSystemMessage) {
      const firstUserIdx = finalMessages.findIndex(m => m.role === 'user');
      if (firstUserIdx >= 0) {
        const userMsg = finalMessages[firstUserIdx];
        const existingContent = typeof userMsg.content === 'string'
          ? [{ type: 'text', text: userMsg.content }]
          : userMsg.content;

        finalMessages[firstUserIdx] = {
          role: 'user',
          content: [
            ...existingContent,
            ...contextImages.map(img => ({
              type: 'image_url',
              image_url: { url: img, detail: 'low' }
            }))
          ]
        };
      }
    }

    // Use gpt-4o as fallback for unknown OpenAI models
    const validOpenAIModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'gpt-5.2-2025-12-11'];
    const actualModel = validOpenAIModels.includes(model) ? model : 'gpt-4o';

    if (actualModel !== model) {
      console.log(`[Image Chat] Unknown model "${model}", falling back to ${actualModel}`);
    }

    // GPT-5.2 uses max_completion_tokens instead of max_tokens
    const isGPT5 = actualModel.includes('gpt-5');
    const tokenParam = isGPT5 ? { max_completion_tokens: 2000 } : { max_tokens: 2000 };

    const response = await openai.chat.completions.create({
      model: actualModel,
      messages: finalMessages,
      ...tokenParam
    });

    res.json({
      success: true,
      message: {
        role: 'assistant',
        content: response.choices[0].message.content
      },
      usage: response.usage
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Chat failed'
    });
  }
});

/**
 * POST /api/image-creation/auto-tag
 * Use LLM to analyze an image and suggest title/category
 */
router.post('/auto-tag', async (req, res) => {
  try {
    const {
      imageUrl,
      categories = [],
      currentTitle = '',
      openaiApiKey
    } = req.body;

    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key is required for auto-tagging' });
    }

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const openai = new OpenAI({ apiKey });

    // Build the prompt for image analysis
    const categoriesList = categories.length > 0 ? categories.join(', ') : 'Hero, Service, Team, Equipment, Before/After, Other';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an image analyzer for a business content system. Analyze the image and provide:
1. A short, descriptive title (2-5 words) that describes what's in the image
2. The best category from this list: ${categoriesList}

Respond in JSON format only:
{"title": "your suggested title", "category": "matching category"}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: currentTitle
                ? `Current title: "${currentTitle}". Analyze this image and suggest a better title and category.`
                : 'Analyze this image and suggest a title and category.'
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl, detail: 'low' }
            }
          ]
        }
      ],
      max_tokens: 150
    });

    // Parse the response
    const content = response.choices[0].message.content;
    let result;
    try {
      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: currentTitle, category: 'Other' };
    } catch (e) {
      result = { title: currentTitle, category: 'Other' };
    }

    // Validate category is in the list
    if (!categories.includes(result.category)) {
      result.category = 'Other';
    }

    res.json({
      success: true,
      suggestedTitle: result.title || currentTitle,
      suggestedCategory: result.category || 'Other'
    });

  } catch (error) {
    console.error('Auto-tag error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// SETTINGS MANAGEMENT
// ========================================

/**
 * GET /api/image-creation/settings/website/:websiteId
 * Get image creation settings for a website (shared across all workflows)
 */
router.get('/settings/website/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    console.log('[Image Creation API] GET settings for website:', websiteId);

    const results = await sql`
      SELECT * FROM image_creation_settings
      WHERE website_id = ${websiteId}
    `;

    console.log('[Image Creation API] Found website records:', results.length);

    if (results.length === 0) {
      console.log('[Image Creation API] No website settings found, returning defaults');
      return res.json({
        success: true,
        settings: null, // No website-level settings yet
        isWebsiteLevel: true
      });
    }

    res.json({
      success: true,
      settings: results[0],
      isWebsiteLevel: true
    });

  } catch (error) {
    console.error('[Image Creation API] Get website settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/image-creation/settings/website/:websiteId
 * Save/update image creation settings for a website (shared across all workflows)
 */
router.put('/settings/website/:websiteId', requireDb, async (req, res) => {
  try {
    const { websiteId } = req.params;
    console.log('[Image Creation API] PUT settings for website:', websiteId);

    const settingsData = req.body;

    // Check if website settings exist
    const existing = await sql`
      SELECT id FROM image_creation_settings WHERE website_id = ${websiteId}
    `;

    if (existing.length === 0) {
      // Create new website-level settings
      await sql`
        INSERT INTO image_creation_settings (
          website_id,
          enabled,
          prompt_assistant_model,
          image_generation_model,
          image_quality,
          reference_images,
          logo_images,
          audience_avatars,
          image_bank,
          image_categories,
          auto_tag_enabled,
          chat_history,
          consultant_chat_history,
          consultant_model,
          worker_chat_history,
          worker_model,
          main_prompt_chat_history,
          main_prompt_chat_files,
          main_prompt_chat_conversations,
          main_prompt_chat_model,
          chat_cross_references,
          unified_chat_history,
          unified_chat_conversations,
          unified_chat_files,
          chat_scope_selections,
          integration_mode,
          fallback_to_live,
          image_order,
          variation_order_mode,
          manual_variation_order,
          live_prompt_mode,
          smart_prompt_guidance,
          guided_guardrails,
          prompt_problem_areas,
          guided_gpt_prompts,
          smart_prompt_prompts,
          guided_gpt_rules,
          legacy_prompt_rules,
          testing_slots,
          active_testing_slot
        ) VALUES (
          ${websiteId},
          ${settingsData.enabled ?? false},
          ${settingsData.prompt_assistant_model ?? 'gpt-4o'},
          ${settingsData.image_generation_model ?? 'flux-1.1-pro'},
          ${settingsData.image_quality ?? 'low'},
          ${JSON.stringify(settingsData.reference_images ?? [])},
          ${JSON.stringify(settingsData.logo_images ?? [])},
          ${JSON.stringify(settingsData.audience_avatars ?? [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }])},
          ${JSON.stringify(settingsData.image_bank ?? [])},
          ${JSON.stringify(settingsData.image_categories ?? ['Hero', 'Service', 'Team', 'Equipment', 'Before/After', 'Other'])},
          ${settingsData.auto_tag_enabled ?? true},
          ${JSON.stringify(settingsData.chat_history ?? [])},
          ${JSON.stringify(settingsData.consultant_chat_history ?? [])},
          ${settingsData.consultant_model ?? 'gpt-4o'},
          ${JSON.stringify(settingsData.worker_chat_history ?? [])},
          ${settingsData.worker_model ?? 'gpt-4o-mini'},
          ${JSON.stringify(settingsData.main_prompt_chat_history ?? [])},
          ${JSON.stringify(settingsData.main_prompt_chat_files ?? [])},
          ${JSON.stringify(settingsData.main_prompt_chat_conversations ?? [])},
          ${settingsData.main_prompt_chat_model ?? 'gpt-4o'},
          ${JSON.stringify(settingsData.chat_cross_references ?? [])},
          ${JSON.stringify(settingsData.unified_chat_history ?? [])},
          ${JSON.stringify(settingsData.unified_chat_conversations ?? [])},
          ${JSON.stringify(settingsData.unified_chat_files ?? [])},
          ${JSON.stringify(settingsData.chat_scope_selections ?? [])},
          ${settingsData.integration_mode ?? 'bank'},
          ${settingsData.fallback_to_live ?? true},
          ${JSON.stringify(settingsData.image_order ?? [])},
          ${settingsData.variation_order_mode ?? 'sequential'},
          ${JSON.stringify(settingsData.manual_variation_order ?? [])},
          ${settingsData.live_prompt_mode ?? 'main_prompt'},
          ${settingsData.smart_prompt_guidance ?? ''},
          ${JSON.stringify(settingsData.guided_guardrails ?? {})},
          ${JSON.stringify(settingsData.prompt_problem_areas ?? [])},
          ${JSON.stringify(settingsData.guided_gpt_prompts ?? [])},
          ${JSON.stringify(settingsData.smart_prompt_prompts ?? [])},
          ${JSON.stringify(settingsData.guided_gpt_rules ?? [])},
          ${JSON.stringify(settingsData.legacy_prompt_rules ?? [])},
          ${JSON.stringify(settingsData.testing_slots ?? [])},
          ${settingsData.active_testing_slot ?? null}
        )
      `;
      console.log('[Image Creation API] Created new website settings record');
    } else {
      // Update existing website-level settings
      await sql`
        UPDATE image_creation_settings
        SET
          enabled = COALESCE(${settingsData.enabled}, enabled),
          prompt_assistant_model = COALESCE(${settingsData.prompt_assistant_model}, prompt_assistant_model),
          image_generation_model = COALESCE(${settingsData.image_generation_model}, image_generation_model),
          image_quality = COALESCE(${settingsData.image_quality}, image_quality),
          reference_images = COALESCE(${settingsData.reference_images ? JSON.stringify(settingsData.reference_images) : null}::jsonb, reference_images),
          logo_images = COALESCE(${settingsData.logo_images ? JSON.stringify(settingsData.logo_images) : null}::jsonb, logo_images),
          audience_avatars = COALESCE(${settingsData.audience_avatars ? JSON.stringify(settingsData.audience_avatars) : null}::jsonb, audience_avatars),
          image_bank = ${settingsData.image_bank ? JSON.stringify(settingsData.image_bank) : '[]'}::jsonb,
          image_categories = COALESCE(${settingsData.image_categories ? JSON.stringify(settingsData.image_categories) : null}::jsonb, image_categories),
          auto_tag_enabled = COALESCE(${settingsData.auto_tag_enabled}, auto_tag_enabled),
          chat_history = COALESCE(${settingsData.chat_history ? JSON.stringify(settingsData.chat_history) : null}::jsonb, chat_history),
          consultant_chat_history = COALESCE(${settingsData.consultant_chat_history ? JSON.stringify(settingsData.consultant_chat_history) : null}::jsonb, consultant_chat_history),
          consultant_model = COALESCE(${settingsData.consultant_model}, consultant_model),
          worker_chat_history = COALESCE(${settingsData.worker_chat_history ? JSON.stringify(settingsData.worker_chat_history) : null}::jsonb, worker_chat_history),
          worker_model = COALESCE(${settingsData.worker_model}, worker_model),
          main_prompt_chat_history = COALESCE(${settingsData.main_prompt_chat_history ? JSON.stringify(settingsData.main_prompt_chat_history) : null}::jsonb, main_prompt_chat_history),
          main_prompt_chat_files = COALESCE(${settingsData.main_prompt_chat_files ? JSON.stringify(settingsData.main_prompt_chat_files) : null}::jsonb, main_prompt_chat_files),
          main_prompt_chat_conversations = COALESCE(${settingsData.main_prompt_chat_conversations ? JSON.stringify(settingsData.main_prompt_chat_conversations) : null}::jsonb, main_prompt_chat_conversations),
          main_prompt_chat_model = COALESCE(${settingsData.main_prompt_chat_model}, main_prompt_chat_model),
          chat_cross_references = COALESCE(${settingsData.chat_cross_references ? JSON.stringify(settingsData.chat_cross_references) : null}::jsonb, chat_cross_references),
          unified_chat_history = COALESCE(${settingsData.unified_chat_history ? JSON.stringify(settingsData.unified_chat_history) : null}::jsonb, unified_chat_history),
          unified_chat_conversations = COALESCE(${settingsData.unified_chat_conversations ? JSON.stringify(settingsData.unified_chat_conversations) : null}::jsonb, unified_chat_conversations),
          unified_chat_files = COALESCE(${settingsData.unified_chat_files ? JSON.stringify(settingsData.unified_chat_files) : null}::jsonb, unified_chat_files),
          chat_scope_selections = COALESCE(${settingsData.chat_scope_selections ? JSON.stringify(settingsData.chat_scope_selections) : null}::jsonb, chat_scope_selections),
          integration_mode = COALESCE(${settingsData.integration_mode}, integration_mode),
          fallback_to_live = COALESCE(${settingsData.fallback_to_live}, fallback_to_live),
          image_order = COALESCE(${settingsData.image_order ? JSON.stringify(settingsData.image_order) : null}::jsonb, image_order),
          variation_order_mode = COALESCE(${settingsData.variation_order_mode}, variation_order_mode),
          manual_variation_order = COALESCE(${settingsData.manual_variation_order ? JSON.stringify(settingsData.manual_variation_order) : null}::jsonb, manual_variation_order),
          live_prompt_mode = COALESCE(${settingsData.live_prompt_mode}, live_prompt_mode),
          smart_prompt_guidance = COALESCE(${settingsData.smart_prompt_guidance}, smart_prompt_guidance),
          guided_guardrails = COALESCE(${settingsData.guided_guardrails ? JSON.stringify(settingsData.guided_guardrails) : null}::jsonb, guided_guardrails),
          prompt_problem_areas = COALESCE(${settingsData.prompt_problem_areas ? JSON.stringify(settingsData.prompt_problem_areas) : null}::jsonb, prompt_problem_areas),
          guided_gpt_prompts = COALESCE(${settingsData.guided_gpt_prompts ? JSON.stringify(settingsData.guided_gpt_prompts) : null}::jsonb, guided_gpt_prompts),
          smart_prompt_prompts = COALESCE(${settingsData.smart_prompt_prompts ? JSON.stringify(settingsData.smart_prompt_prompts) : null}::jsonb, smart_prompt_prompts),
          guided_gpt_rules = COALESCE(${settingsData.guided_gpt_rules ? JSON.stringify(settingsData.guided_gpt_rules) : null}::jsonb, guided_gpt_rules),
          legacy_prompt_rules = COALESCE(${settingsData.legacy_prompt_rules ? JSON.stringify(settingsData.legacy_prompt_rules) : null}::jsonb, legacy_prompt_rules),
          testing_slots = COALESCE(${settingsData.testing_slots ? JSON.stringify(settingsData.testing_slots) : null}::jsonb, testing_slots),
          active_testing_slot = COALESCE(${settingsData.active_testing_slot ?? null}, active_testing_slot),
          updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ${websiteId}
      `;
      console.log('[Image Creation API] Updated website settings record');
    }

    res.json({ success: true, isWebsiteLevel: true });

  } catch (error) {
    console.error('[Image Creation API] Save website settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/image-creation/settings/migrate-to-website/:workflowId
 * Migrate existing workflow-level settings to website-level
 */
router.post('/settings/migrate-to-website/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { websiteId } = req.body;

    if (!websiteId) {
      return res.status(400).json({ error: 'websiteId required' });
    }

    console.log(`[Image Creation API] Migrating workflow ${workflowId} settings to website ${websiteId}`);

    // Get existing workflow settings
    const workflowSettings = await sql`
      SELECT * FROM image_creation_settings WHERE workflow_id = ${workflowId}
    `;

    if (workflowSettings.length === 0) {
      return res.status(404).json({ error: 'No workflow settings to migrate' });
    }

    // Check if website already has settings
    const existingWebsite = await sql`
      SELECT id FROM image_creation_settings WHERE website_id = ${websiteId}
    `;

    if (existingWebsite.length > 0) {
      return res.json({ success: true, message: 'Website already has settings, skipping migration' });
    }

    // Copy to website level
    const settings = workflowSettings[0];
    await sql`
      INSERT INTO image_creation_settings (
        website_id, enabled, prompt_assistant_model, image_generation_model, image_quality,
        reference_images, logo_images, audience_avatars, image_bank, image_categories,
        auto_tag_enabled, chat_history, consultant_chat_history, consultant_model,
        worker_chat_history, worker_model, integration_mode, fallback_to_live,
        image_order, variation_order_mode, manual_variation_order, live_prompt_mode,
        fallback_prompt_mode, smart_prompt_guidance, guided_guardrails, prompt_problem_areas
      )
      SELECT
        ${websiteId}, enabled, prompt_assistant_model, image_generation_model, image_quality,
        reference_images, logo_images, audience_avatars, image_bank, image_categories,
        auto_tag_enabled, chat_history, consultant_chat_history, consultant_model,
        worker_chat_history, worker_model, integration_mode, fallback_to_live,
        image_order, variation_order_mode, manual_variation_order, live_prompt_mode,
        fallback_prompt_mode, smart_prompt_guidance, guided_guardrails, prompt_problem_areas
      FROM image_creation_settings WHERE workflow_id = ${workflowId}
    `;

    console.log('[Image Creation API] Migration complete');
    res.json({ success: true, message: 'Settings migrated to website level' });

  } catch (error) {
    console.error('[Image Creation API] Migration error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/image-creation/settings/:workflowId
 * Get image creation settings for a workflow
 *
 * PRIORITY: Website settings > Workflow settings
 * If workflow has a linked website AND that website has settings, use website settings.
 * Otherwise fall back to workflow-specific settings.
 * This allows multiple workflows under one website to share image settings.
 */
router.get('/settings/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;
    console.log('[Image Creation API] GET settings for workflow:', workflowId);

    // Step 1: Look up the workflow's associated website_id
    let websiteId = null;
    try {
      const workflowResult = await sql`
        SELECT website_id FROM workflows WHERE id = ${workflowId}
      `;
      if (workflowResult.length > 0 && workflowResult[0].website_id) {
        websiteId = workflowResult[0].website_id;
        console.log('[Image Creation API] Workflow linked to website:', websiteId);
      }
    } catch (err) {
      console.log('[Image Creation API] Could not lookup website:', err.message);
    }

    // Step 2: Check for website-level settings FIRST (preferred)
    let results = [];
    let usingWebsiteSettings = false;

    if (websiteId) {
      const websiteResults = await sql`
        SELECT * FROM image_creation_settings
        WHERE website_id = ${websiteId}
      `;
      if (websiteResults.length > 0) {
        results = websiteResults;
        usingWebsiteSettings = true;
        console.log('[Image Creation API] ✓ Using WEBSITE-level settings (shared across workflows)');
      } else {
        console.log('[Image Creation API] No website-level settings, checking workflow...');
      }
    }

    // Step 3: Fall back to workflow-specific settings
    if (results.length === 0) {
      results = await sql`
        SELECT * FROM image_creation_settings
        WHERE workflow_id = ${workflowId}
      `;
      if (results.length > 0) {
        console.log('[Image Creation API] Using workflow-specific settings');
      }
    }

    console.log('[Image Creation API] Found records:', results.length, usingWebsiteSettings ? '(website-level)' : '(workflow-level)');

    if (results.length === 0) {
      console.log('[Image Creation API] No settings found, returning defaults');
      // Return default settings
      return res.json({
        success: true,
        settings: {
          enabled: false,
          prompt_assistant_model: 'gpt-4o',
          image_generation_model: 'flux-1.1-pro',
          reference_images: [],
          logo_images: [],
          audience_avatars: [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }],
          image_bank: [],
          // Image categories and auto-tag
          image_categories: ['Hero', 'Service', 'Team', 'Equipment', 'Before/After', 'Other'],
          auto_tag_enabled: true,
          chat_history: [],
          // Dual chat system defaults
          consultant_chat_history: [],
          consultant_model: 'gpt-4o',
          worker_chat_history: [],
          worker_model: 'gpt-4o-mini',
          integration_mode: 'bank',
          fallback_to_live: true,
          image_order: [],
          variation_order_mode: 'sequential',
          manual_variation_order: [],
          // Smart Content Matching defaults
          smart_matching_enabled: false,
          smart_matching_mode: 'bank_first',
          // Algorithm rules (editable)
          placement_rule: 'Place image at last paragraph break under {300} words since previous image. Hero image on {right/left/alt}.',
          smart_matching_rule: 'Look {50-75} words around image placement for keyword matches. Match against: {placeholder_categories}.',
          match_plurals: true, // Default ON - auto-match counter/counters
          // Editable Smart Matching Rules (the 4 core rules)
          matching_rule_1: 'Always try to match Primary Keywords first. Search for primary keywords within the word range around image placement.',
          matching_rule_2: 'If no primary match, fall back to Secondary Keywords. Only if secondary keywords are enabled for that option.',
          matching_rule_3: 'Never use the same Primary Keyword twice on a page. Each primary keyword can only appear once per article (no duplicate stove images).',
          matching_rule_4: 'Secondary keyword matches must have different primaries. If "kitchen" matches twice, each must be a different primary (stove, then sink).',
          // Smart Matching Config (configurable parameters that code ACTUALLY reads)
          smart_matching_config: { wordRange: 75, primaryWeight: 10, secondaryWeight: 1 },
          // Image quality default
          image_quality: 'low',
          // Generate Live prompt mode
          live_prompt_mode: 'main_prompt',
          fallback_prompt_mode: 'main_prompt',
          smart_prompt_guidance: '',
          // Prompt Problem Areas
          prompt_problem_areas: [],
          // Templates and Text Bank
          prompt_templates: [],
          text_snippets: [],
          category_templates: [],
          // Guided GPT guardrails
          guided_guardrails: {},
          // Chat Files and Conversations
          consultant_chat_files: [],
          consultant_chat_conversations: [],
          // Unified Chat System
          unified_chat_history: [],
          unified_chat_conversations: [],
          unified_chat_files: [],
          chat_scope_selections: [],
          // Testing Slots System
          testing_slots: [],
          active_testing_slot: null,
          // Calibration System
          calibration_entries: [],
          calibration_version: 0
        },
        isNew: true
      });
    }

    // AUTO-MIGRATION: Check if image_bank is too large and migrate to separate table
    let imageBankData = results[0].image_bank || [];
    let imageBankMigrated = false;
    const imageBankSize = JSON.stringify(imageBankData).length;
    const IMAGE_BANK_THRESHOLD = 1 * 1024 * 1024; // 1MB threshold - be aggressive to prevent crashes

    if (imageBankSize > IMAGE_BANK_THRESHOLD || (Array.isArray(imageBankData) && imageBankData.length > 20)) {
      console.log(`[Image Creation API] Large image_bank detected (${(imageBankSize / 1024 / 1024).toFixed(1)}MB, ${imageBankData.length} images). Auto-migrating...`);

      try {
        // Import migration function dynamically
        const { migrateImageBankFromSettings } = await import('../services/image-bank.js');
        const migrationResult = await migrateImageBankFromSettings(parseInt(workflowId));
        console.log('[Image Creation API] Migration result:', migrationResult);
        imageBankMigrated = true;

        // Clear the image_bank - it's now in the separate table
        imageBankData = [];
      } catch (migrationError) {
        console.error('[Image Creation API] Auto-migration failed:', migrationError);
        // Still return empty to prevent browser crash, images are safe in original DB column
        imageBankData = [];
        imageBankMigrated = true; // Tell frontend to use new API anyway
      }
    }

    res.json({
      success: true,
      settings: {
        id: results[0].id,
        enabled: results[0].enabled,
        prompt_assistant_model: results[0].prompt_assistant_model,
        image_generation_model: results[0].image_generation_model || 'flux-1.1-pro',
        reference_images: results[0].reference_images || [],
        logo_images: results[0].logo_images || [],
        audience_avatars: results[0].audience_avatars || [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }],
        image_bank: imageBankData,
        // Image categories and auto-tag
        image_categories: results[0].image_categories || ['Hero', 'Service', 'Team', 'Equipment', 'Before/After', 'Other'],
        auto_tag_enabled: results[0].auto_tag_enabled ?? true,
        chat_history: results[0].chat_history || [],
        // Dual chat system
        consultant_chat_history: results[0].consultant_chat_history || [],
        consultant_model: results[0].consultant_model || 'gpt-4o',
        worker_chat_history: results[0].worker_chat_history || [],
        worker_model: results[0].worker_model || 'gpt-4o-mini',
        integration_mode: results[0].integration_mode,
        fallback_to_live: results[0].fallback_to_live,
        image_order: results[0].image_order || [],
        variation_order_mode: results[0].variation_order_mode || 'sequential',
        manual_variation_order: results[0].manual_variation_order || [],
        // Smart Content Matching
        smart_matching_enabled: results[0].smart_matching_enabled ?? false,
        smart_matching_mode: results[0].smart_matching_mode || 'bank_first',
        // Algorithm rules (editable)
        placement_rule: results[0].placement_rule || 'Place image at last paragraph break under {300} words since previous image. Hero image on {right/left/alt}.',
        smart_matching_rule: results[0].smart_matching_rule || 'Look {50-75} words around image placement for keyword matches. Match against: {placeholder_categories}.',
        match_plurals: results[0].match_plurals !== false, // Default ON
        // Editable Smart Matching Rules (the 4 core rules)
        matching_rule_1: results[0].matching_rule_1 || 'Always try to match Primary Keywords first. Search for primary keywords within the word range around image placement.',
        matching_rule_2: results[0].matching_rule_2 || 'If no primary match, fall back to Secondary Keywords. Only if secondary keywords are enabled for that option.',
        matching_rule_3: results[0].matching_rule_3 || 'Never use the same Primary Keyword twice on a page. Each primary keyword can only appear once per article (no duplicate stove images).',
        matching_rule_4: results[0].matching_rule_4 || 'Secondary keyword matches must have different primaries. If "kitchen" matches twice, each must be a different primary (stove, then sink).',
        // Smart Matching Config (configurable parameters that code ACTUALLY reads)
        smart_matching_config: results[0].smart_matching_config || { wordRange: 75, primaryWeight: 10, secondaryWeight: 1 },
        // Image quality
        image_quality: results[0].image_quality || 'low',
        // Generate Live prompt mode
        live_prompt_mode: results[0].live_prompt_mode || 'main_prompt',
        fallback_prompt_mode: results[0].fallback_prompt_mode || 'main_prompt',
        smart_prompt_guidance: results[0].smart_prompt_guidance || '',
        // Prompt Problem Areas
        prompt_problem_areas: results[0].prompt_problem_areas || [],
        // Templates and Text Bank (CRITICAL for persistence)
        prompt_templates: results[0].prompt_templates || [],
        text_snippets: results[0].text_snippets || [],
        category_templates: results[0].category_templates || [],
        // Guided GPT guardrails
        guided_guardrails: results[0].guided_guardrails || {},
        // Chat Files and Conversations
        consultant_chat_files: results[0].consultant_chat_files || [],
        consultant_chat_conversations: results[0].consultant_chat_conversations || [],
        // Unified Chat System
        unified_chat_history: results[0].unified_chat_history || [],
        unified_chat_conversations: results[0].unified_chat_conversations || [],
        unified_chat_files: results[0].unified_chat_files || [],
        chat_scope_selections: results[0].chat_scope_selections || [],
        // Testing Slots System
        testing_slots: results[0].testing_slots || [],
        active_testing_slot: results[0].active_testing_slot || null,
        // Calibration System (may not exist if migration 035 hasn't run)
        calibration_entries: results[0].calibration_entries || [],
        calibration_version: results[0].calibration_version || 0
      },
      imageBankMigrated  // Tell frontend to use new /api/image-bank API
    });

    // DEBUG: Log template data being returned (after response)
    console.log('[Image Creation API] GET returning TEMPLATE DATA:', {
      prompt_templates_count: results[0].prompt_templates?.length ?? 'null/undefined in DB',
      text_snippets_count: results[0].text_snippets?.length ?? 'null/undefined in DB',
      category_templates_count: results[0].category_templates?.length ?? 'null/undefined in DB'
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/image-creation/settings/:workflowId
 * Save/update image creation settings for a workflow
 *
 * PRIORITY: Website settings > Workflow settings
 * If workflow has a linked website, save to website-level (shared across workflows).
 * Otherwise save to workflow-level.
 */
router.put('/settings/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;
    console.log('[Image Creation API] ======= PUT /settings/:workflowId =======');
    console.log('[Image Creation API] workflowId:', workflowId);
    console.log('[Image Creation API] REQUEST BODY KEYS:', Object.keys(req.body));
    console.log('[Image Creation API] Received avatars:', req.body.audience_avatars?.length || 0);

    // Step 1: Look up the workflow's associated website_id
    let websiteId = null;
    try {
      const workflowResult = await sql`
        SELECT website_id FROM workflows WHERE id = ${workflowId}
      `;
      if (workflowResult.length > 0 && workflowResult[0].website_id) {
        websiteId = workflowResult[0].website_id;
        console.log('[Image Creation API] Workflow linked to website:', websiteId, '- will save to website-level');
      }
    } catch (err) {
      console.log('[Image Creation API] Could not lookup website:', err.message);
    }
    const {
      enabled,
      prompt_assistant_model,
      image_generation_model,
      image_quality, // low, medium, high - low is best for websites
      reference_images,
      logo_images,
      audience_avatars,
      image_bank,
      // Image categories and auto-tag
      image_categories,
      auto_tag_enabled,
      chat_history,
      // Dual chat system
      consultant_chat_history,
      consultant_model,
      worker_chat_history,
      worker_model,
      integration_mode,
      fallback_to_live,
      image_order,
      variation_order_mode,
      manual_variation_order,
      // Smart Content Matching (may not exist in DB yet)
      smart_matching_enabled,
      smart_matching_mode,
      // Algorithm rules (editable)
      placement_rule,
      smart_matching_rule,
      match_plurals,
      // Editable Smart Matching Rules (the 4 core rules)
      matching_rule_1,
      matching_rule_2,
      matching_rule_3,
      matching_rule_4,
      // Smart Matching Config (configurable parameters that code ACTUALLY reads)
      smart_matching_config,
      // Generate Live prompt mode
      live_prompt_mode,
      fallback_prompt_mode,
      smart_prompt_guidance,
      // Guided GPT guardrails (instructions, uniformDescription, defaultSubject, avoidList)
      guided_guardrails,
      // Prompt Problem Areas
      prompt_problem_areas,
      // Templates and Text Bank (CRITICAL for persistence)
      prompt_templates,
      text_snippets,
      category_templates,
      // Chat Files and Conversations (for organized chat sessions)
      consultant_chat_files,
      consultant_chat_conversations,
      // Unified Chat System
      unified_chat_history,
      unified_chat_conversations,
      unified_chat_files,
      chat_scope_selections,
      // Guided GPT and Smart Prompt prompts/rules (for Generate Live persistence)
      guided_gpt_prompts,
      smart_prompt_prompts,
      guided_gpt_rules,
      legacy_prompt_rules,
      // Persistent prompt portions (shared across all tags)
      main_prompt_persistent,
      guided_instructions_persistent,
      smart_prompt_persistent,
      // Testing Slots System (Phase 3)
      testing_slots,
      active_testing_slot,
      // Calibration System (Cal-1)
      calibration_entries,
      calibration_version
    } = req.body;

    // DEBUG: Log what Test Mode is sending
    console.log('[Image Creation API] PUT received:', {
      integration_mode,
      live_prompt_mode,
      smart_matching_mode,
      fallback_prompt_mode
    });
    // DEBUG: Log template data for persistence debugging
    console.log('[Image Creation API] TEMPLATE DATA received:', {
      prompt_templates_count: prompt_templates?.length ?? 'undefined',
      prompt_templates_first: prompt_templates?.[0]?.name ?? 'none',
      text_snippets_count: text_snippets?.length ?? 'undefined',
      category_templates_count: category_templates?.length ?? 'undefined'
    });
    console.log('[Image Creation API] TYPE CHECK:', {
      live_prompt_mode_type: typeof live_prompt_mode,
      live_prompt_mode_value: JSON.stringify(live_prompt_mode),
      is_undefined: live_prompt_mode === undefined,
      is_null: live_prompt_mode === null
    });

    // Check if settings exist - prefer website-level, fall back to workflow-level
    let existing = [];
    let saveToWebsite = false;
    let websiteColumnExists = true;

    if (websiteId) {
      // Check for website-level settings first (with fallback if column doesn't exist)
      try {
        existing = await sql`
          SELECT id FROM image_creation_settings WHERE website_id = ${websiteId}
        `;
        if (existing.length > 0) {
          saveToWebsite = true;
          console.log('[Image Creation API] Found existing WEBSITE-level settings:', existing[0].id);
        } else {
          // No website settings exist - will create new website-level settings
          saveToWebsite = true;
          console.log('[Image Creation API] No website settings - will create website-level settings');
        }
      } catch (websiteErr) {
        // website_id column might not exist - fall back to workflow-level
        if (websiteErr.message?.includes('website_id') || websiteErr.message?.includes('column')) {
          console.log('[Image Creation API] website_id column not available, using workflow-level settings');
          websiteColumnExists = false;
          saveToWebsite = false;
        } else {
          throw websiteErr;
        }
      }
    }

    // If no website or website column doesn't exist, check workflow-level
    if (!saveToWebsite) {
      existing = await sql`
        SELECT id FROM image_creation_settings WHERE workflow_id = ${workflowId}
      `;
      console.log('[Image Creation API] Checking workflow-level settings');
    }

    console.log('[Image Creation API] Existing record:', existing.length > 0 ? existing[0].id : 'none', saveToWebsite ? '(website-level)' : '(workflow-level)');
    console.log('[Image Creation API] DEBUG: websiteId=', websiteId, 'workflowId=', workflowId, 'saveToWebsite=', saveToWebsite, 'existing.length=', existing.length, 'websiteColumnExists=', websiteColumnExists);

    // If website column doesn't exist, force workflow-level
    if (!websiteColumnExists) {
      saveToWebsite = false;
    }

    // 🛡️ SERVER-SIDE PROTECTION: Prevent accidental erasure of audience_avatars content
    let protectedAvatars = audience_avatars;
    if (audience_avatars && existing.length > 0) {
      try {
        // Fetch current settings to compare
        const currentSettings = saveToWebsite
          ? await sql`SELECT audience_avatars FROM image_creation_settings WHERE website_id = ${websiteId}`
          : await sql`SELECT audience_avatars FROM image_creation_settings WHERE workflow_id = ${workflowId}`;

        if (currentSettings.length > 0 && currentSettings[0].audience_avatars) {
          const currentAvatars = currentSettings[0].audience_avatars;
          protectedAvatars = audience_avatars.map(newAvatar => {
            const currentAvatar = currentAvatars.find(a => a.id === newAvatar.id);
            if (!currentAvatar) return newAvatar;

            // Protect mainPrompt from erasure
            const currentPromptLen = currentAvatar.mainPrompt?.length || 0;
            const newPromptLen = newAvatar.mainPrompt?.length || 0;
            if (currentPromptLen > 200 && newPromptLen < 100) {
              console.error(`🛡️ SERVER PROTECTION: Preserving mainPrompt for "${newAvatar.name}" (${currentPromptLen} chars -> ${newPromptLen} chars BLOCKED)`);
              newAvatar = { ...newAvatar, mainPrompt: currentAvatar.mainPrompt };
            }

            // Protect placeholderCategories from erasure
            const currentCatCount = currentAvatar.placeholderCategories?.length || 0;
            const newCatCount = newAvatar.placeholderCategories?.length || 0;
            if (currentCatCount > 0 && newCatCount === 0) {
              console.error(`🛡️ SERVER PROTECTION: Preserving ${currentCatCount} placeholderCategories for "${newAvatar.name}"`);
              newAvatar = { ...newAvatar, placeholderCategories: currentAvatar.placeholderCategories };
            }

            // Protect variations from erasure
            const currentVarCount = currentAvatar.variations?.length || 0;
            const newVarCount = newAvatar.variations?.length || 0;
            if (currentVarCount > 0 && newVarCount === 0) {
              console.error(`🛡️ SERVER PROTECTION: Preserving ${currentVarCount} variations for "${newAvatar.name}"`);
              newAvatar = { ...newAvatar, variations: currentAvatar.variations };
            }

            return newAvatar;
          });
          console.log('[Image Creation API] 🛡️ Protection check completed');
        }
      } catch (protectionErr) {
        console.error('[Image Creation API] Protection check failed (continuing with original data):', protectionErr.message);
      }
    }

    // Helper function to save core settings
    // Uses fallback logic if newer columns (live_prompt_mode, etc.) don't exist in the database
    // IMPORTANT: Uses website_id when saveToWebsite is true, workflow_id otherwise
    const saveCoreSettings = async (isInsert) => {
      // Determine which ID column/value to use
      const idColumn = saveToWebsite ? 'website_id' : 'workflow_id';
      const idValue = saveToWebsite ? websiteId : workflowId;
      console.log(`[Image Creation API] Saving to ${idColumn}:`, idValue);

      if (isInsert) {
        // Try INSERT with all columns first, fallback to basic columns if newer ones don't exist
        try {
          // Dynamic INSERT based on website vs workflow
          const result = saveToWebsite
            ? await sql`
              INSERT INTO image_creation_settings (
                website_id,
                enabled,
                prompt_assistant_model,
                image_generation_model,
                image_quality,
                reference_images,
                logo_images,
                audience_avatars,
                image_bank,
                image_categories,
                auto_tag_enabled,
                chat_history,
                consultant_chat_history,
                consultant_model,
                worker_chat_history,
                worker_model,
                integration_mode,
                fallback_to_live,
                image_order,
                variation_order_mode,
                manual_variation_order,
                live_prompt_mode,
                fallback_prompt_mode,
                smart_prompt_guidance,
                guided_guardrails,
                prompt_problem_areas,
                prompt_templates,
                text_snippets,
                category_templates,
                consultant_chat_files,
                consultant_chat_conversations,
                guided_gpt_prompts,
                smart_prompt_prompts,
                guided_gpt_rules,
                legacy_prompt_rules,
                main_prompt_persistent,
                guided_instructions_persistent,
                smart_prompt_persistent
              ) VALUES (
                ${websiteId},
                ${enabled ?? false},
                ${prompt_assistant_model ?? 'gpt-4o'},
                ${image_generation_model ?? 'flux-1.1-pro'},
                ${image_quality ?? 'low'},
                ${JSON.stringify(reference_images ?? [])},
                ${JSON.stringify(logo_images ?? [])},
                ${JSON.stringify(protectedAvatars ?? [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }])},
                ${JSON.stringify(image_bank ?? [])},
                ${JSON.stringify(image_categories ?? ['Hero', 'Service', 'Team', 'Equipment', 'Before/After', 'Other'])},
                ${auto_tag_enabled ?? true},
                ${JSON.stringify(chat_history ?? [])},
                ${JSON.stringify(consultant_chat_history ?? [])},
                ${consultant_model ?? 'gpt-4o'},
                ${JSON.stringify(worker_chat_history ?? [])},
                ${worker_model ?? 'gpt-4o-mini'},
                ${integration_mode ?? 'bank'},
                ${fallback_to_live ?? true},
                ${JSON.stringify(image_order ?? [])},
                ${variation_order_mode ?? 'sequential'},
                ${JSON.stringify(manual_variation_order ?? [])},
                ${live_prompt_mode ?? 'main_prompt'},
                ${fallback_prompt_mode ?? 'main_prompt'},
                ${smart_prompt_guidance ?? ''},
                ${JSON.stringify(guided_guardrails ?? {})},
                ${JSON.stringify(prompt_problem_areas ?? [])},
                ${JSON.stringify(prompt_templates ?? [])},
                ${JSON.stringify(text_snippets ?? [])},
                ${JSON.stringify(category_templates ?? [])},
                ${JSON.stringify(consultant_chat_files ?? [])},
                ${JSON.stringify(consultant_chat_conversations ?? [])},
                ${JSON.stringify(guided_gpt_prompts ?? [])},
                ${JSON.stringify(smart_prompt_prompts ?? [])},
                ${JSON.stringify(guided_gpt_rules ?? [])},
                ${JSON.stringify(legacy_prompt_rules ?? [])},
                ${main_prompt_persistent ?? ''},
                ${guided_instructions_persistent ?? ''},
                ${smart_prompt_persistent ?? ''}
              )
              RETURNING id
            `
            : await sql`
              INSERT INTO image_creation_settings (
                workflow_id,
                enabled,
                prompt_assistant_model,
                image_generation_model,
                image_quality,
                reference_images,
                logo_images,
                audience_avatars,
                image_bank,
                image_categories,
                auto_tag_enabled,
                chat_history,
                consultant_chat_history,
                consultant_model,
                worker_chat_history,
                worker_model,
                integration_mode,
                fallback_to_live,
                image_order,
                variation_order_mode,
                manual_variation_order,
                live_prompt_mode,
                fallback_prompt_mode,
                smart_prompt_guidance,
                guided_guardrails,
                prompt_problem_areas,
                prompt_templates,
                text_snippets,
                category_templates,
                consultant_chat_files,
                consultant_chat_conversations,
                guided_gpt_prompts,
                smart_prompt_prompts,
                guided_gpt_rules,
                legacy_prompt_rules,
                main_prompt_persistent,
                guided_instructions_persistent,
                smart_prompt_persistent
              ) VALUES (
                ${workflowId},
              ${enabled ?? false},
              ${prompt_assistant_model ?? 'gpt-4o'},
              ${image_generation_model ?? 'flux-1.1-pro'},
              ${image_quality ?? 'low'},
              ${JSON.stringify(reference_images ?? [])},
              ${JSON.stringify(logo_images ?? [])},
              ${JSON.stringify(protectedAvatars ?? [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }])},
              ${JSON.stringify(image_bank ?? [])},
              ${JSON.stringify(image_categories ?? ['Hero', 'Service', 'Team', 'Equipment', 'Before/After', 'Other'])},
              ${auto_tag_enabled ?? true},
              ${JSON.stringify(chat_history ?? [])},
              ${JSON.stringify(consultant_chat_history ?? [])},
              ${consultant_model ?? 'gpt-4o'},
              ${JSON.stringify(worker_chat_history ?? [])},
              ${worker_model ?? 'gpt-4o-mini'},
              ${integration_mode ?? 'bank'},
              ${fallback_to_live ?? true},
              ${JSON.stringify(image_order ?? [])},
              ${variation_order_mode ?? 'sequential'},
              ${JSON.stringify(manual_variation_order ?? [])},
              ${live_prompt_mode ?? 'main_prompt'},
              ${fallback_prompt_mode ?? 'main_prompt'},
              ${smart_prompt_guidance ?? ''},
              ${JSON.stringify(guided_guardrails ?? {})},
              ${JSON.stringify(prompt_problem_areas ?? [])},
              ${JSON.stringify(prompt_templates ?? [])},
              ${JSON.stringify(text_snippets ?? [])},
              ${JSON.stringify(category_templates ?? [])},
              ${JSON.stringify(consultant_chat_files ?? [])},
              ${JSON.stringify(consultant_chat_conversations ?? [])},
              ${JSON.stringify(guided_gpt_prompts ?? [])},
              ${JSON.stringify(smart_prompt_prompts ?? [])},
              ${JSON.stringify(guided_gpt_rules ?? [])},
              ${JSON.stringify(legacy_prompt_rules ?? [])},
              ${main_prompt_persistent ?? ''},
              ${guided_instructions_persistent ?? ''},
              ${smart_prompt_persistent ?? ''}
            )
            RETURNING id
          `;
          return result[0].id;
        } catch (insertErr) {
          // If it failed due to missing column, try without live_prompt_mode columns
          if (insertErr.message?.includes('live_prompt_mode') || insertErr.message?.includes('smart_prompt_guidance') || insertErr.message?.includes('guided_guardrails') || insertErr.message?.includes('prompt_problem_areas') || insertErr.message?.includes('fallback_prompt_mode') || insertErr.message?.includes('main_prompt_persistent') || insertErr.message?.includes('guided_instructions_persistent') || insertErr.message?.includes('smart_prompt_persistent')) {
            console.log('[Image Creation API] Falling back to INSERT without live_prompt columns');
            // Use website_id or workflow_id based on saveToWebsite flag
            const result = saveToWebsite
              ? await sql`
                INSERT INTO image_creation_settings (
                  website_id,
                  enabled,
                  prompt_assistant_model,
                  image_generation_model,
                  image_quality,
                  reference_images,
                  logo_images,
                  audience_avatars,
                  image_bank,
                  image_categories,
                  auto_tag_enabled,
                  chat_history,
                  consultant_chat_history,
                  consultant_model,
                  worker_chat_history,
                  worker_model,
                  integration_mode,
                  fallback_to_live,
                  image_order,
                  variation_order_mode,
                  manual_variation_order,
                  prompt_templates,
                  text_snippets,
                  category_templates,
                  consultant_chat_files,
                  consultant_chat_conversations,
                  unified_chat_history,
                  unified_chat_conversations,
                  unified_chat_files,
                  chat_scope_selections
                ) VALUES (
                  ${websiteId},
                  ${enabled ?? false},
                  ${prompt_assistant_model ?? 'gpt-4o'},
                  ${image_generation_model ?? 'flux-1.1-pro'},
                  ${image_quality ?? 'low'},
                  ${JSON.stringify(reference_images ?? [])},
                  ${JSON.stringify(logo_images ?? [])},
                  ${JSON.stringify(protectedAvatars ?? [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }])},
                  ${JSON.stringify(image_bank ?? [])},
                  ${JSON.stringify(image_categories ?? ['Hero', 'Service', 'Team', 'Equipment', 'Before/After', 'Other'])},
                  ${auto_tag_enabled ?? true},
                  ${JSON.stringify(chat_history ?? [])},
                  ${JSON.stringify(consultant_chat_history ?? [])},
                  ${consultant_model ?? 'gpt-4o'},
                  ${JSON.stringify(worker_chat_history ?? [])},
                  ${worker_model ?? 'gpt-4o-mini'},
                  ${integration_mode ?? 'bank'},
                  ${fallback_to_live ?? true},
                  ${JSON.stringify(image_order ?? [])},
                  ${variation_order_mode ?? 'sequential'},
                  ${JSON.stringify(manual_variation_order ?? [])},
                  ${JSON.stringify(prompt_templates ?? [])},
                  ${JSON.stringify(text_snippets ?? [])},
                  ${JSON.stringify(category_templates ?? [])},
                  ${JSON.stringify(consultant_chat_files ?? [])},
                  ${JSON.stringify(consultant_chat_conversations ?? [])},
                  ${JSON.stringify(unified_chat_history ?? [])},
                  ${JSON.stringify(unified_chat_conversations ?? [])},
                  ${JSON.stringify(unified_chat_files ?? [])},
                  ${JSON.stringify(chat_scope_selections ?? [])}
                )
                RETURNING id
              `
              : await sql`
                INSERT INTO image_creation_settings (
                  workflow_id,
                  enabled,
                  prompt_assistant_model,
                  image_generation_model,
                  image_quality,
                  reference_images,
                  logo_images,
                  audience_avatars,
                  image_bank,
                  image_categories,
                  auto_tag_enabled,
                  chat_history,
                  consultant_chat_history,
                  consultant_model,
                  worker_chat_history,
                  worker_model,
                  integration_mode,
                  fallback_to_live,
                  image_order,
                  variation_order_mode,
                  manual_variation_order,
                  prompt_templates,
                  text_snippets,
                  category_templates,
                  consultant_chat_files,
                  consultant_chat_conversations,
                  unified_chat_history,
                  unified_chat_conversations,
                  unified_chat_files,
                  chat_scope_selections
                ) VALUES (
                  ${workflowId},
                ${enabled ?? false},
                ${prompt_assistant_model ?? 'gpt-4o'},
                ${image_generation_model ?? 'flux-1.1-pro'},
                ${image_quality ?? 'low'},
                ${JSON.stringify(reference_images ?? [])},
                ${JSON.stringify(logo_images ?? [])},
                ${JSON.stringify(protectedAvatars ?? [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }])},
                ${JSON.stringify(image_bank ?? [])},
                ${JSON.stringify(image_categories ?? ['Hero', 'Service', 'Team', 'Equipment', 'Before/After', 'Other'])},
                ${auto_tag_enabled ?? true},
                ${JSON.stringify(chat_history ?? [])},
                ${JSON.stringify(consultant_chat_history ?? [])},
                ${consultant_model ?? 'gpt-4o'},
                ${JSON.stringify(worker_chat_history ?? [])},
                ${worker_model ?? 'gpt-4o-mini'},
                ${integration_mode ?? 'bank'},
                ${fallback_to_live ?? true},
                ${JSON.stringify(image_order ?? [])},
                ${variation_order_mode ?? 'sequential'},
                ${JSON.stringify(manual_variation_order ?? [])},
                ${JSON.stringify(prompt_templates ?? [])},
                ${JSON.stringify(text_snippets ?? [])},
                ${JSON.stringify(category_templates ?? [])},
                ${JSON.stringify(consultant_chat_files ?? [])},
                ${JSON.stringify(consultant_chat_conversations ?? [])},
                ${JSON.stringify(unified_chat_history ?? [])},
                ${JSON.stringify(unified_chat_conversations ?? [])},
                ${JSON.stringify(unified_chat_files ?? [])},
                ${JSON.stringify(chat_scope_selections ?? [])}
              )
              RETURNING id
            `;
            return result[0].id;
          }
          throw insertErr;
        }
      } else {
        // Try UPDATE with all columns first, fallback if columns don't exist
        try {
          // Use separate UPDATE statements based on saveToWebsite flag
          // (Cannot use ternary with sql tagged template literals)
          if (saveToWebsite) {
            const updateResult = await sql`
              UPDATE image_creation_settings
              SET
                enabled = COALESCE(${enabled}, enabled),
                prompt_assistant_model = COALESCE(${prompt_assistant_model}, prompt_assistant_model),
                image_generation_model = COALESCE(${image_generation_model}, image_generation_model),
                image_quality = COALESCE(${image_quality}, image_quality),
                reference_images = COALESCE(${reference_images ? JSON.stringify(reference_images) : null}::jsonb, reference_images),
                logo_images = COALESCE(${logo_images ? JSON.stringify(logo_images) : null}::jsonb, logo_images),
                audience_avatars = COALESCE(${protectedAvatars ? JSON.stringify(protectedAvatars) : null}::jsonb, audience_avatars),
                image_bank = ${image_bank ? JSON.stringify(image_bank) : '[]'}::jsonb,
                image_categories = COALESCE(${image_categories ? JSON.stringify(image_categories) : null}::jsonb, image_categories),
                auto_tag_enabled = COALESCE(${auto_tag_enabled}, auto_tag_enabled),
                chat_history = COALESCE(${chat_history ? JSON.stringify(chat_history) : null}::jsonb, chat_history),
                consultant_chat_history = COALESCE(${consultant_chat_history ? JSON.stringify(consultant_chat_history) : null}::jsonb, consultant_chat_history),
                consultant_model = COALESCE(${consultant_model}, consultant_model),
                worker_chat_history = COALESCE(${worker_chat_history ? JSON.stringify(worker_chat_history) : null}::jsonb, worker_chat_history),
                worker_model = COALESCE(${worker_model}, worker_model),
                integration_mode = COALESCE(${integration_mode}, integration_mode),
                fallback_to_live = COALESCE(${fallback_to_live}, fallback_to_live),
                image_order = COALESCE(${image_order ? JSON.stringify(image_order) : null}::jsonb, image_order),
                variation_order_mode = COALESCE(${variation_order_mode}, variation_order_mode),
                manual_variation_order = COALESCE(${manual_variation_order ? JSON.stringify(manual_variation_order) : null}::jsonb, manual_variation_order),
                live_prompt_mode = COALESCE(${live_prompt_mode}, live_prompt_mode),
                fallback_prompt_mode = COALESCE(${fallback_prompt_mode}, fallback_prompt_mode),
                smart_prompt_guidance = COALESCE(${smart_prompt_guidance}, smart_prompt_guidance),
                guided_guardrails = COALESCE(${guided_guardrails ? JSON.stringify(guided_guardrails) : null}::jsonb, guided_guardrails),
                prompt_problem_areas = COALESCE(${prompt_problem_areas ? JSON.stringify(prompt_problem_areas) : null}::jsonb, prompt_problem_areas),
                prompt_templates = COALESCE(${prompt_templates ? JSON.stringify(prompt_templates) : null}::jsonb, prompt_templates),
                text_snippets = COALESCE(${text_snippets ? JSON.stringify(text_snippets) : null}::jsonb, text_snippets),
                category_templates = COALESCE(${category_templates ? JSON.stringify(category_templates) : null}::jsonb, category_templates),
                consultant_chat_files = COALESCE(${consultant_chat_files ? JSON.stringify(consultant_chat_files) : null}::jsonb, consultant_chat_files),
                consultant_chat_conversations = COALESCE(${consultant_chat_conversations ? JSON.stringify(consultant_chat_conversations) : null}::jsonb, consultant_chat_conversations),
                unified_chat_history = COALESCE(${unified_chat_history ? JSON.stringify(unified_chat_history) : null}::jsonb, unified_chat_history),
                unified_chat_conversations = COALESCE(${unified_chat_conversations ? JSON.stringify(unified_chat_conversations) : null}::jsonb, unified_chat_conversations),
                unified_chat_files = COALESCE(${unified_chat_files ? JSON.stringify(unified_chat_files) : null}::jsonb, unified_chat_files),
                chat_scope_selections = COALESCE(${chat_scope_selections ? JSON.stringify(chat_scope_selections) : null}::jsonb, chat_scope_selections),
                guided_gpt_prompts = COALESCE(${guided_gpt_prompts ? JSON.stringify(guided_gpt_prompts) : null}::jsonb, guided_gpt_prompts),
                smart_prompt_prompts = COALESCE(${smart_prompt_prompts ? JSON.stringify(smart_prompt_prompts) : null}::jsonb, smart_prompt_prompts),
                guided_gpt_rules = COALESCE(${guided_gpt_rules ? JSON.stringify(guided_gpt_rules) : null}::jsonb, guided_gpt_rules),
                legacy_prompt_rules = COALESCE(${legacy_prompt_rules ? JSON.stringify(legacy_prompt_rules) : null}::jsonb, legacy_prompt_rules),
                main_prompt_persistent = COALESCE(${main_prompt_persistent ?? null}, main_prompt_persistent),
                guided_instructions_persistent = COALESCE(${guided_instructions_persistent ?? null}, guided_instructions_persistent),
                smart_prompt_persistent = COALESCE(${smart_prompt_persistent ?? null}, smart_prompt_persistent),
                updated_at = CURRENT_TIMESTAMP
              WHERE website_id = ${websiteId}
              RETURNING id, integration_mode, live_prompt_mode, smart_matching_mode
            `;
            console.log('[Image Creation API] UPDATE WEBSITE result:', updateResult[0]);
          } else {
            const updateResult = await sql`
              UPDATE image_creation_settings
              SET
                enabled = COALESCE(${enabled}, enabled),
                prompt_assistant_model = COALESCE(${prompt_assistant_model}, prompt_assistant_model),
                image_generation_model = COALESCE(${image_generation_model}, image_generation_model),
                image_quality = COALESCE(${image_quality}, image_quality),
                reference_images = COALESCE(${reference_images ? JSON.stringify(reference_images) : null}::jsonb, reference_images),
                logo_images = COALESCE(${logo_images ? JSON.stringify(logo_images) : null}::jsonb, logo_images),
                audience_avatars = COALESCE(${protectedAvatars ? JSON.stringify(protectedAvatars) : null}::jsonb, audience_avatars),
                image_bank = ${image_bank ? JSON.stringify(image_bank) : '[]'}::jsonb,
                image_categories = COALESCE(${image_categories ? JSON.stringify(image_categories) : null}::jsonb, image_categories),
                auto_tag_enabled = COALESCE(${auto_tag_enabled}, auto_tag_enabled),
                chat_history = COALESCE(${chat_history ? JSON.stringify(chat_history) : null}::jsonb, chat_history),
                consultant_chat_history = COALESCE(${consultant_chat_history ? JSON.stringify(consultant_chat_history) : null}::jsonb, consultant_chat_history),
                consultant_model = COALESCE(${consultant_model}, consultant_model),
                worker_chat_history = COALESCE(${worker_chat_history ? JSON.stringify(worker_chat_history) : null}::jsonb, worker_chat_history),
                worker_model = COALESCE(${worker_model}, worker_model),
                integration_mode = COALESCE(${integration_mode}, integration_mode),
                fallback_to_live = COALESCE(${fallback_to_live}, fallback_to_live),
                image_order = COALESCE(${image_order ? JSON.stringify(image_order) : null}::jsonb, image_order),
                variation_order_mode = COALESCE(${variation_order_mode}, variation_order_mode),
                manual_variation_order = COALESCE(${manual_variation_order ? JSON.stringify(manual_variation_order) : null}::jsonb, manual_variation_order),
                live_prompt_mode = COALESCE(${live_prompt_mode}, live_prompt_mode),
                fallback_prompt_mode = COALESCE(${fallback_prompt_mode}, fallback_prompt_mode),
                smart_prompt_guidance = COALESCE(${smart_prompt_guidance}, smart_prompt_guidance),
                guided_guardrails = COALESCE(${guided_guardrails ? JSON.stringify(guided_guardrails) : null}::jsonb, guided_guardrails),
                prompt_problem_areas = COALESCE(${prompt_problem_areas ? JSON.stringify(prompt_problem_areas) : null}::jsonb, prompt_problem_areas),
                prompt_templates = COALESCE(${prompt_templates ? JSON.stringify(prompt_templates) : null}::jsonb, prompt_templates),
                text_snippets = COALESCE(${text_snippets ? JSON.stringify(text_snippets) : null}::jsonb, text_snippets),
                category_templates = COALESCE(${category_templates ? JSON.stringify(category_templates) : null}::jsonb, category_templates),
                consultant_chat_files = COALESCE(${consultant_chat_files ? JSON.stringify(consultant_chat_files) : null}::jsonb, consultant_chat_files),
                consultant_chat_conversations = COALESCE(${consultant_chat_conversations ? JSON.stringify(consultant_chat_conversations) : null}::jsonb, consultant_chat_conversations),
                unified_chat_history = COALESCE(${unified_chat_history ? JSON.stringify(unified_chat_history) : null}::jsonb, unified_chat_history),
                unified_chat_conversations = COALESCE(${unified_chat_conversations ? JSON.stringify(unified_chat_conversations) : null}::jsonb, unified_chat_conversations),
                unified_chat_files = COALESCE(${unified_chat_files ? JSON.stringify(unified_chat_files) : null}::jsonb, unified_chat_files),
                chat_scope_selections = COALESCE(${chat_scope_selections ? JSON.stringify(chat_scope_selections) : null}::jsonb, chat_scope_selections),
                guided_gpt_prompts = COALESCE(${guided_gpt_prompts ? JSON.stringify(guided_gpt_prompts) : null}::jsonb, guided_gpt_prompts),
                smart_prompt_prompts = COALESCE(${smart_prompt_prompts ? JSON.stringify(smart_prompt_prompts) : null}::jsonb, smart_prompt_prompts),
                guided_gpt_rules = COALESCE(${guided_gpt_rules ? JSON.stringify(guided_gpt_rules) : null}::jsonb, guided_gpt_rules),
                legacy_prompt_rules = COALESCE(${legacy_prompt_rules ? JSON.stringify(legacy_prompt_rules) : null}::jsonb, legacy_prompt_rules),
                main_prompt_persistent = COALESCE(${main_prompt_persistent ?? null}, main_prompt_persistent),
                guided_instructions_persistent = COALESCE(${guided_instructions_persistent ?? null}, guided_instructions_persistent),
                smart_prompt_persistent = COALESCE(${smart_prompt_persistent ?? null}, smart_prompt_persistent),
                updated_at = CURRENT_TIMESTAMP
              WHERE workflow_id = ${workflowId}
              RETURNING id, integration_mode, live_prompt_mode, smart_matching_mode
            `;
            console.log('[Image Creation API] UPDATE WORKFLOW result:', updateResult[0]);
          }
        } catch (updateErr) {
          // If it failed due to missing column, try without live_prompt_mode columns
          if (updateErr.message?.includes('live_prompt_mode') || updateErr.message?.includes('fallback_prompt_mode') || updateErr.message?.includes('smart_prompt_guidance') || updateErr.message?.includes('guided_guardrails') || updateErr.message?.includes('main_prompt_persistent') || updateErr.message?.includes('guided_instructions_persistent') || updateErr.message?.includes('smart_prompt_persistent')) {
            console.log('[Image Creation API] Falling back to UPDATE without live_prompt columns');
            // Use separate UPDATE statements based on saveToWebsite flag
            if (saveToWebsite) {
              await sql`
                UPDATE image_creation_settings
                SET
                  enabled = COALESCE(${enabled}, enabled),
                  prompt_assistant_model = COALESCE(${prompt_assistant_model}, prompt_assistant_model),
                  image_generation_model = COALESCE(${image_generation_model}, image_generation_model),
                  image_quality = COALESCE(${image_quality}, image_quality),
                  reference_images = COALESCE(${reference_images ? JSON.stringify(reference_images) : null}::jsonb, reference_images),
                  logo_images = COALESCE(${logo_images ? JSON.stringify(logo_images) : null}::jsonb, logo_images),
                  audience_avatars = COALESCE(${protectedAvatars ? JSON.stringify(protectedAvatars) : null}::jsonb, audience_avatars),
                  image_bank = ${image_bank ? JSON.stringify(image_bank) : '[]'}::jsonb,
                  image_categories = COALESCE(${image_categories ? JSON.stringify(image_categories) : null}::jsonb, image_categories),
                  auto_tag_enabled = COALESCE(${auto_tag_enabled}, auto_tag_enabled),
                  chat_history = COALESCE(${chat_history ? JSON.stringify(chat_history) : null}::jsonb, chat_history),
                  consultant_chat_history = COALESCE(${consultant_chat_history ? JSON.stringify(consultant_chat_history) : null}::jsonb, consultant_chat_history),
                  consultant_model = COALESCE(${consultant_model}, consultant_model),
                  worker_chat_history = COALESCE(${worker_chat_history ? JSON.stringify(worker_chat_history) : null}::jsonb, worker_chat_history),
                  worker_model = COALESCE(${worker_model}, worker_model),
                  integration_mode = COALESCE(${integration_mode}, integration_mode),
                  fallback_to_live = COALESCE(${fallback_to_live}, fallback_to_live),
                  image_order = COALESCE(${image_order ? JSON.stringify(image_order) : null}::jsonb, image_order),
                  variation_order_mode = COALESCE(${variation_order_mode}, variation_order_mode),
                  manual_variation_order = COALESCE(${manual_variation_order ? JSON.stringify(manual_variation_order) : null}::jsonb, manual_variation_order),
                  prompt_templates = COALESCE(${prompt_templates ? JSON.stringify(prompt_templates) : null}::jsonb, prompt_templates),
                  text_snippets = COALESCE(${text_snippets ? JSON.stringify(text_snippets) : null}::jsonb, text_snippets),
                  category_templates = COALESCE(${category_templates ? JSON.stringify(category_templates) : null}::jsonb, category_templates),
                  consultant_chat_files = COALESCE(${consultant_chat_files ? JSON.stringify(consultant_chat_files) : null}::jsonb, consultant_chat_files),
                  consultant_chat_conversations = COALESCE(${consultant_chat_conversations ? JSON.stringify(consultant_chat_conversations) : null}::jsonb, consultant_chat_conversations),
                  unified_chat_history = COALESCE(${unified_chat_history ? JSON.stringify(unified_chat_history) : null}::jsonb, unified_chat_history),
                  unified_chat_conversations = COALESCE(${unified_chat_conversations ? JSON.stringify(unified_chat_conversations) : null}::jsonb, unified_chat_conversations),
                  unified_chat_files = COALESCE(${unified_chat_files ? JSON.stringify(unified_chat_files) : null}::jsonb, unified_chat_files),
                  chat_scope_selections = COALESCE(${chat_scope_selections ? JSON.stringify(chat_scope_selections) : null}::jsonb, chat_scope_selections),
                  guided_gpt_prompts = COALESCE(${guided_gpt_prompts ? JSON.stringify(guided_gpt_prompts) : null}::jsonb, guided_gpt_prompts),
                  smart_prompt_prompts = COALESCE(${smart_prompt_prompts ? JSON.stringify(smart_prompt_prompts) : null}::jsonb, smart_prompt_prompts),
                  guided_gpt_rules = COALESCE(${guided_gpt_rules ? JSON.stringify(guided_gpt_rules) : null}::jsonb, guided_gpt_rules),
                  legacy_prompt_rules = COALESCE(${legacy_prompt_rules ? JSON.stringify(legacy_prompt_rules) : null}::jsonb, legacy_prompt_rules),
                  updated_at = CURRENT_TIMESTAMP
                WHERE website_id = ${websiteId}
              `;
            } else {
              await sql`
                UPDATE image_creation_settings
                SET
                  enabled = COALESCE(${enabled}, enabled),
                  prompt_assistant_model = COALESCE(${prompt_assistant_model}, prompt_assistant_model),
                  image_generation_model = COALESCE(${image_generation_model}, image_generation_model),
                  image_quality = COALESCE(${image_quality}, image_quality),
                  reference_images = COALESCE(${reference_images ? JSON.stringify(reference_images) : null}::jsonb, reference_images),
                  logo_images = COALESCE(${logo_images ? JSON.stringify(logo_images) : null}::jsonb, logo_images),
                  audience_avatars = COALESCE(${protectedAvatars ? JSON.stringify(protectedAvatars) : null}::jsonb, audience_avatars),
                  image_bank = ${image_bank ? JSON.stringify(image_bank) : '[]'}::jsonb,
                  image_categories = COALESCE(${image_categories ? JSON.stringify(image_categories) : null}::jsonb, image_categories),
                  auto_tag_enabled = COALESCE(${auto_tag_enabled}, auto_tag_enabled),
                  chat_history = COALESCE(${chat_history ? JSON.stringify(chat_history) : null}::jsonb, chat_history),
                  consultant_chat_history = COALESCE(${consultant_chat_history ? JSON.stringify(consultant_chat_history) : null}::jsonb, consultant_chat_history),
                  consultant_model = COALESCE(${consultant_model}, consultant_model),
                  worker_chat_history = COALESCE(${worker_chat_history ? JSON.stringify(worker_chat_history) : null}::jsonb, worker_chat_history),
                  worker_model = COALESCE(${worker_model}, worker_model),
                  integration_mode = COALESCE(${integration_mode}, integration_mode),
                  fallback_to_live = COALESCE(${fallback_to_live}, fallback_to_live),
                  image_order = COALESCE(${image_order ? JSON.stringify(image_order) : null}::jsonb, image_order),
                  variation_order_mode = COALESCE(${variation_order_mode}, variation_order_mode),
                  manual_variation_order = COALESCE(${manual_variation_order ? JSON.stringify(manual_variation_order) : null}::jsonb, manual_variation_order),
                  prompt_templates = COALESCE(${prompt_templates ? JSON.stringify(prompt_templates) : null}::jsonb, prompt_templates),
                  text_snippets = COALESCE(${text_snippets ? JSON.stringify(text_snippets) : null}::jsonb, text_snippets),
                  category_templates = COALESCE(${category_templates ? JSON.stringify(category_templates) : null}::jsonb, category_templates),
                  consultant_chat_files = COALESCE(${consultant_chat_files ? JSON.stringify(consultant_chat_files) : null}::jsonb, consultant_chat_files),
                  consultant_chat_conversations = COALESCE(${consultant_chat_conversations ? JSON.stringify(consultant_chat_conversations) : null}::jsonb, consultant_chat_conversations),
                  unified_chat_history = COALESCE(${unified_chat_history ? JSON.stringify(unified_chat_history) : null}::jsonb, unified_chat_history),
                  unified_chat_conversations = COALESCE(${unified_chat_conversations ? JSON.stringify(unified_chat_conversations) : null}::jsonb, unified_chat_conversations),
                  unified_chat_files = COALESCE(${unified_chat_files ? JSON.stringify(unified_chat_files) : null}::jsonb, unified_chat_files),
                  chat_scope_selections = COALESCE(${chat_scope_selections ? JSON.stringify(chat_scope_selections) : null}::jsonb, chat_scope_selections),
                  guided_gpt_prompts = COALESCE(${guided_gpt_prompts ? JSON.stringify(guided_gpt_prompts) : null}::jsonb, guided_gpt_prompts),
                  smart_prompt_prompts = COALESCE(${smart_prompt_prompts ? JSON.stringify(smart_prompt_prompts) : null}::jsonb, smart_prompt_prompts),
                  guided_gpt_rules = COALESCE(${guided_gpt_rules ? JSON.stringify(guided_gpt_rules) : null}::jsonb, guided_gpt_rules),
                  legacy_prompt_rules = COALESCE(${legacy_prompt_rules ? JSON.stringify(legacy_prompt_rules) : null}::jsonb, legacy_prompt_rules),
                  updated_at = CURRENT_TIMESTAMP
                WHERE workflow_id = ${workflowId}
              `;
            }
          } else {
            throw updateErr;
          }
        }
        return null;
      }
    };

    // Try to update smart_matching columns and algorithm rules (silently fail if they don't exist)
    const tryUpdateSmartMatching = async () => {
      try {
        // Use separate UPDATE statements based on saveToWebsite flag
        if (saveToWebsite) {
          await sql`
            UPDATE image_creation_settings
            SET
              smart_matching_enabled = COALESCE(${smart_matching_enabled}, smart_matching_enabled),
              smart_matching_mode = COALESCE(${smart_matching_mode}, smart_matching_mode),
              placement_rule = COALESCE(${placement_rule}, placement_rule),
              smart_matching_rule = COALESCE(${smart_matching_rule}, smart_matching_rule),
              match_plurals = COALESCE(${match_plurals}, match_plurals),
              matching_rule_1 = COALESCE(${matching_rule_1}, matching_rule_1),
              matching_rule_2 = COALESCE(${matching_rule_2}, matching_rule_2),
              matching_rule_3 = COALESCE(${matching_rule_3}, matching_rule_3),
              matching_rule_4 = COALESCE(${matching_rule_4}, matching_rule_4),
              smart_matching_config = COALESCE(${smart_matching_config ? JSON.stringify(smart_matching_config) : null}::jsonb, smart_matching_config)
            WHERE website_id = ${websiteId}
          `;
        } else {
          await sql`
            UPDATE image_creation_settings
            SET
              smart_matching_enabled = COALESCE(${smart_matching_enabled}, smart_matching_enabled),
              smart_matching_mode = COALESCE(${smart_matching_mode}, smart_matching_mode),
              placement_rule = COALESCE(${placement_rule}, placement_rule),
              smart_matching_rule = COALESCE(${smart_matching_rule}, smart_matching_rule),
              match_plurals = COALESCE(${match_plurals}, match_plurals),
              matching_rule_1 = COALESCE(${matching_rule_1}, matching_rule_1),
              matching_rule_2 = COALESCE(${matching_rule_2}, matching_rule_2),
              matching_rule_3 = COALESCE(${matching_rule_3}, matching_rule_3),
              matching_rule_4 = COALESCE(${matching_rule_4}, matching_rule_4),
              smart_matching_config = COALESCE(${smart_matching_config ? JSON.stringify(smart_matching_config) : null}::jsonb, smart_matching_config)
            WHERE workflow_id = ${workflowId}
          `;
        }
        return true;
      } catch (err) {
        if (err.message?.includes('smart_matching') || err.message?.includes('placement_rule') || err.message?.includes('match_plurals') || err.message?.includes('matching_rule')) {
          console.log('[Image Creation API] smart_matching/algorithm columns not available yet (run migration)');
          return false;
        }
        throw err;
      }
    };

    // Separate function to update JUST smart_matching_mode (critical for bank fallback behavior)
    const tryUpdateSmartMatchingMode = async () => {
      if (smart_matching_mode === undefined || smart_matching_mode === null) {
        return false; // Nothing to update
      }
      try {
        if (saveToWebsite) {
          await sql`UPDATE image_creation_settings SET smart_matching_mode = ${smart_matching_mode} WHERE website_id = ${websiteId}`;
        } else {
          await sql`UPDATE image_creation_settings SET smart_matching_mode = ${smart_matching_mode} WHERE workflow_id = ${workflowId}`;
        }
        console.log('[Image Creation API] Successfully saved smart_matching_mode:', smart_matching_mode);
        return true;
      } catch (err) {
        if (err.message?.includes('smart_matching_mode')) {
          console.log('[Image Creation API] smart_matching_mode column not available');
          return false;
        }
        throw err;
      }
    };

    // Separate function to update live_prompt_mode AND fallback_prompt_mode (ensures they're saved even if other columns fail)
    const tryUpdateLivePromptMode = async () => {
      const hasLiveMode = live_prompt_mode !== undefined && live_prompt_mode !== null;
      const hasFallbackMode = fallback_prompt_mode !== undefined && fallback_prompt_mode !== null;

      if (!hasLiveMode && !hasFallbackMode) {
        return false; // Nothing to update
      }

      // Helper to save just live_prompt_mode
      const saveLiveModeOnly = async () => {
        if (saveToWebsite) {
          await sql`UPDATE image_creation_settings SET live_prompt_mode = ${live_prompt_mode} WHERE website_id = ${websiteId}`;
        } else {
          await sql`UPDATE image_creation_settings SET live_prompt_mode = ${live_prompt_mode} WHERE workflow_id = ${workflowId}`;
        }
        console.log('[Image Creation API] Successfully saved live_prompt_mode:', live_prompt_mode);
      };

      try {
        // Try to save both if both are provided
        if (hasLiveMode && hasFallbackMode) {
          try {
            if (saveToWebsite) {
              await sql`
                UPDATE image_creation_settings
                SET live_prompt_mode = ${live_prompt_mode},
                    fallback_prompt_mode = ${fallback_prompt_mode}
                WHERE website_id = ${websiteId}
              `;
            } else {
              await sql`
                UPDATE image_creation_settings
                SET live_prompt_mode = ${live_prompt_mode},
                    fallback_prompt_mode = ${fallback_prompt_mode}
                WHERE workflow_id = ${workflowId}
              `;
            }
            console.log('[Image Creation API] Successfully saved live_prompt_mode:', live_prompt_mode, 'fallback_prompt_mode:', fallback_prompt_mode);
          } catch (bothErr) {
            // If combined update fails (likely missing fallback_prompt_mode column), save just live_prompt_mode
            if (bothErr.message?.includes('fallback_prompt_mode')) {
              console.log('[Image Creation API] fallback_prompt_mode column missing, saving just live_prompt_mode');
              await saveLiveModeOnly();
            } else {
              throw bothErr;
            }
          }
        } else if (hasLiveMode) {
          await saveLiveModeOnly();
        } else if (hasFallbackMode) {
          try {
            if (saveToWebsite) {
              await sql`UPDATE image_creation_settings SET fallback_prompt_mode = ${fallback_prompt_mode} WHERE website_id = ${websiteId}`;
            } else {
              await sql`UPDATE image_creation_settings SET fallback_prompt_mode = ${fallback_prompt_mode} WHERE workflow_id = ${workflowId}`;
            }
            console.log('[Image Creation API] Successfully saved fallback_prompt_mode:', fallback_prompt_mode);
          } catch (fallbackErr) {
            if (fallbackErr.message?.includes('fallback_prompt_mode')) {
              console.log('[Image Creation API] fallback_prompt_mode column not available yet (run migration 007)');
            } else {
              throw fallbackErr;
            }
          }
        }
        return true;
      } catch (err) {
        if (err.message?.includes('live_prompt_mode')) {
          console.log('[Image Creation API] live_prompt_mode column not available yet (run migration 007)');
          return false;
        }
        throw err;
      }
    };

    // Separate function to update testing_slots columns (silently fail if migration 034 hasn't run)
    const tryUpdateTestingSlots = async () => {
      const hasSlots = testing_slots !== undefined;
      const hasActiveSlot = active_testing_slot !== undefined;

      if (!hasSlots && !hasActiveSlot) return false;

      try {
        const slotsJson = hasSlots ? JSON.stringify(testing_slots ?? []) : null;
        if (saveToWebsite) {
          await sql`
            UPDATE image_creation_settings
            SET
              testing_slots = COALESCE(${slotsJson}::jsonb, testing_slots),
              active_testing_slot = ${hasActiveSlot ? (active_testing_slot ?? null) : null}
            WHERE website_id = ${websiteId}
          `;
        } else {
          await sql`
            UPDATE image_creation_settings
            SET
              testing_slots = COALESCE(${slotsJson}::jsonb, testing_slots),
              active_testing_slot = ${hasActiveSlot ? (active_testing_slot ?? null) : null}
            WHERE workflow_id = ${workflowId}
          `;
        }
        console.log('[Image Creation API] Successfully saved testing_slots:', testing_slots?.length ?? 0, 'active_slot:', active_testing_slot);
        return true;
      } catch (err) {
        if (err.message?.includes('testing_slots') || err.message?.includes('active_testing_slot')) {
          console.log('[Image Creation API] testing_slots columns not available yet (run migration 034)');
          return false;
        }
        throw err;
      }
    };

    // Separate function to update calibration columns (silently fail if migration 035 hasn't run)
    const tryUpdateCalibration = async () => {
      const hasEntries = calibration_entries !== undefined;
      const hasVersion = calibration_version !== undefined;

      if (!hasEntries && !hasVersion) return false;

      try {
        const entriesJson = hasEntries ? JSON.stringify(calibration_entries ?? []) : null;
        if (saveToWebsite) {
          await sql`
            UPDATE image_creation_settings
            SET
              calibration_entries = COALESCE(${entriesJson}::jsonb, calibration_entries),
              calibration_version = COALESCE(${hasVersion ? calibration_version : null}, calibration_version)
            WHERE website_id = ${websiteId}
          `;
        } else {
          await sql`
            UPDATE image_creation_settings
            SET
              calibration_entries = COALESCE(${entriesJson}::jsonb, calibration_entries),
              calibration_version = COALESCE(${hasVersion ? calibration_version : null}, calibration_version)
            WHERE workflow_id = ${workflowId}
          `;
        }
        console.log('[Image Creation API] Successfully saved calibration_entries:', calibration_entries?.length ?? 0, 'version:', calibration_version);
        return true;
      } catch (err) {
        if (err.message?.includes('calibration_entries') || err.message?.includes('calibration_version')) {
          console.log('[Image Creation API] calibration columns not available yet (run migration 035)');
          return false;
        }
        throw err;
      }
    };

    if (existing.length === 0) {
      // Insert new settings
      console.log('[Image Creation API] Creating new settings record...');
      const newId = await saveCoreSettings(true);
      console.log('[Image Creation API] Created new record with id:', newId);

      // Try to set smart_matching fields
      await tryUpdateSmartMatching();

      // Ensure smart_matching_mode is saved (critical for bank fallback)
      await tryUpdateSmartMatchingMode();

      // Ensure live_prompt_mode is saved (fallback may have skipped it)
      await tryUpdateLivePromptMode();

      // Save testing slots if provided
      await tryUpdateTestingSlots();

      // Save calibration entries if provided
      await tryUpdateCalibration();

      return res.json({ success: true, id: newId, created: true });
    }

    // Update existing settings
    console.log('[Image Creation API] Updating existing record...');
    await saveCoreSettings(false);

    // Try to update smart_matching fields separately
    await tryUpdateSmartMatching();

    // Ensure smart_matching_mode is saved (critical for bank fallback)
    await tryUpdateSmartMatchingMode();

    // Ensure live_prompt_mode is saved (fallback may have skipped it)
    await tryUpdateLivePromptMode();

    // Save testing slots if provided
    await tryUpdateTestingSlots();

    // Save calibration entries if provided
    await tryUpdateCalibration();

    // VERIFICATION: Read back what was saved to confirm (wrapped in try/catch for missing columns)
    try {
      const verifyQuery = saveToWebsite
        ? sql`SELECT id, integration_mode, live_prompt_mode, fallback_prompt_mode, smart_matching_mode FROM image_creation_settings WHERE website_id = ${websiteId}`
        : sql`SELECT id, integration_mode, live_prompt_mode, fallback_prompt_mode, smart_matching_mode FROM image_creation_settings WHERE workflow_id = ${workflowId}`;
      const verifyResult = await verifyQuery;
      console.log('[Image Creation API] VERIFICATION READ after save:', verifyResult[0]);
      if (verifyResult.length > 1) {
        console.log('[Image Creation API] WARNING: Multiple rows found!', verifyResult.map(r => r.id));
      }
    } catch (verifyErr) {
      // Fallback verification without fallback_prompt_mode if column doesn't exist
      console.log('[Image Creation API] Verification with fallback_prompt_mode failed, trying without...');
      const verifyQuery = saveToWebsite
        ? sql`SELECT id, integration_mode, live_prompt_mode, smart_matching_mode FROM image_creation_settings WHERE website_id = ${websiteId}`
        : sql`SELECT id, integration_mode, live_prompt_mode, smart_matching_mode FROM image_creation_settings WHERE workflow_id = ${workflowId}`;
      const verifyResult = await verifyQuery;
      console.log('[Image Creation API] VERIFICATION READ after save:', verifyResult[0]);
    }

    console.log('[Image Creation API] Update complete for workflow:', workflowId);
    res.json({ success: true, updated: true });

  } catch (error) {
    console.error('[Image Creation API] Save settings error:', error);
    console.error('[Image Creation API] Stack:', error.stack);

    // Push logs to GitHub so Claude can see them
    githubLogger.pushLogsToGitHub('image-creation-error').catch(err => {
      console.error('[GitHub Logger] Failed to push error logs:', err.message);
    });

    res.status(500).json({
      error: error.message,
      stack: error.stack,
      hint: 'Check server logs for full details'
    });
  }
});

/**
 * POST /api/image-creation/settings/:workflowId/add-to-bank
 * Add generated image(s) to the image bank
 */
router.post('/settings/:workflowId/add-to-bank', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { images, avatarTag } = req.body; // Array of {url, variation, orientation, prompt}, avatarTag for tag routing

    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ error: 'Images array required' });
    }

    // Get current bank
    const current = await sql`
      SELECT image_bank FROM image_creation_settings WHERE workflow_id = ${workflowId}
    `;

    let bank = [];
    if (current.length > 0 && current[0].image_bank) {
      bank = current[0].image_bank;
    }

    // Add new images with IDs and avatarTag for routing
    const newImages = images.map((img, idx) => ({
      id: `img-${Date.now()}-${idx}`,
      url: img.url,
      variation: img.variation,
      variationId: img.variationId,
      avatarTag: img.avatarTag || avatarTag || null, // Tag for routing (H, J, C)
      orientation: img.orientation,
      prompt: img.prompt,
      createdAt: new Date().toISOString()
    }));

    bank = [...bank, ...newImages];

    // Save back
    if (current.length === 0) {
      await sql`
        INSERT INTO image_creation_settings (workflow_id, image_bank)
        VALUES (${workflowId}, ${JSON.stringify(bank)})
      `;
    } else {
      await sql`
        UPDATE image_creation_settings
        SET image_bank = ${JSON.stringify(bank)}::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE workflow_id = ${workflowId}
      `;
    }

    res.json({ success: true, added: newImages.length, total: bank.length });

  } catch (error) {
    console.error('Add to bank error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/image-creation/settings/:workflowId/bank/:imageId
 * Remove image from bank
 */
router.delete('/settings/:workflowId/bank/:imageId', requireDb, async (req, res) => {
  try {
    const { workflowId, imageId } = req.params;

    const current = await sql`
      SELECT image_bank FROM image_creation_settings WHERE workflow_id = ${workflowId}
    `;

    if (current.length === 0 || !current[0].image_bank) {
      return res.status(404).json({ error: 'No image bank found' });
    }

    const bank = current[0].image_bank.filter(img => img.id !== imageId);

    await sql`
      UPDATE image_creation_settings
      SET image_bank = ${JSON.stringify(bank)}::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE workflow_id = ${workflowId}
    `;

    res.json({ success: true, remaining: bank.length });

  } catch (error) {
    console.error('Delete from bank error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/image-creation/available-models
 * Get list of available LLM models for prompt assistant
 */
router.get('/available-models', (req, res) => {
  res.json({
    success: true,
    models: [
      // GPT Models
      { id: 'gpt-5.2-2025-12-11', name: 'GPT-5.2', provider: 'openai' },
      { id: 'gpt-5-mini-2025-08-07', name: 'GPT-5 Mini', provider: 'openai' },
      { id: 'gpt-5-nano-2025-08-07', name: 'GPT-5 Nano', provider: 'openai' },
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
      // Claude Models
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic' },
      { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', provider: 'anthropic' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
      // Gemini Models
      { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro', provider: 'google' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' }
    ]
  });
});

/**
 * POST /api/image-creation/verify-replicate
 * Verify Replicate API key and get account info
 */
router.post('/verify-replicate', async (req, res) => {
  try {
    const { replicateApiKey } = req.body;
    const apiKey = replicateApiKey || process.env.REPLICATE_API_TOKEN;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'No Replicate API key provided'
      });
    }

    // Call Replicate account endpoint
    const response = await fetch('https://api.replicate.com/v1/account', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({
        success: false,
        error: error.detail || 'Invalid API key or request failed',
        status: response.status
      });
    }

    const account = await response.json();

    res.json({
      success: true,
      account: {
        type: account.type,
        username: account.username,
        name: account.name,
        github_url: account.github_url
      },
      message: `Connected to Replicate as: ${account.username}`,
      note: 'Billing info not available via API - check https://replicate.com/account/billing'
    });

  } catch (error) {
    console.error('Replicate verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/image-creation/debug-levels/:workflowId
 * DEBUG: Compare settings stored at website-level vs workflow-level
 * Helps diagnose issues where old prompts are cached at the wrong level
 */
router.get('/debug-levels/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;

    // Get website_id from workflow
    let websiteId = null;
    const workflowResult = await sql`
      SELECT website_id, name FROM workflows WHERE id = ${workflowId}
    `;
    if (workflowResult.length > 0) {
      websiteId = workflowResult[0].website_id;
    }

    // Get workflow-level settings
    const workflowSettings = await sql`
      SELECT id, workflow_id, website_id, integration_mode, live_prompt_mode,
             audience_avatars, updated_at
      FROM image_creation_settings WHERE workflow_id = ${workflowId}
    `;

    // Get website-level settings (if websiteId exists)
    let websiteSettings = [];
    if (websiteId) {
      websiteSettings = await sql`
        SELECT id, workflow_id, website_id, integration_mode, live_prompt_mode,
               audience_avatars, updated_at
        FROM image_creation_settings WHERE website_id = ${websiteId}
      `;
    }

    // Extract mainPrompt from avatars for easy comparison
    const extractMainPrompt = (avatars) => {
      if (!avatars || !avatars.length) return '(no avatars)';
      const first = avatars[0];
      if (!first.mainPrompt) return '(empty mainPrompt)';
      return first.mainPrompt.substring(0, 100) + '...';
    };

    res.json({
      success: true,
      workflowId,
      websiteId,
      workflowName: workflowResult[0]?.name || 'Unknown',
      comparison: {
        workflowLevel: workflowSettings.length > 0 ? {
          id: workflowSettings[0].id,
          live_prompt_mode: workflowSettings[0].live_prompt_mode,
          mainPrompt_preview: extractMainPrompt(workflowSettings[0].audience_avatars),
          updated_at: workflowSettings[0].updated_at,
          hasAvatars: (workflowSettings[0].audience_avatars || []).length
        } : null,
        websiteLevel: websiteSettings.length > 0 ? {
          id: websiteSettings[0].id,
          live_prompt_mode: websiteSettings[0].live_prompt_mode,
          mainPrompt_preview: extractMainPrompt(websiteSettings[0].audience_avatars),
          updated_at: websiteSettings[0].updated_at,
          hasAvatars: (websiteSettings[0].audience_avatars || []).length
        } : null,
      },
      recommendation: websiteSettings.length > 0 && workflowSettings.length > 0
        ? 'DUPLICATE DATA - Settings exist at BOTH levels! Delete one to fix caching issues.'
        : websiteSettings.length > 0
        ? 'Using WEBSITE-level settings (correct)'
        : workflowSettings.length > 0
        ? 'Using WORKFLOW-level settings only'
        : 'NO SETTINGS FOUND at either level'
    });

  } catch (error) {
    console.error('[Image Creation API] Debug levels error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/image-creation/sync-levels/:workflowId
 * FIX: Delete stale workflow-level settings when website-level settings exist
 * This resolves the "old prompt stuck in cache" issue
 */
router.post('/sync-levels/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;

    // Get website_id from workflow
    let websiteId = null;
    const workflowResult = await sql`
      SELECT website_id, name FROM workflows WHERE id = ${workflowId}
    `;
    if (workflowResult.length > 0) {
      websiteId = workflowResult[0].website_id;
    }

    if (!websiteId) {
      return res.json({
        success: false,
        message: 'No website_id linked to this workflow - nothing to sync'
      });
    }

    // Check if both levels have settings
    const workflowSettings = await sql`
      SELECT id FROM image_creation_settings WHERE workflow_id = ${workflowId}
    `;
    const websiteSettings = await sql`
      SELECT id FROM image_creation_settings WHERE website_id = ${websiteId}
    `;

    if (workflowSettings.length === 0) {
      return res.json({
        success: true,
        message: 'No workflow-level settings to delete - already clean',
        deleted: 0
      });
    }

    if (websiteSettings.length === 0) {
      return res.json({
        success: false,
        message: 'No website-level settings exist - cannot delete workflow settings without replacement'
      });
    }

    // BOTH exist - delete the workflow-level (stale) settings
    console.log(`[SYNC LEVELS] Deleting workflow-level settings for workflow ${workflowId}`);
    console.log(`[SYNC LEVELS] Website-level settings at website ${websiteId} will be used instead`);

    const deleteResult = await sql`
      DELETE FROM image_creation_settings WHERE workflow_id = ${workflowId}
      RETURNING id
    `;

    console.log(`[SYNC LEVELS] Deleted ${deleteResult.length} stale workflow-level rows`);

    res.json({
      success: true,
      message: `Deleted ${deleteResult.length} stale workflow-level settings. Website-level settings will now be used.`,
      deleted: deleteResult.length,
      deletedIds: deleteResult.map(r => r.id)
    });

  } catch (error) {
    console.error('[Image Creation API] Sync levels error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// IMAGE BANK INTEGRATION FOR ARTICLES
// ========================================

/**
 * POST /api/image-creation/get-images-for-article
 * Get images from Image Bank for an article based on its tag
 * This is the key integration point for the Elementor pipeline
 *
 * Flow:
 * 1. Extract tag from keyword (e.g., "Standard Cleaning(H)" -> "H")
 * 2. Find Audience Avatar matching that tag
 * 3. Get images from Image Bank with matching avatarTag
 * 4. Return images in variation order (sequential, random, or manual)
 * 5. Mark images as used and track which article they went to
 */
router.post('/get-images-for-article', requireDb, async (req, res) => {
  try {
    const {
      workflowId,
      keyword, // e.g., "Standard Cleaning(H)" or "Construction Site Cleaning (C)"
      articleId, // Optional - to track which article used which images
      chunksNeeded = 4, // How many images needed (based on article chunks)
      heroFirst = true // First image should be for hero section
    } = req.body;

    if (!workflowId) {
      return res.status(400).json({ error: 'workflowId is required' });
    }

    // 1. Extract tag from keyword - look for (X) pattern
    const tagMatch = keyword?.match(/\(([A-Z])\)/i);
    const articleTag = tagMatch ? tagMatch[1].toUpperCase() : null;

    // 2. Get Image Creation settings
    const settings = await sql`
      SELECT * FROM image_creation_settings WHERE workflow_id = ${workflowId}
    `;

    if (settings.length === 0) {
      return res.json({
        success: true,
        images: [],
        message: 'No Image Creation settings found for this workflow',
        mode: 'none'
      });
    }

    const config = settings[0];
    const integrationMode = config.integration_mode || 'bank';
    const fallbackToLive = config.fallback_to_live ?? true;
    const imageBank = config.image_bank || [];
    const avatars = config.audience_avatars || [];
    const variationOrderMode = config.variation_order_mode || 'sequential';
    const manualOrder = config.manual_variation_order || [];

    // 3. Find matching avatar by tag
    let targetAvatar = null;
    if (articleTag) {
      targetAvatar = avatars.find(a => a.tag === articleTag);
    }
    if (!targetAvatar && avatars.length > 0) {
      // Fall back to first avatar if no tag match
      targetAvatar = avatars[0];
    }

    // 4. Get available images from bank matching the tag
    let availableImages = imageBank.filter(img => {
      // Filter out already used images
      if (img.used) return false;
      // If we have a target tag, filter by avatarTag
      if (articleTag && img.avatarTag) {
        return img.avatarTag === articleTag;
      }
      // If avatar has variations, match by variationId
      if (targetAvatar && targetAvatar.variations?.length > 0) {
        return targetAvatar.variations.some(v => v.id === img.variationId);
      }
      return true;
    });

    // 5. Sort images by variation order
    if (variationOrderMode === 'manual' && manualOrder.length > 0) {
      // Manual order - sort by position in manualOrder array
      availableImages = availableImages.sort((a, b) => {
        const aIdx = manualOrder.indexOf(a.variationId);
        const bIdx = manualOrder.indexOf(b.variationId);
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
    } else if (variationOrderMode === 'random') {
      // Random order (shuffle)
      availableImages = availableImages.sort(() => Math.random() - 0.5);
    }
    // 'sequential' keeps original order

    // 6. Select images for the article
    const selectedImages = [];
    let imageIndex = 0;

    for (let i = 0; i < chunksNeeded && imageIndex < availableImages.length; i++) {
      const img = availableImages[imageIndex];
      const isHero = heroFirst && i === 0;

      selectedImages.push({
        id: img.id,
        url: img.url,
        variation: img.variation,
        variationId: img.variationId,
        prompt: img.prompt,
        orientation: img.orientation,
        side: isHero ? 'right' : (i % 2 === 0 ? 'left' : 'right'), // Alternate sides
        isHero,
        position: i
      });

      imageIndex++;
    }

    // 7. Mark selected images as used in the bank
    if (selectedImages.length > 0) {
      const selectedIds = new Set(selectedImages.map(i => i.id));
      const updatedBank = imageBank.map(img => {
        if (selectedIds.has(img.id)) {
          return {
            ...img,
            used: true,
            usedOn: keyword || 'Unknown article',
            usedAt: new Date().toISOString(),
            usedByArticleId: articleId
          };
        }
        return img;
      });

      // Save updated bank
      await sql`
        UPDATE image_creation_settings
        SET image_bank = ${JSON.stringify(updatedBank)}::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE workflow_id = ${workflowId}
      `;
    }

    // 8. Check if we need more images (fallback to live)
    const needsMore = selectedImages.length < chunksNeeded;
    const avatarPrompt = targetAvatar?.mainPrompt || '';
    const variations = targetAvatar?.variations || [];

    res.json({
      success: true,
      images: selectedImages,
      fromBank: selectedImages.length,
      needed: chunksNeeded,
      tag: articleTag,
      avatarName: targetAvatar?.name,
      mode: integrationMode,
      needsLiveGeneration: needsMore && fallbackToLive,
      remainingNeeded: chunksNeeded - selectedImages.length,
      // Include prompt info for live generation fallback
      avatarPrompt: needsMore ? avatarPrompt : null,
      variations: needsMore ? variations.slice(0, chunksNeeded - selectedImages.length) : []
    });

  } catch (error) {
    console.error('Get images for article error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/image-creation/release-images
 * Release used images back to the bank (undo use)
 */
router.post('/release-images', requireDb, async (req, res) => {
  try {
    const { workflowId, imageIds } = req.body;

    if (!workflowId || !imageIds?.length) {
      return res.status(400).json({ error: 'workflowId and imageIds required' });
    }

    const settings = await sql`
      SELECT image_bank FROM image_creation_settings WHERE workflow_id = ${workflowId}
    `;

    if (settings.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    const idsToRelease = new Set(imageIds);
    const updatedBank = (settings[0].image_bank || []).map(img => {
      if (idsToRelease.has(img.id)) {
        const { used, usedOn, usedAt, usedByArticleId, ...rest } = img;
        return rest;
      }
      return img;
    });

    await sql`
      UPDATE image_creation_settings
      SET image_bank = ${JSON.stringify(updatedBank)}::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE workflow_id = ${workflowId}
    `;

    res.json({ success: true, released: imageIds.length });

  } catch (error) {
    console.error('Release images error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// SMART CONTENT MATCHING
// ========================================

/**
 * POST /api/image-creation/analyze-content
 * Analyze paragraph text to extract topics and keywords for image matching
 * Uses GPT to understand the semantic content
 */
router.post('/analyze-content', async (req, res) => {
  try {
    const {
      text, // The paragraph text to analyze
      context = '', // Optional surrounding context
      openaiApiKey
    } = req.body;

    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key required for content analysis' });
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text content required' });
    }

    const openai = new OpenAI({ apiKey });

    // Use GPT to extract semantic topics from the text
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use mini for speed/cost
      messages: [
        {
          role: 'system',
          content: `You are a content analyzer for a house cleaning business image matching system.
Extract the key visual topics from the provided text that would be relevant for selecting or generating an image.

Focus on:
- What activity is being described (e.g., "cleaning the sink", "mopping floors")
- What objects/items are mentioned (e.g., "kitchen countertops", "stove burners")
- What location/room is referenced (e.g., "kitchen", "bathroom", "living room")
- What type of person might be shown (age range, gender if implied)
- What mood/tone is conveyed (professional, friendly, thorough)

Respond ONLY with valid JSON in this exact format:
{
  "primaryTopic": "the main visual subject for the image",
  "activity": "specific cleaning action if mentioned",
  "location": "room or area type",
  "objects": ["list", "of", "relevant", "objects"],
  "keywords": ["semantic", "keywords", "for", "matching"],
  "suggestedPromptAdditions": "brief text to add to base prompt for this specific content"
}`
        },
        {
          role: 'user',
          content: context
            ? `Context: ${context}\n\nAnalyze this paragraph:\n${text}`
            : `Analyze this paragraph:\n${text}`
        }
      ],
      max_tokens: 300,
      temperature: 0.3 // Low temperature for consistent extraction
    });

    // Parse the response
    const content = response.choices[0].message.content;
    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      console.error('Failed to parse content analysis:', e);
      // Fallback to basic extraction
      analysis = {
        primaryTopic: text.substring(0, 50),
        keywords: text.split(/\s+/).filter(w => w.length > 4).slice(0, 5),
        activity: null,
        location: null,
        objects: [],
        suggestedPromptAdditions: ''
      };
    }

    res.json({
      success: true,
      analysis,
      originalText: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
      usage: response.usage
    });

  } catch (error) {
    console.error('Content analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/image-creation/smart-match-image
 * Find the best matching image from bank based on content analysis
 * Or generate a new one if no good match found
 */
router.post('/smart-match-image', requireDb, async (req, res) => {
  try {
    const {
      workflowId,
      contentAnalysis, // From analyze-content endpoint
      avatarTag, // Which avatar/tag to use for generation
      articleId, // Track which article uses the image
      openaiApiKey,
      replicateApiKey
    } = req.body;

    const openaiKey = openaiApiKey || process.env.OPENAI_API_KEY;
    const replicateKey = replicateApiKey || process.env.REPLICATE_API_TOKEN;

    if (!workflowId || !contentAnalysis) {
      return res.status(400).json({ error: 'workflowId and contentAnalysis required' });
    }

    // Get settings including smart matching config
    const settings = await sql`
      SELECT * FROM image_creation_settings WHERE workflow_id = ${workflowId}
    `;

    if (settings.length === 0) {
      return res.status(404).json({ error: 'No Image Creation settings found' });
    }

    const config = settings[0];
    const smartMatchingEnabled = config.smart_matching_enabled ?? false;
    const smartMatchingMode = config.smart_matching_mode || 'bank_first';
    const imageBank = config.image_bank || [];
    const avatars = config.audience_avatars || [];
    const imageGenModel = config.image_generation_model || 'flux-1.1-pro';

    if (!smartMatchingEnabled) {
      return res.json({
        success: false,
        message: 'Smart Content Matching is not enabled',
        mode: 'disabled'
      });
    }

    // Find the target avatar
    let targetAvatar = avatarTag
      ? avatars.find(a => a.tag === avatarTag)
      : avatars[0];

    // Keywords from content analysis
    const keywords = contentAnalysis.keywords || [];
    const primaryTopic = contentAnalysis.primaryTopic || '';
    const activity = contentAnalysis.activity || '';

    // Function to score how well an image matches the content
    const scoreImageMatch = (img) => {
      let score = 0;
      const imgText = `${img.title || ''} ${img.prompt || ''} ${img.variation || ''}`.toLowerCase();

      // Check primary topic
      if (primaryTopic && imgText.includes(primaryTopic.toLowerCase())) {
        score += 10;
      }

      // Check activity
      if (activity && imgText.includes(activity.toLowerCase())) {
        score += 8;
      }

      // Check keywords
      for (const keyword of keywords) {
        if (imgText.includes(keyword.toLowerCase())) {
          score += 3;
        }
      }

      // Bonus for matching avatar tag
      if (avatarTag && img.avatarTag === avatarTag) {
        score += 5;
      }

      // Penalty for already used images
      if (img.used) {
        score -= 15;
      }

      return score;
    };

    let selectedImage = null;
    let generatedImage = null;
    let source = 'none';

    // Handle different modes
    if (smartMatchingMode === 'bank_first' || smartMatchingMode === 'bank_only') {
      // Try to find a matching image in the bank
      const scoredImages = imageBank
        .filter(img => !img.used) // Only unused images
        .map(img => ({ ...img, matchScore: scoreImageMatch(img) }))
        .filter(img => img.matchScore > 0) // Only positive matches
        .sort((a, b) => b.matchScore - a.matchScore);

      if (scoredImages.length > 0) {
        selectedImage = scoredImages[0];
        source = 'bank';

        // Mark the image as used
        const updatedBank = imageBank.map(img =>
          img.id === selectedImage.id
            ? {
                ...img,
                used: true,
                usedOn: primaryTopic || 'Smart matched content',
                usedAt: new Date().toISOString(),
                usedByArticleId: articleId,
                matchScore: selectedImage.matchScore
              }
            : img
        );

        await sql`
          UPDATE image_creation_settings
          SET image_bank = ${JSON.stringify(updatedBank)}::jsonb,
              updated_at = CURRENT_TIMESTAMP
          WHERE workflow_id = ${workflowId}
        `;
      }
    }

    // Generate if needed and allowed
    const shouldGenerate =
      !selectedImage &&
      (smartMatchingMode === 'generate_first' ||
       smartMatchingMode === 'generate_only' ||
       (smartMatchingMode === 'bank_first' && !selectedImage));

    if (shouldGenerate && apiKey && targetAvatar?.mainPrompt) {
      // Build a content-aware prompt
      let prompt = targetAvatar.mainPrompt;

      // Add content-specific additions if available
      if (contentAnalysis.suggestedPromptAdditions) {
        prompt += `\n\n${contentAnalysis.suggestedPromptAdditions}`;
      }

      // Replace placeholders if in advanced mode
      if (targetAvatar.placeholderMode === 'advanced' && targetAvatar.placeholderCategories) {
        // Find relevant options based on content analysis
        for (const category of targetAvatar.placeholderCategories) {
          // Try to match content analysis to placeholder options
          let bestOption = category.options[0]; // Default to first
          const categoryLower = category.name.toLowerCase();

          // If this category relates to the analyzed content, try to find a match
          if (activity && categoryLower.includes('clean')) {
            const matchingOption = category.options.find(opt =>
              activity.toLowerCase().includes(opt.text.toLowerCase()) ||
              opt.text.toLowerCase().includes(activity.toLowerCase())
            );
            if (matchingOption) bestOption = matchingOption;
          }

          // Replace the placeholder
          prompt = prompt.replace(category.placeholder, bestOption.text);
        }
      }

      try {
        // Select correct API key based on model
        const imageApiKey = imageGenModel === 'gpt-image-1.5' ? openaiKey : replicateKey;

        if (!imageApiKey) {
          const keyType = imageGenModel === 'gpt-image-1.5' ? 'OpenAI' : 'Replicate';
          console.log(`[Smart Match] No ${keyType} API key for ${imageGenModel}`);
          throw new Error(`${keyType} API key required for ${imageGenModel}`);
        }

        // Use portrait for hero images
        const size = '1024x1536';

        console.log(`[Smart Match] Generating image with ${imageGenModel}`);

        // Use unified generateImage function
        const result = await generateImage(prompt, {
          model: imageGenModel,
          quality: 'low', // Use low for web performance
          size: size
        }, imageApiKey);

        generatedImage = {
          id: `img-smart-${Date.now()}`,
          url: result.url,
          prompt: prompt,
          revisedPrompt: result.revisedPrompt,
          avatarTag: targetAvatar?.tag || null,
          createdAt: new Date().toISOString(),
          smartMatched: true,
          contentAnalysis: contentAnalysis
        };
        source = 'generated';

        // Add to bank for future use (if mode allows)
        if (smartMatchingMode !== 'generate_only') {
          const newBankEntry = {
            ...generatedImage,
            title: primaryTopic || 'Smart generated image',
            used: true,
            usedOn: primaryTopic || 'Smart matched content',
            usedAt: new Date().toISOString(),
            usedByArticleId: articleId
          };

          await sql`
            UPDATE image_creation_settings
            SET image_bank = image_bank || ${JSON.stringify([newBankEntry])}::jsonb,
                updated_at = CURRENT_TIMESTAMP
            WHERE workflow_id = ${workflowId}
          `;
        }

      } catch (genError) {
        console.error('Smart match generation error:', genError);
        // Continue without generated image
      }
    }

    const finalImage = selectedImage || generatedImage;

    res.json({
      success: !!finalImage,
      image: finalImage ? {
        id: finalImage.id,
        url: finalImage.url,
        prompt: finalImage.prompt,
        title: finalImage.title || primaryTopic,
        matchScore: selectedImage?.matchScore,
        source: source
      } : null,
      source,
      mode: smartMatchingMode,
      contentAnalysis,
      avatarUsed: targetAvatar?.name,
      message: finalImage
        ? `Image ${source === 'bank' ? 'matched from bank' : 'generated'} for content`
        : 'No suitable image found or generated'
    });

  } catch (error) {
    console.error('Smart match error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/image-creation/smart-match-batch
 * Match images for multiple content chunks in an article
 * Used by the Elementor publish flow
 */
router.post('/smart-match-batch', requireDb, async (req, res) => {
  try {
    const {
      workflowId,
      chunks, // Array of {id, text, context?} for each content chunk needing an image
      avatarTag,
      articleId,
      openaiApiKey
    } = req.body;

    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!workflowId || !chunks?.length) {
      return res.status(400).json({ error: 'workflowId and chunks array required' });
    }

    // Get settings
    const settings = await sql`
      SELECT * FROM image_creation_settings WHERE workflow_id = ${workflowId}
    `;

    if (settings.length === 0) {
      return res.status(404).json({ error: 'No Image Creation settings found' });
    }

    const config = settings[0];

    if (!config.smart_matching_enabled) {
      return res.json({
        success: false,
        results: [],
        message: 'Smart Content Matching is not enabled'
      });
    }

    const results = [];
    const openai = new OpenAI({ apiKey });

    // Process each chunk
    for (const chunk of chunks) {
      try {
        // Step 1: Analyze the content
        const analysisResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Extract key visual topics from text for image matching. Respond with JSON: {"primaryTopic":"main subject","activity":"action","keywords":["list"],"suggestedPromptAdditions":"brief additions"}`
            },
            { role: 'user', content: chunk.text }
          ],
          max_tokens: 200,
          temperature: 0.3
        });

        let analysis;
        try {
          const jsonMatch = analysisResponse.choices[0].message.content.match(/\{[\s\S]*\}/);
          analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { keywords: [] };
        } catch (e) {
          analysis = { primaryTopic: chunk.text.substring(0, 30), keywords: [] };
        }

        // Step 2: Try to find/generate matching image
        // (Simplified inline version of smart-match-image logic)
        const imageBank = config.image_bank || [];
        const keywords = analysis.keywords || [];
        const primaryTopic = analysis.primaryTopic || '';

        // Score and find best match
        let bestMatch = null;
        let bestScore = 0;

        for (const img of imageBank) {
          if (img.used) continue;
          const imgText = `${img.title || ''} ${img.prompt || ''} ${img.variation || ''}`.toLowerCase();
          let score = 0;

          if (primaryTopic && imgText.includes(primaryTopic.toLowerCase())) score += 10;
          for (const kw of keywords) {
            if (imgText.includes(kw.toLowerCase())) score += 3;
          }
          if (avatarTag && img.avatarTag === avatarTag) score += 5;

          if (score > bestScore) {
            bestScore = score;
            bestMatch = img;
          }
        }

        results.push({
          chunkId: chunk.id,
          analysis,
          image: bestMatch ? {
            id: bestMatch.id,
            url: bestMatch.url,
            title: bestMatch.title,
            matchScore: bestScore,
            source: 'bank'
          } : null,
          needsGeneration: !bestMatch && config.smart_matching_mode !== 'bank_only'
        });

        // Mark image as used if found
        if (bestMatch) {
          config.image_bank = imageBank.map(img =>
            img.id === bestMatch.id
              ? { ...img, used: true, usedOn: primaryTopic, usedAt: new Date().toISOString(), usedByArticleId: articleId }
              : img
          );
        }

      } catch (chunkError) {
        console.error('Error processing chunk:', chunk.id, chunkError);
        results.push({
          chunkId: chunk.id,
          error: chunkError.message,
          image: null
        });
      }
    }

    // Save updated bank if any images were used
    if (results.some(r => r.image)) {
      await sql`
        UPDATE image_creation_settings
        SET image_bank = ${JSON.stringify(config.image_bank)}::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE workflow_id = ${workflowId}
      `;
    }

    res.json({
      success: true,
      results,
      matched: results.filter(r => r.image).length,
      needGeneration: results.filter(r => r.needsGeneration).length,
      total: chunks.length
    });

  } catch (error) {
    console.error('Smart match batch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// STAGING WORDPRESS UPLOAD
// ========================================

/**
 * POST /api/image-creation/upload-to-staging
 * Upload a base64 image to the staging WordPress site
 *
 * Flow: AI generates base64 → Upload to Staging WP (bypasses ModSecurity) → Returns permanent wpUrl
 *
 * This endpoint is used by:
 * - Batch Generate: Upload generated images to staging for Image Bank storage
 * - Generate Live: Upload images before placing on customer sites
 */
router.post('/upload-to-staging', async (req, res) => {
  try {
    const {
      // Image data
      imageData, // base64 string (with or without data:image/png;base64, prefix)
      filename,  // Optional filename, will generate one if not provided
      alt = '',  // Alt text for accessibility

      // Staging WordPress credentials (required)
      wpUrl,     // Staging site URL (e.g., https://staging.example.com)
      wpUser,    // WordPress username
      wpPassword // Application password

    } = req.body;

    // Validate required fields
    if (!imageData) {
      return res.status(400).json({ error: 'imageData (base64) is required' });
    }

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({
        error: 'Staging WordPress credentials required (wpUrl, wpUser, wpPassword)'
      });
    }

    // Generate filename if not provided
    const finalFilename = filename || `image-${Date.now()}.png`;

    console.log('[Upload to Staging] Starting upload...');
    console.log('[Upload to Staging] URL:', wpUrl);
    console.log('[Upload to Staging] Filename:', finalFilename);

    // Use the uploadMedia function from wordpress-publisher
    const wpCredentials = {
      url: wpUrl,
      user: wpUser,
      password: wpPassword
    };

    const media = await uploadMedia(
      wpCredentials,
      imageData,
      finalFilename,
      { alt: alt || finalFilename }
    );

    console.log('[Upload to Staging] Success! Media ID:', media.id);
    console.log('[Upload to Staging] URL:', media.source_url);

    res.json({
      success: true,
      wpMediaId: media.id,
      wpUrl: media.source_url,
      filename: finalFilename,
      alt: media.alt_text || alt
    });

  } catch (error) {
    console.error('[Upload to Staging] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload image to staging WordPress'
    });
  }
});

/**
 * POST /api/image-creation/upload-bank-to-staging
 * Upload multiple Image Bank images to staging WordPress
 *
 * This is a batch operation to upload all bank images that don't have wpUrl yet
 */
router.post('/upload-bank-to-staging', requireDb, async (req, res) => {
  try {
    const {
      workflowId,
      // Staging WordPress credentials
      wpUrl,
      wpUser,
      wpPassword,
      // Optional: specific image IDs to upload (if not provided, uploads all missing)
      imageIds
    } = req.body;

    if (!workflowId) {
      return res.status(400).json({ error: 'workflowId is required' });
    }

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({
        error: 'Staging WordPress credentials required (wpUrl, wpUser, wpPassword)'
      });
    }

    // Get current settings
    const settings = await sql`
      SELECT * FROM image_creation_settings WHERE workflow_id = ${workflowId}
    `;

    if (settings.length === 0) {
      return res.status(404).json({ error: 'Image Creation settings not found' });
    }

    const config = settings[0];
    const imageBank = config.image_bank || [];

    // Find images that need uploading
    let imagesToUpload = imageBank.filter(img => {
      // Skip if already has wpUrl
      if (img.wpUrl) return false;
      // Skip if no base64 data
      if (!img.url || !img.url.startsWith('data:')) return false;
      // If specific IDs requested, only include those
      if (imageIds && !imageIds.includes(img.id)) return false;
      return true;
    });

    if (imagesToUpload.length === 0) {
      return res.json({
        success: true,
        uploaded: 0,
        message: 'No images need uploading (all already have WordPress URLs)'
      });
    }

    console.log(`[Upload Bank to Staging] Uploading ${imagesToUpload.length} images...`);

    const wpCredentials = {
      url: wpUrl,
      user: wpUser,
      password: wpPassword
    };

    const results = [];
    const updatedBank = [...imageBank];

    for (const img of imagesToUpload) {
      try {
        const filename = `bank-${img.id}-${Date.now()}.png`;
        const media = await uploadMedia(
          wpCredentials,
          img.url, // base64 data URL
          filename,
          { alt: img.variation || img.title || 'Image Bank' }
        );

        // Update the image in the bank
        const bankIndex = updatedBank.findIndex(b => b.id === img.id);
        if (bankIndex !== -1) {
          updatedBank[bankIndex] = {
            ...updatedBank[bankIndex],
            wpUrl: media.source_url,
            wpMediaId: media.id,
            uploadedAt: new Date().toISOString()
          };
        }

        results.push({
          id: img.id,
          success: true,
          wpUrl: media.source_url,
          wpMediaId: media.id
        });

        console.log(`[Upload Bank to Staging] ✓ Uploaded ${img.id}: ${media.source_url}`);

      } catch (uploadError) {
        console.error(`[Upload Bank to Staging] ✗ Failed ${img.id}:`, uploadError.message);
        results.push({
          id: img.id,
          success: false,
          error: uploadError.message
        });
      }
    }

    // Save updated bank to database
    const successCount = results.filter(r => r.success).length;
    if (successCount > 0) {
      await sql`
        UPDATE image_creation_settings
        SET image_bank = ${JSON.stringify(updatedBank)}::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE workflow_id = ${workflowId}
      `;
    }

    res.json({
      success: true,
      uploaded: successCount,
      failed: results.filter(r => !r.success).length,
      total: imagesToUpload.length,
      results
    });

  } catch (error) {
    console.error('[Upload Bank to Staging] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// PROMPT LIBRARY
// Reusable prompts and rules for Guided GPT and Smart Prompt
// ========================================

/**
 * GET /api/image-creation/prompt-library
 * Get all prompts/rules for a website (includes global ones)
 * Query params: websiteId, type (prompt|rule), mode (guided_gpt|smart_prompt)
 */
router.get('/prompt-library', requireDb, async (req, res) => {
  try {
    const { websiteId, type, mode } = req.query;

    let items;
    if (websiteId) {
      // Get website-specific + global items
      if (type && mode) {
        items = await sql`
          SELECT * FROM prompt_library
          WHERE (website_id = ${websiteId} OR is_global = true)
            AND type = ${type}
            AND mode = ${mode}
          ORDER BY is_global DESC, updated_at DESC
        `;
      } else if (type) {
        items = await sql`
          SELECT * FROM prompt_library
          WHERE (website_id = ${websiteId} OR is_global = true)
            AND type = ${type}
          ORDER BY is_global DESC, updated_at DESC
        `;
      } else if (mode) {
        items = await sql`
          SELECT * FROM prompt_library
          WHERE (website_id = ${websiteId} OR is_global = true)
            AND mode = ${mode}
          ORDER BY is_global DESC, updated_at DESC
        `;
      } else {
        items = await sql`
          SELECT * FROM prompt_library
          WHERE (website_id = ${websiteId} OR is_global = true)
          ORDER BY is_global DESC, updated_at DESC
        `;
      }
    } else {
      // Get global items + any orphaned items (website_id IS NULL)
      if (type && mode) {
        items = await sql`
          SELECT * FROM prompt_library
          WHERE (is_global = true OR website_id IS NULL)
            AND type = ${type}
            AND mode = ${mode}
          ORDER BY updated_at DESC
        `;
      } else if (type) {
        items = await sql`
          SELECT * FROM prompt_library
          WHERE (is_global = true OR website_id IS NULL)
            AND type = ${type}
          ORDER BY updated_at DESC
        `;
      } else if (mode) {
        items = await sql`
          SELECT * FROM prompt_library
          WHERE (is_global = true OR website_id IS NULL)
            AND mode = ${mode}
          ORDER BY updated_at DESC
        `;
      } else {
        items = await sql`
          SELECT * FROM prompt_library
          WHERE (is_global = true OR website_id IS NULL)
          ORDER BY updated_at DESC
        `;
      }
    }

    res.json({ success: true, items });

  } catch (error) {
    console.error('[Prompt Library] GET error:', error);
    // If table doesn't exist, return empty array
    if (error.message?.includes('prompt_library') || error.message?.includes('does not exist')) {
      return res.json({ success: true, items: [], message: 'Table not created yet - run migration 024' });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/image-creation/prompt-library
 * Save a new prompt or rule to the library
 */
router.post('/prompt-library', requireDb, async (req, res) => {
  try {
    const {
      websiteId,
      isGlobal = false,
      type,       // 'prompt' or 'rule'
      mode,       // 'guided_gpt' or 'smart_prompt'
      name,
      description,
      content,
      tag,        // H, J, C, or Global
      tags = []
    } = req.body;

    if (!type || !mode || !name || !content) {
      return res.status(400).json({ error: 'Missing required fields: type, mode, name, content' });
    }

    // If no websiteId provided and not marked as global, treat as global
    // This prevents orphaned items that can't be fetched
    const effectiveIsGlobal = isGlobal || !websiteId;

    // Convert tags array to PostgreSQL array format
    const tagsArray = Array.isArray(tags) && tags.length > 0 ? tags : null;

    console.log('[Prompt Library] Saving:', { name, type, mode, isGlobal: effectiveIsGlobal, websiteId, tag, tags: tagsArray });

    const result = await sql`
      INSERT INTO prompt_library (
        website_id, is_global, type, mode, name, description, content, tag, tags
      ) VALUES (
        ${effectiveIsGlobal ? null : websiteId},
        ${effectiveIsGlobal},
        ${type},
        ${mode},
        ${name},
        ${description || null},
        ${content},
        ${tag || null},
        ${tagsArray}
      )
      RETURNING *
    `;

    console.log('[Prompt Library] Created:', result[0].id, name);
    res.json({ success: true, item: result[0] });

  } catch (error) {
    console.error('[Prompt Library] POST error:', error);
    // Check if table doesn't exist
    if (error.message?.includes('prompt_library') || error.message?.includes('does not exist')) {
      return res.status(500).json({
        error: 'Prompt Library table not created yet. Please run migration 024_add_prompt_library.sql in your database console.',
        needsMigration: true
      });
    }
    res.status(500).json({ error: error.message || 'Unknown database error' });
  }
});

/**
 * PUT /api/image-creation/prompt-library/:id
 * Update a prompt or rule in the library
 */
router.put('/prompt-library/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      websiteId,
      isGlobal,
      name,
      description,
      content,
      tag,
      tags
    } = req.body;

    const result = await sql`
      UPDATE prompt_library
      SET
        website_id = COALESCE(${isGlobal ? null : websiteId}, website_id),
        is_global = COALESCE(${isGlobal}, is_global),
        name = COALESCE(${name}, name),
        description = COALESCE(${description}, description),
        content = COALESCE(${content}, content),
        tag = COALESCE(${tag}, tag),
        tags = COALESCE(${tags}, tags),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    console.log('[Prompt Library] Updated:', id);
    res.json({ success: true, item: result[0] });

  } catch (error) {
    console.error('[Prompt Library] PUT error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/image-creation/prompt-library/:id
 * Delete a prompt or rule from the library
 */
router.delete('/prompt-library/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM prompt_library
      WHERE id = ${id}
      RETURNING id, name
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    console.log('[Prompt Library] Deleted:', id, result[0].name);
    res.json({ success: true, deleted: result[0] });

  } catch (error) {
    console.error('[Prompt Library] DELETE error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================
// VERSION HISTORY ENDPOINTS
// =====================================

/**
 * GET /api/image-creation/version-history
 * Get version history for a specific entity type
 * Query params: websiteId, workflowId, entityType, entityId
 */
router.get('/version-history', requireDb, async (req, res) => {
  try {
    const { websiteId, workflowId, entityType, entityId, limit = 50 } = req.query;

    console.log('[Version History] GET:', { websiteId, workflowId, entityType, entityId });

    let result;
    if (entityId && entityType) {
      // Get history for a specific entity
      if (workflowId) {
        result = await sql`
          SELECT * FROM version_history
          WHERE workflow_id = ${workflowId}
            AND entity_type = ${entityType}
            AND entity_id = ${entityId}
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)}
        `;
      } else if (websiteId) {
        result = await sql`
          SELECT * FROM version_history
          WHERE website_id = ${websiteId}
            AND entity_type = ${entityType}
            AND entity_id = ${entityId}
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)}
        `;
      }
    } else if (entityType) {
      // Get all history for an entity type
      if (workflowId) {
        result = await sql`
          SELECT * FROM version_history
          WHERE workflow_id = ${workflowId}
            AND entity_type = ${entityType}
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)}
        `;
      } else if (websiteId) {
        result = await sql`
          SELECT * FROM version_history
          WHERE website_id = ${websiteId}
            AND entity_type = ${entityType}
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)}
        `;
      }
    } else {
      // Get all history
      if (workflowId) {
        result = await sql`
          SELECT * FROM version_history
          WHERE workflow_id = ${workflowId}
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)}
        `;
      } else if (websiteId) {
        result = await sql`
          SELECT * FROM version_history
          WHERE website_id = ${websiteId}
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)}
        `;
      } else {
        return res.status(400).json({ error: 'Either websiteId or workflowId is required' });
      }
    }

    console.log('[Version History] Found:', result?.length || 0, 'entries');
    res.json({ success: true, versions: result || [] });

  } catch (error) {
    // Handle missing table gracefully
    if (error.message?.includes('version_history') && error.message?.includes('does not exist')) {
      console.log('[Version History] Table not created yet - run migration 025');
      return res.json({ success: true, versions: [], message: 'Table not yet created - run migration 025' });
    }
    console.error('[Version History] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/image-creation/version-history
 * Save a new version to history
 */
router.post('/version-history', requireDb, async (req, res) => {
  try {
    const {
      websiteId,
      workflowId,
      entityType,
      entityId,
      versionName,
      content,
      notes,
      createdBy = 'manual'
    } = req.body;

    console.log('[Version History] POST:', { websiteId, workflowId, entityType, entityId, versionName, createdBy });

    if (!entityType || !entityId || !content) {
      return res.status(400).json({ error: 'entityType, entityId, and content are required' });
    }

    if (!websiteId && !workflowId) {
      return res.status(400).json({ error: 'Either websiteId or workflowId is required' });
    }

    const result = await sql`
      INSERT INTO version_history (
        website_id,
        workflow_id,
        entity_type,
        entity_id,
        version_name,
        content,
        notes,
        created_by
      ) VALUES (
        ${websiteId || null},
        ${workflowId || null},
        ${entityType},
        ${entityId},
        ${versionName || null},
        ${JSON.stringify(content)},
        ${notes || null},
        ${createdBy}
      )
      RETURNING *
    `;

    console.log('[Version History] Created version:', result[0]?.id);
    res.json({ success: true, version: result[0] });

  } catch (error) {
    // Handle missing table gracefully
    if (error.message?.includes('version_history') && error.message?.includes('does not exist')) {
      console.log('[Version History] Table not created yet - run migration 025');
      return res.status(503).json({ error: 'Version history table not created - run migration 025' });
    }
    console.error('[Version History] POST error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/image-creation/version-history/:id
 * Delete a specific version from history
 */
router.delete('/version-history/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM version_history
      WHERE id = ${id}
      RETURNING id, entity_type, entity_id, version_name
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Version not found' });
    }

    console.log('[Version History] Deleted version:', id);
    res.json({ success: true, deleted: result[0] });

  } catch (error) {
    console.error('[Version History] DELETE error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
