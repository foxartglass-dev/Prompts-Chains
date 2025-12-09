/**
 * StyleLock Engine - Main Orchestrator
 * Coordinates the complete style-locking workflow
 */

import { v4 as uuidv4 } from 'uuid';
import { extractStyleDNA } from './style-dna.js';
import { generatePrompts, buildPromptFromTemplate } from './prompt-generator.js';
import { voteOnCandidates, aggregateFeedback } from './voting.js';
import { runBlindTest, quickQualityCheck } from './blind-test.js';
import { DEFAULT_SETTINGS, mergeSettings, validateSettings } from './default-settings.js';
import { generateImage } from '../image-generator.js';

/**
 * StyleLock Engine Class
 */
export class StyleLockEngine {
  constructor(apiKeys, settings = {}) {
    this.apiKeys = apiKeys;
    this.settings = mergeSettings(settings);

    const validation = validateSettings(this.settings);
    if (!validation.valid) {
      console.warn('Settings validation warnings:', validation.errors);
    }
  }

  async run(jobConfig, onProgress = () => {}) {
    const {
      referenceImages,
      targetDescription,
      uniformConfig = null,
      websiteId = null,
      nicheId = null
    } = jobConfig;

    const jobId = uuidv4().slice(0, 8);

    const job = {
      id: jobId,
      websiteId,
      nicheId,
      status: 'pending',
      referenceImages,
      targetDescription,
      uniformConfig,
      settings: { ...this.settings },
      currentRound: 0,
      rounds: [],
      styleDNA: null,
      winningPrompt: null,
      winningImageUrl: null,
      blindTestPassed: false,
      finalScore: 0,
      tier: null,
      totalCost: 0,
      costBreakdown: { styleDNA: 0, prompts: 0, images: 0, voting: 0, blindTest: 0 },
      createdAt: new Date(),
      completedAt: null
    };

    try {
      onProgress({ status: 'validating', jobId, round: 0 });

      if (!referenceImages || referenceImages.length === 0) {
        throw new Error('At least one reference image is required');
      }
      if (!this.apiKeys.openai) {
        throw new Error('OpenAI API key is required');
      }
      if (!this.apiKeys.replicate) {
        throw new Error('Replicate API key is required for image generation');
      }

      // Extract Style DNA
      job.status = 'extracting';
      onProgress({ status: 'extracting_style', jobId, round: 0 });

      const styleDNAResult = await extractStyleDNA(
        referenceImages,
        this.apiKeys.openai,
        { model: this.settings.generation.generatorModel }
      );

      job.styleDNA = styleDNAResult.styleDNA;
      job.costBreakdown.styleDNA = styleDNAResult.cost;
      job.totalCost += styleDNAResult.cost;

      onProgress({ status: 'style_extracted', jobId, round: 0, styleDNA: job.styleDNA, cost: job.totalCost });

      // Main iteration loop
      let bestPrompt = null;
      let bestImage = null;
      let bestScore = 0;
      let accumulatedFeedback = '';
      let plateauCount = 0;
      let previousBestScore = 0;

      for (let round = 1; round <= this.settings.limits.maxRounds; round++) {
        job.currentRound = round;
        job.status = 'generating';

        if (job.totalCost >= this.settings.limits.maxCost) {
          onProgress({ status: 'cost_limit_reached', jobId, round, cost: job.totalCost });
          break;
        }

        if (this.settings.checkpoints.enableHumanCheckpoint &&
            round === this.settings.checkpoints.humanCheckpointRound) {
          onProgress({ status: 'human_checkpoint', jobId, round, bestScore, bestImage, bestPrompt, message: 'Paused for human review' });
        }

        onProgress({ status: 'generating_prompts', jobId, round });

        const promptsResult = await generatePrompts(
          job.styleDNA,
          targetDescription,
          this.apiKeys.openai,
          {
            count: this.settings.generation.numGenerators,
            previousFeedback: accumulatedFeedback,
            uniformConfig,
            diversityStrategies: this.settings.generation.diversityStrategies
          }
        );

        job.costBreakdown.prompts += promptsResult.cost;
        job.totalCost += promptsResult.cost;

        onProgress({ status: 'generating_images', jobId, round, promptCount: promptsResult.count });

        const imageResults = [];
        for (const promptObj of promptsResult.prompts) {
          try {
            const result = await generateImage(
              promptObj.prompt,
              { width: this.settings.generation.imageWidth, height: this.settings.generation.imageHeight },
              this.apiKeys.replicate
            );
            imageResults.push({ url: result.url, prompt: promptObj.prompt, strategy: promptObj.strategy });
            job.costBreakdown.images += this.settings.costs['flux-1.1-pro'];
            job.totalCost += this.settings.costs['flux-1.1-pro'];
          } catch (error) {
            console.warn(`Image generation failed for prompt ${promptObj.index}:`, error.message);
          }
        }

        if (imageResults.length === 0) {
          onProgress({ status: 'generation_failed', jobId, round, error: 'All image generations failed' });
          continue;
        }

        onProgress({ status: 'voting', jobId, round, imageCount: imageResults.length });

        const voteResults = await voteOnCandidates(
          imageResults.map(r => r.url),
          referenceImages,
          this.apiKeys.openai,
          { numVoters: this.settings.voting.numVoters, model: this.settings.voting.voterModel }
        );

        job.costBreakdown.voting += voteResults.totalCost;
        job.totalCost += voteResults.totalCost;

        const roundResult = {
          roundNum: round,
          prompts: imageResults.map(r => r.prompt),
          images: imageResults.map(r => r.url),
          voteResults: voteResults.results,
          bestImageIndex: voteResults.bestIndex,
          bestScore: voteResults.bestScore,
          feedback: voteResults.bestFeedback,
          cost: promptsResult.cost + (imageResults.length * this.settings.costs['flux-1.1-pro']) + voteResults.totalCost
        };
        job.rounds.push(roundResult);

        if (voteResults.bestScore > bestScore) {
          bestScore = voteResults.bestScore;
          bestImage = imageResults[voteResults.bestIndex]?.url;
          bestPrompt = imageResults[voteResults.bestIndex]?.prompt;
        }

        accumulatedFeedback = aggregateFeedback(job.rounds);

        onProgress({ status: 'round_complete', jobId, round, bestScore, roundScore: voteResults.bestScore, feedback: roundResult.feedback, cost: job.totalCost });

        // Plateau detection
        if (this.settings.checkpoints.enablePlateauDetection) {
          const improvement = bestScore - previousBestScore;
          if (improvement < this.settings.checkpoints.plateauMinImprovement) {
            plateauCount++;
            if (plateauCount >= this.settings.checkpoints.plateauRounds) {
              onProgress({ status: 'plateau_detected', jobId, round, bestScore, message: `No significant improvement for ${plateauCount} rounds` });
            }
          } else {
            plateauCount = 0;
          }
          previousBestScore = bestScore;
        }

        // Blind test
        if (bestScore >= this.settings.voting.advanceThreshold) {
          job.status = 'blind_test';
          onProgress({ status: 'blind_test', jobId, round, score: bestScore });

          const blindTestResult = await runBlindTest(
            referenceImages,
            [bestImage],
            { openai: this.apiKeys.openai, anthropic: this.apiKeys.anthropic },
            {
              numJudges: this.settings.blindTest.numJudges,
              judgeModels: this.settings.blindTest.judgeModels,
              numReferenceImages: this.settings.blindTest.numReferenceImages,
              passThreshold: this.settings.blindTest.passThreshold
            }
          );

          job.costBreakdown.blindTest += blindTestResult.totalCost;
          job.totalCost += blindTestResult.totalCost;

          if (blindTestResult.passed) {
            job.status = 'complete';
            job.winningPrompt = bestPrompt;
            job.winningImageUrl = bestImage;
            job.blindTestPassed = true;
            job.finalScore = bestScore;
            job.tier = this.determineTier(bestScore);
            job.completedAt = new Date();

            onProgress({ status: 'complete', jobId, round, score: bestScore, foolRate: blindTestResult.foolRate, tier: job.tier, cost: job.totalCost });

            return this.formatJobResult(job, true);
          } else {
            accumulatedFeedback = blindTestResult.feedback || accumulatedFeedback;
            onProgress({ status: 'blind_test_failed', jobId, round, foolRate: blindTestResult.foolRate, feedback: blindTestResult.feedback });
          }
        }
      }

      // Max rounds reached
      job.status = 'failed';
      job.winningPrompt = bestPrompt;
      job.winningImageUrl = bestImage;
      job.finalScore = bestScore;
      job.tier = this.determineTier(bestScore);
      job.completedAt = new Date();

      onProgress({ status: 'max_rounds_reached', jobId, bestScore, tier: job.tier, cost: job.totalCost });

      return this.formatJobResult(job, false);

    } catch (error) {
      job.status = 'error';
      job.error = error.message;
      job.completedAt = new Date();

      onProgress({ status: 'error', jobId, error: error.message, cost: job.totalCost });

      return this.formatJobResult(job, false, error.message);
    }
  }

  determineTier(score) {
    const { thresholds } = this.settings.tiers;
    if (score >= thresholds.perfect) return 'PERFECT';
    if (score >= thresholds.goodEnough) return 'GOOD_ENOUGH';
    if (score >= thresholds.partial) return 'PARTIAL';
    return 'FAILED';
  }

  formatJobResult(job, success, error = null) {
    return {
      success,
      jobId: job.id,
      status: job.status,
      tier: job.tier,
      prompt: job.winningPrompt,
      imageUrl: job.winningImageUrl,
      score: job.finalScore,
      blindTestPassed: job.blindTestPassed,
      rounds: job.currentRound,
      totalCost: job.totalCost,
      costBreakdown: job.costBreakdown,
      duration: job.completedAt ? job.completedAt - job.createdAt : null,
      styleDNA: job.styleDNA,
      error,
      _fullJob: job
    };
  }

  async generateBatch(styleDNA, actions, options = {}) {
    const { uniformConfig = null, imageType = 'inline', onProgress = () => {}, referenceImages = [] } = options;

    const results = [];
    let totalCost = 0;
    let qualityCheckFailed = false;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      onProgress({ status: 'generating_batch', current: i + 1, total: actions.length, action });

      const prompt = buildPromptFromTemplate(styleDNA, action, { uniformConfig, imageType });

      try {
        const result = await generateImage(
          prompt,
          { width: this.settings.generation.imageWidth, height: this.settings.generation.imageHeight },
          this.apiKeys.replicate
        );

        const imageCost = this.settings.costs['flux-1.1-pro'];
        totalCost += imageCost;

        results.push({ index: i, action, prompt, imageUrl: result.url, cost: imageCost, success: true });

        if (this.settings.batch.enableQualityChecks &&
            this.settings.batch.checkIntervals.includes(i + 1) &&
            referenceImages.length > 0) {

          onProgress({ status: 'quality_check', imageNumber: i + 1 });

          const checkResult = await quickQualityCheck(referenceImages, result.url, this.apiKeys.openai);
          totalCost += checkResult.cost;

          if (!checkResult.passed) {
            qualityCheckFailed = true;
            onProgress({ status: 'quality_check_failed', imageNumber: i + 1, reason: checkResult.reason });

            if (this.settings.batch.failureAction === 'pause') {
              return { results, totalCost, paused: true, pauseReason: `Quality check failed at image ${i + 1}: ${checkResult.reason}`, qualityCheckFailed: true };
            }
          }
        }

      } catch (error) {
        results.push({ index: i, action, prompt, error: error.message, success: false });
      }
    }

    return { results, totalCost, paused: false, qualityCheckFailed, successCount: results.filter(r => r.success).length, failCount: results.filter(r => !r.success).length };
  }
}

export function createStyleLockEngine(apiKeys, settings = {}) {
  return new StyleLockEngine(apiKeys, settings);
}
