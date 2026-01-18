/**
 * Find Saved Prompts in Database
 *
 * Searches articles for any saved prompts in:
 * - image_decision_report (newer - probably empty on old articles)
 * - generated_images (has 'prompt' field per image)
 *
 * Run with: node scripts/find-saved-prompts.mjs
 *
 * Requires DATABASE_URL environment variable to be set.
 */

import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  console.log('Set it with: export DATABASE_URL="your-neon-connection-string"');
  process.exit(1);
}

const sql = neon(connectionString);

async function findPrompts() {
  console.log('='.repeat(70));
  console.log('SEARCHING FOR SAVED PROMPTS IN DATABASE');
  console.log('='.repeat(70));

  try {
    // 1. Check articles with image_decision_report
    console.log('\n1. Checking image_decision_report column...');
    const articlesWithReport = await sql`
      SELECT id, keyword, created_at, image_decision_report
      FROM articles
      WHERE image_decision_report IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 50
    `;

    console.log(`   Found ${articlesWithReport.length} articles with image_decision_report`);

    for (const article of articlesWithReport) {
      console.log(`\n   Article #${article.id}: "${article.keyword}" (${article.created_at})`);
      const report = article.image_decision_report;
      if (report?.images) {
        for (const img of report.images) {
          if (img.prompt) {
            console.log('   ─────────────────────────────────────────');
            console.log(`   Position: ${img.position || 'unknown'}`);
            console.log(`   Type: ${img.type || 'unknown'}`);
            console.log(`   PROMPT:\n   ${img.prompt.substring(0, 500)}...`);
          }
        }
      }
    }

    // 2. Check generated_images for prompts
    console.log('\n' + '='.repeat(70));
    console.log('2. Checking generated_images column for prompts...');

    const articlesWithImages = await sql`
      SELECT id, keyword, created_at, generated_images
      FROM articles
      WHERE generated_images IS NOT NULL
        AND jsonb_array_length(generated_images) > 0
      ORDER BY created_at DESC
      LIMIT 100
    `;

    console.log(`   Found ${articlesWithImages.length} articles with generated_images`);

    let promptCount = 0;
    const uniquePrompts = new Set();

    for (const article of articlesWithImages) {
      const images = article.generated_images || [];
      for (const img of images) {
        if (img.prompt && img.prompt.length > 50) {
          promptCount++;
          const promptKey = img.prompt.substring(0, 100);
          if (!uniquePrompts.has(promptKey)) {
            uniquePrompts.add(promptKey);
            console.log(`\n   ─────────────────────────────────────────`);
            console.log(`   Article #${article.id}: "${article.keyword}"`);
            console.log(`   Created: ${article.created_at}`);
            console.log(`   PROMPT (${img.prompt.length} chars):`);
            console.log(`   ${img.prompt}`);
            console.log(`   ─────────────────────────────────────────`);
          }
        }
      }
    }

    console.log(`\n   Total prompts found in generated_images: ${promptCount}`);
    console.log(`   Unique prompts: ${uniquePrompts.size}`);

    // 3. Check image_creation_settings for mainPrompt in avatars
    console.log('\n' + '='.repeat(70));
    console.log('3. Checking image_creation_settings for avatar mainPrompts...');

    const settings = await sql`
      SELECT id, workflow_id, website_id, audience_avatars, updated_at
      FROM image_creation_settings
      ORDER BY updated_at DESC
    `;

    console.log(`   Found ${settings.length} settings rows`);

    for (const row of settings) {
      const avatars = row.audience_avatars || [];
      for (const avatar of avatars) {
        if (avatar.mainPrompt && avatar.mainPrompt.length > 50) {
          console.log(`\n   ─────────────────────────────────────────`);
          console.log(`   Settings ID: ${row.id} | Website: ${row.website_id || 'N/A'}`);
          console.log(`   Avatar: "${avatar.name}" (tag: ${avatar.tag || 'none'})`);
          console.log(`   Updated: ${row.updated_at}`);
          console.log(`   MAIN PROMPT (${avatar.mainPrompt.length} chars):`);
          console.log(`   ${avatar.mainPrompt}`);
          console.log(`   ─────────────────────────────────────────`);
        }
      }
    }

    // 4. Find oldest articles to check their structure
    console.log('\n' + '='.repeat(70));
    console.log('4. Oldest articles with images (Jan 10-16 range)...');

    const oldArticles = await sql`
      SELECT id, keyword, created_at,
             jsonb_array_length(COALESCE(generated_images, '[]'::jsonb)) as img_count,
             image_decision_report IS NOT NULL as has_report
      FROM articles
      WHERE created_at >= '2025-01-10' AND created_at <= '2025-01-16'
      ORDER BY created_at ASC
      LIMIT 20
    `;

    console.log(`   Found ${oldArticles.length} articles from Jan 10-16:`);
    for (const a of oldArticles) {
      console.log(`   #${a.id}: "${a.keyword}" - ${a.img_count} images, report: ${a.has_report ? 'YES' : 'NO'} (${a.created_at})`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('DONE!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error(error);
  }
}

findPrompts();
