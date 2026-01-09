# PromptFlow Agent Blueprint

**CRITICAL: Read this ENTIRE document before making ANY changes to the codebase.**

This document exists because multiple AI agents have broken things by not understanding the system architecture. If you break something that was working, this document should help you fix it.

---

## System Overview

PromptFlow is an SEO page factory that:
1. Generates articles via prompt chains (AI content)
2. Generates meta titles & descriptions (5 options each)
3. Generates images (via Image Bank or live generation)
4. Publishes everything to WordPress via Elementor

---

## Critical Data Flow

### Article Creation Flow
```
Workflow Page → Run Batch → Claude generates article
                         → AI generates meta (5 titles, 5 descriptions)
                         → Images are generated/matched
                         → Article saved to `articles` table
                         → Images saved to `articles.generated_images` (JSONB)
```

### Image Flow (VERY IMPORTANT - THIS HAS BEEN BROKEN MANY TIMES)
```
Two Sources:
1. IMAGE BANK (pre-generated batch images)
   - Stored in `image_bank_items` table
   - Already have WordPress URLs (uploaded to test WP site)
   - Matched to articles via Smart Content Matching

2. GENERATE LIVE (on-the-fly generation)
   - Created as BASE64 data URLs
   - Must be uploaded to WP Media Library to get wpUrl
   - Triggered when bank is empty AND smart_matching_mode = 'bank_first'

Two Destinations:
1. DRAFT MODE (imageDraftMode: true)
   - Images go to Article Page (articles.generated_images)
   - Images go to Draft Image Bank (for later promotion)
   - NO WordPress page created yet

2. WORDPRESS MODE (imageDraftMode: false)
   - Images embedded in WordPress page via Elementor
   - Page created on actual WordPress site
```

### Push All to WP Flow (3 Steps - ORDER MATTERS!)
```
Step 1: Upload images to WP Media Library
        POST /api/articles/:id/push-images
        - Converts base64 to WordPress URLs
        - Updates articles.generated_images with wpMediaUrl

Step 2: Create WordPress page with embedded images
        POST /api/elementor/publish
        - Fetches articles.generated_images (now has wpMediaUrl)
        - Embeds images in Elementor page structure
        - Creates page on WordPress

Step 3: Push meta to SEO plugin
        POST /api/seo/push-direct
        - Sends selected_meta_title and selected_meta_description
        - Must pass correct seoPlugin (rankmath, yoast, aioseo, etc.)
        - Gets seoPlugin from website.seo_plugin
```

---

## Database Tables (Key Fields)

### `articles` Table
```sql
id                        -- Primary key
workflow_id               -- Links to workflow (for image settings)
website_id                -- Links to website (for WP credentials, seo_plugin)
keyword                   -- The article keyword/topic
final_content             -- Generated article HTML
meta_titles               -- JSONB array of 5 options
meta_descriptions         -- JSONB array of 5 options
selected_meta_title       -- User's chosen title (saved state)
selected_meta_description -- User's chosen description (saved state)
generated_images          -- JSONB array of image objects
wp_post_id                -- WordPress page ID after publish
wp_post_url               -- WordPress page URL after publish
status                    -- 'generated', 'published', etc.
```

### `websites` Table
```sql
id
wp_url                    -- WordPress site URL
wp_user                   -- WordPress username
wp_app_password           -- WordPress application password
seo_plugin                -- 'rankmath', 'yoast', 'aioseo', 'seopress', 'direct'
```

### `image_creation_settings` Table
```sql
workflow_id               -- Links to workflow
integration_mode          -- 'bank' or 'live'
smart_matching_mode       -- 'bank_first', 'bank_only', 'generate_first', 'generate_only'
image_generation_model    -- 'gpt-image-1.5', 'flux-1.1-pro', etc.
image_quality             -- 'low', 'medium', 'high'
audience_avatars          -- JSONB array of personas with tags
```

### Image Object Structure (in generated_images)
```json
{
  "id": "img-1234567890-hero",
  "placement": "hero" | "section-1" | "section-3" | etc.,
  "url": "data:image/png;base64,..." OR "https://site.com/wp-content/...",
  "wpMediaUrl": "https://site.com/wp-content/uploads/...",
  "wpMediaId": 123,
  "prompt": "The generation prompt used",
  "pushedToWp": true | false,
  "side": "left" | "right",
  "keywords": ["matched", "keywords"]
}
```

---

## Key Settings That MUST Sync

### SEO Plugin
- **Source of truth**: `websites.seo_plugin`
- **Must be used by**: Push All to WP (via `/api/seo/push-direct`)
- **BUG FIXED**: Frontend wasn't passing seoPlugin to push-direct, defaulted to wrong plugin

### Image Bank vs Generate Live
- **Source of truth**: `image_creation_settings.smart_matching_mode`
- `bank_first` = Use bank, generate live if empty (fallback: true)
- `bank_only` = Only use bank, never generate (fallback: false)
- **BUG FIXED**: Code was reading separate `fallback_to_live` field instead of deriving from smart_matching_mode

### Meta Saved State
- **Source of truth**: `articles.selected_meta_title` and `articles.selected_meta_description`
- **UI state**: `metaSaved` boolean in ArticleListView.tsx
- **BUG FIXED**: `fetchArticleDetails()` was always resetting `metaSaved` to false

---

## Common Bugs & Fixes (Learn From History!)

### 1. Images Disappearing After "Push All to WP"
**Symptom**: Images vanish from article after clicking Push All
**Cause**: elementor.js was overwriting `generated_images` with empty array
**Fix**: Check if article already has images before UPDATE, preserve them
**File**: `server/routes/elementor.js` (look for "shouldUpdateImages")

### 2. Images Not Appearing ON WordPress Page
**Symptom**: Images upload to Media Library but don't show on page
**Cause**: Wrong step order - page created before images uploaded
**Fix**: Reorder Push All steps: Images FIRST, then page, then meta
**File**: `src/components/articles/ArticleListView.tsx` (pushAllToWordPress function)

### 3. "Bank First" Not Generating When Bank Empty
**Symptom**: No images when bank is exhausted despite "Bank First" selected
**Cause**: Code read `fallback_to_live` instead of `smart_matching_mode`
**Fix**: Derive fallback from smart_matching_mode
**File**: `server/routes/elementor.js` (look for "smartMatchingMode")

### 4. Meta Unsaving After Push
**Symptom**: Meta shows as "Draft" after Push All completes
**Cause**: `fetchArticleDetails()` always set `metaSaved(false)`
**Fix**: Check if article has `selected_meta_title` and set accordingly
**File**: `src/components/articles/ArticleListView.tsx` (fetchArticleDetails function)

### 5. Meta Not Pushing to WordPress
**Symptom**: Meta saved in app but doesn't appear in Rank Math/Yoast
**Cause**: Wrong SEO plugin being used (defaulted to 'aioseo')
**Fix**: Pass `website.seo_plugin` to push-direct endpoint
**File**: `src/components/articles/ArticleListView.tsx` (Step 3 in pushAllToWordPress)

---

## Files You'll Likely Need to Touch

### Frontend (React/TypeScript)
- `src/components/articles/ArticleListView.tsx` - Article page, Push All to WP
- `src/components/ImageCreationSection.tsx` - Image settings, bank/live toggle
- `src/components/WebsitesPage.tsx` - Website settings, SEO plugin dropdown

### Backend (Express/Node.js)
- `server/routes/elementor.js` - WordPress page creation, image embedding
- `server/routes/articles.js` - Article CRUD, push-images endpoint
- `server/routes/seo.js` - SEO meta pushing to plugins
- `server/routes/image-creation.js` - Image generation settings

### Database
- `server/db/schema.sql` - Table definitions
- `server/db/setup-all.mjs` - Database initialization

---

## Testing Checklist

Before saying you're done, verify:

1. **Draft Mode Test**
   - [ ] Run workflow in Draft mode
   - [ ] Images appear in Article Page preview
   - [ ] Images saved to articles.generated_images in DB
   - [ ] "Image: Draft" badge shows correctly

2. **Push All to WP Test**
   - [ ] Save meta title & description first
   - [ ] Click "Push All to WP"
   - [ ] Images appear ON the WordPress page (not just Media Library)
   - [ ] Meta appears in Rank Math/Yoast on WordPress
   - [ ] Meta stays "saved" (green badge) after push

3. **Generate Live Fallback Test**
   - [ ] Set mode to "Bank First"
   - [ ] Ensure Image Bank is empty for the tag
   - [ ] Run workflow
   - [ ] Images should generate live (not fail with 0 images)

---

## Logs Location

Server logs are pushed to GitHub automatically after each publish:
```bash
git fetch origin main && git show origin/main:logs/server-latest.log
```

Key log prefixes:
- `[Elementor Publish]` - WordPress page creation
- `[Image Bank]` - Bank selection/matching
- `[Push Images]` - Media Library upload
- `[SAVE]` - Database save operations
- `[Push All]` - Frontend push flow (browser console)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PROMPTFLOW UI                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   Workflow   │───▶│   Article    │───▶│   Push All to WP     │  │
│  │    Setup     │    │    Page      │    │                      │  │
│  │              │    │              │    │  1. Upload images    │  │
│  │ - AI Models  │    │ - Preview    │    │  2. Create WP page   │  │
│  │ - Image Mode │    │ - Meta SEO   │    │  3. Push meta        │  │
│  │ - Bank/Live  │    │ - Images     │    │                      │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         EXPRESS API                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  /api/elementor/publish     - Create WordPress pages with images    │
│  /api/articles/:id/push-images - Upload images to WP Media Library  │
│  /api/seo/push-direct       - Push meta to SEO plugin               │
│  /api/articles              - Article CRUD                          │
│  /api/image-creation        - Image generation settings             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      POSTGRESQL (Neon)                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  articles              - Generated content + images (JSONB)          │
│  websites              - WP credentials + seo_plugin                 │
│  workflows             - Chain configuration                         │
│  image_creation_settings - Bank/Live mode, matching settings        │
│  image_bank_items      - Pre-generated images for matching          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      WORDPRESS SITE                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  /wp-json/wp/v2/pages   - Create/update pages                       │
│  /wp-json/wp/v2/media   - Upload images                             │
│  /wp-json/rankmath/v1/  - Rank Math SEO (if enabled)                │
│  /wp-json/yoast/v1/     - Yoast SEO (if enabled)                    │
│                                                                      │
│  ELEMENTOR              - Page builder (pages use Elementor format)  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Golden Rules

1. **NEVER overwrite `generated_images` with an empty array** - Always check first
2. **Step order matters for Push All** - Images first, page second, meta third
3. **`smart_matching_mode` is the source of truth** for bank/live fallback
4. **`website.seo_plugin` is the source of truth** for which SEO plugin to use
5. **Always preserve `selected_meta_title/description`** when refreshing article data
6. **Test the full flow** before saying something is fixed

---

## Quick Reference: Key Variables

| What | Where | Field/Variable |
|------|-------|----------------|
| SEO Plugin | websites table | `seo_plugin` |
| Bank/Live Mode | image_creation_settings | `smart_matching_mode` |
| Article Images | articles table | `generated_images` (JSONB) |
| Saved Meta | articles table | `selected_meta_title`, `selected_meta_description` |
| WP Credentials | websites table | `wp_url`, `wp_user`, `wp_app_password` |
| Image Bank | image_bank_items table | Separate table, linked by workflow_id |

---

*Last updated: 2026-01-09 by Claude (fixing Push All to WP flow)*
