// Run migration 006 to add smart_matching columns
// Usage: node server/db/run-migration-006.mjs

import { neon } from '@neondatabase/serverless';

const connectionString = 'postgresql://neondb_owner:npg_FEAdokp4C1IQ@ep-dark-bar-adgtv25x-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function runMigration() {
  const sql = neon(connectionString);

  console.log('Running migration 006: Add smart_matching columns...\n');

  try {
    // Check if columns already exist
    const checkColumns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'image_creation_settings'
      AND column_name IN ('smart_matching_enabled', 'smart_matching_mode')
    `;

    const existingColumns = checkColumns.map(r => r.column_name);
    console.log('Existing columns:', existingColumns.length > 0 ? existingColumns.join(', ') : 'none');

    // Add smart_matching_enabled if not exists
    if (!existingColumns.includes('smart_matching_enabled')) {
      await sql`
        ALTER TABLE image_creation_settings
        ADD COLUMN smart_matching_enabled BOOLEAN DEFAULT false
      `;
      console.log('✓ Added smart_matching_enabled column');
    } else {
      console.log('- smart_matching_enabled already exists');
    }

    // Add smart_matching_mode if not exists
    if (!existingColumns.includes('smart_matching_mode')) {
      await sql`
        ALTER TABLE image_creation_settings
        ADD COLUMN smart_matching_mode VARCHAR(50) DEFAULT 'bank_first'
      `;
      console.log('✓ Added smart_matching_mode column');
    } else {
      console.log('- smart_matching_mode already exists');
    }

    console.log('\n✅ Migration 006 complete!');

    // Verify
    const verify = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'image_creation_settings'
      AND column_name IN ('smart_matching_enabled', 'smart_matching_mode')
    `;
    console.log('\nVerification:');
    verify.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (default: ${col.column_default})`);
    });

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
