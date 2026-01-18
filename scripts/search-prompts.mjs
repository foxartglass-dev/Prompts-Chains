/**
 * Search ENTIRE Database for Prompts with Specific Patterns
 * Searches ALL tables, ALL JSONB columns - finds orphaned/disconnected data too
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
  console.log(`SEARCHING ENTIRE DATABASE FOR: "${searchTerm}"`);
  console.log('='.repeat(70));

  // Get list of ALL tables in the database
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

  console.log(`\nFound ${tables.length} tables to search:`);
  console.log(tables.map(t => t.table_name).join(', '));

  let totalFound = 0;

  // Search each table
  for (const { table_name } of tables) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📋 Searching table: ${table_name}`);
    console.log('─'.repeat(50));

    try {
      // Get column info for this table
      const columns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table_name}
      `;

      // Find text-like and JSONB columns to search
      const searchableColumns = columns.filter(c =>
        ['text', 'character varying', 'jsonb', 'json'].includes(c.data_type)
      );

      if (searchableColumns.length === 0) {
        console.log('   (no searchable text/jsonb columns)');
        continue;
      }

      console.log(`   Searchable columns: ${searchableColumns.map(c => c.column_name).join(', ')}`);

      // Build dynamic search query
      for (const col of searchableColumns) {
        try {
          let results;

          if (col.data_type === 'jsonb' || col.data_type === 'json') {
            // For JSONB, cast to text and search
            results = await sql`
              SELECT id, ${sql(col.column_name)}::text as content
              FROM ${sql(table_name)}
              WHERE ${sql(col.column_name)}::text ILIKE ${'%' + searchTerm + '%'}
              LIMIT 10
            `;
          } else {
            // For text columns
            results = await sql`
              SELECT id, ${sql(col.column_name)} as content
              FROM ${sql(table_name)}
              WHERE ${sql(col.column_name)} ILIKE ${'%' + searchTerm + '%'}
              LIMIT 10
            `;
          }

          if (results.length > 0) {
            totalFound += results.length;
            console.log(`\n   ✅ FOUND ${results.length} match(es) in column "${col.column_name}":`);

            for (const row of results) {
              console.log(`\n      Row ID: ${row.id}`);

              // Show context around the match
              const content = typeof row.content === 'string' ? row.content : JSON.stringify(row.content);
              const lowerContent = content.toLowerCase();
              const lowerSearch = searchTerm.toLowerCase();
              const idx = lowerContent.indexOf(lowerSearch);

              if (idx >= 0) {
                const start = Math.max(0, idx - 100);
                const end = Math.min(content.length, idx + searchTerm.length + 200);
                console.log(`      Context: ...${content.substring(start, end)}...`);
              } else {
                console.log(`      Preview: ${content.substring(0, 300)}...`);
              }
            }
          }
        } catch (colErr) {
          // Some columns might fail, that's OK
          if (!colErr.message.includes('does not exist')) {
            console.log(`   (error searching ${col.column_name}: ${colErr.message.substring(0, 50)})`);
          }
        }
      }
    } catch (tableErr) {
      console.log(`   Error: ${tableErr.message.substring(0, 100)}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SEARCH COMPLETE');
  console.log(`Total matches found: ${totalFound}`);
  console.log('='.repeat(70));

  // Also show specific common locations
  console.log('\n📍 COMMON PROMPT LOCATIONS:');
  console.log('   - image_creation_settings.audience_avatars → mainPrompt field');
  console.log('   - image_creation_settings.consultant_chat_history → message content');
  console.log('   - articles.generated_images → prompt field per image');
  console.log('   - articles.image_decision_report → finalPrompt field');
  console.log('   - workflows.settings → may contain legacy prompts');
}

searchPrompts().catch(console.error);
