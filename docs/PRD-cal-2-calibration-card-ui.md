# PRD: Calibration Phase 2 — Calibration Card UI + Promote Flow

**Track:** Calibration
**Phase:** Cal-2 of 3
**Source:** BlueprintPage.tsx → PRD 3 (Calibration System Full Spec)
**Branch:** Assigned per implementation session
**Status:** Not Started
**Depends On:** Cal-1 (data model + injection layer must exist first)

---

## What

Build the UI for creating, viewing, editing, and managing calibration entries. This includes the Calibration Library section, the card CRUD interface, and the "Promote to Calibration" flow from test slots.

## Calibration Card (CRUD UI — Template 1)

Each entry renders as a card with these fields:

| Field | Description |
|-------|-------------|
| Title | Short name (e.g. "Avoid model glam") |
| Tags | Multi-select of tags this applies to |
| Priority | Hard / Med / Soft selector |
| Human Note | FOR THE USER: what's off and what we want — the `human_note` field (readable description) |
| Trigger | When to apply (e.g. "any portrait with visible chest area") |
| Do (preferred) | What the preferred outcome looks like |
| Avoid (anti-pattern) | What to avoid |
| Enforcement wording | FOR THE AI: drop-in line injected into prompts — the `model_instruction` field |
| Enforcement tactics | 1-3 bullet tactics (camera/occlusion/crop/lighting wording) |
| Evidence | Bad/good image IDs (linked thumbnails) |
| Status | Pass/fail per tag + last tested timestamp |

Forces each calibration to be actionable with literal injectable wording.

## Calibration Library — UI Layout

- Dedicated collapsible **"Calibration Library"** sub-section under each prompt type area
- NOT buried in test slots — it's its own visible section
- Populated FROM test slot evidence
- Drag to reorder priority
- Version history visible
- Each tag page can show "calibration entries affecting this tag" filtered view

## "Promote to Calibration" Flow

1. User sees a near-miss image in a test slot
2. User clicks **"Create Calibration from This Result"** button on that test image
3. Button pre-fills card fields + attaches the image/prompt as evidence
4. Entry appears in Calibration Library
5. User can edit/refine the entry

### Near-Miss Logging (Phase 2 Workflow)

When user spots an image that's *nearly* right but slightly off, they log a calibration case from a test slot image. Each case captures:
1. Reference image (the near-miss)
2. What's wrong (1-2 sentences)
3. What correct looks like (1-2 sentences)
4. Optional corrected example image after prompt adjustment

## AI Chat Role in Calibration

When user pastes near-miss evidence (image + prompt), AI should:
1. Diagnose why it happened (prompt phrasing, rule conflict, missing negative)
2. Propose a calibration entry with both `human_note` and `model_instruction`
3. Suggest a targeted test to verify the fix

AI defaults to tagging new entries with only the current tag being tested.

## Affected Files

- `src/components/ImageCreationSection.tsx` — new Calibration Library sub-section under each prompt type
- `src/components/TestingSlotsSelector.tsx` — "Create Calibration from This Result" button on test images
- Possibly a new `CalibrationLibrary.tsx` component if the section is complex enough to extract

## Key Rules

- Calibration entries must be **atomic** (one idea per entry — don't bundle concepts)
- Keep entries short and crisp — models comply better with concise constraints
- Each entry has TWO text fields: `human_note` (for user) and `model_instruction` (for AI)
- Don't merge calibration UI into test slots — it's a separate, promoted section
