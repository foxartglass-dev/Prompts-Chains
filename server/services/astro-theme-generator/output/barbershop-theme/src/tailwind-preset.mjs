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
          "light": "#F87171",
          "DEFAULT": "#DC2626",
          "dark": "#B91C1C"
        },
        "surface": {
          "canvas": "#0F0F0F",
          "base": "#1A1A1A",
          "muted": "#252525"
        },
        "text": {
          "primary": "#FAFAFA",
          "secondary": "#A3A3A3",
          "tertiary": "#737373"
        },
        "border": {
          "subtle": "#2A2A2A",
          "DEFAULT": "#3A3A3A"
        },
        "status": {},
        "accent": {}
      },
      "fontFamily": {
        "sans": [
          "Oswald",
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
        "sm": "2px",
        "DEFAULT": "4px",
        "lg": "2px"
      },
      "borderWidth": {},
      "boxShadow": {
        "DEFAULT": "0 4px 20px rgba(0,0,0,0.4)"
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
