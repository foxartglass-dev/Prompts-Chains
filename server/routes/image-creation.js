/**
 * Image Creation Routes
 * Routes for "7. Image Creation" section - GPT Image API + settings management
 */

import express from 'express';
import OpenAI from 'openai';
import { sql, isDatabaseEnabled } from '../db/index.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

    const response = await openai.images.generate(generateParams);

    const imageUrl = response.data[0].url;
    const revisedPrompt = response.data[0].revised_prompt;

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
    console.error('GPT Image generation error:', error);

    // Handle specific OpenAI errors
    if (error.code === 'model_not_found') {
      // Fallback to dall-e-3 if gpt-image-1 not available
      try {
        const apiKey = req.body.openaiApiKey || process.env.OPENAI_API_KEY;
        const openai = new OpenAI({ apiKey });

        const response = await openai.images.generate({
          model: 'dall-e-3',
          prompt: req.body.prompt,
          n: 1,
          size: req.body.size || '1024x1024',
          quality: req.body.quality === 'high' ? 'hd' : 'standard',
          style: req.body.style || 'vivid'
        });

        return res.json({
          success: true,
          image: {
            url: response.data[0].url,
            prompt: req.body.prompt,
            revisedPrompt: response.data[0].revised_prompt,
            model: 'dall-e-3',
            note: 'Used DALL-E 3 fallback'
          }
        });
      } catch (fallbackError) {
        return res.status(500).json({ error: fallbackError.message });
      }
    }

    res.status(500).json({ error: error.message });
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

    const response = await openai.images.generate(generateParams);

    res.json({
      success: true,
      image: {
        url: response.data[0].url,
        prompt: stylePrompt,
        revisedPrompt: response.data[0].revised_prompt,
        model: selectedModel,
        size: adjustedSize
      }
    });

  } catch (error) {
    console.error('Reference-based generation error:', error);

    // Fallback to dall-e-3
    if (error.code === 'model_not_found' || error.message?.includes('gpt-image-1')) {
      try {
        const apiKey = req.body.openaiApiKey || process.env.OPENAI_API_KEY;
        const openai = new OpenAI({ apiKey });

        const response = await openai.images.generate({
          model: 'dall-e-3',
          prompt: req.body.prompt,
          n: 1,
          size: req.body.size || '1024x1024',
          quality: 'hd'
        });

        return res.json({
          success: true,
          image: {
            url: response.data[0].url,
            prompt: req.body.prompt,
            revisedPrompt: response.data[0].revised_prompt,
            model: 'dall-e-3',
            note: 'Used DALL-E 3 fallback'
          }
        });
      } catch (fallbackError) {
        return res.status(500).json({ error: fallbackError.message });
      }
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/image-creation/batch-generate
 * Generate multiple images from prompts + variations
 */
router.post('/batch-generate', async (req, res) => {
  try {
    const {
      mainPrompt,
      variations = [], // Array of {id, name, prompt, orientation}
      referenceImageUrls = [],
      quantity = 1, // How many of each variation
      model = 'gpt-image-1.5', // Default to latest model
      quality = 'high',
      openaiApiKey
    } = req.body;

    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key is required' });
    }

    if (!mainPrompt && variations.length === 0) {
      return res.status(400).json({ error: 'Main prompt or variations required' });
    }

    const openai = new OpenAI({ apiKey });
    const results = [];
    const errors = [];

    // Build prompts for each variation
    const promptsToGenerate = [];

    for (const variation of variations) {
      for (let i = 0; i < quantity; i++) {
        const fullPrompt = mainPrompt
          ? `${mainPrompt}\n\nVariation: ${variation.prompt}`
          : variation.prompt;

        // GPT-Image models use different sizes than DALL-E
        let size;
        if (model.startsWith('gpt-image')) {
          size = variation.orientation === 'vertical'
            ? '1024x1536'
            : variation.orientation === 'landscape'
              ? '1536x1024'
              : '1024x1024';
        } else {
          size = variation.orientation === 'vertical'
            ? '1024x1792'
            : variation.orientation === 'landscape'
              ? '1792x1024'
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

    // Generate images (with concurrency limit)
    const concurrencyLimit = 2;
    for (let i = 0; i < promptsToGenerate.length; i += concurrencyLimit) {
      const batch = promptsToGenerate.slice(i, i + concurrencyLimit);

      const batchResults = await Promise.all(
        batch.map(async (item) => {
          try {
            // Build generation params based on model
            const generateParams = {
              model: model,
              prompt: item.prompt,
              n: 1,
              size: item.size,
            };

            // Add quality param based on model type
            if (model === 'dall-e-3') {
              generateParams.quality = quality === 'high' ? 'hd' : 'standard';
            } else if (model.startsWith('gpt-image')) {
              generateParams.quality = quality;
            }

            console.log(`[Batch Generate] Using model: ${model}, size: ${item.size}`);
            const response = await openai.images.generate(generateParams);

            return {
              success: true,
              url: response.data[0].url,
              prompt: item.prompt,
              revisedPrompt: response.data[0].revised_prompt,
              variation: item.variation,
              variationId: item.variationId,
              orientation: item.orientation,
              size: item.size,
              model: model
            };
          } catch (error) {
            // Try fallback to dall-e-3
            try {
              const response = await openai.images.generate({
                model: 'dall-e-3',
                prompt: item.prompt,
                n: 1,
                size: item.size,
                quality: 'hd'
              });

              return {
                success: true,
                url: response.data[0].url,
                prompt: item.prompt,
                revisedPrompt: response.data[0].revised_prompt,
                variation: item.variation,
                variationId: item.variationId,
                orientation: item.orientation,
                size: item.size,
                model: 'dall-e-3'
              };
            } catch (fallbackError) {
              return {
                success: false,
                error: fallbackError.message,
                variation: item.variation,
                variationId: item.variationId
              };
            }
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
 * Chat with GPT-4o about image prompts, get critiques, suggestions
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

    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key is required' });
    }

    if (!messages.length) {
      return res.status(400).json({ error: 'Messages required' });
    }

    const openai = new OpenAI({ apiKey });

    // Format messages for OpenAI API
    const formattedMessages = messages.map(msg => {
      if (msg.images && msg.images.length > 0) {
        // Message with images
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
      return {
        role: msg.role,
        content: msg.content
      };
    });

    // Check if first message is already a system message (custom context injection)
    const hasCustomSystemMessage = messages.length > 0 && messages[0].role === 'system';

    // Default system message for image prompt assistance
    const defaultSystemMessage = {
      role: 'system',
      content: `You are an expert image prompt engineer helping create consistent, high-quality image generation prompts for a business marketing context.

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

When creating prompts, be specific and technical. Include details about lighting, camera angle, color grading, and mood.`
    };

    // Build final messages array
    // If custom system message exists, don't add default; otherwise prepend default
    let finalMessages = hasCustomSystemMessage
      ? formattedMessages
      : [defaultSystemMessage, ...formattedMessages];

    // If context images provided, add them to the first user message
    if (contextImages.length > 0 && !hasCustomSystemMessage) {
      // Find first user message and add context images
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
              image_url: { url: img, detail: 'low' } // Use 'low' for context images to save tokens
            }))
          ]
        };
      }
    }

    const response = await openai.chat.completions.create({
      model: model,
      messages: finalMessages,
      max_tokens: 2000
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
    res.status(500).json({ error: error.message });
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
 * GET /api/image-creation/settings/:workflowId
 * Get image creation settings for a workflow
 */
router.get('/settings/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;
    console.log('[Image Creation API] GET settings for workflow:', workflowId);

    const results = await sql`
      SELECT * FROM image_creation_settings
      WHERE workflow_id = ${workflowId}
    `;

    console.log('[Image Creation API] Found records:', results.length);

    if (results.length === 0) {
      console.log('[Image Creation API] No settings found, returning defaults');
      // Return default settings
      return res.json({
        success: true,
        settings: {
          enabled: false,
          prompt_assistant_model: 'gpt-4o',
          image_generation_model: 'gpt-image-1.5',
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
          smart_matching_mode: 'bank_first'
        },
        isNew: true
      });
    }

    res.json({
      success: true,
      settings: {
        id: results[0].id,
        enabled: results[0].enabled,
        prompt_assistant_model: results[0].prompt_assistant_model,
        image_generation_model: results[0].image_generation_model || 'gpt-image-1.5',
        reference_images: results[0].reference_images || [],
        logo_images: results[0].logo_images || [],
        audience_avatars: results[0].audience_avatars || [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }],
        image_bank: results[0].image_bank || [],
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
        smart_matching_mode: results[0].smart_matching_mode || 'bank_first'
      }
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/image-creation/settings/:workflowId
 * Save/update image creation settings for a workflow
 */
router.put('/settings/:workflowId', requireDb, async (req, res) => {
  try {
    const { workflowId } = req.params;
    console.log('[Image Creation API] PUT settings for workflow:', workflowId);
    console.log('[Image Creation API] Received avatars:', req.body.audience_avatars?.length || 0);
    const {
      enabled,
      prompt_assistant_model,
      image_generation_model,
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
      // Smart Content Matching
      smart_matching_enabled,
      smart_matching_mode
    } = req.body;

    // Check if settings exist
    const existing = await sql`
      SELECT id FROM image_creation_settings WHERE workflow_id = ${workflowId}
    `;

    console.log('[Image Creation API] Existing record:', existing.length > 0 ? existing[0].id : 'none');

    if (existing.length === 0) {
      // Insert new settings
      console.log('[Image Creation API] Creating new settings record...');
      const result = await sql`
        INSERT INTO image_creation_settings (
          workflow_id,
          enabled,
          prompt_assistant_model,
          image_generation_model,
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
          smart_matching_enabled,
          smart_matching_mode
        ) VALUES (
          ${workflowId},
          ${enabled ?? false},
          ${prompt_assistant_model ?? 'gpt-4o'},
          ${image_generation_model ?? 'gpt-image-1.5'},
          ${JSON.stringify(reference_images ?? [])},
          ${JSON.stringify(logo_images ?? [])},
          ${JSON.stringify(audience_avatars ?? [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }])},
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
          ${smart_matching_enabled ?? false},
          ${smart_matching_mode ?? 'bank_first'}
        )
        RETURNING id
      `;

      console.log('[Image Creation API] Created new record with id:', result[0].id);
      return res.json({ success: true, id: result[0].id, created: true });
    }

    // Update existing settings
    console.log('[Image Creation API] Updating existing record...');
    await sql`
      UPDATE image_creation_settings
      SET
        enabled = COALESCE(${enabled}, enabled),
        prompt_assistant_model = COALESCE(${prompt_assistant_model}, prompt_assistant_model),
        image_generation_model = COALESCE(${image_generation_model}, image_generation_model),
        reference_images = COALESCE(${reference_images ? JSON.stringify(reference_images) : null}::jsonb, reference_images),
        logo_images = COALESCE(${logo_images ? JSON.stringify(logo_images) : null}::jsonb, logo_images),
        audience_avatars = COALESCE(${audience_avatars ? JSON.stringify(audience_avatars) : null}::jsonb, audience_avatars),
        image_bank = COALESCE(${image_bank ? JSON.stringify(image_bank) : null}::jsonb, image_bank),
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
        smart_matching_enabled = COALESCE(${smart_matching_enabled}, smart_matching_enabled),
        smart_matching_mode = COALESCE(${smart_matching_mode}, smart_matching_mode),
        updated_at = CURRENT_TIMESTAMP
      WHERE workflow_id = ${workflowId}
    `;

    console.log('[Image Creation API] Update complete for workflow:', workflowId);
    res.json({ success: true, updated: true });

  } catch (error) {
    console.error('[Image Creation API] Save settings error:', error);
    res.status(500).json({ error: error.message });
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
      openaiApiKey
    } = req.body;

    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

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
    const imageGenModel = config.image_generation_model || 'gpt-image-1.5';

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
        // Generate the image
        const openai = new OpenAI({ apiKey });

        // Adjust size for GPT-Image models
        let size = '1024x1536'; // Default to portrait for hero images
        if (imageGenModel.startsWith('gpt-image')) {
          const sizeMap = {
            '1792x1024': '1536x1024',
            '1024x1792': '1024x1536',
          };
          size = sizeMap[size] || size;
        }

        const generateParams = {
          model: imageGenModel,
          prompt: prompt,
          n: 1,
          size: size,
        };

        if (imageGenModel === 'dall-e-3') {
          generateParams.quality = 'hd';
        } else if (imageGenModel.startsWith('gpt-image')) {
          generateParams.quality = 'high';
        }

        const response = await openai.images.generate(generateParams);

        generatedImage = {
          id: `img-smart-${Date.now()}`,
          url: response.data[0].url,
          prompt: prompt,
          revisedPrompt: response.data[0].revised_prompt,
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

export default router;
