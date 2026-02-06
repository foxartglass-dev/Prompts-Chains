# PRD: Processing Log Article Summary View

## Priority: MEDIUM
## Estimated Complexity: Small (1 session, ~20-30% context)
## Date: 2026-02-06

---

## Problem

The Processing Log has two issues:

**1. History entries say "Unnamed Project"** — useless. When you click History, you see 4 entries all called "Unnamed Project" with truncated keyword lists ("Airbnb Cleaning(H), Vacation Home Cleaning(H)... +17 more"). No way to distinguish them at a glance.

**2. Clicking a history run dumps raw log firehose** — 302 lines of chronological detail with no structure. To find what happened with one specific article, you scroll through hundreds of lines looking for `[Sticker Removal(C)]` in the noise.

## Goal

Transform the Processing Log into a **two-level drill-down**:

**Level 1: History** — Shows runs with date/time + article count + ALL keywords visible in a grid (no truncation).

**Level 2: Inside a run** — Shows ALL keywords in a clickable grid. Click any keyword → its detail logs drop down below the grid. Click another keyword → swaps to that one's details. Non-article logs (errors, system messages) get their own section.

---

## Current Architecture (What Exists)

**File:** `/home/user/Prompted-Flows/App.tsx`

### Key Data Structures

```typescript
enum LogStatus { INFO, SUCCESS, ERROR, WORKING }

interface LogEntry {
  id: number;
  itemId?: number;     // Links log to specific article
  message: string;
  status: LogStatus;
  timestamp: string;
}

interface ProcessingRun {
  id: string;
  projectName: string;    // Currently "Unnamed Project" — FIX THIS
  date: string;           // ISO date string "2026-02-06"
  time: string;           // "01:45 PM"
  itemCount: number;      // 20, 27, etc
  itemNames: string[];    // ["Airbnb Cleaning(H)", "Vacation Home Cleaning(H)", ...]
  logs: LogEntry[];
  results: Result[];
}
```

### Key UI Locations

| What | Line | Description |
|------|------|-------------|
| State declarations | 214-222 | `isProcessing`, `processingLogCollapsed`, `processingHistory`, etc. |
| `addLog()` function | 319-328 | Adds log entries with auto-expand and auto-scroll |
| History run creation | 1685-1695 | Creates `ProcessingRun` at end of batch |
| Processing Log header | 3752-3769 | Collapsible section with entry count badge |
| History panel | 3846-3906 | Shows past runs as clickable cards |
| Sorting dropdown | 3777-3838 | Time Order, Group By, Display options |
| Log display | 3951-4050 | Raw log rendering with optional grouping |
| History run card | 3862-3888 | "Unnamed Project" + truncated item names |

### How Runs Are Named (The Problem)

Line 1685-1695 — when batch completes:
```javascript
const historyRun: ProcessingRun = {
  id: now.toISOString(),
  projectName: currentProject?.projectName || 'Unnamed Project',  // ← ALWAYS "Unnamed Project"
  date: now.toLocaleDateString(),
  time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  itemCount: itemsToProcess.length,
  itemNames: itemsToProcess.map(i => i.name),
  logs: [...logsRef.current, completionLog],
  results: currentResults
};
```

`currentProject?.projectName` is never set → always falls back to "Unnamed Project".

---

## What to Build

### Fix 1: Better Run Names (Replace "Unnamed Project")

**Change the `projectName` to use date + time + count:**

```javascript
// BEFORE (line ~1688):
projectName: currentProject?.projectName || 'Unnamed Project',

// AFTER:
projectName: `${now.toLocaleDateString()} • ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${itemsToProcess.length} articles`,
```

**Or even simpler** — just drop the `projectName` display entirely and use the `date`, `time`, and `itemCount` fields that already exist. The History card already shows date/time (line 3880-3883), so the "Unnamed Project" title is redundant.

### Fix 2: Show ALL Keywords in History Cards

**Currently (line 3885-3887):**
```jsx
<div className="mt-1 text-xs text-slate-500 truncate">
  {run.itemNames.slice(0, 3).join(', ')}{run.itemNames.length > 3 ? ` +${run.itemNames.length - 3} more` : ''}
</div>
```

**Replace with a keyword grid — all keywords visible, multi-column:**

```jsx
<div className="mt-2 flex flex-wrap gap-1">
  {run.itemNames.map((name, idx) => (
    <span key={idx} className="text-xs bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded">
      {name}
    </span>
  ))}
</div>
```

This uses flex-wrap to fill the available horizontal space with keyword pills. 20 keywords in a grid is scannable; "+17 more" is not.

### Fix 3: Keyword Grid View (When Viewing a Run)

When you click a history run (or when viewing the current session), instead of showing the raw log firehose, show:

```
┌──────────────────────────────────────────────────────────────────┐
│ 2026-02-06 • 01:45 PM                          20 articles      │
│                                                                  │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌────────────┐│
│  │✅ Airbnb Cleaning(H)│ │✅ Vacation Home(H)  │ │✅ Daily(J) ││
│  └─────────────────────┘ └─────────────────────┘ └────────────┘│
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌────────────┐│
│  │✅ Move In/Out(H)    │ │✅ Deep Cleaning(H)  │ │✅ Office(J)││
│  └─────────────────────┘ └─────────────────────┘ └────────────┘│
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌────────────┐│
│  │❌ Sticker Remove(C) │ │❌ Post Construct(C) │ │❌ Demo(C)  ││
│  └─────────────────────┘ └─────────────────────┘ └────────────┘│
│  ... (more keyword pills in rows)                                │
│                                                                  │
│  ⚠ System & Error Logs (3)                        [expand ▼]   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ ▼ Sticker Removal(C) — Detail Log                               │
│   1:43:51 PM  Article saved to database.                         │
│   1:43:52 PM  Publishing to WordPress...                         │
│   1:43:52 PM  STATUS: Article ✗ | Draft Bank ✗ | Website ✅     │
│   1:43:53 PM  Running prompt: "1.Service Pages..."               │
│   1:43:58 PM  Running prompt: "Service Page Outline"...          │
│   1:44:34 PM  Running prompt: "Service Page Article"...          │
│   1:45:21 PM  Generated final content.                           │
│   1:45:21 PM  Generating SEO meta...                             │
│   1:45:26 PM  Checking AI score with ZeroGPT...                  │
│   1:45:27 PM  AI score: 0%, Word count: 1049                     │
│   1:45:27 PM  Process finished. Status: PASSED                   │
│   1:45:27 PM  Publishing to WordPress...                         │
│   1:45:27 PM  Article saved to database.                         │
│   1:45:29 PM  STATUS: Article ✗ | Draft Bank ✗ | Website ✅     │
│   1:45:29 PM  Auto-pushing SEO meta...                           │
│   1:45:29 PM  SEO meta pushed successfully!                      │
│                                                                  │
│ Summary: 17 ✅ succeeded | 3 ❌ failed                          │
└──────────────────────────────────────────────────────────────────┘
```

### How the Keyword Grid Works

1. **Each keyword is a clickable pill** — colored by status:
   - ✅ Green border/bg for SUCCESS
   - ❌ Red border/bg for ERROR
   - ⟳ Yellow/pulsing for WORKING (still processing)
   - Gray for articles with no logs yet

2. **Click a keyword pill** → detail log section appears BELOW the grid, showing that article's processing log lines (filtered by `itemId`). The clicked pill gets highlighted.

3. **Click a different keyword** → detail section swaps to that article's logs. Only one article's details shown at a time (not multiple expandables — keeps it clean).

4. **Click the same keyword again** → collapses the detail section.

5. **"System & Error Logs" section** at the bottom of the grid — collapsible. Contains any log entries with no `itemId` (batch start, batch end, errors without article context). This is where you'd find issues like "Failed to fetch" that aren't tied to a specific article.

### Keyword Pill Component

```jsx
function KeywordPill({ name, status, isSelected, onClick }) {
  const statusStyles = {
    success: 'border-green-500/50 bg-green-500/10 text-green-400',
    error: 'border-red-500/50 bg-red-500/10 text-red-400',
    working: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400 animate-pulse',
    pending: 'border-slate-600 bg-slate-800 text-slate-400',
  };

  const selectedRing = isSelected ? 'ring-2 ring-brand-cyan' : '';

  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-xs rounded-lg border cursor-pointer hover:brightness-125 transition ${statusStyles[status]} ${selectedRing}`}
    >
      {status === 'success' && '✅ '}
      {status === 'error' && '❌ '}
      {status === 'working' && '⟳ '}
      {name}
    </button>
  );
}
```

### Deriving Article Status from Logs

```typescript
function getArticleStatus(logs: LogEntry[]): 'success' | 'error' | 'working' | 'pending' {
  if (logs.length === 0) return 'pending';
  const lastLog = logs[logs.length - 1];
  if (logs.some(l => l.status === LogStatus.ERROR)) return 'error';
  if (logs.some(l => l.status === LogStatus.SUCCESS)) return 'success';
  if (logs.some(l => l.status === LogStatus.WORKING)) return 'working';
  return 'pending';
}
```

---

## Implementation Steps

### Step 1: Fix Run Names

**File:** `App.tsx` (~line 1688)

Replace `projectName: currentProject?.projectName || 'Unnamed Project'` with either:
- Just remove the "Unnamed Project" fallback and show date/time/count instead
- Or auto-generate: `projectName: \`Batch ${itemsToProcess.length} articles\``

### Step 2: Show All Keywords in History Cards

**File:** `App.tsx` (~line 3885-3887)

Replace the truncated `slice(0, 3).join(', ')` with a flex-wrap grid of keyword pills. Each pill colored by status (derive from the run's logs + results).

### Step 3: Add "Summary" View Mode

**File:** `App.tsx` (~line 3951-4050)

Add new `logGroupBy === 'summary'` rendering that shows:
1. Run header (date, time, article count)
2. Keyword grid (all keywords as clickable pills)
3. Selected article's detail log (below grid, if any selected)
4. System & Error Logs collapsible section
5. Summary stats bar (X succeeded, Y failed)

Make `'summary'` the default value for `logGroupBy` (line ~217).

### Step 4: Add Expand/Collapse State for Selected Article

```typescript
const [selectedLogArticle, setSelectedLogArticle] = useState<string | null>(null);
const [showSystemLogs, setShowSystemLogs] = useState(false);
```

### Step 5: Add "Summary" to Sorting Dropdown

**File:** `App.tsx` (~line 3805-3826)

Add a "Summary" option to the "Group By" section of the dropdown.

---

## Existing Features to Preserve

- **Sorting dropdown** — all existing options (No Grouping, By Article, By Session) still work
- **History panel** — still shows past runs, now with better names and full keyword grids
- **Mode indicators** — Article: WP, Meta: WP, Image: Off badges unchanged
- **Auto-expand** on new log entry
- **Auto-scroll** to bottom during processing
- **localStorage persistence** for history
- **Copy/Clear** functionality

## What NOT to Do

- Do NOT remove existing view modes (No Grouping, By Article, By Session)
- Do NOT change the `LogEntry` interface — it has everything needed
- Do NOT change `addLog()` — data collection is fine, only changing display
- Do NOT add new API calls — this is purely frontend
- Do NOT change localStorage format — existing history data must still load
- Do NOT break the History panel — enhance it with better names + keyword grids

## Files to Modify

| File | Change |
|------|--------|
| `App.tsx` (~line 1688) | Fix "Unnamed Project" → meaningful run name |
| `App.tsx` (~line 3862-3888) | History cards: show all keywords in grid, better header |
| `App.tsx` (~line 3805-3826) | Add "Summary" to Sorting dropdown |
| `App.tsx` (~line 3951+) | Add summary view with keyword grid + detail dropdown |
| `App.tsx` (~line 217) | Change default `logGroupBy` to 'summary' |
| `App.tsx` (state section) | Add `selectedLogArticle` and `showSystemLogs` state |

## Database Changes

None. Purely frontend display improvement.

## Testing

1. Run a batch → verify keyword grid appears with status pills
2. Click a keyword → verify detail logs appear below grid
3. Click a different keyword → verify it swaps to that article's details
4. Click same keyword → verify it collapses
5. Verify failed articles show red pills
6. Click "System & Error Logs" → verify non-article logs show
7. Open History → verify runs show date/time/count (no "Unnamed Project")
8. Verify history cards show ALL keywords as pills (no truncation)
9. Click a history run → verify keyword grid loads with that run's data
10. Switch to other view modes → verify they still work
11. Verify auto-scroll and auto-expand during live processing
12. Verify localStorage history still loads correctly
