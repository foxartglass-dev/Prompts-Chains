/**
 * Test: Lumberjack Barberhouse → Astro Theme
 *
 * Dark masculine, bold red accents, rugged typography,
 * full-bleed hero imagery, barbershop/lifestyle aesthetic
 */

import { fromMentor } from './index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const barbershopDNA = {
  colors: {
    // Bold red is the only accent — everything else is dark/neutral
    brandLight: '#F87171',
    brandDefault: '#DC2626',      // strong red
    brandDark: '#B91C1C',

    // Very dark, warm blacks — cinematic feel
    surfaceCanvas: '#0F0F0F',
    surfaceBase: '#1A1A1A',
    surfaceMuted: '#252525',

    surfaceDark: '#000000',

    textPrimary: '#FAFAFA',       // clean white
    textSecondary: '#A3A3A3',     // neutral grey
    textTertiary: '#737373',      // muted

    borderSubtle: '#2A2A2A',
    borderDefault: '#3A3A3A'
  },
  typography: {
    fontFamily: 'Oswald',          // condensed, bold, masculine
    display: { size: '56px', weight: '700' },
    h1: { size: '40px', weight: '700' },
    h2: { size: '28px', weight: '600' },
    h3: { size: '18px', weight: '600' },
    body: { size: '16px', weight: '400' },
    small: { size: '14px', weight: '400' },
    micro: { size: '12px', weight: '500' }
  },
  components: {
    cards: {
      background: '#1A1A1A',
      border: '1px solid #2A2A2A',
      radius: '4px',               // sharp, minimal rounding — masculine
      shadow: '0 4px 20px rgba(0,0,0,0.4)',
      padding: '24px'
    },
    buttons: {
      background: '#DC2626',
      textColor: '#FFFFFF',
      radius: '2px',               // nearly square — bold
      padding: '14px 32px'
    },
    inputs: {
      background: '#1A1A1A',
      border: '1px solid #3A3A3A',
      radius: '2px'
    }
  },
  spacing: {
    baseUnit: '8px',
    density: 'cozy',
    cardGaps: '24px',
    sectionGaps: '64px'
  },
  tailwindConfig: {
    theme: {
      extend: {
        colors: {
          brand: { light: '#F87171', DEFAULT: '#DC2626', dark: '#B91C1C' },
          surface: { canvas: '#0F0F0F', base: '#1A1A1A', muted: '#252525', dark: '#000000' },
          text: { primary: '#FAFAFA', secondary: '#A3A3A3', tertiary: '#737373' },
          border: { subtle: '#2A2A2A', DEFAULT: '#3A3A3A' }
        },
        fontFamily: { sans: ['Oswald', 'system-ui', 'sans-serif'] },
        borderRadius: { card: '4px', input: '2px', btn: '2px' },
        boxShadow: { card: '0 4px 20px rgba(0,0,0,0.4)', hover: '0 8px 30px rgba(0,0,0,0.5)' }
      }
    }
  }
};

const result = fromMentor(barbershopDNA, {
  packageName: 'lumberjack-theme',
  version: '1.0.0',
  description: 'Barbershop theme — dark masculine, bold red accents'
});

const outputDir = path.join(__dirname, 'output', 'barbershop-theme');
for (const [filepath, content] of Object.entries(result.package.files)) {
  const fullPath = path.join(outputDir, filepath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

console.log('Brand:   ', JSON.stringify(result.tokens.colors.brand));
console.log('Surface: ', JSON.stringify(result.tokens.colors.surface));
console.log('Font:    ', result.tokens.typography.fontFamily.sans);
console.log('Radius:  ', JSON.stringify(result.tokens.borders.radius));
console.log(`Theme written to: ${outputDir}/`);
