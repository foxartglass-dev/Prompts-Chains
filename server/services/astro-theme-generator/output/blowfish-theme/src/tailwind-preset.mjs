/**
 * Style Set Tailwind Preset
 * Theme: Custom
 * Style: custom
 *
 * Usage in tailwind.config.mjs:
 *   import themePreset from './styleset-tailwind-preset.mjs';
 *   export default {
 *     presets: [themePreset],
 *     content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx,vue}'],
 *   };
 */
export default {
  "theme": {
    "extend": {
      "colors": {
        "brand": {
          "light": "#86EFAC",
          "DEFAULT": "#4ADE80",
          "dark": "#22C55E"
        },
        "surface": {
          "canvas": "#0A0A0A",
          "base": "#141414",
          "muted": "#1E1E1E"
        },
        "text": {
          "primary": "#FAFAFA",
          "secondary": "#A3A3A3",
          "tertiary": "#6B6B6B"
        },
        "border": {
          "subtle": "#1E1E1E",
          "DEFAULT": "#2E2E2E"
        },
        "status": {},
        "accent": {}
      },
      "fontFamily": {
        "sans": [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ]
      },
      "fontSize": {
        "display": "72px",
        "h1": "48px",
        "h2": "32px",
        "h3": "18px",
        "body": "16px",
        "small": "14px",
        "micro": "12px"
      },
      "fontWeight": {
        "display": "800",
        "heading": "800",
        "body": "400",
        "bold": "600"
      },
      "lineHeight": {},
      "borderRadius": {
        "sm": "0px",
        "DEFAULT": "0px",
        "lg": "0px"
      },
      "borderWidth": {},
      "boxShadow": {
        "DEFAULT": "none"
      },
      "spacing": {
        "xs": "4px",
        "sm": "8px",
        "md": "16px",
        "lg": "24px",
        "xl": "32px",
        "2xl": "48px"
      },
      "backdropBlur": {},
      "transitionDuration": {}
    }
  }
};
