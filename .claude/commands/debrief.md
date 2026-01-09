You are ending your session. Complete the following debrief process:

## Step 1: Review Your Changes
Run `git diff HEAD~3` or `git log --oneline -5` to see what you changed this session.

## Step 2: Read the Blueprint
Read `src/pages/BlueprintPage.tsx` to understand the current documentation structure.

## Step 3: Document Using the 7-Section Template

For each significant change, document:

1. **What Did You Change?** - Files modified/created/deleted
2. **What Was The Bug/Feature?** - Problem, Root Cause, Solution
3. **Data Flow Changes** - Before/After if you changed how data moves
4. **Critical Relationships** - Source of truth, order dependencies discovered
5. **What Could Break This?** - DO NOT / MUST ALWAYS rules
6. **How To Test This** - Step by step verification
7. **Unfinished Business** - TODOs, warnings, ideas

## Step 4: Add to Blueprint

Edit `src/pages/BlueprintPage.tsx` to add your documentation to the appropriate section:
- Image flow changes → `ImageFlowDiagram` component
- Push to WP changes → `PushAllDiagram` component
- Database/settings → `DataSourcesDiagram` component
- New rules discovered → `GoldenRules` component

## Step 5: Commit the Blueprint Update

```bash
git add src/pages/BlueprintPage.tsx
git commit -m "docs: Update Blueprint with [brief description of what you documented]"
```

DO NOT skip this process. The next agent needs your context.
