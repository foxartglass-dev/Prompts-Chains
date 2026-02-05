# Component Library - Complete Technical Specification

This document contains everything needed to rebuild the Component Library feature from scratch.

---

## Overview

**Purpose:** Automatically inject reusable Elementor components (hero sliders, stats bars, benefit sections) into generated SEO articles based on audience tags (H, J, C).

**Key Concept:** Components are captured from existing WordPress pages and stored in a library. When publishing articles, the system selects appropriate components based on the article's tag and injects them at specific positions in the page.

---

## Database Schema

### Table: `component_library`

```sql
CREATE TABLE IF NOT EXISTS component_library (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

  -- Slot assignment (1=TOP, 2=MIDDLE, 3=BOTTOM)
  slot_number INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 3),
  slot_name VARCHAR(100),  -- "Hero Slider", "Stats Bar", "Benefits"

  -- Component type and reference
  -- 'slider_revolution' = shortcode widget with alias
  -- 'elementor_template' = template widget with template_id
  component_type VARCHAR(50) NOT NULL,
  component_ref VARCHAR(200) NOT NULL,  -- alias for sliders, template_id for templates
  module_name VARCHAR(200),  -- SR Module Name (display name in Slider Revolution)

  -- Audience tagging (H, J, C, or NULL for global)
  tag VARCHAR(10),

  -- Display info
  name VARCHAR(200) NOT NULL,  -- User-friendly name shown in UI

  -- Source tracking
  source_page_id INTEGER,
  source_page_url TEXT,

  -- Rotation ordering
  sort_order INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups during page generation
CREATE INDEX IF NOT EXISTS idx_component_library_lookup
ON component_library(workflow_id, slot_number, tag) WHERE is_active = true;
```

### Table: `component_rotation_state`

Tracks which component was last used for sequential rotation.

```sql
CREATE TABLE IF NOT EXISTS component_rotation_state (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,
  tag VARCHAR(10),  -- NULL stored as empty string '' for UNIQUE constraint
  last_used_component_id INTEGER REFERENCES component_library(id) ON DELETE SET NULL,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workflow_id, slot_number, tag)
);
```

> **Implementation Note:** The `tag` column uses empty string `''` instead of NULL for global/untagged rotation states. This is because PostgreSQL treats NULL values as distinct in UNIQUE constraints, which would allow duplicate (workflow_id, slot_number, NULL) rows. The service layer converts NULL → `''` on write and `''` → NULL on read.

### Column on `workflows` table: `component_settings`

```sql
-- JSONB column storing settings per workflow
component_settings JSONB DEFAULT '{
  "enabled": false,
  "slots": [
    {"number": 1, "name": "Hero/Slider", "position": "top", "rotation": "sequential", "enabled": true},
    {"number": 2, "name": "Stats Bar", "position": "middle", "rotation": "sequential", "enabled": true},
    {"number": 3, "name": "Benefits", "position": "bottom", "rotation": "sequential", "enabled": true}
  ]
}'
```

---

## Slot System

| Slot | Position | Default Name | Typical Use |
|------|----------|--------------|-------------|
| 1 | TOP | Hero/Slider | Slider Revolution hero slider |
| 2 | MIDDLE | Stats Bar | Stats/counter section between content |
| 3 | BOTTOM | Benefits | Call-to-action or benefits section |

**Injection Points in Page:**
- Slot 1: Before hero section (very top of page)
- Slot 2: After middle content chunk (splits content in half)
- Slot 3: After all content (very bottom of page)

---

## Component Types

### 1. Slider Revolution (`slider_revolution`)

**What it is:** A premium WordPress slider plugin. Components are referenced by "alias" (internal ID like "home-1").

**Required fields:**
- `component_ref`: The slider alias (e.g., "home-1", "janitorial-1")
- `module_name`: The SR Module Name (display name like "Residential", "Commercial") - **CRITICAL for widget to work**

**How it's injected into Elementor:**
```javascript
{
  id: generateElementId(),
  elType: 'widget',
  widgetType: 'slider_revolution',  // Native SR6 Elementor widget
  isInner: false,
  settings: {
    revslidertitle: moduleName,  // The module display name
    shortcode: `[rev_slider alias="${alias}"][/rev_slider]`
  },
  elements: []
}
```

**Key Discovery:** The native `slider_revolution` widget type requires BOTH:
1. `revslidertitle` - matches the slider's "Module Name" in SR admin
2. `shortcode` - the full shortcode string

### 2. Elementor Template (`elementor_template`)

**What it is:** A saved Elementor section/template. Referenced by template ID.

**Required fields:**
- `component_ref`: The Elementor template ID (e.g., "1134", "1146")

**How it's injected:**
```javascript
{
  id: generateElementId(),
  elType: 'widget',
  widgetType: 'template',
  isInner: false,
  settings: {
    template_id: templateId.toString()
  },
  elements: []
}
```

---

## Tag-Based Selection Logic

**Tags:** H (Homeowner), J (Janitorial/Business), C (Construction)

**Selection Algorithm:**
1. Get all active components for the slot
2. Filter by article's tag (e.g., if article is "Service (H)", look for H-tagged components)
3. If no tag-specific match, fall back to Global (tag = NULL)
4. If multiple matches, use rotation mode (sequential or random)
5. Sequential rotation tracks last-used component per slot+tag combination

**Code Pattern:**
```javascript
// First try tag-specific
let matchingComponents = articleTag
  ? slotComponents.filter(c => c.tag === articleTag)
  : [];

// Fall back to Global
if (matchingComponents.length === 0) {
  matchingComponents = slotComponents.filter(c => c.tag === null || c.tag === '');
}
```

---

## API Endpoints

### GET `/api/component-library/:workflowId`
Returns all components and settings for a workflow.

**Response:**
```json
{
  "success": true,
  "components": [...],
  "bySlot": { "1": [...], "2": [...], "3": [...] },
  "settings": { "enabled": true, "slots": [...] }
}
```

### PUT `/api/component-library/:workflowId/settings`
Update component settings (enable/disable, slot config).

**Body:** `{ "settings": { "enabled": true, "slots": [...] } }`

### POST `/api/component-library/:workflowId/fetch-page`
Fetch a WordPress page and detect components.

**Body:** `{ "pageId": 1441 }`

**Response:**
```json
{
  "success": true,
  "pageInfo": { "id": 1441, "title": "Page Title", "url": "..." },
  "detected": {
    "sliders": [{ "type": "slider_revolution", "alias": "home-1", ... }],
    "templates": [{ "type": "elementor_template", "templateId": "1134", ... }],
    "total": 2
  }
}
```

### POST `/api/component-library/:workflowId/add`
Add a component to the library.

**Body:**
```json
{
  "slotNumber": 1,
  "componentType": "slider_revolution",
  "componentRef": "home-1",
  "moduleName": "Residential",  // Only for slider_revolution
  "name": "House Cleaning Hero Slider",
  "tag": "H"  // or null for Global
}
```

### DELETE `/api/component-library/:workflowId/:componentId`
Remove a component (soft delete sets is_active = false).

### PUT `/api/component-library/:workflowId/:componentId`
Update a single component's properties.

**Body:** Any combination of:
```json
{
  "slot_number": 1,
  "slot_name": "Hero Slider",
  "component_type": "slider_revolution",
  "component_ref": "home-1",
  "module_name": "Residential",
  "tag": "H",
  "name": "Updated Component Name",
  "sort_order": 0
}
```

**Response:** `{ "success": true, "component": {...} }`

### POST `/api/component-library/:workflowId/save-batch`
Save multiple components at once from page detection.

**Body:**
```json
{
  "components": [
    { "slotNumber": 1, "componentType": "slider_revolution", "componentRef": "home-1", ... },
    { "slotNumber": 2, "componentType": "elementor_template", "componentRef": "1134", ... }
  ],
  "sourcePageId": 1441,
  "sourcePageUrl": "https://example.com/page"
}
```

**Response:** `{ "success": true, "components": [...], "count": 2 }`

### GET `/api/component-library/:workflowId/select/:articleTag`
Test endpoint - shows what components would be selected for a given tag.

---

## Component Detection from WordPress Pages

**Function:** `detectComponentsFromPageJson(elementorDataJson)`

Parses Elementor's `_elementor_data` JSON and finds:

### Slider Revolution Detection:
1. **Shortcode widget:** Look for `widgetType === 'shortcode'` with `settings.shortcode` containing `[rev_slider`
2. **Native SR widget:** Look for various widget type names:
   - `rev-slider`, `revslider`, `slider_revolution`, `sr6_slider`, `sr7_slider`
   - Any widget type containing both "rev" and "slider"
3. Extract alias from: `settings.alias`, `settings.slider_alias`, `settings.selected_slider`, etc.

### Elementor Template Detection:
Look for `widgetType === 'template'` with `settings.template_id`

**Regex for shortcode alias extraction:**
```javascript
shortcode.match(/\[rev_slider[^\]]*alias=["']([^"']+)["']/i)
```

---

## Page Building Integration

**File:** `server/services/elementor-builder.js`

**Function:** `buildElementorPage(chunkedContent, options)`

**Options include:**
```javascript
{
  components: {  // From selectComponentsForArticle()
    enabled: true,
    slot1: { type: 'slider_revolution', ref: 'home-1', moduleName: 'Residential', name: '...' },
    slot2: { type: 'elementor_template', ref: '1134', name: 'Stats Bar' },
    slot3: { type: 'elementor_template', ref: '1146', name: 'Benefits' }
  }
}
```

**Injection Order:**
```javascript
// SLOT 1: TOP (before hero)
if (components?.slot1) {
  pageElements.push(buildComponentWidget(components.slot1));
}

// Hero section
pageElements.push(buildHeroSection(...));

// Content chunks with SLOT 2: MIDDLE
chunks.forEach((chunk, index) => {
  if (index === middleIndex && components?.slot2) {
    pageElements.push(buildComponentWidget(components.slot2));
  }
  pageElements.push(buildContentSection(chunk, ...));
});

// SLOT 3: BOTTOM
if (components?.slot3) {
  pageElements.push(buildComponentWidget(components.slot3));
}
```

---

## Frontend Component

**File:** `src/components/ComponentLibrarySection.tsx`

**Features:**
1. Master enable/disable toggle for entire Component Library
2. Per-slot enable/disable toggles
3. Per-slot rotation mode (sequential/random)
4. "Capture from Page" - enter WP page ID, detect components
5. "Add Manually" - form to add components by hand
6. Component list grouped by slot with tag badges
7. Remove button for each component

**State:**
```typescript
interface ComponentSettings {
  enabled: boolean;
  slots: {
    number: number;
    name: string;
    position: string;
    rotation: 'sequential' | 'random';
    enabled?: boolean;
  }[];
}
```

---

## Publish Flow Integration

**File:** `server/routes/elementor.js`

**In the publish endpoint:**
```javascript
// Extract tag from keyword
const tagMatch = keyword?.match(/\(([A-Z])\)/i);
const articleTag = tagMatch ? tagMatch[1].toUpperCase() : null;

// Get component selection
const componentSelection = await selectComponentsForArticle(workflowId, articleTag);

// Pass to page builder
const elementorData = buildElementorPage(chunkedContent, {
  components: componentSelection.enabled ? componentSelection : null,
  // ...other options
});
```

---

## Key Lessons Learned

### 1. Slider Revolution Widget Type
The native Elementor widget for SR6 is `slider_revolution` (NOT `shortcode`). It requires:
- `revslidertitle`: The module's display name (found in SR admin)
- `shortcode`: The full shortcode string

### 2. Module Name vs Alias
- **Alias:** Internal identifier (e.g., "home-1") - used in shortcode
- **Module Name:** Display name (e.g., "Residential") - used in widget settings
Both are needed for the slider to render correctly.

### 3. Component Wrapper
Components are wrapped in a full-width container to isolate styles:
```javascript
{
  elType: 'container',
  settings: {
    content_width: 'full',
    flex_direction: 'column',
    padding: { unit: 'px', top: '0', right: '0', bottom: '0', left: '0' }
  },
  elements: [actualWidget]
}
```

### 4. NULL Tag Handling
PostgreSQL treats NULL values as distinct in UNIQUE constraints. Solution: store empty string `''` instead of NULL for the tag column in `component_rotation_state`.

### 5. Rotation State
Sequential rotation works by:
1. Query `component_rotation_state` for last used component ID
2. Sort available components by `sort_order`, then `id`
3. Find index of last used, return next (wrapping to 0)
4. Update rotation state after selection

---

## Files Reference

| File | Purpose |
|------|---------|
| `server/db/migrations/029_component_library.sql` | Database schema |
| `server/services/component-library-service.js` | Core logic (CRUD, selection) |
| `server/routes/component-library.js` | API endpoints |
| `server/services/elementor-builder.js` | Page building, widget creation |
| `src/components/ComponentLibrarySection.tsx` | Frontend UI |
| `server/routes/elementor.js` | Publish flow integration |

---

## Rebuild Checklist

1. [ ] Create database tables (migration 029)
2. [ ] Add `component_settings` column to workflows table
3. [ ] Implement service functions:
   - `getComponentsForWorkflow()`
   - `getComponentSettings()`
   - `updateComponentSettings()`
   - `selectComponentsForArticle()`
   - `addComponent()`
   - `deleteComponent()` (soft delete - sets is_active = false)
   - `hardDeleteComponent()` (permanent delete - removes row from database)
   - `detectComponentsFromPageJson()`
4. [ ] Create API routes
5. [ ] Add `buildSliderRevolutionWidget()` to elementor-builder
6. [ ] Add `buildElementorTemplateWidget()` to elementor-builder
7. [ ] Add `buildComponentWidget()` wrapper function
8. [ ] Modify `buildElementorPage()` to accept and inject components
9. [ ] Update publish flow to call `selectComponentsForArticle()`
10. [ ] Build frontend ComponentLibrarySection component
11. [ ] Test with actual WordPress pages

---

*Document generated from working codebase - February 2026*
