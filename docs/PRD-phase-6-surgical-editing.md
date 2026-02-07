# Phase 6: Surgical Page Editing (Pages We Didn't Create)

**Project:** Post-Publish Full Page Control System
**Priority:** HIGH — Enables SEO work on existing client sites
**Scope:** New service for parsing/editing Elementor pages in-place + endpoints + UI
**Prerequisite:** Phase 2 (rebuild service) should be complete, but this phase is architecturally independent — it uses a different editing approach (in-place vs delete-and-recreate).
**Context Budget:** This is the largest phase. If context gets tight, split into two sessions:
- **Session A:** Parser service (`elementor-page-parser.js`) + all backend endpoints
- **Session B:** Frontend (`PageEditor.tsx`) + wiring to ArticleListView

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

#### `POST /api/elementor/generate-images-for-page`

Use the existing image pipeline to generate contextually-matched images for any page's content, then map them to the page's image widget slots.

```
Accept: {
  wpUrl, wpUser, wpPassword,
  pageId,
  workflowId,           // for image settings (prompt mode, style DNA, avatar, etc.)
  textOverride: null     // optional: use this text instead of page's current text
}

Flow:
1. Fetch page from WordPress, parse _elementor_data
2. Call parseElementorPage() to get text widgets and image widgets
3. If textOverride provided, use that. Otherwise concatenate all text widget content
   into a single article string (in page order, separated by newlines)
4. Fetch image settings from workflow/website:
   - live_prompt_mode, style_dna, avatar settings
   - WP credentials for upload (same as input credentials)
5. Call processArticleWithImages(articleString, pipelineOptions)
   - This is the SAME pipeline used for our own articles
   - It reads the text, generates contextual images
   - Uploads them to WP Media Library automatically
6. Map generated images to existing image widget slots:
   - Get list of image widgets from parseElementorPage() (in page order)
   - Match: generated image 1 → first image widget, image 2 → second, etc.
   - If more images generated than widget slots: extras noted but not used
   - If more widget slots than images: remaining slots left unchanged
7. Return {
     images: [{ widgetId, newUrl, newMediaId, placement, oldUrl }],
     unmappedSlots: [...],  // image widgets with no generated match
     extraImages: [...]     // generated images with no widget slot
   }
```

This endpoint does NOT push changes — it just generates images and returns the mapping. The Page Editor UI shows the results as pending swaps that the user can approve/reject before pushing.

### 6C. Frontend — Interactive Page Editor

**New file:** `src/components/PageEditor.tsx` (dedicated component — this is complex enough to warrant its own file)

This is the core UI feature. When a user pulls a page from WordPress, they see an ordered visual representation of every editable widget on the page. They can selectively edit any widget — change text here, swap an image there, leave everything else untouched — then push only the changes back.

#### Entry Point

Add a **"Edit Live Page"** button in the article detail area (ArticleListView.tsx). Visible when article has `wp_post_id`. Opens the Page Editor as a modal (React Portal).

Also add a standalone entry point for pages NOT tied to a PromptFlow article — e.g., a "Page Editor" tool accessible from the website/workflow level where the user can enter any WordPress page ID or URL.

#### Page Editor Flow

```
1. User clicks "Edit Live Page"
2. System calls POST /api/elementor/audit-page
3. Loading state while fetching
4. Page Editor modal opens with the widget list
5. User edits widgets selectively
6. User clicks "Push Changes"
7. System calls POST /api/elementor/surgical-edit with only changed widgets
8. Success/error feedback
```

#### Widget Card Layout

The page editor displays widgets as a vertical list of cards, in the exact order they appear on the page. Each card shows the widget type, current content, and action controls.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Edit Live Page: "Best Plumber in Austin TX"                         │
│ Page ID: 4521  •  URL: example.com/best-plumber-austin  •  Status: published │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ HEADING (H1)                                          [Keep ✓] │ │
│ │ "Best Plumber in Austin TX"                                    │ │
│ │                                              [Edit] [Revert]   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ IMAGE                                                 [Keep ✓] │ │
│ │ ┌──────────┐  plumber-hero.jpg                                 │ │
│ │ │ (thumb)  │  ID: #4522  •  800x600                            │ │
│ │ └──────────┘                                                   │ │
│ │                                      [Swap Image] [Revert]     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ TEXT                                             [✎ MODIFIED]  │ │
│ │ ┌───────────────────────────────────────────────────────────┐   │ │
│ │ │ When you need a reliable plumber in Austin, our team...  │   │ │
│ │ │ (editable text area — expanded)                          │   │ │
│ │ │                                                          │   │ │
│ │ └───────────────────────────────────────────────────────────┘   │ │
│ │                                              [Save] [Revert]   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ TEMPLATE                                              [— N/A]  │ │
│ │ Elementor Template #456 (Stats Bar)                            │ │
│ │ ⓘ Templates can't be edited here — update the template in WP  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ IMAGE                                          [✎ SWAPPED]     │ │
│ │ ┌──────────┐  NEW: team-photo-v2.jpg                           │ │
│ │ │ (thumb)  │  (was: team-photo.jpg)                            │ │
│ │ └──────────┘                                                   │ │
│ │                                      [Swap Image] [Revert]     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ TEXT                                                 [Keep ✓]  │ │
│ │ "Our services include emergency repairs, pipe fitting..."      │ │
│ │ (collapsed preview — click Edit to expand)                     │ │
│ │                                              [Edit] [Revert]   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ BUTTON                                                [Keep ✓] │ │
│ │ "Book Now!"  →  https://example.com/book                       │ │
│ │                                              [Edit] [Revert]   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ─────────────────────────────────────────────────────────────────── │
│ Summary: 7 widgets  •  2 modified  •  5 unchanged                   │
│                                                                     │
│ [Push 2 Changes to Page]                              [Cancel]      │
│                                                                     │
│ ⓘ Page structure will be preserved. Only modified widgets change.   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Widget Card States

Each widget card has three possible states:

1. **Keep** (default) — showing current content, collapsed. Badge: `[Keep ✓]` (green)
2. **Editing** — expanded with editable content. Badge: `[✎ MODIFIED]` (amber)
3. **Reverted** — user clicked Revert after editing, back to original. Badge: `[Keep ✓]`

#### Per-Widget-Type Editing

**Text Editor widgets:**
- Collapsed: shows first ~150 chars of content as preview
- Click "Edit" → expands to a textarea (or rich text editor if available)
- User types new content
- Click "Save" to confirm edit (stays expanded, badge changes to MODIFIED)
- Click "Revert" to discard changes and collapse back

**Heading widgets:**
- Shows heading text and tag level (H1, H2, etc.)
- Click "Edit" → inline text input appears
- Tag level is displayed but NOT editable (that would be structural)

**Image widgets:**
- Shows thumbnail of current image (loaded from the `url` in the widget)
- Shows filename and dimensions if available
- Click "Swap Image" → shows either:
  - File upload input (upload new image to WP Media Library first)
  - OR media library browser (select from existing WP media)
- After swap: shows "was: old-file.jpg" label so user can see what changed

**Button widgets:**
- Shows button text and URL
- Click "Edit" → two inline inputs: text field and URL field

**Template/Shortcode widgets:**
- Displayed with info icon: "Templates can't be edited here"
- Shows template ID or shortcode alias for reference
- No edit controls — these are structural

#### Image Swap Flow

When user clicks "Swap Image" on an image widget:

```
1. Show file picker OR "Choose from Media Library" option
2. If file upload:
   a. Upload image to WP Media Library via POST /api/elementor/upload-media
   b. Get back { wpMediaId, wpMediaUrl }
   c. Show new thumbnail in the card
   d. Store { widgetId, newUrl: wpMediaUrl, newMediaId: wpMediaId } in the edits list
3. If media library:
   a. Show a simple media browser (list of existing WP media images)
   b. User selects one
   c. Same result — store the swap in edits list
```

**Important:** Images must be in the WP Media Library before they can be swapped in. The swap is just changing which media library item the widget points to.

#### "Push Changes" Button

Only active when at least one widget has been modified. Shows count: "Push 2 Changes to Page"

When clicked:
1. Show confirmation: "This will modify 2 widgets on the live page. Structure preserved."
2. Build the edits payload from all modified widgets
3. Call `POST /api/elementor/surgical-edit`
4. Show success/error result
5. On success: update all widget cards to show new content as the baseline

#### Quick Actions (Toolbar at Top of Editor)

At the top of the editor, offer these power actions:

```
[Replace All Text ↻]        — Paste new article content, auto-distributes across text widgets
[Generate Images from Text]  — AI generates contextual images from the page text
[Upload Images]              — Manually upload client-provided images to swap in
```

**Replace All Text:**
Opens a textarea to paste new article content. Auto-maps to text widgets using `chunkContent()`. Calls `POST /api/elementor/replace-all-text`. This is the SEO rewrite power feature.

**Generate Images from Text:**
Uses the SAME image generation pipeline (`processArticleWithImages()`) that we use for our own articles — but pointed at this page's content. Flow:

```
1. Grab all text from the page's text widgets (current text, or edited text if user already made changes)
2. Concatenate into a single "article" string
3. Fetch image settings from the current workflow/website (prompt mode, style DNA, avatar, etc.)
4. Call processArticleWithImages(concatenatedText, pipelineOptions)
5. Pipeline reads the text, generates contextually-matched images
   (e.g., "we clean the counters and sink" → worker cleaning a sink)
6. Images uploaded to WP Media Library (standard pipeline behavior)
7. Auto-map generated images to existing image widget slots:
   - Generated hero image → first image widget on page
   - Generated section-1 image → second image widget
   - etc.
8. Image widget cards update to show new AI-generated images
   with thumbnails and "was: old.jpg" labels
9. User reviews each one — can keep, revert, or manually swap individual images
10. Push all changes when satisfied
```

This lets the user do a full page takeover in one session: replace all text + generate matching images + push. Or they can just generate images without changing text — the pipeline reads whatever text is currently on the page.

**New endpoint for this:** `POST /api/elementor/generate-images-for-page`

```
Accept: {
  wpUrl, wpUser, wpPassword,
  pageId,
  workflowId,          // for image settings (prompt mode, style DNA, etc.)
  useEditedText: false  // if true, use text from pending edits instead of live page
}

Flow:
1. Fetch page, parse _elementor_data
2. Extract all text widget content, concatenate into article string
3. Fetch image settings from workflow/website
4. Call processArticleWithImages(articleString, pipelineOptions)
5. Upload generated images to WP Media Library
6. Map images to existing image widget positions
7. Return { images: [{ widgetId, newUrl, newMediaId, placement }] }
```

The frontend receives the mapped images and applies them to the image widget cards as pending swaps. User can review and approve/reject each one before pushing.

**Upload Images (Manual):**
For when the client has their own photos they want on the page. Flow:

```
1. User clicks "Upload Images"
2. Shows image widget slots with current images
3. User uploads a file for any slot they want to replace
4. Each upload goes to WP Media Library via POST /api/elementor/upload-media
5. Gets back { wpMediaId, wpMediaUrl }
6. Image widget card updates with new thumbnail
7. User can mix: upload custom images for some slots, keep existing for others
8. Push all changes
```

This works alongside the AI generation — user could generate images for most slots but upload the owner's headshot for the hero image, for example.

**All three approaches can be mixed in a single session:**
- Replace some text manually (edit individual widget cards)
- Replace All Text for the body content
- Generate AI images for sections 1-3
- Upload the owner's photo for the hero
- Keep the existing footer image
- Push everything at once

#### Component Architecture

```
PageEditor (modal, React Portal)
├── PageEditorHeader (page info, quick actions toolbar)
├── WidgetCardList (scrollable list of widget cards)
│   ├── TextWidgetCard (text-editor widgets)
│   ├── HeadingWidgetCard (heading widgets)
│   ├── ImageWidgetCard (image widgets, with swap UI)
│   ├── ButtonWidgetCard (button widgets)
│   └── TemplateWidgetCard (templates/shortcodes, read-only)
├── PageEditorFooter (summary, Push Changes button, Cancel)
└── ImageSwapModal (file upload or media library picker)

---

## Files to Read (Before Writing Code)

| File | What to Look For |
|---|---|
| `server/services/wordpress-publisher.js` | `getPage()` — how pages are fetched, what fields are available |
| `server/services/image-pipeline.js` | `processArticleWithImages()` — the image generation pipeline |
| `server/services/sse-progress.js` | `setupSSE()` for bulk operations |
| `server/services/content-chunker.js` | `chunkContent()` for splitting new content |
| `server/routes/elementor.js` | Existing endpoint patterns, how WP auth is handled |
| `server/routes/articles.js` | How generate-images/regenerate endpoints call the pipeline (lines 961-1216) |
| `src/components/articles/ArticleListView.tsx` | Where to add audit/edit UI |

## Files to Create

| File | Purpose |
|---|---|
| `server/services/elementor-page-parser.js` | `parseElementorPage()`, `applyTextEdits()`, `applyImageSwaps()`, `createPageAudit()` |
| `src/components/PageEditor.tsx` | Interactive page editor modal with widget cards, editing, image swap UI |

## Files to Modify

| File | Change |
|---|---|
| `server/routes/elementor.js` | Add `audit-page`, `surgical-edit`, `bulk-surgical-edit`, `replace-all-text`, `generate-images-for-page` endpoints |
| `src/components/articles/ArticleListView.tsx` | Add "Edit Live Page" button that opens PageEditor modal |

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

### Backend
1. **Audit a page we created:** Verify parseElementorPage finds all widgets correctly
2. **Audit a page we didn't create:** Verify it still parses (different structure, possibly different widget types)
3. **Surgical text edit — single widget:** Change one text widget's content, verify on WordPress
4. **Surgical text edit — all widgets:** Replace all text, verify layout preserved, only text changed
5. **Surgical image swap:** Swap one image URL, verify new image appears, layout preserved
6. **Replace all text:** Give full new article text, verify it distributes across existing text widgets correctly
7. **Bulk surgical edit:** Edit 3 pages, verify SSE progress and all pages updated
8. **Audit creation:** Verify before-snapshot is saved and contains accurate inventory

### Frontend — Page Editor
9. **Widget card rendering:** Pull a page, verify all widgets appear as cards in correct order
10. **Widget type identification:** Verify text, heading, image, button, template cards render with correct type badges
11. **Text editing:** Click Edit on a text card → textarea expands → type new text → Save → badge shows MODIFIED
12. **Image swap:** Click Swap on an image card → upload new image → thumbnail updates → shows "was: old.jpg"
13. **Selective editing:** Edit 2 widgets, keep 5 unchanged → Push → verify only 2 changed on WordPress
14. **Revert:** Edit a widget → click Revert → verify it returns to original content and shows Keep badge
15. **Push Changes button:** Verify it shows correct count ("Push 2 Changes"), is disabled when nothing modified
16. **Replace All Text:** Paste new article → verify it auto-distributes across text widgets → push → verify on WP
17. **Template widgets:** Verify they show as read-only with info message, no edit controls

### Edge Cases
18. Page with no text widgets → editor shows only image/heading/button cards, "Replace All Text" disabled
19. Page with mixed widget types we don't handle → skip unknown types, show known ones
20. Invalid `_elementor_data` → fail gracefully with descriptive error
21. Elementor data not accessible via REST API → clear error about permissions/configuration
22. Very large page (50+ widgets) → editor should scroll smoothly, not lag
23. Image upload fails → show error on that card, don't lose other edits in progress
