/**
 * ElementorPreview Component
 * Renders article content exactly as it will appear in WordPress/Elementor
 * Uses shared config from /shared/elementor-config.js for single source of truth
 *
 * Parsing Logic: Matches content-chunker.js to handle BOTH markdown and HTML formats
 * - Markdown: ## Heading Text
 * - HTML: <h2>Heading Text</h2>
 */

import React from 'react';
import { ELEMENTOR_CONFIG, getPreviewStyles } from '../../../shared/elementor-config.js';

interface ArticleImage {
  id: string;
  url: string;
  prompt?: string;
  placement: string;
  wpMediaId?: number;
  keywords?: string[];
}

interface ElementorPreviewProps {
  content: string;
  title: string;
  images?: ArticleImage[];
  heroImageSide?: 'left' | 'right';
}

/**
 * Count words in text (strips HTML tags first)
 * Matches content-chunker.js countWords()
 */
function countWords(text: string): number {
  if (!text) return 0;
  const plainText = text.replace(/<[^>]*>/g, ' ');
  return plainText.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Calculate hero image placeholder dimensions based on intro word count
 * Matches image-generator.js calculateHeroSize() logic
 *
 * Line Estimation: ~10 words per line in typical hero layout
 */
function calculateHeroSize(wordCount: number): { height: number; label: string; ratio: string } {
  const WORDS_PER_LINE = 10;
  const estimatedLines = Math.ceil(wordCount / WORDS_PER_LINE);

  if (estimatedLines <= 4) {
    return { height: 150, label: 'WIDE LANDSCAPE', ratio: '3:2' };
  } else if (estimatedLines <= 6) {
    return { height: 180, label: 'LANDSCAPE', ratio: '3:2' };
  } else if (estimatedLines <= 8) {
    return { height: 220, label: 'SLIGHT LANDSCAPE', ratio: '4:3' };
  } else if (estimatedLines <= 11) {
    return { height: 280, label: 'SQUARE', ratio: '1:1' };
  } else if (estimatedLines <= 14) {
    return { height: 340, label: 'SLIGHT PORTRAIT', ratio: '3:4' };
  } else {
    return { height: 400, label: 'PORTRAIT', ratio: '2:3' };
  }
}

/**
 * Convert markdown/plain text to HTML paragraphs
 * - Handles markdown bold **text**
 * - Converts double newlines to paragraph breaks
 * - Preserves existing HTML
 */
function markdownToHtml(text: string): string {
  if (!text) return '';

  let html = text;

  // Convert markdown bold **text** to <strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Convert markdown italic *text* to <em> (but not ** which is bold)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // If content doesn't have HTML paragraph tags, convert newlines
  if (!html.includes('<p>') && !html.includes('<p ')) {
    // Split by double newlines (paragraph breaks)
    const paragraphs = html.split(/\n\n+/);

    html = paragraphs.map(para => {
      const trimmed = para.trim();
      if (!trimmed) return '';
      // Check if already wrapped in a block element
      if (trimmed.startsWith('<')) return trimmed;
      // Convert single newlines to <br> within paragraph
      const withBreaks = trimmed.replace(/\n/g, '<br>\n');
      return `<p>${withBreaks}</p>`;
    }).filter(p => p).join('\n');
  }

  return html;
}

/**
 * Extract intro content (before first H2)
 * Matches content-chunker.js extractIntro()
 */
function extractIntro(content: string): { intro: string; remaining: string } {
  // Normalize line endings
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Find first H2 (HTML or markdown)
  const h2HtmlMatch = normalized.match(/<h2[^>]*>/i);
  const h2MdMatch = normalized.match(/^##\s+/m);

  let firstH2Index = -1;

  if (h2HtmlMatch && h2MdMatch) {
    firstH2Index = Math.min(h2HtmlMatch.index!, h2MdMatch.index!);
  } else if (h2HtmlMatch) {
    firstH2Index = h2HtmlMatch.index!;
  } else if (h2MdMatch) {
    firstH2Index = h2MdMatch.index!;
  }

  if (firstH2Index === -1) {
    return { intro: '', remaining: normalized };
  }

  const intro = normalized.substring(0, firstH2Index).trim();
  const remaining = normalized.substring(firstH2Index).trim();

  return { intro, remaining };
}

/**
 * Split content by H2 headings
 * Matches content-chunker.js splitByH2() - handles BOTH markdown and HTML
 */
function splitByH2(content: string): { heading: string; content: string }[] {
  const sections: { heading: string; content: string }[] = [];

  // Normalize line endings
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Pattern to match H2 in both HTML and markdown formats
  // HTML: <h2>Title</h2> or <h2 class="...">Title</h2>
  // Markdown: ## Title
  const h2Pattern = /(?:<h2[^>]*>([\s\S]*?)<\/h2>|^##\s*([^\n]+))/gim;

  let lastIndex = 0;
  let match;
  let currentHeading: string | null = null;

  while ((match = h2Pattern.exec(normalized)) !== null) {
    // If we had a previous heading, save its content
    if (currentHeading !== null) {
      const sectionContent = normalized.substring(lastIndex, match.index).trim();
      if (sectionContent) {
        sections.push({
          heading: currentHeading,
          content: sectionContent
        });
      }
    }

    // Get heading text (from HTML or markdown capture group)
    currentHeading = (match[1] || match[2] || '').trim();
    lastIndex = match.index + match[0].length;
  }

  // Don't forget the last section
  if (currentHeading !== null) {
    const sectionContent = normalized.substring(lastIndex).trim();
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
 * Clean content before parsing
 * Matches server/routes/elementor.js cleanContent()
 *
 * IMPORTANT: No markdown # characters should appear in the preview or on WordPress
 */
function cleanContent(content: string): string {
  if (!content) return content;

  let cleaned = content;

  // Normalize line endings
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Convert FAQ questions (# or ### followed by question ending in ?) to bold FIRST
  // This must happen before we process other headings
  cleaned = cleaned.replace(/^#{1,3}\s+([^\n]+\?)\s*$/gm, '<strong>$1</strong>');

  // Convert ### headings to <h3> (before removing H1s)
  cleaned = cleaned.replace(/^###\s+([^\n]+)$/gm, '<h3>$1</h3>');

  // Convert #### headings to <h4>
  cleaned = cleaned.replace(/^####\s+([^\n]+)$/gm, '<h4>$1</h4>');

  // Remove markdown # at the very start (H1) - these are page titles, handled by the component
  // Note: ## (H2) headings are handled by splitByH2() function
  cleaned = cleaned.replace(/^#\s+([^\n]+)\n?/gm, '');

  // Safety net: Strip any remaining lone # at start of lines that might slip through
  // This ensures NO markdown # characters appear in the final output
  cleaned = cleaned.replace(/^#+\s+/gm, '');

  // Remove trailing dashes at end of paragraphs
  cleaned = cleaned.replace(/\s*[-–—]+\s*$/gm, '');

  return cleaned;
}

const ElementorPreview: React.FC<ElementorPreviewProps> = ({
  content,
  title,
  images = [],
  heroImageSide = 'right'
}) => {
  const styles = getPreviewStyles();
  const config = ELEMENTOR_CONFIG;

  // Clean and parse content
  const cleanedContent = cleanContent(content);
  const { intro, remaining } = extractIntro(cleanedContent);
  const sections = splitByH2(remaining);

  // Convert intro markdown to HTML
  const introHtml = markdownToHtml(intro);
  const introWordCount = countWords(intro);

  // Calculate hero image size based on intro length
  const heroSize = calculateHeroSize(introWordCount);

  // Find hero image and inline images
  const heroImage = images.find(img =>
    img.placement === 'hero' || img.placement?.toLowerCase().includes('hero')
  );
  const inlineImages = images.filter(img =>
    img.placement !== 'hero' && !img.placement?.toLowerCase().includes('hero')
  );

  // Determine inline image starting side (opposite of hero)
  const inlineStartSide = heroImageSide === 'right' ? 'left' : 'right';

  return (
    <div
      className="elementor-preview"
      style={{
        ...styles.container,
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    >
      {/* Page Title - H1 */}
      <div style={{ padding: `${config.hero.padding.top}px ${config.hero.padding.right}px 0 ${config.hero.padding.left}px` }}>
        <h1 style={{
          ...styles.h1,
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          {title}
        </h1>
      </div>

      {/* Hero Section - 50/50 layout */}
      {introHtml && (
        <div style={{
          ...styles.heroSection,
          flexDirection: heroImageSide === 'left' ? 'row-reverse' : 'row',
          borderBottom: `1px solid ${config.colors.border}`,
        }}>
          {/* Text side */}
          <div style={styles.heroText}>
            <div
              className="prose-content"
              dangerouslySetInnerHTML={{ __html: introHtml }}
              style={{
                lineHeight: config.typography.body.lineHeight,
                color: config.colors.text
              }}
            />
          </div>

          {/* Image side */}
          <div style={styles.heroImage}>
            {heroImage ? (
              <img
                src={heroImage.url}
                alt="Hero"
                style={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: `${config.inlineImage.borderRadius}px`,
                  objectFit: 'cover'
                }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: `${heroSize.height}px`,
                backgroundColor: '#f0f0f0',
                borderRadius: `${config.inlineImage.borderRadius}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px dashed #ccc',
                color: '#666',
                fontSize: '14px',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span style={{ fontWeight: 600 }}>Hero Image</span>
                <span style={{ fontSize: '11px', color: '#888' }}>{heroSize.label} ({heroSize.ratio})</span>
                <span style={{ fontSize: '10px', color: '#aaa' }}>{introWordCount} words ≈ {Math.ceil(introWordCount / 10)} lines</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Sections with Inline Images */}
      {/* Image placement alternates: Hero has image, then skip, then image, skip, image...
          So sections at index 1, 3, 5... get images (odd indices)
          This creates: Hero(img) -> H2#1(no img) -> H2#2(img) -> H2#3(no img) -> H2#4(img) */}
      {sections.map((section, index) => {
        // Only odd-indexed sections get images (1, 3, 5...)
        // This creates the alternating pattern after the hero
        const shouldHaveImage = index % 2 === 1;

        // Calculate which inline image this section should use
        // Section 1 = inlineImages[0], Section 3 = inlineImages[1], etc.
        const imageIndex = Math.floor(index / 2);
        const inlineImage = shouldHaveImage ? inlineImages[imageIndex] : undefined;

        // Alternate sides: first inline image opposite of hero, then alternate
        const imageSide = imageIndex % 2 === 0 ? inlineStartSide : heroImageSide;
        const imageStyle = imageSide === 'left' ? styles.inlineImageLeft : styles.inlineImageRight;

        // Convert section content to HTML
        const sectionHtml = markdownToHtml(section.content);

        // Image position number (Hero=1, then 2, 3, 4...)
        const imagePositionNumber = imageIndex + 2;

        return (
          <div key={index} style={styles.contentSection}>
            {/* Section Heading - H2 */}
            <h2 style={styles.h2}>
              {section.heading}
            </h2>

            {/* Content with optional inline image - only on odd-indexed sections */}
            <div style={{ overflow: 'hidden' }}>
              {shouldHaveImage && inlineImage ? (
                <img
                  src={inlineImage.url}
                  alt={`Section ${index + 1}`}
                  style={imageStyle}
                />
              ) : shouldHaveImage && imageIndex < 3 ? (
                // Show placeholder for sections that SHOULD have images (positions 2, 3, 4)
                <div style={{
                  ...(imageStyle as React.CSSProperties),
                  width: `${config.inlineImage.maxWidth}px`,
                  height: '150px',
                  backgroundColor: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px dashed #ddd',
                  color: '#888',
                  fontSize: '12px',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span style={{ fontWeight: 500 }}>Image {imagePositionNumber}</span>
                  <span style={{ fontSize: '10px', color: '#aaa' }}>{imageSide}</span>
                </div>
              ) : null}

              <div
                className="prose-content"
                dangerouslySetInnerHTML={{ __html: sectionHtml }}
                style={{
                  lineHeight: config.typography.body.lineHeight,
                  color: config.colors.text
                }}
              />
              <div style={{ clear: 'both' }}></div>
            </div>
          </div>
        );
      })}

      {/* No content fallback */}
      {!introHtml && sections.length === 0 && (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          color: '#666'
        }}>
          <p>No content to preview</p>
        </div>
      )}

      {/* Preview CSS for prose styling */}
      <style>{`
        .elementor-preview .prose-content p {
          margin-bottom: ${config.typography.body.paragraphSpacing}px;
          line-height: ${config.typography.body.lineHeight};
        }
        .elementor-preview .prose-content h2 {
          font-family: ${config.typography.h2.fontFamily};
          font-weight: ${config.typography.h2.fontWeight};
          font-size: ${config.typography.h2.fontSize}px;
          line-height: ${config.typography.h2.lineHeight};
          margin-top: ${config.typography.h2.marginTop}px;
          margin-bottom: ${config.typography.h2.marginBottom}px;
          color: ${config.typography.h2.color};
        }
        .elementor-preview .prose-content h3 {
          font-family: ${config.typography.h3.fontFamily};
          font-weight: ${config.typography.h3.fontWeight};
          font-size: ${config.typography.h3.fontSize}px;
          line-height: ${config.typography.h3.lineHeight};
          margin-top: ${config.typography.h3.marginTop}px;
          margin-bottom: ${config.typography.h3.marginBottom}px;
          color: ${config.typography.h3.color};
        }
        .elementor-preview .prose-content ul,
        .elementor-preview .prose-content ol {
          margin-bottom: ${config.typography.body.paragraphSpacing}px;
          padding-left: 24px;
        }
        .elementor-preview .prose-content li {
          margin-bottom: 8px;
        }
        .elementor-preview .prose-content a {
          color: ${config.colors.link};
          text-decoration: underline;
        }
        .elementor-preview .prose-content strong {
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default ElementorPreview;
