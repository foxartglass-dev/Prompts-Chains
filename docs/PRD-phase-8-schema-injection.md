# Phase 8: Schema / JSON-LD Injection

**Project:** Post-Publish Full Page Control System
**Priority:** MEDIUM — Schema markup improves rich snippets and search visibility
**Scope:** Two-track schema generation (bulk + custom pages), LLM-driven schema identification, JSON-LD injection into WordPress page headers.
**Prerequisite:** Pages must be published (need `wp_post_id`). Phase 2 (rebuild service) helpful but not required — schema injection is independent of page content updates.
**Context Budget:** Single session. Schema injection is simpler than Elementor manipulation — no `_elementor_data` involved, just post meta updates via REST API.

---

## What You're Building

A schema generation and injection system that adds structured data (JSON-LD) to every page's `<head>`. Two tracks:

1. **Bulk schema** — An LLM reads each page's content, matches it against a user-configured list of schema types, and generates appropriate JSON-LD. Runs on ALL pages except custom-designated ones.

2. **Custom schema** — User designates specific pages (homepage, city pages, etc.) that get their own custom prompt for comprehensive/special schema. These pages are SKIPPED by the bulk process. **Multiple custom pages supported** — not just one. A multi-location business might need custom schema on every city page.

The schema gets injected into the WordPress `<head>` via a **direct WordPress approach** (custom meta field + mu-plugin), NOT through the SEO plugins. This is intentional — the SEO plugin paths (Yoast, Rank Math, AIOSEO, SEOPress) are tested and working for meta title/description, but have NOT been verified for schema injection. One universal WordPress path is simpler and more reliable than verifying 4 different plugin APIs for schema support.

---

## Two Tracks Explained

### Track 1: Bulk Schema (All Pages Except Custom)

**How it works:**
1. User configures a list of schema types they want the LLM to look for (e.g., LocalBusiness, Service, FAQ, HowTo, BreadcrumbList, Article, Product)
2. User writes a guiding prompt: "Go through each page and identify which of these schemas apply based on the page content"
3. LLM reads each page's content (from database `final_content` or pulled from WordPress)
4. LLM identifies which schema types match each page and generates the JSON-LD
5. Schema gets injected into each page's `<head>` via WordPress custom meta

**Example:**
- Schema types list: `[LocalBusiness, Service, FAQ, HowTo, BreadcrumbList]`
- Page: "Deep Cleaning Kitchen Austin"
  - LLM identifies: Service (deep cleaning is a service), BreadcrumbList (page has hierarchy), FAQ (content has Q&A section)
  - Generates JSON-LD for all three schema types
  - Injects into page head
- Page: "Move Out Cleaning Checklist"
  - LLM identifies: HowTo (checklist format), Article (informational content)
  - Generates JSON-LD for both

**The LLM skips custom-designated pages.** It only processes pages that aren't in the custom list.

### Track 2: Custom Schema (Designated Pages)

**How it works:**
1. User selects a page from a list of all published pages
2. User writes a custom prompt specifically for that page's schema
3. LLM follows that custom prompt to generate comprehensive schema
4. Schema gets injected into that page's `<head>`
5. User can add MORE custom pages with a [+] button — each gets its own prompt

**Why multiple custom pages?** A local business with 5 city locations needs custom LocalBusiness schema on each city page with that city's specific address, phone number, hours, etc. The bulk process can't handle this — each city page needs unique business details.

**Example:**
- **Homepage** (custom): Custom prompt → generates Organization + LocalBusiness + WebSite + SiteNavigationElement schema with full business details
- **Austin Location** (custom): Custom prompt → generates LocalBusiness schema with Austin address, Austin phone, Austin hours
- **Round Rock Location** (custom): Custom prompt → generates LocalBusiness schema with Round Rock address, Round Rock phone, Round Rock hours
- **All other pages** (bulk): LLM auto-identifies applicable schema types

---

## Schema Injection Method: Direct WordPress

### Why NOT Through SEO Plugins

The existing SEO plugin integration (`seo-plugin.js`) is tested and working for meta title + description. Schema injection through plugins is a DIFFERENT API with DIFFERENT requirements:

- **Yoast:** Schema graph API requires PHP filters (`wpseo_schema_graph`), not just REST API meta fields
- **Rank Math:** Has `rank_math_schema_*` meta fields but they use a specific nested format
- **AIOSEO:** Schema is stored differently than title/description
- **SEOPress:** Schema support varies by version

Testing and maintaining 4 different schema injection pathways = 4x the work for the same result.

### The Universal WordPress Approach

**One path that works on every WordPress site, regardless of SEO plugin:**

1. **Store schema as custom post meta via REST API:**
   ```
   PUT /wp-json/wp/v2/pages/{pageId}
   {
     "meta": {
       "_promptflow_schema_jsonld": "[{\"@context\":\"https://schema.org\",...}]"
     }
   }
   ```

2. **Deploy a tiny mu-plugin to WordPress** that reads this meta and outputs it in `<head>`:
   ```php
   <?php
   // File: wp-content/mu-plugins/promptflow-schema.php
   // Must-Use plugin — auto-loaded by WordPress, no activation needed

   add_action('wp_head', function() {
       if (is_singular()) {
           $schema = get_post_meta(get_the_ID(), '_promptflow_schema_jsonld', true);
           if ($schema) {
               $schemas = json_decode($schema, true);
               if (is_array($schemas)) {
                   foreach ($schemas as $s) {
                       echo '<script type="application/ld+json">' . wp_json_encode($s, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '</script>' . "\n";
                   }
               }
           }
       }
   }, 1);
   ```

3. **Register the meta field for REST API access** (in the same mu-plugin):
   ```php
   add_action('init', function() {
       register_post_meta('page', '_promptflow_schema_jsonld', [
           'show_in_rest' => true,
           'single' => true,
           'type' => 'string',
           'auth_callback' => function() { return current_user_can('edit_posts'); }
       ]);
   });
   ```

**Why mu-plugin?**
- `wp-content/mu-plugins/` is auto-loaded by WordPress — no activation step, no accidental deactivation
- Survives theme changes and most updates
- Only needs to be deployed once per WordPress site
- 20 lines of code total

**One-time setup per website:** Deploy the mu-plugin (can be automated via WordPress REST API or SFTP). After that, schema injection is just a REST API call to update the meta field.

### Future Enhancement: SEO Plugin Passthrough

If a specific SEO plugin's schema API turns out to be better for a client (e.g., Rank Math's Schema tab looks prettier in the WP admin), add plugin-specific paths LATER. The mu-plugin approach is the reliable baseline that works everywhere NOW.

---

## What to Build

### 8A. Database: Schema Settings

**New columns on `websites` table:**

```sql
ALTER TABLE websites ADD COLUMN schema_types TEXT;                 -- JSON array of schema types to look for
-- e.g., '["LocalBusiness","Service","FAQ","HowTo","BreadcrumbList","Article"]'
ALTER TABLE websites ADD COLUMN schema_bulk_prompt TEXT;            -- guiding prompt for bulk schema generation
ALTER TABLE websites ADD COLUMN schema_model VARCHAR(100)          -- LLM model for schema generation
  DEFAULT 'claude-sonnet-4-5-20250929';
ALTER TABLE websites ADD COLUMN schema_mu_plugin_deployed BOOLEAN DEFAULT false;  -- tracks mu-plugin deployment
```

**New table:** `schema_custom_pages`

```sql
CREATE TABLE schema_custom_pages (
  id SERIAL PRIMARY KEY,
  website_id INT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  article_id INT REFERENCES articles(id),        -- linked article (if it's one of our pages)
  wp_post_id INT,                                 -- WordPress page ID (for pages we didn't create)
  page_title VARCHAR(255),                        -- display name
  page_url VARCHAR(500),                          -- full URL for reference
  custom_prompt TEXT NOT NULL,                     -- the custom schema prompt for this page
  generated_schema TEXT,                          -- the generated JSON-LD (stored for review before push)
  schema_pushed BOOLEAN DEFAULT false,            -- whether schema has been pushed to WordPress
  pushed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_schema_custom_pages_website ON schema_custom_pages(website_id);
CREATE INDEX idx_schema_custom_pages_article ON schema_custom_pages(article_id);
```

**New columns on `articles` table:**

```sql
ALTER TABLE articles ADD COLUMN generated_schema TEXT;      -- JSON-LD generated by bulk process
ALTER TABLE articles ADD COLUMN schema_pushed BOOLEAN DEFAULT false;
ALTER TABLE articles ADD COLUMN schema_pushed_at TIMESTAMP;
```

**Follow Golden Rule #16:** Add migration file AND update `server/db/setup-all.mjs`.

### 8B. Schema Generation Service

**New file:** `server/services/schema-generator.js`

#### `generateBulkSchema(articleId, schemaTypes, bulkPrompt, model)`

```javascript
/**
 * Generates schema JSON-LD for a single article/page based on its content.
 * LLM reads the content and identifies which schema types apply from the provided list.
 *
 * @param {number} articleId
 * @param {string[]} schemaTypes - List of schema types to look for
 * @param {string} bulkPrompt - User's guiding prompt for what to look for
 * @param {string} model - Which LLM model to use
 * @returns {{ schemas: object[], identifiedTypes: string[] }}
 */
async function generateBulkSchema(articleId, schemaTypes, bulkPrompt, model) {
  // 1. Get article content (final_content from database)
  // 2. Build LLM prompt:
  //    "You are a Schema.org expert. Analyze this page content and identify which of
  //     these schema types apply: [schemaTypes]. For each one that applies, generate
  //     valid JSON-LD. User instructions: [bulkPrompt]"
  // 3. Call LLM via /api/llm/generate with selected model
  // 4. Parse response — expect JSON array of schema objects
  // 5. Validate each schema (must have @context, @type at minimum)
  // 6. Store on articles.generated_schema
  // 7. Return schemas + which types were identified

  return { schemas, identifiedTypes };
}
```

#### `generateCustomSchema(customPageId, customPrompt, model)`

```javascript
/**
 * Generates schema JSON-LD for a custom-designated page using its specific prompt.
 *
 * @param {number} customPageId - ID from schema_custom_pages table
 * @param {string} customPrompt - The custom prompt for this specific page
 * @param {string} model - Which LLM model to use
 * @returns {{ schemas: object[] }}
 */
async function generateCustomSchema(customPageId, customPrompt, model) {
  // 1. Get the page's content:
  //    - If article_id exists, get from articles.final_content
  //    - If only wp_post_id, fetch from WordPress REST API
  // 2. Build LLM prompt:
  //    "You are a Schema.org expert. Generate comprehensive JSON-LD schema for this page.
  //     Follow these specific instructions: [customPrompt]"
  // 3. Call LLM via /api/llm/generate with selected model
  // 4. Parse and validate response
  // 5. Store on schema_custom_pages.generated_schema
  // 6. Return schemas for review

  return { schemas };
}
```

#### `pushSchemaToWordPress(wpPostId, schemas, credentials)`

```javascript
/**
 * Pushes JSON-LD schema to a WordPress page via custom meta field.
 * Uses the mu-plugin approach: stores schema in _promptflow_schema_jsonld meta.
 *
 * @param {number} wpPostId - WordPress page ID
 * @param {object[]} schemas - Array of JSON-LD schema objects
 * @param {object} credentials - { wpUrl, username, appPassword }
 * @returns {{ success: boolean, message: string }}
 */
async function pushSchemaToWordPress(wpPostId, schemas, credentials) {
  // 1. Serialize schemas to JSON string
  // 2. PUT /wp-json/wp/v2/pages/{wpPostId}
  //    { "meta": { "_promptflow_schema_jsonld": JSON.stringify(schemas) } }
  // 3. Use same auth pattern as wordpress-publisher.js (Basic Auth with app password)
  // 4. Return success/failure

  return { success, message };
}
```

#### `checkMuPluginDeployed(credentials)`

```javascript
/**
 * Checks if the PromptFlow schema mu-plugin is deployed on the WordPress site.
 * Tests by checking if the _promptflow_schema_jsonld meta field is registered.
 *
 * @param {object} credentials - { wpUrl, username, appPassword }
 * @returns {{ deployed: boolean, testResult: string }}
 */
async function checkMuPluginDeployed(credentials) {
  // 1. Try to read meta from any published page:
  //    GET /wp-json/wp/v2/pages?per_page=1&_fields=id,meta
  // 2. If meta response includes _promptflow_schema_jsonld field → deployed
  // 3. If field not in meta → not deployed
  // 4. Return status + helpful message

  return { deployed, testResult };
}
```

### 8C. Backend Endpoints

**File:** `server/routes/schema.js` (NEW route file)

#### `GET /api/schema/settings/:websiteId`
Get schema settings for a website (types list, bulk prompt, model, mu-plugin status).

#### `PUT /api/schema/settings/:websiteId`
Update schema settings.
```
Accept: { schemaTypes, bulkPrompt, model }
```

#### `POST /api/schema/check-mu-plugin`
Check if the mu-plugin is deployed on the WordPress site.
```
Accept: { websiteId }
Returns: { deployed: true/false, message: "..." }
```

#### `GET /api/schema/mu-plugin-code`
Returns the mu-plugin PHP code for the user to deploy.
```
Returns: { code: "<?php ...", filename: "promptflow-schema.php", instructions: "..." }
```

#### `POST /api/schema/generate-bulk`
Generate schema for all pages (except custom-designated ones). Uses SSE for progress.
```
Accept: { websiteId, workflowId }
SSE events: { type: 'progress', current: 5, total: 30, pageTitle: '...' }
Returns (final): { generated: 28, skipped: 2 (custom), errors: [] }
```

#### `POST /api/schema/generate-single/:articleId`
Generate schema for a single article (using bulk settings).
```
Returns: { schemas: [...], identifiedTypes: ['Service', 'FAQ'] }
```

#### `POST /api/schema/generate-custom/:customPageId`
Generate schema for a custom-designated page using its custom prompt.
```
Returns: { schemas: [...] }
```

#### `POST /api/schema/push/:articleId`
Push generated schema to WordPress for one article.
```
Returns: { success: true, wpPostId: 123 }
```

#### `POST /api/schema/push-custom/:customPageId`
Push generated schema to WordPress for one custom page.

#### `POST /api/schema/push-bulk`
Push schema for all articles that have generated but unpushed schema. Uses SSE for progress.
```
Accept: { websiteId, workflowId }
Returns: { pushed: 28, failed: 0, errors: [] }
```

#### Custom Pages Management

#### `GET /api/schema/custom-pages/:websiteId`
Get all custom-designated pages for a website.

#### `POST /api/schema/custom-pages`
Add a custom schema page.
```
Accept: { websiteId, articleId?, wpPostId?, pageTitle, pageUrl, customPrompt }
```

#### `PUT /api/schema/custom-pages/:customPageId`
Update a custom page's prompt or details.

#### `DELETE /api/schema/custom-pages/:customPageId`
Remove a page from custom designation (it will be included in bulk next time).

### 8D. Frontend — Schema Manager

**New component:** `src/components/SchemaManager.tsx`

A management interface for schema generation and injection. Accessible from the website/workflow level (same place as Link Pool Manager).

```
┌─────────────────────────────────────────────────────────────────────┐
│ Schema Manager — Austin Cleaning Co.                                 │
│                                                                      │
│ ── MU-PLUGIN STATUS ──                                               │
│                                                                      │
│ ✅ PromptFlow Schema Plugin: Deployed                                │
│    (or)                                                              │
│ ⚠️ PromptFlow Schema Plugin: Not Detected     [Check Again]          │
│    Deploy the mu-plugin to enable schema injection.                  │
│    [View Plugin Code & Instructions]                                 │
│                                                                      │
│ ── BULK SCHEMA SETTINGS ──                                           │
│                                                                      │
│ Schema Types to Look For:                                            │
│ ┌───────────────────────────────────────────────────────────────┐    │
│ │ ☑ LocalBusiness  ☑ Service  ☑ FAQ  ☑ HowTo                  │    │
│ │ ☑ BreadcrumbList  ☑ Article  ☐ Product  ☐ Event             │    │
│ │ ☐ Recipe  ☐ Review  ☐ VideoObject  ☐ Organization           │    │
│ └───────────────────────────────────────────────────────────────┘    │
│                                                                      │
│ Bulk Schema Prompt (guides the LLM for all non-custom pages):       │
│ ┌───────────────────────────────────────────────────────────────┐    │
│ │ Analyze each page's content and identify which schema types   │    │
│ │ apply. For LocalBusiness, use: "Austin Clean Co",             │    │
│ │ (512) 555-1234, Austin TX. For Service schemas, include       │    │
│ │ pricing if mentioned. Always include BreadcrumbList.          │    │
│ └───────────────────────────────────────────────────────────────┘    │
│                                                                      │
│ LLM Model: [Claude Sonnet 4.5 ▾]                                    │
│                                                                      │
│ [Generate Schema for All Pages]  — Processes all non-custom pages    │
│                                                                      │
│ ── CUSTOM SCHEMA PAGES ──                                            │
│                                                                      │
│ These pages get their own custom prompt. The bulk process skips them. │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │ 🏠 Homepage — austinclean.com/                                  │  │
│ │   Custom prompt:                                                │  │
│ │   ┌─────────────────────────────────────────────────────────┐   │  │
│ │   │ Generate comprehensive Organization + LocalBusiness +    │   │  │
│ │   │ WebSite schema. Include: business name "Austin Clean     │   │  │
│ │   │ Co", address 123 Main St Austin TX, phone (512)          │   │  │
│ │   │ 555-1234, hours Mon-Sat 8am-6pm, all service areas...   │   │  │
│ │   └─────────────────────────────────────────────────────────┘   │  │
│ │   Schema: ✅ Generated (3 schemas)        [Regenerate] [Push]  │  │
│ │   [Preview JSON-LD ▾]                                           │  │
│ └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │ 📍 Austin Location — austinclean.com/austin/                    │  │
│ │   Custom prompt:                                                │  │
│ │   ┌─────────────────────────────────────────────────────────┐   │  │
│ │   │ Generate LocalBusiness schema for Austin location.       │   │  │
│ │   │ Address: 123 Main St, Austin TX 78701. Phone: (512)      │   │  │
│ │   │ 555-1234. Hours: Mon-Sat 8am-6pm. Include Service        │   │  │
│ │   │ area: Austin, Pflugerville, Round Rock...                 │   │  │
│ │   └─────────────────────────────────────────────────────────┘   │  │
│ │   Schema: ✅ Generated (2 schemas)        [Regenerate] [Push]  │  │
│ │   [Preview JSON-LD ▾]                                           │  │
│ └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │ 📍 Round Rock Location — austinclean.com/round-rock/            │  │
│ │   Custom prompt:                                                │  │
│ │   ┌─────────────────────────────────────────────────────────┐   │  │
│ │   │ Generate LocalBusiness schema for Round Rock location.   │   │  │
│ │   │ Address: 456 Oak Ave, Round Rock TX 78664. Phone: (512)  │   │  │
│ │   │ 555-5678. Hours: Mon-Fri 9am-5pm...                      │   │  │
│ │   └─────────────────────────────────────────────────────────┘   │  │
│ │   Schema: ⏳ Not generated yet             [Generate] [—]      │  │
│ └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ [+ Add Custom Schema Page]                                           │
│                                                                      │
│ ── BULK SCHEMA STATUS ──                                             │
│                                                                      │
│ Pages with schema: 24 / 30                                           │
│ Pages pending generation: 6                                          │
│ Custom pages: 3 (skipped by bulk)                                    │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │ Page                          │ Types Found      │ Status       │  │
│ │ Deep Cleaning Kitchen Austin  │ Service, FAQ     │ ✅ Pushed    │  │
│ │ Move Out Cleaning Checklist   │ HowTo, Article   │ ✅ Pushed    │  │
│ │ Maid Service Austin           │ Service          │ ⏳ Generated │  │
│ │ Spring Cleaning Tips          │ Article, HowTo   │ ⏳ Generated │  │
│ │ ...                           │                  │              │  │
│ └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ [Push All Generated Schema to WordPress]                             │
│                                                                      │
│ ⓘ Schema is pushed via the PromptFlow mu-plugin. Make sure the      │
│   plugin is deployed before pushing. Works with any SEO plugin.      │
└─────────────────────────────────────────────────────────────────────┘
```

#### [+ Add Custom Schema Page] Flow

When the user clicks the plus button:

```
┌─────────────────────────────────────────────────────────────────┐
│ Add Custom Schema Page                                           │
│                                                                  │
│ Select page:                                                     │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ [Search pages...                                         ]  │  │
│ │                                                             │  │
│ │ ○ Homepage — /                                              │  │
│ │ ○ About Us — /about/                                        │  │
│ │ ● Round Rock Location — /round-rock/         ← selected     │  │
│ │ ○ Deep Cleaning Services — /deep-cleaning/                  │  │
│ │ ○ Maid Service Austin — /maid-service-austin/               │  │
│ │ ... (all published pages)                                   │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ Custom prompt for this page:                                     │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │                                                             │  │
│ │                                                             │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ [Add Page]  [Cancel]                                             │
│                                                                  │
│ ⓘ This page will be skipped by the bulk schema process and      │
│   will use its own custom prompt instead.                        │
└─────────────────────────────────────────────────────────────────┘
```

The page list shows ALL published pages (from articles with `wp_post_id` + any WordPress pages discovered via Phase 6's page pulling). Pages already designated as custom are shown with a ✓ and can't be selected again.

#### JSON-LD Preview

When the user clicks [Preview JSON-LD ▾] on any page:

```
┌─────────────────────────────────────────────────────────────────┐
│ JSON-LD Preview — Homepage                                       │
│                                                                  │
│ Schema 1 of 3: Organization                                      │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ {                                                           │  │
│ │   "@context": "https://schema.org",                         │  │
│ │   "@type": "Organization",                                  │  │
│ │   "name": "Austin Clean Co",                                │  │
│ │   "url": "https://austinclean.com",                         │  │
│ │   "logo": "https://austinclean.com/logo.png",               │  │
│ │   "contactPoint": { ... }                                   │  │
│ │ }                                                           │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ Schema 2 of 3: LocalBusiness                                     │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ {                                                           │  │
│ │   "@context": "https://schema.org",                         │  │
│ │   "@type": "LocalBusiness",                                 │  │
│ │   ...                                                       │  │
│ │ }                                                           │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ [Validate with Google] ↗  — opens Google Rich Results Test       │
│ [Edit JSON] — manual edit before pushing                         │
│ [Copy to Clipboard]                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## How the Complete Flow Works

### First-Time Setup (Once Per Website)

```
1. Deploy mu-plugin to WordPress (copy 20 lines of PHP to wp-content/mu-plugins/)
2. Click [Check Plugin Status] → ✅ Deployed
3. Configure schema types list (checkboxes)
4. Write bulk prompt with business details
5. Designate custom pages (homepage + city pages if multi-location)
6. Write custom prompts for each custom page
```

### Generate & Push (Repeatable)

```
1. Click [Generate Schema for All Pages]
   → LLM reads each page's content
   → Identifies schema types per page
   → Generates JSON-LD
   → Shows progress via SSE
   → Skips custom-designated pages

2. Generate custom pages individually:
   → Click [Generate] on each custom page
   → LLM follows custom prompt
   → Schema appears in preview

3. Review generated schemas:
   → Preview JSON-LD for any page
   → Edit manually if needed
   → Validate with Google Rich Results Test

4. Click [Push All Generated Schema to WordPress]
   → Updates _promptflow_schema_jsonld meta on each page
   → mu-plugin renders it in <head>
   → Shows progress via SSE
```

### Adding More Pages Later

```
1. Supporting content pages added → they don't have schema yet
2. Click [Generate Schema for All Pages] → only processes pages without schema
   (or re-generate all if you want to refresh)
3. New custom pages needed? Click [+] → add page → write prompt → generate → push
```

---

## Background: What Already Exists

### WordPress REST API Meta Updates (Working)
- `wordpress-publisher.js` already makes authenticated REST API calls
- `createElementorPage()` already passes `meta` in the request body
- Same auth pattern (Basic Auth with app passwords) works for updating meta

### SEO Plugin Integration (Working, but for title/description only)
- `seo-plugin.js` handles 4 plugins: Yoast, Rank Math, AIOSEO, SEOPress
- `seo_plugin` setting on `websites` table
- **Schema uses a DIFFERENT path** — direct WordPress meta, not plugin APIs

### LLM Generation (Working)
- `llm-router.js` routes to Anthropic, OpenAI, or Gemini
- `/api/llm/generate` endpoint accepts provider, model, prompt
- Model dropdown pattern in `ImageCreationSection.tsx`
- Same model selector pattern used in Phase 7 link discovery

### SSE Progress (Phase 2)
- `setupSSE()` utility for bulk operations with progress streaming
- Same pattern for bulk schema generation + bulk push

---

## Files to Read (Before Writing Code)

| File | What to Look For |
|---|---|
| `server/services/wordpress-publisher.js` | How meta is passed in REST API calls, auth pattern |
| `server/services/seo-plugin.js` | Existing SEO plugin integration (for reference, NOT for schema) |
| `server/routes/seo.js` | How meta push endpoints work (pattern to follow) |
| `server/llm-router.js` | How LLM generation works, provider routing |
| `server/db/schema.sql` | Current websites and articles table structure |
| `src/components/ImageCreationSection.tsx` | Model dropdown UI pattern |

## Files to Create

| File | Purpose |
|---|---|
| `server/services/schema-generator.js` | `generateBulkSchema()`, `generateCustomSchema()`, `pushSchemaToWordPress()`, `checkMuPluginDeployed()` |
| `server/routes/schema.js` | All schema CRUD + generation + push endpoints |
| `src/components/SchemaManager.tsx` | Schema management UI |

## Files to Modify

| File | Change |
|---|---|
| `server/db/schema.sql` | Add `schema_custom_pages` table + schema columns on websites/articles |
| `server/db/setup-all.mjs` | Add migration |
| `server/index.js` (or server entry) | Register new `/api/schema` route |

---

## The Mu-Plugin (Complete Code)

This is the full mu-plugin that needs to be deployed to each WordPress site. It's small enough to include here — the agent building this phase should also create a "deployment instructions" panel in the UI.

```php
<?php
/**
 * Plugin Name: PromptFlow Schema Injection
 * Description: Renders JSON-LD schema from PromptFlow via custom post meta.
 * Version: 1.0
 * Author: PromptFlow
 */

// Register the meta field for REST API access
add_action('init', function() {
    register_post_meta('page', '_promptflow_schema_jsonld', [
        'show_in_rest' => true,
        'single'       => true,
        'type'         => 'string',
        'auth_callback' => function() {
            return current_user_can('edit_posts');
        }
    ]);
});

// Output schema in <head>
add_action('wp_head', function() {
    if (is_singular()) {
        $schema = get_post_meta(get_the_ID(), '_promptflow_schema_jsonld', true);
        if ($schema) {
            $schemas = json_decode($schema, true);
            if (is_array($schemas)) {
                foreach ($schemas as $s) {
                    echo '<script type="application/ld+json">' .
                         wp_json_encode($s, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) .
                         "</script>\n";
                }
            }
        }
    }
}, 1);
```

**Deployment instructions (show in UI):**
1. Copy the code above
2. Save as `promptflow-schema.php`
3. Upload to `wp-content/mu-plugins/` on the WordPress server
4. If the `mu-plugins` directory doesn't exist, create it
5. No activation needed — mu-plugins are loaded automatically
6. Click [Check Plugin Status] in PromptFlow to verify

---

## Golden Rules (Must Follow)

1. **#7 React Portals for Modals:** Custom page add dialog uses portals.
2. **#9 Never Silently Swallow Errors:** If LLM returns invalid JSON-LD, show the error clearly. If mu-plugin not deployed, block push with clear message.
3. **#16 DB Migrations:** New `schema_custom_pages` table + ALTER statements need migration AND be in `setup-all.mjs`.

## What NOT to Do

- Do NOT push schema through SEO plugins (Yoast/Rank Math/AIOSEO/SEOPress) — use the direct WordPress mu-plugin approach. Plugin paths haven't been verified for schema.
- Do NOT generate schema before the page has content — schema is based on page content, so content must exist first.
- Do NOT auto-push schema without review — always generate first, let user preview, THEN push.
- Do NOT include duplicate schema types on the same page — if the page already has Organization schema, don't add another one.
- Do NOT put business-specific details (address, phone) in the bulk prompt unless they apply to ALL pages. Use custom pages for location-specific details.
- Do NOT skip the mu-plugin check — if it's not deployed, schema will be stored in meta but never rendered. Warn the user clearly.

---

## Validation

### Setup

1. **Mu-plugin deployment check:** Plugin not deployed → shows warning + instructions. Plugin deployed → shows green checkmark.
2. **Schema types list:** Check/uncheck types → saved to website settings → persists.
3. **Bulk prompt:** Write prompt → save → close → reopen → prompt still there.
4. **Model selector:** Shows all available models grouped by provider.

### Custom Pages

5. **Add custom page:** Click [+] → select page from list → write prompt → save → appears in custom list.
6. **Multiple custom pages:** Add 3 custom pages → all show with their own prompts.
7. **Remove custom page:** Delete from custom list → page included in next bulk run.
8. **Generate custom schema:** Click [Generate] → LLM uses custom prompt → schema preview appears.
9. **Edit custom prompt:** Change prompt → regenerate → different schema output.

### Bulk Generation

10. **Generate bulk schema:** Click [Generate All] → progress bar → schema generated for all non-custom pages.
11. **Custom pages skipped:** 3 custom pages exist → bulk generates for 27 pages, skips 3.
12. **Schema types identified:** LLM correctly identifies Service for service pages, FAQ for FAQ pages, etc.
13. **Invalid JSON-LD:** LLM returns malformed JSON → error shown, not saved.

### Push

14. **Push single page:** Click [Push] → schema appears in WordPress meta → mu-plugin renders in `<head>`.
15. **Push all:** Click [Push All] → progress bar → all generated schemas pushed.
16. **Mu-plugin not deployed:** Try to push → blocked with "Deploy mu-plugin first" message.
17. **Verify in browser:** View page source → JSON-LD `<script>` tags present in `<head>`.

### Preview & Edit

18. **Preview JSON-LD:** Click [Preview] → formatted JSON shown with syntax highlighting.
19. **Edit JSON:** Manual edit → save → edited version is what gets pushed.
20. **Google validation link:** Click [Validate with Google] → opens Rich Results Test with page URL.

### Edge Cases

21. Page has no content yet → skip with warning "No content to analyze."
22. LLM identifies no applicable schema types → show "No matching schema types found. Consider adding more types or adjusting the prompt."
23. Page already has schema from a previous run → option to overwrite or skip.
24. Custom page deleted from WordPress → show warning, allow removal from custom list.
25. Very long page content → truncate to fit LLM context window, note which sections were analyzed.
