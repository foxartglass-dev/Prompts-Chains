/**
 * ElementorPreview Component
 * Renders article content exactly as it will appear in WordPress/Elementor
 * Uses shared config from /shared/elementor-config.js for single source of truth
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

// Parse HTML content into sections based on headings
function parseContentSections(html: string): { intro: string; sections: { heading: string; headingTag: string; content: string }[] } {
  if (!html) return { intro: '', sections: [] };

  // Match all headings with their tags
  const headingRegex = /<(h[1-6])[^>]*>(.*?)<\/\1>/gi;
  const headings: { tag: string; text: string; fullMatch: string; index: number }[] = [];

  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({
      tag: match[1],
      text: match[2],
      fullMatch: match[0],
      index: match.index
    });
  }

  // If no headings, return all as intro
  if (headings.length === 0) {
    return { intro: html, sections: [] };
  }

  // Get intro (content before first heading)
  const intro = html.substring(0, headings[0].index).trim();

  // Get sections (content between headings)
  const sections: { heading: string; headingTag: string; content: string }[] = [];

  for (let i = 0; i < headings.length; i++) {
    const startIndex = headings[i].index + headings[i].fullMatch.length;
    const endIndex = i < headings.length - 1 ? headings[i + 1].index : html.length;
    const content = html.substring(startIndex, endIndex).trim();

    sections.push({
      heading: headings[i].text,
      headingTag: headings[i].tag,
      content
    });
  }

  return { intro, sections };
}

const ElementorPreview: React.FC<ElementorPreviewProps> = ({
  content,
  title,
  images = [],
  heroImageSide = 'right'
}) => {
  const styles = getPreviewStyles();
  const config = ELEMENTOR_CONFIG;

  // Parse content into sections
  const { intro, sections } = parseContentSections(content);

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
      {intro && (
        <div style={{
          ...styles.heroSection,
          flexDirection: heroImageSide === 'left' ? 'row-reverse' : 'row',
          borderBottom: `1px solid ${config.colors.border}`,
        }}>
          {/* Text side */}
          <div style={styles.heroText}>
            <div
              className="prose-content"
              dangerouslySetInnerHTML={{ __html: intro }}
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
                height: '250px',
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
                <span style={{ fontSize: '12px' }}>Position 1</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Sections with Inline Images */}
      {sections.map((section, index) => {
        const inlineImage = inlineImages[index];
        // Alternate sides starting from opposite of hero
        const imageSide = index % 2 === 0 ? inlineStartSide : heroImageSide;
        const imageStyle = imageSide === 'left' ? styles.inlineImageLeft : styles.inlineImageRight;

        return (
          <div key={index} style={styles.contentSection}>
            {/* Section Heading */}
            <div style={section.headingTag === 'h2' ? styles.h2 : styles.h3}>
              {section.heading}
            </div>

            {/* Content with optional inline image */}
            <div style={{ overflow: 'hidden' }}>
              {inlineImage ? (
                <img
                  src={inlineImage.url}
                  alt={`Section ${index + 1}`}
                  style={imageStyle}
                />
              ) : index < 3 ? (
                // Show placeholder for first 3 potential inline image positions
                <div style={{
                  ...imageStyle,
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
                  <span style={{ fontWeight: 500 }}>Image {index + 2}</span>
                  <span style={{ fontSize: '10px', color: '#aaa' }}>{imageSide}</span>
                </div>
              ) : null}

              <div
                className="prose-content"
                dangerouslySetInnerHTML={{ __html: section.content }}
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
      {!intro && sections.length === 0 && (
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
