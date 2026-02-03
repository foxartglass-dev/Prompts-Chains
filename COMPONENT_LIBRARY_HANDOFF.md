# Component Library Injection - Handoff for Next Agent

## Problem Summary
Component Library components (sliders, templates) are NOT being injected into published WordPress pages, even though the UI shows everything configured correctly.

## Root Cause Identified
**`workflowId` is `undefined` when publish requests are made from the frontend.**

The backend checks `if (workflowId && isDatabaseEnabled())` before calling component selection. Since `workflowId` is undefined, the entire component injection code path is SKIPPED.

### Proof from Railway Logs:
```
workflowId: undefined,
...
[Elementor Publish] ⚠️ No workflowId or database not enabled
```

No `[ComponentLibrary]` logs appear because the code never runs.

---

## THE FIX (Already Attempted - Verify It Applied)

### File: `src/components/articles/ArticleListView.tsx`

There are **3 publish calls** that need `workflowId` added to the request body:

#### Location 1: ~Line 380 (publishToWordPress function)
```typescript
body: JSON.stringify({
  wpUrl,
  wpUser,
  wpPassword,
  title: stripTagFromKeyword(selectedArticle.keyword),
  content: editContent || selectedArticle.final_content,
  status: 'draft',
  articleId: selectedArticle.id,
  workflowId: selectedArticle.workflow_id,  // <-- ADD THIS
  isManualPush: true
})
```

#### Location 2: ~Line 465 (pushAllToWordPress function)
```typescript
body: JSON.stringify({
  wpUrl,
  wpUser,
  wpPassword,
  title: stripTagFromKeyword(selectedArticle.keyword),
  content: editContent || selectedArticle.final_content,
  status: 'draft',
  articleId: selectedArticle.id,
  workflowId: selectedArticle.workflow_id,  // <-- ADD THIS
  isManualPush: true
})
```

#### Location 3: ~Line 762 (pushArticleOnly function)
```typescript
body: JSON.stringify({
  wpUrl,
  wpUser,
  wpPassword,
  title: stripTagFromKeyword(selectedArticle.keyword),
  content: editContent || selectedArticle.final_content,
  status: 'draft',
  articleId: selectedArticle.id,
  workflowId: selectedArticle.workflow_id,  // <-- ADD THIS
  isManualPush: true,
  articleOnly: true
})
```

### Verification Command
Search for all publish calls missing workflowId:
```bash
grep -n "isManualPush: true" src/components/articles/ArticleListView.tsx
```

Then check each location to ensure `workflowId: selectedArticle.workflow_id` appears BEFORE `isManualPush`.

---

## Backend Code Flow (For Reference - Should NOT Need Changes)

Once `workflowId` is passed correctly, this is the flow:

### 1. Publish Endpoint Receives workflowId
**File:** `server/routes/elementor.js` ~Line 435
```javascript
workflowId, // Destructured from req.body
```

### 2. Component Selection is Called
**File:** `server/routes/elementor.js` ~Line 1745
```javascript
if (workflowId && isDatabaseEnabled()) {
  // This block is SKIPPED when workflowId is undefined
  const componentSelection = await selectComponentsForArticle(parseInt(workflowId), articleTag);
  if (componentSelection.enabled) {
    articleComponents = componentSelection;
    console.log('[Elementor Publish] Component Library enabled, selected components:', {...});
  }
}
```

### 3. Components are Passed to Page Builder
**File:** `server/routes/elementor.js` ~Line 1776
```javascript
const elementorData = buildElementorPage(chunked, {
  // ...other options
  components: articleComponents  // This is null when workflowId is undefined
});
```

### 4. Page Builder Injects Components
**File:** `server/services/elementor-builder.js` ~Lines 820-878
```javascript
// Slot 1 injection (top)
if (components?.slot1) {
  const slot1Widget = buildComponentWidget(components.slot1);
  if (slot1Widget) {
    pageElements.push(slot1Widget);
    console.log(`[ElementorBuilder] Injected slot1 component: ${components.slot1.name}`);
  }
}

// Slot 2 injection (middle) - ~Line 847
// Slot 3 injection (bottom) - ~Line 873
```

### 5. Widget Builders
**File:** `server/services/elementor-builder.js` ~Lines 408-438
```javascript
function buildSliderRevolutionWidget(alias) {
  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'shortcode',
    settings: { shortcode: `[rev_slider alias="${alias}"]` },
    elements: []
  };
}

function buildElementorTemplateWidget(templateId) {
  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'elementor-library',
    settings: { template_id: templateId.toString() },
    elements: []
  };
}
```

---

## Component Library Service (For Reference)

**File:** `server/services/component-library-service.js`

### Key Function: selectComponentsForArticle (~Line 96)
```javascript
export async function selectComponentsForArticle(workflowId, articleTag) {
  // Returns: { enabled: true/false, slot1: {...}, slot2: {...}, slot3: {...} }

  // 1. Gets settings from workflows.component_settings
  // 2. If enabled: false, returns early
  // 3. Gets components from component_library table
  // 4. Matches components to article tag (H, J, C) or falls back to Global
  // 5. Returns selected component for each slot
}
```

---

## What Success Looks Like

After the fix, Railway logs should show:
```
workflowId: 1,
...
[ComponentLibrary] Settings for workflow 1 - enabled: true
[ComponentLibrary] Found 6 active components
[ComponentLibrary] Slot 1 -> Residential Hero Slider (slider_revolution: home-1)
[ComponentLibrary] Slot 2 -> Stats Bar (elementor_template: 1134)
[ComponentLibrary] Slot 3 -> How The Process Works (elementor_template: 1146)
[ElementorBuilder] Injected slot1 component: Residential Hero Slider
[ElementorBuilder] Injected slot2 component: Stats Bar
[ElementorBuilder] Injected slot3 component: How The Process Works
```

---

## Files to Focus On (Priority Order)

1. **`src/components/articles/ArticleListView.tsx`** - Verify workflowId is in all 3 publish calls
2. **`server/routes/elementor.js`** - Only if workflowId IS being passed but components still not injecting
3. **`server/services/elementor-builder.js`** - Only if components are selected but not appearing in page

---

## Current Component Library Setup (Working in UI)

| Slot | Tag | Component Name | Type | Ref |
|------|-----|----------------|------|-----|
| 1 | H | Residential Hero Slider | slider_revolution | home-1 |
| 1 | J | Janitorial Hero Slider | slider_revolution | janitorial-1 |
| 1 | C | Construction Hero Slider | slider_revolution | construction-1 |
| 2 | Global | Stats Bar | elementor_template | 1134 |
| 3 | Global | How The Process Works | elementor_template | 1146 |
| 3 | Global | We Go The Extra Mile Page | elementor_template | 1137 |

---

## Quick Diagnostic Steps

1. **Check if fix applied:**
   ```bash
   grep -A2 "articleId: selectedArticle.id" src/components/articles/ArticleListView.tsx
   ```
   Should see `workflowId: selectedArticle.workflow_id` after each match.

2. **Test publish and check logs:**
   - Push any article manually
   - Look for `workflowId:` in logs - should NOT be `undefined`
   - Look for `[ComponentLibrary]` logs - should appear if workflowId is set

3. **If workflowId is correct but no components:**
   - Check `[ComponentLibrary] Settings for workflow X - enabled:` log
   - If `enabled: false`, toggle is off in UI
   - If `Found 0 active components`, database issue

---

## Previous Agent Work Summary

- Agent 1: Built the Component Library feature (introduced bugs)
- Agent 2: Unknown
- Agent 3 (me): Fixed blue screen errors, added debug logging, identified workflowId as root cause, pushed fix to branch

The fix was pushed but may not have merged correctly. **Start by verifying the fix is in the codebase.**
