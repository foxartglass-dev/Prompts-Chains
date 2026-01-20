# Agent Handoff: Persistence & Image Upload Fixes

## STATUS: ALL ISSUES FIXED (Jan 20, 2026)

All three issues documented here have been resolved. This file is kept for historical reference and to help future agents understand the patterns that caused these bugs.

---

## Issue 1: Prompt Templates / Placeholder Categories Not Persisting (CRITICAL) - FIXED

### What Was Wrong
The frontend sent `placeholder_category_templates` but server expected `category_templates`. Additionally, the fallback INSERT/UPDATE queries in image-creation.js were missing template columns entirely.

### How It Was Fixed
1. Changed 9 occurrences of `placeholder_category_templates` to `category_templates` in `src/components/ImageCreationSection.tsx`
2. Added template fields to GET response in image-creation.js
3. Added template columns to ALL 4 fallback INSERT/UPDATE queries in image-creation.js

### The Hidden Bug Pattern
The MAIN issue was that fallback queries were missing columns:
```javascript
// Main query had the columns:
INSERT INTO settings (..., prompt_templates, text_snippets) VALUES (...)

// BUT fallback query didn't:
try { mainQuery() } catch {
  INSERT INTO settings (...) // prompt_templates, text_snippets MISSING!
}
```

### Golden Rule Added
**Golden Rule #14**: When adding columns, MUST update 4 query locations:
1. Main INSERT
2. Fallback INSERT
3. Main UPDATE
4. Fallback UPDATE

---

## Issue 2: Regenerate Article Image Stores Base64 (MEDIUM) - FIXED

### What Was Wrong
`/api/articles/:id/regenerate-image` endpoint stored raw base64 (~1MB per image) instead of uploading to WordPress first.

### How It Was Fixed
Added uploadMedia import and call in `server/routes/articles.js` to upload base64 to staging WordPress before storing.

### Key Code Change (articles.js ~line 740)
```javascript
if (response.data[0].b64_json) {
  const base64Data = response.data[0].b64_json;

  // Upload to staging WordPress FIRST
  const wpResult = await uploadMedia(stagingCredentials, base64Data, filename);

  if (wpResult && wpResult.url) {
    imageUrl = wpResult.url;      // ~100 bytes
    wpMediaId = wpResult.id;
  }
}
```

---

## Issue 3: Template Library May Still Have Issues (LOW) - WAS ALREADY FIXED

The 507 error issue was already fixed by excluding `template_data` from list queries in templates.js.

---

## Commits That Fixed These Issues

| Commit | Description |
|--------|-------------|
| 1ee1e0e | Fix field name mismatch + regenerate image base64 |
| 2a769ff | Add template fields to GET response |
| e8da445 | Add database migration for missing columns |
| ae7c6ec | Add debug logging for templates |
| 5780550 | Add template columns to ALL fallback queries |

---

## Key Lessons for Future Agents

1. **Field name mismatches are silent** - Server just ignores unknown fields. Check logs for what the server actually receives.

2. **Fallback queries are easy to forget** - When adding new columns, grep for "fallback" to find all query locations.

3. **Base64 images are HUGE** - ~1MB each vs ~100 bytes for a URL. Always upload to WordPress first.

4. **GET endpoints may not return new fields** - Just because a column exists doesn't mean the API returns it.

5. **The Blueprint page has more details** - See Golden Rules #13 and #14, and the Changelog for Jan 20, 2026.
