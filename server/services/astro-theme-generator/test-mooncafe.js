import { fromMentor } from './index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mooncafeDNA = {
  colors: {
    brandLight: '#FDE047',
    brandDefault: '#EAB308',      // electric yellow/gold
    brandDark: '#CA8A04',
    surfaceCanvas: '#0A0A14',     // very dark navy-black
    surfaceBase: '#111122',       // slightly lighter dark
    surfaceMuted: '#1A1A2E',
    surfaceDark: '#000000',
    textPrimary: '#FAFAFA',
    textSecondary: '#A1A1AA',
    textTertiary: '#71717A',
    borderSubtle: '#1E1E30',
    borderDefault: '#2A2A40'
  },
  typography: {
    fontFamily: 'Playfair Display',  // elegant serif for restaurant
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
      background: '#111122',
      border: '1px solid #1E1E30',
      radius: '8px',
      shadow: '0 4px 20px rgba(0,0,0,0.3)',
      padding: '24px'
    },
    buttons: {
      background: 'transparent',
      textColor: '#FAFAFA',
      radius: '4px',
      padding: '14px 32px'
    },
    inputs: {
      background: '#1A1A2E',
      border: '1px solid #2A2A40',
      radius: '4px'
    }
  },
  spacing: { baseUnit: '8px', density: 'cozy', cardGaps: '24px', sectionGaps: '64px' },
  tailwindConfig: {
    theme: {
      extend: {
        colors: {
          brand: { light: '#FDE047', DEFAULT: '#EAB308', dark: '#CA8A04' },
          surface: { canvas: '#0A0A14', base: '#111122', muted: '#1A1A2E', dark: '#000000' },
          text: { primary: '#FAFAFA', secondary: '#A1A1AA', tertiary: '#71717A' },
          border: { subtle: '#1E1E30', DEFAULT: '#2A2A40' }
        },
        fontFamily: { sans: ['Playfair Display', 'Georgia', 'serif'] },
        borderRadius: { card: '8px', input: '4px', btn: '4px' },
        boxShadow: { card: '0 4px 20px rgba(0,0,0,0.3)' }
      }
    }
  }
};

const result = fromMentor(mooncafeDNA, { packageName: 'mooncafe-theme', version: '1.0.0' });
const outputDir = path.join(__dirname, 'output', 'mooncafe-theme');
for (const [fp, content] of Object.entries(result.package.files)) {
  const full = path.join(outputDir, fp);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
}
console.log('Brand:', JSON.stringify(result.tokens.colors.brand));
console.log('Surface:', JSON.stringify(result.tokens.colors.surface));
console.log('Font:', result.tokens.typography.fontFamily.sans);
console.log(`Written to: ${outputDir}/`);
