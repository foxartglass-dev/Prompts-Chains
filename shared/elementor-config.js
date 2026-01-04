/**
 * Shared Elementor Configuration
 * Single source of truth for Elementor layout settings
 * Used by both server (elementor-builder.js) and client (ElementorPreview.tsx)
 */

export const ELEMENTOR_CONFIG = {
  // Container settings
  container: {
    boxedWidth: 1140,
    maxWidth: '1140px'
  },

  // Hero section (intro with 50/50 layout)
  hero: {
    layout: '50/50',
    imageSide: 'right', // default, can be 'left' or 'right'
    imageWidth: 300, // pixels
    padding: {
      top: 60,
      right: 20,
      bottom: 60,
      left: 20
    },
    gap: 40
  },

  // Inline images (float within text)
  inlineImage: {
    maxWidth: 200,
    height: 'auto',
    margin: {
      left: { top: 0, right: 20, bottom: 15, left: 0 },  // When image floats left
      right: { top: 0, right: 0, bottom: 15, left: 20 }  // When image floats right
    },
    borderRadius: 8
  },

  // Content sections
  section: {
    padding: {
      top: 30,
      right: 20,
      bottom: 30,
      left: 20
    },
    marginBottom: 24
  },

  // Typography
  typography: {
    h1: {
      fontFamily: 'Roboto',
      fontWeight: 700,
      fontSize: 32,
      lineHeight: 1.2,
      marginBottom: 24,
      color: '#1a1a1a'
    },
    h2: {
      fontFamily: 'Roboto',
      fontWeight: 700,
      fontSize: 24,
      lineHeight: 1.3,
      marginBottom: 16,
      marginTop: 32,
      color: '#1a1a1a'
    },
    h3: {
      fontFamily: 'Roboto',
      fontWeight: 600,
      fontSize: 20,
      lineHeight: 1.4,
      marginBottom: 12,
      marginTop: 24,
      color: '#1a1a1a'
    },
    body: {
      fontFamily: 'Poppins',
      fontSize: 16,
      lineHeight: 1.8,
      color: '#333333',
      paragraphSpacing: 16
    }
  },

  // Colors (matching typical WordPress/Elementor themes)
  colors: {
    text: '#333333',
    heading: '#1a1a1a',
    link: '#0064A1',
    background: '#ffffff',
    border: '#e5e5e5'
  }
};

// Helper to get CSS styles for preview
export function getPreviewStyles() {
  const c = ELEMENTOR_CONFIG;
  return {
    container: {
      maxWidth: c.container.maxWidth,
      margin: '0 auto',
      backgroundColor: c.colors.background,
      color: c.colors.text,
      fontFamily: c.typography.body.fontFamily,
      fontSize: `${c.typography.body.fontSize}px`,
      lineHeight: c.typography.body.lineHeight
    },
    heroSection: {
      display: 'flex',
      gap: `${c.hero.gap}px`,
      padding: `${c.hero.padding.top}px ${c.hero.padding.right}px ${c.hero.padding.bottom}px ${c.hero.padding.left}px`,
      alignItems: 'stretch'
    },
    heroText: {
      flex: 1
    },
    heroImage: {
      width: `${c.hero.imageWidth}px`,
      flexShrink: 0
    },
    contentSection: {
      padding: `${c.section.padding.top}px ${c.section.padding.right}px ${c.section.padding.bottom}px ${c.section.padding.left}px`,
      marginBottom: `${c.section.marginBottom}px`
    },
    inlineImageLeft: {
      float: 'left',
      maxWidth: `${c.inlineImage.maxWidth}px`,
      height: 'auto',
      margin: `${c.inlineImage.margin.left.top}px ${c.inlineImage.margin.left.right}px ${c.inlineImage.margin.left.bottom}px ${c.inlineImage.margin.left.left}px`,
      borderRadius: `${c.inlineImage.borderRadius}px`
    },
    inlineImageRight: {
      float: 'right',
      maxWidth: `${c.inlineImage.maxWidth}px`,
      height: 'auto',
      margin: `${c.inlineImage.margin.right.top}px ${c.inlineImage.margin.right.right}px ${c.inlineImage.margin.right.bottom}px ${c.inlineImage.margin.right.left}px`,
      borderRadius: `${c.inlineImage.borderRadius}px`
    },
    h1: {
      fontFamily: c.typography.h1.fontFamily,
      fontWeight: c.typography.h1.fontWeight,
      fontSize: `${c.typography.h1.fontSize}px`,
      lineHeight: c.typography.h1.lineHeight,
      marginBottom: `${c.typography.h1.marginBottom}px`,
      color: c.typography.h1.color
    },
    h2: {
      fontFamily: c.typography.h2.fontFamily,
      fontWeight: c.typography.h2.fontWeight,
      fontSize: `${c.typography.h2.fontSize}px`,
      lineHeight: c.typography.h2.lineHeight,
      marginBottom: `${c.typography.h2.marginBottom}px`,
      marginTop: `${c.typography.h2.marginTop}px`,
      color: c.typography.h2.color
    },
    h3: {
      fontFamily: c.typography.h3.fontFamily,
      fontWeight: c.typography.h3.fontWeight,
      fontSize: `${c.typography.h3.fontSize}px`,
      lineHeight: c.typography.h3.lineHeight,
      marginBottom: `${c.typography.h3.marginBottom}px`,
      marginTop: `${c.typography.h3.marginTop}px`,
      color: c.typography.h3.color
    },
    paragraph: {
      marginBottom: `${c.typography.body.paragraphSpacing}px`,
      lineHeight: c.typography.body.lineHeight
    }
  };
}

export default ELEMENTOR_CONFIG;
