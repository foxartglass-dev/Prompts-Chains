/**
 * Test: Elementor.com SCREENSHOT → Astro Theme
 *
 * This version uses the actual visual analysis from the screenshot,
 * not just the scraped CSS. The screenshot reveals design details
 * that CSS extraction misses (gradients, visual hierarchy, density).
 */

import { fromMentor } from './index.js';
import { generateCSS } from './tokens-to-css.js';
import { generateTailwindPreset } from './tokens-to-tailwind.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Extracted from VISUAL analysis of the Elementor.com screenshot
const elementorScreenshotDNA = {
  colors: {
    // The hero gradient runs hot pink to magenta
    brandLight: '#F9A8D4',       // soft pink (gradient start area)
    brandDefault: '#EC4899',     // hot pink (dominant brand color)
    brandDark: '#BE185D',        // deep magenta

    surfaceCanvas: '#FFFFFF',    // main background - pure white
    surfaceBase: '#FFFFFF',      // cards - white
    surfaceMuted: '#F9FAFB',     // subtle grey sections

    // Dark section (bottom of page)
    surfaceDark: '#0A0A0A',      // near-black dark section

    textPrimary: '#000000',      // pure black headlines
    textSecondary: '#4B5563',    // grey body text
    textTertiary: '#9CA3AF',     // muted captions/labels

    borderSubtle: '#E5E7EB',     // very light card borders
    borderDefault: '#D1D5DB'
  },
  typography: {
    fontFamily: 'Roobert',
    // From the screenshot, the display text is HUGE and bold
    display: { size: '56px', weight: '700' },  // "The most powerful website builder? You."
    h1: { size: '40px', weight: '600' },        // section headers
    h2: { size: '28px', weight: '600' },        // "Create. Optimize. Manage."
    h3: { size: '18px', weight: '600' },        // card titles
    body: { size: '16px', weight: '400' },       // body text
    small: { size: '14px', weight: '400' },      // labels, stats
    micro: { size: '12px', weight: '500' }       // badges, tags
  },
  components: {
    cards: {
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      radius: '12px',              // slightly more rounded than scrape suggested
      shadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
      padding: '24px'
    },
    buttons: {
      background: '#000000',       // primary buttons are BLACK, not pink
      textColor: '#FFFFFF',
      radius: '8px',
      padding: '12px 28px',
      hoverBackground: '#EC4899'   // hover turns pink
    },
    inputs: {
      background: '#F3F4F6',
      border: '1px solid #E5E7EB',
      radius: '8px'
    },
    icons: {
      style: 'Solid/filled, minimal',
      caps: 'Rounded'
    }
  },
  spacing: {
    baseUnit: '8px',
    density: 'cozy',              // generous whitespace throughout
    cardGaps: '24px',
    sectionGaps: '64px'           // large gaps between page sections
  },
  tailwindConfig: {
    theme: {
      extend: {
        colors: {
          brand: {
            light: '#F9A8D4',
            DEFAULT: '#EC4899',
            dark: '#BE185D'
          },
          surface: {
            canvas: '#FFFFFF',
            base: '#FFFFFF',
            muted: '#F9FAFB',
            dark: '#0A0A0A'
          },
          text: {
            primary: '#000000',
            secondary: '#4B5563',
            tertiary: '#9CA3AF',
            inverse: '#FFFFFF'
          },
          border: {
            subtle: '#E5E7EB',
            DEFAULT: '#D1D5DB'
          }
        },
        fontFamily: {
          sans: ['Roobert', 'system-ui', 'sans-serif']
        },
        borderRadius: {
          card: '12px',
          input: '8px',
          btn: '8px'
        },
        boxShadow: {
          card: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
          hover: '0 4px 16px rgba(0,0,0,0.08)'
        }
      }
    }
  }
};

console.log('='.repeat(70));
console.log('ELEMENTOR.COM (FROM SCREENSHOT) → ASTRO THEME');
console.log('Visual analysis catches what CSS scraping misses');
console.log('='.repeat(70));
console.log('');

const result = fromMentor(elementorScreenshotDNA, {
  packageName: 'elementor-visual-theme',
  version: '1.0.0',
  description: 'Elementor.com design — extracted from visual screenshot analysis'
});

// Show tokens
console.log('=== DESIGN TOKENS ===');
console.log('');
console.log('Brand:   ', JSON.stringify(result.tokens.colors.brand));
console.log('Surface: ', JSON.stringify(result.tokens.colors.surface));
console.log('Text:    ', JSON.stringify(result.tokens.colors.text));
console.log('Border:  ', JSON.stringify(result.tokens.colors.border));
console.log('Font:    ', result.tokens.typography.fontFamily.sans);
console.log('Sizes:   ', JSON.stringify(result.tokens.typography.fontSize));
console.log('Weights: ', JSON.stringify(result.tokens.typography.fontWeight));
console.log('Radius:  ', JSON.stringify(result.tokens.borders.radius));
console.log('Shadow:  ', result.tokens.shadows.DEFAULT);
console.log('Spacing: ', result.tokens.spacing.base, '(base unit)');
console.log('');

// Full CSS
console.log('=== FULL CSS STYLESHEET ===');
console.log('');
console.log(result.css);
console.log('');

// Show package manifest
console.log('=== PACKAGE MANIFEST ===');
let totalBytes = 0;
for (const [filepath, content] of Object.entries(result.package.files)) {
  totalBytes += content.length;
  console.log(`  ${filepath.padEnd(40)} ${String(content.length).padStart(5)} bytes`);
}
console.log(`  ${'TOTAL'.padEnd(40)} ${String(totalBytes).padStart(5)} bytes`);
console.log('');

// Write the CSS to a file so user can inspect it
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Write each package file to disk
for (const [filepath, content] of Object.entries(result.package.files)) {
  const fullPath = path.join(outputDir, 'elementor-theme', filepath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

console.log(`Theme package written to: ${path.join(outputDir, 'elementor-theme')}/`);
console.log('');

// List what was written
const listFiles = (dir, prefix = '') => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      console.log(`  ${prefix}${entry.name}/`);
      listFiles(path.join(dir, entry.name), prefix + '  ');
    } else {
      const size = fs.statSync(path.join(dir, entry.name)).size;
      console.log(`  ${prefix}${entry.name} (${size} bytes)`);
    }
  }
};

console.log('Generated file tree:');
listFiles(path.join(outputDir, 'elementor-theme'));
console.log('');
console.log('Done. This theme package is ready to npm publish or install locally.');
