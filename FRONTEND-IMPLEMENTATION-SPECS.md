# Frontend Implementation Specifications

## For: Next Claude Agent

These are detailed specs for building the frontend UI for features that currently only have backend APIs. The backend is complete and tested - you're just wiring up UI components to existing endpoints.

---

## Overview of Tech Stack

- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS (already configured)
- **State**: React hooks + context (no Redux)
- **API Calls**: Fetch with async/await
- **UI Components**: Custom components, some shadcn/ui patterns
- **Location**: `/src/components/`

---

## Task 1: Site Planning Tree View

### What To Build
A drag-and-drop tree editor for planning site hierarchy.

### Location
Create: `/src/components/SitePlanningSection.tsx`
Add tab to workflow view alongside existing tabs.

### API Endpoints (Already Working)
```typescript
// Get all plans for a website
GET /api/site-planning/plans?websiteId={id}

// Get tree structure
GET /api/site-planning/nodes/{planId}
// Returns: { nodes: TreeNode[], flatNodes: Node[] }

// Create node
POST /api/site-planning/nodes
Body: { sitePlanId, title, slug, parentId?, targetKeyword?, isPillarPage?, pageType }

// Update node
PUT /api/site-planning/nodes/{nodeId}
Body: { title?, slug?, parentId?, status?, targetKeyword?, ... }

// Delete node
DELETE /api/site-planning/nodes/{nodeId}?deleteChildren=true|false

// Move node (drag-drop)
POST /api/site-planning/nodes/{nodeId}/move
Body: { newParentId, newSortOrder }

// Push all to WordPress
POST /api/site-planning/push-hierarchy/{planId}
Body: { status: 'draft'|'publish', dripFeed?: boolean, dripIntervalHours?: number }
```

### Data Types
```typescript
interface SitePlanNode {
  id: number;
  site_plan_id: number;
  parent_id: number | null;
  title: string;
  slug: string;
  page_type: 'page' | 'post' | 'service' | 'location' | 'landing';
  status: 'planned' | 'built' | 'published';
  target_keyword: string | null;
  meta_title: string | null;
  meta_description: string | null;
  is_pillar_page: boolean;
  depth: number;
  sort_order: number;
  wp_page_id: number | null;
  wp_post_url: string | null;
  assigned_article_id: number | null;
  children?: SitePlanNode[]; // Populated by frontend tree building
}

interface SitePlan {
  id: number;
  website_id: number;
  name: string;
  description: string | null;
  total_pages: number;
  max_depth: number;
  sync_status: 'unknown' | 'synced' | 'differs';
}
```

### UI Components To Build

#### 1. Plan Selector
```tsx
// Simple dropdown to select/create plans
<select value={selectedPlanId} onChange={handlePlanChange}>
  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
</select>
<button onClick={handleCreatePlan}>+ New Plan</button>
```

#### 2. Tree View Component
Use a recursive component pattern:
```tsx
function TreeNode({ node, onUpdate, onDelete, onAddChild }) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);

  return (
    <div className="ml-4 border-l-2 border-gray-200 pl-4">
      <div className="flex items-center gap-2 py-1">
        {node.children?.length > 0 && (
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? '▼' : '▶'}
          </button>
        )}

        {editing ? (
          <input value={node.title} onChange={...} onBlur={handleSave} />
        ) : (
          <span
            className={cn(
              "cursor-pointer",
              node.is_pillar_page && "font-bold",
              node.status === 'published' && "text-green-600"
            )}
            onClick={() => setEditing(true)}
          >
            {node.title}
          </span>
        )}

        <span className="text-xs text-gray-400">{node.page_type}</span>

        {node.wp_page_id && (
          <span className="text-xs bg-green-100 text-green-700 px-1 rounded">
            WP #{node.wp_page_id}
          </span>
        )}

        <button onClick={() => onAddChild(node.id)}>+ Child</button>
        <button onClick={() => onDelete(node.id)}>×</button>
      </div>

      {expanded && node.children?.map(child => (
        <TreeNode key={child.id} node={child} {...props} />
      ))}
    </div>
  );
}
```

#### 3. Node Editor Panel
When a node is selected, show edit panel:
```tsx
<div className="p-4 border rounded">
  <h3>Edit: {selectedNode.title}</h3>

  <label>Title</label>
  <input value={title} onChange={e => setTitle(e.target.value)} />

  <label>Slug</label>
  <input value={slug} onChange={e => setSlug(e.target.value)} />

  <label>Target Keyword</label>
  <input value={targetKeyword} onChange={...} />

  <label>Page Type</label>
  <select value={pageType} onChange={...}>
    <option value="page">Page</option>
    <option value="service">Service</option>
    <option value="location">Location</option>
    <option value="landing">Landing</option>
  </select>

  <label>
    <input type="checkbox" checked={isPillarPage} onChange={...} />
    Pillar Page
  </label>

  <button onClick={handleSave}>Save</button>
</div>
```

#### 4. Bulk Actions Bar
```tsx
<div className="flex gap-2 p-2 bg-gray-50">
  <button onClick={handlePushAll}>
    Push All to WordPress
  </button>
  <button onClick={handleSyncCheck}>
    Check Sync Status
  </button>
  <button onClick={handleExport}>
    Export CSV
  </button>
  <button onClick={handleImport}>
    Import CSV
  </button>
</div>
```

### Drag and Drop
Use `@dnd-kit/core` or `react-beautiful-dnd`:
```tsx
import { DndContext, closestCenter } from '@dnd-kit/core';

function handleDragEnd(event) {
  const { active, over } = event;
  if (active.id !== over.id) {
    // Call API to move node
    await fetch(`/api/site-planning/nodes/${active.id}/move`, {
      method: 'POST',
      body: JSON.stringify({
        newParentId: over.id,
        newSortOrder: 0
      })
    });
    // Refresh tree
    refetchNodes();
  }
}
```

---

## Task 2: Local Viking Dashboard

### What To Build
Dashboard for rank tracking and GBP management.

### Location
Create: `/src/components/LocalVikingSection.tsx`
Add as new tab in workflow view OR as separate page.

### API Endpoints (Already Working)
```typescript
// Test connection
POST /api/local-viking/test-connection
Body: { websiteId }

// Get credit balance
GET /api/local-viking/credits/{websiteId}

// Get GBP locations
GET /api/local-viking/locations/{websiteId}

// Run rank scan
POST /api/local-viking/geogrid/scan
Body: { websiteId, keyword, gridSize: 7|9|11, distance: number }

// Get history
GET /api/local-viking/geogrid/history/{websiteId}?keyword={keyword}&days=30

// Get sheep opportunities
GET /api/local-viking/sheep-opportunities/{websiteId}

// Get templates
GET /api/local-viking/templates/{websiteId}

// Create template
POST /api/local-viking/templates
Body: { websiteId, name, content, callToAction, ctaUrl, rotationDay }

// Execute rinse & repeat
POST /api/local-viking/rinse-repeat/{websiteId}
Body: { maxAgeDays: 7, useTemplates: true }

// Get rinse status
GET /api/local-viking/rinse-repeat/status/{websiteId}
```

### Data Types
```typescript
interface RankSnapshot {
  id: number;
  keyword: string;
  grid_size: number;
  average_rank: number;
  best_rank: number;
  top_3_count: number;
  sheep_score: number;
  grid_data: GridPoint[];
  analysis: SheepAnalysis;
  created_at: string;
}

interface GridPoint {
  lat: number;
  lng: number;
  rank: number;
  businesses: { name: string; rank: number }[];
}

interface SheepAnalysis {
  total_points: number;
  top_3: number;
  positions_4_to_10: number;
  positions_11_to_20: number;
  not_ranking: number;
  sheep_opportunity_score: string;
  recommendation: string;
}

interface GBPTemplate {
  id: number;
  name: string;
  content: string;
  call_to_action: string;
  cta_url: string;
  rotation_day: number | null;
  is_active: boolean;
  times_posted: number;
  last_posted_at: string | null;
}
```

### UI Components To Build

#### 1. Connection Status & Credits
```tsx
function ConnectionStatus({ websiteId }) {
  const [status, setStatus] = useState(null);
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    // Test connection on mount
    testConnection();
    fetchCredits();
  }, [websiteId]);

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded">
      <div className={cn(
        "w-3 h-3 rounded-full",
        status?.success ? "bg-green-500" : "bg-red-500"
      )} />
      <span>{status?.success ? 'Connected' : 'Not Connected'}</span>

      {credits && (
        <div className="ml-auto">
          <span className="font-bold">{credits.credits}</span> credits remaining
        </div>
      )}
    </div>
  );
}
```

#### 2. Keyword Scanner
```tsx
function KeywordScanner({ websiteId }) {
  const [keyword, setKeyword] = useState('');
  const [gridSize, setGridSize] = useState(7);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);

  async function handleScan() {
    setScanning(true);
    const res = await fetch('/api/local-viking/geogrid/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ websiteId, keyword, gridSize })
    });
    const data = await res.json();
    setResult(data);
    setScanning(false);
  }

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Rank Scanner</h3>

      <input
        placeholder="Enter keyword..."
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
        className="w-full p-2 border rounded"
      />

      <div className="flex gap-2 mt-2">
        <select value={gridSize} onChange={e => setGridSize(+e.target.value)}>
          <option value={7}>7×7 (49 credits)</option>
          <option value={9}>9×9 (81 credits)</option>
          <option value={11}>11×11 (121 credits)</option>
        </select>

        <button
          onClick={handleScan}
          disabled={scanning || !keyword}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          {scanning ? 'Scanning...' : 'Scan'}
        </button>
      </div>

      {result && <ScanResult data={result} />}
    </div>
  );
}
```

#### 3. Scan Result / Heat Map
```tsx
function ScanResult({ data }) {
  const { analysis, scan } = data;

  return (
    <div className="mt-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <StatCard label="Top 3" value={analysis.top_3} color="green" />
        <StatCard label="Positions 4-10" value={analysis.positions_4_to_10} color="yellow" />
        <StatCard label="Positions 11-20" value={analysis.positions_11_to_20} color="orange" />
        <StatCard label="Not Ranking" value={analysis.not_ranking} color="red" />
      </div>

      {/* Sheep Score */}
      <div className={cn(
        "p-4 rounded text-center",
        parseFloat(analysis.sheep_opportunity_score) > 20 ? "bg-green-100" : "bg-gray-100"
      )}>
        <div className="text-3xl font-bold">{analysis.sheep_opportunity_score}</div>
        <div className="text-sm">Sheep Opportunity Score</div>
        <div className="text-sm mt-2">{analysis.recommendation}</div>
      </div>

      {/* Grid Visualization */}
      <div className="mt-4">
        <HeatMapGrid points={scan.grid_data} />
      </div>
    </div>
  );
}

function HeatMapGrid({ points }) {
  // Render a grid of colored squares based on rank
  const gridSize = Math.sqrt(points.length);

  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
    >
      {points.map((point, i) => (
        <div
          key={i}
          className={cn(
            "aspect-square rounded flex items-center justify-center text-xs font-bold",
            getRankColor(point.rank)
          )}
          title={`Rank: ${point.rank}`}
        >
          {point.rank || '-'}
        </div>
      ))}
    </div>
  );
}

function getRankColor(rank) {
  if (!rank || rank > 20) return 'bg-gray-200 text-gray-500';
  if (rank <= 3) return 'bg-green-500 text-white';
  if (rank <= 10) return 'bg-yellow-400 text-black';
  return 'bg-orange-400 text-white';
}
```

#### 4. Sheep Opportunities List
```tsx
function SheepOpportunities({ websiteId }) {
  const [opportunities, setOpportunities] = useState([]);

  useEffect(() => {
    fetchOpportunities();
  }, [websiteId]);

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Sheep Ready to Herd</h3>
      <p className="text-sm text-gray-500 mb-4">
        Keywords ranking 4-10 that are ready to push to top 3
      </p>

      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500">
            <th>Keyword</th>
            <th>Sheep Score</th>
            <th>Avg Rank</th>
            <th>Top 3 Count</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map(opp => (
            <tr key={opp.keyword} className="border-t">
              <td className="py-2 font-medium">{opp.keyword}</td>
              <td>
                <span className={cn(
                  "px-2 py-1 rounded text-sm",
                  parseFloat(opp.sheepScore) > 10 ? "bg-green-100 text-green-700" : "bg-gray-100"
                )}>
                  {opp.sheepScore}
                </span>
              </td>
              <td>{opp.avgRank}</td>
              <td>{opp.top3Count}</td>
              <td>
                <button className="text-blue-500 text-sm">
                  Create Content →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

#### 5. Post Template Manager
```tsx
function TemplateManager({ websiteId }) {
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);

  const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="p-4 border rounded">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold">Post Templates</h3>
        <button
          onClick={() => setEditing({ isNew: true })}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
        >
          + Add Template
        </button>
      </div>

      <div className="space-y-2">
        {templates.map(template => (
          <div
            key={template.id}
            className="p-3 border rounded flex justify-between items-start"
          >
            <div>
              <div className="font-medium">{template.name}</div>
              <div className="text-sm text-gray-500 line-clamp-2">
                {template.content}
              </div>
              <div className="flex gap-2 mt-1 text-xs">
                {template.rotation_day && (
                  <span className="bg-blue-100 text-blue-700 px-1 rounded">
                    {dayNames[template.rotation_day]}
                  </span>
                )}
                <span className="text-gray-400">
                  Posted {template.times_posted}x
                </span>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setEditing(template)}
                className="text-gray-400 hover:text-gray-600"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <TemplateEditor
          template={editing}
          websiteId={websiteId}
          onSave={() => { setEditing(null); fetchTemplates(); }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
```

#### 6. Rinse & Repeat Control
```tsx
function RinseRepeatControl({ websiteId }) {
  const [status, setStatus] = useState(null);
  const [executing, setExecuting] = useState(false);

  async function handleExecute() {
    setExecuting(true);
    const res = await fetch(`/api/local-viking/rinse-repeat/${websiteId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxAgeDays: 7, useTemplates: true })
    });
    const result = await res.json();
    alert(`Deleted ${result.deleted.length} posts, created ${result.reposted.length} new posts`);
    setExecuting(false);
    fetchStatus();
  }

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Rinse & Repeat</h3>

      {status && (
        <div className="mb-4">
          <div className="flex gap-4 text-sm">
            <span>Total Posts: {status.summary.total}</span>
            <span className="text-orange-500">
              Due for Refresh: {status.summary.dueForRefresh}
            </span>
            <span className="text-green-500">
              Fresh: {status.summary.fresh}
            </span>
          </div>
        </div>
      )}

      <button
        onClick={handleExecute}
        disabled={executing}
        className="px-4 py-2 bg-purple-500 text-white rounded"
      >
        {executing ? 'Running...' : 'Execute Rinse & Repeat'}
      </button>

      <p className="text-xs text-gray-500 mt-2">
        This will delete posts older than 7 days and post today's template.
      </p>
    </div>
  );
}
```

---

## Task 3: Docs/Help Button

### What To Build
A help button that opens the user manual in a modal or sidebar.

### Location
Add to: `/src/App.tsx` or layout component

### Implementation
```tsx
// In your main layout or App.tsx
function HelpButton() {
  const [showDocs, setShowDocs] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowDocs(true)}
        className="fixed bottom-4 right-4 w-12 h-12 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center text-xl"
        title="Help"
      >
        ?
      </button>

      {showDocs && (
        <DocsModal onClose={() => setShowDocs(false)} />
      )}
    </>
  );
}

function DocsModal({ onClose }) {
  const [content, setContent] = useState('');

  useEffect(() => {
    // Fetch the markdown file
    fetch('/USER-MANUAL.md')
      .then(r => r.text())
      .then(setContent);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="font-bold text-lg">User Manual</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {/* Use a markdown renderer like react-markdown */}
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
```

You'll need to:
1. Install `react-markdown`: `npm install react-markdown`
2. Copy USER-MANUAL.md to `/public/` so it's serveable
3. Add the HelpButton to your layout

---

## Task 4: Website Settings - Local Viking Config

### What To Build
Add Local Viking settings to website edit form.

### Location
Find existing: `/src/components/WebsiteSettings.tsx` or similar

### Add These Fields
```tsx
<div className="mt-6 border-t pt-6">
  <h3 className="font-bold mb-4">Local Viking Integration</h3>

  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium mb-1">API Key</label>
      <input
        type="password"
        value={website.local_viking_api_key || ''}
        onChange={e => setWebsite({
          ...website,
          local_viking_api_key: e.target.value
        })}
        placeholder="Enter Local Viking API key"
        className="w-full p-2 border rounded"
      />
    </div>

    <div>
      <label className="block text-sm font-medium mb-1">GBP Location ID</label>
      <div className="flex gap-2">
        <input
          value={website.local_viking_location_id || ''}
          onChange={e => setWebsite({
            ...website,
            local_viking_location_id: e.target.value
          })}
          placeholder="Select or enter location ID"
          className="flex-1 p-2 border rounded"
        />
        <button
          onClick={fetchLocations}
          disabled={!website.local_viking_api_key}
          className="px-3 py-2 bg-gray-100 rounded"
        >
          Fetch Locations
        </button>
      </div>

      {locations.length > 0 && (
        <select
          onChange={e => setWebsite({
            ...website,
            local_viking_location_id: e.target.value
          })}
          className="w-full mt-2 p-2 border rounded"
        >
          <option value="">Select a location...</option>
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>
              {loc.name} - {loc.address}
            </option>
          ))}
        </select>
      )}
    </div>

    <button
      onClick={testConnection}
      disabled={!website.local_viking_api_key}
      className="px-4 py-2 bg-blue-500 text-white rounded"
    >
      Test Connection
    </button>
  </div>
</div>
```

---

## File Structure Summary

After implementation, you should have:

```
src/components/
├── SitePlanningSection.tsx      # NEW - Tree view
│   ├── TreeNode.tsx             # Recursive node component
│   ├── NodeEditor.tsx           # Edit panel
│   └── PlanActions.tsx          # Bulk actions
├── LocalVikingSection.tsx       # NEW - Dashboard
│   ├── ConnectionStatus.tsx     # Status + credits
│   ├── KeywordScanner.tsx       # Scan interface
│   ├── HeatMapGrid.tsx          # Visual grid
│   ├── SheepOpportunities.tsx   # Priority list
│   ├── TemplateManager.tsx      # Post templates
│   └── RinseRepeatControl.tsx   # Cycle control
├── HelpButton.tsx               # NEW - Docs access
├── DocsModal.tsx                # NEW - Markdown viewer
└── ... existing components
```

---

## Testing Checklist

### Site Planning
- [ ] Can create a new plan
- [ ] Can add nodes to plan
- [ ] Can drag nodes to reorder
- [ ] Can drag nodes to new parent
- [ ] Can edit node details
- [ ] Can delete nodes
- [ ] Can push all to WordPress
- [ ] Can import from CSV

### Local Viking
- [ ] Connection test works
- [ ] Credits display correctly
- [ ] Can run keyword scan
- [ ] Heat map displays correctly
- [ ] Sheep opportunities load
- [ ] Can create/edit templates
- [ ] Rinse & repeat executes
- [ ] Status shows correct counts

### Help System
- [ ] Button appears on all pages
- [ ] Modal opens with docs
- [ ] Markdown renders correctly
- [ ] Can close modal

---

## Tips for the Agent

1. **Start with the simplest component** - ConnectionStatus is a good first test
2. **Use the existing UI patterns** - Look at how other sections are styled
3. **Test API calls in isolation** - Use browser console or Postman first
4. **The backend is solid** - If something doesn't work, it's likely a frontend issue
5. **Check types carefully** - The API returns snake_case, you may need to convert

Good luck! The hard part is done - you're just connecting the wires.
