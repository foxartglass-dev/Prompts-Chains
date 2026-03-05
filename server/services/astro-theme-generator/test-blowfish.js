import { fromMentor } from './index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const blowfishDNA = {
  colors: {
    brandLight: '#86EFAC',
    brandDefault: '#4ADE80',      // neon green accent
    brandDark: '#22C55E',
    surfaceCanvas: '#0A0A0A',     // pure dark
    surfaceBase: '#141414',
    surfaceMuted: '#1E1E1E',
    surfaceDark: '#000000',
    textPrimary: '#FAFAFA',
    textSecondary: '#A3A3A3',
    textTertiary: '#6B6B6B',
    borderSubtle: '#1E1E1E',
    borderDefault: '#2E2E2E'
  },
  typography: {
    fontFamily: 'Inter',           // clean condensed feel
    display: { size: '72px', weight: '800' },  // massive bold headlines
    h1: { size: '48px', weight: '800' },
    h2: { size: '32px', weight: '700' },
    h3: { size: '18px', weight: '600' },
    body: { size: '16px', weight: '400' },
    small: { size: '14px', weight: '400' },
    micro: { size: '12px', weight: '500' }
  },
  components: {
    cards: { background: '#141414', border: '1px solid #1E1E1E', radius: '0px', shadow: 'none', padding: '24px' },
    buttons: { background: 'transparent', textColor: '#FAFAFA', radius: '0px', padding: '16px 36px' },
    inputs: { background: '#1E1E1E', border: '1px solid #2E2E2E', radius: '0px' }
  },
  spacing: { baseUnit: '8px', density: 'cozy', cardGaps: '0px', sectionGaps: '0px' },
  tailwindConfig: {
    theme: {
      extend: {
        colors: {
          brand: { light: '#86EFAC', DEFAULT: '#4ADE80', dark: '#22C55E' },
          surface: { canvas: '#0A0A0A', base: '#141414', muted: '#1E1E1E', dark: '#000000' },
          text: { primary: '#FAFAFA', secondary: '#A3A3A3', tertiary: '#6B6B6B' },
          border: { subtle: '#1E1E1E', DEFAULT: '#2E2E2E' }
        },
        fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
        borderRadius: { card: '0px', input: '0px', btn: '0px' },
        boxShadow: { card: 'none' }
      }
    }
  }
};

const result = fromMentor(blowfishDNA, { packageName: 'blowfish-bike-theme', version: '1.0.0' });
const outputDir = path.join(__dirname, 'output', 'blowfish-theme');
for (const [fp, content] of Object.entries(result.package.files)) {
  const full = path.join(outputDir, fp);
  if (!fs.existsSync(path.dirname(full))) fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
}
console.log('Brand:', JSON.stringify(result.tokens.colors.brand));
console.log('Font:', result.tokens.typography.fontFamily.sans);
console.log('Radius:', JSON.stringify(result.tokens.borders.radius));
console.log(`Written to: ${outputDir}/`);
