# Agent OS: Site Planning System - Complete Architecture

## PROJECT: PromptFlow Site Planning System

**Core Component:** Article Draft & Receipt Page (PageDetailModal)
**Purpose:** Central hub for all page types in the SEO content automation system

---

## 📋 STANDARDS LAYER

### Technology Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Express.js + Node.js (ES Modules)
- **Database**: PostgreSQL via Neon Serverless
- **AI Models**: Claude (content), GPT-Image-1.5/Flux/Seedream (images)
- **CMS**: WordPress REST API + Elementor Page Builder

### Coding Conventions
- React functional components with hooks
- camelCase in frontend, snake_case in database
- Transform at API boundaries (CRITICAL)
- Async/await for all API calls
- JSONB for flexible data structures

### Key Database Tables
```sql
site_plan_nodes    -- Page hierarchy (parent/child structure)
articles           -- Generated content + images + meta
workflows          -- Prompt chain configuration
image_bank_items   -- Pre-generated images with avatar tags
websites           -- WordPress credentials and settings
```

---

## 🎯 PRODUCT LAYER

### Vision
**Automated Local SEO Factory** - Generate hundreds of hierarchical pages with proper parent/child relationships, optimized for local search rankings.

### The Site Planning Ecosystem

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SITE PLANNING SYSTEM                             │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    PAGE HIERARCHY (Tree View)                    │   │
│  │  • Cleaners Hendersonville (Category)                           │   │
│  │    • House Cleaning Service(H) (Landing) ← PILLAR               │   │
│  │      • Standard Cleaning(H) (Service)     ← CORE 30 PAGES       │   │
│  │      • Deep Cleaning(H) (Service)                               │   │
│  │      • Move In/Out Cleaning(H)                                  │   │
│  │      • [Supporting Article 1] (Blog)      ← SHEEP HERDING       │   │
│  │      • [Supporting Article 2] (Blog)                            │   │
│  │    • Janitorial Service(J) (Landing)                            │   │
│  │      • Office Cleaning(J) (Service)                             │   │
│  │    • Neighborhoods (Location)             ← LOCATION EXPANSION  │   │
│  │      • Downtown Hendersonville            ← NEIGHBORHOOD PAGES  │   │
│  │      • Indian Lake Area                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              ARTICLE DRAFT & RECEIPT PAGE                        │   │
│  │                    (PageDetailModal)                             │   │
│  │                                                                  │   │
│  │   THE HEART OF THE SYSTEM - Every page type flows through here  │   │
│  │                                                                  │   │
│  │   • View generated content                                       │   │
│  │   • Select meta titles/descriptions                             │   │
│  │   • Manage images (push, replace, generate)                     │   │
│  │   • Publish to WordPress with hierarchy                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    LOCAL VIKING INTEGRATION                      │   │
│  │                                                                  │   │
│  │   Heat Maps → Identify weak rankings → Queue supporting pages   │   │
│  │   "Sheep Herding" → Push near-top-3 pages into 3-pack          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Page Types and Their Flow

| Page Type | Tag | Parent | Purpose | Flow |
|-----------|-----|--------|---------|------|
| Category | - | Root | Group services | Manual create → Publish |
| Landing (Pillar) | H/J/C | Category | Main service hub | Generate → Draft → Publish |
| Service Page | H/J/C | Landing | Specific service | Generate → Draft → Publish |
| Location Page | - | Root | Neighborhood targeting | Generate → Draft → Publish |
| Supporting Article | H/J/C | Service | Boost parent ranking | Generate → Draft → Publish |
| Blog Post | H/J/C | Blog | General content | Generate → Draft → Publish |

**ALL page types go through the Article Draft & Receipt Page (PageDetailModal)**

---

## 🔧 SPECS LAYER

### Feature: Article Draft & Receipt Page (PageDetailModal)

#### Overview
The central hub where ALL page content is viewed, edited, and published. Regardless of page type (service page, location page, supporting article), every generated page flows through this component.

#### Component Architecture

```typescript
// File: src/components/PageDetailModal.tsx

interface PageDetailModalProps {
  node: SitePlanNode;           // The page in site hierarchy
  article: Article | null;       // Generated content (null if not generated)
  workflow: Workflow;            // Prompt chain configuration
  website: Website;              // WordPress credentials
  onClose: () => void;
  onRefresh: () => void;
}

// Page type determines:
// - Which prompt chain to use
// - Parent page for WordPress hierarchy
// - Image matching by avatar_tag
```

#### UI Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PAGE: Standard Cleaning(H)                                      [X]    │
│  Type: Service Page  |  Parent: House Cleaning Service(H)              │
│  Status: Draft  |  Words: 1,247  |  AI: 30.3%                          │
├─────────────────────────────────────────────────────────────────────────┤
│  [📄 Content] [🖼️ Images] [🔍 Meta SEO]           [Edit] [Publish →]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│  CONTENT TAB                                                            │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  [Article HTML rendered preview]                                  │ │
│  │                                                                   │ │
│  │  # Standard Cleaning Hendersonville TN                           │ │
│  │                                                                   │ │
│  │  In Hendersonville, TN, busy families and professionals trust    │ │
│  │  standard cleaning to keep homes fresh without the hassle...     │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Chain Outputs:                                                         │
│  ├─ 12_PAA: [View] [Copy]                                              │
│  ├─ Service_Page_Outline: [View] [Copy]                                │
│  └─ Service_Page_Article: [View] [Copy]                                │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│  IMAGES TAB                                                             │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  Images (4)                                      [Push All to WordPress]│
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │  [IMG]   │ │  [IMG]   │ │  [IMG]   │ │  [IMG]   │                   │
│  │   HERO   │ │SECTION 1 │ │SECTION 2 │ │SECTION 3 │                   │
│  │ ✓ Pushed │ │ ○ Pending│ │ ○ Pending│ │ ✓ Pushed │                   │
│  │[Replace] │ │[Replace] │ │[Replace] │ │[Replace] │                   │
│  │[Push]    │ │[Push]    │ │[Push]    │ │[Push]    │                   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                   │
│                                                                         │
│  No images? [Generate from Bank] [Generate Live]                       │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│  META SEO TAB                                                           │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  META TITLES:                                                           │
│  ○ Standard Cleaning Hendersonville TN | Fresh Start                   │
│  ● Hendersonville TN Standard Cleaners | Fresh Start    [SELECTED]     │
│  ○ Professional Standard Cleaning in Hendersonville                    │
│  ○ Custom: [_________________________________]                          │
│                                                                         │
│  META DESCRIPTIONS:                                                     │
│  ● Standard cleaning in Hendersonville, TN for floors...  [SELECTED]   │
│  ○ Professional house cleaning services in Hendersonville...           │
│  ○ Custom: [_________________________________]                          │
│                                                                         │
│  [Save Selection]  [Push to WordPress SEO]                             │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  STATUS: Content ✓  |  Images: 2/4 pushed  |  Meta: Selected (saved)   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### THE IMAGE PIPELINE (5 Steps)

```
STEP 1: GENERATION
┌─────────────────────────────────────────┐
│  Prompt + Content → AI Model            │
│  (Flux 1.1 Pro / GPT-Image-1.5)         │
│  Output: base64 string                  │
│  PROBLEM: WordPress blocks base64       │
└─────────────────────────────────────────┘
                    ↓
STEP 2: TEST WORDPRESS UPLOAD
┌─────────────────────────────────────────┐
│  base64 → Test WordPress Media Library  │
│  POST /wp-json/wp/v2/media              │
│  Returns: wpUrl + wpMediaId (test site) │
│  PURPOSE: Real URL bypasses security    │
└─────────────────────────────────────────┘
                    ↓
STEP 3: IMAGE BANK STORAGE
┌─────────────────────────────────────────┐
│  Store in image_bank_items table:       │
│  • url: original or wpUrl               │
│  • wp_url: test site URL                │
│  • avatar_tag: H/J/C for matching       │
│  • variation_id: avatar variation       │
│  • used: false until assigned           │
└─────────────────────────────────────────┘
                    ↓
STEP 4: ARTICLE ASSIGNMENT
┌─────────────────────────────────────────┐
│  Match images to article by avatar_tag  │
│  Store in article.generated_images:     │
│  [{id, url, placement, prompt, ...}]    │
│  wpMediaId: null (not on target yet)    │
└─────────────────────────────────────────┘
                    ↓
STEP 5: TARGET WORDPRESS PUBLISH
┌─────────────────────────────────────────┐
│  Upload each image to TARGET WordPress  │
│  Get NEW wpMediaId from target site     │
│  Build Elementor with target wpMediaIds │
│  Create page with proper parent         │
│  Mark images: pushedToWp: true          │
└─────────────────────────────────────────┘
```

---

### META TITLE/DESCRIPTION FLOW

```
GENERATION:
┌─────────────────────────────────────────┐
│  Prompt output includes:                │
│  ---META TITLES---                      │
│  1. First option                        │
│  2. Second option                       │
│  ---META DESCRIPTIONS---                │
│  1. First description                   │
│  2. Second description                  │
│                                         │
│  Parsed into arrays:                    │
│  meta_titles: ["First", "Second"]       │
│  meta_descriptions: ["Desc1", "Desc2"]  │
└─────────────────────────────────────────┘
                    ↓
SELECTION UI:
┌─────────────────────────────────────────┐
│  Radio buttons for each option          │
│  Custom text input for manual entry     │
│  selectedTitleIndex: 0, 1, or -1        │
│  customMetaTitle: "" or user text       │
└─────────────────────────────────────────┘
                    ↓
SAVE (No WordPress):
┌─────────────────────────────────────────┐
│  POST /api/seo/select/:articleId        │
│  Stores: selected_meta_title,           │
│          selected_meta_description      │
│  Status: meta_seo_status = 'selected'   │
└─────────────────────────────────────────┘
                    ↓
PUSH TO SEO PLUGIN:
┌─────────────────────────────────────────┐
│  POST /api/seo/push-direct              │
│  Sends to RankMath/Yoast/AIOSEO         │
│  Updates WordPress post meta fields     │
│  Status: meta_seo_status = 'pushed'     │
└─────────────────────────────────────────┘
```

---

### API ENDPOINTS SUMMARY

#### Content Generation
```javascript
// Load keywords from Site Planning to Workflow
// (Uses existing loadItems() in App.tsx)
// Items include sitePlanNodeId for linking back

// After generation, link article to node:
PATCH /api/site-planning/nodes/:nodeId
{ assignedArticleId: article.id, status: 'built' }
```

#### Image Management
```javascript
// CORRECT ENDPOINTS (note articleId in URL):
POST /api/articles/:articleId/push-images      // Push all images
POST /api/articles/:articleId/regenerate-image // Replace single image
POST /api/articles/:articleId/generate-images  // Generate from scratch

// Image Bank:
GET  /api/image-bank/:workflowId              // Get available images
POST /api/image-bank/:workflowId/mark-used/:imageId  // Mark as used
```

#### Meta SEO
```javascript
POST /api/seo/select/:articleId    // Save selection (no push)
POST /api/seo/push-direct          // Push to WordPress SEO plugin
```

#### WordPress Publishing
```javascript
POST /api/elementor/publish
{
  articleId: 123,
  parentWpPageId: 456,  // For hierarchy!
  status: 'draft' | 'publish',
  // ... content and images
}
```

---

### SHEEP HERDING INTEGRATION

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LOCAL VIKING HEAT MAP ANALYSIS                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Keyword: "Standard Cleaning Hendersonville"                     │   │
│  │  Average Rank: 6.2  |  Best Rank: 4  |  Top 3 Count: 2          │   │
│  │                                                                  │   │
│  │  RECOMMENDATION: Add 2-3 supporting articles to push into top 3 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  CREATE SUPPORTING ARTICLES IN SITE PLANNING:                    │   │
│  │                                                                  │   │
│  │  • Standard Cleaning(H)  [Service Page - Rank 6.2]              │   │
│  │    └─ + "How Often Should You Standard Clean?" (Blog)           │   │
│  │    └─ + "Standard Cleaning vs Deep Cleaning Guide" (Blog)       │   │
│  │    └─ + "What Standard Cleaners Include" (Blog)                 │   │
│  │                                                                  │   │
│  │  Parent: Standard Cleaning(H) page                              │   │
│  │  These supporting articles BOOST the parent page ranking        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  EACH SUPPORTING ARTICLE → PageDetailModal                       │   │
│  │  Same flow: Generate → Images → Meta → Publish with parent      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### LOCATION/NEIGHBORHOOD PAGES

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HEAT MAP SHOWS GEOGRAPHIC GAPS                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  [Map visualization with ranking colors]                         │   │
│  │  Red spots = Poor rankings in certain neighborhoods              │   │
│  │                                                                  │   │
│  │  RECOMMENDATION: Create neighborhood-specific pages              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ADD NEIGHBORHOOD PAGES IN SITE PLANNING:                        │   │
│  │                                                                  │   │
│  │  • Neighborhoods (Category)                                      │   │
│  │    └─ Downtown Hendersonville (Location)                        │   │
│  │    └─ Indian Lake Area (Location)                               │   │
│  │    └─ Gallatin Pike Corridor (Location)                         │   │
│  │                                                                  │   │
│  │  Each location page → PageDetailModal                           │   │
│  │  Generate with neighborhood-specific content                    │   │
│  │  Publish with proper hierarchy                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🎬 IMPLEMENTATION PHASES

### Phase 1: PageDetailModal Core
**Goal:** Create the central Article Draft & Receipt component
- Content preview tab
- Chain outputs display
- Status bar

### Phase 2: Meta SEO Tab
**Goal:** Full meta title/description management
- Radio button selection
- Custom text input
- Save selection (no push)
- Push to WordPress SEO
- API: `/api/seo/select/:articleId`, `/api/seo/push-direct`

### Phase 3: Images Tab
**Goal:** Complete image management
- Image grid with status indicators
- Push All button (CORRECT endpoint: `/api/articles/:articleId/push-images`)
- Individual Push buttons
- Replace/Regenerate buttons
- Generate from Bank / Generate Live options

### Phase 4: Site Planning Integration
**Goal:** Connect tree view to PageDetailModal
- Click node → Open PageDetailModal
- Load to Workflow button for batch generation
- Node status updates (planned → built → published)

### Phase 5: Hierarchical Publishing
**Goal:** Proper WordPress parent/child relationships
- Resolve parent node wp_page_id
- Pass parentWpPageId to publish endpoint
- WordPress creates pages with correct hierarchy

### Phase 6: Sheep Herding Features
**Goal:** Local Viking integration
- Heat map visualization
- Ranking analysis per page
- Supporting article suggestions
- One-click supporting page creation

---

## 📁 FILES

### Create:
```
src/components/PageDetailModal.tsx    # THE HEART - Article draft/receipt
```

### Modify:
```
src/components/SitePlanningSection.tsx  # Add modal trigger, node selection
App.tsx                                  # Accept sitePlanNodeId
server/routes/articles.js               # Node linking after save
server/routes/elementor.js              # Accept parentWpPageId
```

### Reference (patterns to copy):
```
src/components/ArticleManager.tsx       # State management patterns
server/routes/image-creation.js         # Image endpoints
server/routes/seo.js                    # Meta endpoints
```

---

## ✅ AGENT CHECKLIST

For implementing agents, verify:

- [ ] PageDetailModal renders in SitePlanningSection
- [ ] Content tab shows article HTML preview
- [ ] Chain outputs are expandable/copyable
- [ ] Meta tab has radio buttons for each option
- [ ] Meta tab has custom text input option
- [ ] Save Selection calls `/api/seo/select/:articleId`
- [ ] Push to SEO calls `/api/seo/push-direct`
- [ ] Images tab shows grid with status
- [ ] Push All uses CORRECT endpoint: `/api/articles/:articleId/push-images`
- [ ] Replace buttons call `/api/articles/:articleId/regenerate-image`
- [ ] Generate from Bank matches by avatar_tag
- [ ] Publish includes parentWpPageId for hierarchy
- [ ] Node status updates after publish
