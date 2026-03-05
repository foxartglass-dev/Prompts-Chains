/**
 * Test: Finance Dashboard UI → Astro Theme
 *
 * Dark plum/purple with pink/rose accents, gradient credit card,
 * chart cards, transaction list, circular progress indicators
 */

import { fromMentor } from './index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const financeDNA = {
  colors: {
    // Pink/rose/magenta accent system
    brandLight: '#F9A8D4',        // soft pink
    brandDefault: '#EC4899',      // hot pink accent
    brandDark: '#DB2777',         // deep rose

    // Dark plum/aubergine backgrounds — NOT blue-black, distinctly purple
    surfaceCanvas: '#1A0A1E',     // deep plum page bg
    surfaceBase: '#251530',       // card backgrounds - dark purple
    surfaceMuted: '#2E1B3A',      // elevated surfaces

    surfaceDark: '#120812',

    textPrimary: '#F5F0F7',       // slightly warm white
    textSecondary: '#A78BBF',     // muted lavender
    textTertiary: '#7C5F94',      // deep lavender

    borderSubtle: '#3A2248',      // subtle purple borders
    borderDefault: '#4A2E5A'      // visible purple borders
  },
  typography: {
    fontFamily: 'Inter',
    display: { size: '32px', weight: '700' },
    h1: { size: '28px', weight: '700' },
    h2: { size: '22px', weight: '600' },
    h3: { size: '16px', weight: '600' },
    body: { size: '14px', weight: '400' },
    small: { size: '12px', weight: '400' },
    micro: { size: '10px', weight: '500' }
  },
  components: {
    cards: {
      background: '#251530',
      border: '1px solid #3A2248',
      radius: '16px',
      shadow: '0 4px 20px rgba(0,0,0,0.3)',
      padding: '20px'
    },
    buttons: {
      background: '#EC4899',
      textColor: '#FFFFFF',
      radius: '10px',
      padding: '10px 24px'
    },
    inputs: {
      background: '#2E1B3A',
      border: '1px solid #3A2248',
      radius: '10px'
    }
  },
  spacing: {
    baseUnit: '8px',
    density: 'compact',
    cardGaps: '16px',
    sectionGaps: '24px'
  },
  tailwindConfig: {
    theme: {
      extend: {
        colors: {
          brand: {
            light: '#F9A8D4',
            DEFAULT: '#EC4899',
            dark: '#DB2777'
          },
          surface: {
            canvas: '#1A0A1E',
            base: '#251530',
            muted: '#2E1B3A',
            dark: '#120812'
          },
          text: {
            primary: '#F5F0F7',
            secondary: '#A78BBF',
            tertiary: '#7C5F94',
            inverse: '#1A0A1E'
          },
          border: {
            subtle: '#3A2248',
            DEFAULT: '#4A2E5A'
          }
        },
        fontFamily: {
          sans: ['Inter', 'system-ui', 'sans-serif']
        },
        borderRadius: {
          card: '16px',
          input: '10px',
          btn: '10px'
        },
        boxShadow: {
          card: '0 4px 20px rgba(0,0,0,0.3)',
          hover: '0 8px 30px rgba(0,0,0,0.4)'
        }
      }
    }
  }
};

console.log('='.repeat(70));
console.log('FINANCE DASHBOARD → ASTRO THEME');
console.log('Dark plum, pink/rose accents, gradient cards, transaction list');
console.log('='.repeat(70));
console.log('');

const result = fromMentor(financeDNA, {
  packageName: 'finance-dashboard-theme',
  version: '1.0.0',
  description: 'Finance dashboard theme — dark plum with pink/rose accents'
});

console.log('=== DESIGN TOKENS ===');
console.log('Brand:   ', JSON.stringify(result.tokens.colors.brand));
console.log('Surface: ', JSON.stringify(result.tokens.colors.surface));
console.log('Text:    ', JSON.stringify(result.tokens.colors.text));
console.log('Radius:  ', JSON.stringify(result.tokens.borders.radius));
console.log('');

const outputDir = path.join(__dirname, 'output', 'finance-theme');
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
console.log(`\nTheme written to: ${outputDir}/`);
