/**
 * Elementor JSON Builder Service
 * Builds Elementor page structure from chunked content
 *
 * Based on analysis of actual Elementor pages:
 * - Uses container/widget structure
 * - Images embedded in text-editor HTML with alignleft/alignright classes
 * - Hero section has side-by-side layout (text left, image right)
 * - Body content uses text wrapping around images
 *
 * TEMPLATE STYLES: Can now use imported styles from workflow_elementor_styles table
 * If templateStyles is passed to buildElementorPage, those values override defaults
 */

/**
 * Default styles - used when no template is configured
 * These are the fallback hardcoded values
 */
const DEFAULT_STYLES = {
  // Heading styles
  heading: {
    font_family: 'Roboto',
    font_weight: '700'
  },
  // H1 specific
  h1: {
    color: null, // inherit
    typography: { font_family: 'Roboto', font_weight: '700' }
  },
  // H2 specific
  h2: {
    color: null,
    typography: { font_family: 'Roboto', font_weight: '700' }
  },
  // Body text styles
  text: {
    font_family: 'Poppins',
    font_size: 16,
    line_height: 29
  },
  // Button styles
  button: {
    background_color: '#0064A1',
    text_color: null,
    padding: { top: '10', right: '50', bottom: '10', left: '50' }
  },
  // Container/layout styles
  container: {
    boxed_width: 1140,
    padding: { top: '30', right: '20', bottom: '30', left: '20' },
    gap: '20'
  },
  // Hero section
  hero: {
    padding: { top: '60', right: '20', bottom: '60', left: '20' },
    gap: '40'
  },
  // Image styles
  image: {
    max_width: 200,
    float_margin: 20
  },
  // Stats bar
  statsBar: {
    background_color: '#006EB1',
    gradient_color_b: '#0EB7D4',
    gradient_angle: 90,
    padding: { top: '70', right: '0', bottom: '70', left: '0' }
  }
};

// Current styles context - set by buildElementorPage when template is provided
let currentStyles = DEFAULT_STYLES;

/**
 * Get the current style value with fallback to default
 * @param {string} path - Dot notation path like 'button.background_color'
 * @returns {any} Style value
 */
function getStyle(path) {
  const parts = path.split('.');
  let value = currentStyles;
  let defaultValue = DEFAULT_STYLES;

  for (const part of parts) {
    value = value?.[part];
    defaultValue = defaultValue?.[part];
  }

  return value ?? defaultValue;
}

/**
 * Merge template styles with defaults
 * @param {Object} templateStyles - Styles from workflow_elementor_styles table
 * @returns {Object} Merged styles
 */
function mergeStyles(templateStyles) {
  if (!templateStyles) return DEFAULT_STYLES;

  return {
    heading: {
      font_family: templateStyles.h2_typography?.font_family || DEFAULT_STYLES.heading.font_family,
      font_weight: templateStyles.h2_typography?.font_weight || DEFAULT_STYLES.heading.font_weight
    },
    h1: {
      color: templateStyles.h1_color || DEFAULT_STYLES.h1.color,
      typography: templateStyles.h1_typography || DEFAULT_STYLES.h1.typography
    },
    h2: {
      color: templateStyles.h2_color || DEFAULT_STYLES.h2.color,
      typography: templateStyles.h2_typography || DEFAULT_STYLES.h2.typography
    },
    text: {
      font_family: templateStyles.text_typography?.font_family || DEFAULT_STYLES.text.font_family,
      font_size: templateStyles.text_typography?.font_size?.size || DEFAULT_STYLES.text.font_size,
      line_height: templateStyles.text_typography?.line_height?.size || DEFAULT_STYLES.text.line_height,
      color: templateStyles.text_color || null
    },
    button: {
      background_color: templateStyles.button_background_color || DEFAULT_STYLES.button.background_color,
      text_color: templateStyles.button_text_color || DEFAULT_STYLES.button.text_color,
      padding: templateStyles.button_padding || DEFAULT_STYLES.button.padding,
      typography: templateStyles.button_typography || null
    },
    container: {
      boxed_width: templateStyles.content_width || DEFAULT_STYLES.container.boxed_width,
      padding: templateStyles.container_padding || DEFAULT_STYLES.container.padding,
      gap: templateStyles.section_gap || DEFAULT_STYLES.container.gap
    },
    hero: {
      padding: templateStyles.hero_padding || DEFAULT_STYLES.hero.padding,
      gap: templateStyles.hero_gap || DEFAULT_STYLES.hero.gap
    },
    image: {
      max_width: DEFAULT_STYLES.image.max_width,
      float_margin: DEFAULT_STYLES.image.float_margin,
      border_radius: templateStyles.image_border_radius || null
    },
    statsBar: {
      background_color: templateStyles.stats_background_color || DEFAULT_STYLES.statsBar.background_color,
      gradient_color_b: templateStyles.stats_gradient?.color_b || DEFAULT_STYLES.statsBar.gradient_color_b,
      gradient_angle: templateStyles.stats_gradient?.angle || DEFAULT_STYLES.statsBar.gradient_angle,
      padding: templateStyles.stats_padding || DEFAULT_STYLES.statsBar.padding
    }
  };
}

/**
 * Generate a random 8-character hex ID for Elementor elements
 * @returns {string}
 */
function generateElementId() {
  return Math.random().toString(16).substring(2, 10);
}

/**
 * Build an Elementor heading widget
 * @param {string} text - Heading text
 * @param {string} tag - HTML tag (h1, h2, h3, etc.)
 * @param {Object} options - Additional options
 * @returns {Object} Elementor widget object
 */
function buildHeadingWidget(text, tag = 'h2', options = {}) {
  const { align = 'left' } = options;

  // Get typography for this heading level
  const headingStyle = getStyle(tag) || getStyle('heading');
  const typography = headingStyle?.typography || headingStyle;

  const settings = {
    title: text,
    header_size: tag,
    align: align,
    typography_typography: 'custom',
    typography_font_family: typography?.font_family || getStyle('heading.font_family'),
    typography_font_weight: typography?.font_weight || getStyle('heading.font_weight')
  };

  // Add color if specified in template
  const color = headingStyle?.color;
  if (color) {
    settings.title_color = color;
  }

  // Add font size if specified
  if (typography?.font_size) {
    settings.typography_font_size = typeof typography.font_size === 'object'
      ? typography.font_size
      : { unit: 'px', size: typography.font_size };
  }

  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'heading',
    isInner: false,
    settings,
    elements: []
  };
}

/**
 * Convert plain text content to HTML with proper paragraph tags
 * Preserves line breaks and creates proper HTML structure
 * @param {string} content - Plain text or mixed content
 * @param {boolean} isFAQ - Whether this is FAQ content needing special formatting
 * @returns {string} HTML formatted content
 */
function contentToHtml(content, isFAQ = false) {
  if (!content) return '';

  let html = content;

  // If content doesn't already have HTML paragraph tags, convert newlines
  if (!html.includes('<p>') && !html.includes('<p ')) {
    // Split by double newlines (paragraph breaks)
    const paragraphs = html.split(/\n\n+/);

    if (isFAQ) {
      // FAQ special handling: single newlines become <br>, double become new paragraph
      html = paragraphs.map(para => {
        // Convert single newlines within paragraph to <br>
        const withBreaks = para.split('\n').map(line => line.trim()).filter(line => line).join('<br>\n');
        return `<p>${withBreaks}</p>`;
      }).join('\n');
    } else {
      // Regular content: each paragraph gets <p> tags
      html = paragraphs.map(para => {
        const trimmed = para.trim();
        if (!trimmed) return '';
        // Check if already wrapped in a block element
        if (trimmed.startsWith('<')) return trimmed;
        return `<p>${trimmed}</p>`;
      }).filter(p => p).join('\n');
    }
  }

  return html;
}

/**
 * Build an Elementor text-editor widget
 * Optionally embeds an image with text wrapping
 * @param {string} content - HTML content
 * @param {Object} imageData - Optional image data { url, id, alt, width, height }
 * @param {string} imageAlignment - 'left' or 'right'
 * @param {Object} options - Additional options { isFAQ: boolean }
 * @returns {Object} Elementor widget object
 */
function buildTextEditorWidget(content, imageData = null, imageAlignment = 'left', options = {}) {
  const { isFAQ = false } = options;

  // Get styles from template or defaults
  const textStyle = getStyle('text');
  const imageStyle = getStyle('image');
  const maxWidth = imageStyle?.max_width || 200;
  const floatMargin = imageStyle?.float_margin || 20;

  // Convert content to proper HTML
  let htmlContent = contentToHtml(content, isFAQ);

  // If we have image data, embed it at the start with the appropriate alignment
  // Uses inline styles to ensure word wrap works regardless of theme CSS
  if (imageData && (imageData.wpUrl || imageData.url)) {
    // Prefer WordPress URL (permanent) over Replicate URL (temporary)
    const imageUrl = imageData.wpUrl || imageData.url;
    const imageId = imageData.wpMediaId || imageData.id || '';
    // Use imageSide from pipeline if alignment not explicitly set
    const side = imageData.side || imageAlignment;
    const imgClass = side === 'left' ? 'alignleft' : 'alignright';

    // Inline styles ensure word wrap works across all themes
    const floatStyle = side === 'left'
      ? `float: left; margin: 0 ${floatMargin}px 15px 0;`
      : `float: right; margin: 0 0 15px ${floatMargin}px;`;

    const imgTag = `<img class="${imgClass} wp-image-${imageId}" style="${floatStyle} max-width: ${maxWidth}px; height: auto;" src="${imageUrl}" alt="${imageData.alt || ''}" width="${imageData.width || maxWidth}" height="${imageData.height || 250}" />`;

    // Insert image at the beginning of content
    htmlContent = imgTag + htmlContent;
  }

  const settings = {
    editor: htmlContent,
    typography_typography: 'custom',
    typography_font_family: textStyle?.font_family || 'Poppins',
    typography_font_size: { unit: 'px', size: textStyle?.font_size || 16 },
    typography_line_height: { unit: 'px', size: textStyle?.line_height || 29 }
  };

  // Add text color if specified in template
  if (textStyle?.color) {
    settings.text_color = textStyle.color;
  }

  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'text-editor',
    isInner: false,
    settings,
    elements: []
  };
}

/**
 * Build an Elementor image widget (for hero section)
 * @param {Object} imageData - Image data { url, id, alt }
 * @param {Object} options - Additional options
 * @returns {Object} Elementor widget object
 */
function buildImageWidget(imageData, options = {}) {
  const { align = 'center', fitToContainer = false } = options;
  // Prefer WordPress URL (permanent) over Replicate URL (temporary)
  const imageUrl = imageData.wpUrl || imageData.url;
  const imageId = imageData.wpMediaId || imageData.id || 0;

  const settings = {
    image: {
      url: imageUrl,
      id: imageId,
      alt: imageData.alt || ''
    },
    image_size: 'full',
    align: align
  };

  // For hero images: auto-adjust height to match text container
  if (fitToContainer) {
    settings.height = { unit: '%', size: 100 };
    settings.object_fit = 'cover'; // Cover maintains aspect while filling
    settings.object_position = 'center center';
  }

  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'image',
    isInner: false,
    settings,
    elements: []
  };
}

/**
 * Build an Elementor button widget
 * @param {string} text - Button text
 * @param {string} url - Button link URL
 * @param {Object} options - Additional options
 * @returns {Object} Elementor widget object
 */
function buildButtonWidget(text, url, options = {}) {
  const { align = 'center' } = options;

  // Get button styles from template or defaults
  const buttonStyle = getStyle('button');
  const padding = buttonStyle?.padding || { top: '10', right: '50', bottom: '10', left: '50' };

  const settings = {
    text: text,
    link: {
      url: url,
      is_external: '',
      nofollow: ''
    },
    align: align,
    background_color: buttonStyle?.background_color || '#0064A1',
    text_padding: {
      unit: 'px',
      top: padding.top || '10',
      right: padding.right || '50',
      bottom: padding.bottom || '10',
      left: padding.left || '50'
    }
  };

  // Add text color if specified
  if (buttonStyle?.text_color) {
    settings.button_text_color = buttonStyle.text_color;
  }

  // Add typography if specified
  if (buttonStyle?.typography?.font_family) {
    settings.typography_typography = 'custom';
    settings.typography_font_family = buttonStyle.typography.font_family;
    if (buttonStyle.typography.font_weight) {
      settings.typography_font_weight = buttonStyle.typography.font_weight;
    }
  }

  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'button',
    isInner: false,
    settings,
    elements: []
  };
}

/**
 * Build a Slider Revolution widget (shortcode)
 * Used for hero sliders captured from existing pages
 * @param {string} alias - The slider alias (e.g., "home-1")
 * @param {string} moduleName - The slider module name (e.g., "Residential") - from Display Name field
 * @returns {Object} Elementor slider_revolution widget
 */
function buildSliderRevolutionWidget(alias, moduleName) {
  console.log('🎰 [SLIDER DEBUG] buildSliderRevolutionWidget called with alias:', alias, '| moduleName:', moduleName);

  // Clean up the alias - extract from shortcode if provided as full shortcode
  let cleanAlias = alias;
  if (alias && alias.includes('[rev_slider')) {
    // Extract alias from shortcode like [rev_slider alias="home-1"]
    const match = alias.match(/alias=["']([^"']+)["']/);
    if (match) {
      cleanAlias = match[1];
      console.log('🎰 [SLIDER DEBUG] Extracted alias from shortcode:', cleanAlias);
    } else {
      // Couldn't extract, remove brackets to get just the alias text
      cleanAlias = alias.replace(/\[rev_slider\s*/gi, '').replace(/\[\/rev_slider\]/gi, '').replace(/alias=/gi, '').replace(/["'\]]/g, '').trim();
      console.log('🎰 [SLIDER DEBUG] Cleaned alias (fallback):', cleanAlias);
    }
  }

  // Build the full shortcode string (this is what the native widget expects)
  const shortcode = `[rev_slider alias="${cleanAlias}"][/rev_slider]`;

  // Use the moduleName (Display Name from Component Library) as the revslidertitle
  // This should match the actual Slider Revolution module name (e.g., "Residential", "Commercial")
  const sliderTitle = moduleName || cleanAlias;

  console.log('🎰 [SLIDER DEBUG] Using shortcode:', shortcode, '| revslidertitle:', sliderTitle);

  // Use the native Slider Revolution 6 Elementor widget (NOT generic shortcode widget)
  // Widget type discovered from exported Elementor template: "slider_revolution"
  // Settings need both "revslidertitle" (module name) and "shortcode"
  const widget = {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'slider_revolution',  // Native SR6 widget, not 'shortcode'
    isInner: false,
    settings: {
      revslidertitle: sliderTitle,  // The selected module name
      shortcode: shortcode  // Full shortcode string like '[rev_slider alias="home-1"][/rev_slider]'
    },
    elements: []
  };

  console.log('🎰 [SLIDER DEBUG] Built slider_revolution widget:', JSON.stringify(widget, null, 2));
  return widget;
}

/**
 * Build an Elementor Template widget
 * Used for stats bars, benefit sections, etc. captured from Elementor template library
 * @param {string|number} templateId - The Elementor template ID
 * @returns {Object} Elementor template widget
 */
function buildElementorTemplateWidget(templateId) {
  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'template',
    isInner: false,
    settings: {
      template_id: templateId.toString()
    },
    elements: []
  };
}

/**
 * Build a component widget based on type and reference
 * Wrapper function for component library injection
 * @param {Object} component - Component with type and ref
 * @returns {Object|null} Elementor widget or null if invalid
 */
function buildComponentWidget(component) {
  console.log('🔧 [buildComponentWidget] CALLED with:', JSON.stringify(component, null, 2));

  if (!component || !component.type || !component.ref) {
    console.log('🔧 [buildComponentWidget] SKIPPED - missing component, type, or ref');
    return null;
  }

  console.log(`🔧 [buildComponentWidget] Processing: type="${component.type}", ref="${component.ref}", moduleName="${component.moduleName}", name="${component.name}"`);

  let widget = null;

  if (component.type === 'slider_revolution') {
    // Use moduleName (SR's internal name) if available, otherwise fall back to name for backward compatibility
    const sliderModuleName = component.moduleName || component.name;
    console.log('🔧 [buildComponentWidget] -> Matched slider_revolution, calling buildSliderRevolutionWidget with moduleName:', sliderModuleName);
    widget = buildSliderRevolutionWidget(component.ref, sliderModuleName);
  } else if (component.type === 'elementor_template') {
    console.log('🔧 [buildComponentWidget] -> Matched elementor_template, calling buildElementorTemplateWidget');
    widget = buildElementorTemplateWidget(component.ref);
  } else {
    console.log(`🔧 [buildComponentWidget] -> NO MATCH for type: "${component.type}"`);
  }

  if (!widget) {
    console.warn(`[ElementorBuilder] Unknown component type: ${component.type}`);
    return null;
  }

  // Wrap component in a full-width container to isolate styles
  // This mimics how Elementor wraps manually-added templates
  return {
    id: generateElementId(),
    elType: 'container',
    isInner: false,
    settings: {
      content_width: 'full',
      flex_direction: 'column',
      padding: { unit: 'px', top: '0', right: '0', bottom: '0', left: '0', isLinked: false }
    },
    elements: [widget]
  };
}

/**
 * Build a container with specified direction
 * @param {Array} elements - Child elements
 * @param {Object} options - Container options
 * @returns {Object} Elementor container object
 */
function buildContainer(elements, options = {}) {
  const {
    direction = 'column',
    isInner = false,
    padding = { top: '0', right: '0', bottom: '0', left: '0' },
    gap = '20',
    contentWidth = 'boxed',
    boxedWidth = 1140,
    alignItems = 'flex-start', // flex-start, center, flex-end, stretch
    verticalAlign = 'flex-start', // For child alignment
    width = null // Percentage width for flex children (e.g., '50' for 50%)
  } = options;

  const settings = {
    flex_direction: direction,
    content_width: contentWidth,
    boxed_width: { unit: 'px', size: boxedWidth },
    flex_gap: { column: gap, row: gap, unit: 'px' },
    padding: { unit: 'px', ...padding, isLinked: false }
  };

  // Add alignment settings for row layouts
  if (direction === 'row') {
    settings.flex_align_items = alignItems;
  }
  if (verticalAlign !== 'flex-start') {
    settings.flex_justify_content = verticalAlign;
  }

  // Set percentage width for flex children (used in hero 50/50 layout)
  if (width) {
    settings._flex_size = 'custom';
    settings._flex_size_custom = { unit: '%', size: parseInt(width) };
  }

  return {
    id: generateElementId(),
    elType: 'container',
    isInner: isInner,
    settings,
    elements: elements
  };
}

/**
 * Extract headline from intro content
 * The headline is typically the first line that ends with a phrase (no period) or
 * is distinctly styled. It's usually the first sentence/line before the main paragraph.
 * @param {string} content - Intro content
 * @returns {{ headline: string|null, remainingContent: string }}
 */
function extractHeadlineFromIntro(content) {
  if (!content) return { headline: null, remainingContent: content };

  // Split by newlines first
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);

  if (lines.length === 0) return { headline: null, remainingContent: content };

  // Check if first line looks like a headline:
  // - Relatively short (under 150 chars)
  // - Doesn't end with a period, or ends with a distinct phrase
  // - Often contains location, service name, or tagline
  const firstLine = lines[0];

  // If first line is short and looks like a headline (ends without period or is title-case style)
  const isHeadline = firstLine.length < 150 &&
    (!firstLine.endsWith('.') || firstLine.split(' ').length < 20);

  if (isHeadline && lines.length > 1) {
    return {
      headline: formatHeadlineWithEmDash(firstLine),
      remainingContent: lines.slice(1).join('\n')
    };
  }

  // If content is one paragraph, try to extract first sentence as headline
  // Look for a natural break point (first sentence that could be a headline)
  const firstSentenceMatch = content.match(/^([^.!?]+[.!?])/);
  if (firstSentenceMatch && firstSentenceMatch[1].length < 150) {
    return {
      headline: formatHeadlineWithEmDash(firstSentenceMatch[1].trim()),
      remainingContent: content.slice(firstSentenceMatch[0].length).trim()
    };
  }

  return { headline: null, remainingContent: content };
}

/**
 * Format headline to use em dash (—) instead of period for title separators
 * Converts patterns like "Service in City, TN. Tagline" to "Service in City, TN — Tagline"
 * This applies to ALL workflows globally.
 *
 * @param {string} headline - The extracted headline
 * @returns {string} Headline with em dashes instead of periods for separators
 */
function formatHeadlineWithEmDash(headline) {
  if (!headline) return headline;

  // Pattern: "City, STATE. Rest" -> "City, STATE — Rest"
  // Matches 2-letter US state abbreviations followed by period and space
  // Examples: "TN. ", "FL. ", "CA. ", "TX. "
  let formatted = headline.replace(/,\s*([A-Z]{2})\.\s+/g, ', $1 — ');

  // Also handle "City, STATE." at end of headline (remove trailing period)
  formatted = formatted.replace(/,\s*([A-Z]{2})\.\s*$/, ', $1');

  return formatted;
}

/**
 * Build the hero/intro section (H1 headline + intro text + image side by side + CTA button)
 * @param {string} title - Page title (used for WordPress page title, NOT displayed as H1)
 * @param {Object} introChunk - Intro chunk from chunker
 * @param {Object} options - Section options
 * @returns {Object} Elementor container
 */
function buildHeroSection(title, introChunk, options = {}) {
  // heroImageSide: 'left' or 'right' - alternates per article
  // ctaText and ctaUrl for Book Now button
  const { heroImageSide = 'right', ctaText = 'Book Now!', ctaUrl = '#' } = options;

  // Text side: Headline (H1) + intro text + CTA button
  const textElements = [];

  // Extract headline from intro content - this becomes the H1
  // We do NOT use the keyword as the H1 (that would create duplicate titles)
  let introContent = introChunk?.content || '';
  const { headline, remainingContent } = extractHeadlineFromIntro(introContent);

  // Add headline as H1 (extracted from intro, not the keyword)
  if (headline) {
    textElements.push(buildHeadingWidget(headline, 'h1', { align: 'center' }));
    introContent = remainingContent;
  } else if (title && !introContent.toLowerCase().startsWith(title.toLowerCase())) {
    // Fallback: only use title as H1 if intro doesn't already contain it
    textElements.push(buildHeadingWidget(title, 'h1', { align: 'center' }));
  }

  // Add remaining intro text
  if (introContent) {
    textElements.push(buildTextEditorWidget(introContent));
  }

  // Add CTA button after intro text
  if (ctaText && ctaUrl) {
    textElements.push(buildButtonWidget(ctaText, ctaUrl));
  }

  const textContainer = buildContainer(textElements, {
    isInner: true,
    direction: 'column',
    contentWidth: 'full',
    width: '50' // 50% width for equal split
  });

  // Image side: Hero image (if available)
  const imageElements = [];

  if (introChunk && introChunk.imageData && introChunk.imageData.url) {
    // Auto-adjust image to match text height with object-fit
    const imageWidget = buildImageWidget(introChunk.imageData, {
      align: 'center',
      fitToContainer: true // Signal to use height: 100%
    });
    imageElements.push(imageWidget);
  } else {
    // Placeholder spacer when no image
    imageElements.push({
      id: generateElementId(),
      elType: 'widget',
      widgetType: 'spacer',
      isInner: false,
      settings: { space: { unit: 'px', size: 200 } },
      elements: []
    });
  }

  const imageContainer = buildContainer(imageElements, {
    isInner: true,
    direction: 'column',
    contentWidth: 'full',
    verticalAlign: 'stretch', // Image container stretches to match text
    width: '50' // 50% width for equal split
  });

  // Arrange containers based on heroImageSide
  const containers = heroImageSide === 'left'
    ? [imageContainer, textContainer]
    : [textContainer, imageContainer];

  // Get hero styles from template
  const heroStyle = getStyle('hero');
  const containerStyle = getStyle('container');

  // Parse hero padding
  const heroPadding = heroStyle?.padding || { top: '60', right: '20', bottom: '60', left: '20' };
  // Parse hero gap - handle string or object format
  const heroGap = typeof heroStyle?.gap === 'string'
    ? heroStyle.gap.replace('px', '')
    : (heroStyle?.gap || '40');

  // Main hero container (row direction for side-by-side)
  return buildContainer(containers, {
    direction: 'row',
    padding: {
      top: heroPadding.top || '60',
      right: heroPadding.right || '20',
      bottom: heroPadding.bottom || '60',
      left: heroPadding.left || '20'
    },
    gap: heroGap,
    contentWidth: 'boxed',
    boxedWidth: containerStyle?.boxed_width || 1140,
    alignItems: 'stretch' // Both columns same height
  });
}

/**
 * Build a content section with heading, text, and optional CTA button
 * @param {Object} chunk - Chunk from chunker
 * @param {Object} options - Section options { ctaText, ctaUrl, showCta }
 * @returns {Object} Elementor container
 */
function buildContentSection(chunk, options = {}) {
  const { ctaText = 'Book Now!', ctaUrl = '#', showCta = true } = options;
  const elements = [];

  // Add heading if present
  if (chunk.heading) {
    elements.push(buildHeadingWidget(chunk.heading, 'h2'));
  }

  // Add text content with optional embedded image
  // Pass isFAQ flag for special FAQ formatting
  elements.push(buildTextEditorWidget(
    chunk.content,
    chunk.imageData,
    chunk.imageAlignment,
    { isFAQ: chunk.isFAQ || false }
  ));

  // Add CTA button after content (unless it's FAQ section)
  if (showCta && ctaText && ctaUrl && !chunk.isFAQ) {
    elements.push(buildButtonWidget(ctaText, ctaUrl));
  }

  // Get container styles from template
  const containerStyle = getStyle('container');
  const containerPadding = containerStyle?.padding || { top: '30', right: '20', bottom: '30', left: '20' };

  return buildContainer(elements, {
    direction: 'column',
    padding: {
      top: containerPadding.top || '30',
      right: containerPadding.right || '20',
      bottom: containerPadding.bottom || '30',
      left: containerPadding.left || '20'
    },
    contentWidth: 'boxed',
    boxedWidth: containerStyle?.boxed_width || 1140
  });
}

/**
 * Build a placeholder stats bar section
 * This can be customized later by the user
 * @param {Object} options - Stats options
 * @returns {Object} Elementor container
 */
function buildStatsBarPlaceholder(options = {}) {
  const {
    stats = [
      { value: '2000+', label: 'Projects Completed' },
      { value: '10+', label: 'Years Experience' },
      { value: '100%', label: 'Satisfaction' },
      { value: '10+', label: 'Team Members' }
    ]
  } = options;

  const statWidgets = stats.map(stat => {
    return {
      id: generateElementId(),
      elType: 'container',
      isInner: true,
      settings: {
        content_width: 'full',
        padding: { unit: 'px', top: '25', right: '25', bottom: '25', left: '25', isLinked: true }
      },
      elements: [{
        id: generateElementId(),
        elType: 'widget',
        widgetType: 'icon-box',
        isInner: false,
        settings: {
          title_text: stat.value,
          description_text: stat.label,
          position: 'left'
        },
        elements: []
      }]
    };
  });

  // Get stats bar styles from template
  const statsStyle = getStyle('statsBar');
  const statsPadding = statsStyle?.padding || { top: '70', right: '0', bottom: '70', left: '0' };

  return {
    id: generateElementId(),
    elType: 'container',
    isInner: false,
    settings: {
      flex_direction: 'row',
      padding: {
        unit: 'px',
        top: statsPadding.top || '70',
        right: statsPadding.right || '0',
        bottom: statsPadding.bottom || '70',
        left: statsPadding.left || '0',
        isLinked: false
      },
      background_background: 'gradient',
      background_color: statsStyle?.background_color || '#006EB1',
      background_color_b: statsStyle?.gradient_color_b || '#0EB7D4',
      background_gradient_angle: { unit: 'deg', size: statsStyle?.gradient_angle || 90 }
    },
    elements: statWidgets
  };
}

/**
 * Main function: Build complete Elementor page structure
 * @param {Object} chunkedContent - Output from chunkContent()
 * @param {Object} options - Page options
 * @param {Object} options.templateStyles - Optional styles from workflow_elementor_styles table
 * @returns {Object} Complete Elementor page structure
 */
function buildElementorPage(chunkedContent, options = {}) {
  const {
    title = '',
    ctaText = 'Book Now!',
    ctaUrl = '#',
    includeStatsBar = false,
    statsBarPosition = 'middle', // 'middle' or 'bottom'
    heroImageSide = 'right', // 'left' or 'right' - alternates per article
    templateStyles = null, // Styles from workflow_elementor_styles table (includes structure)
    components = null // Component library injection { slot1, slot2, slot3 }
  } = options;

  // Set current styles context - merges template with defaults
  currentStyles = mergeStyles(templateStyles);

  // Extract structure rules from template if available
  const structure = templateStyles?.structure || null;

  // Determine hero image side: use template structure if available, otherwise use passed option
  const effectiveHeroImageSide = structure?.hero?.imageSide || heroImageSide;

  // Determine stats bar settings from template
  // Component library slot2 takes precedence over legacy stats bar
  const hasSlot2Component = components?.slot2 != null;
  const showStatsBar = !hasSlot2Component && (structure?.statsBar?.detected || includeStatsBar);
  const effectiveStatsBarPosition = structure?.statsBar?.position || statsBarPosition;
  const templateStats = structure?.statsBar?.stats || [];

  // Determine CTA placement from template
  const ctaAfterEachSection = structure?.sections?.ctaAfterEachSection || false;
  const ctaInHero = structure?.sections?.ctaInHero !== false; // Default true

  const pageElements = [];

  // Log component injection status
  console.log('[ElementorBuilder] ========== BUILDING PAGE ==========');
  console.log('[ElementorBuilder] Components received:', components ? 'YES' : 'NO');
  if (components) {
    console.log('[ElementorBuilder] - slot1:', components.slot1 ? `${components.slot1.name} [${components.slot1.type}]` : 'none');
    console.log('[ElementorBuilder] - slot2:', components.slot2 ? `${components.slot2.name} [${components.slot2.type}]` : 'none');
    console.log('[ElementorBuilder] - slot3:', components.slot3 ? `${components.slot3.name} [${components.slot3.type}]` : 'none');
  }

  // === SLOT 1: TOP (before hero) ===
  // Inject component library slot 1 (e.g., Slider Revolution hero slider)
  if (components?.slot1) {
    const slot1Widget = buildComponentWidget(components.slot1);
    if (slot1Widget) {
      pageElements.push(slot1Widget);
      console.log(`[ElementorBuilder] Injected slot1 component: ${components.slot1.name}`);
    }
  }

  // 1. Hero section (intro) - image on effectiveHeroImageSide
  // Note: title is used for WordPress page title, NOT displayed as H1
  // The H1 is extracted from the intro content (the headline)
  if (chunkedContent.intro || title) {
    pageElements.push(buildHeroSection(title, chunkedContent.intro, {
      heroImageSide: effectiveHeroImageSide,
      ctaText: ctaInHero ? ctaText : null,
      ctaUrl: ctaInHero ? ctaUrl : null
    }));
  }

  // 2. Content sections
  const chunks = chunkedContent.chunks || [];
  const middleIndex = Math.floor(chunks.length / 2);

  chunks.forEach((chunk, index) => {
    // === SLOT 2: MIDDLE (between content chunks) ===
    if (index === middleIndex) {
      // Component library slot2 takes precedence
      if (components?.slot2) {
        const slot2Widget = buildComponentWidget(components.slot2);
        if (slot2Widget) {
          pageElements.push(slot2Widget);
          console.log(`[ElementorBuilder] Injected slot2 component: ${components.slot2.name}`);
        }
      } else if (showStatsBar && effectiveStatsBarPosition === 'middle') {
        // Fallback to legacy stats bar
        pageElements.push(buildStatsBarPlaceholder({
          stats: templateStats.length > 0 ? templateStats : undefined
        }));
      }
    }

    // Show CTA after section if template says to, or if it's a FAQ section (never show CTA after FAQ)
    const showCtaAfterSection = ctaAfterEachSection && !chunk.isFAQ;

    pageElements.push(buildContentSection(chunk, {
      ctaText,
      ctaUrl,
      showCta: showCtaAfterSection
    }));
  });

  // === SLOT 3: BOTTOM (after all content) ===
  // Component library slot3 takes precedence
  if (components?.slot3) {
    const slot3Widget = buildComponentWidget(components.slot3);
    if (slot3Widget) {
      pageElements.push(slot3Widget);
      console.log(`[ElementorBuilder] Injected slot3 component: ${components.slot3.name}`);
    }
  } else if (showStatsBar && effectiveStatsBarPosition === 'bottom') {
    // Fallback to legacy stats bar at bottom
    pageElements.push(buildStatsBarPlaceholder({
      stats: templateStats.length > 0 ? templateStats : undefined
    }));
  }

  // Wrap everything in a root container (full width, sections handle their own boxing)
  const rootContainer = buildContainer(pageElements, {
    direction: 'column',
    padding: { top: '0', right: '0', bottom: '0', left: '0' },
    contentWidth: 'full'
  });

  return {
    content: [rootContainer],
    page_settings: [],
    version: '0.4',
    title: title,
    type: 'page'
  };
}

/**
 * Convert Elementor structure to JSON string for WordPress meta
 * @param {Object} elementorData - Elementor page structure
 * @returns {string} JSON string ready for _elementor_data meta field
 */
function toElementorMeta(elementorData) {
  // WordPress expects just the content array for _elementor_data
  return JSON.stringify(elementorData.content);
}

/**
 * Get all required WordPress meta fields for an Elementor page
 * @param {Object} elementorData - Elementor page structure
 * @returns {Object} Meta fields object
 */
function getElementorMetaFields(elementorData) {
  return {
    _elementor_data: toElementorMeta(elementorData),
    _elementor_edit_mode: 'builder',
    _elementor_template_type: 'wp-page',
    _elementor_version: '3.18.0', // Current stable version
    _wp_page_template: 'elementor_header_footer'
  };
}

export {
  buildElementorPage,
  toElementorMeta,
  getElementorMetaFields,
  buildHeroSection,
  buildContentSection,
  buildStatsBarPlaceholder,
  buildHeadingWidget,
  buildTextEditorWidget,
  buildImageWidget,
  buildButtonWidget,
  buildContainer,
  generateElementId,
  contentToHtml,
  buildSliderRevolutionWidget,
  buildElementorTemplateWidget,
  buildComponentWidget
};

export default buildElementorPage;
