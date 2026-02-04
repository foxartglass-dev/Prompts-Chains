# Agent Handoff Notes - Session 2026-02-04 (Continued)

## Session Summary
This session continued work on the Component Library and investigated several bugs: (C) tags in content, image toggle behavior, FAQ formatting, and prepared documentation for a per-component toggle feature request.

---

## COMPLETED WORK THIS SESSION

### 1. (C) Tag Fix in AI-Generated Content
**Problem:** Tags like (C) were appearing in H1 headings, H2 headings, and FAQ questions on published pages. Only (C) articles affected.

**Root Cause:** `src/engine/prompt-filler.ts` line 76 was using `item.name` directly in `{item_name}` replacement without stripping the tag suffix. When prompts contained `{item_name}`, the full "Phase Cleaning Out(C)" was sent to the AI, which then included (C) in all generated headings.

**Solution Implemented:**
- Modified `src/engine/prompt-filler.ts` (lines 75-81) to strip tags before AI:
```typescript
// 5. Replace {item_name} with the current item's name (tag stripped)
const cleanItemName = item.name.replace(/\s*\([A-Za-z]\)\s*$/, '').trim();
filled = filled.replace(/{item_name}/g, cleanItemName);
```

- Created `server/db/migrations/031_fix_c_article_tags.sql` to fix existing Phase Cleaning Out(C) article
- **STATUS:** Code fix committed. User reported they ran the SQL migration in Neon.

### 2. Em Dash Formatting for H1 Titles
**Problem:** H1 titles were displaying periods after state abbreviations instead of em dashes:
- Wrong: "Move-In House Cleaning in Hendersonville, TN. Premium Service"
- Correct: "Move-In House Cleaning in Hendersonville, TN — Premium Service"

**Solution Implemented:**
- Added `formatHeadlineWithEmDash()` function in `server/services/elementor-builder.js`
- Applied to `extractHeadlineFromIntro()` function
- Pattern: `/,\s*([A-Z]{2})\.\s+/g` → `, $1 — `

### 3. Blueprint Documentation Updates
- Added Tag Stripping fix to "Known Issues" section
- Added Golden Rule #18: Em dash formatting for H1 titles

---

## RESEARCH FINDINGS (NEXT AGENT ACTION ITEMS)

### Issue 1: Image Toggle "Off" Not Respected
**User Report:** Images were being generated even when the toggle was set to "Off" for weeks.

**Investigation Findings:**

**Code Location:** `App.tsx` lines 1259-1467
```typescript
// Line 1259 - Toggle state resolution
const effectiveWpPublishMode = publishModeOverrides?.wpPublishMode ?? currentProject?.state.wpPublishMode ?? 'draft';

// Line 1467 - Image processing decision
const shouldProcessImages = effectiveWpPublishMode !== 'off';
```

**Root Cause Analysis:**
1. The toggle state defaults to `'draft'` if not saved to project state
2. If user sets toggle to "Off" but doesn't save the project, the state is lost on refresh
3. The fallback chain is: `publishModeOverrides` → `currentProject.state.wpPublishMode` → `'draft'`
4. Default `'draft'` DOES process images (only `'off'` skips images)

**State Persistence Issue:**
- Toggle is controlled by React state `wpPublishMode`
- Must be persisted to `currentProject.state` to survive refresh
- If state wasn't saved, the setting reverts to default `'draft'` on page load

**Files to Check:**
| File | Line | Purpose |
|------|------|---------|
| `App.tsx` | 1259 | Toggle state resolution |
| `App.tsx` | 1467 | Image processing decision |
| `App.tsx` | ~800-850 | Toggle UI and state management |
| `src/components/ProjectSettings.tsx` | - | Where settings get saved |

**Recommended Fix Options:**
1. **Save state on toggle change** - Auto-persist to project when user toggles
2. **Show warning** - If toggle is "Off" but not saved, show indicator
3. **Default to 'off'** - Change fallback from 'draft' to 'off' (safer but changes behavior)

---

### Issue 2: Per-Component Toggle Feature Request (NEW)
**User Request:** Add an enabled/disabled toggle for each component in the Component Library, similar to the existing slot toggles.

**Desired UI Location:**
- Toggle should appear on the FAR LEFT of each component row
- The "Global" badge should be pushed to the right
- Current layout: `[Global badge] Component Name (template: 1146) [Remove]`
- Desired layout: `[Toggle] [Global badge] Component Name (template: 1146) [Remove]`

**Implementation Notes:**
| File | Purpose |
|------|---------|
| `src/components/ComponentLibrarySection.tsx` | Add toggle UI to component rows |
| `server/routes/component-library.js` | Handle `enabled` field in API |
| `server/services/component-library-service.js` | Filter out disabled components in selection |
| `server/db/migrations/` | Add `enabled` column (default true) |

**Reference Implementation:**
Slot toggles already implemented in this session provide a template:
- `handleSlotToggle()` function for individual toggles
- `handleMasterSlotToggle()` function for master toggle
- Selection logic that skips disabled items

---

### Issue 3: FAQ Formatting Broken
**User Report:** FAQ section at bottom of pages has no structure - questions and answers running together without proper bold/spacing.

**User Note:** H articles work fine, but J and C articles may have issues.

**Tag-Equality Investigation:**
I verified the code treats ALL tags (H, J, C) equally - no hardcoded tag-specific logic:
- Tag extraction: `/\(([A-Z])\)/i` matches any single letter
- Component selection: `c.tag === articleTag` is generic
- Content chunker: No tag-specific FAQ logic
- Elementor builder: No tag-specific content logic

**If H works but J/C don't, the issue is DATA CONFIGURATION:**
1. Components may only be set up for H tag (check Component Library)
2. Template page (Page Style Template) may only have FAQ section for H articles
3. AI prompts may generate different FAQ formats for different article types

**Investigation Findings:**

**The System DOES Support FAQ Formatting:**
1. **Style Extractor** (`server/services/elementor-style-extractor.js` lines 86-96) - Captures FAQ structure:
   - `questionFormat`: 'bold', 'h3', 'numbered', 'plain'
   - `questionNumbered`: true/false
   - `spacingBetweenQA`: 'tight' or 'spaced'
   - `spacingBetweenPairs`: 'tight' or 'spaced'

2. **Content Chunker** (`server/services/content-chunker.js` lines 364-473) - Formats FAQ content:
   - `formatFAQContent()` extracts Q&A pairs and applies formatting rules
   - Uses template rules if provided, else defaults to bold questions with spacing

3. **Elementor Builder** (`server/services/elementor-builder.js` lines 210-240) - Special FAQ HTML handling:
   - `contentToHtml()` has `isFAQ` flag for special newline handling
   - Single newlines become `<br>`, double newlines become new paragraphs

**Potential Causes:**

1. **Template Not Detecting FAQ Section**
   - `faq.detected` defaults to `false`
   - Only set to `true` if source template page has an FAQ heading
   - If not detected, FAQ structure rules aren't captured from template

2. **AI Content Format Issues**
   - `formatFAQContent()` uses regex to parse Q&A pairs
   - Pattern: `/^(?:#\s+|\*\*)?(.+\?)(?:\*\*)?$/` for questions
   - If AI generates different format (e.g., no blank lines between Q&A), parsing fails

3. **Q&A Pair Detection Failing**
   - If no Q&A pairs detected (line 422-428), falls back to basic cleanup
   - Fallback only converts `#` and `**` to `<strong>`, doesn't add spacing

**Debug Steps:**
1. Check if source template page (the one in Page Style Template) has an FAQ section
2. Check server logs during page build for FAQ detection messages
3. Examine raw `final_content` in database to see AI's FAQ format
4. Test with sample content through `formatFAQContent()` function

**Key Files:**
| File | Lines | Purpose |
|------|-------|---------|
| `server/services/elementor-style-extractor.js` | 86-96, 401-466 | FAQ detection from template |
| `server/services/content-chunker.js` | 364-473 | FAQ formatting logic |
| `server/services/elementor-builder.js` | 210-240, 765-774 | FAQ HTML rendering |

---

### Issue 4: Blue Bleeding Through White Cards
**User Report:** Blue background bleeding through at the bottom of pages where white cards are displayed.

**Status:** Not investigated yet. Likely CSS/styling issue in:
- `server/services/elementor-builder.js` - container/section styling
- Theme CSS conflicts
- Container padding/margin issues

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
| `src/engine/prompt-filler.ts` | 75-81 | **NEW: Strip tag before AI** |
| `server/routes/elementor.js` | 78 | Page title stripping (at publish) |
| `server/routes/drip-feed.js` | 16, 1237 | Drip feed title stripping |
| `src/components/articles/ArticleListView.tsx` | 87 | Frontend definition |

### Image Toggle
| File | Line | Purpose |
|------|------|---------|
| `App.tsx` | 1259 | Toggle state resolution |
| `App.tsx` | 1467 | shouldProcessImages decision |
| `App.tsx` | ~800-850 | Toggle UI component |

### FAQ Formatting
| File | Lines | Purpose |
|------|-------|---------|
| `server/services/elementor-style-extractor.js` | 86-96, 401-466 | FAQ structure extraction |
| `server/services/content-chunker.js` | 364-473 | formatFAQContent() |
| `server/services/elementor-builder.js` | 210-240 | contentToHtml() FAQ mode |

---

## WORKING STATE

**What Works:**
- Tag stripping in prompt-filler.ts (new articles won't have tag in content)
- Em dash formatting in H1 titles
- Slider Revolution components with module name + alias
- Component tag matching (H/J/C articles get matching components)
- Slot toggles (individual + master)

**Known Issues (Prioritized):**
1. **HIGH:** Image toggle "Off" - state persistence issue
2. **MEDIUM:** FAQ formatting not working - Q&A detection may be failing
3. **MEDIUM:** Per-component toggle - feature request (not started)
4. **LOW:** Blue bleeding through white cards - needs CSS investigation
5. **DONE:** (C) tags in content - code fixed, SQL run by user

---

## USER PREFERENCES NOTED

1. **Ask before coding** - User explicitly said "don't code unless we absolutely have to"
2. **Check before pushing** - Ask if user is running anything before pushing code (causes Railway redeploy)
3. **Research first** - User prefers research/debugging before implementing fixes
4. **Chunk large tasks** - User noted large features should be split across multiple agent sessions
5. **Document in Blueprint** - Add findings to Blueprint page for future reference

---

## COMMITS THIS SESSION

Previous session:
1. `feat: Add slot toggles for Component Library`
2. `fix: Add keyword to all publish requests for tag extraction`
3. `feat: Add Module Name field for Slider Revolution widgets`

This continuation:
4. `fix: Strip tags from {item_name} before AI prompts` - The (C) tag fix
5. `fix: H1 titles use em dash (—) instead of period for separators`

---

## NEXT STEPS FOR FUTURE AGENT

### Priority 1: Image Toggle Investigation
- Trace state persistence for `wpPublishMode`
- Determine if auto-save on toggle change is feasible
- Consider changing default from 'draft' to 'off'

### Priority 2: FAQ Formatting Fix
- Add logging to `formatFAQContent()` to see what's being parsed
- Check if template has FAQ section (faq.detected)
- Examine raw AI output to see FAQ format
- May need to update regex patterns to match AI's format

### Priority 3: Per-Component Toggle
- Add `enabled` column to component_library table
- Add toggle UI to component rows (left of Global badge)
- Update selection logic to skip disabled components

### Priority 4: Blue Bleeding CSS
- Investigate container styling in elementor-builder.js
- Check theme CSS for conflicts
- May need bottom padding/margin adjustment on final section

---

Session ID: session_019At1C5rTV3E5xUcRALtAUN
Branch: claude/seven-sequential-tasks-1hmPM
