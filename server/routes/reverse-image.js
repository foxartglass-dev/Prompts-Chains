/**
 * Reverse Image Routes
 * Section 10 - Reverse Engineering Prompts from Reference Images
 * Uses GPT-5.2 vision to analyze images and generate structured prompts
 */

import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';
import OpenAI from 'openai';

const router = express.Router();

// Middleware to check if database is enabled
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

// Get OpenAI client
const getOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  return new OpenAI({ apiKey });
};

// ============================================
// PROJECTS
// ============================================

/**
 * GET /api/reverse-image/projects
 * Get all projects for a website
 */
router.get('/projects', requireDb, async (req, res) => {
  try {
    const { website_id } = req.query;

    if (!website_id) {
      return res.status(400).json({ error: 'website_id is required' });
    }

    const projects = await sql`
      SELECT * FROM reverse_image_projects
      WHERE website_id = ${website_id}
      ORDER BY updated_at DESC
    `;

    res.json(projects);
  } catch (error) {
    console.error('[Reverse Image] Error fetching projects:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/reverse-image/projects
 * Create a new project
 */
router.post('/projects', requireDb, async (req, res) => {
  try {
    const { website_id, name, description } = req.body;

    if (!website_id || !name) {
      return res.status(400).json({ error: 'website_id and name are required' });
    }

    const result = await sql`
      INSERT INTO reverse_image_projects (website_id, name, description)
      VALUES (${website_id}, ${name}, ${description || null})
      RETURNING *
    `;

    res.json(result[0]);
  } catch (error) {
    console.error('[Reverse Image] Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/reverse-image/projects/:id
 */
router.delete('/projects/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    await sql`DELETE FROM reverse_image_projects WHERE id = ${id}`;

    res.json({ success: true });
  } catch (error) {
    console.error('[Reverse Image] Error deleting project:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CONVERSATIONS
// ============================================

/**
 * GET /api/reverse-image/conversations
 * Get all conversations for a project
 */
router.get('/conversations', requireDb, async (req, res) => {
  try {
    const { project_id } = req.query;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    const conversations = await sql`
      SELECT * FROM reverse_image_conversations
      WHERE project_id = ${project_id}
      ORDER BY updated_at DESC
    `;

    res.json(conversations);
  } catch (error) {
    console.error('[Reverse Image] Error fetching conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/reverse-image/conversations
 * Create a new conversation
 */
router.post('/conversations', requireDb, async (req, res) => {
  try {
    const { project_id, name, purpose, process_order } = req.body;

    if (!project_id || !name) {
      return res.status(400).json({ error: 'project_id and name are required' });
    }

    const result = await sql`
      INSERT INTO reverse_image_conversations (project_id, name, purpose, process_order)
      VALUES (${project_id}, ${name}, ${purpose || null}, ${process_order || 'image_first'})
      RETURNING *
    `;

    res.json(result[0]);
  } catch (error) {
    console.error('[Reverse Image] Error creating conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/reverse-image/conversations/:id
 */
router.put('/conversations/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, purpose, process_order } = req.body;

    const result = await sql`
      UPDATE reverse_image_conversations
      SET name = COALESCE(${name}, name),
          purpose = COALESCE(${purpose}, purpose),
          process_order = COALESCE(${process_order}, process_order),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    res.json(result[0]);
  } catch (error) {
    console.error('[Reverse Image] Error updating conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/reverse-image/conversations/:id
 */
router.delete('/conversations/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    await sql`DELETE FROM reverse_image_conversations WHERE id = ${id}`;

    res.json({ success: true });
  } catch (error) {
    console.error('[Reverse Image] Error deleting conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MESSAGES
// ============================================

/**
 * GET /api/reverse-image/messages
 * Get all messages for a conversation
 */
router.get('/messages', requireDb, async (req, res) => {
  try {
    const { conversation_id } = req.query;

    if (!conversation_id) {
      return res.status(400).json({ error: 'conversation_id is required' });
    }

    const messages = await sql`
      SELECT * FROM reverse_image_messages
      WHERE conversation_id = ${conversation_id}
      ORDER BY created_at ASC
    `;

    res.json(messages);
  } catch (error) {
    console.error('[Reverse Image] Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/reverse-image/analyze
 * Send a message with images and get GPT-5.2 to analyze and generate a structured prompt
 */
router.post('/analyze', requireDb, async (req, res) => {
  try {
    const { conversation_id, content, images, template_sections, process_order, model } = req.body;

    if (!conversation_id) {
      return res.status(400).json({ error: 'conversation_id is required' });
    }

    // Save user message first
    const userMessage = await sql`
      INSERT INTO reverse_image_messages (conversation_id, role, content, images)
      VALUES (${conversation_id}, 'user', ${content || ''}, ${JSON.stringify(images || [])}::jsonb)
      RETURNING *
    `;

    // Build the prompt for GPT-5.2
    const sectionNames = template_sections?.map(s => s.title).join(', ') ||
      'Lighting, Subject/Worker, Eyes/Face, Logo/Branding, Environment/Setting, Composition/Framing, Style/Mood, Technical Details';

    const systemPrompt = `You are an expert at analyzing images and generating detailed prompts for AI image generation (specifically for GPT Image 1.5).

Your job is to analyze the reference image(s) provided and create a detailed, structured prompt that would generate a similar image.

Output your analysis in the following JSON format:
{
  "sections": [
    {"id": "lighting", "title": "Lighting", "content": "...", "enabled": true, "order": 1},
    {"id": "subject", "title": "Subject/Worker", "content": "...", "enabled": true, "order": 2},
    {"id": "eyes", "title": "Eyes/Face", "content": "...", "enabled": true, "order": 3},
    {"id": "logo", "title": "Logo/Branding", "content": "...", "enabled": true, "order": 4},
    {"id": "environment", "title": "Environment/Setting", "content": "...", "enabled": true, "order": 5},
    {"id": "composition", "title": "Composition/Framing", "content": "...", "enabled": true, "order": 6},
    {"id": "style", "title": "Style/Mood", "content": "...", "enabled": true, "order": 7},
    {"id": "technical", "title": "Technical Details", "content": "...", "enabled": true, "order": 8}
  ],
  "fullPrompt": "Complete prompt combining all sections..."
}

For each section, write 1-3 detailed sentences describing that aspect of the image.
If a section is not applicable (e.g., no logo visible), set enabled: false and content to a note explaining why.
The fullPrompt should be a coherent, detailed prompt that combines all enabled sections.

Focus on:
- Specific, measurable details (not vague descriptions)
- Professional photography terminology
- Details that would help reproduce the exact look and feel
- For people: natural expressions, eye contact, body language
- For lighting: direction, quality, color temperature
- For composition: framing, focal points, depth of field`;

    // Prepare messages for OpenAI
    const openai = getOpenAI();
    const visionModel = model || 'gpt-4o'; // Use gpt-4o as fallback since gpt-5.2 might not be available yet

    // Build content array with text and images
    const userContent = [];

    if (content) {
      userContent.push({ type: 'text', text: content });
    } else {
      userContent.push({ type: 'text', text: 'Please analyze this image and generate a structured prompt that would recreate it.' });
    }

    // Add images
    if (images && images.length > 0) {
      for (const img of images) {
        if (img.base64) {
          userContent.push({
            type: 'image_url',
            image_url: {
              url: img.base64,
              detail: 'high'
            }
          });
        } else if (img.url) {
          userContent.push({
            type: 'image_url',
            image_url: {
              url: img.url,
              detail: 'high'
            }
          });
        }
      }
    }

    console.log(`[Reverse Image] Analyzing with model: ${visionModel}`);

    const response = await openai.chat.completions.create({
      model: visionModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      max_tokens: 4096,
      response_format: { type: 'json_object' }
    });

    const assistantContent = response.choices[0]?.message?.content;
    let generatedPrompt = null;

    try {
      generatedPrompt = JSON.parse(assistantContent);
    } catch (parseError) {
      console.error('[Reverse Image] Failed to parse GPT response:', parseError);
      // If parsing fails, create a basic structure with the raw content
      generatedPrompt = {
        sections: template_sections || [],
        fullPrompt: assistantContent,
        parseError: true
      };
    }

    // Save assistant message
    const assistantMessage = await sql`
      INSERT INTO reverse_image_messages (conversation_id, role, content, generated_prompt)
      VALUES (
        ${conversation_id},
        'assistant',
        ${generatedPrompt.fullPrompt || assistantContent},
        ${JSON.stringify(generatedPrompt)}::jsonb
      )
      RETURNING *
    `;

    // Update conversation timestamp
    await sql`
      UPDATE reverse_image_conversations
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ${conversation_id}
    `;

    res.json({
      user_message: userMessage[0],
      assistant_message: assistantMessage[0],
      generated_prompt: generatedPrompt
    });

  } catch (error) {
    console.error('[Reverse Image] Error analyzing image:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DRAFTS
// ============================================

/**
 * GET /api/reverse-image/drafts
 * Get all drafts for a conversation
 */
router.get('/drafts', requireDb, async (req, res) => {
  try {
    const { conversation_id } = req.query;

    if (!conversation_id) {
      return res.status(400).json({ error: 'conversation_id is required' });
    }

    const drafts = await sql`
      SELECT * FROM reverse_image_drafts
      WHERE conversation_id = ${conversation_id}
      ORDER BY draft_number ASC
    `;

    res.json(drafts);
  } catch (error) {
    console.error('[Reverse Image] Error fetching drafts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/reverse-image/drafts
 * Create a new draft
 */
router.post('/drafts', requireDb, async (req, res) => {
  try {
    const { conversation_id, tag, description, prompt_text, prompt_sections } = req.body;

    if (!conversation_id || !prompt_text) {
      return res.status(400).json({ error: 'conversation_id and prompt_text are required' });
    }

    // Get next draft number
    const countResult = await sql`
      SELECT COALESCE(MAX(draft_number), 0) + 1 as next_number
      FROM reverse_image_drafts
      WHERE conversation_id = ${conversation_id}
    `;
    const nextNumber = countResult[0].next_number;

    const result = await sql`
      INSERT INTO reverse_image_drafts (
        conversation_id, draft_number, tag, description, prompt_text, prompt_sections
      )
      VALUES (
        ${conversation_id},
        ${nextNumber},
        ${tag || null},
        ${description || null},
        ${prompt_text},
        ${prompt_sections ? JSON.stringify(prompt_sections) : null}::jsonb
      )
      RETURNING *
    `;

    res.json(result[0]);
  } catch (error) {
    console.error('[Reverse Image] Error creating draft:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/reverse-image/drafts/:id
 * Update a draft (e.g., mark as default)
 */
router.put('/drafts/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { tag, description, is_default, default_label } = req.body;

    const result = await sql`
      UPDATE reverse_image_drafts
      SET tag = COALESCE(${tag}, tag),
          description = COALESCE(${description}, description),
          is_default = COALESCE(${is_default}, is_default),
          default_label = COALESCE(${default_label}, default_label)
      WHERE id = ${id}
      RETURNING *
    `;

    res.json(result[0]);
  } catch (error) {
    console.error('[Reverse Image] Error updating draft:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/reverse-image/drafts/:id
 */
router.delete('/drafts/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    await sql`DELETE FROM reverse_image_drafts WHERE id = ${id}`;

    res.json({ success: true });
  } catch (error) {
    console.error('[Reverse Image] Error deleting draft:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TEMPLATES
// ============================================

/**
 * GET /api/reverse-image/templates
 * Get all templates (global baselines + website-specific)
 */
router.get('/templates', requireDb, async (req, res) => {
  try {
    const { website_id } = req.query;

    const templates = await sql`
      SELECT * FROM reverse_image_templates
      WHERE is_baseline = true
         OR website_id = ${website_id || null}
      ORDER BY is_baseline DESC, name ASC
    `;

    res.json(templates);
  } catch (error) {
    console.error('[Reverse Image] Error fetching templates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/reverse-image/templates
 * Create a new template
 */
router.post('/templates', requireDb, async (req, res) => {
  try {
    const { website_id, name, description, sections } = req.body;

    if (!name || !sections) {
      return res.status(400).json({ error: 'name and sections are required' });
    }

    const result = await sql`
      INSERT INTO reverse_image_templates (website_id, name, description, sections)
      VALUES (${website_id || null}, ${name}, ${description || null}, ${JSON.stringify(sections)}::jsonb)
      RETURNING *
    `;

    res.json(result[0]);
  } catch (error) {
    console.error('[Reverse Image] Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/reverse-image/templates/:id
 */
router.put('/templates/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, sections } = req.body;

    const result = await sql`
      UPDATE reverse_image_templates
      SET name = COALESCE(${name}, name),
          description = COALESCE(${description}, description),
          sections = COALESCE(${sections ? JSON.stringify(sections) : null}::jsonb, sections),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    res.json(result[0]);
  } catch (error) {
    console.error('[Reverse Image] Error updating template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/reverse-image/templates/:id
 */
router.delete('/templates/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    // Don't allow deleting baseline templates
    const template = await sql`SELECT is_baseline FROM reverse_image_templates WHERE id = ${id}`;
    if (template[0]?.is_baseline) {
      return res.status(400).json({ error: 'Cannot delete baseline template' });
    }

    await sql`DELETE FROM reverse_image_templates WHERE id = ${id}`;

    res.json({ success: true });
  } catch (error) {
    console.error('[Reverse Image] Error deleting template:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TEST IMAGE GENERATION
// ============================================

/**
 * POST /api/reverse-image/generate-test
 * Generate a test image using the current prompt
 */
router.post('/generate-test', requireDb, async (req, res) => {
  try {
    const { conversation_id, prompt, model } = req.body;

    if (!conversation_id || !prompt) {
      return res.status(400).json({ error: 'conversation_id and prompt are required' });
    }

    const openai = getOpenAI();
    const imageModel = model || 'gpt-image-1'; // Use available model

    console.log(`[Reverse Image] Generating test image with model: ${imageModel}`);

    // Generate image
    const response = await openai.images.generate({
      model: imageModel,
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high'
    });

    const imageUrl = response.data[0]?.url || response.data[0]?.b64_json;

    if (!imageUrl) {
      throw new Error('No image returned from API');
    }

    // Convert b64_json to data URL if needed
    let finalUrl = imageUrl;
    if (response.data[0]?.b64_json) {
      finalUrl = `data:image/png;base64,${response.data[0].b64_json}`;
    }

    // Save as assistant message with test image
    const message = await sql`
      INSERT INTO reverse_image_messages (
        conversation_id, role, content, test_image
      )
      VALUES (
        ${conversation_id},
        'assistant',
        'Generated test image from prompt',
        ${JSON.stringify({ url: finalUrl, prompt })}::jsonb
      )
      RETURNING *
    `;

    res.json({
      message: message[0],
      image_url: finalUrl
    });

  } catch (error) {
    console.error('[Reverse Image] Error generating test image:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PROMPT-IMAGE PAIRS (Training Database)
// ============================================

/**
 * GET /api/reverse-image/pairs
 * Get prompt-image pairs for reference
 */
router.get('/pairs', requireDb, async (req, res) => {
  try {
    const { website_id, category, limit } = req.query;

    let pairs;
    if (website_id) {
      pairs = await sql`
        SELECT * FROM prompt_image_pairs
        WHERE website_id = ${website_id} OR website_id IS NULL
        ORDER BY quality_score DESC NULLS LAST, times_used DESC, created_at DESC
        LIMIT ${parseInt(limit) || 100}
      `;
    } else {
      pairs = await sql`
        SELECT * FROM prompt_image_pairs
        ORDER BY quality_score DESC NULLS LAST, times_used DESC, created_at DESC
        LIMIT ${parseInt(limit) || 100}
      `;
    }

    res.json(pairs);
  } catch (error) {
    console.error('[Reverse Image] Error fetching pairs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/reverse-image/pairs
 * Add a new prompt-image pair
 */
router.post('/pairs', requireDb, async (req, res) => {
  try {
    const { website_id, image_url, image_thumbnail, prompt, prompt_sections, tags, category, source, source_article_id, quality_score } = req.body;

    if (!image_url || !prompt) {
      return res.status(400).json({ error: 'image_url and prompt are required' });
    }

    const result = await sql`
      INSERT INTO prompt_image_pairs (
        website_id, image_url, image_thumbnail, prompt, prompt_sections,
        tags, category, source, source_article_id, quality_score
      )
      VALUES (
        ${website_id || null},
        ${image_url},
        ${image_thumbnail || null},
        ${prompt},
        ${prompt_sections ? JSON.stringify(prompt_sections) : null}::jsonb,
        ${JSON.stringify(tags || [])}::jsonb,
        ${category || null},
        ${source || 'manual'},
        ${source_article_id || null},
        ${quality_score || null}
      )
      RETURNING *
    `;

    res.json(result[0]);
  } catch (error) {
    console.error('[Reverse Image] Error creating pair:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/reverse-image/pairs/:id
 */
router.delete('/pairs/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;

    await sql`DELETE FROM prompt_image_pairs WHERE id = ${id}`;

    res.json({ success: true });
  } catch (error) {
    console.error('[Reverse Image] Error deleting pair:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
