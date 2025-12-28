# VibeCoder Notepad - Full SaaS Vision

## The Problem

Vibe coding with AI tools like Claude Code has friction points:

1. **5 Image Limit** - Claude Code only accepts 5 images per message
2. **Forgetting Edits** - You spot issues while testing but forget them
3. **Disorganized Submissions** - Hard to connect images to their edit descriptions
4. **No Breadcrumbs** - Every coding session starts fresh, AI has to re-search the codebase
5. **Ideas Get Lost** - You think of new features/projects while working but can't capture them
6. **No Version History** - Can't look back at what edits were made when

## Current Solution (Local Component)

A React component (`VibeCoderNotepad.tsx`) that can be dropped into any project:
- Slide-out panel for capturing edits
- Title + Description + Images per edit
- Auto-numbering (1a, 1b, 1c for images)
- Smart batching within 5-image limit
- Codebase index/breadcrumb system
- Stores in localStorage

## Full SaaS Vision

### Core Product: VibeCoder Hub

A central web app that manages ALL your vibe coding projects.

#### Features

**1. Project Management**
- Create projects (name, description, tech stack, repo URL)
- Each project gets a unique API key
- Dashboard showing all projects and their edit history

**2. Universal Notepad Widget**
- Downloadable code snippet to add to any project
- Connects to VibeCoder Hub via API key
- All edits sync to central database
- Works offline, syncs when online

**3. Cross-Project Idea Capture**
- Button in notepad: "New Project Idea"
- Capture ideas while working on something else
- Ideas get their own space in the hub
- Tag ideas, add notes, screenshots
- Convert idea to full project when ready

**4. Codebase Index System**
- Auto-builds as edits are made
- Stores file paths, line ranges, component names
- "Where is X?" quick search
- AI agents can read the index first (saves context tokens)
- Export as markdown for new sessions

**5. Version Control / History**
- Every edit logged with timestamp
- See what changed when
- Search: "What did I do last Tuesday?"
- Filter by tag, file, component

**6. Image Management**
- All screenshots stored centrally
- Auto-compression for storage efficiency
- Image collaging feature (combine 4 into 1)
- Auto-numbering overlay (1a, 1b, etc.)
- Batch download for submissions

**7. Smart Batching**
- Knows Claude Code's 5-image limit
- Auto-splits edits into optimal batches
- "Copy Batch 1 of 3" workflow
- Tracks which batches have been submitted

**8. AI Integration Ideas**
- Auto-tag edits based on content
- Suggest related past edits
- Auto-detect file paths from screenshots (OCR)
- Generate edit summaries for PR descriptions

### Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VibeCoder Hub (SaaS)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Projects  │  │    Edits    │  │   Images    │         │
│  │   Database  │  │   Database  │  │   Storage   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                          │                                  │
│                    REST/WebSocket API                       │
└─────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  Project A  │ │  Project B  │ │  Project C  │
    │   Widget    │ │   Widget    │ │   Widget    │
    │  (React)    │ │  (React)    │ │  (React)    │
    └─────────────┘ └─────────────┘ └─────────────┘
```

### Database Schema (Conceptual)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR(255),
  description TEXT,
  tech_stack TEXT[],
  repo_url VARCHAR(500),
  api_key VARCHAR(64) UNIQUE,
  created_at TIMESTAMP
);

-- Edits
CREATE TABLE edits (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  number INTEGER,
  title VARCHAR(255),
  description TEXT,
  tags TEXT[],
  file_paths TEXT[],
  line_ranges TEXT[],
  status VARCHAR(20), -- pending, submitted, done
  created_at TIMESTAMP,
  submitted_at TIMESTAMP
);

-- Edit Images
CREATE TABLE edit_images (
  id UUID PRIMARY KEY,
  edit_id UUID REFERENCES edits(id),
  storage_url VARCHAR(500),
  label VARCHAR(10), -- "1a", "1b", etc.
  created_at TIMESTAMP
);

-- Codebase Index
CREATE TABLE codebase_index (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  file_path VARCHAR(500),
  description TEXT,
  line_range VARCHAR(50),
  component_name VARCHAR(255),
  tags TEXT[],
  last_edit_id UUID REFERENCES edits(id),
  updated_at TIMESTAMP
);

-- Ideas (for future projects)
CREATE TABLE ideas (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title VARCHAR(255),
  description TEXT,
  tags TEXT[],
  source_project_id UUID REFERENCES projects(id), -- Where idea came from
  converted_to_project_id UUID REFERENCES projects(id),
  created_at TIMESTAMP
);
```

### Widget Code Distribution

When user creates a project, they get:

```jsx
// Download this and add to your project

// 1. Install the package (future)
// npm install @vibecoder/notepad

// 2. Or copy the component file
// Copy VibeCoderNotepad.tsx to your project

// 3. Add to your app
import { VibeCoderToggle } from './components/VibeCoderNotepad';

function App() {
  return (
    <>
      <YourApp />
      <VibeCoderToggle
        apiKey="your-project-api-key"  // Future: for SaaS sync
        projectId="project-uuid"
      />
    </>
  );
}
```

### Monetization Ideas

1. **Free Tier**
   - 1 project
   - 50 edits/month
   - 100MB image storage
   - Local-only mode

2. **Pro Tier ($10/month)**
   - Unlimited projects
   - Unlimited edits
   - 5GB image storage
   - Cloud sync
   - Version history (90 days)

3. **Team Tier ($25/month)**
   - Everything in Pro
   - Team collaboration
   - Shared codebase index
   - Unlimited history
   - Priority support

### MVP Features (First Release)

1. ✅ Basic notepad component (DONE - VibeCoderNotepad.tsx)
2. ⬜ Central hub with project creation
3. ⬜ API for widget ↔ hub communication
4. ⬜ Basic image storage (S3/Cloudinary)
5. ⬜ User authentication
6. ⬜ Edit history view

### Future Enhancements

- Browser extension for quick capture
- VS Code extension integration
- GitHub integration (link edits to commits/PRs)
- Slack/Discord notifications
- Mobile app for reviewing edits
- AI-powered edit suggestions
- Team collaboration features
- Integration with other AI coding tools (Cursor, Copilot, etc.)

---

## Using the Current Component

Until the full SaaS is built, you can use the local component:

### Adding to Any Project

1. Copy `VibeCoderNotepad.tsx` to your project's components folder
2. Import and add the toggle:

```tsx
import { VibeCoderToggle } from './components/VibeCoderNotepad';

// In your main App component:
<VibeCoderToggle />
```

3. A floating 📝 button appears in bottom-right
4. Click to open the notepad panel
5. Data saves to localStorage

### Workflow

1. While testing, spot an issue
2. Click 📝 → "New Edit"
3. Quick title: "Button misaligned"
4. Optional: Paste screenshot (Cmd+V / Ctrl+V)
5. Continue testing, add more edits
6. When ready: Click "Copy for Claude"
7. Paste in Claude Code, then attach images
8. Edits marked as submitted, remaining edits queue for next batch

---

*Document created: December 2024*
*For the day when this becomes a real product!*
