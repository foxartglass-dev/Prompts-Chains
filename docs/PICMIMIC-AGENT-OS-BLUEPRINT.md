# PicMimic: Agent OS Blueprint
## Universal AI Image Creation Platform

**Document Version**: 1.0
**Created**: December 26, 2025
**Purpose**: Complete spec-driven development blueprint for coding agents

---

# 📋 STANDARDS LAYER

## Technology Stack

### Frontend
- **Framework**: React 18+ with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React hooks + Context API (no Redux overhead)
- **UI Components**: Custom component library (no external UI kit dependency)
- **Icons**: Inline SVG components for performance
- **Build**: Vite for fast development and optimized builds

### Backend
- **Runtime**: Node.js 18+ with Express.js
- **Language**: JavaScript (ES Modules)
- **Database**: PostgreSQL with Neon (serverless-compatible)
- **ORM**: Raw SQL with tagged template literals (no ORM overhead)
- **File Storage**: Integration-ready for S3/Cloudflare R2
- **API Style**: RESTful with JSON responses

### AI/ML Integrations
- **Primary Image Model**: OpenAI GPT-Image-1.5 (generation + chat)
- **Fallback Image Model**: DALL-E 3
- **Analysis Model**: GPT-4o-mini (fast, cost-effective)
- **Vision Model**: GPT-Image-1.5 / GPT-4o (image understanding)
- **Provider Abstraction**: Support for multiple providers (OpenAI, Anthropic, Google)

### DevOps
- **Hosting**: Railway / Vercel / Any Node.js host
- **Database**: Neon PostgreSQL (serverless)
- **CI/CD**: GitHub Actions
- **Monitoring**: Built-in logging with structured JSON

---

## Coding Conventions

### File Organization
```
picmimic/
├── src/
│   ├── components/           # React components
│   │   ├── common/           # Shared UI components
│   │   ├── consultant/       # Consultant chat components
│   │   ├── generator/        # Image generation components
│   │   ├── bank/             # Image bank components
│   │   └── project/          # Project management components
│   ├── hooks/                # Custom React hooks
│   ├── services/             # API service layers
│   ├── contexts/             # React contexts
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions
├── server/
│   ├── routes/               # Express route handlers
│   ├── db/                   # Database schemas and migrations
│   ├── services/             # Business logic services
│   └── middleware/           # Express middleware
├── public/                   # Static assets
└── docs/                     # Documentation
```

### Naming Conventions
- **Components**: PascalCase (`ConsultantChat.tsx`)
- **Hooks**: camelCase with `use` prefix (`useImageBank.ts`)
- **Services**: camelCase (`imageGeneration.ts`)
- **Routes**: kebab-case (`/api/image-creation/generate`)
- **Database Tables**: snake_case (`image_bank`, `user_projects`)
- **TypeScript Interfaces**: PascalCase with descriptive names (`ImageGenerationSettings`)

### Component Structure
```typescript
// Standard component structure
interface Props {
  // Props interface first
}

const ComponentName: React.FC<Props> = ({ prop1, prop2 }) => {
  // 1. Hooks (useState, useEffect, custom hooks)
  // 2. Derived state / computations
  // 3. Event handlers
  // 4. Render helpers (if needed)
  // 5. Return JSX
};

export default ComponentName;
```

### API Response Format
```typescript
// Success response
{
  success: true,
  data: { ... },
  message?: string
}

// Error response
{
  success: false,
  error: string,
  code?: string
}
```

### Database Patterns
- Use JSONB for flexible nested data (settings, chat history, image metadata)
- Use proper indexes on frequently queried fields
- Include `created_at` and `updated_at` timestamps on all tables
- Use UUIDs for public-facing IDs, integers for internal references

---

## Architecture Patterns

### The Consultant Pattern (CRITICAL)
**Every AI operation on the backend MUST have a corresponding consultant interface on the frontend.**

```
┌─────────────────────────────────────────────────────────┐
│                    CONSULTANT PATTERN                    │
│                                                          │
│  Backend Operation          Frontend Consultant          │
│  ─────────────────          ───────────────────          │
│  Image Generation    →      Image Strategy Chat          │
│  Content Analysis    →      Content Planning Chat        │
│  SEO Optimization    →      SEO Strategy Chat            │
│  Batch Processing    →      Batch Planning Chat          │
│                                                          │
│  Rule: Same model that DOES the work also TEACHES        │
│        the user how to use it effectively                │
└─────────────────────────────────────────────────────────┘
```

### Dual Chat Architecture
```typescript
// Every AI-powered section should have:
interface DualChatSystem {
  consultant: {
    model: string;        // High-capability model (GPT-Image-1.5)
    history: ChatMessage[];
    purpose: 'strategy';  // Deep thinking, analysis, planning
  };
  worker: {
    model: string;        // Fast model (GPT-4o-mini)
    history: ChatMessage[];
    purpose: 'execution'; // Quick iterations, batch work
  };
  syncDecisions: () => void; // Consultant insights flow to worker
}
```

### Settings Persistence Pattern
```typescript
// All settings use this pattern:
// 1. Load from database on mount
// 2. Local state for immediate UI response
// 3. Debounced auto-save (500ms)
// 4. Manual save button as backup
// 5. Visual feedback (saved indicator)

const usePersistedSettings = <T>(
  endpoint: string,
  defaultValue: T,
  debounceMs: number = 500
) => {
  const [settings, setSettings] = useState<T>(defaultValue);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  // ... implementation
};
```

---

## Quality Standards

### Testing Requirements
- Unit tests for all utility functions
- Integration tests for API endpoints
- Component tests for critical UI flows
- E2E tests for core user journeys (project creation → image generation → export)

### Error Handling
```typescript
// All API calls must handle:
// 1. Network errors
// 2. API rate limits
// 3. Invalid responses
// 4. Timeout scenarios

try {
  const result = await apiCall();
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
} catch (error) {
  // Log for debugging
  console.error('[Context] Operation failed:', error);
  // User-friendly message
  showNotification('Operation failed. Please try again.', 'error');
  // Graceful degradation
  return fallbackValue;
}
```

### Performance Standards
- Initial page load: < 2 seconds
- API responses: < 500ms (except image generation)
- Image generation feedback: Show progress immediately
- Debounce user inputs: 300-500ms
- Lazy load heavy components (chat history, image bank)

### Security Standards
- API keys stored server-side only (never in frontend)
- User API keys encrypted at rest
- Input validation on all endpoints
- Rate limiting on expensive operations
- CORS configured for production domains only

---

# 🎯 PRODUCT LAYER

## Vision

**PicMimic is the world's first AI image creation platform that combines strategic consulting with systematic execution.**

Unlike generic image generators where users guess at prompts, PicMimic provides:
1. **Expert Guidance**: The same AI that generates images teaches you how to create them effectively
2. **Systematic Approach**: Define your visual strategy once, generate consistently forever
3. **Professional Results**: Agency-quality image creation accessible to everyone

**Core Insight**: The barrier to great AI images isn't the technology—it's knowing what to ask for. PicMimic solves this by making the AI your strategic partner, not just a tool.

---

## Target Users

### Primary: Professional Content Creators
- **Marketing Agencies**: Managing multiple clients, need consistent brand imagery
- **E-commerce Operators**: Product imagery, lifestyle shots, marketing materials
- **Content Marketers**: Blog images, social media content, email graphics
- **Local Business Owners**: Website imagery, marketing materials, social proof

### Secondary: Systematic Creators
- **Course Creators**: Consistent imagery across educational content
- **Authors/Publishers**: Book covers, chapter images, marketing
- **Real Estate**: Property staging, virtual tours, marketing materials
- **Healthcare/Wellness**: Professional imagery for practices

### Tertiary: Power Users
- **AI Enthusiasts**: Want maximum control over image generation
- **Developers**: Building image generation into their own products
- **Researchers**: Studying AI image generation capabilities

---

## Core Use Cases

### Use Case 1: Brand Image System
**Scenario**: Marketing agency managing 20 cleaning business clients

**Without PicMimic**:
- Each image is a one-off prompt
- Inconsistent quality and style
- Hours spent on prompt engineering
- No reusable system

**With PicMimic**:
1. Create "Cleaning Business" project template
2. Define audience avatars (homeowners, commercial, etc.)
3. Set up placeholder system (cleaning tasks × demographics × settings)
4. Consultant helps refine master prompt
5. Generate 50+ consistent images in one batch
6. Image Bank stores and organizes everything
7. Clone project for each new client, adjust details

**Result**: 10x faster, consistent quality, reusable system

---

### Use Case 2: E-commerce Product Imagery
**Scenario**: Online store needs lifestyle shots for 100 products

**Without PicMimic**:
- Hire photographer or use generic stock
- Expensive, time-consuming, inconsistent

**With PicMimic**:
1. Upload reference images of desired style
2. Consultant analyzes and extracts visual DNA
3. Create placeholders for product categories
4. Batch generate lifestyle contexts
5. Smart matching places products in appropriate scenes

**Result**: Professional product imagery at fraction of cost

---

### Use Case 3: Content Marketing at Scale
**Scenario**: Blog publishes 50 articles/month, each needs 4-5 images

**Without PicMimic**:
- Generic stock photos
- Time searching for relevant images
- Inconsistent visual brand

**With PicMimic**:
1. Define visual brand standards with Consultant
2. Enable Smart Content Matching
3. System reads article text, generates relevant images
4. Images semantically match surrounding content
5. Maximum SEO value (image relevance = ranking factor)

**Result**: 200+ on-brand, relevant images per month, automated

---

### Use Case 4: Multi-Avatar Campaigns
**Scenario**: Fitness brand targeting 3 demographics

**Without PicMimic**:
- Separate photoshoots for each demographic
- Expensive, logistically complex

**With PicMimic**:
1. Create avatars: Young Athletes (Y), Busy Parents (P), Seniors (S)
2. Each avatar has specific prompt characteristics
3. Placeholder categories: exercises × settings × demographics
4. Generate full campaign imagery for all segments
5. Tag-based routing sends right images to right campaigns

**Result**: Full multi-demographic campaign from single system

---

### Use Case 5: Rapid Iteration & Testing
**Scenario**: A/B testing different visual approaches

**Without PicMimic**:
- Create variations manually
- Slow, expensive to test

**With PicMimic**:
1. Consultant helps identify variables to test
2. Create variation sets (warm vs cool colors, close vs wide shots, etc.)
3. Batch generate all variations
4. Test in market
5. Consultant analyzes results, suggests optimizations

**Result**: Data-driven visual optimization

---

## Universal Value Propositions

### For Agencies
- **White-label ready**: Remove branding, deploy for clients
- **Project templates**: Reuse successful configurations
- **Team collaboration**: Multiple users, shared projects
- **Client management**: Separate projects per client

### For Individual Creators
- **No expertise required**: Consultant teaches as you go
- **Affordable**: Fraction of stock photo subscriptions
- **Ownership**: Generated images are yours
- **Consistency**: Once set up, always on-brand

### For Technical Users
- **API access**: Integrate into existing workflows
- **Webhook support**: Trigger on external events
- **Batch processing**: Process thousands of images
- **Custom models**: Plug in alternative providers

---

## Roadmap

### Phase 1: Core Platform (MVP)
- [x] Project management (create, save, load)
- [x] Consultant chat with GPT-Image-1.5
- [x] Image generation with multiple models
- [x] Audience Avatar system
- [x] Simple placeholder variations
- [x] Advanced placeholder categories
- [x] Image Bank with organization
- [x] Batch generation
- [x] Smart Content Matching (basic)
- [ ] User authentication
- [ ] Stripe billing integration
- [ ] Usage tracking and limits

### Phase 2: Professional Features
- [ ] Team/workspace support
- [ ] Project templates marketplace
- [ ] API access for developers
- [ ] Webhook integrations
- [ ] Advanced analytics
- [ ] White-label deployment
- [ ] Custom model integration

### Phase 3: Ecosystem
- [ ] WordPress plugin (direct integration)
- [ ] Shopify app
- [ ] Figma plugin
- [ ] Chrome extension
- [ ] Mobile companion app

### Phase 4: VidMimic Integration
- [ ] Video generation from image prompts
- [ ] Script-to-video pipeline
- [ ] Same consultant paradigm for video

---

# 🔧 SPECS LAYER

## Feature Spec 001: User Authentication & Projects

### Overview
Multi-user system where each user has their own projects, settings, and usage tracking.

### Data Model
```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'free', -- free, pro, agency
  api_keys JSONB DEFAULT '{}', -- encrypted user API keys
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  is_template BOOLEAN DEFAULT false,
  template_source_id UUID, -- if cloned from template
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage tracking
CREATE TABLE usage_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  action VARCHAR(100), -- 'image_generated', 'chat_message', etc.
  tokens_used INTEGER,
  cost_cents INTEGER,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Endpoints
```
POST   /api/auth/register      - Create account
POST   /api/auth/login         - Get JWT token
POST   /api/auth/logout        - Invalidate token
GET    /api/auth/me            - Get current user

GET    /api/projects           - List user's projects
POST   /api/projects           - Create new project
GET    /api/projects/:id       - Get project details
PUT    /api/projects/:id       - Update project
DELETE /api/projects/:id       - Delete project
POST   /api/projects/:id/clone - Clone project (as template)
```

### Acceptance Criteria
- [ ] User can register with email/password
- [ ] User can login and receive JWT
- [ ] JWT expires after 7 days, refresh available
- [ ] User can create unlimited projects (free tier)
- [ ] User can see usage statistics
- [ ] Projects are isolated per user
- [ ] User can clone their project as template

---

## Feature Spec 002: Consultant Chat System

### Overview
The Consultant is the heart of PicMimic—an AI expert that guides users through image strategy using the same model that generates images.

### Core Principle
The Consultant uses GPT-Image-1.5 because:
1. It understands image generation deeply (it IS the generator)
2. It can analyze uploaded reference images
3. It knows what prompts produce what results
4. It can teach effective prompting techniques

### Data Model
```typescript
interface ConsultantChat {
  projectId: string;
  model: string; // 'gpt-image-1.5' recommended
  systemPrompt: string; // Injected context about PicMimic
  history: ChatMessage[];
  attachedImages: string[]; // Reference images in context
  lastActivity: Date;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[]; // Attached images (base64 or URLs)
  timestamp: Date;
  tokenCount?: number;
}
```

### System Prompt (Injected Automatically)
```
You are the PicMimic Consultant—an expert AI image strategist powered by GPT-Image-1.5.

Your role:
1. ANALYZE: Review user's reference images, brand assets, and goals
2. STRATEGIZE: Help develop a systematic approach to image creation
3. EDUCATE: Teach effective prompting techniques
4. OPTIMIZE: Refine prompts for maximum quality and consistency

You have deep knowledge of:
- Image composition, lighting, color theory
- Marketing psychology of visuals
- SEO implications of image choices
- What makes images convert
- Technical prompt engineering

Context about this project:
- Project Name: {project.name}
- Audience Avatars: {project.avatars}
- Current Prompt: {project.mainPrompt}
- Reference Images: {attached}

Guide the user to create a systematic image strategy they can use repeatedly.
Be specific, technical, and actionable.
```

### UI Components
```
┌─────────────────────────────────────────────────────────┐
│  🎯 Consultant Chat                    [GPT-Image-1.5 ▼]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Reference Images Attached: 3]  [+ Add Images]         │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Assistant: I've analyzed your reference images.  │   │
│  │ Here's what I notice about your brand style...   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ You: Can you help me create a prompt for...     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Assistant: Based on your brand analysis, I       │   │
│  │ recommend this prompt structure...               │   │
│  │                                                  │   │
│  │ [📋 Copy to Main Prompt]  [🎨 Generate Preview]  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [📎 Attach Image]  [Type your message...        ] [➤] │
└─────────────────────────────────────────────────────────┘
```

### Key Features
1. **Image Analysis**: User uploads reference images, Consultant analyzes
2. **Prompt Suggestions**: Consultant suggests prompt improvements
3. **Copy to Main Prompt**: One-click to use Consultant's suggestion
4. **Generate Preview**: Test a prompt directly from chat
5. **Context Awareness**: Consultant knows project's avatars, placeholders, etc.

### Acceptance Criteria
- [ ] Chat persists across sessions
- [ ] User can attach up to 10 images to conversation
- [ ] Consultant responses include actionable prompt suggestions
- [ ] "Copy to Main Prompt" button on suggestions
- [ ] "Generate Preview" for quick testing
- [ ] Chat history searchable
- [ ] Export chat as PDF/markdown

---

## Feature Spec 003: Audience Avatar System

### Overview
Audience Avatars represent WHO you're creating images for. Each avatar has its own prompt configuration, enabling systematic generation across different target audiences.

### Data Model
```typescript
interface AudienceAvatar {
  id: string;
  name: string;                    // "Homeowners (H)"
  tag: string;                     // "H" - for routing
  description?: string;            // "Middle-class homeowners..."

  // Core prompt configuration
  mainPrompt: string;              // The base prompt with placeholders

  // Placeholder mode
  placeholderMode: 'simple' | 'advanced';

  // Simple mode: single {variation}
  variations: Variation[];

  // Advanced mode: multiple placeholder categories
  placeholderCategories: PlaceholderCategory[];
  generationMode: 'all' | 'sequential' | 'random' | 'specific';
  specificCombinations?: number[][]; // For manual selection
  randomCount?: number;            // For random mode

  // Style references specific to this avatar
  referenceImages: ReferenceImage[];

  // Generation settings
  defaultSize: '1024x1024' | '1536x1024' | '1024x1536';
  defaultQuality: 'low' | 'medium' | 'high';

  // Metadata
  createdAt: Date;
  lastUsed?: Date;
  imagesGenerated: number;
}

interface Variation {
  id: string;
  name: string;           // "Kitchen Cleaning"
  prompt: string;         // "cleaning the kitchen countertops"
  orientation: 'vertical' | 'landscape' | 'square';
}

interface PlaceholderCategory {
  id: string;
  name: string;           // "Cleaning Task"
  placeholder: string;    // "{Cleaning_Task}"
  options: PlaceholderOption[];
}

interface PlaceholderOption {
  number: number;         // 1, 2, 3...
  text: string;           // "cleaning the stove burners"
}
```

### UI Layout
```
┌─────────────────────────────────────────────────────────────┐
│  Audience Avatars            [Synced with Tag Manager: H,J,C]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [House Cleaning (H)] [Janitorial (J)] [Commercial (C)] [+] │
│        ↑ active                                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Avatar Name: [House Cleaning________________]        │   │
│  │                                                      │   │
│  │ Main Prompt:                      [Simple] [Advanced]│   │
│  │ ┌──────────────────────────────────────────────────┐│   │
│  │ │ {Gender_Age} professional cleaner in a modern    ││   │
│  │ │ residential kitchen, actively {Item_Cleaning}... ││   │
│  │ └──────────────────────────────────────────────────┘│   │
│  │                                                      │   │
│  │ Click to insert: [{Item_Cleaning}] [{Gender_Age}]   │   │
│  │                                                      │   │
│  │ ═══════════════════════════════════════════════════ │   │
│  │ Placeholder Categories                    [+ Add]   │   │
│  │                                                      │   │
│  │ ┌─ Item Cleaning ──────────────── {Item_Cleaning} ─┐│   │
│  │ │ 1. cleaning the stove burners                    ││   │
│  │ │ 2. cleaning the sink                             ││   │
│  │ │ 3. cleaning the countertops                      ││   │
│  │ │ [+ Add Option]                                   ││   │
│  │ └──────────────────────────────────────────────────┘│   │
│  │                                                      │   │
│  │ ┌─ Gender & Age ───────────────── {Gender_Age} ────┐│   │
│  │ │ 1. male ages 25-35                               ││   │
│  │ │ 2. female ages 25-35                             ││   │
│  │ │ 3. female ages 38-45                             ││   │
│  │ │ [+ Add Option]                                   ││   │
│  │ └──────────────────────────────────────────────────┘│   │
│  │                                                      │   │
│  │ Total Combinations: 9 (3 × 3)                       │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Combination Generation Logic
```typescript
// Generate all combinations (Cartesian product)
const generateCombinations = (categories: PlaceholderCategory[]): Combination[] => {
  if (categories.length === 0) return [[]];

  const [first, ...rest] = categories;
  const restCombinations = generateCombinations(rest);

  return first.options.flatMap(option =>
    restCombinations.map(combo => [
      { category: first.name, placeholder: first.placeholder, option },
      ...combo
    ])
  );
};

// Apply combination to prompt
const applyToPrompt = (prompt: string, combination: Combination): string => {
  let result = prompt;
  for (const item of combination) {
    result = result.replace(item.placeholder, item.option.text);
  }
  return result;
};
```

### Acceptance Criteria
- [ ] Create unlimited avatars per project
- [ ] Tag syncs with external tag system (optional)
- [ ] Simple mode: single {variation} placeholder
- [ ] Advanced mode: multiple placeholder categories
- [ ] Click-to-insert placeholders in prompt
- [ ] Show total combination count
- [ ] Preview any specific combination
- [ ] Clone avatar functionality
- [ ] Import/export avatar configurations

---

## Feature Spec 004: Image Bank

### Overview
The Image Bank stores all generated images with rich metadata, enabling organization, search, deployment tracking, and reuse.

### Data Model
```typescript
interface BankImage {
  id: string;
  projectId: string;

  // Image data
  url: string;                    // Stored URL (S3, R2, etc.)
  thumbnailUrl?: string;          // Optimized thumbnail

  // Generation metadata
  prompt: string;                 // Exact prompt used
  revisedPrompt?: string;         // Model's revised version
  model: string;                  // gpt-image-1.5, dall-e-3, etc.
  size: string;                   // 1024x1024, etc.
  quality: string;                // low, medium, high

  // Organization
  title: string;                  // User-editable title
  category: string;               // User-defined category
  tags: string[];                 // Searchable tags
  avatarId?: string;              // Which avatar generated this
  avatarTag?: string;             // H, J, C, etc.
  variationId?: string;           // Which variation

  // Smart matching metadata
  contentKeywords?: string[];     // Extracted keywords
  primaryTopic?: string;          // Main subject

  // Usage tracking
  used: boolean;
  usedOn?: string;                // What it was used for
  usedAt?: Date;
  usedByArticleId?: string;       // If used in article
  usedCount: number;              // Times reused

  // Metadata
  createdAt: Date;
  fileSize?: number;
  width?: number;
  height?: number;

  // User ratings
  rating?: number;                // 1-5 stars
  favorite: boolean;
}

interface ImageBankFilters {
  search?: string;
  category?: string;
  avatarTag?: string;
  used?: boolean;
  favorite?: boolean;
  dateRange?: { start: Date; end: Date };
  rating?: number;
}
```

### UI Layout
```
┌─────────────────────────────────────────────────────────────┐
│  🖼️ Image Bank                              [⬇️ Export All] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Filters:                                                    │
│  [All Categories ▼] [All Avatars ▼] [☐ Show Used] [🔍 Search]│
│                                                              │
│  Sort: [Newest First ▼]        Images: 47 (12 used)         │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       ││
│  │ │     │ │     │ │     │ │     │ │     │ │     │       ││
│  │ │ IMG │ │ IMG │ │ IMG │ │ IMG │ │ IMG │ │ IMG │       ││
│  │ │     │ │     │ │     │ │     │ │     │ │     │       ││
│  │ ├─────┤ ├─────┤ ├─────┤ ├─────┤ ├─────┤ ├─────┤       ││
│  │ │Kit..│ │Bath.│ │Stov.│ │Sink.│ │Coun.│ │Floo.│       ││
│  │ │ ⭐⭐⭐ │ │ ⭐⭐  │ │ ⭐⭐⭐⭐│ │ ⭐⭐⭐ │ │ ⭐⭐  │ │ ⭐⭐⭐⭐│       ││
│  │ │[H]  │ │[H]  │ │[H]  │ │[J]  │ │[J]  │ │[C]  │       ││
│  │ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘       ││
│  │                                                         ││
│  │ [Load More...]                                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  Selected: 3                    [🗑️ Delete] [⬇️ Download]   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Image Detail Modal                                    [X]  │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐  Title: [Kitchen Counter Clean]  │
│  │                       │  Category: [Service ▼]           │
│  │                       │  Avatar: House Cleaning (H)      │
│  │      LARGE IMAGE      │  Rating: ⭐⭐⭐⭐☆                    │
│  │                       │  ☐ Favorite                      │
│  │                       │                                  │
│  │                       │  Prompt:                         │
│  └───────────────────────┘  "A professional cleaner wiping  │
│                             down granite countertops..."    │
│                                                              │
│  Tags: [kitchen] [cleaning] [countertop] [+]                │
│                                                              │
│  Usage: Used in "Standard Cleaning Page" on 12/26/2025      │
│                                                              │
│  [⬇️ Download] [📋 Copy URL] [🔄 Regenerate] [🗑️ Delete]     │
└─────────────────────────────────────────────────────────────┘
```

### Key Features
1. **Grid View**: Responsive image grid with thumbnails
2. **Filtering**: By category, avatar, usage status, rating
3. **Search**: Full-text search across titles, prompts, tags
4. **Bulk Operations**: Select multiple, delete, download, export
5. **Detail Modal**: Full image view with metadata editing
6. **Usage Tracking**: See where each image was used
7. **Auto-Tagging**: LLM analyzes image and suggests title/category
8. **Rating System**: Rate images for quality assessment

### Acceptance Criteria
- [ ] Display images in responsive grid
- [ ] Filter by category, avatar, used/unused
- [ ] Search across title, prompt, tags
- [ ] Click to open detail modal
- [ ] Edit title, category, tags inline
- [ ] Download individual or bulk
- [ ] Delete with confirmation
- [ ] Show usage history
- [ ] Auto-tag using LLM vision
- [ ] Lazy load images for performance
- [ ] Drag-and-drop to reorder

---

## Feature Spec 005: Batch Generation

### Overview
Generate multiple images at once based on avatar configurations and placeholder combinations.

### UI Layout
```
┌─────────────────────────────────────────────────────────────┐
│  ⚡ Batch Generate                                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Mode: [Simple Variations] [Advanced Combinations]          │
│                                                              │
│  ═══════════════════════════════════════════════════════════│
│                                                              │
│  Available Combinations (9 total):                          │
│                                                              │
│  [☑] 1. stove burners + male 25-35                         │
│  [☑] 2. stove burners + female 25-35                       │
│  [☑] 3. stove burners + female 38-45                       │
│  [☐] 4. sink + male 25-35                                  │
│  [☐] 5. sink + female 25-35                                │
│  [☑] 6. sink + female 38-45                                │
│  [☑] 7. countertops + male 25-35                           │
│  [☐] 8. countertops + female 25-35                         │
│  [☐] 9. countertops + female 38-45                         │
│                                                              │
│  [Select All] [Select None] [Randomize 5]                   │
│                                                              │
│  ═══════════════════════════════════════════════════════════│
│                                                              │
│  Settings:                                                   │
│  Quantity per combination: [1 ▼]                            │
│  Model: [GPT-Image-1.5 ▼]                                   │
│  Quality: [High ▼]                                          │
│  Auto-add to Bank: [☑]                                      │
│                                                              │
│  Selected: 5 combinations × 1 each = 5 images               │
│  Estimated cost: ~$0.50                                     │
│                                                              │
│  [🚀 Generate 5 Images]                                     │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Progress: ████████░░░░░░░░ 3/5 (60%)                       │
│                                                              │
│  ✅ stove burners + male 25-35                              │
│  ✅ stove burners + female 25-35                            │
│  ✅ stove burners + female 38-45                            │
│  ⏳ sink + female 38-45                                     │
│  ⏸️ countertops + male 25-35                                │
└─────────────────────────────────────────────────────────────┘
```

### Generation Flow
```typescript
const batchGenerate = async (config: BatchConfig) => {
  const { combinations, quantity, model, quality, addToBank } = config;
  const results: GenerationResult[] = [];

  // Process with concurrency limit (avoid rate limits)
  const CONCURRENCY = 2;

  for (let i = 0; i < combinations.length; i += CONCURRENCY) {
    const batch = combinations.slice(i, i + CONCURRENCY);

    const batchResults = await Promise.all(
      batch.map(async (combo) => {
        // Build prompt from combination
        const prompt = applyToPrompt(avatar.mainPrompt, combo);

        // Generate image
        const image = await generateImage({
          prompt,
          model,
          quality,
          size: combo.orientation === 'vertical' ? '1024x1536' : '1536x1024'
        });

        // Add to bank if configured
        if (addToBank) {
          await addToImageBank(image, {
            avatarId: avatar.id,
            avatarTag: avatar.tag,
            variation: combo.label,
            prompt
          });
        }

        return { combo, image, success: true };
      })
    );

    results.push(...batchResults);
    updateProgress(results.length, combinations.length);
  }

  return results;
};
```

### Acceptance Criteria
- [ ] Show all available combinations
- [ ] Select/deselect individual combinations
- [ ] Select all / none / random N
- [ ] Configure quantity per combination
- [ ] Show estimated cost before generation
- [ ] Real-time progress indicator
- [ ] Cancel in-progress generation
- [ ] Auto-add to bank option
- [ ] Handle failures gracefully (retry failed)
- [ ] Show results summary when complete

---

## Feature Spec 006: Smart Content Matching

### Overview
AI analyzes text content and automatically selects or generates the most relevant image.

### Flow Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                    SMART CONTENT MATCHING                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  INPUT: Article paragraph                                    │
│  "Our professional cleaners pay special attention to stove   │
│   burners, removing grease buildup and making them shine..." │
│                                                              │
│                         │                                    │
│                         ▼                                    │
│              ┌───────────────────┐                          │
│              │ CONTENT ANALYZER  │                          │
│              │ (GPT-4o-mini)     │                          │
│              └───────────────────┘                          │
│                         │                                    │
│                         ▼                                    │
│              ┌───────────────────┐                          │
│              │ Analysis Output:  │                          │
│              │ • topic: "stove"  │                          │
│              │ • activity: "clean│                          │
│              │   grease"         │                          │
│              │ • keywords: [...]│                          │
│              └───────────────────┘                          │
│                         │                                    │
│          ┌──────────────┴──────────────┐                    │
│          ▼                              ▼                    │
│   ┌─────────────┐              ┌─────────────┐              │
│   │ BANK SEARCH │              │  GENERATE   │              │
│   │ Score match │              │  On-demand  │              │
│   └─────────────┘              └─────────────┘              │
│          │                              │                    │
│          ▼                              ▼                    │
│   Best match: 85%              New image with               │
│   "Stove Cleaning"             content-aware prompt         │
│                                                              │
│                         │                                    │
│                         ▼                                    │
│              ┌───────────────────┐                          │
│              │   OUTPUT IMAGE    │                          │
│              │ Semantically      │                          │
│              │ matched to text   │                          │
│              └───────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Matching Algorithm
```typescript
const scoreImageMatch = (image: BankImage, analysis: ContentAnalysis): number => {
  let score = 0;
  const imgText = `${image.title} ${image.prompt} ${image.tags?.join(' ')}`.toLowerCase();

  // Primary topic match (highest weight)
  if (analysis.primaryTopic && imgText.includes(analysis.primaryTopic.toLowerCase())) {
    score += 10;
  }

  // Activity match
  if (analysis.activity && imgText.includes(analysis.activity.toLowerCase())) {
    score += 8;
  }

  // Keyword matches
  for (const keyword of analysis.keywords) {
    if (imgText.includes(keyword.toLowerCase())) {
      score += 3;
    }
  }

  // Avatar tag match (routing bonus)
  if (analysis.avatarTag && image.avatarTag === analysis.avatarTag) {
    score += 5;
  }

  // Penalty for already used
  if (image.used) {
    score -= 15;
  }

  // Bonus for high rating
  if (image.rating && image.rating >= 4) {
    score += 2;
  }

  return score;
};
```

### Modes
| Mode | Behavior |
|------|----------|
| `bank_first` | Search bank, generate only if no match (score < threshold) |
| `generate_first` | Always generate, add to bank for future |
| `bank_only` | Only use bank, skip if no match |
| `generate_only` | Always generate, don't save to bank |

### UI Toggle
```
┌─────────────────────────────────────────────────────────────┐
│  🧠 Smart Content Matching                      [BETA]  [●] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  AI analyzes text and automatically matches or generates    │
│  images based on content. Perfect for SEO optimization.     │
│                                                              │
│  Mode: [Bank First] [Generate First] [Bank Only] [Gen Only] │
│              ↑ selected                                      │
│                                                              │
│  Threshold: Match score must be > [5] to use bank image     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Acceptance Criteria
- [ ] Toggle to enable/disable
- [ ] Four mode options
- [ ] Configurable match threshold
- [ ] Show match score in results
- [ ] Handle no-match gracefully
- [ ] Log all matching decisions
- [ ] API endpoint for external integration

---

## Feature Spec 007: Export & Integration

### Overview
Multiple ways to get images out of PicMimic and into other systems.

### Export Options

#### 1. Direct Download
- Individual image download
- Bulk download as ZIP
- Choice of format (PNG, JPEG, WebP)
- Choice of size (original, optimized, thumbnail)

#### 2. URL Access
- Each image has permanent URL
- CDN-backed for performance
- Signed URLs for private images

#### 3. API Access
```typescript
// API for external systems
GET  /api/v1/images                    // List images
GET  /api/v1/images/:id                // Get image details
GET  /api/v1/images/:id/download       // Download image
POST /api/v1/images/match              // Smart match for content
POST /api/v1/images/generate           // Generate new image

// Webhooks
POST /api/v1/webhooks                  // Register webhook
// Events: image.generated, image.matched, batch.complete
```

#### 4. Direct Integrations
- WordPress Media Library (direct upload)
- Shopify Products (attach to products)
- Google Drive / Dropbox sync
- Figma plugin (drag into designs)

### Acceptance Criteria
- [ ] Download individual images
- [ ] Bulk download as ZIP
- [ ] Format conversion options
- [ ] Public URL for each image
- [ ] API with authentication
- [ ] Webhook registration
- [ ] WordPress direct integration
- [ ] Usage documentation

---

## Database Schema Summary

```sql
-- Core tables
CREATE TABLE users (...);
CREATE TABLE projects (...);
CREATE TABLE audience_avatars (...);
CREATE TABLE images (...);
CREATE TABLE chat_histories (...);
CREATE TABLE usage_logs (...);

-- Settings stored as JSONB on projects
-- This allows flexible schema evolution
projects.settings = {
  consultant_model: 'gpt-image-1.5',
  worker_model: 'gpt-4o-mini',
  image_generation_model: 'gpt-image-1.5',
  smart_matching_enabled: true,
  smart_matching_mode: 'bank_first',
  default_quality: 'high',
  default_size: '1024x1536',
  ...
}
```

---

## API Summary

```
Authentication:
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

Projects:
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
DELETE /api/projects/:id

Avatars:
GET    /api/projects/:id/avatars
POST   /api/projects/:id/avatars
PUT    /api/projects/:id/avatars/:avatarId
DELETE /api/projects/:id/avatars/:avatarId

Images:
GET    /api/projects/:id/images
POST   /api/projects/:id/images/generate
POST   /api/projects/:id/images/batch-generate
GET    /api/projects/:id/images/:imageId
PUT    /api/projects/:id/images/:imageId
DELETE /api/projects/:id/images/:imageId

Consultant:
POST   /api/projects/:id/chat
GET    /api/projects/:id/chat/history
DELETE /api/projects/:id/chat/history

Smart Matching:
POST   /api/projects/:id/match
POST   /api/projects/:id/match/batch

Export:
GET    /api/projects/:id/export
GET    /api/projects/:id/images/:imageId/download
```

---

## Success Metrics

### User Engagement
- Time to first image generated: < 5 minutes
- Images generated per session: > 5
- Return rate within 7 days: > 40%
- Consultant chat messages per session: > 3

### Technical Performance
- Image generation success rate: > 98%
- API response time p95: < 500ms
- Image load time p95: < 2s
- Uptime: > 99.5%

### Business Metrics
- Free to paid conversion: > 5%
- Monthly churn: < 8%
- NPS score: > 40
- Support tickets per 100 users: < 5

---

## Getting Started Checklist for Coding Agents

- [ ] Set up project structure per standards
- [ ] Implement authentication (users, JWT)
- [ ] Create projects CRUD
- [ ] Build Consultant chat (GPT-Image-1.5)
- [ ] Implement image generation endpoint
- [ ] Create Audience Avatar system
- [ ] Build Advanced Placeholder system
- [ ] Implement Image Bank
- [ ] Add Batch Generation
- [ ] Implement Smart Content Matching
- [ ] Build export/download features
- [ ] Add billing integration
- [ ] Deploy to production
- [ ] Documentation and onboarding

---

**This is the foundation. Build it right, and it scales to millions.**

*PicMimic: Where AI becomes your creative partner, not just a tool.*
