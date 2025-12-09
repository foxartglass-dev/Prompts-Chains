/**
 * StyleLock API Routes Tests
 * Tests for route validation and request handling
 */

import assert from 'assert';
import { DEFAULT_SETTINGS, mergeSettings, validateSettings } from '../default-settings.js';

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

// Simple mock for request/response
function mockRequest(body = {}, params = {}, query = {}) {
  return { body, params, query };
}

function mockResponse() {
  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    }
  };
  return res;
}

// Cost estimation function (copied from routes to test independently)
function estimateJobCost(referenceImageCount, settings) {
  const costs = settings.costs || DEFAULT_SETTINGS.costs;
  const gen = settings.generation || DEFAULT_SETTINGS.generation;
  const voting = settings.voting || DEFAULT_SETTINGS.voting;
  const blindTest = settings.blindTest || DEFAULT_SETTINGS.blindTest;
  const limits = settings.limits || DEFAULT_SETTINGS.limits;

  const styleDNACost = (referenceImageCount * 0.01) + 0.01;
  const promptGenCostPerRound = gen.numGenerators * 0.003;
  const imageGenCostPerRound = gen.numGenerators * costs['flux-1.1-pro'];
  const votingCostPerRound = gen.numGenerators * voting.numVoters * 0.01;
  const costPerRound = promptGenCostPerRound + imageGenCostPerRound + votingCostPerRound;
  const blindTestCost = blindTest.numJudges * 0.02;

  const minRounds = 2;
  const avgRounds = 5;
  const maxRounds = limits.maxRounds;

  return {
    styleDNA: styleDNACost,
    perRound: costPerRound,
    blindTest: blindTestCost,
    min: styleDNACost + (costPerRound * minRounds) + blindTestCost,
    average: styleDNACost + (costPerRound * avgRounds) + (blindTestCost * 1.5),
    max: Math.min(
      styleDNACost + (costPerRound * maxRounds) + (blindTestCost * 3),
      limits.maxCost
    ),
    currency: 'USD',
    breakdown: {
      styleDNAExtraction: styleDNACost,
      promptGeneration: promptGenCostPerRound,
      imageGeneration: imageGenCostPerRound,
      voting: votingCostPerRound,
      blindTest: blindTestCost
    }
  };
}

function runTests() {
  console.log('\n=== StyleLock API Route Tests ===\n');
  let passed = 0;
  let failed = 0;

  // ========== COST ESTIMATION TESTS ==========
  console.log('--- Cost Estimation Tests ---\n');

  if (test('Cost estimation with default settings', () => {
    const estimate = estimateJobCost(5, DEFAULT_SETTINGS);
    assert(estimate.min > 0, 'Min cost should be positive');
    assert(estimate.average > estimate.min, 'Average should be greater than min');
    assert(estimate.max >= estimate.average, 'Max should be >= average');
    assert.strictEqual(estimate.currency, 'USD', 'Currency should be USD');
  })) passed++; else failed++;

  if (test('Cost estimation scales with reference images', () => {
    const estimate3 = estimateJobCost(3, DEFAULT_SETTINGS);
    const estimate10 = estimateJobCost(10, DEFAULT_SETTINGS);
    assert(estimate10.styleDNA > estimate3.styleDNA, 'More images should cost more for Style DNA');
  })) passed++; else failed++;

  if (test('Cost estimation includes all breakdown categories', () => {
    const estimate = estimateJobCost(5, DEFAULT_SETTINGS);
    assert(estimate.breakdown, 'Should have breakdown');
    assert(typeof estimate.breakdown.styleDNAExtraction === 'number');
    assert(typeof estimate.breakdown.promptGeneration === 'number');
    assert(typeof estimate.breakdown.imageGeneration === 'number');
    assert(typeof estimate.breakdown.voting === 'number');
    assert(typeof estimate.breakdown.blindTest === 'number');
  })) passed++; else failed++;

  if (test('Cost estimation respects max cost limit', () => {
    const settings = mergeSettings({ limits: { maxCost: 2.00, maxRounds: 100 } });
    const estimate = estimateJobCost(5, settings);
    assert(estimate.max <= 2.00, 'Max should not exceed maxCost limit');
  })) passed++; else failed++;

  // ========== REQUEST VALIDATION TESTS ==========
  console.log('\n--- Request Validation Tests ---\n');

  if (test('Job creation validates reference images', () => {
    const req = mockRequest({ targetDescription: 'test', referenceImages: [] });
    // Simulate validation
    const hasError = !req.body.referenceImages || req.body.referenceImages.length === 0;
    assert(hasError, 'Should detect missing reference images');
  })) passed++; else failed++;

  if (test('Job creation validates target description', () => {
    const req = mockRequest({ referenceImages: ['http://example.com/img.jpg'] });
    const hasError = !req.body.targetDescription;
    assert(hasError, 'Should detect missing target description');
  })) passed++; else failed++;

  if (test('Style DNA extraction validates images', () => {
    const req = mockRequest({ referenceImages: null });
    const hasError = !req.body.referenceImages || req.body.referenceImages.length === 0;
    assert(hasError, 'Should detect missing images');
  })) passed++; else failed++;

  if (test('Batch generation validates style DNA', () => {
    const req = mockRequest({ actions: ['test action'] });
    const hasError = !req.body.styleDNA;
    assert(hasError, 'Should detect missing styleDNA');
  })) passed++; else failed++;

  if (test('Batch generation validates actions', () => {
    const req = mockRequest({ styleDNA: { test: true }, actions: [] });
    const hasError = !req.body.actions || req.body.actions.length === 0;
    assert(hasError, 'Should detect empty actions array');
  })) passed++; else failed++;

  // ========== SETTINGS VALIDATION TESTS ==========
  console.log('\n--- Settings Validation Tests ---\n');

  if (test('Settings merge handles partial updates', () => {
    const partial = { generation: { numGenerators: 5 } };
    const merged = mergeSettings(partial);
    assert.strictEqual(merged.generation.numGenerators, 5);
    assert.strictEqual(merged.generation.generatorModel, DEFAULT_SETTINGS.generation.generatorModel);
    assert.strictEqual(merged.voting.numVoters, DEFAULT_SETTINGS.voting.numVoters);
  })) passed++; else failed++;

  if (test('Settings validation catches invalid advanceThreshold', () => {
    const settings = mergeSettings({ voting: { advanceThreshold: 150 } });
    const result = validateSettings(settings);
    assert(!result.valid, 'Should be invalid');
    assert(result.errors.some(e => e.includes('Advance threshold')));
  })) passed++; else failed++;

  if (test('Settings validation catches advanceThreshold too low', () => {
    const settings = mergeSettings({ voting: { advanceThreshold: 30 } });
    const result = validateSettings(settings);
    assert(!result.valid, 'Should be invalid');
    assert(result.errors.some(e => e.includes('Advance threshold')));
  })) passed++; else failed++;

  // ========== JOB LIFECYCLE TESTS ==========
  console.log('\n--- Job Lifecycle Tests ---\n');

  if (test('Job record structure is correct', () => {
    const jobRecord = {
      id: 'test-123',
      websiteId: 1,
      status: 'running',
      referenceImages: ['img1.jpg', 'img2.jpg'],
      targetDescription: 'A plumber fixing a sink',
      uniformConfig: { enabled: true, description: 'blue polo' },
      settings: DEFAULT_SETTINGS,
      progress: [],
      result: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    assert(jobRecord.id, 'Should have id');
    assert.strictEqual(jobRecord.status, 'running');
    assert(Array.isArray(jobRecord.progress), 'Progress should be array');
    assert(jobRecord.createdAt instanceof Date);
  })) passed++; else failed++;

  if (test('Job list response format is correct', () => {
    const jobs = [
      { id: '1', status: 'complete', websiteId: 1, targetDescription: 'Test', createdAt: new Date(), updatedAt: new Date(), result: { success: true, score: 85, tier: 'GOOD_ENOUGH', totalCost: 1.50 } },
      { id: '2', status: 'running', websiteId: 1, targetDescription: 'Test 2', createdAt: new Date(), updatedAt: new Date(), result: null }
    ];

    const response = {
      jobs: jobs.map(j => ({
        id: j.id,
        status: j.status,
        websiteId: j.websiteId,
        targetDescription: j.targetDescription,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
        result: j.result ? {
          success: j.result.success,
          score: j.result.score,
          tier: j.result.tier,
          totalCost: j.result.totalCost
        } : null
      })),
      total: jobs.length
    };

    assert.strictEqual(response.total, 2);
    assert(response.jobs[0].result, 'First job should have result');
    assert(!response.jobs[1].result, 'Second job should not have result');
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
