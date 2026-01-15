/**
 * Fix House Cleaning avatar mainPrompt
 * This updates the avatar's mainPrompt from "construction sweeping" to correct "navy blue kitchen cleaning"
 *
 * Run with: node scripts/fix-house-cleaning-avatar.js
 */

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

const WEBSITE_ID = 3; // From logs: website_id: 3

async function fixAvatar() {
  try {
    // Get current settings
    const getRes = await fetch(`http://localhost:3001/api/image-creation/settings/website/${WEBSITE_ID}`);
    const getData = await getRes.json();

    if (!getData.settings) {
      console.error('No settings found for website', WEBSITE_ID);
      return;
    }

    const settings = getData.settings;
    console.log('Current avatars:', settings.audience_avatars?.map(a => ({ name: a.name, tag: a.tag })));

    // Find House Cleaning avatar (tag H)
    const avatars = settings.audience_avatars || [];
    const houseCleaningIdx = avatars.findIndex(a => a.tag === 'H' || a.name === 'House Cleaning');

    if (houseCleaningIdx === -1) {
      console.error('House Cleaning avatar not found!');
      return;
    }

    console.log('Found avatar at index', houseCleaningIdx);
    console.log('Current mainPrompt preview:', avatars[houseCleaningIdx].mainPrompt?.substring(0, 100));

    // Update the mainPrompt
    avatars[houseCleaningIdx].mainPrompt = CORRECT_MAIN_PROMPT;

    // Save back - need to use workflow endpoint since that's what the PUT handler expects
    // The server will detect website_id and save to website-level
    const workflowId = 14; // From logs: workflowId: 14

    const saveRes = await fetch(`http://localhost:3001/api/image-creation/settings/${workflowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audience_avatars: avatars
      })
    });

    const saveData = await saveRes.json();
    console.log('Save result:', saveData);

    if (saveData.success) {
      console.log('SUCCESS! Avatar mainPrompt updated to correct navy blue kitchen cleaning prompt.');
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nMake sure the server is running on port 3001');
  }
}

fixAvatar();
