/**
 * Run migration 018 - Add timezone column to drip_feed_settings
 */

import { neon } from '@neondatabase/serverless';

const connectionString = 'postgresql://neondb_owner:npg_FEAdokp4C1IQ@ep-dark-bar-adgtv25x-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const sql = neon(connectionString);

async function runMigration() {
  console.log('Running migration 018: Add timezone to drip_feed_settings...');

  try {
    // Add timezone column if it doesn't exist
    await sql`ALTER TABLE drip_feed_settings ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Chicago'`;
    console.log('✅ Added timezone column');

    // Verify it exists
    const result = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'drip_feed_settings' AND column_name = 'timezone'`;
    if (result.length > 0) {
      console.log('✅ Verified: timezone column exists');
    } else {
      console.log('❌ Verification failed: column not found');
    }

    // Check current values
    const settings = await sql`SELECT id, website_id, timezone FROM drip_feed_settings LIMIT 5`;
    console.log('Current settings:', settings);

  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }
}

runMigration();
