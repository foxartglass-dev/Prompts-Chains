# Phase 7: SEO Link Management System

**Project:** Post-Publish Full Page Control System
**Priority:** HIGH — Links are essential for SEO (internal linking + outbound authority)
**Scope:** New link pool system, auto parent-page linking, link injection for both new and existing pages, link distribution logic, and AI link discovery.
**Prerequisite:** Phase 2 (rebuild service) for new pages. Phase 6 (surgical editing) for existing pages. Can be built in parallel if the injection layer is added last.
**Context Budget:** This is a substantial phase. Split into two sessions:
- **Session A:** Database + backend (link pool table, endpoints, injection logic, distribution)
- **Session B:** Frontend (link pool UI, Page Editor integration, link highlighting)

---

## What You're Building

A complete link management system that handles three types of links on every page:

1. **Internal link to parent page** — fully automated, we know the parent
2. **Outbound link to a reputable external source** — semi-automated (AI finds candidates, human approves, system distributes)
3. **CTA button link** — already exists (Phase 1), website-level setting

The system works identically for pages we create AND pages we didn't create. Same link pool, same distribution, two injection paths.

---

## The Three Link Types

### Link Type 1: Internal Link to Parent Page (Automated)

Every page should link up to its parent page. This strengthens the site's internal linking structure, which Google loves.

**How it works:**
- The `wp_page_hierarchy` table already tracks parent-child relationships
- When building/editing a page, look up the parent page's URL
- Find appropriate anchor text in the article content (a phrase related to the parent page's topic)
- Wrap that phrase in an `<a href="parentUrl">` tag
- Fully automated — no human input needed

**Example:**
- Page: "Deep Cleaning Kitchen Austin" (child of "Deep Cleaning Services")
- Parent URL: `/deep-cleaning-services/`
- In the article text, find a phrase like "our deep cleaning services"
- Inject: `<a href="/deep-cleaning-services/">our deep cleaning services</a>`

### Link Type 2: Outbound Link to External Source (Semi-Automated)

Every page should have one high-quality outbound link to a reputable, relevant source. This signals to Google that the page is well-researched and connected to authoritative content.

**Workflow:**
1. AI discovers/scrapes candidate links (local organizations, industry authorities, relevant resources)
2. AI returns ~45 candidates (expecting ~30% rejection rate)
3. Human reviews each one: approve or reject
4. Approved links go into a **link pool** (one pool per website)
5. Links get distributed to pages:
   - Some manually assigned to specific pages by the human
   - The rest auto-distributed (one per page, randomly)

**Example:**
- Website: Austin house cleaning business
- AI finds: Austin Chamber of Commerce, ISSA (cleaning industry association), local BBB page, etc.
- Human approves 30 out of 45
- Human assigns "Austin Chamber" specifically to the "About Us" page
- Remaining 29 links auto-distributed across 29 pages (one each)

### Link Type 3: CTA Button (Already Exists)

The existing `elementor_cta_text` and `elementor_cta_url` system on the websites table. Bulk update via `POST /api/elementor/bulk-update-cta`. No changes needed — this already works.

---

## Background: What Already Exists

### CTA Button System (Complete)
- `websites.elementor_cta_text` / `websites.elementor_cta_url` — website-level settings
- `buildButtonWidget(ctaText, ctaUrl)` in elementor-builder.js — creates CTA button widget
- `POST /api/elementor/bulk-update-cta` — updates CTA across all published pages
- Frontend button in ArticleListView.tsx with confirmation modal

### Parent Page Tracking (Partial)
- `wp_page_hierarchy` table — tracks `wp_parent_id` for each page
- HierarchyView.tsx — displays site map visualization
- **Missing:** No automatic internal linking based on parent relationship

### Text Widget HTML (Works)
- Text editor widgets store HTML in `settings.editor`
- `contentToHtml()` in elementor-builder.js converts text to `<p>` tags, preserves existing HTML
- `<a>` tags pass through as-is — so if we put links in the HTML, they render correctly
- Works for both `buildElementorPage()` (new pages) AND surgical edits (existing pages)

### Key Functions

| Function | File | Relevance |
|---|---|---|
| `buildElementorPage(chunked, options)` | `elementor-builder.js:915` | New pages — content already has HTML with links |
| `contentToHtml(content)` | `elementor-builder.js:210` | Preserves `<a>` tags in HTML |
| `applyTextEdits(elementorData, edits)` | `elementor-page-parser.js` (Phase 6) | Existing pages — inject links into text widget HTML |
| `chunkContent(content, options)` | `content-chunker.js` | Splits content into sections (links must survive chunking) |

---

## What to Build

### 7A. Database: Link Pool Table

**New table:** `link_pool`

```sql
CREATE TABLE link_pool (
  id SERIAL PRIMARY KEY,
  website_id INT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  anchor_text VARCHAR(255),           -- suggested anchor text (AI-generated or human-entered)
  description TEXT,                    -- what this link is (for human review)
  link_type VARCHAR(20) DEFAULT 'outbound',  -- 'outbound' or 'internal'
  status VARCHAR(20) DEFAULT 'pending',       -- 'pending', 'approved', 'rejected'
  assigned_article_id INT REFERENCES articles(id),  -- NULL = auto-distribute
  used_on_article_id INT REFERENCES articles(id),   -- which article actually got this link
  rel_attribute VARCHAR(50) DEFAULT 'noopener',     -- 'noopener', 'nofollow', etc.
  target VARCHAR(20) DEFAULT '_blank',               -- '_blank' or '_self'
  created_at TIMESTAMP DEFAULT NOW(),
  used_at TIMESTAMP
);

-- Index for quick lookups
CREATE INDEX idx_link_pool_website ON link_pool(website_id);
CREATE INDEX idx_link_pool_status ON link_pool(status);
CREATE INDEX idx_link_pool_assigned ON link_pool(assigned_article_id);
```

**Follow Golden Rule #16:** Add migration file AND update `server/db/setup-all.mjs`.

### 7B. Link Injection Service

**New file:** `server/services/link-injector.js`

This service handles injecting links into article HTML content. It works at the HTML level — finding appropriate anchor text and wrapping it in `<a>` tags.

#### `injectLinks(htmlContent, links)`

```javascript
/**
 * Injects links into HTML content by finding anchor text and wrapping with <a> tags.
 * Does NOT modify the HTML structure — only adds <a> tags around existing text.
 *
 * @param {string} htmlContent - The HTML content (from text widget or article)
 * @param {Array} links - Array of { url, anchorText, type, rel, target }
 *   - type: 'internal' (to parent page) or 'outbound' (external)
 *   - If anchorText not found in content, tries to find a semantically similar phrase
 * @returns {string} Modified HTML with links injected
 */
function injectLinks(htmlContent, links) {
  let modified = htmlContent;

  for (const link of links) {
    // 1. Try exact anchor text match first
    // 2. If not found, try case-insensitive match
    // 3. If still not found, try partial match (anchor text as substring)
    // 4. If nothing works, append link at end of nearest relevant paragraph

    const anchorHtml = buildAnchorTag(link);
    // Replace first occurrence only (don't double-link)
    // Make sure we don't nest links (don't inject inside existing <a> tags)
    modified = safeInjectLink(modified, link.anchorText, anchorHtml);
  }

  return modified;
}

/**
 * Builds an <a> tag from link config.
 */
function buildAnchorTag(link) {
  const attrs = [`href="${link.url}"`];
  if (link.target === '_blank') attrs.push('target="_blank"');
  if (link.rel) attrs.push(`rel="${link.rel}"`);
  return `<a ${attrs.join(' ')}>${link.anchorText}</a>`;
}

/**
 * Safely injects a link without nesting inside existing <a> tags.
 */
function safeInjectLink(html, anchorText, anchorHtml) {
  // Split HTML by existing <a>...</a> tags
  // Only replace anchorText in the non-link portions
  // This prevents nesting <a> inside <a> (invalid HTML)
  // Return reconstructed HTML with the link injected
}
```

#### `findAnchorText(content, parentPageTitle, linkDescription)`

```javascript
/**
 * Finds appropriate anchor text in content for a given link.
 * Used when the link doesn't have pre-set anchor text.
 *
 * @param {string} content - The article/page text content
 * @param {string} parentPageTitle - Title of the parent page (for internal links)
 * @param {string} linkDescription - What the link is about (for outbound links)
 * @returns {string|null} Suggested anchor text, or null if no good match
 */
function findAnchorText(content, context) {
  // For internal (parent) links:
  //   - Look for phrases that mention the parent topic
  //   - e.g., parent = "Deep Cleaning Services" → find "deep cleaning" in the text
  //
  // For outbound links:
  //   - Look for phrases related to the link description
  //   - e.g., link = "Austin Chamber of Commerce" → find "Austin community" or "local business"
  //
  // Strategy: extract noun phrases from content, score by relevance to context
  // Return the best match, or null if confidence is too low
}
```

#### `distributeLinksToArticles(websiteId, workflowId)`

```javascript
/**
 * Distributes unassigned approved links from the pool to articles.
 * Each article gets at most one outbound link.
 *
 * @param {number} websiteId
 * @param {number} workflowId - optional, to scope to a workflow
 * @returns {Array} Assignments: [{ linkId, articleId }]
 */
async function distributeLinksToArticles(websiteId, workflowId) {
  // 1. Get all approved, unassigned links for this website
  //    WHERE status = 'approved' AND assigned_article_id IS NULL AND used_on_article_id IS NULL

  // 2. Get all articles that don't have an outbound link yet
  //    (need a way to track this — either a flag on articles or check link_pool.used_on_article_id)

  // 3. Shuffle the links (random distribution)

  // 4. Assign one link per article:
  //    UPDATE link_pool SET used_on_article_id = ?, used_at = NOW() WHERE id = ?

  // 5. Return the assignments for the caller to inject

  return assignments;
}
```

#### `getParentPageLink(articleId)`

```javascript
/**
 * Gets the parent page URL and suggests anchor text for an internal link.
 * Uses wp_page_hierarchy to find the parent.
 *
 * @param {number} articleId
 * @returns {{ url, suggestedAnchorText, parentTitle } | null}
 */
async function getParentPageLink(articleId) {
  // 1. Get article's wp_post_id
  // 2. Look up wp_page_hierarchy for this page's wp_parent_id
  // 3. If wp_parent_id = 0 (top-level), return null (no parent to link to)
  // 4. Get parent page URL from WordPress or from articles table
  // 5. Use parent page title to suggest anchor text
  // 6. Return { url: parentUrl, suggestedAnchorText, parentTitle }
}
```

### 7C. Link Injection Integration — Two Paths

#### Path 1: New Pages (Build-Time Injection)

When building a new page via `buildElementorPage()`, links should already be in the HTML content BEFORE the page is built.

**Where to inject:** After the article is generated by the prompt chain and BEFORE `chunkContent()` splits it into sections.

```
Prompt chain → final_content → injectLinks(finalContent, links) → chunkContent() → buildElementorPage()
```

**Integration point:** In the publishing flow (elementor.js `/publish` or `/publish-article`), after fetching the article content:

```javascript
// After getting article.final_content:
const links = [];

// 1. Get parent page link (automated)
const parentLink = await getParentPageLink(article.id);
if (parentLink) {
  const anchorText = findAnchorText(article.final_content, { parentTitle: parentLink.parentTitle });
  links.push({
    url: parentLink.url,
    anchorText: anchorText || parentLink.parentTitle,
    type: 'internal',
    rel: '',
    target: '_self',
  });
}

// 2. Get outbound link from pool (if assigned or auto-distributed)
const outboundLink = await getAssignedLink(article.id, websiteId);
if (outboundLink) {
  const anchorText = outboundLink.anchor_text ||
    findAnchorText(article.final_content, { linkDescription: outboundLink.description });
  links.push({
    url: outboundLink.url,
    anchorText,
    type: 'outbound',
    rel: 'noopener',
    target: '_blank',
  });
}

// 3. Inject links into content
const contentWithLinks = injectLinks(article.final_content, links);

// 4. Continue with normal flow
const chunked = chunkContent(contentWithLinks, { maxWords: 300 });
// ... buildElementorPage, etc.
```

#### Path 2: Existing Pages (Surgical Injection via Phase 6)

When editing an existing page via the Page Editor (Phase 6), links get injected into the text widget HTML.

**Integration with Page Editor:** Add a "Manage Links" section in the Page Editor toolbar:

```
[Manage Links]
  ├─ Auto-link to parent page: [/deep-cleaning-services/] ✓ (detected)
  ├─ Outbound link: [Austin Chamber of Commerce] (from link pool)
  └─ [+ Add Custom Link]
```

When the user confirms links:
1. For each text widget marked for editing (or all text widgets if doing Replace All Text):
2. Call `injectLinks(widgetHtml, selectedLinks)` on the widget content
3. The widget card shows the link-injected version
4. User can review (links highlighted in the text preview)
5. Push via surgical edit

**For bulk operations on existing pages:**
When using "Replace All Text" or "Generate New Article" in the Page Editor, links get injected into the new content BEFORE it's mapped to text widgets. Same `injectLinks()` function, same flow.

### 7D. AI Link Discovery (Semi-Automated)

**New endpoint:** `POST /api/links/discover`

```
Accept: {
  websiteId,
  businessType: "house cleaning",
  location: "Austin, TX",
  count: 45,                    // how many candidates to find
  categories: ['local_org', 'industry_authority', 'government', 'educational']
}

Flow:
1. Use LLM (via existing llm-service.ts) to generate a search strategy
2. For each category, generate relevant search queries
3. Use web search or scraping to find candidate URLs
4. For each candidate:
   a. Verify the URL is live (HEAD request)
   b. Check domain authority if possible
   c. Generate a description of why this link is relevant
   d. Suggest anchor text
5. Save all candidates to link_pool with status='pending'
6. Return candidates for human review
```

**Note:** This can start simple — even just having the LLM generate a list of suggested URLs based on the business type and location, without actual scraping. The human verifies and adds the real URLs. More sophisticated scraping/verification can be added later.

### 7E. Backend Endpoints

**File:** `server/routes/links.js` (NEW route file)

#### `GET /api/links/pool/:websiteId`
Get all links in the pool for a website. Filterable by status, assignment.

#### `POST /api/links/pool`
Add a link to the pool manually.
```
Accept: { websiteId, url, anchorText, description, linkType }
```

#### `PUT /api/links/pool/:linkId`
Update a link (approve, reject, assign to article, change anchor text).

#### `DELETE /api/links/pool/:linkId`
Remove a link from the pool.

#### `POST /api/links/pool/bulk`
Add multiple links at once (from AI discovery or manual batch entry).

#### `PUT /api/links/pool/bulk-approve`
Approve multiple links at once.
```
Accept: { linkIds: [1, 2, 3] }
```

#### `POST /api/links/distribute`
Auto-distribute unassigned approved links to articles.
```
Accept: { websiteId, workflowId }
Returns: { distributed: 28, skipped: 2, errors: [] }
```

#### `POST /api/links/discover`
AI link discovery (described in 7D above).

#### `GET /api/links/article/:articleId`
Get links assigned/used on a specific article.

#### `POST /api/links/inject-preview`
Preview what the content would look like with links injected (without pushing).
```
Accept: { articleId, links: [...] }
Returns: { previewHtml: "...", injectionPoints: [...] }
```

### 7F. Frontend — Link Pool Manager

**New component:** `src/components/LinkPoolManager.tsx`

A management interface for the link pool, accessible from the website/workflow level.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Link Pool — Austin Cleaning Co.                    [Discover Links] │
│                                                                     │
│ Approved (28)  │  Pending (12)  │  Rejected (5)  │  Used (24)      │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ✓ Austin Chamber of Commerce                                   │ │
│ │   https://austinchamber.com                                    │ │
│ │   Anchor: "Austin business community"                          │ │
│ │   Assigned to: "About Us" page     [Unassign] [Edit] [Reject] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ✓ ISSA Cleaning Industry Association                           │ │
│ │   https://issa.com/about                                       │ │
│ │   Anchor: "professional cleaning standards"                    │ │
│ │   Auto-distribute (unassigned)          [Assign] [Edit] [Reject]│ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ? Better Business Bureau - Austin                     PENDING  │ │
│ │   https://bbb.org/austin/...                                   │ │
│ │   AI found: "Local business credibility"                       │ │
│ │                                     [Approve] [Reject] [Edit]  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ── BATCH ENTRY ──                                                   │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Paste URLs (one per line):                                    │   │
│ │ https://...                                                   │   │
│ │ https://...                                                   │   │
│ └───────────────────────────────────────────────────────────────┘   │
│ [Add to Pool]                                                       │
│                                                                     │
│ ── DISTRIBUTION ──                                                  │
│ Unassigned approved links: 24                                       │
│ Articles without outbound links: 30                                 │
│ [Auto-Distribute Links to Articles]                                 │
│                                                                     │
│ ⓘ Each article gets one outbound link. Links are randomly assigned. │
└─────────────────────────────────────────────────────────────────────┘
```

**Batch entry:** The worker in the office fills in the approved links one by one (or pastes a batch). Each one gets a text box for URL and optional anchor text.

**Manual assignment:** Click "Assign" on a link → dropdown of articles → select which article gets this specific link.

**Auto-distribute:** Click button → system randomly assigns remaining unassigned links to articles that don't have one yet.

### 7G. Frontend — Page Editor Link Integration

**Add to the Page Editor (Phase 6) toolbar:**

```
[Manage Links]
```

When clicked, shows a link management panel within the Page Editor:

```
┌─────────────────────────────────────────────────────────────────┐
│ Links for this page                                              │
│                                                                  │
│ INTERNAL (auto-detected):                                        │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ ↗ Parent Page: "Deep Cleaning Services"                    │  │
│ │   URL: /deep-cleaning-services/                            │  │
│ │   Anchor text: [our deep cleaning services    ] (editable) │  │
│ │   Status: Will inject into text widget #3      [Preview]   │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ OUTBOUND (from link pool):                                       │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ ↗ ISSA Cleaning Association                                │  │
│ │   URL: https://issa.com/about                              │  │
│ │   Anchor text: [professional cleaning standards] (editable)│  │
│ │   Status: Will inject into text widget #5      [Preview]   │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ [+ Add Custom Link]  — for one-off links specific to this page   │
│                                                                  │
│ [Apply Links to Text]  — injects links into text widget content  │
│                                                                  │
│ ⓘ Links are injected into the first matching text. You can       │
│   preview where each link will appear before pushing.            │
└─────────────────────────────────────────────────────────────────┘
```

**"Apply Links to Text"** takes the configured links and calls `injectLinks()` on the relevant text widgets. The text widget cards then update to show the linked version (with the anchor text highlighted/underlined in the preview).

**Link preview in text widget cards:** When links have been injected, the text widget card preview should show the anchor text highlighted (e.g., underlined or colored) so the user can see where the links will appear.

---

## How the Complete Flow Works

### New Page (Building from Scratch)

```
1. Keyword → prompt chain → final_content
2. Get parent page link (automated from wp_page_hierarchy)
3. Get outbound link (from link pool — assigned or auto-distributed)
4. injectLinks(finalContent, [parentLink, outboundLink])
5. chunkContent(contentWithLinks)
6. buildElementorPage(chunks) — links are already in the HTML
7. Publish to WordPress
```

### Existing Page (Full Takeover via Page Editor)

```
1. Pull page → see widget cards
2. Click "Generate New Article" → prompt chain creates new content
3. New content appears in text widget cards
4. Click "Manage Links" → parent link auto-detected, outbound link from pool
5. Click "Apply Links to Text" → links injected into text widget HTML
6. Text widget cards update with link-highlighted previews
7. Click "Generate Images from Text" → AI creates matching images
8. Review everything → Push all changes
```

### Existing Page (Just Replace Links)

```
1. Pull page → see widget cards
2. Don't change any text
3. Click "Manage Links" → configure new parent link + outbound link
4. Click "Apply Links to Text" → links injected into EXISTING text
5. Only the text widgets with new links show as MODIFIED
6. Push just the link changes — everything else untouched
```

---

## Files to Read (Before Writing Code)

| File | What to Look For |
|---|---|
| `server/db/schema.sql` | Existing tables, wp_page_hierarchy structure |
| `server/db/setup-all.mjs` | How migrations are handled (Golden Rule #16) |
| `server/services/elementor-builder.js` | `contentToHtml()` — how HTML is handled, `buildElementorPage()` options |
| `server/services/elementor-page-parser.js` (Phase 6) | `applyTextEdits()` — how text edits are applied to existing pages |
| `server/services/content-chunker.js` | `chunkContent()` — ensure links survive chunking |
| `server/routes/elementor.js` | Publishing flow, where to hook in link injection |
| `src/components/articles/ArticleListView.tsx` | Where Link Pool Manager could be accessed |
| `src/components/AgencyManager.tsx` | Website-level settings (where link pool fits) |

## Files to Create

| File | Purpose |
|---|---|
| `server/services/link-injector.js` | `injectLinks()`, `findAnchorText()`, `distributeLinksToArticles()`, `getParentPageLink()` |
| `server/routes/links.js` | All link pool CRUD + distribution + discovery endpoints |
| `src/components/LinkPoolManager.tsx` | Link pool management UI |

## Files to Modify

| File | Change |
|---|---|
| `server/db/schema.sql` | Add `link_pool` table |
| `server/db/setup-all.mjs` | Add migration for `link_pool` table |
| `server/index.js` (or server entry) | Register new `/api/links` route |
| `server/routes/elementor.js` | Hook link injection into publish flow (new pages) |
| `src/components/PageEditor.tsx` (Phase 6) | Add "Manage Links" panel and link preview in widget cards |
| `App.tsx` | Add link injection to batch processing flow |

---

## Golden Rules (Must Follow)

1. **#7 React Portals for Modals:** Link management panel and confirmation dialogs use portals.
2. **#9 Never Silently Swallow Errors:** If link injection fails (anchor text not found, invalid URL), report clearly.
3. **#16 DB Migrations:** New `link_pool` table must have migration AND be in `setup-all.mjs`.

## What NOT to Do

- Do NOT nest `<a>` tags inside existing `<a>` tags — invalid HTML. The `safeInjectLink()` function must check for this.
- Do NOT inject links into heading widgets — only text editor widgets. Headings with links look wrong.
- Do NOT auto-distribute the same link to multiple pages — one link per page, one page per link.
- Do NOT inject links before the prompt chain finishes — links go into the final content, not intermediate drafts.
- Do NOT make link injection mandatory — it should be optional. Pages without links are fine (user might not have the pool set up yet).
- Do NOT modify `chunkContent()` — links are `<a>` tags in the HTML, and the chunker already preserves HTML. Verify this.
- Do NOT hardcode `rel="nofollow"` on outbound links — make it configurable per link. Some outbound links should pass SEO juice (dofollow).

---

## Validation

### Session A (Backend)

1. **Link pool CRUD:** Create, read, update, delete links in pool
2. **Bulk add:** Paste 10 URLs → all added to pool with status='pending'
3. **Approve/reject:** Approve 8, reject 2 → verify status changes
4. **Manual assignment:** Assign link to specific article → verify mapping
5. **Auto-distribute:** 20 approved unassigned links, 25 articles → verify 20 get links, 5 don't, no duplicates
6. **Parent page detection:** Article with parent in wp_page_hierarchy → returns parent URL and suggested anchor text
7. **Link injection (new page):** Generate article → inject parent + outbound links → verify `<a>` tags in HTML
8. **Link injection (existing page):** Inject link into text widget HTML → verify anchor text wrapped correctly
9. **Safe injection:** Content already has `<a>` tags → new link injected without nesting
10. **Anchor text not found:** Link description doesn't match content → fallback behavior (append or skip with warning)

### Session B (Frontend)

11. **Link Pool Manager:** View all links, filter by status, approve/reject/edit
12. **Batch entry:** Paste 5 URLs → all appear as pending in pool
13. **Manual assignment UI:** Click Assign → select article → link assigned
14. **Auto-distribute button:** Click → links distributed → count updates
15. **Page Editor integration:** "Manage Links" panel shows parent + outbound links
16. **Link preview:** After applying links, text widget cards show anchor text highlighted
17. **Apply to new content:** Generate New Article → Apply Links → verify links in generated content
18. **Apply to existing content:** Keep existing text → Apply Links → only link-modified widgets show MODIFIED

### Edge Cases

19. Article has no parent page (top-level) → skip parent link, no error
20. Link pool empty → show message "No links available. Add links or run AI discovery."
21. All links already used → show "All links distributed. Add more to the pool."
22. Anchor text appears multiple times → link only the first occurrence
23. Very short article (1 paragraph) → both links go in the same widget if needed
24. Link URL is invalid/broken → warn during approval, don't block distribution
25. Content has no text related to the link → fall back to generic anchor text or skip with warning
