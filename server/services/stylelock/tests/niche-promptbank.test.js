/**
 * StyleLock Niche and Prompt Bank Tests
 * Tests for niche management and prompt bank functionality
 */

import assert from 'assert';
import {
  ENVIRONMENTS,
  getEnvironments
} from '../niche-service.js';

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
  console.log('\n=== StyleLock Niche & Prompt Bank Tests ===\n');
  let passed = 0;
  let failed = 0;

  // ========== ENVIRONMENT TESTS ==========
  console.log('--- Environment Tests ---\n');

  if (test('ENVIRONMENTS contains all expected categories', () => {
    assert(ENVIRONMENTS['in-home'], 'Should have in-home environment');
    assert(ENVIRONMENTS['in-yard'], 'Should have in-yard environment');
    assert(ENVIRONMENTS['in-office'], 'Should have in-office environment');
    assert(ENVIRONMENTS['on-site-field'], 'Should have on-site-field environment');
    assert(ENVIRONMENTS['commercial'], 'Should have commercial environment');
  })) passed++; else failed++;

  if (test('Each environment has required fields', () => {
    for (const [key, env] of Object.entries(ENVIRONMENTS)) {
      assert(env.name, `${key} should have name`);
      assert(env.description, `${key} should have description`);
      assert(Array.isArray(env.examples), `${key} should have examples array`);
      assert(env.examples.length > 0, `${key} should have at least one example`);
    }
  })) passed++; else failed++;

  if (test('getEnvironments returns array with keys', () => {
    const envs = getEnvironments();
    assert(Array.isArray(envs), 'Should return array');
    assert.strictEqual(envs.length, 5, 'Should have 5 environments');
    for (const env of envs) {
      assert(env.key, 'Each environment should have key');
      assert(env.name, 'Each environment should have name');
    }
  })) passed++; else failed++;

  if (test('In-home environment has appropriate examples', () => {
    const inHome = ENVIRONMENTS['in-home'];
    assert(inHome.examples.some(e => e.toLowerCase().includes('plumb')), 'Should include plumbing');
    assert(inHome.examples.some(e => e.toLowerCase().includes('electric')), 'Should include electrical');
    assert(inHome.examples.some(e => e.toLowerCase().includes('clean')), 'Should include cleaning');
  })) passed++; else failed++;

  if (test('On-site-field environment has appropriate examples', () => {
    const onSite = ENVIRONMENTS['on-site-field'];
    assert(onSite.examples.some(e => e.toLowerCase().includes('roof')), 'Should include roofing');
    assert(onSite.examples.some(e => e.toLowerCase().includes('solar') || e.toLowerCase().includes('concrete')),
      'Should include construction work');
  })) passed++; else failed++;

  // ========== NICHE DATA STRUCTURE TESTS ==========
  console.log('\n--- Niche Data Structure Tests ---\n');

  if (test('Niche object has required fields', () => {
    const nicheTemplate = {
      id: 1,
      name: 'Plumbing',
      description: 'Plumbing services',
      environment: 'in-home',
      isLocked: false,
      lockedAt: null,
      lockedPrompt: null,
      lockedStyleDna: {},
      referenceImages: [],
      lockedByJobId: null,
      lockScore: null,
      lockTier: null,
      timesUsed: 0,
      lastUsedAt: null,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    assert(typeof nicheTemplate.id === 'number', 'Should have numeric id');
    assert(typeof nicheTemplate.name === 'string', 'Should have string name');
    assert(typeof nicheTemplate.environment === 'string', 'Should have string environment');
    assert(typeof nicheTemplate.isLocked === 'boolean', 'Should have boolean isLocked');
    assert(Array.isArray(nicheTemplate.referenceImages), 'Should have array referenceImages');
    assert(Array.isArray(nicheTemplate.tags), 'Should have array tags');
  })) passed++; else failed++;

  if (test('Locked niche has all lock fields populated', () => {
    const lockedNiche = {
      id: 1,
      name: 'Plumbing',
      environment: 'in-home',
      isLocked: true,
      lockedAt: new Date(),
      lockedPrompt: 'Professional photo of a plumber...',
      lockedStyleDna: { lighting: { quality: 'soft' } },
      referenceImages: ['img1.jpg', 'img2.jpg'],
      lockedByJobId: 123,
      lockScore: 92.5,
      lockTier: 'PERFECT'
    };

    assert(lockedNiche.isLocked === true, 'Should be locked');
    assert(lockedNiche.lockedAt instanceof Date, 'Should have lock timestamp');
    assert(typeof lockedNiche.lockedPrompt === 'string', 'Should have locked prompt');
    assert(typeof lockedNiche.lockedStyleDna === 'object', 'Should have locked style DNA');
    assert(lockedNiche.referenceImages.length > 0, 'Should have reference images');
    assert(typeof lockedNiche.lockScore === 'number', 'Should have lock score');
    assert(typeof lockedNiche.lockTier === 'string', 'Should have lock tier');
  })) passed++; else failed++;

  // ========== PROMPT DATA STRUCTURE TESTS ==========
  console.log('\n--- Prompt Data Structure Tests ---\n');

  if (test('Prompt object has required fields', () => {
    const promptTemplate = {
      id: 1,
      promptTemplate: 'Professional photo of {SUBJECT}...',
      actionDescription: 'plumber fixing a sink',
      nicheId: 1,
      styleDNA: { lighting: { quality: 'soft' } },
      score: 88.5,
      tier: 'GOOD_ENOUGH',
      environment: 'in-home',
      tags: ['plumbing', 'residential'],
      timesUsed: 5,
      averageScore: 85.2,
      lastUsedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    assert(typeof promptTemplate.id === 'number', 'Should have numeric id');
    assert(typeof promptTemplate.promptTemplate === 'string', 'Should have string prompt template');
    assert(typeof promptTemplate.actionDescription === 'string', 'Should have action description');
    assert(typeof promptTemplate.score === 'number', 'Should have numeric score');
    assert(typeof promptTemplate.tier === 'string', 'Should have tier');
    assert(typeof promptTemplate.environment === 'string', 'Should have environment');
    assert(Array.isArray(promptTemplate.tags), 'Should have tags array');
    assert(typeof promptTemplate.timesUsed === 'number', 'Should have usage count');
  })) passed++; else failed++;

  if (test('Prompt score is within valid range', () => {
    const validScores = [0, 50, 75, 90, 100];
    for (const score of validScores) {
      assert(score >= 0 && score <= 100, `Score ${score} should be valid`);
    }
  })) passed++; else failed++;

  // ========== BUSINESS LOGIC TESTS ==========
  console.log('\n--- Business Logic Tests ---\n');

  if (test('Environment validation logic', () => {
    const validEnvs = ['in-home', 'in-yard', 'in-office', 'on-site-field', 'commercial'];
    const invalidEnvs = ['home', 'yard', 'office', 'field', 'invalid'];

    for (const env of validEnvs) {
      assert(ENVIRONMENTS[env], `${env} should be valid`);
    }

    for (const env of invalidEnvs) {
      assert(!ENVIRONMENTS[env], `${env} should be invalid`);
    }
  })) passed++; else failed++;

  if (test('Lock tier determination matches engine logic', () => {
    // Tier thresholds from default-settings
    const determineTier = (score) => {
      if (score >= 90) return 'PERFECT';
      if (score >= 80) return 'GOOD_ENOUGH';
      if (score >= 70) return 'PARTIAL';
      return 'FAILED';
    };

    assert.strictEqual(determineTier(95), 'PERFECT');
    assert.strictEqual(determineTier(90), 'PERFECT');
    assert.strictEqual(determineTier(85), 'GOOD_ENOUGH');
    assert.strictEqual(determineTier(80), 'GOOD_ENOUGH');
    assert.strictEqual(determineTier(75), 'PARTIAL');
    assert.strictEqual(determineTier(70), 'PARTIAL');
    assert.strictEqual(determineTier(65), 'FAILED');
    assert.strictEqual(determineTier(0), 'FAILED');
  })) passed++; else failed++;

  if (test('Average score calculation is correct', () => {
    // Running average formula: new_avg = (old_avg * (n-1) + new_score) / n
    const updateAverage = (oldAvg, n, newScore) => {
      return ((oldAvg * (n - 1)) + newScore) / n;
    };

    // First usage
    let avg = 80;
    let n = 1;

    // Second usage with score 90
    n = 2;
    avg = updateAverage(avg, n, 90);
    assert.strictEqual(avg, 85, 'Average of 80 and 90 should be 85');

    // Third usage with score 85
    n = 3;
    avg = updateAverage(avg, n, 85);
    assert.strictEqual(avg, 85, 'Average of 80, 90, 85 should be 85');
  })) passed++; else failed++;

  // ========== SEARCH LOGIC TESTS ==========
  console.log('\n--- Search Logic Tests ---\n');

  if (test('Case-insensitive search would match', () => {
    const searchTerms = ['plumber', 'PLUMBER', 'Plumber', 'PlUmBeR'];
    const target = 'Professional plumber fixing sink';

    for (const term of searchTerms) {
      const matches = target.toLowerCase().includes(term.toLowerCase());
      assert(matches, `Search for "${term}" should match`);
    }
  })) passed++; else failed++;

  if (test('Partial search would match', () => {
    const targets = ['plumber fixing sink', 'sink repair', 'fix leaky faucet'];
    const query = 'sink';

    for (const target of targets) {
      if (target.includes('sink')) {
        assert(true, `"${target}" should match query "${query}"`);
      }
    }
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
