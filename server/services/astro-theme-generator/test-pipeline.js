/**
 * Test: Mentor Prompt Output → Astro Theme Pipeline
 *
 * Uses the example output from the mentor's Style Guide Generator prompt
 * to verify the full pipeline works end-to-end.
 */

import { fromMentor, fromStyleSet, exportCSS } from './index.js';

// ============================================================
// TEST 1: Mentor's example output (from the prompt itself)
// This simulates what you'd get back from ChatGPT/Claude/Gemini
// after feeding it a screenshot + the mentor's prompt
// ============================================================

const mentorExampleOutput = {
  colors: {
    brandLight: '#E7FBC3',
    brandDefault: '#DFFF5E',
    brandDark: '#B8D940',
    surfaceCanvas: '#F9FAFB',
    surfaceBase: '#FFFFFF',
    surfaceMuted: '#F3F4F6',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    borderSubtle: '#E5E7EB'
  },
  typography: {
    fontFamily: 'Inter',
    display: { size: '30px', weight: '700' },
    h1: { size: '24px', weight: '600' },
    h2: { size: '18px', weight: '600' },
    h3: { size: '16px', weight: '600' },
    body: { size: '14px', weight: '400' },
    small: { size: '13px', weight: '400' },
    micro: { size: '12px', weight: '400' }
  },
  components: {
    cards: {
      background: 'White',
      border: '1px solid #E5E7EB',
      radius: '12px',
      shadow: '0 1px 3px rgba(0,0,0,0.05)',
      padding: '20-24px'
    },
    buttons: {
      background: 'Brand gradient or solid',
      textColor: 'Dark for contrast',
      radius: '8px',
      padding: '12px 24px'
    },
    inputs: {
      background: '#F3F4F6',
      border: 'None',
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
    cardGaps: '16-24px',
    sectionGaps: '32px'
  },
  tailwindConfig: {
    theme: {
      extend: {
        colors: {
          brand: {
            light: '#E7FBC3',
            DEFAULT: '#DFFF5E',
            dark: '#B8D940'
          },
          surface: {
            canvas: '#F9FAFB',
            base: '#FFFFFF',
            muted: '#F3F4F6'
          },
          text: {
            primary: '#111827',
            secondary: '#6B7280',
            tertiary: '#9CA3AF'
          },
          border: {
            subtle: '#E5E7EB'
          }
        },
        fontFamily: {
          sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
        },
        borderRadius: {
          card: '12px',
          input: '8px',
          btn: '8px'
        },
        boxShadow: {
          card: '0 1px 3px rgba(0,0,0,0.05)'
        }
      }
    }
  }
};

console.log('='.repeat(60));
console.log('TEST 1: Mentor Prompt Output → Astro Theme');
console.log('='.repeat(60));
console.log('');

const mentorResult = fromMentor(mentorExampleOutput, {
  packageName: 'lime-dashboard-theme',
  version: '1.0.0'
});

console.log('--- TOKENS (excerpt) ---');
console.log('Brand colors:', mentorResult.tokens.colors.brand);
console.log('Surface:', mentorResult.tokens.colors.surface);
console.log('Text:', mentorResult.tokens.colors.text);
console.log('Font:', mentorResult.tokens.typography.fontFamily.sans);
console.log('Radius:', mentorResult.tokens.borders.radius);
console.log('Shadow:', mentorResult.tokens.shadows.DEFAULT);
console.log('');

console.log('--- CSS OUTPUT (first 50 lines) ---');
const cssLines = mentorResult.css.split('\n');
console.log(cssLines.slice(0, 50).join('\n'));
console.log(`... (${cssLines.length} total lines)`);
console.log('');

console.log('--- PACKAGE FILES ---');
for (const [filepath, content] of Object.entries(mentorResult.package.files)) {
  const lines = content.split('\n').length;
  const bytes = content.length;
  console.log(`  ${filepath} (${lines} lines, ${bytes} bytes)`);
}
console.log('');

// ============================================================
// TEST 2: Style Set Config → Astro Theme
// Simulates what happens when user picks styles in the renderer
// ============================================================

console.log('='.repeat(60));
console.log('TEST 2: Style Set Config → Astro Theme');
console.log('='.repeat(60));
console.log('');

const styleSetResult = fromStyleSet({
  style: 'neomorphism',
  palette: 'midnight-office',
  font: 'Space Grotesk',
  highContrast: false,
  themeName: 'neo-midnight'
});

console.log('--- TOKENS (excerpt) ---');
console.log('Style:', styleSetResult.tokens.meta.style);
console.log('Brand colors:', styleSetResult.tokens.colors.brand);
console.log('Surface:', styleSetResult.tokens.colors.surface);
console.log('Font:', styleSetResult.tokens.typography.fontFamily.sans);
console.log('Shadow:', styleSetResult.tokens.shadows.DEFAULT);
console.log('');

console.log('--- CSS OUTPUT (first 40 lines) ---');
const css2Lines = styleSetResult.css.split('\n');
console.log(css2Lines.slice(0, 40).join('\n'));
console.log(`... (${css2Lines.length} total lines)`);
console.log('');

console.log('--- PACKAGE FILES ---');
for (const [filepath, content] of Object.entries(styleSetResult.package.files)) {
  const lines = content.split('\n').length;
  console.log(`  ${filepath} (${lines} lines)`);
}
console.log('');

// ============================================================
// TEST 3: Quick CSS Export (just the stylesheet, no package)
// ============================================================

console.log('='.repeat(60));
console.log('TEST 3: Quick CSS Export - Glassmorphism + Electric Coral');
console.log('='.repeat(60));
console.log('');

const quickCSS = exportCSS({
  style: 'glassmorphism',
  palette: 'electric-coral',
  font: 'DM Sans',
  themeName: 'glass-coral'
});

const quickLines = quickCSS.split('\n');
console.log(quickLines.slice(0, 35).join('\n'));
console.log(`... (${quickLines.length} total lines)`);
console.log('');

// ============================================================
// TEST 4: Mixed styles (accent)
// ============================================================

console.log('='.repeat(60));
console.log('TEST 4: Mixed Styles - Brutalism base + Neubrutalism accent');
console.log('='.repeat(60));
console.log('');

const mixedResult = fromStyleSet({
  style: 'brutalism',
  accentStyle: 'neubrutalism',
  palette: 'sunset-glow',
  font: 'Montserrat',
  themeName: 'brutal-sunset'
});

console.log('Style:', mixedResult.tokens.meta.style);
console.log('Brand:', mixedResult.tokens.colors.brand);
console.log('Radius:', mixedResult.tokens.borders.radius);
console.log('Shadow:', mixedResult.tokens.shadows.DEFAULT);
console.log('');

console.log('--- Integration entry (src/index.js) ---');
const integrationContent = mixedResult.package.files['src/index.js'];
console.log(integrationContent.slice(0, 600));
console.log('...');
console.log('');

console.log('='.repeat(60));
console.log('ALL TESTS COMPLETE');
console.log('='.repeat(60));
