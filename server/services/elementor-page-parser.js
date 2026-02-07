/**
 * Elementor Page Parser Service
 * Parses _elementor_data and provides a usable map of all editable content on a page.
 * Supports surgical editing: modify widget VALUES without changing page structure.
 *
 * Phase 6: Surgical Page Editing (Pages We Didn't Create)
 *
 * IMPORTANT LIMITATIONS:
 * - Only VALUE changes inside existing widgets are reliable
 * - Adding, removing, or rearranging widgets/sections is UNRELIABLE
 * - Element IDs must NEVER be modified
 * - Widget types must NEVER be changed
 */

/**
 * Parses Elementor page JSON into a flat list of editable widgets.
 * Walks the nested tree structure and extracts all editable widgets.
 *
 * @param {Array} elementorData - Parsed _elementor_data JSON
 * @returns {Object} Categorized widget lists with summary
 */
function parseElementorPage(elementorData) {
  if (!elementorData || !Array.isArray(elementorData)) {
    throw new Error('Invalid elementor data: expected an array');
  }

  const result = {
    texts: [],
    images: [],
    headings: [],
    buttons: [],
    templates: [],
    all: [],       // All widgets in page order for the editor
    summary: {}
  };

  let widgetIndex = 0;

  function walkTree(elements, path = [], sectionIndex = 0) {
    for (const element of elements) {
      const currentPath = [...path, element.id];

      if (element.elType === 'widget') {
        const baseWidget = {
          id: element.id,
          path: currentPath,
          widgetType: element.widgetType,
          sectionIndex,
          order: widgetIndex++
        };

        switch (element.widgetType) {
          case 'text-editor': {
            const widget = {
              ...baseWidget,
              content: element.settings?.editor || '',
            };
            result.texts.push(widget);
            result.all.push({ ...widget, category: 'text' });
            break;
          }
          case 'image': {
            const widget = {
              ...baseWidget,
              url: element.settings?.image?.url || '',
              mediaId: element.settings?.image?.id || null,
            };
            result.images.push(widget);
            result.all.push({ ...widget, category: 'image' });
            break;
          }
          case 'heading': {
            const widget = {
              ...baseWidget,
              text: element.settings?.title || '',
              tag: element.settings?.header_size || 'h2',
            };
            result.headings.push(widget);
            result.all.push({ ...widget, category: 'heading' });
            break;
          }
          case 'button': {
            const widget = {
              ...baseWidget,
              text: element.settings?.text || '',
              url: element.settings?.link?.url || '',
            };
            result.buttons.push(widget);
            result.all.push({ ...widget, category: 'button' });
            break;
          }
          case 'global':
          case 'template': {
            const widget = {
              ...baseWidget,
              templateId: element.settings?.template_id || null,
            };
            result.templates.push(widget);
            result.all.push({ ...widget, category: 'template' });
            break;
          }
          case 'shortcode': {
            const widget = {
              ...baseWidget,
              shortcode: element.settings?.shortcode || '',
            };
            result.templates.push(widget);
            result.all.push({ ...widget, category: 'template', isShortcode: true });
            break;
          }
          default: {
            // Unknown widget type — still track it as read-only
            result.all.push({ ...baseWidget, category: 'unknown' });
            break;
          }
        }
      }

      // Track section index for position reference
      if (element.elType === 'section' || element.elType === 'container') {
        sectionIndex++;
      }

      // Recurse into children
      if (element.elements && element.elements.length > 0) {
        walkTree(element.elements, currentPath, sectionIndex);
      }
    }
  }

  walkTree(elementorData);

  // Sort all widgets by order to maintain page order
  result.all.sort((a, b) => a.order - b.order);

  // Build summary counts
  result.summary = {
    totalWidgets: result.all.length,
    textWidgets: result.texts.length,
    imageWidgets: result.images.length,
    headingWidgets: result.headings.length,
    buttonWidgets: result.buttons.length,
    templateWidgets: result.templates.length,
    unknownWidgets: result.all.filter(w => w.category === 'unknown').length
  };

  return result;
}

/**
 * Applies text edits to Elementor page data IN-PLACE.
 * Only changes values inside existing widgets — never adds/removes/moves elements.
 *
 * @param {Array} elementorData - The original _elementor_data (will be deep-cloned internally)
 * @param {Array} edits - Array of edit objects:
 *   - { widgetId, newContent } for text-editor widgets
 *   - { widgetId, newTitle } for heading widgets
 *   - { widgetId, newText, newUrl } for button widgets
 * @returns {Array} Modified elementorData (new object, original unchanged)
 */
function applyTextEdits(elementorData, edits) {
  if (!edits || edits.length === 0) return elementorData;

  const modified = JSON.parse(JSON.stringify(elementorData)); // Deep clone
  const editMap = new Map(edits.map(e => [e.widgetId, e]));
  let appliedCount = 0;

  function walkAndApply(elements) {
    for (const element of elements) {
      if (element.elType === 'widget' && editMap.has(element.id)) {
        const edit = editMap.get(element.id);
        switch (element.widgetType) {
          case 'text-editor':
            if (edit.newContent !== undefined) {
              element.settings = element.settings || {};
              element.settings.editor = edit.newContent;
              appliedCount++;
            }
            break;
          case 'heading':
            if (edit.newTitle !== undefined) {
              element.settings = element.settings || {};
              element.settings.title = edit.newTitle;
              appliedCount++;
            }
            break;
          case 'button':
            if (edit.newText !== undefined) {
              element.settings = element.settings || {};
              element.settings.text = edit.newText;
            }
            if (edit.newUrl !== undefined) {
              element.settings = element.settings || {};
              element.settings.link = element.settings.link || {};
              element.settings.link.url = edit.newUrl;
            }
            if (edit.newText !== undefined || edit.newUrl !== undefined) {
              appliedCount++;
            }
            break;
        }
      }
      if (element.elements?.length > 0) walkAndApply(element.elements);
    }
  }

  walkAndApply(modified);

  if (appliedCount !== edits.length) {
    console.warn(`[PageParser] Applied ${appliedCount}/${edits.length} text edits. Some widget IDs may not have been found.`);
  }

  return modified;
}

/**
 * Swaps images in Elementor page data IN-PLACE.
 * Only changes image URL and media ID inside existing image widgets.
 *
 * @param {Array} elementorData - The original _elementor_data
 * @param {Array} swaps - Array of { widgetId, newUrl, newMediaId }
 * @returns {Array} Modified elementorData (new object, original unchanged)
 */
function applyImageSwaps(elementorData, swaps) {
  if (!swaps || swaps.length === 0) return elementorData;

  const modified = JSON.parse(JSON.stringify(elementorData));
  const swapMap = new Map(swaps.map(s => [s.widgetId, s]));
  let appliedCount = 0;

  function walkAndSwap(elements) {
    for (const element of elements) {
      if (element.elType === 'widget' && element.widgetType === 'image' && swapMap.has(element.id)) {
        const swap = swapMap.get(element.id);
        element.settings = element.settings || {};
        element.settings.image = element.settings.image || {};
        element.settings.image.url = swap.newUrl;
        element.settings.image.id = swap.newMediaId;
        appliedCount++;
      }
      if (element.elements?.length > 0) walkAndSwap(element.elements);
    }
  }

  walkAndSwap(modified);

  if (appliedCount !== swaps.length) {
    console.warn(`[PageParser] Applied ${appliedCount}/${swaps.length} image swaps. Some widget IDs may not have been found.`);
  }

  return modified;
}

/**
 * Creates a detailed audit/inventory of a page's contents.
 * Use this BEFORE making changes so the user has a record of what existed.
 *
 * @param {Object} pageData - WordPress page object (title, slug, status, etc.)
 * @param {Object} parsedContent - Output from parseElementorPage()
 * @returns {Object} Audit record with full inventory
 */
function createPageAudit(pageData, parsedContent) {
  return {
    auditedAt: new Date().toISOString(),
    page: {
      id: pageData.id,
      title: pageData.title?.rendered || pageData.title,
      slug: pageData.slug,
      status: pageData.status,
      url: pageData.link,
    },
    content: {
      textWidgets: parsedContent.texts.map(t => ({
        widgetId: t.id,
        section: t.sectionIndex,
        contentPreview: t.content.substring(0, 200) + (t.content.length > 200 ? '...' : ''),
        fullContent: t.content,
      })),
      imageWidgets: parsedContent.images.map(i => ({
        widgetId: i.id,
        section: i.sectionIndex,
        url: i.url,
        mediaId: i.mediaId,
      })),
      headingWidgets: parsedContent.headings.map(h => ({
        widgetId: h.id,
        section: h.sectionIndex,
        text: h.text,
        tag: h.tag,
      })),
      buttonWidgets: parsedContent.buttons.map(b => ({
        widgetId: b.id,
        section: b.sectionIndex,
        text: b.text,
        url: b.url,
      })),
    },
    summary: parsedContent.summary,
  };
}

export {
  parseElementorPage,
  applyTextEdits,
  applyImageSwaps,
  createPageAudit
};

export default {
  parseElementorPage,
  applyTextEdits,
  applyImageSwaps,
  createPageAudit
};
