import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TestStep {
  id: string;
  articleMode: 'draft' | 'wordpress';
  metaMode: 'draft' | 'wordpress';
  imageMode: 'off' | 'draft' | 'wordpress';
  imageSource: 'bank' | 'main-prompt' | 'guided-gpt' | 'smart-prompt';
  status: 'pending' | 'running' | 'completed' | 'failed';
}

interface TestPreset {
  id: string;
  name: string;
  steps: Omit<TestStep, 'id' | 'status'>[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRunTest: (steps: TestStep[]) => void;
  currentArticleMode: 'draft' | 'wordpress';
  currentMetaMode: 'draft' | 'wordpress';
  currentImageMode: 'off' | 'draft' | 'wordpress';
}

const STORAGE_KEY = 'test-runner-presets';

const TestRunnerPopup: React.FC<Props> = ({
  isOpen,
  onClose,
  onRunTest,
  currentArticleMode,
  currentMetaMode,
  currentImageMode
}) => {
  // Toggle states for building test steps
  const [articleMode, setArticleMode] = useState<'draft' | 'wordpress'>(currentArticleMode);
  const [metaMode, setMetaMode] = useState<'draft' | 'wordpress'>(currentMetaMode);
  const [imageMode, setImageMode] = useState<'off' | 'draft' | 'wordpress'>(currentImageMode);

  // Current test queue
  const [testQueue, setTestQueue] = useState<TestStep[]>([]);

  // Presets
  const [presets, setPresets] = useState<TestPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  // Load presets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load presets:', e);
      }
    }
  }, []);

  // Save presets to localStorage
  const savePresets = (newPresets: TestPreset[]) => {
    setPresets(newPresets);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPresets));
  };

  // Add a test step to the queue
  const addTestStep = (imageSource: 'bank' | 'main-prompt' | 'guided-gpt' | 'smart-prompt') => {
    const newStep: TestStep = {
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      articleMode,
      metaMode,
      imageMode,
      imageSource,
      status: 'pending'
    };
    setTestQueue([...testQueue, newStep]);
  };

  // Remove a step from queue
  const removeStep = (id: string) => {
    setTestQueue(testQueue.filter(s => s.id !== id));
  };

  // Clear queue
  const clearQueue = () => {
    setTestQueue([]);
  };

  // Save current queue as preset
  const saveAsPreset = () => {
    if (!presetName.trim() || testQueue.length === 0) return;

    const newPreset: TestPreset = {
      id: `preset-${Date.now()}`,
      name: presetName.trim(),
      steps: testQueue.map(({ articleMode, metaMode, imageMode, imageSource }) => ({
        articleMode, metaMode, imageMode, imageSource
      }))
    };

    savePresets([...presets, newPreset]);
    setPresetName('');
    setShowSavePreset(false);
  };

  // Load a preset
  const loadPreset = (preset: TestPreset) => {
    const steps: TestStep[] = preset.steps.map((step, index) => ({
      ...step,
      id: `test-${Date.now()}-${index}`,
      status: 'pending' as const
    }));
    setTestQueue(steps);
  };

  // Delete a preset
  const deletePreset = (id: string) => {
    savePresets(presets.filter(p => p.id !== id));
  };

  // Run the test
  const runTest = () => {
    if (testQueue.length === 0) return;
    onRunTest(testQueue);
    onClose();
  };

  // Get image source label
  const getImageSourceLabel = (source: string) => {
    switch (source) {
      case 'bank': return 'Bank';
      case 'main-prompt': return 'Main Prompt';
      case 'guided-gpt': return 'Guided GPT';
      case 'smart-prompt': return 'Smart Prompt';
      default: return source;
    }
  };

  // Get mode label with color
  const getModeClass = (mode: string) => {
    if (mode === 'wordpress' || mode === 'wp') return 'text-green-400';
    if (mode === 'draft') return 'text-yellow-400';
    return 'text-gray-400';
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
      <div className="bg-slate-900 rounded-xl border-2 border-red-500 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <h2 className="text-xl font-bold text-white">Test Mode</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-red-200 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Toggle Settings */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Step Settings</h3>
            <div className="flex flex-wrap gap-4">
              {/* Article Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Article:</span>
                <div className="flex rounded-lg overflow-hidden border border-slate-600">
                  <button
                    onClick={() => setArticleMode('draft')}
                    className={`px-3 py-1.5 text-sm font-medium transition ${
                      articleMode === 'draft'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                    }`}
                  >
                    Draft
                  </button>
                  <button
                    onClick={() => setArticleMode('wordpress')}
                    className={`px-3 py-1.5 text-sm font-medium transition ${
                      articleMode === 'wordpress'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                    }`}
                  >
                    WP
                  </button>
                </div>
              </div>

              {/* Meta Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Meta:</span>
                <div className="flex rounded-lg overflow-hidden border border-slate-600">
                  <button
                    onClick={() => setMetaMode('draft')}
                    className={`px-3 py-1.5 text-sm font-medium transition ${
                      metaMode === 'draft'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                    }`}
                  >
                    Draft
                  </button>
                  <button
                    onClick={() => setMetaMode('wordpress')}
                    className={`px-3 py-1.5 text-sm font-medium transition ${
                      metaMode === 'wordpress'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                    }`}
                  >
                    WP
                  </button>
                </div>
              </div>

              {/* Image Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Image:</span>
                <div className="flex rounded-lg overflow-hidden border border-slate-600">
                  <button
                    onClick={() => setImageMode('off')}
                    className={`px-3 py-1.5 text-sm font-medium transition ${
                      imageMode === 'off'
                        ? 'bg-gray-600 text-white'
                        : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                    }`}
                  >
                    Off
                  </button>
                  <button
                    onClick={() => setImageMode('draft')}
                    className={`px-3 py-1.5 text-sm font-medium transition ${
                      imageMode === 'draft'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                    }`}
                  >
                    Draft
                  </button>
                  <button
                    onClick={() => setImageMode('wordpress')}
                    className={`px-3 py-1.5 text-sm font-medium transition ${
                      imageMode === 'wordpress'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                    }`}
                  >
                    WP
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Image Source Buttons */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Add Test Step (Image Source)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => addTestStep('bank')}
                className="px-4 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white font-medium transition flex flex-col items-center gap-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-sm">1. Bank</span>
              </button>

              <button
                onClick={() => addTestStep('main-prompt')}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium transition flex flex-col items-center gap-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="text-sm">2. Main Prompt</span>
              </button>

              <button
                onClick={() => addTestStep('guided-gpt')}
                className="px-4 py-3 bg-orange-600 hover:bg-orange-500 rounded-lg text-white font-medium transition flex flex-col items-center gap-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-sm">3. Guided GPT</span>
              </button>

              <button
                onClick={() => addTestStep('smart-prompt')}
                className="px-4 py-3 bg-pink-600 hover:bg-pink-500 rounded-lg text-white font-medium transition flex flex-col items-center gap-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm">4. Smart Prompt</span>
              </button>
            </div>
          </div>

          {/* Test Queue */}
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-400">Test Queue ({testQueue.length} steps)</h3>
              <div className="flex gap-2">
                {testQueue.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowSavePreset(true)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs transition"
                    >
                      Save as Preset
                    </button>
                    <button
                      onClick={clearQueue}
                      className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-white text-xs transition"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            {testQueue.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                No test steps added. Use the buttons above to add steps.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {testQueue.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex items-center justify-between bg-slate-700 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold text-sm">#{index + 1}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={getModeClass(step.articleMode)}>
                          Art:{step.articleMode === 'wordpress' ? 'WP' : 'Draft'}
                        </span>
                        <span className="text-slate-500">|</span>
                        <span className={getModeClass(step.metaMode)}>
                          Meta:{step.metaMode === 'wordpress' ? 'WP' : 'Draft'}
                        </span>
                        <span className="text-slate-500">|</span>
                        <span className={getModeClass(step.imageMode)}>
                          Img:{step.imageMode === 'wordpress' ? 'WP' : step.imageMode === 'draft' ? 'Draft' : 'Off'}
                        </span>
                        <span className="text-slate-500">|</span>
                        <span className="text-cyan-400 font-medium">
                          {getImageSourceLabel(step.imageSource)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeStep(step.id)}
                      className="text-red-400 hover:text-red-300 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Save Preset Modal */}
            {showSavePreset && (
              <div className="mt-3 bg-slate-900 rounded-lg p-3 border border-blue-500">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name..."
                    className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={saveAsPreset}
                    disabled={!presetName.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 rounded text-white text-sm transition"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowSavePreset(false)}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-white text-sm transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Saved Presets */}
          {presets.length > 0 && (
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Saved Presets</h3>
              <div className="space-y-2">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between bg-slate-700 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-white font-medium">{preset.name}</span>
                      <span className="text-gray-400 text-xs">({preset.steps.length} steps)</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadPreset(preset)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-white text-xs transition"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deletePreset(preset.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-white text-xs transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-800 px-6 py-4 flex items-center justify-between border-t border-slate-700">
          <p className="text-gray-400 text-sm">
            Each step runs one article through the workflow with specified settings.
          </p>
          <button
            onClick={runTest}
            disabled={testQueue.length === 0}
            className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-white font-bold transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Run Test ({testQueue.length})
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TestRunnerPopup;
