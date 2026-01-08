# Image System Handoff Document

## Current Issue
Images are not being saved to articles in draft mode. The Processing Log shows:
- "Processing images..."
- "Preparing images from Image Bank..."
- "WordPress publish failed: Unknown error"

The system appears to be trying to publish to WordPress even when in draft mode, and images aren't being saved to the article record.

---

## System Architecture Overview

### The Three Toggle Buttons (Publishing to WordPress Section)

Located in `App.tsx` around lines 2796-2873:

| Toggle | Values | Purpose |
|--------|--------|---------|
| **Article** | Draft / WP | Controls whether article content is published to WordPress |
| **Meta** | Draft / WP | Controls whether SEO meta is pushed to WordPress |
| **Image** | Off / Draft / WP | Controls image processing behavior |

**Draft Mode Expected Behavior:**
- Article: Draft → Save to database, don't create WP page
- Meta: Draft → Generate meta, save to DB, don't push to WP
- Image: Draft → Match/generate images, save to article record, don't embed in WP page

---

## Key Files and Their Purposes

### Frontend (React/TypeScript)

| File | Purpose |
|------|---------|
| `App.tsx` | Main app, contains batch processing logic (lines 1033-1375), toggle buttons (lines 2796-2873) |
| `src/components/ImageCreationSection.tsx` | Image Bank UI, avatar management, prompt configuration |
| `src/components/articles/ArticleListView.tsx` | Article display, shows images in Preview/Images tabs |
| `src/components/LogViewer.tsx` | Server logs viewer (Copy All button for debugging) |

### Backend (Node.js/Express)

| File | Purpose |
|------|---------|
| `server/routes/elementor.js` | **MAIN IMAGE FLOW** - publish endpoint, image processing, WP page creation |
| `server/services/image-pipeline.js` | Image generation (Flux/GPT), WordPress upload |
| `server/services/console-capture.js` | Captures all console.log for in-app log viewer |
| `server/routes/image-creation.js` | Image Bank CRUD, settings management |
| `server/routes/logs.js` | API for retrieving captured logs |

---

## Image Flow Diagram

```
User clicks "Run" with Image: Draft
            │
            ▼
┌─────────────────────────────────────┐
│  App.tsx - Batch Processing         │
│  Lines 1233-1375                    │
│                                     │
│  Checks: shouldProcessImages?       │
│  (true if Image toggle != 'off')    │
│                                     │
│  Checks: shouldPublishToWP?         │
│  (true if Article toggle = 'WP')    │
└─────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│  POST /api/elementor/publish        │
│  server/routes/elementor.js         │
│                                     │
│  Key parameters sent:               │
│  - generateImages: true/false       │
│  - imageDraftMode: true/false       │
│  - skipWpPageCreation: true/false   │
│  - articleId: for saving images     │
└─────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│  Image Source Decision              │
│  elementor.js lines 388-442         │
│                                     │
│  Reads integration_mode from DB:    │
│  - 'live' → Generate fresh images   │
│  - 'bank' → Pull from Image Bank    │
└─────────────────────────────────────┘
            │
            ├─── integration_mode = 'bank' ───┐
            │                                  │
            ▼                                  ▼
┌──────────────────────┐        ┌──────────────────────┐
│  Generate Live       │        │  Image Bank Match    │
│  elementor.js        │        │  elementor.js        │
│  lines 1009-1115     │        │  lines 453-959       │
│                      │        │                      │
│  Uses image-pipeline │        │  Matches by avatar   │
│  to generate images  │        │  tag and keywords    │
└──────────────────────┘        └──────────────────────┘
            │                                  │
            └──────────┬───────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────┐
│  Save Images to Article             │
│  elementor.js lines 1297-1476       │
│                                     │
│  Builds generatedImagesData array   │
│  Updates article in database with:  │
│  - generated_images (JSONB)         │
│  - image_decision_report (JSONB)    │
└─────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│  WordPress Page Creation            │
│  elementor.js lines 1269-1284       │
│                                     │
│  IF skipWpPageCreation = true:      │
│    → Skip, just return success      │
│  ELSE:                              │
│    → Create Elementor page          │
└─────────────────────────────────────┘
```

---

## Database Schema (Relevant Tables)

### articles table
```sql
- id: Primary key
- generated_images: JSONB array of image objects
- image_decision_report: JSONB with mode, model, images array
- status: 'draft' | 'published'
```

### image_creation_settings table
```sql
- workflow_id: Links to workflow
- integration_mode: 'live' | 'bank'
- image_bank: JSONB array of bank images
- audience_avatars: JSONB array of avatar configs
- fallback_to_live: boolean
```

---

## Recent Changes Made (This Session)

1. **Fixed base64 upload bug** (`image-pipeline.js` lines 706-752)
   - Images were being generated but not uploaded to WordPress
   - fetch() can't handle data: URLs, now extracts base64 directly

2. **Added source field to images** (`elementor.js` multiple locations)
   - Images now have `source: 'bank'` or `source: 'generated'`
   - Fixes display showing wrong source in Articles page

3. **Draft mode image processing** (`App.tsx` lines 1233-1240)
   - Changed condition from `articlePublishMode === 'wordpress'`
   - To `shouldPublishToWP || shouldProcessImages`
   - Images should now process even when Article is on Draft

4. **Added skipWpPageCreation flag** (`elementor.js` line 315)
   - When Article=Draft, this flag is true
   - Should skip WordPress page creation but still process images

5. **Processing Log improvements** (`App.tsx` lines 3198-3223)
   - Added mode indicators (Article/Meta/Image: Draft/WP)
   - Expanded height for more visible logs

6. **Server Logs system** (`console-capture.js`, `LogViewer.tsx`)
   - Captures ALL console.log output
   - Available in-app with Copy All button

---

## Known Issue to Debug

The error "WordPress publish failed: Unknown error" suggests the code is still trying to create a WordPress page when it shouldn't be.

**Where to look:**
1. `elementor.js` lines 1269-1284 - The `skipWpPageCreation` condition
2. Check if `skipWpPageCreation` is being passed correctly from frontend
3. Check the actual error in full server logs

**To get full logs:**
1. User opens Server Logs viewer (button at bottom left)
2. Runs a test
3. Clicks "Copy All"
4. Pastes here - you'll see the full Railway-equivalent output

---

## Image Creation Settings (UI Location)

In the app: **Section 5: Image Creation**

Key settings:
- **Image Source**: "Generate Live" vs "Pull from Bank"
- **Audience Avatars**: Tags (A, B, C...) with prompts
- **Image Bank**: Pre-generated images matched by tag/keywords
- **Fallback to Live**: If bank is empty, generate fresh

---

## Testing Checklist

When testing draft mode:
1. Set Article: Draft, Meta: Draft, Image: Draft
2. Run batch processing
3. Check Processing Log for image-related messages
4. Go to Articles page → click article → Images tab
5. Should see images even though not published to WP

---

## File Locations Summary

```
/App.tsx                              - Main frontend, batch processing
/src/components/ImageCreationSection.tsx - Image Bank UI
/src/components/articles/ArticleListView.tsx - Article display
/src/components/LogViewer.tsx         - Server logs viewer

/server/routes/elementor.js           - MAIN: Image processing & WP publish
/server/services/image-pipeline.js    - Image generation engine
/server/services/console-capture.js   - Log capture system
/server/routes/image-creation.js      - Image Bank API
/server/routes/logs.js                - Logs API

/docs/GITHUB-LOGGING-SETUP.md         - How to set up GitHub logging
/docs/IMAGE-SYSTEM-ARCHITECTURE.md    - Previous architecture doc (may be outdated)
```

---

## For the Next Agent

1. Get the full server logs (user knows how to copy them now)
2. Search for "Unknown error" to find the actual failure point
3. The fix is likely in `elementor.js` around the `skipWpPageCreation` logic
4. The image saving happens at lines 1297-1476 - check if `generatedImagesData` is being populated
5. Check if `articleId` is being passed correctly (needed for saving images)

Good luck! The system is close to working - it's generating images but something in the save/return flow is breaking.
