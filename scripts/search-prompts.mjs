/**
 * Search Database for Prompts with Specific Patterns
 *
 * Usage: DATABASE_URL="your-neon-url" node scripts/search-prompts.mjs "CRITICAL"
 *        DATABASE_URL="your-neon-url" node scripts/search-prompts.mjs "DSLR"
 *        DATABASE_URL="your-neon-url" node scripts/search-prompts.mjs "navy blue"
 */

import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;
const searchTerm = process.argv[2] || 'CRITICAL';

if (!connectionString) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  console.log('Usage: DATABASE_URL="your-neon-url" node scripts/search-prompts.mjs "CRITICAL"');
  process.exit(1);
}

const sql = neon(connectionString);

async function searchPrompts() {
  console.log('='.repeat(70));
  console.log(`SEARCHING DATABASE FOR: "${searchTerm}"`);
  console.log('='.repeat(70));

  // 1. Search in audience_avatars mainPrompt
  console.log('\n📋 1. AUDIENCE AVATARS (mainPrompt):');
  console.log('-'.repeat(50));

  const settings = await sql`
    SELECT
      ics.id,
      ics.workflow_id,
      ics.website_id,
      w.name as website_name,
      ics.audience_avatars,
      ics.updated_at
    FROM image_creation_settings ics
    LEFT JOIN websites w ON ics.website_id = w.id
    ORDER BY ics.updated_at DESC
  `;

  let foundInAvatars = 0;
  for (const row of settings) {
    if (!row.audience_avatars) continue;

    for (const avatar of row.audience_avatars) {
      if (avatar.mainPrompt && avatar.mainPrompt.includes(searchTerm)) {
        foundInAvatars++;
        console.log(`\n✅ FOUND in Avatar "${avatar.name}" (${avatar.tag || 'no tag'})`);
        console.log(`   Website: ${row.website_name || 'Global'}`);
        console.log(`   Updated: ${row.updated_at}`);
        console.log(`   Prompt length: ${avatar.mainPrompt.length} chars`);
        console.log(`   Preview:`);
        // Show context around the match
        const idx = avatar.mainPrompt.indexOf(searchTerm);
        const start = Math.max(0, idx - 50);
        const end = Math.min(avatar.mainPrompt.length, idx + searchTerm.length + 100);
        console.log(`   ...${avatar.mainPrompt.substring(start, end)}...`);

        // Ask if user wants full prompt
        console.log(`\n   FULL PROMPT (first 1000 chars):`);
        console.log('   ' + '-'.repeat(40));
        console.log(avatar.mainPrompt.substring(0, 1000));
        if (avatar.mainPrompt.length > 1000) {
          console.log(`   ... (${avatar.mainPrompt.length - 1000} more chars)`);
        }
      }
    }
  }

  if (foundInAvatars === 0) {
    console.log('   No matches in audience_avatars mainPrompt');
  }

  // 2. Search in consultant_chat_history
  console.log('\n\n📋 2. CHAT HISTORY (consultant_chat_history):');
  console.log('-'.repeat(50));

  let foundInChat = 0;
  for (const row of settings) {
    const chatHistory = row.consultant_chat_history;
    if (!chatHistory || !Array.isArray(chatHistory)) continue;

    for (const msg of chatHistory) {
      if (msg.content && msg.content.includes(searchTerm)) {
        foundInChat++;
        console.log(`\n✅ FOUND in chat message (${msg.role})`);
        console.log(`   Website: ${row.website_name || 'Global'}`);
        console.log(`   Timestamp: ${msg.timestamp || 'unknown'}`);
        const idx = msg.content.indexOf(searchTerm);
        const start = Math.max(0, idx - 50);
        const end = Math.min(msg.content.length, idx + searchTerm.length + 200);
        console.log(`   Context: ...${msg.content.substring(start, end)}...`);
      }
    }
  }

  if (foundInChat === 0) {
    console.log('   No matches in chat history');
  }

  // 3. Search in articles generated_images prompts
  console.log('\n\n📋 3. ARTICLE GENERATED IMAGES (prompt field):');
  console.log('-'.repeat(50));

  const articles = await sql`
    SELECT
      a.id,
      a.keyword,
      a.generated_images,
      a.image_decision_report,
      w.name as website_name
    FROM articles a
    LEFT JOIN websites w ON a.website_id = w.id
    WHERE a.generated_images IS NOT NULL
    ORDER BY a.created_at DESC
    LIMIT 100
  `;

  let foundInArticles = 0;
  for (const article of articles) {
    if (!article.generated_images) continue;

    const images = Array.isArray(article.generated_images)
      ? article.generated_images
      : [];

    for (const img of images) {
      if (img.prompt && img.prompt.includes(searchTerm)) {
        foundInArticles++;
        console.log(`\n✅ FOUND in article image prompt`);
        console.log(`   Article: "${article.keyword}"`);
        console.log(`   Website: ${article.website_name || 'Unknown'}`);
        console.log(`   Prompt preview: ${img.prompt.substring(0, 300)}...`);
      }
    }

    // Also check image_decision_report
    if (article.image_decision_report) {
      const report = article.image_decision_report;
      if (report.finalPrompt && report.finalPrompt.includes(searchTerm)) {
        foundInArticles++;
        console.log(`\n✅ FOUND in image_decision_report.finalPrompt`);
        console.log(`   Article: "${article.keyword}"`);
        console.log(`   Prompt preview: ${report.finalPrompt.substring(0, 300)}...`);
      }
    }
  }

  if (foundInArticles === 0) {
    console.log('   No matches in article image prompts (checked last 100 articles)');
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY:');
  console.log(`  Found "${searchTerm}" in ${foundInAvatars} avatar(s)`);
  console.log(`  Found "${searchTerm}" in ${foundInChat} chat message(s)`);
  console.log(`  Found "${searchTerm}" in ${foundInArticles} article image(s)`);
  console.log('='.repeat(70));
}

searchPrompts().catch(console.error);
