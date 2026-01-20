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

## Issue 4: fallback_prompt_mode Not Saving (CRITICAL) - FIXED Jan 20, 2026

### What Was Wrong
User could select Main Prompt, Guided GPT, or Smart Prompt for "When bank is empty, generate using:" but ALL selections produced the same behavior. The setting was never saved to the database.

### Root Cause Discovery (Archaeology)
This was a **multi-layer bug** requiring investigation through 4 code layers:

1. **Frontend (ImageCreationSection.tsx)**: Working correctly - sent fallback_prompt_mode in updateSettings()
2. **Server API (image-creation.js)**: Had the column in queries but...
3. **Database**: THE COLUMN DIDN'T EXIST! It was in schema.sql but never migrated
4. **Runtime (elementor.js)**: Was chaining settings with `||` which masked the problem

### The Hidden Bug Pattern
```javascript
// schema.sql had the column defined:
fallback_prompt_mode VARCHAR(20) DEFAULT 'main_prompt'

// BUT the migration was never run! Column didn't exist in production.
// When code tried to save:
UPDATE settings SET fallback_prompt_mode = 'guided_gpt' WHERE id = 1
// PostgreSQL: ERROR column "fallback_prompt_mode" does not exist

// Fallback query ran WITHOUT the column:
UPDATE settings SET integration_mode = 'bank' WHERE id = 1
// SUCCESS but fallback_prompt_mode was lost!

// When reading back:
config.fallback_prompt_mode // undefined

// elementor.js line 1307 then chained:
livePromptMode = config.fallback_prompt_mode || config.live_prompt_mode || 'main_prompt'
// Since fallback_prompt_mode was undefined, it always fell through!
```

### How It Was Fixed
1. **Added migration 022** to `setup-all.mjs` to create `fallback_prompt_mode` column
2. **Added migration 023** to create `live_prompt_mode` column (was also missing)
3. **Fixed the chaining logic** in elementor.js - now treats the two settings separately:
   ```javascript
   if (isFallbackFromBank) {
     livePromptMode = config.fallback_prompt_mode || 'main_prompt';  // SEPARATE!
   } else {
     livePromptMode = config.live_prompt_mode || 'main_prompt';
   }
   ```

### Golden Rules Added
- **Golden Rule #15**: fallback_prompt_mode and live_prompt_mode are SEPARATE - never chain with ||
- **Golden Rule #16**: Database columns MUST exist - schema.sql alone is NOT enough

### Testing Confirmation
Ran 6 test scenarios (Jan 20, 2026):
- Bank mode: Main Prompt ✓, Guided GPT ✓, Smart Prompt ✓
- Live mode: Main Prompt ✓, Guided GPT ✓, Smart Prompt ✓

All 6 correctly used the selected prompt mode as shown in logs.

---

## Commits That Fixed These Issues

| Commit | Description |
|--------|-------------|
| 1ee1e0e | Fix field name mismatch + regenerate image base64 |
| 2a769ff | Add template fields to GET response |
| e8da445 | Add database migration for missing columns |
| ae7c6ec | Add debug logging for templates |
| 5780550 | Add template columns to ALL fallback queries |
| 6c96d15 | Fix fallback_prompt_mode not being respected (logic fix) |
| 59a74a8 | Add fallback_prompt_mode and live_prompt_mode columns to database |

---

## Key Lessons for Future Agents

1. **Field name mismatches are silent** - Server just ignores unknown fields. Check logs for what the server actually receives.

2. **Fallback queries are easy to forget** - When adding new columns, grep for "fallback" to find all query locations.

3. **Base64 images are HUGE** - ~1MB each vs ~100 bytes for a URL. Always upload to WordPress first.

4. **GET endpoints may not return new fields** - Just because a column exists doesn't mean the API returns it.

5. **schema.sql is NOT the truth** - It's documentation only. Actual columns come from setup-all.mjs migrations which run on server start.

6. **Check if columns actually exist** - When code "silently fails", check if the database column physically exists. Use `SELECT column_name FROM information_schema.columns`.

7. **Don't chain settings with ||** - If two settings control different paths (fallback vs direct), they must be kept separate. Chaining with `||` masks bugs.

8. **The Blueprint page has more details** - See Golden Rules #13-16, System Archaeology tab, and the Changelog for Jan 20, 2026.
