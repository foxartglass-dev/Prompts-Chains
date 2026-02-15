# PRD: Categories Unique/Persistent Toggle

**Track:** Non-Calibration
**Phase:** 2 of 3
**Source:** HANDOFF-PRD.md → Phase 2
**Status:** Complete (UI + Pipeline + Templates)

---

## What

Each placeholder category gets a radio toggle: **Unique** or **Persistent**

## Where It Shows

In the category card, near the category name. Unique/Persistent buttons below each category card.

## Behavior

- **Unique:** This category only appears when the matching tag is active (e.g., "Cleaning Item" only for H)
- **Persistent:** This category appears for ALL tags (e.g., "Worker Persona" for H, J, C)

## Current State (What Already Exists)

The UI groundwork is in place:

- `PlaceholderCategory` interface has `scope?: 'unique' | 'persistent'` (`ImageCreationSection.tsx` ~line 89)
- Toggle buttons exist in the UI (`ImageCreationSection.tsx` ~lines 15242-15253) via `handleUpdatePlaceholderCategory()`
- Scope value is saved to the database per category

**What does NOT work yet:**
- When switching avatar tags, only that avatar's categories display — persistent categories from other avatars are not shown
- The image pipeline (`server/services/image-pipeline.js`) does not check `category.scope` at all
- `smartMatchForPosition()` processes only the selected avatar's `placeholderCategories` array with no cross-avatar merging

## Data Model

Already exists on each category object:

```typescript
category.scope = 'unique' | 'persistent'  // default: 'unique'
```

## Remaining Work

### 1. UI — Cross-avatar display
When viewing Avatar J, the categories list should include:
- J's own unique-scoped categories
- ALL persistent-scoped categories from every avatar (H, J, C, etc.)

### 2. Pipeline — Cross-avatar merging
When `selectAvatarForTag()` picks an avatar for image generation, collect persistent categories from all avatars and merge:
```javascript
function collectPlaceholderCategories(selectedAvatar, allAvatars) {
  const unique = (selectedAvatar.placeholderCategories || [])
    .filter(cat => cat.scope !== 'persistent');
  const persistent = allAvatars
    .flatMap(a => a.placeholderCategories || [])
    .filter(cat => cat.scope === 'persistent');
  // Deduplicate by id
  const seen = new Set(unique.map(c => c.id));
  const merged = [...unique, ...persistent.filter(c => !seen.has(c.id))];
  return merged;
}
```

### 3. Save Template Integration
When saving a template, preserve the `scope` field. Templates saved from a persistent category should default to `scope: 'persistent'`.

## Affected Files

- `src/components/ImageCreationSection.tsx` — category display logic (show persistent from all avatars)
- `server/services/image-pipeline.js` — `smartMatchForPosition()` needs merged categories
- `server/routes/articles.js` — pass all avatars (not just selected) so pipeline can merge

## Key Rules

- Don't rename variables that other code depends on
- Don't merge the 3 prompt systems together — they are SEPARATE systems
- "Global" is its own actual tag — don't use "Global" to mean "persistent across all tags"
- Categories are stored on each avatar's `placeholderCategories` array — don't move them to a separate table
