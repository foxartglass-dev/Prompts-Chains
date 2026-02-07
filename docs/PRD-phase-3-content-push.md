# Phase 3: Content Push Operations

**Project:** Post-Publish Full Page Control System
**Priority:** HIGH
**Scope:** Backend endpoints + frontend buttons for pushing updated content to existing WordPress pages. Single article + bulk + batch integration.
**Prerequisite:** Phase 2 (page rebuild service) must be complete.
**Context Budget:** Should complete under 40% context window.

---

## What You're Building

The ability to push updated article content to existing WordPress pages. Three scenarios:

1. **Single article:** User edited content or re-ran through prompt chain. Push the new text to the existing page.
2. **Bulk push:** Re-ran ALL articles. Push all updated content to WordPress at once.
3. **Batch integration:** When running articles through the prompt chain, optionally auto-push to WordPress after generation.

---

## Background: What Already Exists

### Page Rebuild Service (Built in Phase 2)

**`server/services/page-rebuild-service.js`** — provides:
- `rebuildPage(article, wpCredentials, options)` — rebuilds one page, preserves slug
- `bulkRebuildPages(articles, wpCredentials, options, progressCallback)` — rebuilds many pages with progress
- `deletePageDirect(wpCredentials, pageId)` — deletes a WordPress page

### SSE Progress Utility (Built in Phase 2)

**`server/services/sse-progress.js`** — provides:
- `setupSSE(res)` — returns `{ sendProgress, sendComplete, sendError }`

### Existing Push Patterns

- `POST /api/articles/:articleId/push-images` — pushes images to existing page (articles.js:560-825)
- `POST /api/elementor/bulk-update-cta` — updates CTA on all pages (elementor.js:2757-2920)
- Both use the delete-and-recreate pattern now extracted into `rebuildPage()`

### Key Database Columns (Already Exist)

- `articles.final_content` — the article text (source of truth for content)
- `articles.wp_post_id` — WordPress page ID (null = not published)
- `articles.wp_published_at` — timestamp of last push to WordPress
- `articles.updated_at` — timestamp of last article modification
- `articles.generated_images` — JSON array of image objects
- `articles.workflow_id` — which workflow this article belongs to

### Batch Processing Loop

The existing batch processing in `App.tsx` (~line 1290) runs articles through the prompt chain. After each article completes, `final_content` is updated in the DB. We're adding optional hooks that fire after each article finishes.

### Key Functions (Actual Names & Locations)

| Function | Import From | Purpose |
|---|---|---|
| `rebuildPage(article, wpCreds, options)` | `../services/page-rebuild-service.js` | Rebuilds one page (Phase 2) |
| `bulkRebuildPages(articles, wpCreds, options, cb)` | `../services/page-rebuild-service.js` | Bulk rebuild (Phase 2) |
| `setupSSE(res)` | `../services/sse-progress.js` | SSE streaming (Phase 2) |
| `chunkContent(content, options)` | `../services/content-chunker.js` | Splits article into sections |
| `buildElementorPage(chunked, options)` | `../services/elementor-builder.js` | Builds Elementor JSON |
| `getElementorMetaFields(data)` | `../services/elementor-builder.js` | Returns WP meta fields |

---

## What to Build

### 3A. Single Article Content Push — Backend

**New endpoint:** `POST /api/articles/:articleId/push-content`

**File:** `server/routes/articles.js` (add near the existing push-images endpoint)

```
Flow:
1. Fetch article from DB (must have wp_post_id AND final_content)
2. If no wp_post_id → return 400 "Article not published yet"
3. If no final_content → return 400 "Article has no content"
4. Fetch website credentials (from request body or article's website)
5. Fetch workflow template styles from workflow_elementor_styles table
6. Call rebuildPage(article, wpCredentials, { templateStyles })
   → This re-uses existing images, re-selects components, keeps existing CTA
7. Return { success: true, newPageId, slug }
```

**Credential fetching pattern:** Follow the same pattern as `publish-article` endpoint (elementor.js:2291-2312):
- Accept `wpUrl, wpUser, wpPassword` in request body
- Fall back to website credentials from DB if not provided

### 3B. Bulk Content Push — Backend

**New endpoint:** `POST /api/articles/bulk-push-content`

**File:** `server/routes/articles.js`

```
Flow:
1. Accept { workflowId, websiteId, mode } where mode is:
   - 'changed' → only articles where updated_at > wp_published_at
   - 'all' → all articles with wp_post_id
2. Set up SSE: const { sendProgress, sendComplete, sendError } = setupSSE(res)
3. Fetch website credentials
4. Fetch matching articles:
   - mode='changed': WHERE workflow_id = ? AND wp_post_id IS NOT NULL
                      AND updated_at > wp_published_at
   - mode='all': WHERE workflow_id = ? AND wp_post_id IS NOT NULL
5. Fetch template styles for workflow
6. Call bulkRebuildPages(articles, wpCredentials, { templateStyles }, (progress) => {
     sendProgress(progress);
   })
7. sendComplete(results)
```

**Important:** The `updated_at > wp_published_at` comparison is how we detect "changed since last push." Both columns already exist in the schema.

### 3C. Single Article Content Push — Frontend

**File:** `src/components/articles/ArticleListView.tsx`

Add a **"Push Content to Page"** button. It should appear:
- In the article detail/header area (near existing "Push Images" button)
- Only when article has `wp_post_id` AND `final_content`
- Styled similarly to existing push buttons

```
Button: [Push Content to Page ↑]
  → Calls POST /api/articles/:articleId/push-content
  → Shows loading state during push
  → Shows success/error toast after
```

### 3D. Bulk Content Push — Frontend

**File:** `src/components/articles/ArticleListView.tsx`

Add to the existing Bulk Actions area (near the existing "Bulk Image Actions" dropdown and "Update CTA" button):

Option 1 — Add to existing dropdown:
```
── CONTENT ──
├─ Push Updated Content to Pages (N changed)
```

Option 2 — Separate button (if dropdown is getting too crowded):
```
[Push Content to Pages (N changed)]
```

The count `(N changed)` should show: `articles.filter(a => a.wp_post_id && a.updated_at > a.wp_published_at).length`

This should trigger the bulk endpoint with SSE and use the **existing progress modal** (already built for Phase 1 bulk image operations). The progress modal already uses React Portal and handles SSE streaming.

### 3E. Batch Processing Integration

**File:** `App.tsx`

In the batch processing flow (~line 1290), add two optional checkboxes:

```
☑ Push to existing WordPress pages after generation
☑ Regenerate images with new content
```

These are state variables that control post-generation behavior. After each article finishes the prompt chain:

```javascript
// After article.final_content is saved to DB...
if (pushToWpAfterGen && article.wp_post_id) {
  if (regenImagesWithNewContent) {
    // Call regenerate-all-images endpoint first (already exists)
    await fetch(`/api/articles/${article.id}/regenerate-all-images`, { ... });
  }
  // Then push content to page
  await fetch(`/api/articles/${article.id}/push-content`, { ... });
}
```

**Where to put the checkboxes:** In the batch processing configuration UI, near the existing "Generate Images" toggle. Look for where batch options are configured before the processing loop starts.

---

## Files to Read (Before Writing Code)

| File | What to Look For | Lines |
|---|---|---|
| `server/services/page-rebuild-service.js` | `rebuildPage()` and `bulkRebuildPages()` signatures | Full file |
| `server/services/sse-progress.js` | `setupSSE()` usage | Full file |
| `server/routes/articles.js` | Existing endpoint patterns (push-images, generate-images) | 560-825, 961-1093 |
| `server/routes/articles.js` | SSE pattern in bulk-generate-images | 1220-1250 |
| `server/routes/elementor.js` | publish-article credential fetching pattern | 2291-2312 |
| `server/routes/elementor.js` | Template styles fetching pattern | 2326-2345 |
| `src/components/articles/ArticleListView.tsx` | Existing buttons, dropdown, progress modal | Look for "Push Images", "Bulk Image Actions", progress modal |
| `App.tsx` | Batch processing loop and configuration | ~line 1290 |

## Files to Create

None — all code goes in existing files.

## Files to Modify

| File | Change |
|---|---|
| `server/routes/articles.js` | Add `push-content` and `bulk-push-content` endpoints |
| `src/components/articles/ArticleListView.tsx` | Add "Push Content to Page" button + bulk dropdown item |
| `App.tsx` | Add batch processing checkboxes + post-generation hooks |

---

## Golden Rules (Must Follow)

1. **#1 Image Pipeline Order:** Images → Page → Meta. Content push re-uses existing images — they're already uploaded. Just re-embed them in the rebuilt page.
2. **#2 Never Overwrite Images Accidentally:** Content push does NOT touch images. Pass `images: null` to `rebuildPage()` to re-use existing `generated_images`.
3. **#7 React Portals for Modals:** Any confirmation dialogs must use `createPortal()`. The progress modal already does this — reuse it.
4. **#9 Never Silently Swallow Errors:** Show ALL errors to the user. Bulk operations must display individual article errors.

## What NOT to Do

- Do NOT regenerate images when pushing content — that's a separate operation. Content push only updates text.
- Do NOT modify the existing push-images or bulk-update-cta endpoints. They're untouched until Phase 5.
- Do NOT create a new progress modal — reuse the existing one from Phase 1 bulk image operations.
- Do NOT run bulk operations in parallel — process sequentially to avoid API rate limits.
- Do NOT skip the template styles fetch — pages need `workflow_elementor_styles` to maintain their formatting.
- Do NOT forget to update `wp_published_at` after pushing — `rebuildPage()` should handle this, but verify.

---

## Validation

1. **Single push:** Edit an article's `final_content` in the DB. Click "Push Content to Page." Verify:
   - Page URL/slug unchanged
   - New text appears on WordPress page
   - Existing images still appear
   - `wp_published_at` updated in DB

2. **Bulk push (changed mode):** Update 2-3 articles. Run bulk push with mode='changed'. Verify:
   - Only changed articles are processed
   - Progress streams via SSE
   - All page slugs preserved
   - Unchanged articles are skipped

3. **Bulk push (all mode):** Run with mode='all'. Verify all published articles are rebuilt.

4. **Batch integration:** Run batch processing with "Push to WP" checked. Verify:
   - Articles go through prompt chain first
   - After each article finishes, content is pushed to existing page
   - If "Regenerate images" is also checked, images regenerate before push

5. **Edge cases:**
   - Article with no `wp_post_id` → should return error "not published yet"
   - Article with no `final_content` → should return error "no content"
   - WordPress credentials missing → should fail fast with clear error
