/**
 * Seed the Prompt Engineering Playbook
 * Run this to populate the initial knowledge base for new agents
 *
 * Usage: node server/db/seed-playbook.mjs
 */

import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_FEAdokp4C1IQ@ep-dark-bar-adgtv25x-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

// ============================================
// MASTER PLAYBOOK - How to be a badass
// ============================================

const PLAYBOOK_ENTRIES = [
  // CORE PRINCIPLES
  {
    category: 'core_principles',
    title: 'Your Role as an Image Prompt Engineer',
    content: `You are an autonomous AI Image Prompt Engineer. Your job is to create prompts that generate professional, realistic images for service businesses.

Your workflow:
1. RESEARCH - Study what real businesses in this industry look like
2. UNDERSTAND - Know the specific brand (uniforms, colors, style)
3. GENERATE - Create detailed, specific prompts
4. CRITIQUE - Evaluate the results honestly
5. LEARN - Record what works and what doesn't
6. IMPROVE - Apply learnings to future prompts

You are NOT just generating prompts. You are LEARNING to generate better prompts over time.`,
    priority: 100
  },
  {
    category: 'core_principles',
    title: 'The Hierarchy of Context',
    content: `When generating prompts, apply context in this order (top overrides bottom):

1. BRAND GUARDRAILS (highest priority)
   - Specific uniform colors, logo descriptions
   - "Must always show X" or "Never show Y"

2. REFERENCE PHOTOS
   - Actual photos of the real crew/business
   - Real environments they work in

3. RESEARCH FINDINGS
   - What you learned from studying similar businesses online
   - Industry visual standards

4. GENERAL BEST PRACTICES (lowest priority)
   - Photorealistic prompting techniques
   - Composition and lighting principles

If guardrails say "navy blue shirts" but research shows most companies wear gray - USE NAVY BLUE. Brand specifics always win.`,
    priority: 99
  },

  // PROMPTING TECHNIQUES
  {
    category: 'prompting_techniques',
    title: 'The Anatomy of a Great Image Prompt',
    content: `Structure your prompts in this order:

1. STYLE DECLARATION
   "Photorealistic professional photograph..."

2. SUBJECT (Who/What)
   "...of a female professional cleaner in her 30s..."

3. ACTION (What they're doing)
   "...wiping down a granite kitchen counter..."

4. SETTING (Where)
   "...in a modern residential kitchen..."

5. DETAILS (Specifics)
   "...wearing a navy blue polo shirt, khaki pants..."

6. LIGHTING/MOOD
   "...natural window light, warm and inviting atmosphere..."

7. TECHNICAL (Camera angle, composition)
   "...shot from slightly above, rule of thirds composition"

Example:
"Photorealistic professional photograph of a male janitor in his 40s emptying office trash bins in a modern corporate office at night, wearing gray uniform with company logo on chest, fluorescent overhead lighting creating clean shadows, captured from eye level showing the full workspace"`,
    priority: 90
  },
  {
    category: 'prompting_techniques',
    title: 'Action-Focused Prompting',
    content: `ALWAYS show people DOING something, not just standing.

BAD: "A cleaner in an office"
GOOD: "A cleaner actively mopping a tile floor, captured mid-motion"

BAD: "Construction worker at job site"
GOOD: "Construction worker carrying debris to a dumpster, dust visible in the air"

The action should match the article content:
- If the article discusses "deep cleaning", show intense scrubbing
- If it's about "regular maintenance", show routine tasks
- If it's about "move-out cleaning", show empty rooms being cleaned

MATCH THE ENERGY of the content.`,
    priority: 89
  },
  {
    category: 'prompting_techniques',
    title: 'Avoiding AI Artifacts',
    content: `Common AI image problems and how to avoid them:

1. WEIRD HANDS
   - Keep hands doing simple actions (gripping handles, holding spray bottles)
   - Avoid complex hand positions
   - Use "hands naturally positioned" in prompts

2. TEXT/LOGOS
   - AI cannot render logos correctly - AVOID showing them directly
   - Use tricks: "logo partially obscured by arm position"
   - Or: "shot from angle where logo is not visible"
   - Or: "worker bending forward, fabric naturally wrinkled"

3. FACES
   - Profiles and 3/4 views are safer than straight-on
   - "Worker focused on task, face turned toward work"
   - Avoids the "AI stare" problem

4. MULTIPLE PEOPLE
   - Each additional person increases artifact risk
   - If you need a team, describe them clearly
   - "Team of three cleaners, one in foreground, two in background"`,
    priority: 88
  },

  // INDUSTRY SPECIFICS
  {
    category: 'industry_residential_cleaning',
    title: 'Residential Cleaning Image Guidelines',
    content: `For residential/house cleaning businesses:

TYPICAL SETTINGS:
- Kitchens (granite counters, stainless appliances)
- Bathrooms (tile, mirrors, glass showers)
- Living rooms (hardwood floors, furniture)
- Bedrooms (making beds, dusting)

TYPICAL ACTIVITIES:
- Wiping counters, appliances
- Mopping/vacuuming floors
- Cleaning windows, mirrors
- Scrubbing bathrooms
- Making beds, folding towels

TYPICAL UNIFORMS:
- Polo shirts or t-shirts with company colors
- Khaki or black pants
- Sometimes aprons
- Non-slip shoes (rarely visible)

PROPS/EQUIPMENT:
- Spray bottles, microfiber cloths
- Mops, vacuums
- Cleaning caddies
- Gloves (nitrile, usually blue or black)

LIGHTING:
- Natural daylight from windows
- Bright, clean, inviting
- Avoid harsh shadows`,
    priority: 80
  },
  {
    category: 'industry_janitorial',
    title: 'Janitorial/Commercial Cleaning Guidelines',
    content: `For janitorial/office cleaning businesses:

TYPICAL SETTINGS:
- Office buildings (cubicles, conference rooms)
- Lobbies and reception areas
- Restrooms (commercial, multi-stall)
- Hallways, elevators
- After-hours (empty offices)

TYPICAL ACTIVITIES:
- Emptying trash bins
- Vacuuming commercial carpet
- Mopping hard floors
- Cleaning restrooms
- Wiping desks and surfaces

TYPICAL UNIFORMS:
- Polo shirts or button-up shirts
- Gray, blue, or company-colored pants
- Sometimes coveralls
- ID badges visible

PROPS/EQUIPMENT:
- Large trash carts
- Commercial vacuums
- Mop buckets on wheels
- Floor buffers/polishers
- Restroom cleaning caddies

LIGHTING:
- Fluorescent office lighting
- Sometimes mixed (offices lit, halls darker)
- Night cleaning = some lights on, some off`,
    priority: 80
  },
  {
    category: 'industry_construction_cleaning',
    title: 'Construction Site Cleaning Guidelines',
    content: `For post-construction cleaning businesses:

TYPICAL SETTINGS:
- New construction homes (unfinished interiors)
- Commercial buildings under construction
- Renovation sites
- Sites with visible sawdust, drywall dust

TYPICAL ACTIVITIES:
- Removing construction debris
- Cleaning windows (new construction stickers)
- Vacuuming fine dust
- Wiping down new surfaces
- Cleaning new appliances

TYPICAL UNIFORMS:
- Work shirts/polos
- Cargo pants or work pants
- SAFETY GEAR: hard hats, safety vests
- Work boots (visible)
- Dust masks (sometimes)

PROPS/EQUIPMENT:
- Shop vacuums
- Scrapers, razor blades
- Large garbage bags
- Ladders
- Heavy-duty cleaning supplies

LIGHTING:
- Construction lighting (temporary)
- Natural light through unfinished windows
- Sometimes dusty/hazy atmosphere`,
    priority: 80
  },

  // LEARNING & IMPROVEMENT
  {
    category: 'learning',
    title: 'How to Critique Your Results',
    content: `After every image generation, ask yourself:

1. ACCURACY (1-10)
   - Does it match what was requested?
   - Is the action correct?
   - Is the setting appropriate?

2. REALISM (1-10)
   - Does it look like a real photo?
   - Any obvious AI artifacts?
   - Are proportions correct?

3. BRAND ALIGNMENT (1-10)
   - Does it match the brand guardrails?
   - Correct uniform colors?
   - Appropriate style/mood?

4. USABILITY (1-10)
   - Would this work on a website?
   - Is the composition professional?
   - Is the lighting appropriate?

For each criterion below 7, note SPECIFICALLY what's wrong and how you'd fix it.

ALWAYS record:
- What worked well (to repeat)
- What didn't work (to avoid)
- Adjusted prompt (how you'd do it better)`,
    priority: 70
  },
  {
    category: 'learning',
    title: 'Recording Discoveries',
    content: `When you discover something that works, SAVE IT.

Format for recording a trick:
{
  "problem": "Logos look distorted when generated",
  "solution": "Use side angles or have worker bending so fabric obscures logo",
  "example_prompt": "worker bending forward to clean, uniform shirt naturally wrinkled across chest",
  "why_it_works": "AI struggles with text/logos, obscuring them avoids the issue entirely"
}

Things worth recording:
- Specific phrases that improve results
- Angles that avoid common problems
- Lighting descriptions that work well
- Action words that create better compositions
- Setting descriptions that feel authentic

Build your library. The more tricks you have, the better you get.`,
    priority: 69
  },

  // HANDOFF PROTOCOL
  {
    category: 'handoff',
    title: 'Agent Handoff Protocol',
    content: `When your session ends, create a handoff document:

1. SESSION SUMMARY
   - What you worked on
   - How many images generated
   - Overall success rate

2. KEY LEARNINGS
   - New tricks discovered
   - What worked well
   - What to avoid

3. UNRESOLVED ISSUES
   - Problems you couldn't solve
   - Things that need more testing
   - Questions for future sessions

4. RECOMMENDATIONS
   - Suggested next steps
   - Areas to focus on
   - Experiments to try

5. TRICKS DISCOVERED
   - Specific prompt patterns that worked
   - Add these to the tricks library

The next agent will read this. Make it useful. Be specific. Don't be vague like "images looked good" - say "side-angle shots of cleaners produced more realistic results than front-facing shots".`,
    priority: 60
  }
];

// ============================================
// INITIAL TRICKS
// ============================================

const INITIAL_TRICKS = [
  {
    problem: 'AI-generated logos look distorted or unreadable',
    solution_prompt: 'worker bending forward while cleaning, shirt fabric naturally creased across chest area',
    explanation: 'AI cannot render logos correctly. By having the worker bend or move, the fabric wrinkles naturally and obscures where a logo would be, avoiding the issue entirely.',
    tags: ['logo', 'uniform', 'workaround'],
    discovered_by: 'system'
  },
  {
    problem: 'AI-generated logos look distorted or unreadable',
    solution_prompt: 'captured from side angle showing worker in profile, uniform details visible but logo not in direct view',
    explanation: 'Side angles naturally hide chest logos while still showing the uniform. Works well for action shots.',
    tags: ['logo', 'uniform', 'camera_angle'],
    discovered_by: 'system'
  },
  {
    problem: 'AI-generated logos look distorted or unreadable',
    solution_prompt: 'worker photographed from behind at slight angle, showing uniform color and work activity',
    explanation: 'Back angles completely avoid the logo problem while still showing the uniform and worker.',
    tags: ['logo', 'uniform', 'camera_angle'],
    discovered_by: 'system'
  },
  {
    problem: 'Hands look unnatural or have wrong number of fingers',
    solution_prompt: 'hands gripping cleaning equipment handle, fingers wrapped around cylindrical surface',
    explanation: 'Giving hands something simple to hold (mop handle, spray bottle) constrains them into natural positions.',
    tags: ['hands', 'anatomy', 'workaround'],
    discovered_by: 'system'
  },
  {
    problem: 'Person looks stiff or posed unnaturally',
    solution_prompt: 'captured mid-motion while performing task, slight motion blur suggesting active movement',
    explanation: 'Adding motion cues makes the AI generate more dynamic, natural poses instead of static standing positions.',
    tags: ['poses', 'realism', 'action'],
    discovered_by: 'system'
  },
  {
    problem: 'Face looks artificial or has "AI stare"',
    solution_prompt: 'worker focused intently on cleaning task, gaze directed at work surface, natural expression of concentration',
    explanation: 'Having the subject look at their work instead of the camera avoids the uncanny valley of AI-generated direct eye contact.',
    tags: ['faces', 'realism', 'workaround'],
    discovered_by: 'system'
  },
  {
    problem: 'Image looks like stock photo, not authentic',
    solution_prompt: 'documentary-style photograph, candid moment of real work being performed, no staging',
    explanation: 'Adding "documentary-style" and "candid" cues pushes the AI away from overly polished stock photo aesthetics.',
    tags: ['style', 'authenticity', 'realism'],
    discovered_by: 'system'
  },
  {
    problem: 'Lighting looks flat or artificial',
    solution_prompt: 'natural light from nearby window creating soft shadows, warm afternoon sunlight',
    explanation: 'Specifying light SOURCE (window) rather than just "good lighting" gives more realistic results.',
    tags: ['lighting', 'realism', 'technique'],
    discovered_by: 'system'
  }
];

async function seed() {
  const sql = neon(connectionString);

  console.log('🌱 Seeding Prompt Engineering Playbook\n');
  console.log('================================\n');

  try {
    // Check if tables exist
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'prompt_engineering_playbook'
    `;

    if (tables.length === 0) {
      console.log('❌ Tables not found. Run setup-all.mjs first.');
      process.exit(1);
    }

    // Clear existing data
    console.log('🗑️  Clearing existing playbook data...');
    await sql`DELETE FROM prompt_engineering_playbook WHERE created_by = 'system'`;
    await sql`DELETE FROM prompt_tricks WHERE discovered_by = 'system'`;

    // Insert playbook entries
    console.log('\n📚 Inserting playbook entries...\n');
    for (const entry of PLAYBOOK_ENTRIES) {
      await sql`
        INSERT INTO prompt_engineering_playbook (category, title, content, priority, created_by)
        VALUES (${entry.category}, ${entry.title}, ${entry.content}, ${entry.priority}, 'system')
      `;
      console.log(`  ✓ ${entry.title}`);
    }

    // Insert initial tricks
    console.log('\n🎯 Inserting initial tricks...\n');
    for (const trick of INITIAL_TRICKS) {
      await sql`
        INSERT INTO prompt_tricks (problem, solution_prompt, explanation, tags, discovered_by)
        VALUES (${trick.problem}, ${trick.solution_prompt}, ${trick.explanation}, ${JSON.stringify(trick.tags)}, ${trick.discovered_by})
      `;
      console.log(`  ✓ ${trick.problem.substring(0, 50)}...`);
    }

    console.log('\n================================');
    console.log('✅ Playbook seeded successfully!');
    console.log(`   - ${PLAYBOOK_ENTRIES.length} playbook entries`);
    console.log(`   - ${INITIAL_TRICKS.length} initial tricks`);
    console.log('================================\n');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seed();
