# Phase 4: Component Bulk Operations

**Project:** Post-Publish Full Page Control System
**Priority:** MEDIUM — independent from Phase 3, depends only on Phase 2
**Scope:** One backend endpoint + frontend buttons for bulk component re-assignment on existing pages.
**Prerequisite:** Phase 2 (page rebuild service) must be complete. Phase 3 is NOT required.
**Context Budget:** Smallest phase — well under 40% context window.

---

## What You're Building

The ability to change which component graphics (stats bars, sliders, benefits sections) appear on existing published pages, in bulk. When a user adds new components to the library or wants to redistribute, they click one button and all pages get rebuilt with updated component assignments.

---

## Background: What Already Exists

### Component Library System

**`server/services/component-library-service.js`** — provides:
- `selectComponentsForArticle(workflowId, tag)` — selects components for 3 slots using rotation
- Returns: `{ slot1, slot2, slot3 }` where each slot has a component object
- Rotation modes: **sequential** (cycles in order) or **random**
- Rotation state tracked in `component_rotation_state` table

**Three slots:**
- Slot 1: Hero/Slider (Slider Revolution or Elementor Template)
- Slot 2: Stats Bar (Elementor Template)
- Slot 3: Benefits Section (Elementor Template)

**Key insight — Template Content Updates vs. Slot Re-assignment:**
- If the user updates a saved Elementor template's CONTENT in WordPress (new graphics, new layout), ALL pages using that `template_id` update automatically — no page rebuild needed.
- If the user updates a Slider Revolution module, ALL pages with that shortcode alias update automatically.
- Page rebuilds are ONLY needed when changing WHICH component is assigned to WHICH slot (e.g., swap template #123 for template #456).

### Page Rebuild Service (Built in Phase 2)

**`server/services/page-rebuild-service.js`** — provides:
- `rebuildPage(article, wpCredentials, options)` — rebuilds one page, preserves slug
- `bulkRebuildPages(articles, wpCredentials, options, progressCallback)` — rebuilds many with progress
- When `options.components` is `null`, `rebuildPage()` calls `selectComponentsForArticle()` to get fresh assignments

### SSE Progress Utility (Built in Phase 2)

**`server/services/sse-progress.js`** — provides:
- `setupSSE(res)` — returns `{ sendProgress, sendComplete, sendError }`

### Existing CTA Bulk Update (Already Done)

`POST /api/elementor/bulk-update-cta` (elementor.js:2757) already exists with full UI. The component bulk update follows the same pattern.

### Key Database Tables

- `component_rotation_state` — tracks rotation position per workflow per slot
- `articles` — `workflow_id`, `wp_post_id`, `keyword` (contains tag like "(H)")

---

## What to Build

### 4A. Bulk Component Re-assignment — Backend

**New endpoint:** `POST /api/elementor/bulk-update-components`

**File:** `server/routes/elementor.js` (add near the existing `bulk-update-cta` endpoint)

```
Flow:
1. Accept { workflowId, websiteId, resetRotation, wpUrl, wpUser, wpPassword }
2. Validate WordPress credentials
3. Set up SSE: const { sendProgress, sendComplete, sendError } = setupSSE(res)
4. Fetch all articles with wp_post_id for this workflow:
   SELECT * FROM articles WHERE workflow_id = ? AND wp_post_id IS NOT NULL
5. Send initial progress: { total: articles.length, phase: 'starting' }
6. If resetRotation is true:
   → DELETE FROM component_rotation_state WHERE workflow_id = ?
   → This resets rotation to position 0 for fresh even distribution
7. Call bulkRebuildPages(articles, wpCredentials, {
     workflowId,
     resetRotation,
     // components: null → forces re-selection via selectComponentsForArticle()
     // images: null → re-uses existing images
     // ctaText/ctaUrl: null → keeps existing CTA
   }, (progress) => {
     sendProgress(progress);
   })
8. sendComplete(results)
```

**Rotation state behavior:**
- `resetRotation: false` (default) — rotation continues from where it left off. If component library has 4 items in a slot and rotation is at position 2, bulk rebuild starts assigning from position 2.
- `resetRotation: true` — rotation resets to 0. All articles get redistributed evenly across all available components.

**Credential pattern:** Follow the same pattern as `bulk-update-cta` (elementor.js:2759):
- Accept `wpUrl, wpUser, wpPassword` in request body
- These are required (no fallback to DB in bulk operations)

### 4B. Frontend — Component Library Section Button

**File:** `src/components/ComponentLibrarySection.tsx`

Add a **"Refresh Components on All Pages"** button:

```
[Refresh Components on All Pages ↻]
```

Where to place it: In the component library management area, near where components are listed/managed.

When clicked, show a **confirmation modal** (must use React Portal):
```
┌──────────────────────────────────────────────────┐
│ Refresh Components on All Pages                   │
│                                                    │
│ This will rebuild X published pages with updated   │
│ component assignments from the current library.    │
│                                                    │
│ Page URLs will be preserved.                       │
│                                                    │
│ ☑ Reset rotation (redistribute components evenly)  │
│                                                    │
│ Note: If you only changed a template's content     │
│ (not which template is assigned), you don't need   │
│ this — template changes appear automatically.      │
│                                                    │
│ [Refresh All Pages]  [Cancel]                      │
└──────────────────────────────────────────────────┘
```

The modal needs:
- A checkbox for "Reset rotation"
- A count of how many pages will be rebuilt
- An info note about template content vs. slot assignment
- WordPress credentials (pull from current website context or prompt)

After clicking "Refresh All Pages":
- Call `POST /api/elementor/bulk-update-components` with SSE
- Show progress (reuse existing progress modal pattern from Phase 1)
- Show results summary when complete

### 4C. Frontend — Bulk Actions Dropdown Item

**File:** `src/components/articles/ArticleListView.tsx`

Add to the Bulk Actions area (wherever bulk image actions and CTA update are):

```
── COMPONENTS ──
├─ Refresh Components on All Pages
```

This can trigger the same confirmation modal and endpoint as 4B.

---

## Files to Read (Before Writing Code)

| File | What to Look For | Lines |
|---|---|---|
| `server/services/page-rebuild-service.js` | `rebuildPage()` and `bulkRebuildPages()` signatures | Full file |
| `server/services/sse-progress.js` | `setupSSE()` usage | Full file |
| `server/services/component-library-service.js` | `selectComponentsForArticle()` signature, rotation logic | Full file |
| `server/routes/elementor.js` | `bulk-update-cta` as pattern reference | 2757-2920 |
| `src/components/ComponentLibrarySection.tsx` | Current UI structure, where to add button | Full file |
| `src/components/articles/ArticleListView.tsx` | Existing bulk actions area, progress modal | Search for "Bulk", "CTA", progress modal |

## Files to Create

None.

## Files to Modify

| File | Change |
|---|---|
| `server/routes/elementor.js` | Add `bulk-update-components` endpoint |
| `src/components/ComponentLibrarySection.tsx` | Add "Refresh Components on All Pages" button + confirmation modal |
| `src/components/articles/ArticleListView.tsx` | Add bulk dropdown item for component refresh |

---

## Golden Rules (Must Follow)

1. **#1 Image Pipeline Order:** Images → Page → Meta. Component refresh re-uses existing images — don't regenerate them.
2. **#7 React Portals for Modals:** Confirmation modal MUST use `createPortal()`. Check existing modal patterns in the file.
3. **#9 Never Silently Swallow Errors:** Show ALL errors in progress/results display.

## What NOT to Do

- Do NOT modify `selectComponentsForArticle()` — it already handles rotation correctly.
- Do NOT delete old WordPress media when rebuilding — components are templates, not images.
- Do NOT run rebuilds in parallel — sequential processing to avoid WordPress API issues.
- Do NOT forget the rotation state reset option — without it, bulk redistribution won't be even.
- Do NOT trigger rebuilds when only template CONTENT changed — add the info note in the UI explaining this.
- Do NOT modify the existing `bulk-update-cta` endpoint. It stays untouched.

---

## Validation

1. **Bulk component refresh (continue rotation):**
   - Set up 3 components in a slot, note current rotation position
   - Run bulk refresh with resetRotation=false
   - Verify components assigned starting from current rotation position
   - Verify all page URLs/slugs preserved

2. **Bulk component refresh (reset rotation):**
   - Run bulk refresh with resetRotation=true
   - Verify `component_rotation_state` was reset
   - Verify even distribution across all components

3. **Frontend:**
   - Button visible in Component Library Section
   - Confirmation modal appears with page count
   - Reset rotation checkbox works
   - Progress shows during rebuild
   - Errors displayed if any pages fail

4. **Edge cases:**
   - No published articles → show "No published pages to update" message
   - WordPress credentials invalid → fail fast before starting bulk
   - Component library empty for a slot → page builds without that slot (existing behavior)
