# Agent Handoff: Persistence & Image Upload Fixes

## Summary
Three issues need to be fixed to ensure data persists correctly and images don't bloat the database with base64 data.

---

## Issue 1: Prompt Templates / Placeholder Categories Not Persisting (CRITICAL)

### Problem
The frontend sends fields to the server that don't match what the server expects:
- Frontend sends: `placeholder_category_templates`
- Server expects: `category_templates`

This causes the data to be silently ignored and not saved.

### Evidence from Logs
```
[21:54:46.336] REQUEST BODY KEYS: [
  ...
  "prompt_templates",
  "text_snippets",
  "placeholder_category_templates",  // <-- WRONG NAME
  ...
]
```

### Files to Fix

**Option A: Fix the Frontend** (Recommended)
- File: `src/components/ImageCreationSection.tsx`
- Search for: `placeholder_category_templates`
- Change to: `category_templates`

**Option B: Fix the Server**
- File: `server/routes/image-creation.js`
- Around line 1420, in the req.body destructuring, add:
```javascript
placeholder_category_templates, // Frontend sends this name
```
- Then map it: `const category_templates = placeholder_category_templates;`

### Database Columns Required
Run this SQL if columns don't exist:
```sql
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS prompt_templates JSONB DEFAULT '[]'::jsonb;
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS text_snippets JSONB DEFAULT '[]'::jsonb;
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS category_templates JSONB DEFAULT '[]'::jsonb;
```

### Verification
1. Add a prompt template in the UI
2. Check server logs for `prompt_templates` in the PUT request
3. Refresh the page - templates should still be there
4. Run SQL: `SELECT prompt_templates, text_snippets, category_templates FROM image_creation_settings WHERE website_id = 3;`

---

## Issue 2: Regenerate Article Image Stores Base64 (MEDIUM)

### Problem
When regenerating an article image, the endpoint returns base64 and stores it directly without uploading to WordPress first.

### Evidence from Logs
```
[21:57:33.420] [Regenerate Image] Generating with gpt-image-1.5: A professional cleaner...
[21:57:33.773] [Image Generation] Got base64 image, converted to data URL
...
│   ID: img-1768707708997-section-1
│   URL Type: BASE64  // <-- PROBLEM: Should be HTTP (WordPress URL)
│   URL Preview: data:image/png;base64,iVBORw0KGgo...
```

### File to Fix
`server/routes/articles.js` - lines 691-769

### Current Broken Code (around line 740)
```javascript
// Handle response format
let imageUrl;
if (response.data[0].b64_json) {
  imageUrl = `data:image/png;base64,${response.data[0].b64_json}`;  // STORES BASE64!
} else if (response.data[0].url) {
  imageUrl = response.data[0].url;
}
```

### Fix Required
After generating the image, upload to WordPress before saving:

```javascript
const { uploadMedia } = await import('../services/wordpress-publisher.js');

// Handle response format
let imageUrl;
let wpMediaId = null;

if (response.data[0].b64_json) {
  const base64Data = response.data[0].b64_json;

  // Get staging WordPress credentials
  const stagingResult = await sql`
    SELECT staging_wp_url, staging_wp_user, staging_wp_password
    FROM global_settings WHERE id = 1
  `;

  if (stagingResult.length > 0 && stagingResult[0].staging_wp_url) {
    const { staging_wp_url, staging_wp_user, staging_wp_password } = stagingResult[0];
    const filename = `regenerated-${imageId}-${Date.now()}.png`;

    const wpResult = await uploadMedia(
      { url: staging_wp_url, user: staging_wp_user, password: staging_wp_password },
      base64Data,
      filename,
      { alt: prompt.substring(0, 100) }
    );

    if (wpResult && wpResult.url) {
      imageUrl = wpResult.url;
      wpMediaId = wpResult.id;
      console.log(`[Regenerate Image] ✓ Uploaded to WP: ${wpResult.url}`);
    } else {
      // Fallback to base64 if upload fails
      imageUrl = `data:image/png;base64,${base64Data}`;
      console.log(`[Regenerate Image] ⚠️ WP upload failed, using base64`);
    }
  } else {
    imageUrl = `data:image/png;base64,${base64Data}`;
    console.log(`[Regenerate Image] ⚠️ No staging credentials, using base64`);
  }
} else if (response.data[0].url) {
  imageUrl = response.data[0].url;
}
```

Also update the saved object to include wpMediaId:
```javascript
currentImages[imageIndex] = {
  ...oldImage,
  url: imageUrl,
  wpMediaId: wpMediaId,  // ADD THIS
  createdAt: new Date().toISOString(),
  pushedToWp: !!wpMediaId,  // True if we got a WP media ID
};
```

---

## Issue 3: Template Library May Still Have Issues (LOW)

### Problem
The Template Library was returning 507 errors because `template_data` column contains huge base64 blobs from old templates.

### Already Fixed
The GET /api/templates endpoint was modified to exclude `template_data` from list queries (only fetched when loading a single template by ID).

### If Still Broken
Check `server/routes/templates.js` - the SELECT queries should NOT include `template_data`:
```javascript
// CORRECT - excludes template_data
SELECT id, name, description, template_type, includes, tags, scope, website_id, created_at, updated_at FROM templates

// WRONG - includes everything (causes 507)
SELECT * FROM templates
```

### Database Cleanup (Optional)
To find bloated templates:
```sql
SELECT id, name, pg_size_pretty(length(template_data::text)::bigint) as size
FROM templates
ORDER BY length(template_data::text) DESC
LIMIT 10;
```

To delete a bloated template:
```sql
DELETE FROM templates WHERE id = <id>;
```

---

## Quick Reference: All Database Columns Needed

```sql
-- For prompt templates (Issue 1)
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS prompt_templates JSONB DEFAULT '[]'::jsonb;
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS text_snippets JSONB DEFAULT '[]'::jsonb;
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS category_templates JSONB DEFAULT '[]'::jsonb;

-- For chat files (separate feature, already added)
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS consultant_chat_files JSONB DEFAULT '[]'::jsonb;
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS consultant_chat_conversations JSONB DEFAULT '[]'::jsonb;
```

---

## Testing Checklist

### Issue 1 (Prompt Templates)
- [ ] Create a prompt template in AI Prompt Assistant
- [ ] Create a text snippet
- [ ] Create a placeholder category template
- [ ] Refresh the page
- [ ] All three should still be there

### Issue 2 (Regenerate Image)
- [ ] Go to an article with images
- [ ] Click regenerate on one image
- [ ] Check server logs - should see "Uploaded to WP"
- [ ] Check database - URL should start with `https://`, not `data:image`

### Issue 3 (Template Library)
- [ ] Open Template Library modal
- [ ] Should load without 507 error
- [ ] Should show "No templates found" or list of templates

---

## Key Files Summary

| Issue | File | Line Numbers |
|-------|------|--------------|
| 1. Field name mismatch | `src/components/ImageCreationSection.tsx` | Search `placeholder_category_templates` |
| 1. Server handling | `server/routes/image-creation.js` | ~1420 (req.body destructuring) |
| 2. Regenerate image | `server/routes/articles.js` | 691-769 |
| 3. Template list | `server/routes/templates.js` | 26-93 (already fixed) |

---

## Context
- The app is a full-stack React/TypeScript frontend + Express/Node.js backend
- Database is PostgreSQL via Neon
- Images should ALWAYS be uploaded to WordPress staging site first, then only the URL stored
- Base64 images are ~1MB each, WordPress URLs are ~100 bytes
- Storing base64 caused 67MB+ responses and 507 errors
