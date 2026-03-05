/**
 * Test: Search Atlas SEO Tool → Astro Theme
 *
 * Dark SaaS theme with mint/cyan accents, purple gradients,
 * pricing tables, stats cards, testimonials
 */

import { fromMentor } from './index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const searchAtlasDNA = {
  colors: {
    // Bright mint/cyan is the dominant accent
    brandLight: '#5EEAD4',        // lighter teal for hover
    brandDefault: '#2DD4BF',      // mint/cyan primary accent
    brandDark: '#14B8A6',         // deeper teal

    // Very dark backgrounds — near black with slight blue undertone
    surfaceCanvas: '#0B0B1A',     // deep dark blue-black page bg
    surfaceBase: '#12122A',       // card/section backgrounds (dark purple-black)
    surfaceMuted: '#1A1A3E',      // elevated surfaces, slightly purple

    surfaceDark: '#060612',       // deepest black sections

    textPrimary: '#F8FAFC',       // bright white headlines
    textSecondary: '#94A3B8',     // grey body text
    textTertiary: '#64748B',      // muted captions

    borderSubtle: '#1E1E3F',      // dark purple-tinted borders
    borderDefault: '#2A2A5A'      // slightly visible purple borders
  },
  typography: {
    fontFamily: 'Inter',
    display: { size: '48px', weight: '700' },   // "Scale Your Marketing"
    h1: { size: '36px', weight: '700' },         // section headers
    h2: { size: '28px', weight: '600' },         // "Real Results. Real Fast."
    h3: { size: '18px', weight: '600' },         // card/feature titles
    body: { size: '16px', weight: '400' },
    small: { size: '14px', weight: '400' },
    micro: { size: '12px', weight: '500' }
  },
  components: {
    cards: {
      background: '#12122A',
      border: '1px solid #1E1E3F',
      radius: '16px',               // noticeably rounded cards
      shadow: '0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(45,212,191,0.05)',
      padding: '24px'
    },
    buttons: {
      background: '#2DD4BF',        // mint green primary
      textColor: '#0B0B1A',         // dark text on mint
      radius: '8px',
      padding: '12px 28px',
      hoverBackground: '#5EEAD4'
    },
    inputs: {
      background: '#1A1A3E',
      border: '1px solid #2A2A5A',
      radius: '8px'
    },
    icons: {
      style: 'Filled/solid, colorful',
      caps: 'Rounded'
    }
  },
  spacing: {
    baseUnit: '8px',
    density: 'cozy',
    cardGaps: '24px',
    sectionGaps: '80px'
  },
  tailwindConfig: {
    theme: {
      extend: {
        colors: {
          brand: {
            light: '#5EEAD4',
            DEFAULT: '#2DD4BF',
            dark: '#14B8A6'
          },
          surface: {
            canvas: '#0B0B1A',
            base: '#12122A',
            muted: '#1A1A3E',
            dark: '#060612'
          },
          text: {
            primary: '#F8FAFC',
            secondary: '#94A3B8',
            tertiary: '#64748B',
            inverse: '#0B0B1A'
          },
          border: {
            subtle: '#1E1E3F',
            DEFAULT: '#2A2A5A'
          }
        },
        fontFamily: {
          sans: ['Inter', 'system-ui', 'sans-serif']
        },
        borderRadius: {
          card: '16px',
          input: '8px',
          btn: '8px'
        },
        boxShadow: {
          card: '0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(45,212,191,0.05)',
          glow: '0 0 20px rgba(45, 212, 191, 0.15)',
          hover: '0 0 30px rgba(45, 212, 191, 0.25)'
        }
      }
    }
  }
};

console.log('='.repeat(70));
console.log('SEARCH ATLAS / DARK SEO SaaS → ASTRO THEME');
console.log('Dark mode, mint/cyan accents, purple-tinted dark surfaces');
console.log('='.repeat(70));
console.log('');

const result = fromMentor(searchAtlasDNA, {
  packageName: 'searchatlas-dark-theme',
  version: '1.0.0',
  description: 'Dark SEO SaaS theme — extracted from Search Atlas screenshot'
});

console.log('=== DESIGN TOKENS ===');
console.log('Brand:   ', JSON.stringify(result.tokens.colors.brand));
console.log('Surface: ', JSON.stringify(result.tokens.colors.surface));
console.log('Text:    ', JSON.stringify(result.tokens.colors.text));
console.log('Font:    ', result.tokens.typography.fontFamily.sans);
console.log('Radius:  ', JSON.stringify(result.tokens.borders.radius));
console.log('Shadow:  ', result.tokens.shadows.DEFAULT);
console.log('');

// Write to disk
const outputDir = path.join(__dirname, 'output', 'searchatlas-theme');
for (const [filepath, content] of Object.entries(result.package.files)) {
  const fullPath = path.join(outputDir, filepath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

console.log('=== PACKAGE MANIFEST ===');
let totalBytes = 0;
for (const [filepath, content] of Object.entries(result.package.files)) {
  totalBytes += content.length;
  console.log(`  ${filepath.padEnd(40)} ${String(content.length).padStart(5)} bytes`);
}
console.log(`  ${'TOTAL'.padEnd(40)} ${String(totalBytes).padStart(5)} bytes`);
console.log('');
console.log(`Theme written to: ${outputDir}/`);
