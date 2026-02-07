# Phase 6: Surgical Page Editing (Pages We Didn't Create)

**Project:** Post-Publish Full Page Control System
**Priority:** HIGH — Enables SEO work on existing client sites
**Scope:** New service for parsing/editing Elementor pages in-place + endpoints + UI
**Prerequisite:** Phase 2 (rebuild service) should be complete, but this phase is architecturally independent — it uses a different editing approach (in-place vs delete-and-recreate).
**Context Budget:** Should complete under 40% context window.

---

## What You're Building

A system that can edit ANY Elementor page — including pages PromptFlow didn't create — by modifying widget values in-place without changing page structure. This is fundamentally different from the rebuild approach used in Phases 2-5.

**The SEO use case:** Client has an existing website with pages that have decent layouts but weak content. An SEO agency wants to rewrite all the text with better, AI-generated content without touching the page structure, images, or layout. The pages keep their existing SEO juice, their existing structure, their existing graphics — just better words.

## Why This Is Different From Phases 2-5

| | Phases 2-5 (Rebuild) | Phase 6 (Surgical Edit) |
|---|---|---|
| **Approach** | Delete page, create new one from scratch | Modify existing page JSON in-place |
| **Page structure** | Our builder creates the structure | Original structure preserved exactly |
| **Best for** | Pages WE created with PromptFlow | Pages someone else created |
| **Text changes** | Rebuilds everything | Swaps text inside existing widgets |
| **Image changes** | Rebuilds everything | Swaps URLs inside existing image widgets |
| **Layout changes** | Full control | Cannot change — structure must stay same |
| **Risk** | Slug must be preserved | Elementor rendering cache may need clearing |

## The Technical Limitation (Document This Clearly)

**What works reliably (value changes):**
Changing values INSIDE existing widgets. The page structure — containers, columns, sections, widgets — stays identical. Elementor sees the same structure with different content.

- Text widget: change the `editor` HTML field → works
- Image widget: change `image.url` and `image.id` → works
- Heading widget: change the `title` field → works
- Button widget: change `text` and `url` fields → works
- ALL text widgets at once → works (same type of change, just more of them)

**What is unreliable (structural changes):**
Adding, removing, or rearranging widgets/sections/containers. Elementor's internal rendering cache can get out of sync.

- Adding a new section → unreliable
- Removing a section or widget → unreliable
- Moving a widget to a different column → unreliable
- Changing column count in a section → unreliable
- Changing widget type (text → image) → unreliable

**Bottom line:** You can rewrite ALL the text and swap ALL the images on any page. You cannot change the page layout or add/remove elements.

---

## Background: Elementor Page Structure

### How `_elementor_data` Works

Every Elementor page stores its content in a WordPress meta field called `_elementor_data`. It's a JSON array with a nested tree structure:

```
Page
└── Sections (or Containers in newer Elementor)
    └── Columns
        └── Widgets
            ├── text-editor: { settings: { editor: "<p>HTML content here</p>" } }
            ├── heading: { settings: { title: "Heading Text" } }
            ├── image: { settings: { image: { url: "https://...", id: 123 } } }
            ├── button: { settings: { text: "Click Me", link: { url: "https://..." } } }
            ├── template: { settings: { template_id: 456 } }
            └── shortcode: { settings: { shortcode: "[rev_slider alias='xyz']" } }
```

Each element has:
- `id` — unique element ID (alphanumeric string like "3a2b4c5d")
- `elType` — "section", "column", "widget", or "container"
- `widgetType` — for widgets: "text-editor", "heading", "image", "button", etc.
- `settings` — all the widget's configurable values
- `elements` — child elements (nested array)

### How to Read a Page via REST API

```javascript
// Fetch page with Elementor data
const response = await fetch(`${wpUrl}/wp-json/wp/v2/pages/${pageId}`, {
  headers: { 'Authorization': 'Basic ' + btoa(`${wpUser}:${wpPassword}`) }
});
const page = await response.json();

// _elementor_data is in the meta field (may need ?context=edit to access meta)
// OR it may be accessible via a separate meta endpoint
const elementorData = JSON.parse(page.meta._elementor_data);
```

**Note:** You may need to use `?context=edit` on the REST API call to access meta fields. Check the actual WordPress REST API response to see how `_elementor_data` is exposed. Some setups require fetching meta separately via `/wp-json/wp/v2/pages/{id}?context=edit` or via Elementor's own API endpoints.

### How to Push Changes Back

```javascript
// Update the page with modified _elementor_data
await fetch(`${wpUrl}/wp-json/wp/v2/pages/${pageId}`, {
  method: 'POST', // WordPress uses POST for updates
  headers: {
    'Authorization': 'Basic ' + btoa(`${wpUser}:${wpPassword}`),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    meta: {
      _elementor_data: JSON.stringify(modifiedElementorData)
    }
  })
});
```

**Important:** After pushing, Elementor may serve a cached version. The page might need its Elementor CSS regenerated. Check if there's an Elementor API endpoint for clearing/regenerating page CSS, or if simply re-saving triggers it.

---

## What to Build

### 6A. Elementor Page Parser Service

**New file:** `server/services/elementor-page-parser.js`

A service that can parse `_elementor_data` and provide a usable map of all editable content on a page.

**Functions to build:**

#### `parseElementorPage(elementorData)`
Walk the nested JSON tree and extract all editable widgets into a flat list.

```javascript
/**
 * Parses Elementor page JSON into a flat list of editable widgets.
 * @param {Array} elementorData - Parsed _elementor_data JSON
 * @returns {Object} {
 *   texts: [{ id, path, widgetType, content, sectionIndex }],
 *   images: [{ id, path, widgetType, url, mediaId, sectionIndex }],
 *   headings: [{ id, path, widgetType, text, tag, sectionIndex }],
 *   buttons: [{ id, path, widgetType, text, url, sectionIndex }],
 *   templates: [{ id, path, templateId, sectionIndex }],
 *   summary: { totalWidgets, textWidgets, imageWidgets, headingWidgets, buttonWidgets }
 * }
 */
function parseElementorPage(elementorData) {
  const result = { texts: [], images: [], headings: [], buttons: [], templates: [], summary: {} };

  function walkTree(elements, path = [], sectionIndex = 0) {
    for (const element of elements) {
      const currentPath = [...path, element.id];

      if (element.elType === 'widget') {
        switch (element.widgetType) {
          case 'text-editor':
            result.texts.push({
              id: element.id,
              path: currentPath,
              widgetType: element.widgetType,
              content: element.settings?.editor || '',
              sectionIndex,
            });
            break;
          case 'image':
            result.images.push({
              id: element.id,
              path: currentPath,
              widgetType: element.widgetType,
              url: element.settings?.image?.url || '',
              mediaId: element.settings?.image?.id || null,
              sectionIndex,
            });
            break;
          case 'heading':
            result.headings.push({
              id: element.id,
              path: currentPath,
              widgetType: element.widgetType,
              text: element.settings?.title || '',
              tag: element.settings?.header_size || 'h2',
              sectionIndex,
            });
            break;
          case 'button':
            result.buttons.push({
              id: element.id,
              path: currentPath,
              widgetType: element.widgetType,
              text: element.settings?.text || '',
              url: element.settings?.link?.url || '',
              sectionIndex,
            });
            break;
          // ... handle other widget types as needed
        }
      }

      // Track section index for position reference
      if (element.elType === 'section' || element.elType === 'container') {
        sectionIndex++;
      }

      // Recurse into children
      if (element.elements && element.elements.length > 0) {
        walkTree(element.elements, currentPath, sectionIndex);
      }
    }
  }

  walkTree(elementorData);
  // Build summary counts
  return result;
}
```

#### `applyTextEdits(elementorData, edits)`
Apply text changes to the Elementor JSON without changing structure.

```javascript
/**
 * Applies text edits to Elementor page data IN-PLACE.
 * Only changes values inside existing widgets — never adds/removes/moves elements.
 *
 * @param {Array} elementorData - The original _elementor_data (will be deep-cloned internally)
 * @param {Array} edits - Array of { widgetId, newContent } for text-editor widgets
 *                        OR { widgetId, newTitle } for heading widgets
 *                        OR { widgetId, newText, newUrl } for button widgets
 * @returns {Array} Modified elementorData (new object, original unchanged)
 */
function applyTextEdits(elementorData, edits) {
  const modified = JSON.parse(JSON.stringify(elementorData)); // Deep clone
  const editMap = new Map(edits.map(e => [e.widgetId, e]));

  function walkAndApply(elements) {
    for (const element of elements) {
      if (element.elType === 'widget' && editMap.has(element.id)) {
        const edit = editMap.get(element.id);
        switch (element.widgetType) {
          case 'text-editor':
            if (edit.newContent !== undefined) element.settings.editor = edit.newContent;
            break;
          case 'heading':
            if (edit.newTitle !== undefined) element.settings.title = edit.newTitle;
            break;
          case 'button':
            if (edit.newText !== undefined) element.settings.text = edit.newText;
            if (edit.newUrl !== undefined) element.settings.link.url = edit.newUrl;
            break;
        }
      }
      if (element.elements?.length > 0) walkAndApply(element.elements);
    }
  }

  walkAndApply(modified);
  return modified;
}
```

#### `applyImageSwaps(elementorData, swaps)`
Swap image URLs/IDs in existing image widgets.

```javascript
/**
 * Swaps images in Elementor page data IN-PLACE.
 * Only changes image URL and media ID inside existing image widgets.
 *
 * @param {Array} elementorData - The original _elementor_data
 * @param {Array} swaps - Array of { widgetId, newUrl, newMediaId }
 * @returns {Array} Modified elementorData
 */
function applyImageSwaps(elementorData, swaps) {
  const modified = JSON.parse(JSON.stringify(elementorData));
  const swapMap = new Map(swaps.map(s => [s.widgetId, s]));

  function walkAndSwap(elements) {
    for (const element of elements) {
      if (element.elType === 'widget' && element.widgetType === 'image' && swapMap.has(element.id)) {
        const swap = swapMap.get(element.id);
        if (element.settings.image) {
          element.settings.image.url = swap.newUrl;
          element.settings.image.id = swap.newMediaId;
        }
      }
      if (element.elements?.length > 0) walkAndSwap(element.elements);
    }
  }

  walkAndSwap(modified);
  return modified;
}
```

#### `createPageAudit(pageData, parsedContent)`
Create an inventory/manifest of everything on a page before making changes.

```javascript
/**
 * Creates a detailed audit/inventory of a page's contents.
 * Use this BEFORE making changes so the user has a record of what existed.
 *
 * @param {Object} pageData - WordPress page object (title, slug, status, etc.)
 * @param {Object} parsedContent - Output from parseElementorPage()
 * @returns {Object} Audit record with full inventory
 */
function createPageAudit(pageData, parsedContent) {
  return {
    auditedAt: new Date().toISOString(),
    page: {
      id: pageData.id,
      title: pageData.title?.rendered || pageData.title,
      slug: pageData.slug,
      status: pageData.status,
      url: pageData.link,
    },
    content: {
      textWidgets: parsedContent.texts.map(t => ({
        widgetId: t.id,
        section: t.sectionIndex,
        contentPreview: t.content.substring(0, 200) + (t.content.length > 200 ? '...' : ''),
      })),
      imageWidgets: parsedContent.images.map(i => ({
        widgetId: i.id,
        section: i.sectionIndex,
        url: i.url,
        mediaId: i.mediaId,
      })),
      headingWidgets: parsedContent.headings.map(h => ({
        widgetId: h.id,
        section: h.sectionIndex,
        text: h.text,
        tag: h.tag,
      })),
      buttonWidgets: parsedContent.buttons.map(b => ({
        widgetId: b.id,
        section: b.sectionIndex,
        text: b.text,
        url: b.url,
      })),
    },
    summary: parsedContent.summary,
  };
}
```

### 6B. Backend Endpoints

**File:** `server/routes/elementor.js` (add new endpoints)

#### `POST /api/elementor/audit-page`

Pull a page and return its full content inventory.

```
Accept: { wpUrl, wpUser, wpPassword, pageId }

Flow:
1. Fetch page from WordPress REST API (with meta/context=edit)
2. Parse _elementor_data JSON
3. Call parseElementorPage() to get widget map
4. Call createPageAudit() to build inventory
5. Return audit object
```

Use case: User clicks "Audit Page" to see what's on an existing page before making any changes.

#### `POST /api/elementor/surgical-edit`

Apply text and/or image edits to an existing page without changing structure.

```
Accept: {
  wpUrl, wpUser, wpPassword,
  pageId,
  textEdits: [{ widgetId, newContent }],      // optional
  headingEdits: [{ widgetId, newTitle }],      // optional
  imageSwaps: [{ widgetId, newUrl, newMediaId }], // optional
  buttonEdits: [{ widgetId, newText, newUrl }],   // optional
  createAudit: boolean  // save a before-snapshot (default true)
}

Flow:
1. Fetch page from WordPress REST API
2. Parse _elementor_data
3. If createAudit: call createPageAudit() and save/return it
4. Apply text edits via applyTextEdits()
5. Apply image swaps via applyImageSwaps()
6. Push modified _elementor_data back to WordPress via REST API POST
7. Return { success, audit (if created), widgetsModified }
```

#### `POST /api/elementor/bulk-surgical-edit`

Apply the same text replacement across multiple existing pages.

```
Accept: {
  wpUrl, wpUser, wpPassword,
  pageIds: [123, 456, 789],
  // For bulk text replacement, provide new content per page:
  editsPerPage: {
    123: { textEdits: [...], imageSwaps: [...] },
    456: { textEdits: [...], imageSwaps: [...] },
  },
  createAudits: boolean
}

Flow:
1. Set up SSE via setupSSE(res)
2. For each page (SEQUENTIAL):
   a. Fetch page
   b. Create audit if requested
   c. Apply edits
   d. Push back
   e. Send progress
3. sendComplete(results)
```

#### `POST /api/elementor/replace-all-text`

Higher-level endpoint: replace ALL text content on a page with new content. The service figures out the widget mapping automatically.

```
Accept: {
  wpUrl, wpUser, wpPassword,
  pageId,
  newContent: "The full new article text...",
  createAudit: boolean
}

Flow:
1. Fetch page, parse _elementor_data
2. Call parseElementorPage() to find all text widgets
3. Use chunkContent() to split new content into sections
4. Map new content chunks to existing text widgets (in order):
   - First text widget gets first chunk
   - Second text widget gets second chunk
   - If more text widgets than chunks: leave remaining widgets unchanged
   - If more chunks than widgets: combine remaining chunks into last widget
5. Build edit list from the mapping
6. Apply edits via applyTextEdits()
7. Push back to WordPress
8. Return { success, audit, widgetsModified, unmappedChunks }
```

This is the "rewrite the page" endpoint — you give it the new text and it distributes it across the existing text widgets.

### 6C. Frontend

**File:** `src/components/articles/ArticleListView.tsx` (or a new component if cleaner)

#### Page Audit View

When a user selects an article that has `wp_post_id`, add an option to audit the current WordPress page:

```
[Audit Live Page] → calls POST /api/elementor/audit-page
```

Shows results in a panel:
- List of text widgets with content previews
- List of images with URLs (thumbnails if possible)
- List of headings
- List of buttons with URLs

#### Surgical Edit UI

After auditing, user can:
1. See all text widgets listed
2. Click to expand and edit any widget's content
3. Click "Push Edits to Page" to apply changes

OR for a full content replacement:
1. The article's `final_content` is the new text
2. Click "Replace Text on Live Page" → uses the replace-all-text endpoint
3. Confirmation: "This will replace text on the live WordPress page. Layout and images will be preserved."

---

## Files to Read (Before Writing Code)

| File | What to Look For |
|---|---|
| `server/services/wordpress-publisher.js` | `getPage()` — how pages are fetched, what fields are available |
| `server/services/sse-progress.js` | `setupSSE()` for bulk operations |
| `server/services/content-chunker.js` | `chunkContent()` for splitting new content |
| `server/routes/elementor.js` | Existing endpoint patterns, how WP auth is handled |
| `src/components/articles/ArticleListView.tsx` | Where to add audit/edit UI |

## Files to Create

| File | Purpose |
|---|---|
| `server/services/elementor-page-parser.js` | `parseElementorPage()`, `applyTextEdits()`, `applyImageSwaps()`, `createPageAudit()` |

## Files to Modify

| File | Change |
|---|---|
| `server/routes/elementor.js` | Add `audit-page`, `surgical-edit`, `bulk-surgical-edit`, `replace-all-text` endpoints |
| `src/components/articles/ArticleListView.tsx` | Add audit view, surgical edit UI, replace text button |

---

## Golden Rules (Must Follow)

1. **#9 Never Silently Swallow Errors:** If a surgical edit fails (Elementor doesn't pick up the change), report it clearly. Don't pretend it worked.
2. **#13 All Images Through WP First:** When swapping images, new images must already be in the WP Media Library with a media ID. Don't embed external URLs.
3. **#7 React Portals for Modals:** Audit view and confirmation dialogs use portals.

## What NOT to Do

- Do NOT add, remove, or move elements in `_elementor_data`. Only change VALUES inside existing widgets.
- Do NOT change `elType`, `widgetType`, or structural properties of any element.
- Do NOT modify element `id` fields — these are Elementor's internal references.
- Do NOT delete pages when doing surgical edits — the whole point is to preserve the page structure.
- Do NOT assume `_elementor_data` is always in page meta — check how the specific WordPress/Elementor setup exposes it. May need `?context=edit` or a separate endpoint.
- Do NOT skip the audit step — always offer to create a before-snapshot so changes can be understood/reverted.
- Do NOT try to handle structural changes "just this once" — the limitation is fundamental. If someone needs structural changes, they should use the Elementor editor directly.

## Known Limitations (Document in UI)

These limitations should be communicated to the user in the UI (tooltip, info text, or help section):

1. **Text and images only.** Surgical editing can change text content, headings, button text/URLs, and swap images. It cannot add new sections, remove elements, or change the page layout.
2. **Elementor pages only.** This only works on pages built with Elementor. Classic WordPress pages or pages built with other builders (Gutenberg, Divi, etc.) have different data structures.
3. **Cache clearing may be needed.** After surgical edits, Elementor may serve a cached version. If changes don't appear immediately, the Elementor CSS cache may need to be regenerated (Settings → Elementor → Tools → Regenerate CSS).
4. **Audit before editing.** Always audit a page before making changes so you have a record of the original state.

---

## Validation

1. **Audit a page we created:** Verify parseElementorPage finds all widgets correctly
2. **Audit a page we didn't create:** Verify it still parses (different structure, possibly different widget types)
3. **Surgical text edit — single widget:** Change one text widget's content, verify on WordPress
4. **Surgical text edit — all widgets:** Replace all text, verify layout preserved, only text changed
5. **Surgical image swap:** Swap one image URL, verify new image appears, layout preserved
6. **Replace all text:** Give full new article text, verify it distributes across existing text widgets correctly
7. **Bulk surgical edit:** Edit 3 pages, verify SSE progress and all pages updated
8. **Audit creation:** Verify before-snapshot is saved and contains accurate inventory
9. **Edge cases:**
   - Page with no text widgets → return meaningful error
   - Page with mixed widget types we don't handle → skip unknown types, edit known ones
   - Invalid _elementor_data → fail gracefully with descriptive error
   - Elementor data not accessible via REST API → clear error about permissions/configuration
