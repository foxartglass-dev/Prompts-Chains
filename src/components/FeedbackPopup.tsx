/**
 * Human Feedback Popup Component
 *
 * Shows after image generation to collect human feedback.
 * This is the center of the learning loop - helps AI improve.
 */

import React, { useState, useEffect } from 'react';

// Types
interface GeneratedImage {
  url: string;
  prompt?: string;
  position?: string;
}

interface AIQuestion {
  id: number;
  question: string;
  context?: string;
  options: string[];
}

interface FeedbackRequest {
  id: number;
  workflow_id: number;
  avatar_id?: number;
  article_id?: number;
  run_type: string;
  generated_images: GeneratedImage[];
  prompts_used: string[];
  created_at: string;
}

interface FeedbackSettings {
  show_after_every_run: boolean;
  perfect_streak_threshold: number;
  current_perfect_streak: number;
  auto_disabled: boolean;
  never_ask_again: boolean;
}

// Constants
const RATINGS = [
  { id: 'perfect', label: 'Perfect', emoji: '👍', color: 'bg-green-500' },
  { id: 'good', label: 'Good', emoji: '👌', color: 'bg-blue-500' },
  { id: 'ok', label: 'OK', emoji: '😐', color: 'bg-yellow-500' },
  { id: 'needs_work', label: 'Needs Work', emoji: '👎', color: 'bg-orange-500' },
  { id: 'bad', label: 'Bad', emoji: '❌', color: 'bg-red-500' },
];

const QUICK_TAGS = {
  positive: [
    { id: 'perfect', label: '✨ Perfect' },
    { id: 'good_action', label: '👍 Good action' },
    { id: 'good_lighting', label: '💡 Good lighting' },
    { id: 'realistic', label: '📷 Realistic' },
  ],
  negative: [
    { id: 'wrong_uniform', label: '👕 Wrong uniform' },
    { id: 'wrong_setting', label: '🏢 Wrong setting' },
    { id: 'too_posed', label: '🧍 Too posed' },
    { id: 'ai_artifacts', label: '🤖 AI artifacts' },
    { id: 'bad_hands', label: '🖐️ Bad hands' },
    { id: 'bad_logo', label: '🏷️ Bad logo' },
  ],
  direction: [
    { id: 'more_action', label: '⬆️ More action' },
    { id: 'different_angle', label: '📐 Different angle' },
    { id: 'closer_shot', label: '🔍 Closer' },
    { id: 'wider_shot', label: '🔭 Wider' },
  ],
};

interface FeedbackPopupProps {
  isOpen: boolean;
  onClose: () => void;
  feedbackRequest: FeedbackRequest | null;
  pendingQuestions?: AIQuestion[];
  articleTitle?: string;
  avatarName?: string;
  onSubmit: (feedback: {
    rating: string;
    quick_tags: string[];
    detailed_feedback: string;
    questions_answered: { questionId: number; answer: string }[];
  }) => void;
  onSkip: () => void;
  onNeverAskAgain: () => void;
  settings?: FeedbackSettings;
}

export default function FeedbackPopup({
  isOpen,
  onClose,
  feedbackRequest,
  pendingQuestions = [],
  articleTitle,
  avatarName,
  onSubmit,
  onSkip,
  onNeverAskAgain,
  settings,
}: FeedbackPopupProps) {
  const [selectedRating, setSelectedRating] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [detailedFeedback, setDetailedFeedback] = useState('');
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, string>>({});
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [promptPanelWidth, setPromptPanelWidth] = useState<'narrow' | 'normal' | 'wide'>('normal');

  // Reset state when popup opens with new request
  useEffect(() => {
    if (isOpen && feedbackRequest) {
      setSelectedRating(null);
      setSelectedTags([]);
      setDetailedFeedback('');
      setQuestionAnswers({});
      setExpandedImage(null);
    }
  }, [isOpen, feedbackRequest?.id]);

  if (!isOpen || !feedbackRequest) return null;

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = () => {
    if (!selectedRating) return;

    onSubmit({
      rating: selectedRating,
      quick_tags: selectedTags,
      detailed_feedback: detailedFeedback,
      questions_answered: Object.entries(questionAnswers).map(([qId, answer]) => ({
        questionId: parseInt(qId),
        answer
      }))
    });
  };

  const images = feedbackRequest.generated_images || [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-cyan-500/30"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  🎯 How did this run go?
                </h2>
                <p className="text-cyan-100 text-sm mt-1">
                  Your feedback helps the AI improve
                </p>
              </div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-white/70 hover:text-white p-2"
                title="Settings"
              >
                ⚙️
              </button>
            </div>

            {/* Context info */}
            <div className="flex gap-4 mt-3 text-sm text-cyan-100">
              {articleTitle && (
                <span className="bg-white/10 px-2 py-1 rounded">
                  📄 {articleTitle}
                </span>
              )}
              {avatarName && (
                <span className="bg-white/10 px-2 py-1 rounded">
                  👤 {avatarName}
                </span>
              )}
              <span className="bg-white/10 px-2 py-1 rounded">
                🖼️ {images.length} images
              </span>
            </div>
          </div>

          {/* Settings Panel (collapsible) */}
          {showSettings && settings && (
            <div className="bg-slate-700 px-6 py-3 border-b border-slate-600">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-slate-300">
                    Perfect streak: <strong className="text-green-400">{settings.current_perfect_streak}</strong>
                    /{settings.perfect_streak_threshold}
                  </span>
                  {settings.current_perfect_streak > 0 && (
                    <span className="text-green-400">
                      🔥 {settings.current_perfect_streak} in a row!
                    </span>
                  )}
                </div>
                <button
                  onClick={onNeverAskAgain}
                  className="text-xs text-slate-400 hover:text-red-400"
                >
                  Never ask again
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {/* Generated Images */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-400">Generated Images:</h3>
                <button
                  onClick={() => setShowPrompts(!showPrompts)}
                  className={`text-xs px-3 py-1 rounded-lg transition ${
                    showPrompts
                      ? 'bg-purple-500 text-white'
                      : 'bg-purple-900/50 text-purple-300 hover:bg-purple-900'
                  }`}
                >
                  📝 {showPrompts ? 'Hide' : 'View'} Prompts
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative group cursor-pointer"
                    onClick={() => setExpandedImage(img.url)}
                  >
                    <img
                      src={img.url}
                      alt={`Generated ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-slate-600 group-hover:border-cyan-500 transition-colors"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 text-white text-xl">🔍</span>
                    </div>
                    {img.position && (
                      <span className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                        {img.position}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Prompts Panel (Floating, Resizable) */}
            {showPrompts && feedbackRequest.prompts_used && feedbackRequest.prompts_used.length > 0 && (
              <div className={`mb-6 bg-purple-900/30 border border-purple-500/50 rounded-lg overflow-hidden ${
                promptPanelWidth === 'narrow' ? 'max-w-md' :
                promptPanelWidth === 'wide' ? 'max-w-none' : 'max-w-2xl'
              }`}>
                <div className="flex items-center justify-between px-3 py-2 bg-purple-900/50 border-b border-purple-500/30">
                  <span className="text-sm font-medium text-purple-300">📝 Prompts Used ({feedbackRequest.prompts_used.length})</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPromptPanelWidth('narrow')}
                      className={`px-2 py-0.5 rounded text-xs ${promptPanelWidth === 'narrow' ? 'bg-purple-500 text-white' : 'text-purple-400 hover:bg-purple-800'}`}
                    >
                      Narrow
                    </button>
                    <button
                      onClick={() => setPromptPanelWidth('normal')}
                      className={`px-2 py-0.5 rounded text-xs ${promptPanelWidth === 'normal' ? 'bg-purple-500 text-white' : 'text-purple-400 hover:bg-purple-800'}`}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => setPromptPanelWidth('wide')}
                      className={`px-2 py-0.5 rounded text-xs ${promptPanelWidth === 'wide' ? 'bg-purple-500 text-white' : 'text-purple-400 hover:bg-purple-800'}`}
                    >
                      Wide
                    </button>
                    <button
                      onClick={() => setShowPrompts(false)}
                      className="ml-2 text-purple-400 hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="p-3 space-y-3 max-h-64 overflow-y-auto">
                  {feedbackRequest.prompts_used.map((prompt, idx) => (
                    <div key={idx} className="bg-slate-900/50 rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-purple-400 font-medium">Prompt #{idx + 1}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(prompt)}
                          className="text-xs text-purple-400 hover:text-purple-300"
                        >
                          📋 Copy
                        </button>
                      </div>
                      <p className="text-xs text-white font-mono whitespace-pre-wrap leading-relaxed select-all">
                        {prompt}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-2 bg-purple-900/30 border-t border-purple-500/30 text-xs text-purple-400">
                  💡 Tip: Look for patterns in prompts that produced good vs bad results
                </div>
              </div>
            )}

            {/* Rating */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Quick Rating:</h3>
              <div className="flex gap-2 flex-wrap">
                {RATINGS.map(rating => (
                  <button
                    key={rating.id}
                    onClick={() => setSelectedRating(rating.id)}
                    className={`px-4 py-2 rounded-lg text-white font-medium transition-all ${
                      selectedRating === rating.id
                        ? `${rating.color} ring-2 ring-white scale-105`
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    <span className="mr-1">{rating.emoji}</span>
                    {rating.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Tags */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Quick Tags (optional):</h3>

              {/* Positive */}
              <div className="mb-2">
                <span className="text-xs text-green-400 mb-1 block">What worked:</span>
                <div className="flex gap-1 flex-wrap">
                  {QUICK_TAGS.positive.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        selectedTags.includes(tag.id)
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Negative */}
              <div className="mb-2">
                <span className="text-xs text-red-400 mb-1 block">Issues:</span>
                <div className="flex gap-1 flex-wrap">
                  {QUICK_TAGS.negative.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        selectedTags.includes(tag.id)
                          ? 'bg-red-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Direction */}
              <div>
                <span className="text-xs text-blue-400 mb-1 block">Adjustments:</span>
                <div className="flex gap-1 flex-wrap">
                  {QUICK_TAGS.direction.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        selectedTags.includes(tag.id)
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Questions */}
            {pendingQuestions.length > 0 && (
              <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <h3 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                  ❓ AI is unsure about:
                </h3>
                {pendingQuestions.map(q => (
                  <div key={q.id} className="mb-3 last:mb-0">
                    <p className="text-white text-sm mb-2">{q.question}</p>
                    {q.context && (
                      <p className="text-slate-400 text-xs mb-2">{q.context}</p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {q.options.length > 0 ? (
                        q.options.map(option => (
                          <button
                            key={option}
                            onClick={() => setQuestionAnswers(prev => ({ ...prev, [q.id]: option }))}
                            className={`px-3 py-1 text-xs rounded ${
                              questionAnswers[q.id] === option
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {option}
                          </button>
                        ))
                      ) : (
                        <input
                          type="text"
                          value={questionAnswers[q.id] || ''}
                          onChange={e => setQuestionAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder="Type your answer..."
                          className="flex-1 px-3 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-white"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Detailed Feedback */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-400 mb-2">
                Detailed Feedback (optional):
              </h3>
              <textarea
                value={detailedFeedback}
                onChange={e => setDetailedFeedback(e.target.value)}
                placeholder="Any specific notes? What should change next time?"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm resize-none"
                rows={3}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-700/50 px-6 py-4 flex items-center justify-between border-t border-slate-600">
            <button
              onClick={onSkip}
              className="text-slate-400 hover:text-white text-sm"
            >
              Skip this time
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedRating}
                className={`px-6 py-2 rounded-lg text-white font-medium text-sm ${
                  selectedRating
                    ? 'bg-cyan-500 hover:bg-cyan-600'
                    : 'bg-slate-600 cursor-not-allowed'
                }`}
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Image Modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Expanded view"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl hover:text-cyan-400"
            onClick={() => setExpandedImage(null)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
