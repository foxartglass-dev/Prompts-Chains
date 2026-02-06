# PRD: Article Command Center ("The Desk")

## Priority: HIGH
## Estimated Complexity: Medium (2-3 focused agent sessions for Phase 0+1)
## Date: 2026-02-06

---

## The Vision

**Current architecture: Motel hallway.** Walk room by room. Open a door, look around, close it, walk to the next. Every article is its own room. Every feature (images, components, publishing, settings) is another wing of the building. You're walking everywhere.

**New architecture: The Desk.** Everything rotates to YOU. Articles spin to you like a revolver chamber — but better than a revolver, because with tabs you can teleport to any chamber instantly. Images are right there. Graphics are right there. Push buttons are right there. You don't go anywhere. Everything comes to the desk.

**The article page IS the edit page IS the review page IS the push page.** Why have separate pages when you're always working on ONE article at a time? One desk. Everything around it.

**Long-term:** The Desk becomes the center of the app. Two main zones:
1. **Prompt Flows** — article generation, prompt chains (its own page, deserves its own space)
2. **The Desk** — everything post-generation: editing, reviewing, images, graphics, pushing, settings

For now though, we build it as a dropdown section in the current app.

---

## Problem

After publishing 200 articles to WordPress, the user needs to:
1. **Proofread** articles — fix 1-5 words per page (e.g., "Restoration" → "Cleanup")
2. **Review images** — check if they look right, regenerate bad ones
3. **Push changes** — send edits to WordPress without logging into Elementor
4. **Manage graphics** — swap components, update CTA, push new graphics

Currently, this requires:
- Opening each article individually in PromptFlow (clicking in/out, loading each one)
- OR logging into WordPress → finding the page → waiting for Elementor to load → editing → saving
- Multiply that by 50-200 pages = hours of clicking, loading, waiting

**The user should never leave PromptFlow.** Everything comes to them in one workspace.

---

## Phase 0: Dropdown in Current App (BUILD THIS FIRST)

The immediate implementation — fits into the existing UI without a full rebuild.

### Where It Goes

**New collapsible section** placed between the Processing Log and the Prompt Workflow sections (near the top of the main page). Like the other dropdowns (Audience Avatars, Image Creation, etc.) but with one key difference:

**When you open it, it takes over the full page.**

This follows the same pattern as the Audience Avatar "Expand" button — except it goes full-page immediately on dropdown open. No separate expand click. You drop it down, boom, full page editor.

### Why Full Page on Open

Because you need space. The editor needs:
- Article content (main area, wide)
- Images (sidebar)
- Actions/push buttons (sidebar)
- Find & Replace (sidebar)
- Tabs (top)
- Navigation arrows (top/bottom)

That doesn't fit in a 400px collapsible dropdown. Full page from the start.

### Close / Collapse

- "Close" / "X" button in the top-right to collapse back to the dropdown
- Or press `Escape` (when not focused in the content editor)
- Returns to the normal page with all other sections visible

### Implementation

The dropdown header shows:
```
▶ Article Editor                                [147 articles]
```

When clicked, it expands to full-page overlay (React Portal, z-index above everything else):
```
┌──────────────────────────────────────────────────────────────────┐
│ Article Editor                                        [× Close] │
│                                                                  │
│ Tabs: [All (147)] [Flagged (3)] [Art 12 ×] [Art 41 ×]          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ◄ Prev    Article 12 of 147: "Demolition Cleanup..."    Next ► │
│            Status: ● Published  │  WP ID: 4523                   │
│                                                                  │
├────────────────────────────┬─────────────────────────────────────┤
│                            │                                     │
│  ARTICLE CONTENT           │  IMAGES (4)                        │
│  (always editable)         │  ┌─────┐ ┌─────┐                  │
│                            │  │hero │ │sec-1│                   │
│  Demolition Cleanup in     │  └─────┘ └─────┘                  │
│  Hendersonville, TN —      │  ┌─────┐ ┌─────┐                  │
│  Professional Post-Demo    │  │sec-2│ │sec-3│                   │
│  Site [Cleanup]            │  └─────┘ └─────┘                  │
│                            │  [Regen All] [Push Images ↑]       │
│  In Hendersonville,        │                                     │
│  demolition cleanup        │  ACTIONS                           │
│  keeps construction        │  [Push Content ↑]                  │
│  sites safe, compliant,    │  [Push Everything ↑]               │
│  and ready for the next    │  [View on WordPress ↗]             │
│  phase...                  │  [Flag ⚑] [Revert ↺]              │
│                            │                                     │
│                            │  FIND & REPLACE                    │
│                            │  Find: [____________]               │
│                            │  Replace: [____________]            │
│                            │  [Replace] [Replace All]            │
│                            │                                     │
│                            │  META                               │
│                            │  Title: [editable_______]           │
│                            │  Desc:  [editable_______]           │
│                            │  [Push Meta ↑]                     │
│                            │                                     │
├────────────────────────────┴─────────────────────────────────────┤
│  ◄ Prev    [Save Draft] [Push to WP ↑] [Revert ↺]    Next ►   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Core Features

### 1. Always-Live Editing (No Mode Toggle)

**The content is always editable.** You see the article, you click on a word, you change it. Zero mode switching, zero extra clicks.

- Article content rendered as styled HTML — AND editable (contenteditable)
- Click anywhere to start typing/editing
- Changes tracked — edited text gets a subtle highlight so you see what you changed
- Find & Replace always available in sidebar
- "Save Draft" saves to DB without pushing to WP
- "Push to WP" saves AND rebuilds the WordPress page
- **No "Edit" button.** No mode toggle. You're always in the zone.

**Key UX detail:** When user is clicked into the content (editing), arrow keys type/navigate text. When user clicks outside content or presses Escape, arrow keys switch between articles (swipe). This feels natural — same as any text editor.

**Unsaved changes guard:** If user swipes away from an article with unsaved edits, show a quick confirmation: "You have unsaved changes. [Save & Continue] [Discard]"

### 2. Navigation (The Revolver Chamber)

**Arrow Keys / Swipe:**
- `←` / `→` arrow keys to navigate between articles (when not in editor)
- Current article index shown: "Article 12 of 147"
- Navigation is INSTANT — content loads from local state (preloaded from DB)

**Tab System:**
- **"All" tab** — full article list, navigate sequentially
- **"Flagged" tab** — only articles you've flagged for review
- **Individual article tabs** — pin specific articles (click × to close)
- Clicking a tab jumps directly to that article (no swiping needed)
- Tabs persist during session

**Why tabs matter:** You swipe through 200 articles. You find 3 that need editing. You flag them. Now click "Flagged" tab — only those 3 show up. Edit, push, done. No swiping through 197 clean articles to find the 3 dirty ones.

### 3. Find & Replace (The Power Tool)

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
- Works on the HTML content — smart enough to skip HTML tags (only replace visible text)

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

### 4. Revert Button (CRITICAL SAFETY FEATURE)

**Every action that changes content or pushes to WordPress must be revertable.**

The user accidentally pushed a template move and lost 10 minutes recovering. Never again.

**How it works:**

Before any save or push, snapshot the current state:
```typescript
interface ArticleSnapshot {
  articleId: number;
  final_content: string;        // The content before edit
  generated_images: any[];      // Images before change
  meta_title: string;
  meta_description: string;
  wp_post_id: number;           // Page ID before rebuild
  timestamp: string;
  action: string;               // What triggered the snapshot: 'edit', 'push', 'replace-images', etc.
}
```

**Revert flow:**
1. User clicks [Revert ↺]
2. Confirmation: "Revert to version before [last action] at [timestamp]? This will restore the content and rebuild the WordPress page."
3. On confirm:
   - Restore `final_content` from snapshot
   - Save to DB
   - If page was rebuilt: rebuild again with restored content (same slug preserved)
4. Show success toast: "Reverted to version from [timestamp]"

**Storage:** Keep last 5 snapshots per article in React state (session-only). Optional: persist to DB for cross-session undo:
```sql
CREATE TABLE article_snapshots (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES articles(id),
  final_content TEXT,
  generated_images JSONB,
  meta_title VARCHAR(500),
  meta_description TEXT,
  action VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5. Image Panel (Sidebar)

Shows the same images from the article:
- Image grid with placement badges (hero, inline)
- WP status badges (pushed / not pushed)
- Quick actions:
  - **Regenerate** single image
  - **Regenerate All** images
  - **Push Images to Page** (upload to WP + rebuild page)
- Clicking an image opens full-size preview

### 6. Push Actions (Sidebar)

| Button | What It Does |
|--------|-------------|
| **Save Draft** | Save content to DB only. No WordPress interaction. Instant. |
| **Push Content** | Rebuilds WP page with current `final_content` (preserves images, components, CTA) |
| **Push Images** | Uploads images to WP Media Library + rebuilds page with images embedded |
| **Push Everything** | Content + Images + Components + CTA — full page rebuild |
| **Push Meta** | Updates SEO title/description via seo.js push endpoint |
| **View on WordPress** | Opens the live WP page in new tab (uses `wp_post_url`) |
| **Revert** | Restore previous version (see section 4) |

### 7. Editable Meta (Sidebar)

Meta title and description are also editable right in the sidebar:
```
META
Title: [Demolition Cleanup in Hendersonville TN — Fresh Start|]
Desc:  [Professional post-demo site cleanup services in...|    ]
[Push Meta ↑]
```

Edit the text fields, click Push Meta, done. No separate meta editing page.

### 8. Keyboard Shortcuts

- `←` / `→` — Previous / Next article (when not focused in content)
- `Cmd+H` / `Ctrl+H` — Focus Find & Replace
- `Cmd+S` / `Ctrl+S` — Save draft (prevent browser default)
- `Cmd+Enter` — Push to WordPress
- `Cmd+Z` / `Ctrl+Z` — Undo last edit (browser native contenteditable undo)
- `Escape` — Deselect content (unfocus editor, re-enable arrow key navigation)

---

## Why This Is Fast

**Content is already in the database.** Every article's `final_content` (full HTML) is stored in the `articles` table. Loading an article = one DB query returning a text field. No WordPress API call, no Elementor render, no page load.

| Action | Current Time | Desk Time |
|--------|-------------|-----------|
| Open article | 3-5 sec (navigate + load) | **Instant** (already loaded, swipe) |
| Read/review | Same | Same |
| Edit 2 words | 15-30 sec (find spot, type) | **2-3 sec** (find & replace) |
| Push to WP | 45-60 sec (log in, find page, Elementor, edit, save) | **5-10 sec** (one button) |
| Next article | 3-5 sec (navigate back, open next) | **Instant** (swipe/arrow) |

For 50 articles needing quick edits: **~50 minutes → ~10 minutes**

---

## Data Flow

### Loading Articles (On Open)

```javascript
// Fetch all articles for the current workflow
GET /api/articles?workflowId={id}&fields=id,keyword,final_content,generated_images,wp_post_id,wp_post_url,meta_title,meta_description,updated_at,wp_published_at

// Content is already in the DB — no WordPress round-trip
// Even 200 articles with content is probably <5MB — load all at once
```

**Preloading optimization:** Load article list (without content) first for instant tab/counter rendering, then lazy-load `final_content` 5 at a time as user swipes:

```typescript
const PRELOAD_WINDOW = 3; // Load 3 ahead, 3 behind

useEffect(() => {
  const start = Math.max(0, currentIndex - PRELOAD_WINDOW);
  const end = Math.min(articles.length - 1, currentIndex + PRELOAD_WINDOW);

  for (let i = start; i <= end; i++) {
    if (!articles[i].contentLoaded) {
      fetchArticleContent(articles[i].id);
    }
  }
}, [currentIndex]);
```

### Saving Edits (Draft)

```javascript
PUT /api/articles/{articleId}
Body: { final_content: "<updated HTML>" }

// Just updates DB — no WordPress interaction
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

Backend handles: snapshot → delete old page → build new page with updated content → create with same slug → update article's wp_post_id.

---

## Technical Implementation

### Content Editing Approach

**Recommended: `contenteditable` div with HTML sanitization**

Think Google Docs — you see the article rendered beautifully, and you can click anywhere and just start typing. The `final_content` is already HTML. Using `contenteditable`:
1. Renders the content as the user sees it on WordPress
2. Allows direct text editing — click a word, change it, done
3. No heavy rich text editor library needed
4. On save, sanitize HTML to prevent XSS
5. **Always editable** — the page IS the editor
6. Browser gives you free undo/redo (Cmd+Z / Cmd+Shift+Z)

**Alternative: TipTap** — if `contenteditable` proves too fragile for HTML editing, use TipTap (built on ProseMirror). It handles HTML well and has a small bundle size. But try `contenteditable` first — it's simpler and faster.

**DO NOT use a plain textarea** — the content is HTML with headings, lists, bold, etc. A textarea would show raw HTML tags which defeats the purpose.

### Full-Page Overlay (React Portal)

The editor uses a React Portal (Golden Rule 7) to render above all other content:

```typescript
function ArticleEditorOverlay({ isOpen, onClose, workflowId }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-gray-900 overflow-auto">
      {/* Full editor layout here */}
      <button onClick={onClose} className="absolute top-4 right-4">× Close</button>
      {/* ... */}
    </div>,
    document.body
  );
}
```

The dropdown header in the main page just toggles `isOpen`:
```typescript
<CollapsibleSection
  title="Article Editor"
  badge={`${articles.length} articles`}
  onToggle={() => setEditorOpen(true)}
/>
{editorOpen && <ArticleEditorOverlay isOpen onClose={() => setEditorOpen(false)} workflowId={workflowId} />}
```

---

## Implementation Order

### Session 1: Core Editor (Priority — build this first)
1. Create collapsible dropdown section in main page (between Processing Log and Prompt Workflow)
2. Build full-page overlay (React Portal) that opens when dropdown is clicked
3. Article loading from API + preloading
4. Navigation: arrow keys, article index, prev/next buttons
5. Content display with `contenteditable` — always-live editing
6. Save Draft button → `PUT /api/articles/:id`
7. Close button to return to main page

### Session 2: Sidebar + Push + Find & Replace
1. Build sidebar: images, actions, meta sections
2. Wire Push Content button → `POST /api/elementor/rebuild-page` (or existing publish endpoint)
3. Build Find & Replace with match highlighting
4. Wire Push Images, Push Meta, Push Everything buttons
5. Add editable meta fields (title, description) in sidebar
6. Add "View on WordPress" link
7. Revert button with snapshot logic

### Session 3: Tabs + Polish
1. Build tab bar: All, Flagged, pinned article tabs
2. Flag/pin functionality
3. Unsaved changes guard (confirm on navigate away)
4. Keyboard shortcuts (Cmd+S, Cmd+H, Cmd+Enter, Escape)
5. Loading states, error toasts, success indicators
6. Extract shared image grid component from ArticleListView.tsx

---

## Golden Rules

| Rule | Relevance |
|------|-----------|
| **#1 Image Pipeline Order** | When pushing images: Images → Page → Meta |
| **#7 React Portals** | Full-page overlay MUST use React Portal |
| **#9 Never swallow errors** | Show clear error messages when push fails |
| **#11 Protect mainPrompt** | Don't touch prompt chain data — only edit `final_content` |
| **#16 DB migrations** | If adding `article_snapshots` table: migration file + setup-all.mjs |
| **#17 Strip H/J/C tags** | If article content has tags, strip them in the viewer |

## What NOT to Do

- Do NOT build a full rich text editor (like Google Docs). This is for QUICK edits — 1-5 words. `contenteditable` or TipTap is enough.
- Do NOT load articles from WordPress. Content is in the database. Zero WP calls for viewing/editing.
- Do NOT create a separate save mechanism. Use the existing `PUT /api/articles/:id` endpoint.
- Do NOT duplicate the image grid code from ArticleListView. Extract and share it.
- Do NOT add workflow selection inside the editor. It inherits the current workflow from the app context.
- Do NOT build this as a separate route/page. Build as a dropdown section that opens a full-page overlay. (Future rebuild will make it a real page.)
- Do NOT remove or modify the existing article pages. This is ADDITIVE — the existing flow still works.
- Do NOT skip the Revert button. Accidental pushes need an undo. This is a critical safety feature.

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/command-center/ArticleEditorOverlay.tsx` | Full-page overlay container |
| `src/components/command-center/ArticleNavigator.tsx` | Swipe/arrow navigation + article index |
| `src/components/command-center/ArticleContentEditor.tsx` | Contenteditable article viewer/editor |
| `src/components/command-center/FindAndReplace.tsx` | Find & Replace panel |
| `src/components/command-center/EditorSidebar.tsx` | Images, actions, meta, find & replace |
| `src/components/command-center/ArticleTabs.tsx` | Tab bar: All, Flagged, pinned articles |
| `src/components/command-center/RevertManager.tsx` | Snapshot + revert logic |

## Files to Modify

| File | Change |
|------|--------|
| Main page component (where dropdowns live) | Add "Article Editor" collapsible section |
| `src/components/articles/ArticleListView.tsx` | Extract shared components (image grid, push buttons) |

## Database Changes

**Required: None** — all data already exists:
- `articles.final_content` — the article HTML
- `articles.generated_images` — the image array
- `articles.wp_post_id` / `wp_post_url` — WordPress page reference
- `articles.meta_title` / `meta_description` — SEO meta
- `articles.updated_at` / `wp_published_at` — change tracking

**Optional (nice to have, can add later):**
```sql
-- Persist flags across sessions
ALTER TABLE articles ADD COLUMN flagged_for_review BOOLEAN DEFAULT false;

-- Persist snapshots for cross-session revert (if in-memory isn't enough)
CREATE TABLE article_snapshots (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES articles(id),
  final_content TEXT,
  generated_images JSONB,
  meta_title VARCHAR(500),
  meta_description TEXT,
  action VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
If added, follow Golden Rule 16: migration file + setup-all.mjs.

---

## Long-Term Vision: The Desk Replaces Article Pages

This PRD builds Phase 0 — the dropdown overlay in the current app. But the long-term vision is bigger:

**The Desk becomes the center of the app.** Two zones:

1. **Prompt Flows Page** — article generation, prompt chains, keyword loading, batch processing. This is the "factory floor" where articles are manufactured.

2. **The Desk** — everything post-generation. Editing, reviewing, images, graphics, CTA, components, pushing. This is "quality control + shipping."

In the rebuild, The Desk absorbs:
- Article detail pages (the individual article views) → gone, replaced by the swipe editor
- Image management → lives in the sidebar
- Component Library settings → accessible from the desk when needed
- Publishing controls → all push buttons right here
- Meta editing → right here in the sidebar

The dropdown sections we have now (Loaded Items, Publishing to WordPress, Image Creation, Component Library) get reorganized:
- **Setup sections** (WordPress credentials, API keys, SEO settings) → Settings page
- **Prompt chain** → Prompt Flows page
- **Everything else** → The Desk

But that's the rebuild. For now: build the dropdown, prove the concept, iterate.
