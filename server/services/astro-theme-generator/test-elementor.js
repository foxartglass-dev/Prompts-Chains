/**
 * Test: Elementor.com → Astro Theme
 *
 * Feeding Elementor's actual design system through the mentor pipeline
 * to generate a complete Astro theme package.
 */

import { fromMentor } from './index.js';

// Elementor.com's extracted design DNA (as if mentor's prompt returned this)
const elementorDesignDNA = {
  colors: {
    brandLight: '#FAE4FA',
    brandDefault: '#ED01EE',
    brandDark: '#C000C1',
    surfaceCanvas: '#FFFFFF',
    surfaceBase: '#FFFFFF',
    surfaceMuted: '#F5F5F5',
    textPrimary: '#000000',
    textSecondary: '#484848',
    textTertiary: '#A6A6A6',
    borderSubtle: '#D1D1D1',
    borderDefault: '#D1D1D1'
  },
  typography: {
    fontFamily: 'Roobert',
    display: { size: '48px', weight: '600' },
    h1: { size: '36px', weight: '500' },
    h2: { size: '24px', weight: '600' },
    h3: { size: '18px', weight: '600' },
    body: { size: '16px', weight: '400' },
    small: { size: '14px', weight: '400' },
    micro: { size: '12px', weight: '400' }
  },
  components: {
    cards: {
      background: '#FFFFFF',
      border: '1px solid #D1D1D1',
      radius: '8px',
      shadow: '0 0 15px 3px rgba(0,0,0,0.05)',
      padding: '24px'
    },
    buttons: {
      background: '#000000',
      textColor: '#FFFFFF',
      radius: '8px',
      padding: '0 24px',
      height: '48px',
      hoverBackground: '#ED01EE'
    },
    inputs: {
      background: '#F5F5F5',
      border: '1px solid #D1D1D1',
      radius: '8px'
    },
    icons: {
      style: 'Line/stroke, 1.5px',
      caps: 'Rounded'
    }
  },
  spacing: {
    baseUnit: '8px',
    density: 'cozy',
    cardGaps: '24px',
    sectionGaps: '48px'
  },
  tailwindConfig: {
    theme: {
      extend: {
        colors: {
          brand: {
            light: '#FAE4FA',
            DEFAULT: '#ED01EE',
            dark: '#C000C1'
          },
          surface: {
            canvas: '#FFFFFF',
            base: '#FFFFFF',
            muted: '#F5F5F5'
          },
          text: {
            primary: '#000000',
            secondary: '#484848',
            tertiary: '#A6A6A6'
          },
          border: {
            subtle: '#D1D1D1',
            DEFAULT: '#D1D1D1'
          }
        },
        fontFamily: {
          sans: ['Roobert', 'system-ui', 'sans-serif']
        },
        borderRadius: {
          card: '8px',
          input: '8px',
          btn: '8px'
        },
        boxShadow: {
          card: '0 0 15px 3px rgba(0,0,0,0.05)'
        }
      }
    }
  }
};

console.log('='.repeat(60));
console.log('ELEMENTOR.COM → ASTRO THEME');
console.log('='.repeat(60));
console.log('');

const result = fromMentor(elementorDesignDNA, {
  packageName: 'elementor-style-theme',
  version: '1.0.0',
  description: 'Elementor.com design system as an Astro theme'
});

// Show the full CSS
console.log('========== FULL CSS STYLESHEET ==========');
console.log(result.css);
console.log('');

// Show the Tailwind preset
console.log('========== TAILWIND PRESET ==========');
console.log(result.tailwindPreset);
console.log('');

// Show the integration entry
console.log('========== ASTRO INTEGRATION (src/index.js) ==========');
console.log(result.package.files['src/index.js']);
console.log('');

// Show package.json
console.log('========== package.json ==========');
console.log(result.package.files['package.json']);
console.log('');

// Show a component
console.log('========== Card.astro Component ==========');
console.log(result.package.files['src/components/Card.astro']);
console.log('');

console.log('========== Button.astro Component ==========');
console.log(result.package.files['src/components/Button.astro']);
console.log('');

// File manifest
console.log('========== COMPLETE PACKAGE MANIFEST ==========');
let totalBytes = 0;
for (const [filepath, content] of Object.entries(result.package.files)) {
  const lines = content.split('\n').length;
  const bytes = content.length;
  totalBytes += bytes;
  console.log(`  ${filepath.padEnd(40)} ${String(lines).padStart(4)} lines  ${String(bytes).padStart(6)} bytes`);
}
console.log(`  ${''.padEnd(40)} ${''.padStart(4)}        ${String(totalBytes).padStart(6)} TOTAL`);
console.log('');
console.log('Done. This is a complete, installable Astro theme package.');
