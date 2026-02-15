/**
 * Tests for Rules Checkbox Grid — Pipeline Integration (PRD Phase 3)
 * Tests getRulesForScope() and buildRulesBlock() functions.
 *
 * These functions are defined inside image-pipeline.js but not exported.
 * We replicate them here for testing since they are pure functions.
 */

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

// Replicate the functions from image-pipeline.js for testing
function getRulesForScope(allRules, tag, segment) {
  if (!allRules || allRules.length === 0 || !segment) return [];

  return allRules.filter(rule => {
    const targets = rule.appliesTo || [];
    if (targets.length === 0) return false;
    return (tag && targets.includes(`${tag}-${segment}`)) || targets.includes(`All-${segment}`);
  }).sort((a, b) => (a.order || 0) - (b.order || 0));
}

function buildRulesBlock(rules) {
  if (!rules || rules.length === 0) return '';
  return rules.map(r => r.text).filter(Boolean).join('\n\n');
}

// ========================================
// Test Data
// ========================================

const RULES = [
  {
    id: 'rule-1',
    tag: 'H',
    title: 'H prompt rule',
    text: 'Always show professional cleaners',
    order: 1,
    appliesTo: ['H-prompt', 'H-guardrails']
  },
  {
    id: 'rule-2',
    tag: 'J',
    title: 'J smart rule',
    text: 'Focus on janitorial equipment',
    order: 2,
    appliesTo: ['J-smart', 'J-smart-rules']
  },
  {
    id: 'rule-3',
    tag: 'Global',
    title: 'All guardrails rule',
    text: 'No cartoon style images',
    order: 0,
    appliesTo: ['All-guardrails']
  },
  {
    id: 'rule-4',
    tag: 'H',
    title: 'H and All prompt',
    text: 'Include branded uniform',
    order: 3,
    appliesTo: ['H-prompt', 'All-categories']
  },
  {
    id: 'rule-5',
    tag: 'C',
    title: 'No scope configured',
    text: 'This rule has no appliesTo',
    order: 4,
    appliesTo: []
  },
  {
    id: 'rule-6',
    tag: 'H',
    title: 'Guided rules for H',
    text: 'Use warm lighting for residential',
    order: 1,
    appliesTo: ['H-guided-rules', 'All-guided-rules']
  }
];

// ========================================
// getRulesForScope Tests
// ========================================

console.log('\n=== getRulesForScope Tests ===\n');

// Test 1: Match tag-specific scope
(() => {
  const result = getRulesForScope(RULES, 'H', 'prompt');
  assert(result.length === 2, 'H-prompt returns 2 rules (rule-1 and rule-4)');
  assert(result[0].id === 'rule-1', 'First rule is rule-1 (order 1)');
  assert(result[1].id === 'rule-4', 'Second rule is rule-4 (order 3)');
})();

// Test 2: Match All-segment
(() => {
  const result = getRulesForScope(RULES, 'J', 'guardrails');
  assert(result.length === 1, 'J-guardrails returns 1 rule (All-guardrails: rule-3)');
  assert(result[0].id === 'rule-3', 'Matched rule is the All-guardrails rule');
})();

// Test 3: Match both tag-specific and All-segment
(() => {
  const result = getRulesForScope(RULES, 'H', 'guardrails');
  assert(result.length === 2, 'H-guardrails returns 2 rules (H-guardrails + All-guardrails)');
  const ids = result.map(r => r.id);
  assert(ids.includes('rule-1'), 'Contains rule-1 (H-guardrails)');
  assert(ids.includes('rule-3'), 'Contains rule-3 (All-guardrails)');
})();

// Test 4: No match
(() => {
  const result = getRulesForScope(RULES, 'C', 'prompt');
  assert(result.length === 0, 'C-prompt returns 0 rules (no C-prompt rules configured)');
})();

// Test 5: All-categories matches for any tag
(() => {
  const resultH = getRulesForScope(RULES, 'H', 'categories');
  assert(resultH.length === 1, 'H-categories returns 1 rule (All-categories from rule-4)');
  const resultJ = getRulesForScope(RULES, 'J', 'categories');
  assert(resultJ.length === 1, 'J-categories returns 1 rule (All-categories from rule-4)');
  const resultC = getRulesForScope(RULES, 'C', 'categories');
  assert(resultC.length === 1, 'C-categories returns 1 rule (All-categories from rule-4)');
})();

// Test 6: Rules without appliesTo are excluded
(() => {
  const result = getRulesForScope(RULES, 'C', 'smart');
  assert(result.length === 0, 'Rule with empty appliesTo is not included');
})();

// Test 7: Empty rules array
(() => {
  const result = getRulesForScope([], 'H', 'prompt');
  assert(result.length === 0, 'Empty rules array returns empty');
})();

// Test 8: Null/undefined inputs
(() => {
  const result1 = getRulesForScope(null, 'H', 'prompt');
  assert(result1.length === 0, 'Null rules returns empty');
  const result2 = getRulesForScope(RULES, null, 'guardrails');
  // Should still match All-guardrails even with null tag
  assert(result2.length === 1, 'Null tag still matches All-guardrails');
  assert(result2[0].id === 'rule-3', 'Matched All-guardrails with null tag');
  const result3 = getRulesForScope(RULES, 'H', '');
  assert(result3.length === 0, 'Empty segment returns empty');
})();

// Test 9: Order is preserved
(() => {
  const result = getRulesForScope(RULES, 'H', 'guided-rules');
  assert(result.length === 1, 'H-guided-rules returns 1 rule');
  // Also test All-guided-rules
  const resultJ = getRulesForScope(RULES, 'J', 'guided-rules');
  assert(resultJ.length === 1, 'J gets All-guided-rules rule');
})();

// Test 10: Smart prompt segments
(() => {
  const result = getRulesForScope(RULES, 'J', 'smart');
  assert(result.length === 1, 'J-smart returns 1 rule');
  assert(result[0].id === 'rule-2', 'Correct smart rule for J');

  const resultRules = getRulesForScope(RULES, 'J', 'smart-rules');
  assert(resultRules.length === 1, 'J-smart-rules returns 1 rule');
  assert(resultRules[0].id === 'rule-2', 'Correct smart-rules rule for J');
})();

// ========================================
// buildRulesBlock Tests
// ========================================

console.log('\n=== buildRulesBlock Tests ===\n');

// Test 11: Basic block building
(() => {
  const rules = [
    { text: 'Rule A text' },
    { text: 'Rule B text' }
  ];
  const block = buildRulesBlock(rules);
  assert(block === 'Rule A text\n\nRule B text', 'Builds block with double newline separator');
})();

// Test 12: Empty rules
(() => {
  assert(buildRulesBlock([]) === '', 'Empty array returns empty string');
  assert(buildRulesBlock(null) === '', 'Null returns empty string');
  assert(buildRulesBlock(undefined) === '', 'Undefined returns empty string');
})();

// Test 13: Rules with empty/null text
(() => {
  const rules = [
    { text: 'Valid rule' },
    { text: '' },
    { text: null },
    { text: 'Another valid rule' }
  ];
  const block = buildRulesBlock(rules);
  assert(block === 'Valid rule\n\nAnother valid rule', 'Skips empty/null text entries');
})();

// Test 14: Single rule
(() => {
  const rules = [{ text: 'Only rule' }];
  const block = buildRulesBlock(rules);
  assert(block === 'Only rule', 'Single rule returns just the text');
})();

// ========================================
// Integration-style Tests
// ========================================

console.log('\n=== Integration Tests ===\n');

// Test 15: Full pipeline scenario - Main Prompt mode for tag H
(() => {
  const promptRules = getRulesForScope(RULES, 'H', 'prompt');
  const promptBlock = buildRulesBlock(promptRules);
  assert(promptBlock.includes('Always show professional cleaners'), 'Prompt block includes H-prompt rule text');
  assert(promptBlock.includes('Include branded uniform'), 'Prompt block includes H-prompt + All-categories rule text');

  const categoryRules = getRulesForScope(RULES, 'H', 'categories');
  const categoryBlock = buildRulesBlock(categoryRules);
  assert(categoryBlock.includes('Include branded uniform'), 'Category block includes All-categories rule');
})();

// Test 16: Full pipeline scenario - Guided GPT mode for tag H
(() => {
  const guardrailRules = getRulesForScope(RULES, 'H', 'guardrails');
  const guardrailBlock = buildRulesBlock(guardrailRules);
  assert(guardrailBlock.includes('Always show professional cleaners'), 'Guardrail block includes H-guardrails rule');
  assert(guardrailBlock.includes('No cartoon style'), 'Guardrail block includes All-guardrails rule');

  const guidedRules = getRulesForScope(RULES, 'H', 'guided-rules');
  const guidedBlock = buildRulesBlock(guidedRules);
  assert(guidedBlock.includes('Use warm lighting'), 'Guided-rules block includes H-guided-rules rule');
})();

// Test 17: Full pipeline scenario - Smart Prompt mode for tag J
(() => {
  const smartRules = getRulesForScope(RULES, 'J', 'smart');
  const smartBlock = buildRulesBlock(smartRules);
  assert(smartBlock.includes('Focus on janitorial equipment'), 'Smart block includes J-smart rule');

  const smartRulesScoped = getRulesForScope(RULES, 'J', 'smart-rules');
  const smartRulesBlock = buildRulesBlock(smartRulesScoped);
  assert(smartRulesBlock.includes('Focus on janitorial equipment'), 'Smart-rules block includes J-smart-rules rule');
})();

// Test 18: Tag with no tag-specific rules still gets All-* rules
(() => {
  // Tag X has no tag-specific rules, but All-guardrails and All-categories still match
  const guardrailResult = getRulesForScope(RULES, 'X', 'guardrails');
  assert(guardrailResult.length === 1, 'Unknown tag X still gets All-guardrails rule');
  assert(guardrailResult[0].id === 'rule-3', 'It is the All-guardrails rule');

  const categoriesResult = getRulesForScope(RULES, 'X', 'categories');
  assert(categoriesResult.length === 1, 'Unknown tag X still gets All-categories rule');

  // But tag-specific segments return empty
  const promptResult = getRulesForScope(RULES, 'X', 'prompt');
  assert(promptResult.length === 0, 'Unknown tag X has no prompt rules (no All-prompt configured)');

  const smartResult = getRulesForScope(RULES, 'X', 'smart');
  assert(smartResult.length === 0, 'Unknown tag X has no smart rules (no All-smart configured)');
})();

// ========================================
// Summary
// ========================================

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
console.log(`${'='.repeat(40)}\n`);

if (failed > 0) {
  process.exit(1);
}
