# Site Planning System - User Manual

## Overview

The Site Planning system is THE central hub for organizing, generating, and managing all website pages in PromptFlow. It provides a visual tree structure that represents your website's page hierarchy, integrates with content generation, and syncs with WordPress.

---

## Getting Started

### Creating a Site Plan

1. **Select a Workflow**: You must have a workflow selected before creating a site plan
   - If no workflow is selected, you'll see: "Please select a workflow first"

2. **Click "Create Site Plan"**: This creates an empty site plan with a default Homepage

3. **Add Pages**: Use the "+ Add Page" button to add root-level pages, or hover over any page and click the "+" icon to add child pages

---

## The Site Planning Interface

### Header Buttons (Left to Right)

| Button | Function |
|--------|----------|
| **Push to WP** | Push planned pages to WordPress as drafts or publish directly |
| **Select** | Enter selection mode to choose multiple pages for batch generation |
| **Generate All (N)** | Generate content for ALL pages in the site plan |
| **Check WP Sync** | Compare your site plan against what exists in WordPress |
| **Import List** | Import pages from a tab-indented text list |
| **+ Location** | Add a new location (for multi-location businesses) |
| **Neighborhoods** | Analyze geographic coverage gaps |
| **CSV** | Import pages from CSV format |
| **Export** | Download the site plan as JSON file |
| **+ Add Page** | Add a new root-level page |

### Page Row Elements

Each page row shows:
- **Expand/Collapse Arrow**: Click to show/hide child pages
- **Color Dot**: Indicates page type (see legend below tree)
- **Page Title**: The name of the page
- **Slug**: URL path for the page (e.g., `/services`)
- **Status Badge**: Current status (planned, in_progress, built, published)
- **Pillar Badge**: Shows if page is marked as a pillar page
- **WP Link**: External link icon appears if page exists in WordPress

### Page Action Buttons (Hover to reveal)

| Icon | Action |
|------|--------|
| **Eye** | View Content - Opens PageDetailModal |
| **Lightning** | Generate - Generate content for this single page |
| **Plus** | Add Child - Add a child page under this one |
| **Pencil** | Edit - Edit page properties |
| **Trash** | Delete - Remove the page |

---

## Page Types

| Type | Color | Description |
|------|-------|-------------|
| Page | Blue | Generic page |
| Landing Page | Purple | Landing/conversion page |
| Service Page | Green | Service description page |
| Location Page | Amber | City/area-specific page |
| Blog Post | Pink | Blog article |
| Category | Cyan | Category/archive page |

---

## Generation Modes

### 1. Generate SINGLE Page
- Hover over any page in the tree
- Click the **Lightning bolt** icon
- Content generates for just that page

### 2. Generate SELECTED Pages
1. Click **"Select"** button in header
2. Checkboxes appear next to each page
3. Check the pages you want to generate
4. Click **"Generate X Selected"** button
5. Use "Select All" / "Deselect All" for quick selection

### 3. Generate ALL Pages
- Click **"Generate All (N)"** button
- All pages in the site plan will be processed sequentially
- Progress overlay shows current page being generated

---

## PageDetailModal - The Content Hub

When you click the **Eye icon** (View Content) on any page, the PageDetailModal opens with 4 tabs:

### Tab 1: Content
- Displays the generated article content
- Shows **Hero Image** with configured placement (left/right)
- Shows **Inline Images** distributed through content
- Content is formatted as it would appear on the final webpage

### Tab 2: Images
- **Push Images to WordPress** button - Uploads all images to WP media library
- **Hero Image Section**:
  - Shows hero image with placement indicator
  - Displays matched keyword
  - Shows push status (green checkmark if pushed)
- **Inline Images Grid**:
  - Thumbnail preview of each inline image
  - Left/Right placement badge
  - Matched keyword
  - Push status

### Tab 3: Meta SEO
- **Meta Title** input with character counter (50-60 optimal)
- **Meta Description** textarea with character counter (150-160 optimal)
- **Google Preview**: Live preview of how it appears in search results
- **Save Meta**: Save changes to the site plan node
- **Push to WordPress**: Push meta to the WordPress page

### Tab 4: Chain Outputs
- View all outputs from the prompt chain
- Each prompt in the chain shows its output
- Useful for debugging or reviewing AI-generated segments

---

## Multi-Location Workflow

For businesses serving multiple cities (e.g., cleaning services in Nashville, Hendersonville, Franklin):

### Understanding H/J/C Tags
- **H** = House (residential audience)
- **J** = Janitorial (commercial audience)
- **C** = Construction (construction cleanup audience)

These tags switch the audience avatar during content generation, NOT the location.

### Location in Page Titles
The city name IS part of the unique identifier:
- "Standard Cleaning Hendersonville" → unique page
- "Standard Cleaning Nashville" → different unique page

### Adding Locations
1. Click **"+ Location"** button
2. Enter city/area name
3. Location pages are created under each service

---

## Import/Export

### Import List (Tab-Indented)
```
Homepage
Services
    Standard Cleaning
    Deep Cleaning
    Move Out Cleaning
Locations
    Nashville
    Hendersonville
```
- Indentation (tab or spaces) creates hierarchy
- First line becomes root, indented lines become children

### Import CSV
Format: `title,parent,slug,type,keyword,meta_title,meta_description,pillar`

### Export JSON
- Click **"Export"** button
- Downloads `site-plan-[name]-[date].json`
- Contains all pages with:
  - Title, slug, page_type
  - Target keyword, meta title, meta description
  - Content brief
  - Hierarchy (parent_id, depth)
  - Pillar and menu settings

---

## Template Library Integration

### Saving Site Plan to Template
1. Go to **More → Templates**
2. Click **"Create from Workflow"**
3. Check **"Site Planning"** in Include Sections
4. Enter template name and save
5. Site plan structure is saved to template

### Loading Site Plan from Template
1. Open Template Library
2. Select a template that includes Site Planning
3. Click **"Apply to Workflow"**
4. Site plan is created/replaced in the current workflow

---

## WordPress Integration

### Push to WordPress
1. Ensure WordPress credentials are configured in the website settings
2. Click **"Push to WP"** button
3. Choose "Push as Drafts" or "Push & Publish"
4. Pages are created in WordPress maintaining hierarchy (parent-child relationships)

### Sync Check
- Click **"Check WP Sync"** to compare:
  - **Matched**: Pages in both site plan and WordPress
  - **Missing in WP**: Pages planned but not created in WordPress
  - **Extra in WP**: Pages in WordPress not in site plan

### Push Images
1. Open any page in PageDetailModal
2. Go to **Images** tab
3. Click **"Push Images to WordPress"**
4. Images upload to WordPress media library
5. Green checkmarks show successful uploads

---

## Troubleshooting

### "Create Site Plan" Button Doesn't Work
- **Cause**: No workflow selected
- **Fix**: Select a workflow from the workflow selector at the top

### Generation Not Starting
- **Cause**: No workflow ID available
- **Fix**: Make sure you're in a workflow context

### Images Not Pushing
- **Cause**: WordPress credentials not configured
- **Fix**: Go to Website settings and configure WP URL, username, and app password

### Template Doesn't Include Site Planning
- **Cause**: "Site Planning" checkbox wasn't checked when saving
- **Fix**: Create a new template with "Site Planning" checked

---

## Best Practices

1. **Plan Before Generate**: Build your complete site structure before generating content
2. **Use Page Types**: Assign correct page types for better organization
3. **Set Keywords**: Add target keywords to each page for SEO optimization
4. **Pillar Pages**: Mark cornerstone content as pillar pages
5. **Export Backups**: Regularly export your site plan as backup
6. **Check Sync**: Periodically run WP sync check to ensure consistency

---

## Keyboard Shortcuts

- **Enter**: Confirm when adding a new page
- **Escape**: Cancel adding a new page

---

## Status Flow

```
planned → in_progress → built → published
                ↓
          needs_update
```

- **planned**: Page defined but no content
- **in_progress**: Content being generated
- **built**: Content complete, not yet in WordPress
- **published**: Live on WordPress
- **needs_update**: Published but marked for revision
