/**
 * Elementor JSON Builder Service
 * Builds Elementor page structure from chunked content
 *
 * Based on analysis of actual Elementor pages:
 * - Uses container/widget structure
 * - Images embedded in text-editor HTML with alignleft/alignright classes
 * - Hero section has side-by-side layout (text left, image right)
 * - Body content uses text wrapping around images
 */

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

  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'heading',
    isInner: false,
    settings: {
      title: text,
      header_size: tag,
      align: align,
      typography_typography: 'custom',
      typography_font_family: 'Roboto',
      typography_font_weight: '700'
    },
    elements: []
  };
}

/**
 * Build an Elementor text-editor widget
 * Optionally embeds an image with text wrapping
 * @param {string} content - HTML content
 * @param {Object} imageData - Optional image data { url, id, alt, width, height }
 * @param {string} imageAlignment - 'left' or 'right'
 * @returns {Object} Elementor widget object
 */
function buildTextEditorWidget(content, imageData = null, imageAlignment = 'left') {
  let htmlContent = content;

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
      ? 'float: left; margin: 0 20px 15px 0;'
      : 'float: right; margin: 0 0 15px 20px;';

    const imgTag = `<img class="${imgClass} wp-image-${imageId}" style="${floatStyle} max-width: 200px; height: auto;" src="${imageUrl}" alt="${imageData.alt || ''}" width="${imageData.width || 200}" height="${imageData.height || 250}" />`;

    // Insert image at the beginning of content
    htmlContent = imgTag + htmlContent;
  }

  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'text-editor',
    isInner: false,
    settings: {
      editor: htmlContent,
      typography_typography: 'custom',
      typography_font_family: 'Poppins',
      typography_font_size: { unit: 'px', size: 16 },
      typography_line_height: { unit: 'px', size: 29 }
    },
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
  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'button',
    isInner: false,
    settings: {
      text: text,
      link: {
        url: url,
        is_external: '',
        nofollow: ''
      },
      background_color: '#0064A1',
      text_padding: { unit: 'px', top: '10', right: '50', bottom: '10', left: '50' }
    },
    elements: []
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
 * Build the hero/intro section (H1 + intro text + image side by side)
 * @param {string} title - Page title (H1)
 * @param {Object} introChunk - Intro chunk from chunker
 * @param {Object} options - Section options
 * @returns {Object} Elementor container
 */
function buildHeroSection(title, introChunk, options = {}) {
  // heroImageSide: 'left' or 'right' - alternates per article
  const { heroImageSide = 'right' } = options;

  // Text side: Title + intro text (NO CTA button)
  const textElements = [];

  if (title) {
    textElements.push(buildHeadingWidget(title, 'h1', { align: 'center' }));
  }

  if (introChunk && introChunk.content) {
    textElements.push(buildTextEditorWidget(introChunk.content));
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

  // Main hero container (row direction for side-by-side)
  return buildContainer(containers, {
    direction: 'row',
    padding: { top: '60', right: '20', bottom: '60', left: '20' },
    gap: '40',
    contentWidth: 'boxed',
    boxedWidth: 1140,
    alignItems: 'stretch' // Both columns same height
  });
}

/**
 * Build a content section with heading and text (optionally with embedded image)
 * @param {Object} chunk - Chunk from chunker
 * @returns {Object} Elementor container
 */
function buildContentSection(chunk) {
  const elements = [];

  // Add heading if present
  if (chunk.heading) {
    elements.push(buildHeadingWidget(chunk.heading, 'h2'));
  }

  // Add text content with optional embedded image
  elements.push(buildTextEditorWidget(
    chunk.content,
    chunk.imageData,
    chunk.imageAlignment
  ));

  return buildContainer(elements, {
    direction: 'column',
    padding: { top: '30', right: '20', bottom: '30', left: '20' },
    contentWidth: 'boxed',
    boxedWidth: 1140
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

  return {
    id: generateElementId(),
    elType: 'container',
    isInner: false,
    settings: {
      flex_direction: 'row',
      padding: { unit: 'px', top: '70', right: '0', bottom: '70', left: '0', isLinked: false },
      background_background: 'gradient',
      background_color: '#006EB1',
      background_color_b: '#0EB7D4',
      background_gradient_angle: { unit: 'deg', size: 90 }
    },
    elements: statWidgets
  };
}

/**
 * Main function: Build complete Elementor page structure
 * @param {Object} chunkedContent - Output from chunkContent()
 * @param {Object} options - Page options
 * @returns {Object} Complete Elementor page structure
 */
function buildElementorPage(chunkedContent, options = {}) {
  const {
    title = '',
    includeStatsBar = false,
    statsBarPosition = 'middle', // 'middle' or 'bottom'
    heroImageSide = 'right' // 'left' or 'right' - alternates per article
  } = options;

  const pageElements = [];

  // 1. Hero section (intro) - image on heroImageSide
  if (chunkedContent.intro || title) {
    pageElements.push(buildHeroSection(title, chunkedContent.intro, { heroImageSide }));
  }

  // 2. Content sections
  const chunks = chunkedContent.chunks || [];
  const middleIndex = Math.floor(chunks.length / 2);

  chunks.forEach((chunk, index) => {
    // Add stats bar in middle if configured
    if (includeStatsBar && statsBarPosition === 'middle' && index === middleIndex) {
      pageElements.push(buildStatsBarPlaceholder());
    }

    pageElements.push(buildContentSection(chunk));
  });

  // 3. Stats bar at bottom if configured
  if (includeStatsBar && statsBarPosition === 'bottom') {
    pageElements.push(buildStatsBarPlaceholder());
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
  generateElementId
};

export default buildElementorPage;
