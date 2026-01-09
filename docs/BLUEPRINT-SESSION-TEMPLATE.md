# Blueprint Session Template

Give this to any agent at the END of their session to document what they worked on.

---

## Instructions for Agent

You just completed work on this codebase. Before ending, please fill out this template to document your changes for future agents. Be specific - the next agent won't have your context.

---

## SESSION REPORT

### 1. What Did You Change?

**Files Modified:**
```
- path/to/file.tsx (brief description of change)
- path/to/file.js (brief description of change)
```

**Files Created:**
```
- path/to/new/file.tsx (what it does)
```

**Files Deleted:**
```
- path/to/removed/file.tsx (why removed)
```

### 2. What Was The Bug/Feature?

**Problem Statement:** (1-2 sentences - what was broken or missing?)

**Root Cause:** (Why was it happening? What was the actual issue in the code?)

**Solution:** (How did you fix it? Be specific about the approach)

### 3. Data Flow Changes

If you changed how data moves through the system, document it:

```
BEFORE:
[Component A] → [API endpoint] → [Database table]

AFTER:
[Component A] → [New step] → [API endpoint] → [Database table]
```

### 4. Critical Relationships

Did you discover or create dependencies between parts of the system?

**Source of Truth:**
- `field_name` comes from `table_name` (not from X)

**Order Dependencies:**
- Step A must happen before Step B because...

**Conditional Logic:**
- When `condition`, then `behavior`

### 5. What Could Break This?

Future agents need to know what NOT to do:

**DO NOT:**
- [ ] Don't do X because it will cause Y
- [ ] Don't change Z without also updating W

**MUST ALWAYS:**
- [ ] Always do A before B
- [ ] Always check C when doing D

### 6. How To Test This

How would you verify this is still working?

```
1. Do X
2. Check Y
3. Expected result: Z
```

### 7. Unfinished Business

Anything you noticed but didn't fix? Edge cases? Known issues?

```
- TODO: Description of what still needs work
- WARNING: Potential issue in related area
```

---

## QUICK REFERENCE (for Blueprint Page)

If this should be added to the in-app Blueprint page, provide:

**Category:** (image-flow | push-all | data-sources | golden-rules | NEW CATEGORY)

**Diagram Box:** (if applicable)
```
[Box Title]
- Bullet 1
- Bullet 2
```

**New Golden Rule:** (if you discovered a rule the hard way)
```
Rule #X: Never do Y because Z
```

---

## HANDOFF NOTES

Anything the next agent absolutely needs to know to continue your work:

```
The current state is: ...
The next step would be: ...
Watch out for: ...
```
