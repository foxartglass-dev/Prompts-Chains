# PRD: Calibration Phase 3 — Debug Modes (Show Injection + A/B Toggle)

**Track:** Calibration
**Phase:** Cal-3 of 3
**Source:** BlueprintPage.tsx → PRD 3 (Calibration System Full Spec)
**Branch:** Assigned per implementation session
**Status:** Complete
**Depends On:** Cal-1 (injection layer) — Cal-2 (UI) NOT required for debug modes

---

## What

Two debug/diagnostic modes that let the user see exactly what the AI is receiving and prove whether calibration entries actually make a difference.

## Mode A — "Show Injection" (Transparency)

In the test viewer, show the **exact compiled context** that was used for a generation:

```
[System / Role block]
[Global Guardrails block]
[Tag Guardrails block]
[Calibration Pack block]    ← THIS is what you're exposing
[Page context block]
[Output contract block]
```

### Purpose
If something goes wrong with image generation, you can see whether:
- Calibration was missing entirely
- Calibration was included but ignored by the model
- Calibration conflicted with a guardrail
- The wrong calibration entries were selected

### UI
- Toggle or expandable panel in the test viewer area
- Shows the full compiled prompt with clear section labels
- Calibration Pack section highlighted so it's easy to spot

## Mode B — "Disable Calibration" (A/B Toggle)

Toggle to run the same prompt generation **with calibration off** for quick proof that a calibration item actually matters.

### Behavior
- When ON: calibration pack is excluded from the injection stack
- When OFF: normal behavior (calibration included)
- Side-by-side comparison: generate with vs without calibration
- Makes it scientific — you can prove a calibration entry helps or is useless

### UI
- Simple toggle button in the test/generation toolbar
- Visual indicator when calibration is disabled (e.g., yellow warning bar)
- Results labeled "With Calibration" vs "Without Calibration"

## Affected Files

- `src/components/ImageCreationSection.tsx` — test viewer area, generation toolbar
- `server/routes/prompt-assistant.js` — needs to accept a `disableCalibration` flag and skip the calibration pack injection step
- `src/components/TestingSlotsSelector.tsx` — display compiled context in test slot viewer

## Key Rules

- Show Injection must show the EXACT text sent to the AI — no summarization
- Disable Calibration toggle should not affect saved state — it's a runtime-only switch
- These are diagnostic tools — keep them unobtrusive (collapsible/toggle)

## Implementation Notes (Post-Completion Review)

**Verified correct:**
- Mode A (Show Injection): Captures exact compiled context at send-time in `handleSendGuidedAssistant`, renders with section labels and calibration highlighting
- Mode B (Disable Calibration): Runtime-only boolean, strips calibration at both client (context build) and server (prompt-assistant.js injection)
- Both modes integrated into Testing Mode toolbar as compact toggle buttons
- Warning bar appears when calibration is disabled (yellow A/B MODE indicator)
- Show Injection panel is collapsible with Copy button for clipboard export

**Also fixed Cal-1 gap:**
- `buildScopeBasedContext()` (~line 6029) now compiles and injects calibration pack when "guardrails" scope is selected
- Both code paths (handleSendGuidedAssistant + buildScopeBasedContext) respect disableCalibration toggle

**Design decisions:**
- Placed debug toolbar in Testing Mode (not in main prompt areas) since that's where testing/comparison happens
- Show Injection panel displays all context sections, not just calibration — helps diagnose ANY prompt issue
- Context capture happens after toggles are applied, so you see exactly what the AI receives
- Calibration pack compiler is duplicated in 2 places (handleSendGuidedAssistant + buildScopeBasedContext) — in rebuild, extract to shared utility
