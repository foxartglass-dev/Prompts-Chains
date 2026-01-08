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

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import FeedbackPopup from './FeedbackPopup';

// Types for Feedback System
interface GeneratedImage {
  url: string;
  prompt?: string;
  position?: string;
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

interface AIQuestion {
  id: number;
  question: string;
  context?: string;
  options: string[];
}

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
  isRandomized?: boolean; // If true, pick random option instead of keyword matching
}

// An option within a category
interface PlaceholderOption {
  number: number; // 1, 2, 3...
  text: string; // "cleaning the stove burners"
  // Keyword matching system
  primaryKeywords: string[]; // Main keywords: ["stove", "burner"] - must match first
  secondaryKeywords: string[]; // Fallback keywords: ["kitchen"] - used if no primary match
  useSecondaryKeywords: boolean; // Toggle: allow secondary keyword matching for this option
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
  model?: string; // AI model that generated this image (flux-1.1-pro, seedream-4, etc.)
  used?: boolean;
  usedOn?: string;
  usedAt?: string;
  archived?: boolean; // For archive system - keeps images for future reference
  tags?: string[]; // Tags for organization
  dbId?: number; // Database ID for API calls (new table)
  wpUrl?: string; // WordPress Media Library URL
  wpMediaId?: number; // WordPress Media Library ID
}

// ========== PROMPT PROBLEM AREAS ==========
// High-priority prompting issues with multiple solution prompts

interface PromptSolution {
  id: string;
  miniContext: string; // Brief context for this specific prompt
  promptText: string; // The actual prompt technique
  status: 'testing' | 'working' | 'failed';
  notes?: string; // Optional notes on results
}

interface PromptProblemArea {
  id: string;
  name: string; // e.g., "Logo Visibility"
  context: string; // Why this is a problem, detailed explanation
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'solved'; // active = still working on it, solved = cracked it!
  prompts: PromptSolution[];
  isExpanded?: boolean; // UI state for expand/collapse
  solvedPromptId?: string; // Which prompt finally solved it
  solvedNotes?: string; // Notes on the solution
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
  timestamp: string;
}

// ========== PROMPT JOURNAL SYSTEM ==========
// Save prompts, track iterations, organize with tags/files

interface JournalEntry {
  id: string;
  prompt: string;
  imageUrl?: string;
  model: string;
  notes: string;
  tags: string[]; // For file/folder organization (e.g., ["logo", "angles"])
  seriesId?: string; // Links entries in an iteration series
  seriesPosition?: number; // Position in series (1, 2, 3...)
  isFinal?: boolean; // Is this the "winner" prompt of a series?
  createdAt: string;
  updatedAt: string;
}

interface JournalSeries {
  id: string;
  name: string;
  description?: string;
  tags: string[]; // Inherit tags to all entries
  isClosed: boolean; // Series is complete
  finalEntryId?: string; // The winning entry
  closedNotes?: string; // Notes when closing out
  createdAt: string;
  closedAt?: string;
}

// Models that support vision/images (for chat assistants)
const IMAGE_CAPABLE_MODELS = ['gpt-image-1.5', 'gpt-4o', 'gpt-5.2-2025-12-11', 'claude-sonnet-4-5-20250929', 'claude-3-5-sonnet-20241022', 'gemini-2.5-pro'];

// Image generation models (for actually creating images)
const IMAGE_GENERATION_MODELS = [
  { id: 'gpt-image-1.5', name: 'GPT-Image-1.5 (Latest)', provider: 'openai', description: 'Best quality, 20% cheaper, better text rendering' },
  { id: 'gpt-image-1', name: 'GPT-Image-1', provider: 'openai', description: 'Previous generation' },
  { id: 'gpt-image-1-mini', name: 'GPT-Image-1 Mini', provider: 'openai', description: 'Faster, lower cost' },
  { id: 'dall-e-3', name: 'DALL-E 3', provider: 'openai', description: 'Legacy model' },
  { id: 'flux-1.1-pro', name: 'FLUX 1.1 Pro (~$0.04)', provider: 'replicate', description: 'Fast, good prompt adherence' },
  { id: 'seedream-4', name: 'Seedream 4 (~$0.03)', provider: 'replicate', description: 'Best value, 4K support (ByteDance)' },
  { id: 'ideogram-v3-turbo', name: 'Ideogram v3 Turbo (~$0.04)', provider: 'replicate', description: 'Great realism, text rendering' },
];

// Image Model Prompting Guide Knowledge Base
const IMAGE_PROMPT_GUIDES = {
  'gpt-image-1.5': {
    title: 'GPT-Image-1.5 Prompting Guide',
    provider: 'OpenAI',
    lastUpdated: 'December 2025',
    pricing: 'Low: $0.011 | Medium: $0.042 | High: $0.167 per image',
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
        ]
      }
    ],
    links: [
      { name: 'OpenAI Image Generation Guide', url: 'https://platform.openai.com/docs/guides/image-generation' },
      { name: 'GPT-Image-1.5 Prompting Guide (Cookbook)', url: 'https://cookbook.openai.com/examples/multimodal/image-gen-1.5-prompting_guide' },
      { name: 'Images API Reference', url: 'https://platform.openai.com/docs/api-reference/images' },
    ]
  },
  'flux-1.1-pro': {
    title: 'Flux 1.1 Pro Prompting Guide',
    provider: 'Replicate (Black Forest Labs)',
    lastUpdated: 'December 2025',
    pricing: 'Flat rate: ~$0.04 per image (all sizes)',
    sections: [
      {
        title: 'Prompt Upsampling (Auto-Enhancement)',
        tips: [
          'Flux has built-in prompt upsampling that enhances your prompts automatically',
          'Simple prompts work well - model adds detail and quality cues',
          'Example: "cat on a couch" becomes a rich, detailed scene',
          'Good for users who want quick results without complex prompting',
        ]
      },
      {
        title: 'Photorealism',
        tips: [
          'Excels at photorealistic imagery out of the box',
          'Add lighting descriptions: "golden hour lighting", "soft studio light"',
          'Specify camera details for photo look: "DSLR photograph", "professional photography"',
          'Works well with natural, conversational descriptions',
        ]
      },
      {
        title: 'Aspect Ratios',
        tips: [
          '1:1 - Square (default, ~1024x1024)',
          '16:9 - Landscape/Wide (~1344x768)',
          '9:16 - Portrait/Vertical (~768x1344) - BEST for hero images',
          '4:3, 3:4, 3:2, 2:3 - Also supported',
        ]
      },
      {
        title: 'Style & Artistic Control',
        tips: [
          'Add style keywords: "cinematic", "editorial", "commercial photography"',
          'Describe mood: "warm and inviting", "professional and clean"',
          'Reference styles: "in the style of National Geographic", "magazine quality"',
          'Flux handles artistic and realistic styles equally well',
        ]
      },
      {
        title: 'Output Quality',
        tips: [
          'Output quality (0-100) controls WebP compression, not image detail',
          '80 is default - good balance of quality and file size',
          'Higher values = larger files, minimal visual improvement',
          'For web use, 70-80 is recommended',
        ]
      },
      {
        title: 'Best Practices',
        tips: [
          'Be descriptive but not overly complex - Flux handles natural language well',
          'Focus on subject, setting, lighting, and mood',
          'No need for negative prompts - Flux handles this automatically',
          'Fast generation time (~5-10 seconds typically)',
        ]
      }
    ],
    links: [
      { name: 'Flux 1.1 Pro on Replicate', url: 'https://replicate.com/black-forest-labs/flux-1.1-pro' },
      { name: 'Black Forest Labs', url: 'https://blackforestlabs.ai/' },
      { name: 'Replicate API Docs', url: 'https://replicate.com/docs' },
    ]
  }
};

// Legacy reference for backwards compatibility
const GPT_IMAGE_PROMPT_GUIDE = IMAGE_PROMPT_GUIDES['gpt-image-1.5'];

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
  // Image quality (low, medium, high) - low is best for websites, high for print
  image_quality: 'low' | 'medium' | 'high';
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
  // Smart Content Matching (Phase 2 feature)
  smart_matching_enabled: boolean; // Master toggle for smart content matching
  smart_matching_mode: 'bank_first' | 'generate_first' | 'bank_only' | 'generate_only';
  // bank_first: Try to find matching image in bank, generate if not found
  // generate_first: Always generate new, add to bank for future
  // bank_only: Only use existing bank images, skip if no match
  // generate_only: Always generate fresh, never use bank
  // Editable algorithm rules (user-configurable)
  placement_rule: string;
  smart_matching_rule: string;
  match_plurals: boolean; // Auto-match plurals (counter → counters, sink → sinks)
  // Editable Smart Matching Rules (the 4 core rules)
  matching_rule_1: string; // Primary keywords rule
  matching_rule_2: string; // Secondary keywords fallback rule
  matching_rule_3: string; // No duplicate primaries rule
  matching_rule_4: string; // Different primaries for secondary matches rule
  // Generate Live prompt mode
  live_prompt_mode: 'main_prompt' | 'guided_gpt' | 'smart_prompt'; // main_prompt = avatar template, guided_gpt = GPT-4o with guardrails, smart_prompt = legacy
  smart_prompt_guidance: string; // Guidance/guardrails for GPT-4o when using smart_prompt mode
  // Guided GPT mode settings
  guided_model: string; // Model for guided mode (any provider)
  guided_guardrails: {
    instructions: string; // Main guardrails
    uniformDescription: string; // Worker appearance
    stylePreferences: string; // Visual style
    avoidList: string; // Things to avoid
    defaultSubject: string; // Default subject if no match
  } | null;
  // Prompt Problem Areas - High priority prompting issues with solutions
  prompt_problem_areas: PromptProblemArea[];
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
  enabled: true, // Always enabled - no toggle needed
  prompt_assistant_model: 'gpt-4o',
  image_generation_model: 'flux-1.1-pro', // Default to Flux (gpt-image-1.5 requires org verification)
  image_quality: 'low', // Default to low for websites (17x cheaper than high, fast)
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
  manual_variation_order: [],
  // Smart Content Matching - OFF by default until user is ready
  smart_matching_enabled: false,
  smart_matching_mode: 'bank_first', // Default: check bank first, generate if no match
  // Editable algorithm rules
  placement_rule: 'Place image at last paragraph break under {300} words since previous image. Hero image on {right/left/alt}.',
  smart_matching_rule: 'Look {50-75} words around image placement for keyword matches. Match against: {placeholder_categories}.',
  match_plurals: true, // Default ON - auto-match counter/counters, sink/sinks
  // Editable Smart Matching Rules (the 4 core rules) - users can customize these
  matching_rule_1: 'Always try to match Primary Keywords first. Search for primary keywords within the word range around image placement.',
  matching_rule_2: 'If no primary match, fall back to Secondary Keywords. Only if secondary keywords are enabled for that option.',
  matching_rule_3: 'Never use the same Primary Keyword twice on a page. Each primary keyword can only appear once per article (no duplicate stove images).',
  matching_rule_4: 'Secondary keyword matches must have different primaries. If "kitchen" matches twice, each must be a different primary (stove, then sink).',
  // Generate Live prompt mode - default to smart_prompt for backwards compatibility
  live_prompt_mode: 'smart_prompt',
  smart_prompt_guidance: '', // Empty by default - user can add guardrails
  // Guided GPT mode settings
  guided_model: 'gpt-4o',
  guided_guardrails: null,
  // Prompt Problem Areas - High priority prompting issues
  prompt_problem_areas: []
};

// Chat models - for discussing/planning images (NOT gpt-image-1.5, it only generates)
const AVAILABLE_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o (Best for Image Strategy)', provider: 'openai' },
  { id: 'gpt-5.2-2025-12-11', name: 'GPT-5.2', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Faster)', provider: 'openai' },
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
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Collapsible sections - default to collapsed for cleaner UI
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [isLogoOpen, setIsLogoOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isConsultantChatOpen, setIsConsultantChatOpen] = useState(false);
  const [isWorkerChatOpen, setIsWorkerChatOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isBankOpen, setIsBankOpen] = useState(false); // Collapsed by default
  const [isUsedOpen, setIsUsedOpen] = useState(false);
  const [isOrderOpen, setIsOrderOpen] = useState(false);

  // Double opt-in confirmation for "Generate First" (save to bank) option
  const [showGenerateFirstWarning, setShowGenerateFirstWarning] = useState(false);

  // Tab for Reference Assets in Guided GPT section
  const [guidedAssetsTab, setGuidedAssetsTab] = useState<'problems' | 'reference' | 'logo'>('problems');

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
  const [isPromptPlanningSession, setIsPromptPlanningSession] = useState(false);
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
  const [batchQuality, setBatchQuality] = useState<'low' | 'medium' | 'high'>('low'); // Batch generation quality
  const [selectedVariations, setSelectedVariations] = useState<Set<string>>(new Set());

  // Bank filtering
  const [bankFilter, setBankFilter] = useState<string>('all');
  const [bankSort, setBankSort] = useState<'newest' | 'oldest' | 'variation'>('newest');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [bankFullscreen, setBankFullscreen] = useState<boolean>(false);
  const [bankViewMode, setBankViewMode] = useState<'compact' | 'gallery'>('compact'); // compact = grid, gallery = large cards

  // Draft Image Bank (in-transit images for pages)
  const [isDraftBankOpen, setIsDraftBankOpen] = useState(false);
  const [draftBankImages, setDraftBankImages] = useState<any[]>([]);
  const [draftBankStats, setDraftBankStats] = useState<{
    total: number; draft: number; sent: number; replaced: number;
    totalMade: number; totalReplaced: number; totalSent: number;
  }>({ total: 0, draft: 0, sent: 0, replaced: 0, totalMade: 0, totalReplaced: 0, totalSent: 0 });
  const [draftBankFilter, setDraftBankFilter] = useState<'all' | 'draft' | 'sent'>('all');
  const [draftBankItemTypeFilter, setDraftBankItemTypeFilter] = useState<string>('all');
  const [draftBankPageFilter, setDraftBankPageFilter] = useState<string>('all');
  const [draftBankItemTypes, setDraftBankItemTypes] = useState<{item_type: string; count: number}[]>([]);
  const [draftBankLoading, setDraftBankLoading] = useState(false);

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
  const [selectedCombinations, setSelectedCombinations] = useState<Set<string>>(new Set()); // For advanced mode batch

  // Category-based filtering for batch generation (Advanced mode)
  // Maps category ID to Set of selected option numbers
  const [selectedOptionsPerCategory, setSelectedOptionsPerCategory] = useState<Map<string, Set<number>>>(new Map());
  const [categoryFiltersOpen, setCategoryFiltersOpen] = useState<Set<string>>(new Set());

  // Extended context for Consultant Chat (articles, workflow info, etc.)
  const [consultantContext, setConsultantContext] = useState<{
    articles: any[];
    workflow: any;
    websites: any[];
    lastFetched: string | null;
  }>({ articles: [], workflow: null, websites: [], lastFetched: null });
  const [fetchingContext, setFetchingContext] = useState(false);
  const [avatarsCollapsed, setAvatarsCollapsed] = useState(true);
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(false);

  // Prompt Problem Areas state
  const [problemAreasCollapsed, setProblemAreasCollapsed] = useState(true);
  const [activeProblemAreaId, setActiveProblemAreaId] = useState<string | null>(null);
  const [editingProblemArea, setEditingProblemArea] = useState<PromptProblemArea | null>(null);

  // Guided GPT Assets Tabs - collapsed by default (rarely used)
  const [guidedAssetsCollapsed, setGuidedAssetsCollapsed] = useState(true);

  // Guided GPT Assistant Chat state
  const [guidedAssistantOpen, setGuidedAssistantOpen] = useState(false);
  const [guidedAssistantMessages, setGuidedAssistantMessages] = useState<ChatMessage[]>([]);
  const [guidedAssistantInput, setGuidedAssistantInput] = useState('');
  const [guidedAssistantImages, setGuidedAssistantImages] = useState<string[]>([]);
  const [guidedAssistantLoading, setGuidedAssistantLoading] = useState(false);
  const guidedAssistantChatRef = useRef<HTMLDivElement>(null);
  const guidedAssistantFileInputRef = useRef<HTMLInputElement>(null);
  // Chat height sizes: 'sm' = 16rem, 'md' = 24rem, 'lg' = 36rem, 'xl' = 48rem, 'full' = 80vh
  const [chatHeight, setChatHeight] = useState<'sm' | 'md' | 'lg' | 'xl' | 'full'>('md');
  const chatHeightClasses = {
    sm: 'h-64',      // 16rem
    md: 'h-96',      // 24rem
    lg: 'h-[36rem]', // 36rem
    xl: 'h-[48rem]', // 48rem
    full: 'h-[80vh]' // 80% viewport
  };

  // Loaded articles for AI context
  interface LoadedArticle {
    id: number;
    keyword: string;
    tag?: string;
    wordCount?: number;
    content: string;
    websiteName?: string;
    clientName?: string;
  }
  const [loadedArticles, setLoadedArticles] = useState<LoadedArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [articleSummary, setArticleSummary] = useState<{
    summary: Array<{ website_id: number; website_name: string; client_id: number; client_name: string; article_count: number }>;
    recentArticles: Array<{ id: number; keyword: string; tag: string; word_count: number; status: string }>;
  } | null>(null);
  const [showArticleLoader, setShowArticleLoader] = useState(false);

  // Testing Mode state - sandbox for generating test images with MULTIPLE TABS
  const [testingModeOpen, setTestingModeOpen] = useState(false);
  const [testingModeLoading, setTestingModeLoading] = useState(false);

  // Multi-tab testing system - each tab is an independent testing session
  interface TestingTab {
    id: string;
    name: string;
    prompt: string; // Current prompt in textarea
    history: Array<{ url: string; prompt: string; model: string; timestamp: string }>;
  }
  const [testingTabs, setTestingTabs] = useState<TestingTab[]>([
    { id: 'tab-1', name: 'Test 1', prompt: '', history: [] }
  ]);
  const [activeTestingTabId, setActiveTestingTabId] = useState('tab-1');
  const [editingTabName, setEditingTabName] = useState<string | null>(null);

  // Helper to get active tab
  const activeTestingTab = testingTabs.find(t => t.id === activeTestingTabId) || testingTabs[0];

  // ========== PROMPT JOURNAL STATE ==========
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalSeries, setJournalSeries] = useState<JournalSeries[]>([]);
  const [journalFilterTag, setJournalFilterTag] = useState<string | null>(null); // Filter by tag/file
  const [journalActiveSeries, setJournalActiveSeries] = useState<string | null>(null); // Current working series
  const [journalEditingEntry, setJournalEditingEntry] = useState<string | null>(null); // Entry being edited

  // Get all unique tags from journal entries
  const journalTags = useMemo(() => {
    const tags = new Set<string>();
    journalEntries.forEach(e => e.tags.forEach(t => tags.add(t)));
    journalSeries.forEach(s => s.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [journalEntries, journalSeries]);

  // Filtered journal entries
  const filteredJournalEntries = useMemo(() => {
    let entries = journalEntries;
    if (journalFilterTag) {
      entries = entries.filter(e => e.tags.includes(journalFilterTag));
    }
    return entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [journalEntries, journalFilterTag]);

  // ========== ARTICLE TESTING STATE ==========
  // For testing full page image placement with real articles
  interface ImagePlacement {
    id: string;
    position: number; // Character position in article
    paragraphIndex: number;
    wordsBefore: string; // The 50 (or N) words before
    wordsAfter: string; // The 50 (or N) words after
    matchedKeywords: string[]; // Keywords found in the zone
    suggestedPrompt?: string;
    generatedImage?: { url: string; prompt: string; model: string };
    status: 'pending' | 'generating' | 'generated' | 'saved';
  }

  interface ArticleTest {
    articleId: string;
    title: string;
    keyword: string;
    content: string;
    wordCount: number;
    placements: ImagePlacement[];
  }

  const [articleTestOpen, setArticleTestOpen] = useState(false);
  const [articleTestLoading, setArticleTestLoading] = useState(false);
  const [availableArticles, setAvailableArticles] = useState<Array<{ id: string; keyword: string; title: string; wordCount: number }>>([]);
  const [selectedArticleTest, setSelectedArticleTest] = useState<ArticleTest | null>(null);
  const [keywordRange, setKeywordRange] = useState(50); // Words to look up/down for keywords
  const [simulationRunning, setSimulationRunning] = useState(false);

  // ========== AUTO-REFINE STATE ==========
  // Autonomous refinement loop - GPT-5.2 generates, evaluates, and refines prompts
  interface AutoRefineIteration {
    iteration: number;
    prompt: string;
    imageUrl: string | null;
    evaluation: string | null; // GPT-5.2's critique
    meetsGoal: boolean;
    refinementNotes: string | null; // What GPT-5.2 will try differently
    timestamp: string;
  }

  interface AutoRefineSession {
    id: string;
    goal: string; // The criteria the image must meet
    problemArea: string; // Which problem we're trying to solve
    maxIterations: number;
    iterations: AutoRefineIteration[];
    status: 'idle' | 'running' | 'success' | 'failed' | 'stopped';
    finalPrompt: string | null;
    finalImageUrl: string | null;
    startedAt: string | null;
    completedAt: string | null;
  }

  const [autoRefineGoal, setAutoRefineGoal] = useState('');
  const [autoRefineMaxIterations, setAutoRefineMaxIterations] = useState(4);
  const [autoRefineSession, setAutoRefineSession] = useState<AutoRefineSession | null>(null);
  const [autoRefineRunning, setAutoRefineRunning] = useState(false);
  const [autoRefinePaused, setAutoRefinePaused] = useState(false);

  // Feedback popup state
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
  const [pendingFeedbackRequest, setPendingFeedbackRequest] = useState<FeedbackRequest | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState<AIQuestion[]>([]);
  const [recentGenerations, setRecentGenerations] = useState<FeedbackRequest[]>([]);
  const [feedbackGlowDismissed, setFeedbackGlowDismissed] = useState(false);

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

  // Fetch extended context when Consultant Chat is opened
  useEffect(() => {
    if (isConsultantChatOpen && workflowId) {
      fetchConsultantContext();
    }
  }, [isConsultantChatOpen, workflowId]);

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

        // Fetch image bank from new API (always use new API now)
        let imageBankData: BankImage[] = [];
        try {
          const bankRes = await fetch(`/api/image-bank/${workflowId}`);
          const bankData = await bankRes.json();
          if (bankData.success && Array.isArray(bankData.data)) {
            // Transform from DB format to frontend format
            imageBankData = bankData.data.map((img: Record<string, unknown>) => ({
              id: img.external_id || String(img.id),
              url: img.url,
              title: img.title || '',
              category: img.category || '',
              variation: img.variation_name || '',
              variationId: img.variation_id || '',
              avatarTag: img.avatar_tag || '',
              orientation: img.orientation || 'vertical',
              prompt: img.prompt || '',
              model: img.model || '',
              used: img.used || false,
              usedOn: img.used_on || '',
              usedAt: img.used_at || '',
              archived: img.archived || false,
              tags: Array.isArray(img.tags) ? img.tags : [],
              dbId: img.id // Keep the database ID for API calls
            }));
            console.log(`[Image Creation] Loaded ${imageBankData.length} images from new API`);
          }
        } catch (bankError) {
          console.error('[Image Creation] Failed to fetch image bank:', bankError);
          // Fallback to settings data if API fails
          imageBankData = data.settings.image_bank || [];
        }

        const loadedSettings = {
          ...DEFAULT_SETTINGS,
          ...data.settings,
          // Ensure arrays are arrays
          reference_images: data.settings.reference_images || [],
          logo_images: data.settings.logo_images || [],
          audience_avatars: data.settings.audience_avatars?.length > 0
            ? data.settings.audience_avatars
            : [{ id: 1, name: 'Default', mainPrompt: '', variations: [] }],
          image_bank: imageBankData,
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
          manual_variation_order: data.settings.manual_variation_order || [],
          // Prompt Problem Areas
          prompt_problem_areas: data.settings.prompt_problem_areas || []
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

  /**
   * Fetch draft image bank data and stats
   */
  const fetchDraftBank = async () => {
    if (!workflowId) return;
    setDraftBankLoading(true);
    try {
      // Build query string based on filters
      const params = new URLSearchParams();
      if (draftBankFilter !== 'all') params.append('status', draftBankFilter);
      if (draftBankItemTypeFilter !== 'all') params.append('itemType', draftBankItemTypeFilter);
      if (draftBankPageFilter !== 'all') params.append('pageKeyword', draftBankPageFilter);

      const [imagesRes, statsRes, typesRes] = await Promise.all([
        fetch(`/api/draft-image-bank/${workflowId}?${params.toString()}`),
        fetch(`/api/draft-image-bank/${workflowId}/stats`),
        fetch(`/api/draft-image-bank/${workflowId}/item-types`)
      ]);

      const [imagesData, statsData, typesData] = await Promise.all([
        imagesRes.json(),
        statsRes.json(),
        typesRes.json()
      ]);

      if (imagesData.success) {
        setDraftBankImages(imagesData.data || []);
      }
      if (statsData.success) {
        setDraftBankStats(statsData.data);
      }
      if (typesData.success) {
        setDraftBankItemTypes(typesData.data || []);
      }
    } catch (error) {
      console.error('[Draft Bank] Failed to fetch:', error);
    }
    setDraftBankLoading(false);
  };

  // Fetch draft bank when opened or filters change
  useEffect(() => {
    if (isDraftBankOpen && workflowId) {
      fetchDraftBank();
    }
  }, [isDraftBankOpen, draftBankFilter, draftBankItemTypeFilter, draftBankPageFilter, workflowId]);

  /**
   * Fetch extended context for Consultant Chat (articles, workflow, websites)
   * This gives the AI full visibility into what the user is working on
   */
  const fetchConsultantContext = async () => {
    if (!workflowId) return;

    // Don't refetch if we fetched recently (within 2 minutes)
    if (consultantContext.lastFetched) {
      const lastFetch = new Date(consultantContext.lastFetched);
      const now = new Date();
      if (now.getTime() - lastFetch.getTime() < 2 * 60 * 1000) {
        return; // Use cached context
      }
    }

    setFetchingContext(true);
    try {
      // Fetch workflow details
      const workflowRes = await fetch(`/api/workflows/${workflowId}`);
      const workflowData = await workflowRes.json();

      // Fetch articles for this workflow
      const articlesRes = await fetch(`/api/articles?workflowId=${workflowId}`);
      const articlesData = await articlesRes.json();

      // Fetch websites
      const websitesRes = await fetch('/api/websites');
      const websitesData = await websitesRes.json();

      setConsultantContext({
        workflow: workflowData.success ? workflowData.workflow : null,
        articles: articlesData.success ? articlesData.articles : [],
        websites: websitesData.success ? websitesData.websites : [],
        lastFetched: new Date().toISOString()
      });

      console.log('[Image Creation] Fetched consultant context:', {
        workflow: workflowData.workflow?.name,
        articleCount: articlesData.articles?.length || 0,
        websiteCount: websitesData.websites?.length || 0
      });
    } catch (error) {
      console.error('Failed to fetch consultant context:', error);
    }
    setFetchingContext(false);
  };

  // Debounced save to prevent rapid overwrites
  const saveSettings = useCallback(async (newSettings: ImageCreationSettings, immediate: boolean = false) => {
    if (!workflowId || !loaded) {
      console.log('[Image Creation] Skipping save - workflowId:', workflowId, 'loaded:', loaded);
      return;
    }

    // Mark as having unsaved changes
    setHasUnsavedChanges(true);

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const doSave = async () => {
      setSaving(true);
      try {
        console.log('[Image Creation] Saving settings to workflow:', workflowId);

        // IMPORTANT: Exclude image_bank from save payload since it's stored in database separately
        // This prevents the 50MB+ payload bloat issue - images are managed via /api/image-bank
        const { image_bank, ...settingsWithoutBank } = newSettings;
        const payloadJson = JSON.stringify(settingsWithoutBank);
        const payloadSizeMB = new Blob([payloadJson]).size / (1024 * 1024);

        console.log(`[Image Creation] Payload size: ${payloadSizeMB.toFixed(2)}MB (image_bank excluded - stored in DB)`);

        // Warn at 50MB, block at 90MB (server limit is 100MB)
        // These limits should rarely be hit now since image_bank is excluded
        if (payloadSizeMB > 90) {
          showNotification(`⚠️ CANNOT SAVE: Payload is ${payloadSizeMB.toFixed(1)}MB (limit: 100MB). Try clearing old chat history.`, 'error');
          setSaving(false);
          return;
        } else if (payloadSizeMB > 50) {
          showNotification(`⚠️ WARNING: Payload is ${payloadSizeMB.toFixed(1)}MB. Consider clearing old chat history or reference images.`, 'warning');
        } else if (payloadSizeMB > 30) {
          console.log(`[Image Creation] Payload size: ${payloadSizeMB.toFixed(1)}MB - getting large`);
        }

        const res = await fetch(`/api/image-creation/settings/${workflowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: payloadJson
        });

        // Check for HTTP errors BEFORE trying to parse JSON
        if (!res.ok) {
          // Handle specific HTTP error codes with helpful messages
          let errorMsg = '';
          switch (res.status) {
            case 413:
              errorMsg = `Payload too large (${res.status}): Settings data is too large. Try clearing old chat history or reducing reference images.`;
              break;
            case 500:
              errorMsg = `Server error (${res.status}): Database may be full or unavailable. Check your Neon dashboard.`;
              break;
            case 502:
            case 503:
            case 504:
              errorMsg = `Server unavailable (${res.status}): Railway may be restarting. Try again in a moment.`;
              break;
            default:
              errorMsg = `HTTP Error ${res.status}: ${res.statusText}`;
          }
          console.error('[Image Creation] Save failed with HTTP', res.status);
          showNotification(errorMsg, 'error');
          setSaving(false);
          return;
        }

        const data = await res.json();
        if (data.success) {
          onSettingsChange?.(newSettings);
          setLastSaved(new Date());
          setHasUnsavedChanges(false);
          console.log('[Image Creation] Settings saved successfully at', new Date().toLocaleTimeString());
        } else {
          console.error('[Image Creation] Save failed:', data.error);
          showNotification('Image Creation save failed: ' + data.error, 'error');
        }
      } catch (error) {
        console.error('Failed to save settings:', error);
        showNotification('Failed to save Image Creation settings: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
      }
      setSaving(false);
    };

    if (immediate) {
      await doSave();
    } else {
      // Debounce saves by 500ms
      saveTimeoutRef.current = setTimeout(doSave, 500);
    }
  }, [workflowId, loaded, onSettingsChange, showNotification]);

  // Force save - bypasses debounce
  const forceSave = useCallback(() => {
    if (!loaded) {
      showNotification('Settings not loaded yet', 'error');
      return;
    }
    saveSettings(settings, true);
  }, [settings, loaded, saveSettings, showNotification]);

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
  // Get unique models for filtering
  const uniqueModels = [...new Set(settings.image_bank.map(img => img.model).filter(Boolean))];

  // Calculate payload size for warning indicator (excludes image_bank since it's stored in DB)
  const payloadSizeMB = useMemo(() => {
    try {
      const { image_bank, ...settingsWithoutBank } = settings;
      const size = new Blob([JSON.stringify(settingsWithoutBank)]).size / (1024 * 1024);
      return size;
    } catch {
      return 0;
    }
  }, [settings]);

  // Filter and sort bank images
  const getFilteredBankImages = (includeUsed: boolean) => {
    let images = settings.image_bank.filter(img => {
      // Filter by used/available
      const usedMatch = includeUsed ? img.used : !img.used;
      // Filter by archived (show archived only when showArchived is true)
      const archivedMatch = showArchived ? img.archived : !img.archived;
      return usedMatch && archivedMatch;
    });
    // Filter by variation
    if (bankFilter !== 'all') {
      images = images.filter(img => img.variation === bankFilter);
    }
    // Filter by category
    if (categoryFilter !== 'all') {
      images = images.filter(img => img.category === categoryFilter);
    }
    // Filter by model
    if (modelFilter !== 'all') {
      images = images.filter(img => img.model === modelFilter);
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

  // Generate all possible combinations from placeholder categories (for advanced mode)
  const generatePlaceholderCombinations = useCallback(() => {
    if (!activeAvatar?.placeholderCategories || activeAvatar.placeholderCategories.length === 0) {
      return [];
    }

    const categories = activeAvatar.placeholderCategories;

    // Generate cartesian product of all options
    const generateCartesian = (arrays: PlaceholderOption[][]): PlaceholderOption[][] => {
      if (arrays.length === 0) return [[]];
      const [first, ...rest] = arrays;
      const restCombinations = generateCartesian(rest);
      return first.flatMap(option =>
        restCombinations.map(combo => [option, ...combo])
      );
    };

    const optionArrays = categories.map(cat => cat.options);
    const allCombinations = generateCartesian(optionArrays);

    // Map combinations to objects with labels and replacement maps
    return allCombinations.map((combo, idx) => {
      const label = combo.map((opt, catIdx) => opt.text).join(' + ');
      // Build shortLabel with avatar tag in middle: I3-(H)-G2
      // Use serif-style I with brackets for readability
      const avatarTag = activeAvatar?.tag || '?';
      const categoryParts = combo.map((opt, catIdx) => {
        const catInitial = categories[catIdx].name.charAt(0).toUpperCase();
        return `${catInitial}${opt.number}`;
      });
      // Insert avatar tag in the middle
      const midpoint = Math.ceil(categoryParts.length / 2);
      const partsWithTag = [
        ...categoryParts.slice(0, midpoint),
        `(${avatarTag})`,
        ...categoryParts.slice(midpoint)
      ];
      const shortLabel = partsWithTag.join(' · '); // Use centered dot for better spacing
      const replacements: Record<string, string> = {};
      categories.forEach((cat, catIdx) => {
        replacements[cat.placeholder] = combo[catIdx].text;
      });
      return {
        id: `combo-${idx}`,
        label,
        shortLabel,
        replacements,
        options: combo // Include the options array for filtering
      };
    });
  }, [activeAvatar?.placeholderCategories]);

  const placeholderCombinations = generatePlaceholderCombinations();

  // Build prompt with placeholder replacements (for advanced mode)
  const buildAdvancedPrompt = (mainPrompt: string, replacements: Record<string, string>): string => {
    let result = mainPrompt;
    Object.entries(replacements).forEach(([placeholder, value]) => {
      result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    });
    return result;
  };

  // Select all combinations (advanced mode)
  const selectAllCombinations = () => {
    setSelectedCombinations(new Set(placeholderCombinations.map(c => c.id)));
  };

  // Toggle combination selection
  const toggleCombinationSelection = (comboId: string) => {
    setSelectedCombinations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(comboId)) {
        newSet.delete(comboId);
      } else {
        newSet.add(comboId);
      }
      return newSet;
    });
  };

  // Toggle category filter dropdown open/closed
  const toggleCategoryFilter = (categoryId: string) => {
    setCategoryFiltersOpen(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Toggle a specific option within a category
  const toggleCategoryOption = (categoryId: string, optionNumber: number) => {
    setSelectedOptionsPerCategory(prev => {
      const newMap = new Map(prev);
      const currentSet = newMap.get(categoryId) || new Set<number>();
      const newSet = new Set(currentSet);
      if (newSet.has(optionNumber)) {
        newSet.delete(optionNumber);
      } else {
        newSet.add(optionNumber);
      }
      newMap.set(categoryId, newSet);
      return newMap;
    });
  };

  // Select all options in a category
  const selectAllCategoryOptions = (categoryId: string, options: { number: number }[]) => {
    setSelectedOptionsPerCategory(prev => {
      const newMap = new Map(prev);
      newMap.set(categoryId, new Set(options.map(o => o.number)));
      return newMap;
    });
  };

  // Clear all options in a category
  const clearCategoryOptions = (categoryId: string) => {
    setSelectedOptionsPerCategory(prev => {
      const newMap = new Map(prev);
      newMap.set(categoryId, new Set());
      return newMap;
    });
  };

  // Get count of selected options for a category
  const getSelectedCountForCategory = (categoryId: string): number => {
    return selectedOptionsPerCategory.get(categoryId)?.size || 0;
  };

  // Check if an option is selected
  const isOptionSelected = (categoryId: string, optionNumber: number): boolean => {
    return selectedOptionsPerCategory.get(categoryId)?.has(optionNumber) || false;
  };

  // Compute filtered combinations based on selected options per category
  const filteredCombinations = useMemo(() => {
    if (!activeAvatar?.placeholderCategories || activeAvatar.placeholderCategories.length === 0) {
      return placeholderCombinations;
    }

    // Check if any category has selections
    const hasAnySelection = Array.from(selectedOptionsPerCategory.values()).some(set => set.size > 0);
    if (!hasAnySelection) {
      // No filters applied, return all
      return placeholderCombinations;
    }

    // Filter combinations where each option in the combo is selected (or category has no filter)
    return placeholderCombinations.filter(combo => {
      const categories = activeAvatar.placeholderCategories || [];
      return categories.every((cat, idx) => {
        const selectedOptions = selectedOptionsPerCategory.get(cat.id);
        // If no selections for this category, include all
        if (!selectedOptions || selectedOptions.size === 0) return true;
        // Check if the combo's option for this category is selected
        const comboOption = combo.options[idx];
        return comboOption && selectedOptions.has(comboOption.number);
      });
    });
  }, [placeholderCombinations, selectedOptionsPerCategory, activeAvatar?.placeholderCategories]);

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

  // ========== PROMPT PROBLEM AREAS HANDLERS ==========

  const handleAddProblemArea = () => {
    const newArea: PromptProblemArea = {
      id: `area-${Date.now()}`,
      name: 'New Problem Area',
      context: '',
      priority: 'high',
      status: 'active',
      prompts: [],
      isExpanded: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    updateSettings({
      prompt_problem_areas: [...settings.prompt_problem_areas, newArea]
    });
    setActiveProblemAreaId(newArea.id);
    log('Added new problem area', LogStatus.INFO);
  };

  const handleUpdateProblemArea = (areaId: string, updates: Partial<PromptProblemArea>) => {
    updateSettings({
      prompt_problem_areas: settings.prompt_problem_areas.map(area =>
        area.id === areaId ? { ...area, ...updates, updatedAt: new Date().toISOString() } : area
      )
    });
  };

  const handleRemoveProblemArea = (areaId: string) => {
    updateSettings({
      prompt_problem_areas: settings.prompt_problem_areas.filter(a => a.id !== areaId)
    });
    if (activeProblemAreaId === areaId) {
      setActiveProblemAreaId(null);
    }
    log('Removed problem area', LogStatus.INFO);
  };

  const handleAddPromptToArea = (areaId: string) => {
    const newPrompt: PromptSolution = {
      id: `prompt-${Date.now()}`,
      miniContext: '',
      promptText: '',
      status: 'testing'
    };
    handleUpdateProblemArea(areaId, {
      prompts: [...(settings.prompt_problem_areas.find(a => a.id === areaId)?.prompts || []), newPrompt]
    });
  };

  const handleUpdatePromptInArea = (areaId: string, promptId: string, updates: Partial<PromptSolution>) => {
    const area = settings.prompt_problem_areas.find(a => a.id === areaId);
    if (!area) return;
    handleUpdateProblemArea(areaId, {
      prompts: area.prompts.map(p => p.id === promptId ? { ...p, ...updates } : p)
    });
  };

  const handleRemovePromptFromArea = (areaId: string, promptId: string) => {
    const area = settings.prompt_problem_areas.find(a => a.id === areaId);
    if (!area) return;
    handleUpdateProblemArea(areaId, {
      prompts: area.prompts.filter(p => p.id !== promptId)
    });
  };

  const getActiveProblemArea = () => settings.prompt_problem_areas.find(a => a.id === activeProblemAreaId);

  // Get working prompts for AI to use
  const getWorkingPrompts = () => {
    return settings.prompt_problem_areas.flatMap(area =>
      area.prompts
        .filter(p => p.status === 'working')
        .map(p => ({
          area: area.name,
          priority: area.priority,
          context: p.miniContext,
          prompt: p.promptText
        }))
    );
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
   * COMPREHENSIVE: Includes ALL system data - workflow, articles, images, avatars, websites, prompts
   * This gives the AI full visibility to answer any question about the user's content
   */
  const buildConsultantContext = (): string => {
    const parts: string[] = [];

    parts.push('=== COMPREHENSIVE IMAGE & CONTENT CONSULTANT ===');
    parts.push('You are an expert consultant with FULL VISIBILITY into this content marketing system.');
    parts.push('You can answer questions about images, articles, prompts, SEO strategy, and help plan content.');
    parts.push('You understand: image generation, prompt engineering, SEO best practices, stock photo problems, and content strategy.');
    parts.push('');

    // ========== WORKFLOW & PROJECT CONTEXT ==========
    parts.push('━━━━━━━━━━ PROJECT CONTEXT ━━━━━━━━━━');
    if (consultantContext.workflow) {
      const wf = consultantContext.workflow;
      parts.push(`📁 WORKFLOW: "${wf.name}"`);
      if (wf.description) parts.push(`   Description: ${wf.description}`);
      if (wf.niche) parts.push(`   Niche: ${wf.niche}`);
      if (wf.target_audience) parts.push(`   Target Audience: ${wf.target_audience}`);
      if (wf.tone) parts.push(`   Tone: ${wf.tone}`);
      if (wf.brand_voice) parts.push(`   Brand Voice: ${wf.brand_voice}`);
    } else {
      parts.push(`📁 WORKFLOW ID: ${workflowId || 'Not set'}`);
    }
    parts.push('');

    // ========== WEBSITES ==========
    if (consultantContext.websites.length > 0) {
      parts.push('🌐 CONNECTED WEBSITES:');
      consultantContext.websites.forEach(w => {
        parts.push(`   • ${w.name}${w.wp_url ? ` (${w.wp_url})` : ''}`);
        if (w.client_name) parts.push(`     Client: ${w.client_name}`);
      });
      parts.push('');
    }

    // ========== ARTICLES ==========
    if (consultantContext.articles.length > 0) {
      parts.push('━━━━━━━━━━ ARTICLES ━━━━━━━━━━');
      parts.push(`📝 TOTAL ARTICLES: ${consultantContext.articles.length}`);

      // Group by status
      const byStatus: { [key: string]: any[] } = {};
      consultantContext.articles.forEach(a => {
        const status = a.status || 'unknown';
        if (!byStatus[status]) byStatus[status] = [];
        byStatus[status].push(a);
      });

      Object.entries(byStatus).forEach(([status, articles]) => {
        parts.push(`   ${status.toUpperCase()}: ${articles.length}`);
      });
      parts.push('');

      // Show recent articles with keywords
      parts.push('📋 ARTICLES LIST (with keywords):');
      consultantContext.articles.slice(0, 20).forEach((a, idx) => {
        parts.push(`   ${idx + 1}. "${a.title || a.keyword || '(untitled)'}"`);
        if (a.keyword) parts.push(`      Keyword: ${a.keyword}`);
        if (a.meta_title) parts.push(`      Meta Title: ${a.meta_title}`);
        if (a.status) parts.push(`      Status: ${a.status}`);
        if (a.images && a.images.length > 0) {
          parts.push(`      Images: ${a.images.length} attached`);
        }
      });
      if (consultantContext.articles.length > 20) {
        parts.push(`   ... and ${consultantContext.articles.length - 20} more articles`);
      }
      parts.push('');
    }

    // ========== AUDIENCE TAGS ==========
    if (tags.length > 0) {
      parts.push('━━━━━━━━━━ AUDIENCE TAGS ━━━━━━━━━━');
      parts.push('🏷️ TAGS FROM TAG MANAGER:');
      tags.forEach(t => {
        parts.push(`   • ${t.name}${t.description ? `: ${t.description}` : ''}`);
      });
      parts.push('');
    }

    // ========== IMAGE GENERATION MODEL ==========
    parts.push('━━━━━━━━━━ IMAGE GENERATION ━━━━━━━━━━');
    const selectedModel = settings.image_generation_model || 'gpt-image-1.5';
    parts.push(`🎨 ACTIVE IMAGE MODEL: ${selectedModel}`);
    parts.push(`   Quality Setting: ${settings.image_quality || 'low'}`);

    if (selectedModel.startsWith('gpt-image')) {
      parts.push('');
      parts.push('📚 GPT-IMAGE PROMPTING BEST PRACTICES:');
      GPT_IMAGE_PROMPT_GUIDE.sections.forEach(section => {
        parts.push(`   ${section.title}:`);
        section.tips.slice(0, 3).forEach(tip => {
          parts.push(`     • ${tip}`);
        });
      });
    }
    parts.push('');

    // ========== AUDIENCE AVATARS (FULL DETAIL) ==========
    parts.push('━━━━━━━━━━ AUDIENCE AVATARS ━━━━━━━━━━');
    parts.push(`👥 TOTAL AVATARS: ${settings.audience_avatars.length}`);
    parts.push('');

    settings.audience_avatars.forEach((avatar, aIdx) => {
      const isActive = avatar.id === activeAvatarId;
      parts.push(`${isActive ? '▶️' : '  '} AVATAR ${aIdx + 1}: ${avatar.name}${avatar.tag ? ` [Tag: ${avatar.tag}]` : ''}`);

      if (avatar.mainPrompt) {
        parts.push(`      📝 Main Prompt Template:`);
        parts.push(`         "${avatar.mainPrompt}"`);
      }

      // Placeholder categories (advanced mode)
      if (avatar.placeholderMode === 'advanced' && avatar.placeholderCategories && avatar.placeholderCategories.length > 0) {
        parts.push(`      🔧 Placeholder Categories:`);
        avatar.placeholderCategories.forEach(cat => {
          parts.push(`         ${cat.name} (${cat.placeholder}):`);
          if (cat.options && cat.options.length > 0) {
            cat.options.forEach((opt, optIdx) => {
              parts.push(`           ${optIdx + 1}. "${opt.text}"`);
            });
          }
        });
      }

      // Variations
      if (avatar.variations.length > 0) {
        parts.push(`      🎨 Variations (${avatar.variations.length}):`);
        avatar.variations.forEach(v => {
          parts.push(`         • ${v.name} (${v.orientation}): "${v.prompt.substring(0, 80)}${v.prompt.length > 80 ? '...' : ''}"`);
        });
      }
      parts.push('');
    });

    // ========== IMAGE BANK (DETAILED) ==========
    parts.push('━━━━━━━━━━ IMAGE BANK ━━━━━━━━━━');
    const availableImages = settings.image_bank.filter(i => !i.used && !i.archived);
    const usedImages = settings.image_bank.filter(i => i.used);
    const archivedImages = settings.image_bank.filter(i => i.archived);

    parts.push(`🏦 IMAGE BANK STATS:`);
    parts.push(`   Total: ${settings.image_bank.length}`);
    parts.push(`   Available: ${availableImages.length}`);
    parts.push(`   Used: ${usedImages.length}`);
    parts.push(`   Archived: ${archivedImages.length}`);
    parts.push('');

    // Categories in bank
    if (settings.image_categories.length > 0) {
      parts.push('📂 IMAGE CATEGORIES:');
      settings.image_categories.forEach(cat => {
        const count = settings.image_bank.filter(i => i.category === cat).length;
        parts.push(`   • ${cat}: ${count} images`);
      });
      parts.push('');
    }

    // Show sample bank images with prompts
    if (settings.image_bank.length > 0) {
      parts.push('📸 SAMPLE BANK IMAGES (showing prompts used):');
      settings.image_bank.slice(0, 10).forEach((img, idx) => {
        parts.push(`   ${idx + 1}. ${img.title || '(untitled)'}`);
        parts.push(`      Category: ${img.category || 'Uncategorized'}`);
        if (img.prompt) {
          parts.push(`      Prompt: "${img.prompt.substring(0, 100)}${img.prompt.length > 100 ? '...' : ''}"`);
        }
        if (img.avatarTag) parts.push(`      Avatar Tag: ${img.avatarTag}`);
        if (img.orientation) parts.push(`      Orientation: ${img.orientation}`);
      });
      if (settings.image_bank.length > 10) {
        parts.push(`   ... and ${settings.image_bank.length - 10} more images in bank`);
      }
      parts.push('');
    }

    // ========== REFERENCE IMAGES & BRANDING ==========
    parts.push('━━━━━━━━━━ BRANDING & STYLE ━━━━━━━━━━');

    if (settings.reference_images.length > 0) {
      parts.push(`📷 REFERENCE IMAGES: ${settings.reference_images.length} uploaded`);
      parts.push('   (These define the visual style the user wants)');
      settings.reference_images.forEach((ref, idx) => {
        if (ref.filename) parts.push(`   ${idx + 1}. ${ref.filename}`);
        if (ref.tags && ref.tags.length > 0) {
          parts.push(`      Tags: ${ref.tags.join(', ')}`);
        }
      });
      parts.push('');
    }

    const logos = settings.logo_images.filter(i => i.type === 'logo');
    const actions = settings.logo_images.filter(i => i.type === 'action');
    if (logos.length > 0) {
      parts.push(`🏷️ LOGO IMAGES: ${logos.length}`);
    }
    if (actions.length > 0) {
      parts.push(`📸 ACTION SHOTS (logo in use): ${actions.length}`);
      parts.push('   (These show the logo/brand in real-world context)');
    }
    parts.push('');

    // ========== SMART MATCHING SETTINGS ==========
    parts.push('━━━━━━━━━━ INTEGRATION SETTINGS ━━━━━━━━━━');
    parts.push(`🔄 Integration Mode: ${settings.integration_mode}`);
    parts.push(`   Smart Matching: ${settings.smart_matching_enabled ? 'ON' : 'OFF'}`);
    if (settings.smart_matching_enabled) {
      parts.push(`   Matching Mode: ${settings.smart_matching_mode}`);
    }
    parts.push(`   Fallback to Live Generation: ${settings.fallback_to_live ? 'Yes' : 'No'}`);
    parts.push(`   Variation Order: ${settings.variation_order_mode}`);
    parts.push('');

    // ========== ROLE & CAPABILITIES ==========
    parts.push('━━━━━━━━━━ YOUR CAPABILITIES ━━━━━━━━━━');
    parts.push('You can help with:');
    parts.push('   • Crafting and improving image prompts');
    parts.push('   • Suggesting new placeholder options and variations');
    parts.push('   • Planning image strategy for articles');
    parts.push('   • Analyzing which images would work best for specific content');
    parts.push('   • Recommending categories and organization');
    parts.push('   • SEO optimization for image alt text');
    parts.push('   • Brand consistency across all imagery');
    parts.push('   • Answering questions about any aspect of the content system');
    parts.push('');
    parts.push('Ask me anything about images, articles, prompts, or content strategy!');

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

    // Algorithm rules context
    parts.push('⚙️ IMAGE INTEGRATION SETTINGS:');
    parts.push(`  - Source Mode: ${settings.integration_mode === 'bank' ? 'Pull from Bank' : 'Generate Live'}`);
    parts.push(`  - Fallback to Live: ${settings.fallback_to_live ? 'Yes' : 'No'}`);
    parts.push(`  - Smart Matching: ${settings.smart_matching_enabled ? 'ENABLED' : 'Disabled'}`);
    parts.push(`  - Smart Matching Mode: ${settings.smart_matching_mode || 'bank_first'}`);
    parts.push('');
    parts.push('📐 ALGORITHM RULES (user can edit these):');
    parts.push(`  - Placement Rule: "${settings.placement_rule || 'Place image at last paragraph break under {300} words since previous image. Hero image on {right/left/alt}.'}"`);
    parts.push(`  - Smart Matching Rule: "${settings.smart_matching_rule || 'Look {50-75} words around image placement for keyword matches. Match against: {placeholder_categories}.'}"`);
    parts.push('');

    parts.push('Help the user organize prompts, create variation schedules, refine algorithm rules, and manage the operational side of image creation.');

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
   * Send message to Guided GPT Assistant Chat
   * This chat helps users refine guardrails and understand prompt techniques
   */
  const handleSendGuidedAssistant = async () => {
    if (!guidedAssistantInput.trim() && guidedAssistantImages.length === 0) return;

    const newMessage: ChatMessage = {
      role: 'user',
      content: guidedAssistantInput,
      images: guidedAssistantImages.length > 0 ? guidedAssistantImages : undefined,
      timestamp: new Date().toISOString()
    };

    // Build message history for API
    const historyToSend = [...guidedAssistantMessages, newMessage];

    // Update local state immediately
    setGuidedAssistantMessages(historyToSend);
    setGuidedAssistantInput('');
    setGuidedAssistantImages([]);
    setGuidedAssistantLoading(true);

    try {
      // Build COMPREHENSIVE context from current settings
      // The AI Prompt Assistant should see EVERYTHING to help craft better prompts
      const context = {
        // Guardrails / instructions
        guardrails: settings.guided_guardrails,

        // Main prompt template from active avatar
        mainPrompt: activeAvatar?.mainPrompt || '',

        // Placeholder categories with all options (for understanding prompt structure)
        placeholderMode: activeAvatar?.placeholderMode || 'simple',
        placeholderCategories: activeAvatar?.placeholderCategories?.map(cat => ({
          name: cat.name,
          placeholder: cat.placeholder,
          isRandomized: cat.isRandomized,
          options: cat.options.map(opt => ({
            number: opt.number,
            text: opt.text,
            primaryKeywords: opt.primaryKeywords,
            secondaryKeywords: opt.useSecondaryKeywords ? opt.secondaryKeywords : undefined
          }))
        })) || [],

        // Variations (simple mode)
        variations: activeAvatar?.variations?.map(v => ({
          name: v.name,
          prompt: v.prompt,
          orientation: v.orientation
        })) || [],

        // Reference images with descriptions
        referenceImages: settings.reference_images.map((img, idx) => ({
          index: idx + 1,
          filename: img.filename || `Reference ${idx + 1}`,
          tags: img.tags || [],
          hasUrl: !!img.url
        })),

        // Logo and action shots
        logoImages: logoImages.map((img, idx) => ({
          index: idx + 1,
          filename: img.filename || `Logo ${idx + 1}`,
          type: img.type
        })),
        actionShots: actionShots.map((img, idx) => ({
          index: idx + 1,
          filename: img.filename || `Action Shot ${idx + 1}`,
          type: img.type
        })),

        // Image bank examples - show recent successful prompts
        imageBankExamples: (settings.image_bank || [])
          .slice(0, 10)
          .map((img: BankImage) => ({
            title: img.title,
            prompt: img.prompt,
            variation: img.variation,
            model: img.model,
            used: img.used,
            avatarTag: img.avatarTag
          })),

        // Problem areas WITH their solution prompts (full context!)
        problemAreas: (settings.prompt_problem_areas || [])
          .filter((a: PromptProblemArea) => a.status === 'active')
          .map((a: PromptProblemArea) => ({
            name: a.name,
            context: a.context,
            priority: a.priority,
            solutions: a.prompts.map(p => ({
              miniContext: p.miniContext,
              promptText: p.promptText,
              status: p.status,
              notes: p.notes
            }))
          })),

        // Also include solved problems as reference
        solvedProblems: (settings.prompt_problem_areas || [])
          .filter((a: PromptProblemArea) => a.status === 'solved')
          .map((a: PromptProblemArea) => {
            const solvedPrompt = a.prompts.find(p => p.id === a.solvedPromptId);
            return {
              name: a.name,
              context: a.context,
              solvedWith: solvedPrompt?.promptText,
              solvedNotes: a.solvedNotes
            };
          }),

        // Current avatar info
        activeAvatar: activeAvatar ? {
          name: activeAvatar.name,
          tag: activeAvatar.tag
        } : null,

        // All avatar names for reference
        allAvatars: settings.audience_avatars.map(a => ({
          name: a.name,
          tag: a.tag,
          hasPrompt: !!a.mainPrompt
        })),

        // TESTING MODE - Current prompt and recent history
        // AI can edit this by outputting ```testprompt blocks
        testingMode: {
          isOpen: testingModeOpen,
          activeTab: activeTestingTab.name,
          currentPrompt: activeTestingTab.prompt,
          // Send ALL history - no limit, AI should see the full iteration journey
          fullHistory: activeTestingTab.history.map(h => ({
            prompt: h.prompt,
            model: h.model,
            timestamp: h.timestamp
          })),
          model: settings.default_model || 'gpt-image-1.5'
        },

        // LOADED ARTICLES - For image planning based on article content
        // AI can read these to understand the content and create image plans
        articles: loadedArticles.length > 0 ? {
          count: loadedArticles.length,
          items: loadedArticles.map(a => ({
            id: a.id,
            keyword: a.keyword,
            tag: a.tag,
            wordCount: a.wordCount,
            websiteName: a.websiteName,
            clientName: a.clientName,
            content: a.content
          }))
        } : null
      };

      const res = await fetch('/api/prompt-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.guided_model || 'gpt-4o',
          messages: historyToSend.map(m => ({
            role: m.role,
            content: m.content,
            images: m.images
          })),
          context
        })
      });

      const data = await res.json();
      if (data.success) {
        const responseContent = data.response;
        const updatedFields: string[] = [];

        // Check for ```testprompt blocks - AI can directly update Testing Mode
        const testPromptMatch = responseContent.match(/```testprompt\n?([\s\S]*?)```/);
        if (testPromptMatch) {
          const newPrompt = testPromptMatch[1].trim();
          // Open Testing Mode and update the prompt
          setTestingModeOpen(true);
          updateActiveTabPrompt(newPrompt);
          updatedFields.push('Test Prompt');
        }

        // Check for ```instructions blocks - AI can directly update Instructions field
        const instructionsMatch = responseContent.match(/```instructions\n?([\s\S]*?)```/);
        if (instructionsMatch) {
          const newInstructions = instructionsMatch[1].trim();
          updateSettings({
            guided_guardrails: {
              ...settings.guided_guardrails,
              instructions: newInstructions
            } as any
          });
          updatedFields.push('Instructions');
        }

        // Check for ```uniform blocks - AI can directly update Uniform/Appearance field
        const uniformMatch = responseContent.match(/```uniform\n?([\s\S]*?)```/);
        if (uniformMatch) {
          const newUniform = uniformMatch[1].trim();
          updateSettings({
            guided_guardrails: {
              ...settings.guided_guardrails,
              uniformDescription: newUniform
            } as any
          });
          updatedFields.push('Uniform/Appearance');
        }

        // Check for ```subject blocks - AI can directly update Default Subject field
        const subjectMatch = responseContent.match(/```subject\n?([\s\S]*?)```/);
        if (subjectMatch) {
          const newSubject = subjectMatch[1].trim();
          updateSettings({
            guided_guardrails: {
              ...settings.guided_guardrails,
              defaultSubject: newSubject
            } as any
          });
          updatedFields.push('Default Subject');
        }

        // Check for ```avoid blocks - AI can directly update Avoid field
        const avoidMatch = responseContent.match(/```avoid\n?([\s\S]*?)```/);
        if (avoidMatch) {
          const newAvoid = avoidMatch[1].trim();
          updateSettings({
            guided_guardrails: {
              ...settings.guided_guardrails,
              avoidList: newAvoid
            } as any
          });
          updatedFields.push('Avoid List');
        }

        // Check for ```stylepreferences blocks - AI can update style preferences
        const styleMatch = responseContent.match(/```stylepreferences\n?([\s\S]*?)```/);
        if (styleMatch) {
          const newStyle = styleMatch[1].trim();
          updateSettings({
            guided_guardrails: {
              ...settings.guided_guardrails,
              stylePreferences: newStyle
            } as any
          });
          updatedFields.push('Style Preferences');
        }

        // Check for ```mainprompt blocks - AI can update avatar's main prompt
        const mainPromptMatch = responseContent.match(/```mainprompt\n?([\s\S]*?)```/);
        if (mainPromptMatch && activeAvatar) {
          const newMainPrompt = mainPromptMatch[1].trim();
          const updatedAvatars = settings.audience_avatars.map(a =>
            a.tag === activeAvatar.tag ? { ...a, mainPrompt: newMainPrompt } : a
          );
          updateSettings({ audience_avatars: updatedAvatars });
          updatedFields.push('Main Prompt');
        }

        // Check for ```smartprompt blocks - AI can update smart prompt guidance
        const smartPromptMatch = responseContent.match(/```smartprompt\n?([\s\S]*?)```/);
        if (smartPromptMatch) {
          updateSettings({ smart_prompt_guidance: smartPromptMatch[1].trim() });
          updatedFields.push('Smart Prompt Guidance');
        }

        // Check for ```matchingrule1-4 blocks - AI can update matching rules
        const rule1Match = responseContent.match(/```matchingrule1\n?([\s\S]*?)```/);
        if (rule1Match) {
          updateSettings({ matching_rule_1: rule1Match[1].trim() });
          updatedFields.push('Matching Rule 1');
        }

        const rule2Match = responseContent.match(/```matchingrule2\n?([\s\S]*?)```/);
        if (rule2Match) {
          updateSettings({ matching_rule_2: rule2Match[1].trim() });
          updatedFields.push('Matching Rule 2');
        }

        const rule3Match = responseContent.match(/```matchingrule3\n?([\s\S]*?)```/);
        if (rule3Match) {
          updateSettings({ matching_rule_3: rule3Match[1].trim() });
          updatedFields.push('Matching Rule 3');
        }

        const rule4Match = responseContent.match(/```matchingrule4\n?([\s\S]*?)```/);
        if (rule4Match) {
          updateSettings({ matching_rule_4: rule4Match[1].trim() });
          updatedFields.push('Matching Rule 4');
        }

        // Check for ```placementrule blocks - AI can update placement rule
        const placementMatch = responseContent.match(/```placementrule\n?([\s\S]*?)```/);
        if (placementMatch) {
          updateSettings({ placement_rule: placementMatch[1].trim() });
          updatedFields.push('Placement Rule');
        }

        // Check for ```smartmatchingrule blocks - AI can update smart matching rule
        const smartMatchingMatch = responseContent.match(/```smartmatchingrule\n?([\s\S]*?)```/);
        if (smartMatchingMatch) {
          updateSettings({ smart_matching_rule: smartMatchingMatch[1].trim() });
          updatedFields.push('Smart Matching Rule');
        }

        // Show notification for all updated fields
        if (updatedFields.length > 0) {
          showNotification(`✓ Updated: ${updatedFields.join(', ')}`, 'success');
        }

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: responseContent,
          timestamp: new Date().toISOString()
        };
        setGuidedAssistantMessages([...historyToSend, assistantMessage]);
      } else {
        showNotification(data.error || 'Chat failed', 'error');
      }
    } catch (error) {
      console.error('Guided assistant chat error:', error);
      showNotification('Failed to send message', 'error');
    }

    setGuidedAssistantLoading(false);

    // Scroll to bottom
    setTimeout(() => {
      if (guidedAssistantChatRef.current) {
        guidedAssistantChatRef.current.scrollTop = guidedAssistantChatRef.current.scrollHeight;
      }
    }, 100);
  };

  /**
   * Fetch article summary (counts by website/client) for selection UI
   */
  const fetchArticleSummary = async () => {
    try {
      const res = await fetch(`/api/prompt-assistant/articles/summary?workflowId=${workflowId}`);
      const data = await res.json();
      if (data.success) {
        setArticleSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch article summary:', error);
    }
  };

  /**
   * Load articles by filter (websiteId, clientId, or all)
   */
  const loadArticles = async (filter: { websiteId?: number; clientId?: number; limit?: number }) => {
    setLoadingArticles(true);
    try {
      const params = new URLSearchParams();
      params.append('workflowId', workflowId.toString());
      if (filter.websiteId) params.append('websiteId', filter.websiteId.toString());
      if (filter.clientId) params.append('clientId', filter.clientId.toString());
      if (filter.limit) params.append('limit', filter.limit.toString());

      const res = await fetch(`/api/prompt-assistant/articles?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setLoadedArticles(data.articles);
        showNotification(`Loaded ${data.count} articles for AI context`, 'success');
        setShowArticleLoader(false);
      } else {
        showNotification(data.error || 'Failed to load articles', 'error');
      }
    } catch (error) {
      console.error('Failed to load articles:', error);
      showNotification('Failed to load articles', 'error');
    }
    setLoadingArticles(false);
  };

  /**
   * Clear loaded articles
   */
  const clearLoadedArticles = () => {
    setLoadedArticles([]);
    showNotification('Articles cleared from AI context', 'success');
  };

  /**
   * Handle image upload for Guided Assistant Chat
   */
  const handleGuidedAssistantImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setGuidedAssistantImages(prev => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (e.target) e.target.value = '';
  };

  /**
   * Extract and save guardrail suggestions from assistant response
   */
  const saveGuardrailFromChat = (text: string) => {
    // Extract content from ```guardrail blocks
    const guardrailMatch = text.match(/```guardrail\n?([\s\S]*?)```/);
    if (guardrailMatch) {
      const guardrailText = guardrailMatch[1].trim();
      // Append to existing instructions
      const currentInstructions = settings.guided_guardrails?.instructions || '';
      const newInstructions = currentInstructions
        ? `${currentInstructions}\n\n${guardrailText}`
        : guardrailText;

      updateSettings({
        guided_guardrails: {
          ...settings.guided_guardrails,
          instructions: newInstructions
        } as any
      });
      showNotification('Guardrail saved to instructions!', 'success');
    } else {
      // If no special block, just copy the selected text to clipboard
      navigator.clipboard.writeText(text);
      showNotification('Copied to clipboard', 'success');
    }
  };

  // ═══════════════════════════════════════════
  // TESTING MODE - Multi-Tab Functions
  // ═══════════════════════════════════════════

  /**
   * Update the prompt for the active testing tab
   */
  const updateActiveTabPrompt = (prompt: string) => {
    setTestingTabs(prev => prev.map(tab =>
      tab.id === activeTestingTabId ? { ...tab, prompt } : tab
    ));
  };

  /**
   * Add a new testing tab
   */
  const addTestingTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTabNumber = testingTabs.length + 1;
    const newTab = {
      id: newId,
      name: `Test ${newTabNumber}`,
      prompt: '',
      history: []
    };
    setTestingTabs(prev => [...prev, newTab]);
    setActiveTestingTabId(newId);
  };

  /**
   * Rename a testing tab
   */
  const renameTestingTab = (tabId: string, newName: string) => {
    setTestingTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, name: newName.trim() || tab.name } : tab
    ));
    setEditingTabName(null);
  };

  /**
   * Delete a testing tab (keep at least one)
   */
  const deleteTestingTab = (tabId: string) => {
    if (testingTabs.length <= 1) {
      showNotification('Must keep at least one tab', 'error');
      return;
    }
    setTestingTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTestingTabId === tabId) {
      setActiveTestingTabId(testingTabs.find(t => t.id !== tabId)?.id || testingTabs[0].id);
    }
  };

  /**
   * Send prompt from AI Assistant directly to Testing Mode
   */
  const sendPromptToTestingMode = (prompt: string) => {
    // Open testing mode if not already open
    setTestingModeOpen(true);
    // Update the active tab's prompt
    updateActiveTabPrompt(prompt);
    showNotification('Prompt sent to Testing Mode!', 'success');
  };

  /**
   * Generate a test image in Testing Mode sandbox (multi-tab version)
   */
  const handleGenerateTestImage = async () => {
    if (!activeTestingTab.prompt.trim()) {
      showNotification('Please enter a prompt', 'error');
      return;
    }

    setTestingModeLoading(true);
    try {
      const model = settings.default_model || 'gpt-image-1.5';

      // Determine size based on model - use vertical (portrait) as default
      const size = model.startsWith('gpt-image') ? '1024x1536' : '1024x1792';

      const response = await fetch('/api/image-creation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: activeTestingTab.prompt,
          model,
          size,
          quality: 'high'
        })
      });

      const data = await response.json();
      if (data.success && data.image?.url) {
        const newTestImage = {
          url: data.image.url,
          prompt: activeTestingTab.prompt,
          model,
          timestamp: new Date().toISOString()
        };
        // Add to the active tab's history
        setTestingTabs(prev => prev.map(tab =>
          tab.id === activeTestingTabId
            ? { ...tab, history: [newTestImage, ...tab.history].slice(0, 50) } // Keep 50 per tab
            : tab
        ));
        showNotification('Test image generated!', 'success');
      } else {
        showNotification(data.error || 'Failed to generate test image', 'error');
      }
    } catch (error) {
      console.error('Test image generation error:', error);
      showNotification('Failed to generate test image', 'error');
    }
    setTestingModeLoading(false);
  };

  /**
   * Save test image to the Image Bank
   */
  const handleSaveTestImageToBank = async (imageUrl: string, prompt: string, model: string) => {
    try {
      // Add to image bank via API
      const response = await fetch(`/api/image-bank/${settings.workflow_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: imageUrl,
          title: `Test: ${activeTestingTab.name}`,
          prompt: prompt,
          model: model,
          variation: `Testing - ${activeTestingTab.name}`,
          variationId: `testing-${activeTestingTab.id}`,
          orientation: 'vertical',
          used: false,
          archived: false
        })
      });

      const data = await response.json();
      if (data.success) {
        showNotification('Image saved to bank!', 'success');
      } else {
        showNotification(data.error || 'Failed to save to bank', 'error');
      }
    } catch (error) {
      console.error('Save to bank error:', error);
      showNotification('Failed to save to bank', 'error');
    }
  };

  // ═══════════════════════════════════════════
  // AUTO-REFINE Functions
  // ═══════════════════════════════════════════

  /**
   * Start an autonomous refinement session
   * GPT-5.2 generates prompts, evaluates results, and refines until goal is met
   */
  const startAutoRefine = async () => {
    if (!autoRefineGoal.trim()) {
      showNotification('Please enter a goal/criteria for the image', 'error');
      return;
    }

    const sessionId = `autorefine-${Date.now()}`;
    const newSession: AutoRefineSession = {
      id: sessionId,
      goal: autoRefineGoal,
      problemArea: activeTestingTab.name,
      maxIterations: autoRefineMaxIterations,
      iterations: [],
      status: 'running',
      finalPrompt: null,
      finalImageUrl: null,
      startedAt: new Date().toISOString(),
      completedAt: null
    };

    setAutoRefineSession(newSession);
    setAutoRefineRunning(true);
    setAutoRefinePaused(false);

    // Start the refinement loop
    await runAutoRefineLoop(newSession);
  };

  /**
   * The main auto-refine loop
   */
  const runAutoRefineLoop = async (session: AutoRefineSession) => {
    let currentSession = { ...session };
    const model = settings.default_model || 'gpt-image-1.5';
    const size = model.startsWith('gpt-image') ? '1024x1536' : '1024x1792';

    for (let i = 0; i < currentSession.maxIterations; i++) {
      // Check if paused or stopped
      if (autoRefinePaused) {
        setAutoRefineSession(prev => prev ? { ...prev, status: 'idle' } : null);
        return;
      }

      const iterationNum = i + 1;
      console.log(`[Auto-Refine] Starting iteration ${iterationNum}/${currentSession.maxIterations}`);

      // Step 1: Generate or refine the prompt using GPT-5.2
      let promptToUse: string;

      if (i === 0) {
        // First iteration: Ask GPT-5.2 to create an initial prompt based on the goal
        try {
          const promptResponse = await fetch('/api/prompt-assistant/guided-generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `Create an image generation prompt that will achieve this goal:\n\nGOAL: ${currentSession.goal}\n\nContext from current settings:\n- Problem area: ${currentSession.problemArea}\n- Current main prompt: ${settings.audience_avatars.find(a => a.id === activeAvatarId)?.mainPrompt || 'No main prompt'}\n\nWrite ONLY the image prompt, nothing else. Make it detailed and specific to achieve the goal.`,
              workflowId: settings.workflow_id,
              model: settings.guided_model || 'gpt-5.2',
              context: {
                goal: currentSession.goal,
                problemArea: currentSession.problemArea,
                previousAttempts: []
              }
            })
          });
          const promptData = await promptResponse.json();
          promptToUse = promptData.response || currentSession.goal;
        } catch (error) {
          console.error('[Auto-Refine] Error generating initial prompt:', error);
          promptToUse = currentSession.goal;
        }
      } else {
        // Subsequent iterations: Ask GPT-5.2 to refine based on previous evaluation
        const lastIteration = currentSession.iterations[currentSession.iterations.length - 1];
        try {
          const refineResponse = await fetch('/api/prompt-assistant/guided-generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `The previous prompt didn't meet the goal. Refine it.\n\nGOAL: ${currentSession.goal}\n\nPREVIOUS PROMPT: ${lastIteration.prompt}\n\nEVALUATION OF RESULT: ${lastIteration.evaluation}\n\nWHAT WENT WRONG: ${lastIteration.refinementNotes}\n\nWrite a NEW, IMPROVED prompt that addresses these issues. Write ONLY the image prompt, nothing else.`,
              workflowId: settings.workflow_id,
              model: settings.guided_model || 'gpt-5.2',
              context: {
                goal: currentSession.goal,
                previousAttempts: currentSession.iterations.map(it => ({
                  prompt: it.prompt,
                  evaluation: it.evaluation
                }))
              }
            })
          });
          const refineData = await refineResponse.json();
          promptToUse = refineData.response || lastIteration.prompt;
        } catch (error) {
          console.error('[Auto-Refine] Error refining prompt:', error);
          promptToUse = currentSession.iterations[currentSession.iterations.length - 1].prompt;
        }
      }

      // Clean up the prompt (remove any markdown or extra text)
      promptToUse = promptToUse.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();

      // Step 2: Generate the image
      let imageUrl: string | null = null;
      try {
        const imageResponse = await fetch('/api/image-creation/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptToUse,
            model,
            size,
            quality: 'high'
          })
        });
        const imageData = await imageResponse.json();
        if (imageData.success && imageData.image?.url) {
          imageUrl = imageData.image.url;
        }
      } catch (error) {
        console.error('[Auto-Refine] Error generating image:', error);
      }

      if (!imageUrl) {
        // Failed to generate image, record and continue
        const failedIteration: AutoRefineIteration = {
          iteration: iterationNum,
          prompt: promptToUse,
          imageUrl: null,
          evaluation: 'Failed to generate image',
          meetsGoal: false,
          refinementNotes: 'Image generation failed - will retry with modified prompt',
          timestamp: new Date().toISOString()
        };
        currentSession = {
          ...currentSession,
          iterations: [...currentSession.iterations, failedIteration]
        };
        setAutoRefineSession(currentSession);
        continue;
      }

      // Step 3: Send image to GPT-5.2 for evaluation
      let evaluation: string = '';
      let meetsGoal = false;
      let refinementNotes: string = '';

      try {
        const evalResponse = await fetch('/api/prompt-assistant/evaluate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl,
            goal: currentSession.goal,
            prompt: promptToUse,
            workflowId: settings.workflow_id,
            model: settings.guided_model || 'gpt-5.2'
          })
        });
        const evalData = await evalResponse.json();

        evaluation = evalData.evaluation || 'No evaluation received';
        meetsGoal = evalData.meetsGoal || false;
        refinementNotes = evalData.refinementNotes || '';
      } catch (error) {
        console.error('[Auto-Refine] Error evaluating image:', error);
        evaluation = 'Evaluation failed';
        meetsGoal = false;
        refinementNotes = 'Could not evaluate image - will try again';
      }

      // Record this iteration
      const newIteration: AutoRefineIteration = {
        iteration: iterationNum,
        prompt: promptToUse,
        imageUrl,
        evaluation,
        meetsGoal,
        refinementNotes,
        timestamp: new Date().toISOString()
      };

      currentSession = {
        ...currentSession,
        iterations: [...currentSession.iterations, newIteration]
      };
      setAutoRefineSession(currentSession);

      // Add to testing tab history
      setTestingTabs(prev => prev.map(tab =>
        tab.id === activeTestingTabId
          ? { ...tab, history: [{ url: imageUrl!, prompt: promptToUse, model, timestamp: new Date().toISOString() }, ...tab.history].slice(0, 50) }
          : tab
      ));

      // Step 4: Check if goal is met
      if (meetsGoal) {
        console.log(`[Auto-Refine] SUCCESS! Goal met on iteration ${iterationNum}`);
        currentSession = {
          ...currentSession,
          status: 'success',
          finalPrompt: promptToUse,
          finalImageUrl: imageUrl,
          completedAt: new Date().toISOString()
        };
        setAutoRefineSession(currentSession);
        setAutoRefineRunning(false);
        showNotification(`Success! Goal achieved in ${iterationNum} iteration(s)`, 'success');

        // Update the testing tab prompt with the successful one
        setTestingTabs(prev => prev.map(tab =>
          tab.id === activeTestingTabId ? { ...tab, prompt: promptToUse } : tab
        ));
        return;
      }

      // Small delay before next iteration
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Exhausted all iterations without success
    console.log('[Auto-Refine] Max iterations reached without meeting goal');
    currentSession = {
      ...currentSession,
      status: 'failed',
      completedAt: new Date().toISOString()
    };
    setAutoRefineSession(currentSession);
    setAutoRefineRunning(false);
    showNotification(`Completed ${currentSession.maxIterations} iterations - goal not fully met`, 'info');
  };

  /**
   * Stop the auto-refine process
   */
  const stopAutoRefine = () => {
    setAutoRefinePaused(true);
    setAutoRefineRunning(false);
    setAutoRefineSession(prev => prev ? { ...prev, status: 'stopped', completedAt: new Date().toISOString() } : null);
    showNotification('Auto-refine stopped', 'info');
  };

  /**
   * Clear the auto-refine session
   */
  const clearAutoRefineSession = () => {
    setAutoRefineSession(null);
    setAutoRefineGoal('');
  };

  // ═══════════════════════════════════════════
  // PROMPT JOURNAL Functions
  // ═══════════════════════════════════════════

  /**
   * Save a prompt to the journal
   */
  const saveToJournal = (
    prompt: string,
    imageUrl?: string,
    model?: string,
    tags?: string[],
    notes?: string
  ) => {
    const newEntry: JournalEntry = {
      id: `entry-${Date.now()}`,
      prompt,
      imageUrl,
      model: model || settings.default_model || 'gpt-image-1.5',
      notes: notes || '',
      tags: tags || [],
      seriesId: journalActiveSeries || undefined,
      seriesPosition: journalActiveSeries
        ? journalEntries.filter(e => e.seriesId === journalActiveSeries).length + 1
        : undefined,
      isFinal: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setJournalEntries(prev => [newEntry, ...prev]);
    showNotification('Saved to Journal!', 'success');
    return newEntry.id;
  };

  /**
   * Create a new series for tracking iterations
   */
  const createJournalSeries = (name: string, tags?: string[], description?: string) => {
    const newSeries: JournalSeries = {
      id: `series-${Date.now()}`,
      name,
      description,
      tags: tags || [],
      isClosed: false,
      createdAt: new Date().toISOString()
    };

    setJournalSeries(prev => [newSeries, ...prev]);
    setJournalActiveSeries(newSeries.id);
    showNotification(`Started series: ${name}`, 'success');
    return newSeries.id;
  };

  /**
   * Close out a series (mark it complete with a winner)
   */
  const closeJournalSeries = (seriesId: string, finalEntryId?: string, notes?: string) => {
    setJournalSeries(prev => prev.map(s =>
      s.id === seriesId
        ? { ...s, isClosed: true, finalEntryId, closedNotes: notes, closedAt: new Date().toISOString() }
        : s
    ));
    if (finalEntryId) {
      setJournalEntries(prev => prev.map(e =>
        e.id === finalEntryId ? { ...e, isFinal: true } : e
      ));
    }
    if (journalActiveSeries === seriesId) {
      setJournalActiveSeries(null);
    }
    showNotification('Series closed!', 'success');
  };

  /**
   * Update journal entry notes
   */
  const updateJournalEntryNotes = (entryId: string, notes: string) => {
    setJournalEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, notes, updatedAt: new Date().toISOString() } : e
    ));
  };

  /**
   * Add tag to journal entry
   */
  const addTagToJournalEntry = (entryId: string, tag: string) => {
    const normalizedTag = tag.toLowerCase().trim();
    if (!normalizedTag) return;
    setJournalEntries(prev => prev.map(e =>
      e.id === entryId && !e.tags.includes(normalizedTag)
        ? { ...e, tags: [...e.tags, normalizedTag], updatedAt: new Date().toISOString() }
        : e
    ));
  };

  /**
   * Remove tag from journal entry
   */
  const removeTagFromJournalEntry = (entryId: string, tag: string) => {
    setJournalEntries(prev => prev.map(e =>
      e.id === entryId
        ? { ...e, tags: e.tags.filter(t => t !== tag), updatedAt: new Date().toISOString() }
        : e
    ));
  };

  /**
   * Delete journal entry
   */
  const deleteJournalEntry = (entryId: string) => {
    setJournalEntries(prev => prev.filter(e => e.id !== entryId));
    showNotification('Entry deleted', 'success');
  };

  /**
   * Load prompt from journal back to Testing Mode
   */
  const loadFromJournal = (entry: JournalEntry) => {
    setTestingModeOpen(true);
    updateActiveTabPrompt(entry.prompt);
    showNotification('Prompt loaded to Testing Mode', 'success');
  };

  /**
   * Start a new series from the current Testing Mode tab
   */
  const startSeriesFromTestingMode = (name: string, tags?: string[]) => {
    const seriesId = createJournalSeries(name, tags);
    // Save all current history to this series
    activeTestingTab.history.forEach((h, idx) => {
      const entry: JournalEntry = {
        id: `entry-${Date.now()}-${idx}`,
        prompt: h.prompt,
        imageUrl: h.url,
        model: h.model,
        notes: '',
        tags: tags || [],
        seriesId,
        seriesPosition: activeTestingTab.history.length - idx,
        isFinal: false,
        createdAt: h.timestamp,
        updatedAt: h.timestamp
      };
      setJournalEntries(prev => [...prev, entry]);
    });
    showNotification(`Series created with ${activeTestingTab.history.length} entries`, 'success');
  };

  // ═══════════════════════════════════════════
  // ARTICLE TESTING Functions
  // ═══════════════════════════════════════════

  /**
   * Fetch available articles from the API
   */
  const fetchAvailableArticles = async () => {
    try {
      // Get the current website from settings or use default
      const response = await fetch('/api/articles');
      const data = await response.json();
      if (data.articles) {
        setAvailableArticles(data.articles.map((a: any) => ({
          id: a.id,
          keyword: a.keyword,
          title: a.title || a.keyword,
          wordCount: a.word_count || 0
        })));
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    }
  };

  /**
   * Load an article for testing and analyze image placements
   */
  const loadArticleForTesting = async (articleId: string) => {
    setArticleTestLoading(true);
    try {
      const response = await fetch(`/api/articles/${articleId}`);
      const data = await response.json();

      if (data.article) {
        const article = data.article;
        const content = article.content || '';

        // Parse the article to find image placement points
        // Rule: Image at last paragraph break under 300 words since previous image
        const placements = analyzeArticleForPlacements(content, keywordRange);

        setSelectedArticleTest({
          articleId: article.id,
          title: article.title || article.keyword,
          keyword: article.keyword,
          content,
          wordCount: content.split(/\s+/).length,
          placements
        });
      }
    } catch (error) {
      console.error('Failed to load article:', error);
      showNotification('Failed to load article', 'error');
    }
    setArticleTestLoading(false);
  };

  /**
   * Analyze article content to find image placement points based on rules
   */
  const analyzeArticleForPlacements = (content: string, wordRange: number): ImagePlacement[] => {
    const placements: ImagePlacement[] = [];
    const paragraphs = content.split(/\n\n+/);
    let wordsSinceLastImage = 0;
    let charPosition = 0;

    // Get placeholder keywords from active avatar
    const placeholderKeywords: string[] = [];
    if (activeAvatar?.placeholderCategories) {
      activeAvatar.placeholderCategories.forEach(cat => {
        cat.options.forEach(opt => {
          if (opt.primaryKeywords) placeholderKeywords.push(...opt.primaryKeywords);
          if (opt.secondaryKeywords) placeholderKeywords.push(...opt.secondaryKeywords);
        });
      });
    }
    // Also add variation names as keywords
    if (activeAvatar?.variations) {
      activeAvatar.variations.forEach(v => {
        placeholderKeywords.push(v.name.toLowerCase());
      });
    }

    paragraphs.forEach((paragraph, pIdx) => {
      const paragraphWords = paragraph.split(/\s+/).filter(w => w.length > 0);
      wordsSinceLastImage += paragraphWords.length;

      // Check if we should place an image (last paragraph break under 300 words)
      if (wordsSinceLastImage >= 200 && wordsSinceLastImage <= 350) {
        // This is a good spot for an image
        const allWords = content.split(/\s+/);
        const currentWordIndex = content.substring(0, charPosition).split(/\s+/).length;

        // Get words before and after
        const startIdx = Math.max(0, currentWordIndex - wordRange);
        const endIdx = Math.min(allWords.length, currentWordIndex + wordRange);
        const wordsBefore = allWords.slice(startIdx, currentWordIndex).join(' ');
        const wordsAfter = allWords.slice(currentWordIndex, endIdx).join(' ');
        const zoneText = (wordsBefore + ' ' + wordsAfter).toLowerCase();

        // Find matching keywords in the zone
        const matchedKeywords = placeholderKeywords.filter(kw =>
          zoneText.includes(kw.toLowerCase())
        );

        placements.push({
          id: `placement-${pIdx}`,
          position: charPosition,
          paragraphIndex: pIdx,
          wordsBefore,
          wordsAfter,
          matchedKeywords,
          status: 'pending'
        });

        wordsSinceLastImage = 0;
      }

      charPosition += paragraph.length + 2; // +2 for \n\n
    });

    // Always add a hero image at the start
    if (placements.length === 0 || placements[0].paragraphIndex > 0) {
      const firstWords = content.split(/\s+/).slice(0, wordRange).join(' ');
      const zoneText = firstWords.toLowerCase();
      const matchedKeywords = placeholderKeywords.filter(kw =>
        zoneText.includes(kw.toLowerCase())
      );

      placements.unshift({
        id: 'placement-hero',
        position: 0,
        paragraphIndex: 0,
        wordsBefore: '',
        wordsAfter: firstWords,
        matchedKeywords,
        status: 'pending'
      });
    }

    return placements;
  };

  /**
   * Re-analyze the article with new keyword range
   */
  const reanalyzeArticle = () => {
    if (selectedArticleTest) {
      const placements = analyzeArticleForPlacements(selectedArticleTest.content, keywordRange);
      setSelectedArticleTest({
        ...selectedArticleTest,
        placements
      });
    }
  };

  /**
   * Generate image for a single placement
   */
  const generatePlacementImage = async (placementId: string) => {
    if (!selectedArticleTest) return;

    const placement = selectedArticleTest.placements.find(p => p.id === placementId);
    if (!placement) return;

    // Update status to generating
    setSelectedArticleTest(prev => prev ? {
      ...prev,
      placements: prev.placements.map(p =>
        p.id === placementId ? { ...p, status: 'generating' as const } : p
      )
    } : null);

    try {
      const model = settings.default_model || 'gpt-image-1.5';

      // Build a prompt based on matched keywords and guardrails
      let prompt = '';
      if (placement.matchedKeywords.length > 0) {
        prompt = `${settings.guided_guardrails?.instructions || ''} Scene showing: ${placement.matchedKeywords.join(', ')}. ${settings.guided_guardrails?.uniformDescription || ''}`;
      } else {
        prompt = `${settings.guided_guardrails?.instructions || ''} Professional image for article about ${selectedArticleTest.keyword}. ${settings.guided_guardrails?.uniformDescription || ''}`;
      }

      const size = model.startsWith('gpt-image') ? '1024x1536' : '1024x1792';

      const response = await fetch('/api/image-creation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model, size, quality: 'high' })
      });

      const data = await response.json();
      if (data.success && data.image?.url) {
        setSelectedArticleTest(prev => prev ? {
          ...prev,
          placements: prev.placements.map(p =>
            p.id === placementId ? {
              ...p,
              status: 'generated' as const,
              suggestedPrompt: prompt,
              generatedImage: { url: data.image.url, prompt, model }
            } : p
          )
        } : null);
        showNotification('Image generated!', 'success');
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error) {
      console.error('Image generation error:', error);
      setSelectedArticleTest(prev => prev ? {
        ...prev,
        placements: prev.placements.map(p =>
          p.id === placementId ? { ...p, status: 'pending' as const } : p
        )
      } : null);
      showNotification('Failed to generate image', 'error');
    }
  };

  /**
   * Run full page simulation - generate all images
   */
  const runFullPageSimulation = async () => {
    if (!selectedArticleTest) return;

    setSimulationRunning(true);

    for (const placement of selectedArticleTest.placements) {
      if (placement.status !== 'generated' && placement.status !== 'saved') {
        await generatePlacementImage(placement.id);
        // Small delay between generations
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setSimulationRunning(false);
    showNotification('Simulation complete!', 'success');
  };

  /**
   * Save a placement image to the Image Bank
   */
  const savePlacementToBank = async (placementId: string) => {
    if (!selectedArticleTest) return;

    const placement = selectedArticleTest.placements.find(p => p.id === placementId);
    if (!placement?.generatedImage) return;

    try {
      const response = await fetch(`/api/image-bank/${settings.workflow_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: placement.generatedImage.url,
          title: `Article Test: ${selectedArticleTest.keyword}`,
          prompt: placement.generatedImage.prompt,
          model: placement.generatedImage.model,
          variation: placement.matchedKeywords.join(', ') || 'Article Test',
          variationId: `article-test-${placementId}`,
          orientation: 'vertical',
          used: false,
          archived: false
        })
      });

      const data = await response.json();
      if (data.success) {
        setSelectedArticleTest(prev => prev ? {
          ...prev,
          placements: prev.placements.map(p =>
            p.id === placementId ? { ...p, status: 'saved' as const } : p
          )
        } : null);
        showNotification('Saved to Image Bank!', 'success');
      }
    } catch (error) {
      console.error('Save to bank error:', error);
      showNotification('Failed to save', 'error');
    }
  };

  /**
   * Start a Prompt Planning Session - guided workflow to build a complete prompt bank
   */
  const startPromptPlanningSession = async () => {
    setIsPromptPlanningSession(true);

    // Build context about the current setup for the planning session
    const businessContext = [
      `CURRENT SETUP:`,
      `- Reference Images: ${settings.reference_images.length} uploaded`,
      `- Logo Images: ${logoImages.length} uploaded`,
      `- Action Shots: ${actionShots.length} uploaded`,
      `- Audience Tags: ${tags.map(t => `${t.name} (${t.description || 'no description'})`).join(', ') || 'None configured'}`,
      `- Existing Avatars: ${settings.audience_avatars.map(a => `${a.name}${a.mainPrompt ? ' (has prompt)' : ' (no prompt yet)'}`).join(', ')}`,
      `- Image Categories: ${settings.image_categories.join(', ')}`,
      `- Current Bank: ${availableImages.length} images`,
      ``,
      `IMAGE INTEGRATION SETTINGS:`,
      `- Source Mode: ${settings.integration_mode === 'bank' ? 'Pull from Bank' : 'Generate Live'}`,
      `- Fallback to Live: ${settings.fallback_to_live ? 'Yes' : 'No'}`,
      `- Smart Matching: ${settings.smart_matching_enabled ? 'ENABLED' : 'Disabled'}`,
      `- Smart Matching Mode: ${settings.smart_matching_mode || 'bank_first'}`,
      ``,
      `ALGORITHM RULES (editable by user):`,
      `- Placement Rule: "${settings.placement_rule || 'Place image at last paragraph break under {300} words since previous image. Hero image on {right/left/alt}.'}"`,
      `- Smart Matching Rule: "${settings.smart_matching_rule || 'Look {50-75} words around image placement for keyword matches. Match against: {placeholder_categories}.'}"`,
      ``,
      `NOTE: You can help the user refine these algorithm rules. Suggest improvements based on their content strategy and SEO goals.`
    ].join('\n');

    const planningSystemMessage: ChatMessage = {
      role: 'system',
      content: `You are an expert image prompt strategist conducting a PROMPT PLANNING SESSION. Your goal is to help the user build a complete, professional image prompt library for their business.

${businessContext}

SESSION STRUCTURE:
1. **Discovery Phase** - Ask about the business, brand, target audience, and services
2. **Style Phase** - Review their reference images and establish the visual style DNA
3. **Shot Types Phase** - Guide them through different image categories:
   - Hero Images (main landing page shots)
   - Service Images (action shots showing work being done)
   - Team Images (professionals at work)
   - B-Roll (environmental/atmospheric shots)
   - Before/After (if applicable)
4. **Audience Customization** - Create prompt variations for each audience tag
5. **Diversity & Inclusion** - Ensure representation in imagery
6. **Export Phase** - Compile all prompts into a structured bank

RULES:
- Be conversational but efficient - ask 2-3 questions at a time
- After each answer, summarize what you learned and move forward
- When creating prompts, format them clearly with categories
- Consider SEO keywords that should appear in alt text
- Think about seasonal variations if relevant
- Create prompts that work with AI image generators (DALL-E, gpt-image, Flux, etc.)

Start by introducing yourself and asking about their business in a friendly way.`,
      timestamp: new Date().toISOString()
    };

    const userStartMessage: ChatMessage = {
      role: 'user',
      content: "Let's start a Prompt Planning Session. Help me build a complete image prompt library for my business.",
      timestamp: new Date().toISOString()
    };

    // Clear existing history and start fresh with planning session
    updateSettings({ consultant_chat_history: [userStartMessage] });
    setConsultantLoading(true);

    try {
      const res = await fetch('/api/image-creation/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: planningSystemMessage.content },
            { role: 'user', content: userStartMessage.content }
          ],
          model: settings.consultant_model,
          contextImages: getContextImages('consultant')
        })
      });

      const data = await res.json();
      if (data.success) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.message.content,
          timestamp: new Date().toISOString()
        };
        updateSettings({ consultant_chat_history: [userStartMessage, assistantMessage] });
        showNotification('Prompt Planning Session started!', 'success');
      } else {
        showNotification(data.error || 'Failed to start planning session', 'error');
        setIsPromptPlanningSession(false);
      }
    } catch (error) {
      console.error('Planning session error:', error);
      showNotification('Failed to start planning session', 'error');
      setIsPromptPlanningSession(false);
    }

    setConsultantLoading(false);
    setIsConsultantChatOpen(true);
  };

  /**
   * End the Prompt Planning Session and extract prompts
   */
  const endPromptPlanningSession = async () => {
    setIsPromptPlanningSession(false);

    // Ask the AI to summarize and export the prompts
    const exportMessage: ChatMessage = {
      role: 'user',
      content: "Please summarize all the prompts we've created in this session. Format them as a structured list with categories, so I can save them to my prompt bank.",
      timestamp: new Date().toISOString()
    };

    const newHistory = [...settings.consultant_chat_history, exportMessage];
    updateSettings({ consultant_chat_history: newHistory });
    setConsultantLoading(true);

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
          model: settings.consultant_model
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
        showNotification('Session complete! Review the exported prompts above.', 'success');
      }
    } catch (error) {
      console.error('Export error:', error);
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
          model: settings.image_generation_model || 'flux-1.1-pro',
          used: false
        };

        updateSettings({
          image_bank: [...settings.image_bank, newBankImage]
        });

        // Sync to new database API
        try {
          await fetch(`/api/image-bank/${workflowId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: newBankImage })
          });
        } catch (err) {
          console.error('[Image Bank] Add API failed:', err);
        }

        setGenerationProgress('');
        log(`Image generated successfully for "${variation.name}"!`, LogStatus.SUCCESS);
        showNotification('Image generated and added to bank!', 'success');

        // Create feedback request for later review
        createFeedbackRequest([{ url: data.image.url, prompt: fullPrompt }], 'single');
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

  // Image Generation - Batch (supports both Simple and Advanced modes)
  const handleBatchGenerate = async () => {
    const isAdvancedMode = activeAvatar?.placeholderMode === 'advanced';

    // Validate based on mode
    if (isAdvancedMode) {
      if (!activeAvatar || selectedCombinations.size === 0) {
        showNotification('Select combinations to generate', 'error');
        return;
      }
    } else {
      if (!activeAvatar || selectedVariations.size === 0) {
        showNotification('Select variations to generate', 'error');
        return;
      }
    }

    setGenerating(true);

    let variationsWithFullPrompt: { id: string; name: string; prompt: string; orientation: string }[] = [];

    if (isAdvancedMode) {
      // Advanced mode: use placeholder combinations
      const combosToGenerate = placeholderCombinations.filter(c => selectedCombinations.has(c.id));
      variationsWithFullPrompt = combosToGenerate.map(combo => ({
        id: combo.id,
        name: combo.shortLabel,
        prompt: buildAdvancedPrompt(activeAvatar.mainPrompt, combo.replacements),
        orientation: 'vertical' // Default to vertical for advanced mode
      }));
    } else {
      // Simple mode: use variations
      const variationsToGenerate = activeAvatar.variations.filter(v => selectedVariations.has(v.id));
      variationsWithFullPrompt = variationsToGenerate.map(v => ({
        id: v.id,
        name: v.name,
        prompt: buildFinalPrompt(activeAvatar.mainPrompt, v.prompt),
        orientation: v.orientation
      }));
    }

    const totalImages = variationsWithFullPrompt.length * batchQuantity;
    setGenerationProgress(`Starting batch generation of ${totalImages} images...`);
    log(`Starting batch generation: ${totalImages} images (${isAdvancedMode ? 'Advanced' : 'Simple'} mode)`, LogStatus.WORKING);

    try {
      const res = await fetch('/api/image-creation/batch-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainPrompt: '', // Already included in variation prompts
          variations: variationsWithFullPrompt,
          model: settings.image_generation_model || 'gpt-image-1.5',
          quality: batchQuality, // Use batch-specific quality setting
          referenceImageUrls: settings.reference_images.map(i => i.url).filter(url => !url.startsWith('data:')),
          quantity: batchQuantity,
          workflowId // Pass workflowId to lookup WP credentials and upload images
        })
      });

      const data = await res.json();

      if (data.success) {
        const successCount = data.images?.length || 0;
        const failCount = data.errors?.length || 0;

        if (successCount > 0) {
          const newBankImages: BankImage[] = data.images.map((img: any) => ({
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url: img.wpUrl || img.url, // Prefer WordPress URL if available
            variation: img.variation,
            variationId: img.variationId,
            avatarTag: activeAvatar?.tag, // Link images to avatar's tag for routing
            orientation: img.orientation,
            prompt: img.prompt,
            createdAt: new Date().toISOString(),
            model: img.model || settings.image_generation_model || 'flux-1.1-pro',
            used: false,
            wpUrl: img.wpUrl || null, // WordPress Media Library URL
            wpMediaId: img.wpMediaId || null // WordPress Media Library ID
          }));

          updateSettings({
            image_bank: [...settings.image_bank, ...newBankImages]
          });

          // Sync to new database API (bulk add)
          try {
            await fetch(`/api/image-bank/${workflowId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ images: newBankImages })
            });
          } catch (err) {
            console.error('[Image Bank] Bulk add API failed:', err);
          }

          setGenerationProgress('');
          log(`Batch complete: ${successCount} generated, ${failCount} failed`, LogStatus.SUCCESS);
          showNotification(`Generated ${successCount} images!`, 'success');

          // Create feedback request for later review
          const feedbackImages = data.images.map((img: any) => ({ url: img.url, prompt: img.prompt }));
          createFeedbackRequest(feedbackImages, 'batch');
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

  // ========== FEEDBACK SYSTEM ==========

  /**
   * Create a feedback request after image generation
   */
  const createFeedbackRequest = async (images: { url: string; prompt: string }[], runType: string) => {
    try {
      const res = await fetch('/api/feedback/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: workflowId || 1,
          avatar_id: activeAvatar?.id ? parseInt(activeAvatar.id) : null,
          run_type: runType,
          generated_images: images.map(img => ({ url: img.url, prompt: img.prompt })),
          prompts_used: images.map(img => img.prompt)
        })
      });

      const data = await res.json();
      if (data.success) {
        // Store the feedback request for later review
        const newRequest = data.data.feedbackRequest;
        if (newRequest) {
          setRecentGenerations(prev => [newRequest, ...prev].slice(0, 10)); // Keep last 10
          setPendingFeedbackRequest(newRequest);
          setPendingQuestions(data.data.pendingQuestions || []);
          setFeedbackGlowDismissed(false); // Reset glow for new generations
        }
        log('Feedback request created - click "Review" when ready to critique', LogStatus.INFO);
      }
    } catch (error) {
      console.error('[Feedback] Failed to create request:', error);
    }
  };

  /**
   * Handle feedback submission
   */
  const handleFeedbackSubmit = async (feedback: {
    rating: string;
    quick_tags: string[];
    detailed_feedback: string;
    questions_answered: { questionId: number; answer: string }[];
  }) => {
    if (!pendingFeedbackRequest) return;

    try {
      const res = await fetch(`/api/feedback/submit/${pendingFeedbackRequest.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback)
      });

      const data = await res.json();
      if (data.success) {
        log(`Feedback submitted: ${feedback.rating} rating`, LogStatus.SUCCESS);
        showNotification('Thanks! Your feedback helps AI improve.', 'success');
        setShowFeedbackPopup(false);
        setPendingFeedbackRequest(null);
        // Remove from recent generations
        setRecentGenerations(prev => prev.filter(r => r.id !== pendingFeedbackRequest.id));
      }
    } catch (error) {
      console.error('[Feedback] Submit error:', error);
      showNotification('Failed to submit feedback', 'error');
    }
  };

  /**
   * Skip feedback for this run
   */
  const handleFeedbackSkip = async () => {
    if (!pendingFeedbackRequest) {
      setShowFeedbackPopup(false);
      return;
    }

    try {
      await fetch(`/api/feedback/skip/${pendingFeedbackRequest.id}`, { method: 'POST' });
      setShowFeedbackPopup(false);
      setPendingFeedbackRequest(null);
      setRecentGenerations(prev => prev.filter(r => r.id !== pendingFeedbackRequest.id));
    } catch (error) {
      console.error('[Feedback] Skip error:', error);
    }
  };

  /**
   * Open feedback for a specific generation
   */
  const openFeedbackForGeneration = (request: FeedbackRequest) => {
    setPendingFeedbackRequest(request);
    setShowFeedbackPopup(true);
  };

  // Bank Management - Now using new API for persistence
  const handleRemoveFromBank = async (imageId: string) => {
    const image = settings.image_bank.find(i => i.id === imageId);
    const newBank = settings.image_bank.filter(i => i.id !== imageId);
    updateSettings({ image_bank: newBank });

    // Sync to database API
    try {
      const apiId = image?.dbId || imageId;
      await fetch(`/api/image-bank/${workflowId}/${apiId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('[Image Bank] Delete API failed:', err);
    }
    showNotification('Image removed from bank', 'info');
  };

  const handleMarkAsUsed = async (imageId: string, pageUrl: string) => {
    const image = settings.image_bank.find(i => i.id === imageId);
    const newBank = settings.image_bank.map(img =>
      img.id === imageId ? { ...img, used: true, usedOn: pageUrl, usedAt: new Date().toISOString() } : img
    );
    updateSettings({ image_bank: newBank });

    // Sync to database API
    try {
      const apiId = image?.dbId || imageId;
      await fetch(`/api/image-bank/${workflowId}/mark-used/${apiId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usedOn: pageUrl })
      });
    } catch (err) {
      console.error('[Image Bank] Mark used API failed:', err);
    }
    log(`Image marked as used on: ${pageUrl}`, LogStatus.INFO);
  };

  const handleRestoreFromUsed = async (imageId: string) => {
    const image = settings.image_bank.find(i => i.id === imageId);
    const newBank = settings.image_bank.map(img =>
      img.id === imageId ? { ...img, used: false, usedOn: undefined, usedAt: undefined } : img
    );
    updateSettings({ image_bank: newBank });

    // Sync to database API
    try {
      const apiId = image?.dbId || imageId;
      await fetch(`/api/image-bank/${workflowId}/${apiId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ used: false, usedOn: null })
      });
    } catch (err) {
      console.error('[Image Bank] Restore API failed:', err);
    }
    showNotification('Image restored to available', 'info');
  };

  const handleArchiveImage = async (imageId: string) => {
    const image = settings.image_bank.find(i => i.id === imageId);
    const newArchived = !image?.archived;
    const newBank = settings.image_bank.map(img =>
      img.id === imageId ? { ...img, archived: newArchived } : img
    );
    updateSettings({ image_bank: newBank });

    // Sync to database API
    try {
      const apiId = image?.dbId || imageId;
      if (newArchived) {
        await fetch(`/api/image-bank/${workflowId}/archive/${apiId}`, { method: 'POST' });
      } else {
        await fetch(`/api/image-bank/${workflowId}/${apiId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived: false })
        });
      }
    } catch (err) {
      console.error('[Image Bank] Archive API failed:', err);
    }
    showNotification(image?.archived ? 'Image restored from archive' : 'Image archived', 'info');
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

    // Sync to new database API
    try {
      await fetch(`/api/image-bank/${workflowId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: newImages })
      });
    } catch (err) {
      console.error('[Image Bank] Upload sync API failed:', err);
    }

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

            // Sync to API
            try {
              const apiId = img.dbId || img.id;
              await fetch(`/api/image-bank/${workflowId}/${apiId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: data.suggestedTitle || img.title,
                  category: data.suggestedCategory || img.category
                })
              });
            } catch (err) {
              console.error('[Image Bank] Auto-tag sync API failed:', err);
            }
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
  const handleUpdateImageTitle = async (imageId: string, newTitle: string) => {
    const image = settings.image_bank.find(i => i.id === imageId);
    const newBank = settings.image_bank.map(img =>
      img.id === imageId ? { ...img, title: newTitle } : img
    );
    updateSettings({ image_bank: newBank });
    setEditingImageId(null);
    setEditingTitle('');

    // Sync to API
    try {
      const apiId = image?.dbId || imageId;
      await fetch(`/api/image-bank/${workflowId}/${apiId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
    } catch (err) {
      console.error('[Image Bank] Update title API failed:', err);
    }
  };

  /**
   * Update image category
   */
  const handleUpdateImageCategory = async (imageId: string, newCategory: string) => {
    const image = settings.image_bank.find(i => i.id === imageId);
    const newBank = settings.image_bank.map(img =>
      img.id === imageId ? { ...img, category: newCategory } : img
    );
    updateSettings({ image_bank: newBank });

    // Sync to API
    try {
      const apiId = image?.dbId || imageId;
      await fetch(`/api/image-bank/${workflowId}/${apiId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory })
      });
    } catch (err) {
      console.error('[Image Bank] Update category API failed:', err);
    }
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
          options: [...cat.options, {
            number: nextNumber,
            text: '',
            primaryKeywords: [],
            secondaryKeywords: [],
            useSecondaryKeywords: true // Default to ON
          }]
        };
      }
      return cat;
    });
    handleUpdateAvatar(activeAvatar.id, { placeholderCategories: updatedCategories });
  };

  const handleUpdatePlaceholderOption = (categoryId: string, optionNumber: number, updates: Partial<PlaceholderOption>) => {
    if (!activeAvatar) return;
    const categories = activeAvatar.placeholderCategories || [];
    const updatedCategories = categories.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          options: cat.options.map(opt =>
            opt.number === optionNumber ? { ...opt, ...updates } : opt
          )
        };
      }
      return cat;
    });
    handleUpdateAvatar(activeAvatar.id, { placeholderCategories: updatedCategories });
  };

  // Add a keyword to an option (primary or secondary)
  const handleAddKeyword = (categoryId: string, optionNumber: number, keyword: string, type: 'primary' | 'secondary') => {
    if (!activeAvatar || !keyword.trim()) return;
    const categories = activeAvatar.placeholderCategories || [];
    const cat = categories.find(c => c.id === categoryId);
    const opt = cat?.options.find(o => o.number === optionNumber);
    if (!opt) return;

    const keywordsArray = type === 'primary'
      ? [...(opt.primaryKeywords || []), keyword.trim()]
      : [...(opt.secondaryKeywords || []), keyword.trim()];

    handleUpdatePlaceholderOption(categoryId, optionNumber, {
      [type === 'primary' ? 'primaryKeywords' : 'secondaryKeywords']: keywordsArray
    });
  };

  // Remove a keyword from an option
  const handleRemoveKeyword = (categoryId: string, optionNumber: number, keyword: string, type: 'primary' | 'secondary') => {
    if (!activeAvatar) return;
    const categories = activeAvatar.placeholderCategories || [];
    const cat = categories.find(c => c.id === categoryId);
    const opt = cat?.options.find(o => o.number === optionNumber);
    if (!opt) return;

    const keywordsArray = type === 'primary'
      ? (opt.primaryKeywords || []).filter(k => k !== keyword)
      : (opt.secondaryKeywords || []).filter(k => k !== keyword);

    handleUpdatePlaceholderOption(categoryId, optionNumber, {
      [type === 'primary' ? 'primaryKeywords' : 'secondaryKeywords']: keywordsArray
    });
  };

  // Detect shared/ambiguous keywords across categories
  const sharedKeywords = useMemo(() => {
    if (!activeAvatar?.placeholderCategories) return new Map();

    const keywordToCategories = new Map<string, string[]>();

    activeAvatar.placeholderCategories.forEach(cat => {
      if (cat.isRandomized) return;
      cat.options?.forEach(opt => {
        (opt.primaryKeywords || []).forEach(kw => {
          const kwLower = kw.toLowerCase().trim();
          if (!kwLower) return;
          if (!keywordToCategories.has(kwLower)) {
            keywordToCategories.set(kwLower, []);
          }
          const cats = keywordToCategories.get(kwLower)!;
          if (!cats.includes(cat.name)) {
            cats.push(cat.name);
          }
        });
      });
    });

    // Filter to only shared keywords (2+ categories)
    const shared = new Map<string, string[]>();
    keywordToCategories.forEach((categories, keyword) => {
      if (categories.length > 1) {
        shared.set(keyword, categories);
      }
    });

    return shared;
  }, [activeAvatar?.placeholderCategories]);

  // Check if a keyword is shared across categories
  const isSharedKeyword = (keyword: string): string[] | null => {
    const kwLower = keyword.toLowerCase().trim();
    return sharedKeywords.get(kwLower) || null;
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
      {/* Model Selectors + Save */}
      <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-brand-gold/50 flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Image Generation Model - The model that creates images */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-brand-gold/70">Image Model:</label>
            <select
              value={settings.image_generation_model || 'flux-1.1-pro'}
              onChange={(e) => updateSettings({ image_generation_model: e.target.value })}
              className="bg-slate-900 border border-brand-gold/50 rounded px-2 py-1 text-white text-sm"
            >
              {IMAGE_GENERATION_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          {/* Image Quality - different options based on model */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-brand-gold/70">Quality:</label>
            <select
              value={settings.image_quality || 'low'}
              onChange={(e) => updateSettings({ image_quality: e.target.value as 'low' | 'medium' | 'high' })}
              className="bg-slate-900 border border-brand-gold/50 rounded px-2 py-1 text-white text-sm"
            >
              {(settings.image_generation_model || 'flux-1.1-pro').startsWith('gpt-image') ? (
                <>
                  <option value="low">Low ($0.01) - Web</option>
                  <option value="medium">Medium ($0.04)</option>
                  <option value="high">High ($0.17) - Print</option>
                </>
              ) : (
                <>
                  <option value="low">60% - Small files</option>
                  <option value="medium">80% - Balanced</option>
                  <option value="high">100% - Max quality</option>
                </>
              )}
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
          {/* Save Button for Image Creation */}
          <button
            onClick={forceSave}
            disabled={saving || !loaded}
            className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition ${
              hasUnsavedChanges
                ? 'bg-yellow-500 hover:bg-yellow-600 text-slate-900'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
            title={loaded ? "Click to save Image Creation settings" : "Loading..."}
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                </svg>
                <span>{hasUnsavedChanges ? 'Save' : 'Saved'}</span>
                {lastSaved && (
                  <span className="text-[10px] opacity-75">{lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Prompt Guide Modal - Shows both GPT-Image and Flux guides */}
      {showPromptGuide && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-brand-gold/50 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-brand-gold/30">
              <div>
                <h2 className="text-xl font-bold text-brand-gold">Image Model Prompting Guide</h2>
                <p className="text-sm text-brand-gold/60">Tips for GPT-Image-1.5 and Flux 1.1 Pro</p>
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
            <div className="overflow-y-auto p-4 space-y-6">
              {/* Quick Reference: Image Creation vs WordPress Publishing */}
              <div className="border border-brand-gold/50 rounded-lg overflow-hidden">
                <div className="bg-brand-gold/10 px-4 py-2 border-b border-brand-gold/30">
                  <h3 className="text-sm font-bold text-brand-gold">Quick Reference: Where Images Are Used</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-800">
                        <th className="px-3 py-2 text-left text-brand-gold/80 font-medium">Feature</th>
                        <th className="px-3 py-2 text-left text-purple-300 font-medium">Image Creation (Section 7)</th>
                        <th className="px-3 py-2 text-left text-brand-cyan font-medium">WordPress Publishing</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      <tr className="border-t border-slate-700">
                        <td className="px-3 py-2 text-brand-gold/70 font-medium">Purpose</td>
                        <td className="px-3 py-2"><strong>Batch generation</strong> - Create multiple images upfront to populate Image Bank</td>
                        <td className="px-3 py-2"><strong>Auto-publish</strong> - Generate images on-the-fly during WordPress publishing</td>
                      </tr>
                      <tr className="border-t border-slate-700 bg-slate-800/30">
                        <td className="px-3 py-2 text-brand-gold/70 font-medium">When Used</td>
                        <td className="px-3 py-2">Before running workflows, to build up a library of images</td>
                        <td className="px-3 py-2">During article generation when auto-publishing to WordPress</td>
                      </tr>
                      <tr className="border-t border-slate-700">
                        <td className="px-3 py-2 text-brand-gold/70 font-medium">Storage</td>
                        <td className="px-3 py-2">Images go to <strong>Image Bank</strong> for reuse across articles</td>
                        <td className="px-3 py-2">Images generated per article and uploaded to WordPress media</td>
                      </tr>
                      <tr className="border-t border-slate-700 bg-slate-800/30">
                        <td className="px-3 py-2 text-brand-gold/70 font-medium">Model Selection</td>
                        <td className="px-3 py-2">Per-workflow setting (saved with workflow)</td>
                        <td className="px-3 py-2">Per-project setting (in WordPress section)</td>
                      </tr>
                      <tr className="border-t border-slate-700">
                        <td className="px-3 py-2 text-brand-gold/70 font-medium">Typical Flow</td>
                        <td className="px-3 py-2">1. Set model/variations → 2. Generate batch → 3. Images saved to bank → 4. Articles pull from bank</td>
                        <td className="px-3 py-2">1. Article generated → 2. Model generates image → 3. Uploads to WordPress → 4. Page published</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Flux 1.1 Pro Section */}
              <div className="border border-purple-500/50 rounded-lg overflow-hidden">
                <div className="bg-purple-900/30 px-4 py-3 border-b border-purple-500/30">
                  <h3 className="text-lg font-bold text-purple-300">Flux 1.1 Pro</h3>
                  <p className="text-xs text-purple-300/70">{IMAGE_PROMPT_GUIDES['flux-1.1-pro'].provider} | {IMAGE_PROMPT_GUIDES['flux-1.1-pro'].pricing}</p>
                </div>
                <div className="p-4 space-y-3">
                  {IMAGE_PROMPT_GUIDES['flux-1.1-pro'].sections.map((section, idx) => (
                    <div key={idx} className="bg-slate-800/50 rounded-lg p-3">
                      <h4 className="text-sm font-semibold text-purple-300 mb-2">{section.title}</h4>
                      <ul className="space-y-1">
                        {section.tips.map((tip, tipIdx) => (
                          <li key={tipIdx} className="flex items-start gap-2 text-xs text-gray-300">
                            <span className="text-purple-400 mt-0.5">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <h4 className="text-sm font-semibold text-purple-300 mb-2">Documentation</h4>
                    <ul className="space-y-1 text-xs">
                      {IMAGE_PROMPT_GUIDES['flux-1.1-pro'].links.map((link, idx) => (
                        <li key={idx}>
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                            {link.name} →
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* GPT-Image-1.5 Section */}
              <div className="border border-brand-cyan/50 rounded-lg overflow-hidden">
                <div className="bg-brand-cyan/10 px-4 py-3 border-b border-brand-cyan/30">
                  <h3 className="text-lg font-bold text-brand-cyan">GPT-Image-1.5</h3>
                  <p className="text-xs text-brand-cyan/70">{IMAGE_PROMPT_GUIDES['gpt-image-1.5'].provider} | {IMAGE_PROMPT_GUIDES['gpt-image-1.5'].pricing}</p>
                </div>
                <div className="p-4 space-y-3">
                  {IMAGE_PROMPT_GUIDES['gpt-image-1.5'].sections.map((section, idx) => (
                    <div key={idx} className="bg-slate-800/50 rounded-lg p-3">
                      <h4 className="text-sm font-semibold text-brand-cyan mb-2">{section.title}</h4>
                      <ul className="space-y-1">
                        {section.tips.map((tip, tipIdx) => (
                          <li key={tipIdx} className="flex items-start gap-2 text-xs text-gray-300">
                            <span className="text-brand-gold mt-0.5">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <h4 className="text-sm font-semibold text-brand-cyan mb-2">Documentation</h4>
                    <ul className="space-y-1 text-xs">
                      {IMAGE_PROMPT_GUIDES['gpt-image-1.5'].links.map((link, idx) => (
                        <li key={idx}>
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                            {link.name} →
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
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

      {/* ========== PROMPT PROBLEM AREAS ========== */}
      <div className="bg-slate-900 rounded-lg border border-orange-500/50 overflow-hidden">
        <div
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-800/50 transition"
          onClick={() => setProblemAreasCollapsed(!problemAreasCollapsed)}
        >
          <div className="flex items-center gap-2">
            <span className={`text-orange-400 transition-transform ${problemAreasCollapsed ? '' : 'rotate-90'}`}>▶</span>
            <span className="text-orange-400 font-semibold">🎯 Prompt Problem Areas</span>
            {settings.prompt_problem_areas.length > 0 && (
              <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded">
                {settings.prompt_problem_areas.length} areas • {settings.prompt_problem_areas.flatMap(a => a.prompts.filter(p => p.status === 'working')).length} working
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleAddProblemArea(); }}
            className="text-orange-400 hover:text-orange-300 text-sm font-medium transition"
          >
            + Add Area
          </button>
        </div>

        {!problemAreasCollapsed && (
          <div className="p-3 border-t border-orange-500/30 space-y-3">
            {settings.prompt_problem_areas.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <p className="text-sm">No problem areas yet.</p>
                <p className="text-xs mt-1">Add areas for issues like "Logo Visibility", "Camera Angles", etc.</p>
              </div>
            ) : (
              <>
                {/* Area Tabs */}
                <div className="flex flex-wrap gap-2">
                  {settings.prompt_problem_areas.map(area => (
                    <button
                      key={area.id}
                      onClick={() => setActiveProblemAreaId(activeProblemAreaId === area.id ? null : area.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                        area.status === 'solved'
                          ? activeProblemAreaId === area.id
                            ? 'bg-green-500 text-slate-900'
                            : 'bg-green-900/50 text-green-400 hover:bg-green-900/70 border border-green-500/50'
                          : activeProblemAreaId === area.id
                            ? 'bg-orange-500 text-slate-900'
                            : 'bg-slate-800 text-orange-400 hover:bg-slate-700'
                      }`}
                    >
                      {area.status === 'solved' ? (
                        <span className="text-green-300">✓</span>
                      ) : (
                        <span className={`w-2 h-2 rounded-full ${
                          area.priority === 'high' ? 'bg-red-500' :
                          area.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`} />
                      )}
                      {area.name}
                      {area.status === 'solved' ? (
                        <span className="text-xs opacity-70">SOLVED</span>
                      ) : (
                        <span className="text-xs opacity-70">({area.prompts.length})</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Active Area Editor */}
                {activeProblemAreaId && (() => {
                  const area = getActiveProblemArea();
                  if (!area) return null;
                  return (
                    <div className="bg-slate-800/50 rounded-lg p-3 space-y-3 border border-orange-500/20">
                      {/* Area Header */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={area.name}
                            onChange={(e) => handleUpdateProblemArea(area.id, { name: e.target.value })}
                            className="w-full bg-slate-900 border border-orange-500/30 rounded px-2 py-1 text-white text-sm font-medium"
                            placeholder="Problem area name..."
                          />
                          <textarea
                            value={area.context}
                            onChange={(e) => handleUpdateProblemArea(area.id, { context: e.target.value })}
                            className="w-full bg-slate-900 border border-orange-500/30 rounded px-2 py-1 text-white text-xs resize-y"
                            rows={2}
                            placeholder="Context: Why is this a problem? What are you trying to solve?"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          {area.status === 'solved' ? (
                            <div className="bg-green-900/50 border border-green-500 rounded px-2 py-1 text-xs text-green-300 text-center">
                              ✓ SOLVED
                            </div>
                          ) : (
                            <>
                              <select
                                value={area.priority}
                                onChange={(e) => handleUpdateProblemArea(area.id, { priority: e.target.value as 'high' | 'medium' | 'low' })}
                                className="bg-slate-900 border border-orange-500/30 rounded px-2 py-1 text-xs text-white"
                              >
                                <option value="high">🔴 High</option>
                                <option value="medium">🟡 Medium</option>
                                <option value="low">🟢 Low</option>
                              </select>
                              <button
                                onClick={() => {
                                  const workingPrompt = area.prompts.find(p => p.status === 'working');
                                  handleUpdateProblemArea(area.id, {
                                    status: 'solved',
                                    solvedPromptId: workingPrompt?.id
                                  });
                                  log(`Problem area "${area.name}" marked as SOLVED!`, LogStatus.SUCCESS);
                                }}
                                disabled={!area.prompts.some(p => p.status === 'working')}
                                className={`text-xs transition px-2 py-1 rounded ${
                                  area.prompts.some(p => p.status === 'working')
                                    ? 'bg-green-600 hover:bg-green-500 text-white'
                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                }`}
                                title={area.prompts.some(p => p.status === 'working') ? 'Mark as solved' : 'Need at least one working prompt'}
                              >
                                ✓ Solved
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => area.status === 'solved'
                              ? handleUpdateProblemArea(area.id, { status: 'active' })
                              : handleRemoveProblemArea(area.id)
                            }
                            className="text-xs text-red-400 hover:text-red-300 transition"
                          >
                            {area.status === 'solved' ? 'Reopen' : 'Delete'}
                          </button>
                        </div>
                      </div>

                      {/* Prompts Within This Area */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-orange-300 font-medium">Solution Prompts:</span>
                          <button
                            onClick={() => handleAddPromptToArea(area.id)}
                            className="text-xs text-orange-400 hover:text-orange-300 transition"
                          >
                            + Add Prompt
                          </button>
                        </div>

                        {area.prompts.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-2">No prompts yet. Add prompts that might solve this problem.</p>
                        ) : (
                          <div className="space-y-2">
                            {area.prompts.map((prompt, idx) => (
                              <div key={prompt.id} className="bg-slate-900/50 rounded p-2 space-y-1.5 border border-slate-700">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 font-mono">#{idx + 1}</span>
                                  <input
                                    type="text"
                                    value={prompt.miniContext}
                                    onChange={(e) => handleUpdatePromptInArea(area.id, prompt.id, { miniContext: e.target.value })}
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-white text-xs"
                                    placeholder="Brief context for this prompt..."
                                  />
                                  <select
                                    value={prompt.status}
                                    onChange={(e) => handleUpdatePromptInArea(area.id, prompt.id, { status: e.target.value as 'testing' | 'working' | 'failed' })}
                                    className={`text-xs rounded px-2 py-0.5 border ${
                                      prompt.status === 'working' ? 'bg-green-900/50 border-green-500 text-green-300' :
                                      prompt.status === 'failed' ? 'bg-red-900/50 border-red-500 text-red-300' :
                                      'bg-yellow-900/50 border-yellow-500 text-yellow-300'
                                    }`}
                                  >
                                    <option value="testing">🧪 Testing</option>
                                    <option value="working">✅ Working</option>
                                    <option value="failed">❌ Failed</option>
                                  </select>
                                  <button
                                    onClick={() => handleRemovePromptFromArea(area.id, prompt.id)}
                                    className="text-red-400 hover:text-red-300 text-xs"
                                  >
                                    ×
                                  </button>
                                </div>
                                <textarea
                                  value={prompt.promptText}
                                  onChange={(e) => handleUpdatePromptInArea(area.id, prompt.id, { promptText: e.target.value })}
                                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs font-mono resize-y"
                                  rows={2}
                                  placeholder="The actual prompt technique to try..."
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Working Prompts Summary */}
                      {area.prompts.filter(p => p.status === 'working').length > 0 && (
                        <div className="bg-green-900/20 border border-green-500/30 rounded p-2">
                          <span className="text-xs text-green-400 font-medium">
                            ✅ {area.prompts.filter(p => p.status === 'working').length} working prompt(s) - AI will use these
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>

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
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setAvatarsCollapsed(!avatarsCollapsed)}
            >
              <div className="flex items-center gap-3">
                <span className={`text-brand-gold transition-transform ${avatarsCollapsed ? '' : 'rotate-90'}`}>▶</span>
                <h3 className="text-brand-gold font-semibold">Audience Avatars</h3>
                {tags.length > 0 && (
                  <span className="text-xs text-brand-cyan/70 bg-brand-cyan/10 px-2 py-0.5 rounded">
                    Synced with Tag Manager: {tags.map(t => t.name).join(', ')}
                  </span>
                )}
                {avatarsCollapsed && activeAvatar && (
                  <span className="text-xs text-brand-gold/50 bg-slate-800 px-2 py-0.5 rounded">
                    Active: {activeAvatar.name}
                  </span>
                )}
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleAddAvatar(); }} className="text-brand-cyan hover:text-brand-cyan-light text-sm font-medium transition">+ Add Avatar</button>
            </div>

            {!avatarsCollapsed && <div className="mt-3">

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
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setCategoriesCollapsed(!categoriesCollapsed)}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-purple-400 transition-transform ${categoriesCollapsed ? '' : 'rotate-90'}`}>▶</span>
                        <label className="text-sm text-purple-300 font-medium cursor-pointer">Placeholder Categories</label>
                        {categoriesCollapsed && (activeAvatar.placeholderCategories || []).length > 0 && (
                          <span className="text-xs text-purple-400/70 bg-slate-800 px-2 py-0.5 rounded">
                            {(activeAvatar.placeholderCategories || []).length} categories
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddPlaceholderCategory(); }}
                        className="px-2 py-1 bg-purple-600/50 hover:bg-purple-600 rounded text-white text-xs transition"
                      >
                        + Add Category
                      </button>
                    </div>

                    {/* Category List */}
                    {!categoriesCollapsed && (<>
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

                        {/* Options for this category - Stacked Layout */}
                        <div className="pl-2 space-y-3">
                          {category.options.map((option, optIndex) => (
                            <div key={option.number} className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
                              {/* Row 1: Keywords */}
                              <div className="p-2 bg-slate-800/50 border-b border-slate-700">
                                <div className="flex items-start gap-4">
                                  {/* Option Number */}
                                  <span className="w-6 h-6 flex items-center justify-center bg-purple-600 rounded text-white text-xs font-bold">{option.number}</span>

                                  {/* Primary Keywords */}
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1 mb-1">
                                      <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide">Primary</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1">
                                      {(option.primaryKeywords || []).map((kw, kwIdx) => {
                                        const sharedWith = isSharedKeyword(kw);
                                        const isShared = sharedWith && sharedWith.length > 1;
                                        return (
                                          <span
                                            key={kwIdx}
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                              isShared
                                                ? 'bg-orange-600/30 border border-orange-500 text-orange-300'
                                                : 'bg-emerald-600/30 border border-emerald-500 text-emerald-300'
                                            }`}
                                            title={isShared ? `⚠️ Shared across: ${sharedWith.join(', ')} - requires category keyword in article` : undefined}
                                          >
                                            {isShared && <span className="text-orange-400">⚠️</span>}
                                            {kw}
                                            <button onClick={() => handleRemoveKeyword(category.id, option.number, kw, 'primary')} className={`${isShared ? 'text-orange-400' : 'text-emerald-400'} hover:text-red-400`}>×</button>
                                          </span>
                                        );
                                      })}
                                      <input
                                        type="text"
                                        className="w-20 bg-slate-900 border border-emerald-500/30 rounded px-1.5 py-0.5 text-emerald-300 text-xs placeholder-emerald-700"
                                        placeholder="+ add"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                            handleAddKeyword(category.id, option.number, e.currentTarget.value, 'primary');
                                            e.currentTarget.value = '';
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Secondary Keywords */}
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide">Secondary</span>
                                      <label className="flex items-center gap-1 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={option.useSecondaryKeywords !== false}
                                          onChange={(e) => handleUpdatePlaceholderOption(category.id, option.number, { useSecondaryKeywords: e.target.checked })}
                                          className="w-3 h-3 rounded border-amber-500 text-amber-500 focus:ring-amber-500 bg-slate-900"
                                        />
                                        <span className="text-[9px] text-amber-400/70">ON</span>
                                      </label>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1">
                                      {/* Auto-add category name as first secondary keyword (shown as locked) */}
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-600/20 border border-amber-500/50 rounded text-amber-300/70 text-xs italic">
                                        {category.name.toLowerCase()}
                                        <svg className="w-2.5 h-2.5 text-amber-500/50" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                      </span>
                                      {(option.secondaryKeywords || []).map((kw, kwIdx) => (
                                        <span key={kwIdx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-600/30 border border-amber-500 rounded text-amber-300 text-xs">
                                          {kw}
                                          <button onClick={() => handleRemoveKeyword(category.id, option.number, kw, 'secondary')} className="text-amber-400 hover:text-red-400">×</button>
                                        </span>
                                      ))}
                                      <input
                                        type="text"
                                        className="w-20 bg-slate-900 border border-amber-500/30 rounded px-1.5 py-0.5 text-amber-300 text-xs placeholder-amber-700"
                                        placeholder="+ add"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                            handleAddKeyword(category.id, option.number, e.currentTarget.value, 'secondary');
                                            e.currentTarget.value = '';
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Delete Option */}
                                  <button
                                    onClick={() => handleRemovePlaceholderOption(category.id, option.number)}
                                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded transition"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Row 2: Prompt Text */}
                              <div className="p-2">
                                <input
                                  type="text"
                                  value={option.text}
                                  onChange={(e) => handleUpdatePlaceholderOption(category.id, option.number, { text: e.target.value })}
                                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                                  placeholder={`Prompt text for option ${option.number}...`}
                                />
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() => handleAddPlaceholderOption(category.id)}
                            className="w-full py-2 border-2 border-dashed border-purple-500/30 rounded-lg text-purple-400 hover:border-purple-500 hover:text-purple-300 text-xs transition"
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
                    </>)}
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
            </div>}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    {!isPromptPlanningSession ? (
                      <button
                        onClick={startPromptPlanningSession}
                        disabled={consultantLoading}
                        className="px-2 py-1 bg-purple-600/50 hover:bg-purple-600 disabled:opacity-50 rounded text-white text-xs transition flex items-center gap-1"
                        title="Start a guided prompt planning session"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Prompt Planning
                      </button>
                    ) : (
                      <button
                        onClick={endPromptPlanningSession}
                        disabled={consultantLoading}
                        className="px-2 py-1 bg-amber-600/50 hover:bg-amber-600 disabled:opacity-50 rounded text-white text-xs transition flex items-center gap-1 animate-pulse"
                        title="End session and export prompts"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        End & Export
                      </button>
                    )}
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

                {/* Context info panel - Enhanced visibility */}
                <div className="px-3 py-2 bg-indigo-900/20 border-b border-indigo-500/20 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3 text-indigo-300/80">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                        <strong>AI Sees:</strong>
                      </span>
                      {consultantContext.workflow && (
                        <span title="Workflow info">📁 {consultantContext.workflow.name}</span>
                      )}
                      {consultantContext.articles.length > 0 && (
                        <span title="Articles">📝 {consultantContext.articles.length} articles</span>
                      )}
                      {consultantContext.websites.length > 0 && (
                        <span title="Websites">🌐 {consultantContext.websites.length} sites</span>
                      )}
                      <span title="Reference images">📷 {settings.reference_images.length}</span>
                      <span title="Image bank">🏦 {availableImages.length}</span>
                      <span title="Avatars">👥 {settings.audience_avatars.length}</span>
                      {tags.length > 0 && <span title="Tags">🏷️ {tags.length}</span>}
                    </div>
                    <button
                      onClick={() => fetchConsultantContext()}
                      disabled={fetchingContext}
                      className="px-2 py-0.5 bg-indigo-600/30 hover:bg-indigo-600/50 rounded text-indigo-300 transition flex items-center gap-1"
                      title="Refresh context data"
                    >
                      <svg className={`w-3 h-3 ${fetchingContext ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {fetchingContext ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>
                  <div className="mt-1 text-indigo-400/60">
                    Full context: workflow details, all articles, prompts, placeholders, image bank, branding, and settings
                  </div>
                </div>

                {/* Prompt Planning Session Banner */}
                {isPromptPlanningSession && (
                  <div className="px-3 py-2 bg-purple-900/40 border-b border-purple-500/50 text-xs text-purple-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
                      <strong>PROMPT PLANNING SESSION</strong> - Building your image prompt library
                    </div>
                    <span className="text-purple-300/70">Click "End & Export" when ready</span>
                  </div>
                )}

                {/* Chat messages */}
                <div ref={consultantChatRef} className="h-72 overflow-y-auto p-4 space-y-3">
                  {settings.consultant_chat_history.length === 0 ? (
                    <div className="text-center text-indigo-300/50 py-6 space-y-3">
                      <p className="text-lg">🎨 Full-Context Consultant</p>
                      <p className="text-sm">I can see everything in your system and answer any question.</p>
                      <div className="text-xs text-indigo-400/60 space-y-1">
                        <p>Ask me about:</p>
                        <p>• Image prompts, variations, and style strategy</p>
                        <p>• Your articles, keywords, and content planning</p>
                        <p>• Which images would work best for specific content</p>
                        <p>• SEO optimization and brand consistency</p>
                      </div>
                      <div className="pt-2">
                        <button
                          onClick={startPromptPlanningSession}
                          disabled={consultantLoading}
                          className="px-4 py-2 bg-purple-600/50 hover:bg-purple-600 rounded-lg text-white text-sm transition"
                        >
                          Or start a Prompt Planning Session
                        </button>
                      </div>
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
                  <textarea
                    value={consultantInput}
                    onChange={(e) => {
                      setConsultantInput(e.target.value);
                      // Auto-resize textarea
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendConsultantChat())}
                    placeholder="Discuss image style, branding, composition, SEO strategy..."
                    rows={1}
                    className="flex-1 bg-slate-900 border border-indigo-500/50 rounded px-3 py-2 text-white text-sm resize-none overflow-hidden min-h-[38px] max-h-[200px]"
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

          {/* Batch Generate (Collapsible) - Supports Simple and Advanced modes */}
          <div className="bg-slate-900 rounded-lg border border-green-500/50 overflow-hidden">
            <button onClick={() => setIsBatchOpen(!isBatchOpen)} className="w-full flex items-center justify-between p-3 text-green-400 hover:bg-slate-800/50 transition">
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                Batch Generate Images
                {activeAvatar?.placeholderMode === 'advanced' && (
                  <span className="ml-2 px-2 py-0.5 bg-purple-600 text-white text-[10px] rounded">ADVANCED</span>
                )}
              </span>
              <svg className={`w-5 h-5 transition-transform ${isBatchOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isBatchOpen && (
              <div className="p-4 border-t border-green-500/30 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-xs text-brand-gold/70">Quantity per {activeAvatar?.placeholderMode === 'advanced' ? 'combination' : 'variation'}:</label>
                  <input type="range" min="1" max="20" value={batchQuantity} onChange={(e) => setBatchQuantity(parseInt(e.target.value))} className="flex-1 min-w-[100px] accent-green-500" />
                  <span className="text-green-400 font-bold w-8 text-center">{batchQuantity}</span>

                  {/* Quality selector for batch generation */}
                  <div className="flex items-center gap-2 ml-4 pl-4 border-l border-green-500/30">
                    <label className="text-xs text-brand-gold/70">Quality:</label>
                    <select
                      value={batchQuality}
                      onChange={(e) => setBatchQuality(e.target.value as 'low' | 'medium' | 'high')}
                      className="bg-slate-800 border border-green-500/50 rounded px-2 py-1 text-white text-xs"
                    >
                      <option value="low">Low ($0.01) - Web</option>
                      <option value="medium">Medium ($0.04)</option>
                      <option value="high">High ($0.17) - Print</option>
                    </select>
                  </div>
                </div>

                {/* Advanced Mode: Category-based filtering */}
                {activeAvatar?.placeholderMode === 'advanced' ? (
                  <div className="space-y-3">
                    {/* Category Filter Dropdowns */}
                    {activeAvatar?.placeholderCategories && activeAvatar.placeholderCategories.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-brand-gold/70 font-medium">Filter by Category:</label>
                          <span className="text-xs text-green-400">
                            {filteredCombinations.length} of {placeholderCombinations.length} combinations
                          </span>
                        </div>

                        {/* Category filter rows */}
                        <div className="space-y-1">
                          {activeAvatar.placeholderCategories.map((category) => (
                            <div key={category.id} className="bg-slate-800/50 rounded border border-purple-500/30">
                              {/* Category header - clickable to expand */}
                              <button
                                onClick={() => toggleCategoryFilter(category.id)}
                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-700/50 transition"
                              >
                                <span className="flex items-center gap-2">
                                  <svg className={`w-4 h-4 text-purple-400 transition-transform ${categoryFiltersOpen.has(category.id) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                  </svg>
                                  <span className="text-sm text-white font-medium">{category.name}</span>
                                  <span className="text-xs text-purple-400 font-mono">{category.placeholder}</span>
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded bg-purple-600/50 text-purple-200">
                                  {getSelectedCountForCategory(category.id) || 'All'} / {category.options.length}
                                </span>
                              </button>

                              {/* Expanded options */}
                              {categoryFiltersOpen.has(category.id) && (
                                <div className="px-3 pb-3 pt-1 border-t border-purple-500/20">
                                  <div className="flex gap-2 mb-2">
                                    <button
                                      onClick={() => selectAllCategoryOptions(category.id, category.options)}
                                      className="text-[10px] text-brand-cyan hover:text-brand-cyan-light"
                                    >
                                      Select All
                                    </button>
                                    <button
                                      onClick={() => clearCategoryOptions(category.id)}
                                      className="text-[10px] text-red-400 hover:text-red-300"
                                    >
                                      Clear
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {category.options.map((option) => (
                                      <label
                                        key={option.number}
                                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition ${
                                          isOptionSelected(category.id, option.number)
                                            ? 'bg-green-500 text-slate-900 font-medium'
                                            : 'bg-slate-700 text-brand-gold hover:bg-slate-600 border border-slate-600'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isOptionSelected(category.id, option.number)}
                                          onChange={() => toggleCategoryOption(category.id, option.number)}
                                          className="hidden"
                                        />
                                        <span className="font-mono text-[9px] opacity-70">#{option.number}</span>
                                        <span className="truncate max-w-[150px]" title={option.text}>
                                          {option.text.substring(0, 25)}{option.text.length > 25 ? '...' : ''}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Select from filtered combinations */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-brand-gold/70">
                          Select Combinations ({filteredCombinations.length} shown):
                        </label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedCombinations(new Set(filteredCombinations.map(c => c.id)))}
                            className="text-xs text-brand-cyan hover:text-brand-cyan-light"
                          >
                            Select Filtered
                          </button>
                          <button onClick={selectAllCombinations} className="text-xs text-green-400 hover:text-green-300">Select All ({placeholderCombinations.length})</button>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 bg-slate-800/50 p-2 rounded">
                        {filteredCombinations.map((combo) => (
                          <label
                            key={combo.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded text-xs cursor-pointer transition ${
                              selectedCombinations.has(combo.id)
                                ? 'bg-green-500 text-slate-900'
                                : 'bg-slate-700 text-brand-gold hover:bg-slate-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedCombinations.has(combo.id)}
                              onChange={() => toggleCombinationSelection(combo.id)}
                              className="hidden"
                            />
                            <span className="font-mono text-[10px] text-purple-300 mr-2">{combo.shortLabel}</span>
                            <span className="truncate">{combo.label}</span>
                          </label>
                        ))}
                        {filteredCombinations.length === 0 && (
                          <p className="text-xs text-brand-gold/50 italic text-center py-2">No combinations match the current filters</p>
                        )}
                      </div>
                    </div>
                    {placeholderCombinations.length === 0 && (
                      <p className="text-xs text-brand-gold/50 italic">Add placeholder categories above to generate combinations</p>
                    )}
                  </div>
                ) : (
                  /* Simple Mode: Show variations */
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
                      {(!activeAvatar?.variations || activeAvatar.variations.length === 0) && (
                        <p className="text-xs text-brand-gold/50 italic">Add variations above first, or switch to Advanced mode</p>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleBatchGenerate}
                  disabled={generating || (activeAvatar?.placeholderMode === 'advanced' ? selectedCombinations.size === 0 : selectedVariations.size === 0)}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 rounded text-white font-bold transition"
                >
                  {generating ? 'Generating...' : `Generate ${(activeAvatar?.placeholderMode === 'advanced' ? selectedCombinations.size : selectedVariations.size) * batchQuantity} Images`}
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
                {/* Storage size indicator */}
                <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                  payloadSizeMB > 70 ? 'bg-red-600 text-white animate-pulse' :
                  payloadSizeMB > 50 ? 'bg-amber-600 text-white' :
                  payloadSizeMB > 30 ? 'bg-yellow-600 text-white' :
                  'bg-slate-700 text-slate-300'
                }`}>
                  {payloadSizeMB.toFixed(1)}MB / 100MB
                </span>
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
                      <label className="text-xs text-brand-gold/70">Model:</label>
                      <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} className="bg-slate-800 border border-brand-gold/50 rounded px-2 py-1 text-white text-xs">
                        <option value="all">All</option>
                        {uniqueModels.map(m => (<option key={m} value={m}>{m}</option>))}
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
                    {/* Archive toggle */}
                    <button
                      onClick={() => setShowArchived(!showArchived)}
                      className={`px-2 py-1 rounded text-xs transition flex items-center gap-1 ${showArchived ? 'bg-amber-600 text-white' : 'bg-slate-700 text-white/70 hover:bg-slate-600'}`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                      {showArchived ? 'Archived' : 'Archive'}
                    </button>
                  </div>
                  {/* Right side controls */}
                  <div className="flex items-center gap-2">
                    {/* Fullscreen toggle */}
                    <button
                      onClick={() => setBankFullscreen(true)}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-xs transition flex items-center gap-1"
                      title="Expand to fullscreen"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                      Expand
                    </button>
                    {/* Bulk Download Controls */}
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
                        {/* Title label at top with model badge */}
                        <div
                          className="absolute top-0 left-0 right-0 z-10 bg-slate-900/90 border-b border-brand-cyan/30 px-1.5 py-0.5 rounded-t"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between gap-1">
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
                                className="flex-1 bg-transparent border-none text-[10px] text-white focus:outline-none"
                              />
                            ) : (
                              <div
                                onClick={() => { setEditingImageId(img.id); setEditingTitle(img.title || ''); }}
                                className="text-[10px] text-white truncate cursor-text hover:text-brand-cyan flex-1"
                                title="Click to edit title"
                              >
                                {img.title || img.variation}
                              </div>
                            )}
                            {/* Model badge */}
                            {img.model && (
                              <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${
                                img.model === 'seedream-4' ? 'bg-green-600/80 text-white' :
                                img.model === 'ideogram-v3-turbo' ? 'bg-purple-600/80 text-white' :
                                img.model === 'flux-1.1-pro' ? 'bg-blue-600/80 text-white' :
                                img.model.startsWith('gpt') ? 'bg-emerald-600/80 text-white' :
                                'bg-slate-600/80 text-white'
                              }`}>
                                {img.model.replace('-1.1-pro', '').replace('-v3-turbo', '').replace('-4', '4').replace('gpt-image-', 'gpt')}
                              </span>
                            )}
                          </div>
                          {/* Timestamp */}
                          <div className="text-[8px] text-brand-gold/50">
                            {new Date(img.createdAt).toLocaleDateString()} {new Date(img.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                        </div>
                        {/* Selection checkbox */}
                        <div className="absolute top-7 left-1 z-10">
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
                          <div className="absolute top-7 right-1 z-10">
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
                          className="w-full h-24 object-cover rounded-b border border-brand-cyan/30 pt-6"
                          onClick={() => setPreviewImage(img)}
                        />
                        {/* Hover overlay with actions */}
                        <div className="absolute inset-0 top-6 bg-black/70 opacity-0 group-hover:opacity-100 transition rounded-b flex flex-col items-center justify-center p-1 gap-1">
                          <span className="text-sm text-white font-bold tracking-wider font-serif">{img.variation}</span>
                          {img.avatarTag && <span className="text-[9px] text-brand-cyan">Tag: {img.avatarTag}</span>}
                          <div className="flex gap-1 flex-wrap justify-center">
                            <button onClick={() => setPreviewImage(img)} className="px-2 py-0.5 bg-blue-600/80 rounded text-white text-[10px]">Expand</button>
                            <button onClick={() => handleDownloadImage(img)} className="px-2 py-0.5 bg-brand-cyan/80 rounded text-slate-900 text-[10px] font-medium">Download</button>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => handleMarkAsUsed(img.id, 'manual')} className="px-2 py-0.5 bg-green-600/80 rounded text-white text-[10px]">Used</button>
                            <button onClick={() => handleArchiveImage(img.id)} className="px-2 py-0.5 bg-amber-600/80 rounded text-white text-[10px]">Archive</button>
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

          {/* Draft Image Bank (Collapsible) - In-transit images for pages */}
          <div className="bg-slate-900 rounded-lg border border-amber-500/50 overflow-hidden">
            <button onClick={() => setIsDraftBankOpen(!isDraftBankOpen)} className="w-full flex items-center justify-between p-3 text-amber-400 hover:bg-slate-800/50 transition">
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                Draft Image Bank ({draftBankStats.draft} in draft)
                {/* Stats badges */}
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-300">
                  Made: {draftBankStats.totalMade} | Replaced: {draftBankStats.totalReplaced}
                </span>
              </span>
              <svg className={`w-5 h-5 transition-transform ${isDraftBankOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isDraftBankOpen && (
              <div className="p-4 border-t border-amber-500/30 space-y-3">
                {/* Stats Overview */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
                    <div className="text-2xl font-bold text-white">{draftBankStats.draft}</div>
                    <div className="text-xs text-amber-400">Draft</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
                    <div className="text-2xl font-bold text-green-400">{draftBankStats.sent}</div>
                    <div className="text-xs text-green-400/70">Sent</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
                    <div className="text-2xl font-bold text-slate-400">{draftBankStats.totalMade}</div>
                    <div className="text-xs text-slate-400/70">Total Made</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
                    <div className="text-2xl font-bold text-red-400">{draftBankStats.totalReplaced}</div>
                    <div className="text-xs text-red-400/70">Replaced</div>
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="flex gap-3 flex-wrap items-center bg-slate-800/50 p-3 rounded-lg border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-amber-400/70">Status:</label>
                    <select
                      value={draftBankFilter}
                      onChange={(e) => setDraftBankFilter(e.target.value as any)}
                      className="bg-slate-800 border border-amber-500/50 rounded px-2 py-1 text-white text-xs"
                    >
                      <option value="all">All Images</option>
                      <option value="draft">Draft Only</option>
                      <option value="sent">Sent Only</option>
                    </select>
                  </div>
                  {draftBankItemTypes.length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-amber-400/70">Item Type:</label>
                      <select
                        value={draftBankItemTypeFilter}
                        onChange={(e) => setDraftBankItemTypeFilter(e.target.value)}
                        className="bg-slate-800 border border-amber-500/50 rounded px-2 py-1 text-white text-xs"
                      >
                        <option value="all">All Types</option>
                        {draftBankItemTypes.map(t => (
                          <option key={t.item_type} value={t.item_type}>{t.item_type} ({t.count})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {draftBankLoading && (
                    <span className="text-xs text-amber-400 animate-pulse">Loading...</span>
                  )}
                </div>

                {/* Image Grid */}
                {draftBankImages.length > 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    {draftBankImages.map((img) => (
                      <div key={img.id} className="relative group">
                        {/* Status badge */}
                        <div className={`absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded text-[9px] text-white ${
                          img.status === 'draft' ? 'bg-amber-600/90' :
                          img.status === 'sent' ? 'bg-green-600/90' :
                          'bg-red-600/90'
                        }`}>
                          {img.status.toUpperCase()}
                        </div>
                        {/* Item type tag */}
                        {img.item_type && (
                          <div className="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-slate-900/90 rounded text-[9px] text-amber-300">
                            {img.item_type}
                          </div>
                        )}
                        <img
                          src={img.url}
                          alt={img.item_type || 'Draft image'}
                          className={`w-full h-24 object-cover rounded border ${
                            img.status === 'draft' ? 'border-amber-500/30' :
                            img.status === 'sent' ? 'border-green-500/30 opacity-70' :
                            'border-red-500/30 opacity-50'
                          }`}
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition rounded flex flex-col items-center justify-center p-1 gap-1">
                          <span className="text-xs text-white font-medium">{img.page_keyword || 'No page'}</span>
                          {img.item_category && <span className="text-[9px] text-amber-300">{img.item_category}</span>}
                          {img.avatar_tag && <span className="text-[9px] text-brand-cyan">Tag: {img.avatar_tag}</span>}
                          <div className="text-[8px] text-slate-400 mt-1">
                            {new Date(img.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-amber-400/50 mb-2">No draft images yet.</p>
                    <p className="text-xs text-slate-500">Images will appear here when generated for specific pages.</p>
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
                          <span className="text-sm text-white font-bold tracking-wider font-serif">{img.variation}</span>
                          {img.avatarTag && <span className="text-[9px] text-brand-cyan">Tag: {img.avatarTag}</span>}
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

          {/* ═══════════════════════════════════════════════════════════════════
              UNIFIED IMAGE INTEGRATION SETTINGS DASHBOARD
              All page integration, smart matching, and ordering in ONE place
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/30 rounded-xl border-2 border-purple-500/50 overflow-hidden shadow-lg shadow-purple-500/10">
            {/* Dashboard Header */}
            <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 px-5 py-4 border-b border-purple-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-600/30 rounded-lg">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Image Integration Settings</h2>
                    <p className="text-xs text-purple-300/70">Configure how images are selected and published to pages</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-purple-600/40 text-purple-200 text-xs rounded-full font-medium border border-purple-500/30">
                    {settings.integration_mode === 'bank' ? '📦 Bank Mode' : '⚡ Live Mode'}
                  </span>
                  {settings.smart_matching_enabled && (
                    <span className="px-2.5 py-1 bg-emerald-600/40 text-emerald-200 text-xs rounded-full font-medium border border-emerald-500/30">
                      🎯 Smart Match ON
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* ─────────────────────────────────────────────────────
                  SECTION 1: Image Source Mode
              ───────────────────────────────────────────────────── */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h3 className="text-brand-gold font-semibold">Image Source</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${settings.integration_mode === 'bank' ? 'bg-brand-gold/20 border-2 border-brand-gold' : 'bg-slate-900 border border-slate-600 hover:border-slate-500'}`}>
                    <input type="radio" name="integration_mode" checked={settings.integration_mode === 'bank'} onChange={() => updateSettings({
                      integration_mode: 'bank',
                      // AUTO-SWITCH: When switching to Bank mode, ensure matching strategy is a bank option
                      smart_matching_mode: (settings.smart_matching_mode === 'generate_first' || settings.smart_matching_mode === 'generate_only') ? 'bank_first' : settings.smart_matching_mode
                    })} className="hidden" />
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${settings.integration_mode === 'bank' ? 'bg-brand-gold text-slate-900' : 'bg-slate-700 text-slate-400'}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                    </div>
                    <div>
                      <span className={`font-medium ${settings.integration_mode === 'bank' ? 'text-brand-gold' : 'text-white'}`}>Pull from Bank</span>
                      <p className="text-[10px] text-slate-400">Use pre-generated images</p>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${settings.integration_mode === 'live' ? 'bg-brand-cyan/20 border-2 border-brand-cyan' : 'bg-slate-900 border border-slate-600 hover:border-slate-500'}`}>
                    <input type="radio" name="integration_mode" checked={settings.integration_mode === 'live'} onChange={() => updateSettings({
                      integration_mode: 'live',
                      // AUTO-SWITCH: When switching to Live mode, default to generate_only (Page Only)
                      // generate_first requires double opt-in, so never auto-switch to it
                      smart_matching_mode: 'generate_only'
                    })} className="hidden" />
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${settings.integration_mode === 'live' ? 'bg-brand-cyan text-slate-900' : 'bg-slate-700 text-slate-400'}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div>
                      <span className={`font-medium ${settings.integration_mode === 'live' ? 'text-brand-cyan' : 'text-white'}`}>Generate Live</span>
                      <p className="text-[10px] text-slate-400">Create fresh images on-the-fly</p>
                    </div>
                  </label>
                </div>

                {/* Generate Live Prompt Mode Toggle - only show when Live mode is selected */}
                {settings.integration_mode === 'live' && (
                  <div className="bg-brand-cyan/10 rounded-lg p-3 border border-brand-cyan/30 mb-3">
                    <label className="text-xs text-brand-cyan mb-2 block font-medium">Prompt Source for Generate Live:</label>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => updateSettings({ live_prompt_mode: 'main_prompt' })}
                        className={`p-2 rounded text-xs font-medium transition-all ${
                          settings.live_prompt_mode === 'main_prompt'
                            ? 'bg-brand-gold text-slate-900'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Main Prompt
                        <span className="block text-[10px] opacity-70 mt-0.5">Avatar template</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSettings({ live_prompt_mode: 'guided_gpt' })}
                        className={`p-2 rounded text-xs font-medium transition-all ${
                          settings.live_prompt_mode === 'guided_gpt'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Guided GPT
                        <span className="block text-[10px] opacity-70 mt-0.5">GPT + guardrails</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSettings({ live_prompt_mode: 'smart_prompt' })}
                        className={`p-2 rounded text-xs font-medium transition-all ${
                          settings.live_prompt_mode === 'smart_prompt'
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Smart Prompt
                        <span className="block text-[10px] opacity-70 mt-0.5">Legacy GPT-4o-mini</span>
                      </button>
                    </div>
                    {settings.live_prompt_mode === 'main_prompt' && (
                      <p className="text-[10px] text-brand-gold/70 bg-brand-gold/10 p-2 rounded">
                        Uses your Main Prompt from the Audience Avatar. Placeholders like {'{Item_Cleaning}'} are filled based on article keywords around each image position.
                      </p>
                    )}
                    {settings.live_prompt_mode === 'guided_gpt' && (
                      <div className="space-y-3 mt-2">
                        <p className="text-[10px] text-emerald-300/70 bg-emerald-500/10 p-2 rounded">
                          GPT-4o reads your article and creates prompts following your guardrails. Easier to set up than Main Prompt, more control than Smart Prompt.
                        </p>
                        {/* Model selector */}
                        <div>
                          <label className="text-[10px] text-emerald-400 mb-1 block">AI Model:</label>
                          <select
                            value={settings.guided_model || 'gpt-4o'}
                            onChange={(e) => updateSettings({ guided_model: e.target.value })}
                            className="w-full p-2 text-xs bg-slate-900 border border-emerald-500/30 rounded text-white"
                          >
                            <optgroup label="🟢 OpenAI - Best for Image Prompts">
                              <option value="gpt-5.2-2025-12-11">GPT-5.2 (Latest & Best)</option>
                              <option value="gpt-4o">GPT-4o (Recommended)</option>
                              <option value="gpt-4o-mini">GPT-4o Mini (Fast & Cheap)</option>
                            </optgroup>
                            <optgroup label="🟣 Anthropic - Great Writers">
                              <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (Your Writer!)</option>
                              <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                              <option value="claude-3-opus-20240229">Claude 3 Opus (Most Capable)</option>
                              <option value="claude-3-haiku-20240307">Claude Haiku (Fastest)</option>
                            </optgroup>
                            <optgroup label="🔵 Google Gemini - Visual Experts">
                              <option value="gemini-3-pro-preview">Gemini 3.0 Pro (Latest)</option>
                              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Thinking)</option>
                              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                            </optgroup>
                          </select>
                        </div>
                        {/* Guardrails */}
                        <div className="space-y-2">
                          <label className="text-[10px] text-emerald-400 mb-1 block">Guardrails / Instructions:</label>
                          <textarea
                            value={settings.guided_guardrails?.instructions || ''}
                            onChange={(e) => updateSettings({
                              guided_guardrails: { ...settings.guided_guardrails, instructions: e.target.value } as any
                            })}
                            placeholder="e.g., Always show professional cleaners in uniform. Focus on the specific task being discussed. Use natural lighting. Modern residential settings."
                            className="w-full p-2 text-xs bg-slate-900 border border-emerald-500/30 rounded text-white placeholder-slate-500 resize-y min-h-[60px]"
                            rows={3}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-emerald-400/70 mb-1 block">Uniform/Appearance:</label>
                            <input
                              type="text"
                              value={settings.guided_guardrails?.uniformDescription || ''}
                              onChange={(e) => updateSettings({
                                guided_guardrails: { ...settings.guided_guardrails, uniformDescription: e.target.value } as any
                              })}
                              placeholder="e.g., Blue polo shirt, khaki pants"
                              className="w-full p-1.5 text-xs bg-slate-900 border border-emerald-500/20 rounded text-white placeholder-slate-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-emerald-400/70 mb-1 block">Default Subject:</label>
                            <input
                              type="text"
                              value={settings.guided_guardrails?.defaultSubject || ''}
                              onChange={(e) => updateSettings({
                                guided_guardrails: { ...settings.guided_guardrails, defaultSubject: e.target.value } as any
                              })}
                              placeholder="e.g., Professional cleaner in their 30s"
                              className="w-full p-1.5 text-xs bg-slate-900 border border-emerald-500/20 rounded text-white placeholder-slate-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-red-400/70 mb-1 block">Avoid (things NOT to show):</label>
                          <input
                            type="text"
                            value={settings.guided_guardrails?.avoidList || ''}
                            onChange={(e) => updateSettings({
                              guided_guardrails: { ...settings.guided_guardrails, avoidList: e.target.value } as any
                            })}
                            placeholder="e.g., No cartoon style, no stock photo feel, no text"
                            className="w-full p-1.5 text-xs bg-slate-900 border border-red-500/20 rounded text-white placeholder-slate-500"
                          />
                        </div>

                        {/* AI Prompt Assistant Chat */}
                        <div className="mt-4 border-t border-emerald-500/30 pt-4">
                          <button
                            type="button"
                            onClick={() => setGuidedAssistantOpen(!guidedAssistantOpen)}
                            className="w-full flex items-center justify-between p-2 bg-emerald-900/30 hover:bg-emerald-900/50 rounded-lg transition"
                          >
                            <span className="flex items-center gap-2 text-emerald-400 font-medium text-sm">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              AI Prompt Assistant
                              {guidedAssistantMessages.length > 0 && (
                                <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[10px] rounded-full">
                                  {guidedAssistantMessages.length}
                                </span>
                              )}
                            </span>
                            <svg className={`w-4 h-4 text-emerald-400 transition-transform ${guidedAssistantOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {guidedAssistantOpen && (
                            <div className="mt-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] text-emerald-300/60">
                                  Chat with AI to refine your guardrails and get suggestions. AI can directly edit fields above.
                                </p>
                                {/* Chat Height Controls */}
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-slate-500 mr-1">Size:</span>
                                  <button
                                    onClick={() => {
                                      const sizes: Array<'sm' | 'md' | 'lg' | 'xl' | 'full'> = ['sm', 'md', 'lg', 'xl', 'full'];
                                      const currentIdx = sizes.indexOf(chatHeight);
                                      if (currentIdx > 0) setChatHeight(sizes[currentIdx - 1]);
                                    }}
                                    disabled={chatHeight === 'sm'}
                                    className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded text-slate-400 hover:text-white transition"
                                    title="Shrink chat"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  <span className="text-[9px] text-emerald-400 w-8 text-center">{chatHeight.toUpperCase()}</span>
                                  <button
                                    onClick={() => {
                                      const sizes: Array<'sm' | 'md' | 'lg' | 'xl' | 'full'> = ['sm', 'md', 'lg', 'xl', 'full'];
                                      const currentIdx = sizes.indexOf(chatHeight);
                                      if (currentIdx < sizes.length - 1) setChatHeight(sizes[currentIdx + 1]);
                                    }}
                                    disabled={chatHeight === 'full'}
                                    className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded text-slate-400 hover:text-white transition"
                                    title="Expand chat"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Chat Messages */}
                              <div
                                ref={guidedAssistantChatRef}
                                className={`${chatHeightClasses[chatHeight]} overflow-y-auto bg-slate-950 rounded-lg p-3 space-y-3 border border-emerald-500/20 transition-all duration-300`}
                              >
                                {guidedAssistantMessages.length === 0 ? (
                                  <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                                    <div className="text-center">
                                      <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                      </svg>
                                      <p>Ask about prompt techniques, guardrails, or upload reference images for analysis</p>
                                    </div>
                                  </div>
                                ) : (
                                  guidedAssistantMessages.map((msg, idx) => (
                                    <div
                                      key={idx}
                                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                      <div
                                        className={`max-w-[85%] rounded-lg p-2.5 ${
                                          msg.role === 'user'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-800 text-slate-200'
                                        }`}
                                      >
                                        {/* Show attached images */}
                                        {msg.images && msg.images.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mb-2">
                                            {msg.images.map((img, imgIdx) => (
                                              <img key={imgIdx} src={img} alt="" className="h-16 w-auto rounded" />
                                            ))}
                                          </div>
                                        )}
                                        {/* Message content with markdown-ish rendering for special blocks */}
                                        <div className="text-xs whitespace-pre-wrap">
                                          {(() => {
                                            // Parse content for both ```guardrail and ```testprompt blocks
                                            let content = msg.content;
                                            const elements: React.ReactNode[] = [];
                                            let keyIdx = 0;

                                            // Process ```testprompt blocks (amber)
                                            const testPromptRegex = /```testprompt\n?([\s\S]*?)```/g;
                                            let lastIndex = 0;
                                            let match;

                                            while ((match = testPromptRegex.exec(content)) !== null) {
                                              // Add text before this match
                                              if (match.index > lastIndex) {
                                                elements.push(<span key={keyIdx++}>{content.slice(lastIndex, match.index)}</span>);
                                              }
                                              // Add the testprompt block
                                              const testPrompt = match[1].trim();
                                              elements.push(
                                                <div key={keyIdx++} className="my-2 bg-amber-900/50 border border-amber-500/50 rounded p-2">
                                                  <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                      </svg>
                                                      Prompt Updated in Testing Mode
                                                    </span>
                                                  </div>
                                                  <code className="text-amber-300 text-[11px] block">{testPrompt}</code>
                                                </div>
                                              );
                                              lastIndex = match.index + match[0].length;
                                            }
                                            // Add remaining content
                                            if (lastIndex < content.length) {
                                              const remaining = content.slice(lastIndex);
                                              // Now process guardrail blocks in remaining content
                                              elements.push(
                                                ...remaining.split('```guardrail').map((part, partIdx) => {
                                                  if (partIdx === 0) return <span key={keyIdx++}>{part}</span>;
                                                  const [guardrail, rest] = part.split('```');
                                                  return (
                                                    <span key={keyIdx++}>
                                                      <div className="my-2 bg-emerald-900/50 border border-emerald-500/50 rounded p-2">
                                                        <div className="flex items-center justify-between mb-1">
                                                          <span className="text-[10px] text-emerald-400 font-medium">Suggested Guardrail:</span>
                                                          <button
                                                            onClick={() => saveGuardrailFromChat(`\`\`\`guardrail\n${guardrail}\`\`\``)}
                                                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] rounded transition"
                                                          >
                                                            + Add to Guardrails
                                                          </button>
                                                        </div>
                                                        <code className="text-emerald-300 text-[11px]">{guardrail?.trim()}</code>
                                                      </div>
                                                      {rest}
                                                    </span>
                                                  );
                                                })
                                              );
                                            }
                                            return elements.length > 0 ? elements : content;
                                          })()}
                                        </div>
                                        {/* Action buttons for assistant messages */}
                                        {msg.role === 'assistant' && (
                                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                                            <button
                                              onClick={() => {
                                                navigator.clipboard.writeText(msg.content);
                                                showNotification('Copied to clipboard', 'success');
                                              }}
                                              className="text-[10px] text-slate-400 hover:text-white transition"
                                            >
                                              Copy response
                                            </button>
                                            <button
                                              onClick={() => {
                                                // Extract prompt-like content (remove explanation text)
                                                // Look for content in quotes or code blocks, or use full content
                                                const codeBlockMatch = msg.content.match(/```(?:prompt)?\n?([\s\S]*?)```/);
                                                const quotedMatch = msg.content.match(/"([^"]{20,})"/);
                                                const promptContent = codeBlockMatch?.[1] || quotedMatch?.[1] || msg.content;
                                                sendPromptToTestingMode(promptContent.trim());
                                              }}
                                              className="text-[10px] text-amber-400 hover:text-amber-300 transition flex items-center gap-1"
                                            >
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                              </svg>
                                              Use as Test Prompt
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                )}
                                {guidedAssistantLoading && (
                                  <div className="flex justify-start">
                                    <div className="bg-slate-800 rounded-lg p-2.5">
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Loaded Articles Preview */}
                              {loadedArticles.length > 0 && (
                                <div className="p-2 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] text-blue-400 font-medium flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      {loadedArticles.length} Articles Loaded for AI
                                    </span>
                                    <button
                                      onClick={clearLoadedArticles}
                                      className="text-[10px] text-red-400 hover:text-red-300 transition"
                                    >
                                      Clear
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {loadedArticles.slice(0, 5).map((a, idx) => (
                                      <span key={idx} className="px-1.5 py-0.5 bg-blue-800/50 text-blue-300 text-[9px] rounded">
                                        {a.keyword.length > 25 ? a.keyword.substring(0, 25) + '...' : a.keyword}
                                      </span>
                                    ))}
                                    {loadedArticles.length > 5 && (
                                      <span className="px-1.5 py-0.5 bg-blue-800/50 text-blue-300 text-[9px] rounded">
                                        +{loadedArticles.length - 5} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Article Loader Panel */}
                              {showArticleLoader && (
                                <div className="p-3 bg-slate-900 border border-blue-500/30 rounded-lg space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-blue-400 font-medium">Load Articles for AI</span>
                                    <button
                                      onClick={() => setShowArticleLoader(false)}
                                      className="text-slate-400 hover:text-white"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-slate-400">
                                    Load articles so the AI can read them and create image plans based on content.
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() => loadArticles({ limit: 10 })}
                                      disabled={loadingArticles}
                                      className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-[10px] rounded transition"
                                    >
                                      {loadingArticles ? 'Loading...' : 'Load 10 Recent'}
                                    </button>
                                    <button
                                      onClick={() => loadArticles({ limit: 20 })}
                                      disabled={loadingArticles}
                                      className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-[10px] rounded transition"
                                    >
                                      Load 20 Recent
                                    </button>
                                    <button
                                      onClick={() => loadArticles({ limit: 50 })}
                                      disabled={loadingArticles}
                                      className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-[10px] rounded transition"
                                    >
                                      Load All (max 50)
                                    </button>
                                  </div>
                                  {articleSummary && articleSummary.summary.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-slate-700">
                                      <span className="text-[10px] text-slate-400 block mb-1">Or load by client/website:</span>
                                      <div className="flex flex-wrap gap-1">
                                        {articleSummary.summary.map((s, idx) => (
                                          <button
                                            key={idx}
                                            onClick={() => s.website_id ? loadArticles({ websiteId: s.website_id }) : loadArticles({ clientId: s.client_id })}
                                            disabled={loadingArticles}
                                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] rounded transition"
                                          >
                                            {s.website_name || s.client_name || 'Unknown'} ({s.article_count})
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Image attachments preview */}
                              {guidedAssistantImages.length > 0 && (
                                <div className="flex flex-wrap gap-2 p-2 bg-slate-900 rounded-lg">
                                  {guidedAssistantImages.map((img, idx) => (
                                    <div key={idx} className="relative group">
                                      <img src={img} alt="" className="h-12 w-auto rounded" />
                                      <button
                                        onClick={() => setGuidedAssistantImages(prev => prev.filter((_, i) => i !== idx))}
                                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                      >
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Chat Input */}
                              <div className="flex gap-2">
                                <input
                                  ref={guidedAssistantFileInputRef}
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={handleGuidedAssistantImageUpload}
                                  className="hidden"
                                />
                                <button
                                  onClick={() => guidedAssistantFileInputRef.current?.click()}
                                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition"
                                  title="Attach images"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => {
                                    setShowArticleLoader(!showArticleLoader);
                                    if (!articleSummary) fetchArticleSummary();
                                  }}
                                  className={`p-2 rounded-lg transition ${
                                    loadedArticles.length > 0
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                                  }`}
                                  title={loadedArticles.length > 0 ? `${loadedArticles.length} articles loaded` : 'Load articles for AI to read'}
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </button>
                                <input
                                  type="text"
                                  value={guidedAssistantInput}
                                  onChange={(e) => setGuidedAssistantInput(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendGuidedAssistant())}
                                  placeholder="Ask about guardrails, prompt techniques..."
                                  className="flex-1 p-2 text-xs bg-slate-900 border border-emerald-500/30 rounded-lg text-white placeholder-slate-500"
                                  disabled={guidedAssistantLoading}
                                />
                                <button
                                  onClick={handleSendGuidedAssistant}
                                  disabled={guidedAssistantLoading || (!guidedAssistantInput.trim() && guidedAssistantImages.length === 0)}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white text-xs font-medium transition"
                                >
                                  {guidedAssistantLoading ? '...' : 'Send'}
                                </button>
                              </div>

                              {/* Clear chat button */}
                              {guidedAssistantMessages.length > 0 && (
                                <button
                                  onClick={() => {
                                    setGuidedAssistantMessages([]);
                                    showNotification('Chat cleared', 'success');
                                  }}
                                  className="w-full p-1.5 text-[10px] text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded transition"
                                >
                                  Clear conversation
                                </button>
                              )}

                              {/* ═══════════════════════════════════════════
                                  TESTING MODE - Multi-Tab Sandbox
                              ═══════════════════════════════════════════ */}
                              <div className="mt-4 border-t border-amber-500/30 pt-4">
                                {/* Header with Title, Model dropdown, and expand toggle */}
                                <button
                                  type="button"
                                  onClick={() => setTestingModeOpen(!testingModeOpen)}
                                  className="w-full flex items-center justify-between p-2 bg-amber-900/30 hover:bg-amber-900/50 rounded-t-lg transition"
                                >
                                  <span className="flex items-center gap-2 text-amber-400 font-medium text-sm">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    Testing Mode
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {/* Model selector in header - compact */}
                                    <select
                                      onClick={(e) => e.stopPropagation()}
                                      value={settings.default_model || 'gpt-image-1.5'}
                                      onChange={(e) => { e.stopPropagation(); updateSettings({ default_model: e.target.value }); }}
                                      className="px-2 py-1 text-[10px] bg-slate-900 border border-amber-500/30 rounded text-white"
                                    >
                                      {IMAGE_GENERATION_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name.split(' ')[0]}</option>
                                      ))}
                                    </select>
                                    <svg className={`w-4 h-4 text-amber-400 transition-transform ${testingModeOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                </button>

                                {testingModeOpen && (
                                  <div className="bg-slate-900/50 rounded-b-lg border border-t-0 border-amber-500/20">
                                    {/* Tab Bar */}
                                    <div className="flex items-center gap-1 p-1.5 bg-slate-950/50 border-b border-amber-500/20 overflow-x-auto">
                                      {testingTabs.map((tab) => (
                                        <div
                                          key={tab.id}
                                          className={`group relative flex items-center gap-1 px-2 py-1 rounded text-[10px] cursor-pointer transition-all ${
                                            activeTestingTabId === tab.id
                                              ? 'bg-amber-600 text-white'
                                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                                          }`}
                                          onClick={() => setActiveTestingTabId(tab.id)}
                                        >
                                          {editingTabName === tab.id ? (
                                            <input
                                              type="text"
                                              defaultValue={tab.name}
                                              autoFocus
                                              onClick={(e) => e.stopPropagation()}
                                              onBlur={(e) => renameTestingTab(tab.id, e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') renameTestingTab(tab.id, (e.target as HTMLInputElement).value);
                                                if (e.key === 'Escape') setEditingTabName(null);
                                              }}
                                              className="w-16 px-1 py-0.5 text-[10px] bg-slate-900 border border-amber-500 rounded text-white"
                                            />
                                          ) : (
                                            <>
                                              <span
                                                onDoubleClick={(e) => { e.stopPropagation(); setEditingTabName(tab.id); }}
                                                title="Double-click to rename"
                                              >
                                                {tab.name}
                                              </span>
                                              {tab.history.length > 0 && (
                                                <span className="px-1 py-0.5 bg-black/30 rounded text-[8px]">
                                                  {tab.history.length}
                                                </span>
                                              )}
                                              {testingTabs.length > 1 && (
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); deleteTestingTab(tab.id); }}
                                                  className="ml-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition"
                                                  title="Delete tab"
                                                >
                                                  &times;
                                                </button>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      ))}
                                      {/* Add Tab Button */}
                                      <button
                                        onClick={addTestingTab}
                                        className="px-2 py-1 rounded text-[10px] bg-slate-800 text-amber-400 hover:bg-amber-600 hover:text-white transition"
                                        title="Add new test tab"
                                      >
                                        +
                                      </button>
                                    </div>

                                    {/* Active Tab Content */}
                                    <div className="p-3 space-y-3">
                                      {/* Prompt input */}
                                      <div className="flex gap-2">
                                        <textarea
                                          value={activeTestingTab.prompt}
                                          onChange={(e) => updateActiveTabPrompt(e.target.value)}
                                          placeholder="Enter your test prompt here... (AI Assistant can send prompts here directly)"
                                          className="flex-1 p-2 text-xs bg-slate-900 border border-amber-500/30 rounded-lg text-white placeholder-slate-500 resize-y min-h-[60px]"
                                          rows={2}
                                        />
                                        <button
                                          onClick={handleGenerateTestImage}
                                          disabled={testingModeLoading || !activeTestingTab.prompt.trim()}
                                          className="px-4 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white text-xs font-medium transition flex items-center justify-center"
                                          title="Generate Test Image"
                                        >
                                          {testingModeLoading ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                          ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                          )}
                                        </button>
                                      </div>

                                      {/* ═══════════════════════════════════════════ */}
                                      {/* AUTO-REFINE Section */}
                                      {/* ═══════════════════════════════════════════ */}
                                      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg border border-purple-500/30 p-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-purple-400 text-sm font-semibold">🤖 Auto-Refine</span>
                                            <span className="text-[9px] text-purple-300/70 bg-purple-500/20 px-1.5 py-0.5 rounded">GPT-5.2 Vision Loop</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-400">Max iterations:</span>
                                            <input
                                              type="number"
                                              min="1"
                                              max="10"
                                              value={autoRefineMaxIterations}
                                              onChange={(e) => setAutoRefineMaxIterations(Math.min(10, Math.max(1, parseInt(e.target.value) || 4)))}
                                              className="w-12 px-1 py-0.5 text-xs bg-slate-900 border border-purple-500/30 rounded text-white text-center"
                                            />
                                          </div>
                                        </div>

                                        {/* Goal/Criteria Input */}
                                        <div className="mb-2">
                                          <label className="text-[10px] text-purple-300 block mb-1">Goal/Criteria (what must the image show?):</label>
                                          <textarea
                                            value={autoRefineGoal}
                                            onChange={(e) => setAutoRefineGoal(e.target.value)}
                                            placeholder="Example: A single male professional cleaner in their 30s, wearing a blue polo shirt uniform, cleaning a kitchen counter. Natural lighting, residential setting. NO multiple people, NO cartoon style."
                                            className="w-full p-2 text-xs bg-slate-900 border border-purple-500/30 rounded-lg text-white placeholder-slate-500 resize-y"
                                            rows={2}
                                            disabled={autoRefineRunning}
                                          />
                                        </div>

                                        {/* Control Buttons */}
                                        <div className="flex gap-2 mb-2">
                                          {!autoRefineRunning ? (
                                            <button
                                              onClick={startAutoRefine}
                                              disabled={!autoRefineGoal.trim()}
                                              className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-lg text-white text-xs font-medium transition flex items-center justify-center gap-2"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                              Start Auto-Refine
                                            </button>
                                          ) : (
                                            <button
                                              onClick={stopAutoRefine}
                                              className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-xs font-medium transition flex items-center justify-center gap-2"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                              </svg>
                                              Stop
                                            </button>
                                          )}
                                          {autoRefineSession && (
                                            <button
                                              onClick={clearAutoRefineSession}
                                              disabled={autoRefineRunning}
                                              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed rounded-lg text-slate-300 text-xs transition"
                                            >
                                              Clear
                                            </button>
                                          )}
                                        </div>

                                        {/* Session Status & Log */}
                                        {autoRefineSession && (
                                          <div className="bg-slate-950/50 rounded-lg p-2 border border-purple-500/20">
                                            {/* Status Bar */}
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${
                                                  autoRefineSession.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                                                  autoRefineSession.status === 'success' ? 'bg-green-400' :
                                                  autoRefineSession.status === 'failed' ? 'bg-red-400' :
                                                  autoRefineSession.status === 'stopped' ? 'bg-orange-400' :
                                                  'bg-slate-400'
                                                }`}></span>
                                                <span className="text-[10px] text-slate-300 capitalize">{autoRefineSession.status}</span>
                                              </div>
                                              <span className="text-[10px] text-slate-500">
                                                {autoRefineSession.iterations.length}/{autoRefineSession.maxIterations} iterations
                                              </span>
                                            </div>

                                            {/* Iterations Log */}
                                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                              {autoRefineSession.iterations.map((iter, idx) => (
                                                <div key={idx} className={`p-2 rounded border ${
                                                  iter.meetsGoal ? 'bg-green-900/30 border-green-500/30' : 'bg-slate-900/50 border-slate-600/30'
                                                }`}>
                                                  <div className="flex items-start gap-2">
                                                    <span className={`text-[10px] font-bold ${iter.meetsGoal ? 'text-green-400' : 'text-slate-400'}`}>
                                                      #{iter.iteration}
                                                    </span>
                                                    {iter.imageUrl && (
                                                      <img src={iter.imageUrl} alt="" className="w-12 h-12 object-cover rounded" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                      <div className="text-[9px] text-slate-400 line-clamp-2">{iter.prompt}</div>
                                                      <div className={`text-[9px] mt-1 ${iter.meetsGoal ? 'text-green-300' : 'text-orange-300'}`}>
                                                        {iter.evaluation}
                                                      </div>
                                                      {!iter.meetsGoal && iter.refinementNotes && (
                                                        <div className="text-[8px] text-purple-300 mt-1">
                                                          → {iter.refinementNotes}
                                                        </div>
                                                      )}
                                                    </div>
                                                    {iter.meetsGoal && (
                                                      <span className="text-green-400 text-lg">✓</span>
                                                    )}
                                                  </div>
                                                </div>
                                              ))}
                                              {autoRefineRunning && (
                                                <div className="flex items-center justify-center py-3">
                                                  <div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin"></div>
                                                  <span className="ml-2 text-[10px] text-purple-300">Processing iteration {autoRefineSession.iterations.length + 1}...</span>
                                                </div>
                                              )}
                                            </div>

                                            {/* Success Result */}
                                            {autoRefineSession.status === 'success' && autoRefineSession.finalPrompt && (
                                              <div className="mt-2 p-2 bg-green-900/30 rounded border border-green-500/30">
                                                <div className="text-[10px] text-green-400 font-semibold mb-1">✓ Goal Achieved!</div>
                                                <div className="text-[9px] text-green-200">Final prompt has been copied to the prompt box above.</div>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        <p className="text-[9px] text-purple-300/50 mt-2">
                                          GPT-5.2 will generate prompts, create images, evaluate results, and refine until the goal is met or max iterations reached.
                                        </p>
                                      </div>

                                      {/* History - Scrollable list showing prompt + image pairs */}
                                      {activeTestingTab.history.length > 0 ? (
                                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                                          <div className="text-[10px] text-slate-500 flex justify-between items-center">
                                            <span>Test History ({activeTestingTab.history.length})</span>
                                            <div className="flex gap-2">
                                              <button
                                                onClick={() => {
                                                  const name = prompt('Name this series:', activeTestingTab.name);
                                                  if (name) {
                                                    const tag = prompt('Add a tag/file (optional):', '');
                                                    startSeriesFromTestingMode(name, tag ? [tag.toLowerCase()] : []);
                                                  }
                                                }}
                                                className="text-blue-400 hover:text-blue-300"
                                              >
                                                Save All to Journal
                                              </button>
                                              <button
                                                onClick={() => setTestingTabs(prev => prev.map(tab =>
                                                  tab.id === activeTestingTabId ? { ...tab, history: [] } : tab
                                                ))}
                                                className="text-red-400 hover:text-red-300"
                                              >
                                                Clear
                                              </button>
                                            </div>
                                          </div>
                                          {activeTestingTab.history.map((item, idx) => (
                                            <div key={idx} className="bg-slate-950 rounded-lg p-2 border border-slate-700">
                                              <div className="flex gap-3">
                                                {/* Image thumbnail */}
                                                <img
                                                  src={item.url}
                                                  alt=""
                                                  className="w-24 h-auto rounded-lg flex-shrink-0"
                                                />
                                                {/* Prompt and actions */}
                                                <div className="flex-1 min-w-0">
                                                  <div className="text-[10px] text-slate-400 mb-1 line-clamp-3">
                                                    {item.prompt}
                                                  </div>
                                                  <div className="text-[8px] text-slate-600 mb-2">
                                                    {item.model} • {new Date(item.timestamp).toLocaleTimeString()}
                                                  </div>
                                                  <div className="flex gap-1 flex-wrap">
                                                    <button
                                                      onClick={() => handleSaveTestImageToBank(item.url, item.prompt, item.model)}
                                                      className="px-2 py-0.5 bg-green-600 hover:bg-green-500 rounded text-white text-[9px] transition"
                                                    >
                                                      Bank
                                                    </button>
                                                    <button
                                                      onClick={() => {
                                                        const tag = prompt('Add tag (optional):', '');
                                                        saveToJournal(item.prompt, item.url, item.model, tag ? [tag.toLowerCase()] : []);
                                                      }}
                                                      className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 rounded text-white text-[9px] transition"
                                                    >
                                                      Journal
                                                    </button>
                                                    <button
                                                      onClick={() => updateActiveTabPrompt(item.prompt)}
                                                      className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-white text-[9px] transition"
                                                    >
                                                      Use
                                                    </button>
                                                    <button
                                                      onClick={() => {
                                                        navigator.clipboard.writeText(item.prompt);
                                                        showNotification('Prompt copied!', 'success');
                                                      }}
                                                      className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-white text-[9px] transition"
                                                    >
                                                      Copy
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-center py-6 text-slate-500 text-xs">
                                          <p>No test images yet in this tab.</p>
                                          <p className="text-[10px] mt-1">Enter a prompt above and generate a test image.</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* ═══════════════════════════════════════════
                                  PROMPT JOURNAL - Save & organize prompts
                              ═══════════════════════════════════════════ */}
                              <div className="mt-4 border-t border-blue-500/30 pt-4">
                                <button
                                  type="button"
                                  onClick={() => setJournalOpen(!journalOpen)}
                                  className="w-full flex items-center justify-between p-2 bg-blue-900/30 hover:bg-blue-900/50 rounded-t-lg transition"
                                >
                                  <span className="flex items-center gap-2 text-blue-400 font-medium text-sm">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                    Prompt Journal
                                    {journalEntries.length > 0 && (
                                      <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded-full">
                                        {journalEntries.length}
                                      </span>
                                    )}
                                  </span>
                                  <svg className={`w-4 h-4 text-blue-400 transition-transform ${journalOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>

                                {journalOpen && (
                                  <div className="bg-slate-900/50 rounded-b-lg border border-t-0 border-blue-500/20 p-3">
                                    {/* Filter by tag/file */}
                                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                                      <span className="text-[10px] text-blue-400">Filter:</span>
                                      <button
                                        onClick={() => setJournalFilterTag(null)}
                                        className={`px-2 py-0.5 rounded text-[9px] transition ${
                                          !journalFilterTag
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                        }`}
                                      >
                                        All ({journalEntries.length})
                                      </button>
                                      {journalTags.map(tag => (
                                        <button
                                          key={tag}
                                          onClick={() => setJournalFilterTag(tag)}
                                          className={`px-2 py-0.5 rounded text-[9px] transition ${
                                            journalFilterTag === tag
                                              ? 'bg-blue-600 text-white'
                                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                          }`}
                                        >
                                          {tag} ({journalEntries.filter(e => e.tags.includes(tag)).length})
                                        </button>
                                      ))}
                                    </div>

                                    {/* Active Series indicator */}
                                    {journalActiveSeries && (
                                      <div className="mb-3 p-2 bg-blue-900/30 rounded border border-blue-500/30">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] text-blue-400">
                                            Active Series: <strong>{journalSeries.find(s => s.id === journalActiveSeries)?.name}</strong>
                                          </span>
                                          <button
                                            onClick={() => {
                                              const notes = prompt('Closing notes (optional):');
                                              closeJournalSeries(journalActiveSeries, undefined, notes || undefined);
                                            }}
                                            className="text-[9px] text-green-400 hover:text-green-300"
                                          >
                                            Close Series
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Journal entries */}
                                    {filteredJournalEntries.length > 0 ? (
                                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {filteredJournalEntries.map((entry) => (
                                          <div
                                            key={entry.id}
                                            className={`bg-slate-950 rounded-lg p-2 border ${
                                              entry.isFinal
                                                ? 'border-green-500/50'
                                                : 'border-slate-700'
                                            }`}
                                          >
                                            <div className="flex gap-3">
                                              {/* Image thumbnail */}
                                              {entry.imageUrl && (
                                                <img
                                                  src={entry.imageUrl}
                                                  alt=""
                                                  className="w-16 h-auto rounded flex-shrink-0"
                                                />
                                              )}
                                              <div className="flex-1 min-w-0">
                                                <div className="text-[10px] text-slate-400 mb-1 line-clamp-2">
                                                  {entry.prompt}
                                                </div>
                                                {/* Tags */}
                                                <div className="flex gap-1 mb-1 flex-wrap">
                                                  {entry.tags.map(tag => (
                                                    <span
                                                      key={tag}
                                                      className="px-1 py-0.5 bg-blue-900/50 text-blue-300 text-[8px] rounded"
                                                    >
                                                      {tag}
                                                    </span>
                                                  ))}
                                                  {entry.seriesPosition && (
                                                    <span className="px-1 py-0.5 bg-purple-900/50 text-purple-300 text-[8px] rounded">
                                                      #{entry.seriesPosition}
                                                    </span>
                                                  )}
                                                  {entry.isFinal && (
                                                    <span className="px-1 py-0.5 bg-green-900/50 text-green-300 text-[8px] rounded">
                                                      WINNER
                                                    </span>
                                                  )}
                                                </div>
                                                {/* Notes */}
                                                {entry.notes && (
                                                  <div className="text-[9px] text-slate-500 italic mb-1">
                                                    {entry.notes}
                                                  </div>
                                                )}
                                                <div className="text-[8px] text-slate-600 mb-1">
                                                  {entry.model} • {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString()}
                                                </div>
                                                {/* Actions */}
                                                <div className="flex gap-1 flex-wrap">
                                                  <button
                                                    onClick={() => loadFromJournal(entry)}
                                                    className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 rounded text-white text-[9px] transition"
                                                  >
                                                    Load
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      const note = prompt('Add note:', entry.notes);
                                                      if (note !== null) updateJournalEntryNotes(entry.id, note);
                                                    }}
                                                    className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-white text-[9px] transition"
                                                  >
                                                    Note
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      const tag = prompt('Add tag:');
                                                      if (tag) addTagToJournalEntry(entry.id, tag);
                                                    }}
                                                    className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-white text-[9px] transition"
                                                  >
                                                    +Tag
                                                  </button>
                                                  <button
                                                    onClick={() => deleteJournalEntry(entry.id)}
                                                    className="px-2 py-0.5 bg-red-900/50 hover:bg-red-800 rounded text-red-300 text-[9px] transition"
                                                  >
                                                    Del
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-center py-6 text-slate-500 text-xs">
                                        <p>No journal entries yet.</p>
                                        <p className="text-[10px] mt-1">Save prompts from Testing Mode to keep track of your work.</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* ═══════════════════════════════════════════
                                  ARTICLE TESTING - Test full page layouts
                              ═══════════════════════════════════════════ */}
                              <div className="mt-4 border-t border-purple-500/30 pt-4">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setArticleTestOpen(!articleTestOpen);
                                    if (!articleTestOpen) fetchAvailableArticles();
                                  }}
                                  className="w-full flex items-center justify-between p-2 bg-purple-900/30 hover:bg-purple-900/50 rounded-t-lg transition"
                                >
                                  <span className="flex items-center gap-2 text-purple-400 font-medium text-sm">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Article Testing
                                    {selectedArticleTest && (
                                      <span className="px-1.5 py-0.5 bg-purple-600 text-white text-[10px] rounded-full">
                                        {selectedArticleTest.placements.length} spots
                                      </span>
                                    )}
                                  </span>
                                  <svg className={`w-4 h-4 text-purple-400 transition-transform ${articleTestOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>

                                {articleTestOpen && (
                                  <div className="bg-slate-900/50 rounded-b-lg border border-t-0 border-purple-500/20 p-3">
                                    <p className="text-[10px] text-purple-300/60 mb-3">
                                      Import a real article to test image placement rules. See where images would go and what keywords are matched.
                                    </p>

                                    {/* Article selector */}
                                    <div className="flex gap-2 mb-3">
                                      <select
                                        value={selectedArticleTest?.articleId || ''}
                                        onChange={(e) => e.target.value && loadArticleForTesting(e.target.value)}
                                        className="flex-1 p-2 text-xs bg-slate-900 border border-purple-500/30 rounded text-white"
                                        disabled={articleTestLoading}
                                      >
                                        <option value="">Select an article...</option>
                                        {availableArticles.map(a => (
                                          <option key={a.id} value={a.id}>
                                            {a.keyword} ({a.wordCount} words)
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        onClick={fetchAvailableArticles}
                                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-purple-400 text-xs transition"
                                        title="Refresh article list"
                                      >
                                        ↻
                                      </button>
                                    </div>

                                    {/* Keyword range slider */}
                                    <div className="mb-3 p-2 bg-slate-950 rounded border border-purple-500/20">
                                      <div className="flex items-center justify-between mb-1">
                                        <label className="text-[10px] text-purple-400">Keyword Search Range:</label>
                                        <span className="text-[10px] text-white font-medium">{keywordRange} words each way</span>
                                      </div>
                                      <input
                                        type="range"
                                        min="10"
                                        max="100"
                                        value={keywordRange}
                                        onChange={(e) => setKeywordRange(parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                      />
                                      <div className="flex justify-between text-[8px] text-slate-500 mt-1">
                                        <span>10 words</span>
                                        <span>50 words</span>
                                        <span>100 words</span>
                                      </div>
                                      {selectedArticleTest && (
                                        <button
                                          onClick={reanalyzeArticle}
                                          className="mt-2 w-full p-1.5 text-[10px] bg-purple-900/50 hover:bg-purple-800/50 text-purple-300 rounded transition"
                                        >
                                          Re-analyze with new range
                                        </button>
                                      )}
                                    </div>

                                    {articleTestLoading && (
                                      <div className="text-center py-4">
                                        <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-2"></div>
                                        <p className="text-[10px] text-purple-400">Loading article...</p>
                                      </div>
                                    )}

                                    {selectedArticleTest && !articleTestLoading && (
                                      <div className="space-y-3">
                                        {/* Article info header */}
                                        <div className="p-2 bg-purple-900/30 rounded border border-purple-500/30">
                                          <div className="flex items-center justify-between">
                                            <div>
                                              <h4 className="text-sm text-white font-medium">{selectedArticleTest.title}</h4>
                                              <p className="text-[10px] text-purple-300">
                                                {selectedArticleTest.wordCount} words • {selectedArticleTest.placements.length} image placements detected
                                              </p>
                                            </div>
                                            <button
                                              onClick={runFullPageSimulation}
                                              disabled={simulationRunning}
                                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 rounded text-white text-xs font-medium transition flex items-center gap-1"
                                            >
                                              {simulationRunning ? (
                                                <>
                                                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                  Running...
                                                </>
                                              ) : (
                                                <>
                                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                  </svg>
                                                  Generate All
                                                </>
                                              )}
                                            </button>
                                          </div>
                                        </div>

                                        {/* Image placements */}
                                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                          {selectedArticleTest.placements.map((placement, idx) => (
                                            <div
                                              key={placement.id}
                                              className={`p-3 rounded-lg border ${
                                                placement.status === 'saved'
                                                  ? 'bg-green-900/20 border-green-500/30'
                                                  : placement.status === 'generated'
                                                  ? 'bg-purple-900/20 border-purple-500/30'
                                                  : 'bg-slate-950 border-slate-700'
                                              }`}
                                            >
                                              {/* Placement header */}
                                              <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs text-purple-400 font-medium">
                                                  {idx === 0 && placement.id === 'placement-hero' ? '🖼️ Hero Image' : `📍 Image ${idx + 1}`}
                                                  <span className="text-[10px] text-slate-500 ml-2">
                                                    (Paragraph {placement.paragraphIndex + 1})
                                                  </span>
                                                </span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded ${
                                                  placement.status === 'saved' ? 'bg-green-600 text-white' :
                                                  placement.status === 'generated' ? 'bg-purple-600 text-white' :
                                                  placement.status === 'generating' ? 'bg-yellow-600 text-white' :
                                                  'bg-slate-700 text-slate-300'
                                                }`}>
                                                  {placement.status}
                                                </span>
                                              </div>

                                              {/* Keyword zone visualization */}
                                              <div className="mb-2 p-2 bg-slate-900 rounded text-[10px]">
                                                <div className="text-slate-500 mb-1">Keyword Search Zone ({keywordRange} words each way):</div>
                                                <div className="text-slate-400">
                                                  {placement.wordsBefore && (
                                                    <span className="bg-blue-900/30 text-blue-300 px-1 rounded">
                                                      ...{placement.wordsBefore.split(' ').slice(-10).join(' ')}
                                                    </span>
                                                  )}
                                                  <span className="text-purple-400 font-bold mx-1">|IMAGE|</span>
                                                  {placement.wordsAfter && (
                                                    <span className="bg-green-900/30 text-green-300 px-1 rounded">
                                                      {placement.wordsAfter.split(' ').slice(0, 10).join(' ')}...
                                                    </span>
                                                  )}
                                                </div>
                                              </div>

                                              {/* Matched keywords */}
                                              <div className="mb-2">
                                                <span className="text-[10px] text-slate-500">Matched Keywords: </span>
                                                {placement.matchedKeywords.length > 0 ? (
                                                  <span className="flex flex-wrap gap-1 mt-1">
                                                    {placement.matchedKeywords.map((kw, kwIdx) => (
                                                      <span key={kwIdx} className="px-1.5 py-0.5 bg-purple-600 text-white text-[9px] rounded">
                                                        {kw}
                                                      </span>
                                                    ))}
                                                  </span>
                                                ) : (
                                                  <span className="text-[10px] text-orange-400">None found - will use general prompt</span>
                                                )}
                                              </div>

                                              {/* Generated image */}
                                              {placement.generatedImage && (
                                                <div className="mb-2">
                                                  <img
                                                    src={placement.generatedImage.url}
                                                    alt=""
                                                    className="w-full max-w-[200px] rounded-lg"
                                                  />
                                                  <div className="text-[9px] text-slate-500 mt-1">
                                                    Prompt: {placement.suggestedPrompt?.substring(0, 100)}...
                                                  </div>
                                                </div>
                                              )}

                                              {/* Actions */}
                                              <div className="flex gap-2">
                                                {placement.status === 'pending' && (
                                                  <button
                                                    onClick={() => generatePlacementImage(placement.id)}
                                                    className="px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded text-white text-[10px] transition"
                                                  >
                                                    Generate
                                                  </button>
                                                )}
                                                {placement.status === 'generating' && (
                                                  <span className="px-2 py-1 text-[10px] text-yellow-400 flex items-center gap-1">
                                                    <div className="w-3 h-3 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin"></div>
                                                    Generating...
                                                  </span>
                                                )}
                                                {placement.status === 'generated' && (
                                                  <>
                                                    <button
                                                      onClick={() => generatePlacementImage(placement.id)}
                                                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-[10px] transition"
                                                    >
                                                      Regenerate
                                                    </button>
                                                    <button
                                                      onClick={() => savePlacementToBank(placement.id)}
                                                      className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-white text-[10px] transition"
                                                    >
                                                      Save to Bank
                                                    </button>
                                                  </>
                                                )}
                                                {placement.status === 'saved' && (
                                                  <span className="text-[10px] text-green-400">✓ Saved to Bank</span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {!selectedArticleTest && !articleTestLoading && (
                                      <div className="text-center py-6 text-slate-500 text-xs">
                                        <p>Select an article to test image placement.</p>
                                        <p className="text-[10px] mt-1">See where images would go and which keywords match.</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {settings.live_prompt_mode === 'smart_prompt' && (
                      <div className="space-y-2">
                        <p className="text-[10px] text-purple-300/70 bg-purple-500/10 p-2 rounded">
                          Legacy mode: GPT-4o-mini reads your article and creates prompts automatically. Less control than Guided GPT.
                        </p>
                        <div>
                          <label className="text-[10px] text-purple-400 mb-1 block">Guidance / Guardrails (optional):</label>
                          <textarea
                            value={settings.smart_prompt_guidance || ''}
                            onChange={(e) => updateSettings({ smart_prompt_guidance: e.target.value })}
                            placeholder="e.g., Always show professional cleaners in navy blue uniforms. Include cleaning supplies. Modern residential settings only. No faces."
                            className="w-full p-2 text-xs bg-slate-900 border border-purple-500/30 rounded text-white placeholder-slate-500 resize-y min-h-[60px]"
                            rows={3}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─────────────────────────────────────────────────────
                    Reference Assets Tabs (Problem Areas, Reference Images, Logo/Action)
                    COLLAPSIBLE - Default collapsed, rarely used
                ───────────────────────────────────────────────────── */}
                <div className="mt-4 border-t border-slate-700 pt-4">
                  {/* Tab Buttons with Collapse Toggle */}
                  <div className="flex items-center border-b border-slate-700">
                    <button
                      onClick={() => !guidedAssetsCollapsed && setGuidedAssetsTab('problems')}
                      className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
                        !guidedAssetsCollapsed && guidedAssetsTab === 'problems'
                          ? 'text-orange-400 border-orange-500 bg-orange-500/10'
                          : 'text-slate-400 border-transparent hover:text-slate-300 hover:bg-slate-800/50'
                      } ${guidedAssetsCollapsed ? 'opacity-60' : ''}`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        🎯 Prompt Problem Areas
                        {settings.prompt_problem_areas.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-300 text-[10px] rounded">
                            {settings.prompt_problem_areas.length}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      onClick={() => !guidedAssetsCollapsed && setGuidedAssetsTab('logo')}
                      className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
                        !guidedAssetsCollapsed && guidedAssetsTab === 'logo'
                          ? 'text-brand-cyan border-brand-cyan bg-brand-cyan/10'
                          : 'text-slate-400 border-transparent hover:text-slate-300 hover:bg-slate-800/50'
                      } ${guidedAssetsCollapsed ? 'opacity-60' : ''}`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        LOGO REFERENCE
                        {(logoImages.length > 0 || actionShots.length > 0) && (
                          <span className="px-1.5 py-0.5 bg-brand-cyan/20 text-brand-cyan text-[10px] rounded">
                            {logoImages.length + actionShots.length}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      onClick={() => !guidedAssetsCollapsed && setGuidedAssetsTab('reference')}
                      className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
                        !guidedAssetsCollapsed && guidedAssetsTab === 'reference'
                          ? 'text-purple-400 border-purple-500 bg-purple-500/10'
                          : 'text-slate-400 border-transparent hover:text-slate-300 hover:bg-slate-800/50'
                      } ${guidedAssetsCollapsed ? 'opacity-60' : ''}`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        Reference Images
                        {settings.reference_images.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] rounded">
                            {settings.reference_images.length}
                          </span>
                        )}
                      </span>
                    </button>
                    {/* Collapse/Expand Toggle Arrow */}
                    <button
                      onClick={() => setGuidedAssetsCollapsed(!guidedAssetsCollapsed)}
                      className="px-3 py-2.5 text-slate-400 hover:text-white transition-all hover:bg-slate-800/50"
                      title={guidedAssetsCollapsed ? 'Expand section' : 'Collapse section'}
                    >
                      <svg
                        className={`w-5 h-5 transition-transform duration-200 ${guidedAssetsCollapsed ? '' : 'rotate-180'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Tab Content - Only show when expanded */}
                  {!guidedAssetsCollapsed && (
                  <div className="p-4 bg-slate-900/50 rounded-b-lg">
                    {/* Prompt Problem Areas Tab */}
                    {guidedAssetsTab === 'problems' && (
                      <div className="space-y-3">
                        {settings.prompt_problem_areas.length === 0 ? (
                          <div className="text-center py-6 text-slate-500">
                            <p className="text-sm">No problem areas yet.</p>
                            <p className="text-xs mt-1">Add areas for issues like "Logo Visibility", "Camera Angles", etc.</p>
                            <button
                              onClick={handleAddProblemArea}
                              className="mt-3 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-lg transition"
                            >
                              + Add Problem Area
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Area Tabs */}
                            <div className="flex flex-wrap gap-2">
                              {settings.prompt_problem_areas.map(area => (
                                <button
                                  key={area.id}
                                  onClick={() => setActiveProblemAreaId(activeProblemAreaId === area.id ? null : area.id)}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                                    area.status === 'solved'
                                      ? activeProblemAreaId === area.id
                                        ? 'bg-green-500 text-slate-900'
                                        : 'bg-green-900/50 text-green-400 hover:bg-green-900/70 border border-green-500/50'
                                      : activeProblemAreaId === area.id
                                        ? 'bg-orange-500 text-slate-900'
                                        : 'bg-slate-800 text-orange-400 hover:bg-slate-700'
                                  }`}
                                >
                                  {area.status === 'solved' ? (
                                    <span className="text-green-300">✓</span>
                                  ) : (
                                    <span className={`w-2 h-2 rounded-full ${
                                      area.priority === 'high' ? 'bg-red-500' :
                                      area.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                                    }`} />
                                  )}
                                  {area.name}
                                  <span className="text-xs opacity-70">({area.prompts.length})</span>
                                </button>
                              ))}
                              <button
                                onClick={handleAddProblemArea}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-800 text-orange-400 hover:bg-slate-700 border border-dashed border-orange-500/50"
                              >
                                + New
                              </button>
                            </div>

                            {/* Active Problem Area Editor */}
                            {activeProblemAreaId && (() => {
                              const area = getActiveProblemArea();
                              if (!area) return null;
                              return (
                                <div className="bg-slate-800/50 rounded-lg p-3 space-y-3 border border-orange-500/20">
                                  <div className="flex items-start gap-3">
                                    <div className="flex-1 space-y-2">
                                      <input
                                        type="text"
                                        value={area.name}
                                        onChange={(e) => handleUpdateProblemArea(area.id, { name: e.target.value })}
                                        className="w-full bg-slate-900 border border-orange-500/30 rounded px-2 py-1 text-white text-sm font-medium"
                                        placeholder="Problem area name..."
                                      />
                                      <textarea
                                        value={area.context}
                                        onChange={(e) => handleUpdateProblemArea(area.id, { context: e.target.value })}
                                        className="w-full bg-slate-900 border border-orange-500/30 rounded px-2 py-1 text-white text-xs resize-y"
                                        rows={2}
                                        placeholder="Context: Why is this a problem? What are you trying to solve?"
                                      />
                                    </div>
                                    <select
                                      value={area.priority}
                                      onChange={(e) => handleUpdateProblemArea(area.id, { priority: e.target.value as any })}
                                      className="bg-slate-900 border border-orange-500/30 rounded px-2 py-1 text-xs text-white"
                                    >
                                      <option value="high">🔴 High</option>
                                      <option value="medium">🟡 Medium</option>
                                      <option value="low">🟢 Low</option>
                                    </select>
                                    <button
                                      onClick={() => handleDeleteProblemArea(area.id)}
                                      className="text-red-400 hover:text-red-300 text-xs"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    {area.prompts.length} solution prompts • Click "+ Add Prompt" in the original section to add more
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    )}

                    {/* Logo & Action Shots Tab */}
                    {guidedAssetsTab === 'logo' && (
                      <div className="space-y-4">
                        {/* Logo Image */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm text-brand-cyan font-medium">Logo Image (the actual logo)</label>
                            <button
                              onClick={() => logoFileInputRef.current?.click()}
                              className="px-3 py-1 bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan text-xs rounded transition"
                            >
                              + Upload Logo
                            </button>
                          </div>
                          {logoImages.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {logoImages.map((img, idx) => (
                                <div key={idx} className="relative group">
                                  <img src={img.dataUrl} alt="Logo" className="h-16 w-auto rounded border border-brand-cyan/30" />
                                  <button
                                    onClick={() => removeLogo(idx)}
                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                  >
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">No logo uploaded yet</p>
                          )}
                        </div>

                        {/* Action Shots */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm text-brand-cyan font-medium">Action Shots (logo on shirts, vehicles, etc.)</label>
                            <button
                              onClick={() => actionShotsInputRef.current?.click()}
                              className="px-3 py-1 bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan text-xs rounded transition"
                            >
                              + Upload Action Shots
                            </button>
                          </div>
                          {actionShots.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {actionShots.map((img, idx) => (
                                <div key={idx} className="relative group">
                                  <img src={img.dataUrl} alt="Action shot" className="h-16 w-auto rounded border border-slate-600" />
                                  <button
                                    onClick={() => removeActionShot(idx)}
                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                  >
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">No action shots uploaded yet</p>
                          )}
                        </div>

                        <p className="text-[10px] text-slate-500">
                          Tip: These images help AI understand your brand. Use {'{logo}'} in prompts to reference the logo placement.
                        </p>
                      </div>
                    )}

                    {/* Reference Images Tab */}
                    {guidedAssetsTab === 'reference' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-purple-400 font-medium">Reference Images ({settings.reference_images.length})</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Or paste image URL..."
                              className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white placeholder-slate-500 w-48"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const url = (e.target as HTMLInputElement).value.trim();
                                  if (url) {
                                    updateSettings({
                                      reference_images: [...settings.reference_images, { id: `ref-${Date.now()}`, dataUrl: url, name: 'From URL' }]
                                    });
                                    (e.target as HTMLInputElement).value = '';
                                  }
                                }
                              }}
                            />
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 text-xs rounded transition"
                            >
                              ↑ Upload
                            </button>
                          </div>
                        </div>
                        {settings.reference_images.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {settings.reference_images.map((img, idx) => (
                              <div key={img.id} className="relative group">
                                <img src={img.dataUrl} alt={img.name} className="h-16 w-auto rounded border border-purple-500/30" />
                                <button
                                  onClick={() => {
                                    const updated = settings.reference_images.filter((_, i) => i !== idx);
                                    updateSettings({ reference_images: updated });
                                  }}
                                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                >
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 text-center py-4">No reference images yet. Upload images that represent your desired style.</p>
                        )}
                      </div>
                    )}
                  </div>
                  )}
                </div>

                {/* REMOVED: Redundant fallback checkbox - functionality now handled by "Bank First" matching strategy */}
              </div>

              {/* ─────────────────────────────────────────────────────
                  SECTION 2: Smart Content Matching
                  - Bank mode: Toggle on/off
                  - Live + Main Prompt: Always ON (it's the core mechanism)
                  - Live + Guided/Smart: OFF (GPT handles prompts)
              ───────────────────────────────────────────────────── */}
              {(() => {
                // Determine Smart Matching state based on mode
                const isLiveMode = settings.integration_mode === 'live';
                const isMainPromptMode = settings.live_prompt_mode === 'main_prompt';
                const isGuidedOrSmartMode = settings.live_prompt_mode === 'guided_gpt' || settings.live_prompt_mode === 'smart_prompt';

                // Smart Matching is ALWAYS ON for Main Prompt mode (it's how it works)
                const isAlwaysOnMode = isLiveMode && isMainPromptMode;
                // Smart Matching is OFF/disabled for Guided GPT and Smart Prompt
                const isDisabledMode = isLiveMode && isGuidedOrSmartMode;
                // Normal toggle mode for Bank
                const isToggleMode = !isLiveMode;

                // Effective enabled state
                const effectiveEnabled = isAlwaysOnMode || (isToggleMode && settings.smart_matching_enabled);

                return (
              <div className={`rounded-lg p-4 border transition-all ${
                isDisabledMode
                  ? 'bg-slate-800/20 border-slate-600 opacity-60'
                  : isAlwaysOnMode
                    ? 'bg-purple-900/30 border-purple-500'
                    : effectiveEnabled
                      ? 'bg-purple-900/20 border-purple-500'
                      : 'bg-slate-800/30 border-slate-700'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className={`w-5 h-5 ${isDisabledMode ? 'text-slate-500' : effectiveEnabled ? 'text-purple-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <h3 className={`font-semibold ${isDisabledMode ? 'text-slate-500' : effectiveEnabled ? 'text-purple-400' : 'text-slate-500'}`}>Smart Content Matching</h3>
                    <span className="px-2 py-0.5 bg-purple-600/30 text-purple-300 text-[10px] rounded font-medium">BETA</span>
                    {isAlwaysOnMode && (
                      <span className="px-2 py-0.5 bg-purple-600/50 text-purple-200 text-[10px] rounded font-medium">ALWAYS ON</span>
                    )}
                    {isDisabledMode && (
                      <span className="px-2 py-0.5 bg-slate-600/50 text-slate-400 text-[10px] rounded font-medium">GPT HANDLES THIS</span>
                    )}
                  </div>
                  {/* Toggle - only show for Bank mode */}
                  {isToggleMode ? (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.smart_matching_enabled}
                        onChange={(e) => updateSettings({ smart_matching_enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  ) : isAlwaysOnMode ? (
                    <span className="text-xs text-purple-400 font-medium">Core Feature</span>
                  ) : (
                    <span className="text-xs text-slate-500">Not Used</span>
                  )}
                </div>

                {/* DISABLED: Guided GPT or Smart Prompt mode */}
                {isDisabledMode ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400">
                      <strong className="text-slate-300">Not used for {settings.live_prompt_mode === 'guided_gpt' ? 'Guided GPT' : 'Smart Prompt'} mode.</strong>
                    </p>
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-600">
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        {settings.live_prompt_mode === 'guided_gpt' ? (
                          <>GPT-4o analyzes your article content and generates contextual image prompts using your guardrails. No placeholder matching needed.</>
                        ) : (
                          <>GPT-4o-mini analyzes your article content and automatically generates appropriate image prompts. No placeholder matching needed.</>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-2">
                        Switch to <strong className="text-purple-400">"Main Prompt"</strong> to use placeholder-based Smart Content Matching.
                      </p>
                    </div>

                    {/* Static Placement Rules - Still apply to Guided GPT / Smart Prompt */}
                    <div className="bg-slate-800/30 rounded-lg p-3 border border-cyan-500/30">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        <h4 className="text-xs text-cyan-400 font-semibold">Placement Rules</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-600/30 text-cyan-300">STILL ACTIVE</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <label className="text-[10px] text-cyan-400 font-medium block mb-1">Image Placement Rule</label>
                          <textarea
                            value={settings.placement_rule || 'Place image at last paragraph break under {300} words since previous image. Hero image on {right/left/alt}.'}
                            onChange={(e) => updateSettings({ placement_rule: e.target.value })}
                            className="w-full bg-slate-800 border border-cyan-500/30 rounded px-2 py-1.5 text-white text-xs resize-none focus:outline-none focus:border-cyan-500"
                            rows={2}
                            placeholder="Place image at last paragraph break under {300} words since previous image..."
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-cyan-400 font-medium block mb-1">Content Analysis Rule</label>
                          <textarea
                            value={settings.smart_matching_rule || 'Look {50-75} words around image placement for keyword matches. Match against: {placeholder_categories}.'}
                            onChange={(e) => updateSettings({ smart_matching_rule: e.target.value })}
                            className="w-full bg-slate-800 border border-cyan-500/30 rounded px-2 py-1.5 text-white text-xs resize-none focus:outline-none focus:border-cyan-500"
                            rows={2}
                            placeholder="Look {50-75} words around image placement for keyword matches..."
                          />
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-2">
                        These rules guide GPT on where to place images and what content to analyze.
                      </p>
                    </div>
                  </div>
                ) : isAlwaysOnMode ? (
                  /* ALWAYS ON: Main Prompt mode in Generate Live */
                  <div className="space-y-4">
                    <p className="text-xs text-purple-300/70">
                      Main Prompt mode uses Smart Content Matching to fill placeholders based on article content around each image position.
                    </p>
                    <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-500/30">
                      <p className="text-[10px] text-purple-300 leading-relaxed">
                        <strong>How it works:</strong> For each image position, the system looks at the surrounding ~75 words and matches your placeholder keywords (e.g., {'{Room}'}, {'{Surface}'}) to the article content.
                      </p>
                    </div>

                    {/* Category Matching Rules for Main Prompt */}
                    {activeAvatar?.placeholderCategories && activeAvatar.placeholderCategories.length > 0 && (
                      <div className="bg-slate-800/50 rounded-lg p-3 border border-purple-500/20">
                        <label className="text-xs text-purple-400 mb-3 block font-medium flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
                          Category Matching Rules:
                        </label>
                        <div className="space-y-2">
                          {activeAvatar.placeholderCategories.map(cat => (
                            <div key={cat.id} className="flex items-center gap-3 text-xs bg-slate-900/50 p-2 rounded">
                              <span className="text-white font-medium w-32 truncate">{cat.name}</span>
                              <div className="flex-1 flex items-center gap-4">
                                <label className={`flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded transition ${!cat.isRandomized ? 'bg-purple-600/30 border border-purple-500' : 'hover:bg-slate-800'}`}>
                                  <input
                                    type="radio"
                                    name={`cat-match-live-${cat.id}`}
                                    checked={!cat.isRandomized}
                                    onChange={() => {
                                      const updatedCats = activeAvatar.placeholderCategories?.map(c =>
                                        c.id === cat.id ? { ...c, isRandomized: false } : c
                                      );
                                      handleUpdateAvatar(activeAvatar.id, { placeholderCategories: updatedCats });
                                    }}
                                    className="accent-purple-500"
                                  />
                                  <span className="text-purple-300">🎯 Match Keywords</span>
                                </label>
                                <label className={`flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded transition ${cat.isRandomized === true ? 'bg-amber-600/30 border border-amber-500' : 'hover:bg-slate-800'}`}>
                                  <input
                                    type="radio"
                                    name={`cat-match-live-${cat.id}`}
                                    checked={cat.isRandomized === true}
                                    onChange={() => {
                                      const updatedCats = activeAvatar.placeholderCategories?.map(c =>
                                        c.id === cat.id ? { ...c, isRandomized: true } : c
                                      );
                                      handleUpdateAvatar(activeAvatar.id, { placeholderCategories: updatedCats });
                                    }}
                                    className="accent-amber-500"
                                  />
                                  <span className="text-amber-300">🎲 Randomize</span>
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bank Save Option - Default: Generate Only, with double opt-in for Generate First */}
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-purple-500/20">
                      <label className="text-xs text-purple-400 mb-3 block font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                        Image Destination:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Generate Only - Default */}
                        <label className={`flex flex-col p-3 rounded cursor-pointer transition border-2 ${
                          settings.smart_matching_mode === 'generate_only'
                            ? 'bg-purple-600 border-purple-400 text-white'
                            : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700 hover:border-slate-500'
                        }`}>
                          <input
                            type="radio"
                            name="live_destination"
                            checked={settings.smart_matching_mode === 'generate_only'}
                            onChange={() => updateSettings({ smart_matching_mode: 'generate_only' })}
                            className="hidden"
                          />
                          <span className="text-xs font-bold flex items-center gap-1">
                            <span className="text-lg">📄</span> Page Only
                          </span>
                          <span className="text-[10px] opacity-80 mt-1">Generate fresh for this page</span>
                          <span className="text-[9px] opacity-60 mt-0.5">Recommended</span>
                        </label>

                        {/* Generate First - Requires double opt-in */}
                        <label
                          className={`flex flex-col p-3 rounded cursor-pointer transition border-2 ${
                            settings.smart_matching_mode === 'generate_first'
                              ? 'bg-amber-600 border-amber-400 text-white'
                              : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700 hover:border-slate-500'
                          }`}
                          onClick={(e) => {
                            // If not already selected, show warning first
                            if (settings.smart_matching_mode !== 'generate_first') {
                              e.preventDefault();
                              setShowGenerateFirstWarning(true);
                            }
                          }}
                        >
                          <input
                            type="radio"
                            name="live_destination"
                            checked={settings.smart_matching_mode === 'generate_first'}
                            onChange={() => {}} // Handled by onClick above
                            className="hidden"
                          />
                          <span className="text-xs font-bold flex items-center gap-1">
                            <span className="text-lg">📄➕📦</span> Page + Bank
                          </span>
                          <span className="text-[10px] opacity-80 mt-1">Also save copy to Image Bank</span>
                          <span className="text-[9px] opacity-60 mt-0.5">For reuse on future pages</span>
                        </label>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">
                        <strong className="text-purple-400">Page Only:</strong> Each page gets unique generated images.<br/>
                        <strong className="text-amber-400">Page + Bank:</strong> Images are also saved for potential reuse by other articles.
                      </p>
                    </div>

                    {/* Double Opt-In Warning Modal for Generate First */}
                    {showGenerateFirstWarning && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                        <div className="bg-slate-800 rounded-xl border border-amber-500 p-6 max-w-md mx-4 shadow-2xl">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-3xl">⚠️</span>
                            <h3 className="text-lg font-bold text-amber-400">Save to Image Bank?</h3>
                          </div>
                          <p className="text-sm text-slate-300 mb-4">
                            This will generate images for the current page <strong className="text-white">AND</strong> save copies to the Image Bank for potential reuse on future pages.
                          </p>
                          <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-3 mb-4">
                            <p className="text-xs text-amber-300">
                              <strong>Use case:</strong> Building a reusable image library over time. Images generated for one article may be smart-matched to similar content in future articles.
                            </p>
                          </div>
                          <p className="text-xs text-slate-400 mb-4">
                            If you just want unique images per page without saving to the bank, cancel and use "Page Only" instead.
                          </p>
                          <div className="flex gap-3">
                            <button
                              onClick={() => setShowGenerateFirstWarning(false)}
                              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                updateSettings({ smart_matching_mode: 'generate_first' });
                                setShowGenerateFirstWarning(false);
                              }}
                              className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-bold transition"
                            >
                              Yes, Save to Bank
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : effectiveEnabled ? (
                  <div className="space-y-4">
                    <p className="text-xs text-purple-300/70">
                      AI analyzes article text and matches images based on keywords. Define keywords in each placeholder option above.
                    </p>

                    {/* Matching Strategy - CONSTRAINED by Image Source (integration_mode) */}
                    <div>
                      <label className="text-xs text-purple-400 mb-2 block font-medium">
                        Matching Strategy:
                        <span className="ml-2 text-[10px] text-slate-500">
                          ({settings.integration_mode === 'bank' ? 'Bank options only' : 'Generate options only'})
                        </span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Show only Bank options when integration_mode is 'bank', only Generate options when 'live' */}
                        {(settings.integration_mode === 'bank' ? [
                          { value: 'bank_first', label: 'Bank First', desc: 'Search bank → Generate if no match' },
                          { value: 'bank_only', label: 'Bank Only', desc: 'Only use existing bank images' }
                        ] : [
                          { value: 'generate_first', label: 'Generate First', desc: 'Always fresh → Save to bank' },
                          { value: 'generate_only', label: 'Generate Only', desc: 'Always new → Skip bank' }
                        ]).map(opt => (
                          <label key={opt.value} className={`flex flex-col p-2 rounded cursor-pointer transition ${settings.smart_matching_mode === opt.value ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                            <input type="radio" name="smart_mode" checked={settings.smart_matching_mode === opt.value} onChange={() => updateSettings({ smart_matching_mode: opt.value as any })} className="hidden" />
                            <span className="text-xs font-medium">{opt.label}</span>
                            <span className="text-[9px] opacity-70">{opt.desc}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Category Matching Rules */}
                    {activeAvatar?.placeholderCategories && activeAvatar.placeholderCategories.length > 0 && (
                      <div className="bg-slate-800/50 rounded-lg p-3 border border-purple-500/20">
                        <label className="text-xs text-purple-400 mb-3 block font-medium flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
                          Category Matching Rules:
                        </label>
                        <div className="space-y-2">
                          {activeAvatar.placeholderCategories.map(cat => (
                            <div key={cat.id} className="flex items-center gap-3 text-xs bg-slate-900/50 p-2 rounded">
                              <span className="text-white font-medium w-32 truncate">{cat.name}</span>
                              <div className="flex-1 flex items-center gap-4">
                                <label className={`flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded transition ${!cat.isRandomized ? 'bg-purple-600/30 border border-purple-500' : 'hover:bg-slate-800'}`}>
                                  <input
                                    type="radio"
                                    name={`cat-match-${cat.id}`}
                                    checked={!cat.isRandomized}
                                    onChange={() => {
                                      const updatedCats = activeAvatar.placeholderCategories?.map(c =>
                                        c.id === cat.id ? { ...c, isRandomized: false } : c
                                      );
                                      handleUpdateAvatar(activeAvatar.id, { placeholderCategories: updatedCats });
                                    }}
                                    className="accent-purple-500"
                                  />
                                  <span className="text-purple-300">🎯 Match Keywords</span>
                                </label>
                                <label className={`flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded transition ${cat.isRandomized === true ? 'bg-amber-600/30 border border-amber-500' : 'hover:bg-slate-800'}`}>
                                  <input
                                    type="radio"
                                    name={`cat-match-${cat.id}`}
                                    checked={cat.isRandomized === true}
                                    onChange={() => {
                                      const updatedCats = activeAvatar.placeholderCategories?.map(c =>
                                        c.id === cat.id ? { ...c, isRandomized: true } : c
                                      );
                                      handleUpdateAvatar(activeAvatar.id, { placeholderCategories: updatedCats });
                                    }}
                                    className="accent-amber-500"
                                  />
                                  <span className="text-amber-300">🎲 Randomize</span>
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-3">
                          <strong className="text-purple-400">Match Keywords:</strong> Uses keyword field in placeholder options to match article content<br/>
                          <strong className="text-amber-400">Randomize:</strong> Picks any option randomly (ideal for Gender/Age categories)
                        </p>
                      </div>
                    )}

                    {/* B-Roll Configuration */}
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                      <label className="text-xs text-slate-400 mb-2 block font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
                        B-Roll Settings (Coming Soon):
                      </label>
                      <div className="flex items-center gap-3 text-xs opacity-50">
                        <label className="flex items-center gap-2 cursor-not-allowed">
                          <input type="checkbox" disabled className="accent-purple-500" />
                          <span className="text-white">Include 1 B-Roll per page</span>
                        </label>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">
                        B-Roll images show general scenes (cleaning supplies, branded vehicles, etc.)
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Enable Smart Content Matching to have AI automatically select images based on article content for optimal SEO.
                  </p>
                )}
              </div>
                );
              })()}

              {/* ─────────────────────────────────────────────────────
                  SECTION 3: Matching Rules - CONDITIONAL based on Smart Matching toggle
                  NOTE: Only shown when Image Source is "Pull from Bank"
              ───────────────────────────────────────────────────── */}
              {settings.integration_mode === 'bank' && (
              <div className={`rounded-lg p-4 border ${settings.smart_matching_enabled ? 'bg-slate-800/50 border-emerald-500/30' : 'bg-slate-800/30 border-cyan-500/30'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <svg className={`w-5 h-5 ${settings.smart_matching_enabled ? 'text-emerald-400' : 'text-cyan-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <h3 className={`font-semibold ${settings.smart_matching_enabled ? 'text-emerald-400' : 'text-cyan-400'}`}>
                    {settings.smart_matching_enabled ? 'Smart Matching Rules' : 'Static Matching Rules'}
                  </h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${settings.smart_matching_enabled ? 'bg-emerald-600/30 text-emerald-300' : 'bg-cyan-600/30 text-cyan-300'}`}>
                    {settings.smart_matching_enabled ? 'Smart Matching ON' : 'Smart Matching OFF'}
                  </span>
                </div>

                {/* 4 COLORED RULES - Only show when Smart Matching is ON */}
                {settings.smart_matching_enabled ? (
                  <>
                    {/* Numbered Rules List - EDITABLE */}
                    <div className="space-y-3">
                      {/* Rule 1 - Emerald */}
                      <div className="flex items-start gap-3 bg-slate-900/50 p-3 rounded-lg border-l-4 border-emerald-500">
                        <span className="w-6 h-6 flex items-center justify-center bg-emerald-600 rounded-full text-white text-xs font-bold shrink-0">1</span>
                        <div className="flex-1">
                          <label className="text-xs text-emerald-400 font-semibold mb-1 block">Primary Keywords Rule</label>
                          <textarea
                            value={settings.matching_rule_1 || 'Always try to match Primary Keywords first. Search for primary keywords within the word range around image placement.'}
                            onChange={(e) => updateSettings({ matching_rule_1: e.target.value })}
                            className="w-full bg-slate-800 border border-emerald-500/30 rounded px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-emerald-500"
                            rows={2}
                            placeholder="Rule for primary keyword matching..."
                          />
                        </div>
                      </div>

                      {/* Rule 2 - Amber */}
                      <div className="flex items-start gap-3 bg-slate-900/50 p-3 rounded-lg border-l-4 border-amber-500">
                        <span className="w-6 h-6 flex items-center justify-center bg-amber-600 rounded-full text-white text-xs font-bold shrink-0">2</span>
                        <div className="flex-1">
                          <label className="text-xs text-amber-400 font-semibold mb-1 block">Secondary Keywords Fallback Rule</label>
                          <textarea
                            value={settings.matching_rule_2 || 'If no primary match, fall back to Secondary Keywords. Only if secondary keywords are enabled for that option.'}
                            onChange={(e) => updateSettings({ matching_rule_2: e.target.value })}
                            className="w-full bg-slate-800 border border-amber-500/30 rounded px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-amber-500"
                            rows={2}
                            placeholder="Rule for secondary keyword fallback..."
                          />
                        </div>
                      </div>

                      {/* Rule 3 - Red */}
                      <div className="flex items-start gap-3 bg-slate-900/50 p-3 rounded-lg border-l-4 border-red-500">
                        <span className="w-6 h-6 flex items-center justify-center bg-red-600 rounded-full text-white text-xs font-bold shrink-0">3</span>
                        <div className="flex-1">
                          <label className="text-xs text-red-400 font-semibold mb-1 block">No Duplicate Primaries Rule</label>
                          <textarea
                            value={settings.matching_rule_3 || 'Never use the same Primary Keyword twice on a page. Each primary keyword can only appear once per article (no duplicate stove images).'}
                            onChange={(e) => updateSettings({ matching_rule_3: e.target.value })}
                            className="w-full bg-slate-800 border border-red-500/30 rounded px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-red-500"
                            rows={2}
                            placeholder="Rule for preventing duplicate primary keywords..."
                          />
                        </div>
                      </div>

                      {/* Rule 4 - Purple */}
                      <div className="flex items-start gap-3 bg-slate-900/50 p-3 rounded-lg border-l-4 border-purple-500">
                        <span className="w-6 h-6 flex items-center justify-center bg-purple-600 rounded-full text-white text-xs font-bold shrink-0">4</span>
                        <div className="flex-1">
                          <label className="text-xs text-purple-400 font-semibold mb-1 block">Different Primaries for Secondary Matches Rule</label>
                          <textarea
                            value={settings.matching_rule_4 || 'Secondary keyword matches must have different primaries. If "kitchen" matches twice, each must be a different primary (stove, then sink).'}
                            onChange={(e) => updateSettings({ matching_rule_4: e.target.value })}
                            className="w-full bg-slate-800 border border-purple-500/30 rounded px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-purple-500"
                            rows={2}
                            placeholder="Rule for secondary keyword primary diversity..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Plurals Toggle - Only with Smart Matching */}
                    <div className="mt-4 flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-emerald-500/30">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📝</span>
                        <div>
                          <span className="text-sm text-white font-medium">Auto-Match Plurals</span>
                          <p className="text-[10px] text-slate-400">counter → counters, sink → sinks, countertop → countertops</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.match_plurals !== false}
                          onChange={(e) => updateSettings({ match_plurals: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                  </>
                ) : (
                  /* 2 BLUE RULES - Only show when Smart Matching is OFF (static fallback) */
                  <div className="space-y-3">
                    <p className="text-xs text-cyan-300/70 mb-3">
                      Smart Matching is OFF. These static rules will be used for all image placements.
                    </p>
                    <div>
                      <label className="text-xs text-cyan-400 font-semibold block mb-1">Image Placement Rule</label>
                      <textarea
                        value={settings.placement_rule || 'Place image at last paragraph break under {300} words since previous image. Hero image on {right/left/alt}.'}
                        onChange={(e) => updateSettings({ placement_rule: e.target.value })}
                        className="w-full bg-slate-800 border border-cyan-500/30 rounded px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-cyan-500"
                        rows={2}
                        placeholder="Place image at last paragraph break under {300} words since previous image..."
                      />
                    </div>
                    <div>
                      <label className="text-xs text-cyan-400 font-semibold block mb-1">Smart Matching Rule</label>
                      <textarea
                        value={settings.smart_matching_rule || 'Look {50-75} words around image placement for keyword matches. Match against: {placeholder_categories}.'}
                        onChange={(e) => updateSettings({ smart_matching_rule: e.target.value })}
                        className="w-full bg-slate-800 border border-cyan-500/30 rounded px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-cyan-500"
                        rows={2}
                        placeholder="Look {50-75} words around image placement for keyword matches..."
                      />
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* ─────────────────────────────────────────────────────
                  SECTION 4: Variation Order
              ───────────────────────────────────────────────────── */}
              <div className="bg-slate-800/50 rounded-lg border border-orange-500/30 overflow-hidden">
                <button onClick={() => setIsOrderOpen(!isOrderOpen)} className="w-full flex items-center justify-between p-4 text-orange-400 hover:bg-slate-800/80 transition">
                  <span className="flex items-center gap-2 font-semibold">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                    Variation Order
                    <span className="text-xs text-orange-300/70 font-normal ml-2">
                      ({settings.variation_order_mode === 'manual' ? `${settings.manual_variation_order?.length || 0} set` : settings.variation_order_mode})
                    </span>
                  </span>
                  <svg className={`w-5 h-5 transition-transform ${isOrderOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {isOrderOpen && (
                  <div className="p-4 border-t border-orange-500/30 space-y-3 bg-slate-900/50">
                    <p className="text-xs text-brand-gold/70">Define the order variations are used across pages. Each page gets unique variations.</p>

                    <div className="flex items-center gap-3 mb-2">
                      <label className="text-xs text-brand-gold/70">Mode:</label>
                      <select
                        value={settings.variation_order_mode || 'sequential'}
                        onChange={(e) => updateSettings({ variation_order_mode: e.target.value as any })}
                        className="bg-slate-800 border border-brand-gold/50 rounded px-3 py-1.5 text-white text-xs"
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
                      <div className="text-xs text-orange-300 bg-orange-900/30 p-2 rounded border border-orange-500/30">
                        Order: {settings.manual_variation_order.map((id, idx) => {
                          const v = activeAvatar?.variations.find(v => v.id === id);
                          return v ? `${idx + 1}. ${v.name}` : '';
                        }).filter(Boolean).join(' → ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-brand-cyan text-slate-900 px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
          Saving...
        </div>
      )}

      {/* Fullscreen Image Bank Modal */}
      {bankFullscreen && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex flex-col border-b border-brand-cyan/30 bg-slate-900">
            {/* Top row - Title and Close */}
            <div className="flex items-center justify-between p-4 pb-2">
              <h2 className="text-xl font-bold text-brand-cyan flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Image Bank ({availableImages.length} {showArchived ? 'archived' : 'available'})
              </h2>
              <button
                onClick={() => setBankFullscreen(false)}
                className="p-2 hover:bg-slate-800 rounded-full text-white transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Second row - Filters, View Toggle, and Actions */}
            <div className="flex items-center justify-between px-4 pb-3 gap-4 flex-wrap">
              {/* Left: Filters */}
              <div className="flex gap-2 flex-wrap items-center">
                <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} className="bg-slate-800 border border-brand-gold/50 rounded px-2 py-1 text-white text-sm">
                  <option value="all">All Models</option>
                  {uniqueModels.map(m => (<option key={m} value={m}>{m}</option>))}
                </select>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-slate-800 border border-brand-gold/50 rounded px-2 py-1 text-white text-sm">
                  <option value="all">All Categories</option>
                  {settings.image_categories.map(c => (<option key={c} value={c}>{c}</option>))}
                </select>
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className={`px-3 py-1 rounded text-sm transition ${showArchived ? 'bg-amber-600 text-white' : 'bg-slate-700 text-white/70 hover:bg-slate-600'}`}
                >
                  {showArchived ? 'Viewing Archive' : 'View Archive'}
                </button>
              </div>
              {/* Center: View Toggle - Simple icons */}
              <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-brand-cyan/30 gap-1">
                <button
                  onClick={() => setBankViewMode('compact')}
                  className={`p-2 rounded transition ${
                    bankViewMode === 'compact' ? 'bg-brand-cyan text-slate-900' : 'text-white/70 hover:text-white hover:bg-slate-700'
                  }`}
                  title="Compact View (6 columns)"
                >
                  {/* Grid icon - small squares */}
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </button>
                <button
                  onClick={() => setBankViewMode('gallery')}
                  className={`p-2 rounded transition ${
                    bankViewMode === 'gallery' ? 'bg-brand-cyan text-slate-900' : 'text-white/70 hover:text-white hover:bg-slate-700'
                  }`}
                  title="Gallery View (Full Size)"
                >
                  {/* Large rectangle icon - landscape */}
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                  </svg>
                </button>
              </div>
              {/* Right: Actions (duplicated from footer) */}
              <div className="flex gap-2 items-center">
                {selectedForDownload.size > 0 && (
                  <>
                    <button onClick={handleBulkDownload} className="px-3 py-1.5 bg-brand-cyan hover:bg-brand-cyan-dark rounded text-slate-900 font-medium text-sm transition flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Download Selected
                    </button>
                    <button onClick={clearDownloadSelection} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm transition">Clear Selection</button>
                  </>
                )}
                <button onClick={selectAllForDownload} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm transition">Select All</button>
              </div>
            </div>
          </div>
          {/* Image Grid - fullscreen */}
          <div className="flex-1 overflow-auto p-6">
            {availableImages.length > 0 ? (
              bankViewMode === 'compact' ? (
                /* COMPACT VIEW - Small thumbnails, more images visible */
                <div className="grid grid-cols-6 gap-4">
                  {availableImages.map((img) => (
                    <div key={img.id} className={`relative group cursor-pointer bg-slate-900 rounded-lg overflow-hidden border border-brand-cyan/30 ${selectedForDownload.has(img.id) ? 'ring-2 ring-brand-cyan' : ''}`}>
                      {/* Header with model and timestamp */}
                      <div className="p-2 bg-slate-800/80 border-b border-brand-cyan/20">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs text-white font-medium truncate">{img.title || img.variation}</span>
                          {img.model && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${
                              img.model === 'seedream-4' ? 'bg-green-600/80 text-white' :
                              img.model === 'ideogram-v3-turbo' ? 'bg-purple-600/80 text-white' :
                              img.model === 'flux-1.1-pro' ? 'bg-blue-600/80 text-white' :
                              img.model.startsWith('gpt') ? 'bg-emerald-600/80 text-white' :
                              'bg-slate-600/80 text-white'
                            }`}>
                              {img.model.replace('-1.1-pro', '').replace('-v3-turbo', ' v3').replace('-4', ' 4').replace('gpt-image-', 'GPT ')}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-brand-gold/50">
                          {new Date(img.createdAt).toLocaleDateString()} {new Date(img.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                      {/* Image - fixed height, cropped */}
                      <img
                        src={img.url}
                        alt={img.title || img.variation}
                        className="w-full h-40 object-cover"
                        onClick={() => setPreviewImage(img)}
                      />
                      {/* Actions overlay */}
                      <div className="absolute inset-0 top-12 bg-black/70 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2 p-2">
                        <div className="flex gap-2 flex-wrap justify-center">
                          <button onClick={() => setPreviewImage(img)} className="px-3 py-1 bg-blue-600 rounded text-white text-xs">View</button>
                          <button onClick={() => handleDownloadImage(img)} className="px-3 py-1 bg-brand-cyan rounded text-slate-900 text-xs font-medium">Download</button>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleArchiveImage(img.id)} className="px-3 py-1 bg-amber-600 rounded text-white text-xs">
                            {img.archived ? 'Restore' : 'Archive'}
                          </button>
                          <button onClick={() => handleRemoveFromBank(img.id)} className="px-3 py-1 bg-red-600 rounded text-white text-xs">Delete</button>
                        </div>
                      </div>
                      {/* Selection checkbox */}
                      <div className="absolute top-12 left-2">
                        <input
                          type="checkbox"
                          checked={selectedForDownload.has(img.id)}
                          onChange={() => toggleDownloadSelection(img.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 rounded border-2 border-brand-cyan text-brand-cyan focus:ring-brand-cyan bg-slate-900/80"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* GALLERY VIEW - Full-size images with stable aspect ratio containers */
                <div className="grid grid-cols-3 gap-6">
                  {availableImages.map((img) => (
                    <div key={img.id} className={`relative group cursor-pointer bg-slate-900 rounded-xl overflow-hidden border-2 ${selectedForDownload.has(img.id) ? 'border-brand-cyan ring-2 ring-brand-cyan/50' : 'border-brand-cyan/30'}`}>
                      {/* Selection checkbox - prominent */}
                      <div className="absolute top-3 left-3 z-20">
                        <input
                          type="checkbox"
                          checked={selectedForDownload.has(img.id)}
                          onChange={() => toggleDownloadSelection(img.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-6 h-6 rounded border-2 border-brand-cyan text-brand-cyan focus:ring-brand-cyan bg-slate-900/90 cursor-pointer"
                        />
                      </div>
                      {/* Model badge - top right */}
                      {img.model && (
                        <div className="absolute top-3 right-3 z-20">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            img.model === 'seedream-4' ? 'bg-green-600 text-white' :
                            img.model === 'ideogram-v3-turbo' ? 'bg-purple-600 text-white' :
                            img.model === 'flux-1.1-pro' ? 'bg-blue-600 text-white' :
                            img.model.startsWith('gpt') ? 'bg-emerald-600 text-white' :
                            'bg-slate-600 text-white'
                          }`}>
                            {img.model.replace('-1.1-pro', '').replace('-v3-turbo', ' v3').replace('-4', ' 4').replace('gpt-image-', 'GPT ')}
                          </span>
                        </div>
                      )}
                      {/* Image container - fixed aspect ratio to prevent jitter */}
                      <div className="relative bg-slate-950 aspect-[3/4] flex items-center justify-center" onClick={() => setPreviewImage(img)}>
                        <img
                          src={img.url}
                          alt={img.title || img.variation}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      {/* Info bar at bottom */}
                      <div className="p-3 bg-slate-800/95 border-t border-brand-cyan/20">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate">{img.title || img.variation}</p>
                            <p className="text-xs text-brand-gold/60">
                              {new Date(img.createdAt).toLocaleDateString()} {new Date(img.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              {img.avatarTag && <span className="ml-2 text-brand-cyan">• Tag: {img.avatarTag}</span>}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setPreviewImage(img)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs transition">View</button>
                            <button onClick={() => handleDownloadImage(img)} className="px-3 py-1.5 bg-brand-cyan hover:bg-brand-cyan-dark rounded text-slate-900 text-xs font-medium transition">Download</button>
                            <button onClick={() => handleArchiveImage(img.id)} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-white text-xs transition">
                              {img.archived ? 'Restore' : 'Archive'}
                            </button>
                            <button onClick={() => handleRemoveFromBank(img.id)} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-white text-xs transition">Delete</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-brand-gold/50 text-lg">{showArchived ? 'No archived images.' : 'No available images.'}</p>
              </div>
            )}
          </div>
          {/* Footer with bulk actions */}
          <div className="p-4 border-t border-brand-cyan/30 bg-slate-900 flex justify-between items-center">
            <div className="text-sm text-brand-gold/70">
              {selectedForDownload.size > 0 ? `${selectedForDownload.size} images selected` : 'Click images to select for bulk download'}
            </div>
            <div className="flex gap-2">
              {selectedForDownload.size > 0 && (
                <>
                  <button onClick={handleBulkDownload} className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan-dark rounded text-slate-900 font-medium text-sm transition flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download Selected
                  </button>
                  <button onClick={clearDownloadSelection} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm transition">Clear Selection</button>
                </>
              )}
              <button onClick={selectAllForDownload} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm transition">Select All</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          {/* Fixed container to prevent flickering */}
          <div className="relative w-full max-w-4xl flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-2 right-0 text-white hover:text-brand-cyan transition p-2 z-10"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Image container with fixed aspect ratio behavior */}
            <div className="w-full flex items-center justify-center" style={{ minHeight: '60vh', maxHeight: '75vh' }}>
              <img
                src={previewImage.url}
                alt={previewImage.variation}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
                style={{ margin: '0 auto' }}
              />
            </div>

            {/* Navigation arrows - together at bottom */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <button
                onClick={() => {
                  const currentIndex = availableImages.findIndex(img => img.id === previewImage.id);
                  const prevIndex = currentIndex > 0 ? currentIndex - 1 : availableImages.length - 1;
                  setPreviewImage(availableImages[prevIndex]);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition"
                title="Previous image"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">Previous</span>
              </button>

              <span className="text-white/50 text-sm">
                {availableImages.findIndex(img => img.id === previewImage.id) + 1} / {availableImages.length}
              </span>

              <button
                onClick={() => {
                  const currentIndex = availableImages.findIndex(img => img.id === previewImage.id);
                  const nextIndex = currentIndex < availableImages.length - 1 ? currentIndex + 1 : 0;
                  setPreviewImage(availableImages[nextIndex]);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition"
                title="Next image"
              >
                <span className="text-sm">Next</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Info and actions bar */}
            <div className="mt-4 w-full bg-slate-900 rounded-lg p-4 flex items-center justify-between">
              <div className="text-white min-w-0 flex-1">
                <p className="font-semibold">{previewImage.title || previewImage.variation}</p>
                <p className="text-xs text-brand-gold/70 mt-1">
                  {previewImage.orientation} • {new Date(previewImage.createdAt).toLocaleDateString()}
                  {previewImage.model && <span className="ml-2">• {previewImage.model}</span>}
                </p>
                {previewImage.prompt && (
                  <p className="text-xs text-gray-400 mt-2 truncate" title={previewImage.prompt}>
                    Prompt: {previewImage.prompt.substring(0, 100)}...
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
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

      {/* Floating Review Button - Shows when there are pending feedback requests */}
      {recentGenerations.length > 0 && !showFeedbackPopup && (
        <div className="fixed right-6 z-40" style={{ top: '140px' }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openFeedbackForGeneration(recentGenerations[0])}
              className={`bg-slate-800 hover:bg-slate-700 border-2 border-cyan-500 text-white px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 transition-all ${!feedbackGlowDismissed ? 'animate-pulse' : ''}`}
              style={!feedbackGlowDismissed ? {
                boxShadow: '0 0 20px rgba(6, 182, 212, 0.5), 0 0 40px rgba(6, 182, 212, 0.3)'
              } : {}}
            >
              <span className="text-lg">🎯</span>
              <span className="font-semibold">Review Images</span>
              <span className="bg-cyan-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded">{recentGenerations.length}</span>
            </button>
            {!feedbackGlowDismissed && (
              <button
                onClick={() => setFeedbackGlowDismissed(true)}
                className="bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white p-1.5 rounded transition"
                title="Dismiss glow (I'll review later)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Feedback Popup */}
      <FeedbackPopup
        isOpen={showFeedbackPopup}
        onClose={() => setShowFeedbackPopup(false)}
        feedbackRequest={pendingFeedbackRequest}
        pendingQuestions={pendingQuestions}
        avatarName={activeAvatar?.name}
        onSubmit={handleFeedbackSubmit}
        onSkip={handleFeedbackSkip}
        onNeverAskAgain={async () => {
          try {
            await fetch(`/api/feedback/settings/${workflowId || 1}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ never_ask_again: true })
            });
            setShowFeedbackPopup(false);
            setRecentGenerations([]);
            showNotification('Feedback disabled. You can re-enable in settings.', 'info');
          } catch (error) {
            console.error('[Feedback] Never ask error:', error);
          }
        }}
      />
    </div>
  );
};

export default ImageCreationSection;
