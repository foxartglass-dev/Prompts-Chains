# Agent OS Blueprint: AI Image Generation System

## Overview

This blueprint extends the existing WordPress Elementor Flow with automatic AI image generation. Images are generated using FLUX 1.1 Pro (via Replicate) with prompts crafted by GPT-4o-mini based on article content and a pre-configured "Style DNA".

---

## 1. STANDARDS LAYER

### Technology Stack
- **Runtime**: Node.js 18+ (matches existing server)
- **API Framework**: Express.js (existing)
- **LLM for Prompting**: OpenAI GPT-4o-mini (text analysis, prompt crafting)
- **Image Generation**: FLUX 1.1 Pro via Replicate API
- **Image Hosting**: WordPress Media Library (upload via REST API)

### Design Patterns
- **Service Architecture**: Separate services for each concern
  - `image-prompt-generator.js` - GPT-4o-mini integration for Style DNA and action extraction
  - `image-generator.js` - Replicate FLUX integration
  - `image-pipeline.js` - Orchestrates the full flow
- **Async/Await**: All external API calls use async patterns
- **Error Handling**: Graceful degradation if image generation fails
- **Caching**: Style DNA cached per website/project

### File Structure
```
server/
├── services/
│   ├── content-chunker.js      # EXISTING - chunks articles
│   ├── elementor-builder.js    # EXISTING - builds Elementor JSON
│   ├── wordpress-publisher.js  # EXISTING - publishes to WP
│   ├── image-prompt-generator.js  # NEW - GPT-4o-mini prompting
│   ├── image-generator.js         # NEW - FLUX via Replicate
│   └── image-pipeline.js          # NEW - orchestrates image flow
├── routes/
│   ├── elementor.js            # MODIFY - add image options
│   └── images.js               # NEW - image generation endpoints
└── index.js                    # MODIFY - register images router
```

---

## 2. PRODUCT LAYER

### Vision
Transform AI-generated articles into visually stunning Elementor pages with contextually relevant, brand-consistent images. The system generates 3-4 images per article:
- 1 Hero image (top of page)
- 2-3 Inline images (alternating left/right alignment within text)

### User Experience Flow

1. **Style DNA Setup** (one-time per website/project)
   - User uploads 3-5 reference images that represent their desired visual style
   - System analyzes images using GPT-4o-mini Vision
   - Extracts style attributes: color palette, mood, composition, artistic style
   - Saves as "Style DNA" template for all future generations

2. **Article Publishing with Images**
   - User clicks "Publish Elementor Page" on an article
   - System chunks the article (existing)
   - For each chunk needing an image:
     - GPT-4o-mini extracts the key "action" or concept
     - Combines action with Style DNA to create FLUX prompt
     - FLUX 1.1 Pro generates the image
   - Images uploaded to WordPress Media Library
   - Elementor page built with images embedded
   - Page published to WordPress

### Key Features

#### Style DNA Modes
- **Mode A: Per-Image Analysis** - Upload specific images, system uses them as direct style references
- **Mode B: Style Extraction** - Upload references once, system extracts reusable style template with `{keyword}` placeholder

#### Image Placement Strategy
- Hero image: Abstract/atmospheric, represents overall article theme
- Inline images: More literal, action-oriented based on section content
- Alternating alignment: First inline left, second right, third left (creates visual rhythm)

### Settings (Website/Project Level)
```
Image Generation:
├── Enabled: true/false
├── Provider: "flux" (future: "stability", "dalle", "midjourney")
├── API Key: Replicate API token
├── Images Per Article: 3-4 (default: 4)
├── Style DNA Mode: "extraction" | "per-image"
├── Style DNA Template: saved prompt template
├── Reference Images: array of uploaded image URLs
└── Override Prompts: optional manual prompt overrides
```

---

## 3. SPECIFICATION LAYER

### 3.1 Service: `image-prompt-generator.js`

#### Purpose
Uses GPT-4o-mini to:
1. Analyze reference images and extract Style DNA
2. Parse article sections to identify key "actions" for images
3. Combine Style DNA + actions into FLUX-optimized prompts

#### API

```javascript
// Extract style DNA from reference images
async function extractStyleDNA(referenceImages, options = {}) {
  // referenceImages: array of { url, description? }
  // Returns: { styleTemplate, attributes, rawAnalysis }
}

// Extract action/concept from article section
async function extractAction(sectionContent, context = {}) {
  // sectionContent: text of one article section
  // context: { articleTitle, keyword, previousActions }
  // Returns: { action, mood, subjects, setting }
}

// Build final FLUX prompt
function buildFluxPrompt(styleDNA, action, imageType = 'inline') {
  // Combines style template with action
  // imageType: 'hero' | 'inline'
  // Returns: string prompt for FLUX
}
```

#### Style DNA Extraction Prompt
```
Analyze these reference images and extract a reusable style template.

Focus on:
1. Color palette (specific hex codes if identifiable)
2. Lighting style (natural, dramatic, soft, etc.)
3. Composition patterns (centered, rule of thirds, etc.)
4. Artistic style (photorealistic, illustration, 3D render, etc.)
5. Mood/atmosphere keywords
6. Recurring visual elements

Output a prompt template with {ACTION} placeholder where the specific
scene/action would be inserted. The template should be optimized for
FLUX 1.1 Pro image generation.

Example output format:
{
  "styleTemplate": "Professional photography of {ACTION}, warm golden hour lighting,
    shallow depth of field, modern minimalist composition, clean white background
    with subtle shadows, high-end commercial aesthetic",
  "attributes": {
    "colorPalette": ["#F5A623", "#FFFFFF", "#2D3748"],
    "lighting": "golden hour, soft shadows",
    "composition": "centered subject, negative space",
    "style": "commercial photography",
    "mood": "professional, approachable, premium"
  }
}
```

#### Action Extraction Prompt
```
Read this article section and identify the PRIMARY ACTION or concept
that should be visually represented.

Section:
{SECTION_CONTENT}

Article context: {ARTICLE_TITLE}
Business/Topic: {KEYWORD}

Output a concise visual description (max 20 words) that captures:
1. The main action or concept being discussed
2. Any specific objects, people, or settings mentioned
3. The emotional tone of this section

Format: Just the visual description, no JSON needed.
Example: "hands carefully adjusting stained glass panel, workshop setting, focused craftsmanship"
```

### 3.2 Service: `image-generator.js`

#### Purpose
Interfaces with Replicate API to generate images using FLUX 1.1 Pro.

#### API

```javascript
// Generate a single image
async function generateImage(prompt, options = {}) {
  // prompt: FLUX-optimized prompt string
  // options: {
  //   width: 1024,
  //   height: 768,
  //   aspectRatio: '4:3',
  //   numOutputs: 1,
  //   outputFormat: 'webp'
  // }
  // Returns: { url, width, height, prompt }
}

// Generate batch of images (for article)
async function generateArticleImages(prompts, options = {}) {
  // prompts: array of prompt strings
  // options: { parallel: true, onProgress: callback }
  // Returns: array of image results
}
```

#### Replicate Configuration
```javascript
const FLUX_MODEL = "black-forest-labs/flux-1.1-pro";
const DEFAULT_OPTIONS = {
  width: 1024,
  height: 768,
  num_outputs: 1,
  output_format: "webp",
  output_quality: 80,
  aspect_ratio: "4:3",
  safety_tolerance: 2,
  prompt_upsampling: true
};
```

#### Cost Estimate
- FLUX 1.1 Pro: ~$0.04 per image
- 4 images per article: ~$0.16 per article
- GPT-4o-mini for prompting: ~$0.001 per article
- **Total: ~$0.17 per article with images**

### 3.3 Service: `image-pipeline.js`

#### Purpose
Orchestrates the full image generation flow, integrating with existing content chunker and Elementor builder.

#### API

```javascript
// Generate images for chunked article
async function generateImagesForArticle(chunks, options = {}) {
  // chunks: output from content-chunker.js
  // options: {
  //   styleDNA: saved style template,
  //   keyword: article keyword,
  //   title: article title,
  //   heroImage: true,
  //   inlineImages: true,
  //   maxImages: 4
  // }
  // Returns: chunks with imageData filled in
}

// Full pipeline: article content → chunks with images
async function processArticleWithImages(content, options = {}) {
  // Chunks content, generates images, returns ready-for-Elementor data
}
```

#### Pipeline Flow
```
Article Content
      │
      ▼
┌─────────────────┐
│ Content Chunker │ ← Existing service
└────────┬────────┘
         │
         ▼
   chunks[] with imageData: null
         │
         ▼
┌─────────────────────┐
│ Action Extraction   │ ← GPT-4o-mini per chunk
│ (parallel)          │
└────────┬────────────┘
         │
         ▼
   actions[] for each chunk
         │
         ▼
┌─────────────────────┐
│ Prompt Assembly     │ ← Combine Style DNA + Action
└────────┬────────────┘
         │
         ▼
   prompts[] for FLUX
         │
         ▼
┌─────────────────────┐
│ Image Generation    │ ← FLUX 1.1 Pro (parallel)
└────────┬────────────┘
         │
         ▼
   imageUrls[] from Replicate
         │
         ▼
┌─────────────────────┐
│ WordPress Upload    │ ← Upload to Media Library
└────────┬────────────┘
         │
         ▼
   wpMediaUrls[] (permanent)
         │
         ▼
┌─────────────────────┐
│ Elementor Builder   │ ← Build page with images
└────────┬────────────┘
         │
         ▼
   Elementor JSON with images embedded
```

### 3.4 API Routes: `routes/images.js`

```javascript
// POST /api/images/extract-style-dna
// Extract style DNA from reference images
router.post('/extract-style-dna', async (req, res) => {
  const { referenceImages, websiteId } = req.body;
  // Returns: { styleDNA, attributes }
});

// POST /api/images/preview-prompts
// Generate prompts without creating images (for testing)
router.post('/preview-prompts', async (req, res) => {
  const { content, styleDNA } = req.body;
  // Returns: { prompts, actions, chunks }
});

// POST /api/images/generate
// Generate a single image
router.post('/generate', async (req, res) => {
  const { prompt, options } = req.body;
  // Returns: { url, width, height }
});

// POST /api/images/generate-for-article
// Full pipeline for an article
router.post('/generate-for-article', async (req, res) => {
  const { content, styleDNA, keyword, options } = req.body;
  // Returns: { chunks: chunksWithImages, images: [] }
});
```

### 3.5 Modifications to Existing Routes

#### `routes/elementor.js` - Enhanced `/publish`

Add image generation options:
```javascript
router.post('/publish', async (req, res) => {
  const {
    // Existing options...
    content, title, wpUrl, wpUser, wpPassword,

    // NEW: Image generation options
    generateImages = false,
    styleDNA = null,
    openaiApiKey = null,
    replicateApiKey = null,
    maxImages = 4
  } = req.body;

  if (generateImages && styleDNA) {
    // Run image pipeline
    const chunksWithImages = await generateImagesForArticle(chunks, {
      styleDNA,
      openaiApiKey,
      replicateApiKey,
      wpCredentials,
      maxImages
    });
    // Build Elementor with images
  }
});
```

### 3.6 Database Schema Updates

```sql
-- Add to websites table
ALTER TABLE websites ADD COLUMN IF NOT EXISTS image_style_dna JSONB DEFAULT '{}';
ALTER TABLE websites ADD COLUMN IF NOT EXISTS image_reference_urls JSONB DEFAULT '[]';

-- Track generated images per article
ALTER TABLE articles ADD COLUMN IF NOT EXISTS generated_images JSONB DEFAULT '[]';
-- Format: [{ url, prompt, placement, wpMediaId }]
```

### 3.7 Frontend Integration Points

#### Settings UI (Website Settings)
- Toggle: "Enable AI Image Generation"
- API Key input: Replicate API Key
- API Key input: OpenAI API Key (for GPT-4o-mini)
- Reference Image uploader (3-5 images)
- "Extract Style DNA" button
- Style DNA preview/edit textarea

#### Article Publish UI
- Checkbox: "Generate Images" (if enabled at website level)
- Preview: Show extracted actions before generating
- Progress: Show image generation progress
- Result: Display generated images with Elementor preview

---

## 4. IMPLEMENTATION PLAN

### Phase 2a: Core Infrastructure
1. Create `server/services/image-generator.js` - Replicate FLUX integration
2. Create `server/services/image-prompt-generator.js` - GPT-4o-mini integration
3. Create `server/routes/images.js` - API endpoints
4. Update `server/index.js` - Register new router

### Phase 2b: Style DNA System
1. Implement `extractStyleDNA()` with GPT-4o-mini Vision
2. Add Style DNA storage to website settings
3. Create reference image upload endpoint

### Phase 2c: Action Extraction
1. Implement `extractAction()` for section analysis
2. Implement `buildFluxPrompt()` for prompt assembly
3. Test prompt quality with sample articles

### Phase 2d: Pipeline Integration
1. Create `server/services/image-pipeline.js`
2. Modify content chunker to support image slots
3. Modify Elementor builder for image embedding
4. Update `/api/elementor/publish` with image options

### Phase 2e: WordPress Media Integration
1. Implement image upload to WP Media Library
2. Store permanent URLs in article record
3. Handle upload failures gracefully

### Phase 2f: Frontend (Optional)
1. Add image generation toggle to publish flow
2. Add Style DNA configuration UI
3. Add generation progress indicator

---

## 5. ENVIRONMENT VARIABLES

```bash
# Required for image generation
OPENAI_API_KEY=sk-...          # For GPT-4o-mini prompting
REPLICATE_API_TOKEN=r8_...     # For FLUX 1.1 Pro generation

# Optional defaults
DEFAULT_IMAGES_PER_ARTICLE=4
FLUX_MODEL_VERSION=black-forest-labs/flux-1.1-pro
```

---

## 6. ERROR HANDLING

| Error | Handling |
|-------|----------|
| GPT-4o-mini API failure | Use fallback generic prompt |
| FLUX generation failure | Skip image, log error, continue |
| WP upload failure | Store temp URL, retry on next publish |
| Style DNA not configured | Warn user, publish without images |
| Rate limiting | Exponential backoff, queue system |

---

## 7. TESTING CHECKLIST

- [ ] Style DNA extraction produces usable prompt templates
- [ ] Action extraction captures meaningful section concepts
- [ ] FLUX prompts generate relevant, high-quality images
- [ ] Images upload successfully to WordPress
- [ ] Elementor pages display images correctly
- [ ] Failed image generation doesn't break page publishing
- [ ] Cost tracking is accurate

---

## Ready for Implementation

This blueprint provides complete specifications for adding AI image generation to the existing Elementor flow. The modular service architecture allows for:
- Easy testing of individual components
- Swapping image providers (FLUX → Stability → DALL-E)
- Future enhancements (before/after sections, stats bars)

**Estimated Implementation Time**: Implementation follows Phase 2a → 2f progression
**Estimated Cost per Article**: ~$0.17 (4 images + GPT-4o-mini prompting)
