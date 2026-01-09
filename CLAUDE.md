# PromptFlow - SEO Page Factory

## What This Is
A full-stack application that generates SEO articles with AI, creates images, and publishes to WordPress via Elementor. Built with React/TypeScript frontend and Express/Node.js backend with PostgreSQL (Neon).

## Critical Rules - READ BEFORE TOUCHING CODE

### 1. Image Pipeline Order (NEVER CHANGE)
```
Images → Page → Meta
```
If you create the page before uploading images, images won't appear on WordPress.

### 2. Source of Truth for Settings
- `smart_matching_mode` → determines bank/live fallback (NOT a separate fallback_to_live field)
- `website.seo_plugin` → determines which SEO plugin to use (NOT hardcoded)
- `articles.generated_images` → the images for an article

### 3. Never Overwrite Images
Before any UPDATE on articles table, check if images exist. Look for `shouldUpdateImages` pattern.

### 4. State Preservation
- Don't reset `metaSaved` on refresh if article already has saved meta
- Don't clear arrays when you mean to leave them unchanged

## Current State
- **Last Updated:** 2025-01-09
- **What's Working:** Image pipeline, Push All to WP, Blueprint page
- **Known Issues:** SEO plugin dropdown sync between two places
- **Next Priority:** User will specify

## Key Commands
```bash
npm run dev        # Start dev server
npm test           # Run tests
```

## Key Files
| Area | File |
|------|------|
| Image publish | server/routes/elementor.js |
| Article UI | src/components/articles/ArticleListView.tsx |
| Blueprint | src/pages/BlueprintPage.tsx |
| SEO push | server/routes/seo.js |

## Don't Touch (Stable)
- WorkflowNavigation.tsx
- ClientsPage.tsx
- Most of the workflow/prompt chain logic

## See Also
- **In-app Blueprint:** More > Blueprint (visual diagrams)
- **Agent Template:** More > Blueprint > Agent Template tab
- **Debrief Command:** `/debrief` at end of session
