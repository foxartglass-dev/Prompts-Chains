/**
 * Import House Cleaning avatar settings
 * Run with: node scripts/import-house-cleaning-avatar.js <workflowId>
 *
 * Or via curl while server is running:
 * curl -X PUT http://localhost:3001/api/image-creation/settings/<workflowId> \
 *   -H "Content-Type: application/json" \
 *   -d @scripts/house-cleaning-avatar.json
 */

const WORKFLOW_ID = process.argv[2] || 1; // Pass workflow ID as argument

const avatarData = {
  enabled: true,
  image_generation_model: 'gpt-image-1.5',
  audience_avatars: [
    {
      id: Date.now(),
      name: 'House Cleaning',
      tag: 'H', // Assuming H tag based on previous context
      mainPrompt: `{Gender_&_Age}Photorealistic professional cleaning scene inside a modern residential kitchen.

An adult professional cleaner is a {Gender_&_Age} is actively {Item_Cleaning} using a microfiber cloth and spray bottle. The cleaner is shown from a natural candid angle, mid-action, focused on the cleaning task.

The cleaner is wearing a plain solid-color dark navy blue short-sleeve shirt that has a white logo over right side of chest, protective cleaning gloves, and simple work attire with no readable logos or text. Clothing looks practical and professional.

The environment is a clean, modern house with neutral colors, light cabinetry, and minimal clutter. The countertop surface is clearly visible and being wiped.

Lighting is bright, soft, natural indoor lighting, similar to daylight coming through a nearby window. No harsh shadows, no dramatic lighting.

Camera style is DSLR photography with shallow to medium depth of field. The subject is in sharp focus while the background is slightly blurred.

Composition is realistic and natural, like a high-quality professional stock photo. The frame captures the cleaner from the side at a slight angle, not posed, not centered perfectly.

Facial expression is neutral to positive – calm, focused, professional. The emotion conveyed is trust, cleanliness, and professionalism.

High-resolution, ultra-realistic, natural skin tones, accurate textures.

No text, no watermarks, no branding, no exaggerated poses, no artificial effects.`,
      variations: [],
      placeholderMode: 'advanced',
      placeholderCategories: [
        {
          id: 'item_cleaning',
          name: 'Item Cleaning',
          placeholder: '{Item_Cleaning}',
          options: [
            { number: 1, text: 'cleaning the stove burners' },
            { number: 2, text: 'cleaning the sink' },
            { number: 3, text: 'cleaning the countertops' }
          ]
        },
        {
          id: 'gender_age',
          name: 'Gender & Age',
          placeholder: '{Gender_&_Age}',
          options: [
            { number: 1, text: 'male ages 25-35' },
            { number: 2, text: 'female ages 25-35' },
            { number: 3, text: 'female ages 35-45' }
          ]
        }
      ],
      generationMode: 'random',
      randomCount: 5
    }
  ]
};

async function importSettings() {
  try {
    const response = await fetch(`http://localhost:3001/api/image-creation/settings/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(avatarData)
    });

    const result = await response.json();
    console.log('Import result:', result);
  } catch (error) {
    console.error('Error importing settings:', error.message);
    console.log('\nMake sure the server is running on port 3001');
  }
}

importSettings();
