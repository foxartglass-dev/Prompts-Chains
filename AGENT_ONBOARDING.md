# Agent Onboarding - PromptFlow

## Quick Start (New Agent Warm-Up)

When starting a new session, follow this sequence to get oriented efficiently:

### Step 1: Read CLAUDE.md (2 min)
```
Read /home/user/Prompts-Chains/CLAUDE.md
```
This gives you critical rules and current state.

### Step 2: Open Blueprint Page (Primary Resource)
```
Read /home/user/Prompts-Chains/src/pages/BlueprintPage.tsx
```

The Blueprint page contains comprehensive visual documentation. Focus on these tabs in order:

1. **Image Flow Tab** - How images move through the system (Replicate → WordPress Media → Elementor)
2. **Push All Tab** - The complete WordPress publishing mechanism
3. **Individual Buttons Tab** - How !Article, !Meta, !Images buttons work differently
4. **Known Issues Tab** - Current bugs and debugging info (check this before investigating "weird" behavior)
5. **Drip Feed Tab** - Partial implementation status

### Step 3: Check for Context (If Resuming Work)
If the user mentions previous work or you're continuing a session:
```bash
git log --oneline -10  # See recent commits
git fetch origin main && git show origin/main:logs/server-latest.log  # Check server logs
```

## Key Mechanisms to Understand

### WordPress Publishing (Most Complex Part)
- **Order matters**: Images → Page → Meta (NEVER change this order)
- **Elementor quirk**: Can't update `_elementor_data` via REST API
- **Images button solution**: Deletes page → Recreates with same slug

### State Management
- `articles.generated_images` → source of truth for images
- `website.seo_plugin` → which SEO plugin to use (yoast/rankmath/seopress)
- Never overwrite images on UPDATE - look for `shouldUpdateImages` pattern

### Server Logs
Logs are committed to `logs/server-latest.log` on main branch. Access from any branch:
```bash
git fetch origin main
git show origin/main:logs/server-latest.log | tail -100
```

## Before Making Changes

1. **Read the relevant Blueprint tab** - It may already document what you're about to work on
2. **Check Known Issues tab** - The behavior you're seeing might be a documented issue
3. **Explain your approach first** - Before implementing, tell the user what you plan to do
4. **Don't over-engineer** - Fix only what's requested, don't refactor surrounding code

## Key Files Reference

| What | File |
|------|------|
| Publishing logic | `server/routes/elementor.js` |
| Individual buttons | `server/routes/articles.js` (push-article, push-meta, push-images) |
| Article UI | `src/components/articles/ArticleListView.tsx` |
| Blueprint docs | `src/pages/BlueprintPage.tsx` |
| SEO meta push | `server/routes/seo.js` |
| Elementor builder | `server/services/elementor-builder.js` |

## End of Session

Run `/debrief` command to document what you worked on for the next agent.
