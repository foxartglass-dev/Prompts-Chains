/**
 * Elementor Style Extractor Service
 * Fetches Elementor page data from WordPress and extracts reusable styles AND structure
 *
 * ENHANCED: Now captures page STRUCTURE in addition to styling:
 * - FAQ formatting (bold questions, spacing, numbering)
 * - Section layout patterns
 * - Stats bar presence and position
 * - CTA button placement
 * - Hero section layout
 */

import { createAuthHeader } from './wordpress-publisher.js';

/**
 * Fetch a WordPress page with Elementor data
 * @param {Object} params - Parameters
 * @param {string} params.wpUrl - WordPress site URL
 * @param {string} params.wpUser - WordPress username
 * @param {string} params.wpPassword - WordPress application password
 * @param {number} params.pageId - WordPress page ID to fetch
 * @returns {Promise<Object>} Page data including _elementor_data
 */
export async function fetchWordPressPage({ wpUrl, wpUser, wpPassword, pageId }) {
  const baseUrl = wpUrl.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/wp-json/wp/v2/pages/${pageId}?context=edit`;

  console.log(`[ElementorStyleExtractor] Fetching page ${pageId} from ${baseUrl}`);

  const response = await fetch(endpoint, {
    headers: {
      'Authorization': createAuthHeader(wpUser, wpPassword)
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch page ${pageId}: ${response.status} - ${errorText}`);
  }

  const pageData = await response.json();

  // Check if Elementor data exists
  if (!pageData.meta || !pageData.meta._elementor_data) {
    throw new Error(`Page ${pageId} does not have Elementor data. Make sure the page was built with Elementor.`);
  }

  return {
    id: pageData.id,
    title: pageData.title?.rendered || '',
    link: pageData.link || '',
    elementorData: pageData.meta._elementor_data
  };
}

/**
 * Extract styles from Elementor JSON data
 * Traverses the element tree and pulls out styling information
 * @param {string} elementorDataJson - JSON string of _elementor_data
 * @returns {Object} Extracted styles organized by element type
 */
export function extractStylesFromElementorData(elementorDataJson) {
  let elements;
  try {
    elements = typeof elementorDataJson === 'string'
      ? JSON.parse(elementorDataJson)
      : elementorDataJson;
  } catch (e) {
    throw new Error(`Failed to parse Elementor data: ${e.message}`);
  }

  const styles = {
    button: null,
    h1: null,
    h2: null,
    h3: null,
    text: null,
    container: null,
    hero: null,
    image: null,
    statsBar: null,
    // Track what we found
    foundElements: [],

    // STRUCTURE PATTERNS - captures how content is laid out, not just styled
    structure: {
      // FAQ section structure
      faq: {
        detected: false,
        headingFormat: null,        // 'simple' (just "FAQs") or 'extended' ("FAQs: Location Name")
        questionFormat: 'bold',      // 'bold', 'h3', 'numbered', 'plain'
        questionNumbered: false,     // true if questions have numbers like "1. Question?"
        answerFormat: 'plain',       // 'plain', 'italic', etc.
        spacingBetweenQA: 'tight',   // 'tight' (no gap) or 'spaced' (blank line)
        spacingBetweenPairs: 'spaced' // 'tight' or 'spaced' between Q&A pairs
      },
      // Section structure
      sections: {
        ctaAfterEachSection: false,  // CTA button after every content section
        ctaAtEnd: true,              // CTA only at end
        ctaInHero: true              // CTA in hero section
      },
      // Stats bar
      statsBar: {
        detected: false,
        position: null,              // 'middle', 'bottom', or null
        stats: []                    // Array of { value, label } from the actual stats bar
      },
      // Hero section
      hero: {
        imageSide: 'right',          // 'left' or 'right'
        hasHeadline: true,
        hasSubtext: true,
        hasCta: true
      },
      // Banner/card elements (for future rotation feature)
      banners: {
        detected: false,
        positions: [],               // Where banners appear
        items: []                    // Banner content for rotation
      }
    }
  };

  // Track state during traversal for structure detection
  let sectionIndex = 0;
  let totalSections = 0;
  let ctaCount = 0;
  let statsBarSectionIndex = null;
  let heroDetected = false;
  let currentSectionHasHeading = false;
  let textWidgetsInCurrentSection = [];

  // First pass: count sections
  function countSections(elements) {
    let count = 0;
    if (!Array.isArray(elements)) return count;
    for (const el of elements) {
      if (el.elType === 'container' && !el.isInner) {
        count++;
      }
    }
    return count;
  }
  totalSections = countSections(elements);

  /**
   * Recursively traverse Elementor elements
   */
  function traverse(elements, depth = 0, parentType = null, containerIndex = 0) {
    if (!Array.isArray(elements)) return;

    for (const el of elements) {
      // Track container padding and gaps at top level
      if (el.elType === 'container' && depth === 0) {
        extractContainerStyles(el, styles);
        sectionIndex++;
        currentSectionHasHeading = false;
        textWidgetsInCurrentSection = [];

        // Detect hero section (first section with row direction)
        if (!heroDetected && el.settings?.flex_direction === 'row') {
          heroDetected = true;
          // Analyze hero structure
          analyzeHeroStructure(el, styles);
        }
      }

      // Extract widget-specific styles
      if (el.widgetType) {
        switch (el.widgetType) {
          case 'button':
            ctaCount++;
            if (!styles.button) {
              styles.button = extractButtonStyles(el);
              styles.foundElements.push('button');
            }
            // Track CTA placement
            if (sectionIndex === 1 && heroDetected) {
              styles.structure.sections.ctaInHero = true;
            }
            break;

          case 'heading':
            extractHeadingStyles(el, styles);
            currentSectionHasHeading = true;

            // Detect FAQ section by heading text
            const headingText = el.settings?.title || '';
            if (isFaqHeading(headingText)) {
              styles.structure.faq.detected = true;
              styles.foundElements.push('faq-section');
              // Analyze if heading is simple "FAQs" or extended "FAQs: Location"
              if (headingText.includes(':')) {
                styles.structure.faq.headingFormat = 'extended';
              } else {
                styles.structure.faq.headingFormat = 'simple';
              }
            }
            break;

          case 'text-editor':
            if (!styles.text) {
              styles.text = extractTextStyles(el);
              styles.foundElements.push('text');
            }
            textWidgetsInCurrentSection.push(el);

            // Analyze text content for FAQ structure
            const textContent = el.settings?.editor || '';
            if (styles.structure.faq.detected || containsFaqContent(textContent)) {
              analyzeFaqStructure(textContent, styles);
            }
            break;

          case 'image':
            if (!styles.image) {
              styles.image = extractImageStyles(el);
              styles.foundElements.push('image');
            }
            break;

          case 'icon-box':
            // Stats bar indicator
            if (parentType === 'container') {
              if (!styles.statsBar) {
                styles.statsBar = { detected: true };
                styles.foundElements.push('statsBar');
              }
              statsBarSectionIndex = sectionIndex;
              styles.structure.statsBar.detected = true;
              // Extract stat values
              const statValue = el.settings?.title_text || '';
              const statLabel = el.settings?.description_text || '';
              if (statValue || statLabel) {
                styles.structure.statsBar.stats.push({ value: statValue, label: statLabel });
              }
            }
            break;
        }
      }

      // Check for gradient backgrounds (stats bar)
      if (el.settings?.background_background === 'gradient') {
        styles.statsBar = {
          ...styles.statsBar,
          background_color: el.settings.background_color,
          gradient_color_b: el.settings.background_color_b,
          gradient_angle: el.settings.background_gradient_angle,
          padding: el.settings.padding
        };
      }

      // Recurse into children
      if (el.elements) {
        traverse(el.elements, depth + 1, el.elType, sectionIndex);
      }
    }
  }

  traverse(elements);

  // Post-processing: determine stats bar position
  if (styles.structure.statsBar.detected && statsBarSectionIndex !== null) {
    const relativePosition = statsBarSectionIndex / totalSections;
    if (relativePosition < 0.3) {
      styles.structure.statsBar.position = 'top';
    } else if (relativePosition > 0.7) {
      styles.structure.statsBar.position = 'bottom';
    } else {
      styles.structure.statsBar.position = 'middle';
    }
  }

  // Determine CTA placement pattern
  if (ctaCount > 0) {
    // If CTAs appear in most sections, it's "after each section"
    // Otherwise it's just at specific points
    const ctaRatio = ctaCount / totalSections;
    styles.structure.sections.ctaAfterEachSection = ctaRatio > 0.5;
    styles.structure.sections.ctaAtEnd = ctaCount >= 1;
  }

  traverse(elements);

  return styles;
}

/**
 * Extract button widget styles
 */
function extractButtonStyles(el) {
  const s = el.settings || {};
  return {
    background_color: s.background_color || s.button_background_color,
    text_color: s.text_color || s.button_text_color,
    border_radius: s.border_radius,
    padding: s.text_padding,
    typography: {
      font_family: s.typography_font_family,
      font_size: s.typography_font_size,
      font_weight: s.typography_font_weight,
      text_transform: s.typography_text_transform
    },
    hover_background: s.background_hover_color || s.button_background_hover_color,
    hover_text_color: s.hover_color || s.button_text_hover_color
  };
}

/**
 * Extract heading styles (h1, h2, h3)
 */
function extractHeadingStyles(el, styles) {
  const s = el.settings || {};
  const tag = s.header_size || 'h2';

  // Only capture first instance of each heading level
  if (styles[tag]) return;

  styles[tag] = {
    color: s.title_color,
    typography: {
      font_family: s.typography_font_family,
      font_size: s.typography_font_size,
      font_weight: s.typography_font_weight,
      line_height: s.typography_line_height,
      letter_spacing: s.typography_letter_spacing,
      text_transform: s.typography_text_transform
    },
    align: s.align
  };

  if (!styles.foundElements.includes(tag)) {
    styles.foundElements.push(tag);
  }
}

/**
 * Extract text editor styles
 */
function extractTextStyles(el) {
  const s = el.settings || {};
  return {
    color: s.text_color,
    typography: {
      font_family: s.typography_font_family,
      font_size: s.typography_font_size,
      font_weight: s.typography_font_weight,
      line_height: s.typography_line_height,
      letter_spacing: s.typography_letter_spacing
    }
  };
}

/**
 * Extract image widget styles
 */
function extractImageStyles(el) {
  const s = el.settings || {};
  return {
    border_radius: s.image_border_radius,
    opacity: s.opacity,
    css_filters: s.css_filters,
    hover_animation: s.hover_animation
  };
}

/**
 * Extract container/section styles
 */
function extractContainerStyles(el, styles) {
  const s = el.settings || {};

  // Check if this looks like a hero section (row direction at top level)
  if (s.flex_direction === 'row' && !styles.hero) {
    styles.hero = {
      padding: s.padding,
      gap: s.flex_gap,
      content_width: s.content_width,
      boxed_width: s.boxed_width,
      align_items: s.flex_align_items
    };
    styles.foundElements.push('hero');
  }

  // General container styles (first column container found)
  if (!styles.container && s.flex_direction === 'column') {
    styles.container = {
      padding: s.padding,
      gap: s.flex_gap,
      content_width: s.content_width,
      boxed_width: s.boxed_width
    };
    styles.foundElements.push('container');
  }
}

/**
 * Check if a heading text indicates an FAQ section
 */
function isFaqHeading(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return lower.includes('faq') ||
         lower.includes('frequently asked') ||
         lower.includes('common questions') ||
         lower === 'questions' ||
         lower === 'q&a' ||
         lower === 'q & a';
}

/**
 * Check if text content contains FAQ patterns (questions and answers)
 */
function containsFaqContent(content) {
  if (!content) return false;
  // Look for question patterns: text ending with ? followed by answer text
  const questionPattern = /\?[\s\S]*?[.!]/;
  // Look for bold questions
  const boldQuestionPattern = /<strong>[^<]+\?<\/strong>/i;
  return questionPattern.test(content) || boldQuestionPattern.test(content);
}

/**
 * Analyze FAQ content structure to detect formatting patterns
 */
function analyzeFaqStructure(content, styles) {
  if (!content) return;

  const faq = styles.structure.faq;

  // Check for numbered questions: "1. Question?" or "1) Question?"
  if (/^\s*\d+[\.\)]\s*[^?]+\?/m.test(content)) {
    faq.questionNumbered = true;
  }

  // Check for bold questions: <strong>Question?</strong>
  if (/<strong>[^<]+\?<\/strong>/i.test(content)) {
    faq.questionFormat = 'bold';
  }
  // Check for H3 questions
  else if (/<h3[^>]*>[^<]+\?<\/h3>/i.test(content)) {
    faq.questionFormat = 'h3';
  }
  // Plain text questions
  else if (/^[^<\n]+\?$/m.test(content)) {
    faq.questionFormat = 'plain';
  }

  // Check spacing patterns
  // Tight: question immediately followed by answer (just newline)
  // Spaced: blank line between question and answer
  if (/<\/strong>\s*\n\s*\n/.test(content) || /\?\s*\n\s*\n/.test(content)) {
    faq.spacingBetweenQA = 'spaced';
  } else {
    faq.spacingBetweenQA = 'tight';
  }

  // Check spacing between Q&A pairs
  // Look for pattern: answer ending with period, then gap before next question
  if (/[.!]\s*\n\s*\n\s*(<strong>|<h3|\d+[\.\)])/i.test(content)) {
    faq.spacingBetweenPairs = 'spaced';
  } else {
    faq.spacingBetweenPairs = 'tight';
  }
}

/**
 * Analyze hero section structure
 */
function analyzeHeroStructure(heroElement, styles) {
  if (!heroElement || !heroElement.elements) return;

  const hero = styles.structure.hero;
  let foundImage = false;
  let foundHeading = false;
  let foundText = false;
  let foundButton = false;
  let imageIsFirst = false;

  // Check children to determine layout
  function scanChildren(elements, isFirst = true) {
    if (!Array.isArray(elements)) return;

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];

      if (el.widgetType === 'image') {
        foundImage = true;
        if (isFirst && i === 0) {
          imageIsFirst = true;
        }
      } else if (el.widgetType === 'heading') {
        foundHeading = true;
      } else if (el.widgetType === 'text-editor') {
        foundText = true;
      } else if (el.widgetType === 'button') {
        foundButton = true;
      }

      // Check inner containers
      if (el.elType === 'container' && el.elements) {
        // If first inner container has image, image is on left
        if (el.elements.some(child => child.widgetType === 'image')) {
          if (i === 0) imageIsFirst = true;
        }
        scanChildren(el.elements, false);
      }
    }
  }

  scanChildren(heroElement.elements);

  // Determine image side based on order
  hero.imageSide = imageIsFirst ? 'left' : 'right';
  hero.hasHeadline = foundHeading;
  hero.hasSubtext = foundText;
  hero.hasCta = foundButton;
}

/**
 * Convert extracted styles to database-ready format
 * Maps the nested style object to flat database columns
 */
export function stylesToDatabaseFormat(styles, sourceInfo) {
  return {
    source_page_id: sourceInfo.pageId,
    source_page_url: sourceInfo.url,
    source_page_title: sourceInfo.title,

    // Button
    button_background_color: styles.button?.background_color || null,
    button_text_color: styles.button?.text_color || null,
    button_border_radius: styles.button?.border_radius?.size
      ? `${styles.button.border_radius.size}${styles.button.border_radius.unit || 'px'}`
      : null,
    button_padding: styles.button?.padding || null,
    button_typography: styles.button?.typography || null,

    // Headings
    h1_color: styles.h1?.color || null,
    h1_typography: styles.h1?.typography || null,
    h2_color: styles.h2?.color || null,
    h2_typography: styles.h2?.typography || null,
    h3_color: styles.h3?.color || null,
    h3_typography: styles.h3?.typography || null,

    // Body text
    text_color: styles.text?.color || null,
    text_typography: styles.text?.typography || null,

    // Containers
    container_padding: styles.container?.padding || null,
    section_gap: styles.container?.gap?.column
      ? `${styles.container.gap.column}${styles.container.gap.unit || 'px'}`
      : null,
    content_width: styles.container?.boxed_width?.size || null,

    // Hero
    hero_padding: styles.hero?.padding || null,
    hero_gap: styles.hero?.gap?.column
      ? `${styles.hero.gap.column}${styles.hero.gap.unit || 'px'}`
      : null,

    // Image
    image_border_radius: styles.image?.border_radius?.size
      ? `${styles.image.border_radius.size}${styles.image.border_radius.unit || 'px'}`
      : null,

    // Stats bar
    stats_background_color: styles.statsBar?.background_color || null,
    stats_gradient: styles.statsBar?.gradient_color_b ? {
      color_a: styles.statsBar.background_color,
      color_b: styles.statsBar.gradient_color_b,
      angle: styles.statsBar.gradient_angle?.size || 90
    } : null,
    stats_padding: styles.statsBar?.padding || null,

    // STRUCTURE PATTERNS - how content is laid out
    structure: styles.structure || null,

    // Full data backup (includes both styles AND structure)
    extracted_styles: styles
  };
}

/**
 * Format styles for preview display
 * Creates a human-readable summary of extracted styles
 */
export function formatStylesForPreview(styles) {
  const preview = {
    summary: `Found ${styles.foundElements.length} element types: ${styles.foundElements.join(', ')}`,
    elements: {}
  };

  if (styles.button) {
    preview.elements.button = {
      'Background': styles.button.background_color || 'not set',
      'Text Color': styles.button.text_color || 'not set',
      'Font': styles.button.typography?.font_family || 'not set',
      'Padding': styles.button.padding ?
        `${styles.button.padding.top || 0}/${styles.button.padding.right || 0}/${styles.button.padding.bottom || 0}/${styles.button.padding.left || 0}`
        : 'not set'
    };
  }

  if (styles.h1) {
    preview.elements.h1 = {
      'Color': styles.h1.color || 'not set',
      'Font': styles.h1.typography?.font_family || 'not set',
      'Size': styles.h1.typography?.font_size?.size
        ? `${styles.h1.typography.font_size.size}${styles.h1.typography.font_size.unit || 'px'}`
        : 'not set',
      'Weight': styles.h1.typography?.font_weight || 'not set'
    };
  }

  if (styles.h2) {
    preview.elements.h2 = {
      'Color': styles.h2.color || 'not set',
      'Font': styles.h2.typography?.font_family || 'not set',
      'Size': styles.h2.typography?.font_size?.size
        ? `${styles.h2.typography.font_size.size}${styles.h2.typography.font_size.unit || 'px'}`
        : 'not set',
      'Weight': styles.h2.typography?.font_weight || 'not set'
    };
  }

  if (styles.text) {
    preview.elements.text = {
      'Color': styles.text.color || 'not set',
      'Font': styles.text.typography?.font_family || 'not set',
      'Size': styles.text.typography?.font_size?.size
        ? `${styles.text.typography.font_size.size}${styles.text.typography.font_size.unit || 'px'}`
        : 'not set',
      'Line Height': styles.text.typography?.line_height?.size
        ? `${styles.text.typography.line_height.size}${styles.text.typography.line_height.unit || 'px'}`
        : 'not set'
    };
  }

  if (styles.hero) {
    preview.elements.hero = {
      'Padding': styles.hero.padding ?
        `${styles.hero.padding.top || 0}/${styles.hero.padding.right || 0}/${styles.hero.padding.bottom || 0}/${styles.hero.padding.left || 0}`
        : 'not set',
      'Gap': styles.hero.gap?.column
        ? `${styles.hero.gap.column}${styles.hero.gap.unit || 'px'}`
        : 'not set',
      'Width': styles.hero.boxed_width?.size
        ? `${styles.hero.boxed_width.size}px`
        : 'not set'
    };
  }

  if (styles.container) {
    preview.elements.container = {
      'Padding': styles.container.padding ?
        `${styles.container.padding.top || 0}/${styles.container.padding.right || 0}/${styles.container.padding.bottom || 0}/${styles.container.padding.left || 0}`
        : 'not set',
      'Gap': styles.container.gap?.column
        ? `${styles.container.gap.column}${styles.container.gap.unit || 'px'}`
        : 'not set',
      'Width': styles.container.boxed_width?.size
        ? `${styles.container.boxed_width.size}px`
        : 'not set'
    };
  }

  if (styles.statsBar?.background_color) {
    preview.elements.statsBar = {
      'Background': styles.statsBar.background_color,
      'Gradient To': styles.statsBar.gradient_color_b || 'none',
      'Angle': styles.statsBar.gradient_angle?.size
        ? `${styles.statsBar.gradient_angle.size}deg`
        : '90deg'
    };
  }

  // Add STRUCTURE patterns to preview
  if (styles.structure) {
    preview.structure = {};

    // FAQ structure
    if (styles.structure.faq?.detected) {
      preview.structure.faq = {
        'Heading Format': styles.structure.faq.headingFormat === 'simple'
          ? 'Simple (just "FAQs")'
          : 'Extended (includes location/topic)',
        'Question Style': styles.structure.faq.questionFormat === 'bold'
          ? 'Bold text'
          : styles.structure.faq.questionFormat === 'h3'
          ? 'H3 heading'
          : styles.structure.faq.questionFormat === 'numbered'
          ? 'Numbered'
          : 'Plain text',
        'Questions Numbered': styles.structure.faq.questionNumbered ? 'Yes' : 'No',
        'Q&A Spacing': styles.structure.faq.spacingBetweenQA === 'tight'
          ? 'Tight (no gap)'
          : 'Spaced (blank line)',
        'Between Pairs': styles.structure.faq.spacingBetweenPairs === 'tight'
          ? 'Tight'
          : 'Spaced'
      };
    }

    // Stats bar structure
    if (styles.structure.statsBar?.detected) {
      preview.structure.statsBar = {
        'Detected': 'Yes',
        'Position': styles.structure.statsBar.position || 'unknown',
        'Stats Count': styles.structure.statsBar.stats?.length || 0
      };
      if (styles.structure.statsBar.stats?.length > 0) {
        preview.structure.statsBar['Stats'] = styles.structure.statsBar.stats
          .map(s => `${s.value}: ${s.label}`)
          .join(', ');
      }
    }

    // Hero structure
    if (styles.structure.hero) {
      preview.structure.hero = {
        'Image Side': styles.structure.hero.imageSide || 'right',
        'Has Headline': styles.structure.hero.hasHeadline ? 'Yes' : 'No',
        'Has Subtext': styles.structure.hero.hasSubtext ? 'Yes' : 'No',
        'Has CTA Button': styles.structure.hero.hasCta ? 'Yes' : 'No'
      };
    }

    // Section/CTA structure
    if (styles.structure.sections) {
      preview.structure.sections = {
        'CTA After Each Section': styles.structure.sections.ctaAfterEachSection ? 'Yes' : 'No',
        'CTA In Hero': styles.structure.sections.ctaInHero ? 'Yes' : 'No'
      };
    }
  }

  return preview;
}

export default {
  fetchWordPressPage,
  extractStylesFromElementorData,
  stylesToDatabaseFormat,
  formatStylesForPreview
};
