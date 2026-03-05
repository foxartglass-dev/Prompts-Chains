/**
 * Astro Theme Package Generator
 *
 * Takes unified design tokens and generates a complete, installable
 * Astro theme integration package. The output is a directory structure
 * that can be:
 *   1. Published to npm as @styleset/astro-theme-{name}
 *   2. Used locally via file: reference
 *   3. Downloaded as a zip from the Style Set app
 *
 * The generated package uses the Astro Integration API to:
 *   - Inject CSS custom properties via virtual modules
 *   - Provide a Tailwind preset for token-based utility classes
 *   - Export reusable Astro components (Card, Button, Input, Badge)
 */

import { generateCSS } from './tokens-to-css.js';
import { generateTailwindPreset, generateTailwindPresetWithVars } from './tokens-to-tailwind.js';

/**
 * Generate all files for an Astro theme package
 * @param {object} tokens - Unified design tokens
 * @param {object} options - Package options
 * @returns {object} Map of filepath -> file content
 */
export function generateAstroThemePackage(tokens, options = {}) {
  const {
    packageName = `styleset-${tokens.meta?.name || 'theme'}`,
    packageScope = '@styleset',
    version = '1.0.0',
    description = `Style Set theme: ${tokens.meta?.style || 'custom'} style`,
    author = 'Style Set (styleset.app)'
  } = options;

  const fullPackageName = packageScope ? `${packageScope}/${packageName}` : packageName;
  const files = {};

  // 1. package.json
  files['package.json'] = JSON.stringify({
    name: fullPackageName,
    version,
    description,
    author,
    type: 'module',
    main: './src/index.js',
    exports: {
      '.': './src/index.js',
      './components/*': './src/components/*.astro',
      './styles/*': './src/styles/*',
      './tailwind-preset': './src/tailwind-preset.mjs'
    },
    files: ['src'],
    keywords: [
      'astro',
      'astro-integration',
      'withastro',
      'theme',
      'styleset',
      tokens.meta?.style
    ].filter(Boolean),
    peerDependencies: {
      astro: '>=4.0.0'
    },
    homepage: 'https://styleset.app',
    license: 'MIT'
  }, null, 2);

  // 2. Main integration entry
  files['src/index.js'] = generateIntegrationEntry(fullPackageName, tokens);

  // 3. CSS files
  files['src/styles/theme.css'] = generateCSS(tokens);
  files['src/styles/reset.css'] = generateResetCSS();

  // 4. Tailwind preset (standalone with values baked in)
  files['src/tailwind-preset.mjs'] = generateTailwindPreset(tokens);

  // 5. Tailwind preset (variable-reference mode for integration use)
  files['src/tailwind-preset-vars.mjs'] = generateTailwindPresetWithVars();

  // 6. Astro components
  files['src/components/Card.astro'] = generateCardComponent(tokens);
  files['src/components/Button.astro'] = generateButtonComponent(tokens);
  files['src/components/Input.astro'] = generateInputComponent(tokens);
  files['src/components/Badge.astro'] = generateBadgeComponent();
  files['src/components/Container.astro'] = generateContainerComponent();
  files['src/components/index.ts'] = generateComponentIndex();

  // 7. README
  files['README.md'] = generateReadme(fullPackageName, tokens);

  return files;
}

function generateIntegrationEntry(packageName, tokens) {
  return `/**
 * ${packageName} - Astro Integration
 * Style: ${tokens.meta?.style || 'custom'}
 *
 * Usage in astro.config.mjs:
 *   import styleSetTheme from '${packageName}';
 *   export default defineConfig({
 *     integrations: [styleSetTheme()],
 *   });
 */

export default function styleSetTheme(userOptions = {}) {
  return {
    name: '${packageName}',
    hooks: {
      'astro:config:setup': ({ injectScript, updateConfig, logger }) => {
        // Inject the theme CSS (custom properties + component styles)
        injectScript('page-ssr', \`import '${packageName}/styles/theme.css';\`);

        // Optionally inject reset
        if (userOptions.includeReset !== false) {
          injectScript('page-ssr', \`import '${packageName}/styles/reset.css';\`);
        }

        // Inject Google Font link if needed
        const font = '${tokens.typography.fontFamily.sans || 'Inter'}';
        if (font && font !== 'system-ui') {
          const fontSlug = font.replace(/\\s+/g, '+');
          injectScript('head-inline', \`
            if (!document.querySelector('link[href*="fonts.googleapis.com"][href*="\${fontSlug}"]')) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = 'https://fonts.googleapis.com/css2?family=\${fontSlug}:wght@400;500;600;700&display=swap';
              document.head.appendChild(link);
            }
          \`);
        }

        logger.info('Style Set theme loaded: ${tokens.meta?.style || 'custom'}');
      }
    }
  };
}
`;
}

function generateResetCSS() {
  return `/* Style Set - Minimal Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
}

html {
  -moz-text-size-adjust: none;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}

body {
  min-height: 100vh;
  line-height: var(--leading-normal, 1.5);
}

h1, h2, h3, h4, h5, h6 {
  text-wrap: balance;
}

p, li {
  text-wrap: pretty;
}

img, picture, video, canvas, svg {
  display: block;
  max-width: 100%;
}

input, button, textarea, select {
  font: inherit;
}
`;
}

function generateCardComponent(tokens) {
  const isGlass = tokens.meta?.style === 'glassmorphism';
  return `---
interface Props {
  class?: string;
  hover?: boolean;
}

const { class: className = '', hover = true } = Astro.props;
---

<div class:list={['ss-card', { 'ss-card--hover': hover }, className]}>
  <slot />
</div>

<style>
  .ss-card {
    background: var(--color-surface-base);
    border-radius: var(--radius-base);
    padding: var(--space-lg);
    border: var(--border-base) solid var(--color-border);
    box-shadow: var(--shadow-base);
    transition: var(--transition-base);${isGlass ? `
    backdrop-filter: blur(var(--blur-base));
    -webkit-backdrop-filter: blur(var(--blur-base));` : ''}
  }

  .ss-card--hover:hover {
    box-shadow: var(--shadow-md);
  }
</style>
`;
}

function generateButtonComponent(tokens) {
  const isBrutal = tokens.meta?.style === 'brutalism' || tokens.meta?.style === 'neubrutalism';
  return `---
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  class?: string;
}

const {
  variant = 'primary',
  size = 'md',
  href,
  class: className = ''
} = Astro.props;

const Tag = href ? 'a' : 'button';
---

<Tag
  class:list={['ss-btn', \`ss-btn--\${variant}\`, \`ss-btn--\${size}\`, className]}
  href={href}
>
  <slot />
</Tag>

<style>
  .ss-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    font-weight: var(--font-bold);
    font-family: var(--font-sans);
    border-radius: var(--radius-sm);
    transition: var(--transition-base);
    cursor: pointer;
    border: var(--border-base) solid transparent;
    text-decoration: none;
    line-height: 1;
  }

  .ss-btn--sm { padding: var(--space-xs) var(--space-sm); font-size: var(--text-small); }
  .ss-btn--md { padding: var(--space-sm) var(--space-lg); font-size: var(--text-body); }
  .ss-btn--lg { padding: var(--space-md) var(--space-xl); font-size: var(--text-h3); }

  .ss-btn--primary {
    background: var(--color-brand);
    color: var(--color-surface-canvas);${isBrutal ? `
    border-color: var(--color-border);
    box-shadow: var(--shadow-base);` : ''}
  }

  .ss-btn--primary:hover {
    background: var(--color-brand-dark);${isBrutal ? `
    transform: translate(2px, 2px);
    box-shadow: var(--shadow-sm);` : ''}
  }

  .ss-btn--secondary {
    background: var(--color-surface-muted);
    color: var(--color-text-primary);
    border-color: var(--color-border);
  }

  .ss-btn--secondary:hover {
    background: var(--color-surface-base);
  }

  .ss-btn--ghost {
    background: transparent;
    color: var(--color-brand);
  }

  .ss-btn--ghost:hover {
    background: var(--color-surface-muted);
  }
</style>
`;
}

function generateInputComponent(tokens) {
  const isNeo = tokens.meta?.style === 'neomorphism';
  return `---
interface Props {
  type?: string;
  placeholder?: string;
  label?: string;
  name?: string;
  class?: string;
}

const {
  type = 'text',
  placeholder = '',
  label,
  name,
  class: className = ''
} = Astro.props;
---

<div class:list={['ss-field', className]}>
  {label && <label class="ss-label" for={name}>{label}</label>}
  <input
    class="ss-input"
    type={type}
    placeholder={placeholder}
    name={name}
    id={name}
  />
</div>

<style>
  .ss-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .ss-label {
    font-size: var(--text-small);
    font-weight: var(--font-bold);
    color: var(--color-text-secondary);
  }

  .ss-input {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    font-size: var(--text-body);
    font-family: var(--font-sans);
    background: var(--color-surface-muted);
    border: var(--border-base) solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    transition: var(--transition-base);${isNeo ? `
    box-shadow: var(--shadow-inner);` : ''}
  }

  .ss-input:focus {
    outline: none;
    border-color: var(--color-brand);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-brand) 20%, transparent);
  }

  .ss-input::placeholder {
    color: var(--color-text-tertiary);
  }
</style>
`;
}

function generateBadgeComponent() {
  return `---
interface Props {
  variant?: 'default' | 'success' | 'error' | 'warning';
  class?: string;
}

const { variant = 'default', class: className = '' } = Astro.props;
---

<span class:list={['ss-badge', \`ss-badge--\${variant}\`, className]}>
  <slot />
</span>

<style>
  .ss-badge {
    display: inline-flex;
    align-items: center;
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--text-micro);
    font-weight: var(--font-bold);
    border-radius: var(--radius-full);
    line-height: 1;
  }

  .ss-badge--default {
    background: var(--color-surface-muted);
    color: var(--color-text-secondary);
  }
  .ss-badge--success {
    background: color-mix(in srgb, var(--color-status-success) 15%, transparent);
    color: var(--color-status-success);
  }
  .ss-badge--error {
    background: color-mix(in srgb, var(--color-status-error) 15%, transparent);
    color: var(--color-status-error);
  }
  .ss-badge--warning {
    background: color-mix(in srgb, var(--color-status-warning) 15%, transparent);
    color: var(--color-status-warning);
  }
</style>
`;
}

function generateContainerComponent() {
  return `---
interface Props {
  size?: 'sm' | 'md' | 'lg' | 'full';
  class?: string;
}

const { size = 'md', class: className = '' } = Astro.props;

const maxWidths = {
  sm: '640px',
  md: '1024px',
  lg: '1280px',
  full: '100%'
};
---

<div class:list={['ss-container', className]} style={\`max-width: \${maxWidths[size]}\`}>
  <slot />
</div>

<style>
  .ss-container {
    width: 100%;
    margin-inline: auto;
    padding-inline: var(--space-lg);
  }
</style>
`;
}

function generateComponentIndex() {
  return `export { default as Card } from './Card.astro';
export { default as Button } from './Button.astro';
export { default as Input } from './Input.astro';
export { default as Badge } from './Badge.astro';
export { default as Container } from './Container.astro';
`;
}

function generateReadme(packageName, tokens) {
  return `# ${packageName}

An Astro theme integration generated by [Style Set](https://styleset.app).

**Style:** ${tokens.meta?.style || 'Custom'}
**Font:** ${tokens.typography.fontFamily.sans || 'Inter'}

## Quick Start

\`\`\`bash
npm install ${packageName}
\`\`\`

### 1. Add the integration

\`\`\`js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import styleSetTheme from '${packageName}';

export default defineConfig({
  integrations: [styleSetTheme()],
});
\`\`\`

### 2. (Optional) Use with Tailwind

\`\`\`js
// tailwind.config.mjs
import themePreset from '${packageName}/tailwind-preset';

export default {
  presets: [themePreset],
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx,vue}',
    './node_modules/${packageName}/src/components/**/*.astro',
  ],
};
\`\`\`

### 3. Use components

\`\`\`astro
---
import Card from '${packageName}/components/Card.astro';
import Button from '${packageName}/components/Button.astro';
import Input from '${packageName}/components/Input.astro';
---

<Card>
  <h2>Hello World</h2>
  <p>This card uses your theme styles automatically.</p>
  <Button variant="primary" href="/get-started">Get Started</Button>
</Card>
\`\`\`

### 4. Use CSS classes directly

The theme injects global CSS classes you can use anywhere:

- \`.card\` - Styled container
- \`.btn\`, \`.btn-primary\`, \`.btn-secondary\` - Buttons
- \`.input\` - Form inputs
- \`.badge\` - Status badges

### 5. Use CSS custom properties

All design tokens are available as CSS variables:

\`\`\`css
.my-element {
  color: var(--color-text-primary);
  background: var(--color-surface-base);
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-base);
  font-family: var(--font-sans);
}
\`\`\`

## Design Tokens

| Token | Value |
|-------|-------|
| Brand | \`${tokens.colors.brand.DEFAULT}\` |
| Surface | \`${tokens.colors.surface.canvas}\` |
| Text | \`${tokens.colors.text.primary}\` |
| Radius | \`${tokens.borders.radius.DEFAULT}\` |
| Shadow | \`${tokens.shadows.DEFAULT}\` |
| Font | \`${tokens.typography.fontFamily.sans}\` |

---

Generated by [Style Set](https://styleset.app) - Set your UI and forget it.
`;
}

export default { generateAstroThemePackage };
