/**
 * parseCodeBlocks.ts - Shared utility for parsing AI response code blocks
 *
 * Phase 4: Chat Writing to All Fields + Category/Rule Creation
 *
 * Extracts code blocks from AI responses and either auto-applies them
 * or queues them for user confirmation (if the target field is non-empty).
 *
 * New code blocks: newcategory, addoptions, newguidedrule, newlegacyrule, guidedprompt
 * Existing code blocks: mainprompt, instructions, uniform, subject, avoid,
 *   stylepreferences, smartprompt, matchingrule1-4, placementrule,
 *   smartmatchingrule, testprompt
 */

// ========== TYPES ==========

export interface PlaceholderOption {
  number: number;
  text: string;
  primaryKeywords: string[];
  secondaryKeywords: string[];
  useSecondaryKeywords: boolean;
}

export interface PlaceholderCategory {
  id: string;
  name: string;
  placeholder: string;
  options: PlaceholderOption[];
  isRandomized?: boolean;
  enabled?: boolean;
  scope?: 'unique' | 'persistent';
}

export interface TagBasedRule {
  id: string;
  tag: string;
  title: string;
  text: string;
  order: number;
  globalAppliesTo?: string[];
  appliesTo?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PendingConfirmation {
  id: string;
  blockType: string;
  fieldLabel: string;
  currentValue: string;
  newValue: string;
  applyFn: () => void;
  timestamp: string;
}

export interface AppliedBlock {
  blockType: string;
  fieldLabel: string;
  action: 'updated' | 'created' | 'merged';
  timestamp: string;
}

export interface ParseResult {
  updatedFields: string[];
  pendingConfirmations: PendingConfirmation[];
  appliedBlocks: AppliedBlock[];
}

export interface CodeBlockDeps {
  settings: any;
  updateSettings: (updates: any) => void;
  activeAvatar: any;
  handleUpdateAvatar: (id: number, updates: any) => void;
  saveVersionSnapshot: (
    entityType: string,
    entityId: string,
    content: any,
    source?: string,
    versionName?: string,
    notes?: string
  ) => Promise<any>;
  setTestingModeOpen: (open: boolean) => void;
  updateActiveTabPrompt: (prompt: string) => void;
  allTags: string[];
  getRulesForTag: (rules: TagBasedRule[], tag: string) => TagBasedRule[];
}

// ========== HELPERS ==========

function extractBlock(content: string, blockName: string): string | null {
  const regex = new RegExp('```' + blockName + '\\n?([\\s\\S]*?)```');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function extractAllBlocks(content: string, blockName: string): string[] {
  const regex = new RegExp('```' + blockName + '\\n?([\\s\\S]*?)```', 'g');
  const results: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

function parseKeyValueBlock(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim().toLowerCase();
      const value = line.substring(colonIdx + 1).trim();
      result[key] = value;
    }
  }
  return result;
}

function makeConfirmation(
  blockType: string,
  fieldLabel: string,
  currentValue: string,
  newValue: string,
  applyFn: () => void
): PendingConfirmation {
  return {
    id: `${blockType}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    blockType,
    fieldLabel,
    currentValue,
    newValue,
    applyFn,
    timestamp: new Date().toISOString(),
  };
}

// ========== MAIN PARSER ==========

export function parseAndApplyCodeBlocks(
  responseContent: string,
  deps: CodeBlockDeps
): ParseResult {
  const {
    settings,
    updateSettings,
    activeAvatar,
    handleUpdateAvatar,
    saveVersionSnapshot,
    setTestingModeOpen,
    updateActiveTabPrompt,
    allTags,
    getRulesForTag,
  } = deps;

  const updatedFields: string[] = [];
  const pendingConfirmations: PendingConfirmation[] = [];
  const appliedBlocks: AppliedBlock[] = [];

  // ==============================
  // EXISTING BLOCKS (with confirmation for non-empty)
  // ==============================

  // --- mainprompt ---
  const mainPromptVal = extractBlock(responseContent, 'mainprompt');
  if (mainPromptVal && activeAvatar) {
    const currentValue = activeAvatar.mainPrompt || '';
    if (currentValue.length > 0) {
      pendingConfirmations.push(makeConfirmation(
        'mainprompt', 'Main Prompt', currentValue, mainPromptVal,
        () => {
          handleUpdateAvatar(activeAvatar.id, { mainPrompt: mainPromptVal });
        }
      ));
    } else {
      handleUpdateAvatar(activeAvatar.id, { mainPrompt: mainPromptVal });
      updatedFields.push('Main Prompt');
      appliedBlocks.push({ blockType: 'mainprompt', fieldLabel: 'Main Prompt', action: 'updated', timestamp: new Date().toISOString() });
    }
  }

  // --- instructions ---
  const instructionsVal = extractBlock(responseContent, 'instructions');
  if (instructionsVal) {
    const currentValue = settings.guided_guardrails?.instructions || '';
    if (currentValue.length > 0) {
      pendingConfirmations.push(makeConfirmation(
        'instructions', 'Guided Instructions', currentValue, instructionsVal,
        () => {
          saveVersionSnapshot('guardrails', 'global', { instructions: currentValue }, 'ai-assistant', 'Pre-AI update');
          updateSettings({
            guided_guardrails: { ...settings.guided_guardrails, instructions: instructionsVal } as any,
          });
        }
      ));
    } else {
      updateSettings({
        guided_guardrails: { ...settings.guided_guardrails, instructions: instructionsVal } as any,
      });
      updatedFields.push('Instructions');
      appliedBlocks.push({ blockType: 'instructions', fieldLabel: 'Instructions', action: 'updated', timestamp: new Date().toISOString() });
    }
  }

  // --- uniform ---
  const uniformVal = extractBlock(responseContent, 'uniform');
  if (uniformVal) {
    const currentValue = settings.guided_guardrails?.uniformDescription || '';
    if (currentValue.length > 0) {
      pendingConfirmations.push(makeConfirmation(
        'uniform', 'Uniform/Appearance', currentValue, uniformVal,
        () => {
          saveVersionSnapshot('guardrails', 'global', { uniformDescription: currentValue }, 'ai-assistant', 'Pre-AI update');
          updateSettings({
            guided_guardrails: { ...settings.guided_guardrails, uniformDescription: uniformVal } as any,
          });
        }
      ));
    } else {
      updateSettings({
        guided_guardrails: { ...settings.guided_guardrails, uniformDescription: uniformVal } as any,
      });
      updatedFields.push('Uniform/Appearance');
      appliedBlocks.push({ blockType: 'uniform', fieldLabel: 'Uniform/Appearance', action: 'updated', timestamp: new Date().toISOString() });
    }
  }

  // --- subject ---
  const subjectVal = extractBlock(responseContent, 'subject');
  if (subjectVal) {
    const currentValue = settings.guided_guardrails?.defaultSubject || '';
    if (currentValue.length > 0) {
      pendingConfirmations.push(makeConfirmation(
        'subject', 'Default Subject', currentValue, subjectVal,
        () => {
          updateSettings({
            guided_guardrails: { ...settings.guided_guardrails, defaultSubject: subjectVal } as any,
          });
        }
      ));
    } else {
      updateSettings({
        guided_guardrails: { ...settings.guided_guardrails, defaultSubject: subjectVal } as any,
      });
      updatedFields.push('Default Subject');
      appliedBlocks.push({ blockType: 'subject', fieldLabel: 'Default Subject', action: 'updated', timestamp: new Date().toISOString() });
    }
  }

  // --- avoid ---
  const avoidVal = extractBlock(responseContent, 'avoid');
  if (avoidVal) {
    const currentValue = settings.guided_guardrails?.avoidList || '';
    if (currentValue.length > 0) {
      pendingConfirmations.push(makeConfirmation(
        'avoid', 'Avoid List', currentValue, avoidVal,
        () => {
          updateSettings({
            guided_guardrails: { ...settings.guided_guardrails, avoidList: avoidVal } as any,
          });
        }
      ));
    } else {
      updateSettings({
        guided_guardrails: { ...settings.guided_guardrails, avoidList: avoidVal } as any,
      });
      updatedFields.push('Avoid List');
      appliedBlocks.push({ blockType: 'avoid', fieldLabel: 'Avoid List', action: 'updated', timestamp: new Date().toISOString() });
    }
  }

  // --- stylepreferences ---
  const styleVal = extractBlock(responseContent, 'stylepreferences');
  if (styleVal) {
    const currentValue = settings.guided_guardrails?.stylePreferences || '';
    if (currentValue.length > 0) {
      pendingConfirmations.push(makeConfirmation(
        'stylepreferences', 'Style Preferences', currentValue, styleVal,
        () => {
          updateSettings({
            guided_guardrails: { ...settings.guided_guardrails, stylePreferences: styleVal } as any,
          });
        }
      ));
    } else {
      updateSettings({
        guided_guardrails: { ...settings.guided_guardrails, stylePreferences: styleVal } as any,
      });
      updatedFields.push('Style Preferences');
      appliedBlocks.push({ blockType: 'stylepreferences', fieldLabel: 'Style Preferences', action: 'updated', timestamp: new Date().toISOString() });
    }
  }

  // --- smartprompt ---
  const smartPromptVal = extractBlock(responseContent, 'smartprompt');
  if (smartPromptVal) {
    const currentValue = settings.smart_prompt_guidance || '';
    if (currentValue.length > 0) {
      pendingConfirmations.push(makeConfirmation(
        'smartprompt', 'Smart Prompt Guidance', currentValue, smartPromptVal,
        () => {
          saveVersionSnapshot('smart_prompt_guidance', 'global', currentValue, 'ai-assistant', 'Pre-AI update');
          updateSettings({ smart_prompt_guidance: smartPromptVal });
        }
      ));
    } else {
      updateSettings({ smart_prompt_guidance: smartPromptVal });
      updatedFields.push('Smart Prompt Guidance');
      appliedBlocks.push({ blockType: 'smartprompt', fieldLabel: 'Smart Prompt Guidance', action: 'updated', timestamp: new Date().toISOString() });
    }
  }

  // --- matchingrule1-4 ---
  for (let i = 1; i <= 4; i++) {
    const ruleVal = extractBlock(responseContent, `matchingrule${i}`);
    if (ruleVal) {
      const settingsKey = `matching_rule_${i}` as string;
      const currentValue = (settings as any)[settingsKey] || '';
      const label = `Matching Rule ${i}`;
      if (currentValue.length > 0) {
        pendingConfirmations.push(makeConfirmation(
          `matchingrule${i}`, label, currentValue, ruleVal,
          () => {
            saveVersionSnapshot('matching_rule', `rule_${i}`, currentValue, 'ai-assistant', 'Pre-AI update');
            updateSettings({ [settingsKey]: ruleVal });
          }
        ));
      } else {
        updateSettings({ [settingsKey]: ruleVal });
        updatedFields.push(label);
        appliedBlocks.push({ blockType: `matchingrule${i}`, fieldLabel: label, action: 'updated', timestamp: new Date().toISOString() });
      }
    }
  }

  // --- placementrule ---
  const placementVal = extractBlock(responseContent, 'placementrule');
  if (placementVal) {
    const currentValue = settings.placement_rule || '';
    if (currentValue.length > 0) {
      pendingConfirmations.push(makeConfirmation(
        'placementrule', 'Placement Rule', currentValue, placementVal,
        () => {
          updateSettings({ placement_rule: placementVal });
        }
      ));
    } else {
      updateSettings({ placement_rule: placementVal });
      updatedFields.push('Placement Rule');
      appliedBlocks.push({ blockType: 'placementrule', fieldLabel: 'Placement Rule', action: 'updated', timestamp: new Date().toISOString() });
    }
  }

  // --- smartmatchingrule ---
  const smartMatchVal = extractBlock(responseContent, 'smartmatchingrule');
  if (smartMatchVal) {
    const currentValue = settings.smart_matching_rule || '';
    if (currentValue.length > 0) {
      pendingConfirmations.push(makeConfirmation(
        'smartmatchingrule', 'Smart Matching Rule', currentValue, smartMatchVal,
        () => {
          updateSettings({ smart_matching_rule: smartMatchVal });
        }
      ));
    } else {
      updateSettings({ smart_matching_rule: smartMatchVal });
      updatedFields.push('Smart Matching Rule');
      appliedBlocks.push({ blockType: 'smartmatchingrule', fieldLabel: 'Smart Matching Rule', action: 'updated', timestamp: new Date().toISOString() });
    }
  }

  // --- testprompt (always auto-apply, non-destructive) ---
  const testPromptVal = extractBlock(responseContent, 'testprompt');
  if (testPromptVal) {
    setTestingModeOpen(true);
    updateActiveTabPrompt(testPromptVal);
    updatedFields.push('Test Prompt');
    appliedBlocks.push({ blockType: 'testprompt', fieldLabel: 'Test Prompt', action: 'updated', timestamp: new Date().toISOString() });
  }

  // --- guidedprompt (new - updates guided GPT prompt text) ---
  const guidedPromptVal = extractBlock(responseContent, 'guidedprompt');
  if (guidedPromptVal) {
    const currentValue = settings.guided_gpt_prompt || '';
    if (currentValue.length > 0) {
      pendingConfirmations.push(makeConfirmation(
        'guidedprompt', 'Guided GPT Prompt', currentValue, guidedPromptVal,
        () => {
          updateSettings({ guided_gpt_prompt: guidedPromptVal });
        }
      ));
    } else {
      updateSettings({ guided_gpt_prompt: guidedPromptVal });
      updatedFields.push('Guided GPT Prompt');
      appliedBlocks.push({ blockType: 'guidedprompt', fieldLabel: 'Guided GPT Prompt', action: 'updated', timestamp: new Date().toISOString() });
    }
  }

  // ==============================
  // NEW ADDITIVE BLOCKS (always auto-apply)
  // ==============================

  // --- newcategory (creates new placeholder category or merges if exists) ---
  const newCategoryBlocks = extractAllBlocks(responseContent, 'newcategory');
  for (const block of newCategoryBlocks) {
    if (!activeAvatar) continue;
    const parsed = parseKeyValueBlock(block);
    const name = parsed.name;
    if (!name) continue;

    const options = parsed.options
      ? parsed.options.split(',').map(o => o.trim()).filter(Boolean)
      : [];

    const existingCategories: PlaceholderCategory[] = activeAvatar.placeholderCategories || [];
    const existingCat = existingCategories.find(
      (c: PlaceholderCategory) => c.name.toLowerCase() === name.toLowerCase()
    );

    if (existingCat) {
      // MERGE: add new options to existing category (don't replace)
      const existingTexts = new Set(existingCat.options.map((o: PlaceholderOption) => o.text.toLowerCase()));
      const newOptions = options.filter(o => !existingTexts.has(o.toLowerCase()));
      if (newOptions.length === 0) {
        updatedFields.push(`Category '${name}' already has all options`);
        continue;
      }
      const nextNum = existingCat.options.length > 0
        ? Math.max(...existingCat.options.map((o: PlaceholderOption) => o.number)) + 1
        : 1;
      const updatedCat = {
        ...existingCat,
        options: [
          ...existingCat.options,
          ...newOptions.map((text, i) => ({
            number: nextNum + i,
            text,
            primaryKeywords: [] as string[],
            secondaryKeywords: [] as string[],
            useSecondaryKeywords: true,
          })),
        ],
      };
      const updatedCategories = existingCategories.map((c: PlaceholderCategory) =>
        c.id === existingCat.id ? updatedCat : c
      );
      handleUpdateAvatar(activeAvatar.id, { placeholderCategories: updatedCategories });
      updatedFields.push(`Merged ${newOptions.length} options into '${name}'`);
      appliedBlocks.push({ blockType: 'newcategory', fieldLabel: `Category '${name}'`, action: 'merged', timestamp: new Date().toISOString() });
    } else {
      // CREATE new category
      const placeholder = `{${name.replace(/\s+/g, '_')}}`;
      const newCategory: PlaceholderCategory = {
        id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name,
        placeholder,
        options: options.map((text, i) => ({
          number: i + 1,
          text,
          primaryKeywords: [] as string[],
          secondaryKeywords: [] as string[],
          useSecondaryKeywords: true,
        })),
      };
      handleUpdateAvatar(activeAvatar.id, {
        placeholderCategories: [...existingCategories, newCategory],
      });
      updatedFields.push(`Created category '${name}' with ${options.length} options`);
      appliedBlocks.push({ blockType: 'newcategory', fieldLabel: `Category '${name}'`, action: 'created', timestamp: new Date().toISOString() });
    }
  }

  // --- addoptions (adds options to existing category) ---
  const addOptionsBlocks = extractAllBlocks(responseContent, 'addoptions');
  for (const block of addOptionsBlocks) {
    if (!activeAvatar) continue;
    const parsed = parseKeyValueBlock(block);
    const categoryName = parsed.category;
    if (!categoryName) continue;

    const options = parsed.options
      ? parsed.options.split(',').map(o => o.trim()).filter(Boolean)
      : [];
    if (options.length === 0) continue;

    const existingCategories: PlaceholderCategory[] = activeAvatar.placeholderCategories || [];
    const targetCat = existingCategories.find(
      (c: PlaceholderCategory) => c.name.toLowerCase() === categoryName.toLowerCase()
    );

    if (!targetCat) {
      updatedFields.push(`Category '${categoryName}' not found (skipped)`);
      continue;
    }

    const existingTexts = new Set(targetCat.options.map((o: PlaceholderOption) => o.text.toLowerCase()));
    const newOptions = options.filter(o => !existingTexts.has(o.toLowerCase()));
    if (newOptions.length === 0) {
      updatedFields.push(`Category '${categoryName}' already has all options`);
      continue;
    }

    const nextNum = targetCat.options.length > 0
      ? Math.max(...targetCat.options.map((o: PlaceholderOption) => o.number)) + 1
      : 1;
    const updatedCat = {
      ...targetCat,
      options: [
        ...targetCat.options,
        ...newOptions.map((text, i) => ({
          number: nextNum + i,
          text,
          primaryKeywords: [] as string[],
          secondaryKeywords: [] as string[],
          useSecondaryKeywords: true,
        })),
      ],
    };
    const updatedCategories = existingCategories.map((c: PlaceholderCategory) =>
      c.id === targetCat.id ? updatedCat : c
    );
    handleUpdateAvatar(activeAvatar.id, { placeholderCategories: updatedCategories });
    updatedFields.push(`Added ${newOptions.length} options to '${categoryName}'`);
    appliedBlocks.push({ blockType: 'addoptions', fieldLabel: `Category '${categoryName}'`, action: 'merged', timestamp: new Date().toISOString() });
  }

  // --- newguidedrule (creates new guided GPT rule) ---
  const newGuidedRuleBlocks = extractAllBlocks(responseContent, 'newguidedrule');
  for (const block of newGuidedRuleBlocks) {
    const parsed = parseKeyValueBlock(block);
    const title = parsed.title || 'AI-Created Rule';
    const text = parsed.text || block; // Fall back to full block content if no key-value format
    const tag = parsed.tag || activeAvatar?.tag || 'Global';

    const existingRules: TagBasedRule[] = settings.guided_gpt_rules || [];
    const rulesForTag = getRulesForTag(existingRules, tag);

    const newRule: TagBasedRule = {
      id: `gr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      tag,
      title,
      text,
      order: rulesForTag.length,
      globalAppliesTo: tag === 'Global' ? allTags : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    updateSettings({
      guided_gpt_rules: [...existingRules, newRule],
    });
    updatedFields.push(`Created guided rule '${title}'`);
    appliedBlocks.push({ blockType: 'newguidedrule', fieldLabel: `Guided Rule '${title}'`, action: 'created', timestamp: new Date().toISOString() });
  }

  // --- newlegacyrule (creates new legacy/smart prompt rule) ---
  const newLegacyRuleBlocks = extractAllBlocks(responseContent, 'newlegacyrule');
  for (const block of newLegacyRuleBlocks) {
    const parsed = parseKeyValueBlock(block);
    const title = parsed.title || 'AI-Created Rule';
    const text = parsed.text || block;
    const tag = parsed.tag || activeAvatar?.tag || 'Global';

    const existingRules: TagBasedRule[] = settings.legacy_prompt_rules || [];
    const rulesForTag = getRulesForTag(existingRules, tag);

    const newRule: TagBasedRule = {
      id: `lr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      tag,
      title,
      text,
      order: rulesForTag.length,
      globalAppliesTo: tag === 'Global' ? allTags : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    updateSettings({
      legacy_prompt_rules: [...existingRules, newRule],
    });
    updatedFields.push(`Created legacy rule '${title}'`);
    appliedBlocks.push({ blockType: 'newlegacyrule', fieldLabel: `Legacy Rule '${title}'`, action: 'created', timestamp: new Date().toISOString() });
  }

  return { updatedFields, pendingConfirmations, appliedBlocks };
}

// ========== CODE BLOCK METADATA (for rendering) ==========

/** All recognized code block types for rendering in chat messages */
export const CODE_BLOCK_TYPES = [
  'mainprompt', 'instructions', 'uniform', 'subject', 'avoid',
  'stylepreferences', 'smartprompt', 'matchingrule1', 'matchingrule2',
  'matchingrule3', 'matchingrule4', 'placementrule', 'smartmatchingrule',
  'testprompt', 'guidedprompt', 'guardrail',
  'newcategory', 'addoptions', 'newguidedrule', 'newlegacyrule',
] as const;

export type CodeBlockType = typeof CODE_BLOCK_TYPES[number];

/** Labels for each block type */
export const CODE_BLOCK_LABELS: Record<string, string> = {
  mainprompt: 'Main Prompt',
  instructions: 'Guided Instructions',
  uniform: 'Uniform/Appearance',
  subject: 'Default Subject',
  avoid: 'Avoid List',
  stylepreferences: 'Style Preferences',
  smartprompt: 'Smart Prompt Guidance',
  matchingrule1: 'Matching Rule 1',
  matchingrule2: 'Matching Rule 2',
  matchingrule3: 'Matching Rule 3',
  matchingrule4: 'Matching Rule 4',
  placementrule: 'Placement Rule',
  smartmatchingrule: 'Smart Matching Rule',
  testprompt: 'Test Prompt',
  guidedprompt: 'Guided GPT Prompt',
  guardrail: 'Suggested Guardrail',
  newcategory: 'New Category',
  addoptions: 'Add Options',
  newguidedrule: 'New Guided Rule',
  newlegacyrule: 'New Legacy Rule',
};

/** Whether a block type is additive (doesn't overwrite existing content) */
export function isAdditiveBlock(blockType: string): boolean {
  return ['newcategory', 'addoptions', 'newguidedrule', 'newlegacyrule'].includes(blockType);
}
