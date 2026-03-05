/**
 * Astro Theme Generator - Main Entry
 *
 * The complete pipeline:
 *   Screenshot/Style Set Config → Unified Tokens → Astro Theme Package
 *
 * Three input modes:
 *   1. fromStyleSet()  - Style Set renderer config (style name + palette + font)
 *   2. fromMentor()    - Mentor's "Style Guide Generator" prompt output
 *   3. fromTokens()    - Raw unified tokens (for advanced users)
 */

import { fromStyleSetConfig, fromMentorPromptOutput } from './style-to-tokens.js';
import { generateCSS } from './tokens-to-css.js';
import { generateTailwindPreset, generateTailwindPresetWithVars } from './tokens-to-tailwind.js';
import { generateAstroThemePackage } from './generate-astro-theme.js';

/**
 * Generate a complete Astro theme from Style Set renderer config.
 * This is the main function the app will call.
 *
 * @param {object} styleSetConfig - From the Style Set renderer UI
 * @param {string} styleSetConfig.style - Named style (e.g. 'neomorphism')
 * @param {string} [styleSetConfig.accentStyle] - Secondary style to mix
 * @param {string} [styleSetConfig.palette] - Named color palette
 * @param {string} [styleSetConfig.font] - Font family name
 * @param {boolean} [styleSetConfig.highContrast] - High contrast mode
 * @param {object} [styleSetConfig.customColors] - Custom color overrides
 * @param {string} [styleSetConfig.themeName] - Name for the theme
 * @param {object} [packageOptions] - npm package options
 * @returns {object} { tokens, css, tailwindPreset, package: { files } }
 */
export function fromStyleSet(styleSetConfig, packageOptions = {}) {
  const tokens = fromStyleSetConfig(styleSetConfig);
  return buildOutput(tokens, packageOptions);
}

/**
 * Generate a complete Astro theme from the mentor's Style Guide Generator output.
 * User provides a screenshot → mentor's prompt extracts design DNA → this converts to theme.
 *
 * @param {object} mentorOutput - The JSON output from the mentor's prompt
 * @param {object} [packageOptions] - npm package options
 * @returns {object} { tokens, css, tailwindPreset, package: { files } }
 */
export function fromMentor(mentorOutput, packageOptions = {}) {
  const tokens = fromMentorPromptOutput(mentorOutput);
  return buildOutput(tokens, packageOptions);
}

/**
 * Generate a complete Astro theme from raw unified tokens.
 *
 * @param {object} tokens - Unified design tokens
 * @param {object} [packageOptions] - npm package options
 * @returns {object} { tokens, css, tailwindPreset, package: { files } }
 */
export function fromTokens(tokens, packageOptions = {}) {
  return buildOutput(tokens, packageOptions);
}

/**
 * Internal: Build all outputs from tokens
 */
function buildOutput(tokens, packageOptions) {
  return {
    tokens,
    css: generateCSS(tokens),
    tailwindPreset: generateTailwindPreset(tokens),
    tailwindPresetVars: generateTailwindPresetWithVars(),
    package: {
      files: generateAstroThemePackage(tokens, packageOptions)
    }
  };
}

/**
 * Quick export: just the CSS stylesheet (no package, no tailwind)
 * For users who just want to drop a .css file into their project
 */
export function exportCSS(styleSetConfig) {
  const tokens = fromStyleSetConfig(styleSetConfig);
  return generateCSS(tokens);
}

/**
 * Quick export: just the Tailwind preset
 * For users who already have Tailwind set up
 */
export function exportTailwind(styleSetConfig) {
  const tokens = fromStyleSetConfig(styleSetConfig);
  return generateTailwindPreset(tokens);
}

export {
  fromStyleSetConfig,
  fromMentorPromptOutput,
  generateCSS,
  generateTailwindPreset,
  generateTailwindPresetWithVars,
  generateAstroThemePackage
};

export default {
  fromStyleSet,
  fromMentor,
  fromTokens,
  exportCSS,
  exportTailwind
};
