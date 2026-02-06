import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';

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
  },
  {
    id: 'idea_seed_6',
    title: 'Enterprise Agency Platform',
    description: `Evolve PromptFlow from a prompting/SEO tool into a full multi-platform CMS for agencies.

The path: Prompting Tool → SEO/WordPress → Content Editor → Multi-Platform CMS.

Key expansions:
- White-label for agencies
- Multi-platform beyond Elementor — Shopify, other page builders, partner's new lightweight platform
- Bulletproof agency dashboard handling different customers/websites/platforms
- Enterprise-grade reliable — zero bugs, zero crashes, zero data loss
- Even agencies that don't use AI articles still need the content editing/publishing workflow

Adoption path: agencies test with a couple clients → see results → transfer entire business in.
Target: $1K+/mo for 50+ client agencies. Each new platform integration is ~couple weeks with Claude.`,
    tags: ['Enterprise', 'Agency', 'SaaS', 'Vision'],
    priority: 1,
    status: 'planned',
    source: 'Founder vision',
    created_at: '2026-02-06T00:00:00.000Z',
    updated_at: '2026-02-06T00:00:00.000Z'
  },
  {
    id: 'idea_seed_7',
    title: 'Supporting Content Automation Engine',
    description: `Fully automate the SEO supporting content cycle using Viking heat maps integration.

Strategy:
1. Build 30 core pages → wait for them to index and settle in rankings (1-100)
2. Viking heat maps track ranking positions — visualize as horse race / EQ board
3. Algorithm identifies pages closest to Google 3-pack
4. Auto-generates supporting content (People Also Ask questions)
5. Pushes articles → monitors movement → repeats until all pages dominate 3-pack

The 3-pack magnetically pulls the rest up — more you get in, more it draws from behind.

Also includes Viking GBP (Google Business Profile) automation: auto-post images/updates.

Cost advantage: ~30 cents/article vs competitors at $2K/mo manual work. Could do all 200 pages in one day instead of drip-feeding over 18 months. Data from iterations reveals exact supporting page count needed per keyword.

This is "beach mode" — the algorithm runs the entire SEO strategy autonomously.`,
    tags: ['Automation', 'SEO', 'Viking', 'Algorithm'],
    priority: 1,
    status: 'idea',
    source: 'Founder vision',
    created_at: '2026-02-06T00:00:00.000Z',
    updated_at: '2026-02-06T00:00:00.000Z'
  },
  {
    id: 'idea_seed_8',
    title: 'Tiered Agency Pricing',
    description: `Stage platform features into pricing tiers for agency customers.

Tier 1 (~$1K/mo): Editing/publishing features (The Desk, content management)
Tier 2 (~$2K/mo): + Core page generation + image pipeline
Tier 3 (~$3.5K+/mo): + Full automation engine (supporting content algorithm, Viking heat maps, auto-boost to 3-pack, GBP posting)

Top tier = "Sipping Pina Coladas on the Beach" package — fully automated agency where you just check your phone.

More automation layers = higher price = more sticky revenue.
Agencies just need a sales team + this platform = fully automated business.
Future: Claude-powered AI agent coordinates all in-between work.`,
    tags: ['Pricing', 'SaaS', 'Business'],
    priority: 2,
    status: 'idea',
    source: 'Founder vision',
    created_at: '2026-02-06T00:00:00.000Z',
    updated_at: '2026-02-06T00:00:00.000Z'
  },
  {
    id: 'idea_seed_9',
    title: 'The Desk / Command Center',
    description: `Single editing workspace that replaces individual article pages. PRD written: PRD-COMMAND-CENTER.md

- Dropdown section that goes full-page (React Portal overlay)
- Always-live contenteditable editing — NO separate review/edit mode
- Swipe/arrow navigation between articles
- Find & Replace across articles
- Clickable keyword tabs
- Revert button for safety (snapshot before any save/push)
- Long-term: becomes center of the app alongside Prompt Flows and Image Prompts desktops
- 3-Desktop Architecture: Prompt Flows (factory) | Image Prompts (art studio) | The Desk (editing/shipping)`,
    tags: ['UI', 'Editor', 'PRD Ready'],
    priority: 1,
    status: 'planned',
    source: 'PRD written',
    created_at: '2026-02-06T00:00:00.000Z',
    updated_at: '2026-02-06T00:00:00.000Z'
  },
  {
    id: 'idea_seed_10',
    title: 'Post-Publish Visual Control',
    description: `Full system for managing already-published WordPress pages. PRD written: PRD-POST-PUBLISH-VISUAL-CONTROL.md

Phase 1: Push/Replace article images on existing pages
Phase 2: Replace article content on existing pages
Phase 3: Component graphics control (swap headers, CTAs, etc.)
Phase 4: Unified page rebuild service

Uses delete-and-recreate pattern (already proven in push-images endpoint). Shared rebuildPage() service for all post-publish operations.`,
    tags: ['WordPress', 'Publishing', 'PRD Ready'],
    priority: 1,
    status: 'planned',
    source: 'PRD written',
    created_at: '2026-02-06T00:00:00.000Z',
    updated_at: '2026-02-06T00:00:00.000Z'
  },
  {
    id: 'idea_seed_11',
    title: 'CTA Button URL Configuration',
    description: `Wire up existing CTA button infrastructure with UI. PRD written: PRD-CTA-BUTTON-URL.md

DB columns already exist (elementor_cta_text, elementor_cta_url). API endpoints already accept values. Builder already uses ctaText/ctaUrl params.

Missing: UI fields in AgencyManager.tsx, frontend wiring during publish, bulk update endpoint for existing pages.`,
    tags: ['CTA', 'UI', 'PRD Ready'],
    priority: 2,
    status: 'planned',
    source: 'PRD written',
    created_at: '2026-02-06T00:00:00.000Z',
    updated_at: '2026-02-06T00:00:00.000Z'
  },
  {
    id: 'idea_seed_12',
    title: 'Processing Log Summary',
    description: `Transform the Processing Log from a raw firehose into a two-level drill-down. PRD written: PRD-PROCESSING-LOG-SUMMARY.md

- Fix "Unnamed Project" naming → use date/time/count
- Show ALL keywords in flex-wrap grid (keyword pills with status colors)
- Clickable pills → detail logs drop down below grid for selected article
- System & Error Logs in separate collapsible section
- Summary stats bar at bottom`,
    tags: ['UI', 'Logs', 'PRD Ready'],
    priority: 2,
    status: 'planned',
    source: 'PRD written',
    created_at: '2026-02-06T00:00:00.000Z',
    updated_at: '2026-02-06T00:00:00.000Z'
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

    const systemPrompt = `You are an AI assistant helping the user capture and formulate feature ideas for their software project "PromptFlow" - an AI content automation platform.

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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || "I'm having trouble processing that. Could you try again?";

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
