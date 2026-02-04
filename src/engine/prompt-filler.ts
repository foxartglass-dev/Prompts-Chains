// PromptFlow Engine - Template Filling Logic
// This is the HEART of the prompt chaining system

import { WorkflowItem, ProjectConfig } from './types';

/**
 * Fill a prompt template with all variable types:
 *
 * Variable Syntax:
 * - [[{opt1}or{opt2}]] → Randomly pick ONE of the options (OR syntax)
 * - [output_key]     → Output from a previous prompt in the chain
 * - {{{snippet}}}    → Tagged snippet (different value per tag)
 * - {key{TAG}}       → Tagged placeholder (specific to one tag)
 * - {key}            → Global placeholder (same for all items)
 * - {item_name}      → The name of the current workflow item
 *
 * @param template - The prompt template with variables
 * @param item - The current workflow item being processed
 * @param config - The project configuration with placeholders, snippets, etc.
 * @param previousOutputs - Outputs from earlier prompts in this workflow run
 * @returns The filled prompt ready to send to an LLM
 */
export function fillPrompt(
  template: string,
  item: WorkflowItem,
  config: ProjectConfig,
  previousOutputs: Record<string, string> = {}
): string {
  let filled = template;

  // 0. Replace [[{opt1}or{opt2}or{opt3}]] with a randomly chosen option
  // This must happen FIRST so the chosen placeholder can be resolved later
  filled = filled.replace(/\[\[(.+?)\]\]/g, (match, inner) => {
    // Split by "or" (case-insensitive, with optional whitespace)
    const options = inner.split(/\s*or\s*/i).map((opt: string) => opt.trim());
    if (options.length < 2) {
      // Not a valid OR pattern, return unchanged
      return match;
    }
    // Randomly pick one option
    const randomIndex = Math.floor(Math.random() * options.length);
    return options[randomIndex];
  });

  // 1. Replace [output_key] with previous prompt outputs
  filled = filled.replace(/\[([^\]]+)\]/g, (match, key) => {
    const trimmedKey = key.trim();
    return previousOutputs[trimmedKey] || match;
  });

  // 2. Replace {{{snippet}}} with tagged snippet values
  if (item.tag) {
    const itemTag = item.tag;
    config.taggedSnippets.forEach(snippet => {
      const snippetValue = snippet.values[itemTag] || '';
      const regex = new RegExp(`\\{\\{\\{${escapeRegex(snippet.key)}\\}\\}\\}`, 'g');
      filled = filled.replace(regex, snippetValue);
    });
  }

  // 3. Replace {key{TAG}} with tagged placeholder values
  const taggedPlaceholders = config.placeholders.filter(p => p.tag === item.tag);
  taggedPlaceholders.forEach(p => {
    const regex = new RegExp(`\\{${escapeRegex(p.key)}\\{${escapeRegex(p.tag!)}\\}\\}`, 'g');
    filled = filled.replace(regex, p.value);
  });

  // 4. Replace {key} with global placeholder values
  const globalPlaceholders = config.placeholders.filter(p => !p.tag);
  globalPlaceholders.forEach(p => {
    const regex = new RegExp(`\\{${escapeRegex(p.key)}\\}`, 'g');
    filled = filled.replace(regex, p.value);
  });

  // 5. Replace {item_name} with the current item's name (tag stripped)
  // IMPORTANT: Strip tag suffixes like (H), (J), (C) from the name before sending to AI
  // These tags are for internal routing (image matching, component selection) only
  // The AI should never see them, or it will include them in generated headings
  // See Blueprint > Known Issues > "Tag Stripping" for full documentation
  const cleanItemName = item.name.replace(/\s*\([A-Za-z]\)\s*$/, '').trim();
  filled = filled.replace(/{item_name}/g, cleanItemName);

  return filled;
}

/**
 * Parse the final output to extract meta titles and descriptions
 * Expected format:
 * [Content]
 * ---META TITLES---
 * 1. Title 1
 * 2. Title 2
 * ---META DESCRIPTIONS---
 * 1. Description 1
 * 2. Description 2
 */
export function parseFinalOutput(text: string): {
  finalOutput: string;
  metaTitles: string[];
  metaDescriptions: string[];
} {
  const metaTitlesSeparator = '---META TITLES---';
  const metaDescriptionsSeparator = '---META DESCRIPTIONS---';

  const titlesStart = text.indexOf(metaTitlesSeparator);
  const descriptionsStart = text.indexOf(metaDescriptionsSeparator);

  // Extract main content (everything before META TITLES)
  const finalOutput = titlesStart !== -1
    ? text.substring(0, titlesStart).trim()
    : text.trim();

  // Extract titles
  let metaTitles: string[] = [];
  if (titlesStart !== -1) {
    const titlesEnd = descriptionsStart !== -1 ? descriptionsStart : undefined;
    const titlesBlock = text.substring(titlesStart + metaTitlesSeparator.length, titlesEnd).trim();
    metaTitles = titlesBlock
      .split('\n')
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
  }

  // Extract descriptions
  let metaDescriptions: string[] = [];
  if (descriptionsStart !== -1) {
    const descriptionsBlock = text.substring(descriptionsStart + metaDescriptionsSeparator.length).trim();
    metaDescriptions = descriptionsBlock
      .split('\n')
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
  }

  return { finalOutput, metaTitles, metaDescriptions };
}

/**
 * Fill a simple template (for filenames, WordPress titles, etc.)
 * Supports both {curly braces} and <angle brackets> syntax
 */
export function fillSimpleTemplate(
  template: string,
  data: Record<string, string | null | undefined>
): string {
  let result = template;
  // First pass: handle <angle brackets>
  result = result.replace(/<([^<>]+)>/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = data[trimmedKey];
    return value !== null && value !== undefined ? String(value) : match;
  });
  // Second pass: handle {curly braces}
  result = result.replace(/{([^{}]+)}/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = data[trimmedKey];
    return value !== null && value !== undefined ? String(value) : match;
  });
  return result;
}

/**
 * Generate a filename for an output file
 */
export function generateFilename(
  item: WorkflowItem,
  status: string,
  extension: string,
  template: string
): string {
  const sanitizedName = item.name
    .replace(/\(.\)$/, '')
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase();

  const data = {
    tag: item.tag?.toLowerCase() || 'x',
    item_name: sanitizedName,
    status: status.toLowerCase(),
  };

  return fillSimpleTemplate(template, data) + `.${extension}`;
}

// Helper to escape special regex characters
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
