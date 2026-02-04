-- Migration 031: Fix (C) tags in article content
-- Issue: Tags like (C) were appearing in AI-generated content because
-- the prompt-filler.ts was not stripping tags from {item_name} before
-- sending to the AI. This fixes the existing affected article.
--
-- Root Cause: src/engine/prompt-filler.ts line 76 used item.name directly
-- without stripping the tag suffix. When prompts contained {item_name},
-- the full "Phase Cleaning Out(C)" was sent to the AI, which then
-- included (C) in all the generated headings.
--
-- This migration fixes the existing article. A code fix in prompt-filler.ts
-- prevents this from happening to future articles.

-- Fix the Phase Cleaning Out article - remove (C) from all content
UPDATE articles
SET final_content = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(final_content, 'Out(C)', 'Out'),
      'Phase Cleaning Out(C)', 'Phase Cleaning Out'
    ),
    'Phase Cleaning(C)', 'Phase Cleaning'
  ),
  '(C)', ''  -- Catch any remaining instances
)
WHERE keyword LIKE '%Phase Cleaning Out%'
  AND tag = 'C'
  AND final_content LIKE '%(C)%';

-- Also fix meta_titles if they contain (C)
UPDATE articles
SET meta_titles = REPLACE(meta_titles::text, '(C)', '')::jsonb
WHERE keyword LIKE '%Phase Cleaning Out%'
  AND tag = 'C'
  AND meta_titles::text LIKE '%(C)%';

-- Also fix meta_descriptions if they contain (C)
UPDATE articles
SET meta_descriptions = REPLACE(meta_descriptions::text, '(C)', '')::jsonb
WHERE keyword LIKE '%Phase Cleaning Out%'
  AND tag = 'C'
  AND meta_descriptions::text LIKE '%(C)%';
