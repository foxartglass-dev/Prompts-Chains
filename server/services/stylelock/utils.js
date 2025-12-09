/**
 * StyleLock Utility Functions
 * Reference validation, difficulty estimation, and uniform handling
 */

import OpenAI from 'openai';

// ========== REFERENCE IMAGE VALIDATION ==========

/**
 * Validate that reference images are consistent and suitable
 * @param {Array} referenceImages - URLs or paths to reference images
 * @param {string} apiKey - OpenAI API key
 * @returns {object} - Validation result with score, issues, and recommendations
 */
export async function validateReferenceImages(referenceImages, apiKey) {
  if (!referenceImages || referenceImages.length === 0) {
    return {
      valid: false,
      score: 0,
      issues: ['No reference images provided'],
      recommendations: ['Upload at least 3-5 reference images for best results']
    };
  }

  if (referenceImages.length < 3) {
    return {
      valid: true,
      score: 50,
      issues: ['Few reference images - style extraction may be less accurate'],
      recommendations: [
        'Add more reference images (3-5 recommended)',
        'Use images with consistent style'
      ]
    };
  }

  // For full validation, we would analyze the images
  // This is a simplified version that returns reasonable defaults
  const issues = [];
  const recommendations = [];
  let score = 80;

  if (referenceImages.length > 10) {
    issues.push('Many reference images - may increase processing time');
    recommendations.push('Consider using 5-7 of your best reference images');
    score -= 5;
  }

  // Check for mixed formats (basic validation)
  const formats = new Set();
  for (const img of referenceImages) {
    const url = typeof img === 'string' ? img : img.url;
    const ext = url.split('.').pop()?.toLowerCase();
    if (ext) formats.add(ext);
  }

  if (formats.size > 2) {
    issues.push('Mixed image formats detected');
    recommendations.push('Use consistent image formats (preferably JPG or PNG)');
    score -= 5;
  }

  return {
    valid: true,
    score,
    imageCount: referenceImages.length,
    formats: Array.from(formats),
    issues,
    recommendations
  };
}

/**
 * Check if an image URL is accessible
 */
export async function checkImageAccessibility(imageUrl) {
  try {
    // For local paths, check if they start with /uploads
    if (imageUrl.startsWith('/uploads')) {
      return { accessible: true, type: 'local' };
    }

    // For URLs, do a HEAD request
    const response = await fetch(imageUrl, { method: 'HEAD' });
    return {
      accessible: response.ok,
      type: 'remote',
      status: response.status,
      contentType: response.headers.get('content-type')
    };
  } catch (error) {
    return {
      accessible: false,
      type: 'unknown',
      error: error.message
    };
  }
}

// ========== DIFFICULTY ESTIMATION ==========

/**
 * Difficulty factors that affect how hard it is to match a style
 */
export const DIFFICULTY_FACTORS = {
  // Subject complexity
  commonSubject: -1,      // e.g., person, building, car
  rareSubject: +2,        // e.g., specific equipment, unique objects
  multipleSubjects: +1,   // Multiple distinct subjects in image

  // Environment
  genericEnvironment: -1, // e.g., office, home, outdoors
  specificEnvironment: +1, // e.g., specific room type, unique location
  outdoorVariability: +1,  // Weather, time of day variations

  // Lighting
  naturalLighting: -1,    // Even, natural light
  complexLighting: +2,    // Multiple sources, dramatic shadows
  artificialMix: +1,      // Mix of natural and artificial

  // Style
  stockPhotoStyle: -2,    // Generic professional look
  artisticStyle: +3,      // Distinctive artistic treatment
  brandedStyle: +2,       // Specific brand look and feel

  // Technical
  highDetail: +1,         // Lots of fine detail to match
  simpleComposition: -1,  // Straightforward framing
  complexComposition: +2  // Layered, complex scenes
};

/**
 * Estimate difficulty of matching a style
 * @param {object} styleDNA - Extracted style DNA
 * @param {string} targetDescription - What needs to be generated
 * @returns {object} - Difficulty estimate with score and factors
 */
export function estimateDifficulty(styleDNA, targetDescription) {
  const factors = [];
  let baseScore = 50; // Start at medium difficulty

  // Analyze style DNA
  if (styleDNA) {
    // Lighting complexity
    if (styleDNA.lighting) {
      const lighting = styleDNA.lighting;
      if (lighting.type === 'natural' && lighting.quality === 'soft') {
        factors.push({ factor: 'Natural lighting', adjustment: DIFFICULTY_FACTORS.naturalLighting });
        baseScore += DIFFICULTY_FACTORS.naturalLighting;
      }
      if (lighting.type === 'studio' || lighting.type === 'dramatic') {
        factors.push({ factor: 'Complex lighting', adjustment: DIFFICULTY_FACTORS.complexLighting });
        baseScore += DIFFICULTY_FACTORS.complexLighting;
      }
    }

    // Composition complexity
    if (styleDNA.composition) {
      const comp = styleDNA.composition;
      if (comp.framing === 'center' || comp.framing === 'standard') {
        factors.push({ factor: 'Simple composition', adjustment: DIFFICULTY_FACTORS.simpleComposition });
        baseScore += DIFFICULTY_FACTORS.simpleComposition;
      }
      if (comp.elements && comp.elements.length > 3) {
        factors.push({ factor: 'Complex composition', adjustment: DIFFICULTY_FACTORS.complexComposition });
        baseScore += DIFFICULTY_FACTORS.complexComposition;
      }
    }

    // Style type
    if (styleDNA.mood) {
      const mood = styleDNA.mood.toLowerCase();
      if (mood.includes('professional') || mood.includes('corporate')) {
        factors.push({ factor: 'Stock photo style', adjustment: DIFFICULTY_FACTORS.stockPhotoStyle });
        baseScore += DIFFICULTY_FACTORS.stockPhotoStyle;
      }
      if (mood.includes('artistic') || mood.includes('unique')) {
        factors.push({ factor: 'Artistic style', adjustment: DIFFICULTY_FACTORS.artisticStyle });
        baseScore += DIFFICULTY_FACTORS.artisticStyle;
      }
    }
  }

  // Analyze target description
  if (targetDescription) {
    const desc = targetDescription.toLowerCase();

    // Common subjects
    const commonSubjects = ['person', 'worker', 'technician', 'professional', 'building', 'office', 'home'];
    if (commonSubjects.some(s => desc.includes(s))) {
      factors.push({ factor: 'Common subject', adjustment: DIFFICULTY_FACTORS.commonSubject });
      baseScore += DIFFICULTY_FACTORS.commonSubject;
    }

    // Rare subjects
    const rareSubjects = ['specialized equipment', 'custom', 'unique', 'specific tool'];
    if (rareSubjects.some(s => desc.includes(s))) {
      factors.push({ factor: 'Rare subject', adjustment: DIFFICULTY_FACTORS.rareSubject });
      baseScore += DIFFICULTY_FACTORS.rareSubject;
    }

    // Multiple subjects
    if (desc.includes(' and ') || desc.includes(' with ')) {
      factors.push({ factor: 'Multiple subjects', adjustment: DIFFICULTY_FACTORS.multipleSubjects });
      baseScore += DIFFICULTY_FACTORS.multipleSubjects;
    }
  }

  // Clamp score between 0 and 100
  const finalScore = Math.max(0, Math.min(100, baseScore));

  // Determine difficulty level
  let level;
  if (finalScore < 40) level = 'easy';
  else if (finalScore < 60) level = 'medium';
  else if (finalScore < 80) level = 'hard';
  else level = 'very_hard';

  // Estimate rounds needed
  const estimatedRounds = level === 'easy' ? 2-3 :
                          level === 'medium' ? 4-6 :
                          level === 'hard' ? 6-8 : 8-10;

  return {
    score: finalScore,
    level,
    factors,
    estimatedRounds: `${estimatedRounds}`,
    recommendations: getDifficultyRecommendations(level, factors)
  };
}

/**
 * Get recommendations based on difficulty
 */
function getDifficultyRecommendations(level, factors) {
  const recommendations = [];

  if (level === 'very_hard') {
    recommendations.push('Consider using the aggressive settings preset for this niche');
    recommendations.push('Ensure reference images are highly consistent');
    recommendations.push('May require human review checkpoint');
  } else if (level === 'hard') {
    recommendations.push('Use balanced or aggressive settings');
    recommendations.push('5+ reference images recommended');
  } else if (level === 'medium') {
    recommendations.push('Standard settings should work well');
    recommendations.push('3-5 reference images recommended');
  } else {
    recommendations.push('Conservative settings may be sufficient');
    recommendations.push('Good candidate for batch processing');
  }

  return recommendations;
}

// ========== UNIFORM HANDLING ==========

/**
 * Build uniform configuration
 * @param {object} options - Uniform options
 * @returns {object} - Formatted uniform config for StyleLock
 */
export function buildUniformConfig(options) {
  const {
    enabled = false,
    type = 'polo',
    color = null,
    colorHex = null,
    logo = null,
    companyName = null,
    additionalDetails = ''
  } = options;

  if (!enabled) {
    return { enabled: false };
  }

  let description = type;

  if (color) {
    description = `${color} ${type}`;
  }

  if (companyName) {
    description += ` with ${companyName} branding`;
  }

  if (logo) {
    description += `, company logo on ${logo === 'chest' ? 'left chest' : logo}`;
  }

  if (additionalDetails) {
    description += `, ${additionalDetails}`;
  }

  return {
    enabled: true,
    type,
    color,
    colorHex,
    logo,
    companyName,
    description
  };
}

/**
 * Common uniform types for local service businesses
 */
export const UNIFORM_TYPES = {
  polo: {
    name: 'Polo Shirt',
    description: 'Professional polo shirt, common for service technicians',
    goodFor: ['HVAC', 'plumbing', 'electrical', 'appliance repair']
  },
  button_up: {
    name: 'Button-Up Shirt',
    description: 'Collared button-up shirt, more formal look',
    goodFor: ['real estate', 'consulting', 'sales', 'office services']
  },
  t_shirt: {
    name: 'T-Shirt',
    description: 'Casual t-shirt with logo',
    goodFor: ['lawn care', 'moving', 'cleaning', 'general labor']
  },
  coveralls: {
    name: 'Coveralls',
    description: 'Full coveralls/jumpsuit for heavy work',
    goodFor: ['auto repair', 'painting', 'industrial', 'construction']
  },
  vest: {
    name: 'Safety Vest',
    description: 'High-visibility safety vest',
    goodFor: ['roofing', 'construction', 'road work', 'utilities']
  },
  apron: {
    name: 'Apron',
    description: 'Work apron for crafts and trades',
    goodFor: ['carpentry', 'welding', 'artisan work']
  }
};

/**
 * Suggest uniform type based on niche
 */
export function suggestUniform(nicheName, environment) {
  const name = (nicheName || '').toLowerCase();
  const env = (environment || '').toLowerCase();

  // Match based on niche name
  if (name.includes('plumb') || name.includes('hvac') || name.includes('electric')) {
    return { type: 'polo', confidence: 0.9 };
  }

  if (name.includes('real estate') || name.includes('consult') || name.includes('account')) {
    return { type: 'button_up', confidence: 0.9 };
  }

  if (name.includes('lawn') || name.includes('landscap') || name.includes('clean')) {
    return { type: 't_shirt', confidence: 0.8 };
  }

  if (name.includes('roof') || name.includes('construct') || name.includes('solar')) {
    return { type: 'vest', confidence: 0.9 };
  }

  if (name.includes('auto') || name.includes('paint') || name.includes('body')) {
    return { type: 'coveralls', confidence: 0.8 };
  }

  // Match based on environment
  if (env === 'in-office') {
    return { type: 'button_up', confidence: 0.7 };
  }

  if (env === 'on-site-field') {
    return { type: 'vest', confidence: 0.7 };
  }

  if (env === 'commercial') {
    return { type: 'polo', confidence: 0.6 };
  }

  // Default
  return { type: 'polo', confidence: 0.5 };
}

// ========== PLATEAU DETECTION ==========

/**
 * Analyze rounds for plateau detection
 * @param {Array} rounds - Array of round results
 * @param {object} options - Detection options
 * @returns {object} - Plateau analysis
 */
export function detectPlateau(rounds, options = {}) {
  const {
    minRounds = 3,           // Minimum rounds to analyze
    minImprovement = 2,      // Minimum % improvement expected
    windowSize = 3           // Rounds to look at for plateau
  } = options;

  if (!rounds || rounds.length < minRounds) {
    return {
      isPlateau: false,
      reason: 'Not enough rounds to detect plateau',
      roundsAnalyzed: rounds?.length || 0
    };
  }

  // Get recent scores
  const recentRounds = rounds.slice(-windowSize);
  const scores = recentRounds.map(r => r.bestScore || 0);

  // Calculate improvement
  const firstScore = scores[0];
  const lastScore = scores[scores.length - 1];
  const totalImprovement = lastScore - firstScore;
  const avgImprovement = totalImprovement / (scores.length - 1);

  // Check for plateau
  const isPlateau = avgImprovement < minImprovement;

  // Analyze trend
  let trend = 'stable';
  if (avgImprovement > minImprovement) trend = 'improving';
  if (avgImprovement < -minImprovement) trend = 'declining';

  // Identify issues from feedback
  const feedbackSummary = {};
  for (const round of recentRounds) {
    if (round.feedback) {
      const items = round.feedback.split(';').map(f => f.trim()).filter(f => f);
      for (const item of items) {
        feedbackSummary[item] = (feedbackSummary[item] || 0) + 1;
      }
    }
  }

  // Get top recurring issues
  const topIssues = Object.entries(feedbackSummary)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([issue, count]) => ({ issue, frequency: count }));

  return {
    isPlateau,
    trend,
    scores,
    averageImprovement: avgImprovement,
    totalImprovement,
    roundsAnalyzed: recentRounds.length,
    topIssues,
    recommendations: getPlateauRecommendations(isPlateau, trend, topIssues)
  };
}

/**
 * Get recommendations for breaking out of a plateau
 */
function getPlateauRecommendations(isPlateau, trend, topIssues) {
  const recommendations = [];

  if (isPlateau) {
    recommendations.push('Consider changing diversity strategies');
    recommendations.push('Review reference images for consistency');
    recommendations.push('Try adjusting the target description');

    if (topIssues.length > 0) {
      recommendations.push(`Focus on fixing: ${topIssues[0].issue}`);
    }
  }

  if (trend === 'declining') {
    recommendations.push('Reset diversity strategies to defaults');
    recommendations.push('May need more/better reference images');
  }

  return recommendations;
}

/**
 * Suggest recovery strategies for plateau
 */
export function suggestRecoveryStrategies(plateauAnalysis) {
  const strategies = [];

  if (plateauAnalysis.isPlateau) {
    strategies.push({
      name: 'Increase Diversity',
      description: 'Try more diverse prompt strategies',
      action: { diversityStrategies: ['literal', 'lighting_focus', 'composition_focus', 'color_focus', 'mood_focus'] }
    });

    strategies.push({
      name: 'Bump Generators',
      description: 'Increase number of generators temporarily',
      action: { numGenerators: 5 }
    });

    if (plateauAnalysis.topIssues.length > 0) {
      strategies.push({
        name: 'Target Issue',
        description: `Focus prompts on fixing: ${plateauAnalysis.topIssues[0].issue}`,
        action: { targetedFix: plateauAnalysis.topIssues[0].issue }
      });
    }
  }

  return strategies;
}
