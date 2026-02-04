# Next Agent Tasks

## Task 1: Per-Component Toggle Feature (NEW FEATURE)

### What User Wants
Add an enabled/disabled toggle for EACH component in the Component Library. Similar to the existing slot toggles, but for individual components within slots.

### UI Location
The toggle should appear on the **FAR LEFT** of each component row, pushing the "Global" badge to the right.

**Current layout:**
```
[Global badge] Component Name (template: 1146) [Remove button]
```

**Desired layout:**
```
[Toggle] [Global badge] Component Name (template: 1146) [Remove button]
```

### Files to Modify

| File | What to Do |
|------|------------|
| `server/db/migrations/032_add_component_enabled.sql` | CREATE: Add `enabled` column (BOOLEAN DEFAULT true) to `component_library` table |
| `src/components/ComponentLibrarySection.tsx` | Add toggle UI to each component row |
| `server/routes/component-library.js` | Handle `enabled` field in add/update endpoints |
| `server/services/component-library-service.js` | Filter out disabled components in `selectComponentsForArticle()` |

### Reference Implementation (Slot Toggles)
Slot toggles were already implemented and provide a pattern to follow. Look at:

**ComponentLibrarySection.tsx** - Search for these patterns:
- `handleSlotToggle` - Function that toggles individual slots
- `handleMasterSlotToggle` - Master toggle for all slots
- `slotConfig?.enabled` - How enabled state is checked
- The toggle UI element in the slot header

**component-library-service.js:132-137** - How disabled slots are skipped:
```javascript
const slotEnabled = slotConfig?.enabled !== false;
if (!slotEnabled) {
  console.log(`[ComponentLibrary] Slot ${slotNumber} -> DISABLED by toggle, skipping`);
  continue;
}
```

### Implementation Steps

1. **Create migration** (`server/db/migrations/032_add_component_enabled.sql`):
```sql
ALTER TABLE component_library
ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;
```

2. **Update API endpoints** (`server/routes/component-library.js`):
   - POST `/add` - Accept `enabled` field (default true)
   - PUT `/update/:id` - Accept `enabled` field
   - Ensure GET returns `enabled` field

3. **Update selection logic** (`server/services/component-library-service.js`):
   - In `selectComponentsForArticle()`, filter out disabled components:
   ```javascript
   // After getting slotComponents, filter by enabled
   const enabledComponents = slotComponents.filter(c => c.enabled !== false);
   ```

4. **Add toggle UI** (`src/components/ComponentLibrarySection.tsx`):
   - Add toggle to left of each component row
   - Create `handleComponentToggle(componentId, enabled)` function
   - Call API to update component enabled state

### User Preferences
- **Ask before coding** - Confirm approach before implementing
- **Don't push without asking** - Pushing causes Railway redeploy

---

## Task 2: Image Toggle Investigation (RESEARCH/DEBUG)

### The Problem
User reports the image toggle was set to "Off" for weeks, but images were still being generated when publishing articles.

### What I Found

**Toggle State Resolution** (`App.tsx:1259`):
```typescript
const effectiveWpPublishMode = publishModeOverrides?.wpPublishMode
  ?? currentProject?.state.wpPublishMode
  ?? 'draft';  // <-- DEFAULT IS 'draft', NOT 'off'
```

**Image Processing Decision** (`App.tsx:1467`):
```typescript
const shouldProcessImages = effectiveWpPublishMode !== 'off';
// 'draft' !== 'off' → true → IMAGES ARE PROCESSED
```

### Root Cause Hypothesis
The toggle defaults to `'draft'` if not saved to project state. The fallback chain is:
1. `publishModeOverrides?.wpPublishMode` (runtime override)
2. `currentProject?.state.wpPublishMode` (saved project state)
3. `'draft'` (hardcoded default)

If user sets toggle to "Off" but doesn't save the project, the state is lost on page refresh.

### Files to Investigate

| File | Lines | What to Check |
|------|-------|---------------|
| `App.tsx` | ~1259 | Toggle state resolution |
| `App.tsx` | ~1467 | `shouldProcessImages` decision |
| `App.tsx` | ~800-850 | Toggle UI component and state management |
| `src/components/ProjectSettings.tsx` | - | Where/how settings get saved |

### Questions to Answer

1. **Is the toggle state persisted on change?**
   - Look for `onChange` handler on the toggle
   - Does it call an API to save, or just update React state?

2. **When does project state get saved?**
   - Is there an explicit "Save" button?
   - Does it auto-save?

3. **What happens on page refresh?**
   - Is `currentProject?.state.wpPublishMode` populated from DB?
   - Or does it default to undefined/null?

### Potential Fixes (for next agent to evaluate)

1. **Auto-save on toggle change** - Persist to project state immediately when user toggles
2. **Change default** - Change fallback from `'draft'` to `'off'` (safer but changes behavior)
3. **Show warning** - If toggle is "Off" but not saved, show visual indicator
4. **Local storage backup** - Store toggle state in localStorage as backup

### How to Test

1. Set toggle to "Off"
2. Refresh the page
3. Check if toggle is still "Off" or reverted to default
4. Check Network tab - is there an API call to save the setting?
5. Check `currentProject.state` in React DevTools after refresh

---

## User Preferences (IMPORTANT)

1. **Ask before coding** - User explicitly said "don't code unless we absolutely have to"
2. **Check before pushing** - Ask if user is running anything before pushing code (causes Railway redeploy)
3. **Research first** - User prefers research/debugging before implementing fixes
4. **Document in Blueprint** - Add findings to Blueprint page for future reference

---

## Branch Info
- Branch: `claude/seven-sequential-tasks-1hmPM`
- Previous session: session_019At1C5rTV3E5xUcRALtAUN
