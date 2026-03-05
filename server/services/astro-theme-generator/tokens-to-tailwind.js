/**
 * Tokens-to-Tailwind Preset Generator
 *
 * Converts unified design tokens into a Tailwind CSS preset config.
 * Users drop this into their tailwind.config.mjs presets array.
 */

/**
 * Generate a Tailwind CSS preset object from unified tokens
 * @param {object} tokens - Unified token object
 * @returns {string} JavaScript module string for tailwind preset
 */
export function generateTailwindPreset(tokens) {
  const config = {
    theme: {
      extend: {
        colors: buildTailwindColors(tokens.colors),
        fontFamily: buildFontFamily(tokens.typography.fontFamily),
        fontSize: buildFontSize(tokens.typography.fontSize),
        fontWeight: buildFontWeight(tokens.typography.fontWeight),
        lineHeight: buildLineHeight(tokens.typography.lineHeight),
        borderRadius: buildBorderRadius(tokens.borders.radius),
        borderWidth: buildBorderWidth(tokens.borders.width),
        boxShadow: buildShadows(tokens.shadows),
        spacing: buildSpacing(tokens.spacing),
        backdropBlur: buildBlur(tokens.effects?.blur),
        transitionDuration: buildTransitions(tokens.effects?.transition)
      }
    }
  };

  return `/**
 * Style Set Tailwind Preset
 * Theme: ${tokens.meta?.name || 'Custom'}
 * Style: ${tokens.meta?.style || 'custom'}
 *
 * Usage in tailwind.config.mjs:
 *   import themePreset from './styleset-tailwind-preset.mjs';
 *   export default {
 *     presets: [themePreset],
 *     content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx,vue}'],
 *   };
 */
export default ${JSON.stringify(config, null, 2)};
`;
}

/**
 * Generate a Tailwind preset that references CSS custom properties.
 * This is the version used inside an Astro integration package,
 * where the CSS variables are injected separately.
 */
export function generateTailwindPresetWithVars() {
  return `/**
 * Style Set Tailwind Preset (CSS Variable Mode)
 * References CSS custom properties set by the Style Set integration.
 *
 * Usage in tailwind.config.mjs:
 *   import themePreset from '@styleset/astro/tailwind-preset';
 *   export default {
 *     presets: [themePreset],
 *     content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx,vue}'],
 *   };
 */
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          light: 'var(--color-brand-light)',
          DEFAULT: 'var(--color-brand)',
          dark: 'var(--color-brand-dark)',
        },
        surface: {
          canvas: 'var(--color-surface-canvas)',
          base: 'var(--color-surface-base)',
          muted: 'var(--color-surface-muted)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
        },
        border: {
          subtle: 'var(--color-border-subtle)',
          DEFAULT: 'var(--color-border)',
        },
        accent: {
          light: 'var(--color-accent-light)',
          DEFAULT: 'var(--color-accent)',
          dark: 'var(--color-accent-dark)',
        },
        status: {
          success: 'var(--color-status-success)',
          error: 'var(--color-status-error)',
          warning: 'var(--color-status-warning)',
          info: 'var(--color-status-info)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        serif: ['var(--font-serif)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        display: 'var(--text-display)',
        h1: 'var(--text-h1)',
        h2: 'var(--text-h2)',
        h3: 'var(--text-h3)',
        body: 'var(--text-body)',
        small: 'var(--text-small)',
        micro: 'var(--text-micro)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-base)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-base)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        inner: 'var(--shadow-inner)',
      },
    },
  },
};
`;
}

function buildTailwindColors(colors) {
  const result = {};
  for (const [group, values] of Object.entries(colors)) {
    if (!values || typeof values !== 'object') continue;
    result[group] = {};
    for (const [key, val] of Object.entries(values)) {
      if (val) result[group][key] = val;
    }
  }
  return result;
}

function buildFontFamily(fonts) {
  const result = {};
  if (fonts.sans) result.sans = [fonts.sans, 'ui-sans-serif', 'system-ui', 'sans-serif'];
  if (fonts.serif) result.serif = [fonts.serif, 'ui-serif', 'Georgia', 'serif'];
  if (fonts.mono) result.mono = [fonts.mono, 'ui-monospace', 'monospace'];
  return result;
}

function buildFontSize(sizes) {
  const result = {};
  for (const [key, val] of Object.entries(sizes)) {
    if (val) result[key] = val;
  }
  return result;
}

function buildFontWeight(weights) {
  const result = {};
  for (const [key, val] of Object.entries(weights)) {
    if (val) result[key] = val;
  }
  return result;
}

function buildLineHeight(heights) {
  const result = {};
  for (const [key, val] of Object.entries(heights)) {
    if (val) result[key] = val;
  }
  return result;
}

function buildBorderRadius(radii) {
  const result = {};
  for (const [key, val] of Object.entries(radii)) {
    if (val) result[key === 'DEFAULT' ? 'DEFAULT' : key] = val;
  }
  return result;
}

function buildBorderWidth(widths) {
  const result = {};
  for (const [key, val] of Object.entries(widths)) {
    if (val) result[key === 'DEFAULT' ? 'DEFAULT' : key] = val;
  }
  return result;
}

function buildShadows(shadows) {
  const result = {};
  for (const [key, val] of Object.entries(shadows)) {
    if (val) result[key === 'DEFAULT' ? 'DEFAULT' : key] = val;
  }
  return result;
}

function buildSpacing(spacing) {
  const base = parseInt(spacing.base) || 8;
  return {
    xs: `${base * 0.5}px`,
    sm: `${base}px`,
    md: `${base * 2}px`,
    lg: `${base * 3}px`,
    xl: `${base * 4}px`,
    '2xl': `${base * 6}px`
  };
}

function buildBlur(blur) {
  if (!blur) return {};
  const result = {};
  for (const [key, val] of Object.entries(blur)) {
    if (val) result[key === 'DEFAULT' ? 'DEFAULT' : key] = val;
  }
  return result;
}

function buildTransitions(transitions) {
  if (!transitions) return {};
  const result = {};
  for (const [key, val] of Object.entries(transitions)) {
    if (val) {
      const ms = parseInt(val) || 200;
      result[key === 'DEFAULT' ? 'DEFAULT' : key] = `${ms}ms`;
    }
  }
  return result;
}

export default { generateTailwindPreset, generateTailwindPresetWithVars };
