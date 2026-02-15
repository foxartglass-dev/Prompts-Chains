# PRD: Prompt Top/Bottom Split

**Track:** Non-Calibration
**Phase:** 1 of 3
**Source:** HANDOFF-PRD.md → Phase 1
**Status:** Completed

---

## What

Every prompt text area in all 3 systems gets split into two text areas with a visible divider line between them.

**Top box** = Unique to active tag (changes when you switch between H, J, C tags)
**Bottom box** = Persistent across ALL tags (stays the same regardless of which tag is active)

## Examples

### Main Prompt (House Cleaning / H tag)
- **Top (unique):** "cleaning the kitchen sink", "cleaning the bathroom", "cleaning the refrigerator"
- **Bottom (persistent):** pose/camera angle rules, uniform info, logo strategy, diversity requirements

### Guided GPT
- The current layout has: Guardrails/Instructions (one big text box), Uniform/Appearance, Default Subject, Avoid
- **Change to:** TWO big text boxes stacked vertically with a line between them
- Top = unique instructions for this tag
- Bottom = persistent instructions across all tags
- The Uniform/Appearance, Default Subject, Avoid sub-fields stay as-is (tag-specific, no split needed)

## Data Model

Three persistent columns added via migration 032 (`032_add_persistent_prompt_fields.sql`):

```sql
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS main_prompt_persistent TEXT DEFAULT '';
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS guided_instructions_persistent TEXT DEFAULT '';
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS smart_prompt_persistent TEXT DEFAULT '';
```

### Storage Pattern:
- **Top (unique):** Stored per-avatar as before (`activeAvatar.mainPrompt`, per-tag `guided_prompts`, per-tag `smart_prompts`)
- **Bottom (persistent):** Stored at settings level (`settings.main_prompt_persistent`, `settings.guided_instructions_persistent`, `settings.smart_prompt_persistent`)

## UI

One text area becomes two stacked text areas. A subtle horizontal divider line separates them with labels "Unique to [tag]" (top) and "All Tags" (bottom).

All three prompt systems have this split:
- **Main Prompt** — `ImageCreationSection.tsx` (~line 15025)
- **Guided GPT** — `ImageCreationSection.tsx` (~line 10167)
- **Smart Prompt** — `ImageCreationSection.tsx` (~line 12801)

## Pipeline Integration

Persistent prompts are concatenated during image generation in `server/services/image-pipeline.js`:

- **Main Prompt mode** (~lines 385-389, 445-449): Appends `mainPromptPersistent` to each prompt
- **Guided GPT mode** (~lines 489-494): Merges `guidedInstructionsPersistent` into guardrails instructions
- **Smart Prompt mode** (~lines 618-628): Appends `smartPromptPersistent` to each AI-generated prompt

Wiring in `server/routes/articles.js` `buildPipelineOptions()` (~lines 116-119) passes all three persistent fields to the pipeline.

## Affected Files

- `src/components/ImageCreationSection.tsx` — UI split for all 3 prompt systems
- `server/db/migrations/032_add_persistent_prompt_fields.sql` — DB columns
- `server/routes/articles.js` — `buildPipelineOptions()` passes persistent fields
- `server/services/image-pipeline.js` — concatenation during generation
- `src/components/TestingSlotsSelector.tsx` — `TestingSlotContent` interface includes persistent fields

## Known Pre-Existing Issues (Not Introduced by This PRD)

- **Guided GPT top textarea** (~line 10172) doesn't check `isViewingTestSlot` — edits while viewing a test slot go to the live prompt
- **Smart Prompt top textarea** (~line 12806) — same issue
- These are pre-existing from before the split. The bottom (persistent) textareas correctly handle test slot mode. Fixing the top ones requires changes to per-tag array handling in `TestingSlotContent` — recommend as a separate task.

## Key Rules

- Don't rename variables that other code depends on
- Don't rip out context injection blocks from chat functions
- Don't merge the 3 prompt systems together — they are SEPARATE systems
- Tags (H, J, C, etc.) are audience avatar tags
- "Global" is its own actual tag — don't use "Global" to mean "persistent across all tags"
