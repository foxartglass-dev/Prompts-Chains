/**
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
