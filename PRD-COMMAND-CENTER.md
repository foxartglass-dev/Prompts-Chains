# PRD: Article Command Center (Proofreading & Push Workspace)

## Priority: HIGH
## Estimated Complexity: Medium (2-3 focused agent sessions)
## Date: 2026-02-06

---

## Problem

After publishing 200 articles to WordPress, the user needs to:
1. **Proofread** articles — fix 1-5 words per page (e.g., "Restoration" → "Cleanup")
2. **Review images** — check if they look right, regenerate bad ones
3. **Push changes** — send edits to WordPress without logging into Elementor

Currently, this requires:
- Opening each article individually in PromptFlow (clicking in/out of article pages)
- OR logging into WordPress → finding the page → waiting for Elementor to load → editing → saving
- Multiply that by 50-200 pages = hours of clicking, loading, waiting

**The user should never leave PromptFlow.** Everything comes to them in one workspace. Swipe through articles like Tinder — review, edit, push, next.

## Goal

Build an **Article Command Center** — a single-page workspace where the user can:
1. Swipe/arrow through ALL articles in a workflow (instant load — content is in DB)
2. View the rendered article content + images + metadata
3. Edit text inline (fix words, rephrase sentences)
4. Find & Replace across the current article
5. Push changes to WordPress with one button
6. Re-push images, regenerate images, push graphics — all from this same page
7. Flag articles that need attention → they appear as tabs for quick access
8. Never need to log into WordPress/Elementor for content edits again

---

## Why This Is Fast

**Content is already in the database.** Every article's `final_content` (full HTML) is stored in the `articles` table. Loading an article = one DB query returning a text field. No WordPress API call, no Elementor render, no page load.

| Action | Current Time | Command Center Time |
|--------|-------------|-------------------|
| Open article | 3-5 sec (navigate + load) | **Instant** (already loaded, swipe) |
| Read/review | Same | Same |
| Edit 2 words | 15-30 sec (find spot, type) | **2-3 sec** (find & replace) |
| Push to WP | 45-60 sec (log in, find page, Elementor, edit, save) | **5-10 sec** (one button) |
| Next article | 3-5 sec (navigate back, open next) | **Instant** (swipe/arrow) |

For 50 articles needing quick edits: **~50 minutes → ~10 minutes**

---

## UX Design

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Command Center        Workflow: Fresh Start Cleaning                │
│                                                                     │
│ Tabs: [All (147)] [Flagged (3)] [Art 12 ×] [Art 41 ×] [Art 89 ×] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ◄ Prev (←)    Article 12 of 147    Next (→) ►                    │
│                "Demolition Cleanup in Hendersonville, TN"           │
│                                                                     │
│                             Status: ● Published  │ WP ID: 4523    │
│                                                                     │
├─────────────────────────┬───────────────────────────────────────────┤
│                         │                                           │
│   ARTICLE CONTENT       │   SIDEBAR                                │
│   ─────────────────     │   ───────                                │
│                         │                                           │
│   Demolition Cleanup    │   IMAGES (4)                             │
│   in Hendersonville,    │   ┌─────┐ ┌─────┐                       │
│   TN — Professional     │   │hero │ │sec-1│                       │
│   Post-Demo Site        │   │     │ │     │                       │
│   [Cleanup]             │   └─────┘ └─────┘                       │
│                         │   ┌─────┐ ┌─────┐                       │
│   In Hendersonville,    │   │sec-2│ │sec-3│                       │
│   demolition cleanup    │   │     │ │     │                       │
│   keeps construction    │   └─────┘ └─────┘                       │
│   sites safe...         │   [Regen All] [Push Images ↑]           │
│                         │                                           │
│                         │   ACTIONS                                │
│                         │   ─────────                              │
│                         │   [Push Content to WP ↑]                 │
│                         │   [Push Everything ↑]                    │
│                         │   [View on WordPress ↗]                  │
│                         │   [Flag for Review ⚑]                   │
│                         │                                           │
│                         │   FIND & REPLACE                         │
│                         │   ───────────────                        │
│                         │   Find: [Restoration____]                │
│                         │   Replace: [Cleanup_______]              │
│                         │   [Replace] [Replace All]                │
│                         │                                           │
│                         │   META                                   │
│                         │   ────                                   │
│                         │   Title: Demolition Cleanup...           │
│                         │   Desc: Professional post-demo...        │
│                         │   Keyword: demolition cleanup...         │
│                         │   [Push Meta ↑]                          │
│                         │                                           │
├─────────────────────────┴───────────────────────────────────────────┤
│  ◄ Prev (←)    [Save Draft] [Push to WP ↑] [Skip]    Next (→) ►  │
└─────────────────────────────────────────────────────────────────────┘
```

### Navigation

**Swipe / Arrow Keys:**
- `←` / `→` arrow keys to navigate between articles
- Or swipe gestures on touch devices
- Current article index shown: "Article 12 of 147"
- Navigation is INSTANT — content loads from local state (preloaded from DB)

**Tab System:**
- **"All" tab** — full article list, navigate sequentially
- **"Flagged" tab** — only articles you've flagged for review
- **Individual article tabs** — pin specific articles (click × to close)
- Clicking a tab jumps directly to that article (no swiping needed)
- Tabs persist during session (stored in React state)

**Keyboard Shortcuts:**
- `←` / `→` — Previous / Next article (when not focused in content)
- `Cmd+H` / `Ctrl+H` — Focus Find & Replace
- `Cmd+S` / `Ctrl+S` — Save draft (prevent browser default)
- `Cmd+Enter` — Push to WordPress
- `Escape` — Deselect content (unfocus editor, re-enable arrow key navigation)

### Single Mode: View + Edit (Always Live)

No separate "review" vs "edit" mode. **The content is always editable.** You see the article, you click on a word, you change it. Zero mode switching, zero extra clicks.

- Article content rendered as styled HTML — AND editable (contenteditable)
- Click anywhere to start typing/editing
- Changes tracked — edited sections highlighted with a subtle background
- Find & Replace always available in sidebar
- "Save Draft" saves to DB without pushing to WP
- "Push to WP" saves AND rebuilds the WordPress page
- **No "Edit" button.** No mode toggle. You're always in the zone.

### Find & Replace (The Power Tool)

For the "change 1 word" use case, this is the fastest path:

```
Find:    [Restoration         ]
Replace: [Cleanup              ]
         [Replace] [Replace All] [Preview]

Matches found: 3 (highlighted in content)
```

- Highlights all matches in the article content (yellow background)
- "Replace" replaces current match, advances to next
- "Replace All" replaces all matches
- "Preview" shows before/after diff
- Works on the HTML content — smart enough to skip HTML tags

### Image Panel (Sidebar)

Shows the same images that appear in the Article Images tab:
- Image grid with placement badges (hero, inline)
- WP status badges (pushed / not pushed)
- Quick actions:
  - **Regenerate** single image
  - **Regenerate All** images
  - **Push Images to Page** (upload to WP + rebuild page)
- Clicking an image opens full-size preview

### Push Actions (Sidebar)

| Button | What It Does |
|--------|-------------|
| **Push Content** | Rebuilds WP page with current `final_content` (preserves images, components, CTA) |
| **Push Images** | Uploads images to WP Media Library + rebuilds page with images embedded |
| **Push Everything** | Content + Images + Components + CTA — full page rebuild |
| **Push Meta** | Updates SEO title/description via seo.js push endpoint |
| **View on WordPress** | Opens the live WP page in new tab (uses `wp_post_url`) |

All push operations use the `rebuildPage()` service from the Post-Publish Visual Control PRD.

---

## Data Flow

### Loading Articles (On Page Load)

```javascript
// Fetch all articles for the current workflow — lightweight query
GET /api/articles?workflowId={id}&fields=id,keyword,final_content,generated_images,wp_post_id,wp_post_url,meta_title,meta_description,updated_at,wp_published_at

// Returns array of articles with content
// Content is already in the DB — no WordPress round-trip needed
```

**Optimization:** For large workflows (200+ articles), fetch article list first (without content), then lazy-load `final_content` as user swipes. First 5 articles preloaded, rest loaded on demand. But honestly, even 200 articles with content is probably <5MB of text — could just load all at once.

### Saving Edits (Draft)

```javascript
// Save edited content back to article
PUT /api/articles/{articleId}
Body: { final_content: "<updated HTML>" }

// This just updates the DB — no WordPress interaction
// Fast: ~50ms
```

### Pushing to WordPress

Uses the `rebuildPage()` service (from Post-Publish Visual Control PRD):

```javascript
POST /api/elementor/rebuild-page
Body: {
  articleId: 123,
  what: ['content'],  // or ['content', 'images', 'components', 'cta', 'meta']
}
```

The backend handles: delete old page → build new page with updated content → create with same slug → update article's wp_post_id.

---

## Technical Implementation

### New Route: `/command-center`

**File:** `src/pages/CommandCenterPage.tsx` (NEW FILE)

This is a new top-level page, accessible from the main navigation (alongside Articles, Image Creation, etc.).

### Key Components to Build

| Component | Purpose |
|-----------|---------|
| `CommandCenterPage.tsx` | Main page with layout, state management, keyboard handlers |
| `ArticleNavigator.tsx` | Swipe/arrow navigation, article index, preloading |
| `ArticleContentViewer.tsx` | Review mode (rendered HTML) + Edit mode (contenteditable) |
| `FindAndReplace.tsx` | Find & Replace panel with match highlighting |
| `CommandSidebar.tsx` | Images, actions, meta, find & replace — all sidebar sections |
| `ArticleTabs.tsx` | Tab bar with All, Flagged, and pinned article tabs |

### State Management

```typescript
interface CommandCenterState {
  articles: Article[];           // All articles for workflow
  currentIndex: number;          // Which article is showing
  hasUnsavedChanges: boolean;    // Whether content has been edited since last save
  editedContent: string | null;  // Dirty content (null = no edits)
  flaggedIds: Set<number>;       // Flagged article IDs
  pinnedIds: number[];           // Pinned tab article IDs
  findText: string;              // Find & Replace: search term
  replaceText: string;           // Find & Replace: replacement
  pushingState: 'idle' | 'pushing' | 'success' | 'error';
}
```

### Content Editing Approach

**Recommended: `contenteditable` div with HTML sanitization**

Think Google Docs — you see the article rendered beautifully, and you can click anywhere and just start typing. The `final_content` is already HTML. Using `contenteditable`:
1. Renders the content as the user sees it on WordPress
2. Allows direct text editing — click a word, change it, done
3. No need for a heavy rich text editor library
4. On save, sanitize HTML to prevent XSS
5. **Always editable** — no "edit mode" toggle, the page IS the editor

**Key UX detail:** When user is clicked into the content (editing), arrow keys type/navigate text. When user clicks outside content or presses Escape, arrow keys switch between articles (swipe). This feels natural — same as any text editor.

**Unsaved changes guard:** If user swipes away from an article with unsaved edits, show a quick confirmation: "You have unsaved changes. [Save & Continue] [Discard]"

**Alternative: TipTap** — if `contenteditable` proves too fragile for HTML editing, use TipTap (built on ProseMirror). It handles HTML well and has a small bundle size. But try `contenteditable` first — it's simpler and faster.

**DO NOT use a plain textarea** — the content is HTML with headings, lists, bold, etc. A textarea would show raw HTML tags which defeats the purpose.

### Find & Replace Implementation

```typescript
function findAndReplace(html: string, find: string, replace: string): string {
  // Parse HTML into DOM tree
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Walk text nodes only (skip HTML tags)
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.includes(find)) {
      node.textContent = node.textContent.replaceAll(find, replace);
    }
  }

  return doc.body.innerHTML;
}
```

This ensures we only replace visible text, not HTML attribute values or tag names.

### Preloading Strategy

```typescript
// Preload articles around current index for instant swiping
const PRELOAD_WINDOW = 3; // Load 3 ahead, 3 behind

useEffect(() => {
  const start = Math.max(0, currentIndex - PRELOAD_WINDOW);
  const end = Math.min(articles.length - 1, currentIndex + PRELOAD_WINDOW);

  for (let i = start; i <= end; i++) {
    if (!articles[i].final_content) {
      fetchArticleContent(articles[i].id);
    }
  }
}, [currentIndex]);
```

---

## Integration with Existing Features

### Navigation Entry Point

Add to main app navigation (sidebar or top nav):
```
[Articles] [Image Creation] [Component Library] [Command Center] [Settings]
```

Or add as a button within the Articles page:
```
[Open Command Center] — launches the command center for the current workflow
```

### Reuse from ArticleListView.tsx

The Command Center reuses existing patterns from ArticleListView.tsx:
- Image grid display (lines 1658-1948) — same image cards with Regenerate/View
- Push Images button logic (lines 1456-1495)
- Push All to WP flow (lines 420-527)
- Article metadata display

**Don't duplicate code.** Extract shared components from ArticleListView into reusable pieces:
- `ArticleImageGrid.tsx` — image grid with badges and actions
- `ArticlePushButtons.tsx` — push content/images/meta buttons
- `ArticleMetaDisplay.tsx` — title, description, keyword display

### Reuse from Post-Publish Visual Control PRD

The Command Center uses the same `rebuildPage()` backend service. The push buttons call the same endpoints. No new backend needed for pushing — just wire up the frontend.

---

## Implementation Order

### Session 1: Core Workspace
1. Create `CommandCenterPage.tsx` with layout skeleton
2. Build `ArticleNavigator.tsx` — swipe/arrow navigation
3. Build `ArticleContentViewer.tsx` — review mode (rendered HTML)
4. Add route to app router
5. Wire up article loading from API
6. Keyboard shortcuts (arrows, shortcuts)

### Session 2: Editing + Sidebar
1. Add Edit mode to `ArticleContentViewer.tsx` (contenteditable)
2. Build `FindAndReplace.tsx` with match highlighting
3. Build `CommandSidebar.tsx` with images, actions, meta sections
4. Wire "Save Draft" to article update API
5. Wire "Push to WP" to rebuild endpoint

### Session 3: Tabs + Polish
1. Build `ArticleTabs.tsx` — All, Flagged, pinned tabs
2. Add flag/pin functionality
3. Add preloading strategy for instant swiping
4. Progress indicators for push operations
5. Extract shared components from ArticleListView
6. Testing and edge cases

---

## Golden Rules

| Rule | Relevance |
|------|-----------|
| **#1 Image Pipeline Order** | When pushing images, always: Images → Page → Meta |
| **#7 React Portals** | Any confirmation dialogs (e.g., "Push to WP?") use portals |
| **#9 Never swallow errors** | Show clear error messages when push fails |
| **#11 Protect mainPrompt** | Don't touch prompt chain data — only edit `final_content` |
| **#17 Strip H/J/C tags** | If article content has tags, strip them in the viewer |

## What NOT to Do

- Do NOT build a full rich text editor (like Google Docs). This is for QUICK edits — 1-5 words. `contenteditable` or TipTap is sufficient.
- Do NOT load articles from WordPress. Content is in the database. Zero WP calls for viewing/editing.
- Do NOT create a separate save mechanism. Use the existing `PUT /api/articles/:id` endpoint.
- Do NOT duplicate the image grid code from ArticleListView. Extract and share it.
- Do NOT modify any existing article page functionality. The Command Center is ADDITIVE — it doesn't replace the existing article pages.
- Do NOT add workflow selection to this page. It inherits the current workflow from the app context (same as other pages).

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/CommandCenterPage.tsx` | Main page component |
| `src/components/command-center/ArticleNavigator.tsx` | Swipe/arrow navigation |
| `src/components/command-center/ArticleContentViewer.tsx` | Review + Edit modes |
| `src/components/command-center/FindAndReplace.tsx` | Find & Replace panel |
| `src/components/command-center/CommandSidebar.tsx` | Sidebar with images, actions, meta |
| `src/components/command-center/ArticleTabs.tsx` | Tab bar for navigation |

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add route for `/command-center` |
| `src/components/articles/ArticleListView.tsx` | Extract shared components (image grid, push buttons) |

## Database Changes

None required. All data already exists:
- `articles.final_content` — the article HTML
- `articles.generated_images` — the image array
- `articles.wp_post_id` / `wp_post_url` — WordPress page reference
- `articles.meta_title` / `meta_description` — SEO meta
- `articles.updated_at` / `wp_published_at` — change tracking

Optional: Add a `flagged_for_review` boolean column to persist flags across sessions:
```sql
ALTER TABLE articles ADD COLUMN flagged_for_review BOOLEAN DEFAULT false;
```
If added, follow Golden Rule 16: migration file + setup-all.mjs.
