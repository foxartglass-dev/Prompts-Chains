import express from 'express';

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

When users share their current settings or reference images, analyze them and provide actionable advice.

IMPORTANT FORMATTING:
- When suggesting prompts or guardrails the user should save, wrap them in triple backticks with a "guardrail" label like this:
\`\`\`guardrail
Your suggested guardrail text here
\`\`\`
This makes it easy for users to identify and save your suggestions.

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
        parts.push('\n## Main Prompt Template:');
        parts.push('```');
        parts.push(context.mainPrompt);
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

export default router;
