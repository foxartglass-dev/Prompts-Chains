/**
 * StyleLock - Main Module Exports
 * AI-powered image style matching engine
 */

// Main Engine
export { StyleLockEngine, createStyleLockEngine } from './engine.js';

// Style DNA
export { extractStyleDNA, analyzeReferenceConsistency, detectAIGenerated } from './style-dna.js';

// Prompt Generation
export { generatePrompts, buildPromptFromTemplate, refinePrompt } from './prompt-generator.js';

// Voting
export { voteOnImage, voteOnCandidates, aggregateFeedback } from './voting.js';

// Blind Test
export { runBlindTest, quickQualityCheck } from './blind-test.js';

// Settings
export { DEFAULT_SETTINGS, mergeSettings, validateSettings } from './default-settings.js';

// Settings Service
export {
  getGlobalSettings,
  getWebsiteSettings,
  saveGlobalSettings,
  saveWebsiteSettings,
  applyPreset,
  applyWebsitePreset,
  getPresets,
  deleteWebsiteSettings,
  getSettingsHistory,
  getEffectiveSettings,
  clearSettingsCache,
  PRESETS
} from './settings-service.js';

// Niche Service
export {
  createNiche,
  getNiches,
  getNiche,
  lockNiche,
  unlockNiche,
  recordNicheUsage,
  searchNiches,
  deleteNiche,
  getEnvironments,
  ENVIRONMENTS
} from './niche-service.js';

// Prompt Bank Service
export {
  savePrompt,
  getPrompts,
  getPrompt,
  findSimilarPrompts,
  recordPromptUsage,
  getTopPrompts,
  deletePrompt,
  getNichePrompts,
  getPromptStats
} from './prompt-bank-service.js';

// Utilities - Reference Validation, Difficulty Estimation, Uniforms, Plateau Detection
export {
  validateReferenceImages,
  checkImageAccessibility,
  estimateDifficulty,
  DIFFICULTY_FACTORS,
  buildUniformConfig,
  UNIFORM_TYPES,
  suggestUniform,
  detectPlateau,
  suggestRecoveryStrategies
} from './utils.js';
