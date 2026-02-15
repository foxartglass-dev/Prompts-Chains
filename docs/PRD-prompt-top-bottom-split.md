# PRD: Prompt Top/Bottom Split

**Track:** Non-Calibration
**Phase:** 1 of 3
**Source:** HANDOFF-PRD.md → Phase 1
**Branch:** `claude/fix-prompt-button-S8BcZ`
**Status:** Not Started

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
- The Uniform/Appearance, Default Subject, Avoid fields below can stay as-is OR also get the same split (user can clarify)

## Data Model Changes

Currently prompts are stored per-avatar. Need to add persistent storage:

### For Main Prompt:
```
// Per avatar (unique per tag) — already exists
activeAvatar.mainPrompt → becomes the TOP (unique) portion

// New field — persistent across all tags
settings.mainPromptPersistent → the BOTTOM portion
// OR store on each avatar but sync across all:
activeAvatar.mainPromptPersistent
```

### For Guided GPT:
```
// Currently per-tag prompts in guided_prompts array
// Need: per-tag unique portion + shared persistent portion
```

### For Smart Prompt:
```
// Similar split needed
```

## UI Change

One text area becomes two stacked text areas. Add a subtle horizontal divider line between them with labels like "Unique to [H]" and "All Tags" so the user knows which is which.

## Affected Files

- `src/components/ImageCreationSection.tsx` — Main Prompt text area, Guided GPT prompt areas
- Database/settings model — new fields for persistent prompt portions
- Backend routes if they read prompt data

## Key Rules

- Don't rename variables that other code depends on
- Don't rip out context injection blocks from chat functions
- Don't merge the 3 prompt systems together — they are SEPARATE systems
- Tags (H, J, C, etc.) are audience avatar tags
- "Global" is its own actual tag — don't use "Global" to mean "persistent across all tags"
