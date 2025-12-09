/**
 * StyleLock Settings Service Tests
 * Tests for presets, caching, and settings management
 */

import assert from 'assert';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  validateSettings
} from '../default-settings.js';
import {
  PRESETS,
  getPresets,
  clearSettingsCache
} from '../settings-service.js';

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

function runTests() {
  console.log('\n=== StyleLock Settings Service Tests ===\n');
  let passed = 0;
  let failed = 0;

  // ========== PRESET TESTS ==========
  console.log('--- Preset Tests ---\n');

  if (test('PRESETS contains all expected presets', () => {
    assert(PRESETS.conservative, 'Should have conservative preset');
    assert(PRESETS.balanced, 'Should have balanced preset');
    assert(PRESETS.aggressive, 'Should have aggressive preset');
  })) passed++; else failed++;

  if (test('Conservative preset has lower settings', () => {
    const con = PRESETS.conservative.settings;
    const bal = PRESETS.balanced.settings;
    assert(con.generation.numGenerators <= bal.generation.numGenerators, 'Conservative should have fewer generators');
    assert(con.limits.maxCost <= bal.limits.maxCost, 'Conservative should have lower max cost');
  })) passed++; else failed++;

  if (test('Aggressive preset has higher settings', () => {
    const agg = PRESETS.aggressive.settings;
    const bal = PRESETS.balanced.settings;
    assert(agg.generation.numGenerators >= bal.generation.numGenerators, 'Aggressive should have more generators');
    assert(agg.limits.maxCost >= bal.limits.maxCost, 'Aggressive should have higher max cost');
  })) passed++; else failed++;

  if (test('All presets have odd number of voters', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      const merged = mergeSettings(preset.settings);
      assert(merged.voting.numVoters % 2 === 1, `${name} preset should have odd voters`);
    }
  })) passed++; else failed++;

  if (test('All presets have odd number of judges', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      const merged = mergeSettings(preset.settings);
      assert(merged.blindTest.numJudges % 2 === 1, `${name} preset should have odd judges`);
    }
  })) passed++; else failed++;

  if (test('All presets pass validation', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      const merged = mergeSettings(preset.settings);
      const validation = validateSettings(merged);
      assert(validation.valid, `${name} preset should be valid: ${validation.errors.join(', ')}`);
    }
  })) passed++; else failed++;

  if (test('getPresets returns all presets with descriptions', () => {
    const presets = getPresets();
    assert(Array.isArray(presets), 'Should return array');
    assert.strictEqual(presets.length, 3, 'Should have 3 presets');
    for (const preset of presets) {
      assert(preset.name, 'Preset should have name');
      assert(preset.description, 'Preset should have description');
      assert(preset.settings, 'Preset should have settings');
    }
  })) passed++; else failed++;

  // ========== PRESET VALUE TESTS ==========
  console.log('\n--- Preset Value Tests ---\n');

  if (test('Conservative preset values are reasonable', () => {
    const settings = mergeSettings(PRESETS.conservative.settings);
    assert.strictEqual(settings.generation.numGenerators, 2, 'Should have 2 generators');
    assert.strictEqual(settings.limits.maxCost, 2.00, 'Should have $2 max cost');
    assert.strictEqual(settings.voting.advanceThreshold, 80, 'Should have 80% threshold');
  })) passed++; else failed++;

  if (test('Balanced preset values are reasonable', () => {
    const settings = mergeSettings(PRESETS.balanced.settings);
    assert.strictEqual(settings.generation.numGenerators, 3, 'Should have 3 generators');
    assert.strictEqual(settings.limits.maxCost, 5.00, 'Should have $5 max cost');
    assert.strictEqual(settings.voting.advanceThreshold, 85, 'Should have 85% threshold');
  })) passed++; else failed++;

  if (test('Aggressive preset values are reasonable', () => {
    const settings = mergeSettings(PRESETS.aggressive.settings);
    assert.strictEqual(settings.generation.numGenerators, 5, 'Should have 5 generators');
    assert.strictEqual(settings.limits.maxCost, 10.00, 'Should have $10 max cost');
    assert.strictEqual(settings.voting.advanceThreshold, 90, 'Should have 90% threshold');
  })) passed++; else failed++;

  // ========== MERGE BEHAVIOR TESTS ==========
  console.log('\n--- Merge Behavior Tests ---\n');

  if (test('Preset merging fills in defaults', () => {
    const preset = PRESETS.conservative.settings;
    const merged = mergeSettings(preset);
    // Should have all settings from DEFAULT_SETTINGS filled in
    assert(merged.costs, 'Should have costs from defaults');
    assert(merged.checkpoints, 'Should have checkpoints from defaults');
    assert(merged.tiers, 'Should have tiers from defaults');
  })) passed++; else failed++;

  if (test('Double merging is idempotent', () => {
    const preset = PRESETS.balanced.settings;
    const merged1 = mergeSettings(preset);
    const merged2 = mergeSettings(merged1);
    assert.deepStrictEqual(merged1, merged2, 'Double merge should produce same result');
  })) passed++; else failed++;

  if (test('Empty object merges to defaults', () => {
    const merged = mergeSettings({});
    assert.deepStrictEqual(merged, DEFAULT_SETTINGS, 'Empty merge should equal defaults');
  })) passed++; else failed++;

  // ========== CACHE TESTS ==========
  console.log('\n--- Cache Tests ---\n');

  if (test('clearSettingsCache does not throw', () => {
    // Just verify it doesn't throw
    clearSettingsCache();
    assert(true, 'Should not throw');
  })) passed++; else failed++;

  // ========== VALIDATION EDGE CASES ==========
  console.log('\n--- Validation Edge Cases ---\n');

  if (test('Very low advanceThreshold is invalid', () => {
    const settings = mergeSettings({ voting: { advanceThreshold: 10 } });
    const result = validateSettings(settings);
    assert(!result.valid, 'Should be invalid');
  })) passed++; else failed++;

  if (test('Very high advanceThreshold is invalid', () => {
    const settings = mergeSettings({ voting: { advanceThreshold: 110 } });
    const result = validateSettings(settings);
    assert(!result.valid, 'Should be invalid');
  })) passed++; else failed++;

  if (test('Exact boundary values are valid', () => {
    const settings = mergeSettings({
      voting: { advanceThreshold: 50, numVoters: 3 },
      blindTest: { numJudges: 3 }
    });
    const result = validateSettings(settings);
    assert(result.valid, 'Boundary values should be valid');
  })) passed++; else failed++;

  // ========== SUMMARY ==========
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  if (failed > 0) {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

runTests();
