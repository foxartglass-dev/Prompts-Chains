/**
 * StyleLock Utility Functions Tests
 * Tests for reference validation, difficulty estimation, uniforms, and plateau detection
 */

import assert from 'assert';
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

async function runTests() {
  console.log('\n=== StyleLock Utility Tests ===\n');
  let passed = 0;
  let failed = 0;

  // ========== REFERENCE VALIDATION TESTS ==========
  console.log('--- Reference Validation Tests ---\n');

  if (await asyncTest('validateReferenceImages returns invalid for empty array', async () => {
    const result = await validateReferenceImages([], 'test-key');
    assert(!result.valid, 'Should be invalid');
    assert(result.issues.length > 0, 'Should have issues');
  })) passed++; else failed++;

  if (await asyncTest('validateReferenceImages returns invalid for null', async () => {
    const result = await validateReferenceImages(null, 'test-key');
    assert(!result.valid, 'Should be invalid');
  })) passed++; else failed++;

  if (await asyncTest('validateReferenceImages warns for few images', async () => {
    const result = await validateReferenceImages(['img1.jpg', 'img2.jpg'], 'test-key');
    assert(result.valid, 'Should still be valid');
    assert(result.score < 80, 'Score should be lower');
    assert(result.recommendations.length > 0, 'Should have recommendations');
  })) passed++; else failed++;

  if (await asyncTest('validateReferenceImages handles good input', async () => {
    const images = ['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg', 'img5.jpg'];
    const result = await validateReferenceImages(images, 'test-key');
    assert(result.valid, 'Should be valid');
    assert(result.score >= 70, 'Score should be reasonable');
    assert.strictEqual(result.imageCount, 5, 'Should have correct count');
  })) passed++; else failed++;

  if (await asyncTest('validateReferenceImages warns for too many images', async () => {
    const images = Array(15).fill(null).map((_, i) => `img${i}.jpg`);
    const result = await validateReferenceImages(images, 'test-key');
    assert(result.valid, 'Should still be valid');
    assert(result.issues.some(i => i.includes('Many')), 'Should warn about many images');
  })) passed++; else failed++;

  // ========== DIFFICULTY ESTIMATION TESTS ==========
  console.log('\n--- Difficulty Estimation Tests ---\n');

  if (test('DIFFICULTY_FACTORS has expected values', () => {
    assert(DIFFICULTY_FACTORS.commonSubject < 0, 'Common subjects should be easier');
    assert(DIFFICULTY_FACTORS.rareSubject > 0, 'Rare subjects should be harder');
    assert(DIFFICULTY_FACTORS.naturalLighting < 0, 'Natural lighting should be easier');
    assert(DIFFICULTY_FACTORS.complexLighting > 0, 'Complex lighting should be harder');
    assert(DIFFICULTY_FACTORS.artisticStyle > 0, 'Artistic style should be harder');
  })) passed++; else failed++;

  if (test('estimateDifficulty returns score in valid range', () => {
    const styleDNA = { lighting: { type: 'natural', quality: 'soft' } };
    const result = estimateDifficulty(styleDNA, 'A professional plumber');
    assert(result.score >= 0 && result.score <= 100, 'Score should be 0-100');
    assert(result.level, 'Should have level');
    assert(Array.isArray(result.factors), 'Should have factors array');
  })) passed++; else failed++;

  if (test('estimateDifficulty handles null inputs', () => {
    const result = estimateDifficulty(null, null);
    assert(result.score >= 0 && result.score <= 100, 'Should still return valid score');
    assert(result.level, 'Should have level');
  })) passed++; else failed++;

  if (test('estimateDifficulty rates common subjects easier', () => {
    const result = estimateDifficulty({}, 'A person working in an office');
    assert(result.factors.some(f => f.factor === 'Common subject'), 'Should identify common subject');
  })) passed++; else failed++;

  if (test('estimateDifficulty identifies natural lighting as easier', () => {
    const styleDNA = { lighting: { type: 'natural', quality: 'soft' } };
    const result = estimateDifficulty(styleDNA, 'Test');
    assert(result.factors.some(f => f.factor === 'Natural lighting'), 'Should identify natural lighting');
    assert(result.factors.find(f => f.factor === 'Natural lighting').adjustment < 0, 'Should be negative adjustment');
  })) passed++; else failed++;

  if (test('estimateDifficulty provides recommendations', () => {
    const result = estimateDifficulty({}, 'Complex artistic unique scene');
    assert(result.recommendations.length > 0, 'Should have recommendations');
  })) passed++; else failed++;

  // ========== UNIFORM TESTS ==========
  console.log('\n--- Uniform Configuration Tests ---\n');

  if (test('UNIFORM_TYPES has expected types', () => {
    assert(UNIFORM_TYPES.polo, 'Should have polo');
    assert(UNIFORM_TYPES.button_up, 'Should have button_up');
    assert(UNIFORM_TYPES.t_shirt, 'Should have t_shirt');
    assert(UNIFORM_TYPES.coveralls, 'Should have coveralls');
    assert(UNIFORM_TYPES.vest, 'Should have vest');
  })) passed++; else failed++;

  if (test('Each uniform type has required fields', () => {
    for (const [key, type] of Object.entries(UNIFORM_TYPES)) {
      assert(type.name, `${key} should have name`);
      assert(type.description, `${key} should have description`);
      assert(Array.isArray(type.goodFor), `${key} should have goodFor array`);
    }
  })) passed++; else failed++;

  if (test('buildUniformConfig returns disabled when not enabled', () => {
    const config = buildUniformConfig({ enabled: false });
    assert.strictEqual(config.enabled, false, 'Should be disabled');
    assert(!config.description, 'Should not have description');
  })) passed++; else failed++;

  if (test('buildUniformConfig builds description correctly', () => {
    const config = buildUniformConfig({
      enabled: true,
      type: 'polo',
      color: 'blue',
      companyName: 'ABC Plumbing',
      logo: 'chest'
    });
    assert(config.enabled, 'Should be enabled');
    assert(config.description.includes('blue polo'), 'Should include color and type');
    assert(config.description.includes('ABC Plumbing'), 'Should include company');
    assert(config.description.includes('logo'), 'Should mention logo');
  })) passed++; else failed++;

  if (test('suggestUniform returns appropriate type for plumber', () => {
    const result = suggestUniform('Plumbing', 'in-home');
    assert.strictEqual(result.type, 'polo', 'Should suggest polo for plumber');
    assert(result.confidence >= 0.8, 'Should have high confidence');
  })) passed++; else failed++;

  if (test('suggestUniform returns appropriate type for roofer', () => {
    const result = suggestUniform('Roofing contractor', 'on-site-field');
    assert.strictEqual(result.type, 'vest', 'Should suggest vest for roofer');
  })) passed++; else failed++;

  if (test('suggestUniform returns appropriate type for real estate', () => {
    const result = suggestUniform('Real Estate Agent', 'in-office');
    assert.strictEqual(result.type, 'button_up', 'Should suggest button_up for real estate');
  })) passed++; else failed++;

  if (test('suggestUniform has default fallback', () => {
    const result = suggestUniform('Unknown Niche', 'unknown');
    assert(result.type, 'Should return a type');
    assert(result.confidence > 0, 'Should have some confidence');
  })) passed++; else failed++;

  // ========== PLATEAU DETECTION TESTS ==========
  console.log('\n--- Plateau Detection Tests ---\n');

  if (test('detectPlateau returns not enough rounds for small array', () => {
    const rounds = [{ bestScore: 50 }, { bestScore: 55 }];
    const result = detectPlateau(rounds);
    assert(!result.isPlateau, 'Should not detect plateau');
    assert(result.reason.includes('Not enough'), 'Should mention not enough rounds');
  })) passed++; else failed++;

  if (test('detectPlateau detects plateau when no improvement', () => {
    const rounds = [
      { bestScore: 70, feedback: 'lighting off' },
      { bestScore: 71, feedback: 'lighting off' },
      { bestScore: 70, feedback: 'lighting off' },
      { bestScore: 71, feedback: 'lighting still off' }
    ];
    const result = detectPlateau(rounds);
    assert(result.isPlateau, 'Should detect plateau');
    assert.strictEqual(result.trend, 'stable', 'Should be stable trend');
    assert(result.topIssues.length > 0, 'Should have top issues');
  })) passed++; else failed++;

  if (test('detectPlateau does not detect plateau when improving', () => {
    const rounds = [
      { bestScore: 50 },
      { bestScore: 55 },
      { bestScore: 62 },
      { bestScore: 70 }
    ];
    const result = detectPlateau(rounds);
    assert(!result.isPlateau, 'Should not detect plateau');
    assert.strictEqual(result.trend, 'improving', 'Should be improving');
  })) passed++; else failed++;

  if (test('detectPlateau provides recommendations when plateau detected', () => {
    const rounds = [
      { bestScore: 75 },
      { bestScore: 75 },
      { bestScore: 76 },
      { bestScore: 75 }
    ];
    const result = detectPlateau(rounds);
    if (result.isPlateau) {
      assert(result.recommendations.length > 0, 'Should have recommendations');
    }
  })) passed++; else failed++;

  if (test('suggestRecoveryStrategies returns strategies for plateau', () => {
    const plateauAnalysis = {
      isPlateau: true,
      topIssues: [{ issue: 'lighting wrong', frequency: 3 }]
    };
    const strategies = suggestRecoveryStrategies(plateauAnalysis);
    assert(strategies.length > 0, 'Should have strategies');
    assert(strategies[0].name, 'Strategy should have name');
    assert(strategies[0].action, 'Strategy should have action');
  })) passed++; else failed++;

  if (test('suggestRecoveryStrategies returns empty for no plateau', () => {
    const analysis = { isPlateau: false };
    const strategies = suggestRecoveryStrategies(analysis);
    assert.strictEqual(strategies.length, 0, 'Should have no strategies');
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
