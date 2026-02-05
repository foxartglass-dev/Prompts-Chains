/**
 * ElementorPreview Component
 * Renders article content exactly as it will appear in WordPress/Elementor
 *
 * ARCHITECTURE FIX (Feb 2026):
 * Previously this component had its own parsing logic that didn't match the server.
 * Now it calls /api/elementor/preview-html which uses the SAME processing functions
 * (chunkContent, contentToHtml) that WordPress publish uses.
 *
 * This guarantees: Preview === WordPress output
 */

import React, { useEffect, useState } from 'react';
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

interface PreviewSection {
  heading: string | null;
  html: string;
  isFAQ: boolean;
  wordCount: number;
}

interface PreviewData {
  title: string | null;
  intro: { html: string; wordCount: number } | null;
  sections: PreviewSection[];
  totalWords: number;
  sectionCount: number;
}

/**
 * Calculate hero image placeholder dimensions based on intro word count
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

const ElementorPreview: React.FC<ElementorPreviewProps> = ({
  content,
  title,
  images = [],
  heroImageSide = 'right'
}) => {
  const styles = getPreviewStyles();
  const config = ELEMENTOR_CONFIG;

  // State for server-processed content
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch processed HTML from server when content changes
  useEffect(() => {
    if (!content) {
      setPreviewData(null);
      setLoading(false);
      return;
    }

    const fetchPreviewHtml = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/elementor/preview-html', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, maxWords: 300 })
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          setPreviewData(data);
        } else {
          throw new Error(data.error || 'Failed to process content');
        }
      } catch (err) {
        console.error('Preview fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    };

    // Debounce to avoid excessive API calls while typing
    const timeoutId = setTimeout(fetchPreviewHtml, 300);
    return () => clearTimeout(timeoutId);
  }, [content]);

  // Find hero image
  const heroImage = images.find(img =>
    img.placement === 'hero' || img.placement?.toLowerCase().includes('hero')
  );

  // Calculate hero size based on intro word count
  const introWordCount = previewData?.intro?.wordCount || 0;
  const heroSize = calculateHeroSize(introWordCount);

  // Loading state
  if (loading) {
    return (
      <div
        className="elementor-preview"
        style={{
          ...styles.container,
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          overflow: 'hidden',
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{ textAlign: 'center', color: '#666' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e0e0e0',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p>Processing content...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="elementor-preview"
        style={{
          ...styles.container,
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          overflow: 'hidden',
          minHeight: '200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{ textAlign: 'center', color: '#dc2626', padding: '20px' }}>
          <p style={{ fontWeight: 600 }}>Preview Error</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>{error}</p>
        </div>
      </div>
    );
  }

  // No content state
  if (!previewData || (!previewData.intro && previewData.sections.length === 0)) {
    return (
      <div
        className="elementor-preview"
        style={{
          ...styles.container,
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          overflow: 'hidden',
          padding: '60px 20px',
          textAlign: 'center',
          color: '#666'
        }}
      >
        <p>No content to preview</p>
      </div>
    );
  }

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
      {previewData.intro && (
        <div style={{
          ...styles.heroSection,
          flexDirection: heroImageSide === 'left' ? 'row-reverse' : 'row',
          borderBottom: `1px solid ${config.colors.border}`,
        }}>
          {/* Text side - uses server-processed HTML */}
          <div style={styles.heroText}>
            <div
              className="prose-content"
              dangerouslySetInnerHTML={{ __html: previewData.intro.html }}
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
                <span style={{ fontSize: '10px', color: '#aaa' }}>{introWordCount} words</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Sections - uses server-processed HTML */}
      {previewData.sections.map((section, index) => (
        <div key={index} style={styles.contentSection}>
          {/* Section Heading - H2 */}
          {section.heading && (
            <h2 style={styles.h2}>
              {section.heading}
            </h2>
          )}

          {/* Content - server-processed HTML, identical to WordPress */}
          <div style={{ overflow: 'hidden' }}>
            <div
              className="prose-content"
              dangerouslySetInnerHTML={{ __html: section.html }}
              style={{
                lineHeight: config.typography.body.lineHeight,
                color: config.colors.text
              }}
            />
            <div style={{ clear: 'both' }}></div>
          </div>
        </div>
      ))}

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
