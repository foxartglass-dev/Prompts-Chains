/**
 * Style-to-Tokens Converter
 *
 * Takes output from EITHER:
 *   1. Mentor's "Style Guide Generator" prompt (Tailwind config + design tokens)
 *   2. Style Set renderer (named styles like Neomorphism, color palettes, fonts)
 *   3. Raw style object with colors/fonts/spacing
 *
 * And normalizes it into a unified token format that can be exported as:
 *   - CSS custom properties (:root variables)
 *   - Tailwind theme preset
 *   - Astro integration package
 */

/**
 * The unified token format everything gets normalized into.
 * This is the "lingua franca" between Style Set and Astro themes.
 */
const EMPTY_TOKENS = {
  colors: {
    brand: { light: null, DEFAULT: null, dark: null },
    surface: { canvas: null, base: null, muted: null },
    text: { primary: null, secondary: null, tertiary: null },
    border: { subtle: null, DEFAULT: null },
    status: { success: null, error: null, warning: null, info: null },
    accent: { DEFAULT: null, light: null, dark: null }
  },
  typography: {
    fontFamily: { sans: null, serif: null, mono: null },
    fontSize: {
      display: null, h1: null, h2: null, h3: null,
      body: null, small: null, micro: null
    },
    fontWeight: {
      display: null, heading: null, body: null, bold: null
    },
    lineHeight: {
      tight: null, normal: null, relaxed: null
    }
  },
  spacing: {
    base: null,
    scale: {} // xs, sm, md, lg, xl, 2xl
  },
  borders: {
    radius: { sm: null, DEFAULT: null, lg: null, full: null },
    width: { DEFAULT: null, thick: null }
  },
  shadows: {
    sm: null, DEFAULT: null, md: null, lg: null, inner: null
  },
  effects: {
    blur: { sm: null, DEFAULT: null, lg: null },
    opacity: { muted: null, disabled: null },
    transition: { fast: null, DEFAULT: null, slow: null }
  },
  meta: {
    name: null,
    style: null, // e.g. 'neomorphism', 'glassmorphism', etc.
    density: null, // 'cozy' or 'compact'
    contrast: null // 'normal' or 'high'
  }
};

/**
 * Named style presets that match Style Set's built-in styles.
 * These provide sensible defaults for each named style,
 * which can be overridden by custom colors/fonts.
 */
const STYLE_PRESETS = {
  neomorphism: {
    borders: {
      radius: { sm: '8px', DEFAULT: '16px', lg: '24px', full: '9999px' },
      width: { DEFAULT: '0px', thick: '0px' }
    },
    shadows: {
      sm: '4px 4px 8px rgba(0,0,0,0.08), -4px -4px 8px rgba(255,255,255,0.8)',
      DEFAULT: '8px 8px 16px rgba(0,0,0,0.1), -8px -8px 16px rgba(255,255,255,0.7)',
      md: '12px 12px 24px rgba(0,0,0,0.12), -12px -12px 24px rgba(255,255,255,0.6)',
      lg: '20px 20px 40px rgba(0,0,0,0.15), -20px -20px 40px rgba(255,255,255,0.5)',
      inner: 'inset 4px 4px 8px rgba(0,0,0,0.08), inset -4px -4px 8px rgba(255,255,255,0.8)'
    },
    colors: {
      surface: { canvas: '#e0e5ec', base: '#e0e5ec', muted: '#d1d9e6' },
      border: { subtle: 'transparent', DEFAULT: 'transparent' }
    },
    meta: { style: 'neomorphism', density: 'cozy' }
  },
  glassmorphism: {
    borders: {
      radius: { sm: '8px', DEFAULT: '12px', lg: '20px', full: '9999px' },
      width: { DEFAULT: '1px', thick: '2px' }
    },
    shadows: {
      sm: '0 2px 8px rgba(0,0,0,0.1)',
      DEFAULT: '0 8px 32px rgba(0,0,0,0.12)',
      md: '0 12px 40px rgba(0,0,0,0.15)',
      lg: '0 20px 60px rgba(0,0,0,0.2)',
      inner: 'inset 0 0 30px rgba(255,255,255,0.05)'
    },
    effects: {
      blur: { sm: '4px', DEFAULT: '12px', lg: '20px' }
    },
    colors: {
      surface: { canvas: '#0f0f23', base: 'rgba(255,255,255,0.1)', muted: 'rgba(255,255,255,0.05)' },
      border: { subtle: 'rgba(255,255,255,0.15)', DEFAULT: 'rgba(255,255,255,0.2)' },
      text: { primary: '#ffffff', secondary: 'rgba(255,255,255,0.7)', tertiary: 'rgba(255,255,255,0.4)' }
    },
    meta: { style: 'glassmorphism', density: 'cozy' }
  },
  brutalism: {
    borders: {
      radius: { sm: '0px', DEFAULT: '0px', lg: '0px', full: '9999px' },
      width: { DEFAULT: '2px', thick: '4px' }
    },
    shadows: {
      sm: '2px 2px 0 #000',
      DEFAULT: '4px 4px 0 #000',
      md: '6px 6px 0 #000',
      lg: '8px 8px 0 #000',
      inner: 'none'
    },
    colors: {
      surface: { canvas: '#ffffff', base: '#ffffff', muted: '#f5f5f5' },
      border: { subtle: '#000000', DEFAULT: '#000000' }
    },
    meta: { style: 'brutalism', density: 'compact' }
  },
  minimalism: {
    borders: {
      radius: { sm: '4px', DEFAULT: '8px', lg: '12px', full: '9999px' },
      width: { DEFAULT: '1px', thick: '1px' }
    },
    shadows: {
      sm: '0 1px 2px rgba(0,0,0,0.04)',
      DEFAULT: '0 1px 3px rgba(0,0,0,0.06)',
      md: '0 4px 6px rgba(0,0,0,0.07)',
      lg: '0 10px 15px rgba(0,0,0,0.08)',
      inner: 'none'
    },
    colors: {
      surface: { canvas: '#fafafa', base: '#ffffff', muted: '#f5f5f5' },
      border: { subtle: '#e5e5e5', DEFAULT: '#d4d4d4' }
    },
    meta: { style: 'minimalism', density: 'cozy' }
  },
  skeuomorphism: {
    borders: {
      radius: { sm: '6px', DEFAULT: '10px', lg: '16px', full: '9999px' },
      width: { DEFAULT: '1px', thick: '2px' }
    },
    shadows: {
      sm: '0 1px 2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.3)',
      DEFAULT: '0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.2)',
      md: '0 4px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
      lg: '0 8px 16px rgba(0,0,0,0.25), inset 0 2px 0 rgba(255,255,255,0.1)',
      inner: 'inset 0 2px 4px rgba(0,0,0,0.15)'
    },
    meta: { style: 'skeuomorphism', density: 'cozy' }
  },
  claymorphism: {
    borders: {
      radius: { sm: '16px', DEFAULT: '24px', lg: '32px', full: '9999px' },
      width: { DEFAULT: '0px', thick: '0px' }
    },
    shadows: {
      sm: '4px 4px 12px rgba(0,0,0,0.08), inset -2px -2px 4px rgba(0,0,0,0.05), inset 2px 2px 4px rgba(255,255,255,0.5)',
      DEFAULT: '8px 8px 20px rgba(0,0,0,0.1), inset -4px -4px 8px rgba(0,0,0,0.06), inset 4px 4px 8px rgba(255,255,255,0.4)',
      md: '12px 12px 30px rgba(0,0,0,0.12), inset -6px -6px 12px rgba(0,0,0,0.07), inset 6px 6px 12px rgba(255,255,255,0.3)',
      lg: '16px 16px 40px rgba(0,0,0,0.15), inset -8px -8px 16px rgba(0,0,0,0.08), inset 8px 8px 16px rgba(255,255,255,0.2)',
      inner: 'inset 4px 4px 8px rgba(0,0,0,0.06), inset -4px -4px 8px rgba(255,255,255,0.4)'
    },
    meta: { style: 'claymorphism', density: 'cozy' }
  },
  bauhaus: {
    borders: {
      radius: { sm: '0px', DEFAULT: '0px', lg: '50%', full: '50%' },
      width: { DEFAULT: '2px', thick: '4px' }
    },
    shadows: {
      sm: 'none', DEFAULT: 'none', md: 'none', lg: 'none', inner: 'none'
    },
    colors: {
      brand: { light: '#f7d046', DEFAULT: '#e63226', dark: '#1a4b8c' },
      surface: { canvas: '#f5f0e8', base: '#ffffff', muted: '#ede8df' },
      border: { subtle: '#1a1a1a', DEFAULT: '#000000' }
    },
    meta: { style: 'bauhaus', density: 'compact' }
  },
  neubrutalism: {
    borders: {
      radius: { sm: '4px', DEFAULT: '8px', lg: '12px', full: '9999px' },
      width: { DEFAULT: '2px', thick: '3px' }
    },
    shadows: {
      sm: '2px 2px 0 #000',
      DEFAULT: '4px 4px 0 #000',
      md: '6px 6px 0 #000',
      lg: '8px 8px 0 #000',
      inner: 'none'
    },
    colors: {
      surface: { canvas: '#fef9ef', base: '#ffffff', muted: '#fdf3e1' },
      border: { subtle: '#1a1a1a', DEFAULT: '#000000' }
    },
    meta: { style: 'neubrutalism', density: 'cozy' }
  }
};

/**
 * Color palette presets matching Style Set's palette options
 */
const COLOR_PALETTES = {
  'midnight-office': {
    brand: { light: '#4f8ff7', DEFAULT: '#2563eb', dark: '#1d4ed8' },
    surface: { canvas: '#0f172a', base: '#1e293b', muted: '#334155' },
    text: { primary: '#f8fafc', secondary: '#94a3b8', tertiary: '#64748b' },
    accent: { DEFAULT: '#3b82f6', light: '#60a5fa', dark: '#2563eb' }
  },
  'charcoal-cream': {
    brand: { light: '#a3a3a3', DEFAULT: '#737373', dark: '#525252' },
    surface: { canvas: '#fafaf9', base: '#ffffff', muted: '#f5f5f4' },
    text: { primary: '#1c1917', secondary: '#57534e', tertiary: '#a8a29e' },
    accent: { DEFAULT: '#78716c', light: '#a8a29e', dark: '#57534e' }
  },
  'deep-teal': {
    brand: { light: '#5eead4', DEFAULT: '#14b8a6', dark: '#0d9488' },
    surface: { canvas: '#f0fdfa', base: '#ffffff', muted: '#ccfbf1' },
    text: { primary: '#134e4a', secondary: '#115e59', tertiary: '#5eead4' },
    accent: { DEFAULT: '#14b8a6', light: '#2dd4bf', dark: '#0d9488' }
  },
  'sunset-glow': {
    brand: { light: '#fdba74', DEFAULT: '#f97316', dark: '#ea580c' },
    surface: { canvas: '#fffbeb', base: '#ffffff', muted: '#fef3c7' },
    text: { primary: '#78350f', secondary: '#92400e', tertiary: '#d97706' },
    accent: { DEFAULT: '#f59e0b', light: '#fbbf24', dark: '#d97706' }
  },
  'rose-garden': {
    brand: { light: '#fda4af', DEFAULT: '#f43f5e', dark: '#e11d48' },
    surface: { canvas: '#fff1f2', base: '#ffffff', muted: '#ffe4e6' },
    text: { primary: '#4c0519', secondary: '#881337', tertiary: '#fb7185' },
    accent: { DEFAULT: '#f43f5e', light: '#fb7185', dark: '#e11d48' }
  },
  'arctic-blue': {
    brand: { light: '#bae6fd', DEFAULT: '#0ea5e9', dark: '#0284c7' },
    surface: { canvas: '#f0f9ff', base: '#ffffff', muted: '#e0f2fe' },
    text: { primary: '#0c4a6e', secondary: '#075985', tertiary: '#38bdf8' },
    accent: { DEFAULT: '#0ea5e9', light: '#38bdf8', dark: '#0284c7' }
  },
  'forest-floor': {
    brand: { light: '#86efac', DEFAULT: '#22c55e', dark: '#16a34a' },
    surface: { canvas: '#f0fdf4', base: '#ffffff', muted: '#dcfce7' },
    text: { primary: '#14532d', secondary: '#166534', tertiary: '#4ade80' },
    accent: { DEFAULT: '#22c55e', light: '#4ade80', dark: '#16a34a' }
  },
  'electric-coral': {
    brand: { light: '#fca5a5', DEFAULT: '#ef4444', dark: '#dc2626' },
    surface: { canvas: '#1a1a2e', base: '#16213e', muted: '#0f3460' },
    text: { primary: '#fef2f2', secondary: '#fecaca', tertiary: '#f87171' },
    accent: { DEFAULT: '#ef4444', light: '#f87171', dark: '#dc2626' }
  }
};

/**
 * Normalize the mentor's prompt output into unified tokens
 */
export function fromMentorPromptOutput(mentorOutput) {
  const tokens = structuredClone(EMPTY_TOKENS);

  // Colors
  if (mentorOutput.colors || mentorOutput['1. Color Tokens'] || mentorOutput.tailwindConfig?.colors) {
    const colors = mentorOutput.colors || {};
    const tw = mentorOutput.tailwindConfig?.theme?.extend?.colors || mentorOutput.tailwindConfig?.colors || {};

    tokens.colors.brand = {
      light: tw.brand?.light || colors.brandLight || null,
      DEFAULT: tw.brand?.DEFAULT || colors.brandDefault || colors.brand || null,
      dark: tw.brand?.dark || colors.brandDark || null
    };
    tokens.colors.surface = {
      canvas: tw.surface?.canvas || colors.surfaceCanvas || null,
      base: tw.surface?.base || colors.surfaceBase || null,
      muted: tw.surface?.muted || colors.surfaceMuted || null
    };
    tokens.colors.text = {
      primary: tw.text?.primary || colors.textPrimary || null,
      secondary: tw.text?.secondary || colors.textSecondary || null,
      tertiary: tw.text?.tertiary || colors.textTertiary || null
    };
    tokens.colors.border = {
      subtle: tw.border?.subtle || colors.borderSubtle || null,
      DEFAULT: tw.border?.DEFAULT || colors.borderDefault || null
    };
  }

  // Typography
  if (mentorOutput.typography || mentorOutput.tailwindConfig?.fontFamily) {
    const typo = mentorOutput.typography || {};
    const tw = mentorOutput.tailwindConfig?.theme?.extend || {};

    tokens.typography.fontFamily.sans = tw.fontFamily?.sans?.[0] || typo.fontFamily || null;
    tokens.typography.fontSize = {
      display: typo.display?.size || '30px',
      h1: typo.h1?.size || '24px',
      h2: typo.h2?.size || '18px',
      h3: typo.h3?.size || '16px',
      body: typo.body?.size || '14px',
      small: typo.small?.size || '13px',
      micro: typo.micro?.size || '12px'
    };
    tokens.typography.fontWeight = {
      display: typo.display?.weight || '700',
      heading: typo.h1?.weight || '600',
      body: typo.body?.weight || '400',
      bold: '600'
    };
  }

  // Spacing
  if (mentorOutput.spacing) {
    tokens.spacing.base = mentorOutput.spacing.baseUnit || '8px';
    tokens.meta.density = mentorOutput.spacing.density || 'cozy';
  }

  // Components → borders/shadows
  if (mentorOutput.components) {
    const cards = mentorOutput.components.cards || mentorOutput.components.surfaces || {};
    tokens.borders.radius.DEFAULT = cards.radius || mentorOutput.tailwindConfig?.theme?.extend?.borderRadius?.card || '12px';
    tokens.shadows.DEFAULT = cards.shadow || mentorOutput.tailwindConfig?.theme?.extend?.boxShadow?.card || null;

    const buttons = mentorOutput.components.buttons || mentorOutput.components.interactables || {};
    tokens.borders.radius.sm = buttons.radius || '8px';

    const inputs = mentorOutput.components.inputs || {};
    tokens.borders.radius.lg = inputs.radius || tokens.borders.radius.DEFAULT;
  }

  return tokens;
}

/**
 * Normalize Style Set renderer output into unified tokens.
 * Takes: { style, accentStyle, palette, font, highContrast, customColors }
 */
export function fromStyleSetConfig(config) {
  const {
    style = 'minimalism',
    accentStyle = null,
    palette = null,
    font = 'Inter',
    highContrast = false,
    customColors = {}
  } = config;

  // Start with empty tokens
  const tokens = structuredClone(EMPTY_TOKENS);

  // Apply named style preset (shadows, borders, base colors)
  const preset = STYLE_PRESETS[style.toLowerCase()];
  if (preset) {
    deepMerge(tokens, preset);
  }

  // If mixing two styles, blend the accent style's shadows
  if (accentStyle && STYLE_PRESETS[accentStyle.toLowerCase()]) {
    const accent = STYLE_PRESETS[accentStyle.toLowerCase()];
    // Use accent style's borders but keep primary style's shadows
    if (accent.borders) {
      tokens.borders = { ...tokens.borders, ...accent.borders };
    }
  }

  // Apply color palette
  if (palette && COLOR_PALETTES[palette.toLowerCase().replace(/\s+/g, '-')]) {
    const paletteColors = COLOR_PALETTES[palette.toLowerCase().replace(/\s+/g, '-')];
    deepMerge(tokens.colors, paletteColors);
  }

  // Apply custom color overrides
  if (customColors.primary) tokens.colors.brand.DEFAULT = customColors.primary;
  if (customColors.secondary) tokens.colors.accent.DEFAULT = customColors.secondary;
  if (customColors.background) tokens.colors.surface.canvas = customColors.background;
  if (customColors.surface) tokens.colors.surface.base = customColors.surface;
  if (customColors.text) tokens.colors.text.primary = customColors.text;

  // Apply font
  tokens.typography.fontFamily.sans = font;

  // Apply high contrast modifier
  if (highContrast) {
    tokens.meta.contrast = 'high';
    tokens.typography.fontWeight.body = '500';
    tokens.typography.fontWeight.heading = '700';
    tokens.typography.fontSize.body = '16px';
    tokens.typography.fontSize.small = '14px';
  }

  // Set meta
  tokens.meta.name = config.themeName || `${style}-theme`;
  tokens.meta.style = style;

  // Apply sensible defaults for anything still null
  applyDefaults(tokens);

  return tokens;
}

/**
 * Deep merge source into target (mutates target)
 */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else if (source[key] !== null && source[key] !== undefined) {
      target[key] = source[key];
    }
  }
}

/**
 * Fill in remaining nulls with sensible defaults
 */
function applyDefaults(tokens) {
  const defaults = {
    colors: {
      brand: { light: '#93c5fd', DEFAULT: '#3b82f6', dark: '#1d4ed8' },
      surface: { canvas: '#ffffff', base: '#ffffff', muted: '#f5f5f5' },
      text: { primary: '#111827', secondary: '#6b7280', tertiary: '#9ca3af' },
      border: { subtle: '#e5e7eb', DEFAULT: '#d1d5db' },
      status: { success: '#22c55e', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' },
      accent: { DEFAULT: '#8b5cf6', light: '#a78bfa', dark: '#7c3aed' }
    },
    typography: {
      fontFamily: { sans: 'Inter', serif: 'Georgia', mono: 'JetBrains Mono' },
      fontSize: { display: '36px', h1: '28px', h2: '22px', h3: '18px', body: '14px', small: '13px', micro: '11px' },
      fontWeight: { display: '700', heading: '600', body: '400', bold: '600' },
      lineHeight: { tight: '1.25', normal: '1.5', relaxed: '1.75' }
    },
    spacing: { base: '8px' },
    borders: {
      radius: { sm: '6px', DEFAULT: '8px', lg: '12px', full: '9999px' },
      width: { DEFAULT: '1px', thick: '2px' }
    },
    shadows: {
      sm: '0 1px 2px rgba(0,0,0,0.05)',
      DEFAULT: '0 1px 3px rgba(0,0,0,0.1)',
      md: '0 4px 6px rgba(0,0,0,0.1)',
      lg: '0 10px 15px rgba(0,0,0,0.1)',
      inner: 'inset 0 2px 4px rgba(0,0,0,0.06)'
    },
    effects: {
      blur: { sm: '4px', DEFAULT: '8px', lg: '16px' },
      opacity: { muted: '0.6', disabled: '0.4' },
      transition: { fast: '150ms ease', DEFAULT: '200ms ease', slow: '300ms ease' }
    }
  };

  fillNulls(tokens, defaults);
}

function fillNulls(target, defaults) {
  for (const key of Object.keys(defaults)) {
    if (target[key] === null || target[key] === undefined) {
      target[key] = defaults[key];
    } else if (typeof target[key] === 'object' && typeof defaults[key] === 'object' && !Array.isArray(target[key])) {
      fillNulls(target[key], defaults[key]);
    }
  }
}

export { STYLE_PRESETS, COLOR_PALETTES, EMPTY_TOKENS };
