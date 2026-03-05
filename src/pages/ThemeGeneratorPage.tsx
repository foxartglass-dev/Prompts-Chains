import React, { useState, useRef, useEffect } from 'react';
import { processImageFile, IMAGE_ACCEPT } from '../services/image-upload-utils';

interface ThemeGeneratorPageProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ConfidenceResult {
  score: number;
  label: string;
  explanation?: string;
  reasons: string[];
  tips: string[];
}

interface GenerationResult {
  success: boolean;
  designDNA: any;
  screenshot?: string;
  pages?: Record<string, any>;
  pageCount?: number;
  confidence?: ConfidenceResult;
  siteName?: string;
  // Astro results
  themeName?: string;
  css?: string;
  files?: string[];
}

type InputMode = 'url' | 'image';
type OutputFormat = 'elementor' | 'astro' | 'both';
type Stage = 'input' | 'generating' | 'results';

const PROGRESS_STEPS = [
  { label: 'Screenshotting website...', duration: 8 },
  { label: 'Analyzing visual design...', duration: 15 },
  { label: 'Extracting color palette...', duration: 8 },
  { label: 'Mapping typography system...', duration: 8 },
  { label: 'Detecting component styles...', duration: 10 },
  { label: 'Building design tokens...', duration: 8 },
  { label: 'Generating page templates...', duration: 20 },
  { label: 'Assembling theme package...', duration: 12 },
  { label: 'Running quality checks...', duration: 8 },
  { label: 'Finalizing your theme...', duration: 3 },
];

const ThemeGeneratorPage: React.FC<ThemeGeneratorPageProps> = ({ isOpen, onClose }) => {
  // Input state
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [url, setUrl] = useState('');
  const [siteName, setSiteName] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState('');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('elementor');

  // Generation state
  const [stage, setStage] = useState<Stage>('input');
  const [progressStep, setProgressStep] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState('');

  // Results state
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [showConfidence, setShowConfidence] = useState(false);

  // DNA tweaker state
  const [tweakedDNA, setTweakedDNA] = useState<any>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<any>(null);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      // Don't reset results - let them come back to it
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ============================================
  // HANDLERS
  // ============================================

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const processed = await processImageFile(files[0]);
      setUploadedImage(processed.dataUrl);
      setUploadedImageName(processed.filename);
    } catch (err: any) {
      setError(`Failed to process image: ${err.message}`);
    }
  };

  const startProgressTheater = () => {
    let step = 0;
    let elapsed = 0;
    const totalDuration = PROGRESS_STEPS.reduce((s, p) => s + p.duration, 0);

    progressIntervalRef.current = setInterval(() => {
      elapsed += 0.5;
      const percent = Math.min(95, (elapsed / totalDuration) * 100);
      setProgressPercent(percent);

      // Advance step
      let accumulated = 0;
      for (let i = 0; i < PROGRESS_STEPS.length; i++) {
        accumulated += PROGRESS_STEPS[i].duration;
        if (elapsed < accumulated) {
          if (i !== step) {
            step = i;
            setProgressStep(i);
          }
          break;
        }
      }
    }, 500);
  };

  const stopProgressTheater = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgressPercent(100);
    setProgressStep(PROGRESS_STEPS.length - 1);
  };

  const handleGenerate = async () => {
    setError('');
    setStage('generating');
    setProgressStep(0);
    setProgressPercent(0);
    setShowConfidence(false);
    startProgressTheater();

    try {
      let endpoint: string;
      let body: any;

      const resolvedSiteName = siteName || (url ? new URL(url).hostname.replace(/^www\./, '').split('.')[0] : 'Brand');

      if (outputFormat === 'elementor' || outputFormat === 'both') {
        if (inputMode === 'url') {
          endpoint = '/api/theme-generator/elementor/from-url';
          body = { url, siteName: resolvedSiteName };
        } else {
          endpoint = '/api/theme-generator/elementor/from-image';
          body = { image: uploadedImage, siteName: resolvedSiteName };
        }
      } else {
        if (inputMode === 'url') {
          endpoint = '/api/theme-generator/from-url';
          body = { url, themeName: resolvedSiteName + '-theme' };
        } else {
          endpoint = '/api/theme-generator/from-image';
          body = { image: uploadedImage, themeName: resolvedSiteName + '-theme' };
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      stopProgressTheater();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      setResult(data);
      setTweakedDNA(data.designDNA ? JSON.parse(JSON.stringify(data.designDNA)) : null);

      // Brief pause before showing results (let 100% sink in)
      setTimeout(() => {
        setStage('results');
        // Show confidence AFTER the results are visible (they already committed)
        setTimeout(() => setShowConfidence(true), 800);
      }, 600);

    } catch (err: any) {
      stopProgressTheater();
      setError(err.message);
      setStage('input');
    }
  };

  const handleRegenerate = async () => {
    if (!tweakedDNA) return;
    setIsRegenerating(true);
    setError('');

    try {
      const res = await fetch('/api/theme-generator/elementor/from-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designDNA: tweakedDNA,
          siteName: result?.siteName || 'Brand'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Regeneration failed');

      setResult(prev => prev ? {
        ...prev,
        pages: data.pages,
        pageCount: data.pageCount,
        confidence: data.confidence
      } : data);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  const updateDNAColor = (path: string, value: string) => {
    if (!tweakedDNA) return;
    const updated = { ...tweakedDNA, colors: { ...tweakedDNA.colors, [path]: value } };
    setTweakedDNA(updated);
  };

  const updateDNAFont = (value: string) => {
    if (!tweakedDNA) return;
    const updated = { ...tweakedDNA, typography: { ...tweakedDNA.typography, fontFamily: value } };
    setTweakedDNA(updated);
  };

  const canGenerate = inputMode === 'url' ? url.trim().length > 0 : uploadedImage !== null;

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center overflow-y-auto">
      <div className="bg-slate-900 border border-brand-gold/30 rounded-2xl w-full max-w-4xl mx-4 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-brand-gold">Theme DNA Generator</h2>
            <p className="text-sm text-slate-400 mt-1">Paste a URL or upload a screenshot to generate a complete theme</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-2">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* ====== INPUT STAGE ====== */}
          {stage === 'input' && (
            <div className="space-y-6">
              {/* Mode toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setInputMode('url')}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition ${
                    inputMode === 'url'
                      ? 'bg-brand-gold/20 border-2 border-brand-gold text-brand-gold'
                      : 'bg-slate-800 border border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  Paste a URL
                </button>
                <button
                  onClick={() => setInputMode('image')}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition ${
                    inputMode === 'image'
                      ? 'bg-brand-gold/20 border-2 border-brand-gold text-brand-gold'
                      : 'bg-slate-800 border border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  Upload Screenshot
                </button>
              </div>

              {/* URL input */}
              {inputMode === 'url' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Website URL</label>
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-brand-gold focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-2">We'll screenshot this site and extract its complete design system</p>
                </div>
              )}

              {/* Image upload */}
              {inputMode === 'image' && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    onChange={e => handleImageUpload(e.target.files)}
                    className="hidden"
                  />
                  {!uploadedImage ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-slate-600 rounded-lg py-12 px-4 text-center hover:border-brand-gold transition group"
                    >
                      <svg className="h-12 w-12 mx-auto text-slate-500 group-hover:text-brand-gold transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-3 text-sm text-slate-400 group-hover:text-slate-300">Click to upload a screenshot or website design</p>
                      <p className="text-xs text-slate-500 mt-1">PNG, JPG, WebP, or HEIC</p>
                    </button>
                  ) : (
                    <div className="relative">
                      <img src={uploadedImage} alt="Uploaded" className="w-full rounded-lg border border-slate-600 max-h-48 object-cover" />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-slate-400">{uploadedImageName}</span>
                        <button
                          onClick={() => { setUploadedImage(null); setUploadedImageName(''); }}
                          className="text-xs text-red-400 hover:text-red-300"
                        >Remove</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Site name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Site / Brand Name (optional)</label>
                <input
                  type="text"
                  value={siteName}
                  onChange={e => setSiteName(e.target.value)}
                  placeholder="My Business"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-brand-gold focus:border-transparent"
                />
              </div>

              {/* Output format */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Output Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['elementor', 'astro', 'both'] as OutputFormat[]).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setOutputFormat(fmt)}
                      className={`py-2.5 px-3 rounded-lg font-medium text-sm transition ${
                        outputFormat === fmt
                          ? 'bg-brand-gold/20 border-2 border-brand-gold text-brand-gold'
                          : 'bg-slate-800 border border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {fmt === 'elementor' ? 'WordPress / Elementor' : fmt === 'astro' ? 'Astro' : 'Both'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">{error}</div>
              )}

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={`w-full py-4 rounded-xl font-bold text-lg transition ${
                  canGenerate
                    ? 'bg-gradient-to-r from-brand-gold to-yellow-500 text-slate-900 hover:shadow-lg hover:shadow-brand-gold/25'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                Generate Theme
              </button>
            </div>
          )}

          {/* ====== GENERATING STAGE (Progress Theater) ====== */}
          {stage === 'generating' && (
            <div className="py-12 text-center space-y-8">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">Generating Your Theme</h3>
                <p className="text-slate-400">This usually takes 1-2 minutes</p>
              </div>

              {/* Progress bar */}
              <div className="max-w-md mx-auto">
                <div className="bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-gold to-yellow-400 transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-sm text-brand-gold mt-3 font-medium">
                  {PROGRESS_STEPS[progressStep]?.label || 'Starting...'}
                </p>
                <p className="text-xs text-slate-500 mt-1">{Math.round(progressPercent)}%</p>
              </div>

              {/* Animated dots */}
              <div className="flex justify-center gap-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full bg-brand-gold/60"
                    style={{
                      animation: 'pulse 1.5s ease-in-out infinite',
                      animationDelay: `${i * 0.3}s`
                    }}
                  />
                ))}
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">{error}</div>
              )}
            </div>
          )}

          {/* ====== RESULTS STAGE ====== */}
          {stage === 'results' && result && (
            <div className="space-y-6">
              {/* Screenshot + Confidence side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Screenshot */}
                {result.screenshot && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Source Screenshot</label>
                    <img
                      src={result.screenshot}
                      alt="Source website"
                      className="w-full rounded-lg border border-slate-700"
                    />
                  </div>
                )}

                {/* Confidence Score - appears after delay */}
                <div className={`transition-all duration-500 ${showConfidence ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                  {result.confidence && (
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">DNA Match Quality</label>
                      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                        {/* Score circle */}
                        <div className="flex items-center gap-4 mb-4">
                          <div className={`w-16 h-16 rounded-full flex items-center justify-content font-bold text-xl border-4 flex-shrink-0 flex items-center justify-center ${
                            result.confidence.score >= 90 ? 'border-green-500 text-green-400' :
                            result.confidence.score >= 75 ? 'border-yellow-500 text-yellow-400' :
                            'border-orange-500 text-orange-400'
                          }`}>
                            {result.confidence.score}%
                          </div>
                          <div>
                            <p className="font-semibold text-white">{result.confidence.label}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{result.pageCount || 10} pages generated</p>
                          </div>
                        </div>

                        {/* Progress bar visual */}
                        <div className="bg-slate-700 rounded-full h-2.5 mb-4">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${
                              result.confidence.score >= 90 ? 'bg-green-500' :
                              result.confidence.score >= 75 ? 'bg-yellow-500' :
                              'bg-orange-500'
                            }`}
                            style={{ width: showConfidence ? `${result.confidence.score}%` : '0%' }}
                          />
                        </div>

                        {/* Explanation paragraph */}
                        {result.confidence.explanation && (
                          <p className="text-xs text-slate-300 leading-relaxed mb-3">{result.confidence.explanation}</p>
                        )}

                        {/* Reasons (only if not perfect) */}
                        {result.confidence.score < 95 && result.confidence.reasons.length > 0 && (
                          <div className="space-y-1.5 mb-3">
                            {result.confidence.reasons.map((r, i) => (
                              <p key={i} className="text-xs text-slate-400 flex items-start gap-2">
                                <span className="text-yellow-500 mt-0.5">*</span>
                                {r}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Tips */}
                        {result.confidence.tips.length > 0 && (
                          <div className="bg-slate-900/50 rounded-lg p-3 mt-3">
                            {result.confidence.tips.map((t, i) => (
                              <p key={i} className="text-xs text-brand-gold">{t}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Extracted color palette */}
              {tweakedDNA?.colors && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-slate-400">Extracted Colors (click to adjust)</label>
                    <button
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition ${
                        isRegenerating
                          ? 'bg-slate-700 text-slate-500'
                          : 'bg-brand-gold/20 text-brand-gold hover:bg-brand-gold/30 border border-brand-gold/50'
                      }`}
                    >
                      {isRegenerating ? 'Regenerating...' : 'Regenerate with Changes'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {[
                      { key: 'brandDefault', label: 'Brand' },
                      { key: 'brandLight', label: 'Brand Light' },
                      { key: 'brandDark', label: 'Brand Dark' },
                      { key: 'surfaceCanvas', label: 'Background' },
                      { key: 'surfaceBase', label: 'Surface' },
                      { key: 'surfaceMuted', label: 'Muted' },
                      { key: 'textPrimary', label: 'Text' },
                      { key: 'textSecondary', label: 'Text 2' },
                      { key: 'borderDefault', label: 'Border' },
                    ].filter(c => tweakedDNA.colors[c.key]).map(c => (
                      <div key={c.key} className="text-center">
                        <label className="relative cursor-pointer group">
                          <div
                            className="w-full h-12 rounded-lg border-2 border-slate-600 group-hover:border-brand-gold transition"
                            style={{ backgroundColor: tweakedDNA.colors[c.key] }}
                          />
                          <input
                            type="color"
                            value={tweakedDNA.colors[c.key]}
                            onChange={e => updateDNAColor(c.key, e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </label>
                        <p className="text-[10px] text-slate-500 mt-1">{c.label}</p>
                        <p className="text-[10px] text-slate-600 font-mono">{tweakedDNA.colors[c.key]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Font tweaker */}
              {tweakedDNA?.typography && (
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-slate-400 whitespace-nowrap">Font Family</label>
                  <input
                    type="text"
                    value={tweakedDNA.typography.fontFamily || ''}
                    onChange={e => updateDNAFont(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-brand-gold"
                  />
                </div>
              )}

              {/* Page list */}
              {result.pages && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-3">Generated Pages ({Object.keys(result.pages).length})</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {Object.entries(result.pages).map(([name, page]: [string, any]) => (
                      <div key={name} className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center hover:border-brand-gold/50 transition">
                        <p className="text-sm font-medium text-white capitalize">{name}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{page.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Astro file list */}
              {result.files && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Astro Theme Files ({result.files.length})</label>
                  <div className="bg-slate-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {result.files.map((f, i) => (
                      <p key={i} className="text-xs text-slate-400 font-mono py-0.5">{f}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Design DNA JSON (collapsible) */}
              <details className="bg-slate-800 rounded-lg border border-slate-700">
                <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-300">
                  View Raw Design DNA (JSON)
                </summary>
                <pre className="px-4 pb-4 text-xs text-slate-500 overflow-x-auto max-h-60 overflow-y-auto">
                  {JSON.stringify(result.designDNA, null, 2)}
                </pre>
              </details>

              {/* Error */}
              {error && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">{error}</div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setStage('input'); setResult(null); setShowConfidence(false); }}
                  className="flex-1 py-3 rounded-lg font-semibold text-sm bg-slate-800 border border-slate-600 text-slate-300 hover:border-slate-500 transition"
                >
                  Generate Another
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(result.designDNA, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${result.siteName || result.themeName || 'theme'}-design-dna.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex-1 py-3 rounded-lg font-semibold text-sm bg-brand-gold/20 border border-brand-gold text-brand-gold hover:bg-brand-gold/30 transition"
                >
                  Download DNA (JSON)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
};

export default ThemeGeneratorPage;
