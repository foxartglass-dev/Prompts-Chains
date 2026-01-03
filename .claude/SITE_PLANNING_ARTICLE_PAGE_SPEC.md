# Agent OS: Site Planning Article Page - Complete Spec

## 🔧 IMAGE PIPELINE - EXACT STEP-BY-STEP FLOW

### THE COMPLETE IMAGE JOURNEY

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: IMAGE GENERATION                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Prompt + Content Analysis                                       │   │
│  │           ↓                                                      │   │
│  │  AI Model (Flux 1.1 Pro / GPT-Image-1.5 / Seedream 4)           │   │
│  │           ↓                                                      │   │
│  │  OUTPUT: base64 string (data:image/png;base64,...)              │   │
│  │  PROBLEM: base64 blocked by WordPress security                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: TEST WORDPRESS UPLOAD (Security Bypass)                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  base64 image                                                    │   │
│  │           ↓                                                      │   │
│  │  POST to TEST WordPress /wp-json/wp/v2/media                    │   │
│  │           ↓                                                      │   │
│  │  WordPress processes → Creates media library entry               │   │
│  │           ↓                                                      │   │
│  │  RETURNS:                                                        │   │
│  │    • wpUrl: "https://test-wp.com/wp-content/uploads/img.png"    │   │
│  │    • wpMediaId: 12345 (test site ID)                            │   │
│  │  PURPOSE: Now have a REAL URL that bypasses security            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: IMAGE BANK STORAGE                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Image stored in image_bank_items table:                        │   │
│  │    • id: auto-generated                                          │   │
│  │    • url: original base64 or generated URL                       │   │
│  │    • wp_url: https://test-wp.com/... (from step 2)              │   │
│  │    • wp_media_id: 12345 (test site ID)                          │   │
│  │    • avatar_tag: "H" / "J" / "C" (for matching)                 │   │
│  │    • variation_id: links to avatar variation                     │   │
│  │    • prompt: full generation prompt                              │   │
│  │    • used: false (until attached to article)                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 4: ARTICLE ASSIGNMENT                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  During batch processing or manual selection:                    │   │
│  │    1. Match images by avatar_tag (H matches H articles)         │   │
│  │    2. Smart content matching (keywords in prompt vs content)    │   │
│  │    3. Select images for placements: hero, section-1, section-2  │   │
│  │    4. Store in article.generated_images JSONB array:            │   │
│  │       [                                                          │   │
│  │         {                                                        │   │
│  │           id: "img-1704283920000-hero",                         │   │
│  │           url: "https://test-wp.com/...",  ← wpUrl from bank    │   │
│  │           prompt: "Professional cleaner...",                     │   │
│  │           placement: "hero",                                     │   │
│  │           wpMediaId: null,  ← NOT SET YET (this is test site)   │   │
│  │           createdAt: "2024-01-03T...",                          │   │
│  │           pushedToWp: false                                      │   │
│  │         }                                                        │   │
│  │       ]                                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 5: TARGET WORDPRESS PUBLISHING                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  When pushing to ACTUAL target website:                         │   │
│  │                                                                  │   │
│  │  FOR EACH IMAGE:                                                 │   │
│  │    1. Fetch image from wpUrl (test site URL)                    │   │
│  │    2. Upload to TARGET WordPress /wp-json/wp/v2/media           │   │
│  │    3. Get back NEW wpMediaId (target site ID)                   │   │
│  │    4. Update article.generated_images:                          │   │
│  │       {                                                          │   │
│  │         ...existing fields...,                                   │   │
│  │         wpMediaId: 67890,  ← NOW SET (target site ID)           │   │
│  │         pushedToWp: true                                         │   │
│  │       }                                                          │   │
│  │                                                                  │   │
│  │  BUILD ELEMENTOR PAGE:                                           │   │
│  │    • Hero section with image widget: wpMediaId: 67890           │   │
│  │    • Body sections with image widgets                            │   │
│  │    • Proper left/right alignment                                 │   │
│  │                                                                  │   │
│  │  CREATE WORDPRESS PAGE:                                          │   │
│  │    POST /wp-json/wp/v2/pages                                    │   │
│  │    + _elementor_data meta with widget structure                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 META TITLE/DESCRIPTION MECHANISM - DETAILED SPEC

### How Options Are Generated

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DURING ARTICLE GENERATION                                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Prompt chain produces final_content                            │   │
│  │           ↓                                                      │   │
│  │  parseFinalOutput() looks for:                                  │   │
│  │    ---META TITLES---                                            │   │
│  │    1. First Title Option                                        │   │
│  │    2. Second Title Option                                       │   │
│  │    3. Third Title Option                                        │   │
│  │                                                                  │   │
│  │    ---META DESCRIPTIONS---                                      │   │
│  │    1. First description option here                             │   │
│  │    2. Second description option here                            │   │
│  │           ↓                                                      │   │
│  │  STORED IN ARTICLE:                                             │   │
│  │    meta_titles: ["First Title", "Second Title", "Third Title"]  │   │
│  │    meta_descriptions: ["First desc", "Second desc"]             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### UI Selection Mechanism (What Needs to Be Built)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  META TITLES                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ○ Standard Cleaning Hendersonville TN | Fresh Start            │   │
│  │  ● Hendersonville TN Standard Cleaners | Fresh Start   ← SELECTED│   │
│  │  ○ Professional Standard Cleaning in Hendersonville             │   │
│  │  ○ Custom: [___________________________________]                 │   │
│  │                                                                  │   │
│  │  When "Custom" selected: text input becomes active               │   │
│  │  selectedTitleIndex: 1  (or -1 for custom)                      │   │
│  │  customMetaTitle: "" (or user text if custom)                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  META DESCRIPTIONS                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ● Standard cleaning in Hendersonville for floors... ← SELECTED │   │
│  │  ○ Professional house cleaning services in Hendersonville...    │   │
│  │  ○ Custom: [___________________________________]                 │   │
│  │                                                                  │   │
│  │  selectedDescIndex: 0  (or -1 for custom)                       │   │
│  │  customMetaDesc: "" (or user text if custom)                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  BUTTONS:                                                               │
│  ┌──────────────┐  ┌────────────────────┐                              │
│  │    Save      │  │  Push to WordPress │                              │
│  └──────────────┘  └────────────────────┘                              │
│                                                                         │
│  Save: Stores selection to article record (no WordPress)               │
│  Push: Sends to WordPress SEO plugin (RankMath/Yoast/AIOSEO)          │
└─────────────────────────────────────────────────────────────────────────┘
```

### API Endpoints for Meta

```javascript
// SAVE SELECTION (no WordPress push)
POST /api/seo/select/:articleId
{
  selectedMetaTitle: "Hendersonville TN Standard Cleaners | Fresh Start",
  selectedMetaDescription: "Standard cleaning in Hendersonville..."
}
// Updates: selected_meta_title, selected_meta_description, meta_seo_status='selected'

// PUSH TO WORDPRESS SEO PLUGIN
POST /api/seo/push-direct
{
  wpUrl: "https://target-site.com",
  wpUser: "admin",
  wpPassword: "xxxx xxxx xxxx xxxx",
  postId: 12345,  // WordPress page ID
  metaTitle: "Selected title",
  metaDescription: "Selected description",
  seoPlugin: "rankmath",  // or "yoast" or "aioseo"
  postType: "pages",
  articleId: 67,
  isManualPush: true
}
// Updates: meta_seo_status='pushed', meta_pushed_at=NOW()
```

---

## 🖼️ IMAGE MANAGEMENT UI - DETAILED SPEC

### Article Images Section

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ARTICLE IMAGES (4)                                    [Push All to WP] │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐│   │
│  │  │             │  │             │  │             │  │         ││   │
│  │  │   [IMAGE]   │  │   [IMAGE]   │  │   [IMAGE]   │  │ [IMAGE] ││   │
│  │  │    HERO     │  │  SECTION 1  │  │  SECTION 2  │  │SECTION 3││   │
│  │  │             │  │             │  │             │  │         ││   │
│  │  ├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────┤│   │
│  │  │ ✓ Pushed    │  │ ○ Not pushed│  │ ○ Not pushed│  │✓ Pushed ││   │
│  │  ├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────┤│   │
│  │  │[Replace]    │  │[Replace]    │  │[Replace]    │  │[Replace]││   │
│  │  │[Push to WP] │  │[Push to WP] │  │[Push to WP] │  │[Push]   ││   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘│   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  NO IMAGES YET?                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │         [Generate Images from Image Bank]                        │   │
│  │         [Generate New Images Live]                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Image Button Actions

```javascript
// PUSH ALL IMAGES TO WORDPRESS
// File: ArticleManager.tsx line 591-641
// BUG: Currently calls wrong endpoint

// CORRECT IMPLEMENTATION:
POST /api/articles/${articleId}/push-images  // ← articleId in URL
{
  postId: article.wp_post_id,
  images: article.generated_images,
  wpUrl: website.wp_url,
  wpUser: website.wp_user,
  wpPassword: website.wp_app_password
}

// RESPONSE:
{
  success: true,
  results: [
    { imageId: "img-xxx-hero", status: "success", wpMediaId: 67890 },
    { imageId: "img-xxx-1", status: "success", wpMediaId: 67891 },
    { imageId: "img-xxx-2", status: "skipped", reason: "already pushed" }
  ],
  successCount: 2,
  skippedCount: 1
}

// PUSH SINGLE IMAGE
POST /api/articles/${articleId}/push-images
{
  postId: article.wp_post_id,
  images: [single_image],  // Just one image
  wpUrl, wpUser, wpPassword
}

// REPLACE IMAGE (Regenerate)
POST /api/articles/${articleId}/regenerate-image
{
  imageId: "img-xxx-hero",
  prompt: "Original or modified prompt",
  workflowId: article.workflow_id
}
// Returns: Updated image object with new URL, resets pushedToWp=false

// GENERATE IMAGES FROM SCRATCH
POST /api/articles/${articleId}/generate-images
{
  workflowId: article.workflow_id,
  useImageBank: true,      // Try bank first
  fallbackToLive: true,    // Generate if bank empty
  maxImages: 4,
  avatarTag: article.tag   // Match H/J/C
}
```

---

## 🏗️ SITE PLANNING ARTICLE PAGE - REBUILD SPEC

### Component: PageDetailModal

This replaces ArticleManager for Site Planning. Clean implementation.

```typescript
// File: src/components/SitePlanningSection.tsx (new modal)

interface PageDetailModalProps {
  node: SitePlanNode;
  article: Article | null;  // null if not generated yet
  workflow: Workflow;
  website: Website;
  onClose: () => void;
  onRefresh: () => void;
}

// STATE:
const [article, setArticle] = useState<Article | null>(null);
const [viewMode, setViewMode] = useState<'content' | 'images' | 'meta'>('content');

// Meta selection state
const [selectedTitleIndex, setSelectedTitleIndex] = useState<number>(-1);
const [selectedDescIndex, setSelectedDescIndex] = useState<number>(-1);
const [customMetaTitle, setCustomMetaTitle] = useState('');
const [customMetaDesc, setCustomMetaDesc] = useState('');

// Image state
const [pushingImages, setPushingImages] = useState(false);
const [pushingSingleImage, setPushingSingleImage] = useState<string | null>(null);
const [regeneratingImage, setRegeneratingImage] = useState<string | null>(null);

// Loading states
const [generatingContent, setGeneratingContent] = useState(false);
const [generatingImages, setGeneratingImages] = useState(false);
const [publishing, setPublishing] = useState(false);
```

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PAGE DETAIL: Standard Cleaning(H)                               [X]    │
│  Status: Draft  |  Word Count: 1,247  |  AI Score: 30.3%               │
├─────────────────────────────────────────────────────────────────────────┤
│  [Content] [Images] [Meta SEO]                    [Edit] [Publish to WP]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─ CONTENT TAB ─────────────────────────────────────────────────────┐ │
│  │  [Article HTML Preview]                                           │ │
│  │                                                                   │ │
│  │  # Standard Cleaning Hendersonville TN                           │ │
│  │                                                                   │ │
│  │  In Hendersonville, TN, busy families and professionals trust    │ │
│  │  standard cleaning to keep homes fresh without the hassle...     │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌─ IMAGES TAB ──────────────────────────────────────────────────────┐ │
│  │  [Image Grid with Push/Replace buttons per image]                │ │
│  │  [Push All to WP] [Generate from Bank] [Generate Live]           │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌─ META SEO TAB ────────────────────────────────────────────────────┐ │
│  │  META TITLES:                                                     │ │
│  │  ○ Option 1  ● Option 2 (selected)  ○ Custom: [____]             │ │
│  │                                                                   │ │
│  │  META DESCRIPTIONS:                                               │ │
│  │  ● Option 1 (selected)  ○ Option 2  ○ Custom: [____]             │ │
│  │                                                                   │ │
│  │  [Save Selection] [Push to WordPress SEO]                        │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌─ STATUS BAR ──────────────────────────────────────────────────────┐ │
│  │  Content: ✓ Generated  Images: ○ 0/4 pushed  Meta: ○ Not pushed │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 WHAT WAS WORKING VS BROKEN (ArticleManager)

### ✅ WORKING:
1. **Article content display** - Renders HTML correctly
2. **Meta generation** - Creates options array from prompt output
3. **Meta saving** - POST /api/seo/select/:articleId works
4. **Meta pushing** - POST /api/seo/push-direct works
5. **Image generation** - All models (Flux, GPT, Seedream) work
6. **Test WordPress upload** - base64 → wpUrl conversion works
7. **Image Bank storage** - CRUD operations work
8. **Image regeneration** - POST /api/articles/:id/regenerate-image works
9. **Elementor page building** - Creates valid Elementor JSON

### ❌ BROKEN:
1. **Image push endpoint** - Frontend calls `/api/articles/push-images` but backend expects `/api/articles/:articleId/push-images`
2. **Meta selection UI** - Radio buttons and custom input never implemented
3. **Image display in article** - `generated_images` column was missing (now added)
4. **image_decision_report** - Field exists but never populated

---

## 🔧 IMPLEMENTATION PHASES FOR SITE PLANNING

### Phase 1: Load Keywords to Workflow
- Add "Load to Workflow" button in Site Planning
- Export selected nodes as items with tags
- Pass sitePlanNodeId for linking back

### Phase 2: Article-Node Linking
- After article saves, update node.assigned_article_id
- Update node.status to 'built'

### Phase 3: PageDetailModal (NEW)
- Create clean modal component in SitePlanningSection
- Content preview tab
- Images tab with correct endpoint calls:
  - `POST /api/articles/${articleId}/push-images` (NOT /api/articles/push-images)
- Meta SEO tab with:
  - Radio button selection for titles
  - Radio button selection for descriptions
  - Custom text input option
  - Save and Push buttons

### Phase 4: Hierarchical WordPress Publishing
- Resolve parent node's wp_page_id
- Pass parent to WordPress API for hierarchy

### Phase 5: Image Generation from Page
- "Generate Images" button when article has no images
- Use existing image-pipeline with article.tag for matching
- Store in article.generated_images

---

## 📁 FILES TO CREATE/MODIFY

### NEW FILES:
```
src/components/PageDetailModal.tsx       # Clean article view for Site Planning
```

### MODIFY FILES:
```
src/components/SitePlanningSection.tsx   # Add modal trigger, node selection
App.tsx                                   # Accept sitePlanNodeId on items
server/routes/articles.js                 # Add sitePlanNodeId linking
server/routes/elementor.js                # Accept parentWpPageId parameter
```

### REFERENCE FILES (Don't Modify, Just Copy Patterns):
```
src/components/ArticleManager.tsx        # Copy meta/image state patterns
server/routes/image-creation.js          # Image generation endpoints
server/services/wordpress-publisher.js   # WP upload functions
server/routes/seo.js                     # Meta push endpoints
```

---

## ✅ PRE-IMPLEMENTATION CHECKLIST

- [x] generated_images column added to articles table
- [x] Page type edit bug fixed (camelCase transform)
- [x] Modal overlap issue fixed (z-index)
- [x] Image pipeline fully documented
- [x] Meta mechanism fully documented
- [x] API endpoint mismatch identified (image push)
- [ ] PageDetailModal component created
- [ ] Correct image push endpoint used
- [ ] Meta selection UI implemented
- [ ] Node-article linking implemented
- [ ] Hierarchical publishing implemented
