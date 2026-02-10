import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';

const router = express.Router();

// Supported vision-capable models
const VISION_MODELS = {
  'gpt-5.2-2025-12-11': { provider: 'openai', supportsImages: true },
  'gpt-4o': { provider: 'openai', supportsImages: true },
  'gpt-4o-mini': { provider: 'openai', supportsImages: true },
  'claude-sonnet-4-5-20250929': { provider: 'anthropic', supportsImages: true },
  'claude-3-5-sonnet-20241022': { provider: 'anthropic', supportsImages: true },
  'claude-3-opus-20240229': { provider: 'anthropic', supportsImages: true },
  'gemini-2.5-pro': { provider: 'google', supportsImages: true },
  'gemini-2.5-flash': { provider: 'google', supportsImages: true },
};

// System prompt for the Prompt Assistant
const ASSISTANT_SYSTEM_PROMPT = `You are an expert AI Image Prompt Assistant specializing in crafting effective prompts for AI image generation models (DALL-E 3, GPT Image, FLUX, Ideogram, Seedream, etc.).

Your role is to help users:
1. Understand how different image generation models interpret prompts
2. Refine guardrails and instructions for consistent image generation
3. Suggest specific prompt techniques and wording
4. Analyze reference images and help incorporate their style
5. Troubleshoot common issues (logo visibility, pose consistency, style drift)
6. Read and analyze articles to create comprehensive image generation plans
7. Create batch image strategies based on article content

When users share their current settings or reference images, analyze them and provide actionable advice.

DIRECT FIELD EDITING:
You can DIRECTLY UPDATE fields in the Image section by using special code blocks. When you use these, the fields will be automatically updated.

GUARDRAILS FIELDS:
\`\`\`instructions
Main guardrails/instructions text (replaces instructions field)
\`\`\`

\`\`\`uniform
Worker appearance description (replaces uniform/appearance field)
\`\`\`

\`\`\`subject
Default subject description (replaces default subject field)
\`\`\`

\`\`\`avoid
Things to avoid, comma-separated (replaces avoid field)
\`\`\`

\`\`\`stylepreferences
Visual style preferences (replaces style preferences field)
\`\`\`

PROMPT TEMPLATES:
\`\`\`mainprompt
Avatar's main prompt template - use {placeholders} for dynamic content
\`\`\`

\`\`\`smartprompt
Smart prompt guidance text for GPT-guided generation
\`\`\`

MATCHING RULES (for Smart Content Matching):
\`\`\`matchingrule1
Primary keywords matching rule
\`\`\`

\`\`\`matchingrule2
Secondary keywords fallback rule
\`\`\`

\`\`\`matchingrule3
No duplicate primaries rule
\`\`\`

\`\`\`matchingrule4
Different primaries for secondary matches rule
\`\`\`

\`\`\`placementrule
Image placement algorithm rule
\`\`\`

\`\`\`smartmatchingrule
Smart matching algorithm rule
\`\`\`

TESTING:
\`\`\`testprompt
A test prompt to try (updates Testing Mode)
\`\`\`

Use these blocks when you and the user agree on changes. You can update multiple fields in one response.

SUGGESTING WITHOUT APPLYING:
If you want to suggest something for the user to review before applying, use:
\`\`\`guardrail
Suggested text here (user must click "Add to Guardrails" to apply)
\`\`\`

ARTICLE ANALYSIS:
When you receive article content in the context, analyze it to understand:
- The main topics and services discussed
- Visual scenarios that would complement the content
- Consistent themes across multiple articles
- Opportunities for hero images, inline images, and supporting visuals

When creating image plans, consider:
- Reading ALL articles first to understand the full scope
- Creating a cohesive visual strategy across articles
- Identifying recurring themes that need consistent imagery
- Suggesting specific prompts for each article section

Be concise but thorough. Focus on practical, actionable advice based on how modern image AI actually works.`;

// Call OpenAI API with vision support
async function callOpenAI(messages, model, apiKey, maxTokens = 2048) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      messages: [
        { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
        ...messages
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI API error: ${response.status}`);
  }

  return {
    content: data.choices[0]?.message?.content || '',
    usage: {
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    },
  };
}

// Call Anthropic API with vision support
async function callAnthropic(messages, model, apiKey, maxTokens = 2048) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2024-01-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: ASSISTANT_SYSTEM_PROMPT,
      messages,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Anthropic API error: ${response.status}`);
  }

  return {
    content: data.content?.[0]?.text || '',
    usage: {
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    },
  };
}

// Call Google Gemini API with vision support
async function callGemini(messages, model, apiKey, maxTokens = 2048) {
  // Convert messages to Gemini format
  const geminiMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: Array.isArray(msg.content)
      ? msg.content.map(part => {
          if (part.type === 'text') return { text: part.text };
          if (part.type === 'image_url') {
            // Extract base64 from data URL
            const base64Match = part.image_url.url.match(/^data:(.+);base64,(.+)$/);
            if (base64Match) {
              return {
                inline_data: {
                  mime_type: base64Match[1],
                  data: base64Match[2]
                }
              };
            }
            // For URLs, Gemini needs them as fileData (not supported in simple mode)
            return { text: `[Image: ${part.image_url.url}]` };
          }
          return { text: JSON.stringify(part) };
        })
      : [{ text: msg.content }]
  }));

  // Add system instruction as first user message if needed
  const contents = [
    { role: 'user', parts: [{ text: ASSISTANT_SYSTEM_PROMPT + '\n\nNow, please respond to the following:' }] },
    { role: 'model', parts: [{ text: 'Understood! I\'m ready to help you craft effective image prompts. What would you like to work on?' }] },
    ...geminiMessages
  ];

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Gemini API error: ${response.status}`);
  }

  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
    },
  };
}

// Format message content for OpenAI vision API
function formatOpenAIMessage(message) {
  if (message.images && message.images.length > 0) {
    const content = [
      { type: 'text', text: message.content }
    ];

    for (const img of message.images) {
      content.push({
        type: 'image_url',
        image_url: {
          url: img, // Can be data URL or regular URL
          detail: 'auto'
        }
      });
    }

    return { role: message.role, content };
  }

  return { role: message.role, content: message.content };
}

// Format message content for Anthropic vision API
function formatAnthropicMessage(message) {
  if (message.images && message.images.length > 0) {
    const content = [];

    for (const img of message.images) {
      // Extract base64 and media type from data URL
      const base64Match = img.match(/^data:(.+);base64,(.+)$/);
      if (base64Match) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: base64Match[1],
            data: base64Match[2]
          }
        });
      } else {
        // For regular URLs, use URL source (if supported)
        content.push({
          type: 'image',
          source: {
            type: 'url',
            url: img
          }
        });
      }
    }

    content.push({ type: 'text', text: message.content });

    return { role: message.role, content };
  }

  return { role: message.role, content: message.content };
}

/**
 * POST /api/prompt-assistant/chat
 *
 * Chat with the AI Prompt Assistant
 *
 * Body:
 * - model: string (model ID like 'gpt-4o', 'claude-sonnet-4-5-20250929', etc.)
 * - messages: Array<{ role: 'user' | 'assistant', content: string, images?: string[] }>
 * - context: {
 *     guardrails?: { instructions, uniformDescription, defaultSubject, avoidList },
 *     referenceImages?: number,
 *     logoImages?: number,
 *     actionShots?: number,
 *     problemAreas?: Array<{ name, context }>,
 *   }
 */
router.post('/chat', async (req, res) => {
  try {
    const { model = 'gpt-4o', messages, context } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Get model info
    const modelInfo = VISION_MODELS[model];
    if (!modelInfo) {
      return res.status(400).json({
        error: `Unsupported model: ${model}. Supported: ${Object.keys(VISION_MODELS).join(', ')}`
      });
    }

    // Get API key based on provider
    let apiKey;
    switch (modelInfo.provider) {
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY;
        break;
      case 'anthropic':
        apiKey = process.env.ANTHROPIC_API_KEY;
        break;
      case 'google':
        apiKey = process.env.GEMINI_API_KEY;
        break;
    }

    if (!apiKey) {
      return res.status(400).json({
        error: `API key not configured for ${modelInfo.provider}`
      });
    }

    // Build COMPREHENSIVE context message if provided
    let contextMessage = '';
    if (context) {
      const parts = [];

      // Current avatar
      if (context.activeAvatar) {
        parts.push(`## Active Avatar: ${context.activeAvatar.name}${context.activeAvatar.tag ? ` (Tag: ${context.activeAvatar.tag})` : ''}`);
      }

      // Main prompt template - THE KEY PIECE
      if (context.mainPrompt) {
        parts.push('\n## Main Prompt Template (Unique to Tag):');
        parts.push('```');
        parts.push(context.mainPrompt);
        parts.push('```');
      }
      if (context.mainPromptPersistent) {
        parts.push('\n## Main Prompt (Persistent — All Tags):');
        parts.push('```');
        parts.push(context.mainPromptPersistent);
        parts.push('```');
      }

      // Placeholder system
      if (context.placeholderMode === 'advanced' && context.placeholderCategories?.length > 0) {
        parts.push('\n## Placeholder Categories (Advanced Mode):');
        for (const cat of context.placeholderCategories) {
          parts.push(`\n### ${cat.name} (${cat.placeholder})${cat.isRandomized ? ' [RANDOMIZED]' : ''}`);
          for (const opt of cat.options) {
            const keywords = opt.primaryKeywords?.length > 0 ? ` [Keywords: ${opt.primaryKeywords.join(', ')}]` : '';
            parts.push(`  ${opt.number}. "${opt.text}"${keywords}`);
          }
        }
      } else if (context.variations?.length > 0) {
        parts.push('\n## Variations (Simple Mode):');
        for (const v of context.variations) {
          parts.push(`- **${v.name}** (${v.orientation}): "${v.prompt}"`);
        }
      }

      // Guardrails
      if (context.guardrails) {
        parts.push('\n## Guardrails:');
        if (context.guardrails.instructions) {
          parts.push(`**Instructions:** ${context.guardrails.instructions}`);
        }
        if (context.guardrails.uniformDescription) {
          parts.push(`**Uniform/Appearance:** ${context.guardrails.uniformDescription}`);
        }
        if (context.guardrails.defaultSubject) {
          parts.push(`**Default Subject:** ${context.guardrails.defaultSubject}`);
        }
        if (context.guardrails.avoidList) {
          parts.push(`**Avoid:** ${context.guardrails.avoidList}`);
        }
      }

      // Guided GPT persistent instructions (shared across all tags)
      if (context.guidedInstructionsPersistent) {
        parts.push('\n## Guided GPT Instructions (Persistent — All Tags):');
        parts.push(context.guidedInstructionsPersistent);
      }

      // Reference images with detail
      if (context.referenceImages?.length > 0) {
        parts.push(`\n## Reference Images (${context.referenceImages.length} uploaded):`);
        for (const img of context.referenceImages) {
          const tags = img.tags?.length > 0 ? ` [Tags: ${img.tags.join(', ')}]` : '';
          parts.push(`- ${img.filename}${tags}`);
        }
      }

      // Logo and action shots
      if (context.logoImages?.length > 0 || context.actionShots?.length > 0) {
        parts.push('\n## Logo Assets:');
        if (context.logoImages?.length > 0) {
          parts.push(`- **Logos:** ${context.logoImages.length} uploaded (${context.logoImages.map(l => l.filename).join(', ')})`);
        }
        if (context.actionShots?.length > 0) {
          parts.push(`- **Action Shots:** ${context.actionShots.length} (showing logo in real use)`);
        }
      }

      // Image bank examples - what has worked before
      if (context.imageBankExamples?.length > 0) {
        parts.push('\n## Image Bank Examples (recent successful generations):');
        for (const img of context.imageBankExamples) {
          const status = img.used ? ' [USED]' : '';
          parts.push(`- **${img.title || img.variation}**${status} (${img.model || 'unknown model'}):`);
          parts.push(`  Prompt: "${img.prompt}"`);
        }
      }

      // Active problem areas WITH their solution attempts
      if (context.problemAreas?.length > 0) {
        parts.push('\n## Active Problem Areas (currently working on):');
        for (const area of context.problemAreas) {
          parts.push(`\n### ${area.name} [${area.priority} priority]`);
          parts.push(`Context: ${area.context || 'No context provided'}`);
          if (area.solutions?.length > 0) {
            parts.push('Solution attempts:');
            for (const sol of area.solutions) {
              const statusEmoji = sol.status === 'working' ? '✓' : sol.status === 'failed' ? '✗' : '?';
              parts.push(`  ${statusEmoji} [${sol.status}] ${sol.miniContext || 'No context'}`);
              parts.push(`    Prompt: "${sol.promptText}"`);
              if (sol.notes) parts.push(`    Notes: ${sol.notes}`);
            }
          }
        }
      }

      // Solved problems - for reference
      if (context.solvedProblems?.length > 0) {
        parts.push('\n## Solved Problems (what worked!):');
        for (const prob of context.solvedProblems) {
          parts.push(`- **${prob.name}**: ${prob.context || ''}`);
          if (prob.solvedWith) parts.push(`  Solution: "${prob.solvedWith}"`);
          if (prob.solvedNotes) parts.push(`  Notes: ${prob.solvedNotes}`);
        }
      }

      // All avatars for reference
      if (context.allAvatars?.length > 1) {
        parts.push(`\n## All Avatars: ${context.allAvatars.map(a => `${a.name}${a.tag ? ` (${a.tag})` : ''}${a.hasPrompt ? '' : ' [no prompt]'}`).join(', ')}`);
      }

      // GUIDED GPT PROMPT SETTINGS - Smart Prompt, Matching Rules
      if (context.smartPromptGuidance) {
        parts.push('\n## Smart Prompt Guidance (Unique to Tag):');
        parts.push('```');
        parts.push(context.smartPromptGuidance);
        parts.push('```');
        parts.push('*You can edit this by outputting a ```smartprompt code block.*');
      }
      if (context.smartPromptPersistent) {
        parts.push('\n## Smart Prompt Guidance (Persistent — All Tags):');
        parts.push(context.smartPromptPersistent);
      }
      if (context.matchingRules) {
        const rules = context.matchingRules;
        const hasAny = rules.rule1 || rules.rule2 || rules.rule3 || rules.rule4;
        if (hasAny) {
          parts.push('\n## Matching Rules:');
          if (rules.rule1) parts.push(`**Rule 1:** ${rules.rule1}`);
          if (rules.rule2) parts.push(`**Rule 2:** ${rules.rule2}`);
          if (rules.rule3) parts.push(`**Rule 3:** ${rules.rule3}`);
          if (rules.rule4) parts.push(`**Rule 4:** ${rules.rule4}`);
          parts.push('*You can edit these by outputting ```matchingrule1 through ```matchingrule4 code blocks.*');
        }
      }
      if (context.placementRule) {
        parts.push(`\n## Placement Rule: ${context.placementRule}`);
        parts.push('*You can edit this by outputting a ```placementrule code block.*');
      }
      if (context.smartMatchingRule) {
        parts.push(`\n## Smart Matching Rule: ${context.smartMatchingRule}`);
        parts.push('*You can edit this by outputting a ```smartmatchingrule code block.*');
      }

      // TESTING MODE - Current prompt that AI can edit
      if (context.testingMode) {
        parts.push('\n## TESTING MODE (Active Sandbox):');
        parts.push(`**Tab:** "${context.testingMode.activeTab}" | **Model:** ${context.testingMode.model}`);
        if (context.testingMode.currentPrompt) {
          parts.push(`**Current Prompt in Testing Mode:**`);
          parts.push('```');
          parts.push(context.testingMode.currentPrompt);
          parts.push('```');
        } else {
          parts.push('*No prompt currently in Testing Mode*');
        }
        if (context.testingMode.fullHistory?.length > 0) {
          parts.push(`\n**Full Test History (${context.testingMode.fullHistory.length} iterations):**`);
          context.testingMode.fullHistory.forEach((h, idx) => {
            const iterNum = context.testingMode.fullHistory.length - idx; // Newest first, so count backwards
            parts.push(`\n[Iteration ${iterNum}] (${h.model}, ${new Date(h.timestamp).toLocaleTimeString()}):`);
            parts.push(`Prompt: "${h.prompt}"`);
            if (h.imageUrl) {
              parts.push(`Generated Image: ${h.imageUrl}`);
            }
          });
        }
        parts.push('\n**IMPORTANT: You can directly edit the Testing Mode prompt!**');
        parts.push('To update/modify the test prompt, output your new or modified prompt inside a ```testprompt code block.');
        parts.push('Example: When the user asks you to adjust the prompt, output:');
        parts.push('```testprompt');
        parts.push('Your improved prompt text here...');
        parts.push('```');
        parts.push('This will automatically update the Testing Mode prompt box so they can generate a new test image.');
      }

      if (parts.length > 0) {
        contextMessage = `\n\n---\n**USER'S COMPLETE IMAGE PROMPT SETUP:**\n${parts.join('\n')}\n---\n\n`;
      }
    }

    // Inject context into the first user message
    const processedMessages = messages.map((msg, idx) => {
      if (idx === 0 && msg.role === 'user' && contextMessage) {
        return { ...msg, content: contextMessage + msg.content };
      }
      return msg;
    });

    // Call the appropriate API
    let result;
    switch (modelInfo.provider) {
      case 'openai':
        result = await callOpenAI(
          processedMessages.map(formatOpenAIMessage),
          model,
          apiKey
        );
        break;
      case 'anthropic':
        result = await callAnthropic(
          processedMessages.map(formatAnthropicMessage),
          model,
          apiKey
        );
        break;
      case 'google':
        result = await callGemini(
          processedMessages.map(formatOpenAIMessage), // Gemini uses similar format
          model,
          apiKey
        );
        break;
    }

    res.json({
      success: true,
      model,
      provider: modelInfo.provider,
      response: result.content,
      usage: result.usage,
    });

  } catch (error) {
    console.error('[Prompt Assistant] Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to get AI response'
    });
  }
});

/**
 * POST /api/prompt-assistant/guided-generate
 * Generate a prompt based on a message/instruction
 * Used by Auto-Refine to create and refine prompts
 */
router.post('/guided-generate', async (req, res) => {
  try {
    const { message, workflowId, model = 'gpt-5.2-2025-12-11', context = {} } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Build the system prompt for prompt generation
    const systemPrompt = `You are an expert at writing prompts for AI image generation models. Your task is to create or refine image generation prompts that achieve specific goals.

IMPORTANT RULES:
1. Write ONLY the image prompt - no explanations, no markdown, no extra text
2. Be specific and detailed
3. Include style cues (photorealistic, professional, etc.)
4. Specify camera angle, lighting, setting
5. Avoid ambiguous terms
6. If refining, address the specific issues mentioned

Output format: Just the prompt text, nothing else.`;

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.startsWith('gpt-5') ? 'gpt-5.2-2025-12-11' : 'gpt-4o',
        max_completion_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'OpenAI API error');
    }

    const generatedPrompt = data.choices?.[0]?.message?.content?.trim() || '';

    res.json({
      success: true,
      response: generatedPrompt,
      model
    });

  } catch (error) {
    console.error('[Prompt Assistant - Guided Generate] Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate prompt'
    });
  }
});

/**
 * POST /api/prompt-assistant/evaluate-image
 * Evaluate a generated image against a goal using vision
 * Used by Auto-Refine to judge if an image meets criteria
 */
router.post('/evaluate-image', async (req, res) => {
  try {
    const { imageUrl, goal, prompt, workflowId, model = 'gpt-5.2-2025-12-11' } = req.body;

    if (!imageUrl || !goal) {
      return res.status(400).json({ error: 'imageUrl and goal are required' });
    }

    // Get API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Build the evaluation prompt
    const evaluationPrompt = `You are an expert image evaluator. Analyze this image against the specified goal and determine if it meets the criteria.

GOAL/CRITERIA:
${goal}

PROMPT USED TO GENERATE:
${prompt}

EVALUATION INSTRUCTIONS:
1. Carefully examine the image
2. Compare it against EACH point in the goal/criteria
3. Be strict but fair - partial matches don't count as success
4. Identify specific issues if the goal is not met

Respond in this exact JSON format (no markdown, just JSON):
{
  "meetsGoal": true/false,
  "evaluation": "Brief summary of what you see in the image",
  "refinementNotes": "If meetsGoal is false, explain specifically what's wrong and how the prompt should be changed"
}`;

    // Call OpenAI with vision
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.startsWith('gpt-5') ? 'gpt-5.2-2025-12-11' : 'gpt-4o',
        max_completion_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: evaluationPrompt },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'OpenAI API error');
    }

    const responseText = data.choices?.[0]?.message?.content?.trim() || '';

    // Parse the JSON response
    let evaluation = 'Could not parse evaluation';
    let meetsGoal = false;
    let refinementNotes = '';

    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        meetsGoal = parsed.meetsGoal === true;
        evaluation = parsed.evaluation || responseText;
        refinementNotes = parsed.refinementNotes || '';
      } else {
        // If no JSON, treat the whole response as evaluation
        evaluation = responseText;
        // Try to detect if it seems positive
        meetsGoal = responseText.toLowerCase().includes('meets') &&
                    !responseText.toLowerCase().includes('does not meet') &&
                    !responseText.toLowerCase().includes('doesn\'t meet');
      }
    } catch (parseError) {
      console.error('[Evaluate Image] JSON parse error:', parseError);
      evaluation = responseText;
    }

    res.json({
      success: true,
      meetsGoal,
      evaluation,
      refinementNotes,
      model
    });

  } catch (error) {
    console.error('[Prompt Assistant - Evaluate Image] Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to evaluate image'
    });
  }
});

// ============================================
// ARTICLE READING FOR AI ASSISTANT
// ============================================

/**
 * GET /api/prompt-assistant/articles
 * Fetch articles for the AI Prompt Assistant to analyze
 * Supports filtering by workflowId, websiteId, clientId
 */
router.get('/articles', async (req, res) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const { workflowId, websiteId, clientId, ids, limit = 20 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 20, 50); // Max 50 articles

    let articles;

    // If specific IDs are provided, fetch those articles
    if (ids) {
      const articleIds = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (articleIds.length > 0) {
        articles = await sql`
          SELECT a.id, a.keyword, a.tag, a.final_content, a.meta_titles, a.meta_descriptions,
                 a.chain_outputs, a.word_count, a.status,
                 ws.name as website_name, c.name as client_name
          FROM articles a
          LEFT JOIN websites ws ON a.website_id = ws.id
          LEFT JOIN clients c ON a.client_id = c.id
          WHERE a.id = ANY(${articleIds})
          ORDER BY a.created_at DESC
        `;
      } else {
        articles = [];
      }
    } else if (workflowId) {
      articles = await sql`
        SELECT a.id, a.keyword, a.tag, a.final_content, a.meta_titles, a.meta_descriptions,
               a.chain_outputs, a.word_count, a.status,
               ws.name as website_name, c.name as client_name
        FROM articles a
        LEFT JOIN websites ws ON a.website_id = ws.id
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE a.workflow_id = ${workflowId}
        ORDER BY a.created_at DESC
        LIMIT ${parsedLimit}
      `;
    } else if (websiteId) {
      articles = await sql`
        SELECT a.id, a.keyword, a.tag, a.final_content, a.meta_titles, a.meta_descriptions,
               a.chain_outputs, a.word_count, a.status,
               ws.name as website_name, c.name as client_name
        FROM articles a
        LEFT JOIN websites ws ON a.website_id = ws.id
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE a.website_id = ${websiteId}
        ORDER BY a.created_at DESC
        LIMIT ${parsedLimit}
      `;
    } else if (clientId) {
      articles = await sql`
        SELECT a.id, a.keyword, a.tag, a.final_content, a.meta_titles, a.meta_descriptions,
               a.chain_outputs, a.word_count, a.status,
               ws.name as website_name, c.name as client_name
        FROM articles a
        LEFT JOIN websites ws ON a.website_id = ws.id
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE a.client_id = ${clientId}
        ORDER BY a.created_at DESC
        LIMIT ${parsedLimit}
      `;
    } else {
      // No filter - return recent articles
      articles = await sql`
        SELECT a.id, a.keyword, a.tag, a.final_content, a.meta_titles, a.meta_descriptions,
               a.chain_outputs, a.word_count, a.status,
               ws.name as website_name, c.name as client_name
        FROM articles a
        LEFT JOIN websites ws ON a.website_id = ws.id
        LEFT JOIN clients c ON a.client_id = c.id
        ORDER BY a.created_at DESC
        LIMIT ${parsedLimit}
      `;
    }

    // Format articles for AI consumption (summarized for context window efficiency)
    const formattedArticles = articles.map(article => {
      // Truncate content if very long (AI doesn't need full article, just enough context)
      const content = article.final_content || '';
      const truncatedContent = content.length > 3000
        ? content.substring(0, 3000) + '...[truncated]'
        : content;

      return {
        id: article.id,
        keyword: article.keyword,
        tag: article.tag,
        wordCount: article.word_count,
        status: article.status,
        websiteName: article.website_name,
        clientName: article.client_name,
        content: truncatedContent,
        metaTitles: article.meta_titles,
        metaDescriptions: article.meta_descriptions
      };
    });

    res.json({
      success: true,
      count: formattedArticles.length,
      articles: formattedArticles
    });

  } catch (error) {
    console.error('[Prompt Assistant - Articles] Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch articles'
    });
  }
});

/**
 * GET /api/prompt-assistant/articles/summary
 * Get a quick overview of available articles (for UI selection)
 */
router.get('/articles/summary', async (req, res) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const { workflowId } = req.query;

    // Get article counts by website/client
    const summaryQuery = workflowId
      ? sql`
          SELECT
            ws.id as website_id, ws.name as website_name,
            c.id as client_id, c.name as client_name,
            COUNT(a.id) as article_count
          FROM articles a
          LEFT JOIN websites ws ON a.website_id = ws.id
          LEFT JOIN clients c ON a.client_id = c.id
          WHERE a.workflow_id = ${workflowId}
          GROUP BY ws.id, ws.name, c.id, c.name
          ORDER BY c.name, ws.name
        `
      : sql`
          SELECT
            ws.id as website_id, ws.name as website_name,
            c.id as client_id, c.name as client_name,
            COUNT(a.id) as article_count
          FROM articles a
          LEFT JOIN websites ws ON a.website_id = ws.id
          LEFT JOIN clients c ON a.client_id = c.id
          GROUP BY ws.id, ws.name, c.id, c.name
          ORDER BY c.name, ws.name
        `;

    const summary = await summaryQuery;

    // Also get recent article keywords for quick selection
    const recentQuery = workflowId
      ? sql`
          SELECT id, keyword, tag, word_count, status
          FROM articles
          WHERE workflow_id = ${workflowId}
          ORDER BY created_at DESC
          LIMIT 20
        `
      : sql`
          SELECT id, keyword, tag, word_count, status
          FROM articles
          ORDER BY created_at DESC
          LIMIT 20
        `;

    const recentArticles = await recentQuery;

    res.json({
      success: true,
      summary,
      recentArticles
    });

  } catch (error) {
    console.error('[Prompt Assistant - Articles Summary] Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch articles summary'
    });
  }
});

export default router;
