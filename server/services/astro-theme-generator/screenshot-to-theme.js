#!/usr/bin/env node
/**
 * Screenshot → Astro Theme CLI Tool
 *
 * Usage:
 *   node screenshot-to-theme.js <image-path> [theme-name]
 *
 * Example:
 *   node screenshot-to-theme.js ./my-screenshot.png my-dark-theme
 *
 * Requires:
 *   ANTHROPIC_API_KEY environment variable
 *
 * What it does:
 *   1. Reads the screenshot image
 *   2. Sends it to Claude's vision API to extract design DNA
 *   3. Feeds the design DNA through the Astro theme pipeline
 *   4. Writes the complete theme package to ./output/<theme-name>/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fromMentor } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Config ----
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// ---- The Prompt ----
const DESIGN_DNA_PROMPT = `You are a design system analyzer. Look at this screenshot of a website and extract the complete design DNA as a JSON object.

Analyze CAREFULLY:
- The dominant brand/accent color (look at buttons, links, highlights)
- Background colors (is it dark mode? light mode? what shade?)
- Text colors at different hierarchy levels
- Border colors and styles
- Font family (your best guess from the visual style)
- Font sizes for headings, body, small text
- Card styling (background, border, radius, shadow)
- Button styling
- Input styling
- Spacing density (tight/cozy/spacious)

Return ONLY valid JSON in this exact format (no markdown, no explanation):

{
  "colors": {
    "brandLight": "#hex",
    "brandDefault": "#hex",
    "brandDark": "#hex",
    "surfaceCanvas": "#hex",
    "surfaceBase": "#hex",
    "surfaceMuted": "#hex",
    "textPrimary": "#hex",
    "textSecondary": "#hex",
    "textTertiary": "#hex",
    "borderSubtle": "#hex",
    "borderDefault": "#hex"
  },
  "typography": {
    "fontFamily": "Font Name",
    "display": { "size": "XXpx", "weight": "700" },
    "h1": { "size": "XXpx", "weight": "600" },
    "h2": { "size": "XXpx", "weight": "600" },
    "h3": { "size": "XXpx", "weight": "600" },
    "body": { "size": "XXpx", "weight": "400" },
    "small": { "size": "XXpx", "weight": "400" },
    "micro": { "size": "XXpx", "weight": "500" }
  },
  "components": {
    "cards": {
      "background": "#hex or description",
      "border": "CSS border value",
      "radius": "XXpx",
      "shadow": "CSS shadow value",
      "padding": "XXpx"
    },
    "buttons": {
      "background": "#hex",
      "textColor": "#hex",
      "radius": "XXpx",
      "padding": "XXpx XXpx"
    },
    "inputs": {
      "background": "#hex",
      "border": "CSS border value",
      "radius": "XXpx"
    }
  },
  "spacing": {
    "baseUnit": "8px",
    "density": "cozy or compact",
    "cardGaps": "XXpx",
    "sectionGaps": "XXpx"
  },
  "tailwindConfig": {
    "theme": {
      "extend": {
        "colors": {
          "brand": { "light": "#hex", "DEFAULT": "#hex", "dark": "#hex" },
          "surface": { "canvas": "#hex", "base": "#hex", "muted": "#hex" },
          "text": { "primary": "#hex", "secondary": "#hex", "tertiary": "#hex" },
          "border": { "subtle": "#hex", "DEFAULT": "#hex" }
        },
        "fontFamily": {
          "sans": ["Font Name", "system-ui", "sans-serif"]
        },
        "borderRadius": {
          "card": "XXpx",
          "input": "XXpx",
          "btn": "XXpx"
        },
        "boxShadow": {
          "card": "CSS shadow value",
          "hover": "CSS shadow value"
        }
      }
    }
  }
}`;

// ---- Main ----
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Screenshot → Astro Theme Generator
====================================

Usage:
  node screenshot-to-theme.js <image-path> [theme-name]

Examples:
  node screenshot-to-theme.js ./screenshot.png
  node screenshot-to-theme.js ./dark-site.jpg my-dark-theme
  node screenshot-to-theme.js C:\\Users\\me\\Desktop\\site.png cool-theme

Environment:
  ANTHROPIC_API_KEY  Required. Your Anthropic API key.

Output:
  Creates a complete Astro theme package in ./output/<theme-name>/
  with CSS, Tailwind preset, Astro components, and package.json.
`);
    process.exit(0);
  }

  // Validate API key
  if (!ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is required.');
    console.error('');
    console.error('Set it:');
    console.error('  Windows:  set ANTHROPIC_API_KEY=sk-ant-...');
    console.error('  Mac/Linux: export ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  const imagePath = path.resolve(args[0]);
  const themeName = args[1] || path.basename(imagePath, path.extname(imagePath)) + '-theme';

  // Validate image exists
  if (!fs.existsSync(imagePath)) {
    console.error(`ERROR: Image not found: ${imagePath}`);
    process.exit(1);
  }

  const ext = path.extname(imagePath).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };

  if (!mimeTypes[ext]) {
    console.error(`ERROR: Unsupported image format: ${ext}`);
    console.error('Supported: .png, .jpg, .jpeg, .gif, .webp');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('SCREENSHOT → ASTRO THEME');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Image:  ${imagePath}`);
  console.log(`Theme:  ${themeName}`);
  console.log(`Model:  ${CLAUDE_MODEL}`);
  console.log('');

  // Step 1: Read and encode the image
  console.log('[1/4] Reading image...');
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mediaType = mimeTypes[ext];
  console.log(`       ${(imageBuffer.length / 1024).toFixed(1)} KB, ${mediaType}`);
  console.log('');

  // Step 2: Send to Claude Vision API
  console.log('[2/4] Analyzing design with Claude Vision...');
  let designDNA;
  try {
    designDNA = await extractDesignDNA(base64Image, mediaType);
    console.log('       Design DNA extracted successfully.');
    console.log(`       Brand: ${designDNA.colors?.brandDefault || 'unknown'}`);
    console.log(`       Surface: ${designDNA.colors?.surfaceCanvas || 'unknown'}`);
    console.log(`       Font: ${designDNA.typography?.fontFamily || 'unknown'}`);
    console.log('');
  } catch (err) {
    console.error(`ERROR: Failed to analyze image: ${err.message}`);
    process.exit(1);
  }

  // Step 3: Generate theme through pipeline
  console.log('[3/4] Generating Astro theme package...');
  const result = fromMentor(designDNA, {
    packageName: themeName,
    version: '1.0.0',
    description: `Theme generated from screenshot: ${path.basename(imagePath)}`
  });
  console.log(`       ${Object.keys(result.package.files).length} files generated`);
  console.log('');

  // Step 4: Write to disk
  console.log('[4/4] Writing files...');
  const outputDir = path.join(__dirname, 'output', themeName);
  let totalBytes = 0;

  for (const [filepath, content] of Object.entries(result.package.files)) {
    const fullPath = path.join(outputDir, filepath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    totalBytes += content.length;
    console.log(`       ${filepath}`);
  }

  // Also write the raw design DNA for reference
  const dnaPath = path.join(outputDir, 'design-dna.json');
  fs.writeFileSync(dnaPath, JSON.stringify(designDNA, null, 2), 'utf-8');
  console.log(`       design-dna.json`);

  console.log('');
  console.log('='.repeat(60));
  console.log('DONE!');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Theme package: ${outputDir}`);
  console.log(`Total size:    ${(totalBytes / 1024).toFixed(1)} KB`);
  console.log('');
  console.log('To use in an Astro project:');
  console.log('');
  console.log('  1. Copy the theme CSS:');
  console.log(`     copy "${path.join(outputDir, 'src', 'styles', 'theme.css')}" your-project/src/styles/`);
  console.log('');
  console.log('  2. Import in your layout:');
  console.log("     import '../styles/theme.css';");
  console.log('');
  console.log('  3. Or install as a local package:');
  console.log(`     npm install "${outputDir}"`);
  console.log('');
}

/**
 * Call Claude Vision API to extract design DNA from screenshot
 */
async function extractDesignDNA(base64Image, mediaType) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image
            }
          },
          {
            type: 'text',
            text: DESIGN_DNA_PROMPT
          }
        ]
      }]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  // Parse the JSON from Claude's response
  // Try to extract JSON if it's wrapped in markdown code blocks
  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    return JSON.parse(jsonStr.trim());
  } catch (e) {
    // Try to find JSON object in the response
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      return JSON.parse(braceMatch[0]);
    }
    throw new Error(`Failed to parse design DNA JSON: ${e.message}\n\nRaw response:\n${text}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
