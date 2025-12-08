/**
 * Content Chunker Service
 * Splits article content into chunks for Elementor page building
 * - Breaks at H2 headings
 * - Ensures no chunk exceeds maxWords (default 300)
 * - Returns chunks with placeholder for image data
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
  // Find the first H2 (either HTML or markdown style)
  const h2HtmlMatch = content.match(/<h2[^>]*>/i);
  const h2MdMatch = content.match(/^##\s+/m);

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
    return { intro: '', remaining: content };
  }

  const intro = content.substring(0, firstH2Index).trim();
  const remaining = content.substring(firstH2Index).trim();

  return { intro, remaining };
}

/**
 * Split content by H2 headings
 * @param {string} content - HTML content with H2 headings
 * @returns {Array<{ heading: string, content: string }>}
 */
function splitByH2(content) {
  const sections = [];

  // Pattern to match H2 in both HTML and markdown formats
  // HTML: <h2>Title</h2> or <h2 class="...">Title</h2>
  // Markdown: ## Title
  const h2Pattern = /(?:<h2[^>]*>(.*?)<\/h2>|^##\s*(.+)$)/gim;

  let lastIndex = 0;
  let match;
  let currentHeading = null;

  while ((match = h2Pattern.exec(content)) !== null) {
    // If we had a previous heading, save its content
    if (currentHeading !== null) {
      const sectionContent = content.substring(lastIndex, match.index).trim();
      if (sectionContent) {
        sections.push({
          heading: currentHeading,
          content: sectionContent
        });
      }
    }

    // Get the heading text (from either HTML or markdown capture group)
    currentHeading = (match[1] || match[2] || '').trim();
    lastIndex = match.index + match[0].length;
  }

  // Don't forget the last section
  if (currentHeading !== null) {
    const sectionContent = content.substring(lastIndex).trim();
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
 * @returns {Object} Chunked content structure
 */
function chunkContent(content, options = {}) {
  const { maxWords = 300, alternateImageSide = true } = options;

  if (!content || typeof content !== 'string') {
    return {
      intro: null,
      chunks: [],
      totalWords: 0,
      chunkCount: 0
    };
  }

  // Extract intro (content before first H2)
  const { intro, remaining } = extractIntro(content);

  // Split remaining content by H2
  const sections = splitByH2(remaining);

  // Process each section into chunks
  const chunks = [];
  let imageAlignment = 'left'; // Start with left, will alternate

  for (const section of sections) {
    // Split section if too long
    const sectionChunks = splitLongSection(section.content, maxWords);

    // First chunk of section gets the heading
    sectionChunks.forEach((chunkContent, index) => {
      chunks.push({
        heading: index === 0 ? section.heading : null,
        content: chunkContent,
        wordCount: countWords(chunkContent),
        imageData: null, // Placeholder for image - will be filled by image generation
        imageAlignment: alternateImageSide ? imageAlignment : 'left'
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

export {
  chunkContent,
  countWords,
  extractTitle,
  extractIntro,
  splitByH2,
  splitLongSection
};

export default chunkContent;
