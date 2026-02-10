# Handoff PRD — Prompt System Restructure

## Session Context
- **Branch**: `claude/review-blueprint-page-7FM6a`
- **Last commit**: `7c21638` (WIP: toggle state restructured but UI not yet updated)
- **Build status**: BROKEN — toggle UI still references old state variable names
- **Previous session date**: 2026-02-10

## What Was Done (Completed Work)

### 1. Chat History Limit (DONE - commit `1a0e619`)
- All 6 chat functions now send only last 8 messages + current instead of full history
- Testing history capped to 5 iterations
- Article HTML content removed from context (metadata only)

### 2. Context Toggle State + Filters (DONE - commit `7c21638`)
- Unified toggle state declared at ~line 1013 of `ImageCreationSection.tsx`:
```typescript
const [contextToggles, setContextToggles] = useState({
    mainPrompt: false,       // Main Prompt: template + variations + avatars
    mainCategories: false,   // Main Prompt: placeholder categories/groups
    guidedPrompt: false,     // Guided GPT: prompt/instructions
    guidedRules: false,      // Guided GPT: rules (uniform, subject, avoid)
    smartPrompt: false,      // Smart Prompt: smart prompt + matching/placement rules
    testing: false,          // Testing: testing mode + articles (independent)
    problems: false,         // Problems: problem areas + solved problems (independent)
    imageBank: false,        // Image Bank: bank examples + reference images + logos (independent)
});
```
- Guided GPT context filter updated (~line 4819)
- Main Prompt context filter updated (~line 5169)
- Both filters use `contextToggles` with new field names

### 3. Smart Prompt Fields Added to Context (DONE - commit `4983435`)
- `smartPromptGuidance`, `matchingRules` (1-4), `placementRule`, `smartMatchingRule` added to frontend context object AND backend rendering in `server/routes/prompt-assistant.js`

---

## What Needs To Be Done (Priority Order)

### PHASE 0: Fix Toggle UI (URGENT — Build is Broken)

The toggle UI in both chat panels still references deleted state variables (`guidedContextToggles`, `mainPromptContextToggles`, `setGuidedContextToggles`, `setMainPromptContextToggles`).

**Files**: `src/components/ImageCreationSection.tsx`
**Locations**: Two identical toggle blocks:
- Main Prompt chat panel: ~line 8672
- Guided GPT chat panel: ~line 10236

**Replace both with this layout** (9 pills, one row):
```
Main: [Prompt] [Categories]  |  Guided: [Prompt] [Rules]  |  Smart: [Prompt]  |  [Testing] [Problems] [Bank]  |  [All]
```

**Colors**:
- Main Prompt labels/active pills: amber (amber-300 label, amber-600 active)
- Guided GPT labels/active pills: emerald (emerald-300 label, emerald-600 active)
- Smart Prompt labels/active pills: purple (purple-300 label, purple-600 active)
- Independent pills (Testing/Problems/Bank): sky (sky-600 active)
- Inactive pills: bg-slate-700/80 text-slate-300
- All button: sky-600 when all on, sky-600/40 when partial, slate when none

**Both panels show identical toggle bars** — they share the same `contextToggles` state.

**The `[All]` button** toggles all 8 fields on/off.

**Context filter mapping** (already coded, just documenting):
| Toggle | Context fields it controls |
|--------|--------------------------|
| mainPrompt | mainPrompt, variations, activeAvatar, allAvatars |
| mainCategories | placeholderMode, placeholderCategories |
| guidedPrompt | guardrails.instructions |
| guidedRules | guardrails.uniformRules, subjectRules, avoidRules |
| smartPrompt | smartPromptGuidance, matchingRules, placementRule, smartMatchingRule |
| testing | testingMode, articles |
| problems | problemAreas, solvedProblems |
| imageBank | imageBankExamples, referenceImages, logoImages, actionShots |

---

### PHASE 1: Prompt Top/Bottom Split

**What**: Every prompt text area in all 3 systems gets split into two text areas with a visible divider line between them.

**Top box** = Unique to active tag (changes when you switch between H, J, C tags)
**Bottom box** = Persistent across ALL tags (stays the same regardless of which tag is active)

**Example for Main Prompt (House Cleaning / H tag)**:
- Top (unique): "cleaning the kitchen sink", "cleaning the bathroom", "cleaning the refrigerator"
- Bottom (persistent): pose/camera angle rules, uniform info, logo strategy, diversity requirements

**Example for Guided GPT**:
- The current layout has: Guardrails/Instructions (one big text box), Uniform/Appearance, Default Subject, Avoid
- Change to: TWO big text boxes stacked vertically with a line between them
- Top = unique instructions for this tag
- Bottom = persistent instructions across all tags
- The Uniform/Appearance, Default Subject, Avoid fields below can stay as-is OR also get the same split (user can clarify)

**Data Model Changes Needed**:
Currently prompts are stored per-avatar. Need to add persistent storage:

For Main Prompt:
```
// Per avatar (unique per tag) — already exists
activeAvatar.mainPrompt → becomes the TOP (unique) portion

// New field — persistent across all tags
settings.mainPromptPersistent → the BOTTOM portion
// OR store on each avatar but sync across all:
activeAvatar.mainPromptPersistent
```

For Guided GPT:
```
// Currently per-tag prompts in guided_prompts array
// Need: per-tag unique portion + shared persistent portion
```

For Smart Prompt:
```
// Similar split needed
```

**UI Change**: One text area becomes two stacked text areas. Add a subtle horizontal divider line between them with labels like "Unique to [H]" and "All Tags" so the user knows which is which.

**Affected files**:
- `src/components/ImageCreationSection.tsx` — Main Prompt text area, Guided GPT prompt areas
- Database/settings model — new fields for persistent prompt portions
- Backend routes if they read prompt data

---

### PHASE 2: Categories — Unique/Persistent Toggle

**What**: Each placeholder category gets a radio toggle: **Unique** or **Persistent**

**Where it shows**: In the category card, near the category name. See screenshot — user showed Unique/Persistent buttons below each category card.

**Behavior**:
- **Unique**: This category only appears when the matching tag is active (e.g., "Cleaning Item" only for H)
- **Persistent**: This category appears for ALL tags (e.g., "Worker Persona" for H, J, C)

**Data Model**: Add to each category object:
```typescript
category.scope = 'unique' | 'persistent'  // default: 'unique'
```

**Also applies to Save Template**: When saving a template, track if it's unique or persistent. Could auto-detect based on what section you're saving from.

**File**: `src/components/ImageCreationSection.tsx` — wherever categories are rendered (the Placeholder Categories section on the right side of the avatar area)

---

### PHASE 3: Rules Checkbox Grid

**What**: The Rules system already exists (Guided GPT Rules section, Smart Matching Rules section). The current "Applies to: [x] H [x] J [x] C" checkboxes need to be replaced with a more powerful grid system.

**Current state** (from screenshot):
- Each rule has a text box + "Applies to: ☑H ☑J ☑C" inline checkboxes
- Simple per-tag checkboxes

**New behavior**:
- Each rule gets a **button** that opens a **popup checkbox grid**
- The grid is like the spreadsheet the user showed — rows and columns representing all segments:
  - Columns: Each tag (H, J, C, etc.) + "All Tags"
  - Rows: Each sub-segment (Main Prompt, Main Categories, Guided Prompt, Guided Rules, Smart Prompt, Smart Rules)
- User checks which boxes the rule applies to
- When grid is closed: show checked items as **comma-separated abbreviations** along the top of the rule box (e.g., "H-Prompt, J-Categories, All-Guardrails")
- Click the button again to reopen, edit checkboxes, close to save

**Data Model**: Add to each rule:
```typescript
rule.appliesTo = ['H-prompt', 'H-categories', 'J-prompt', 'All-guardrails', ...]
```

**Files**:
- `src/components/ImageCreationSection.tsx` — Guided GPT Rules section (~search for "Guided GPT Rules"), Smart Matching Rules section
- Settings/database model for storing appliesTo array

---

## Key Files Reference

| File | What's in it | Lines |
|------|-------------|-------|
| `src/components/ImageCreationSection.tsx` | ALL chat logic, toggle state, toggle UI, context builders, prompt areas | ~18,000 lines |
| `server/routes/prompt-assistant.js` | Backend for `/api/prompt-assistant/chat` — injects context into messages | Context rendering ~355-504 |
| `server/routes/image-creation.js` | Backend for `/api/image-creation/chat` — consultant/worker chats | |
| `src/pages/BlueprintPage.tsx` | Documentation/blueprint page (13 tabs) | ~6,400 lines |

## Critical Rules (from CLAUDE.md)

1. **Image Pipeline Order**: Images → Page → Meta (NEVER CHANGE)
2. **Never Overwrite Images**: Check `shouldUpdateImages` before any UPDATE
3. **State Preservation**: Don't reset saved state on refresh
4. **Don't Touch**: WorkflowNavigation.tsx, ClientsPage.tsx, workflow/prompt chain logic

## Architecture Notes

- **Stateless AI calls**: Every API call is independent. AI has zero memory between calls. "Seeing" data = data included in payload.
- **Context injection**: Backend takes a `context` object and prepends it as text to the first user message (prompt-assistant.js lines 507-513)
- **Code block auto-editing**: AI responses can contain special code blocks (` ```testprompt `, ` ```mainprompt `, ` ```instructions `, ` ```matchingrule1-4 `) that auto-update UI fields
- **Two API endpoints**: `/api/prompt-assistant/chat` (Guided GPT + Main Prompt chats) and `/api/image-creation/chat` (consultant, worker, generic chats)

## What NOT To Do

- Don't rename variables that other code depends on (previous agent broke everything by renaming `historyToSend`)
- Don't rip out context injection blocks from chat functions
- Don't merge the 3 prompt systems together — they are SEPARATE systems
- Don't add features beyond what's specified here
- Don't touch the image pipeline, workflow navigation, or clients page

## Naming Decisions

- **Rules stay as "Rules"** in both Guided GPT Rules and Smart Prompt sections
- The prompt areas naturally contain prompt + guardrails (instructions, uniform, subject, avoid)
- The "Rules" section below each prompt system is for overarching rules about image placement, consistency, etc.
- Tags (H, J, C, etc.) are audience avatar tags already in the system
- "Global" is its own actual tag — don't use "Global" to mean "persistent across all tags"
