# PRD: Rules Checkbox Grid

**Track:** Non-Calibration
**Phase:** 3 of 3
**Source:** HANDOFF-PRD.md → Phase 3
**Branch:** `claude/fix-prompt-button-S8BcZ`
**Status:** Not Started

---

## What

The Rules system already exists (Guided GPT Rules section, Smart Matching Rules section). The current "Applies to: [x] H [x] J [x] C" checkboxes need to be replaced with a more powerful grid system.

## Current State

- Each rule has a text box + "Applies to: ☑H ☑J ☑C" inline checkboxes
- Simple per-tag checkboxes

## New Behavior

- Each rule gets a **button** that opens a **popup checkbox grid**
- The grid is like a spreadsheet — rows and columns representing all segments:
  - **Columns:** Each tag (H, J, C, etc.) + "All Tags"
  - **Rows:** Each sub-segment (Main Prompt, Main Categories, Guided Prompt, Guided Rules, Smart Prompt, Smart Rules)
- User checks which boxes the rule applies to
- When grid is closed: show checked items as **comma-separated abbreviations** along the top of the rule box (e.g., "H-Prompt, J-Categories, All-Guardrails")
- Click the button again to reopen, edit checkboxes, close to save

## Data Model

Add to each rule:

```typescript
rule.appliesTo = ['H-prompt', 'H-categories', 'J-prompt', 'All-guardrails', ...]
```

## Affected Files

- `src/components/ImageCreationSection.tsx` — Guided GPT Rules section (~search for "Guided GPT Rules"), Smart Matching Rules section
- Settings/database model for storing appliesTo array

## Key Rules

- Don't rename variables that other code depends on
- Don't rip out context injection blocks from chat functions
- Don't merge the 3 prompt systems together — they are SEPARATE systems
