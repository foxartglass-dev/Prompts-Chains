/**
 * DNA Confidence Scorer
 *
 * Analyzes extracted design DNA and returns a confidence score (0-100)
 * plus human-readable reasons. Used to set user expectations AFTER
 * generation, not before (so it doesn't discourage them from trying).
 */

/**
 * Score the confidence of a design DNA extraction
 * @param {object} dna - The extracted design DNA from Claude Vision
 * @returns {{ score: number, label: string, reasons: string[], tips: string[] }}
 */
export function scoreDNA(dna) {
  let score = 100;
  const reasons = [];
  const tips = [];

  // --- Color checks ---
  const colors = dna.colors || {};

  // Check if brand color is a gradient string instead of hex
  if (colors.brandDefault && !isValidHex(colors.brandDefault)) {
    score -= 15;
    reasons.push('Brand color detected as gradient — we picked the dominant color');
    tips.push('Use the color picker to adjust your brand color');
  }

  // Check if there are multiple competing accent colors (brand vs brandLight are too different)
  if (colors.brandDefault && colors.brandLight) {
    const similarity = colorSimilarity(colors.brandDefault, colors.brandLight);
    if (similarity < 0.3) {
      score -= 8;
      reasons.push('Multiple accent colors detected — picked the strongest one');
    }
  }

  // Check surface color clarity (is it clearly light or dark mode?)
  if (colors.surfaceCanvas && colors.surfaceBase) {
    const canvasLum = luminance(colors.surfaceCanvas);
    const baseLum = luminance(colors.surfaceBase);
    // If they're on different sides of the spectrum, mixed mode detected
    if ((canvasLum > 0.5 && baseLum < 0.3) || (canvasLum < 0.3 && baseLum > 0.5)) {
      score -= 10;
      reasons.push('Mixed light/dark sections detected — we picked the dominant mode');
      tips.push('Check the background colors and adjust if needed');
    }
  }

  // Check text contrast
  if (colors.textPrimary && colors.surfaceCanvas) {
    const contrast = contrastRatio(colors.textPrimary, colors.surfaceCanvas);
    if (contrast < 3) {
      score -= 5;
      reasons.push('Low text contrast detected in source site');
    }
  }

  // --- Typography checks ---
  const typo = dna.typography || {};

  // Check if font is a known Google Font vs a guess
  const knownFonts = [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway',
    'Nunito', 'Source Sans Pro', 'Oswald', 'Playfair Display', 'Merriweather',
    'PT Sans', 'Noto Sans', 'Ubuntu', 'Rubik', 'Work Sans', 'DM Sans',
    'Quicksand', 'Barlow', 'Manrope', 'Space Grotesk', 'Plus Jakarta Sans',
    'Outfit', 'Sora', 'Figtree', 'Geist', 'Satoshi', 'General Sans',
    'Cabinet Grotesk', 'Clash Display', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman'
  ];
  const fontFamily = typo.fontFamily || '';
  const isKnownFont = knownFonts.some(f => fontFamily.toLowerCase().includes(f.toLowerCase()));
  if (!isKnownFont && fontFamily && fontFamily !== 'system-ui') {
    score -= 5;
    reasons.push(`Font "${fontFamily}" detected — may be a custom/premium font, substituted with closest match`);
    tips.push('You can change the font family in the customizer');
  }

  // Check if font sizes are reasonable
  const h1Size = parseInt(typo.h1?.size) || 0;
  if (h1Size > 80 || h1Size < 20) {
    score -= 3;
    reasons.push('Unusual heading sizes detected — adjusted to standard scale');
  }

  // --- Component checks ---
  const components = dna.components || {};

  // Check card styling completeness
  const cards = components.cards || {};
  if (!cards.radius && !cards.shadow && !cards.border) {
    score -= 5;
    reasons.push('Card styling not clearly visible — used sensible defaults');
  }

  // Check button styling
  const buttons = components.buttons || {};
  if (!buttons.radius || !buttons.background) {
    score -= 3;
    reasons.push('Button style partially detected — filled in defaults');
  }

  // --- Spacing checks ---
  const spacing = dna.spacing || {};
  if (!spacing.baseUnit && !spacing.cardGaps) {
    score -= 3;
    reasons.push('Spacing system not clearly defined — used standard 8px grid');
  }

  // Clamp score
  score = Math.max(40, Math.min(100, score));

  // Generate label and explanation based on tier
  let label;
  let explanation;
  if (score >= 90) {
    label = 'Excellent match';
    explanation = 'Your site has a clean, well-defined design system. The extracted theme is a near-perfect representation of the original.';
  } else if (score >= 80) {
    label = 'Strong match';
    explanation = 'Great extraction. A few design elements were interpreted from visual cues rather than exact values. The theme captures the look and feel accurately.';
  } else if (score >= 70) {
    label = 'Good match — minor tweaks recommended';
    explanation = 'The core design DNA was captured well. Some elements like gradients or custom fonts needed interpretation. Use the color pickers below to fine-tune — most people get it perfect in under 30 seconds.';
  } else if (score >= 60) {
    label = 'Solid starting point';
    explanation = 'This site uses advanced design techniques (gradients, overlays, custom illustrations) that make exact extraction harder. We captured the dominant colors and typography — adjust the brand color and font below to dial it in. This is normal for highly artistic or illustration-heavy sites.';
    tips.push('Try adjusting the brand color first — that usually gets it 90% of the way there');
  } else {
    label = 'Creative site detected';
    explanation = 'This site relies heavily on images, illustrations, or highly custom CSS effects rather than a traditional design system. We extracted what we could and filled in professional defaults. Think of this as a curated starting point — use the tweaker below to make it yours. Sites like this are the 5% where manual adjustment gets the best results.';
    tips.push('Start by setting your brand color, then adjust the background');
    tips.push('The generated pages use professional layout patterns that work great once colors are dialed in');
  }

  // Add default tip if score isn't perfect
  if (score < 95 && tips.length === 0) {
    tips.push('Use the color and font pickers below to fine-tune your theme');
  }

  return { score, label, explanation, reasons, tips };
}

// --- Utility functions ---

function isValidHex(str) {
  if (!str || typeof str !== 'string') return false;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(str.trim());
}

function hexToRgb(hex) {
  if (!isValidHex(hex)) return { r: 128, g: 128, b: 128 };
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16)
  };
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function contrastRatio(hex1, hex2) {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function colorSimilarity(hex1, hex2) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  const dist = Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
  // 0 = identical, 1 = completely different (max dist ~441)
  return 1 - (dist / 441);
}

export default { scoreDNA };
