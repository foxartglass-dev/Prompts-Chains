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
          "light": "#FBBF24",
          "DEFAULT": "#F59E0B",
          "dark": "#D97706"
        },
        "surface": {
          "canvas": "#0C0A09",
          "base": "rgba(255,255,255,0.08)",
          "muted": "rgba(255,255,255,0.05)"
        },
        "text": {
          "primary": "#FAFAF9",
          "secondary": "#A8A29E",
          "tertiary": "#78716C"
        },
        "border": {
          "subtle": "rgba(255,255,255,0.08)",
          "DEFAULT": "rgba(255,255,255,0.12)"
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
        "display": "32px",
        "h1": "24px",
        "h2": "20px",
        "h3": "16px",
        "body": "14px",
        "small": "12px",
        "micro": "10px"
      },
      "fontWeight": {
        "display": "700",
        "heading": "600",
        "body": "400",
        "bold": "600"
      },
      "lineHeight": {},
      "borderRadius": {
        "sm": "12px",
        "DEFAULT": "20px",
        "lg": "12px"
      },
      "borderWidth": {},
      "boxShadow": {
        "DEFAULT": "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)"
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
