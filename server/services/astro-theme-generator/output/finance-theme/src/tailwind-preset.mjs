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
          "light": "#F9A8D4",
          "DEFAULT": "#EC4899",
          "dark": "#DB2777"
        },
        "surface": {
          "canvas": "#1A0A1E",
          "base": "#251530",
          "muted": "#2E1B3A"
        },
        "text": {
          "primary": "#F5F0F7",
          "secondary": "#A78BBF",
          "tertiary": "#7C5F94"
        },
        "border": {
          "subtle": "#3A2248",
          "DEFAULT": "#4A2E5A"
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
        "h1": "28px",
        "h2": "22px",
        "h3": "16px",
        "body": "14px",
        "small": "12px",
        "micro": "10px"
      },
      "fontWeight": {
        "display": "700",
        "heading": "700",
        "body": "400",
        "bold": "600"
      },
      "lineHeight": {},
      "borderRadius": {
        "sm": "10px",
        "DEFAULT": "16px",
        "lg": "10px"
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
