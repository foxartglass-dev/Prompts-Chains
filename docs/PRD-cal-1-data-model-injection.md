# PRD: Calibration Phase 1 — Data Model + Backend Injection Layer

**Track:** Calibration
**Phase:** Cal-1 of 3
**Source:** BlueprintPage.tsx → PRD 3 (Calibration System Full Spec)
**Branch:** Implemented on `claude/data-model-injection-dEICV` (not yet merged)
**Status:** Complete (one gap — see Implementation Notes)

---

## What

Build the data model, schema, and backend injection pipeline for the calibration system. This is the foundation layer — no UI yet, just storage and the injection stack that compiles calibration entries into prompts.

## Calibration Entry Schema

Each calibration entry stores:

```typescript
interface CalibrationEntry {
  id: string;                    // unique ID (e.g. CAL-007)
  title: string;                 // short name (e.g. "Avoid model glam")
  tags: string[];                // multi-select tags this applies to; "All" = global
  priority: 'hard' | 'medium' | 'soft';  // enforcement strength (hard = non-negotiable)
  human_note: string;            // FOR THE USER: what's off and what we want (readable description)
  model_instruction: string;     // FOR THE AI: the actual drop-in line injected into prompts
  trigger: string;               // when to apply (e.g. "any portrait with visible chest area")
  do_preferred: string;          // what the preferred outcome looks like
  avoid_antipattern: string;     // what to avoid
  enforcement_tactics: string[]; // 1-3 bullet tactics (camera/occlusion/crop/lighting wording)
  negative_constraints?: string[];      // optional short negative list
  evidence_bad_image_ids?: string[];    // near-miss image references
  evidence_good_image_ids?: string[];   // target/good image references
  per_tag_test_status?: Record<string, { pass: boolean; testedAt: string }>;
  createdAt: string;
  updatedAt: string;
  source_test_image_id?: string; // links back to the test image that triggered it
}
```

Stored alongside entries on the settings table:
```typescript
calibration_version: number  // auto-increments when entries change (v1/v2/v3 tracking + rollback)
```

### Key Design Decision — Two Text Fields Per Entry

1. **human_note** — for the user: "What's off and what we want" (readable description)
2. **model_instruction** — for the AI: the actual drop-in line used in prompts. THIS is the critical field.

### Tag Management

**Per-tag with progressive expansion.** Each entry starts attached to the ONE tag it was tested on. As you verify it works on more tags, add them via multi-select. Once verified on all tags, check "All" for global. You can always remove a tag if it stops working. The `per_tag_test_status` field lets you scientifically track whether a rule is niche or global over time.

## Drop-in Line Format (Template 2)

Each entry's `model_instruction` should follow this format:

```
[CAL:Title | Strength] Do …; Avoid …; Prefer …
```

Example:
```
[CAL:Everyday employee look | Hard] Depict a realistic worker with natural skin texture and minimal makeup; avoid glam/influencer styling; prefer practical hair and functional posture.
```

## Calibration Pack (Template 3 — Compiled Block for Injection)

When generating for a specific tag, compile a block like:

```
Calibration Pack — Tag H (sorted by priority):
1. (Hard) [drop-in line]
2. (Hard) [drop-in line]
3. (Medium) [drop-in line]
```

Meta-instruction included: "If a calibration item conflicts with guardrails, guardrails win. If two calibration items conflict, higher priority wins; if same priority, most recent wins."

## Injection Stack (Where Calibration Goes in the Prompt)

**Critical: Calibration is a DYNAMIC LAYER between guardrails and page context. Never bake it into permanent guardrails.**

When generating an image prompt (Guided GPT flow), build context in this exact order:

1. **System / Role** (already exists)
2. **Global Guardrails** (persistent instructions — always included)
3. **Tag Guardrails** (only for the active tag)
4. **Calibration Pack (DYNAMIC)** — filtered by tag, sorted by priority, limited to top 12-20
5. **Page context** (the ~75 words around image placement)
6. **Output contract** ("Output ONLY the final prompt…")

**Why this order:** Calibration refines output without overriding fundamentals. Placing it after guardrails prevents calibration from accidentally relaxing hard rules.

## Query Logic (What Gets Injected)

Given `active_tag`:
1. Include items where `active_tag in tags[]`
2. Also include items marked "All" (global)
3. Sort by priority desc (Hard → Med → Soft), then updatedAt desc
4. Limit to **12-20 max** (avoid prompt bloat)
5. Render as numbered bullet list using Template 3 format

Inject calibration pack into all frontend context builders that include guardrails:
- `handleSendGuidedAssistant()` at `ImageCreationSection.tsx:~5284` (**done** — pack compiled client-side, added to context object after guardrails)
- `buildScopeBasedContext()` at `ImageCreationSection.tsx:~5928` (**gap** — guardrails are included here but calibration is not; needs to be added alongside the guardrails section under `anyTagSelected('guardrails')`)
- `guided-generate` endpoint context at `ImageCreationSection.tsx:~6540` (optional — Auto-Refine flow, lower priority)

## Conflict Resolution

Simple rule:
1. Guardrails always beat calibration
2. Higher priority calibration wins
3. Same priority → most recent wins

## Integration with Test Slots

Add `calibrationNote?: string` and `correctedPrompt?: string` fields to the `testImages` array items in TestingSlotContent (already at `TestingSlotsSelector.tsx:114-123`). A near-miss is literally a test slot image + annotation.

## Affected Files

- `server/db/migrations/035_add_calibration_system.sql` — adds `calibration_entries` (JSONB) and `calibration_version` (INTEGER) columns to `image_creation_settings`
- `server/routes/calibration.js` — full CRUD API + pack compiler (new file)
- `server/index.js` — registered calibration routes at `/api/calibration`
- `server/routes/prompt-assistant.js` — injection of calibration pack into context builder (line ~460, after guardrails/guided instructions, before reference images)
- `server/routes/image-creation.js` — `tryUpdateCalibration` pattern for graceful migration, calibration fields in GET response and defaults
- `src/components/ImageCreationSection.tsx` — CalibrationEntry interface, settings fields, data loading, client-side pack compilation in `handleSendGuidedAssistant` (~line 5284)
- `src/components/TestingSlotsSelector.tsx` — `calibrationNote` and `correctedPrompt` fields added to testImages (lines 122-124)

## Implementation Notes (Post-Completion Review)

**Verified correct:**
- Backend injection position (prompt-assistant.js:460) — after guardrails, before reference images
- Pack compiler — filter by tag/All, sort by priority then recency, limit 12-20
- CRUD API — follows Golden Rule 8 (website_id FIRST), empty-array protection (Golden Rule 1)
- `tryUpdateCalibration` — graceful migration handling, follows `tryUpdateXxx` pattern
- TestingSlotsSelector fields — correctly placed in testImages array

**Gap to fix before Cal-2:**
- `buildScopeBasedContext()` (~line 5928) does NOT include calibration pack. This is the scope-based context builder used by the unified chat system. Since it already includes guardrails under `anyTagSelected('guardrails')`, calibration should be compiled and added there too (after `guidedInstructionsPersistent`, before the next section). Without this, scope-based chat sessions won't see calibration data.

## Key Rules

- Calibration is a DYNAMIC LAYER — never bake into permanent guardrails
- Guardrails > Calibration always
- Entries must be atomic (one idea per entry)
- Keep entries short and crisp — models comply better with concise constraints
