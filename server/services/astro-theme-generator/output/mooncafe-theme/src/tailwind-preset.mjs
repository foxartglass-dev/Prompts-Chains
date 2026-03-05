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
          "light": "#FDE047",
          "DEFAULT": "#EAB308",
          "dark": "#CA8A04"
        },
        "surface": {
          "canvas": "#0A0A14",
          "base": "#111122",
          "muted": "#1A1A2E"
        },
        "text": {
          "primary": "#FAFAFA",
          "secondary": "#A1A1AA",
          "tertiary": "#71717A"
        },
        "border": {
          "subtle": "#1E1E30",
          "DEFAULT": "#2A2A40"
        },
        "status": {},
        "accent": {}
      },
      "fontFamily": {
        "sans": [
          "Playfair Display",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ]
      },
      "fontSize": {
        "display": "56px",
        "h1": "40px",
        "h2": "28px",
        "h3": "18px",
        "body": "16px",
        "small": "14px",
        "micro": "12px"
      },
      "fontWeight": {
        "display": "700",
        "heading": "700",
        "body": "400",
        "bold": "600"
      },
      "lineHeight": {},
      "borderRadius": {
        "sm": "4px",
        "DEFAULT": "8px",
        "lg": "4px"
      },
      "borderWidth": {},
      "boxShadow": {
        "DEFAULT": "0 4px 20px rgba(0,0,0,0.3)"
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
