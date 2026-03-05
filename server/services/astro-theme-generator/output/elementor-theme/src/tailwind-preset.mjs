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
          "dark": "#BE185D"
        },
        "surface": {
          "canvas": "#FFFFFF",
          "base": "#FFFFFF",
          "muted": "#F9FAFB"
        },
        "text": {
          "primary": "#000000",
          "secondary": "#4B5563",
          "tertiary": "#9CA3AF"
        },
        "border": {
          "subtle": "#E5E7EB",
          "DEFAULT": "#D1D5DB"
        },
        "status": {},
        "accent": {}
      },
      "fontFamily": {
        "sans": [
          "Roobert",
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
        "heading": "600",
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
        "DEFAULT": "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)"
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
