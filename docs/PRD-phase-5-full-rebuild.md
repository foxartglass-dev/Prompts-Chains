# Phase 5: Full Page Rebuild + Consolidation

**Project:** Post-Publish Full Page Control System
**Priority:** MEDIUM — the finishing touches
**Scope:** "Nuclear option" rebuild-everything endpoint, refactor existing endpoints to use shared service, polish UI.
**Prerequisite:** Phases 2, 3, and 4 must be complete.
**Context Budget:** Should complete under 40% context window.

---

## What You're Building

Three things:

1. **Full Page Rebuild endpoint** — the "nuclear option" that lets users rebuild all pages with updated content + images + CTA + components at once.
2. **Refactor existing endpoints** — make the original push-images and bulk-update-cta use the shared rebuild service (eliminating code duplication).
3. **Complete the Bulk Actions UI** — finalize the dropdown with all options and wire everything together.

---

## Background: What Already Exists

### Services Built in Previous Phases

**`server/services/page-rebuild-service.js`** (Phase 2):
- `rebuildPage(article, wpCredentials, options)` — rebuilds one page, preserves slug
- `bulkRebuildPages(articles, wpCredentials, options, progressCallback)` — bulk with progress
- `deletePageDirect(wpCredentials, pageId)` — deletes a WordPress page

**`server/services/sse-progress.js`** (Phase 2):
- `setupSSE(res)` — returns `{ sendProgress, sendComplete, sendError }`

### Endpoints Built in Previous Phases

| Endpoint | Phase | File |
|---|---|---|
| `POST /api/articles/:id/generate-images` | 1 | articles.js |
| `POST /api/articles/:id/regenerate-all-images` | 1 | articles.js |
| `POST /api/articles/bulk-generate-images` | 1 | articles.js |
| `POST /api/articles/:id/push-images` | Pre-existing | articles.js |
| `POST /api/elementor/bulk-update-cta` | Pre-existing | elementor.js |
| `POST /api/articles/:id/push-content` | 3 | articles.js |
| `POST /api/articles/bulk-push-content` | 3 | articles.js |
| `POST /api/elementor/bulk-update-components` | 4 | elementor.js |

### Existing Endpoints to Refactor

**1. Push Images** (`server/routes/articles.js`, lines 560-825):
- Currently has its own inline delete-and-recreate logic
- Should be refactored to use `rebuildPage()` after uploading images

**2. Bulk Update CTA** (`server/routes/elementor.js`, lines 2757-2920):
- Currently has its own inline delete-and-recreate logic (~160 lines)
- Should be refactored to use `bulkRebuildPages()` with CTA options

### Key Functions (Actual Names & Locations)

| Function | Import From | Purpose |
|---|---|---|
| `rebuildPage(article, wpCreds, options)` | `page-rebuild-service.js` | Rebuild one page |
| `bulkRebuildPages(articles, wpCreds, options, cb)` | `page-rebuild-service.js` | Bulk rebuild |
| `setupSSE(res)` | `sse-progress.js` | SSE streaming |
| `processArticleWithImages(content, options)` | `image-pipeline.js` | Generate images |
| `selectComponentsForArticle(wfId, tag)` | `component-library-service.js` | Select components |

---

## What to Build

### 5A. Full Page Rebuild Endpoint

**New endpoint:** `POST /api/elementor/bulk-rebuild-pages`

**File:** `server/routes/elementor.js`

This is the "nuclear option" — rebuild every published page with whatever combination of updates the user selects.

```
Accept: {
  workflowId,
  websiteId,
  wpUrl, wpUser, wpPassword,
  options: {
    updateContent: boolean,      // Use latest final_content from DB
    regenerateImages: boolean,   // Re-run image pipeline (slow)
    updateCta: boolean,          // Apply current CTA from website settings
    refreshComponents: boolean,  // Re-select components from library
    resetRotation: boolean,      // Reset component rotation state
  }
}

Flow:
1. Validate WordPress credentials
2. Set up SSE: const { sendProgress, sendComplete, sendError } = setupSSE(res)
3. Fetch all articles with wp_post_id for this workflow
4. Fetch website settings (CTA text/URL if updateCta is true)
5. Fetch workflow template styles
6. If resetRotation → reset component_rotation_state for workflow
7. For each article (SEQUENTIAL — not parallel):
   a. If regenerateImages:
      → Call processArticleWithImages() to generate new images
      → Upload to WP Media Library
      → Save to article.generated_images
      → Send progress: "Generating images for: [keyword]"
   b. Build rebuild options:
      - images: (new images if regenerated, null otherwise)
      - ctaText/ctaUrl: (from website settings if updateCta, null otherwise)
      - components: null (forces re-selection if refreshComponents,
                    or use saved if not)
      - templateStyles: from workflow
   c. Call rebuildPage(article, wpCredentials, rebuildOptions)
   d. Send progress update via SSE
8. sendComplete(results summary)
```

**Important:** When `regenerateImages` is true, this is an intentional replacement. Images must be generated and uploaded to WP Media Library BEFORE the page rebuild (Golden Rule #1). The existing `processArticleWithImages()` from `image-pipeline.js` handles the upload.

**For `refreshComponents`:** When true, pass `components: null` to `rebuildPage()` so it calls `selectComponentsForArticle()`. When false, you need to fetch the article's current component assignments and pass them explicitly to avoid re-selection.

### 5B. Refactor Push Images Endpoint

**File:** `server/routes/articles.js` (lines 560-825)

The existing push-images endpoint has ~265 lines of inline rebuild logic. After Phase 2 created the shared service, this can be simplified.

**Current flow (keep the image upload part, replace the rebuild part):**
```
Lines 560-674: Image upload logic (KEEP AS-IS)
  → Uploads un-pushed images to WP Media Library
  → Updates article.generated_images with wpMediaId/wpMediaUrl

Lines 675-825: Delete-and-recreate logic (REPLACE WITH rebuildPage())
  → Get slug, delete page, build new page, create page, update DB
```

**New flow after refactor:**
```
1. (Lines 560-674 unchanged) Upload images to WP
2. Fetch fresh article from DB (now has updated generated_images)
3. Call rebuildPage(article, wpCredentials, {
     images: article.generated_images,  // just-uploaded images
     templateStyles: fetchedStyles,
   })
4. Return { success, newPageId, slug }
```

**BE CAREFUL:** This endpoint currently works. Test thoroughly after refactoring. If the refactored version produces different results, something is wrong.

### 5C. Refactor Bulk Update CTA Endpoint

**File:** `server/routes/elementor.js` (lines 2757-2920)

The existing bulk-update-cta has ~160 lines of inline rebuild logic per article. Replace with `bulkRebuildPages()`.

**Current flow (simplify significantly):**
```
Lines 2757-2790: Setup, credential validation, article fetching (KEEP)
Lines 2791-2920: Per-article rebuild loop (REPLACE)
  → For each article: get slug, chunk content, embed images,
    build page, delete old, create new, update DB
```

**New flow after refactor:**
```
1. (Setup, validation, article fetching — keep as-is)
2. Call bulkRebuildPages(articles, wpCredentials, {
     ctaText: req.body.ctaText,
     ctaUrl: req.body.ctaUrl,
   }, progressCallback)
3. Return results summary
```

**Note:** The existing endpoint does NOT use SSE — it returns a final JSON result. Keep this behavior for backward compatibility (the frontend expects a JSON response, not SSE). The `bulkRebuildPages()` function works with both — just use the `progressCallback` for logging, not SSE.

### 5D. Complete Bulk Actions UI

**File:** `src/components/articles/ArticleListView.tsx`

Finalize the complete Bulk Actions area. By this phase, these items should already exist:

```
── IMAGES ── (Phase 1)
├─ Generate Missing Images (N articles)
├─ Regenerate All Images (N articles)
├─ Push Images to Pages (N unpushed)

[Update CTA on Published Pages] (Pre-existing)

── CONTENT ── (Phase 3)
├─ Push Updated Content to Pages (N changed)

── COMPONENTS ── (Phase 4)
├─ Refresh Components on All Pages
```

**Add the "Full Page Rebuild" option:**
```
── FULL REBUILD ──
└─ Full Page Rebuild...
```

When clicked, show an **options modal** (React Portal):
```
┌──────────────────────────────────────────────────┐
│ Full Page Rebuild                                 │
│                                                    │
│ Rebuild X published pages with selected updates:   │
│                                                    │
│ ☑ Update content from database                     │
│ ☐ Regenerate images (slow — makes API calls)       │
│ ☑ Apply current CTA settings                       │
│ ☑ Refresh component assignments                    │
│   ☐ Reset rotation (distribute evenly)             │
│                                                    │
│ ⚠ This will rebuild every page. URLs preserved.    │
│                                                    │
│ [Rebuild All Pages]  [Cancel]                      │
└──────────────────────────────────────────────────┘
```

Wire this to `POST /api/elementor/bulk-rebuild-pages` with SSE. Use the existing progress modal.

### 5E. Progress Modal Verification

Verify the existing progress modal (built in Phase 1) works for ALL bulk operations:
- Image generation (Phase 1) — already works
- Content push (Phase 3) — verify SSE integration
- Component refresh (Phase 4) — verify SSE integration
- Full rebuild (Phase 5) — verify SSE integration
- CTA update (pre-existing) — does NOT use SSE, uses JSON response (different flow)

If the progress modal doesn't handle all cases cleanly, add the necessary state/logic.

---

## Files to Read (Before Writing Code)

| File | What to Look For | Lines |
|---|---|---|
| `server/services/page-rebuild-service.js` | Full service API | Full file |
| `server/services/sse-progress.js` | setupSSE usage | Full file |
| `server/routes/articles.js` | push-images endpoint (to refactor) | 560-825 |
| `server/routes/elementor.js` | bulk-update-cta endpoint (to refactor) | 2757-2920 |
| `server/services/image-pipeline.js` | processArticleWithImages signature | Search for the export |
| `src/components/articles/ArticleListView.tsx` | Bulk actions area, progress modal | Search for "Bulk", "progress" |

## Files to Create

None.

## Files to Modify

| File | Change |
|---|---|
| `server/routes/elementor.js` | Add `bulk-rebuild-pages` endpoint; refactor `bulk-update-cta` |
| `server/routes/articles.js` | Refactor `push-images` to use rebuild service |
| `src/components/articles/ArticleListView.tsx` | Add "Full Page Rebuild" option + options modal |

---

## Golden Rules (Must Follow)

1. **#1 Image Pipeline Order:** Images → Page → Meta. When regenerating images in full rebuild, generate + upload FIRST, then rebuild page.
2. **#2 Never Overwrite Images Accidentally:** Image regeneration in full rebuild is INTENTIONAL — user explicitly checked the box.
3. **#7 React Portals for Modals:** Options modal and progress modal must use `createPortal()`.
4. **#9 Never Silently Swallow Errors:** ALL errors visible in progress display. Log to console with descriptive messages.
5. **#13 All Images Through WP First:** Regenerated images must be uploaded to WP Media Library before page embed.

## What NOT to Do

- Do NOT break existing push-images behavior when refactoring. Test before and after.
- Do NOT break existing bulk-update-cta behavior when refactoring. Test before and after.
- Do NOT change the bulk-update-cta response format — frontend expects JSON, not SSE.
- Do NOT run image regeneration in parallel — sequential to avoid API rate limits.
- Do NOT delete old WP media files when regenerating images. Client might use them.
- Do NOT skip the options modal for Full Rebuild — user must explicitly choose what to update.
- Do NOT modify `selectComponentsForArticle()` — it works correctly.

---

## Validation

### Refactoring Tests (Critical — Must Not Break Working Features)

1. **Push Images (refactored):**
   - Generate images for an article → Push Images → verify page has images
   - Compare with pre-refactor behavior: same slug, same layout, same images
   - Test with article that has no images → should handle gracefully

2. **Bulk Update CTA (refactored):**
   - Change CTA URL in website settings → click "Update CTA on Published Pages"
   - Verify all pages rebuilt with new CTA
   - Verify JSON response format unchanged (not SSE)
   - Compare with pre-refactor behavior

### New Feature Tests

3. **Full Page Rebuild — content only:**
   - Check only "Update content" → rebuild
   - Verify new content appears, images preserved, CTA preserved, components preserved

4. **Full Page Rebuild — everything:**
   - Check all options → rebuild
   - Verify content updated, images regenerated, CTA updated, components refreshed
   - Verify page URLs/slugs preserved

5. **Full Page Rebuild — images only:**
   - Check only "Regenerate images" → rebuild
   - Verify images regenerated and appear on page
   - Verify content, CTA, components unchanged

6. **Progress modal:**
   - Verify SSE progress works for full rebuild
   - Verify cancel button works
   - Verify error display works
   - Verify "Retry Failed" works (if implemented)

### Edge Cases

7. Article with no content → skip with error in progress
8. Article with no wp_post_id → should not appear in the list
9. WordPress credentials invalid → fail fast before starting bulk
10. Image generation fails for one article → continue with others, show error
