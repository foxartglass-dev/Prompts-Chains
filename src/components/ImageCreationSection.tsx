/**
 * ImageCreationSection Component
 * "7. Image Creation" section for the main dashboard
 *
 * Features:
 * - Reference images for style consistency (collapsible)
 * - Audience avatars with main prompts + variations
 * - Chat interface with GPT-4o for prompt refinement
 * - Main prompt + variation buttons system
 * - Batch Generate section (collapsible)
 * - Image Bank section (separate, with sorting/filtering)
 * - Used/Archive section with page links
 * - Page integration controls (live vs bank)
 * - Processing Log integration
 */

import React, { useState, useEffect, useRef } from 'react';

// Types
interface ReferenceImage {
  url: string;
  filename?: string;
  tags?: string[];
}

interface Variation {
  id: string;
  name: string;
  prompt: string;
  orientation: 'vertical' | 'landscape' | 'both';
}

interface AudienceAvatar {
  id: number;
  name: string;
  mainPrompt: string;
  variations: Variation[];
  referenceImages?: ReferenceImage[];
}

interface BankImage {
  id: string;
  url: string;
  variation: string;
  variationId: string;
  orientation: string;
  prompt: string;
  createdAt: string;
  used?: boolean;
  usedOn?: string; // Page URL where image was used
  usedAt?: string; // Timestamp when used
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  timestamp: string;
}

interface ImageCreationSettings {
  enabled: boolean;
  prompt_assistant_model: string;
  reference_images: ReferenceImage[];
  audience_avatars: AudienceAvatar[];
  image_bank: BankImage[];
  chat_history: ChatMessage[];
  integration_mode: 'live' | 'bank';
  fallback_to_live: boolean;
  image_order: string[];
}

// Log status enum matching App.tsx
enum LogStatus {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  WORKING = 'WORKING',
}

interface Props {
  workflowId?: number;
  onSettingsChange?: (settings: ImageCreationSettings) => void;
  showNotification: (message: string, type: 'success' | 'info' | 'error') => void;
  addLog?: (message: string, status: LogStatus) => void;
}

const DEFAULT_SETTINGS: ImageCreationSettings = {
  enabled: false,
  prompt_assistant_model: 'gpt-4o',
  reference_images: [],
  audience_avatars: [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }],
  image_bank: [],
  chat_history: [],
  integration_mode: 'bank',
  fallback_to_live: true,
  image_order: []
};

const AVAILABLE_MODELS = [
  { id: 'gpt-5.2-2025-12-11', name: 'GPT-5.2', provider: 'openai' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' }
];

const ImageCreationSection: React.FC<Props> = ({ workflowId, onSettingsChange, showNotification, addLog }) => {
  // State
  const [settings, setSettings] = useState<ImageCreationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Collapsible sections
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isBankOpen, setIsBankOpen] = useState(true);
  const [isUsedOpen, setIsUsedOpen] = useState(false);

  // Active avatar
  const [activeAvatarId, setActiveAvatarId] = useState<number>(1);
  const [activeVariationId, setActiveVariationId] = useState<string | null>(null);

  // Chat
  const [chatInput, setChatInput] = useState('');
  const [chatImages, setChatImages] = useState<string[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Image generation
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [batchQuantity, setBatchQuantity] = useState(1);
  const [selectedVariations, setSelectedVariations] = useState<Set<string>>(new Set());

  // Bank filtering
  const [bankFilter, setBankFilter] = useState<string>('all'); // 'all' or variation name
  const [bankSort, setBankSort] = useState<'newest' | 'oldest' | 'variation'>('newest');

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Log to Processing Log
  const log = (message: string, status: LogStatus) => {
    if (addLog) {
      addLog(`[Image Creation] ${message}`, status);
    }
    console.log(`[Image Creation] ${status}: ${message}`);
  };

  // Load settings when workflowId changes
  useEffect(() => {
    if (workflowId) {
      loadSettings();
    }
  }, [workflowId]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [settings.chat_history]);

  const loadSettings = async () => {
    if (!workflowId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/image-creation/settings/${workflowId}`);
      const data = await res.json();
      if (data.success) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        if (data.settings.audience_avatars?.length > 0) {
          setActiveAvatarId(data.settings.audience_avatars[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load image creation settings:', error);
    }
    setLoading(false);
  };

  const saveSettings = async (newSettings: ImageCreationSettings) => {
    if (!workflowId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/image-creation/settings/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      const data = await res.json();
      if (data.success) {
        onSettingsChange?.(newSettings);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
    setSaving(false);
  };

  const updateSettings = (updates: Partial<ImageCreationSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // Get active avatar
  const activeAvatar = settings.audience_avatars.find(a => a.id === activeAvatarId) || settings.audience_avatars[0];

  // Get unique variations for filtering
  const uniqueVariations = [...new Set(settings.image_bank.map(img => img.variation))];

  // Filter and sort bank images
  const getFilteredBankImages = (includeUsed: boolean) => {
    let images = settings.image_bank.filter(img => includeUsed ? img.used : !img.used);

    // Apply variation filter
    if (bankFilter !== 'all') {
      images = images.filter(img => img.variation === bankFilter);
    }

    // Apply sort
    switch (bankSort) {
      case 'newest':
        images.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        images.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'variation':
        images.sort((a, b) => a.variation.localeCompare(b.variation));
        break;
    }

    return images;
  };

  const availableImages = getFilteredBankImages(false);
  const usedImages = getFilteredBankImages(true);

  // Reference Images Handlers
  const handleUploadReference = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: ReferenceImage[] = [];
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newImages.push({ url: dataUrl, filename: file.name });
    }

    updateSettings({
      reference_images: [...settings.reference_images, ...newImages]
    });
    showNotification(`Added ${newImages.length} reference image(s)`, 'success');
  };

  const handleAddReferenceUrl = (url: string) => {
    if (!url.trim()) return;
    updateSettings({
      reference_images: [...settings.reference_images, { url: url.trim() }]
    });
  };

  const handleRemoveReference = (index: number) => {
    const newImages = settings.reference_images.filter((_, i) => i !== index);
    updateSettings({ reference_images: newImages });
  };

  // Audience Avatar Handlers
  const handleAddAvatar = () => {
    const newId = Math.max(...settings.audience_avatars.map(a => a.id), 0) + 1;
    const newAvatar: AudienceAvatar = {
      id: newId,
      name: `Avatar ${newId}`,
      mainPrompt: '',
      variations: []
    };
    updateSettings({
      audience_avatars: [...settings.audience_avatars, newAvatar]
    });
    setActiveAvatarId(newId);
  };

  const handleRemoveAvatar = (id: number) => {
    if (settings.audience_avatars.length <= 1) {
      showNotification('Must have at least one avatar', 'error');
      return;
    }
    const newAvatars = settings.audience_avatars.filter(a => a.id !== id);
    updateSettings({ audience_avatars: newAvatars });
    if (activeAvatarId === id) {
      setActiveAvatarId(newAvatars[0].id);
    }
  };

  const handleUpdateAvatar = (id: number, updates: Partial<AudienceAvatar>) => {
    const newAvatars = settings.audience_avatars.map(a =>
      a.id === id ? { ...a, ...updates } : a
    );
    updateSettings({ audience_avatars: newAvatars });
  };

  // Variation Handlers
  const handleAddVariation = () => {
    if (!activeAvatar) return;
    const newVariation: Variation = {
      id: `v${Date.now()}`,
      name: `V${activeAvatar.variations.length + 1}`,
      prompt: '',
      orientation: 'landscape'
    };
    handleUpdateAvatar(activeAvatar.id, {
      variations: [...activeAvatar.variations, newVariation]
    });
    setActiveVariationId(newVariation.id);
  };

  const handleUpdateVariation = (variationId: string, updates: Partial<Variation>) => {
    if (!activeAvatar) return;
    const newVariations = activeAvatar.variations.map(v =>
      v.id === variationId ? { ...v, ...updates } : v
    );
    handleUpdateAvatar(activeAvatar.id, { variations: newVariations });
  };

  const handleRemoveVariation = (variationId: string) => {
    if (!activeAvatar) return;
    const newVariations = activeAvatar.variations.filter(v => v.id !== variationId);
    handleUpdateAvatar(activeAvatar.id, { variations: newVariations });
    if (activeVariationId === variationId) {
      setActiveVariationId(newVariations[0]?.id || null);
    }
  };

  // Chat Handlers
  const handleSendChat = async () => {
    if (!chatInput.trim() && chatImages.length === 0) return;

    const newMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      images: chatImages.length > 0 ? chatImages : undefined,
      timestamp: new Date().toISOString()
    };

    const newHistory = [...settings.chat_history, newMessage];
    updateSettings({ chat_history: newHistory });
    setChatInput('');
    setChatImages([]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/image-creation/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map(m => ({
            role: m.role,
            content: m.content,
            images: m.images
          })),
          model: settings.prompt_assistant_model
        })
      });

      const data = await res.json();
      if (data.success) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.message.content,
          timestamp: new Date().toISOString()
        };
        updateSettings({ chat_history: [...newHistory, assistantMessage] });
      } else {
        showNotification(data.error || 'Chat failed', 'error');
      }
    } catch (error) {
      console.error('Chat error:', error);
      showNotification('Failed to send message', 'error');
    }

    setChatLoading(false);
  };

  const handleChatImageUpload = async (files: FileList | null) => {
    if (!files) return;
    const newImages: string[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newImages.push(dataUrl);
    }
    setChatImages([...chatImages, ...newImages].slice(0, 4));
  };

  // Image Generation - Single
  const handleGenerateSingle = async (prompt: string, orientation: 'vertical' | 'landscape' | 'both') => {
    setGenerating(true);
    setGenerationProgress('Starting image generation...');
    log('Starting single image generation...', LogStatus.WORKING);

    try {
      const size = orientation === 'vertical' ? '1024x1792' :
                   orientation === 'landscape' ? '1792x1024' : '1024x1024';

      const fullPrompt = activeAvatar?.mainPrompt
        ? `${activeAvatar.mainPrompt}\n\n${prompt}`
        : prompt;

      setGenerationProgress('Generating image with AI...');
      log(`Generating ${orientation} image...`, LogStatus.WORKING);

      const res = await fetch('/api/image-creation/generate-with-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          referenceImageUrls: settings.reference_images.map(i => i.url).filter(url => !url.startsWith('data:')),
          size
        })
      });

      const data = await res.json();

      if (data.success && data.image?.url) {
        // Add to bank
        const newBankImage: BankImage = {
          id: `img-${Date.now()}`,
          url: data.image.url,
          variation: activeVariationId ? (activeAvatar?.variations.find(v => v.id === activeVariationId)?.name || 'single') : 'single',
          variationId: activeVariationId || '',
          orientation,
          prompt: fullPrompt,
          createdAt: new Date().toISOString(),
          used: false
        };

        updateSettings({
          image_bank: [...settings.image_bank, newBankImage]
        });

        setGenerationProgress('');
        log('Image generated successfully!', LogStatus.SUCCESS);
        showNotification('Image generated and added to bank!', 'success');
      } else {
        const errorMsg = data.error || 'Generation failed - no image returned';
        setGenerationProgress('');
        log(`Generation failed: ${errorMsg}`, LogStatus.ERROR);
        showNotification(errorMsg, 'error');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to generate image';
      setGenerationProgress('');
      log(`Generation error: ${errorMsg}`, LogStatus.ERROR);
      showNotification(errorMsg, 'error');
    }

    setGenerating(false);
  };

  // Image Generation - Batch
  const handleBatchGenerate = async () => {
    if (!activeAvatar || selectedVariations.size === 0) {
      showNotification('Select variations to generate', 'error');
      return;
    }

    setGenerating(true);
    const variationsToGenerate = activeAvatar.variations.filter(v => selectedVariations.has(v.id));
    const totalImages = variationsToGenerate.length * batchQuantity;

    setGenerationProgress(`Starting batch generation of ${totalImages} images...`);
    log(`Starting batch generation: ${totalImages} images (${variationsToGenerate.length} variations x ${batchQuantity} each)`, LogStatus.WORKING);

    try {
      const res = await fetch('/api/image-creation/batch-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainPrompt: activeAvatar.mainPrompt,
          variations: variationsToGenerate.map(v => ({
            id: v.id,
            name: v.name,
            prompt: v.prompt,
            orientation: v.orientation
          })),
          referenceImageUrls: settings.reference_images.map(i => i.url).filter(url => !url.startsWith('data:')),
          quantity: batchQuantity
        })
      });

      const data = await res.json();

      if (data.success) {
        const successCount = data.images?.length || 0;
        const failCount = data.errors?.length || 0;

        if (successCount > 0) {
          // Add to bank
          const newBankImages: BankImage[] = data.images.map((img: any) => ({
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url: img.url,
            variation: img.variation,
            variationId: img.variationId,
            orientation: img.orientation,
            prompt: img.prompt,
            createdAt: new Date().toISOString(),
            used: false
          }));

          updateSettings({
            image_bank: [...settings.image_bank, ...newBankImages]
          });

          setGenerationProgress('');
          log(`Batch complete: ${successCount} generated, ${failCount} failed`, successCount > 0 ? LogStatus.SUCCESS : LogStatus.ERROR);
          showNotification(`Generated ${successCount} images${failCount > 0 ? ` (${failCount} failed)` : ''}!`, 'success');
        } else {
          setGenerationProgress('');
          log('Batch generation failed - no images returned', LogStatus.ERROR);
          showNotification('Generation failed - no images returned', 'error');
        }
      } else {
        const errorMsg = data.error || 'Batch generation failed';
        setGenerationProgress('');
        log(`Batch failed: ${errorMsg}`, LogStatus.ERROR);
        showNotification(errorMsg, 'error');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to generate batch';
      setGenerationProgress('');
      log(`Batch error: ${errorMsg}`, LogStatus.ERROR);
      showNotification(errorMsg, 'error');
    }

    setGenerating(false);
  };

  // Bank Management
  const handleRemoveFromBank = (imageId: string) => {
    const newBank = settings.image_bank.filter(i => i.id !== imageId);
    updateSettings({ image_bank: newBank });
    showNotification('Image removed from bank', 'info');
  };

  const handleMarkAsUsed = (imageId: string, pageUrl: string) => {
    const newBank = settings.image_bank.map(img =>
      img.id === imageId ? { ...img, used: true, usedOn: pageUrl, usedAt: new Date().toISOString() } : img
    );
    updateSettings({ image_bank: newBank });
    log(`Image marked as used on: ${pageUrl}`, LogStatus.INFO);
  };

  const handleRestoreFromUsed = (imageId: string) => {
    const newBank = settings.image_bank.map(img =>
      img.id === imageId ? { ...img, used: false, usedOn: undefined, usedAt: undefined } : img
    );
    updateSettings({ image_bank: newBank });
    showNotification('Image restored to available', 'info');
  };

  // Toggle variation selection for batch
  const toggleVariationSelection = (id: string) => {
    const newSelected = new Set(selectedVariations);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedVariations(newSelected);
  };

  const selectAllVariations = () => {
    if (!activeAvatar) return;
    setSelectedVariations(new Set(activeAvatar.variations.map(v => v.id)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-cyan"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Enable Toggle + Model Selector */}
      <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-brand-gold/50">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
            className="w-5 h-5 rounded border-2 border-brand-gold text-brand-gold focus:ring-brand-gold bg-slate-900"
          />
          <span className="text-brand-gold font-semibold">Enable Image Creation</span>
        </label>
        <div className="flex items-center gap-2">
          <label className="text-sm text-brand-gold/70">Prompt Assistant:</label>
          <select
            value={settings.prompt_assistant_model}
            onChange={(e) => updateSettings({ prompt_assistant_model: e.target.value })}
            className="bg-slate-900 border border-brand-gold/50 rounded px-2 py-1 text-white text-sm"
          >
            {AVAILABLE_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Generation Progress */}
      {generating && generationProgress && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-yellow-500"></div>
          <span className="text-yellow-400 text-sm">{generationProgress}</span>
        </div>
      )}

      {settings.enabled && (
        <>
          {/* Reference Images (Collapsible) */}
          <div className="bg-slate-900 rounded-lg border border-brand-gold/50 overflow-hidden">
            <button
              onClick={() => setIsReferenceOpen(!isReferenceOpen)}
              className="w-full flex items-center justify-between p-3 text-brand-gold hover:bg-slate-800/50 transition"
            >
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Reference Images ({settings.reference_images.length})
              </span>
              <svg className={`w-5 h-5 transition-transform ${isReferenceOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isReferenceOpen && (
              <div className="p-4 border-t border-brand-gold/30 space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-cyan hover:bg-brand-cyan-dark rounded text-slate-900 font-medium text-sm transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload Images
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleUploadReference(e.target.files)}
                    className="hidden"
                  />
                  <input
                    type="text"
                    placeholder="Or paste image URL..."
                    className="flex-1 bg-slate-900 border border-brand-gold/50 rounded px-3 py-2 text-white text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddReferenceUrl((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                </div>

                {settings.reference_images.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {settings.reference_images.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={img.url}
                          alt={img.filename || `Reference ${idx + 1}`}
                          className="w-full h-24 object-cover rounded border border-brand-gold/30"
                        />
                        <button
                          onClick={() => handleRemoveReference(idx)}
                          className="absolute top-1 right-1 p-1 bg-red-600/80 rounded opacity-0 group-hover:opacity-100 transition"
                        >
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-brand-gold/50 py-4">No reference images yet. Upload images or add URLs to build your Style DNA.</p>
                )}
              </div>
            )}
          </div>

          {/* Audience Avatars */}
          <div className="bg-slate-900 p-4 rounded-lg border border-brand-gold/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-brand-gold font-semibold">Audience Avatars</h3>
              <button
                onClick={handleAddAvatar}
                className="text-brand-cyan hover:text-brand-cyan-light text-sm font-medium transition"
              >
                + Add Avatar
              </button>
            </div>

            {/* Avatar Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {settings.audience_avatars.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => setActiveAvatarId(avatar.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                    activeAvatarId === avatar.id
                      ? 'bg-brand-gold text-slate-900'
                      : 'bg-slate-800 text-brand-gold hover:bg-slate-700'
                  }`}
                >
                  <span>{avatar.name}</span>
                  {settings.audience_avatars.length > 1 && (
                    <span
                      onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(avatar.id); }}
                      className="hover:text-red-500 cursor-pointer"
                    >
                      &times;
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Active Avatar Editor */}
            {activeAvatar && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-brand-gold/70 mb-1">Avatar Name</label>
                  <input
                    type="text"
                    value={activeAvatar.name}
                    onChange={(e) => handleUpdateAvatar(activeAvatar.id, { name: e.target.value })}
                    className="w-full bg-slate-900 border border-brand-gold/50 rounded px-3 py-2 text-white text-sm"
                    placeholder="e.g., House Cleaning, Janitorial, Construction"
                  />
                </div>

                <div>
                  <label className="block text-xs text-brand-gold/70 mb-1">Main Prompt (base for all variations)</label>
                  <textarea
                    value={activeAvatar.mainPrompt}
                    onChange={(e) => handleUpdateAvatar(activeAvatar.id, { mainPrompt: e.target.value })}
                    rows={3}
                    className="w-full bg-slate-900 border border-brand-gold/50 rounded px-3 py-2 text-white text-sm font-mono resize-y"
                    placeholder="Professional cleaning photo, bright natural lighting, modern residential setting..."
                  />
                </div>

                {/* Variations */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs text-brand-gold/70">Variations</label>
                    <button
                      onClick={handleAddVariation}
                      className="text-brand-cyan hover:text-brand-cyan-light text-xs font-medium transition"
                    >
                      + Add Variation
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {activeAvatar.variations.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setActiveVariationId(activeVariationId === v.id ? null : v.id)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                          activeVariationId === v.id
                            ? 'bg-brand-cyan text-slate-900'
                            : 'bg-slate-800 text-brand-gold hover:bg-slate-700'
                        }`}
                      >
                        {v.name} ({v.orientation === 'vertical' ? 'V' : v.orientation === 'landscape' ? 'L' : 'B'})
                      </button>
                    ))}
                  </div>

                  {activeVariationId && (() => {
                    const variation = activeAvatar.variations.find(v => v.id === activeVariationId);
                    if (!variation) return null;
                    return (
                      <div className="bg-slate-800 p-3 rounded-lg space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={variation.name}
                            onChange={(e) => handleUpdateVariation(variation.id, { name: e.target.value })}
                            className="flex-1 bg-slate-900 border border-brand-gold/50 rounded px-2 py-1.5 text-white text-sm"
                            placeholder="Variation name (e.g., sink, stove, bathroom)"
                          />
                          <select
                            value={variation.orientation}
                            onChange={(e) => handleUpdateVariation(variation.id, { orientation: e.target.value as any })}
                            className="bg-slate-900 border border-brand-gold/50 rounded px-2 py-1.5 text-white text-sm"
                          >
                            <option value="landscape">Landscape</option>
                            <option value="vertical">Vertical</option>
                            <option value="both">Both</option>
                          </select>
                          <button
                            onClick={() => handleRemoveVariation(variation.id)}
                            className="p-1.5 bg-red-600/50 hover:bg-red-600 rounded text-white transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <textarea
                          value={variation.prompt}
                          onChange={(e) => handleUpdateVariation(variation.id, { prompt: e.target.value })}
                          rows={2}
                          className="w-full bg-slate-900 border border-brand-gold/50 rounded px-3 py-2 text-white text-sm font-mono resize-y"
                          placeholder="Variation-specific prompt (e.g., person cleaning kitchen sink with microfiber cloth)"
                        />
                        <button
                          onClick={() => handleGenerateSingle(variation.prompt, variation.orientation === 'both' ? 'landscape' : variation.orientation)}
                          disabled={generating}
                          className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 rounded text-white text-sm font-medium transition"
                        >
                          {generating ? 'Generating...' : 'Generate This Variation'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Chat Interface (Collapsible) */}
          <div className="bg-slate-900 rounded-lg border border-brand-gold/50 overflow-hidden">
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="w-full flex items-center justify-between p-3 text-brand-gold hover:bg-slate-800/50 transition"
            >
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Image Prompt Chat
              </span>
              <svg className={`w-5 h-5 transition-transform ${isChatOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isChatOpen && (
              <div className="border-t border-brand-gold/30">
                <div
                  ref={chatContainerRef}
                  className="h-64 overflow-y-auto p-4 space-y-3"
                >
                  {settings.chat_history.length === 0 ? (
                    <p className="text-center text-brand-gold/50 py-8">
                      Chat with the AI to help craft your image prompts. You can paste images for analysis.
                    </p>
                  ) : (
                    settings.chat_history.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            msg.role === 'user'
                              ? 'bg-brand-cyan/20 border border-brand-cyan/50'
                              : 'bg-slate-800 border border-brand-gold/30'
                          }`}
                        >
                          {msg.images && msg.images.length > 0 && (
                            <div className="flex gap-2 mb-2">
                              {msg.images.map((img, i) => (
                                <img key={i} src={img} alt="" className="w-16 h-16 object-cover rounded" />
                              ))}
                            </div>
                          )}
                          <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800 border border-brand-gold/30 rounded-lg p-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-brand-gold rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {chatImages.length > 0 && (
                  <div className="px-4 py-2 border-t border-brand-gold/30 flex gap-2">
                    {chatImages.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img src={img} alt="" className="w-12 h-12 object-cover rounded" />
                        <button
                          onClick={() => setChatImages(chatImages.filter((_, i) => i !== idx))}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-xs"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-4 border-t border-brand-gold/30 flex gap-2">
                  <button
                    onClick={() => chatFileInputRef.current?.click()}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-brand-gold transition"
                    title="Attach Image"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  <input
                    ref={chatFileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleChatImageUpload(e.target.files)}
                    className="hidden"
                  />
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                    placeholder="Ask about image prompts, paste images for analysis..."
                    className="flex-1 bg-slate-900 border border-brand-gold/50 rounded px-3 py-2 text-white text-sm"
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={chatLoading || (!chatInput.trim() && chatImages.length === 0)}
                    className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan-dark disabled:bg-slate-600 rounded text-slate-900 font-medium text-sm transition"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Batch Generate (Collapsible) */}
          <div className="bg-slate-900 rounded-lg border border-green-500/50 overflow-hidden">
            <button
              onClick={() => setIsBatchOpen(!isBatchOpen)}
              className="w-full flex items-center justify-between p-3 text-green-400 hover:bg-slate-800/50 transition"
            >
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Batch Generate Images
              </span>
              <svg className={`w-5 h-5 transition-transform ${isBatchOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isBatchOpen && (
              <div className="p-4 border-t border-green-500/30 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-brand-gold/70">Quantity per variation:</label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={batchQuantity}
                    onChange={(e) => setBatchQuantity(parseInt(e.target.value))}
                    className="flex-1 accent-green-500"
                  />
                  <span className="text-green-400 font-bold w-8 text-center">{batchQuantity}</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-brand-gold/70">Select Variations:</label>
                    <button
                      onClick={selectAllVariations}
                      className="text-xs text-brand-cyan hover:text-brand-cyan-light"
                    >
                      Select All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeAvatar?.variations.map((v) => (
                      <label
                        key={v.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs cursor-pointer transition ${
                          selectedVariations.has(v.id)
                            ? 'bg-green-500 text-slate-900'
                            : 'bg-slate-800 text-brand-gold border border-brand-gold/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedVariations.has(v.id)}
                          onChange={() => toggleVariationSelection(v.id)}
                          className="hidden"
                        />
                        {v.name}
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleBatchGenerate}
                  disabled={generating || selectedVariations.size === 0}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 rounded text-white font-bold transition"
                >
                  {generating ? 'Generating...' : `Generate ${selectedVariations.size * batchQuantity} Images`}
                </button>
              </div>
            )}
          </div>

          {/* Image Bank (Collapsible) - SEPARATE from batch generate */}
          <div className="bg-slate-900 rounded-lg border border-brand-cyan/50 overflow-hidden">
            <button
              onClick={() => setIsBankOpen(!isBankOpen)}
              className="w-full flex items-center justify-between p-3 text-brand-cyan hover:bg-slate-800/50 transition"
            >
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Image Bank ({availableImages.length} available)
              </span>
              <svg className={`w-5 h-5 transition-transform ${isBankOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isBankOpen && (
              <div className="p-4 border-t border-brand-cyan/30 space-y-3">
                {/* Filter & Sort Controls */}
                <div className="flex gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-brand-gold/70">Filter:</label>
                    <select
                      value={bankFilter}
                      onChange={(e) => setBankFilter(e.target.value)}
                      className="bg-slate-800 border border-brand-gold/50 rounded px-2 py-1 text-white text-xs"
                    >
                      <option value="all">All Variations</option>
                      {uniqueVariations.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-brand-gold/70">Sort:</label>
                    <select
                      value={bankSort}
                      onChange={(e) => setBankSort(e.target.value as any)}
                      className="bg-slate-800 border border-brand-gold/50 rounded px-2 py-1 text-white text-xs"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="variation">By Variation</option>
                    </select>
                  </div>
                </div>

                {/* Available Images Grid */}
                {availableImages.length > 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    {availableImages.map((img) => (
                      <div key={img.id} className="relative group">
                        <img
                          src={img.url}
                          alt={img.variation}
                          className="w-full h-24 object-cover rounded border border-brand-cyan/30"
                        />
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition rounded flex flex-col items-center justify-center p-1 gap-1">
                          <span className="text-[10px] text-white font-semibold">{img.variation}</span>
                          <span className="text-[9px] text-white/70">{img.orientation}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleMarkAsUsed(img.id, 'manual')}
                              className="px-2 py-0.5 bg-green-600/80 rounded text-white text-[10px]"
                              title="Mark as Used"
                            >
                              Used
                            </button>
                            <button
                              onClick={() => handleRemoveFromBank(img.id)}
                              className="px-2 py-0.5 bg-red-600/80 rounded text-white text-[10px]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-brand-gold/50 py-4">No available images. Generate some using Batch Generate above.</p>
                )}
              </div>
            )}
          </div>

          {/* Used/Archive Section (Collapsible) */}
          <div className="bg-slate-900 rounded-lg border border-purple-500/50 overflow-hidden">
            <button
              onClick={() => setIsUsedOpen(!isUsedOpen)}
              className="w-full flex items-center justify-between p-3 text-purple-400 hover:bg-slate-800/50 transition"
            >
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Used/Archive ({usedImages.length})
              </span>
              <svg className={`w-5 h-5 transition-transform ${isUsedOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isUsedOpen && (
              <div className="p-4 border-t border-purple-500/30 space-y-3">
                {usedImages.length > 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    {usedImages.map((img) => (
                      <div key={img.id} className="relative group">
                        <img
                          src={img.url}
                          alt={img.variation}
                          className="w-full h-24 object-cover rounded border border-purple-500/30 opacity-70"
                        />
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-purple-600/90 rounded text-[9px] text-white">
                          USED
                        </div>
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition rounded flex flex-col items-center justify-center p-1 gap-1">
                          <span className="text-[10px] text-white font-semibold">{img.variation}</span>
                          {img.usedOn && (
                            <a
                              href={img.usedOn}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[9px] text-brand-cyan underline"
                            >
                              View Page
                            </a>
                          )}
                          <button
                            onClick={() => handleRestoreFromUsed(img.id)}
                            className="px-2 py-0.5 bg-brand-cyan/80 rounded text-slate-900 text-[10px] font-medium"
                          >
                            Restore
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-brand-gold/50 py-4">No used images yet. Images will appear here after being used on pages.</p>
                )}
              </div>
            )}
          </div>

          {/* Page Integration Controls */}
          <div className="bg-slate-900 p-4 rounded-lg border border-brand-gold/50">
            <h3 className="text-brand-gold font-semibold mb-3">Page Integration</h3>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="integration_mode"
                  checked={settings.integration_mode === 'bank'}
                  onChange={() => updateSettings({ integration_mode: 'bank' })}
                  className="accent-brand-gold"
                />
                <span className="text-sm text-white">Pull from Bank</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="integration_mode"
                  checked={settings.integration_mode === 'live'}
                  onChange={() => updateSettings({ integration_mode: 'live' })}
                  className="accent-brand-gold"
                />
                <span className="text-sm text-white">Generate Live</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={settings.fallback_to_live}
                  onChange={(e) => updateSettings({ fallback_to_live: e.target.checked })}
                  className="w-4 h-4 rounded border-brand-gold text-brand-gold focus:ring-brand-gold bg-slate-900"
                />
                <span className="text-sm text-brand-gold/70">Generate if bank empty</span>
              </label>
            </div>
          </div>
        </>
      )}

      {/* Saving Indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-brand-cyan text-slate-900 px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
          Saving...
        </div>
      )}
    </div>
  );
};

export default ImageCreationSection;
