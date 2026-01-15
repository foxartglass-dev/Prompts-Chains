/**
 * Direct Database Fix: Update House Cleaning Avatar mainPrompt
 *
 * This script directly updates the audience_avatars JSONB in the database
 * to fix the stale "construction sweeping" mainPrompt.
 *
 * Run with: node scripts/fix-mainprompt-direct.mjs
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

// The CORRECT mainPrompt - navy blue kitchen cleaning
const CORRECT_MAIN_PROMPT = `{Gender_&_Age}Photorealistic professional cleaning scene inside a modern residential kitchen.

An adult professional cleaner is a {Gender_&_Age} is actively {Item_Cleaning} using a microfiber cloth and spray bottle. The cleaner is shown from a natural candid angle, mid-action, focused on the cleaning task.

The cleaner is wearing a plain solid-color dark navy blue short-sleeve shirt that has a white logo over right side of chest, protective cleaning gloves, and simple work attire with no readable logos or text. Clothing looks practical and professional.

The environment is a clean, modern house with neutral colors, light cabinetry, and minimal clutter. The countertop surface is clearly visible and being wiped.

Lighting is bright, soft, natural indoor lighting, similar to daylight coming through a nearby window. No harsh shadows, no dramatic lighting.

Camera style is DSLR photography with shallow to medium depth of field. The subject is in sharp focus while the background is slightly blurred.

Composition is realistic and natural, like a high-quality professional stock photo. The frame captures the cleaner from the side at a slight angle, not posed, not centered perfectly.

Facial expression is neutral to positive – calm, focused, professional. The emotion conveyed is trust, cleanliness, and professionalism.

High-resolution, ultra-realistic, natural skin tones, accurate textures.

No text, no watermarks, no branding, no exaggerated poses, no artificial effects.`;

async function fixMainPrompt() {
  console.log('='.repeat(60));
  console.log('DIRECT DATABASE FIX: Update House Cleaning Avatar mainPrompt');
  console.log('='.repeat(60));

  try {
    // Step 1: Find all settings rows that might have the House Cleaning avatar
    console.log('\n1. Searching for all image_creation_settings rows...');
    const allSettings = await sql`
      SELECT id, workflow_id, website_id, audience_avatars, updated_at
      FROM image_creation_settings
      ORDER BY id
    `;

    console.log(`   Found ${allSettings.length} settings row(s)`);

    for (const row of allSettings) {
      console.log(`\n   Row ID: ${row.id} | workflow_id: ${row.workflow_id || 'NULL'} | website_id: ${row.website_id || 'NULL'}`);

      const avatars = row.audience_avatars || [];
      console.log(`   Avatars: ${avatars.length}`);

      // Find House Cleaning avatar (tag H or name contains "House" or "Cleaning")
      let needsUpdate = false;
      const updatedAvatars = avatars.map((avatar, idx) => {
        const isHouseCleaning = avatar.tag === 'H' ||
                                avatar.name?.toLowerCase().includes('house') ||
                                avatar.name?.toLowerCase().includes('cleaning');

        const mainPromptPreview = avatar.mainPrompt?.substring(0, 60) || '(empty)';
        console.log(`     [${idx}] "${avatar.name}" (tag: ${avatar.tag || 'none'}) - ${mainPromptPreview}...`);

        // Check if this is House Cleaning with stale prompt
        if (isHouseCleaning && avatar.mainPrompt) {
          const hasConstruction = avatar.mainPrompt.toLowerCase().includes('construction') ||
                                   avatar.mainPrompt.toLowerCase().includes('sweeping debris');
          const hasNavyBlue = avatar.mainPrompt.toLowerCase().includes('navy blue');
          const hasKitchen = avatar.mainPrompt.toLowerCase().includes('kitchen');

          if (hasConstruction || (!hasNavyBlue && !hasKitchen)) {
            console.log(`     ^ STALE PROMPT DETECTED! Contains construction/sweeping or missing navy blue/kitchen`);
            needsUpdate = true;
            return { ...avatar, mainPrompt: CORRECT_MAIN_PROMPT };
          } else {
            console.log(`     ^ Already has correct prompt (navy blue kitchen)`);
          }
        }

        return avatar;
      });

      if (needsUpdate) {
        console.log(`\n   UPDATING row ${row.id} with correct mainPrompt...`);
        await sql`
          UPDATE image_creation_settings
          SET audience_avatars = ${JSON.stringify(updatedAvatars)}::jsonb,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${row.id}
        `;
        console.log(`   SUCCESS! Row ${row.id} updated.`);
      }
    }

    // Step 2: Verify the fix
    console.log('\n' + '='.repeat(60));
    console.log('2. VERIFICATION - Reading all rows after fix...');
    console.log('='.repeat(60));

    const verifySettings = await sql`
      SELECT id, workflow_id, website_id, audience_avatars
      FROM image_creation_settings
      ORDER BY id
    `;

    for (const row of verifySettings) {
      console.log(`\n   Row ID: ${row.id} | workflow_id: ${row.workflow_id || 'NULL'} | website_id: ${row.website_id || 'NULL'}`);
      const avatars = row.audience_avatars || [];
      for (const avatar of avatars) {
        if (avatar.tag === 'H' || avatar.name?.toLowerCase().includes('house') || avatar.name?.toLowerCase().includes('cleaning')) {
          const preview = avatar.mainPrompt?.substring(0, 80) || '(empty)';
          const hasNavy = avatar.mainPrompt?.toLowerCase().includes('navy blue') ? 'YES' : 'NO';
          const hasKitchen = avatar.mainPrompt?.toLowerCase().includes('kitchen') ? 'YES' : 'NO';
          console.log(`     "${avatar.name}" - Navy blue: ${hasNavy} | Kitchen: ${hasKitchen}`);
          console.log(`     Preview: ${preview}...`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('DONE! Restart the server for changes to take effect.');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error(error);
  }
}

fixMainPrompt();
