/**
 * Tests for Calibration System — Cal-1 Data Model + Backend Injection Layer
 * Tests the pack compiler, entry validation, and injection logic.
 */

import { compileCalibrationPack } from '../server/routes/calibration.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

// ========================================
// Test Data
// ========================================

const ENTRIES = [
  {
    id: 'CAL-001',
    title: 'Avoid model glam',
    tags: ['H', 'J'],
    priority: 'hard',
    human_note: 'Models should look like real workers',
    model_instruction: '[CAL:Everyday employee look | Hard] Depict a realistic worker with natural skin texture and minimal makeup; avoid glam/influencer styling; prefer practical hair and functional posture.',
    trigger: 'any portrait with visible chest area',
    do_preferred: 'natural skin, minimal makeup',
    avoid_antipattern: 'glam/influencer styling',
    enforcement_tactics: ['use natural lighting', 'avoid studio setups'],
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z'
  },
  {
    id: 'CAL-002',
    title: 'Realistic tools',
    tags: ['All'],
    priority: 'medium',
    human_note: 'Tools should look used, not brand-new',
    model_instruction: '[CAL:Worn tools | Medium] Show tools with slight wear marks and patina; avoid pristine showroom tools; prefer tools that look actively used.',
    trigger: 'any image with tools or equipment',
    do_preferred: 'slight wear marks',
    avoid_antipattern: 'brand-new showroom tools',
    enforcement_tactics: ['add patina', 'show slight scuffs'],
    createdAt: '2026-01-11T00:00:00Z',
    updatedAt: '2026-01-11T00:00:00Z'
  },
  {
    id: 'CAL-003',
    title: 'Safety gear visible',
    tags: ['H'],
    priority: 'hard',
    human_note: 'Workers must show safety equipment',
    model_instruction: '[CAL:Safety gear | Hard] Include visible safety equipment (hard hat, gloves, goggles); avoid workers without PPE; prefer safety-first compositions.',
    trigger: 'any worker in industrial setting',
    do_preferred: 'visible hard hat, gloves, goggles',
    avoid_antipattern: 'workers without PPE',
    enforcement_tactics: ['make PPE prominent in frame'],
    createdAt: '2026-01-12T00:00:00Z',
    updatedAt: '2026-01-12T00:00:00Z'
  },
  {
    id: 'CAL-004',
    title: 'Natural backgrounds',
    tags: ['J'],
    priority: 'soft',
    human_note: 'Use real job site backgrounds',
    model_instruction: '[CAL:Job site bg | Soft] Use realistic job site backgrounds; avoid pure white or studio backdrops; prefer contextual environments.',
    trigger: 'any scene composition',
    do_preferred: 'real job site background',
    avoid_antipattern: 'studio backdrops',
    enforcement_tactics: ['show environmental context'],
    createdAt: '2026-01-13T00:00:00Z',
    updatedAt: '2026-01-13T00:00:00Z'
  },
  {
    id: 'CAL-005',
    title: 'No stock photo feel',
    tags: ['C'],
    priority: 'medium',
    human_note: 'Avoid the classic stock photo vibe',
    model_instruction: '[CAL:Anti-stock | Medium] Avoid corporate stock photo aesthetics; prefer candid documentary-style framing.',
    trigger: 'all images',
    do_preferred: 'candid documentary style',
    avoid_antipattern: 'corporate stock photo look',
    enforcement_tactics: ['off-center framing', 'natural expressions'],
    createdAt: '2026-01-14T00:00:00Z',
    updatedAt: '2026-01-14T00:00:00Z'
  }
];

// ========================================
// Pack Compiler Tests
// ========================================

console.log('\n=== Calibration Pack Compiler Tests ===\n');

// Test 1: Filter by specific tag
console.log('--- Tag Filtering ---');
{
  const result = compileCalibrationPack(ENTRIES, 'H');
  // Should include: CAL-001 (tag H), CAL-002 (All), CAL-003 (tag H)
  // Should exclude: CAL-004 (tag J only), CAL-005 (tag C only)
  assert(result.entries.length === 3, `Tag H: got ${result.entries.length} entries (expected 3)`);
  const ids = result.entries.map(e => e.id);
  assert(ids.includes('CAL-001'), 'Tag H includes CAL-001 (explicit H tag)');
  assert(ids.includes('CAL-002'), 'Tag H includes CAL-002 (All/global)');
  assert(ids.includes('CAL-003'), 'Tag H includes CAL-003 (explicit H tag)');
  assert(!ids.includes('CAL-004'), 'Tag H excludes CAL-004 (J only)');
  assert(!ids.includes('CAL-005'), 'Tag H excludes CAL-005 (C only)');
}

// Test 2: Filter by different tag
{
  const result = compileCalibrationPack(ENTRIES, 'J');
  // Should include: CAL-001 (tag J), CAL-002 (All), CAL-004 (tag J)
  assert(result.entries.length === 3, `Tag J: got ${result.entries.length} entries (expected 3)`);
  const ids = result.entries.map(e => e.id);
  assert(ids.includes('CAL-001'), 'Tag J includes CAL-001 (explicit J tag)');
  assert(ids.includes('CAL-002'), 'Tag J includes CAL-002 (All/global)');
  assert(ids.includes('CAL-004'), 'Tag J includes CAL-004 (explicit J tag)');
}

// Test 3: Tag with only global entries
{
  const result = compileCalibrationPack(ENTRIES, 'Z');
  // Should include only CAL-002 (All)
  assert(result.entries.length === 1, `Tag Z: got ${result.entries.length} entries (expected 1 — global only)`);
  assert(result.entries[0].id === 'CAL-002', 'Tag Z only gets global entry');
}

// Test 4: Priority sorting
console.log('\n--- Priority Sorting ---');
{
  const result = compileCalibrationPack(ENTRIES, 'H');
  // Hard entries first, then medium, then soft
  assert(result.entries[0].priority === 'hard', `First entry is hard priority (got ${result.entries[0].priority})`);
  assert(result.entries[1].priority === 'hard', `Second entry is hard priority (got ${result.entries[1].priority})`);
  assert(result.entries[2].priority === 'medium', `Third entry is medium priority (got ${result.entries[2].priority})`);
}

// Test 5: Same-priority entries sorted by updatedAt (newest first)
{
  const result = compileCalibrationPack(ENTRIES, 'H');
  // Two hard entries: CAL-001 (Jan 10) and CAL-003 (Jan 12)
  // CAL-003 should come first (newer)
  const hardEntries = result.entries.filter(e => e.priority === 'hard');
  assert(hardEntries[0].id === 'CAL-003', `Newer hard entry first: CAL-003 (got ${hardEntries[0].id})`);
  assert(hardEntries[1].id === 'CAL-001', `Older hard entry second: CAL-001 (got ${hardEntries[1].id})`);
}

// Test 6: Empty entries
console.log('\n--- Edge Cases ---');
{
  const result = compileCalibrationPack([], 'H');
  assert(result.entries.length === 0, 'Empty entries returns empty result');
  assert(result.text === '', 'Empty entries returns empty text');
}

// Test 7: No matching tag
{
  const onlyCEntries = ENTRIES.filter(e => e.tags.includes('C') && !e.tags.includes('All'));
  const result = compileCalibrationPack(onlyCEntries, 'H');
  assert(result.entries.length === 0, 'No matching entries returns empty result');
}

// Test 8: Limit clamping (min 12, max 20)
{
  // Create 25 entries all matching tag H
  const manyEntries = Array.from({ length: 25 }, (_, i) => ({
    id: `CAL-BULK-${i}`,
    title: `Bulk entry ${i}`,
    tags: ['H'],
    priority: 'medium',
    model_instruction: `[CAL:Bulk ${i} | Medium] Test instruction ${i}`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`
  }));

  // Default limit should cap at 16
  const result16 = compileCalibrationPack(manyEntries, 'H');
  assert(result16.entries.length === 16, `Default limit caps at 16 (got ${result16.entries.length})`);

  // Explicit max 20
  const result20 = compileCalibrationPack(manyEntries, 'H', 20);
  assert(result20.entries.length === 20, `Max 20 limit works (got ${result20.entries.length})`);

  // Explicit max 12
  const result12 = compileCalibrationPack(manyEntries, 'H', 12);
  assert(result12.entries.length === 12, `Min 12 limit works (got ${result12.entries.length})`);

  // Below min (should clamp to 12)
  const resultClampLow = compileCalibrationPack(manyEntries, 'H', 5);
  assert(resultClampLow.entries.length === 12, `Below-min clamps to 12 (got ${resultClampLow.entries.length})`);

  // Above max (should clamp to 20)
  const resultClampHigh = compileCalibrationPack(manyEntries, 'H', 50);
  assert(resultClampHigh.entries.length === 20, `Above-max clamps to 20 (got ${resultClampHigh.entries.length})`);
}

// Test 9: Output text format (Template 3)
console.log('\n--- Output Format ---');
{
  const result = compileCalibrationPack(ENTRIES, 'H');
  assert(result.text.startsWith('Calibration Pack — Tag H'), 'Text starts with correct header');
  assert(result.text.includes('1. (Hard)'), 'Text includes numbered hard entry');
  assert(result.text.includes('guardrails win'), 'Text includes conflict resolution meta-instruction');

  // Count numbered lines
  const numberedLines = result.text.split('\n').filter(l => /^\d+\.\s/.test(l));
  assert(numberedLines.length === result.entries.length, `Numbered lines (${numberedLines.length}) match entry count (${result.entries.length})`);
}

// Test 10: Entries with missing fields (robustness)
console.log('\n--- Robustness ---');
{
  const sparseEntries = [
    {
      id: 'CAL-SPARSE',
      title: 'Sparse entry',
      tags: ['H'],
      // no priority field
      model_instruction: '[CAL:Sparse | Medium] Test sparse entry',
      createdAt: '2026-01-01T00:00:00Z'
      // no updatedAt
    }
  ];
  const result = compileCalibrationPack(sparseEntries, 'H');
  assert(result.entries.length === 1, 'Sparse entry is included');
  assert(result.text.includes('(Medium)'), 'Missing priority defaults to medium in display');
}

// Test 11: "All" tag entries mixed with specific
{
  const result = compileCalibrationPack(ENTRIES, 'C');
  // Should include: CAL-002 (All) + CAL-005 (C)
  assert(result.entries.length === 2, `Tag C: got ${result.entries.length} entries (expected 2)`);
}

// Test 12: Entry with multiple tags including target
{
  const multiTagEntry = [{
    id: 'CAL-MULTI',
    title: 'Multi-tag',
    tags: ['A', 'B', 'C'],
    priority: 'hard',
    model_instruction: '[CAL:Multi | Hard] Multi-tag test',
    updatedAt: '2026-01-01T00:00:00Z'
  }];
  const resultA = compileCalibrationPack(multiTagEntry, 'A');
  const resultB = compileCalibrationPack(multiTagEntry, 'B');
  const resultD = compileCalibrationPack(multiTagEntry, 'D');
  assert(resultA.entries.length === 1, 'Multi-tag matches tag A');
  assert(resultB.entries.length === 1, 'Multi-tag matches tag B');
  assert(resultD.entries.length === 0, 'Multi-tag does not match tag D');
}

// ========================================
// Summary
// ========================================

console.log(`\n=== Calibration Test Summary ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All calibration tests passed!');
}
