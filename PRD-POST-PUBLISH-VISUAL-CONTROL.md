# PRD: Post-Publish Full Page Control System

## Priority: HIGH
## Estimated Complexity: Large (multi-session, 3-4 focused agent sessions)
## Date: 2026-02-06

---

## Problem

Once articles are published to WordPress, EVERYTHING is "frozen" — there's no way to:
1. **Push images** to pages that were published without images (image prompts weren't ready yet)
2. **Replace images** on existing pages (better prompts discovered, new graphic packs from client)
3. **Swap component graphics** (stats bar, sliders, benefits sections) with new versions
4. **Replace article content** on existing pages (better prompts, SEO changes, new articles)
5. **Update CTA buttons** across pages (new URL, new text)
6. **Bulk update** any/all of the above across 200+ pages

The user should **NEVER have to log into WordPress/Elementor to edit pages manually.** PromptFlow is the single source of truth. Every element on every page should be controllable from PromptFlow at any time.

## Goal

Build a unified system that allows users to:
1. Generate images for articles that don't have them yet → push to existing pages
2. Regenerate ALL images for articles with existing images → replace on existing pages
3. Swap component library graphics (slots 1-3) on existing pages
4. Replace article content on existing pages (re-run through prompt chain or paste new content)
5. Update CTA text/URL across all pages
6. Do all of the above in bulk (per workflow, per website, or selected articles)
7. **Never need to log into WordPress/Elementor again** — PromptFlow controls everything

---

## Existing Architecture (What We're Building On)

### Page Update Pattern (ALREADY EXISTS)
The `push-images` endpoint in `server/routes/articles.js` (lines 570-698) already implements the **delete-and-recreate** pattern:
1. Get existing page slug (preserves URL)
2. Delete old WordPress page
3. Create new page with same slug + updated content
4. Update article's `wp_post_id` with new page ID

**This is THE pattern for all post-publish updates.** WordPress/Elementor's REST API can't reliably update `_elementor_data` in-place.

### Image Generation (ALREADY EXISTS)
- `server/services/image-pipeline.js` — `processArticleWithImages()` generates images per section
- Three prompt modes: `main_prompt`, `guided_gpt`, `smart_prompt`
- Image bank matching: `server/services/image-bank.js`
- Single image regeneration: `POST /api/articles/:id/regenerate-image`

### Component Library (ALREADY EXISTS)
- `server/services/component-library-service.js` — `selectComponentsForArticle(workflowId, tag)`
- Sequential/random rotation per slot per tag
- Three slots: Slot 1 (Hero/Slider), Slot 2 (Stats Bar), Slot 3 (Benefits)
- Components injected at page build time by `buildElementorPage()`

### Article Image Panel UI (ALREADY EXISTS)
- `src/components/articles/ArticleListView.tsx` (lines 1658-1948)
- Shows image grid with placement badges, WP status, Regenerate/View buttons
- Push Images button (purple, in header)
- Regenerate single image button per image

---

## PHASE 1: Push/Replace Article Images on Existing Pages

### 1A. Generate Images for Imageless Articles

**Use Case:** Published 200 articles without images. Now image prompts are dialed in. Want to generate images for all of them and push to existing pages.

**New Button in Article Images tab:**
```
[Generate Images] — visible when article has wp_post_id BUT no generated_images
```

**Backend flow:**
```
1. POST /api/articles/:articleId/generate-images (NEW ENDPOINT)
   Input: { articleId, workflowId }

2. Server:
   a. Fetch article.final_content from DB
   b. Fetch image settings (prompt mode, avatar, style DNA, etc.) from workflow/website
   c. Call processArticleWithImages() from image-pipeline.js
   d. Upload generated images to WordPress Media Library
   e. Save to article.generated_images (with wpMediaId, wpMediaUrl, pushedToWp=true)
   f. Return generated images array

3. Frontend: Shows new images in the image grid
4. User clicks "Push Images to Page" (existing button) → triggers page rebuild
```

**New endpoint:** `POST /api/articles/:articleId/generate-images`

**File:** `server/routes/articles.js` (add after existing regenerate-image endpoint ~line 847)

```javascript
router.post('/:articleId/generate-images', async (req, res) => {
  const { articleId } = req.params;
  const { workflowId } = req.body;

  // 1. Fetch article content
  const article = await sql`SELECT * FROM articles WHERE id = ${articleId}`;
  if (!article[0]?.final_content) {
    return res.status(400).json({ error: 'Article has no content to generate images for' });
  }

  // 2. Fetch image settings from workflow/website
  //    - Get live_prompt_mode, style_dna, avatar settings
  //    - Get API keys from settings

  // 3. Call image pipeline
  const pipelineResult = await processArticleWithImages(article[0].final_content, {
    livePromptMode: settings.live_prompt_mode,
    // ... other settings
  });

  // 4. Upload each image to WordPress Media Library
  //    - Use same upload logic as push-images endpoint

  // 5. Save to article.generated_images
  //    - Mark each image: pushedToWp=true, wpMediaId, wpMediaUrl

  // 6. Return images
  res.json({ success: true, images: updatedImages });
});
```

### 1B. Replace ALL Images on an Article

**Use Case:** "We figured out better prompts. Replace ALL pictures on this article."

**New Button in Article Images tab:**
```
[Regenerate All Images] — visible when article HAS generated_images
```
This is different from individual "Regenerate" per image. This:
1. Generates a full new set using current image settings/prompts
2. Uploads all to WordPress Media Library
3. Replaces the article's `generated_images` array
4. User then clicks "Push Images to Page" to update the WordPress page

**Backend flow:**
Same as 1A but for articles that already have images. The key difference:
- **Check `shouldUpdateImages` pattern** — in this case, we ARE intentionally replacing, so the endpoint must explicitly set `forceReplace: true` to bypass the "never overwrite images" protection.
- Old WordPress media files: Keep them (don't delete from Media Library — client might use elsewhere)

**New endpoint:** `POST /api/articles/:articleId/regenerate-all-images`

```javascript
router.post('/:articleId/regenerate-all-images', async (req, res) => {
  // Same as generate-images but:
  // 1. Article ALREADY has generated_images
  // 2. We're REPLACING them (set shouldUpdateImages = true intentionally)
  // 3. Old images preserved in WP Media Library (don't delete)
  // 4. New images uploaded, article.generated_images overwritten
});
```

### 1C. Push Updated Images to Existing Page

**The existing `POST /api/articles/:articleId/push-images` endpoint (line 450-698 in articles.js) ALREADY handles this!**

Current flow:
1. Upload any un-pushed images to WP Media Library
2. If article has `wp_post_id` AND images:
   - Fetch existing page → save slug
   - Delete old page
   - Rebuild page with images embedded
   - Create new page with same slug
   - Update article with new `wp_post_id`

**No changes needed** to this endpoint for Phase 1. The existing "Push Images" button (purple, in article header) already triggers this.

### 1D. Bulk Generate + Push Images

**Use Case:** "Generate images for ALL 200 articles and push to pages."

**New UI:** Add bulk action buttons to the article list header (or a dropdown):
```
[Bulk Actions ▼]
  ├─ Generate Missing Images (articles without images that have wp_post_id)
  ├─ Regenerate All Images (replace images on all articles)
  └─ Push All Images to Pages (push generated images to WP pages)
```

**Backend:** `POST /api/articles/bulk-generate-images`

```javascript
router.post('/bulk-generate-images', async (req, res) => {
  const { workflowId, mode } = req.body;
  // mode: 'missing' (only articles without images) or 'all' (regenerate everything)

  // 1. Fetch articles for workflow
  //    - If mode=missing: WHERE generated_images IS NULL OR generated_images = '[]'
  //    - If mode=all: all articles with wp_post_id

  // 2. For each article (sequential to avoid API rate limits):
  //    a. Generate images via pipeline
  //    b. Upload to WP Media Library
  //    c. Save to article
  //    d. Rebuild page with images
  //    e. Report progress via SSE or polling

  // 3. Return summary: { total, succeeded, failed, errors[] }
});
```

**Progress tracking:** Use the same pattern as batch article generation — either Server-Sent Events or a polling endpoint that returns `{ processed: 15, total: 200, currentArticle: "keyword..." }`.

---

## PHASE 2: Replace Article Content on Existing Pages

### 2A. Replace Single Article Content

**Use Case:** "SEO changed. We wrote new articles with better prompts. Push the new content to the existing pages."

**Scenario 1 — Re-generate via prompt chain:**
User re-runs an article through the prompt chain (already supported in batch processing). The new `final_content` is saved to the article. Now they want to push it to the existing WordPress page.

**Scenario 2 — Article already re-generated, just needs push:**
The article's `final_content` in the DB has been updated (via batch re-run or manual edit). User clicks "Push Content to Page" and the existing WP page gets rebuilt with the new text.

**New Button in Article Detail/Header:**
```
[Push Content to Page ↑] — visible when article has wp_post_id AND final_content
```

This is essentially the same as the existing "Push All to WP" flow, but specifically for CONTENT updates on articles that already have a `wp_post_id`. The page gets rebuilt with:
- Current `final_content` (the new text)
- Current `generated_images` (preserved)
- Current component assignments (preserved or re-selected)
- Current CTA settings (from website)

**Backend:** Uses the same `rebuildPage()` service from Phase 3 below. No special endpoint needed beyond the unified rebuild.

### 2B. Bulk Re-push Content to All Pages

**Use Case:** "We re-ran ALL articles through the prompt chain. Now push all the new content to WordPress."

**Bulk action in dropdown:**
```
├─ Push Updated Content to Pages (articles where content changed since last push)
```

**Tracking:** Add a comparison between `article.updated_at` and `article.wp_published_at`. If `updated_at > wp_published_at`, the content has changed since the last push.

### 2C. Re-generate + Push (Full Article Refresh)

**Use Case:** "Run these articles through the new prompts AND push to WordPress."

This combines:
1. Batch re-run through prompt chain (already exists)
2. Optionally regenerate images (new)
3. Push everything to existing pages (new)

**The batch processing loop in App.tsx (~line 1290) already handles re-running articles.** We just need to add a checkbox/option:
```
☑ Push to existing WordPress pages after generation
☑ Regenerate images with new content
```

When these are checked, after each article is processed through the prompt chain, automatically trigger the page rebuild with the new content + new images.

---

## PHASE 3: Component Graphics Control (Stats Bar, Sliders, Benefits)
> (Previously Phase 2 before content replacement was added)

### 2A. Swap Component on Existing Pages

**Use Case:** Client gives you 4 new stats bar graphics. You add them to Component Library. Now you want ALL existing pages to use the new graphics instead of the old ones.

**How it works today:**
1. Components selected at page BUILD time via `selectComponentsForArticle()`
2. Selected component's Elementor template ID or SR alias injected into page JSON
3. Once published, the template ID is frozen in the page's `_elementor_data`

**Key insight:** For **Elementor Template** components (not Slider Revolution), the page contains a `template_id` reference. If you update the saved template in WordPress, ALL pages using that template_id update automatically — no page rebuild needed!

**For Slider Revolution** components: Same thing — the page contains `[rev_slider alias="xyz"]` shortcode. If you update the SR module, all pages update.

**So for component graphics, we may NOT need the delete-and-recreate pattern!** We just need:
1. User updates the template/module in WordPress
2. All pages automatically show the new version

**HOWEVER — if you want to change WHICH component is in which slot** (not just update the template contents), THEN you need page rebuilds.

### 2B. Re-assign Components to Existing Pages

**Use Case:** "I want Slot 2 to use template #456 instead of template #123 on all existing pages."

**New endpoint:** `POST /api/elementor/bulk-update-components`

```javascript
router.post('/bulk-update-components', async (req, res) => {
  const { workflowId, websiteId } = req.body;

  // 1. Fetch all articles with wp_post_id for this workflow
  // 2. For each article:
  //    a. Re-run selectComponentsForArticle() with CURRENT component library state
  //    b. Rebuild Elementor page with new component assignments
  //    c. Delete old page, create new with same slug
  //    d. Update wp_post_id
  // 3. Return summary
});
```

**Sequential/Random re-assignment:** The existing rotation logic handles this:
- **Sequential:** Components cycle through in order (using rotation state tracking)
- **Random:** Random selection per article
- Reset rotation state before bulk re-assignment if user wants fresh distribution

**Frontend trigger:** Button in Component Library Section:
```
[Push Component Changes to All Pages] (with confirmation: "This will rebuild X pages")
```

---

## PHASE 4: Unified Page Rebuild Service

All the bulk operations above share the same core pattern. Extract into a shared service:

**New file:** `server/services/page-rebuild-service.js`

```javascript
/**
 * Rebuilds a WordPress page while preserving its URL slug.
 * Used by: push images, update CTA, swap components, etc.
 *
 * @param {Object} article - Article record from DB
 * @param {Object} wpCredentials - { wpUrl, wpUser, wpPassword }
 * @param {Object} options - What to update
 * @param {Array} options.images - New images array (or null to keep existing)
 * @param {Object} options.components - New component assignments (or null to keep existing)
 * @param {string} options.ctaText - New CTA text (or null to keep existing)
 * @param {string} options.ctaUrl - New CTA URL (or null to keep existing)
 * @param {string} options.status - Page status (draft/publish)
 */
async function rebuildPage(article, wpCredentials, options = {}) {
  // 1. Get existing page slug
  const existingPage = await getPage(wpCredentials, article.wp_post_id);
  const slug = existingPage.slug;
  const status = options.status || existingPage.status;

  // 2. Build updated content
  const chunked = chunkContent(article.final_content, { maxWords: 300 });

  // 3. Embed images (new or existing)
  const images = options.images || article.generated_images || [];
  embedImagesInChunks(chunked, images);

  // 4. Select components (new or re-use saved)
  const components = options.components ||
    await selectComponentsForArticle(article.workflow_id, article.tag);

  // 5. Build Elementor page
  const elementorData = buildElementorPage(chunked, {
    title: article.keyword,
    ctaText: options.ctaText || article.cta_text || 'Book Now!',
    ctaUrl: options.ctaUrl || article.cta_url || '#',
    components,
    // ... other options
  });

  // 6. Delete old page
  await deletePage(wpCredentials, article.wp_post_id);

  // 7. Create new page with same slug
  const newPage = await createElementorPage(wpCredentials, {
    title: article.keyword,
    slug,
    elementorMeta: buildElementorMeta(elementorData),
    status
  });

  // 8. Update article record
  await sql`UPDATE articles SET wp_post_id = ${newPage.id} WHERE id = ${article.id}`;

  return { oldPageId: article.wp_post_id, newPageId: newPage.id, slug };
}

/**
 * Bulk rebuild pages for a workflow/website
 */
async function bulkRebuildPages(workflowId, websiteId, options = {}, progressCallback) {
  const articles = await sql`
    SELECT * FROM articles
    WHERE workflow_id = ${workflowId}
    AND wp_post_id IS NOT NULL
  `;

  const results = { total: articles.length, succeeded: 0, failed: 0, errors: [] };

  for (const article of articles) {
    try {
      await rebuildPage(article, wpCredentials, options);
      results.succeeded++;
      if (progressCallback) progressCallback(results);
    } catch (error) {
      results.failed++;
      results.errors.push({ articleId: article.id, error: error.message });
    }
  }

  return results;
}
```

**This shared service is then used by ALL bulk operations:**
- Bulk update CTA → `bulkRebuildPages(wfId, wsId, { ctaText, ctaUrl })`
- Bulk push images → `bulkRebuildPages(wfId, wsId, { images: 'regenerate' })`
- Bulk swap components → `bulkRebuildPages(wfId, wsId, { components: 'reselect' })`
- Bulk update everything → `bulkRebuildPages(wfId, wsId, { ctaText, ctaUrl, images: 'regenerate', components: 'reselect' })`

---

## UI Design

### Article Images Tab - New Buttons

```
┌─────────────────────────────────────────────────┐
│ Article Images                                   │
│                                                  │
│  [Generate Images]  ← only when NO images exist  │
│  [Regenerate All]   ← only when images exist     │
│  [Push to Page ↑]   ← existing button            │
│                                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │
│  │ hero │ │ sec1 │ │ sec2 │ │ sec3 │            │
│  │      │ │      │ │      │ │      │            │
│  │[Regen]│ │[Regen]│ │[Regen]│ │[Regen]│          │
│  │[View] │ │[View] │ │[View] │ │[View] │          │
│  └──────┘ └──────┘ └──────┘ └──────┘            │
└─────────────────────────────────────────────────┘
```

### Bulk Actions Dropdown (Article List Header)

```
┌───────────────────────────────────────────────────────┐
│ Articles (147 total)               [Bulk Actions ▼]   │
│                                                       │
│  Dropdown:                                            │
│  ── IMAGES ──                                         │
│  ├─ Generate Missing Images (32 articles)             │
│  ├─ Regenerate All Images (147 articles)              │
│  ├─ Push Images to Pages (47 unpushed)                │
│  ── CONTENT ──                                        │
│  ├─ Push Updated Content to Pages (12 changed)        │
│  ── COMPONENTS & CTA ──                               │
│  ├─ Update CTA on All Pages                           │
│  ├─ Refresh Components on All Pages                   │
│  ── NUCLEAR OPTION ──                                 │
│  └─ Full Page Rebuild (content + images + CTA + comp) │
└───────────────────────────────────────────────────────┘
```

### Progress Modal (During Bulk Operations)

```
┌─────────────────────────────────────────────────┐
│ Regenerating Images                    [Cancel]  │
│                                                  │
│  Progress: 47 / 200                              │
│  ████████████░░░░░░░░░░░░  23.5%                │
│                                                  │
│  Current: "Best plumber in Austin TX"            │
│  Succeeded: 45  │  Failed: 2                     │
│                                                  │
│  Errors:                                         │
│  ├─ Article #123: OpenAI rate limit              │
│  └─ Article #456: WordPress upload failed        │
│                                                  │
│  [Retry Failed]  [Close]                         │
└─────────────────────────────────────────────────┘
```

Use React Portal for this modal (Golden Rule 7).

---

## Implementation Order

### Session 1: Core Infrastructure (Page Rebuild Service)
1. Create `server/services/page-rebuild-service.js` with `rebuildPage()` and `bulkRebuildPages()`
2. Extract common logic from existing `push-images` endpoint into this service
3. Add progress tracking utility (SSE helper or polling state)
4. Test the core rebuild with a single article

### Session 2: Image Operations
1. Create `POST /api/articles/:articleId/generate-images` endpoint
2. Create `POST /api/articles/:articleId/regenerate-all-images` endpoint
3. Create `POST /api/articles/bulk-generate-images` endpoint
4. Add "Generate Images" and "Regenerate All" buttons to Article Images tab
5. Wire "Push Images to Page" to use the new rebuild service

### Session 3: Content + CTA + Components
1. Add "Push Content to Page" button for single articles
2. Create `POST /api/elementor/bulk-update-cta` endpoint
3. Create `POST /api/elementor/bulk-update-components` endpoint
4. Create `POST /api/elementor/bulk-rebuild-pages` (unified "Full Page Rebuild" endpoint)
5. Add batch processing option: "Push to existing WP pages after generation"
6. Add batch processing option: "Regenerate images with new content"

### Session 4: Frontend Bulk UI
1. Add Bulk Actions dropdown to article list header
2. Build progress modal with React Portal
3. Add "Push Component Changes" button to Component Library section
4. Add "Update CTA on All Pages" button to website settings
5. Wire all bulk operations to the unified rebuild service
6. Add "changed since last push" detection (updated_at vs wp_published_at)

### Session 5: Testing & Polish
1. Test single-article generate images → push to page
2. Test single-article regenerate all images → push to page
3. Test single-article push content update
4. Test bulk generate missing images across workflow
5. Test bulk replace all images across workflow
6. Test bulk CTA update
7. Test bulk component swap
8. Test "Full Page Rebuild" (everything at once)
9. Test error handling, retry logic, edge cases
10. Verify page slugs/URLs preserved in all scenarios

---

## Golden Rules to Follow

| Rule | Relevance |
|------|-----------|
| **#1 Image Pipeline Order** | Images → Page → Meta. When rebuilding, upload images FIRST, then build page. |
| **#2 Never overwrite images accidentally** | The `generate-images` endpoint is intentional, NOT accidental. Use explicit `forceReplace` flag. |
| **#7 React Portals for modals** | Progress modal and confirmation dialogs must use portals. |
| **#9 Never silently swallow errors** | Show ALL errors in progress modal. Log to console with descriptive messages. |
| **#13 All images through WP first** | Generated images must be uploaded to WP Media Library before page embed. No base64 in DB. |
| **#16 DB migrations via setup-all.mjs** | If any new columns needed, add migration AND update setup-all.mjs. |

## What NOT to Do

- Do NOT try to update `_elementor_data` in-place via WordPress REST API — it doesn't work reliably. Always delete-and-recreate.
- Do NOT delete old media files from WordPress Media Library when replacing images — client might use them elsewhere.
- Do NOT run image generation in parallel — API rate limits. Process sequentially with progress reporting.
- Do NOT bypass the `shouldUpdateImages` check without the explicit `forceReplace` flag.
- Do NOT change the existing `push-images` endpoint behavior — it already works correctly for its use case.
- Do NOT store base64 image data in the database — always upload to WP first (Golden Rule 13).
- Do NOT forget to preserve page slugs when rebuilding — URLs must stay the same.
- Do NOT modify `selectComponentsForArticle()` — it already handles sequential/random rotation correctly.

## Edge Cases

1. **Article with no `final_content`** — can't generate images. Skip with error message.
2. **Article with no `wp_post_id`** — hasn't been published yet. Skip for "push to page" but allow image generation.
3. **WordPress credentials missing/invalid** — fail fast with clear error.
4. **Rate limiting** — use retry logic from `retryFetch()` (already implemented in llm-service.ts).
5. **Page slug already taken** — after deleting old page and creating new, WordPress may append `-2`. Handle by checking slug and retrying immediately after delete.
6. **Component rotation state** — when doing bulk component refresh, decide: reset rotation (fresh distribution) or continue from current state. Add option in UI.

## Files to Create

| File | Purpose |
|------|---------|
| `server/services/page-rebuild-service.js` | Shared page rebuild + bulk rebuild logic |

## Files to Modify

| File | Change |
|------|--------|
| `server/routes/articles.js` | Add generate-images, regenerate-all-images, bulk-generate-images endpoints |
| `server/routes/elementor.js` | Add bulk-update-cta, bulk-update-components, bulk-rebuild-pages endpoints |
| `src/components/articles/ArticleListView.tsx` | Add Generate/Regenerate All buttons, Push Content button, Bulk Actions dropdown, Progress modal |
| `src/components/ComponentLibrarySection.tsx` | Add "Push Changes to Pages" button |
| `src/components/AgencyManager.tsx` | Add "Update CTA on All Pages" button |
| `App.tsx` | Add batch processing options: "Push to existing WP pages", "Regenerate images with new content" |

## Database Changes

No new tables needed. Possible additions:
```sql
-- Track bulk operation history (optional, nice to have)
ALTER TABLE articles ADD COLUMN last_page_rebuild_at TIMESTAMP;
ALTER TABLE articles ADD COLUMN page_rebuild_count INTEGER DEFAULT 0;
```

If added, follow Golden Rule 16: create migration file AND update setup-all.mjs.
