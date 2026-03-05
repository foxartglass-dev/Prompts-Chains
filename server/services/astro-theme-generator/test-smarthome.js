/**
 * Test: Smart Home Dashboard UI → Astro Theme
 *
 * Dark glassmorphism, warm amber/orange accents, rounded cards,
 * frosted glass panels, IoT dashboard aesthetic
 */

import { fromMentor } from './index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const smartHomeDNA = {
  colors: {
    // Warm amber/cyan dual accent system
    brandLight: '#67E8F9',        // cyan/teal toggle indicators
    brandDefault: '#F59E0B',      // warm amber - primary accent
    brandDark: '#D97706',         // deeper amber

    // Very dark with warm undertone — rich blacks, not blue-black
    surfaceCanvas: '#0C0A09',     // warm near-black background
    surfaceBase: 'rgba(255,255,255,0.08)',  // glassmorphism card bg
    surfaceMuted: 'rgba(255,255,255,0.05)', // subtle elevated surfaces

    surfaceDark: '#000000',

    textPrimary: '#FAFAF9',       // warm white
    textSecondary: '#A8A29E',     // warm grey
    textTertiary: '#78716C',      // muted warm grey

    borderSubtle: 'rgba(255,255,255,0.08)',  // glass borders
    borderDefault: 'rgba(255,255,255,0.12)'  // slightly visible
  },
  typography: {
    fontFamily: 'Inter',
    display: { size: '32px', weight: '700' },
    h1: { size: '24px', weight: '600' },
    h2: { size: '20px', weight: '600' },
    h3: { size: '16px', weight: '600' },
    body: { size: '14px', weight: '400' },
    small: { size: '12px', weight: '400' },
    micro: { size: '10px', weight: '500' }
  },
  components: {
    cards: {
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.1)',
      radius: '20px',                // very rounded — dashboard style
      shadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      padding: '20px'
    },
    buttons: {
      background: '#F59E0B',
      textColor: '#0C0A09',
      radius: '12px',
      padding: '10px 24px',
      hoverBackground: '#FBBF24'
    },
    inputs: {
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      radius: '12px'
    },
    icons: {
      style: 'Filled/solid, rounded',
      caps: 'Rounded'
    }
  },
  spacing: {
    baseUnit: '8px',
    density: 'compact',         // dashboard = compact density
    cardGaps: '16px',
    sectionGaps: '24px'
  },
  tailwindConfig: {
    theme: {
      extend: {
        colors: {
          brand: {
            light: '#FBBF24',
            DEFAULT: '#F59E0B',
            dark: '#D97706'
          },
          surface: {
            canvas: '#0C0A09',
            base: 'rgba(255,255,255,0.08)',
            muted: 'rgba(255,255,255,0.05)',
            dark: '#000000'
          },
          text: {
            primary: '#FAFAF9',
            secondary: '#A8A29E',
            tertiary: '#78716C',
            inverse: '#0C0A09'
          },
          border: {
            subtle: 'rgba(255,255,255,0.08)',
            DEFAULT: 'rgba(255,255,255,0.12)'
          }
        },
        fontFamily: {
          sans: ['Inter', 'system-ui', 'sans-serif']
        },
        borderRadius: {
          card: '20px',
          input: '12px',
          btn: '12px'
        },
        boxShadow: {
          card: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
          glow: '0 0 20px rgba(245, 158, 11, 0.15)',
          hover: '0 12px 40px rgba(0,0,0,0.5)'
        }
      }
    }
  }
};

console.log('='.repeat(70));
console.log('SMART HOME DASHBOARD → ASTRO THEME');
console.log('Dark glass, warm amber accents, rounded cards, IoT dashboard');
console.log('='.repeat(70));
console.log('');

const result = fromMentor(smartHomeDNA, {
  packageName: 'smarthome-glass-theme',
  version: '1.0.0',
  description: 'Smart home dashboard theme — dark glassmorphism with warm amber accents'
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
const outputDir = path.join(__dirname, 'output', 'smarthome-theme');
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
