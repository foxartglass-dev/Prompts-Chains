# Agent OS Context: PromptFlow - Site Planning → Workflow Integration

## Project: PromptFlow SEO Content Automation System

---

## 📋 STANDARDS LAYER

### Technology Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Express.js + Node.js (ES Modules)
- **Database**: PostgreSQL via Neon Serverless (`@neondatabase/serverless`)
- **AI Providers**:
  - Anthropic Claude (primary content generation)
  - OpenAI GPT-4o / GPT-Image-1.5 (image prompts, image generation)
  - Google Gemini (alternative)
  - Replicate Flux (image generation)
- **CMS Integration**: WordPress REST API + Elementor Page Builder

### Coding Conventions
- **Style**: Functional components with hooks (React)
- **State Management**: React useState/useEffect (no Redux)
- **API Pattern**: Express Router with async/await
- **Database**: Raw SQL via Neon `sql` template literals
- **Naming**:
  - Frontend: camelCase for variables/functions
  - Backend API expects: camelCase in request body
  - Database: snake_case for columns
  - **CRITICAL**: Always transform snake_case ↔ camelCase at API boundaries

### File Organization
```
/home/user/Prompts-Chains/
├── src/
│   ├── components/
│   │   ├── SitePlanningSection.tsx    # Site hierarchy management
│   │   ├── ArticleManager.tsx         # Article detail view (legacy)
│   │   └── ImageCreationSection.tsx   # Image generation UI
│   └── App.tsx                        # Main app with workflow engine
├── server/
│   ├── routes/
│   │   ├── site-planning.js           # Site plan CRUD
│   │   ├── elementor.js               # WordPress/Elementor publishing
│   │   ├── articles.js                # Article CRUD
│   │   └── workflows.js               # Workflow management
│   └── db/
│       ├── index.js                   # Database connection
│       ├── schema.sql                 # Full schema reference
│       └── setup-all.mjs              # Migration runner
```

### Key Patterns

#### 1. Prompt Chain Workflow Engine (App.tsx)
The workflow engine processes items through a chain of prompts:
```typescript
// Workflow state structure
interface WorkflowState {
  prompts: Prompt[];           // Chain of prompts to execute
  placeholders: Placeholder[]; // Variables like {city_state}, {main_category}
  tags: string[];              // H, J, C for audience segmentation
  snippets: ConditionalSnippet[]; // Content that swaps based on tag
}

// Processing flow:
// 1. Load keywords into "Loaded Items" (Section 2)
// 2. Keywords tagged with (H), (J), or (C) suffix
// 3. Tags trigger conditional snippet replacement
// 4. Placeholders filled from global variables
// 5. Each prompt in chain executes sequentially
// 6. Outputs stored with keys: {12_PAA}, {Service_Page_Outline}, {Service_Page_Article}
```

#### 2. Tagging System (H/J/C)
```typescript
// Tag determines which conditional snippets are used
// Example keyword: "Standard Cleaning(H)"
// - H = House Cleaning audience
// - J = Janitorial audience
// - C = Construction Site audience

// Conditional snippets auto-swap content based on tag:
interface ConditionalSnippet {
  name: string;           // e.g., "secondary_category"
  tagH: string;           // "House Cleaning Service"
  tagJ: string;           // "Janitorial Cleaning Service"
  tagC: string;           // "Construction Site Cleaning"
}
```

#### 3. Image Bank Integration
```typescript
// Images flow: Generate → Test WP (get wpUrl) → Image Bank → Target WP
interface ImageBankItem {
  id: string;
  url: string;              // Base64 or permanent URL
  wpUrl?: string;           // WordPress media URL (permanent)
  wpMediaId?: number;       // WordPress media library ID
  title?: string;
  category?: string;
  variation_name?: string;
  avatar_tag?: string;      // H, J, or C
  orientation: 'vertical' | 'horizontal';
  prompt?: string;
  used: boolean;
}
```

### Database Schema (Key Tables)

#### site_plan_nodes
```sql
CREATE TABLE site_plan_nodes (
  id SERIAL PRIMARY KEY,
  site_plan_id INTEGER REFERENCES site_plans(id),
  parent_id INTEGER REFERENCES site_plan_nodes(id),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255),
  page_type VARCHAR(50) DEFAULT 'page',  -- page, landing, service, location, category, blog
  status VARCHAR(20) DEFAULT 'planned',   -- planned, in_progress, built, published
  target_keyword VARCHAR(255),
  meta_title VARCHAR(255),
  meta_description TEXT,
  content_brief TEXT,
  assigned_article_id INTEGER REFERENCES articles(id),
  is_pillar_page BOOLEAN DEFAULT false,
  is_in_menu BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  depth INTEGER DEFAULT 0,
  wp_page_id INTEGER,
  wp_post_url VARCHAR(500),
  built_at TIMESTAMP,
  published_at TIMESTAMP
);
```

#### articles
```sql
CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER REFERENCES workflows(id),
  website_id INTEGER REFERENCES websites(id),
  keyword VARCHAR(500) NOT NULL,
  tag VARCHAR(50),                        -- H, J, or C
  final_content TEXT,
  meta_titles JSONB DEFAULT '[]',
  meta_descriptions JSONB DEFAULT '[]',
  chain_outputs JSONB DEFAULT '{}',       -- {12_PAA: "...", Service_Page_Article: "..."}
  generated_images JSONB DEFAULT '[]',    -- Array of ArticleImage
  status VARCHAR(20) DEFAULT 'generated',
  wp_post_id INTEGER,
  wp_post_url VARCHAR(500)
);
```

#### workflows (stores prompt chain configuration)
```sql
CREATE TABLE workflows (
  id SERIAL PRIMARY KEY,
  website_id INTEGER REFERENCES websites(id),
  name VARCHAR(255) NOT NULL,
  state JSONB NOT NULL DEFAULT '{}'       -- Contains prompts, placeholders, tags, snippets
);
```

---

## 🎯 PRODUCT LAYER

### Vision
**Automated Local SEO Content Factory** - Generate hundreds of location-optimized service pages with proper hierarchical structure, automatically targeting ranking opportunities identified by heat map analysis.

### Target Users
- Local service businesses (cleaning, HVAC, plumbing, etc.)
- SEO agencies managing multiple client sites
- Anyone needing to scale local landing page creation

### Core Use Cases

#### 1. Initial Site Build (30 Core Pages)
- Create hierarchical service page structure
- Category pages → Service pages → Location variations
- Each page optimized for local SEO with proper parent/child relationships

#### 2. Sheep Herding Strategy (Ongoing)
- Weekly rank map analysis via Local Viking API
- Identify pages ranking 4-10 (close to 3-pack)
- Generate supporting article content
- Place supporting articles under weak parent pages
- Push weak pages into top 3

#### 3. Neighborhood Expansion
- Heat map shows geographic ranking gaps
- Generate neighborhood-specific landing pages
- Duplicate service structure per neighborhood
- Target hyperlocal keywords

#### 4. AISCO/Programmatic SEO (Future)
- HubSpot-style 350+ page generation
- Template-based mass page creation
- Different content structure than service pages

### Roadmap
- **Phase 1** (Current): Connect Site Planning → existing Workflow
- **Phase 2**: Add "Generate Content" button to Site Planning nodes
- **Phase 3**: Batch generation from Site Planning selection
- **Phase 4**: Local Viking heat map → auto-suggest supporting articles
- **Phase 5**: Full automation pipeline

---

## 🔧 SPECS LAYER

### Feature: Site Planning → Workflow Connection

#### Overview
Enable generating content for Site Planning pages using the existing Prompt Chain workflow system. When a user clicks on a page in Site Planning, they should be able to generate content using their pre-configured prompt chains, then publish with proper WordPress hierarchy.

#### Architecture - CRITICAL TECHNICAL FINDINGS

**IMPORTANT**: The prompt chain logic in App.tsx is **TIGHTLY COUPLED** to React UI state.
Cannot simply extract and reuse. Instead, Site Planning must **FEED INTO** the existing workflow.

```
┌─────────────────────────────────────────────────────────────────┐
│                     SITE PLANNING UI                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ • Cleaners Hendersonville (Category)                      │   │
│  │   • House Cleaning Service(H) (Landing) ← PILLAR         │   │
│  │     • Standard Cleaning(H) (Service) ← [Load to Workflow] │   │
│  │     • Deep Cleaning(H) (Service)                         │   │
│  │     • Move In/Out Cleaning(H) (Service)                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
        [Export nodes as keyword list with tags]
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│            EXISTING WORKFLOW ENGINE (App.tsx)                    │
│  Section 2: Loaded Items ← Keywords from Site Planning          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Standard Cleaning(H)  ← Loaded with tag preserved         │   │
│  │ Deep Cleaning(H)                                          │   │
│  │ Move In/Out Cleaning(H)                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│         [Existing processWorkflow() runs]                        │
│                              │                                   │
│  • fillPrompt() replaces variables                              │
│  • generateLlmContent() calls AI                                │
│  • parseFinalOutput() extracts meta                             │
│  • checkAiScore() validates                                     │
│  • Article saved to database                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
        [Article created with workflow_id]
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│             LINK BACK TO SITE PLANNING                           │
│  1. Match article.keyword to site_plan_node.title               │
│  2. Update node.assigned_article_id = article.id                │
│  3. Update node.status = 'built'                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 WORDPRESS PUBLISHING                             │
│  [Existing elementor.js flow with ONE addition:]                │
│  • Pass parent node's wp_page_id for hierarchy                  │
│  • Create page with parent: parentNode.wp_page_id               │
└─────────────────────────────────────────────────────────────────┘
```

#### KEY TECHNICAL CONSTRAINTS DISCOVERED

**1. Two fillPrompt() Implementations Exist:**
```
App.tsx:896-924         → Uses <item_name> syntax
engine/prompt-filler.ts → Uses {item_name} syntax, has random [[{opt1}or{opt2}]]
```
The App.tsx version is what's actually used in batch processing.

**2. Tag Validation Happens LATE:**
- Tags extracted from item name via regex: `/\(([^)]+)\)/`
- If tag doesn't exist in `workflow.state.tags`, entire item FAILS
- No preview or pre-validation before batch starts
- **Site Planning MUST validate tags before loading**

**3. Meta Parsing Requires Specific Format:**
```
---META TITLES---
1. Title
2. Title

---META DESCRIPTIONS---
1. Description
```
If prompt output doesn't include these markers → empty arrays.
Alternative: Set `prompt.generateMetaFromOutput = true` for separate LLM call.

**4. Image Bank Filtering:**
- Only images with `wpUrl` (WordPress URL) are used
- Base64 `data:image/...` URLs are SKIPPED
- Images must be pre-uploaded to WordPress to be available

**5. Model × Items = Cartesian Product:**
- If 3 models active and 10 items → 30 generations
- Cannot mix models within single prompt chain
- Must duplicate workflow to use different models per chain

**6. chain_outputs Only Persists for Completed Articles:**
- Pending/option-variable results don't save immediately
- Cannot query partial chain progress

#### Requirements

##### Functional Requirements
1. **FR-1**: Add "Generate Content" button to Site Planning node actions
2. **FR-2**: Extract keyword and tag from node title (e.g., "Standard Cleaning(H)" → keyword="Standard Cleaning", tag="H")
3. **FR-3**: Run extracted keyword through existing workflow prompt chain
4. **FR-4**: Store generated content in new article record linked to node
5. **FR-5**: Display generation progress in Processing Log
6. **FR-6**: Show content preview in expanded node detail view
7. **FR-7**: Add "Publish to WP" button that uses parent node's wp_page_id for hierarchy
8. **FR-8**: Support batch generation (select multiple nodes → generate all)

##### Technical Requirements
1. **TR-1**: Reuse existing prompt chain processing logic from App.tsx
2. **TR-2**: Create new API endpoint: `POST /api/site-planning/nodes/:nodeId/generate`
3. **TR-3**: Create new API endpoint: `POST /api/site-planning/nodes/:nodeId/publish`
4. **TR-4**: Store article reference in `site_plan_nodes.assigned_article_id`
5. **TR-5**: Handle image generation using existing Image Bank matching
6. **TR-6**: Maintain WordPress parent/child page hierarchy via `parent` parameter

#### API Specifications

##### POST /api/site-planning/nodes/:nodeId/generate
```typescript
// Request
{
  workflowId: number;          // Which workflow's prompt chain to use
  includeImages?: boolean;     // Whether to generate/match images
  imageCount?: number;         // Number of images (default from workflow settings)
}

// Response
{
  success: boolean;
  article: {
    id: number;
    keyword: string;
    tag: string;
    final_content: string;
    meta_titles: string[];
    meta_descriptions: string[];
    chain_outputs: Record<string, string>;
    generated_images: ArticleImage[];
  };
  node: {
    id: number;
    assigned_article_id: number;
    status: 'built';
  };
}
```

##### POST /api/site-planning/nodes/:nodeId/publish
```typescript
// Request
{
  status?: 'draft' | 'publish';  // WordPress status
  selectedMetaTitle?: string;
  selectedMetaDescription?: string;
}

// Response
{
  success: boolean;
  page: {
    id: number;              // WordPress page ID
    link: string;            // WordPress page URL
  };
  node: {
    id: number;
    wp_page_id: number;
    wp_post_url: string;
    status: 'published';
  };
}
```

#### UI Components to Add

##### 1. Node Action Buttons (SitePlanningSection.tsx)
```tsx
// Add to node row, visible on hover
<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
  {!node.assigned_article_id && (
    <button
      onClick={() => generateContent(node.id)}
      className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
      title="Generate content using workflow"
    >
      Generate
    </button>
  )}
  {node.assigned_article_id && !node.wp_page_id && (
    <button
      onClick={() => publishNode(node.id)}
      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
      title="Publish to WordPress"
    >
      Publish
    </button>
  )}
  {node.assigned_article_id && (
    <button
      onClick={() => viewContent(node.id)}
      className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs"
      title="View generated content"
    >
      View
    </button>
  )}
</div>
```

##### 2. Content Preview Modal
```tsx
// Show when clicking "View" on a node with content
interface ContentPreviewModalProps {
  node: SitePlanNode;
  article: Article;
  onClose: () => void;
  onPublish: () => void;
  onRegenerate: () => void;
}

// Displays:
// - Generated article content (rendered HTML)
// - Meta title options (radio select)
// - Meta description options (radio select)
// - Generated images grid
// - Publish button
// - Regenerate button
```

##### 3. Batch Generation Panel
```tsx
// Floating action bar when multiple nodes selected
<div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-800 rounded-lg p-4 shadow-xl">
  <span>{selectedNodes.length} pages selected</span>
  <button onClick={batchGenerate}>Generate All</button>
  <button onClick={batchPublish}>Publish All</button>
  <button onClick={clearSelection}>Clear</button>
</div>
```

#### Data Flow

##### Generation Flow
```
1. User clicks "Generate" on node "Standard Cleaning(H)"
2. Frontend calls: POST /api/site-planning/nodes/123/generate
   Body: { workflowId: 5, includeImages: true }

3. Backend:
   a. Fetch node from site_plan_nodes
   b. Extract: keyword="Standard Cleaning", tag="H"
   c. Fetch workflow state (prompts, placeholders, snippets)
   d. Apply tag-based snippet replacement
   e. Execute each prompt in chain via AI provider
   f. Collect outputs: {12_PAA, Service_Page_Outline, Service_Page_Article}
   g. Generate meta titles/descriptions
   h. Match/generate images based on tag
   i. Create article record with all data
   j. Update node.assigned_article_id
   k. Return article + updated node

4. Frontend updates UI to show "View" and "Publish" buttons
```

##### Publishing Flow
```
1. User clicks "Publish" on node with content
2. Frontend calls: POST /api/site-planning/nodes/123/publish
   Body: { status: 'publish' }

3. Backend:
   a. Fetch node with article
   b. Fetch parent node to get wp_page_id for hierarchy
   c. Build Elementor JSON with content + images
   d. Call WordPress REST API:
      POST /wp-json/wp/v2/pages
      Body: { title, content, status, parent: parentNode.wp_page_id }
   e. Upload images to WordPress media library
   f. Update Elementor data with image widget IDs
   g. Update node: wp_page_id, wp_post_url, status
   h. Update article: wp_post_id, wp_post_url
   i. Return success with WordPress page info

4. Frontend updates node to show "Published" status with link
```

#### Edge Cases

1. **Node without tag suffix**: Default to first workflow or prompt user to select
2. **Parent not published**: Warn user, offer to publish parent first
3. **Workflow not selected**: Show workflow picker modal
4. **Image Bank empty**: Fall back to live image generation
5. **Generation fails mid-chain**: Save partial progress, allow retry
6. **WordPress API fails**: Queue for retry, show error state

#### Success Metrics
- Generate content for a page in < 90 seconds
- Publish to WordPress in < 30 seconds
- Support batch generation of 20+ pages
- Zero manual copy/paste required
- Proper parent/child hierarchy in WordPress

#### Implementation Order (REVISED Based on Technical Analysis)

**KEY INSIGHT**: Don't replicate processWorkflow() - it's too coupled to UI state.
Instead, make Site Planning a **LOADER** for the existing workflow system.

**Phase 1: Site Planning → Workflow Loader**
```
Goal: Select nodes in Site Planning → Load as items into Section 2 (Loaded Items)
```
- Add "Load to Workflow" button to Site Planning
- Export selected nodes as keyword list with tags preserved
- Load into existing workflow's "Loaded Items" section
- Store site_plan_node_ids in workflow processing context
- Files: `SitePlanningSection.tsx`, `App.tsx` (loadItems function)

**Phase 2: Article → Node Linking**
```
Goal: When article saves, auto-link back to originating site_plan_node
```
- Pass site_plan_node_id through article save flow
- Update node.assigned_article_id after article creation
- Update node.status = 'built'
- Files: `App.tsx` (saveArticle), `server/routes/articles.js`

**Phase 3: Hierarchical WordPress Publishing**
```
Goal: Publish with proper parent/child relationships
```
- When publishing from Site Planning, resolve parent node's wp_page_id
- Pass parent ID to elementor.js publish endpoint
- WordPress creates page with `parent: parentWpPageId`
- Files: `server/routes/elementor.js`, `SitePlanningSection.tsx`

**Phase 4: Content Preview in Site Planning**
```
Goal: View generated article content within Site Planning UI
```
- Add "View Content" button on nodes with assigned_article_id
- Fetch article data and display in modal
- Show meta options, images, content preview
- Files: `SitePlanningSection.tsx` (new modal component)

**Phase 5: Batch Selection UI**
```
Goal: Select multiple nodes and load all to workflow at once
```
- Add checkbox multi-select to node tree
- "Load Selected to Workflow" button
- Progress tracking in Processing Log
- Files: `SitePlanningSection.tsx`

#### WHAT NOT TO DO (Avoid These Traps)

❌ **Don't create `/api/site-planning/nodes/:nodeId/generate`**
   - Would require duplicating processWorkflow() logic
   - Creates maintenance divergence
   - fillPrompt(), model handling, scoring all tightly coupled

❌ **Don't extract prompt chain into separate module**
   - Too many React state dependencies (setResults, setLogs, etc.)
   - Option variable UI flow is integrated
   - Would break existing functionality

❌ **Don't create custom chain_outputs format**
   - Must match article schema exactly
   - Downstream systems depend on structure

✅ **DO: Use existing workflow as-is, just feed it from Site Planning**

---

## 🎬 CURRENT TASK

**Ready for implementation.** This spec covers connecting Site Planning nodes to the existing Workflow prompt chain system with proper WordPress hierarchy publishing.

**Starting point**: Phase 1 - Single Node Generation
- Add "Generate" button to SitePlanningSection.tsx
- Create backend endpoint that reuses App.tsx prompt chain logic
- Link generated article to site_plan_node

---

## 📚 REFERENCE FILES

When implementing, read these files for existing patterns:

1. **App.tsx** (lines 900-1400): Prompt chain processing logic
2. **SitePlanningSection.tsx**: Current Site Planning UI
3. **server/routes/elementor.js** (lines 1-500): WordPress publishing logic
4. **server/routes/site-planning.js**: Existing Site Planning API
5. **server/routes/articles.js**: Article CRUD operations

---

## ✅ PRE-IMPLEMENTATION CHECKLIST

- [x] Page type edit bug fixed (camelCase transform)
- [x] Modal overlap issue fixed (z-index)
- [x] generated_images column exists in database
- [x] Existing workflow system documented
- [x] API specifications defined
- [x] UI component requirements defined
- [ ] Implementation Phase 1 started
