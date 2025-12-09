/**
 * StyleLock - Style DNA Extraction Service
 * Analyzes reference images to extract visual style characteristics
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load prompt template
const STYLE_DNA_PROMPT = fs.readFileSync(
  path.join(__dirname, 'prompts', 'style-dna.txt'),
  'utf-8'
);

/**
 * Convert local file path to base64 data URL
 */
export function localFileToBase64(localPath) {
  // Handle paths starting with /uploads/
  const relativePath = localPath.startsWith('/') ? localPath.substring(1) : localPath;
  const fullPath = path.join(__dirname, '..', '..', '..', relativePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${localPath}`);
  }

  const fileBuffer = fs.readFileSync(fullPath);
  const base64 = fileBuffer.toString('base64');

  const ext = path.extname(fullPath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };

  const mimeType = mimeTypes[ext] || 'image/jpeg';
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Check if path is a local file path
 */
export function isLocalPath(url) {
  return url.startsWith('/uploads/') || url.startsWith('uploads/');
}

/**
 * Prepare image URL for API (convert local paths to base64)
 */
export function prepareImageUrl(imageUrl) {
  if (isLocalPath(imageUrl)) {
    return localFileToBase64(imageUrl);
  }
  // If it's already a data URL or http URL, use as-is
  return imageUrl;
}

/**
 * Extract Style DNA from reference images
 * @param {string[]} referenceImages - Array of image URLs or local paths
 * @param {string} apiKey - OpenAI API key
 * @param {object} options - Additional options
 * @returns {object} - Extracted style DNA
 */
export async function extractStyleDNA(referenceImages, apiKey, options = {}) {
  const {
    model = 'gpt-4o',
    maxImages = 5
  } = options;

  if (!referenceImages || referenceImages.length === 0) {
    throw new Error('At least one reference image is required');
  }

  const openai = new OpenAI({ apiKey });

  // Build message content with images
  const content = [
    { type: 'text', text: STYLE_DNA_PROMPT }
  ];

  // Add images (limit to maxImages)
  const imagesToAnalyze = referenceImages.slice(0, maxImages);

  for (const imageUrl of imagesToAnalyze) {
    try {
      const preparedUrl = prepareImageUrl(imageUrl);
      content.push({
        type: 'image_url',
        image_url: { url: preparedUrl, detail: 'high' }
      });
    } catch (error) {
      console.warn(`Failed to prepare image ${imageUrl}:`, error.message);
      // Continue with other images
    }
  }

  if (content.length === 1) {
    throw new Error('No valid images could be loaded');
  }

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content }],
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const responseText = response.choices[0].message.content;

    let styleDNA;
    try {
      styleDNA = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Failed to parse Style DNA response: ${parseError.message}`);
    }

    // Calculate cost
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const cost = (inputTokens * 0.005 / 1000) + (outputTokens * 0.015 / 1000); // GPT-4o pricing

    return {
      styleDNA,
      imagesAnalyzed: content.length - 1,
      cost,
      model
    };

  } catch (error) {
    if (error.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key');
    }
    throw new Error(`Style DNA extraction failed: ${error.message}`);
  }
}

/**
 * Analyze consistency of reference images
 * Returns groups if images have different styles
 */
export async function analyzeReferenceConsistency(referenceImages, apiKey, options = {}) {
  const { model = 'gpt-4o' } = options;

  if (referenceImages.length < 2) {
    return {
      consistent: true,
      groups: [{ images: referenceImages, description: 'Single image' }]
    };
  }

  const openai = new OpenAI({ apiKey });

  const content = [
    {
      type: 'text',
      text: `Analyze these ${referenceImages.length} images and determine if they share a consistent visual style.

If they ARE consistent (same lighting style, color palette, composition approach):
{
  "consistent": true,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "sharedStyle": "Description of the shared style"
}

If they are NOT consistent (different styles mixed together):
{
  "consistent": false,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "groups": [
    {
      "imageIndices": [0, 2, 4],
      "description": "Bright, airy natural light style"
    },
    {
      "imageIndices": [1, 3],
      "description": "Dramatic, high contrast style"
    }
  ],
  "recommendation": "Which group to choose or how to proceed"
}

Respond with JSON only.`
    }
  ];

  for (const imageUrl of referenceImages.slice(0, 10)) {
    try {
      const preparedUrl = prepareImageUrl(imageUrl);
      content.push({
        type: 'image_url',
        image_url: { url: preparedUrl, detail: 'low' }
      });
    } catch (error) {
      console.warn(`Failed to prepare image for consistency check:`, error.message);
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content }],
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Map indices back to actual images
    if (!result.consistent && result.groups) {
      result.groups = result.groups.map(group => ({
        images: group.imageIndices.map(i => referenceImages[i]).filter(Boolean),
        description: group.description
      }));
    }

    return result;

  } catch (error) {
    // If analysis fails, assume consistent and proceed
    console.warn('Consistency analysis failed:', error.message);
    return {
      consistent: true,
      confidence: 'LOW',
      sharedStyle: 'Analysis failed - proceeding with all images'
    };
  }
}

/**
 * Detect if an image is likely AI-generated
 */
export async function detectAIGenerated(imageUrl, apiKey, options = {}) {
  const { model = 'gpt-4o' } = options;

  const openai = new OpenAI({ apiKey });

  try {
    const preparedUrl = prepareImageUrl(imageUrl);

    const response = await openai.chat.completions.create({
      model,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Is this image likely AI-generated or a real photograph?

Look for:
- Unnatural textures (skin, fabric, surfaces)
- Lighting inconsistencies
- Weird details (hands, text, backgrounds)
- Too-perfect symmetry
- Uncanny valley effects

Respond with JSON:
{
  "verdict": "REAL" | "AI" | "UNSURE",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reason": "Brief explanation"
}`
          },
          {
            type: 'image_url',
            image_url: { url: preparedUrl, detail: 'high' }
          }
        ]
      }],
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);

  } catch (error) {
    return {
      verdict: 'UNSURE',
      confidence: 'LOW',
      reason: `Analysis failed: ${error.message}`
    };
  }
}
