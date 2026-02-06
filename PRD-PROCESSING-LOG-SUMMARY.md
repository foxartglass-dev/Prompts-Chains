# PRD: Processing Log Article Summary View

## Priority: MEDIUM
## Estimated Complexity: Small (1 session, ~20-30% context)
## Date: 2026-02-06

---

## Problem

The Processing Log shows every detail line from every article in one continuous scroll (~20 lines per article). After a 46-article batch:
- 900+ lines of undifferentiated scroll
- No way to tell which articles were processed at a glance
- No visual break between articles (unless you manually set "Group By Article" in Sorting)
- To find what failed, you scroll through hundreds of lines
- When diagnosing failures (like the batch crash at article 8), finding the exact failure point takes forever

## Goal

Add a **Summary View** as the default view for the Processing Log. Shows a clean, scannable list of articles with status/time. Tap any article to expand its detail logs. Get to the problem in seconds, not minutes.

---

## Current Architecture (What Exists)

**File:** `/home/user/Prompted-Flows/App.tsx`

### Existing Data Structures

```typescript
// Line 43-48
enum LogStatus {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  WORKING = 'WORKING',
}

// Line 50-56
interface LogEntry {
  id: number;
  itemId?: number;     // ← KEY: Links log to specific article
  message: string;
  status: LogStatus;
  timestamp: string;
}

// Line 58-68
interface ProcessingRun {
  id: string;
  projectName: string;
  date: string;
  time: string;
  itemCount: number;
  itemNames: string[];
  logs: LogEntry[];
  results: Result[];
}
```

### Existing Features (Don't Break These)
- **Sorting dropdown** (line 3777-3838): Newest/Oldest, Group By None/Article/Session, Show Timestamps
- **Group By Article** (line 3964-3992): Already groups logs by `itemId` with headers, but still shows ALL detail lines
- **History panel** (line 3846-3906): Shows past processing runs, click to load logs
- **Mode indicators** (line 3907-3933): Article: WP/Draft, Meta: WP/Draft, Image: WP/Draft/Off
- **Auto-expand** on new log entry (line 320-321)
- **Auto-scroll** to bottom (line 325)
- **localStorage persistence** for history (line 392-408)

### How Articles Are Identified in Logs

Each log entry from a batch run includes `itemId` (the article/item ID). The article name is extracted from the log message via regex: `log.message.match(/\[([^\]]+)\]/)?.[1]` (line 3974).

Log messages follow the pattern:
```
[Kitchen Remodeling in Nashville(H)] Starting prompt chain...
[Kitchen Remodeling in Nashville(H)] Model: gpt-4o, generating content...
[Kitchen Remodeling in Nashville(H)] Content generated successfully (1,247 words)
[Kitchen Remodeling in Nashville(H)] Publishing to WordPress...
[Kitchen Remodeling in Nashville(H)] ✅ Published successfully (wp_post_id: 4523)
```

System messages (batch start/end) have no `itemId`:
```
Starting batch processing for 46 items using 1 model(s): gpt-4o...
Batch processing complete in 12.5 minutes.
```

---

## What to Build

### New View Mode: "Summary" (Default)

Add a new option to the existing Group By dropdown in the Sorting menu:

```
Group By:
  ○ No Grouping      (existing - raw log stream)
  ○ By Article        (existing - grouped with all details showing)
  ○ By Session        (existing - grouped by batch run)
  ● Summary           (NEW - default - article list with expand/collapse)
```

**Make "Summary" the default** instead of "No Grouping".

### Summary View Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Processing Log                      [History] [Sorting ▼]        │
│ 46 entries                                                       │
├──────────────────────────────────────────────────────────────────┤
│ Article: WP  Meta: WP  Image: Off  📦 Bank: 0  ⚡ Live: 0      │
├──────────────────────────────────────────────────────────────────┤
│ Current Session                                                  │
│                                                                  │
│  ℹ Starting batch processing for 46 items...            2:30 AM │
│                                                                  │
│  ✅ Kitchen Remodeling in Nashville(H)         2:31 — 2:33 AM   │
│  ✅ Bathroom Renovation in Franklin(H)         2:33 — 2:35 AM   │
│  ✅ Flooring Guide in Brentwood(C)             2:35 — 2:37 AM   │
│  ✅ Plumbing Services in Lebanon(J)            2:37 — 2:38 AM   │
│  ✅ HVAC Installation Nashville(H)             2:38 — 2:40 AM   │
│  ✅ Roof Repair in Hendersonville(C)           2:40 — 2:42 AM   │
│  ✅ Window Cleaning in Gallatin(J)             2:42 — 2:43 AM   │
│  ✅ Gutter Cleaning in Mt Juliet(H)            2:43 — 2:45 AM   │
│  ❌ Demolition Cleanup Henderson(C)            2:45 AM  FAILED  │
│  ❌ Post Construction Cleaning(C)              2:45 AM  FAILED  │
│  ❌ Sticker Removal(C)                         2:45 AM  FAILED  │
│  ... (35 more failed)                                            │
│                                                                  │
│  ℹ Batch processing complete in 15.2 minutes.          2:45 AM  │
│                                                                  │
│  Summary: 8 succeeded, 38 failed                                 │
└──────────────────────────────────────────────────────────────────┘
```

### Expand/Collapse Per Article

Click any article row to expand its detail logs:

```
│  ✅ Kitchen Remodeling in Nashville(H)         2:31 — 2:33 AM   │
│  ▼ Bathroom Renovation in Franklin(H)          2:33 — 2:35 AM   │
│    ├─ [2:33:02] Starting prompt chain...                         │
│    ├─ [2:33:05] Model: gpt-4o, generating content...             │
│    ├─ [2:33:45] Content generated successfully (1,247 words)     │
│    ├─ [2:34:01] Publishing to WordPress...                       │
│    ├─ [2:34:15] Processing images...                             │
│    └─ [2:35:02] ✅ Published (wp_post_id: 4523)                 │
│  ✅ Flooring Guide in Brentwood(C)             2:35 — 2:37 AM   │
│  ▼ Demolition Cleanup Henderson(C)             2:45 AM  FAILED  │
│    ├─ [2:45:01] Starting prompt chain...                         │
│    ├─ [2:45:03] Model: gpt-4o, generating content...             │
│    └─ [2:45:04] ❌ ERROR: Failed to fetch                       │
│  ❌ Post Construction Cleaning(C)              2:45 AM  FAILED  │
```

### Summary Stats Bar (Bottom)

After all articles, show a quick summary:

```
Summary: 8 succeeded ✅ | 38 failed ❌ | Duration: 15.2 min
```

### System Messages

Non-article log entries (batch start, batch end, system info) are shown inline between articles, styled differently:

```
│  ℹ Starting batch processing for 46 items using gpt-4o...   │  ← System (blue, italic)
│  ✅ Kitchen Remodeling in Nashville(H)      2:31 — 2:33 AM  │  ← Article (green)
```

---

## Implementation

### Step 1: Build the Summary Grouping Logic

Add to `App.tsx` after the existing `logGroupBy === 'session'` block (~line 3995):

```typescript
if (logGroupBy === 'summary') {
  // Group logs by itemId, compute per-article status
  const articleGroups: Array<{
    key: string;
    name: string;
    itemId: number | undefined;
    logs: LogEntry[];
    status: 'success' | 'error' | 'working' | 'info';
    startTime: string;
    endTime: string;
  }> = [];

  let currentGroup: typeof articleGroups[0] | null = null;

  // Process logs in chronological order
  const chronoLogs = [...logs]; // already chronological
  chronoLogs.forEach(log => {
    if (!log.itemId) {
      // System message — push as its own "group"
      articleGroups.push({
        key: `system-${log.id}`,
        name: log.message,
        itemId: undefined,
        logs: [log],
        status: log.status === LogStatus.ERROR ? 'error' : 'info',
        startTime: log.timestamp,
        endTime: log.timestamp,
      });
      currentGroup = null;
    } else if (!currentGroup || currentGroup.itemId !== log.itemId) {
      // New article group
      currentGroup = {
        key: `article-${log.itemId}-${log.id}`,
        name: log.message.match(/\[([^\]]+)\]/)?.[1] || `Article #${log.itemId}`,
        itemId: log.itemId,
        logs: [log],
        status: 'working',
        startTime: log.timestamp,
        endTime: log.timestamp,
      };
      articleGroups.push(currentGroup);
    } else {
      // Same article, add to current group
      currentGroup.logs.push(log);
      currentGroup.endTime = log.timestamp;
      // Update status based on last significant log
      if (log.status === LogStatus.ERROR) currentGroup.status = 'error';
      else if (log.status === LogStatus.SUCCESS) currentGroup.status = 'success';
    }
  });

  // Render summary view
  return articleGroups.map(group => {
    if (!group.itemId) {
      // System message — render inline
      return (/* system message row */);
    }
    // Article row with expand/collapse
    return (/* article summary row with onClick toggle */);
  });
}
```

### Step 2: Add Expand/Collapse State

```typescript
const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());

const toggleArticleExpand = (key: string) => {
  setExpandedArticles(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
};
```

### Step 3: Add Summary Stats Calculation

```typescript
const summaryStats = useMemo(() => {
  if (logGroupBy !== 'summary') return null;
  // ... compute succeeded/failed/total counts from articleGroups
}, [logs, logGroupBy]);
```

### Step 4: Make "Summary" the Default

Change line 217:
```typescript
// BEFORE:
const [logGroupBy, setLogGroupBy] = useState<string>('none');

// AFTER:
const [logGroupBy, setLogGroupBy] = useState<string>('summary');
```

### Step 5: Add "Summary" Option to Sorting Dropdown

Add after the "By Session" button (around line 3820-3826):

```jsx
<button
  onClick={() => { setLogGroupBy('summary'); }}
  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition flex items-center justify-between ${logGroupBy === 'summary' ? 'text-brand-cyan' : 'text-white'}`}
>
  <span>Summary</span>
  {logGroupBy === 'summary' && <span className="text-brand-cyan">✓</span>}
</button>
```

---

## Styling

### Article Row (Collapsed)

```jsx
<div
  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-800/50 transition ${
    group.status === 'success' ? 'text-green-400' :
    group.status === 'error' ? 'text-red-400' :
    group.status === 'working' ? 'text-yellow-400 animate-pulse' :
    'text-blue-400'
  }`}
  onClick={() => toggleArticleExpand(group.key)}
>
  <div className="flex items-center gap-2">
    {/* Status icon */}
    {group.status === 'success' && <span>✅</span>}
    {group.status === 'error' && <span>❌</span>}
    {group.status === 'working' && <span className="animate-spin">⟳</span>}
    {/* Article name */}
    <span className="font-medium text-sm">{group.name}</span>
  </div>
  <div className="flex items-center gap-2 text-xs text-slate-400">
    {/* Time range */}
    <span>{group.startTime}{group.endTime !== group.startTime ? ` — ${group.endTime}` : ''}</span>
    {/* Failed badge */}
    {group.status === 'error' && <span className="bg-red-600/30 text-red-400 px-1.5 py-0.5 rounded text-xs font-semibold">FAILED</span>}
    {/* Expand indicator */}
    <svg className={`w-3 h-3 transition-transform ${expandedArticles.has(group.key) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
    </svg>
  </div>
</div>
```

### Article Row (Expanded)

```jsx
{expandedArticles.has(group.key) && (
  <div className="ml-6 pl-3 border-l border-slate-700 space-y-1 pb-2">
    {group.logs.map(log => (
      <div key={log.id} className={`flex items-start text-xs ${/* status color */}`}>
        {/* Same detail display as existing "Group By Article" */}
        <span className="text-gray-600 mr-1 font-mono">[{log.timestamp}]</span>
        <span>{log.message}</span>
      </div>
    ))}
  </div>
)}
```

### Summary Stats Bar

```jsx
{logGroupBy === 'summary' && summaryStats && (
  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-700 text-xs">
    <span className="text-green-400 font-semibold">✅ {summaryStats.succeeded} succeeded</span>
    {summaryStats.failed > 0 && <span className="text-red-400 font-semibold">❌ {summaryStats.failed} failed</span>}
    {summaryStats.working > 0 && <span className="text-yellow-400 font-semibold animate-pulse">⟳ {summaryStats.working} processing</span>}
    <span className="text-slate-400">Total: {summaryStats.total} articles</span>
  </div>
)}
```

---

## Golden Rules

| Rule | Relevance |
|------|-----------|
| **#9 Never swallow errors** | Failed articles must be clearly visible (red, FAILED badge) |
| **#17 Strip H/J/C tags** | Article names in the summary should strip tags for clean display (or leave them — they're useful for debugging) |

## What NOT to Do

- Do NOT remove or modify the existing view modes (No Grouping, By Article, By Session). Add Summary alongside them.
- Do NOT change the `LogEntry` interface — it already has everything we need (`itemId`, `status`, `timestamp`)
- Do NOT change how `addLog()` works — the data collection is fine, we're just changing the display
- Do NOT break the History panel — it should work with Summary view too
- Do NOT add any new API calls — this is purely a frontend display change
- Do NOT change localStorage persistence format — existing history data should still work

## Files to Modify

| File | Change |
|------|--------|
| `App.tsx` (~line 3777-3838) | Add "Summary" option to Sorting dropdown |
| `App.tsx` (~line 3951-4050) | Add summary view rendering after existing group-by blocks |
| `App.tsx` (~line 217) | Change default `logGroupBy` from 'none' to 'summary' |
| `App.tsx` (state section) | Add `expandedArticles` state for expand/collapse |
| `App.tsx` (state section) | Add `summaryStats` useMemo for counts |

## Database Changes

None. This is purely a frontend display improvement.

## Testing

1. Run a batch of articles → verify summary shows article list with checkmarks
2. Click an article → verify detail logs expand below it
3. Click again → verify it collapses
4. Verify failed articles show red with FAILED badge
5. Verify system messages (batch start/end) show inline
6. Verify summary stats bar shows correct counts
7. Verify switching to other view modes (No Grouping, By Article, By Session) still works
8. Verify History panel still loads past runs correctly in summary view
9. Verify auto-scroll still works during live processing
10. Verify auto-expand still works when new logs arrive
