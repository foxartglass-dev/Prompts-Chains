/**
 * StyleLock Default Settings
 * All configurable parameters for the StyleLock engine
 * These can be overridden per-job or globally via the settings API
 */

export const DEFAULT_SETTINGS = {
  // === GENERATION ===
  generation: {
    numGenerators: 3,              // How many prompts to try each round
    generatorModel: 'gpt-4o',      // Model for generating prompts
    imageModel: 'flux-1.1-pro',    // Image generation model
    imageWidth: 1024,
    imageHeight: 768,
    diversityStrategies: ['literal', 'lighting_focus', 'composition_focus']
  },

  // === VOTING ===
  voting: {
    numVoters: 3,                  // Always odd number
    voterModel: 'gpt-4o',
    advanceThreshold: 85,          // % score to advance to blind test
    topAdvance: 1                  // How many top candidates advance per round
  },

  // === BLIND TEST ===
  blindTest: {
    numJudges: 3,
    judgeModels: ['gpt-4o', 'gpt-4o', 'gpt-4o'], // Can mix models
    passThreshold: 0.66,           // % of judges that must be fooled
    numReferenceImages: 3          // How many real images to include in blind test
  },

  // === LIMITS ===
  limits: {
    maxRounds: 10,
    maxCost: 5.00,                 // USD
    warnAtCost: 3.00,              // USD - emit warning event
    maxImagesPerRound: 3
  },

  // === CHECKPOINTS ===
  checkpoints: {
    enableHumanCheckpoint: false,
    humanCheckpointRound: 5,
    enablePlateauDetection: true,
    plateauRounds: 3,              // Rounds without improvement to trigger
    plateauMinImprovement: 2       // Minimum % improvement expected
  },

  // === TIERED SUCCESS ===
  tiers: {
    thresholds: {
      perfect: 90,
      goodEnough: 80,
      partial: 70
    },
    actions: {
      perfect: 'auto_use',
      goodEnough: 'auto_use',
      partial: 'ask_user',
      failed: 'flag_review'
    }
  },

  // === FALLBACK ===
  fallback: {
    enabled: true,
    models: ['flux-1.1-pro', 'dall-e-3'],
    maxAttemptsPerModel: 2
  },

  // === BATCH MODE ===
  batch: {
    enableQualityChecks: true,
    checkIntervals: [10, 50, 100], // Check at these image counts
    checkMethod: 'voting',         // 'voting' or 'blind_test'
    failureAction: 'pause'         // 'pause', 'warn', 'continue'
  },

  // === DIFFICULTY ESTIMATION ===
  difficulty: {
    enabled: true,
    factors: {
      commonSubject: -1,           // Makes it easier
      rareSubject: +2,
      genericEnvironment: -1,
      specificEnvironment: +1,
      naturalLighting: -1,
      complexLighting: +2,
      stockPhotoStyle: -2,
      artisticStyle: +3
    }
  },

  // === COST ESTIMATES (USD) ===
  costs: {
    'gpt-4o-vision': 0.01,         // Per image analyzed
    'gpt-4o-text': 0.003,          // Per prompt generation
    'flux-1.1-pro': 0.04,          // Per image generated
    'dall-e-3': 0.08,              // Per image generated
    'claude-sonnet': 0.008         // Per analysis
  }
};

/**
 * Deep merge helper
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Merge user settings with defaults
 */
export function mergeSettings(userSettings = {}) {
  return deepMerge(DEFAULT_SETTINGS, userSettings);
}

/**
 * Validate settings
 */
export function validateSettings(settings) {
  const errors = [];

  // Voters must be odd
  if (settings.voting?.numVoters % 2 === 0) {
    errors.push('Number of voters must be odd');
  }

  // Judges must be odd
  if (settings.blindTest?.numJudges % 2 === 0) {
    errors.push('Number of blind test judges must be odd');
  }

  // Thresholds must be in order
  if (settings.tiers?.thresholds) {
    if (settings.tiers.thresholds.perfect <= settings.tiers.thresholds.goodEnough) {
      errors.push('Perfect threshold must be higher than goodEnough');
    }
  }

  // Advance threshold should be reasonable
  if (settings.voting?.advanceThreshold < 50 || settings.voting?.advanceThreshold > 100) {
    errors.push('Advance threshold must be between 50 and 100');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
