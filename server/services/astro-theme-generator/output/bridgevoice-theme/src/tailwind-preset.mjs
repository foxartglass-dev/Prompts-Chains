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
          "light": "#4ADE80",
          "DEFAULT": "#22C55E",
          "dark": "#16A34A"
        },
        "surface": {
          "canvas": "#050505",
          "base": "#0D0D0D",
          "muted": "#171717"
        },
        "text": {
          "primary": "#F9FAFB",
          "secondary": "#9CA3AF",
          "tertiary": "#6B7280"
        },
        "border": {
          "subtle": "#1F1F1F",
          "DEFAULT": "#2A2A2A"
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
        "sm": "8px",
        "DEFAULT": "12px",
        "lg": "8px"
      },
      "borderWidth": {},
      "boxShadow": {
        "DEFAULT": "0 0 0 1px rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.4)"
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
