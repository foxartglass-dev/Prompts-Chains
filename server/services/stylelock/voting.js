/**
 * StyleLock - Voting Service
 * AI voters score generated images against reference style
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { prepareImageUrl } from './style-dna.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load voting prompt template
const VOTING_PROMPT = fs.readFileSync(
  path.join(__dirname, 'prompts', 'voting.txt'),
  'utf-8'
);

/**
 * Have a single voter score an image
 */
export async function singleVote(candidateImage, referenceImages, apiKey, options = {}) {
  const {
    model = 'gpt-4o',
    voterId = 'voter-1'
  } = options;

  const openai = new OpenAI({ apiKey });

  const content = [
    { type: 'text', text: '## Reference Images (the target style to match):\n' }
  ];

  for (const refImage of referenceImages.slice(0, 3)) {
    try {
      const preparedUrl = prepareImageUrl(refImage);
      content.push({
        type: 'image_url',
        image_url: { url: preparedUrl, detail: 'low' }
      });
    } catch (error) {
      console.warn(`Failed to prepare reference image: ${error.message}`);
    }
  }

  content.push({ type: 'text', text: '\n## Image to Evaluate:\n' });
  try {
    const preparedCandidate = prepareImageUrl(candidateImage);
    content.push({
      type: 'image_url',
      image_url: { url: preparedCandidate, detail: 'high' }
    });
  } catch (error) {
    throw new Error(`Failed to prepare candidate image: ${error.message}`);
  }

  content.push({ type: 'text', text: '\n' + VOTING_PROMPT });

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content }],
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const responseText = response.choices[0].message.content;
    let vote;

    try {
      vote = JSON.parse(responseText);
    } catch (parseError) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        vote = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse vote response');
      }
    }

    const normalizedVote = {
      voterId,
      model,
      scores: {
        lighting: Math.min(25, Math.max(0, vote.lighting_score || 0)),
        color: Math.min(25, Math.max(0, vote.color_score || 0)),
        composition: Math.min(25, Math.max(0, vote.composition_score || 0)),
        realism: Math.min(25, Math.max(0, vote.realism_score || 0))
      },
      totalScore: 0,
      mainIssue: vote.main_issue || 'No specific issue identified',
      specificFix: vote.specific_fix || 'No specific fix suggested'
    };

    normalizedVote.totalScore =
      normalizedVote.scores.lighting +
      normalizedVote.scores.color +
      normalizedVote.scores.composition +
      normalizedVote.scores.realism;

    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const cost = (inputTokens * 0.005 / 1000) + (outputTokens * 0.015 / 1000);

    return { vote: normalizedVote, cost };

  } catch (error) {
    throw new Error(`Voting failed: ${error.message}`);
  }
}

/**
 * Have multiple voters score an image
 */
export async function voteOnImage(candidateImage, referenceImages, apiKey, options = {}) {
  const { numVoters = 3, model = 'gpt-4o' } = options;

  const votePromises = [];
  for (let i = 0; i < numVoters; i++) {
    votePromises.push(
      singleVote(candidateImage, referenceImages, apiKey, {
        model,
        voterId: `voter-${i + 1}`
      })
    );
  }

  const results = await Promise.allSettled(votePromises);

  const votes = [];
  let totalCost = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      votes.push(result.value.vote);
      totalCost += result.value.cost;
    } else {
      console.warn('Vote failed:', result.reason?.message);
    }
  }

  if (votes.length === 0) {
    throw new Error('All voters failed');
  }

  const avgScore = votes.reduce((sum, v) => sum + v.totalScore, 0) / votes.length;

  const feedback = votes
    .filter(v => v.specificFix && v.specificFix !== 'No specific fix suggested')
    .map(v => v.specificFix);

  const issueCounts = {};
  for (const vote of votes) {
    const issue = vote.mainIssue;
    issueCounts[issue] = (issueCounts[issue] || 0) + 1;
  }
  const mainIssue = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'No consensus';

  return {
    votes,
    averageScore: avgScore,
    mainIssue,
    feedback: feedback.length > 0 ? feedback.join('; ') : votes[0]?.specificFix || '',
    voterCount: votes.length,
    cost: totalCost
  };
}

/**
 * Vote on multiple candidate images
 */
export async function voteOnCandidates(candidateImages, referenceImages, apiKey, options = {}) {
  const { numVoters = 3, model = 'gpt-4o' } = options;

  const votingPromises = candidateImages.map((image, index) =>
    voteOnImage(image, referenceImages, apiKey, { numVoters, model })
      .then(result => ({ index, image, ...result }))
      .catch(error => ({
        index,
        image,
        error: error.message,
        averageScore: 0,
        votes: [],
        feedback: '',
        cost: 0
      }))
  );

  const results = await Promise.all(votingPromises);
  const ranked = results.sort((a, b) => b.averageScore - a.averageScore);
  const best = ranked[0];
  const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0);

  return {
    results: ranked,
    bestIndex: best.index,
    bestScore: best.averageScore,
    bestImage: best.image,
    bestFeedback: best.feedback,
    totalCost
  };
}

/**
 * Aggregate feedback from multiple rounds
 */
export function aggregateFeedback(roundsHistory) {
  const feedbackCounts = {};

  for (const round of roundsHistory) {
    if (round.feedback) {
      const items = round.feedback.split(';').map(f => f.trim()).filter(f => f);
      for (const item of items) {
        feedbackCounts[item] = (feedbackCounts[item] || 0) + 1;
      }
    }
  }

  return Object.entries(feedbackCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([feedback]) => feedback)
    .join('; ');
}
