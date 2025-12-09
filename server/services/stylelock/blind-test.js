/**
 * StyleLock - Blind Test Service
 * Fresh AI judges try to distinguish real vs AI-generated images
 * This is the ultimate quality gate
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { prepareImageUrl } from './style-dna.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load blind test prompt template
const BLIND_TEST_PROMPT = fs.readFileSync(
  path.join(__dirname, 'prompts', 'blind-test.txt'),
  'utf-8'
);

/**
 * Shuffle array (Fisher-Yates)
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Run a single blind test judge
 */
async function runSingleJudge(images, apiKey, options = {}) {
  const { model = 'gpt-4o', judgeId = 'judge-1' } = options;

  const shuffled = shuffleArray(images.map((img, idx) => ({ ...img, originalIndex: idx })));
  const promptText = BLIND_TEST_PROMPT.replace('{NUM_IMAGES}', shuffled.length.toString());
  const isClaudeModel = model.includes('claude');

  if (isClaudeModel) {
    return runClaudeJudge(shuffled, apiKey, { ...options, judgeId, promptText });
  } else {
    return runOpenAIJudge(shuffled, apiKey, { ...options, judgeId, promptText });
  }
}

/**
 * Run OpenAI-based judge
 */
async function runOpenAIJudge(shuffledImages, apiKey, options) {
  const { model = 'gpt-4o', judgeId, promptText } = options;
  const openai = new OpenAI({ apiKey });

  const content = [{ type: 'text', text: promptText }];

  for (let i = 0; i < shuffledImages.length; i++) {
    content.push({ type: 'text', text: `\n\nImage ${i + 1}:` });
    try {
      const preparedUrl = prepareImageUrl(shuffledImages[i].url);
      content.push({
        type: 'image_url',
        image_url: { url: preparedUrl, detail: 'high' }
      });
    } catch (error) {
      console.warn(`Failed to prepare image ${i + 1}:`, error.message);
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content }],
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const responseText = response.choices[0].message.content;
    let verdicts;

    try {
      const parsed = JSON.parse(responseText);
      verdicts = Array.isArray(parsed) ? parsed : (parsed.verdicts || parsed.results || [parsed]);
    } catch (parseError) {
      const arrayMatch = responseText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        verdicts = JSON.parse(arrayMatch[0]);
      } else {
        throw new Error('Could not parse blind test response');
      }
    }

    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const cost = (inputTokens * 0.005 / 1000) + (outputTokens * 0.015 / 1000);

    return processVerdicts(verdicts, shuffledImages, judgeId, model, cost);

  } catch (error) {
    throw new Error(`OpenAI judge failed: ${error.message}`);
  }
}

/**
 * Run Claude-based judge for model diversity
 */
async function runClaudeJudge(shuffledImages, apiKey, options) {
  const { model = 'claude-sonnet-4-20250514', judgeId, promptText } = options;
  const anthropic = new Anthropic({ apiKey });

  const content = [{ type: 'text', text: promptText }];

  for (let i = 0; i < shuffledImages.length; i++) {
    content.push({ type: 'text', text: `\n\nImage ${i + 1}:` });
    try {
      const preparedUrl = prepareImageUrl(shuffledImages[i].url);

      if (preparedUrl.startsWith('data:')) {
        const [header, base64Data] = preparedUrl.split(',');
        const mediaType = header.match(/data:(.*);base64/)?.[1] || 'image/jpeg';
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data
          }
        });
      } else {
        console.warn(`Claude judge skipping non-base64 image ${i + 1}`);
      }
    } catch (error) {
      console.warn(`Failed to prepare image ${i + 1} for Claude:`, error.message);
    }
  }

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 1500,
      messages: [{ role: 'user', content }]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    let verdicts;
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        verdicts = JSON.parse(jsonMatch[0]);
      } else {
        const objectMatch = responseText.match(/\{[\s\S]*\}/g);
        if (objectMatch) {
          verdicts = objectMatch.map(m => JSON.parse(m));
        } else {
          throw new Error('No JSON found in response');
        }
      }
    } catch (parseError) {
      throw new Error(`Could not parse Claude response: ${parseError.message}`);
    }

    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const cost = (inputTokens * 0.003 / 1000) + (outputTokens * 0.015 / 1000);

    return processVerdicts(verdicts, shuffledImages, judgeId, model, cost);

  } catch (error) {
    throw new Error(`Claude judge failed: ${error.message}`);
  }
}

/**
 * Process and normalize verdicts from any judge
 */
function processVerdicts(verdicts, shuffledImages, judgeId, model, cost) {
  const processedVerdicts = [];
  let fooledOnAI = false;

  for (let i = 0; i < shuffledImages.length; i++) {
    const img = shuffledImages[i];
    const verdict = verdicts.find(v =>
      v.image_number === i + 1 ||
      v.imageNumber === i + 1 ||
      v.index === i
    ) || verdicts[i];

    if (!verdict) continue;

    const judgedAs = (verdict.verdict || verdict.prediction || 'UNSURE').toUpperCase();
    const actualType = img.type;

    if (actualType === 'AI' && (judgedAs === 'REAL' || judgedAs === 'UNSURE')) {
      fooledOnAI = true;
    }

    processedVerdicts.push({
      imageIndex: img.originalIndex,
      shuffledIndex: i,
      actualType,
      judgedAs,
      confidence: (verdict.confidence || 'MEDIUM').toUpperCase(),
      reason: verdict.reason || 'No reason provided',
      correct: judgedAs === actualType
    });
  }

  return {
    judgeId,
    model,
    verdicts: processedVerdicts,
    fooledOnAI,
    cost
  };
}

/**
 * Run full blind test with multiple judges
 */
export async function runBlindTest(referenceImages, candidateImages, apiKeys, options = {}) {
  const {
    numJudges = 3,
    judgeModels = ['gpt-4o', 'gpt-4o', 'gpt-4o'],
    numReferenceImages = 3,
    passThreshold = 0.66
  } = options;

  const selectedRefs = referenceImages.slice(0, numReferenceImages);
  const images = [
    ...selectedRefs.map(url => ({ url, type: 'REAL' })),
    ...candidateImages.map(url => ({ url, type: 'AI' }))
  ];

  const judgePromises = [];

  for (let i = 0; i < numJudges; i++) {
    const model = judgeModels[i % judgeModels.length];
    const apiKey = model.includes('claude') ? apiKeys.anthropic : apiKeys.openai;

    if (!apiKey) {
      console.warn(`No API key for ${model}, skipping judge ${i + 1}`);
      continue;
    }

    judgePromises.push(
      runSingleJudge(images, apiKey, {
        model,
        judgeId: `judge-${i + 1}`
      }).catch(error => ({
        judgeId: `judge-${i + 1}`,
        model,
        error: error.message,
        verdicts: [],
        fooledOnAI: false,
        cost: 0
      }))
    );
  }

  const judgeResults = await Promise.all(judgePromises);

  const validJudges = judgeResults.filter(j => !j.error && j.verdicts.length > 0);
  const fooledJudges = validJudges.filter(j => j.fooledOnAI);

  const foolRate = validJudges.length > 0
    ? fooledJudges.length / validJudges.length
    : 0;

  const passed = foolRate >= passThreshold;

  const detectionReasons = [];
  for (const judge of validJudges) {
    for (const verdict of judge.verdicts) {
      if (verdict.actualType === 'AI' && verdict.judgedAs === 'AI') {
        detectionReasons.push(verdict.reason);
      }
    }
  }

  const totalCost = judgeResults.reduce((sum, j) => sum + (j.cost || 0), 0);

  return {
    passed,
    foolRate,
    threshold: passThreshold,
    judges: judgeResults,
    validJudgeCount: validJudges.length,
    fooledCount: fooledJudges.length,
    detectionReasons,
    feedback: detectionReasons.slice(0, 3).join('; '),
    totalCost
  };
}

/**
 * Quick quality check for batch mode
 */
export async function quickQualityCheck(referenceImages, candidateImage, apiKey, options = {}) {
  const { model = 'gpt-4o' } = options;

  const images = [
    { url: referenceImages[0], type: 'REAL' },
    { url: candidateImage, type: 'AI' },
    { url: referenceImages[1] || referenceImages[0], type: 'REAL' }
  ];

  const result = await runSingleJudge(images, apiKey, { model, judgeId: 'quick-check' });

  const aiVerdict = result.verdicts.find(v => v.actualType === 'AI');
  const passed = aiVerdict && (aiVerdict.judgedAs === 'REAL' || aiVerdict.judgedAs === 'UNSURE');

  return {
    passed,
    verdict: aiVerdict?.judgedAs || 'UNKNOWN',
    confidence: aiVerdict?.confidence || 'LOW',
    reason: aiVerdict?.reason || 'No verdict',
    cost: result.cost
  };
}
