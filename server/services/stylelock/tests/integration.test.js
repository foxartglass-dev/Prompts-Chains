/**
 * StyleLock Full Integration Test
 * End-to-end test of the complete StyleLock system
 */

import assert from 'assert';

// Import all modules
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  validateSettings
} from '../default-settings.js';

import {
  StyleLockEngine,
  createStyleLockEngine
} from '../engine.js';

import {
  PRESETS,
  getPresets,
  clearSettingsCache
} from '../settings-service.js';

import {
  ENVIRONMENTS,
  getEnvironments
} from '../niche-service.js';

import {
  validateReferenceImages,
  estimateDifficulty,
  DIFFICULTY_FACTORS,
  buildUniformConfig,
  UNIFORM_TYPES,
  suggestUniform,
  detectPlateau,
  suggestRecoveryStrategies
} from '../utils.js';

// Test helper
function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    return true;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
    return false;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    return true;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
    return false;
  }
}

async function runIntegrationTests() {
  console.log('\n=== StyleLock Full Integration Tests ===\n');
  let passed = 0;
  let failed = 0;

  // ========== MODULE IMPORT TESTS ==========
  console.log('--- Module Import Tests ---\n');

  if (test('All default-settings exports are available', () => {
    assert(DEFAULT_SETTINGS, 'DEFAULT_SETTINGS should be exported');
    assert(typeof mergeSettings === 'function', 'mergeSettings should be a function');
    assert(typeof validateSettings === 'function', 'validateSettings should be a function');
  })) passed++; else failed++;

  if (test('All engine exports are available', () => {
    assert(StyleLockEngine, 'StyleLockEngine should be exported');
    assert(typeof createStyleLockEngine === 'function', 'createStyleLockEngine should be a function');
  })) passed++; else failed++;

  if (test('All settings-service exports are available', () => {
    assert(PRESETS, 'PRESETS should be exported');
    assert(typeof getPresets === 'function', 'getPresets should be a function');
    assert(typeof clearSettingsCache === 'function', 'clearSettingsCache should be a function');
  })) passed++; else failed++;

  if (test('All niche-service exports are available', () => {
    assert(ENVIRONMENTS, 'ENVIRONMENTS should be exported');
    assert(typeof getEnvironments === 'function', 'getEnvironments should be a function');
  })) passed++; else failed++;

  if (test('All utils exports are available', () => {
    assert(typeof validateReferenceImages === 'function', 'validateReferenceImages should be a function');
    assert(typeof estimateDifficulty === 'function', 'estimateDifficulty should be a function');
    assert(DIFFICULTY_FACTORS, 'DIFFICULTY_FACTORS should be exported');
    assert(typeof buildUniformConfig === 'function', 'buildUniformConfig should be a function');
    assert(UNIFORM_TYPES, 'UNIFORM_TYPES should be exported');
    assert(typeof suggestUniform === 'function', 'suggestUniform should be a function');
    assert(typeof detectPlateau === 'function', 'detectPlateau should be a function');
    assert(typeof suggestRecoveryStrategies === 'function', 'suggestRecoveryStrategies should be a function');
  })) passed++; else failed++;

  // ========== END-TO-END WORKFLOW SIMULATION ==========
  console.log('\n--- End-to-End Workflow Simulation ---\n');

  if (test('Complete plumber workflow simulation', () => {
    // 1. Get environment for plumber
    const environments = getEnvironments();
    const inHomeEnv = environments.find(e => e.key === 'in-home');
    assert(inHomeEnv, 'Should find in-home environment');
    assert(inHomeEnv.examples.some(e => e.toLowerCase().includes('plumb')), 'Should include plumbing');

    // 2. Get preset and merge settings
    const preset = PRESETS.balanced;
    const settings = mergeSettings(preset.settings);
    const validation = validateSettings(settings);
    assert(validation.valid, 'Settings should be valid');

    // 3. Estimate difficulty
    const styleDNA = {
      lighting: { type: 'natural', quality: 'soft' },
      composition: { framing: 'medium shot' }
    };
    const difficulty = estimateDifficulty(styleDNA, 'A plumber fixing a kitchen sink');
    assert(difficulty.score >= 0 && difficulty.score <= 100, 'Difficulty score should be valid');
    assert(difficulty.level, 'Should have difficulty level');

    // 4. Suggest uniform
    const uniform = suggestUniform('Plumbing', 'in-home');
    assert.strictEqual(uniform.type, 'polo', 'Should suggest polo for plumber');

    // 5. Build uniform config
    const uniformConfig = buildUniformConfig({
      enabled: true,
      type: uniform.type,
      color: 'blue',
      companyName: 'ABC Plumbing',
      logo: 'chest'
    });
    assert(uniformConfig.enabled, 'Uniform should be enabled');
    assert(uniformConfig.description.includes('blue polo'), 'Should have blue polo');

    // 6. Create engine instance
    const engine = createStyleLockEngine({
      openai: 'test-key',
      replicate: 'test-key'
    }, settings);
    assert(engine instanceof StyleLockEngine, 'Should create engine instance');

    // 7. Verify tier determination
    assert.strictEqual(engine.determineTier(95), 'PERFECT', '95 should be PERFECT');
    assert.strictEqual(engine.determineTier(85), 'GOOD_ENOUGH', '85 should be GOOD_ENOUGH');
    assert.strictEqual(engine.determineTier(75), 'PARTIAL', '75 should be PARTIAL');
    assert.strictEqual(engine.determineTier(65), 'FAILED', '65 should be FAILED');
  })) passed++; else failed++;

  if (test('Complete roofer workflow simulation', () => {
    // 1. Get environment for roofer
    const onSiteEnv = ENVIRONMENTS['on-site-field'];
    assert(onSiteEnv, 'Should find on-site-field environment');
    assert(onSiteEnv.examples.some(e => e.toLowerCase().includes('roof')), 'Should include roofing');

    // 2. Use aggressive preset
    const preset = PRESETS.aggressive;
    const settings = mergeSettings(preset.settings);
    assert.strictEqual(settings.generation.numGenerators, 5, 'Should have 5 generators');
    assert.strictEqual(settings.limits.maxCost, 10.00, 'Should have $10 max cost');

    // 3. Estimate difficulty - returns valid score
    const styleDNA = {
      lighting: { type: 'harsh sunlight', quality: 'bright' }
    };
    const difficulty = estimateDifficulty(styleDNA, 'Roofer installing shingles on a steep roof');
    assert(difficulty.score >= 0 && difficulty.score <= 100, 'Difficulty should be valid score');
    assert(difficulty.level, 'Should have difficulty level');
    assert(Array.isArray(difficulty.factors), 'Should have factors array');

    // 4. Suggest uniform
    const uniform = suggestUniform('Roofing contractor', 'on-site-field');
    assert.strictEqual(uniform.type, 'vest', 'Should suggest vest for roofer');
  })) passed++; else failed++;

  if (test('Complete real estate workflow simulation', () => {
    // 1. Get environment for real estate
    const inOfficeEnv = ENVIRONMENTS['in-office'];
    assert(inOfficeEnv, 'Should find in-office environment');

    // 2. Use conservative preset
    const preset = PRESETS.conservative;
    const settings = mergeSettings(preset.settings);
    assert.strictEqual(settings.generation.numGenerators, 2, 'Should have 2 generators');

    // 3. Suggest uniform
    const uniform = suggestUniform('Real Estate Agent', 'in-office');
    assert.strictEqual(uniform.type, 'button_up', 'Should suggest button_up for real estate');
  })) passed++; else failed++;

  // ========== REFERENCE VALIDATION WORKFLOW ==========
  console.log('\n--- Reference Validation Workflow ---\n');

  if (await asyncTest('Validation workflow with good images', async () => {
    const images = [
      'https://example.com/img1.jpg',
      'https://example.com/img2.jpg',
      'https://example.com/img3.jpg',
      'https://example.com/img4.jpg',
      'https://example.com/img5.jpg'
    ];
    const result = await validateReferenceImages(images, 'test-key');
    assert(result.valid, 'Should be valid');
    assert.strictEqual(result.imageCount, 5, 'Should have correct count');
    assert(result.score >= 70, 'Score should be reasonable');
  })) passed++; else failed++;

  if (await asyncTest('Validation workflow with insufficient images', async () => {
    const images = ['https://example.com/img1.jpg'];
    const result = await validateReferenceImages(images, 'test-key');
    assert(result.valid, 'Should still be valid but with warnings');
    assert(result.score < 80, 'Score should be lower');
    assert(result.recommendations.length > 0, 'Should have recommendations');
  })) passed++; else failed++;

  // ========== PLATEAU DETECTION WORKFLOW ==========
  console.log('\n--- Plateau Detection Workflow ---\n');

  if (test('Plateau detection and recovery workflow', () => {
    // Simulate a stuck optimization loop
    const stuckRounds = [
      { bestScore: 72, feedback: 'lighting is too bright' },
      { bestScore: 73, feedback: 'lighting still too harsh' },
      { bestScore: 71, feedback: 'lighting needs adjustment' },
      { bestScore: 72, feedback: 'lighting incorrect' }
    ];

    const analysis = detectPlateau(stuckRounds);
    assert(analysis.isPlateau, 'Should detect plateau');
    assert.strictEqual(analysis.trend, 'stable', 'Trend should be stable');
    assert(analysis.topIssues.length > 0, 'Should identify top issues');
    assert(analysis.topIssues[0].issue.toLowerCase().includes('light'), 'Should identify lighting as issue');

    // Get recovery strategies
    const strategies = suggestRecoveryStrategies(analysis);
    assert(strategies.length > 0, 'Should suggest recovery strategies');
    assert(strategies[0].name, 'Strategy should have name');
    assert(strategies[0].action, 'Strategy should have action');
  })) passed++; else failed++;

  if (test('No plateau when improving', () => {
    const improvingRounds = [
      { bestScore: 60 },
      { bestScore: 70 },
      { bestScore: 78 },
      { bestScore: 85 }
    ];

    const analysis = detectPlateau(improvingRounds);
    assert(!analysis.isPlateau, 'Should not detect plateau');
    assert.strictEqual(analysis.trend, 'improving', 'Trend should be improving');

    const strategies = suggestRecoveryStrategies(analysis);
    assert.strictEqual(strategies.length, 0, 'Should not suggest strategies when improving');
  })) passed++; else failed++;

  // ========== SETTINGS CONSISTENCY ==========
  console.log('\n--- Settings Consistency ---\n');

  if (test('All presets produce valid settings when merged', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      const merged = mergeSettings(preset.settings);
      const validation = validateSettings(merged);
      assert(validation.valid, `${name} preset should produce valid settings: ${validation.errors.join(', ')}`);
    }
  })) passed++; else failed++;

  if (test('Settings cascade correctly', () => {
    // Start with defaults
    let settings = mergeSettings({});
    assert.strictEqual(settings.generation.numGenerators, 3, 'Default should have 3 generators');

    // Override with preset
    settings = mergeSettings(PRESETS.conservative.settings);
    assert.strictEqual(settings.generation.numGenerators, 2, 'Conservative should override to 2');

    // Override preset with custom
    settings = mergeSettings({
      ...PRESETS.conservative.settings,
      generation: { ...PRESETS.conservative.settings.generation, numGenerators: 4 }
    });
    assert.strictEqual(settings.generation.numGenerators, 4, 'Custom should override to 4');
  })) passed++; else failed++;

  // ========== COST CALCULATION CONSISTENCY ==========
  console.log('\n--- Cost Calculation ---\n');

  if (test('Cost values are consistent across presets', () => {
    const conSettings = mergeSettings(PRESETS.conservative.settings);
    const balSettings = mergeSettings(PRESETS.balanced.settings);
    const aggSettings = mergeSettings(PRESETS.aggressive.settings);

    assert(conSettings.limits.maxCost < balSettings.limits.maxCost, 'Conservative should have lower max cost');
    assert(balSettings.limits.maxCost < aggSettings.limits.maxCost, 'Balanced should have lower max cost than aggressive');
  })) passed++; else failed++;

  // ========== ENGINE CREATION ==========
  console.log('\n--- Engine Creation ---\n');

  if (test('Engine can be created with all presets', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      const engine = createStyleLockEngine({
        openai: 'test-key',
        replicate: 'test-key'
      }, mergeSettings(preset.settings));

      assert(engine instanceof StyleLockEngine, `Should create engine with ${name} preset`);
    }
  })) passed++; else failed++;

  if (test('Engine handles job result formatting', () => {
    const engine = createStyleLockEngine({ openai: 'test', replicate: 'test' });

    const now = new Date();
    const startTime = new Date(now.getTime() - 60000);
    const mockJob = {
      id: 'test-job-123',
      createdAt: startTime,
      completedAt: now,
      currentRound: 2,
      rounds: [{ bestScore: 75 }, { bestScore: 85 }],
      totalCost: 2.50,
      costBreakdown: { styleDNA: 0.10, prompts: 0.20, images: 1.50, voting: 0.50, blindTest: 0.20 },
      winningPrompt: 'Test prompt',
      winningImageUrl: 'https://example.com/img.jpg',
      finalScore: 85,
      status: 'complete',
      tier: 'GOOD_ENOUGH',
      blindTestPassed: true,
      styleDNA: { test: true }
    };

    const result = engine.formatJobResult(mockJob, true);
    assert(result.success, 'Should be successful');
    assert.strictEqual(result.jobId, 'test-job-123', 'Should have job ID');
    assert.strictEqual(result.totalCost, 2.50, 'Should have total cost');
    assert.strictEqual(result.rounds, 2, 'Should have rounds count');
    assert(result.duration > 0, 'Should have duration');
    assert.strictEqual(result.tier, 'GOOD_ENOUGH', 'Should have tier');
  })) passed++; else failed++;

  // ========== SUMMARY ==========
  console.log('\n=== Integration Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  if (failed > 0) {
    console.log('\n❌ Some integration tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All integration tests passed!');
    console.log('\n🎉 StyleLock Engine is ready for use!');
    process.exit(0);
  }
}

runIntegrationTests();
