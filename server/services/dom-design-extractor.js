/**
 * DOM Design Extractor (Code-First, Zero AI Cost)
 *
 * Stripe "minions" pattern: use deterministic code for predictable tasks,
 * reserve AI for creative judgment calls.
 *
 * This extracts design DNA from a live website using Puppeteer + getComputedStyle().
 * No AI calls needed. Covers ~80-90% of sites accurately.
 * Falls back to Claude Vision only when DOM extraction fails or confidence is low.
 *
 * Cost: $0.00 per extraction (vs ~$0.02 for Claude Vision)
 */

import puppeteer from 'puppeteer';

/**
 * Extract design DNA from a URL using pure DOM inspection
 * @param {string} url - The website URL to analyze
 * @returns {{ designDNA: object, screenshot: Buffer, extractionMethod: 'dom'|'ai', confidence: number }}
 */
export async function extractFromDOM(url) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    // Take screenshot for display (still need it for the UI)
    const screenshot = await page.screenshot({ type: 'png', fullPage: false });

    // Run the extraction inside the browser context
    const designDNA = await page.evaluate(() => {
      // ============================================
      // HELPER FUNCTIONS (run in browser)
      // ============================================

      function rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
        const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return rgb; // already hex or something weird
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
      }

      function isNeutral(hex) {
        if (!hex) return true;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        return saturation < 0.15; // low saturation = neutral/gray
      }

      function luminance(hex) {
        if (!hex) return 0.5;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }

      function getStyle(el, prop) {
        return window.getComputedStyle(el).getPropertyValue(prop).trim();
      }

      function getStyleHex(el, prop) {
        return rgbToHex(getStyle(el, prop));
      }

      // ============================================
      // COLLECT RAW STYLES FROM KEY ELEMENTS
      // ============================================

      const body = document.body;
      const bodyStyles = window.getComputedStyle(body);

      // Collect colors from many elements
      const colorMap = {}; // hex -> count (for finding dominant brand color)
      const bgColors = [];
      const textColors = [];
      const buttonColors = [];
      const linkColors = [];

      // Body background
      const bodyBg = rgbToHex(bodyStyles.backgroundColor);
      if (bodyBg) bgColors.push(bodyBg);

      // Also check html background
      const htmlBg = rgbToHex(window.getComputedStyle(document.documentElement).backgroundColor);
      if (htmlBg) bgColors.push(htmlBg);

      // Sample many elements for color data
      const allElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, a, button, [class*="btn"], [class*="button"], input, nav, header, footer, section, main, article, aside, [class*="card"], [class*="hero"]');

      allElements.forEach(el => {
        const styles = window.getComputedStyle(el);
        const bg = rgbToHex(styles.backgroundColor);
        const color = rgbToHex(styles.color);
        const tag = el.tagName.toLowerCase();

        if (bg && bg !== '#000000') {
          bgColors.push(bg);
          if (!isNeutral(bg)) {
            colorMap[bg] = (colorMap[bg] || 0) + 1;
          }
        }

        if (color) {
          textColors.push(color);
          if (tag === 'a') {
            linkColors.push(color);
            if (!isNeutral(color)) {
              colorMap[color] = (colorMap[color] || 0) + 2; // links weighted higher
            }
          }
        }

        // Buttons get highest weight for brand color detection
        if (tag === 'button' || el.matches('[class*="btn"], [class*="button"], [type="submit"]')) {
          if (bg && !isNeutral(bg)) {
            buttonColors.push(bg);
            colorMap[bg] = (colorMap[bg] || 0) + 5; // buttons weighted highest
          }
          if (color && !isNeutral(color)) {
            colorMap[color] = (colorMap[color] || 0) + 3;
          }
        }
      });

      // ============================================
      // DETERMINE BRAND COLOR (most-used non-neutral)
      // ============================================

      const sortedColors = Object.entries(colorMap)
        .sort((a, b) => b[1] - a[1]);

      const brandDefault = sortedColors[0]?.[0] || '#2563eb';

      // Generate brand light/dark variants
      function adjustBrightness(hex, factor) {
        const r = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * factor)));
        const g = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * factor)));
        const b = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * factor)));
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
      }

      const brandLight = sortedColors[1]?.[0] || adjustBrightness(brandDefault, 1.3);
      const brandDark = adjustBrightness(brandDefault, 0.7);

      // ============================================
      // DETERMINE SURFACE COLORS
      // ============================================

      // Most common background = canvas
      const bgCounts = {};
      bgColors.forEach(c => { if (c) bgCounts[c] = (bgCounts[c] || 0) + 1; });
      const sortedBgs = Object.entries(bgCounts).sort((a, b) => b[1] - a[1]);

      const surfaceCanvas = sortedBgs[0]?.[0] || '#ffffff';
      const surfaceBase = sortedBgs[1]?.[0] || (luminance(surfaceCanvas) > 0.5 ? '#f9fafb' : '#1a1a1f');
      const surfaceMuted = sortedBgs[2]?.[0] || (luminance(surfaceCanvas) > 0.5 ? '#f3f4f6' : '#252530');

      // ============================================
      // DETERMINE TEXT COLORS
      // ============================================

      const textCounts = {};
      textColors.forEach(c => { if (c && isNeutral(c)) textCounts[c] = (textCounts[c] || 0) + 1; });
      const sortedTexts = Object.entries(textCounts).sort((a, b) => b[1] - a[1]);

      const textPrimary = sortedTexts[0]?.[0] || (luminance(surfaceCanvas) > 0.5 ? '#111827' : '#fafafa');
      const textSecondary = sortedTexts[1]?.[0] || (luminance(surfaceCanvas) > 0.5 ? '#6b7280' : '#a1a1aa');
      const textTertiary = sortedTexts[2]?.[0] || (luminance(surfaceCanvas) > 0.5 ? '#9ca3af' : '#71717a');

      // ============================================
      // EXTRACT TYPOGRAPHY
      // ============================================

      const h1 = document.querySelector('h1');
      const h2 = document.querySelector('h2');
      const h3 = document.querySelector('h3');
      const bodyText = document.querySelector('p');

      function getFontInfo(el) {
        if (!el) return null;
        const s = window.getComputedStyle(el);
        return {
          size: s.fontSize,
          weight: s.fontWeight
        };
      }

      const bodyFont = bodyStyles.fontFamily.split(',')[0].replace(/['"]/g, '').trim();

      // ============================================
      // EXTRACT COMPONENT STYLES
      // ============================================

      // Cards - look for elements with card-like styling
      const cardEl = document.querySelector('[class*="card"], [class*="Card"], article, .rounded-lg, .rounded-xl');
      let cardStyles = { radius: '12px', shadow: '0 1px 3px rgba(0,0,0,0.1)', border: 'none', padding: '24px' };
      if (cardEl) {
        const cs = window.getComputedStyle(cardEl);
        cardStyles.radius = cs.borderRadius !== '0px' ? cs.borderRadius : '12px';
        cardStyles.shadow = cs.boxShadow !== 'none' ? cs.boxShadow : '0 1px 3px rgba(0,0,0,0.1)';
        cardStyles.border = cs.borderWidth !== '0px' ? `${cs.borderWidth} ${cs.borderStyle} ${rgbToHex(cs.borderColor)}` : 'none';
        cardStyles.padding = cs.padding;
        cardStyles.background = rgbToHex(cs.backgroundColor);
      }

      // Buttons
      const btnEl = document.querySelector('button, [class*="btn"], [class*="button"], [type="submit"], a[class*="cta"]');
      let btnStyles = { radius: '8px', background: brandDefault, textColor: '#ffffff', padding: '10px 20px' };
      if (btnEl) {
        const bs = window.getComputedStyle(btnEl);
        btnStyles.radius = bs.borderRadius !== '0px' ? bs.borderRadius : '8px';
        const bg = rgbToHex(bs.backgroundColor);
        if (bg && !isNeutral(bg)) btnStyles.background = bg;
        btnStyles.textColor = rgbToHex(bs.color) || '#ffffff';
        btnStyles.padding = bs.padding;
      }

      // Inputs
      const inputEl = document.querySelector('input[type="text"], input[type="email"], input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"])');
      let inputStyles = { radius: '6px', background: surfaceCanvas, border: `1px solid ${surfaceMuted}` };
      if (inputEl) {
        const is = window.getComputedStyle(inputEl);
        inputStyles.radius = is.borderRadius !== '0px' ? is.borderRadius : '6px';
        inputStyles.background = rgbToHex(is.backgroundColor) || surfaceCanvas;
        inputStyles.border = `${is.borderWidth} ${is.borderStyle} ${rgbToHex(is.borderColor)}`;
      }

      // ============================================
      // EXTRACT SPACING
      // ============================================

      // Check padding patterns on sections
      const sections = document.querySelectorAll('section, [class*="section"], main > div');
      let sectionPaddings = [];
      sections.forEach(s => {
        const pad = window.getComputedStyle(s).paddingTop;
        if (pad && pad !== '0px') sectionPaddings.push(parseInt(pad));
      });
      const avgSectionPad = sectionPaddings.length > 0
        ? Math.round(sectionPaddings.reduce((a, b) => a + b, 0) / sectionPaddings.length)
        : 60;

      // Border colors
      const borderEls = document.querySelectorAll('[class*="border"], hr, [class*="divider"]');
      let borderColor = luminance(surfaceCanvas) > 0.5 ? '#e5e7eb' : '#27272a';
      let borderSubtle = luminance(surfaceCanvas) > 0.5 ? '#f3f4f6' : '#1f1f23';
      borderEls.forEach(el => {
        const bc = rgbToHex(window.getComputedStyle(el).borderColor);
        if (bc && bc !== '#000000' && isNeutral(bc)) borderColor = bc;
      });

      // ============================================
      // ASSEMBLE DNA (same format as Claude Vision output)
      // ============================================

      return {
        colors: {
          brandLight,
          brandDefault,
          brandDark,
          surfaceCanvas,
          surfaceBase,
          surfaceMuted,
          textPrimary,
          textSecondary,
          textTertiary,
          borderSubtle,
          borderDefault: borderColor
        },
        typography: {
          fontFamily: bodyFont || 'Inter',
          display: getFontInfo(h1) || { size: '56px', weight: '800' },
          h1: getFontInfo(h1) || { size: '48px', weight: '700' },
          h2: getFontInfo(h2) || { size: '36px', weight: '600' },
          h3: getFontInfo(h3) || { size: '24px', weight: '600' },
          body: getFontInfo(bodyText) || { size: '16px', weight: '400' },
          small: { size: '14px', weight: '400' },
          micro: { size: '12px', weight: '500' }
        },
        components: {
          cards: cardStyles,
          buttons: btnStyles,
          inputs: inputStyles
        },
        spacing: {
          baseUnit: '8px',
          density: avgSectionPad > 80 ? 'spacious' : avgSectionPad > 40 ? 'cozy' : 'compact',
          cardGaps: '24px',
          sectionGaps: `${avgSectionPad}px`
        },
        _meta: {
          extractionMethod: 'dom',
          colorCandidates: sortedColors.slice(0, 5).map(([hex, count]) => ({ hex, count })),
          bgCandidates: sortedBgs.slice(0, 3).map(([hex, count]) => ({ hex, count })),
          elementsScanned: allElements.length
        }
      };
    });

    return {
      designDNA,
      screenshot,
      extractionMethod: 'dom'
    };

  } finally {
    await browser.close();
  }
}

/**
 * Quick confidence check on DOM-extracted DNA
 * Returns true if the extraction looks solid enough to skip AI
 */
export function isDOMExtractionConfident(dna) {
  if (!dna?._meta) return false;

  const meta = dna._meta;

  // Need at least some elements to have been scanned
  if (meta.elementsScanned < 5) return false;

  // Need at least one color candidate with decent weight
  if (!meta.colorCandidates || meta.colorCandidates.length === 0) return false;
  if (meta.colorCandidates[0].count < 2) return false;

  // Brand color should be a valid hex
  if (!dna.colors?.brandDefault || dna.colors.brandDefault === '#000000') return false;

  // Font should not be empty
  if (!dna.typography?.fontFamily) return false;

  return true;
}

export default { extractFromDOM, isDOMExtractionConfident };
