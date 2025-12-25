/**
 * ImageCreationSection Component
 * "7. Image Creation" section for the main dashboard
 *
 * Features:
 * - Reference images for style consistency (collapsible)
 * - Logo upload with action shots for brand consistency
 * - Audience avatars synced with Tag Manager (H, J, C)
 * - Variation placeholder system (clickable tags to insert into prompt)
 * - Chat interface with GPT-4o for prompt refinement
 * - Batch Generate section (collapsible)
 * - Image Bank section with preview modal and download
 * - Used/Archive section with page links
 * - Page integration controls with variation order
 * - Processing Log integration
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Types
interface ReferenceImage {
  url: string;
  filename?: string;
  tags?: string[];
}

interface LogoImage {
  url: string;
  filename?: string;
  type: 'logo' | 'action'; // logo = the actual logo, action = photos showing logo in use
}

interface Variation {
  id: string;
  name: string;
  prompt: string;
  orientation: 'vertical' | 'landscape' | 'both';
}

// ========== ADVANCED PLACEHOLDER SYSTEM ==========

// A placeholder category (e.g., "Cleaning_Item", "Gender_Age")
interface PlaceholderCategory {
  id: string;
  name: string; // Display name: "Cleaning Item"
  placeholder: string; // The placeholder text: "{Cleaning_Item}"
  options: PlaceholderOption[];
}

// An option within a category
interface PlaceholderOption {
  number: number; // 1, 2, 3...
  text: string; // "cleaning the stove burners"
}

// Generation mode for advanced placeholder system
type GenerationMode = 'one_of_each' | 'sequential' | 'random' | 'specific';

// Specific combination entry (e.g., [3, 2] = 3rd cleaning item + 2nd gender/age)
type PlaceholderCombination = number[];

interface AudienceAvatar {
  id: number;
  name: string;
  tag?: string; // Links to Tag Manager tag (e.g., "H", "J", "C")
  mainPrompt: string;
  // Simple mode: single {variation} placeholder
  variations: Variation[];
  // Advanced mode: multi-placeholder system
  placeholderMode?: 'simple' | 'advanced';
  placeholderCategories?: PlaceholderCategory[];
  generationMode?: GenerationMode;
  specificCombinations?: PlaceholderCombination[];
  randomCount?: number; // How many random combinations to generate
  referenceImages?: ReferenceImage[];
}

interface BankImage {
  id: string;
  url: string;
  title?: string; // Editable title shown on image
  category?: string; // Custom sorting category
  variation: string;
  variationId: string;
  avatarTag?: string; // Which avatar/tag this image belongs to
  orientation: string;
  prompt: string;
  createdAt: string;
  used?: boolean;
  usedOn?: string;
  usedAt?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
  timestamp: string;
}

// Models that support vision/images (for chat assistants)
const IMAGE_CAPABLE_MODELS = ['gpt-4o', 'gpt-5.2-2025-12-11', 'claude-sonnet-4-5-20250929', 'claude-3-5-sonnet-20241022', 'gemini-2.5-pro'];

// Image generation models (for actually creating images)
const IMAGE_GENERATION_MODELS = [
  { id: 'gpt-image-1.5', name: 'GPT-Image-1.5 (Latest)', provider: 'openai', description: 'Best quality, 20% cheaper, better text rendering' },
  { id: 'gpt-image-1', name: 'GPT-Image-1', provider: 'openai', description: 'Previous generation' },
  { id: 'gpt-image-1-mini', name: 'GPT-Image-1 Mini', provider: 'openai', description: 'Faster, lower cost' },
  { id: 'dall-e-3', name: 'DALL-E 3', provider: 'openai', description: 'Legacy model' },
  { id: 'flux-1.1-pro', name: 'FLUX 1.1 Pro', provider: 'replicate', description: 'Via Replicate API' },
];

// GPT-Image-1.5 Prompt Guide Knowledge Base
const GPT_IMAGE_PROMPT_GUIDE = {
  title: 'GPT-Image-1.5 Prompting Guide',
  lastUpdated: 'December 2025',
  sections: [
    {
      title: 'Text Rendering',
      tips: [
        'Use quotes or CAPS for exact text: \'"Welcome to 2025" in bold sans-serif font\'',
        'Specify text details: "Centered at bottom, white text on black background, 72pt size"',
        'Works great for dense and small text - be specific about placement and style',
      ]
    },
    {
      title: 'Photorealism',
      tips: [
        'Use photo language: lens type (85mm portrait lens), lighting quality (soft diffused daylight), framing',
        'Be specific: "add soft coastal daylight" instead of "make it better"',
        'Describe camera angle: "shot from slightly below", "eye-level perspective"',
        'Mention film stocks or processing: "Kodak Portra 400 film look", "clean digital processing"',
      ]
    },
    {
      title: 'Consistency & Editing',
      tips: [
        'Model preserves faces and logos better during edits',
        'For outfit changes: "same person, change red shirt to blue sweater"',
        'For lighting: "adjust lighting to golden hour without changing composition"',
        'Be explicit about what to keep vs change',
      ]
    },
    {
      title: 'UI/Mockups',
      tips: [
        'Describe the product as if it already exists',
        'Focus on: layout, hierarchy, spacing, real interface elements',
        'Avoid concept art language - be practical and specific',
        'Example: "Mobile app screen showing dashboard with 3 metric cards at top, navigation bar at bottom"',
      ]
    },
    {
      title: 'World Knowledge',
      tips: [
        'Model has built-in reasoning and world knowledge',
        'Example: "Bethel, New York, August 1969" → infers Woodstock',
        'Can reference cultural events, historical periods, famous locations',
        'Use contextual cues for accurate scene setting',
      ]
    },
    {
      title: 'Image Sizes',
      tips: [
        '1024x1024 - Square (default)',
        '1536x1024 - Landscape (wide)',
        '1024x1536 - Portrait/Vertical (tall) - BEST for hero images',
        'Use "auto" to let model decide based on content',
      ]
    }
  ]
};

// Chat types for the dual chat system
type ChatType = 'consultant' | 'worker';

interface Tag {
  id: number;
  name: string;
}

interface ImageCreationSettings {
  enabled: boolean;
  prompt_assistant_model: string;
  // Image generation model (gpt-image-1.5, dall-e-3, flux, etc.)
  image_generation_model: string;
  reference_images: ReferenceImage[];
  logo_images: LogoImage[];
  audience_avatars: AudienceAvatar[];
  image_bank: BankImage[];
  // Custom sorting categories for uploaded images
  image_categories: string[];
  // LLM auto-tagging for uploads
  auto_tag_enabled: boolean;
  // Legacy single chat history (for migration)
  chat_history: ChatMessage[];
  // Dual chat system
  consultant_chat_history: ChatMessage[];
  consultant_model: string;
  worker_chat_history: ChatMessage[];
  worker_model: string;
  integration_mode: 'live' | 'bank';
  fallback_to_live: boolean;
  image_order: string[];
  variation_order_mode: 'sequential' | 'random' | 'manual';
  manual_variation_order: string[];
}

enum LogStatus {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  WORKING = 'WORKING',
}

interface Props {
  workflowId?: number;
  tags?: Tag[]; // Tags from Tag Manager
  onSettingsChange?: (settings: ImageCreationSettings) => void;
  showNotification: (message: string, type: 'success' | 'info' | 'error') => void;
  addLog?: (message: string, status: LogStatus) => void;
}

const DEFAULT_SETTINGS: ImageCreationSettings = {
  enabled: false,
  prompt_assistant_model: 'gpt-4o',
  image_generation_model: 'gpt-image-1.5', // Latest and best image generation model
  reference_images: [],
  logo_images: [],
  audience_avatars: [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }],
  image_bank: [],
  // Custom categories for sorting uploaded images
  image_categories: ['Hero', 'Service', 'Team', 'Equipment', 'Before/After', 'Other'],
  auto_tag_enabled: true,
  chat_history: [],
  // Dual chat defaults
  consultant_chat_history: [],
  consultant_model: 'gpt-4o', // Default to vision model for consultant
  worker_chat_history: [],
  worker_model: 'gpt-4o-mini', // Default to cheaper model for worker
  integration_mode: 'bank',
  fallback_to_live: true,
  image_order: [],
  variation_order_mode: 'sequential',
  manual_variation_order: []
};

const AVAILABLE_MODELS = [
  { id: 'gpt-5.2-2025-12-11', name: 'GPT-5.2', provider: 'openai' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' }
];

// Variation placeholder tag
const VARIATION_PLACEHOLDER = '{variation}';

const ImageCreationSection: React.FC<Props> = ({ workflowId, tags = [], onSettingsChange, showNotification, addLog }) => {
  // State
  const [settings, setSettings] = useState<ImageCreationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false); // Prevent saving before load

  // Collapsible sections
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [isLogoOpen, setIsLogoOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isConsultantChatOpen, setIsConsultantChatOpen] = useState(false);
  const [isWorkerChatOpen, setIsWorkerChatOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isBankOpen, setIsBankOpen] = useState(true);
  const [isUsedOpen, setIsUsedOpen] = useState(false);
  const [isOrderOpen, setIsOrderOpen] = useState(false);

  // Image preview modal
  const [previewImage, setPreviewImage] = useState<BankImage | null>(null);

  // Bulk selection for download
  const [selectedForDownload, setSelectedForDownload] = useState<Set<string>>(new Set());

  // Active avatar
  const [activeAvatarId, setActiveAvatarId] = useState<number>(1);
  const [activeVariationId, setActiveVariationId] = useState<string | null>(null);

  // Legacy Chat (keeping for backwards compatibility)
  const [chatInput, setChatInput] = useState('');
  const [chatImages, setChatImages] = useState<string[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Consultant Chat - Strategic partner with vision
  const [consultantInput, setConsultantInput] = useState('');
  const [consultantImages, setConsultantImages] = useState<string[]>([]);
  const [consultantLoading, setConsultantLoading] = useState(false);
  const consultantChatRef = useRef<HTMLDivElement>(null);
  const consultantFileInputRef = useRef<HTMLInputElement>(null);

  // Worker Chat - Operational helper
  const [workerInput, setWorkerInput] = useState('');
  const [workerImages, setWorkerImages] = useState<string[]>([]);
  const [workerLoading, setWorkerLoading] = useState(false);
  const workerChatRef = useRef<HTMLDivElement>(null);
  const workerFileInputRef = useRef<HTMLInputElement>(null);

  // Image generation
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [batchQuantity, setBatchQuantity] = useState(1);
  const [selectedVariations, setSelectedVariations] = useState<Set<string>>(new Set());

  // Bank filtering
  const [bankFilter, setBankFilter] = useState<string>('all');
  const [bankSort, setBankSort] = useState<'newest' | 'oldest' | 'variation'>('newest');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Image title editing
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  // Category management
  const [newCategoryInput, setNewCategoryInput] = useState<string>('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // Upload processing
  const [uploadingToBank, setUploadingToBank] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);
  const [showPromptGuide, setShowPromptGuide] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const actionShotsInputRef = useRef<HTMLInputElement>(null);
  const bankUploadInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const mainPromptRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper: Log to Processing Log
  const log = useCallback((message: string, status: LogStatus) => {
    if (addLog) {
      addLog(`[Image Creation] ${message}`, status);
    }
    console.log(`[Image Creation] ${status}: ${message}`);
  }, [addLog]);

  // Load settings when workflowId changes
  useEffect(() => {
    if (workflowId) {
      loadSettings();
    } else {
      setLoading(false);
      setLoaded(false);
    }
  }, [workflowId]);

  // Sync Tag Manager tags with Audience Avatars
  useEffect(() => {
    if (!loaded || tags.length === 0) return;

    // Check if we need to sync avatars with tags
    const existingTags = new Set(settings.audience_avatars.map(a => a.tag).filter(Boolean));
    const tagManagerTags = new Set(tags.map(t => t.name));

    // Find new tags that don't have avatars
    const newTags = tags.filter(t => !existingTags.has(t.name));

    if (newTags.length > 0) {
      const newAvatars = newTags.map((tag, idx) => ({
        id: Date.now() + idx,
        name: `${tag.name}`, // Just the tag name, user can rename
        tag: tag.name,
        mainPrompt: '',
        variations: []
      }));

      // Keep existing avatars but mark any that don't have tags if tags exist
      const updatedAvatars = [
        ...settings.audience_avatars.filter(a => a.tag || !tagManagerTags.size),
        ...newAvatars
      ];

      // If no avatars left with tags but we have tags, just add new ones
      if (updatedAvatars.length === 0) {
        updateSettings({ audience_avatars: newAvatars });
      } else {
        updateSettings({ audience_avatars: updatedAvatars });
      }

      log(`Synced ${newTags.length} new avatars from Tag Manager`, LogStatus.INFO);
    }
  }, [tags, loaded]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [settings.chat_history]);

  // Scroll consultant chat to bottom on new messages
  useEffect(() => {
    if (consultantChatRef.current) {
      consultantChatRef.current.scrollTop = consultantChatRef.current.scrollHeight;
    }
  }, [settings.consultant_chat_history]);

  // Scroll worker chat to bottom on new messages
  useEffect(() => {
    if (workerChatRef.current) {
      workerChatRef.current.scrollTop = workerChatRef.current.scrollHeight;
    }
  }, [settings.worker_chat_history]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const loadSettings = async () => {
    if (!workflowId) return;
    setLoading(true);
    setLoaded(false);
    try {
      const res = await fetch(`/api/image-creation/settings/${workflowId}`);
      const data = await res.json();
      if (data.success) {
        // Handle migration: if old chat_history exists but new ones don't, migrate
        const migratedConsultantHistory = data.settings.consultant_chat_history?.length > 0
          ? data.settings.consultant_chat_history
          : (data.settings.chat_history?.length > 0 ? data.settings.chat_history : []);

        const loadedSettings = {
          ...DEFAULT_SETTINGS,
          ...data.settings,
          // Ensure arrays are arrays
          reference_images: data.settings.reference_images || [],
          logo_images: data.settings.logo_images || [],
          audience_avatars: data.settings.audience_avatars?.length > 0
            ? data.settings.audience_avatars
            : [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }],
          image_bank: data.settings.image_bank || [],
          // Image categories and auto-tag
          image_categories: data.settings.image_categories?.length > 0
            ? data.settings.image_categories
            : DEFAULT_SETTINGS.image_categories,
          auto_tag_enabled: data.settings.auto_tag_enabled ?? true,
          chat_history: data.settings.chat_history || [],
          // Dual chat system
          consultant_chat_history: migratedConsultantHistory,
          consultant_model: data.settings.consultant_model || 'gpt-4o',
          worker_chat_history: data.settings.worker_chat_history || [],
          worker_model: data.settings.worker_model || 'gpt-4o-mini',
          image_order: data.settings.image_order || [],
          manual_variation_order: data.settings.manual_variation_order || []
        };
        setSettings(loadedSettings);
        if (loadedSettings.audience_avatars.length > 0) {
          setActiveAvatarId(loadedSettings.audience_avatars[0].id);
        }
        console.log('[Image Creation] Loaded settings:', loadedSettings);
      }
    } catch (error) {
      console.error('Failed to load image creation settings:', error);
    }
    setLoading(false);
    setLoaded(true);
  };

  // Debounced save to prevent rapid overwrites
  const saveSettings = useCallback(async (newSettings: ImageCreationSettings) => {
    if (!workflowId || !loaded) {
      console.log('[Image Creation] Skipping save - not loaded yet');
      return;
    }

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce saves by 500ms
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        console.log('[Image Creation] Saving settings:', newSettings);
        const res = await fetch(`/api/image-creation/settings/${workflowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSettings)
        });
        const data = await res.json();
        if (data.success) {
          onSettingsChange?.(newSettings);
          console.log('[Image Creation] Settings saved successfully');
        } else {
          console.error('[Image Creation] Save failed:', data.error);
        }
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
      setSaving(false);
    }, 500);
  }, [workflowId, loaded, onSettingsChange]);

  const updateSettings = useCallback((updates: Partial<ImageCreationSettings>) => {
    if (!loaded) {
      console.log('[Image Creation] Skipping update - not loaded yet');
      return;
    }
    setSettings(current => {
      const newSettings = { ...current, ...updates };
      saveSettings(newSettings);
      return newSettings;
    });
  }, [loaded, saveSettings]);

  // Get active avatar
  const activeAvatar = settings.audience_avatars.find(a => a.id === activeAvatarId) || settings.audience_avatars[0];

  // Get unique variations for filtering
  const uniqueVariations = [...new Set(settings.image_bank.map(img => img.variation))];

  // Filter and sort bank images
  const getFilteredBankImages = (includeUsed: boolean) => {
    let images = settings.image_bank.filter(img => includeUsed ? img.used : !img.used);
    // Filter by variation
    if (bankFilter !== 'all') {
      images = images.filter(img => img.variation === bankFilter);
    }
    // Filter by category
    if (categoryFilter !== 'all') {
      images = images.filter(img => img.category === categoryFilter);
    }
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

  // Get unique categories for filter
  const uniqueCategories = [...new Set(settings.image_bank.map(img => img.category).filter(Boolean))];

  const availableImages = getFilteredBankImages(false);
  const usedImages = getFilteredBankImages(true);

  // Insert variation placeholder into main prompt at cursor
  const insertVariationPlaceholder = () => {
    if (!mainPromptRef.current || !activeAvatar) return;

    const textarea = mainPromptRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = activeAvatar.mainPrompt;

    const newText = text.substring(0, start) + VARIATION_PLACEHOLDER + text.substring(end);
    handleUpdateAvatar(activeAvatar.id, { mainPrompt: newText });

    // Restore cursor position after the placeholder
    setTimeout(() => {
      textarea.focus();
      const newPos = start + VARIATION_PLACEHOLDER.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Insert specific variation name at cursor
  const insertVariationTag = (variationName: string) => {
    if (!mainPromptRef.current || !activeAvatar) return;

    const tag = `{${variationName}}`;
    const textarea = mainPromptRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = activeAvatar.mainPrompt;

    const newText = text.substring(0, start) + tag + text.substring(end);
    handleUpdateAvatar(activeAvatar.id, { mainPrompt: newText });

    setTimeout(() => {
      textarea.focus();
      const newPos = start + tag.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Build final prompt by replacing {variation} with actual variation prompt
  const buildFinalPrompt = (mainPrompt: string, variationPrompt: string): string => {
    if (mainPrompt.includes(VARIATION_PLACEHOLDER)) {
      return mainPrompt.replace(VARIATION_PLACEHOLDER, variationPrompt);
    }
    // If no placeholder, append variation to end
    return mainPrompt ? `${mainPrompt}\n\n${variationPrompt}` : variationPrompt;
  };

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

  // Logo Image Handlers
  const handleUploadLogo = async (files: FileList | null, type: 'logo' | 'action') => {
    if (!files || files.length === 0) return;
    const newImages: LogoImage[] = [];
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newImages.push({ url: dataUrl, filename: file.name, type });
    }
    updateSettings({
      logo_images: [...settings.logo_images, ...newImages]
    });
    showNotification(`Added ${newImages.length} ${type === 'logo' ? 'logo' : 'action shot'}(s)`, 'success');
  };

  const handleRemoveLogo = (index: number) => {
    const newImages = settings.logo_images.filter((_, i) => i !== index);
    updateSettings({ logo_images: newImages });
  };

  // Get logos and action shots separately
  const logoImages = settings.logo_images.filter(img => img.type === 'logo');
  const actionShots = settings.logo_images.filter(img => img.type === 'action');

  // Download handlers
  const handleDownloadImage = async (img: BankImage) => {
    try {
      const response = await fetch(img.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${img.variation}-${img.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showNotification('Image downloaded', 'success');
    } catch (error) {
      showNotification('Failed to download image', 'error');
    }
  };

  const handleBulkDownload = async () => {
    if (selectedForDownload.size === 0) {
      showNotification('Select images to download', 'error');
      return;
    }

    const imagesToDownload = settings.image_bank.filter(img => selectedForDownload.has(img.id));
    log(`Downloading ${imagesToDownload.length} images...`, LogStatus.WORKING);

    for (let i = 0; i < imagesToDownload.length; i++) {
      const img = imagesToDownload[i];
      try {
        const response = await fetch(img.url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${img.variation}-${img.id}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        // Small delay between downloads to prevent browser issues
        await new Promise(r => setTimeout(r, 200));
      } catch (error) {
        console.error('Failed to download:', img.id);
      }
    }

    setSelectedForDownload(new Set());
    log(`Downloaded ${imagesToDownload.length} images`, LogStatus.SUCCESS);
    showNotification(`Downloaded ${imagesToDownload.length} images`, 'success');
  };

  const toggleDownloadSelection = (id: string) => {
    const newSelected = new Set(selectedForDownload);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedForDownload(newSelected);
  };

  const selectAllForDownload = () => {
    const availableIds = availableImages.map(img => img.id);
    setSelectedForDownload(new Set(availableIds));
  };

  const clearDownloadSelection = () => {
    setSelectedForDownload(new Set());
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
      prompt: '', // Start empty - user can copy main prompt if desired
      orientation: 'landscape'
    };
    handleUpdateAvatar(activeAvatar.id, {
      variations: [...activeAvatar.variations, newVariation]
    });
    setActiveVariationId(newVariation.id);
  };

  // Copy main prompt to variation
  const handleCopyMainToVariation = (variationId: string) => {
    if (!activeAvatar) return;
    const newVariations = activeAvatar.variations.map(v =>
      v.id === variationId ? { ...v, prompt: activeAvatar.mainPrompt } : v
    );
    handleUpdateAvatar(activeAvatar.id, { variations: newVariations });
    showNotification('Main prompt copied to variation', 'info');
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

  // ========== DUAL CHAT SYSTEM ==========

  /**
   * Build context summary for the consultant chat
   * Includes: current avatar setup, prompts, variations, reference images, logo, action shots
   */
  const buildConsultantContext = (): string => {
    const parts: string[] = [];

    parts.push('=== IMAGE CREATION CONSULTANT CONTEXT ===');
    parts.push('You are an expert image consultant helping design consistent, high-quality images for a client\'s content marketing.');
    parts.push('');

    // Add GPT-Image model info and prompting knowledge
    const selectedModel = settings.image_generation_model || 'gpt-image-1.5';
    parts.push(`🎨 ACTIVE IMAGE MODEL: ${selectedModel}`);

    if (selectedModel.startsWith('gpt-image')) {
      parts.push('');
      parts.push('📚 GPT-IMAGE PROMPTING KNOWLEDGE (use this to craft better prompts):');
      GPT_IMAGE_PROMPT_GUIDE.sections.forEach(section => {
        parts.push(`  ${section.title}:`);
        section.tips.forEach(tip => {
          parts.push(`    • ${tip}`);
        });
      });
      parts.push('');
      parts.push('IMPORTANT: Apply this prompting knowledge when helping craft or improve prompts.');
    }
    parts.push('');

    // Current avatar info
    if (activeAvatar) {
      parts.push(`📌 ACTIVE AVATAR: ${activeAvatar.name}${activeAvatar.tag ? ` (Tag: ${activeAvatar.tag})` : ''}`);
      if (activeAvatar.mainPrompt) {
        parts.push(`📝 Main Prompt Template: "${activeAvatar.mainPrompt}"`);
      }
      if (activeAvatar.variations.length > 0) {
        parts.push(`🎨 Variations (${activeAvatar.variations.length}):`);
        activeAvatar.variations.forEach(v => {
          parts.push(`  - ${v.name} (${v.orientation}): "${v.prompt.substring(0, 80)}${v.prompt.length > 80 ? '...' : ''}"`);
        });
      }
    }
    parts.push('');

    // All avatars summary
    if (settings.audience_avatars.length > 1) {
      parts.push(`👥 ALL AVATARS (${settings.audience_avatars.length}):`);
      settings.audience_avatars.forEach(a => {
        parts.push(`  - ${a.name}${a.tag ? ` [${a.tag}]` : ''}: ${a.variations.length} variations`);
      });
      parts.push('');
    }

    // Reference images count
    if (settings.reference_images.length > 0) {
      parts.push(`📷 REFERENCE IMAGES: ${settings.reference_images.length} images uploaded for style reference`);
    }

    // Logo info
    const logos = settings.logo_images.filter(i => i.type === 'logo');
    const actions = settings.logo_images.filter(i => i.type === 'action');
    if (logos.length > 0 || actions.length > 0) {
      parts.push(`🏷️ BRANDING: ${logos.length} logo(s), ${actions.length} action shot(s)`);
    }

    // Image bank stats
    const availableCount = settings.image_bank.filter(i => !i.used).length;
    const usedCount = settings.image_bank.filter(i => i.used).length;
    if (settings.image_bank.length > 0) {
      parts.push(`🏦 IMAGE BANK: ${availableCount} available, ${usedCount} used`);
    }

    parts.push('');
    parts.push('Help the user dial in their image style, suggest improvements to prompts, and discuss image strategy for their content.');

    return parts.join('\n');
  };

  /**
   * Build context summary for the worker chat
   * Includes: consultant conversation summary, setup state, instructions for operational work
   */
  const buildWorkerContext = (): string => {
    const parts: string[] = [];

    parts.push('=== IMAGE CREATION WORKER CONTEXT ===');
    parts.push('You are an operational assistant helping organize and distribute image prompts based on a strategic plan.');
    parts.push('');

    // Include consultant conversation summary if exists
    if (settings.consultant_chat_history.length > 0) {
      parts.push('📋 CONSULTANT CONVERSATION SUMMARY:');
      parts.push('The consultant and user have discussed the following:');

      // Get last 10 messages or all if less
      const recentConsultant = settings.consultant_chat_history.slice(-10);
      recentConsultant.forEach((msg, idx) => {
        const prefix = msg.role === 'user' ? '👤 User' : '🤖 Consultant';
        const content = msg.content.substring(0, 200);
        parts.push(`  ${prefix}: ${content}${msg.content.length > 200 ? '...' : ''}`);
      });
      parts.push('');
    }

    // Current setup
    if (activeAvatar) {
      parts.push(`📌 CURRENT SETUP:`);
      parts.push(`  Avatar: ${activeAvatar.name}${activeAvatar.tag ? ` (${activeAvatar.tag})` : ''}`);
      parts.push(`  Main Prompt: "${activeAvatar.mainPrompt.substring(0, 100)}${activeAvatar.mainPrompt.length > 100 ? '...' : ''}"`);
      parts.push(`  Variations: ${activeAvatar.variations.length}`);
      activeAvatar.variations.forEach(v => {
        parts.push(`    - ${v.name} (${v.orientation})`);
      });
    }
    parts.push('');

    // Available images by variation
    const availableImages = settings.image_bank.filter(i => !i.used);
    if (availableImages.length > 0) {
      const byVariation: Record<string, number> = {};
      availableImages.forEach(img => {
        byVariation[img.variation] = (byVariation[img.variation] || 0) + 1;
      });
      parts.push('🏦 AVAILABLE IMAGES BY VARIATION:');
      Object.entries(byVariation).forEach(([v, count]) => {
        parts.push(`  - ${v}: ${count} images`);
      });
    }
    parts.push('');

    parts.push('Help the user organize prompts, create variation schedules, and manage the operational side of image creation.');

    return parts.join('\n');
  };

  /**
   * Get images to include in context based on chat type
   */
  const getContextImages = (chatType: ChatType): string[] => {
    const images: string[] = [];

    if (chatType === 'consultant') {
      // Include reference images (non-data URLs only work for URLs, data URLs for uploaded)
      settings.reference_images.slice(0, 4).forEach(img => {
        images.push(img.url);
      });

      // Include logo
      const logos = settings.logo_images.filter(i => i.type === 'logo');
      logos.slice(0, 2).forEach(img => {
        images.push(img.url);
      });

      // Include some action shots
      const actions = settings.logo_images.filter(i => i.type === 'action');
      actions.slice(0, 2).forEach(img => {
        images.push(img.url);
      });

      // Include some bank images for context
      const bankSample = settings.image_bank.filter(i => !i.used).slice(0, 3);
      bankSample.forEach(img => {
        images.push(img.url);
      });
    }

    return images.slice(0, 8); // Max 8 images for context
  };

  /**
   * Handle sending message to consultant chat
   */
  const handleSendConsultantChat = async () => {
    if (!consultantInput.trim() && consultantImages.length === 0) return;

    const newMessage: ChatMessage = {
      role: 'user',
      content: consultantInput,
      images: consultantImages.length > 0 ? consultantImages : undefined,
      timestamp: new Date().toISOString()
    };

    // Build history with context
    const isFirstMessage = settings.consultant_chat_history.length === 0;
    let historyToSend = [...settings.consultant_chat_history, newMessage];

    // Add system context for first message
    if (isFirstMessage) {
      const contextMessage: ChatMessage = {
        role: 'system',
        content: buildConsultantContext(),
        timestamp: new Date().toISOString()
      };
      historyToSend = [contextMessage, ...historyToSend];
    }

    // Update local state
    const newHistory = [...settings.consultant_chat_history, newMessage];
    updateSettings({ consultant_chat_history: newHistory });
    setConsultantInput('');
    setConsultantImages([]);
    setConsultantLoading(true);

    try {
      // Get context images to include
      const contextImages = getContextImages('consultant');
      const allImages = [...(newMessage.images || []), ...contextImages];

      const res = await fetch('/api/image-creation/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyToSend.map(m => ({
            role: m.role,
            content: m.content,
            images: m.images
          })),
          model: settings.consultant_model,
          contextImages: isFirstMessage ? contextImages : undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.message.content,
          timestamp: new Date().toISOString()
        };
        updateSettings({ consultant_chat_history: [...newHistory, assistantMessage] });
      } else {
        showNotification(data.error || 'Consultant chat failed', 'error');
      }
    } catch (error) {
      console.error('Consultant chat error:', error);
      showNotification('Failed to send message', 'error');
    }

    setConsultantLoading(false);
  };

  /**
   * Handle sending message to worker chat
   */
  const handleSendWorkerChat = async () => {
    if (!workerInput.trim() && workerImages.length === 0) return;

    const newMessage: ChatMessage = {
      role: 'user',
      content: workerInput,
      images: workerImages.length > 0 ? workerImages : undefined,
      timestamp: new Date().toISOString()
    };

    // Build history with context (include consultant context always for worker)
    const isFirstMessage = settings.worker_chat_history.length === 0;
    let historyToSend = [...settings.worker_chat_history, newMessage];

    // Add system context for first message or refresh context periodically
    if (isFirstMessage || settings.worker_chat_history.length % 10 === 0) {
      const contextMessage: ChatMessage = {
        role: 'system',
        content: buildWorkerContext(),
        timestamp: new Date().toISOString()
      };
      historyToSend = [contextMessage, ...historyToSend];
    }

    // Update local state
    const newHistory = [...settings.worker_chat_history, newMessage];
    updateSettings({ worker_chat_history: newHistory });
    setWorkerInput('');
    setWorkerImages([]);
    setWorkerLoading(true);

    try {
      const res = await fetch('/api/image-creation/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyToSend.map(m => ({
            role: m.role,
            content: m.content,
            images: m.images
          })),
          model: settings.worker_model
        })
      });

      const data = await res.json();
      if (data.success) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.message.content,
          timestamp: new Date().toISOString()
        };
        updateSettings({ worker_chat_history: [...newHistory, assistantMessage] });
      } else {
        showNotification(data.error || 'Worker chat failed', 'error');
      }
    } catch (error) {
      console.error('Worker chat error:', error);
      showNotification('Failed to send message', 'error');
    }

    setWorkerLoading(false);
  };

  /**
   * Handle image upload for consultant/worker chats
   */
  const handleDualChatImageUpload = async (files: FileList | null, chatType: ChatType) => {
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

    if (chatType === 'consultant') {
      setConsultantImages([...consultantImages, ...newImages].slice(0, 4));
    } else {
      setWorkerImages([...workerImages, ...newImages].slice(0, 4));
    }
  };

  /**
   * Clear chat history for a specific chat
   */
  const handleClearChatHistory = (chatType: ChatType) => {
    if (chatType === 'consultant') {
      updateSettings({ consultant_chat_history: [] });
      showNotification('Consultant chat cleared', 'info');
    } else {
      updateSettings({ worker_chat_history: [] });
      showNotification('Worker chat cleared', 'info');
    }
  };

  /**
   * Inject context from consultant to worker (sync knowledge)
   */
  const handleSyncConsultantToWorker = () => {
    if (settings.consultant_chat_history.length === 0) {
      showNotification('No consultant conversation to sync', 'error');
      return;
    }

    // Add a system message to worker chat summarizing consultant decisions
    const syncMessage: ChatMessage = {
      role: 'system',
      content: buildWorkerContext(),
      timestamp: new Date().toISOString()
    };

    updateSettings({
      worker_chat_history: [syncMessage, ...settings.worker_chat_history]
    });
    showNotification('Consultant context synced to worker', 'success');
  };

  // Image Generation - Single
  const handleGenerateSingle = async (variation: Variation) => {
    setGenerating(true);
    setGenerationProgress('Starting image generation...');
    log('Starting single image generation...', LogStatus.WORKING);

    try {
      const size = variation.orientation === 'vertical' ? '1024x1792' :
                   variation.orientation === 'landscape' ? '1792x1024' : '1024x1024';

      const fullPrompt = buildFinalPrompt(activeAvatar?.mainPrompt || '', variation.prompt);

      setGenerationProgress('Generating image with AI...');
      log(`Generating ${variation.orientation} image for "${variation.name}"...`, LogStatus.WORKING);

      const res = await fetch('/api/image-creation/generate-with-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          model: settings.image_generation_model || 'gpt-image-1.5',
          referenceImageUrls: settings.reference_images.map(i => i.url).filter(url => !url.startsWith('data:')),
          size
        })
      });

      const data = await res.json();

      if (data.success && data.image?.url) {
        const newBankImage: BankImage = {
          id: `img-${Date.now()}`,
          url: data.image.url,
          variation: variation.name,
          variationId: variation.id,
          avatarTag: activeAvatar?.tag, // Link image to avatar's tag for routing
          orientation: variation.orientation,
          prompt: fullPrompt,
          createdAt: new Date().toISOString(),
          used: false
        };

        updateSettings({
          image_bank: [...settings.image_bank, newBankImage]
        });

        setGenerationProgress('');
        log(`Image generated successfully for "${variation.name}"!`, LogStatus.SUCCESS);
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
    log(`Starting batch generation: ${totalImages} images`, LogStatus.WORKING);

    try {
      // Build prompts with main prompt + variation
      const variationsWithFullPrompt = variationsToGenerate.map(v => ({
        id: v.id,
        name: v.name,
        prompt: buildFinalPrompt(activeAvatar.mainPrompt, v.prompt),
        orientation: v.orientation
      }));

      const res = await fetch('/api/image-creation/batch-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainPrompt: '', // Already included in variation prompts
          variations: variationsWithFullPrompt,
          referenceImageUrls: settings.reference_images.map(i => i.url).filter(url => !url.startsWith('data:')),
          quantity: batchQuantity
        })
      });

      const data = await res.json();

      if (data.success) {
        const successCount = data.images?.length || 0;
        const failCount = data.errors?.length || 0;

        if (successCount > 0) {
          const newBankImages: BankImage[] = data.images.map((img: any) => ({
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url: img.url,
            variation: img.variation,
            variationId: img.variationId,
            avatarTag: activeAvatar?.tag, // Link images to avatar's tag for routing
            orientation: img.orientation,
            prompt: img.prompt,
            createdAt: new Date().toISOString(),
            used: false
          }));

          updateSettings({
            image_bank: [...settings.image_bank, ...newBankImages]
          });

          setGenerationProgress('');
          log(`Batch complete: ${successCount} generated, ${failCount} failed`, LogStatus.SUCCESS);
          showNotification(`Generated ${successCount} images!`, 'success');
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

  // ========== UPLOAD TO BANK ==========

  /**
   * Handle bulk upload of images to bank
   */
  const handleBankUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadingToBank(true);
    const newImages: BankImage[] = [];

    for (const file of Array.from(files)) {
      try {
        // Convert file to base64 data URL
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Get filename without extension for default title
        const defaultTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        const newImage: BankImage = {
          id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          url: dataUrl,
          title: defaultTitle,
          category: 'Other', // Default category, will be auto-tagged if enabled
          variation: 'Uploaded',
          variationId: 'uploaded',
          avatarTag: activeAvatar?.tag,
          orientation: 'landscape', // Could detect from image dimensions
          prompt: 'Manually uploaded',
          createdAt: new Date().toISOString(),
          used: false
        };

        newImages.push(newImage);
      } catch (error) {
        console.error(`Failed to process file ${file.name}:`, error);
      }
    }

    // Add to bank
    const updatedBank = [...settings.image_bank, ...newImages];
    updateSettings({ image_bank: updatedBank });

    showNotification(`Uploaded ${newImages.length} image(s) to bank`, 'success');

    // Auto-tag if enabled
    if (settings.auto_tag_enabled && newImages.length > 0) {
      await autoTagImages(newImages.map(img => img.id));
    }

    setUploadingToBank(false);
  };

  /**
   * LLM Auto-tagging for uploaded images
   */
  const autoTagImages = async (imageIds: string[]) => {
    if (imageIds.length === 0) return;

    setAutoTagging(true);
    log('Auto-tagging uploaded images...', LogStatus.WORKING);

    try {
      // Get images to tag
      const imagesToTag = settings.image_bank.filter(img => imageIds.includes(img.id));

      for (const img of imagesToTag) {
        try {
          // Call LLM to analyze and categorize the image
          const res = await fetch('/api/image-creation/auto-tag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: img.url,
              categories: settings.image_categories,
              currentTitle: img.title
            })
          });

          const data = await res.json();
          if (data.success) {
            // Update image with LLM suggestions
            const newBank = settings.image_bank.map(bankImg =>
              bankImg.id === img.id
                ? {
                    ...bankImg,
                    title: data.suggestedTitle || bankImg.title,
                    category: data.suggestedCategory || bankImg.category
                  }
                : bankImg
            );
            updateSettings({ image_bank: newBank });
          }
        } catch (error) {
          console.error(`Auto-tag failed for image ${img.id}:`, error);
        }
      }

      log('Auto-tagging complete', LogStatus.SUCCESS);
    } catch (error) {
      console.error('Auto-tagging error:', error);
      log('Auto-tagging failed', LogStatus.ERROR);
    }

    setAutoTagging(false);
  };

  /**
   * Update image title
   */
  const handleUpdateImageTitle = (imageId: string, newTitle: string) => {
    const newBank = settings.image_bank.map(img =>
      img.id === imageId ? { ...img, title: newTitle } : img
    );
    updateSettings({ image_bank: newBank });
    setEditingImageId(null);
    setEditingTitle('');
  };

  /**
   * Update image category
   */
  const handleUpdateImageCategory = (imageId: string, newCategory: string) => {
    const newBank = settings.image_bank.map(img =>
      img.id === imageId ? { ...img, category: newCategory } : img
    );
    updateSettings({ image_bank: newBank });
  };

  /**
   * Add a new custom category
   */
  const handleAddCategory = () => {
    if (!newCategoryInput.trim()) return;
    if (settings.image_categories.includes(newCategoryInput.trim())) {
      showNotification('Category already exists', 'error');
      return;
    }
    updateSettings({
      image_categories: [...settings.image_categories, newCategoryInput.trim()]
    });
    setNewCategoryInput('');
    showNotification('Category added', 'success');
  };

  /**
   * Remove a custom category
   */
  const handleRemoveCategory = (category: string) => {
    // Move any images with this category to "Other"
    const newBank = settings.image_bank.map(img =>
      img.category === category ? { ...img, category: 'Other' } : img
    );
    const newCategories = settings.image_categories.filter(c => c !== category);
    updateSettings({
      image_bank: newBank,
      image_categories: newCategories.length > 0 ? newCategories : ['Other']
    });
    showNotification('Category removed', 'info');
  };

  // Variation Order Handlers
  const handleSetVariationOrder = (variationId: string) => {
    const currentOrder = settings.manual_variation_order || [];
    if (currentOrder.includes(variationId)) {
      // Remove from order
      updateSettings({ manual_variation_order: currentOrder.filter(id => id !== variationId) });
    } else {
      // Add to order
      updateSettings({ manual_variation_order: [...currentOrder, variationId] });
    }
  };

  const getVariationOrderNumber = (variationId: string): number | null => {
    const order = settings.manual_variation_order || [];
    const index = order.indexOf(variationId);
    return index >= 0 ? index + 1 : null;
  };

  const clearVariationOrder = () => {
    updateSettings({ manual_variation_order: [] });
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

  // ========== ADVANCED PLACEHOLDER HANDLERS ==========

  const handleAddPlaceholderCategory = () => {
    if (!activeAvatar) return;
    const newCategory: PlaceholderCategory = {
      id: `cat_${Date.now()}`,
      name: 'New Category',
      placeholder: '{New_Category}',
      options: []
    };
    const existingCategories = activeAvatar.placeholderCategories || [];
    handleUpdateAvatar(activeAvatar.id, {
      placeholderCategories: [...existingCategories, newCategory]
    });
  };

  const handleUpdatePlaceholderCategory = (categoryId: string, updates: Partial<PlaceholderCategory>) => {
    if (!activeAvatar) return;
    const categories = activeAvatar.placeholderCategories || [];
    const updatedCategories = categories.map(cat =>
      cat.id === categoryId ? { ...cat, ...updates } : cat
    );
    handleUpdateAvatar(activeAvatar.id, { placeholderCategories: updatedCategories });
  };

  const handleRemovePlaceholderCategory = (categoryId: string) => {
    if (!activeAvatar) return;
    const categories = activeAvatar.placeholderCategories || [];
    handleUpdateAvatar(activeAvatar.id, {
      placeholderCategories: categories.filter(cat => cat.id !== categoryId)
    });
  };

  const handleAddPlaceholderOption = (categoryId: string) => {
    if (!activeAvatar) return;
    const categories = activeAvatar.placeholderCategories || [];
    const updatedCategories = categories.map(cat => {
      if (cat.id === categoryId) {
        const nextNumber = cat.options.length > 0
          ? Math.max(...cat.options.map(o => o.number)) + 1
          : 1;
        return {
          ...cat,
          options: [...cat.options, { number: nextNumber, text: '' }]
        };
      }
      return cat;
    });
    handleUpdateAvatar(activeAvatar.id, { placeholderCategories: updatedCategories });
  };

  const handleUpdatePlaceholderOption = (categoryId: string, optionNumber: number, text: string) => {
    if (!activeAvatar) return;
    const categories = activeAvatar.placeholderCategories || [];
    const updatedCategories = categories.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          options: cat.options.map(opt =>
            opt.number === optionNumber ? { ...opt, text } : opt
          )
        };
      }
      return cat;
    });
    handleUpdateAvatar(activeAvatar.id, { placeholderCategories: updatedCategories });
  };

  const handleRemovePlaceholderOption = (categoryId: string, optionNumber: number) => {
    if (!activeAvatar) return;
    const categories = activeAvatar.placeholderCategories || [];
    const updatedCategories = categories.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          options: cat.options.filter(opt => opt.number !== optionNumber)
        };
      }
      return cat;
    });
    handleUpdateAvatar(activeAvatar.id, { placeholderCategories: updatedCategories });
  };

  const handleAddSpecificCombination = (combo?: PlaceholderCombination) => {
    if (!activeAvatar) return;
    const categories = activeAvatar.placeholderCategories || [];
    // Default combo: first option of each category
    const defaultCombo = combo || categories.map(cat =>
      cat.options.length > 0 ? cat.options[0].number : 1
    );
    const existingCombos = activeAvatar.specificCombinations || [];
    handleUpdateAvatar(activeAvatar.id, {
      specificCombinations: [...existingCombos, defaultCombo]
    });
  };

  const handleRemoveSpecificCombination = (index: number) => {
    if (!activeAvatar) return;
    const combos = activeAvatar.specificCombinations || [];
    handleUpdateAvatar(activeAvatar.id, {
      specificCombinations: combos.filter((_, i) => i !== index)
    });
  };

  const getAdvancedCombinationsPreview = (): string => {
    if (!activeAvatar) return '';
    const categories = activeAvatar.placeholderCategories || [];
    const mode = activeAvatar.generationMode || 'one_of_each';

    if (categories.length === 0) return 'Add categories to preview combinations.';

    // Calculate total possible combinations
    const totalCombinations = categories.reduce((acc, cat) =>
      acc * (cat.options.length || 1), 1
    );

    switch (mode) {
      case 'one_of_each':
        return `Will generate 1 image using first option from each category (${categories.length} placeholders)`;
      case 'sequential':
        return `Will generate ${totalCombinations} images (all combinations: ${categories.map(c => c.options.length || 0).join(' × ')})`;
      case 'random': {
        const count = activeAvatar.randomCount || 5;
        return `Will generate ${Math.min(count, totalCombinations)} random combinations from ${totalCombinations} possible`;
      }
      case 'specific': {
        const combos = activeAvatar.specificCombinations || [];
        return combos.length > 0
          ? `Will generate ${combos.length} specific combinations`
          : 'Add specific combinations to generate';
      }
      default:
        return '';
    }
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
      {/* Enable Toggle + Model Selectors */}
      <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-brand-gold/50 flex-wrap gap-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
            className="w-5 h-5 rounded border-2 border-brand-gold text-brand-gold focus:ring-brand-gold bg-slate-900"
          />
          <span className="text-brand-gold font-semibold">Enable Image Creation</span>
        </label>
        <div className="flex items-center gap-4 flex-wrap">
          {/* Image Generation Model - The model that creates images */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-brand-gold/70">Image Model:</label>
            <select
              value={settings.image_generation_model || 'gpt-image-1.5'}
              onChange={(e) => updateSettings({ image_generation_model: e.target.value })}
              className="bg-slate-900 border border-brand-gold/50 rounded px-2 py-1 text-white text-sm"
            >
              {IMAGE_GENERATION_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          {/* Prompt Assistant Model - The chat model that helps craft prompts */}
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
          {/* Prompt Guide Button */}
          <button
            onClick={() => setShowPromptGuide(true)}
            className="flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm font-medium transition"
            title="View GPT-Image-1.5 Prompting Guide"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Prompt Guide
          </button>
        </div>
      </div>

      {/* Prompt Guide Modal */}
      {showPromptGuide && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-brand-gold/50 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-brand-gold/30">
              <div>
                <h2 className="text-xl font-bold text-brand-gold">{GPT_IMAGE_PROMPT_GUIDE.title}</h2>
                <p className="text-sm text-brand-gold/60">Last updated: {GPT_IMAGE_PROMPT_GUIDE.lastUpdated}</p>
              </div>
              <button
                onClick={() => setShowPromptGuide(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              {GPT_IMAGE_PROMPT_GUIDE.sections.map((section, idx) => (
                <div key={idx} className="bg-slate-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-brand-cyan mb-3">{section.title}</h3>
                  <ul className="space-y-2">
                    {section.tips.map((tip, tipIdx) => (
                      <li key={tipIdx} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-brand-gold mt-1">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-brand-cyan mb-3">Official Documentation</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="https://platform.openai.com/docs/guides/image-generation" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                      OpenAI Image Generation Guide →
                    </a>
                  </li>
                  <li>
                    <a href="https://cookbook.openai.com/examples/multimodal/image-gen-1.5-prompting_guide" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                      GPT-Image-1.5 Prompting Guide (Cookbook) →
                    </a>
                  </li>
                  <li>
                    <a href="https://platform.openai.com/docs/api-reference/images" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                      Images API Reference →
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="p-4 border-t border-brand-gold/30 flex justify-end">
              <button
                onClick={() => setShowPromptGuide(false)}
                className="px-4 py-2 bg-brand-gold text-slate-900 rounded font-medium hover:bg-brand-gold/80 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                    Upload
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
                        <img src={img.url} alt={img.filename || `Ref ${idx + 1}`} className="w-full h-24 object-cover rounded border border-brand-gold/30" />
                        <button onClick={() => handleRemoveReference(idx)} className="absolute top-1 right-1 p-1 bg-red-600/80 rounded opacity-0 group-hover:opacity-100 transition">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-brand-gold/50 py-4">No reference images yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Logo & Action Shots (Collapsible) */}
          <div className="bg-slate-900 rounded-lg border border-pink-500/50 overflow-hidden">
            <button
              onClick={() => setIsLogoOpen(!isLogoOpen)}
              className="w-full flex items-center justify-between p-3 text-pink-400 hover:bg-slate-800/50 transition"
            >
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                Logo & Action Shots ({logoImages.length} logo, {actionShots.length} action)
              </span>
              <svg className={`w-5 h-5 transition-transform ${isLogoOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isLogoOpen && (
              <div className="p-4 border-t border-pink-500/30 space-y-4">
                {/* Logo Upload */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-pink-300 font-medium">Logo Image (the actual logo)</label>
                    <button
                      onClick={() => logoFileInputRef.current?.click()}
                      className="flex items-center gap-1 px-3 py-1 bg-pink-600 hover:bg-pink-500 rounded text-white text-xs transition"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Upload Logo
                    </button>
                    <input
                      ref={logoFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleUploadLogo(e.target.files, 'logo')}
                      className="hidden"
                    />
                  </div>
                  {logoImages.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {logoImages.map((img, idx) => {
                        const globalIdx = settings.logo_images.findIndex(i => i === img);
                        return (
                          <div key={idx} className="relative group">
                            <img src={img.url} alt={img.filename || 'Logo'} className="h-20 w-auto object-contain rounded border-2 border-pink-500/50 bg-white p-1" />
                            <button onClick={() => handleRemoveLogo(globalIdx)} className="absolute -top-2 -right-2 p-1 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-pink-300/50 italic">No logo uploaded. Use {'{logo}'} placeholder in prompts.</p>
                  )}
                </div>

                {/* Action Shots */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-pink-300 font-medium">Action Shots (logo on shirts, vehicles, etc.)</label>
                    <button
                      onClick={() => actionShotsInputRef.current?.click()}
                      className="flex items-center gap-1 px-3 py-1 bg-pink-600 hover:bg-pink-500 rounded text-white text-xs transition"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Upload Action Shots
                    </button>
                    <input
                      ref={actionShotsInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleUploadLogo(e.target.files, 'action')}
                      className="hidden"
                    />
                  </div>
                  {actionShots.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {actionShots.map((img, idx) => {
                        const globalIdx = settings.logo_images.findIndex(i => i === img);
                        return (
                          <div key={idx} className="relative group">
                            <img src={img.url} alt={img.filename || `Action ${idx + 1}`} className="w-full h-20 object-cover rounded border border-pink-500/30" />
                            <button onClick={() => handleRemoveLogo(globalIdx)} className="absolute top-1 right-1 p-1 bg-red-600/80 rounded opacity-0 group-hover:opacity-100 transition">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-pink-300/50 italic">Upload photos showing the logo on dark blue shirts from different angles.</p>
                  )}
                </div>

                <p className="text-xs text-pink-300/70 bg-pink-900/30 p-2 rounded">
                  <strong>Tip:</strong> These images help AI understand your brand. Use <code className="bg-pink-900/50 px-1 rounded">{'{logo}'}</code> in prompts to reference the logo placement.
                </p>
              </div>
            )}
          </div>

          {/* Audience Avatars */}
          <div className="bg-slate-900 p-4 rounded-lg border border-brand-gold/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-brand-gold font-semibold">Audience Avatars</h3>
                {tags.length > 0 && (
                  <span className="text-xs text-brand-cyan/70 bg-brand-cyan/10 px-2 py-0.5 rounded">
                    Synced with Tag Manager: {tags.map(t => t.name).join(', ')}
                  </span>
                )}
              </div>
              <button onClick={handleAddAvatar} className="text-brand-cyan hover:text-brand-cyan-light text-sm font-medium transition">+ Add Avatar</button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {settings.audience_avatars.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => setActiveAvatarId(avatar.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeAvatarId === avatar.id ? 'bg-brand-gold text-slate-900' : 'bg-slate-800 text-brand-gold hover:bg-slate-700'}`}
                >
                  <span>{avatar.name}{avatar.tag ? ` (${avatar.tag})` : ''}</span>
                  {settings.audience_avatars.length > 1 && !avatar.tag && (
                    <span onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(avatar.id); }} className="hover:text-red-500 cursor-pointer">&times;</span>
                  )}
                  {avatar.tag && (
                    <span className="bg-brand-cyan/20 text-brand-cyan text-[10px] px-1.5 rounded">TAG</span>
                  )}
                </button>
              ))}
            </div>

            {activeAvatar && (
              <div className="space-y-3">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-brand-gold/70 mb-1">Avatar Name</label>
                    <input
                      type="text"
                      value={activeAvatar.name}
                      onChange={(e) => handleUpdateAvatar(activeAvatar.id, { name: e.target.value })}
                      className="w-full bg-slate-900 border border-brand-gold/50 rounded px-3 py-2 text-white text-sm"
                    />
                  </div>
                  {/* Mode Toggle */}
                  <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
                    <button
                      onClick={() => handleUpdateAvatar(activeAvatar.id, { placeholderMode: 'simple' })}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition ${(activeAvatar.placeholderMode || 'simple') === 'simple' ? 'bg-brand-cyan text-slate-900' : 'text-brand-gold/70 hover:text-brand-gold'}`}
                    >
                      Simple
                    </button>
                    <button
                      onClick={() => handleUpdateAvatar(activeAvatar.id, { placeholderMode: 'advanced' })}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition ${activeAvatar.placeholderMode === 'advanced' ? 'bg-purple-600 text-white' : 'text-brand-gold/70 hover:text-brand-gold'}`}
                    >
                      Advanced
                    </button>
                  </div>
                </div>

                {/* Main Prompt - shown in both modes */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-brand-gold/70">
                      Main Prompt {(activeAvatar.placeholderMode || 'simple') === 'simple' ? `(use {'{variation}'} placeholder)` : '(use placeholder categories below)'}
                    </label>
                    {(activeAvatar.placeholderMode || 'simple') === 'simple' && (
                      <button onClick={insertVariationPlaceholder} className="text-xs text-brand-cyan hover:text-brand-cyan-light">+ Insert {'{variation}'}</button>
                    )}
                  </div>
                  <textarea
                    ref={mainPromptRef}
                    value={activeAvatar.mainPrompt}
                    onChange={(e) => handleUpdateAvatar(activeAvatar.id, { mainPrompt: e.target.value })}
                    rows={4}
                    className="w-full bg-slate-900 border border-brand-gold/50 rounded px-3 py-2 text-white text-sm font-mono resize-y"
                    placeholder={activeAvatar.placeholderMode === 'advanced'
                      ? "Professional photo of {Gender_Age} {Cleaning_Item}, bright natural lighting..."
                      : "Professional cleaning photo, {variation}, bright natural lighting..."}
                  />
                  {/* Insert placeholder tags */}
                  {(activeAvatar.placeholderMode || 'simple') === 'simple' && activeAvatar.variations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs text-brand-gold/50">Click to insert:</span>
                      {activeAvatar.variations.map(v => (
                        <button
                          key={v.id}
                          onClick={() => insertVariationTag(v.name)}
                          className="px-2 py-0.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 rounded text-purple-300 text-xs transition"
                        >
                          {`{${v.name}}`}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Insert placeholder category tags for advanced mode */}
                  {activeAvatar.placeholderMode === 'advanced' && (activeAvatar.placeholderCategories || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs text-brand-gold/50">Click to insert:</span>
                      {(activeAvatar.placeholderCategories || []).map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            if (!mainPromptRef.current) return;
                            const textarea = mainPromptRef.current;
                            const start = textarea.selectionStart;
                            const text = activeAvatar.mainPrompt;
                            const newText = text.substring(0, start) + cat.placeholder + text.substring(start);
                            handleUpdateAvatar(activeAvatar.id, { mainPrompt: newText });
                          }}
                          className="px-2 py-0.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 rounded text-purple-300 text-xs transition"
                        >
                          {cat.placeholder}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ========== ADVANCED MODE: Placeholder Categories ========== */}
                {activeAvatar.placeholderMode === 'advanced' && (
                  <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-purple-300 font-medium">Placeholder Categories</label>
                      <button
                        onClick={() => handleAddPlaceholderCategory()}
                        className="px-2 py-1 bg-purple-600/50 hover:bg-purple-600 rounded text-white text-xs transition"
                      >
                        + Add Category
                      </button>
                    </div>

                    {/* Category List */}
                    {(activeAvatar.placeholderCategories || []).map((category, catIndex) => (
                      <div key={category.id} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={category.name}
                            onChange={(e) => handleUpdatePlaceholderCategory(category.id, { name: e.target.value, placeholder: `{${e.target.value.replace(/\s+/g, '_')}}` })}
                            className="flex-1 bg-slate-900 border border-purple-500/50 rounded px-2 py-1 text-white text-sm"
                            placeholder="Category name (e.g., Cleaning_Item)"
                          />
                          <span className="text-xs text-purple-400 font-mono">{category.placeholder}</span>
                          <button
                            onClick={() => handleRemovePlaceholderCategory(category.id)}
                            className="p-1 bg-red-600/50 hover:bg-red-600 rounded text-white transition"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        {/* Options for this category */}
                        <div className="pl-4 space-y-1">
                          {category.options.map((option, optIndex) => (
                            <div key={option.number} className="flex items-center gap-2">
                              <span className="w-6 text-center text-xs text-purple-400 font-bold">{option.number}</span>
                              <input
                                type="text"
                                value={option.text}
                                onChange={(e) => handleUpdatePlaceholderOption(category.id, option.number, e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                                placeholder={`Option ${option.number} text...`}
                              />
                              <button
                                onClick={() => handleRemovePlaceholderOption(category.id, option.number)}
                                className="text-red-400 hover:text-red-300 text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => handleAddPlaceholderOption(category.id)}
                            className="text-xs text-purple-400 hover:text-purple-300"
                          >
                            + Add Option
                          </button>
                        </div>
                      </div>
                    ))}

                    {(activeAvatar.placeholderCategories || []).length === 0 && (
                      <p className="text-xs text-purple-400/50 text-center py-2">No categories yet. Add one to get started.</p>
                    )}

                    {/* Generation Mode Controls */}
                    {(activeAvatar.placeholderCategories || []).length > 0 && (
                      <div className="border-t border-purple-500/30 pt-3 space-y-2">
                        <label className="text-xs text-purple-300 font-medium">Generation Mode</label>
                        <div className="flex flex-wrap gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={activeAvatar.generationMode === 'one_of_each'}
                              onChange={() => handleUpdateAvatar(activeAvatar.id, { generationMode: 'one_of_each' })}
                              className="rounded border-purple-500 text-purple-600 bg-slate-900"
                            />
                            <span className="text-xs text-white">1 of Each</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={activeAvatar.generationMode === 'sequential'}
                              onChange={() => handleUpdateAvatar(activeAvatar.id, { generationMode: 'sequential' })}
                              className="rounded border-purple-500 text-purple-600 bg-slate-900"
                            />
                            <span className="text-xs text-white">Sequential</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={activeAvatar.generationMode === 'random'}
                              onChange={() => handleUpdateAvatar(activeAvatar.id, { generationMode: 'random' })}
                              className="rounded border-purple-500 text-purple-600 bg-slate-900"
                            />
                            <span className="text-xs text-white">Random</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={activeAvatar.generationMode === 'specific'}
                              onChange={() => handleUpdateAvatar(activeAvatar.id, { generationMode: 'specific' })}
                              className="rounded border-purple-500 text-purple-600 bg-slate-900"
                            />
                            <span className="text-xs text-white">Specific</span>
                          </label>
                        </div>

                        {/* Specific Combinations Table */}
                        {activeAvatar.generationMode === 'specific' && (
                          <div className="bg-slate-900/50 rounded p-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-purple-400">Specific Combinations</span>
                              <button
                                onClick={() => handleAddSpecificCombination()}
                                className="text-xs text-purple-400 hover:text-purple-300"
                              >
                                + Add Combination
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(activeAvatar.specificCombinations || []).map((combo, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600/30 rounded text-xs text-white">
                                  ({combo.join(', ')})
                                  <button
                                    onClick={() => handleRemoveSpecificCombination(idx)}
                                    className="text-red-400 hover:text-red-300"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                            {/* Quick add input */}
                            <input
                              type="text"
                              placeholder="Add combo (e.g., 3,2) and press Enter"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const input = e.target as HTMLInputElement;
                                  const combo = input.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                                  if (combo.length > 0) {
                                    handleAddSpecificCombination(combo);
                                    input.value = '';
                                  }
                                }
                              }}
                              className="w-full bg-slate-900 border border-purple-500/30 rounded px-2 py-1 text-white text-xs"
                            />
                          </div>
                        )}

                        {/* Random count */}
                        {activeAvatar.generationMode === 'random' && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-purple-400">Generate count:</span>
                            <input
                              type="number"
                              min="1"
                              value={activeAvatar.randomCount || 5}
                              onChange={(e) => handleUpdateAvatar(activeAvatar.id, { randomCount: parseInt(e.target.value) || 5 })}
                              className="w-16 bg-slate-900 border border-purple-500/30 rounded px-2 py-1 text-white text-xs"
                            />
                          </div>
                        )}

                        {/* Preview of combinations */}
                        <div className="text-xs text-purple-400/70">
                          {getAdvancedCombinationsPreview()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ========== SIMPLE MODE: Variations ========== */}
                {(activeAvatar.placeholderMode || 'simple') === 'simple' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs text-brand-gold/70">Variations</label>
                    <button onClick={handleAddVariation} className="text-brand-cyan hover:text-brand-cyan-light text-xs font-medium transition">+ Add Variation</button>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {activeAvatar.variations.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setActiveVariationId(activeVariationId === v.id ? null : v.id)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition ${activeVariationId === v.id ? 'bg-brand-cyan text-slate-900' : 'bg-slate-800 text-brand-gold hover:bg-slate-700'}`}
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
                          <button onClick={() => handleCopyMainToVariation(variation.id)} className="px-2 py-1.5 bg-purple-600/50 hover:bg-purple-600 rounded text-white text-xs transition" title="Copy main prompt">
                            Copy Main
                          </button>
                          <button onClick={() => handleRemoveVariation(variation.id)} className="p-1.5 bg-red-600/50 hover:bg-red-600 rounded text-white transition">
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
                          placeholder="Variation-specific text (e.g., person cleaning kitchen sink)"
                        />
                        <div className="text-xs text-brand-gold/50 bg-slate-900/50 p-2 rounded">
                          <strong>Preview:</strong> {buildFinalPrompt(activeAvatar.mainPrompt, variation.prompt).substring(0, 100)}...
                        </div>
                        <button
                          onClick={() => handleGenerateSingle(variation)}
                          disabled={generating}
                          className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 rounded text-white text-sm font-medium transition"
                        >
                          {generating ? 'Generating...' : 'Generate This Variation'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
                )}
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
                <div ref={chatContainerRef} className="h-64 overflow-y-auto p-4 space-y-3">
                  {settings.chat_history.length === 0 ? (
                    <p className="text-center text-brand-gold/50 py-8">Chat with AI to help craft prompts.</p>
                  ) : (
                    settings.chat_history.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-brand-cyan/20 border border-brand-cyan/50' : 'bg-slate-800 border border-brand-gold/30'}`}>
                          {msg.images && msg.images.length > 0 && (
                            <div className="flex gap-2 mb-2">
                              {msg.images.map((img, i) => (<img key={i} src={img} alt="" className="w-16 h-16 object-cover rounded" />))}
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
                        <button onClick={() => setChatImages(chatImages.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-xs">&times;</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-4 border-t border-brand-gold/30 flex gap-2">
                  <button onClick={() => chatFileInputRef.current?.click()} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-brand-gold transition" title="Attach Image">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  </button>
                  <input ref={chatFileInputRef} type="file" multiple accept="image/*" onChange={(e) => handleChatImageUpload(e.target.files)} className="hidden" />
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendChat()} placeholder="Ask about image prompts..." className="flex-1 bg-slate-900 border border-brand-gold/50 rounded px-3 py-2 text-white text-sm" />
                  <button onClick={handleSendChat} disabled={chatLoading || (!chatInput.trim() && chatImages.length === 0)} className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan-dark disabled:bg-slate-600 rounded text-slate-900 font-medium text-sm transition">Send</button>
                </div>
              </div>
            )}
          </div>

          {/* ========== DUAL CHAT SYSTEM ========== */}

          {/* Consultant Chat - Strategic Partner with Vision */}
          <div className="bg-slate-900 rounded-lg border-2 border-indigo-500/70 overflow-hidden">
            <button
              onClick={() => setIsConsultantChatOpen(!isConsultantChatOpen)}
              className="w-full flex items-center justify-between p-3 text-indigo-400 hover:bg-slate-800/50 transition"
            >
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Consultant Chat (Vision AI)
                {IMAGE_CAPABLE_MODELS.includes(settings.consultant_model) && (
                  <span className="bg-indigo-600/40 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded">CAN SEE IMAGES</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-indigo-300/70">{settings.consultant_chat_history.length} msgs</span>
                <svg className={`w-5 h-5 transition-transform ${isConsultantChatOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {isConsultantChatOpen && (
              <div className="border-t border-indigo-500/30">
                {/* Model selector and controls */}
                <div className="p-3 bg-indigo-900/20 border-b border-indigo-500/30 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-indigo-300">Model:</label>
                    <select
                      value={settings.consultant_model}
                      onChange={(e) => updateSettings({ consultant_model: e.target.value })}
                      className="bg-slate-800 border border-indigo-500/50 rounded px-2 py-1 text-white text-xs"
                    >
                      {AVAILABLE_MODELS.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} {IMAGE_CAPABLE_MODELS.includes(m.id) ? '👁️' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSyncConsultantToWorker()}
                      className="px-2 py-1 bg-emerald-600/50 hover:bg-emerald-600 rounded text-white text-xs transition flex items-center gap-1"
                      title="Sync consultant decisions to worker chat"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Sync to Worker
                    </button>
                    <button
                      onClick={() => handleClearChatHistory('consultant')}
                      className="px-2 py-1 bg-red-600/50 hover:bg-red-600 rounded text-white text-xs transition"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Context info panel */}
                <div className="px-3 py-2 bg-indigo-900/10 border-b border-indigo-500/20 text-xs text-indigo-300/70">
                  <strong>Context:</strong> {settings.reference_images.length} ref images, {logoImages.length} logo, {actionShots.length} action shots, {availableImages.length} bank images •
                  This AI can see your images and help dial in your style.
                </div>

                {/* Chat messages */}
                <div ref={consultantChatRef} className="h-72 overflow-y-auto p-4 space-y-3">
                  {settings.consultant_chat_history.length === 0 ? (
                    <div className="text-center text-indigo-300/50 py-8 space-y-2">
                      <p className="text-lg">🎨 Image Style Consultant</p>
                      <p className="text-sm">Discuss your brand, show reference images, and dial in the perfect style.</p>
                      <p className="text-xs text-indigo-400/50">This chat automatically sees your uploaded images for context.</p>
                    </div>
                  ) : (
                    settings.consultant_chat_history.filter(m => m.role !== 'system').map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-indigo-600/30 border border-indigo-500/50' : 'bg-slate-800 border border-indigo-400/30'}`}>
                          {msg.images && msg.images.length > 0 && (
                            <div className="flex gap-2 mb-2 flex-wrap">
                              {msg.images.map((img, i) => (<img key={i} src={img} alt="" className="w-16 h-16 object-cover rounded" />))}
                            </div>
                          )}
                          <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {consultantLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800 border border-indigo-400/30 rounded-lg p-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Attached images preview */}
                {consultantImages.length > 0 && (
                  <div className="px-4 py-2 border-t border-indigo-500/30 flex gap-2 flex-wrap">
                    {consultantImages.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img src={img} alt="" className="w-12 h-12 object-cover rounded" />
                        <button onClick={() => setConsultantImages(consultantImages.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-xs">&times;</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input area */}
                <div className="p-4 border-t border-indigo-500/30 flex gap-2">
                  <button onClick={() => consultantFileInputRef.current?.click()} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-indigo-400 transition" title="Attach Image">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  </button>
                  <input ref={consultantFileInputRef} type="file" multiple accept="image/*" onChange={(e) => handleDualChatImageUpload(e.target.files, 'consultant')} className="hidden" />
                  <input
                    type="text"
                    value={consultantInput}
                    onChange={(e) => setConsultantInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendConsultantChat()}
                    placeholder="Discuss image style, branding, composition..."
                    className="flex-1 bg-slate-900 border border-indigo-500/50 rounded px-3 py-2 text-white text-sm"
                  />
                  <button
                    onClick={handleSendConsultantChat}
                    disabled={consultantLoading || (!consultantInput.trim() && consultantImages.length === 0)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 rounded text-white font-medium text-sm transition"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Worker Chat - Operational Helper */}
          <div className="bg-slate-900 rounded-lg border-2 border-emerald-500/70 overflow-hidden">
            <button
              onClick={() => setIsWorkerChatOpen(!isWorkerChatOpen)}
              className="w-full flex items-center justify-between p-3 text-emerald-400 hover:bg-slate-800/50 transition"
            >
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Worker Chat (Operations)
                {settings.consultant_chat_history.length > 0 && (
                  <span className="bg-emerald-600/40 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded">SEES CONSULTANT</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-300/70">{settings.worker_chat_history.length} msgs</span>
                <svg className={`w-5 h-5 transition-transform ${isWorkerChatOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {isWorkerChatOpen && (
              <div className="border-t border-emerald-500/30">
                {/* Model selector and controls */}
                <div className="p-3 bg-emerald-900/20 border-b border-emerald-500/30 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-emerald-300">Model:</label>
                    <select
                      value={settings.worker_model}
                      onChange={(e) => updateSettings({ worker_model: e.target.value })}
                      className="bg-slate-800 border border-emerald-500/50 rounded px-2 py-1 text-white text-xs"
                    >
                      {AVAILABLE_MODELS.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} {IMAGE_CAPABLE_MODELS.includes(m.id) ? '👁️' : ''}
                        </option>
                      ))}
                    </select>
                    {settings.consultant_chat_history.length > 0 && (
                      <span className="text-xs text-emerald-400/60">
                        (has {settings.consultant_chat_history.length} consultant messages for context)
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleClearChatHistory('worker')}
                    className="px-2 py-1 bg-red-600/50 hover:bg-red-600 rounded text-white text-xs transition"
                  >
                    Clear
                  </button>
                </div>

                {/* Context info panel */}
                <div className="px-3 py-2 bg-emerald-900/10 border-b border-emerald-500/20 text-xs text-emerald-300/70">
                  <strong>Setup:</strong> {activeAvatar?.name || 'No avatar'} with {activeAvatar?.variations.length || 0} variations •
                  {availableImages.length} images in bank •
                  This AI helps organize and distribute prompts.
                </div>

                {/* Chat messages */}
                <div ref={workerChatRef} className="h-72 overflow-y-auto p-4 space-y-3">
                  {settings.worker_chat_history.length === 0 ? (
                    <div className="text-center text-emerald-300/50 py-8 space-y-2">
                      <p className="text-lg">⚙️ Operations Worker</p>
                      <p className="text-sm">Organize prompts, schedule variations, and manage the workflow.</p>
                      <p className="text-xs text-emerald-400/50">This chat has access to your consultant's decisions and full setup.</p>
                    </div>
                  ) : (
                    settings.worker_chat_history.filter(m => m.role !== 'system').map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-emerald-600/30 border border-emerald-500/50' : 'bg-slate-800 border border-emerald-400/30'}`}>
                          {msg.images && msg.images.length > 0 && (
                            <div className="flex gap-2 mb-2 flex-wrap">
                              {msg.images.map((img, i) => (<img key={i} src={img} alt="" className="w-16 h-16 object-cover rounded" />))}
                            </div>
                          )}
                          <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {workerLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800 border border-emerald-400/30 rounded-lg p-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Attached images preview */}
                {workerImages.length > 0 && (
                  <div className="px-4 py-2 border-t border-emerald-500/30 flex gap-2 flex-wrap">
                    {workerImages.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img src={img} alt="" className="w-12 h-12 object-cover rounded" />
                        <button onClick={() => setWorkerImages(workerImages.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-xs">&times;</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input area */}
                <div className="p-4 border-t border-emerald-500/30 flex gap-2">
                  <button onClick={() => workerFileInputRef.current?.click()} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-emerald-400 transition" title="Attach Image">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  </button>
                  <input ref={workerFileInputRef} type="file" multiple accept="image/*" onChange={(e) => handleDualChatImageUpload(e.target.files, 'worker')} className="hidden" />
                  <input
                    type="text"
                    value={workerInput}
                    onChange={(e) => setWorkerInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendWorkerChat()}
                    placeholder="Organize prompts, plan variations, manage workflow..."
                    className="flex-1 bg-slate-900 border border-emerald-500/50 rounded px-3 py-2 text-white text-sm"
                  />
                  <button
                    onClick={handleSendWorkerChat}
                    disabled={workerLoading || (!workerInput.trim() && workerImages.length === 0)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 rounded text-white font-medium text-sm transition"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Batch Generate (Collapsible) */}
          <div className="bg-slate-900 rounded-lg border border-green-500/50 overflow-hidden">
            <button onClick={() => setIsBatchOpen(!isBatchOpen)} className="w-full flex items-center justify-between p-3 text-green-400 hover:bg-slate-800/50 transition">
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                Batch Generate Images
              </span>
              <svg className={`w-5 h-5 transition-transform ${isBatchOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isBatchOpen && (
              <div className="p-4 border-t border-green-500/30 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-brand-gold/70">Quantity per variation:</label>
                  <input type="range" min="1" max="20" value={batchQuantity} onChange={(e) => setBatchQuantity(parseInt(e.target.value))} className="flex-1 accent-green-500" />
                  <span className="text-green-400 font-bold w-8 text-center">{batchQuantity}</span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-brand-gold/70">Select Variations:</label>
                    <button onClick={selectAllVariations} className="text-xs text-brand-cyan hover:text-brand-cyan-light">Select All</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeAvatar?.variations.map((v) => (
                      <label key={v.id} className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs cursor-pointer transition ${selectedVariations.has(v.id) ? 'bg-green-500 text-slate-900' : 'bg-slate-800 text-brand-gold border border-brand-gold/50'}`}>
                        <input type="checkbox" checked={selectedVariations.has(v.id)} onChange={() => toggleVariationSelection(v.id)} className="hidden" />
                        {v.name}
                      </label>
                    ))}
                  </div>
                </div>
                <button onClick={handleBatchGenerate} disabled={generating || selectedVariations.size === 0} className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 rounded text-white font-bold transition">
                  {generating ? 'Generating...' : `Generate ${selectedVariations.size * batchQuantity} Images`}
                </button>
              </div>
            )}
          </div>

          {/* Image Bank (Collapsible) */}
          <div className="bg-slate-900 rounded-lg border border-brand-cyan/50 overflow-hidden">
            <button onClick={() => setIsBankOpen(!isBankOpen)} className="w-full flex items-center justify-between p-3 text-brand-cyan hover:bg-slate-800/50 transition">
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Image Bank ({availableImages.length} available)
              </span>
              <svg className={`w-5 h-5 transition-transform ${isBankOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isBankOpen && (
              <div className="p-4 border-t border-brand-cyan/30 space-y-3">
                {/* Upload and Auto-tag Controls */}
                <div className="flex gap-3 flex-wrap items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-brand-cyan/20">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => bankUploadInputRef.current?.click()}
                      disabled={uploadingToBank}
                      className="px-3 py-1.5 bg-brand-cyan hover:bg-brand-cyan-dark disabled:bg-slate-600 rounded text-slate-900 text-xs font-medium transition flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      {uploadingToBank ? 'Uploading...' : 'Upload Images'}
                    </button>
                    <input
                      ref={bankUploadInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleBankUpload(e.target.files)}
                      className="hidden"
                    />
                    <button
                      onClick={() => setShowCategoryManager(!showCategoryManager)}
                      className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-white text-xs transition flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
                      Categories
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-brand-gold/70">Auto-tag:</label>
                    <button
                      onClick={() => updateSettings({ auto_tag_enabled: !settings.auto_tag_enabled })}
                      className={`relative w-10 h-5 rounded-full transition ${settings.auto_tag_enabled ? 'bg-brand-cyan' : 'bg-slate-600'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${settings.auto_tag_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    {autoTagging && <span className="text-xs text-brand-cyan animate-pulse">Tagging...</span>}
                  </div>
                </div>

                {/* Category Manager (collapsible) */}
                {showCategoryManager && (
                  <div className="bg-slate-800/30 p-3 rounded-lg border border-brand-gold/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-brand-gold font-medium">Manage Categories</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newCategoryInput}
                          onChange={(e) => setNewCategoryInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                          placeholder="New category..."
                          className="bg-slate-900 border border-brand-gold/50 rounded px-2 py-1 text-white text-xs w-32"
                        />
                        <button onClick={handleAddCategory} className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-white text-xs">Add</button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {settings.image_categories.map(cat => (
                        <span key={cat} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700 rounded text-xs text-white">
                          {cat}
                          {cat !== 'Other' && (
                            <button onClick={() => handleRemoveCategory(cat)} className="text-red-400 hover:text-red-300">&times;</button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filter and Sort Controls */}
                <div className="flex gap-3 flex-wrap items-center justify-between">
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-brand-gold/70">Variation:</label>
                      <select value={bankFilter} onChange={(e) => setBankFilter(e.target.value)} className="bg-slate-800 border border-brand-gold/50 rounded px-2 py-1 text-white text-xs">
                        <option value="all">All</option>
                        {uniqueVariations.map(v => (<option key={v} value={v}>{v}</option>))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-brand-gold/70">Category:</label>
                      <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-slate-800 border border-brand-gold/50 rounded px-2 py-1 text-white text-xs">
                        <option value="all">All</option>
                        {settings.image_categories.map(c => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-brand-gold/70">Sort:</label>
                      <select value={bankSort} onChange={(e) => setBankSort(e.target.value as any)} className="bg-slate-800 border border-brand-gold/50 rounded px-2 py-1 text-white text-xs">
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="variation">Variation</option>
                      </select>
                    </div>
                  </div>
                  {/* Bulk Download Controls */}
                  <div className="flex items-center gap-2">
                    {selectedForDownload.size > 0 ? (
                      <>
                        <span className="text-xs text-brand-cyan">{selectedForDownload.size} selected</span>
                        <button onClick={handleBulkDownload} className="px-2 py-1 bg-brand-cyan hover:bg-brand-cyan-dark rounded text-slate-900 text-xs font-medium transition flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Download
                        </button>
                        <button onClick={clearDownloadSelection} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-xs transition">Clear</button>
                      </>
                    ) : (
                      <button onClick={selectAllForDownload} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-xs transition">Select All</button>
                    )}
                  </div>
                </div>

                {/* Image Grid */}
                {availableImages.length > 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    {availableImages.map((img) => (
                      <div key={img.id} className={`relative group cursor-pointer ${selectedForDownload.has(img.id) ? 'ring-2 ring-brand-cyan' : ''}`}>
                        {/* Title label at top - editable */}
                        <div
                          className="absolute top-0 left-0 right-0 z-10 bg-slate-900/90 border-b border-brand-cyan/30 px-1.5 py-0.5 rounded-t"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {editingImageId === img.id ? (
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => handleUpdateImageTitle(img.id, editingTitle)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateImageTitle(img.id, editingTitle);
                                if (e.key === 'Escape') { setEditingImageId(null); setEditingTitle(''); }
                              }}
                              autoFocus
                              className="w-full bg-transparent border-none text-[10px] text-white focus:outline-none"
                            />
                          ) : (
                            <div
                              onClick={() => { setEditingImageId(img.id); setEditingTitle(img.title || ''); }}
                              className="text-[10px] text-white truncate cursor-text hover:text-brand-cyan"
                              title="Click to edit title"
                            >
                              {img.title || img.variation}
                            </div>
                          )}
                        </div>
                        {/* Selection checkbox */}
                        <div className="absolute top-5 left-1 z-10">
                          <input
                            type="checkbox"
                            checked={selectedForDownload.has(img.id)}
                            onChange={() => toggleDownloadSelection(img.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-2 border-brand-cyan text-brand-cyan focus:ring-brand-cyan bg-slate-900/80"
                          />
                        </div>
                        {/* Category badge */}
                        {img.category && img.category !== 'Other' && (
                          <div className="absolute top-5 right-1 z-10">
                            <select
                              value={img.category || 'Other'}
                              onChange={(e) => { e.stopPropagation(); handleUpdateImageCategory(img.id, e.target.value); }}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-purple-600/80 text-white text-[9px] px-1 py-0.5 rounded border-none cursor-pointer appearance-none"
                              style={{ minWidth: 'auto', paddingRight: '0.5rem' }}
                            >
                              {settings.image_categories.map(c => (<option key={c} value={c}>{c}</option>))}
                            </select>
                          </div>
                        )}
                        {/* Image - click to preview */}
                        <img
                          src={img.url}
                          alt={img.title || img.variation}
                          className="w-full h-24 object-cover rounded-b border border-brand-cyan/30 pt-4"
                          onClick={() => setPreviewImage(img)}
                        />
                        {/* Hover overlay with actions */}
                        <div className="absolute inset-0 top-4 bg-black/70 opacity-0 group-hover:opacity-100 transition rounded-b flex flex-col items-center justify-center p-1 gap-1">
                          <span className="text-[10px] text-white font-semibold">{img.variation}</span>
                          <div className="flex gap-1 flex-wrap justify-center">
                            <button onClick={() => setPreviewImage(img)} className="px-2 py-0.5 bg-blue-600/80 rounded text-white text-[10px]">Expand</button>
                            <button onClick={() => handleDownloadImage(img)} className="px-2 py-0.5 bg-brand-cyan/80 rounded text-slate-900 text-[10px] font-medium">Download</button>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => handleMarkAsUsed(img.id, 'manual')} className="px-2 py-0.5 bg-green-600/80 rounded text-white text-[10px]">Used</button>
                            <button onClick={() => handleRemoveFromBank(img.id)} className="px-2 py-0.5 bg-red-600/80 rounded text-white text-[10px]">Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-brand-gold/50 mb-2">No available images.</p>
                    <button
                      onClick={() => bankUploadInputRef.current?.click()}
                      className="px-4 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-brand-cyan/50 rounded text-brand-cyan text-sm transition"
                    >
                      Upload your first images
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Used/Archive (Collapsible) */}
          <div className="bg-slate-900 rounded-lg border border-purple-500/50 overflow-hidden">
            <button onClick={() => setIsUsedOpen(!isUsedOpen)} className="w-full flex items-center justify-between p-3 text-purple-400 hover:bg-slate-800/50 transition">
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                Used/Archive ({usedImages.length})
              </span>
              <svg className={`w-5 h-5 transition-transform ${isUsedOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isUsedOpen && (
              <div className="p-4 border-t border-purple-500/30 space-y-3">
                {usedImages.length > 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    {usedImages.map((img) => (
                      <div key={img.id} className="relative group">
                        <img src={img.url} alt={img.variation} className="w-full h-24 object-cover rounded border border-purple-500/30 opacity-70" />
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-purple-600/90 rounded text-[9px] text-white">USED</div>
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition rounded flex flex-col items-center justify-center p-1 gap-1">
                          <span className="text-[10px] text-white font-semibold">{img.variation}</span>
                          {img.usedOn && <a href={img.usedOn} target="_blank" rel="noopener noreferrer" className="text-[9px] text-brand-cyan underline">View Page</a>}
                          <button onClick={() => handleRestoreFromUsed(img.id)} className="px-2 py-0.5 bg-brand-cyan/80 rounded text-slate-900 text-[10px] font-medium">Restore</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-brand-gold/50 py-4">No used images.</p>
                )}
              </div>
            )}
          </div>

          {/* Variation Order for Page Integration (Collapsible) */}
          <div className="bg-slate-900 rounded-lg border border-orange-500/50 overflow-hidden">
            <button onClick={() => setIsOrderOpen(!isOrderOpen)} className="w-full flex items-center justify-between p-3 text-orange-400 hover:bg-slate-800/50 transition">
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                Variation Order ({settings.manual_variation_order?.length || 0} set)
              </span>
              <svg className={`w-5 h-5 transition-transform ${isOrderOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isOrderOpen && (
              <div className="p-4 border-t border-orange-500/30 space-y-3">
                <p className="text-xs text-brand-gold/70">Click variations in the order you want them used on pages. Each page gets unique variations.</p>

                <div className="flex items-center gap-3 mb-2">
                  <label className="text-xs text-brand-gold/70">Mode:</label>
                  <select
                    value={settings.variation_order_mode || 'sequential'}
                    onChange={(e) => updateSettings({ variation_order_mode: e.target.value as any })}
                    className="bg-slate-800 border border-brand-gold/50 rounded px-2 py-1 text-white text-xs"
                  >
                    <option value="sequential">Sequential (1, 2, 3...)</option>
                    <option value="random">Random (no duplicates)</option>
                    <option value="manual">Manual Order Below</option>
                  </select>
                  {settings.variation_order_mode === 'manual' && (
                    <button onClick={clearVariationOrder} className="text-xs text-red-400 hover:text-red-300">Clear Order</button>
                  )}
                </div>

                {settings.variation_order_mode === 'manual' && (
                  <div className="flex flex-wrap gap-2">
                    {activeAvatar?.variations.map((v) => {
                      const orderNum = getVariationOrderNumber(v.id);
                      return (
                        <button
                          key={v.id}
                          onClick={() => handleSetVariationOrder(v.id)}
                          className={`relative px-3 py-1.5 rounded text-xs font-medium transition ${orderNum ? 'bg-orange-500 text-slate-900' : 'bg-slate-800 text-brand-gold border border-brand-gold/50 hover:bg-slate-700'}`}
                        >
                          {orderNum && <span className="absolute -top-2 -left-2 w-5 h-5 bg-orange-700 text-white rounded-full text-[10px] flex items-center justify-center">{orderNum}</span>}
                          {v.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {settings.manual_variation_order && settings.manual_variation_order.length > 0 && settings.variation_order_mode === 'manual' && (
                  <div className="text-xs text-orange-300 bg-orange-900/30 p-2 rounded">
                    Order: {settings.manual_variation_order.map((id, idx) => {
                      const v = activeAvatar?.variations.find(v => v.id === id);
                      return v ? `${idx + 1}. ${v.name}` : '';
                    }).filter(Boolean).join(' → ')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Page Integration Controls */}
          <div className="bg-slate-900 p-4 rounded-lg border border-brand-gold/50">
            <h3 className="text-brand-gold font-semibold mb-3">Page Integration</h3>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="integration_mode" checked={settings.integration_mode === 'bank'} onChange={() => updateSettings({ integration_mode: 'bank' })} className="accent-brand-gold" />
                <span className="text-sm text-white">Pull from Bank</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="integration_mode" checked={settings.integration_mode === 'live'} onChange={() => updateSettings({ integration_mode: 'live' })} className="accent-brand-gold" />
                <span className="text-sm text-white">Generate Live</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer ml-4">
                <input type="checkbox" checked={settings.fallback_to_live} onChange={(e) => updateSettings({ fallback_to_live: e.target.checked })} className="w-4 h-4 rounded border-brand-gold text-brand-gold focus:ring-brand-gold bg-slate-900" />
                <span className="text-sm text-brand-gold/70">Generate if bank empty</span>
              </label>
            </div>
          </div>
        </>
      )}

      {saving && (
        <div className="fixed bottom-4 right-4 bg-brand-cyan text-slate-900 px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
          Saving...
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-brand-cyan transition p-2"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Image */}
            <img
              src={previewImage.url}
              alt={previewImage.variation}
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />

            {/* Info and actions bar */}
            <div className="mt-4 bg-slate-900 rounded-lg p-4 flex items-center justify-between">
              <div className="text-white">
                <p className="font-semibold">{previewImage.variation}</p>
                <p className="text-xs text-brand-gold/70 mt-1">
                  {previewImage.orientation} • {new Date(previewImage.createdAt).toLocaleDateString()}
                </p>
                {previewImage.prompt && (
                  <p className="text-xs text-gray-400 mt-2 max-w-xl truncate" title={previewImage.prompt}>
                    Prompt: {previewImage.prompt.substring(0, 100)}...
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadImage(previewImage)}
                  className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan-dark rounded text-slate-900 font-medium text-sm transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={() => { handleMarkAsUsed(previewImage.id, 'manual'); setPreviewImage(null); }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-medium text-sm transition"
                >
                  Mark as Used
                </button>
                <button
                  onClick={() => { handleRemoveFromBank(previewImage.id); setPreviewImage(null); }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-white font-medium text-sm transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageCreationSection;
