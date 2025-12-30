# PromptFlow User Manual

## Table of Contents
1. [System Overview](#system-overview)
2. [What Has UI vs API-Only](#what-has-ui-vs-api-only)
3. [Image Creation System](#image-creation-system)
4. [Site Planning](#site-planning)
5. [Hierarchical Page Push](#hierarchical-page-push)
6. [Local Viking Integration](#local-viking-integration)
7. [WordPress Publishing](#wordpress-publishing)
8. [API Reference](#api-reference)

---

## System Overview

PromptFlow is an AI-powered content and image generation system designed for SEO-focused website building. The system includes:

- **Article Generation** - AI-written content with keyword targeting
- **Image Creation** - AI image generation with audience avatars
- **Site Planning** - Hierarchical site structure management
- **WordPress Publishing** - Push content to WordPress with Elementor
- **Local Viking Integration** - Rank tracking and GBP automation (NEW)

---

## What Has UI vs API-Only

### Has Full UI (Ready to Use)
| Feature | Location | Status |
|---------|----------|--------|
| Workflow Management | Main dashboard | Full UI |
| Article Generation | Workflow → Content section | Full UI |
| Image Creation | Workflow → Image Creation tab | Full UI |
| Image Bank | Within Image Creation | Full UI |
| Prompt Engineering | Within Image Creation | Full UI |
| Human Feedback | Popup after image generation | Full UI |
| Client/Website Management | Settings | Full UI |

### API-Only (Backend Built, No UI Yet)
| Feature | What It Does | How to Use Now |
|---------|--------------|----------------|
| Site Planning | Hierarchical page structure | API calls or direct DB |
| Hierarchical Page Push | Push pages with parent-child relationships | API calls |
| Local Viking | Rank tracking, GBP posting | API calls |
| Rinse & Repeat | Auto-cycle GBP posts | API calls |

**What this means:** The backend is complete and working. To use these features today, you need to make API calls (via Postman, curl, or custom frontend). I can help build frontend UI for any of these if you want.

---

## Image Creation System

### Location
Workflow → **Image Creation** tab

### Features with Full UI

#### 1. Audience Avatars
Create different "personas" for your AI images. Each avatar represents a target audience or image style.

**How to use:**
1. Go to Image Creation tab
2. Click "Add Avatar" or edit existing
3. Set the main prompt (e.g., "Professional glass installer, 40s, wearing safety glasses")
4. Add variations for different scenarios

#### 2. Image Bank
Store generated images for later use instead of generating new ones each time.

**How to use:**
1. Generate images or upload them
2. They appear in the Image Bank
3. Tag them by category (Hero, Service, Team, etc.)
4. When publishing articles, images are pulled from the bank

#### 3. Prompt Engineering Chat
Two-agent system for refining image prompts:
- **Consultant**: High-level strategy and direction
- **Worker**: Executes specific prompt refinements

**How to use:**
1. Click the chat icon in Image Creation
2. Describe what's not working with your images
3. The AI will suggest prompt improvements

#### 4. Prompt Problem Areas
Track recurring issues with your image generation.

**How to use:**
1. When images don't look right, note the problem
2. Add it to Problem Areas
3. Mark as "solved" when you find a fix
4. This builds your knowledge base over time

#### 5. Human Feedback Loop
After generating images, rate them to improve future results.

**How to use:**
1. After image generation, a popup appears
2. Rate: Perfect / Good / Needs Work / Bad
3. Add tags for what went wrong (wrong lighting, wrong pose, etc.)
4. System learns from your feedback

---

## Site Planning

### What It Is
A hierarchical tree structure for planning your website before building it. Think of it as a blueprint.

```
Homepage
├── Services
│   ├── Residential Glass
│   ├── Commercial Glass
│   └── Emergency Repairs
├── About Us
│   ├── Our Team
│   └── Our History
├── Service Areas
│   ├── Phoenix
│   ├── Scottsdale
│   └── Mesa
└── Contact
```

### Current Status: API-Only
The database tables and API endpoints exist, but there's no drag-and-drop UI yet.

### How to Use Now (API)

#### Create a Site Plan
```bash
POST /api/site-planning/plans
{
  "websiteId": 1,
  "name": "Main Site Structure",
  "description": "30 core pages for SEO"
}
```

#### Add Nodes (Pages)
```bash
POST /api/site-planning/nodes
{
  "sitePlanId": 1,
  "title": "Residential Glass Services",
  "slug": "residential-glass",
  "parentId": 2,  // ID of parent node (e.g., "Services")
  "targetKeyword": "residential glass installation phoenix",
  "isPillarPage": true,
  "pageType": "service"
}
```

#### Get the Tree
```bash
GET /api/site-planning/nodes/1
```
Returns nested tree structure with all pages.

#### Import from Spreadsheet
```bash
POST /api/site-planning/import
{
  "sitePlanId": 1,
  "format": "csv",
  "data": "title,parent,keyword,type\nServices,,glass services,page\nResidential,Services,residential glass,service"
}
```

---

## Hierarchical Page Push

### What It Is
Push your site plan to WordPress while preserving parent-child relationships. When you push:
- Parent pages are created first
- Child pages link to their parents
- WordPress menu structure matches your plan

### Why It Matters
- Better SEO (URL structure: `/services/residential-glass/`)
- Easier navigation
- Google understands your site hierarchy

### How to Use (API)

#### Push Entire Hierarchy
```bash
POST /api/site-planning/push-hierarchy/1
{
  "status": "draft",           // or "publish"
  "dripFeed": true,            // Spread publishing over time
  "dripIntervalHours": 24      // One page per day
}
```

This will:
1. Get all unpushed nodes ordered by depth
2. Create parent pages first
3. Create child pages with correct parent IDs
4. Update your site plan with WordPress page IDs

#### Push Single Page with Content
```bash
POST /api/site-planning/push-with-content/15
{
  "status": "draft"
}
```

Uses the linked article's content if available.

#### Link Article to Site Plan Node
```bash
POST /api/site-planning/link-article/15
{
  "articleId": 42
}
```

---

## Local Viking Integration

### What It Is
Integration with [Local Viking](https://localviking.com) for:
- **GeoGrid Rank Tracking**: Heat maps showing where you rank in different locations
- **GBP Posting**: Post to Google Business Profile automatically
- **Rinse & Repeat**: Auto-delete old posts and repost same content (keeps posts fresh)
- **Photo Uploads**: Push AI-generated images to GBP

### The "Sheep Herding" Strategy
This is the core SEO strategy the system supports:

1. **Scan keywords** with GeoGrid to see where you rank
2. **Identify "sheep"** - keywords ranking 4-10 (close to top 3)
3. **Create supporting content** for those keywords
4. **Push to top 3** with focused effort on winnable keywords
5. **Maintain** with GBP posts and fresh content

### Setup (When You Have an Account)

#### 1. Add API Key to Website
In your website settings, add:
- `local_viking_api_key`: Your API key from Local Viking
- `local_viking_location_id`: Your GBP location ID

Or via API:
```bash
PUT /api/websites/1
{
  "local_viking_api_key": "your-key-here",
  "local_viking_location_id": "location-id-here"
}
```

#### 2. Run Database Migration
```bash
node server/db/setup-all.mjs
```

### How to Use (API)

#### Test Connection
```bash
POST /api/local-viking/test-connection
{
  "websiteId": 1
}
```

#### Check Credit Balance
```bash
GET /api/local-viking/credits/1
```

#### Run a Rank Scan
```bash
POST /api/local-viking/geogrid/scan
{
  "websiteId": 1,
  "keyword": "glass repair near me",
  "gridSize": 7,      // 7x7 = 49 credits
  "distance": 1       // Miles between grid points
}
```

Returns:
```json
{
  "success": true,
  "scan": { "grid_data": [...] },
  "analysis": {
    "total_points": 49,
    "top_3": 12,
    "positions_4_to_10": 20,  // SHEEP - ready to herd!
    "sheep_opportunity_score": 45.5,
    "recommendation": "HIGH PRIORITY: Many positions ready to push to top 3!"
  }
}
```

#### Scan Multiple Keywords
```bash
POST /api/local-viking/geogrid/bulk-scan
{
  "websiteId": 1,
  "keywords": ["glass repair phoenix", "window replacement", "shower doors"],
  "gridSize": 7
}
```

#### Get Rank History (Trends)
```bash
GET /api/local-viking/geogrid/history/1?keyword=glass%20repair&days=30
```

#### Get Sheep Opportunities
```bash
GET /api/local-viking/sheep-opportunities/1
```

Returns keywords sorted by opportunity score (highest = best ROI for content creation).

#### Create a GBP Post
```bash
POST /api/local-viking/posts
{
  "websiteId": 1,
  "content": "Need emergency glass repair? We're available 24/7! Call now for same-day service.",
  "callToAction": "CALL",
  "ctaUrl": "tel:+16025551234",
  "imageUrl": "https://yoursite.com/image.jpg",
  "saveAsTemplate": true,
  "templateName": "Emergency Services"
}
```

#### Create Post Templates (for Rinse & Repeat)
```bash
POST /api/local-viking/templates
{
  "websiteId": 1,
  "name": "Monday - Emergency Services",
  "content": "24/7 Emergency Glass Repair! When disaster strikes, we're here.",
  "callToAction": "CALL",
  "ctaUrl": "tel:+16025551234",
  "rotationDay": 1  // 1 = Monday
}
```

Create 7 templates (one per day) for automatic rotation.

#### Execute Rinse & Repeat
```bash
POST /api/local-viking/rinse-repeat/1
{
  "maxAgeDays": 7,        // Delete posts older than 7 days
  "repostImmediately": true,
  "useTemplates": true    // Use stored templates instead of same content
}
```

**What happens:**
1. Fetches all GBP posts
2. Deletes posts older than 7 days
3. Posts today's template
4. Updates template stats

**Run this weekly** via cron job or manual trigger.

#### Check Rinse & Repeat Status
```bash
GET /api/local-viking/rinse-repeat/status/1?maxAgeDays=7
```

Shows which posts are due for refresh.

#### Analyze Site Plan with Rank Data
```bash
POST /api/local-viking/analyze-site-plan/1
{
  "scanKeywords": true,   // Run scans for keywords without recent data
  "gridSize": 7
}
```

Returns prioritized list of pages to create content for, based on sheep opportunity scores.

### Credit Costs
| Action | Credits |
|--------|---------|
| 7x7 GeoGrid scan | 49 |
| 9x9 GeoGrid scan | 81 |
| 11x11 GeoGrid scan | 121 |
| GBP Post | 1 |
| Photo Upload | 1 |

#### Estimate Monthly Usage
```bash
POST /api/local-viking/estimate-credits
{
  "locationsCount": 1,
  "keywordsPerLocation": 10,
  "scansPerMonth": 4,
  "gridSize": 7,
  "postsPerWeek": 2
}
```

---

## WordPress Publishing

### Location
Workflow → **Elementor** tab (for articles with images)

### Features

#### Push Single Article
1. Select an article
2. Click "Push to Elementor"
3. Choose draft or publish
4. Article is created in WordPress with Elementor formatting

#### Drip Feed Publishing
Schedule multiple articles to publish over time:
1. Select multiple articles
2. Click "Schedule Drip Feed"
3. Set pages per day and start time
4. Articles are scheduled across multiple days

### Hierarchy Support (New)
When pushing from Site Planning, pages maintain their parent-child relationships.

---

## API Reference

### Base URL
```
http://localhost:3001/api (development)
https://your-domain.com/api (production)
```

### Authentication
Most endpoints don't require auth, but WordPress operations use credentials stored in website settings.

### Key Endpoints

#### Workflows
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /workflows | List all workflows |
| GET | /workflows/:id | Get workflow details |
| POST | /workflows | Create workflow |
| PUT | /workflows/:id | Update workflow |

#### Articles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /articles?workflowId=1 | List articles for workflow |
| POST | /articles | Create article |
| PUT | /articles/:id | Update article |

#### Image Creation
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /image-creation/:workflowId | Get settings |
| PUT | /image-creation/:workflowId | Update settings |

#### Image Bank
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /image-bank/:workflowId | Get all images |
| POST | /image-bank/:workflowId | Add image |
| PUT | /image-bank/:workflowId/:imageId | Update image |
| DELETE | /image-bank/:workflowId/:imageId | Delete image |

#### Site Planning
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /site-planning/plans | List all plans |
| POST | /site-planning/plans | Create plan |
| GET | /site-planning/nodes/:planId | Get tree structure |
| POST | /site-planning/nodes | Add node |
| POST | /site-planning/push-hierarchy/:planId | Push all to WP |

#### Local Viking
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /local-viking/test-connection | Test API |
| GET | /local-viking/credits/:websiteId | Check credits |
| POST | /local-viking/geogrid/scan | Run rank scan |
| POST | /local-viking/posts | Create GBP post |
| POST | /local-viking/rinse-repeat/:websiteId | Execute cycle |
| GET | /local-viking/sheep-opportunities/:websiteId | Get priorities |

---

## What Needs Frontend Work

If you want me to build UI for any of these, just say the word:

1. **Site Planning Tree View**
   - Drag-and-drop tree editor
   - Visual hierarchy management
   - Quick actions (add child, delete, edit)

2. **Local Viking Dashboard**
   - Credit balance display
   - Keyword rank heatmaps
   - Sheep opportunity list
   - Post template manager
   - Rinse & repeat scheduler

3. **Hierarchical Push UI**
   - Preview tree before pushing
   - Progress indicator during push
   - Status of each page (pushed/pending)

4. **Site Planning Import**
   - CSV/spreadsheet upload
   - Column mapping interface
   - Preview before import

---

## Quick Start Checklist

### To Use Image Creation (Ready Now)
- [ ] Create a workflow
- [ ] Go to Image Creation tab
- [ ] Set up at least one avatar
- [ ] Generate some test images
- [ ] Build your image bank

### To Use Site Planning (API)
- [ ] Create a website in settings
- [ ] Create a site plan via API
- [ ] Add nodes (pages) to the plan
- [ ] Link articles to nodes
- [ ] Push to WordPress

### To Use Local Viking (When Ready)
- [ ] Sign up at localviking.com
- [ ] Add API key to website settings
- [ ] Run database migration
- [ ] Test connection
- [ ] Create post templates
- [ ] Set up weekly rinse & repeat

---

## Getting Help

- **API Issues**: Check server logs for error details
- **Database**: Run `node server/db/setup-all.mjs` to ensure all tables exist
- **Frontend Not Loading**: Check if server is running on port 3001

For questions about any feature, I can explain in more detail or help build the UI you need!
