# Agent Handoff: Prompt-to-Page Assignment System

## Goal
Build a system that lets users assign specific prompts to specific pages, then run images in batches by mode (Main Prompt → Guided GPT → Smart Prompt).

---

## Part 1: Prompt ID System (All Three Modes)

### What to Build
Add permanent ID badges to ALL prompts in ALL three modes:
- **Main Prompt** prompts get: H1, H2, H3, J1, J2, etc.
- **Guided GPT** prompts get: H1, H2, H3, J1, J2, etc.
- **Smart Prompt** prompts get: H1, H2, H3, J1, J2, etc.

### UI Layout
```
┌─────────────────────────────────────────────────────────┐
│ Main Prompt (H tag)                                     │
├─────────────────────────────────────────────────────────┤
│ [H1] Navy Blue Product Photos           [Edit] [Delete] │
│ [H2] Lifestyle Cleaning Scenes          [Edit] [Delete] │
│ [H3] Before/After Shots                 [Edit] [Delete] │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Guided GPT (H tag)                                      │
├─────────────────────────────────────────────────────────┤
│ [H1] Let GPT decide style               [Edit] [Delete] │
│ [H2] GPT creative for special cases     [Edit] [Delete] │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Smart Prompt (H tag)                                    │
├─────────────────────────────────────────────────────────┤
│ [H1] Keyword-based matching             [Edit] [Delete] │
│ [H2] Alternative smart match            [Edit] [Delete] │
│ [H3] Fallback smart prompt              [Edit] [Delete] │
└─────────────────────────────────────────────────────────┘
```

### Key Rules
- **ID on far LEFT** in a colored circle/badge
- **ID is permanent and uneditable** - assigned on creation, never changes
- **ID is per-mode** - Main Prompt has its own H1, Guided GPT has its own H1
- **User-defined name is NEXT to the ID** - editable, for human understanding
- **IDs are for the SYSTEM** to match pages to prompts
- **Names are for the USER** to understand what each prompt does

### Database Changes
Add `prompt_id` column to wherever prompts are stored:
```sql
-- For each prompt storage location (main prompts, guided gpt prompts, smart prompts)
ALTER TABLE [prompt_table] ADD COLUMN IF NOT EXISTS prompt_id VARCHAR(10);
-- Example values: 'H1', 'H2', 'J1', 'J2', etc.
```

### Auto-Assignment Logic
When creating a new prompt:
1. Get the tag (H, J, C, etc.)
2. Count existing prompts with that tag in that mode
3. Assign next number: H1, H2, H3, etc.
4. Store in `prompt_id` column

---

## Part 2: Site Planning Page Columns

### What to Build
Add columns to Site Planning that show available prompt IDs for selection.

### UI Layout (Expanded Full Page)
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Site Planning                                                            [Expand ⤢]  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Filter by Tag: [All] [H] [J] [C] [B] [E] [G]                                         │
├────────────────────┬─────┬────────┬─────────────────┬──────────────┬─────────────────┤
│ Page               │ Tag │ Bank   │ Main Prompt     │ Guided GPT   │ Smart Prompt    │
│                    │     │ First  │                 │              │                 │
├────────────────────┼─────┼────────┼─────────────────┼──────────────┼─────────────────┤
│ House Cleaning     │ H   │  [ ]   │ ●H1 ○H2 ○H3    │ ○H1 ○H2      │ ○H1 ○H2 ○H3     │
│ Move In/Out Clean  │ H   │  [x]   │ ○H1 ●H2 ○H3    │ ○H1 ○H2      │ ○H1 ○H2 ○H3     │
│ Kitchen Deep Clean │ H   │  [ ]   │ ○H1 ○H2 ○H3    │ ●H1 ○H2      │ ○H1 ○H2 ○H3     │
│ Special Event      │ H   │  [ ]   │ ○H1 ○H2 ○H3    │ ○H1 ○H2      │ ●H1 ○H2 ○H3     │
│ Office Cleaning    │ J   │  [ ]   │ ●J1 ○J2        │ ○J1          │ ○J1 ○J2         │
│ Retail Cleaning    │ J   │  [x]   │ ○J1 ●J2        │ ○J1          │ ○J1 ○J2         │
└────────────────────┴─────┴────────┴─────────────────┴──────────────┴─────────────────┘
```

### Selection Rules
- **Radio button behavior ACROSS the three mode columns** - only ONE selection per row
- If you select H2 in Main Prompt, Guided GPT and Smart Prompt are all unselected
- Each column only shows prompt IDs that exist for that tag in that mode
- H pages show H1, H2, H3 (however many exist)
- J pages show J1, J2 (however many exist)

### Bank First Column
- **Checkbox** (independent of mode selection)
- If checked: Go to image bank first, use selected prompt as fallback
- If unchecked: Go directly to selected prompt (live generation)

### Database Changes
Add columns to `site_pages` table:
```sql
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS bank_first BOOLEAN DEFAULT false;
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS assigned_mode VARCHAR(20); -- 'main_prompt', 'guided_gpt', 'smart_prompt'
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS assigned_prompt_id VARCHAR(10); -- 'H1', 'H2', 'J1', etc.
```

---

## Part 3: Batch Execution by Mode

### What to Build
Instead of running all pages in one pass with different modes, run in batches:

1. **Run Main Prompt batch** - All pages with Main Prompt selected
2. **Run Guided GPT batch** - All pages with Guided GPT selected
3. **Run Smart Prompt batch** - All pages with Smart Prompt selected

### UI for Running
Add buttons or a run interface:
```
┌─────────────────────────────────────────────────────────┐
│ Run Images                                              │
├─────────────────────────────────────────────────────────┤
│ Bank First:    5 pages    [Run Bank]                    │
│ Main Prompt:  12 pages    [Run Main Prompt]             │
│ Guided GPT:    3 pages    [Run Guided GPT]              │
│ Smart Prompt:  2 pages    [Run Smart Prompt]            │
│                                                         │
│ [▶ Run All Sequentially]  ← ONE BUTTON, RUNS EVERYTHING │
└─────────────────────────────────────────────────────────┘
```

### Automated Sequential Execution
When "Run All Sequentially" is clicked, execute in order (6 batches):

```javascript
async function runAllSequentially() {
  // Bank First batches (check bank, fallback to assigned prompt)
  // 1. Bank + Main Prompt pages
  await runBatch({ bankFirst: true, mode: 'main_prompt' });

  // 2. Bank + Guided GPT pages
  await runBatch({ bankFirst: true, mode: 'guided_gpt' });

  // 3. Bank + Smart Prompt pages
  await runBatch({ bankFirst: true, mode: 'smart_prompt' });

  // Live batches (no bank check, straight to prompt)
  // 4. Main Prompt only pages
  await runBatch({ bankFirst: false, mode: 'main_prompt' });

  // 5. Guided GPT only pages
  await runBatch({ bankFirst: false, mode: 'guided_gpt' });

  // 6. Smart Prompt only pages
  await runBatch({ bankFirst: false, mode: 'smart_prompt' });

  // Done! All pages processed
}
```

**The 6 Sequential Runs:**
1. Bank + Main Prompt (check bank → fallback to Main Prompt H1/H2/H3)
2. Bank + Guided GPT (check bank → fallback to Guided GPT H1/H2)
3. Bank + Smart Prompt (check bank → fallback to Smart Prompt H1/H2/H3)
4. Main Prompt only (straight to Main Prompt, no bank check)
5. Guided GPT only (straight to Guided GPT, no bank check)
6. Smart Prompt only (straight to Smart Prompt, no bank check)

**Key points:**
- Each batch completes before the next starts
- No mixing within a batch - all pages in batch have same flow
- User clicks ONE button, walks away
- Progress UI shows which batch is running (e.g., "Bank + Main Prompt... 3/5")
- Individual "Run X" buttons still available if user wants manual control
- Empty batches are skipped automatically

### Execution Logic
When "Run Main Prompt" is clicked:
1. Query all pages where `assigned_mode = 'main_prompt'`
2. Set workflow's `live_prompt_mode = 'main_prompt'`
3. For each page:
   - Look up `assigned_prompt_id` (e.g., 'H2')
   - Fetch the specific prompt with that ID
   - Generate image using that exact prompt
4. Repeat for each page in the batch

### Why This Approach
- **Simpler to implement** - mode is set once per batch
- **Safer** - less likely to break existing code
- **Current code already supports** running with a single mode
- **Just need to add** filtering by assignment and prompt ID lookup

---

## Part 4: Implementation Steps

### Step 1: Add Prompt IDs to Existing Prompts
1. Find where Main Prompt, Guided GPT, and Smart Prompt data is stored
2. Add `prompt_id` column
3. Auto-assign IDs to existing prompts (H1, H2, H3 based on order)
4. Update UI to show ID badge on left, name on right

### Step 2: Add Site Planning Columns
1. Expand Site Planning to full-page mode (like Audience Avatar)
2. Add three columns: Main Prompt, Guided GPT, Smart Prompt
3. Show radio buttons with available IDs for each page's tag
4. Add Bank First checkbox column
5. Save selections to database

### Step 3: Add Batch Execution
1. Add "Run" section showing counts per mode
2. Add "Run Main Prompt" button that:
   - Filters pages by `assigned_mode`
   - Uses `assigned_prompt_id` to get exact prompt
   - Generates images
3. Repeat for Guided GPT and Smart Prompt buttons

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `src/components/ImageCreationSection.tsx` | Add prompt ID badges to all three modes |
| `src/components/SitePlanningSection.tsx` | Add columns, expand mode, selection UI |
| `server/routes/site-planning.js` | API for saving page assignments |
| `server/routes/elementor.js` | Read `assigned_prompt_id` during generation |
| Database | Add columns to prompts and site_pages tables |

---

## Current State Reference

### Where Prompts Are Stored
- Check `ImageCreationSection.tsx` for how Main Prompt, Guided GPT, Smart Prompt are stored
- They may be in workflow state, database, or both
- Need to identify exact storage location before adding `prompt_id`

### Current Generation Flow
- `server/routes/elementor.js` handles image generation
- `live_prompt_mode` is read from workflow config
- Avatar/prompt selection happens in the generation code
- Need to add lookup of `assigned_prompt_id` from page config

---

## Questions to Resolve
1. Where exactly are prompts stored for each mode? (workflow state? database table?)
2. Is Site Planning data in `site_pages` table or elsewhere?
3. Should there be a "default" option if no specific prompt is assigned?

---

## Success Criteria
- [ ] All prompts show H1, H2, H3 (etc.) badge on left side (in ALL three modes)
- [ ] Site Planning shows columns for all three modes with selectable IDs
- [ ] Bank First checkbox works independently
- [ ] "Run All Sequentially" button runs Bank → Main → Guided → Smart in order
- [ ] Individual "Run X" buttons still work for manual control
- [ ] Each page uses its exact assigned prompt ID
- [ ] Progress shows which batch is running and count (e.g., "Main Prompt 8/12")

## Site Planning Checkbox Behavior
- Remove/disable old "Select All" and "Start" buttons (they conflict with new system)
- Checkboxes become assignment trackers:
  - Auto-checked when page gets a prompt assignment
  - Unchecked = still needs assignment
  - Helps user see what's left to configure
