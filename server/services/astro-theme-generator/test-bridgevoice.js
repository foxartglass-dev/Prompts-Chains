/**
 * Test: BridgeVoice/Dark Agentic Dev Tool → Astro Theme
 *
 * Extracted from visual analysis of the BridgeVoice screenshot:
 * Dark mode, neon accents, terminal-inspired, dev tool aesthetic
 */

import { fromMentor } from './index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bridgeVoiceDNA = {
  colors: {
    // Neon green/cyan is the primary accent
    brandLight: '#4ADE80',        // lighter green for hover states
    brandDefault: '#22C55E',      // primary neon green accent
    brandDark: '#16A34A',         // deeper green

    // Very dark backgrounds throughout
    surfaceCanvas: '#050505',     // near-black page background
    surfaceBase: '#0D0D0D',      // card/section backgrounds
    surfaceMuted: '#171717',      // subtle elevated surfaces

    surfaceDark: '#000000',       // pure black sections

    textPrimary: '#F9FAFB',      // white/near-white headlines
    textSecondary: '#9CA3AF',    // grey body text
    textTertiary: '#6B7280',     // muted captions

    borderSubtle: '#1F1F1F',     // very subtle dark borders
    borderDefault: '#2A2A2A'     // slightly visible borders
  },
  typography: {
    fontFamily: 'Inter',
    display: { size: '56px', weight: '700' },   // "Ship Software at the Speed of Thought"
    h1: { size: '40px', weight: '700' },         // section headers
    h2: { size: '28px', weight: '600' },         // "Vibe coding from the terminal"
    h3: { size: '18px', weight: '600' },         // card titles
    body: { size: '16px', weight: '400' },        // body text
    small: { size: '14px', weight: '400' },       // labels, stats
    micro: { size: '12px', weight: '500' }        // badges, tags
  },
  components: {
    cards: {
      background: '#0D0D0D',
      border: '1px solid #1F1F1F',
      radius: '12px',
      shadow: '0 0 0 1px rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.4)',
      padding: '24px'
    },
    buttons: {
      background: '#22C55E',      // neon green primary
      textColor: '#050505',       // dark text on green
      radius: '8px',
      padding: '12px 28px',
      hoverBackground: '#4ADE80'
    },
    inputs: {
      background: '#171717',
      border: '1px solid #2A2A2A',
      radius: '8px'
    },
    icons: {
      style: 'Line/stroke, minimal',
      caps: 'Rounded'
    }
  },
  spacing: {
    baseUnit: '8px',
    density: 'cozy',
    cardGaps: '24px',
    sectionGaps: '80px'           // large section gaps, spacious dark layout
  },
  tailwindConfig: {
    theme: {
      extend: {
        colors: {
          brand: {
            light: '#4ADE80',
            DEFAULT: '#22C55E',
            dark: '#16A34A'
          },
          surface: {
            canvas: '#050505',
            base: '#0D0D0D',
            muted: '#171717',
            dark: '#000000'
          },
          text: {
            primary: '#F9FAFB',
            secondary: '#9CA3AF',
            tertiary: '#6B7280',
            inverse: '#050505'
          },
          border: {
            subtle: '#1F1F1F',
            DEFAULT: '#2A2A2A'
          }
        },
        fontFamily: {
          sans: ['Inter', 'system-ui', 'sans-serif']
        },
        borderRadius: {
          card: '12px',
          input: '8px',
          btn: '8px'
        },
        boxShadow: {
          card: '0 0 0 1px rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.4)',
          glow: '0 0 20px rgba(34, 197, 94, 0.15)',
          hover: '0 0 30px rgba(34, 197, 94, 0.25)'
        }
      }
    }
  }
};

console.log('='.repeat(70));
console.log('BRIDGEVOICE / DARK AGENTIC THEME → ASTRO THEME');
console.log('Dark mode, neon green accents, terminal-inspired dev tool');
console.log('='.repeat(70));
console.log('');

const result = fromMentor(bridgeVoiceDNA, {
  packageName: 'bridgevoice-dark-theme',
  version: '1.0.0',
  description: 'Dark agentic dev tool theme — extracted from BridgeVoice screenshot'
});

// Show tokens
console.log('=== DESIGN TOKENS ===');
console.log('');
console.log('Brand:   ', JSON.stringify(result.tokens.colors.brand));
console.log('Surface: ', JSON.stringify(result.tokens.colors.surface));
console.log('Text:    ', JSON.stringify(result.tokens.colors.text));
console.log('Border:  ', JSON.stringify(result.tokens.colors.border));
console.log('Font:    ', result.tokens.typography.fontFamily.sans);
console.log('Radius:  ', JSON.stringify(result.tokens.borders.radius));
console.log('Shadow:  ', result.tokens.shadows.DEFAULT);
console.log('');

// Full CSS
console.log('=== FULL CSS STYLESHEET ===');
console.log('');
console.log(result.css);
console.log('');

// Write to disk
const outputDir = path.join(__dirname, 'output', 'bridgevoice-theme');
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
