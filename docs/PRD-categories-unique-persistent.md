# PRD: Categories Unique/Persistent Toggle

**Track:** Non-Calibration
**Phase:** 2 of 3
**Source:** HANDOFF-PRD.md → Phase 2
**Branch:** `claude/fix-prompt-button-S8BcZ`
**Status:** Not Started

---

## What

Each placeholder category gets a radio toggle: **Unique** or **Persistent**

## Where It Shows

In the category card, near the category name. Unique/Persistent buttons below each category card.

## Behavior

- **Unique:** This category only appears when the matching tag is active (e.g., "Cleaning Item" only for H)
- **Persistent:** This category appears for ALL tags (e.g., "Worker Persona" for H, J, C)

## Data Model

Add to each category object:

```typescript
category.scope = 'unique' | 'persistent'  // default: 'unique'
```

## Save Template Integration

When saving a template, track if it's unique or persistent. Could auto-detect based on what section you're saving from.

## Affected Files

- `src/components/ImageCreationSection.tsx` — wherever categories are rendered (the Placeholder Categories section on the right side of the avatar area)

## Key Rules

- Don't rename variables that other code depends on
- Don't merge the 3 prompt systems together — they are SEPARATE systems
- "Global" is its own actual tag — don't use "Global" to mean "persistent across all tags"
