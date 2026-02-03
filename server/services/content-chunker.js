/**
 * Content Chunker Service
 * Splits article content into chunks for Elementor page building
 * - Breaks at H2 headings
 * - Ensures no chunk exceeds maxWords (default 300)
 * - Returns chunks with placeholder for image data
 *
 * ENHANCED: Now supports template structure rules
 * - FAQ formatting follows template patterns (bold/plain, numbered/not, spacing)
 * - Section headings can be simplified based on template
 */

/**
 * Count words in a text string (strips HTML tags first)
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
function countWords(text) {
  if (!text) return 0;
  // Strip HTML tags
  const plainText = text.replace(/<[^>]*>/g, ' ');
  // Split by whitespace and filter empty strings
  return plainText.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Extract the first paragraph(s) as intro content (before first H2)
 * @param {string} content - Full HTML content
 * @returns {{ intro: string, remaining: string }}
 */
function extractIntro(content) {
  // Normalize line endings first
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Find the first H2 (either HTML or markdown style)
  const h2HtmlMatch = normalizedContent.match(/<h2[^>]*>/i);
  const h2MdMatch = normalizedContent.match(/^##\s+/m);

  let firstH2Index = -1;

  if (h2HtmlMatch && h2MdMatch) {
    firstH2Index = Math.min(h2HtmlMatch.index, h2MdMatch.index);
  } else if (h2HtmlMatch) {
    firstH2Index = h2HtmlMatch.index;
  } else if (h2MdMatch) {
    firstH2Index = h2MdMatch.index;
  }

  if (firstH2Index === -1) {
    // No H2 found, return empty intro
    return { intro: '', remaining: normalizedContent };
  }

  const intro = normalizedContent.substring(0, firstH2Index).trim();
  const remaining = normalizedContent.substring(firstH2Index).trim();

  return { intro, remaining };
}

/**
 * Pre-process content to consolidate FAQ sections
 * When we encounter a "FAQs" or "Frequently Asked Questions" H2,
 * all subsequent H2s that look like questions (end with ?) should be
 * converted to bold text, not treated as separate sections.
 * @param {string} content - Raw content
 * @returns {string} Content with FAQ questions consolidated
 */
function consolidateFAQSection(content) {
  if (!content) return content;

  let result = content;

  // Pattern to find FAQ section header
  const faqHeaderPattern = /^(##\s*(?:FAQs?|Frequently Asked Questions?|Common Questions?|Q\s*&\s*A))\s*$/gim;

  const faqMatch = faqHeaderPattern.exec(result);
  if (!faqMatch) {
    // No FAQ section found
    return result;
  }

  // Found FAQ header - everything after it until EOF or next non-question H2
  // should have its H2 questions converted to bold
  const faqStartIndex = faqMatch.index + faqMatch[0].length;
  const beforeFaq = result.substring(0, faqMatch.index + faqMatch[0].length);
  let faqContent = result.substring(faqStartIndex);

  // Convert ## Question? to **Question?** (bold) within FAQ section
  // Pattern: ## followed by text ending with ?
  faqContent = faqContent.replace(/^##\s*([^\n]+\?)\s*$/gm, '**$1**');

  // Also handle # Question? (H1 style questions)
  faqContent = faqContent.replace(/^#\s+([^\n]+\?)\s*$/gm, '**$1**');

  result = beforeFaq + faqContent;

  return result;
}

/**
 * Split content by H2 headings
 * @param {string} content - HTML content with H2 headings
 * @returns {Array<{ heading: string, content: string }>}
 */
function splitByH2(content) {
  const sections = [];

  // Normalize line endings first
  let normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Pattern to match H2 in both HTML and markdown formats
  // HTML: <h2>Title</h2> or <h2 class="...">Title</h2>
  // Markdown: ## Title (captures everything after ## until newline)
  // Using [\s\S] approach to handle the full line properly
  const h2Pattern = /(?:<h2[^>]*>([\s\S]*?)<\/h2>|^##\s*([^\n]+))/gim;

  let lastIndex = 0;
  let match;
  let currentHeading = null;

  while ((match = h2Pattern.exec(normalizedContent)) !== null) {
    // If we had a previous heading, save its content
    if (currentHeading !== null) {
      const sectionContent = normalizedContent.substring(lastIndex, match.index).trim();
      if (sectionContent) {
        sections.push({
          heading: currentHeading,
          content: sectionContent
        });
      }
    }

    // Get the heading text (from either HTML or markdown capture group)
    // Trim to remove any trailing whitespace or newlines
    currentHeading = (match[1] || match[2] || '').trim();
    lastIndex = match.index + match[0].length;
  }

  // Don't forget the last section
  if (currentHeading !== null) {
    const sectionContent = normalizedContent.substring(lastIndex).trim();
    if (sectionContent) {
      sections.push({
        heading: currentHeading,
        content: sectionContent
      });
    }
  }

  return sections;
}

/**
 * Split a section into smaller chunks if it exceeds maxWords
 * Tries to break at paragraph boundaries
 * @param {string} content - Section content
 * @param {number} maxWords - Maximum words per chunk
 * @returns {Array<string>}
 */
function splitLongSection(content, maxWords) {
  const wordCount = countWords(content);

  if (wordCount <= maxWords) {
    return [content];
  }

  const chunks = [];

  // Try to split by paragraphs first
  const paragraphs = content.split(/(?:<\/p>\s*<p[^>]*>|<br\s*\/?>\s*<br\s*\/?>|\n\n+)/gi);

  let currentChunk = '';
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const paraWordCount = countWords(para);

    if (currentWordCount + paraWordCount <= maxWords) {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
      currentWordCount += paraWordCount;
    } else {
      // Save current chunk if it has content
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      // Start new chunk
      if (paraWordCount <= maxWords) {
        currentChunk = para;
        currentWordCount = paraWordCount;
      } else {
        // Paragraph itself is too long, need to split by sentences
        const sentences = para.split(/(?<=[.!?])\s+/);
        currentChunk = '';
        currentWordCount = 0;

        for (const sentence of sentences) {
          const sentenceWordCount = countWords(sentence);

          if (currentWordCount + sentenceWordCount <= maxWords) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
            currentWordCount += sentenceWordCount;
          } else {
            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
            currentWordCount = sentenceWordCount;
          }
        }
      }
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Main chunking function
 * Takes article content and returns structured chunks ready for Elementor
 *
 * @param {string} content - Full article HTML content
 * @param {Object} options - Chunking options
 * @param {number} options.maxWords - Maximum words per chunk (default 300)
 * @param {boolean} options.alternateImageSide - Alternate image alignment (default true)
 * @param {Object} options.templateStructure - Template structure rules for formatting
 * @returns {Object} Chunked content structure
 */
function chunkContent(content, options = {}) {
  const { maxWords = 300, alternateImageSide = true, templateStructure = null } = options;

  if (!content || typeof content !== 'string') {
    return {
      intro: null,
      chunks: [],
      totalWords: 0,
      chunkCount: 0
    };
  }

  // Pre-process: Consolidate FAQ sections so questions aren't split as separate H2s
  const processedContent = consolidateFAQSection(content);

  // Extract intro (content before first H2)
  const { intro, remaining } = extractIntro(processedContent);

  // Split remaining content by H2
  const sections = splitByH2(remaining);

  // Process each section into chunks
  const chunks = [];
  let imageAlignment = 'left'; // Start with left, will alternate

  for (const section of sections) {
    // Check if this is an FAQ section and format it specially
    let sectionContent = section.content;
    let sectionHeading = section.heading;
    const isFaq = isFAQSection(sectionHeading);

    if (isFaq) {
      // Format FAQ content using template structure rules if available
      sectionContent = formatFAQContent(sectionContent, templateStructure);

      // Simplify FAQ heading if template uses simple format
      // E.g., convert "FAQs: Apartment Cleaning in Hendersonville, TN" to just "FAQs"
      if (templateStructure?.faq?.headingFormat === 'simple' && sectionHeading) {
        // Remove everything after colon or dash
        const simplifiedHeading = sectionHeading.replace(/[:–-].*$/, '').trim();
        // Only use simplified if it still contains FAQ keyword
        if (isFAQSection(simplifiedHeading)) {
          sectionHeading = simplifiedHeading;
        }
      }
    }

    // Split section if too long
    const sectionChunks = splitLongSection(sectionContent, maxWords);

    // First chunk of section gets the heading
    sectionChunks.forEach((chunkContent, index) => {
      chunks.push({
        heading: index === 0 ? sectionHeading : null,
        content: chunkContent,
        wordCount: countWords(chunkContent),
        imageData: null, // Placeholder for image - will be filled by image generation
        imageAlignment: alternateImageSide ? imageAlignment : 'left',
        isFAQ: isFaq // Mark FAQ chunks for special rendering
      });

      // Alternate sides for next chunk
      if (alternateImageSide) {
        imageAlignment = imageAlignment === 'left' ? 'right' : 'left';
      }
    });
  }

  // Build intro chunk if we have intro content
  const introChunk = intro ? {
    heading: null,
    content: intro,
    wordCount: countWords(intro),
    imageData: null, // Hero image placeholder
    imageAlignment: 'right', // Hero image typically on right
    isIntro: true
  } : null;

  // Calculate totals
  const totalWords = (introChunk ? introChunk.wordCount : 0) +
    chunks.reduce((sum, chunk) => sum + chunk.wordCount, 0);

  return {
    intro: introChunk,
    chunks,
    totalWords,
    chunkCount: chunks.length + (introChunk ? 1 : 0)
  };
}

/**
 * Extract H1 title from content if present
 * @param {string} content - Full HTML content
 * @returns {string|null} The H1 title or null
 */
function extractTitle(content) {
  // Try HTML H1
  const h1HtmlMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1HtmlMatch) {
    return h1HtmlMatch[1].replace(/<[^>]*>/g, '').trim();
  }

  // Try markdown H1
  const h1MdMatch = content.match(/^#\s+(.+)$/m);
  if (h1MdMatch) {
    return h1MdMatch[1].trim();
  }

  return null;
}

/**
 * Format FAQ content with proper Q&A spacing
 * Detects question/answer pairs and formats them based on template rules
 *
 * Template structure options:
 * - questionFormat: 'bold' | 'h3' | 'plain' | 'numbered'
 * - questionNumbered: true/false
 * - spacingBetweenQA: 'tight' | 'spaced'
 * - spacingBetweenPairs: 'tight' | 'spaced'
 *
 * Handles multiple input formats:
 * - Markdown H1: # Question?
 * - Markdown bold: **Question?**
 * - Plain text questions ending with ?
 *
 * @param {string} content - Raw FAQ content
 * @param {Object} templateStructure - Optional template structure rules
 * @returns {string} Formatted FAQ content
 */
function formatFAQContent(content, templateStructure = null) {
  if (!content) return content;

  // Get formatting rules from template or use defaults
  const faqRules = templateStructure?.faq || {
    questionFormat: 'bold',
    questionNumbered: false,
    spacingBetweenQA: 'tight',
    spacingBetweenPairs: 'spaced'
  };

  let formatted = content;
  let questionIndex = 0;

  // First, extract all Q&A pairs so we can reformat them consistently
  // Pattern to find questions: lines ending with ?
  const qaPattern = /(?:^|\n)(?:#\s+|\*\*)?([^\n]+\?)(?:\*\*)?(?:\n+)([\s\S]*?)(?=(?:\n(?:#\s+|\*\*)?[^\n]+\?)|$)/g;

  const qaPairs = [];
  let match;
  let lastContent = '';

  // Extract Q&A pairs
  const lines = formatted.split('\n');
  let currentQuestion = null;
  let currentAnswer = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Check if line is a question (ends with ?, possibly in markdown format)
    // Handle multiple hash symbols (# ## ###) for different heading levels
    const questionMatch = trimmed.match(/^(?:#+\s*|\*\*)?(.+\?)(?:\*\*)?$/);

    if (questionMatch) {
      // Save previous Q&A pair
      if (currentQuestion) {
        qaPairs.push({
          question: currentQuestion,
          answer: currentAnswer.join('\n').trim()
        });
      }
      // Start new Q&A pair - remove any markdown formatting (# or **)
      currentQuestion = questionMatch[1].replace(/^#+\s*|\*\*|\*\*$/g, '').trim();
      currentAnswer = [];
    } else if (currentQuestion && trimmed) {
      // This is answer content
      currentAnswer.push(trimmed);
    }
  }

  // Don't forget the last Q&A pair
  if (currentQuestion) {
    qaPairs.push({
      question: currentQuestion,
      answer: currentAnswer.join('\n').trim()
    });
  }

  // If no Q&A pairs found, return original with basic cleanup
  if (qaPairs.length === 0) {
    // Fallback to basic formatting - handle multiple hash levels (# ## ###)
    formatted = content;
    formatted = formatted.replace(/^#+\s+([^\n]+\?)\s*$/gm, '<strong>$1</strong>');
    formatted = formatted.replace(/\*\*([^*]+\?)\*\*\s*/g, '<strong>$1</strong>\n');
    return formatted.trim();
  }

  // Rebuild content with template formatting rules
  const formattedPairs = qaPairs.map((qa, index) => {
    let questionText = qa.question;

    // Apply numbering if template requires it
    if (faqRules.questionNumbered) {
      questionText = `${index + 1}. ${questionText}`;
    }

    // Apply question format based on template
    let formattedQuestion;
    switch (faqRules.questionFormat) {
      case 'h3':
        formattedQuestion = `<h3>${questionText}</h3>`;
        break;
      case 'plain':
        formattedQuestion = questionText;
        break;
      case 'numbered':
        // Already handled above, just make it bold
        formattedQuestion = `<strong>${questionText}</strong>`;
        break;
      case 'bold':
      default:
        formattedQuestion = `<strong>${questionText}</strong>`;
        break;
    }

    // Determine spacing between question and answer
    const qaJoiner = faqRules.spacingBetweenQA === 'spaced' ? '\n\n' : '\n';

    return formattedQuestion + qaJoiner + qa.answer;
  });

  // Join Q&A pairs with appropriate spacing
  const pairJoiner = faqRules.spacingBetweenPairs === 'spaced' ? '\n\n' : '\n';
  formatted = formattedPairs.join(pairJoiner);

  // Final cleanup
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  formatted = formatted.trim();

  return formatted;
}

/**
 * Check if a section is an FAQ section based on heading
 * @param {string} heading - Section heading
 * @returns {boolean}
 */
function isFAQSection(heading) {
  if (!heading) return false;
  const headingLower = heading.toLowerCase();
  return headingLower.includes('faq') ||
         headingLower.includes('frequently asked') ||
         headingLower.includes('questions') ||
         headingLower === 'q&a' ||
         headingLower === 'qa';
}

export {
  chunkContent,
  countWords,
  extractTitle,
  extractIntro,
  splitByH2,
  splitLongSection,
  formatFAQContent,
  isFAQSection
};

export default chunkContent;
