# PRD: Rules Checkbox Grid

**Track:** Non-Calibration
**Phase:** 3 of 3
**Source:** HANDOFF-PRD.md → Phase 3
**Status:** Complete (UI + Pipeline Integration)
**Branch:** Implemented on `claude/review-prd-testing-6QhNo`

---

## What

The Rules system already exists (Guided GPT Rules section, Smart Matching Rules section). Each rule needs a granular scope grid that controls which tags and prompt systems the rule applies to.

## Current State (What Already Exists)

The grid UI is already built:

- **"Set Scope" button** on each rule opens a popup checkbox grid (`ImageCreationSection.tsx` ~lines 19630-19790)
- **Grid structure** (~lines 19650-19657):
  - **Columns:** Dynamic tag names (H, J, C, etc.) + "All" — not hardcoded
  - **Rows:** Main Prompt, Main Categories, Guided Prompt, Guided Rules, Smart Prompt, Smart Rules
- **Cell IDs** use format `{tag}-{rowKey}` (e.g., `H-prompt`, `J-categories`, `All-guardrails`)
- **Bulk controls:** Column toggle, row toggle, Select All, Clear All
- **Display:** Button shows count "Scope (N)" when configured; abbreviations shown on rule card
- **TagBasedRule interface** (`ImageCreationSection.tsx` ~lines 338-348) includes `appliesTo?: string[]`
- **Database:** `guided_gpt_rules` and `legacy_prompt_rules` JSONB columns store the rules with their `appliesTo` arrays (`server/db/schema.sql` ~lines 314-319)

**What does NOT work yet:**
- The `appliesTo` array is stored but **never read during image generation**
- `server/services/image-pipeline.js` does not check any rule's `appliesTo` field
- Rules are not injected into prompts based on their scope — they are organizational metadata only

## Data Model

Already exists on each rule:

```typescript
interface TagBasedRule {
  id: string;
  tag: string;                    // 'H', 'J', 'C', or 'Global'
  title: string;
  text: string;
  order: number;
  globalAppliesTo?: string[];     // For Global rules: which tags they apply to
  appliesTo?: string[];           // Grid-selected targets: ['H-prompt', 'J-categories', 'All-guardrails']
  createdAt: string;
  updatedAt: string;
}
```

## Remaining Work

### Pipeline Integration
The image pipeline needs to read rules and inject them based on `appliesTo`:

1. **Load rules** — `buildPipelineOptions()` in `server/routes/articles.js` should pass `guided_gpt_rules` and `legacy_prompt_rules` to the pipeline
2. **Filter by tag + segment** — For each article's tag, find rules where `appliesTo` includes `{tag}-{segment}` or `All-{segment}`
3. **Inject into the correct pipeline stage:**
   - `*-prompt` → Append rule text to the main prompt for that system
   - `*-categories` → Apply rule as a filter/modifier to placeholder category matching
   - `*-guardrails` → Append rule text to Guided GPT guardrails instructions
   - `*-guided-rules` → Include in Guided GPT rules context
   - `*-smart` → Append rule text to Smart Prompt system instructions
   - `*-smart-rules` → Include in Smart Prompt rules context

### Injection Logic (Suggested Pattern)
```javascript
function getRulesForScope(allRules, tag, segment) {
  return allRules.filter(rule => {
    const targets = rule.appliesTo || [];
    return targets.includes(`${tag}-${segment}`) || targets.includes(`All-${segment}`);
  });
}
```

## Affected Files

- `server/routes/articles.js` — pass rules to pipeline via `buildPipelineOptions()`
- `server/services/image-pipeline.js` — read and inject rules at each pipeline stage
- `src/components/ImageCreationSection.tsx` — UI already done (Guided GPT Rules ~line 10260, Smart Matching Rules ~line 13820, Grid popup ~line 19630)

## Implementation Notes (Post-Completion Review)

**What was done:**
- Added `getRulesForScope(allRules, tag, segment)` and `buildRulesBlock(rules)` to `server/services/image-pipeline.js` (lines 19-47)
- Updated `buildPipelineOptions()` in `server/routes/articles.js` to combine `guided_gpt_rules` + `legacy_prompt_rules` into `allRules` array, plus extract `articleTag`
- Updated 3 callsites in `server/routes/elementor.js` to pass rules and tag to the pipeline
- Injected rules into all 3 prompt modes:
  - **Main Prompt**: `prompt` and `categories` rules appended after persistent text
  - **Guided GPT**: `guardrails` and `guided-rules` rules merged into `guardrails.instructions`
  - **Smart Prompt**: `smart` and `smart-rules` rules appended to each generated prompt
- 43 unit tests in `tests/rules-scope.test.js`

**Design decisions:**
- Rules with empty `appliesTo` are NOT injected (backward-compatible — they were never injected before)
- `All-*` segments match any tag, including unknown tags
- Rules from both `guided_gpt_rules` and `legacy_prompt_rules` are combined into a single array, enabling cross-system injection via the scope grid
- Injection order: base content → persistent text → rules (preserves existing injection stack)

## Key Rules

- Don't rename variables that other code depends on
- Don't rip out context injection blocks from chat functions
- Don't merge the 3 prompt systems together — they are SEPARATE systems
- Tags (H, J, C, etc.) are audience avatar tags
- "Global" is its own actual tag — don't use "Global" to mean "persistent across all tags"
