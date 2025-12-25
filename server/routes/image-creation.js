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
      referenceImages = [], // Array of image URLs or base64 strings
      size = '1024x1024', // 1024x1024, 1024x1792, 1792x1024
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

    // Build the request - gpt-image-1 supports reference images in the prompt
    let fullPrompt = prompt;

    // If reference images provided, we'll use the edit endpoint or include them in context
    if (referenceImages.length > 0) {
      // For gpt-image-1, reference images can be passed via the images API
      // We'll use the generations endpoint with style guidance in prompt
      fullPrompt = `Create an image in the exact same style as the reference images provided. Style consistency is critical. ${prompt}`;
    }

    // Use DALL-E 3 for now (gpt-image-1 endpoint may have different name)
    // Update this when OpenAI releases gpt-image-1 officially
    const response = await openai.images.generate({
      model: 'gpt-image-1', // or 'dall-e-3' as fallback
      prompt: fullPrompt,
      n: 1,
      size: size,
      quality: quality === 'high' ? 'hd' : 'standard',
      style: style,
      response_format: 'url'
    });

    const imageUrl = response.data[0].url;
    const revisedPrompt = response.data[0].revised_prompt;

    res.json({
      success: true,
      image: {
        url: imageUrl,
        prompt: fullPrompt,
        revisedPrompt,
        size,
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

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: stylePrompt,
      n: 1,
      size: size,
      quality: 'hd'
    });

    res.json({
      success: true,
      image: {
        url: response.data[0].url,
        prompt: stylePrompt,
        revisedPrompt: response.data[0].revised_prompt,
        size
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

        const size = variation.orientation === 'vertical'
          ? '1024x1792'
          : variation.orientation === 'landscape'
            ? '1792x1024'
            : '1024x1024';

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
            const response = await openai.images.generate({
              model: 'gpt-image-1',
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
              size: item.size
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

    // Add system message for image prompt assistance
    const systemMessage = {
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

    const response = await openai.chat.completions.create({
      model: model,
      messages: [systemMessage, ...formattedMessages],
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

    const results = await sql`
      SELECT * FROM image_creation_settings
      WHERE workflow_id = ${workflowId}
    `;

    if (results.length === 0) {
      // Return default settings
      return res.json({
        success: true,
        settings: {
          enabled: false,
          prompt_assistant_model: 'gpt-4o',
          reference_images: [],
          logo_images: [],
          audience_avatars: [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }],
          image_bank: [],
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
          manual_variation_order: []
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
        reference_images: results[0].reference_images || [],
        logo_images: results[0].logo_images || [],
        audience_avatars: results[0].audience_avatars || [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }],
        image_bank: results[0].image_bank || [],
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
        manual_variation_order: results[0].manual_variation_order || []
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
    const {
      enabled,
      prompt_assistant_model,
      reference_images,
      logo_images,
      audience_avatars,
      image_bank,
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
      manual_variation_order
    } = req.body;

    // Check if settings exist
    const existing = await sql`
      SELECT id FROM image_creation_settings WHERE workflow_id = ${workflowId}
    `;

    if (existing.length === 0) {
      // Insert new settings
      const result = await sql`
        INSERT INTO image_creation_settings (
          workflow_id,
          enabled,
          prompt_assistant_model,
          reference_images,
          logo_images,
          audience_avatars,
          image_bank,
          chat_history,
          consultant_chat_history,
          consultant_model,
          worker_chat_history,
          worker_model,
          integration_mode,
          fallback_to_live,
          image_order,
          variation_order_mode,
          manual_variation_order
        ) VALUES (
          ${workflowId},
          ${enabled ?? false},
          ${prompt_assistant_model ?? 'gpt-4o'},
          ${JSON.stringify(reference_images ?? [])},
          ${JSON.stringify(logo_images ?? [])},
          ${JSON.stringify(audience_avatars ?? [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }])},
          ${JSON.stringify(image_bank ?? [])},
          ${JSON.stringify(chat_history ?? [])},
          ${JSON.stringify(consultant_chat_history ?? [])},
          ${consultant_model ?? 'gpt-4o'},
          ${JSON.stringify(worker_chat_history ?? [])},
          ${worker_model ?? 'gpt-4o-mini'},
          ${integration_mode ?? 'bank'},
          ${fallback_to_live ?? true},
          ${JSON.stringify(image_order ?? [])},
          ${variation_order_mode ?? 'sequential'},
          ${JSON.stringify(manual_variation_order ?? [])}
        )
        RETURNING id
      `;

      return res.json({ success: true, id: result[0].id, created: true });
    }

    // Update existing settings
    await sql`
      UPDATE image_creation_settings
      SET
        enabled = COALESCE(${enabled}, enabled),
        prompt_assistant_model = COALESCE(${prompt_assistant_model}, prompt_assistant_model),
        reference_images = COALESCE(${reference_images ? JSON.stringify(reference_images) : null}::jsonb, reference_images),
        logo_images = COALESCE(${logo_images ? JSON.stringify(logo_images) : null}::jsonb, logo_images),
        audience_avatars = COALESCE(${audience_avatars ? JSON.stringify(audience_avatars) : null}::jsonb, audience_avatars),
        image_bank = COALESCE(${image_bank ? JSON.stringify(image_bank) : null}::jsonb, image_bank),
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
        updated_at = CURRENT_TIMESTAMP
      WHERE workflow_id = ${workflowId}
    `;

    res.json({ success: true, updated: true });

  } catch (error) {
    console.error('Save settings error:', error);
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

    if (settings.length === 0 || !settings[0].enabled) {
      return res.json({
        success: true,
        images: [],
        message: 'Image Creation not enabled for this workflow',
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

export default router;
