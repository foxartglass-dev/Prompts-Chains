/**
 * Elementor API Routes
 * Handles the full pipeline: Article → Elementor Page
 */

import express from 'express';
import { sql, isDatabaseEnabled } from '../db/index.js';
import chunkContent, { extractTitle, countWords } from '../services/content-chunker.js';
import buildElementorPage, { getElementorMetaFields } from '../services/elementor-builder.js';
import {
  createElementorPage,
  updatePage,
  getPage,
  getDraftPages,
  uploadMedia,
  scheduleDripFeed,
  testConnection
} from '../services/wordpress-publisher.js';
import { processArticleWithImages, previewPrompts } from '../services/image-pipeline.js';
import {
  trackImagesSaved,
  trackImagesAttachedToChunks,
  trackImageGenerated,
  banner,
  section,
  endSection,
  log,
  success,
  warning,
  error as logError,
  highlight
} from '../services/image-tracker.js';

const router = express.Router();

/**
 * Clean content before processing
 * - Remove markdown # at start of text (H1)
 * - Remove AI outline markers (H1:, ## Intro, etc.)
 * - Remove stray dashes/em-dashes at end of paragraphs
 * - Normalize line endings
 * - Ensure proper H2 title separation
 * - Convert markdown bold/italic to HTML
 */
function cleanContent(content) {
  if (!content) return content;

  let cleaned = content;

  // Normalize line endings (Windows \r\n -> Unix \n)
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/\r/g, '\n');

  // Remove AI outline markers that shouldn't appear in final content
  // Pattern: "H1:" followed by text (AI title suggestion)
  cleaned = cleaned.replace(/^H1:\s*.+$/gim, '');
  // Pattern: "## Intro" or "## Introduction" outline markers
  cleaned = cleaned.replace(/^##\s*(Intro|Introduction)\s*(Paragraph)?\s*(Outline)?:?\s*$/gim, '');
  // Pattern: Lines that are just outline labels like "Service Page Article", "Service Page Outline"
  cleaned = cleaned.replace(/^(Service Page|Page)\s*(Article|Outline|Content)?\s*:?\s*$/gim, '');
  // Pattern: Lines starting with bullet markers followed by outline text
  cleaned = cleaned.replace(/^[-*]\s*\*\*[^*]+\*\*:\s*.+$/gm, '');

  // Remove markdown # at the very start (but not ## which is H2)
  cleaned = cleaned.replace(/^#\s+/gm, '');

  // Convert markdown bold **text** to <strong>text</strong>
  // Must be done before italic to avoid conflicts
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Convert markdown italic *text* to <em>text</em>
  // Use negative lookbehind/lookahead to avoid matching ** (bold markers)
  cleaned = cleaned.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Remove trailing dashes/em-dashes at end of paragraphs
  // These often appear at the end of AI-generated content
  // Match: text followed by space(s), dash/em-dash, optional space, then end of line or before next paragraph
  cleaned = cleaned.replace(/\s*[-–—]+\s*$/gm, ''); // End of line dashes
  cleaned = cleaned.replace(/\s*[-–—]+\s*(?=\n)/g, ''); // Dashes before newline
  cleaned = cleaned.replace(/\s+[-–—]\s+(?=[A-Z])/g, '. '); // Mid-sentence break dashes before capital

  // Ensure H2 titles are on their own line (not run-on with body text)
  // If HTML H2 is followed by text without line break, add one
  cleaned = cleaned.replace(/(<\/h2>)([^\n<])/g, '$1\n$2');

  // For markdown H2: ensure there's a newline after the heading
  // Match ## followed by heading text, ensure newline follows
  // Don't capture the character after - just ensure separation
  cleaned = cleaned.replace(/^(##\s+.+)$/gm, '$1\n');

  // Remove any triple+ newlines that might have been created
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Remove empty lines at the very start
  cleaned = cleaned.replace(/^\n+/, '');

  return cleaned.trim();
}

/**
 * Determine which chunks should receive images based on natural breaks
 * Rule: Place image at the LAST paragraph/section break UNDER 300 words since previous image
 *
 * @param {Object} chunked - Chunked content with intro and chunks
 * @param {number} maxWordsPerImage - Max words between images (default 300)
 * @returns {Array<number>} Array of chunk indices that should receive images (0 = intro/hero)
 */
function getImagePlacementIndices(chunked, maxWordsPerImage = 300) {
  const indices = [];

  // Hero image always goes on intro (index 0)
  if (chunked.intro) {
    indices.push(0);
  }

  // Track words since last image
  let wordsSinceLastImage = 0;
  let lastValidBreakIndex = -1;
  let lastValidBreakWords = 0;

  // Process each chunk (body sections)
  const chunks = chunked.chunks || [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkWords = chunk.wordCount || 0;

    // Check if adding this chunk would exceed the limit
    if (wordsSinceLastImage + chunkWords >= maxWordsPerImage) {
      // Place image at the LAST valid break (before we exceeded)
      if (lastValidBreakIndex >= 0 && !indices.includes(lastValidBreakIndex + 1)) {
        // +1 because indices[0] is intro, chunks start at index 1
        indices.push(lastValidBreakIndex + 1);
        // Recalculate words since that break
        wordsSinceLastImage = 0;
        for (let j = lastValidBreakIndex + 1; j <= i; j++) {
          wordsSinceLastImage += chunks[j]?.wordCount || 0;
        }
        lastValidBreakIndex = -1;
      } else {
        // No valid break found, place on current chunk
        indices.push(i + 1); // +1 for intro offset
        wordsSinceLastImage = 0;
        lastValidBreakIndex = -1;
      }
    } else {
      // This is a valid break point (under 300 words)
      wordsSinceLastImage += chunkWords;
      lastValidBreakIndex = i;
      lastValidBreakWords = wordsSinceLastImage;
    }
  }

  return indices;
}

/**
 * Determine hero image side - alternates based on some identifier
 * @param {string} identifier - Article ID, keyword, or timestamp to determine side
 */
function getHeroImageSide(identifier) {
  // Use simple hash of identifier to alternate
  if (!identifier) return 'right';
  const hash = identifier.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return hash % 2 === 0 ? 'right' : 'left';
}

// Middleware to check database availability
const requireDb = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
};

/**
 * POST /api/elementor/test-connection
 * Test WordPress connection with provided credentials
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { wpUrl, wpUser, wpPassword } = req.body;

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const result = await testConnection({
      url: wpUrl,
      user: wpUser,
      password: wpPassword
    });

    res.json(result);
  } catch (error) {
    console.error('Connection test error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/elementor/chunk-content
 * Chunk content for preview (doesn't save anything)
 */
router.post('/chunk-content', async (req, res) => {
  try {
    const { content, maxWords = 300 } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const chunked = chunkContent(content, { maxWords });
    const title = extractTitle(content);

    res.json({
      success: true,
      title,
      ...chunked
    });
  } catch (error) {
    console.error('Chunk content error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/elementor/preview
 * Generate Elementor JSON for preview (doesn't publish)
 */
router.post('/preview', async (req, res) => {
  try {
    const {
      content,
      title,
      maxWords = 300,
      ctaText = 'Book Now!',
      ctaUrl = '#',
      includeStatsBar = false,
      statsBarPosition = 'middle'
    } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Chunk the content
    const chunked = chunkContent(content, { maxWords });

    // Extract title from content if not provided
    const pageTitle = title || extractTitle(content) || 'Untitled Page';

    // Build Elementor structure
    const elementorData = buildElementorPage(chunked, {
      title: pageTitle,
      ctaText,
      ctaUrl,
      includeStatsBar,
      statsBarPosition
    });

    res.json({
      success: true,
      elementorData,
      meta: getElementorMetaFields(elementorData),
      chunks: chunked
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/elementor/publish
 * Full pipeline: Article → Elementor Page on WordPress
 * Supports:
 * 1. Pull from Image Bank (uses pre-made images by tag)
 * 2. Generate live images with Style DNA
 * 3. No images (text only)
 */
router.post('/publish', async (req, res) => {
  try {
    const {
      // Article content
      content,
      title,
      slug,
      keyword,
      // WordPress credentials
      wpUrl,
      wpUser,
      wpPassword,
      // Elementor options
      maxWords = 300,
      ctaText = 'Book Now!',
      ctaUrl = '#',
      includeStatsBar = false,
      statsBarPosition = 'middle',
      // Publishing options
      status = 'draft',
      publishDate,
      // Database tracking
      articleId,
      workflowId, // NEW: For Image Bank integration
      // Push tracking (manual vs auto)
      isManualPush = false,
      // Hierarchy support (optional)
      parentPageId,    // WordPress page ID of parent page
      menuOrder,       // Sort order within parent (0, 1, 2...)
      // Image options
      useImageBank = true, // NEW: Pull from Image Bank by tag
      generateImages = false, // Fallback to live generation
      imageDraftMode = false, // If true: match images, save to article DB, but DON'T embed in WP page
      styleDNA = null,
      referenceImages = null,
      openaiApiKey = null,
      anthropicApiKey = null,  // For Claude models in Guided GPT
      geminiApiKey = null,     // For Gemini models in Guided GPT
      replicateApiKey = null,
      maxImages = 4
    } = req.body;

    // Validate required fields
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const wpCredentials = { url: wpUrl, user: wpUser, password: wpPassword };

    // Step 0: Clean content (remove markdown #, stray dashes, fix H2 titles)
    const cleanedContent = cleanContent(content);

    // Step 1: Chunk the content first
    let chunked = chunkContent(cleanedContent, { maxWords });
    let imagesGenerated = 0;
    let imagesFromBank = 0;
    let estimatedCost = null;

    // Track images for draft mode (when images are matched but not embedded in page)
    let draftModeImages = [];

    // Image Decision Report - collect data to return to frontend
    let imageDecisionReport = {
      mode: 'none', // 'bank', 'live', or 'none'
      model: null,
      quality: null,
      smartMatchingEnabled: false,
      matchingRules: [],
      images: [] // Array of {position, type, heading, wordCount, side, action, prompt, matchedKeywords, score}
    };

    // Determine which chunks should receive images (based on natural breaks under 300 words)
    const imagePlacementIndices = getImagePlacementIndices(chunked, 300);
    const dynamicMaxImages = imagePlacementIndices.length;

    // Determine hero image side (alternates per article based on keyword/title)
    const heroImageSide = getHeroImageSide(keyword || title || `${Date.now()}`);

    // Body images start on OPPOSITE side of hero
    const bodyStartSide = heroImageSide === 'right' ? 'left' : 'right';

    // Step 2: Get image creation settings and determine mode
    let effectiveUseBank = useImageBank;
    let effectiveGenerateLive = generateImages;
    let imageGenModel = 'flux-1.1-pro';  // Default to Flux (gpt-image-1.5 requires org verification)
    let imageQuality = 'low'; // Default to low for websites (cheapest)

    if (workflowId && isDatabaseEnabled()) {
      try {
        const settingsResult = await sql`
          SELECT * FROM image_creation_settings WHERE workflow_id = ${workflowId}
        `;

        console.log('[Elementor Publish] Settings found:', settingsResult.length > 0);
        if (settingsResult.length > 0) {
          console.log('[Elementor Publish] integration_mode:', settingsResult[0].integration_mode);
        }

        // Note: We ignore the 'enabled' flag - if settings exist, user wants images
        if (settingsResult.length > 0) {
          const config = settingsResult[0];

          // Check integration_mode to determine behavior
          const integrationMode = config.integration_mode || 'bank';
          const fallbackToLive = config.fallback_to_live ?? true;
          imageGenModel = config.image_generation_model || 'flux-1.1-pro';
          imageQuality = config.image_quality || 'low';

          // Get prompt mode settings for Generate Live
          const livePromptMode = config.live_prompt_mode || 'smart_prompt';
          const smartPromptGuidance = config.smart_prompt_guidance || '';
          const avatars = config.audience_avatars || [];

          // Extract tag from keyword (e.g., "Standard Cleaning(H)" -> "H")
          const tagMatch = keyword?.match(/\(([A-Z])\)/i);
          const articleTag = tagMatch ? tagMatch[1].toUpperCase() : null;

          // Find matching avatar for this article
          const targetAvatar = articleTag ? avatars.find(a => a.tag === articleTag) : avatars[0];

          // Store these for use in Generate Live
          config._livePromptMode = livePromptMode;
          config._smartPromptGuidance = smartPromptGuidance;
          config._targetAvatar = targetAvatar;

          console.log('[Elementor Publish] Integration mode:', integrationMode);
          console.log('[Elementor Publish] Image generation model:', imageGenModel);
          console.log('[Elementor Publish] Image quality:', imageQuality);
          console.log('[Elementor Publish] Live prompt mode:', livePromptMode);
          if (targetAvatar) {
            console.log('[Elementor Publish] Target avatar:', targetAvatar.name);
          }

          if (integrationMode === 'live') {
            // "Generate Live" mode - skip bank, generate fresh images
            effectiveUseBank = false;
            effectiveGenerateLive = true;
            console.log('[Elementor Publish] Mode: Generate Live - will create new images');
          } else {
            // "Pull from Bank" mode - use bank, optionally fallback to live
            effectiveUseBank = true;
            effectiveGenerateLive = fallbackToLive; // Only generate if bank is empty and fallback enabled
            console.log('[Elementor Publish] Mode: Pull from Bank (fallback:', fallbackToLive, ')');
          }
        } else {
          console.log('[Elementor Publish] ⚠️ No Image Creation settings found');
        }
      } catch (settingsError) {
        console.error('[Elementor Publish] Failed to fetch settings:', settingsError.message);
      }
    } else {
      console.log('[Elementor Publish] ⚠️ No workflowId or database not enabled');
    }

    // Step 2b: Try to get images from Image Bank if in bank mode
    console.log('[Image Bank] Checking conditions: effectiveUseBank=', effectiveUseBank, 'workflowId=', workflowId, 'dbEnabled=', isDatabaseEnabled());
    if (effectiveUseBank && workflowId && isDatabaseEnabled()) {
      try {
        const bankImages = await sql`
          SELECT * FROM image_creation_settings WHERE workflow_id = ${workflowId}
        `;

        // Note: We don't check 'enabled' here - if integration_mode is 'bank', user wants bank
        if (bankImages.length > 0) {
          const config = bankImages[0];
          const imageBank = config.image_bank || [];
          const avatars = config.audience_avatars || [];

          console.log('╔══════════════════════════════════════════════════════════════╗');
          console.log('║              IMAGE BANK SELECTION STARTING                    ║');
          console.log('╠══════════════════════════════════════════════════════════════╣');
          console.log(`║ Bank size: ${String(imageBank.length).padEnd(5)} images                                  ║`);
          console.log(`║ Avatars configured: ${String(avatars.length).padEnd(3)}                                   ║`);

          if (imageBank.length === 0) {
            console.log('║ ⚠️  WARNING: Image Bank is EMPTY - no images to select!       ║');
            console.log('╚══════════════════════════════════════════════════════════════╝');
          }
          const variationOrderMode = config.variation_order_mode || 'sequential';
          const manualOrder = config.manual_variation_order || [];

          // Extract tag from keyword (e.g., "Standard Cleaning(H)" -> "H")
          const tagMatch = keyword?.match(/\(([A-Z])\)/i);
          const articleTag = tagMatch ? tagMatch[1].toUpperCase() : null;

          // Find matching avatar by tag
          let targetAvatar = articleTag ? avatars.find(a => a.tag === articleTag) : avatars[0];

          // Debug logging
          console.log('[Image Bank] Keyword:', keyword);
          console.log('[Image Bank] Article tag:', articleTag);
          console.log('[Image Bank] Bank size:', imageBank.length);
          console.log('[Image Bank] Avatars:', avatars.map(a => ({ name: a.name, tag: a.tag })));
          console.log('[Image Bank] Target avatar:', targetAvatar?.name, targetAvatar?.tag);

          // Get available images from bank matching the tag
          // IMPORTANT: Only use images that have been uploaded to WordPress (have wpUrl)
          let availableImages = imageBank.filter(img => {
            if (img.used) {
              console.log('[Image Bank] Skipping used image:', img.id);
              return false;
            }
            // Skip images without WordPress URL - base64 data URLs won't work
            if (!img.wpUrl) {
              console.log('[Image Bank] ⚠️ Skipping image without wpUrl:', img.id, '- needs WordPress upload');
              return false;
            }
            // If article has a tag and image has a tag, they must match
            if (articleTag && img.avatarTag) {
              const matches = img.avatarTag === articleTag;
              if (!matches) console.log('[Image Bank] Tag mismatch:', img.avatarTag, '!=', articleTag);
              return matches;
            }
            // If no tags, check variation match
            if (targetAvatar?.variations?.length > 0) {
              const matches = targetAvatar.variations.some(v => v.id === img.variationId);
              if (!matches) console.log('[Image Bank] Variation mismatch for image:', img.id);
              return matches;
            }
            // No tag requirements - include all unused images
            return true;
          });

          // Count images missing wpUrl for warning
          const missingWpUrl = imageBank.filter(img => !img.used && !img.wpUrl).length;
          console.log('[Image Bank] Available images after filter:', availableImages.length);
          if (missingWpUrl > 0) {
            console.log(`[Image Bank] ⚠️ WARNING: ${missingWpUrl} images skipped - missing WordPress URL!`);
            console.log('[Image Bank] → These images need to be uploaded to WordPress Media Library first');
          }

          // ═══════════════════════════════════════════════════════════════
          // SMART CONTENT MATCHING - Match images to article content
          // Rules:
          // 1. Always try primary keywords first
          // 2. Fall back to secondary keywords if enabled
          // 3. Never duplicate primary keywords on the same page
          // 4. Secondary matches must have different primaries
          // ═══════════════════════════════════════════════════════════════
          const smartMatchingEnabled = config.smart_matching_enabled || false;
          const smartMatchingMode = config.smart_matching_mode || 'bank_first';
          const matchPlurals = config.match_plurals !== false; // Default ON
          const usedPrimaryKeywords = new Set(); // Track used primary keywords (Rule 3)

          // Helper: Generate plural forms of a word
          const getPluralForms = (word) => {
            if (!matchPlurals) return [word];
            const forms = [word];
            const w = word.toLowerCase().trim();
            // Add common plural forms
            if (w.endsWith('s') || w.endsWith('x') || w.endsWith('ch') || w.endsWith('sh')) {
              forms.push(w + 'es'); // box → boxes, dish → dishes
            } else if (w.endsWith('y') && !['a','e','i','o','u'].includes(w[w.length-2])) {
              forms.push(w.slice(0, -1) + 'ies'); // city → cities
            } else {
              forms.push(w + 's'); // counter → counters
            }
            // Also check if word is already plural, add singular
            if (w.endsWith('ies')) {
              forms.push(w.slice(0, -3) + 'y'); // cities → city
            } else if (w.endsWith('es')) {
              forms.push(w.slice(0, -2)); // boxes → box
            } else if (w.endsWith('s') && w.length > 2) {
              forms.push(w.slice(0, -1)); // counters → counter
            }
            return [...new Set(forms)]; // Remove duplicates
          };

          if (smartMatchingEnabled && targetAvatar?.placeholderCategories?.length > 0) {
            console.log('[Smart Matching] Enabled, mode:', smartMatchingMode, ', plurals:', matchPlurals);

            // Normalize article content for keyword matching
            const articleText = (cleanedContent || contentHtml || '').toLowerCase();

            // ═══════════════════════════════════════════════════════════════
            // DISAMBIGUATION: Detect keywords that exist in multiple categories
            // e.g., "sink" in both Kitchen and Bathroom = ambiguous
            // ═══════════════════════════════════════════════════════════════
            const keywordToCategoriesMap = new Map(); // keyword → Set of category names

            // Build the map of all primary keywords and their categories
            targetAvatar.placeholderCategories.forEach(cat => {
              if (cat.isRandomized) return;
              cat.options?.forEach(opt => {
                (opt.primaryKeywords || []).forEach(kw => {
                  const kwLower = kw.toLowerCase().trim();
                  if (!kwLower) return;
                  // Add all plural forms too
                  const forms = getPluralForms(kwLower);
                  forms.forEach(form => {
                    if (!keywordToCategoriesMap.has(form)) {
                      keywordToCategoriesMap.set(form, new Set());
                    }
                    keywordToCategoriesMap.get(form).add(cat.name.toLowerCase());
                  });
                });
              });
            });

            // Identify ambiguous keywords (exist in 2+ categories)
            const ambiguousKeywords = new Set();
            keywordToCategoriesMap.forEach((categories, keyword) => {
              if (categories.size > 1) {
                ambiguousKeywords.add(keyword);
                console.log('[Smart Matching] AMBIGUOUS keyword:', keyword, '→ exists in:', [...categories].join(', '));
              }
            });

            // Helper: Check if category keyword is present in article
            const categoryKeywordInArticle = (categoryName) => {
              const catKeyword = categoryName.toLowerCase().replace(/_/g, ' ');
              const forms = getPluralForms(catKeyword);
              return forms.some(form => articleText.includes(form));
            };

            // Score each image based on keyword matches
            availableImages = availableImages.map(img => {
              let primaryScore = 0;
              let secondaryScore = 0;
              const matchedPrimary = [];
              const matchedSecondary = [];

              // Parse image variation string to extract placeholder codes
              // Format: "I3 · (H) · G2" or "I3-(H)-G2"
              const variationStr = img.variation || img.shortLabel || '';
              const parts = variationStr.split(/[·\-\s]+/).filter(Boolean);

              // For each placeholder category
              targetAvatar.placeholderCategories.forEach((cat, catIdx) => {
                // Skip randomized categories - they don't need matching
                if (cat.isRandomized) {
                  return;
                }

                // Find the code for this category in the image variation
                const catInitial = cat.name.charAt(0).toUpperCase();
                const matchingPart = parts.find(p => {
                  const partMatch = p.match(/^([A-Z])(\d+)$/i);
                  return partMatch && partMatch[1].toUpperCase() === catInitial;
                });

                if (matchingPart) {
                  const optionNum = parseInt(matchingPart.slice(1));
                  const option = cat.options?.find(o => o.number === optionNum);

                  if (option) {
                    // Check PRIMARY keywords first (Rule 1)
                    const primaryKeywords = option.primaryKeywords || [];
                    for (const kw of primaryKeywords) {
                      const kwLower = kw.toLowerCase().trim();
                      if (!kwLower) continue;

                      // Check keyword and its plural forms
                      const forms = getPluralForms(kwLower);
                      let foundForm = null;
                      for (const form of forms) {
                        if (articleText.includes(form)) {
                          foundForm = form;
                          break;
                        }
                      }

                      if (foundForm) {
                        // DISAMBIGUATION: If keyword is ambiguous, require category keyword too
                        const isAmbiguous = forms.some(f => ambiguousKeywords.has(f));

                        if (isAmbiguous) {
                          // Ambiguous keyword - require category name to also be present
                          if (categoryKeywordInArticle(cat.name)) {
                            primaryScore += 10;
                            matchedPrimary.push(kwLower);
                            console.log('[Smart Matching] Image', img.id, 'PRIMARY match:', kwLower, '(disambiguated by:', cat.name, ')');
                          } else {
                            console.log('[Smart Matching] Image', img.id, 'SKIPPED ambiguous keyword:', kwLower, '(need', cat.name, 'in article)');
                          }
                        } else {
                          // Unique keyword - safe to use
                          primaryScore += 10;
                          matchedPrimary.push(kwLower);
                          console.log('[Smart Matching] Image', img.id, 'PRIMARY match:', kwLower, '(found as:', foundForm, ')');
                        }
                      }
                    }

                    // Check SECONDARY keywords if enabled (Rule 2)
                    if (option.useSecondaryKeywords !== false) {
                      // Auto-include category name as secondary keyword
                      const categoryKeyword = cat.name.toLowerCase().replace(/_/g, ' ');
                      const secondaryKeywords = [categoryKeyword, ...(option.secondaryKeywords || [])];

                      for (const kw of secondaryKeywords) {
                        const kwLower = kw.toLowerCase().trim();
                        if (!kwLower || matchedPrimary.includes(kwLower)) continue;

                        // Check keyword and its plural forms
                        const forms = getPluralForms(kwLower);
                        for (const form of forms) {
                          if (articleText.includes(form)) {
                            secondaryScore += 1; // Secondary matches worth less
                            matchedSecondary.push(kwLower); // Store original keyword
                            console.log('[Smart Matching] Image', img.id, 'SECONDARY match:', kwLower, '(found as:', form, ')');
                            break; // Only count once per keyword
                          }
                        }
                      }
                    }
                  }
                }
              });

              // Store the primary keywords for deduplication check
              return {
                ...img,
                primaryScore,
                secondaryScore,
                matchScore: primaryScore + secondaryScore,
                matchedPrimary,
                matchedSecondary
              };
            });

            // Sort: Primary score first, then secondary score
            availableImages.sort((a, b) => {
              // First by primary score (highest first)
              if (b.primaryScore !== a.primaryScore) {
                return b.primaryScore - a.primaryScore;
              }
              // Then by secondary score
              if (b.secondaryScore !== a.secondaryScore) {
                return b.secondaryScore - a.secondaryScore;
              }
              return 0;
            });

            // Apply Rule 3 & 4: Filter out duplicates
            const selectedImages = [];
            const usedPrimaries = new Set();

            for (const img of availableImages) {
              // Check if any of this image's primary keywords are already used (Rule 3)
              const hasDuplicatePrimary = img.matchedPrimary?.some(kw => usedPrimaries.has(kw));

              if (!hasDuplicatePrimary) {
                selectedImages.push(img);
                // Mark these primary keywords as used
                img.matchedPrimary?.forEach(kw => usedPrimaries.add(kw));
              } else {
                console.log('[Smart Matching] Skipping image', img.id, '- duplicate primary keyword');
              }
            }

            availableImages = selectedImages;

            // ═══════════════════════════════════════════════════════════════
            // SMART MATCHING DECISION REPORT - Show why each image was chosen
            // ═══════════════════════════════════════════════════════════════
            console.log('\n╔══════════════════════════════════════════════════════════════╗');
            console.log('║         SMART CONTENT MATCHING DECISION REPORT               ║');
            console.log('╠══════════════════════════════════════════════════════════════╣');
            console.log(`║ Article: ${(keyword || title || 'Untitled').substring(0, 50).padEnd(50)} ║`);
            console.log(`║ Avatar: ${(targetAvatar?.name || 'None').padEnd(52)} ║`);
            console.log(`║ Mode: Pull from Bank | Plurals: ${matchPlurals ? 'ON' : 'OFF'}                       ║`);
            console.log('╠══════════════════════════════════════════════════════════════╣');
            console.log('║ MATCHING RULES APPLIED:                                      ║');
            console.log('║  1. Always try primary keywords first                        ║');
            console.log('║  2. Fall back to secondary keywords if enabled               ║');
            console.log('║  3. Never duplicate primary keywords on a page               ║');
            console.log('║  4. Secondary matches must have different primaries          ║');
            console.log('╠══════════════════════════════════════════════════════════════╣');

            availableImages.slice(0, 5).forEach((img, idx) => {
              console.log(`║ IMAGE #${idx + 1}: ${(img.variation || img.id).substring(0, 50).padEnd(50)} ║`);
              console.log(`║   Primary Score: ${String(img.primaryScore || 0).padEnd(5)} | Secondary Score: ${String(img.secondaryScore || 0).padEnd(12)} ║`);
              if (img.matchedPrimary?.length > 0) {
                console.log(`║   Primary Keywords: ${img.matchedPrimary.slice(0, 3).join(', ').substring(0, 40).padEnd(40)} ║`);
              }
              if (img.matchedSecondary?.length > 0) {
                console.log(`║   Secondary Keywords: ${img.matchedSecondary.slice(0, 3).join(', ').substring(0, 38).padEnd(38)} ║`);
              }
              console.log('╠──────────────────────────────────────────────────────────────╣');
            });

            console.log(`║ Total Matched: ${String(availableImages.length).padEnd(3)} images                                  ║`);
            console.log('╚══════════════════════════════════════════════════════════════╝\n');

            // Populate image decision report for frontend
            imageDecisionReport.mode = 'bank';
            imageDecisionReport.smartMatchingEnabled = true;
            imageDecisionReport.avatar = targetAvatar?.name || 'None';
            imageDecisionReport.matchPlurals = matchPlurals;
            imageDecisionReport.matchingRules = [
              'Always try primary keywords first',
              'Fall back to secondary keywords if enabled',
              'Never duplicate primary keywords on a page',
              'Secondary matches must have different primaries'
            ];
            imageDecisionReport.images = availableImages.slice(0, 5).map((img, idx) => ({
              position: idx + 1,
              type: idx === 0 ? 'hero' : 'inline',
              variation: img.variation || img.id,
              primaryScore: img.primaryScore || 0,
              secondaryScore: img.secondaryScore || 0,
              matchedPrimary: img.matchedPrimary || [],
              matchedSecondary: img.matchedSecondary || []
            }));
          }

          // Sort by variation order (if not using smart matching or as tiebreaker)
          // Apply variation order sorting only if NOT using smart matching
          if (!smartMatchingEnabled) {
            if (variationOrderMode === 'manual' && manualOrder.length > 0) {
              availableImages = availableImages.sort((a, b) => {
                const aIdx = manualOrder.indexOf(a.variationId);
                const bIdx = manualOrder.indexOf(b.variationId);
                return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
              });
            } else if (variationOrderMode === 'random') {
              availableImages = availableImages.sort(() => Math.random() - 0.5);
            }
          }

          // === IMAGE SELECTION LOGIC ===
          // Rule 1: First image (hero) SHOULD be vertical, but use any if none available
          // Rule 2: Remaining images can be either orientation (word wrap in content)
          // Rule 3: Body images start on OPPOSITE side of hero, then alternate

          // Separate vertical and non-vertical images
          const verticalImages = availableImages.filter(img => img.orientation === 'vertical');
          const otherImages = availableImages.filter(img => img.orientation !== 'vertical');

          // Select hero image (prefer vertical, but fallback to any)
          let heroImage = verticalImages.length > 0 ? verticalImages[0] : null;

          // FALLBACK: If no vertical images, use first available image for hero
          if (!heroImage && availableImages.length > 0) {
            heroImage = availableImages[0];
            console.log('[Image Bank] No vertical images found, using first available for hero');
          }

          // Select remaining images (can be any orientation, prefer landscape for word wrap)
          const remainingVertical = heroImage && verticalImages.includes(heroImage)
            ? verticalImages.slice(1)
            : verticalImages;
          const remainingOther = heroImage && !verticalImages.includes(heroImage)
            ? otherImages.filter(img => img !== heroImage)
            : otherImages;
          const remainingImages = [...remainingOther, ...remainingVertical];

          // Build final image list: hero first, then remaining
          const imagesToUse = [];
          if (heroImage) {
            imagesToUse.push(heroImage);
          }

          // Add remaining images based on placement indices (natural breaks under 300 words)
          const remainingNeeded = imagePlacementIndices.length - imagesToUse.length;
          imagesToUse.push(...remainingImages.slice(0, remainingNeeded));

          // Assign images to chunks based on imagePlacementIndices (NOT sequential)
          imagesToUse.forEach((img, imgIdx) => {
            // Get the actual chunk index from placement indices
            const placementIndex = imagePlacementIndices[imgIdx];
            const isHero = placementIndex === 0;

            // Body image side alternation: starts opposite of hero, then alternates
            const bodyImageCount = imagePlacementIndices.filter((idx, i) => i < imgIdx && idx > 0).length;
            const bodySide = bodyImageCount % 2 === 0 ? bodyStartSide : (bodyStartSide === 'left' ? 'right' : 'left');

            // Hero image: matches text column (50% width via Elementor flex)
            // Body images: LARGE (~400px) for prominent display, similar to hero
            const imageData = {
              url: img.url,
              wpUrl: img.wpUrl, // WordPress Media Library URL (permanent, preferred)
              wpMediaId: img.wpMediaId, // WordPress Media ID for proper linking
              alt: img.variation || 'Article image',
              width: isHero
                ? (img.orientation === 'vertical' ? 400 : 450)  // Hero: fills 50% column
                : (img.orientation === 'vertical' ? 380 : 420), // Body: similar to hero (~50% of content width)
              height: isHero
                ? (img.orientation === 'vertical' ? 500 : 350)  // Hero: matches text height
                : (img.orientation === 'vertical' ? 475 : 325), // Body: proportional to width
              side: isHero ? heroImageSide : bodySide,
              orientation: img.orientation // Pass through for debugging
            };

            // Debug: Log image data structure
            console.log(`[Image Bank] ${isHero ? 'HERO' : `BODY-${imgIdx}`} imageData:`, {
              hasUrl: !!img.url,
              hasWpUrl: !!img.wpUrl,
              wpMediaId: img.wpMediaId,
              urlPreview: (img.url || '').substring(0, 50),
              wpUrlPreview: (img.wpUrl || '').substring(0, 50)
            });

            // Log hero image details for debugging
            if (isHero) {
              console.log('[Image Bank] HERO IMAGE SELECTED:');
              console.log('  - Variation:', img.variation);
              console.log('  - URL:', img.url?.substring(0, 60) + '...');
              console.log('  - wpUrl:', img.wpUrl?.substring(0, 60) + '...');
              console.log('  - Orientation:', img.orientation);
            }

            // Only embed images in the page if NOT in imageDraftMode
            // In imageDraftMode: images are saved to article record but NOT embedded in WP page
            if (!imageDraftMode) {
              if (isHero && chunked.intro) {
                chunked.intro.imageData = imageData;
              } else {
                // placementIndex is 1-based for chunks (0 = intro), so subtract 1
                const chunkIdx = placementIndex - 1;
                if (chunked.chunks[chunkIdx]) {
                  chunked.chunks[chunkIdx].imageData = imageData;
                }
              }
            }
          });

          // Log if images were matched but not embedded (draft mode)
          if (imageDraftMode && imagesToUse.length > 0) {
            console.log(`[Image Bank] IMAGE DRAFT MODE: ${imagesToUse.length} images matched but NOT embedded in page`);
            console.log('[Image Bank] Images will be saved to article record for review');

            // Store matched images for saving to article record later
            const timestamp = new Date().toISOString();
            imagesToUse.forEach((img, imgIdx) => {
              const isHero = imgIdx === 0;
              const placementIndex = imagePlacementIndices[imgIdx];
              const bodyImageCount = imagePlacementIndices.filter((idx, i) => i < imgIdx && idx > 0).length;
              const bodySide = bodyImageCount % 2 === 0 ? bodyStartSide : (bodyStartSide === 'left' ? 'right' : 'left');

              draftModeImages.push({
                id: `img-${Date.now()}-${isHero ? 'hero' : `section-${imgIdx}`}`,
                url: img.wpUrl || img.url,
                wpMediaId: img.wpMediaId || null,
                placement: isHero ? 'hero' : `section-${imgIdx}`,
                side: isHero ? heroImageSide : bodySide,
                prompt: img.prompt || '',
                variation: img.variation,
                bankImageId: img.id,
                createdAt: timestamp,
                pushedToWp: false // NOT pushed to WP page, just matched for review
              });
            });
          }

          imagesFromBank = imagesToUse.length;

          console.log('╠══════════════════════════════════════════════════════════════╣');
          console.log(`║ IMAGES SELECTED FROM BANK: ${String(imagesFromBank).padEnd(3)}                             ║`);
          console.log(`║ (Hero: 1, Body: ${String(imagesFromBank - 1).padEnd(2)})                                       ║`);
          console.log('╚══════════════════════════════════════════════════════════════╝');

          // Mark images as used
          if (imagesToUse.length > 0) {
            const usedIds = new Set(imagesToUse.map(i => i.id));
            const updatedBank = imageBank.map(img => {
              if (usedIds.has(img.id)) {
                return { ...img, used: true, usedOn: keyword, usedAt: new Date().toISOString() };
              }
              return img;
            });

            await sql`
              UPDATE image_creation_settings
              SET image_bank = ${JSON.stringify(updatedBank)}::jsonb,
                  updated_at = CURRENT_TIMESTAMP
              WHERE workflow_id = ${workflowId}
            `;
          }
        }
      } catch (bankError) {
        console.error('Image Bank error (continuing without bank):', bankError);
      }
    }

    // Step 3: Generate live images if needed (either "Generate Live" mode or fallback)
    const needsLiveGeneration = effectiveGenerateLive && imagesFromBank < dynamicMaxImages;

    // Get Generate Live settings from config if available
    let livePromptMode = 'smart_prompt';
    let targetAvatar = null;
    let smartPromptGuidance = '';
    let matchPlurals = true;
    let guidedGuardrails = null;
    let guidedModel = 'gpt-4o';

    if (workflowId && isDatabaseEnabled()) {
      try {
        const settingsResult = await sql`
          SELECT * FROM image_creation_settings WHERE workflow_id = ${workflowId}
        `;
        if (settingsResult.length > 0) {
          const config = settingsResult[0];
          livePromptMode = config.live_prompt_mode || 'smart_prompt';
          smartPromptGuidance = config.smart_prompt_guidance || '';
          matchPlurals = config.match_plurals !== false;

          // Find the target avatar for this article
          const avatars = config.audience_avatars || [];
          const tagMatch = keyword?.match(/\(([A-Z])\)/i);
          const articleTag = tagMatch ? tagMatch[1].toUpperCase() : null;
          targetAvatar = articleTag ? avatars.find(a => a.tag === articleTag) : avatars[0];

          // Get guided GPT settings if in guided mode
          guidedGuardrails = targetAvatar?.guardrails || config.guided_guardrails || null;
          guidedModel = config.guided_model || 'gpt-4o';

          console.log('[Elementor Publish] Generate Live settings:');
          console.log('  - Prompt mode:', livePromptMode);
          console.log('  - Target avatar:', targetAvatar?.name || 'None');
          if (livePromptMode === 'main_prompt' && targetAvatar?.mainPrompt) {
            console.log('  - Main prompt:', targetAvatar.mainPrompt.substring(0, 50) + '...');
          }
          if (livePromptMode === 'guided_gpt') {
            console.log('  - Guided model:', guidedModel);
            console.log('  - Has guardrails:', !!guidedGuardrails?.instructions);
          }
        }
      } catch (err) {
        console.error('[Elementor Publish] Failed to fetch Generate Live settings:', err.message);
      }
    }

    if (needsLiveGeneration) {
      const imagesToGenerate = dynamicMaxImages - imagesFromBank;
      console.log(`[Elementor Publish] Generating ${imagesToGenerate} live images with model: ${imageGenModel}`);
      console.log(`[Elementor Publish] Prompt mode: ${livePromptMode}`);

      // Use the image pipeline for remaining images
      const pipelineResult = await processArticleWithImages(cleanedContent, {
        title,
        keyword,
        styleDNA,
        referenceImages,
        openaiApiKey: openaiApiKey || process.env.OPENAI_API_KEY,
        anthropicApiKey: anthropicApiKey || process.env.ANTHROPIC_API_KEY,
        geminiApiKey: geminiApiKey || process.env.GEMINI_API_KEY,
        replicateApiKey: replicateApiKey || process.env.REPLICATE_API_TOKEN,
        wpCredentials,
        maxImages: imagesToGenerate,
        maxWords,
        model: imageGenModel, // gpt-image-1.5 or flux-1.1-pro
        quality: imageQuality, // low/medium/high (for gpt-image-1.5)
        // Generate Live mode options
        livePromptMode,
        targetAvatar,
        smartPromptGuidance,
        matchPlurals,
        heroImageSide, // Pass hero side for proper alternation
        // Guided GPT mode options
        guidedGuardrails,
        guidedModel
      });

      // 🔍🔍🔍 CRITICAL TRACKING: What came back from pipeline?
      banner('PIPELINE RESULT - What images came back?');
      console.log('╔══════════════════════════════════════════════════════════════════════╗');
      console.log('║  🔬 EXAMINING PIPELINE RESULT FOR IMAGES                            ║');
      console.log('╠══════════════════════════════════════════════════════════════════════╣');
      console.log(`║ pipelineResult.imagesGenerated: ${pipelineResult.imagesGenerated || 0}`.padEnd(71) + '║');
      console.log(`║ pipelineResult.chunks.intro exists: ${!!pipelineResult.chunks.intro}`.padEnd(71) + '║');
      console.log(`║ pipelineResult.chunks.intro.imageData exists: ${!!pipelineResult.chunks.intro?.imageData}`.padEnd(71) + '║');
      if (pipelineResult.chunks.intro?.imageData) {
        const id = pipelineResult.chunks.intro.imageData;
        console.log(`║   - url: ${id.url ? 'YES (' + (id.url.startsWith('data:') ? 'BASE64' : 'HTTP') + ')' : 'NO'}`.padEnd(71) + '║');
        console.log(`║   - wpUrl: ${id.wpUrl ? 'YES' : 'NO'}`.padEnd(71) + '║');
        console.log(`║   - wpMediaId: ${id.wpMediaId || 'NONE'}`.padEnd(71) + '║');
      }
      console.log(`║ pipelineResult.chunks.chunks count: ${pipelineResult.chunks.chunks?.length || 0}`.padEnd(71) + '║');
      let pipelineChunksWithImages = 0;
      pipelineResult.chunks.chunks?.forEach((c, i) => {
        if (c.imageData) {
          pipelineChunksWithImages++;
          console.log(`║   chunk[${i}] imageData: url=${c.imageData.url ? 'YES' : 'NO'}, wpUrl=${c.imageData.wpUrl ? 'YES' : 'NO'}`.padEnd(71) + '║');
        }
      });
      console.log(`║ Pipeline chunks with imageData: ${pipelineChunksWithImages}`.padEnd(71) + '║');
      console.log('╚══════════════════════════════════════════════════════════════════════╝');

      // Merge pipeline images with bank images (only if NOT in draft mode)
      if (!imageDraftMode) {
        if (!chunked.intro?.imageData && pipelineResult.chunks.intro?.imageData) {
          chunked.intro.imageData = pipelineResult.chunks.intro.imageData;
          success('Merged hero image from pipeline to chunked');
        }
        pipelineResult.chunks.chunks.forEach((pChunk, idx) => {
          if (pChunk.imageData && chunked.chunks[idx] && !chunked.chunks[idx].imageData) {
            chunked.chunks[idx].imageData = pChunk.imageData;
            success(`Merged chunk[${idx}] image from pipeline to chunked`);
          }
        });
      } else {
        // In draft mode: save generated images to draftModeImages for article record
        console.log('[Image Draft Mode] NOT embedding live-generated images in page - saving for review');
        const timestamp = new Date().toISOString();

        if (pipelineResult.chunks.intro?.imageData) {
          const heroImg = pipelineResult.chunks.intro.imageData;
          draftModeImages.push({
            id: `img-${Date.now()}-hero`,
            url: heroImg.wpUrl || heroImg.url,
            wpMediaId: heroImg.wpMediaId || null,
            placement: 'hero',
            side: heroImg.side || 'right',
            prompt: pipelineResult.chunks.intro.imagePrompt || '',
            createdAt: timestamp,
            pushedToWp: false
          });
        }

        pipelineResult.chunks.chunks.forEach((pChunk, idx) => {
          if (pChunk.imageData) {
            draftModeImages.push({
              id: `img-${Date.now()}-section-${idx + 1}`,
              url: pChunk.imageData.wpUrl || pChunk.imageData.url,
              wpMediaId: pChunk.imageData.wpMediaId || null,
              placement: `section-${idx + 1}`,
              side: pChunk.imageData.side || 'left',
              prompt: pChunk.imagePrompt || '',
              createdAt: timestamp,
              pushedToWp: false
            });
          }
        });

        console.log(`[Image Draft Mode] Saved ${draftModeImages.length} generated images for review`);
      }

      // 🔍 AFTER MERGE: What do we have now?
      console.log('\n[AFTER MERGE] chunked.intro.imageData:', !!chunked.intro?.imageData);
      chunked.chunks?.forEach((c, i) => {
        console.log(`[AFTER MERGE] chunked.chunks[${i}].imageData:`, !!c.imageData);
      });

      imagesGenerated = pipelineResult.imagesGenerated || 0;
      estimatedCost = pipelineResult.estimatedCost;
      console.log(`[Elementor Publish] Generated ${imagesGenerated} images`);

      // ═══════════════════════════════════════════════════════════════
      // IMAGE DECISION REPORT - Log what was generated and why
      // ═══════════════════════════════════════════════════════════════
      console.log('\n╔══════════════════════════════════════════════════════════════╗');
      console.log('║          IMAGE GENERATION DECISION REPORT                    ║');
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log(`║ Article: ${(title || keyword || 'Untitled').substring(0, 50).padEnd(50)} ║`);
      console.log(`║ Mode: Generate Live | Model: ${imageGenModel.padEnd(28)} ║`);
      console.log(`║ Quality: ${imageQuality.padEnd(10)} | Images Generated: ${String(imagesGenerated).padEnd(14)} ║`);
      console.log('╠══════════════════════════════════════════════════════════════╣');

      // Log hero image if present
      if (pipelineResult.chunks.intro?.imageData) {
        const heroAction = pipelineResult.chunks.intro.extractedAction || {};
        const heroData = pipelineResult.chunks.intro.imageData;
        const introWords = pipelineResult.chunks.intro.wordCount || 0;
        const estimatedLines = Math.ceil(introWords / 10); // ~10 words per line in hero layout
        const sizeLabel = heroData.requestedSize === '1536x1024' ? 'LANDSCAPE' :
                          heroData.requestedSize === '1024x1024' ? 'SQUARE' : 'PORTRAIT';
        console.log('║ HERO IMAGE:                                                  ║');
        console.log(`║   Auto-Size: ${introWords} words ≈ ${estimatedLines} lines → ${sizeLabel} (${heroData.requestedSize || 'N/A'})`.padEnd(62) + '║');
        console.log(`║   Action: ${(heroAction.action || 'N/A').substring(0, 50).padEnd(50)} ║`);
        console.log(`║   Mood: ${(heroAction.mood || 'N/A').padEnd(52)} ║`);
        console.log(`║   Setting: ${(heroAction.setting || 'N/A').substring(0, 48).padEnd(48)} ║`);
        if (pipelineResult.chunks.intro.imagePrompt) {
          console.log(`║   Prompt: ${pipelineResult.chunks.intro.imagePrompt.substring(0, 50).padEnd(50)} ║`);
        }
      }

      // Log inline images
      let inlineCount = 0;
      pipelineResult.chunks.chunks.forEach((chunk, idx) => {
        if (chunk.imageData) {
          inlineCount++;
          const action = chunk.extractedAction || {};
          console.log('╠──────────────────────────────────────────────────────────────╣');
          console.log(`║ IMAGE #${inlineCount} (Section ${idx + 1}):                                       ║`);
          console.log(`║   Heading: ${(chunk.heading || 'No heading').substring(0, 48).padEnd(48)} ║`);
          console.log(`║   Word Count: ${String(chunk.wordCount || 0).padEnd(5)} | Side: ${(chunk.imageData.side || 'N/A').padEnd(25)} ║`);
          console.log(`║   Action: ${(action.action || 'N/A').substring(0, 50).padEnd(50)} ║`);
          if (chunk.imagePrompt) {
            console.log(`║   Prompt: ${chunk.imagePrompt.substring(0, 50).padEnd(50)} ║`);
          }
        }
      });

      console.log('╚══════════════════════════════════════════════════════════════╝\n');

      // Populate image decision report for frontend
      imageDecisionReport.mode = 'live';
      imageDecisionReport.model = imageGenModel;
      imageDecisionReport.quality = imageQuality;
      imageDecisionReport.livePromptMode = livePromptMode; // 'main_prompt' or 'smart_prompt'
      imageDecisionReport.smartMatchingEnabled = livePromptMode === 'main_prompt';
      if (livePromptMode === 'main_prompt' && targetAvatar) {
        imageDecisionReport.avatar = targetAvatar.name;
        imageDecisionReport.mainPrompt = targetAvatar.mainPrompt?.substring(0, 100);
      }

      // Add hero image to report
      if (pipelineResult.chunks.intro?.imageData) {
        const heroAction = pipelineResult.chunks.intro.extractedAction || {};
        imageDecisionReport.images.push({
          position: 0,
          type: 'hero',
          heading: 'Hero / Intro',
          action: heroAction.action || 'N/A',
          mood: heroAction.mood || 'N/A',
          setting: heroAction.setting || 'N/A',
          prompt: pipelineResult.chunks.intro.imagePrompt || 'N/A', // Full prompt, no truncation
          matchedKeywords: heroAction.matchedKeywords || []
        });
      }

      // Add inline images to report
      pipelineResult.chunks.chunks.forEach((chunk, idx) => {
        if (chunk.imageData) {
          const action = chunk.extractedAction || {};
          imageDecisionReport.images.push({
            position: idx + 1,
            type: 'inline',
            heading: chunk.heading || `Section ${idx + 1}`,
            wordCount: chunk.wordCount || 0,
            side: chunk.imageSide || chunk.imageData.side || 'N/A',
            action: action.action || 'N/A',
            mood: action.mood || 'N/A',
            prompt: chunk.imagePrompt || 'N/A', // Full prompt, no truncation
            matchedKeywords: action.matchedKeywords || []
          });
        }
      });
    }

    // Step 4: Extract or use provided title
    const pageTitle = title || extractTitle(cleanedContent) || 'Untitled Page';

    // Step 5: Build Elementor structure
    const elementorData = buildElementorPage(chunked, {
      title: pageTitle,
      includeStatsBar,
      statsBarPosition,
      heroImageSide // Pass hero side for alternating layout
    });

    // Step 6: Get Elementor meta fields
    const elementorMeta = getElementorMetaFields(elementorData);

    // Step 7: Create WordPress page (with optional hierarchy)
    const pageResult = await createElementorPage(wpCredentials, {
      title: pageTitle,
      slug,
      elementorMeta,
      status,
      publishDate,
      parent: parentPageId,    // Optional: WordPress ID of parent page
      menuOrder: menuOrder     // Optional: sort order within parent
    });

    // Step 8: Update article in database if articleId provided
    console.log('\n========== IMAGE SAVE DIAGNOSTIC ==========');
    console.log('[SAVE] articleId:', articleId);
    console.log('[SAVE] isDatabaseEnabled():', isDatabaseEnabled());
    console.log('[SAVE] chunked.intro exists:', !!chunked.intro);
    console.log('[SAVE] chunked.intro.imageData:', JSON.stringify(chunked.intro?.imageData, null, 2)?.substring(0, 500));
    console.log('[SAVE] chunked.chunks count:', chunked.chunks?.length);
    chunked.chunks?.forEach((c, i) => {
      if (c.imageData) {
        console.log(`[SAVE] chunk[${i}] imageData: url=${c.imageData.url ? 'YES' : 'NO'}, wpUrl=${c.imageData.wpUrl ? 'YES' : 'NO'}`);
      }
    });
    console.log('============================================\n');

    // Track image save status for response
    let imageSaveStatus = { saved: false, count: 0, articleId: null, error: null };

    if (articleId && isDatabaseEnabled()) {
      try {
        // Build array of generated images to save with article
        // Must include all fields expected by ArticleImage interface: id, url, prompt, placement, wpMediaId, createdAt, pushedToWp
        const generatedImagesData = [];
        const timestamp = new Date().toISOString();

        // Use draft mode images if available (images matched but not embedded in page)
        if (imageDraftMode && draftModeImages.length > 0) {
          console.log(`[Elementor Publish] Using ${draftModeImages.length} draft mode images for article`);
          generatedImagesData.push(...draftModeImages);
        } else {
          // Normal mode: get images from embedded chunk data
          // Hero image
          if (chunked.intro?.imageData?.url || chunked.intro?.imageData?.wpUrl) {
            const heroImageData = chunked.intro.imageData;
            generatedImagesData.push({
              id: `img-${Date.now()}-hero`,
              url: heroImageData.wpUrl || heroImageData.url, // Prefer WordPress URL (permanent) over base64
              wpMediaId: heroImageData.wpMediaId || null,
              placement: 'hero',
              side: heroImageData.side || 'right',
              prompt: chunked.intro.imagePrompt || imageDecisionReport.images.find(i => i.type === 'hero')?.prompt || '',
              createdAt: timestamp,
              pushedToWp: !!heroImageData.wpMediaId // True if already has WordPress media ID
            });
          }

          // Inline images
          chunked.chunks.forEach((chunk, idx) => {
            if (chunk.imageData?.url || chunk.imageData?.wpUrl) {
              const chunkImageData = chunk.imageData;
              generatedImagesData.push({
                id: `img-${Date.now()}-section-${idx + 1}`,
                url: chunkImageData.wpUrl || chunkImageData.url, // Prefer WordPress URL over base64
                wpMediaId: chunkImageData.wpMediaId || null,
                placement: `section-${idx + 1}`,
                side: chunkImageData.side || 'left',
                heading: chunk.heading || `Section ${idx + 1}`,
                prompt: chunk.imagePrompt || '',
                createdAt: timestamp,
                pushedToWp: !!chunkImageData.wpMediaId
              });
            }
          });
        }

        // 🔍🔍🔍 MEGA IMAGE TRACKING - SEE WHERE IMAGES GO! 🔍🔍🔍
        banner(`SAVING IMAGES TO DATABASE - Article ${articleId}`);

        // Track what's in chunks BEFORE we extract images
        trackImagesAttachedToChunks(chunked, 'BEFORE saving to DB');

        // Track what we're about to save
        trackImagesSaved('elementor.js publish endpoint', generatedImagesData, {
          articleId,
          isManualPush,
          status
        });

        console.log(`[Elementor Publish] Saving ${generatedImagesData.length} images to article ${articleId}`);

        // Debug: Log what we're saving
        if (generatedImagesData.length > 0) {
          success(`Found ${generatedImagesData.length} images to save!`);
          console.log('[Elementor Publish] Images to save:', generatedImagesData.map(img => ({
            id: img.id,
            placement: img.placement,
            hasUrl: !!img.url,
            urlType: img.url?.startsWith('data:') ? 'base64' : img.url?.startsWith('http') ? 'http' : 'unknown',
            wpMediaId: img.wpMediaId,
            pushedToWp: img.pushedToWp
          })));
        } else {
          // 🚨 BIG RED FLAG - NO IMAGES TO SAVE!
          logError('NO IMAGES TO SAVE! This is the problem!');
          warning('Checking chunks to find where images got lost...');
          console.log('[Elementor Publish] DEBUG - No images to save. Checking chunks:');
          console.log('  - chunked.intro exists:', !!chunked.intro);
          console.log('  - chunked.intro.imageData exists:', !!chunked.intro?.imageData);
          console.log('  - chunked.intro.imageData.url:', chunked.intro?.imageData?.url?.substring(0, 50) || 'NONE');
          console.log('  - chunked.intro.imageData.wpUrl:', chunked.intro?.imageData?.wpUrl?.substring(0, 50) || 'NONE');
          console.log('  - chunked.chunks count:', chunked.chunks?.length || 0);
          chunked.chunks?.forEach((chunk, idx) => {
            console.log(`  - chunk[${idx}].imageData exists:`, !!chunk.imageData);
            if (chunk.imageData) {
              console.log(`    - url: ${chunk.imageData.url?.substring(0, 50) || 'NONE'}`);
              console.log(`    - wpUrl: ${chunk.imageData.wpUrl?.substring(0, 50) || 'NONE'}`);
            }
          });
        }

        // Prepare imageDecisionReport for storage (only if images were generated)
        const reportToSave = imageDecisionReport.mode !== 'none' ? imageDecisionReport : null;

        // DIAGNOSTIC: What are we about to save?
        console.log('\n[SAVE] ========== ABOUT TO SAVE ==========');
        console.log('[SAVE] generatedImagesData.length:', generatedImagesData.length);
        console.log('[SAVE] isManualPush:', isManualPush);
        if (generatedImagesData.length > 0) {
          generatedImagesData.forEach((img, i) => {
            console.log(`[SAVE] Image ${i}: id=${img.id}, placement=${img.placement}, hasUrl=${!!img.url}, urlStart=${img.url?.substring(0, 30)}`);
          });
        } else {
          console.log('[SAVE] ⚠️ NO IMAGES IN ARRAY - This is why nothing is saved!');
        }
        console.log('[SAVE] ========================================\n');

        if (isManualPush) {
          // Manual push: increment count and append date
          const updateResult = await sql`
            UPDATE articles
            SET wp_post_id = ${pageResult.id},
                wp_post_url = ${pageResult.link},
                wp_published_at = CURRENT_TIMESTAMP,
                status = ${status === 'publish' ? 'published' : 'draft'},
                article_push_manual_count = COALESCE(article_push_manual_count, 0) + 1,
                article_push_manual_dates = COALESCE(article_push_manual_dates, '[]'::jsonb) || to_jsonb(to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
                generated_images = ${JSON.stringify(generatedImagesData)}::jsonb,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${articleId}
            RETURNING id
          `;
          console.log('[SAVE] ✅ Manual push DB update completed for article', articleId);
          console.log('[SAVE] Update result:', updateResult.length, 'rows affected');
        } else {
          // Auto push: set auto_at timestamp (only if not already set)
          const updateResult = await sql`
            UPDATE articles
            SET wp_post_id = ${pageResult.id},
                wp_post_url = ${pageResult.link},
                wp_published_at = CURRENT_TIMESTAMP,
                status = ${status === 'publish' ? 'published' : 'draft'},
                article_push_auto_at = COALESCE(article_push_auto_at, CURRENT_TIMESTAMP),
                generated_images = ${JSON.stringify(generatedImagesData)}::jsonb,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${articleId}
            RETURNING id
          `;
          console.log('[SAVE] ✅ Auto push DB update completed for article', articleId);
          console.log('[SAVE] Update result:', updateResult.length, 'rows affected');
        }
        console.log('[SAVE] ✅ Successfully saved', generatedImagesData.length, 'images to database');
        imageSaveStatus = { saved: true, count: generatedImagesData.length, articleId, error: null };

        // VERIFICATION: Query the database to confirm images were saved
        try {
          const verifyResult = await sql`SELECT id, generated_images FROM articles WHERE id = ${articleId}`;
          if (verifyResult.length > 0) {
            const savedImages = verifyResult[0].generated_images;
            const imageCount = Array.isArray(savedImages) ? savedImages.length : 0;
            console.log('[VERIFY] ✅ Database verification: Article', articleId, 'has', imageCount, 'images saved');
            imageSaveStatus.verifiedCount = imageCount;
            if (imageCount === 0 && generatedImagesData.length > 0) {
              console.error('[VERIFY] ❌ MISMATCH! We tried to save', generatedImagesData.length, 'but database has', imageCount);
              console.error('[VERIFY] generatedImagesData was:', JSON.stringify(generatedImagesData).substring(0, 500));
              imageSaveStatus.error = 'MISMATCH: Saved ' + generatedImagesData.length + ' but DB has ' + imageCount;
            }
          } else {
            console.error('[VERIFY] ❌ Article', articleId, 'not found in database!');
            imageSaveStatus.error = 'Article not found in database after save';
          }
        } catch (verifyError) {
          console.error('[VERIFY] Error checking database:', verifyError.message);
          imageSaveStatus.verifyError = verifyError.message;
        }
      } catch (dbError) {
        console.error('[SAVE] ❌ FAILED to update article:', dbError);
        console.error('[SAVE] Error details:', dbError.message);
        imageSaveStatus = { saved: false, count: 0, articleId, error: dbError.message };
        // Don't fail the request, page was created successfully
      }
    } else {
      console.log('[SAVE] ⚠️ SKIPPED database save - articleId:', articleId, 'dbEnabled:', isDatabaseEnabled());
      imageSaveStatus = { saved: false, count: 0, articleId, error: 'SKIPPED: ' + (!articleId ? 'No articleId' : 'Database disabled') };
    }

    res.json({
      success: true,
      page: pageResult,
      chunks: chunked.chunkCount,
      wordCount: chunked.totalWords,
      imagesFromBank,
      imagesGenerated,
      totalImages: imagesFromBank + imagesGenerated,
      estimatedCost,
      imageDecisionReport, // Include decision report for frontend display
      imageSaveStatus // NEW: Detailed status of image save to database
    });
  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/elementor/publish-article/:id
 * Publish an existing article from the database as an Elementor page
 */
router.post('/publish-article/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      wpUrl,
      wpUser,
      wpPassword,
      maxWords = 300,
      ctaText = 'Book Now!',
      ctaUrl = '#',
      includeStatsBar = false,
      status = 'draft',
      publishDate,
      // Hierarchy support - optional parent page
      parentPageId,    // WordPress page ID of parent (for manual hierarchy)
      menuOrder        // Sort order within parent
    } = req.body;

    // Fetch article with website credentials
    const articles = await sql`
      SELECT a.*,
             ws.wp_url as website_wp_url,
             ws.wp_user as website_wp_user,
             ws.wp_app_password as website_wp_password
      FROM articles a
      LEFT JOIN websites ws ON a.website_id = ws.id
      WHERE a.id = ${id}
    `;

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = articles[0];

    // Use provided credentials or fall back to website credentials
    const wpCredentials = {
      url: wpUrl || article.website_wp_url,
      user: wpUser || article.website_wp_user,
      password: wpPassword || article.website_wp_password
    };

    if (!wpCredentials.url || !wpCredentials.user || !wpCredentials.password) {
      return res.status(400).json({
        error: 'WordPress credentials required. Either provide them in the request or configure them on the website.'
      });
    }

    // Get content from article
    const content = article.final_content;
    if (!content) {
      return res.status(400).json({ error: 'Article has no content' });
    }

    // Chunk the content
    const chunked = chunkContent(content, { maxWords });

    // Use keyword as title, or first meta title
    const pageTitle = article.keyword ||
      (article.meta_titles && article.meta_titles[0]) ||
      'Untitled Page';

    // Build Elementor structure
    const elementorData = buildElementorPage(chunked, {
      title: pageTitle,
      ctaText,
      ctaUrl,
      includeStatsBar
    });

    // Get Elementor meta fields
    const elementorMeta = getElementorMetaFields(elementorData);

    // Create WordPress page (with optional hierarchy)
    const pageResult = await createElementorPage(wpCredentials, {
      title: pageTitle,
      elementorMeta,
      status,
      publishDate,
      parent: parentPageId,    // Optional: set parent for hierarchy
      menuOrder: menuOrder     // Optional: sort order within parent
    });

    // Update article in database
    await sql`
      UPDATE articles
      SET wp_post_id = ${pageResult.id},
          wp_post_url = ${pageResult.link},
          wp_published_at = CURRENT_TIMESTAMP,
          status = ${status === 'publish' ? 'published' : 'draft'},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    res.json({
      success: true,
      page: pageResult,
      article: {
        id: article.id,
        keyword: article.keyword
      },
      parentPageId: parentPageId || null,  // Echo back for confirmation
      chunks: chunked.chunkCount,
      wordCount: chunked.totalWords
    });
  } catch (error) {
    console.error('Publish article error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/elementor/drafts
 * Get all draft pages from WordPress
 */
router.get('/drafts', async (req, res) => {
  try {
    const { wpUrl, wpUser, wpPassword } = req.query;

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const drafts = await getDraftPages({
      url: wpUrl,
      user: wpUser,
      password: wpPassword
    });

    res.json({
      success: true,
      drafts,
      count: drafts.length
    });
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/elementor/schedule-drip-feed
 * Schedule multiple pages for drip feed publishing
 */
router.post('/schedule-drip-feed', async (req, res) => {
  try {
    const {
      pageIds,
      wpUrl,
      wpUser,
      wpPassword,
      pagesPerDay = 5,
      startDate,
      publishTime = '09:00',
      randomize = true
    } = req.body;

    if (!pageIds || !Array.isArray(pageIds) || pageIds.length === 0) {
      return res.status(400).json({ error: 'pageIds array is required' });
    }

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const results = await scheduleDripFeed(
      { url: wpUrl, user: wpUser, password: wpPassword },
      pageIds,
      {
        pagesPerDay,
        startDate: startDate ? new Date(startDate) : new Date(),
        publishTime,
        randomize
      }
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      scheduled: successful,
      failed,
      results
    });
  } catch (error) {
    console.error('Schedule drip feed error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/elementor/upload-media
 * Upload an image to WordPress media library
 */
router.post('/upload-media', async (req, res) => {
  try {
    const {
      wpUrl,
      wpUser,
      wpPassword,
      imageData, // base64 encoded image
      filename,
      alt = '',
      caption = ''
    } = req.body;

    if (!imageData || !filename) {
      return res.status(400).json({ error: 'imageData and filename are required' });
    }

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const media = await uploadMedia(
      { url: wpUrl, user: wpUser, password: wpPassword },
      imageData,
      filename,
      { alt, caption }
    );

    res.json({
      success: true,
      media
    });
  } catch (error) {
    console.error('Upload media error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/elementor/batch-publish
 * Publish multiple articles as Elementor pages
 */
router.post('/batch-publish', requireDb, async (req, res) => {
  try {
    const {
      articleIds,
      wpUrl,
      wpUser,
      wpPassword,
      maxWords = 300,
      ctaText = 'Book Now!',
      ctaUrl = '#',
      status = 'draft'
    } = req.body;

    if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return res.status(400).json({ error: 'articleIds array is required' });
    }

    if (!wpUrl || !wpUser || !wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials required' });
    }

    const wpCredentials = { url: wpUrl, user: wpUser, password: wpPassword };
    const results = [];

    for (const articleId of articleIds) {
      try {
        // Fetch article
        const articles = await sql`
          SELECT * FROM articles WHERE id = ${articleId}
        `;

        if (articles.length === 0) {
          results.push({ articleId, success: false, error: 'Article not found' });
          continue;
        }

        const article = articles[0];
        const content = article.final_content;

        if (!content) {
          results.push({ articleId, success: false, error: 'No content' });
          continue;
        }

        // Chunk and build
        const chunked = chunkContent(content, { maxWords });
        const pageTitle = article.keyword || 'Untitled';
        const elementorData = buildElementorPage(chunked, {
          title: pageTitle,
          ctaText,
          ctaUrl
        });
        const elementorMeta = getElementorMetaFields(elementorData);

        // Create page
        const pageResult = await createElementorPage(wpCredentials, {
          title: pageTitle,
          elementorMeta,
          status
        });

        // Update article
        await sql`
          UPDATE articles
          SET wp_post_id = ${pageResult.id},
              wp_post_url = ${pageResult.link},
              wp_published_at = CURRENT_TIMESTAMP,
              status = ${status === 'publish' ? 'published' : 'draft'},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${articleId}
        `;

        results.push({
          articleId,
          success: true,
          pageId: pageResult.id,
          link: pageResult.link
        });
      } catch (error) {
        results.push({
          articleId,
          success: false,
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      published: successful,
      failed,
      results
    });
  } catch (error) {
    console.error('Batch publish error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
