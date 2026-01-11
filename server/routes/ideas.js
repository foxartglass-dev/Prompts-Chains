import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';
import {
  openaiWebTools,
  executeWebTool,
  webToolsSystemPrompt,
  areWebToolsAvailable
} from '../services/web-tools-integration.js';

const router = express.Router();

// Initial seed ideas - features discussed for future development
const seedIdeas = [
  {
    id: 'idea_seed_1',
    title: 'AI Tech Support Bot',
    description: `A floating chat widget that provides contextual AI assistance throughout PromptFlow.

Features:
- Accessible from any page (floating button in corner)
- Knows the codebase and all plugin documentation
- Can help with WordPress REST API issues, SEO plugin setup
- Maintains conversation context across different screens
- Pre-loaded with docs for Yoast, Rank Math, AIOSEO, SEOPress
- Can read your current config to provide specific guidance`,
    tags: ['AI', 'Support', 'UX'],
    priority: 2,
    status: 'planned',
    source: 'Claude suggestion',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'idea_seed_2',
    title: 'Clone Workflows Feature',
    description: `Ability to duplicate entire workflow sets when setting up new websites.

Use case: When you have a perfectly configured workflow for one website, clone it for new websites with similar content needs. Would clone all prompts, placeholders, tags, snippets, and settings.`,
    tags: ['Workflows', 'Productivity'],
    priority: 3,
    status: 'idea',
    source: 'Claude suggestion',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'idea_seed_3',
    title: 'Context-Specific Help Buttons',
    description: `Alternative to floating chat - add help buttons (?) in specific sections that open the AI assistant with pre-filled context.

For example:
- Help button next to SEO plugin dropdown opens chat with "I need help with Rank Math setup"
- Help button in WordPress section opens with WordPress REST API context
- Same underlying conversation, just different entry points`,
    tags: ['AI', 'Support', 'UX'],
    priority: 4,
    status: 'idea',
    source: 'Claude suggestion',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'idea_seed_4',
    title: 'SaaS Voting System for Ideas',
    description: `When PromptFlow becomes a SaaS product, allow users to:
- Submit feature ideas
- Vote on other users' ideas
- See what's being worked on
- Get notified when their requested feature ships

Similar to how Canny, UserVoice, or ProductBoard work.`,
    tags: ['SaaS', 'Community', 'Future'],
    priority: 5,
    status: 'idea',
    source: 'User mentioned',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'idea_seed_5',
    title: 'WordPress Conflict Detection',
    description: `Since WordPress setups can vary wildly and plugins can conflict:
- Detect installed plugins that might cause REST API issues
- Warn about common configuration problems
- Suggest fixes for known issues
- Check if security plugins are blocking API access`,
    tags: ['WordPress', 'Diagnostics'],
    priority: 3,
    status: 'idea',
    source: 'Claude suggestion',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Get all ideas
router.get('/', async (req, res) => {
  try {
    // Try to get from database first
    const result = await sql`
      SELECT * FROM ideas ORDER BY priority ASC, created_at DESC
    `;

    // If no ideas exist, seed with initial ideas
    if (result.length === 0) {
      res.json({ ideas: seedIdeas, seeded: true });
    } else {
      res.json({ ideas: result });
    }
  } catch (error) {
    // If table doesn't exist, return seed ideas
    console.log('Ideas table may not exist yet:', error.message);
    res.json({ ideas: seedIdeas, seeded: true });
  }
});

// Save/update all ideas (bulk update)
router.put('/', async (req, res) => {
  try {
    const { ideas } = req.body;

    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS ideas (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        tags TEXT[] DEFAULT '{}',
        priority INTEGER DEFAULT 3,
        status TEXT DEFAULT 'idea',
        source TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Clear and re-insert all ideas (simple approach)
    await sql`DELETE FROM ideas`;

    for (const idea of ideas) {
      await sql`
        INSERT INTO ideas (id, title, description, tags, priority, status, source, created_at, updated_at)
        VALUES (
          ${idea.id},
          ${idea.title},
          ${idea.description || ''},
          ${idea.tags || []},
          ${idea.priority || 3},
          ${idea.status || 'idea'},
          ${idea.source || 'Manual'},
          ${idea.created_at || new Date().toISOString()},
          ${idea.updated_at || new Date().toISOString()}
        )
      `;
    }

    res.json({ success: true, count: ideas.length });
  } catch (error) {
    console.error('Failed to save ideas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a single idea
router.post('/', async (req, res) => {
  try {
    const { title, description, tags, priority, status, source } = req.body;

    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS ideas (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        tags TEXT[] DEFAULT '{}',
        priority INTEGER DEFAULT 3,
        status TEXT DEFAULT 'idea',
        source TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const id = `idea_${Date.now()}`;
    const result = await sql`
      INSERT INTO ideas (id, title, description, tags, priority, status, source)
      VALUES (${id}, ${title}, ${description || ''}, ${tags || []}, ${priority || 3}, ${status || 'idea'}, ${source || 'Manual'})
      RETURNING *
    `;

    res.json({ success: true, idea: result[0] });
  } catch (error) {
    console.error('Failed to add idea:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete an idea
router.delete('/:id', async (req, res) => {
  try {
    await sql`DELETE FROM ideas WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete idea:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI Chat endpoint for idea formulation
router.post('/chat', async (req, res) => {
  try {
    const { messages, context } = req.body;

    // Get API key from settings
    const settings = await sql`SELECT open_ai_key FROM settings WHERE id = 1`.catch(() => []);
    const apiKey = settings[0]?.open_ai_key;

    if (!apiKey) {
      return res.json({
        message: "I'd love to help you formulate your ideas! However, I need an OpenAI API key to be configured in Settings first. For now, you can add ideas manually using the '+ New Idea' button.",
        suggestedIdea: null
      });
    }

    const useWebTools = areWebToolsAvailable();

    let systemPrompt = `You are an AI assistant helping the user capture and formulate feature ideas for their software project "PromptFlow" - an AI content automation platform.

Your role is to:
1. Listen to the user's ideas (they may ramble or speak in fragments)
2. Ask clarifying questions to understand the idea better
3. Help refine the idea into something actionable
4. When the user says something like "add this as a card" or "save this idea", extract a structured idea

When extracting an idea, respond with your message AND include a JSON block like this:
\`\`\`idea
{
  "title": "Brief, clear title",
  "description": "Detailed description of what was discussed",
  "tags": ["relevant", "tags"],
  "priority": 3,
  "status": "idea"
}
\`\`\`

Priority guide:
- 1: Critical - needs to be done ASAP
- 2: High - important feature
- 3: Medium - good to have
- 4: Low - nice addition
- 5: Nice to have - someday maybe

Be conversational, helpful, and help the user think through their ideas. Don't be too formal.`;

    if (useWebTools) {
      systemPrompt += webToolsSystemPrompt;
    }

    const apiOptions = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7
    };

    if (useWebTools) {
      apiOptions.tools = openaiWebTools;
      apiOptions.tool_choice = 'auto';
    }

    let response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(apiOptions)
    });

    let data = await response.json();
    let assistantMsg = data.choices?.[0]?.message;
    let allMessages = [...apiOptions.messages];

    // Handle tool calls in a loop
    let iterations = 0;
    while (assistantMsg?.tool_calls?.length > 0 && iterations < 5) {
      iterations++;
      console.log(`[Ideas Chat] Processing ${assistantMsg.tool_calls.length} tool call(s)`);

      allMessages.push(assistantMsg);

      for (const toolCall of assistantMsg.tool_calls) {
        const toolResult = await executeWebTool(toolCall.function.name, JSON.parse(toolCall.function.arguments));
        allMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      }

      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: allMessages,
          temperature: 0.7,
          tools: openaiWebTools,
          tool_choice: 'auto'
        })
      });

      data = await response.json();
      assistantMsg = data.choices?.[0]?.message;
    }

    const assistantMessage = assistantMsg?.content || "I'm having trouble processing that. Could you try again?";

    // Check if there's an idea to extract
    let suggestedIdea = null;
    const ideaMatch = assistantMessage.match(/```idea\n([\s\S]*?)\n```/);
    if (ideaMatch) {
      try {
        suggestedIdea = JSON.parse(ideaMatch[1]);
      } catch (e) {
        console.log('Failed to parse idea JSON:', e);
      }
    }

    // Clean the message (remove the JSON block if present)
    const cleanMessage = assistantMessage.replace(/```idea\n[\s\S]*?\n```/g, '').trim();

    res.json({
      message: cleanMessage,
      suggestedIdea
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.json({
      message: "I'm having trouble connecting right now. Try again in a moment, or add the idea manually!",
      suggestedIdea: null
    });
  }
});

export default router;
