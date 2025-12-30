/**
 * Human Feedback Service
 *
 * The center of the learning loop - captures human feedback
 * after image generation runs to help the AI improve.
 */

import { sql, isDatabaseEnabled } from '../db/index.js';

// Quick feedback tags that can be selected
export const QUICK_TAGS = [
  // Positive
  { id: 'perfect', label: '✨ Perfect', type: 'positive' },
  { id: 'good_action', label: '👍 Good action', type: 'positive' },
  { id: 'good_lighting', label: '💡 Good lighting', type: 'positive' },
  { id: 'good_setting', label: '🏠 Good setting', type: 'positive' },
  { id: 'realistic', label: '📷 Realistic', type: 'positive' },

  // Negative - Things to improve
  { id: 'wrong_uniform', label: '👕 Wrong uniform', type: 'negative' },
  { id: 'wrong_setting', label: '🏢 Wrong setting', type: 'negative' },
  { id: 'too_posed', label: '🧍 Too posed/stiff', type: 'negative' },
  { id: 'bad_lighting', label: '🌑 Bad lighting', type: 'negative' },
  { id: 'wrong_action', label: '❌ Wrong action', type: 'negative' },
  { id: 'ai_artifacts', label: '🤖 AI artifacts', type: 'negative' },
  { id: 'bad_hands', label: '🖐️ Bad hands', type: 'negative' },
  { id: 'bad_face', label: '😐 Weird face', type: 'negative' },
  { id: 'bad_logo', label: '🏷️ Bad logo', type: 'negative' },
  { id: 'not_authentic', label: '📸 Stock photo feel', type: 'negative' },

  // Directional - What to do more/less of
  { id: 'more_action', label: '⬆️ More action', type: 'direction' },
  { id: 'different_angle', label: '📐 Different angle', type: 'direction' },
  { id: 'closer_shot', label: '🔍 Closer shot', type: 'direction' },
  { id: 'wider_shot', label: '🔭 Wider shot', type: 'direction' },
  { id: 'more_equipment', label: '🧹 Show more equipment', type: 'direction' },
  { id: 'less_equipment', label: '➖ Less equipment', type: 'direction' },
];

// Rating levels
export const RATINGS = [
  { id: 'perfect', label: '👍 Perfect', score: 5, emoji: '👍' },
  { id: 'good', label: '👌 Good', score: 4, emoji: '👌' },
  { id: 'ok', label: '😐 OK', score: 3, emoji: '😐' },
  { id: 'needs_work', label: '👎 Needs Work', score: 2, emoji: '👎' },
  { id: 'bad', label: '❌ Bad', score: 1, emoji: '❌' },
];

// ============================================
// FEEDBACK SETTINGS
// ============================================

/**
 * Get or create feedback settings for a workflow
 */
export async function getFeedbackSettings(workflowId) {
  if (!isDatabaseEnabled()) {
    return {
      show_after_every_run: true,
      perfect_streak_threshold: 10,
      current_perfect_streak: 0,
      auto_disabled: false,
      never_ask_again: false
    };
  }

  // Try to get existing settings
  let settings = await sql`
    SELECT * FROM feedback_settings WHERE workflow_id = ${workflowId}
  `;

  // Create if doesn't exist
  if (settings.length === 0) {
    settings = await sql`
      INSERT INTO feedback_settings (workflow_id)
      VALUES (${workflowId})
      RETURNING *
    `;
  }

  return settings[0];
}

/**
 * Update feedback settings
 */
export async function updateFeedbackSettings(workflowId, updates) {
  if (!isDatabaseEnabled()) return null;

  const result = await sql`
    UPDATE feedback_settings
    SET
      show_after_every_run = COALESCE(${updates.show_after_every_run}, show_after_every_run),
      perfect_streak_threshold = COALESCE(${updates.perfect_streak_threshold}, perfect_streak_threshold),
      never_ask_again = COALESCE(${updates.never_ask_again}, never_ask_again),
      updated_at = CURRENT_TIMESTAMP
    WHERE workflow_id = ${workflowId}
    RETURNING *
  `;
  return result[0];
}

/**
 * Check if feedback popup should be shown
 */
export async function shouldShowFeedback(workflowId) {
  const settings = await getFeedbackSettings(workflowId);

  // Never ask again was set
  if (settings.never_ask_again) {
    return { show: false, reason: 'never_ask_again' };
  }

  // Auto-disabled due to perfect streak
  if (settings.auto_disabled) {
    return { show: false, reason: 'auto_disabled', streak: settings.current_perfect_streak };
  }

  // Show after every run is enabled
  if (settings.show_after_every_run) {
    return { show: true, reason: 'always_show' };
  }

  return { show: true, reason: 'default' };
}

// ============================================
// FEEDBACK SUBMISSION
// ============================================

/**
 * Create a pending feedback request (after image generation)
 */
export async function createFeedbackRequest({
  workflow_id,
  avatar_id = null,
  article_id = null,
  run_type = 'batch',
  generated_images = [],
  prompts_used = []
}) {
  if (!isDatabaseEnabled()) return null;

  const result = await sql`
    INSERT INTO human_feedback
    (workflow_id, avatar_id, article_id, run_type, generated_images, prompts_used)
    VALUES (${workflow_id}, ${avatar_id}, ${article_id}, ${run_type}, ${JSON.stringify(generated_images)}, ${JSON.stringify(prompts_used)})
    RETURNING *
  `;
  return result[0];
}

/**
 * Submit feedback for a request
 */
export async function submitFeedback(feedbackId, {
  rating,
  quick_tags = [],
  detailed_feedback = null,
  questions_answered = []
}) {
  if (!isDatabaseEnabled()) return null;

  // Get the feedback request to find workflow_id
  const feedbackRequest = await sql`
    SELECT * FROM human_feedback WHERE id = ${feedbackId}
  `;

  if (feedbackRequest.length === 0) {
    throw new Error('Feedback request not found');
  }

  const workflowId = feedbackRequest[0].workflow_id;

  // Update the feedback
  const result = await sql`
    UPDATE human_feedback
    SET
      rating = ${rating},
      quick_tags = ${JSON.stringify(quick_tags)},
      detailed_feedback = ${detailed_feedback},
      questions_answered = ${JSON.stringify(questions_answered)},
      feedback_given = true
    WHERE id = ${feedbackId}
    RETURNING *
  `;

  // Update perfect streak
  const isPerfect = rating === 'perfect';
  await updatePerfectStreak(workflowId, isPerfect);

  return result[0];
}

/**
 * Skip feedback (user doesn't want to provide feedback this time)
 */
export async function skipFeedback(feedbackId) {
  if (!isDatabaseEnabled()) return null;

  const result = await sql`
    UPDATE human_feedback
    SET skipped = true
    WHERE id = ${feedbackId}
    RETURNING *
  `;
  return result[0];
}

/**
 * Update perfect streak and check for auto-disable
 */
async function updatePerfectStreak(workflowId, isPerfect) {
  if (!isDatabaseEnabled()) return;

  const settings = await getFeedbackSettings(workflowId);

  if (isPerfect) {
    // Increment streak
    const newStreak = settings.current_perfect_streak + 1;
    const shouldAutoDisable = newStreak >= settings.perfect_streak_threshold;

    await sql`
      UPDATE feedback_settings
      SET
        current_perfect_streak = ${newStreak},
        auto_disabled = ${shouldAutoDisable},
        updated_at = CURRENT_TIMESTAMP
      WHERE workflow_id = ${workflowId}
    `;

    if (shouldAutoDisable) {
      console.log(`[Feedback] Auto-disabled for workflow ${workflowId} after ${newStreak} perfect ratings`);
    }
  } else {
    // Reset streak on non-perfect rating
    await sql`
      UPDATE feedback_settings
      SET
        current_perfect_streak = 0,
        auto_disabled = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE workflow_id = ${workflowId}
    `;
  }
}

/**
 * Get pending feedback requests (not yet answered)
 */
export async function getPendingFeedback(workflowId) {
  if (!isDatabaseEnabled()) return [];

  return await sql`
    SELECT * FROM human_feedback
    WHERE workflow_id = ${workflowId}
      AND feedback_given = false
      AND skipped = false
    ORDER BY created_at DESC
  `;
}

/**
 * Get feedback history
 */
export async function getFeedbackHistory(workflowId, limit = 50) {
  if (!isDatabaseEnabled()) return [];

  return await sql`
    SELECT * FROM human_feedback
    WHERE workflow_id = ${workflowId}
      AND feedback_given = true
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

// ============================================
// AI QUESTIONS
// ============================================

/**
 * Queue a question for the human to answer
 */
export async function queueQuestion({
  workflow_id,
  avatar_id = null,
  question,
  context = null,
  options = [],
  priority = 0
}) {
  if (!isDatabaseEnabled()) return null;

  const result = await sql`
    INSERT INTO ai_questions
    (workflow_id, avatar_id, question, context, options, priority)
    VALUES (${workflow_id}, ${avatar_id}, ${question}, ${context}, ${JSON.stringify(options)}, ${priority})
    RETURNING *
  `;
  return result[0];
}

/**
 * Get unanswered questions
 */
export async function getUnansweredQuestions(workflowId, avatarId = null) {
  if (!isDatabaseEnabled()) return [];

  if (avatarId) {
    return await sql`
      SELECT * FROM ai_questions
      WHERE workflow_id = ${workflowId}
        AND (avatar_id = ${avatarId} OR avatar_id IS NULL)
        AND answered = false
      ORDER BY priority DESC, created_at ASC
    `;
  }

  return await sql`
    SELECT * FROM ai_questions
    WHERE workflow_id = ${workflowId}
      AND answered = false
    ORDER BY priority DESC, created_at ASC
  `;
}

/**
 * Answer a question
 */
export async function answerQuestion(questionId, answer) {
  if (!isDatabaseEnabled()) return null;

  const result = await sql`
    UPDATE ai_questions
    SET
      answered = true,
      answer = ${answer},
      answered_at = CURRENT_TIMESTAMP
    WHERE id = ${questionId}
    RETURNING *
  `;
  return result[0];
}

// ============================================
// LEARNING FROM FEEDBACK
// ============================================

/**
 * Get aggregated feedback insights
 */
export async function getFeedbackInsights(workflowId, avatarId = null) {
  if (!isDatabaseEnabled()) return null;

  // Get all feedback with ratings
  const feedback = await sql`
    SELECT rating, quick_tags, detailed_feedback
    FROM human_feedback
    WHERE workflow_id = ${workflowId}
      ${avatarId ? sql`AND avatar_id = ${avatarId}` : sql``}
      AND feedback_given = true
  `;

  if (feedback.length === 0) {
    return { total: 0, insights: [] };
  }

  // Count ratings
  const ratingCounts = {};
  feedback.forEach(f => {
    ratingCounts[f.rating] = (ratingCounts[f.rating] || 0) + 1;
  });

  // Count tags
  const tagCounts = {};
  feedback.forEach(f => {
    (f.quick_tags || []).forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  // Sort tags by frequency
  const topIssues = Object.entries(tagCounts)
    .filter(([tag]) => QUICK_TAGS.find(t => t.id === tag)?.type === 'negative')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count, label: QUICK_TAGS.find(t => t.id === tag)?.label }));

  const topStrengths = Object.entries(tagCounts)
    .filter(([tag]) => QUICK_TAGS.find(t => t.id === tag)?.type === 'positive')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count, label: QUICK_TAGS.find(t => t.id === tag)?.label }));

  // Calculate average score
  const scores = feedback.map(f => RATINGS.find(r => r.id === f.rating)?.score || 3);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  return {
    total: feedback.length,
    averageScore: avgScore.toFixed(2),
    ratingDistribution: ratingCounts,
    topIssues,
    topStrengths,
    perfectRate: ((ratingCounts['perfect'] || 0) / feedback.length * 100).toFixed(1) + '%'
  };
}

export default {
  // Constants
  QUICK_TAGS,
  RATINGS,
  // Settings
  getFeedbackSettings,
  updateFeedbackSettings,
  shouldShowFeedback,
  // Feedback
  createFeedbackRequest,
  submitFeedback,
  skipFeedback,
  getPendingFeedback,
  getFeedbackHistory,
  // Questions
  queueQuestion,
  getUnansweredQuestions,
  answerQuestion,
  // Insights
  getFeedbackInsights
};
