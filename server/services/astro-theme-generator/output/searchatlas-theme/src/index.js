/**
 * @styleset/searchatlas-dark-theme - Astro Integration
 * Style: custom
 *
 * Usage in astro.config.mjs:
 *   import styleSetTheme from '@styleset/searchatlas-dark-theme';
 *   export default defineConfig({
 *     integrations: [styleSetTheme()],
 *   });
 */

export default function styleSetTheme(userOptions = {}) {
  return {
    name: '@styleset/searchatlas-dark-theme',
    hooks: {
      'astro:config:setup': ({ injectScript, updateConfig, logger }) => {
        // Inject the theme CSS (custom properties + component styles)
        injectScript('page-ssr', `import '@styleset/searchatlas-dark-theme/styles/theme.css';`);

        // Optionally inject reset
        if (userOptions.includeReset !== false) {
          injectScript('page-ssr', `import '@styleset/searchatlas-dark-theme/styles/reset.css';`);
        }

        // Inject Google Font link if needed
        const font = 'Inter';
        if (font && font !== 'system-ui') {
          const fontSlug = font.replace(/\s+/g, '+');
          injectScript('head-inline', `
            if (!document.querySelector('link[href*="fonts.googleapis.com"][href*="${fontSlug}"]')) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = 'https://fonts.googleapis.com/css2?family=${fontSlug}:wght@400;500;600;700&display=swap';
              document.head.appendChild(link);
            }
          `);
        }

        logger.info('Style Set theme loaded: custom');
      }
    }
  };
}
