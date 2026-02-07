# Dashboard Integration Briefing — Post-Publish Feature Set

**Purpose:** This document briefs the dashboard agent on all post-publish editing features (Phases 1-8) so they can be integrated into the Article Editing Dashboard. Phases 1-5 get brief summaries (code exists, previous plans cover them). Phases 6-8 get full detail (completely new, never part of the original dashboard plan).

**Source of truth for implementation details:** `docs/PRD-phase-*.md` files + actual codebase.

---

## PART 1: Phases 1-5 (Brief — Code Exists or PRDs Are Detailed)

### Phase 1 — Image Generation & Regeneration (COMPLETE, IN CODEBASE)

What it does: Generate AI images for articles, regenerate all images, bulk generate across multiple articles.

**Features already built:**
- **Generate Images** button per article — calls `POST /api/articles/:id/generate-images`, runs the image pipeline (`processArticleWithImages()`), uploads to WordPress media library
- **Regenerate All Images** button — deletes existing images and regenerates fresh ones
- **Bulk Generate Images** — checkbox selection + bulk dropdown action, processes multiple articles with SSE progress
- **Progress modal** — shows real-time progress during generation (uses `createPortal`)

**Key files:** `server/routes/articles.js` (endpoints at lines 961-1448), `server/services/image-pipeline.js`, `src/components/articles/ArticleListView.tsx` (buttons at lines 2019-2044, bulk at lines 1159-1195)

**Dashboard integration:** These buttons already exist in ArticleListView. They need to move into the dashboard's article editing zone — likely near the image preview area.

---

### Phase 2 — Shared Rebuild Service + SSE Utility (NOT YET BUILT)

What it does: Creates shared infrastructure that Phases 3-5 all use.

**What it provides:**
- `server/services/page-rebuild-service.js` — shared `rebuildPage(articleId, options)` function that handles the delete-and-recreate pattern (delete old WP page → build new Elementor page → create with same slug → update wp_post_id)
- `server/services/sse-progress.js` — shared `setupSSE(res)` utility for streaming progress on bulk operations
- Refactors the existing push-images flow and bulk-update-cta to use the shared service

**Dashboard impact:** No direct UI — this is backend plumbing. But every bulk operation button in the dashboard will use SSE progress from this phase.

---

### Phase 3 — Content Push (NOT YET BUILT)

What it does: Push updated text content to already-published pages without rebuilding the whole page.

**Features:**
- **Push Content** button per article — takes current `final_content` from database, rebuilds page with updated text
- **Bulk Push Content** — checkbox selection, push content for multiple articles at once with SSE progress
- **Batch integration** — "Push Content" step added to the existing batch processing flow in App.tsx

**Endpoints:** `POST /api/articles/:id/push-content`, `POST /api/articles/bulk-push-content`

**Dashboard integration:** "Push Content" is a per-article action button + a bulk action. Should be in the article editing toolbar area and the bulk actions dropdown.

---

### Phase 4 — Component Bulk Operations (NOT YET BUILT)

What it does: Re-assign Elementor component templates across published pages. Components = the visual layout templates (hero sections, content blocks, etc.) from `component-library-service.js`.

**Features:**
- **Bulk Update Components** — select articles, choose new component assignment strategy (sequential or random rotation), rebuild pages with new components
- **Reset Rotation** option — resets the `component_rotation_state` table so rotation starts fresh
- Re-applies components to already-published pages via delete-and-recreate

**Endpoint:** `POST /api/articles/bulk-update-components`

**Dashboard integration:** This is a bulk-level operation, not per-article. It belongs in a "bulk tools" or "site-wide tools" area of the dashboard.

---

### Phase 5 — Full Page Rebuild (NOT YET BUILT)

What it does: The "nuclear option" — full delete-and-recreate of published pages with all options. Refactors existing push-images and bulk-update-cta into the shared rebuild service.

**Features:**
- **Full Page Rebuild** modal with checkboxes:
  - ☑ Rebuild content (use latest `final_content`)
  - ☑ Rebuild images (re-upload from `generated_images`)
  - ☑ Rebuild components (re-apply component templates)
  - ☑ Rebuild CTA (re-apply website CTA settings)
  - ☑ Push meta after rebuild
- Works on single article or bulk selection
- Options modal lets user pick exactly what to rebuild

**Endpoint:** `POST /api/articles/bulk-rebuild-pages`

**Dashboard integration:** "Full Rebuild" is a power-user action. Should be accessible but not prominent — maybe in a "More Actions" menu or an advanced tools panel. The options modal is its own component.

---

## PART 2: Phase 6 — Surgical Page Editing (DETAILED — NEW TO DASHBOARD)

### Overview

Phase 6 is a completely new capability: **editing ANY Elementor page** — including pages we didn't create. This is huge for SEO agencies taking over existing client sites. It gets its own dedicated UI component: the **Page Editor**.

**Core concept:** We can READ any Elementor page's full widget structure via WordPress REST API (`?context=edit`), and we can CHANGE VALUES inside existing widgets (text, images, headings, buttons). We CANNOT change page structure (add/remove/move widgets). Values only, structure untouched.

### New Service: `server/services/elementor-page-parser.js`

This is the engine behind Phase 6. It parses Elementor's `_elementor_data` (deeply nested JSON) into a flat, workable structure.

#### Key Functions

**`parseElementorPage(elementorData)`**
```javascript
// Input: raw _elementor_data from WordPress (nested sections → columns → widgets)
// Output: flat inventory of editable content
{
  texts: [
    { widgetId: 'abc123', type: 'text-editor', content: '<p>Current text...</p>', path: 'sections[0].columns[0].widgets[0]' },
    ...
  ],
  images: [
    { widgetId: 'def456', type: 'image', url: 'https://...', id: 789, alt: '...', size: { width, height }, path: '...' },
    ...
  ],
  headings: [
    { widgetId: 'ghi789', type: 'heading', text: 'Page Title', tag: 'h2', path: '...' },
    ...
  ],
  buttons: [
    { widgetId: 'jkl012', type: 'button', text: 'Call Now', url: 'tel:...', path: '...' },
    ...
  ],
  templates: [],  // template widgets (informational only)
  summary: { totalWidgets: 24, textWidgets: 8, imageWidgets: 6, headingWidgets: 4, buttonWidgets: 2 }
}
```

**`applyTextEdits(elementorData, edits)`**
```javascript
// Deep clones _elementor_data, walks the widget tree, applies text changes
// edits = [{ widgetId: 'abc123', newContent: '<p>New text...</p>' }, ...]
// Returns: modified _elementor_data (full structure, ready to push back)
```

**`applyImageSwaps(elementorData, swaps)`**
```javascript
// Deep clones _elementor_data, walks the widget tree, swaps image URLs/IDs
// swaps = [{ widgetId: 'def456', newUrl: 'https://...', newId: 123, newAlt: '...' }, ...]
// Returns: modified _elementor_data
```

**`createPageAudit(pageData, parsedContent)`**
```javascript
// Creates a before-snapshot inventory of the page
// Used for tracking what was changed (before vs after)
```

### New UI Component: Page Editor (`src/components/PageEditor.tsx`)

The Page Editor is a full-screen (or large panel) interface for editing any page. This is its own view within the dashboard.

#### Widget Cards

The Page Editor shows every editable widget as a **card**:

```
┌─────────────────────────────────────────────────────────────────┐
│ TEXT WIDGET #3                                    [Keep ✓]      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Our deep cleaning services cover every room in your home.   │ │
│ │ We use professional-grade equipment and eco-friendly...     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ Status: Original (unchanged)                                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ IMAGE WIDGET #5                                   [Modified ✎] │
│ ┌───────────────┐  ┌───────────────┐                           │
│ │  (old image)  │→ │  (new image)  │                           │
│ │  before.jpg   │  │  after.jpg    │                           │
│ └───────────────┘  └───────────────┘                           │
│ Status: Modified — new image uploaded                           │
│ [Revert to Original]                                           │
└─────────────────────────────────────────────────────────────────┘
```

Each card has three states:
- **Keep** (green checkmark) — original content, no changes
- **Modified** (orange pencil) — content has been changed
- **Reverted** — was modified, user reverted to original

#### Page Editor Toolbar (4 Power Actions)

These actions appear at the top of the Page Editor. They operate on ALL text/image widgets at once:

**1. Generate New Article**
- Runs the SAME prompt chain that creates new articles
- Takes a keyword (from the page or user-entered) → runs through the prompt chain → generates full article content
- New content gets mapped to existing text widgets (first text widget gets first chunk, etc.)
- All text widget cards update to show new content with "Modified" state
- User can review each widget card before pushing

**2. Replace All Text**
- Paste or type new content → it gets chunked and distributed across text widgets
- Simpler than Generate New Article — no prompt chain, just direct text replacement
- Useful when the user already has the new content ready

**3. Generate Images from Text**
- Points the SAME image pipeline (`processArticleWithImages()`) at the current text content
- Reads text from the text widgets (either original or modified) → generates contextual images
- New images appear in the image widget cards with "Modified" state
- Works for pages we didn't create — pipeline doesn't care where the text came from

**4. Upload Images**
- Manual image upload for any image widget
- Click on an image widget card → file picker → upload → image widget shows new image
- Uploaded images go through WordPress media library (same as existing pipeline)

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/elementor/audit-page` | POST | Pull a page from WordPress, parse it, return widget inventory |
| `/api/elementor/surgical-edit` | POST | Apply edits to specific widgets and push back to WordPress |
| `/api/elementor/bulk-surgical-edit` | POST | Surgical edit across multiple pages (SSE progress) |
| `/api/elementor/replace-all-text` | POST | Replace all text widgets with new content |
| `/api/elementor/generate-images-for-page` | POST | Run image pipeline on a page's text content |
| `/api/elementor/generate-content-for-page` | POST | Run prompt chain to generate new content for a page |

#### `POST /api/elementor/audit-page`
```javascript
// Request:
{ websiteId, wpPostId }  // or { websiteId, pageUrl }

// Response:
{
  pageData: { title, url, wpPostId, status, modified },
  widgets: {
    texts: [...],     // parsed text widgets
    images: [...],    // parsed image widgets
    headings: [...],  // parsed heading widgets
    buttons: [...]    // parsed button widgets
  },
  summary: { totalWidgets, textWidgets, imageWidgets, ... },
  rawElementorData: "..."  // the full _elementor_data (for surgical edit later)
}
```

#### `POST /api/elementor/surgical-edit`
```javascript
// Request:
{
  websiteId,
  wpPostId,
  rawElementorData,  // the original _elementor_data (from audit)
  textEdits: [{ widgetId, newContent }],
  imageSwaps: [{ widgetId, newUrl, newId, newAlt }],
  headingEdits: [{ widgetId, newText }],
  buttonEdits: [{ widgetId, newText, newUrl }]
}

// Flow:
// 1. applyTextEdits(rawElementorData, textEdits)
// 2. applyImageSwaps(result, imageSwaps)
// 3. Apply heading/button edits similarly
// 4. PUT /wp-json/wp/v2/pages/{wpPostId} with { meta: { _elementor_data: result } }

// Response:
{ success: true, modifiedWidgets: 5, unchangedWidgets: 19 }
```

#### `POST /api/elementor/generate-content-for-page`
```javascript
// Request:
{
  websiteId,
  wpPostId,
  keyword,         // keyword for the prompt chain
  workflowId       // to use that workflow's prompt chain settings
}

// Flow:
// 1. Run keyword through the same prompt chain as new articles
// 2. Chunk the generated content to match the number of text widgets on the page
// 3. Return the new content mapped to text widget IDs

// Response:
{
  generatedContent: "full article text...",
  widgetMapping: [
    { widgetId: 'abc123', newContent: '<p>First chunk...</p>' },
    { widgetId: 'def456', newContent: '<p>Second chunk...</p>' },
    ...
  ]
}
```

### Dashboard Integration Notes for Phase 6

The Page Editor is a **separate view** — it's not a small panel. When you click "Edit Page" on any article (or on a page discovered from WordPress), it opens the Page Editor as the main workspace.

**How it fits the dashboard model:**
- From the article editing dashboard, clicking "Edit Page" on any article opens the Page Editor
- The Page Editor IS its own dashboard workspace — widget cards in the center, toolbar at top, link/schema tools on sides
- When done editing, user goes back to the article list

**The Page Editor works on TWO types of pages:**
1. **Our pages** (articles in our database with `wp_post_id`) — pull from WordPress, edit, push back
2. **External pages** (any WordPress page, even ones we didn't create) — need a "Pull Page by URL" or page picker

---

## PART 3: Phase 7 — Link Management (DETAILED — NEW TO DASHBOARD)

### Overview

A complete link management system. Three link types: internal links to parent pages (automated), outbound links from a managed pool (semi-automated), and CTA buttons (already exists).

### The Link Pool — Persistent Per-Website Database

Every website gets a **link pool** — a persistent, growing inventory of all links. It stores every link ever discovered, manually added, approved, or rejected. The pool grows over time as the user runs more discovery rounds.

**Database table:** `link_pool`
- `id`, `website_id`, `url`, `anchor_text`, `description`
- `link_type` ('outbound' or 'internal')
- `status` ('pending', 'approved', 'rejected')
- `assigned_article_id` (manually assigned to specific page)
- `used_on_article_id` (which page actually got this link after distribution)
- `discovery_run` (which AI discovery round found this — 1, 2, 3...)
- `rel_attribute` ('noopener', 'nofollow', etc. — configurable per link)
- `target` ('_blank' or '_self')

### Configurable Settings (Per Website)

Stored on the `websites` table:

| Setting | Default | Purpose |
|---------|---------|---------|
| `link_discovery_prompt` | null | Custom AI instructions for what kind of links to find |
| `link_discovery_model` | claude-sonnet-4-5 | Which LLM to use for discovery |
| `link_discovery_count` | 70 | How many candidates to find per run |
| `links_per_page` | 1 | How many outbound links each page gets |
| `link_discovery_runs` | 0 | Counter: how many discovery runs so far |

**Why configurable?** A site starts with 30 core pages, then adds 60-150 supporting content pages. The pool needs to grow. User runs discovery multiple times, adjusts counts, adjusts links-per-page.

### AI Link Discovery

**Endpoint:** `POST /api/links/discover`

```javascript
// Request:
{
  websiteId,
  businessType: "house cleaning",
  location: "Austin, TX",
  count: 70,                    // user-configurable
  categories: ['local_org', 'industry_authority', 'government', 'educational'],
  prompt: "Find high-quality local and industry links...",  // custom instructions
  model: "claude-sonnet-4-5-20250929",                       // user-selected LLM
  provider: "anthropic"                                       // auto-detected from model
}

// Flow:
// 1. Build discovery prompt from user's custom prompt + business details
// 2. Call LLM via /api/llm/generate with selected model
// 3. LLM returns candidate URLs with descriptions and anchor text suggestions
// 4. Verify each URL is live (HEAD request)
// 5. Save to link_pool with status='pending', increment discovery_run
// 6. Return candidates for human review

// Response:
{
  candidates: [
    { id: 1, url: 'https://austinchamber.com', description: 'Austin Chamber of Commerce', anchorText: 'Austin business community', status: 'pending' },
    ...
  ],
  totalFound: 70,
  verified: 65,
  failed: 5,
  discoveryRun: 2
}
```

**Model selector:** Same dropdown pattern as `ImageCreationSection.tsx` — optgroups for OpenAI, Anthropic, Google Gemini. User picks the model. Auto-detects provider from model ID.

**Multiple runs:** Each run ADDS to the pool. Pool is persistent. Typical flow:
1. Run 1: Find 70 for 30 core pages → approve 50 → distribute
2. Run 2: Find 100 for 60 supporting pages → approve 72 → distribute
3. Run 3: Decide core pages need 2 links each → find more → redistribute

### Link Distribution

**Endpoint:** `POST /api/links/distribute`

```javascript
// Request:
{ websiteId, workflowId }

// Logic:
// 1. Read links_per_page from website settings (default: 1)
// 2. Get all approved, unassigned links
// 3. Get all articles that need more links (have fewer than links_per_page)
// 4. Shuffle and assign randomly
// 5. Each link goes to ONE page only (but a page can get N links)

// Response:
{
  distributed: 28,
  skipped: 2,
  linksPerPage: 1,
  articlesServed: 28,
  articlesPending: 5,
  errors: []
}
```

### Link Injection Service: `server/services/link-injector.js`

Handles injecting `<a>` tags into HTML content.

#### Key Functions

**`injectLinks(htmlContent, links)`** — Takes HTML + array of link configs → returns HTML with `<a>` tags injected around matching anchor text. Safe injection: never nests `<a>` inside existing `<a>` tags.

**`findAnchorText(content, context)`** — Finds appropriate anchor text in content for a given link. For parent links: looks for phrases mentioning parent topic. For outbound: looks for phrases related to link description.

**`distributeLinksToArticles(websiteId, workflowId)`** — Distribution logic (described above).

**`getParentPageLink(articleId)`** — Looks up `wp_page_hierarchy` for the parent page URL + suggests anchor text.

**`safeInjectLink(html, anchorText, anchorHtml)`** — Splits HTML by existing `<a>` tags, only injects in non-link portions. Prevents `<a>` nesting.

### Two Injection Paths

**Path 1: Build-time (new pages)**
```
Prompt chain → final_content → injectLinks(content, links) → chunkContent() → buildElementorPage()
```
Integration point: `server/routes/elementor.js` publish flow, after getting article content.

**Path 2: Surgical (existing pages via Phase 6)**
```
Page Editor → text widget HTML → injectLinks(widgetHtml, links) → surgical edit push
```
Integration point: Page Editor's "Manage Links" panel.

### Link Pool Manager UI: `src/components/LinkPoolManager.tsx`

The Link Pool Manager is the persistent inventory dashboard for all links. It includes:

**Discovery Settings Panel:**
- AI Discovery Prompt (textarea)
- LLM Model dropdown (grouped by provider)
- "Links to find" number input
- "Links per page" number input
- Discovery run counter
- [Run AI Discovery] button

**Link Inventory:**
- Tabs: Approved | Pending | Rejected | Used
- Each link card shows: URL, anchor text, description, assignment, discovery run number
- Actions: Approve, Reject, Edit, Assign, Unassign, Preview

**Iframe Preview:**
- Click [Preview] on any link → iframe loads the website inline
- Approve/Reject buttons below iframe → auto-advances to next pending link
- Rapid-fire review workflow for discovery batches
- Fallback for iframe-blocked sites: "Open in New Tab"

**Batch Entry:**
- Paste URLs (one per line) → all added as pending

**Distribution Panel:**
- Shows: unassigned count, articles needing links count
- [Auto-Distribute] button → assigns links respecting links_per_page setting

### Page Editor Link Integration

In the Page Editor (Phase 6), a "Manage Links" panel shows:
- Auto-detected parent page link (from `wp_page_hierarchy`)
- Outbound link from pool (assigned or available)
- [+ Add Custom Link] for one-off links
- [Apply Links to Text] → injects links into text widget HTML
- Link preview in text widget cards (anchor text highlighted)

### All Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/links/pool/:websiteId` | GET | Get all links, filterable by status |
| `POST /api/links/pool` | POST | Add link manually |
| `PUT /api/links/pool/:linkId` | PUT | Update link (approve, reject, edit) |
| `DELETE /api/links/pool/:linkId` | DELETE | Remove link |
| `POST /api/links/pool/bulk` | POST | Add multiple links at once |
| `PUT /api/links/pool/bulk-approve` | PUT | Approve multiple links |
| `POST /api/links/distribute` | POST | Auto-distribute to articles |
| `POST /api/links/discover` | POST | AI link discovery |
| `GET /api/links/settings/:websiteId` | GET | Get discovery settings |
| `PUT /api/links/settings/:websiteId` | PUT | Update discovery settings |
| `GET /api/links/article/:articleId` | GET | Get links for specific article |
| `POST /api/links/inject-preview` | POST | Preview link injection (no push) |

---

## PART 4: Phase 8 — Schema / JSON-LD Injection (DETAILED — NEW TO DASHBOARD)

### Overview

Adds structured data (JSON-LD) to every page's `<head>`. Two tracks: bulk (LLM auto-identifies schema types per page) and custom (designated pages with their own prompts). Injected via WordPress mu-plugin, NOT through SEO plugins.

### Two-Track System

**Track 1: Bulk Schema**
- User configures a checklist of schema types: LocalBusiness, Service, FAQ, HowTo, BreadcrumbList, Article, Product, Event, etc.
- User writes a guiding prompt: business details, what to look for, priorities
- LLM reads each page's content → identifies which types apply → generates JSON-LD
- Runs on ALL pages except custom-designated ones
- Progress via SSE

**Track 2: Custom Schema (Multiple Pages)**
- User designates specific pages for custom schema treatment
- Each custom page gets its own prompt box
- [+] button to add more custom pages
- Typical custom pages: homepage (Organization + WebSite), city location pages (LocalBusiness with city-specific details)
- Bulk process SKIPS all custom pages

### Why Direct WordPress (Not SEO Plugins)

Schema injection uses a tiny mu-plugin (20 lines PHP) deployed once to WordPress. Stores JSON-LD in `_promptflow_schema_jsonld` custom meta field. The mu-plugin reads it and outputs `<script type="application/ld+json">` in `<head>`.

One universal path vs. testing 4 different plugin APIs (Yoast/Rank Math/AIOSEO/SEOPress) for schema support. SEO plugins continue handling meta title/description (what they're already tested for).

### Schema Generator Service: `server/services/schema-generator.js`

#### Key Functions

**`generateBulkSchema(articleId, schemaTypes, bulkPrompt, model)`**
```javascript
// 1. Get article content from database
// 2. Build prompt: "Analyze this content, identify which of [schemaTypes] apply, generate JSON-LD"
// 3. Call LLM with selected model
// 4. Parse and validate JSON-LD response
// 5. Store on articles.generated_schema
// Returns: { schemas: [{ @context, @type, ... }], identifiedTypes: ['Service', 'FAQ'] }
```

**`generateCustomSchema(customPageId, customPrompt, model)`**
```javascript
// 1. Get page content (from database or WordPress)
// 2. Build prompt from custom instructions
// 3. Call LLM
// 4. Store on schema_custom_pages.generated_schema
// Returns: { schemas: [...] }
```

**`pushSchemaToWordPress(wpPostId, schemas, credentials)`**
```javascript
// PUT /wp-json/wp/v2/pages/{wpPostId}
// { meta: { _promptflow_schema_jsonld: JSON.stringify(schemas) } }
// Same auth as wordpress-publisher.js
```

**`checkMuPluginDeployed(credentials)`**
```javascript
// Tests if _promptflow_schema_jsonld meta field is registered
// Returns: { deployed: true/false, testResult: "..." }
```

### Database

**New table: `schema_custom_pages`**
- `id`, `website_id`, `article_id` (nullable), `wp_post_id` (nullable)
- `page_title`, `page_url`, `custom_prompt`
- `generated_schema` (the JSON-LD output, stored for review before push)
- `schema_pushed` (boolean), `pushed_at`

**New columns on `websites`:**
- `schema_types` — JSON array of schema types to look for
- `schema_bulk_prompt` — guiding prompt for bulk generation
- `schema_model` — LLM model for schema generation
- `schema_mu_plugin_deployed` — boolean tracking deployment status

**New columns on `articles`:**
- `generated_schema` — JSON-LD generated by bulk process
- `schema_pushed`, `schema_pushed_at`

### Schema Manager UI: `src/components/SchemaManager.tsx`

**Mu-Plugin Status:**
- Green checkmark if deployed, warning with instructions if not
- [Check Again] button
- [View Plugin Code & Instructions] — shows the PHP code to deploy

**Bulk Schema Settings:**
- Schema types checklist (checkboxes for each type)
- Bulk prompt textarea
- LLM model dropdown (same pattern as link discovery and image generation)
- [Generate Schema for All Pages] button with SSE progress

**Custom Schema Pages:**
- List of designated custom pages, each with its own prompt textarea
- [+] button to add more (page picker → prompt → save)
- Per-page: [Generate], [Regenerate], [Push], [Preview JSON-LD]
- Remove from custom list (reverts to bulk)

**Bulk Schema Status Table:**
- Shows every page: title, identified schema types, status (Generated/Pushed/Pending)
- [Push All Generated Schema] button with SSE progress

**JSON-LD Preview:**
- Collapsible code block showing formatted JSON-LD
- [Validate with Google] link (Rich Results Test)
- [Edit JSON] for manual tweaks before push
- [Copy to Clipboard]

### All Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/schema/settings/:websiteId` | GET | Get schema settings |
| `PUT /api/schema/settings/:websiteId` | PUT | Update schema settings |
| `POST /api/schema/check-mu-plugin` | POST | Check mu-plugin deployment |
| `GET /api/schema/mu-plugin-code` | GET | Get PHP code for deployment |
| `POST /api/schema/generate-bulk` | POST | Generate schema for all pages (SSE) |
| `POST /api/schema/generate-single/:articleId` | POST | Generate for one article |
| `POST /api/schema/generate-custom/:customPageId` | POST | Generate for custom page |
| `POST /api/schema/push/:articleId` | POST | Push schema to WordPress |
| `POST /api/schema/push-custom/:customPageId` | POST | Push custom page schema |
| `POST /api/schema/push-bulk` | POST | Push all unpushed schema (SSE) |
| `GET /api/schema/custom-pages/:websiteId` | GET | Get custom pages list |
| `POST /api/schema/custom-pages` | POST | Add custom schema page |
| `PUT /api/schema/custom-pages/:customPageId` | PUT | Update custom page |
| `DELETE /api/schema/custom-pages/:customPageId` | DELETE | Remove custom page |

---

## PART 5: Feature Inventory — Dashboard Layout Planning

This is a flat list of every feature/component for placing in the dashboard zones.

### Article-Level Features (Per Article)

These features operate on a single article. In the "revolver chamber" model, these surround the article you're currently viewing.

| Feature | Source Phase | Type | Notes |
|---------|-------------|------|-------|
| Article content preview/proofread | Existing | Read | Center workspace — swipe left/right |
| Image gallery preview | Existing | Read | Show all generated images for current article |
| Generate Images | Phase 1 | Action button | Per-article, triggers image pipeline |
| Regenerate All Images | Phase 1 | Action button | Per-article, deletes + regenerates |
| Push Content | Phase 3 | Action button | Push updated text to WordPress |
| Push Meta (SEO) | Existing | Action button | Push meta title/description to SEO plugin |
| Push Schema | Phase 8 | Action button | Push JSON-LD to WordPress |
| Full Page Rebuild | Phase 5 | Action button + modal | Options checkboxes modal |
| Edit Page (opens Page Editor) | Phase 6 | Navigation | Opens Page Editor for this article's WP page |
| View Links | Phase 7 | Info panel | Show which links are assigned to this article |
| View Schema | Phase 8 | Info panel | Show generated schema types + preview |
| Article status indicators | Existing | Display | Published, images generated, meta pushed, schema pushed, links injected |

### Bulk Features (Multi-Article)

These operate on multiple selected articles. In the dashboard, these likely go in a toolbar or dropdown.

| Feature | Source Phase | Type | Notes |
|---------|-------------|------|-------|
| Bulk Generate Images | Phase 1 | Bulk action | Checkbox selection + action |
| Bulk Push Content | Phase 3 | Bulk action | Push text for selected articles |
| Bulk Update Components | Phase 4 | Bulk action | Re-assign component templates |
| Bulk Update CTA | Existing | Bulk action | Already exists |
| Bulk Rebuild Pages | Phase 5 | Bulk action + modal | Full rebuild with options |
| Bulk Surgical Edit | Phase 6 | Bulk action | Same edit across multiple pages |
| Auto-Distribute Links | Phase 7 | Bulk action | Assign links from pool to articles |
| Bulk Generate Schema | Phase 8 | Bulk action | Generate schema for all pages |
| Bulk Push Schema | Phase 8 | Bulk action | Push schema to WordPress |

### Site-Wide Panels (Website-Level)

These are larger UI panels that manage website-level settings and data. They could be sidebar panels, tabs, or overlay panels.

| Panel | Source Phase | Component | What It Shows |
|-------|-------------|-----------|---------------|
| Link Pool Manager | Phase 7 | `LinkPoolManager.tsx` | Full link inventory, discovery settings, AI prompt, model dropdown, iframe preview, distribution |
| Schema Manager | Phase 8 | `SchemaManager.tsx` | Schema types checklist, bulk prompt, custom pages, mu-plugin status, generation status table |
| Page Editor | Phase 6 | `PageEditor.tsx` | Widget cards, toolbar (Generate Article, Replace Text, Generate Images, Upload), link management, surgical edit |
| Component Library | Existing | Already exists | Component template management |
| SEO Meta Selection | Existing | Already exists | Meta title/description selection |

### Settings / Configuration

These are configuration interfaces that need to be accessible somewhere.

| Setting | Source Phase | Level | Notes |
|---------|-------------|-------|-------|
| SEO Plugin selection | Existing | Website | Dropdown: Yoast/RankMath/AIOSEO/SEOPress |
| CTA Text + URL | Existing | Website | Website-level CTA button settings |
| Link discovery prompt | Phase 7 | Website | Textarea in Link Pool Manager |
| Link discovery model | Phase 7 | Website | Model dropdown in Link Pool Manager |
| Links to find count | Phase 7 | Website | Number input in Link Pool Manager |
| Links per page | Phase 7 | Website | Number input in Link Pool Manager |
| Schema types list | Phase 8 | Website | Checkboxes in Schema Manager |
| Schema bulk prompt | Phase 8 | Website | Textarea in Schema Manager |
| Schema model | Phase 8 | Website | Model dropdown in Schema Manager |
| Mu-plugin status | Phase 8 | Website | Status check in Schema Manager |

### Progress / Status Indicators

Any bulk operation shows real-time progress. These need a consistent progress display component.

| Operation | Source Phase | Progress Type |
|-----------|-------------|---------------|
| Bulk image generation | Phase 1 | SSE: current/total + article name |
| Bulk content push | Phase 3 | SSE: current/total + article name |
| Bulk component update | Phase 4 | SSE: current/total + article name |
| Bulk page rebuild | Phase 5 | SSE: current/total + article name |
| Bulk surgical edit | Phase 6 | SSE: current/total + page name |
| AI link discovery | Phase 7 | SSE: candidates found so far |
| Link distribution | Phase 7 | Instant (no SSE needed, fast DB operation) |
| Bulk schema generation | Phase 8 | SSE: current/total + page name |
| Bulk schema push | Phase 8 | SSE: current/total + page name |
