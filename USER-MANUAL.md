# PromptFlow User Manual

## Table of Contents
1. [System Overview](#system-overview)
2. [Getting Started](#getting-started)
3. [Image Creation System](#image-creation-system)
4. [Site Planning](#site-planning)
5. [Push to WordPress](#push-to-wordpress)
6. [Local Viking Integration](#local-viking-integration)
7. [The SEO Automation Loop](#the-seo-automation-loop)
8. [API Reference](#api-reference)
9. [Troubleshooting](#troubleshooting)

---

## System Overview

PromptFlow is an AI-powered content and image generation system designed for local SEO. The goal: get your Google Business Profile into the **Map Pack** (top 3 local results).

### Core Features

| Feature | What It Does | Has UI? |
|---------|--------------|---------|
| Workflow Management | Organize content projects | ✅ Yes |
| Article Generation | AI-written SEO content | ✅ Yes |
| Image Creation | AI images with avatars | ✅ Yes |
| Site Planning | Hierarchical page structure | ✅ Yes |
| Push to WordPress | Publish with parent-child pages | ✅ Yes |
| Local Viking | Rank tracking & GBP automation | ✅ Yes |

---

## Getting Started

### Step 1: Set Up Local Viking API Key (Global)

1. Click **"Settings"** in the top navigation (gear icon)
2. Scroll to the **Local Viking** section
3. Enter your **Local Viking API Key** (get from localviking.com → Settings → API Keys)
4. Click **"Save Local Viking Settings"**

> **Note:** The API key is account-level and works for all your websites. You only enter it once.

### Step 2: Set Up a Client and Website

1. Click **"Settings"** in the top navigation
2. Under **Agency Manager**, click **"Add Client"**
3. Fill in:
   - Client name
   - Contact email (optional)
4. Click **"Save"**
5. Click **"Add Website"** for your new client
6. Fill in:
   - Website name
   - Website URL
   - WordPress URL (e.g., `https://yoursite.com/wp-json`)
   - WordPress username
   - WordPress application password
   - **Local Viking Location ID** (your GBP campaign/location ID - each business has its own)
7. Click **"Save"**

### Step 3: Create a Workflow

1. Click **"New Workflow"** on the main dashboard
2. Select your client and website
3. Give it a name (e.g., "Core 30 Pages")
4. Click **"Create"**

---

## Image Creation System

### Location
Workflow → **Image Creation** tab

### Step-by-Step Guide

#### Creating Audience Avatars

Avatars define the "look" of people in your AI images.

1. Go to **Image Creation** tab
2. Click **"Add Avatar"**
3. Fill in:
   - **Name**: e.g., "Professional Installer"
   - **Main Prompt**: e.g., "Professional glass installer, 40s, wearing safety glasses, blue work shirt"
4. Add **Variations** for different scenarios:
   - "installing residential window"
   - "measuring glass panel"
   - "consulting with homeowner"
5. Click **"Save"**

#### Generating Images

1. Select an avatar from the dropdown
2. Choose a variation (or use main prompt)
3. Set quantity (1-4 images)
4. Click **"Generate"**
5. Wait for images to appear (usually 10-30 seconds)

#### Rating Images (Human Feedback)

After generation, a popup appears:

| Rating | When to Use |
|--------|-------------|
| ⭐ Perfect | Exactly what you wanted |
| 👍 Good | Usable, minor issues |
| 🔄 Needs Work | Close but needs refinement |
| ❌ Bad | Wrong completely |

Add tags for issues: "wrong lighting", "weird hands", "wrong uniform"

#### Building Your Image Bank

1. Good images automatically go to the **Image Bank**
2. Click **"Image Bank"** tab to view
3. Tag images by category:
   - Hero (main banner images)
   - Service (action shots)
   - Team (portraits)
   - Gallery (general use)
4. When publishing articles, images pull from this bank

---

## Site Planning

### Location
Section **8** on the main dashboard (scroll down)

### What It Does
Creates a hierarchical tree of pages for your website. This is your SEO blueprint.

### Step-by-Step Guide

#### Creating a Site Plan

1. Scroll to **Site Planning** section
2. Select your website from the dropdown
3. Click **"New Plan"**
4. Enter:
   - **Plan Name**: e.g., "Main Site Structure"
   - **Description**: e.g., "30 core pages for local SEO"
5. Click **"Create"**

#### Adding Pages (Nodes)

1. Select your plan from the dropdown
2. The tree view shows existing pages
3. Click **"Add Page"**
4. Fill in:
   - **Title**: Page title (e.g., "Residential Glass Services")
   - **Slug**: URL slug (e.g., "residential-glass")
   - **Parent**: Select parent page for hierarchy
   - **Target Keyword**: Main SEO keyword
   - **Page Type**: service, location, about, etc.
   - **Is Pillar Page**: Check if this is a main topic page
5. Click **"Add"**

#### Understanding the Tree View

```
Homepage
├── Services (pillar)
│   ├── Residential Glass
│   ├── Commercial Glass
│   └── Emergency Repairs
├── Service Areas (pillar)
│   ├── Phoenix
│   ├── Scottsdale
│   └── Mesa
└── Contact
```

- **Pillar pages** are marked with a special icon
- **Child pages** are indented under their parent
- **Status colors**:
  - Gray = Not pushed
  - Yellow = Draft in WordPress
  - Green = Published

---

## Push to WordPress

### Location
Site Planning section → **"Push to WP"** button

### What It Does
Pushes your entire site plan to WordPress, preserving the parent-child hierarchy. This creates proper URL structures like:
- `/services/residential-glass/`
- `/service-areas/phoenix/`

### Step-by-Step Guide

#### Pushing Your Site Plan

1. In **Site Planning**, select your plan
2. Click the **"Push to WP"** button (dropdown arrow)
3. Choose:
   - **"Push as Draft"** - Creates pages as drafts for review
   - **"Push & Publish"** - Creates and publishes immediately
4. Wait for the push to complete
5. A result message shows:
   - Pages created
   - Pages updated
   - Any errors

#### What Happens Behind the Scenes

1. System reads your site plan tree
2. Parent pages are created first
3. Child pages are created with correct WordPress parent IDs
4. Your site plan updates with WordPress page IDs
5. Status updates to "draft" or "published"

#### Tips

- **Always push as draft first** to review before publishing
- **Check WordPress** after pushing to verify hierarchy
- **Re-push** if you add new pages to the plan

---

## Local Viking Integration

### Location
Section **9** on the main dashboard (scroll down past Site Planning)

### What It Does
- Track where you rank in Google Maps across different locations
- Post to your Google Business Profile
- Identify keywords that are "almost" in the top 3 (sheep herding)
- Automate GBP post rotation (rinse & repeat)

### Prerequisites
1. Local Viking account (localviking.com)
2. **API key** added to global Settings (Settings → Local Viking section)
3. **Location ID** added to your website settings (Agency Manager → Website → Local Viking Location ID)

---

### Tab 1: Overview

Shows your connection status and account info.

#### What You See
- **Connection Status**: Green = connected, Red = disconnected
- **Credit Balance**: How many Local Viking credits you have
- **Location Name**: Your GBP listing name
- **Account Info**: Plan type, features enabled

#### Buttons
| Button | What It Does |
|--------|--------------|
| **Check Connection** | Tests your API key and shows account status |
| **Refresh** | Updates the displayed information |

---

### Tab 2: Heat Map

Visual display of where you rank for keywords across a geographic grid.

#### How to Read the Heat Map

The heat map shows a 7x7 or larger grid centered on your business location. Each cell shows your rank at that spot:

| Color | Rank | Meaning |
|-------|------|---------|
| 🟢 Green | 1-3 | **In the Map Pack!** |
| 🟡 Yellow | 4-10 | **Sheep** - close to top 3 |
| 🟠 Orange | 11-20 | Needs work |
| 🔴 Red | 20+ | Not ranking |

#### Running a Scan

1. Go to **Heat Map** tab
2. Enter a keyword (e.g., "glass repair near me")
3. Select grid size:
   - 7x7 = 49 credits (standard)
   - 9x9 = 81 credits (more detail)
   - 11x11 = 121 credits (comprehensive)
4. Click **"Run Scan"**
5. Wait 30-60 seconds for results
6. Heat map displays with your rankings

#### Viewing History

- Select a keyword from the dropdown
- Previous scans appear below
- Click a past scan to view that heat map
- Compare over time to see improvement

---

### Tab 3: Sheep Analysis

This is where the magic happens. "Sheep" are keywords ranking 4-10 - they're close to the top 3 and ready to be "herded" up.

#### Understanding the Sheep Report

| Column | Meaning |
|--------|---------|
| Keyword | The search term |
| Avg Rank | Average position across the grid |
| Top 3 % | Percentage of grid points in positions 1-3 |
| Sheep % | Percentage in positions 4-10 |
| Opportunity Score | Higher = better ROI for effort |

#### Using Sheep Data

1. Go to **Sheep Analysis** tab
2. Click **"Load Analysis"**
3. Review the table sorted by opportunity score
4. **High opportunity** keywords:
   - Create supporting content
   - Add GBP posts mentioning them
   - Build internal links to related pages
5. Re-scan after 2-4 weeks to measure progress

#### The Strategy

```
High Opportunity (score 70+)
└── Create supporting blog posts
└── Add GBP posts with keyword
└── Build internal links
└── Re-scan in 2 weeks

Medium Opportunity (score 40-70)
└── Monitor for movement
└── Include in content naturally

Low Opportunity (score <40)
└── Long-term project
└── May need more backlinks
```

---

### Tab 4: GBP Templates

Create reusable post templates for your Google Business Profile.

#### Creating a Template

1. Go to **GBP Templates** tab
2. Click **"New Template"**
3. Fill in:
   - **Name**: e.g., "Monday - Emergency Services"
   - **Content**: Your post text (500 char max)
   - **Call to Action**: CALL, BOOK, LEARN_MORE, etc.
   - **CTA URL**: Link or phone number
   - **Rotation Day**: Which day to use this template (for automation)
4. Click **"Save"**

#### Template Tips

- Create 7 templates (one for each day)
- Rotate between different services/offers
- Include target keywords naturally
- Keep content fresh and engaging

#### Posting from a Template

1. Select a template from the list
2. Click **"Post Now"**
3. Confirm the action
4. Post appears on your GBP within minutes

---

### Tab 5: Automation

Set up automatic "rinse and repeat" - delete old posts and repost fresh content.

#### Why Rinse & Repeat?

Google likes fresh content. Posts older than 7 days get less visibility. By deleting and reposting:
- Your posts stay "new"
- Google sees activity
- Customers see current info

#### Setting Up Automation

1. Go to **Automation** tab
2. Configure:
   - **Max Post Age**: Days before deletion (default: 7)
   - **Use Templates**: Enable to use your saved templates
   - **Auto-Run**: Schedule automatic execution
3. Click **"Save Settings"**

#### Running Manually

1. Click **"Run Rinse & Repeat"**
2. System will:
   - Check all GBP posts
   - Delete posts older than your max age
   - Post today's template
3. Results show:
   - Posts deleted
   - New post created
   - Any errors

#### Checking Status

- **Posts Due for Refresh**: Shows which posts are getting old
- **Last Run**: When automation last executed
- **Template Usage**: Which templates have been used recently

---

## The SEO Automation Loop

Here's how all the pieces work together:

### The Full Workflow

```
1. PLAN: Create site structure in Site Planning
          └── 30 core pages with keywords

2. WRITE: Generate articles in Workflows
          └── AI content for each page

3. IMAGE: Create visuals in Image Creation
          └── Avatars → Bank → Articles

4. PUSH: Push to WordPress
          └── Hierarchical pages live on site

5. TRACK: Run Local Viking scans
          └── See where you rank

6. ANALYZE: Check Sheep Analysis
          └── Find opportunities

7. SUPPORT: Create supporting content
          └── Blog posts for sheep keywords

8. POST: GBP posts with keywords
          └── Fresh content signals

9. REPEAT: Rinse & repeat automation
          └── Keep posts fresh

10. MEASURE: Re-scan in 2-4 weeks
          └── Track movement to top 3
```

### The "Sheep Herding" Strategy Explained

**Goal**: Get keywords from position 4-10 into the Map Pack (positions 1-3)

**Why it works**: Keywords ranking 4-10 are already close. A little push (supporting content, GBP posts, internal links) can bump them up. This is easier than trying to rank from position 50.

**The process**:
1. Scan your target keywords
2. Identify "sheep" (positions 4-10)
3. Create content specifically for those keywords
4. Post to GBP mentioning those keywords
5. Re-scan to see improvement
6. Celebrate when they hit top 3!

---

## API Reference

### Base URL
```
http://localhost:3001/api (development)
https://your-domain.com/api (production)
```

### Key Endpoints

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
| GET | /local-viking/account/:websiteId | Get account info |
| GET | /local-viking/credits/:websiteId | Check credits |
| POST | /local-viking/geogrid/scan | Run rank scan |
| GET | /local-viking/geogrid/history/:websiteId | Get scan history |
| GET | /local-viking/sheep-opportunities/:websiteId | Get sheep data |
| POST | /local-viking/posts | Create GBP post |
| GET | /local-viking/templates/:websiteId | Get templates |
| POST | /local-viking/templates | Create template |
| POST | /local-viking/rinse-repeat/:websiteId | Run automation |

---

## Troubleshooting

### Connection Issues

**"Local Viking not connected"**
1. Go to **Settings** (gear icon) → Local Viking section
2. Check your **API key** is entered correctly and saved
3. Go to **Agency Manager** → edit Website → check **Location ID** is correct
4. Click "Check Connection" in Local Viking section

**"Push to WordPress failed"**
1. Verify WordPress URL ends with `/wp-json`
2. Check username is correct
3. Ensure you're using an Application Password (not regular password)
4. WordPress → Users → Application Passwords → Generate new

### Common Errors

| Error | Solution |
|-------|----------|
| "Invalid API key" | Go to Settings → Local Viking and re-enter your API key |
| "Location not found" | Check Location ID in Agency Manager → Website settings |
| "Insufficient credits" | Buy more credits at localviking.com |
| "WordPress auth failed" | Generate new application password |
| "Parent page not found" | Push parent pages before children |

### Getting Help

- **Check server logs**: `npm run dev` shows backend errors
- **Database issues**: Run `node server/db/setup-all.mjs`
- **Reset data**: Check database tables directly

---

## Quick Reference Card

### Keyboard Shortcuts
(None currently - all mouse/touch based)

### Button Quick Guide

| Section | Button | What It Does |
|---------|--------|--------------|
| Settings | Save Local Viking Settings | Saves the global API key |
| Site Planning | Push to WP | Pushes pages to WordPress |
| Site Planning | Push as Draft | Creates as drafts |
| Site Planning | Push & Publish | Creates and publishes |
| Site Planning | Import List | Import tab-indented hierarchy |
| Site Planning | + Location | Add multi-location expansion |
| Site Planning | Neighborhoods | Gap analysis for neighborhoods |
| Local Viking | Check Connection | Tests API connection |
| Local Viking | Run Scan | Runs new GeoGrid scan |
| Local Viking | Load Analysis | Gets sheep opportunities |
| Local Viking | New Template | Creates GBP post template |
| Local Viking | Post Now | Posts template to GBP |
| Local Viking | Run Rinse & Repeat | Executes post rotation |

---

*Last updated: December 2024*
*PromptFlow v2.1 - Global Settings & Multi-Location*
