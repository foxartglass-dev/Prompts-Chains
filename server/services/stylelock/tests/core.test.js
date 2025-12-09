/**
 * StyleLock Core Engine Tests
 * Tests for utility functions and core logic that don't require API keys
 */

import assert from 'assert';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  validateSettings
} from '../default-settings.js';
import { buildPromptFromTemplate } from '../prompt-generator.js';
import { aggregateFeedback } from '../voting.js';
import { StyleLockEngine } from '../engine.js';

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
  console.log('\n=== StyleLock Core Engine Tests ===\n');
  let passed = 0;
  let failed = 0;

  // ========== DEFAULT SETTINGS TESTS ==========
  console.log('--- Settings Tests ---\n');

  if (test('DEFAULT_SETTINGS has required sections', () => {
    assert(DEFAULT_SETTINGS.generation, 'Should have generation settings');
    assert(DEFAULT_SETTINGS.voting, 'Should have voting settings');
    assert(DEFAULT_SETTINGS.blindTest, 'Should have blindTest settings');
    assert(DEFAULT_SETTINGS.limits, 'Should have limits settings');
    assert(DEFAULT_SETTINGS.checkpoints, 'Should have checkpoints settings');
    assert(DEFAULT_SETTINGS.tiers, 'Should have tiers settings');
    assert(DEFAULT_SETTINGS.costs, 'Should have costs settings');
  })) passed++; else failed++;

  if (test('DEFAULT_SETTINGS has odd number of voters', () => {
    assert(DEFAULT_SETTINGS.voting.numVoters % 2 === 1, 'numVoters should be odd');
  })) passed++; else failed++;

  if (test('DEFAULT_SETTINGS has odd number of judges', () => {
    assert(DEFAULT_SETTINGS.blindTest.numJudges % 2 === 1, 'numJudges should be odd');
  })) passed++; else failed++;

  if (test('mergeSettings returns defaults when no overrides', () => {
    const merged = mergeSettings({});
    assert.strictEqual(merged.generation.numGenerators, DEFAULT_SETTINGS.generation.numGenerators);
    assert.strictEqual(merged.voting.numVoters, DEFAULT_SETTINGS.voting.numVoters);
  })) passed++; else failed++;

  if (test('mergeSettings overrides nested values', () => {
    const merged = mergeSettings({ voting: { numVoters: 5 } });
    assert.strictEqual(merged.voting.numVoters, 5, 'Should override numVoters');
    assert.strictEqual(merged.voting.voterModel, DEFAULT_SETTINGS.voting.voterModel, 'Should keep other voting settings');
  })) passed++; else failed++;

  if (test('validateSettings detects even voters', () => {
    const settings = mergeSettings({ voting: { numVoters: 4 } });
    const result = validateSettings(settings);
    assert(!result.valid, 'Should be invalid');
    assert(result.errors.includes('Number of voters must be odd'));
  })) passed++; else failed++;

  if (test('validateSettings detects even judges', () => {
    const settings = mergeSettings({ blindTest: { numJudges: 2 } });
    const result = validateSettings(settings);
    assert(!result.valid, 'Should be invalid');
    assert(result.errors.includes('Number of blind test judges must be odd'));
  })) passed++; else failed++;

  if (test('validateSettings passes valid settings', () => {
    const result = validateSettings(DEFAULT_SETTINGS);
    assert(result.valid, 'Default settings should be valid');
    assert.strictEqual(result.errors.length, 0, 'Should have no errors');
  })) passed++; else failed++;

  // ========== PROMPT TEMPLATE TESTS ==========
  console.log('\n--- Prompt Template Tests ---\n');

  if (test('buildPromptFromTemplate with basic action', () => {
    const styleDNA = {
      styleTemplate: 'Professional photo of {SUBJECT}',
      lighting: { quality: 'soft', type: 'natural', direction: 'side' },
      color: { palette: 'warm', saturation: 'medium' }
    };
    const prompt = buildPromptFromTemplate(styleDNA, 'a plumber fixing a sink');
    assert(prompt.includes('Professional photo of a plumber fixing a sink'), 'Should include action in template');
    assert(prompt.includes('soft natural lighting from side'), 'Should include lighting');
    assert(prompt.includes('warm color palette'), 'Should include color');
  })) passed++; else failed++;

  if (test('buildPromptFromTemplate with uniform config', () => {
    const styleDNA = {
      styleTemplate: 'Photo of {SUBJECT}'
    };
    const options = {
      uniformConfig: {
        enabled: true,
        description: 'blue company polo with ABC Plumbing logo'
      }
    };
    const prompt = buildPromptFromTemplate(styleDNA, 'worker repairing HVAC', options);
    assert(prompt.includes('worker wearing blue company polo with ABC Plumbing logo'), 'Should include uniform');
  })) passed++; else failed++;

  if (test('buildPromptFromTemplate without styleTemplate', () => {
    const styleDNA = {
      lighting: { quality: 'bright', type: 'studio', direction: 'front' }
    };
    const prompt = buildPromptFromTemplate(styleDNA, 'electrician at panel');
    assert(prompt.startsWith('electrician at panel'), 'Should use action as base when no template');
  })) passed++; else failed++;

  if (test('buildPromptFromTemplate adds hero image modifiers', () => {
    const styleDNA = { styleTemplate: '{SUBJECT}' };
    const prompt = buildPromptFromTemplate(styleDNA, 'team photo', { imageType: 'hero' });
    assert(prompt.includes('hero image'), 'Should include hero image modifier');
    assert(prompt.includes('atmospheric'), 'Should include atmospheric');
    assert(prompt.includes('establishing shot'), 'Should include establishing shot');
  })) passed++; else failed++;

  if (test('buildPromptFromTemplate adds quality markers', () => {
    const styleDNA = { styleTemplate: '{SUBJECT}' };
    const prompt = buildPromptFromTemplate(styleDNA, 'test');
    assert(prompt.includes('professional photography'), 'Should include professional photography');
    assert(prompt.includes('sharp focus'), 'Should include sharp focus');
  })) passed++; else failed++;

  // ========== FEEDBACK AGGREGATION TESTS ==========
  console.log('\n--- Feedback Aggregation Tests ---\n');

  if (test('aggregateFeedback extracts top feedback', () => {
    const rounds = [
      { feedback: 'too dark; wrong color; blurry' },
      { feedback: 'too dark; composition off' },
      { feedback: 'too dark; wrong color' }
    ];
    const result = aggregateFeedback(rounds);
    assert(result.includes('too dark'), 'Should include most common feedback (too dark)');
    assert(result.includes('wrong color'), 'Should include second most common');
  })) passed++; else failed++;

  if (test('aggregateFeedback handles empty rounds', () => {
    const result = aggregateFeedback([]);
    assert.strictEqual(result, '', 'Should return empty string for empty rounds');
  })) passed++; else failed++;

  if (test('aggregateFeedback handles missing feedback', () => {
    const rounds = [
      { feedback: null },
      { feedback: 'issue one' },
      { }
    ];
    const result = aggregateFeedback(rounds);
    assert(typeof result === 'string', 'Should return a string');
  })) passed++; else failed++;

  // ========== ENGINE TESTS ==========
  console.log('\n--- Engine Tests ---\n');

  if (test('StyleLockEngine constructor sets defaults', () => {
    const engine = new StyleLockEngine({ openai: 'test-key', replicate: 'test-key' });
    assert.strictEqual(engine.settings.generation.numGenerators, DEFAULT_SETTINGS.generation.numGenerators);
    assert.strictEqual(engine.settings.voting.numVoters, DEFAULT_SETTINGS.voting.numVoters);
  })) passed++; else failed++;

  if (test('StyleLockEngine constructor accepts custom settings', () => {
    const engine = new StyleLockEngine(
      { openai: 'test-key', replicate: 'test-key' },
      { voting: { numVoters: 5 } }
    );
    assert.strictEqual(engine.settings.voting.numVoters, 5, 'Should use custom numVoters');
    assert.strictEqual(engine.settings.generation.numGenerators, DEFAULT_SETTINGS.generation.numGenerators, 'Should keep other defaults');
  })) passed++; else failed++;

  if (test('StyleLockEngine determineTier returns correct tiers', () => {
    const engine = new StyleLockEngine({ openai: 'test', replicate: 'test' });
    assert.strictEqual(engine.determineTier(95), 'PERFECT', '95 should be PERFECT');
    assert.strictEqual(engine.determineTier(90), 'PERFECT', '90 should be PERFECT');
    assert.strictEqual(engine.determineTier(85), 'GOOD_ENOUGH', '85 should be GOOD_ENOUGH');
    assert.strictEqual(engine.determineTier(80), 'GOOD_ENOUGH', '80 should be GOOD_ENOUGH');
    assert.strictEqual(engine.determineTier(75), 'PARTIAL', '75 should be PARTIAL');
    assert.strictEqual(engine.determineTier(70), 'PARTIAL', '70 should be PARTIAL');
    assert.strictEqual(engine.determineTier(65), 'FAILED', '65 should be FAILED');
    assert.strictEqual(engine.determineTier(0), 'FAILED', '0 should be FAILED');
  })) passed++; else failed++;

  if (test('StyleLockEngine formatJobResult includes all fields', () => {
    const engine = new StyleLockEngine({ openai: 'test', replicate: 'test' });
    const job = {
      id: 'test-123',
      status: 'complete',
      tier: 'GOOD_ENOUGH',
      winningPrompt: 'test prompt',
      winningImageUrl: 'http://example.com/img.jpg',
      finalScore: 85,
      blindTestPassed: true,
      currentRound: 3,
      totalCost: 1.50,
      costBreakdown: { styleDNA: 0.05, prompts: 0.02, images: 0.12, voting: 0.09, blindTest: 0.06 },
      styleDNA: { styleTemplate: 'test' },
      createdAt: new Date('2024-01-01'),
      completedAt: new Date('2024-01-01')
    };

    const result = engine.formatJobResult(job, true);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.jobId, 'test-123');
    assert.strictEqual(result.tier, 'GOOD_ENOUGH');
    assert.strictEqual(result.score, 85);
    assert.strictEqual(result.prompt, 'test prompt');
    assert.strictEqual(result.totalCost, 1.50);
    assert(result.costBreakdown, 'Should include costBreakdown');
    assert(result.styleDNA, 'Should include styleDNA');
  })) passed++; else failed++;

  // ========== COST TRACKING TESTS ==========
  console.log('\n--- Cost Configuration Tests ---\n');

  if (test('Cost estimates are reasonable', () => {
    assert(DEFAULT_SETTINGS.costs['flux-1.1-pro'] > 0, 'FLUX cost should be positive');
    assert(DEFAULT_SETTINGS.costs['flux-1.1-pro'] < 0.10, 'FLUX cost should be reasonable');
    assert(DEFAULT_SETTINGS.costs['gpt-4o-vision'] > 0, 'GPT-4o vision cost should be positive');
  })) passed++; else failed++;

  if (test('Max cost limit is set', () => {
    assert(DEFAULT_SETTINGS.limits.maxCost > 0, 'Max cost should be positive');
    assert(DEFAULT_SETTINGS.limits.maxCost <= 10, 'Max cost should be capped');
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
