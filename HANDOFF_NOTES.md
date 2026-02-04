# Agent Handoff Notes - Session 2026-02-04

## Session Summary
This session focused on implementing the Component Library Module Name feature for Slider Revolution widgets, fixing the keyword/tag extraction for component matching, adding slot toggles, and researching two bugs.

---

## COMPLETED WORK

### 1. Slider Revolution Module Name Feature
**Problem:** SR widgets need TWO settings - `revslidertitle` (module name like "Residential") AND `shortcode` (alias like "home-1"). The Component Library only had Alias + Display Name.

**Solution Implemented:**
- Created migration `server/db/migrations/030_add_slider_module_name.sql` - adds `module_name` column
- Updated `src/components/ComponentLibrarySection.tsx` - added Module Name input field for SR widgets
- Updated `server/routes/component-library.js` - handles moduleName in add/update endpoints
- Updated `server/services/component-library-service.js` - passes moduleName through selection
- Updated `server/services/elementor-builder.js` - `buildComponentWidget()` uses moduleName for SR

### 2. Keyword Tag Extraction Fix
**Problem:** Component tag matching (H/J/C) wasn't working because `keyword` was undefined in publish requests.

**Solution Implemented:**
Added `keyword: selectedArticle.keyword` to ALL publish calls:
- `src/components/articles/ArticleListView.tsx` (3 places: lines ~384, ~472, ~771)
- `src/components/ArticleManager.tsx` (1 place)
- `server/routes/drip-feed.js` (1 place: line ~1238)
- `server/services/drip-feed-scheduler.js` (1 place)

### 3. Slot Toggles Feature
**Problem:** User wanted ability to enable/disable individual slots and a master toggle.

**Solution Implemented:**
- Added `enabled` property to SlotConfig interface
- Added `handleSlotToggle()` and `handleMasterSlotToggle()` functions
- Updated selection logic in `selectComponentsForArticle()` to skip disabled slots
- Added toggle UI for each slot header and master toggle above slots

---

## RESEARCH FINDINGS (NO CODE WRITTEN)

### Issue 1: Tags (C)/(H) Appearing in Page Titles/Headings

**Root Cause Found:** The tags are baked into the AI-generated content itself, not a display issue.

**Location:** `server/routes/workflows.js:525-528`
```javascript
// Replace {item_name} or {keyword} with the target keyword
filledPrompt = filledPrompt.replace(/{item_name}/g, targetKeyword || nodeTitle);
filledPrompt = filledPrompt.replace(/{keyword}/g, targetKeyword || nodeTitle);
```

When articles are generated via `/api/workflows/generate-for-node`:
1. The `targetKeyword` (e.g., "Phase Cleaning Out(C)") is passed to AI prompts without stripping the tag
2. The AI includes the full keyword (with tag) in generated headings
3. At publish time, `stripTagFromKeyword()` only strips the **page title**, not content headings

**Why only (C) articles affected:** Likely those articles were generated more recently or with different prompts that echo the keyword more in headings.

**Fix Options (for next agent):**
1. **Strip tag before AI generation** - Modify `generate-for-node` endpoint to strip tag from keyword before sending to AI
2. **Post-process content** - Strip tags from H2 headings in `final_content` after generation
3. **Regenerate affected articles** - With tag stripped from keyword

**Key Files:**
- `server/routes/workflows.js` - Article generation (lines 450-650)
- `server/services/content-chunker.js` - Parses H2 headings from content (line 127)
- `server/services/elementor-builder.js` - Builds H1/H2 widgets (lines 639-645, 738-739)

### Issue 2: Component Library "Capture from Page" Feature

**Status:** User reported it didn't work when first tried (seemed "non-existent"). They then pivoted to manual entry.

**Code Flow:**
1. Frontend: `ComponentLibrarySection.tsx:276-314` - calls POST `/api/component-library/:workflowId/fetch-page`
2. Backend: `component-library.js:78-137` - calls `fetchWordPressPage()` + `detectComponentsFromPageJson()`
3. Detection: `component-library-service.js:357-455` - looks for SR shortcodes and Elementor templates

**Potential Issues:**
- WordPress credentials not configured (would show error)
- Page doesn't have `_elementor_data` in meta (would throw error)
- Detection patterns don't match actual widget types on page
- SR widgets might use non-standard widget type names

**Detection Logic:**
- Looks for `[rev_slider alias="..."]` in shortcode widgets
- Checks many SR widget type names: `rev-slider`, `revslider`, `slider_revolution`, etc.
- Looks for `widgetType === 'template'` for Elementor templates

**Recommendation:** Add more logging to understand what widgets are on the page and why they're not being detected. The `detectComponentsFromPageJson()` function logs widget types found - check server logs.

---

## KEY CODE LOCATIONS

### Component Library System
| File | Purpose |
|------|---------|
| `src/components/ComponentLibrarySection.tsx` | UI for component management |
| `server/routes/component-library.js` | API endpoints |
| `server/services/component-library-service.js` | Business logic, selection algorithm |
| `server/services/elementor-builder.js` | Builds SR/template widgets |
| `server/db/migrations/029_component_library.sql` | Main table schema |
| `server/db/migrations/030_add_slider_module_name.sql` | Module name column |

### Tag Stripping
| File | Line | Usage |
|------|------|-------|
| `server/routes/elementor.js` | 78 | Definition |
| `server/routes/elementor.js` | 381, 1738, 2299, 2569 | Page title stripping |
| `server/routes/drip-feed.js` | 16, 1237 | Drip feed title stripping |
| `src/components/articles/ArticleListView.tsx` | 87 | Frontend definition |

### Article Generation
| File | Lines | Purpose |
|------|-------|---------|
| `server/routes/workflows.js` | 450-650 | `/generate-for-node` endpoint |
| `server/services/content-chunker.js` | 101-148 | Parses H2 headings |

---

## WORKING STATE

**What Works:**
- Slider Revolution components with correct module name + alias
- Component tag matching (H/J/C articles get matching components)
- Slot toggles (individual + master)
- Manual component entry

**Known Issues:**
- Tags appear in content headings for (C) articles (see root cause above)
- "Capture from Page" feature needs debugging
- Image toggle sometimes not respected (lower priority - "safer" failure mode)

---

## USER PREFERENCES NOTED

1. **Ask before coding** - User explicitly said "don't code unless we absolutely have to"
2. **Check before pushing** - Ask if user is running anything before pushing code (causes Railway redeploy)
3. **Research first** - User prefers research/debugging before implementing fixes
4. **Chunk large tasks** - User noted large features should be split across multiple agent sessions

---

## COMMITS THIS SESSION

1. `feat: Add slot toggles for Component Library` - Added individual and master slot toggles
2. `fix: Add keyword to all publish requests for tag extraction` - Fixed component tag matching
3. `feat: Add Module Name field for Slider Revolution widgets` - Full SR module name support

Note: One commit was reverted (page title hide feature) - user didn't want it coded.

---

## NEXT STEPS FOR FUTURE AGENT

1. **Fix tags in content** - Strip tags from keyword BEFORE sending to AI in `generate-for-node`
2. **Debug Capture from Page** - Add logging to understand why component detection fails
3. **Consider content post-processing** - Option to strip tags from existing article content

---

Session ID: session_019At1C5rTV3E5xUcRALtAUN
Branch: claude/seven-sequential-tasks-1hmPM
