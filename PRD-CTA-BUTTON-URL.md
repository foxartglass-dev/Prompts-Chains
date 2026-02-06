# PRD: CTA Button URL Configuration

## Priority: HIGH
## Estimated Complexity: Small (1-2 hours)
## Date: 2026-02-06

---

## Problem

The "Book Now!" CTA button on published WordPress pages currently has NO functional URL — it points to `#`. The database columns and builder logic already exist, but:
1. **No UI** exists to configure the CTA text/URL
2. **Frontend doesn't pass** the website's CTA settings during publish
3. **No way to update** the CTA URL on already-published pages

## Goal

Wire up the existing CTA infrastructure so users can:
1. Set a CTA URL and text per website
2. Have it automatically injected into every new page published
3. Update the URL on existing published pages (bulk operation)

---

## Architecture (Already Exists)

### Database (ALREADY DONE - don't create these)
```sql
-- websites table (already has these columns)
elementor_cta_text VARCHAR(255) DEFAULT 'Book Now!'
elementor_cta_url VARCHAR(500) DEFAULT '#'
```
- Migration: `server/db/migrations/014_add_website_settings_columns.sql` (lines 10-11)
- Schema: `server/db/setup-all.mjs` (lines 76-77)

### API (ALREADY DONE - don't create these)
- `PUT /api/websites/:id` — accepts `elementor_cta_text` / `elementorCtaText` and `elementor_cta_url` / `elementorCtaUrl`
- File: `server/routes/websites.js` (lines 137-184)

### Builder (ALREADY DONE - don't create these)
- `buildButtonWidget(text, url, options)` — `server/services/elementor-builder.js` (lines 347-400)
- `buildHeroSection()` — uses `ctaText`/`ctaUrl` from options (lines 693-793)
- `buildContentSection()` — uses `ctaText`/`ctaUrl` from options (lines 801-839)
- `buildElementorPage()` — accepts `ctaText`/`ctaUrl` in options (lines 915-1040)

### Publish Endpoint (ALREADY DONE)
- `POST /api/elementor/publish` — accepts `ctaText`/`ctaUrl` in request body (line 460+ in `server/routes/elementor.js`)

---

## What Needs to Be Built

### Task 1: Add CTA Fields to Website Settings UI

**File:** `src/components/AgencyManager.tsx` (~line 1059-1120, website form section)

Add two form fields to the website creation/editing form:

```
CTA Button Text: [__Book Now!__________]
CTA Button URL:  [__https://example.com/book__]
```

**Implementation:**
1. Add `elementorCtaText` and `elementorCtaUrl` to the website form state
2. Add two input fields in the Elementor settings area (near where WordPress credentials are)
3. Include these fields in the create/update API calls
4. Load existing values when editing a website

**Specifics:**
- Text field: placeholder "Book Now!", label "CTA Button Text"
- URL field: placeholder "https://...", label "CTA Button URL"
- Both optional — defaults stay as-is if not set
- Group under a collapsible "CTA Button Settings" section or place alongside existing Elementor settings

### Task 2: Pass CTA Settings During Publish

**File:** `src/components/articles/ArticleListView.tsx`

When publishing an article (Push All to WP or individual push), the frontend must:
1. Fetch the website's CTA settings (already available if website data is loaded)
2. Include `ctaText` and `ctaUrl` in the POST body to `/api/elementor/publish`

**Find the publish call** — look for `fetch('/api/elementor/publish'` or the equivalent. The body currently likely has `ctaText: 'Book Now!'` hardcoded or doesn't pass it at all.

**Fix:** Pass `ctaText: website.elementor_cta_text` and `ctaUrl: website.elementor_cta_url` from the loaded website settings.

Also check `App.tsx` batch processing loop (~line 1290+) — the batch publish also calls the elementor publish endpoint and needs to pass CTA settings.

### Task 3: Bulk Update CTA on Existing Pages

**New endpoint:** `POST /api/elementor/bulk-update-cta`

**File:** `server/routes/elementor.js` (add new route)

```javascript
router.post('/bulk-update-cta', async (req, res) => {
  const { websiteId, workflowId, ctaText, ctaUrl } = req.body;

  // 1. Get all articles for this website/workflow that have wp_post_id
  // 2. For each article:
  //    a. Get article content + images + components
  //    b. Rebuild Elementor page with new CTA text/URL
  //    c. Delete old WP page, create new one with same slug
  //    d. Update article's wp_post_id
  // 3. Return results summary
});
```

**IMPORTANT:** This follows the same delete-and-recreate pattern as `push-images` in `server/routes/articles.js` (line 570-698). The WordPress/Elementor REST API can't reliably update `_elementor_data` in-place, so we delete the old page, create a new one with the same slug to preserve URLs.

**Frontend trigger:** Add a button in the website settings or article list:
```
[Update CTA on All Published Pages] (with confirmation dialog)
```

---

## Golden Rules to Follow

- **Golden Rule 7:** Use React Portal for any confirmation modal
- **Golden Rule 9:** Never silently swallow API errors — show toast on failure
- **Golden Rule 13:** No base64 in database (not applicable here but keep in mind)
- **Settings hierarchy:** Website-level settings (this is website-level, correct)

## What NOT to Do

- Do NOT create new database columns — they already exist
- Do NOT create new API endpoints for getting/setting website CTA — PUT /api/websites/:id already handles it
- Do NOT modify `buildButtonWidget()` or `buildElementorPage()` — they already accept ctaText/ctaUrl
- Do NOT change the image pipeline order
- Do NOT add CTA settings at workflow level — keep at website level (a website's CTA button goes to the same booking page regardless of workflow)

## Testing

1. Set CTA URL on a website via the new UI fields
2. Publish a new article — verify button links to the URL on WordPress
3. Change the CTA URL
4. Publish another article — verify new URL
5. Run bulk update — verify ALL previously published pages now have the new URL
6. Verify page slugs/URLs are preserved after bulk update

## Files to Modify

| File | Change |
|------|--------|
| `src/components/AgencyManager.tsx` | Add CTA text + URL form fields |
| `src/components/articles/ArticleListView.tsx` | Pass website CTA settings in publish call |
| `App.tsx` | Pass CTA settings in batch publish loop |
| `server/routes/elementor.js` | Add `/bulk-update-cta` endpoint |
| `src/components/articles/ArticleListView.tsx` | Add "Update CTA" button with confirmation |
