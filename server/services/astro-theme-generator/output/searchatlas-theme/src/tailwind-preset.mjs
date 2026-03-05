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
          "light": "#5EEAD4",
          "DEFAULT": "#2DD4BF",
          "dark": "#14B8A6"
        },
        "surface": {
          "canvas": "#0B0B1A",
          "base": "#12122A",
          "muted": "#1A1A3E"
        },
        "text": {
          "primary": "#F8FAFC",
          "secondary": "#94A3B8",
          "tertiary": "#64748B"
        },
        "border": {
          "subtle": "#1E1E3F",
          "DEFAULT": "#2A2A5A"
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
        "display": "48px",
        "h1": "36px",
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
        "DEFAULT": "16px",
        "lg": "8px"
      },
      "borderWidth": {},
      "boxShadow": {
        "DEFAULT": "0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(45,212,191,0.05)"
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
