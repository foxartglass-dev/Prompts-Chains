# Agent Handoff: Prompt-to-Page Assignment System

## Overview
Create a system that allows exact matching between Site Planning pages and specific prompts. Currently, when there are multiple prompts for a tag (H1, H2, H3), the system guesses which to use. This feature eliminates guessing by letting users assign specific prompts to specific pages.

## Current State
- Prompts are stored in the Image Creation section under different tags (H, J, C, B, E, G)
- Each tag can have MULTIPLE prompts (e.g., 3 different "H" prompts for different scenarios)
- Site Planning has pages tagged with letters (H, J, C, etc.)
- Image generation currently picks a prompt based on rules/random selection
- `live_prompt_mode` is set at workflow level, not per-page

## Feature Requirements

### Part 1: Prompt ID System

**Location:** Image Creation Section → Main Prompt area (and similar for Guided GPT, Smart Prompt)

**Changes:**
1. Each prompt gets an auto-generated ID based on its tag + creation order:
   - First H prompt = `H1`
   - Second H prompt = `H2`
   - Third H prompt = `H3`
   - Same pattern for J1, J2, J3, C1, C2, etc.

2. The ID should be:
   - Displayed to the LEFT of the prompt name in a colored circle/badge
   - **Uneditable** - auto-assigned, persists even if prompts reordered
   - Stored in database (new column: `prompt_id` in relevant table)

3. User can still edit the prompt NAME (the descriptive title), but not the ID

**UI Example:**
```
[H1] Navy Blue Product Photos    [Edit] [Delete]
[H2] Lifestyle Cleaning Scenes   [Edit] [Delete]
[H3] Before/After Comparisons    [Edit] [Delete]
```

### Part 2: Site Planning Page Enhancements

**Location:** Site Planning Section (currently in a modal/panel)

**Changes:**

1. **Full-Page Expand Mode**
   - Add expand button (like Audience Avatar has)
   - Full page gives more room for columns

2. **New Columns per Page Row:**

   | Page Name | Tag | Bank First | Mode | Prompt ID |
   |-----------|-----|------------|------|-----------|
   | Move In/Out Cleaning | H | [ ] | [Main Prompt ▼] | [H1] [H2] [H3] |
   | Kitchen Deep Cleaning | H | [x] | [Guided GPT ▼] | [H1] [H2] [H3] |
   | Office Cleaning | J | [ ] | [Main Prompt ▼] | [J1] [J2] |

3. **Column Definitions:**

   - **Bank First** (checkbox):
     - If checked: Try image bank first, use generation mode as fallback
     - If unchecked: Generate live immediately

   - **Mode** (dropdown):
     - Main Prompt
     - Guided GPT
     - Smart Prompt

   - **Prompt ID** (toggle buttons):
     - Shows only IDs for that page's tag (H pages show H1, H2, H3)
     - User clicks ONE to select it
     - Selected one is highlighted
     - Default: "General" or first prompt if none selected

4. **Filtering:**
   - When editing H tag rules, only show H pages
   - Quick filter by tag at top of page

### Part 3: Database Schema Changes

**New column in `site_pages` table (or create new `page_image_config` table):**
```sql
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS bank_first BOOLEAN DEFAULT false;
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS generation_mode VARCHAR(50) DEFAULT 'main_prompt';
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS assigned_prompt_id VARCHAR(10);
```

**New column in prompts storage (wherever main prompts are stored):**
```sql
-- Add prompt_id column to store H1, H2, H3, etc.
ALTER TABLE [prompt_table] ADD COLUMN IF NOT EXISTS prompt_id VARCHAR(10);
```

### Part 4: Image Generation Logic Update

**Location:** `server/routes/elementor.js` (and related generation code)

**Current flow:**
1. Get article's tag
2. Get workflow's `live_prompt_mode`
3. Select a prompt for that tag (rules-based or random)
4. Generate image

**New flow:**
1. Get article's tag and page info
2. Look up page's config: `bank_first`, `generation_mode`, `assigned_prompt_id`
3. If `bank_first` = true, check bank first
4. Use `generation_mode` for how to generate
5. Use `assigned_prompt_id` to get the EXACT prompt (no guessing)
6. Generate image

### Part 5: Phased Implementation

**Phase 1 (MVP):**
- Add prompt IDs to existing prompts (H1, H2, H3)
- Display IDs in UI (uneditable badges)
- Add the 3 columns to Site Planning
- Store per-page config in database
- Update generation to read per-page config

**Phase 2 (Enhancement):**
- Full-page expand mode for Site Planning
- Bulk assignment (select multiple pages, assign same prompt)
- Default prompt per tag (if no specific assignment)

## Key Files to Modify

| File | Changes |
|------|---------|
| `src/components/SitePlanningSection.tsx` | Add columns, expand mode, per-page config UI |
| `src/components/ImageCreationSection.tsx` | Display prompt IDs, auto-assign on create |
| `server/routes/site-planning.js` | API for saving page config |
| `server/routes/elementor.js` | Read per-page config during generation |
| Database migrations | Add new columns |

## UI Mockup (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Site Planning                                                    [Expand ⤢] │
├─────────────────────────────────────────────────────────────────────────────┤
│ Filter: [All ▼]  [H] [J] [C] [B] [E] [G]                                    │
├──────────────────────┬─────┬───────┬──────────────┬─────────────────────────┤
│ Page                 │ Tag │ Bank  │ Mode         │ Prompt                  │
│                      │     │ First │              │                         │
├──────────────────────┼─────┼───────┼──────────────┼─────────────────────────┤
│ House Cleaning       │ H   │ [ ]   │ [Main Prompt]│ (H1) (H2) (H3)         │
│ Move In/Out Cleaning │ H   │ [x]   │ [Main Prompt]│ (H1) [H2] (H3)  ←selected│
│ Kitchen Deep Clean   │ H   │ [ ]   │ [Guided GPT] │ (H1) (H2) [H3]         │
│ Office Cleaning      │ J   │ [ ]   │ [Main Prompt]│ [J1] (J2)              │
│ Retail Cleaning      │ J   │ [x]   │ [Smart]      │ (J1) [J2]              │
└──────────────────────┴─────┴───────┴──────────────┴─────────────────────────┘
```

## Questions for User
1. Should "General" be an option that uses rule-based selection as fallback?
2. What happens if a prompt is deleted but pages reference it? (Show warning? Auto-reassign?)
3. Should there be a "copy settings" feature to duplicate one page's config to others?

## Related Context
- The timezone setting was just added to global settings
- The Live + Main Prompt bug was fixed (avatar/config consistency between reads)
- Drip feed has per-website timezone settings

## Priority
HIGH - This is the "last thing" needed for the tagging system to be complete. Everything else is built, this connects the right prompt to the right page.
