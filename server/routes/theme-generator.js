/**
 * Theme Generator Routes
 *
 * Stripe "minions" pattern: code-first, AI-fallback.
 * - DOM extraction (Puppeteer + getComputedStyle): $0.00, ~5 seconds, covers ~85% of sites
 * - Claude Vision fallback: ~$0.02, ~15 seconds, for image uploads or low-confidence DOM results
 *
 * URL flow:  Puppeteer DOM extraction → confidence check → (AI fallback if needed) → generate theme
 * Image flow: Claude Vision (no DOM available) → generate theme
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { generateElementorTheme, toElementorData } from '../services/elementor-theme-generator.js';
import { scoreDNA } from '../services/dna-confidence-scorer.js';
import { extractFromDOM, isDOMExtractionConfident } from '../services/dom-design-extractor.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATOR_DIR = path.join(__dirname, '..', 'services', 'astro-theme-generator');
const OUTPUT_DIR = path.join(GENERATOR_DIR, 'output');

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

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

/**
 * Screenshot a URL using Puppeteer
 */
async function screenshotUrl(url) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // Wait a moment for any animations/lazy-loads
    await new Promise(r => setTimeout(r, 1500));
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    return buffer;
  } finally {
    await browser.close();
  }
}

/**
 * Call Claude Vision API to extract design DNA from a base64 image
 */
async function extractDesignDNA(base64Image, mediaType) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
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
    throw new Error(`Claude API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  try {
    return JSON.parse(jsonStr.trim());
  } catch (e) {
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) return JSON.parse(braceMatch[0]);
    throw new Error(`Failed to parse design DNA JSON: ${e.message}`);
  }
}

/**
 * Run the theme generation pipeline
 */
async function generateTheme(designDNA, themeName, sourceDescription) {
  // Dynamic import since the generator uses ESM
  const { fromMentor } = await import('../services/astro-theme-generator/index.js');

  const result = fromMentor(designDNA, {
    packageName: themeName,
    version: '1.0.0',
    description: `Theme generated from ${sourceDescription}`
  });

  // Write files to disk
  const outputDir = path.join(OUTPUT_DIR, themeName);
  for (const [filepath, content] of Object.entries(result.package.files)) {
    const fullPath = path.join(outputDir, filepath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  // Save the design DNA
  fs.writeFileSync(
    path.join(outputDir, 'design-dna.json'),
    JSON.stringify(designDNA, null, 2),
    'utf-8'
  );

  return {
    themeName,
    outputDir,
    designDNA,
    files: Object.keys(result.package.files),
    css: result.css,
    tailwindPreset: result.tailwindPreset
  };
}

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/theme-generator/from-url
 * Code-first: DOM extraction → confidence check → AI fallback if needed
 */
router.post('/from-url', async (req, res) => {
  try {
    const { url, themeName: rawName, forceAI = false } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    const themeName = rawName || new URL(url).hostname.replace(/[^a-z0-9]/gi, '-') + '-theme';
    let designDNA;
    let screenshotBase64;
    let extractionMethod = 'dom';

    if (!forceAI) {
      try {
        console.log(`[theme-generator] DOM extraction for: ${url}`);
        const domResult = await extractFromDOM(url);
        designDNA = domResult.designDNA;
        screenshotBase64 = `data:image/png;base64,${domResult.screenshot.toString('base64')}`;

        if (!isDOMExtractionConfident(designDNA)) {
          console.log(`[theme-generator] DOM confidence low, falling back to AI...`);
          designDNA = await extractDesignDNA(domResult.screenshot.toString('base64'), 'image/png');
          extractionMethod = 'ai';
        }
      } catch (domErr) {
        console.log(`[theme-generator] DOM extraction failed: ${domErr.message}, using AI...`);
        const screenshotBuffer = await screenshotUrl(url);
        const base64Image = screenshotBuffer.toString('base64');
        screenshotBase64 = `data:image/png;base64,${base64Image}`;
        designDNA = await extractDesignDNA(base64Image, 'image/png');
        extractionMethod = 'ai';
      }
    } else {
      const screenshotBuffer = await screenshotUrl(url);
      const base64Image = screenshotBuffer.toString('base64');
      screenshotBase64 = `data:image/png;base64,${base64Image}`;
      designDNA = await extractDesignDNA(base64Image, 'image/png');
      extractionMethod = 'ai';
    }

    const cleanDNA = { ...designDNA };
    delete cleanDNA._meta;

    console.log(`[theme-generator] Generating Astro theme: ${themeName} (${extractionMethod})`);
    const result = await generateTheme(cleanDNA, themeName, url);
    const confidence = scoreDNA(cleanDNA);

    res.json({
      success: true,
      ...result,
      screenshot: screenshotBase64,
      confidence,
      extractionMethod
    });
  } catch (err) {
    console.error('[theme-generator] from-url error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/theme-generator/from-image
 * Takes { image (base64), mediaType, themeName? } and returns the generated theme
 */
router.post('/from-image', async (req, res) => {
  try {
    const { image, mediaType = 'image/png', themeName = 'custom-theme' } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'image (base64) is required' });
    }

    // Strip data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    console.log(`[theme-generator] Analyzing uploaded image...`);
    const designDNA = await extractDesignDNA(base64Data, mediaType);

    console.log(`[theme-generator] Generating theme: ${themeName}`);
    const result = await generateTheme(designDNA, themeName, 'uploaded image');

    const confidence = scoreDNA(designDNA);

    res.json({
      success: true,
      ...result,
      confidence
    });
  } catch (err) {
    console.error('[theme-generator] from-image error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/theme-generator/themes
 * List all generated themes
 */
router.get('/themes', async (req, res) => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return res.json({ themes: [] });
    }

    const dirs = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const dnaPath = path.join(OUTPUT_DIR, d.name, 'design-dna.json');
        const pkgPath = path.join(OUTPUT_DIR, d.name, 'package.json');
        let designDNA = null;
        let pkg = null;
        if (fs.existsSync(dnaPath)) {
          try { designDNA = JSON.parse(fs.readFileSync(dnaPath, 'utf-8')); } catch {}
        }
        if (fs.existsSync(pkgPath)) {
          try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')); } catch {}
        }
        return {
          name: d.name,
          description: pkg?.description || null,
          brandColor: designDNA?.colors?.brandDefault || null,
          surfaceColor: designDNA?.colors?.surfaceCanvas || null,
          fontFamily: designDNA?.typography?.fontFamily || null
        };
      });

    res.json({ themes: dirs });
  } catch (err) {
    console.error('[theme-generator] themes list error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/theme-generator/themes/:name
 * Get a specific theme's details and files
 */
router.get('/themes/:name', async (req, res) => {
  try {
    const themeDir = path.join(OUTPUT_DIR, req.params.name);
    if (!fs.existsSync(themeDir)) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    const dnaPath = path.join(themeDir, 'design-dna.json');
    const cssPath = path.join(themeDir, 'src', 'styles', 'theme.css');

    const designDNA = fs.existsSync(dnaPath)
      ? JSON.parse(fs.readFileSync(dnaPath, 'utf-8'))
      : null;

    const css = fs.existsSync(cssPath)
      ? fs.readFileSync(cssPath, 'utf-8')
      : null;

    // Collect all files
    const files = {};
    function readDir(dir, prefix = '') {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          readDir(path.join(dir, entry.name), rel);
        } else {
          files[rel] = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
        }
      }
    }
    readDir(themeDir);

    res.json({
      name: req.params.name,
      designDNA,
      css,
      files
    });
  } catch (err) {
    console.error('[theme-generator] theme detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ELEMENTOR THEME ROUTES
// ============================================

/**
 * POST /api/theme-generator/elementor/from-url
 * Code-first pipeline: URL → DOM extraction ($0) → confidence check → AI fallback if needed
 * Returns Elementor JSON for all 10 pages
 */
router.post('/elementor/from-url', async (req, res) => {
  try {
    const { url, siteName, tagline, ctaText, ctaUrl, forceAI = false } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    const resolvedSiteName = siteName || new URL(url).hostname.replace(/^www\./, '').split('.')[0];
    let designDNA;
    let screenshotBase64;
    let extractionMethod = 'dom';

    if (!forceAI) {
      // Step 1: Try DOM extraction first ($0.00)
      console.log(`[theme-generator] DOM extraction for: ${url}`);
      try {
        const domResult = await extractFromDOM(url);
        designDNA = domResult.designDNA;
        screenshotBase64 = `data:image/png;base64,${domResult.screenshot.toString('base64')}`;
        extractionMethod = 'dom';

        // Step 2: Check confidence — fall back to AI if DOM extraction is weak
        if (!isDOMExtractionConfident(designDNA)) {
          console.log(`[theme-generator] DOM confidence low, falling back to Claude Vision...`);
          const base64Image = domResult.screenshot.toString('base64');
          designDNA = await extractDesignDNA(base64Image, 'image/png');
          extractionMethod = 'ai';
        } else {
          console.log(`[theme-generator] DOM extraction confident (scanned ${designDNA._meta?.elementsScanned} elements, ${designDNA._meta?.colorCandidates?.length} color candidates)`);
        }
      } catch (domErr) {
        console.log(`[theme-generator] DOM extraction failed: ${domErr.message}, falling back to AI...`);
        const screenshotBuffer = await screenshotUrl(url);
        const base64Image = screenshotBuffer.toString('base64');
        screenshotBase64 = `data:image/png;base64,${base64Image}`;
        designDNA = await extractDesignDNA(base64Image, 'image/png');
        extractionMethod = 'ai';
      }
    } else {
      // Force AI mode (user explicitly requested)
      console.log(`[theme-generator] Forced AI extraction for: ${url}`);
      const screenshotBuffer = await screenshotUrl(url);
      const base64Image = screenshotBuffer.toString('base64');
      screenshotBase64 = `data:image/png;base64,${base64Image}`;
      designDNA = await extractDesignDNA(base64Image, 'image/png');
      extractionMethod = 'ai';
    }

    // Clean up _meta before passing to generators (internal only)
    const cleanDNA = { ...designDNA };
    delete cleanDNA._meta;

    console.log(`[theme-generator] Generating Elementor pages (${extractionMethod} extraction)...`);
    const pages = generateElementorTheme(cleanDNA, { siteName: resolvedSiteName, tagline, ctaText, ctaUrl });

    const elementorPages = {};
    for (const [name, page] of Object.entries(pages)) {
      elementorPages[name] = {
        title: page.title,
        elementorData: toElementorData(page),
        raw: page
      };
    }

    const confidence = scoreDNA(cleanDNA);

    res.json({
      success: true,
      siteName: resolvedSiteName,
      designDNA: cleanDNA,
      screenshot: screenshotBase64,
      pages: elementorPages,
      pageCount: Object.keys(elementorPages).length,
      confidence,
      extractionMethod,
      costSaved: extractionMethod === 'dom' ? '$0.02' : '$0.00'
    });
  } catch (err) {
    console.error('[theme-generator] elementor/from-url error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/theme-generator/elementor/from-image
 * Same as above but from an uploaded image instead of URL
 */
router.post('/elementor/from-image', async (req, res) => {
  try {
    const { image, mediaType = 'image/png', siteName = 'Brand', tagline, ctaText, ctaUrl } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'image (base64) is required' });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    console.log(`[theme-generator] Elementor pipeline from uploaded image...`);
    const designDNA = await extractDesignDNA(base64Data, mediaType);

    console.log(`[theme-generator] Generating Elementor pages...`);
    const pages = generateElementorTheme(designDNA, { siteName, tagline, ctaText, ctaUrl });

    const elementorPages = {};
    for (const [name, page] of Object.entries(pages)) {
      elementorPages[name] = {
        title: page.title,
        elementorData: toElementorData(page),
        raw: page
      };
    }

    const confidence = scoreDNA(designDNA);

    res.json({
      success: true,
      siteName,
      designDNA,
      pages: elementorPages,
      pageCount: Object.keys(elementorPages).length,
      confidence
    });
  } catch (err) {
    console.error('[theme-generator] elementor/from-image error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/theme-generator/elementor/from-dna
 * Generate Elementor pages from existing design DNA (skip screenshot step)
 * Useful for regenerating with tweaked DNA or for the StyleSet customizer
 */
router.post('/elementor/from-dna', async (req, res) => {
  try {
    const { designDNA, siteName = 'Brand', tagline, ctaText, ctaUrl } = req.body;

    if (!designDNA) {
      return res.status(400).json({ error: 'designDNA is required' });
    }

    console.log(`[theme-generator] Generating Elementor pages from DNA...`);
    const pages = generateElementorTheme(designDNA, { siteName, tagline, ctaText, ctaUrl });

    const elementorPages = {};
    for (const [name, page] of Object.entries(pages)) {
      elementorPages[name] = {
        title: page.title,
        elementorData: toElementorData(page),
        raw: page
      };
    }

    const confidence = scoreDNA(designDNA);

    res.json({
      success: true,
      siteName,
      pages: elementorPages,
      pageCount: Object.keys(elementorPages).length,
      confidence
    });
  } catch (err) {
    console.error('[theme-generator] elementor/from-dna error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
