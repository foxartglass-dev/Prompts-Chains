# Phase 2: Shared Page Rebuild Service + SSE Utility

**Project:** Post-Publish Full Page Control System
**Priority:** HIGH — This is the foundation all future phases depend on
**Scope:** Backend only. Two new service files. No frontend changes.
**Context Budget:** Should complete well under 40% context window.

---

## What You're Building

A shared service that rebuilds WordPress pages while preserving their URL slugs. Right now, the delete-and-recreate pattern is duplicated in two places. You're extracting it into one reusable service, plus creating a shared SSE progress utility.

## Why This Matters

WordPress/Elementor's REST API **cannot reliably update `_elementor_data` in-place.** Every page update requires: delete old page, build new content, create new page with same slug. This pattern exists in two places today and will be needed by 4+ more features. Without a shared service, we'll have 6 copies of the same 100-line pattern.

---

## Background: What Already Exists

### The Two Existing Implementations

**Implementation 1 — Push Images** (`server/routes/articles.js`, lines 560-825):
- Uploads images to WP Media Library
- Gets existing page slug
- Deletes old page
- Rebuilds with images embedded
- Creates new page with same slug
- Updates `wp_post_id` in database

**Implementation 2 — Bulk Update CTA** (`server/routes/elementor.js`, lines 2757-2920):
- Gets existing page slug (line 2808)
- Chunks content (line 2815)
- Re-embeds existing images into chunks (lines 2818-2856)
- Rebuilds page with updated CTA text/URL (lines 2859-2864)
- Deletes old page via inline fetch DELETE (line 2871)
- Creates new page with same slug (lines 2885-2890)
- Updates article record (lines 2894-2901)

**Implementation 2 is the more complete reference** — it handles content chunking, image re-embedding, component selection, AND the rebuild. Use it as your primary template.

### Key Functions You'll Import (Actual Names & Locations)

| Function | Import From | Purpose |
|---|---|---|
| `chunkContent(content, options)` | `../services/content-chunker.js` | Splits article into sections |
| `buildElementorPage(chunked, options)` | `../services/elementor-builder.js` | Builds Elementor JSON structure |
| `getElementorMetaFields(elementorData)` | `../services/elementor-builder.js` | Returns WP meta fields object |
| `createElementorPage(wpCreds, pageData)` | `../services/wordpress-publisher.js` | Creates page on WordPress |
| `getPage(wpCreds, pageId)` | `../services/wordpress-publisher.js` | Fetches existing page (slug, status) |
| `selectComponentsForArticle(workflowId, tag)` | `../services/component-library-service.js` | Selects slot 1/2/3 components with rotation |

**Functions that DO NOT exist (don't try to import these):**
- ~~`buildElementorMeta()`~~ → use `getElementorMetaFields()`
- ~~`embedImagesInChunks()`~~ → image embedding is done inline (see elementor.js:2818-2856)
- ~~`deletePage()`~~ → no standalone function; page deletion is a direct `fetch(DELETE)` call (see elementor.js:2871)

### Database Columns (Already Exist — No Migrations Needed)
- `articles.wp_post_id` — WordPress page ID
- `articles.wp_published_at` — timestamp of last push
- `articles.generated_images` — JSON array of image objects
- `articles.final_content` — the article text
- `articles.updated_at` — last modification timestamp
- `articles.keyword` — contains article tag like "(H)" at end

---

## What to Build

### File 1: `server/services/page-rebuild-service.js`

**Core function: `rebuildPage(article, wpCredentials, options)`**

Parameters:
- `article` — DB record. Must have: `id`, `final_content`, `keyword`, `workflow_id`, `wp_post_id`, `generated_images`
- `wpCredentials` — `{ wpUrl, wpUser, wpPassword }`
- `options`:
  - `images` (Array|null) — new images, or null to re-use `article.generated_images`
  - `components` (Object|null) — component assignments, or null to re-select via library
  - `ctaText` (string|null) — CTA button text, or null to keep current
  - `ctaUrl` (string|null) — CTA URL, or null to keep current
  - `status` (string|null) — page status (draft/publish), or null to keep current
  - `templateStyles` (Object|null) — from `workflow_elementor_styles`, or null to skip
  - `heroImageSide` (string) — 'left' or 'right', default 'right'

Flow:
```
1. getPage() → save slug and status
2. chunkContent(article.final_content, { maxWords: 300 })
3. Embed images into chunks (sort by placement, attach to matching chunk)
   → Reference elementor.js lines 2818-2856 for the image-to-chunk attachment pattern
4. Select components (use provided or call selectComponentsForArticle())
5. buildElementorPage(chunked, { title, ctaText, ctaUrl, components, templateStyles, heroImageSide })
6. getElementorMetaFields(elementorData)
7. Delete old page (direct fetch DELETE to /wp-json/wp/v2/pages/{id}?force=true)
   → If delete fails: append '-updated' to slug (don't crash)
8. createElementorPage(wpCredentials, { title, slug, elementorMeta, status })
9. UPDATE articles SET wp_post_id, wp_post_url, wp_published_at = NOW()
10. Return { oldPageId, newPageId, slug }
```

**Title extraction:** Strip tag identifier from keyword: `"Standard Cleaning(H)"` → `"Standard Cleaning"`. See elementor.js line 2355 for the regex pattern.

**Bulk function: `bulkRebuildPages(articles, wpCredentials, options, progressCallback)`**

```javascript
async function bulkRebuildPages(articles, wpCredentials, options = {}, progressCallback) {
  const results = { total: articles.length, succeeded: 0, failed: 0, errors: [] };

  // Optional: reset component rotation for even redistribution
  if (options.resetRotation && options.workflowId) {
    // Reset component_rotation_state table for this workflow
  }

  for (const article of articles) {
    try {
      await rebuildPage(article, wpCredentials, options);
      results.succeeded++;
    } catch (error) {
      results.failed++;
      results.errors.push({ articleId: article.id, keyword: article.keyword, error: error.message });
    }
    if (progressCallback) {
      progressCallback({ ...results, currentKeyword: article.keyword });
    }
  }

  return results;
}
```

**Also add a standalone `deletePageDirect(wpCredentials, pageId)` function** — extract the inline DELETE fetch from elementor.js:2871. This will be used by `rebuildPage()` and can be exported for other uses.

### File 2: `server/services/sse-progress.js`

Extract the SSE setup pattern from `articles.js` bulk-generate-images (lines 1232-1240) into a reusable utility:

```javascript
/**
 * Sets up SSE headers and returns helper functions for streaming progress.
 * @param {Response} res - Express response object
 * @returns {{ sendProgress, sendComplete, sendError }}
 */
function setupSSE(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  return {
    sendProgress: (data) => res.write(`data: ${JSON.stringify({ type: 'progress', ...data })}\n\n`),
    sendComplete: (data) => {
      res.write(`data: ${JSON.stringify({ type: 'complete', ...data })}\n\n`);
      res.end();
    },
    sendError: (error) => {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || error })}\n\n`);
      res.end();
    },
  };
}

module.exports = { setupSSE };
```

---

## Files to Read (Before Writing Any Code)

Read these to understand the existing patterns. Do NOT modify them in this phase.

| File | What to Look For | Lines |
|---|---|---|
| `server/routes/elementor.js` | bulk-update-cta pattern (your primary template) | 2757-2920 |
| `server/routes/elementor.js` | How images are re-embedded into chunks | 2818-2856 |
| `server/routes/elementor.js` | How page slug is preserved | 2805-2812 |
| `server/routes/elementor.js` | How page is deleted via fetch | 2869-2882 |
| `server/routes/articles.js` | push-images pattern | 560-825 |
| `server/routes/articles.js` | SSE setup in bulk-generate-images | 1220-1250 |
| `server/services/wordpress-publisher.js` | createElementorPage, getPage signatures | Full file |
| `server/services/elementor-builder.js` | buildElementorPage signature and exports | Lines 915+, 1067-1083 |
| `server/services/content-chunker.js` | chunkContent signature | Top of file |
| `server/services/component-library-service.js` | selectComponentsForArticle signature | Search for the export |

## Files to Create

| File | Purpose |
|---|---|
| `server/services/page-rebuild-service.js` | Shared `rebuildPage()` + `bulkRebuildPages()` + `deletePageDirect()` |
| `server/services/sse-progress.js` | Shared `setupSSE()` utility |

## Files to Modify

None in this phase. The existing endpoints will be refactored in Phase 5 to use this service.

---

## Golden Rules (Must Follow)

1. **#1 Image Pipeline Order:** Images → Page → Meta. When rebuilding, images must be embedded in chunks BEFORE calling `buildElementorPage()`.
2. **#2 Never Overwrite Images Accidentally:** The rebuild service re-uses existing `generated_images` by default. Only replace images when explicitly passed via `options.images`.
3. **#9 Never Silently Swallow Errors:** Log all errors with descriptive messages. `bulkRebuildPages()` must collect and return ALL errors.
4. **#13 All Images Through WP First:** If images are provided, they must already have `wpMediaUrl` set. The rebuild service does NOT upload images — that's the caller's responsibility.
5. **#16 DB Migrations:** No new columns needed for this phase. If you add any, update `server/db/setup-all.mjs`.

## What NOT to Do

- Do NOT modify the existing push-images or bulk-update-cta endpoints. They stay untouched until Phase 5.
- Do NOT try to update `_elementor_data` in-place. Always delete-and-recreate.
- Do NOT delete old media files from WordPress when rebuilding. Client might use them elsewhere.
- Do NOT call `selectComponentsForArticle()` without understanding rotation state. Each call advances the rotation counter.
- Do NOT add any frontend code in this phase.
- Do NOT create inline SSE setup in the rebuild service. The SSE utility is a separate file used by endpoint handlers, not by the service itself.

---

## Validation

1. Import `rebuildPage` and test with a single article that has `wp_post_id`:
   - Verify the page URL/slug is preserved after rebuild
   - Verify content appears on the new page
   - Verify images are re-embedded correctly
   - Verify `wp_post_id` is updated in the database

2. Test `bulkRebuildPages()` with 2-3 articles:
   - Verify progress callback fires for each article
   - Verify errors are collected (not thrown)
   - Verify all page slugs preserved

3. Test `setupSSE()`:
   - Verify response headers are set correctly
   - Verify `sendProgress`, `sendComplete`, `sendError` format data correctly

4. Test edge cases:
   - Article with no `generated_images` → should rebuild without images
   - Delete page fails → should append '-updated' to slug and continue
   - Article with no `final_content` → should throw descriptive error
