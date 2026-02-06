/**
 * VibeCoder Notepad - Edit Tracking & Submission Tool
 *
 * A slide-out panel for capturing, organizing, and submitting edits to Claude Code.
 * Solves the problem of:
 * - Forgetting edits while in the flow
 * - Organizing multiple edits with images
 * - Working within Claude Code's 5-image limit
 * - Leaving breadcrumbs for future coding sessions
 *
 * FUTURE SAAS VISION: See /docs/VIBECODER_SAAS_VISION.md
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface EditImage {
  id: string;
  dataUrl: string; // Base64 image data
  label?: string; // Auto-generated: "1a", "1b", etc.
  timestamp: number;
}

interface Edit {
  id: string;
  number: number; // Edit 1, Edit 2, etc.
  title: string;
  description: string;
  images: EditImage[];
  tags: string[]; // Auto-generated tags
  status: 'pending' | 'submitted' | 'done';
  createdAt: number;
  submittedAt?: number;
  // Breadcrumb data (for codebase index)
  filesPaths?: string[]; // Files this edit touched
  lineRanges?: string[]; // e.g., "lines 52-60"
  componentNames?: string[]; // e.g., "ImageCreationSection"
}

interface CodebaseIndexEntry {
  filePath: string;
  description: string;
  lineRange?: string;
  componentName?: string;
  lastEditId?: string;
  lastEditDate: number;
  tags: string[];
}

interface VibeCoderState {
  edits: Edit[];
  codebaseIndex: CodebaseIndexEntry[];
  currentProjectId?: string;
  currentProjectName?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'vibecoder_notepad';

const loadState = (): VibeCoderState => {
  if (typeof window === 'undefined') {
    return { edits: [], codebaseIndex: [] };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load VibeCoder state:', e);
  }
  return { edits: [], codebaseIndex: [] };
};

const saveState = (state: VibeCoderState) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save VibeCoder state:', e);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const generateId = () => Math.random().toString(36).substr(2, 9);

// Auto-tag based on content
const autoTag = (title: string, description: string): string[] => {
  const text = `${title} ${description}`.toLowerCase();
  const tags: string[] = [];

  // Common patterns
  if (text.match(/button|btn|click/)) tags.push('ui-button');
  if (text.match(/style|css|color|margin|padding|layout/)) tags.push('styling');
  if (text.match(/bug|fix|error|broken|issue/)) tags.push('bugfix');
  if (text.match(/add|new|create|implement/)) tags.push('feature');
  if (text.match(/api|fetch|request|endpoint/)) tags.push('api');
  if (text.match(/image|photo|picture|img/)) tags.push('images');
  if (text.match(/database|db|sql|query/)) tags.push('database');
  if (text.match(/mobile|responsive|phone/)) tags.push('mobile');
  if (text.match(/text|label|copy|wording/)) tags.push('content');

  return tags;
};

// Generate image label (1a, 1b, etc.)
const getImageLabel = (editNumber: number, imageIndex: number): string => {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  return `${editNumber}${letters[imageIndex] || imageIndex}`;
};

// Count total images in edits
const countImages = (edits: Edit[]): number => {
  return edits.reduce((sum, edit) => sum + edit.images.length, 0);
};

// Get edits that fit within image limit
const getEditsBatch = (edits: Edit[], maxImages: number = 5): { batch: Edit[], remaining: Edit[] } => {
  const pendingEdits = edits.filter(e => e.status === 'pending');
  const batch: Edit[] = [];
  let imageCount = 0;

  for (const edit of pendingEdits) {
    const editImageCount = Math.max(1, edit.images.length); // At least 1 slot per edit for collage
    if (imageCount + editImageCount <= maxImages) {
      batch.push(edit);
      imageCount += editImageCount;
    } else if (batch.length === 0) {
      // First edit has too many images - include it anyway, will need multiple submissions
      batch.push(edit);
      break;
    } else {
      break;
    }
  }

  const remaining = pendingEdits.filter(e => !batch.includes(e));
  return { batch, remaining };
};

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE CONSOLIDATION - Combine all images into one with numbered sections
// ═══════════════════════════════════════════════════════════════════════════

interface ConsolidatedImage {
  dataUrl: string;
  width: number;
  height: number;
  editCount: number;
  imageCount: number;
}

/**
 * Load an image from a data URL and return its dimensions
 */
const loadImage = (dataUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
};

/**
 * Create a consolidated image from all pending edits
 * - Each edit's images shown in a row
 * - Horizontal lines between edit sections
 * - Number overlay on each section (①, ②, ③)
 */
const createConsolidatedImage = async (edits: Edit[]): Promise<ConsolidatedImage | null> => {
  const editsWithImages = edits.filter(e => e.images.length > 0);
  if (editsWithImages.length === 0) return null;

  // Settings
  const SECTION_PADDING = 20;
  const LINE_HEIGHT = 4;
  const NUMBER_SIZE = 48;
  const MAX_IMAGE_HEIGHT = 400; // Max height per image row
  const GAP_BETWEEN_IMAGES = 10;

  // Load all images first to get dimensions
  const editImageData: { edit: Edit; images: HTMLImageElement[] }[] = [];

  for (const edit of editsWithImages) {
    const loadedImages: HTMLImageElement[] = [];
    for (const img of edit.images) {
      try {
        const loaded = await loadImage(img.dataUrl);
        loadedImages.push(loaded);
      } catch (e) {
        console.error('Failed to load image:', e);
      }
    }
    if (loadedImages.length > 0) {
      editImageData.push({ edit, images: loadedImages });
    }
  }

  if (editImageData.length === 0) return null;

  // Calculate canvas dimensions
  let totalHeight = SECTION_PADDING; // Top padding
  let maxWidth = 800; // Minimum width

  const sectionHeights: number[] = [];

  for (const { images } of editImageData) {
    // Calculate row width and height for this edit's images
    let rowWidth = SECTION_PADDING * 2 + NUMBER_SIZE + GAP_BETWEEN_IMAGES; // Left padding + number + gap
    let rowHeight = 0;

    for (const img of images) {
      // Scale image to fit max height while preserving aspect ratio
      const scale = Math.min(1, MAX_IMAGE_HEIGHT / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;

      rowWidth += scaledWidth + GAP_BETWEEN_IMAGES;
      rowHeight = Math.max(rowHeight, scaledHeight);
    }

    maxWidth = Math.max(maxWidth, rowWidth);
    sectionHeights.push(rowHeight + SECTION_PADDING * 2);
    totalHeight += rowHeight + SECTION_PADDING * 2;

    // Add line height between sections (except after last)
    if (editImageData.indexOf({ edit: editImageData[editImageData.length - 1].edit, images }) === -1) {
      totalHeight += LINE_HEIGHT;
    }
  }

  // Add separators
  totalHeight += (editImageData.length - 1) * LINE_HEIGHT;
  totalHeight += SECTION_PADDING; // Bottom padding

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Fill background
  ctx.fillStyle = '#1e293b'; // slate-800
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw each section
  let currentY = SECTION_PADDING;
  const circledNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

  for (let i = 0; i < editImageData.length; i++) {
    const { edit, images } = editImageData[i];
    const sectionHeight = sectionHeights[i];

    // Draw section background (slightly lighter)
    ctx.fillStyle = '#334155'; // slate-700
    ctx.fillRect(0, currentY, canvas.width, sectionHeight);

    // Draw number circle
    const numberX = SECTION_PADDING + NUMBER_SIZE / 2;
    const numberY = currentY + sectionHeight / 2;

    // Circle background
    ctx.beginPath();
    ctx.arc(numberX, numberY, NUMBER_SIZE / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#7c3aed'; // purple-600
    ctx.fill();

    // Number text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${NUMBER_SIZE * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(edit.number), numberX, numberY);

    // Draw images
    let imageX = SECTION_PADDING + NUMBER_SIZE + GAP_BETWEEN_IMAGES * 2;

    for (let j = 0; j < images.length; j++) {
      const img = images[j];
      const scale = Math.min(1, MAX_IMAGE_HEIGHT / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;

      const imageY = currentY + (sectionHeight - scaledHeight) / 2;

      // Draw image
      ctx.drawImage(img, imageX, imageY, scaledWidth, scaledHeight);

      // Draw image label (1a, 1b, etc.)
      const label = getImageLabel(edit.number, j);
      ctx.fillStyle = 'rgba(124, 58, 237, 0.9)'; // purple with transparency
      ctx.fillRect(imageX, imageY, 30, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(label, imageX + 4, imageY + 4);

      imageX += scaledWidth + GAP_BETWEEN_IMAGES;
    }

    currentY += sectionHeight;

    // Draw separator line (except after last section)
    if (i < editImageData.length - 1) {
      ctx.fillStyle = '#7c3aed'; // purple-600
      ctx.fillRect(0, currentY, canvas.width, LINE_HEIGHT);
      currentY += LINE_HEIGHT;
    }
  }

  // Export as PNG
  const dataUrl = canvas.toDataURL('image/png');

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
    editCount: editImageData.length,
    imageCount: editImageData.reduce((sum, e) => sum + e.images.length, 0)
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface VibeCoderNotepadProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VibeCoderNotepad: React.FC<VibeCoderNotepadProps> = ({ isOpen, onClose }) => {
  const [state, setState] = useState<VibeCoderState>(loadState);
  const [activeTab, setActiveTab] = useState<'edits' | 'index' | 'ideas'>('edits');
  const [expandedEdit, setExpandedEdit] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [consolidatedImage, setConsolidatedImage] = useState<ConsolidatedImage | null>(null);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  // Save state on change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Clear consolidated image when edits change
  useEffect(() => {
    setConsolidatedImage(null);
  }, [state.edits]);

  // Show notification
  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle paste (for images)
  const handlePaste = useCallback((e: ClipboardEvent, editId?: string) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;

        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;

          if (editId) {
            // Add to specific edit
            setState(prev => ({
              ...prev,
              edits: prev.edits.map(edit => {
                if (edit.id === editId) {
                  const newImage: EditImage = {
                    id: generateId(),
                    dataUrl,
                    timestamp: Date.now()
                  };
                  return { ...edit, images: [...edit.images, newImage] };
                }
                return edit;
              })
            }));
          } else {
            // Create new edit with image
            addNewEdit('', '', [{ id: generateId(), dataUrl, timestamp: Date.now() }]);
          }
          showNotification('Image added!');
        };
        reader.readAsDataURL(blob);
        break; // Only handle first image
      }
    }
  }, []);

  // Global paste listener
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (isOpen && !expandedEdit) {
        handlePaste(e);
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [isOpen, expandedEdit, handlePaste]);

  // Add new edit
  const addNewEdit = (title: string = '', description: string = '', images: EditImage[] = []) => {
    const pendingEdits = state.edits.filter(e => e.status === 'pending');
    const newEdit: Edit = {
      id: generateId(),
      number: pendingEdits.length + 1,
      title,
      description,
      images,
      tags: autoTag(title, description),
      status: 'pending',
      createdAt: Date.now()
    };
    setState(prev => ({ ...prev, edits: [...prev.edits, newEdit] }));
    setExpandedEdit(newEdit.id);
  };

  // Update edit
  const updateEdit = (editId: string, updates: Partial<Edit>) => {
    setState(prev => ({
      ...prev,
      edits: prev.edits.map(edit => {
        if (edit.id === editId) {
          const updated = { ...edit, ...updates };
          // Re-generate tags if title/description changed
          if (updates.title !== undefined || updates.description !== undefined) {
            updated.tags = autoTag(updated.title, updated.description);
          }
          return updated;
        }
        return edit;
      })
    }));
  };

  // Delete edit
  const deleteEdit = (editId: string) => {
    setState(prev => ({
      ...prev,
      edits: prev.edits.filter(e => e.id !== editId)
    }));
  };

  // Remove image from edit
  const removeImage = (editId: string, imageId: string) => {
    setState(prev => ({
      ...prev,
      edits: prev.edits.map(edit => {
        if (edit.id === editId) {
          return { ...edit, images: edit.images.filter(img => img.id !== imageId) };
        }
        return edit;
      })
    }));
  };

  // Generate markdown for Claude
  const generateMarkdown = (edits: Edit[]): string => {
    let md = '# Edits to Make\n\n';

    edits.forEach((edit, idx) => {
      md += `## Edit ${edit.number}: ${edit.title || 'Untitled'}\n`;
      if (edit.description) {
        md += `${edit.description}\n`;
      }
      if (edit.images.length > 0) {
        const labels = edit.images.map((_, i) => getImageLabel(edit.number, i));
        md += `[Images: ${labels.join(', ')}]\n`;
      }
      if (edit.tags.length > 0) {
        md += `Tags: ${edit.tags.join(', ')}\n`;
      }
      md += '\n---\n\n';
    });

    return md;
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification('Copied to clipboard!');
    } catch (e) {
      console.error('Failed to copy:', e);
      showNotification('Failed to copy');
    }
  };

  // Paste image from clipboard using Clipboard API (for button click)
  const pasteImageFromClipboard = async (editId?: string) => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              if (editId) {
                // Add to specific edit
                setState(prev => ({
                  ...prev,
                  edits: prev.edits.map(edit => {
                    if (edit.id === editId) {
                      return {
                        ...edit,
                        images: [...edit.images, { id: generateId(), dataUrl, timestamp: Date.now() }]
                      };
                    }
                    return edit;
                  })
                }));
              } else {
                // Create new edit with image
                addNewEdit('', '', [{ id: generateId(), dataUrl, timestamp: Date.now() }]);
              }
              showNotification('Image pasted!');
            };
            reader.readAsDataURL(blob);
            return; // Only handle first image
          }
        }
      }
      showNotification('No image in clipboard');
    } catch (e) {
      console.error('Failed to paste from clipboard:', e);
      showNotification('Could not access clipboard. Try Ctrl+V instead.');
    }
  };

  // Copy batch for Claude
  const copyBatchForClaude = (useConsolidated: boolean = false) => {
    const pendingEdits = state.edits.filter(e => e.status === 'pending');
    const markdown = generateMarkdown(pendingEdits);

    let message = markdown;

    const totalImages = countImages(pendingEdits);
    if (totalImages > 0) {
      if (useConsolidated && consolidatedImage) {
        message += `\n> ONE consolidated image attached - sections numbered to match edits above.\n`;
      } else {
        message += `\n> Attach ${totalImages} image(s) after pasting this text.\n`;
      }
    }

    copyToClipboard(message);

    // Mark as submitted
    setState(prev => ({
      ...prev,
      edits: prev.edits.map(edit => {
        if (edit.status === 'pending') {
          return { ...edit, status: 'submitted', submittedAt: Date.now() };
        }
        return edit;
      })
    }));
  };

  // Generate consolidated image
  const handleConsolidate = async () => {
    const pendingEdits = state.edits.filter(e => e.status === 'pending');
    if (pendingEdits.length === 0) {
      showNotification('No edits with images to consolidate');
      return;
    }

    setIsConsolidating(true);
    try {
      const result = await createConsolidatedImage(pendingEdits);
      if (result) {
        setConsolidatedImage(result);
        showNotification(`Consolidated ${result.imageCount} images from ${result.editCount} edits!`);
      } else {
        showNotification('No images to consolidate');
      }
    } catch (e) {
      console.error('Consolidation error:', e);
      showNotification('Failed to consolidate images');
    } finally {
      setIsConsolidating(false);
    }
  };

  // Download consolidated image
  const downloadConsolidatedImage = () => {
    if (!consolidatedImage) return;

    const link = document.createElement('a');
    link.href = consolidatedImage.dataUrl;
    link.download = `edits-consolidated-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Image downloaded!');
  };

  // Copy consolidated image to clipboard
  const copyConsolidatedImage = async () => {
    if (!consolidatedImage) return;

    try {
      // Convert data URL to blob
      const response = await fetch(consolidatedImage.dataUrl);
      const blob = await response.blob();

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      showNotification('Image copied to clipboard!');
    } catch (e) {
      console.error('Failed to copy image:', e);
      showNotification('Copy failed - use download instead');
    }
  };

  // Add to codebase index
  const addToIndex = (entry: Omit<CodebaseIndexEntry, 'lastEditDate'>) => {
    setState(prev => ({
      ...prev,
      codebaseIndex: [
        ...prev.codebaseIndex.filter(e => e.filePath !== entry.filePath || e.lineRange !== entry.lineRange),
        { ...entry, lastEditDate: Date.now() }
      ]
    }));
  };

  // Render
  if (!isOpen) return null;

  const pendingEdits = state.edits.filter(e => e.status === 'pending');
  const { batch, remaining } = getEditsBatch(pendingEdits);
  const totalPendingImages = countImages(pendingEdits);

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-slate-900 border-l-2 border-purple-500 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-4 border-b border-purple-500/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-8 h-8 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <div>
              <h2 className="text-white font-bold">VibeCoder Notepad</h2>
              <p className="text-purple-300 text-xs">{pendingEdits.length} pending edits</p>
            </div>
          </div>
          <button onClick={onClose} className="text-purple-300 hover:text-white p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-3">
          {(['edits', 'index', 'ideas'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                activeTab === tab
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-900/50 text-purple-300 hover:bg-purple-800'
              }`}
            >
              {tab === 'edits' && 'Edits'}
              {tab === 'index' && 'Index'}
              {tab === 'ideas' && 'Ideas'}
            </button>
          ))}
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {notification}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activeTab === 'edits' && (
          <>
            {/* Quick Add */}
            <div className="flex gap-2">
              <button
                onClick={() => addNewEdit()}
                className="flex-1 py-3 border-2 border-dashed border-purple-500/50 rounded-lg text-purple-400 hover:border-purple-500 hover:text-purple-300 transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                + New Edit
              </button>
              <button
                onClick={() => pasteImageFromClipboard()}
                className="px-4 py-3 border-2 border-dashed border-green-500/50 rounded-lg text-green-400 hover:border-green-500 hover:text-green-300 transition flex items-center justify-center gap-2"
                title="Paste image from clipboard (or use Ctrl+V)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Paste Image
              </button>
            </div>

            {/* Edit Cards */}
            {pendingEdits.map((edit, idx) => (
              <div
                key={edit.id}
                className={`bg-slate-800 rounded-lg border overflow-hidden transition ${
                  batch.includes(edit) ? 'border-green-500' : 'border-slate-700'
                }`}
              >
                {/* Card Header */}
                <div
                  onClick={() => setExpandedEdit(expandedEdit === edit.id ? null : edit.id)}
                  className="p-3 cursor-pointer hover:bg-slate-700/50 flex items-start gap-3"
                >
                  <span className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {edit.number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={edit.title}
                      onChange={(e) => updateEdit(edit.id, { title: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Edit title..."
                      className="w-full bg-transparent text-white font-medium text-sm focus:outline-none"
                    />
                    <div className="flex items-center gap-2 mt-1">
                      {edit.images.length > 0 && (
                        <span className="text-xs text-purple-400">📷 {edit.images.length}</span>
                      )}
                      {edit.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteEdit(edit.id); }}
                    className="text-slate-500 hover:text-red-400 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Expanded Content */}
                {expandedEdit === edit.id && (
                  <div className="border-t border-slate-700 p-3 space-y-3">
                    {/* Description */}
                    <textarea
                      value={edit.description}
                      onChange={(e) => updateEdit(edit.id, { description: e.target.value })}
                      placeholder="Describe the edit..."
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm resize-none focus:outline-none focus:border-purple-500"
                      rows={3}
                    />

                    {/* Images */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">Images</span>
                        <button
                          onClick={() => pasteImageFromClipboard(edit.id)}
                          className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Paste to add
                        </button>
                      </div>
                      <div
                        ref={pasteAreaRef}
                        onPaste={(e) => handlePaste(e.nativeEvent, edit.id)}
                        className="grid grid-cols-3 gap-2 min-h-[60px] p-2 border border-dashed border-slate-600 rounded cursor-pointer hover:border-green-500/50"
                        onClick={() => pasteImageFromClipboard(edit.id)}
                        title="Click to paste image or use Ctrl+V"
                      >
                        {edit.images.map((img, imgIdx) => (
                          <div key={img.id} className="relative group">
                            <img
                              src={img.dataUrl}
                              alt={`${edit.number}${String.fromCharCode(97 + imgIdx)}`}
                              className="w-full h-16 object-cover rounded border border-slate-600"
                            />
                            <span className="absolute top-0 left-0 bg-purple-600 text-white text-[10px] px-1 rounded-br">
                              {getImageLabel(edit.number, imgIdx)}
                            </span>
                            <button
                              onClick={() => removeImage(edit.id, img.id)}
                              className="absolute top-0 right-0 bg-red-600 text-white text-xs w-4 h-4 rounded-bl opacity-0 group-hover:opacity-100 transition"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {edit.images.length === 0 && (
                          <div className="col-span-3 text-center text-slate-500 text-xs py-4">
                            Paste screenshots here
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Breadcrumb Fields */}
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={edit.filesPaths?.join(', ') || ''}
                        onChange={(e) => updateEdit(edit.id, { filesPaths: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        placeholder="File path(s): src/components/Example.tsx"
                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-300 text-xs focus:outline-none focus:border-purple-500"
                      />
                      <input
                        type="text"
                        value={edit.lineRanges?.join(', ') || ''}
                        onChange={(e) => updateEdit(edit.id, { lineRanges: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        placeholder="Line range(s): 52-60, 100-120"
                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-300 text-xs focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {pendingEdits.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <p className="text-4xl mb-2">📋</p>
                <p>No edits yet</p>
                <p className="text-xs mt-1">Click "New Edit" or paste a screenshot</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'index' && (
          <div className="space-y-3">
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">
                Codebase Index
              </h3>
              <p className="text-xs text-slate-400 mb-3">
                Breadcrumb trail of edits. Helps future sessions navigate faster.
              </p>

              {state.codebaseIndex.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">
                  Index builds automatically as you complete edits with file paths.
                </p>
              ) : (
                <div className="space-y-2">
                  {state.codebaseIndex.map((entry, idx) => (
                    <div key={idx} className="bg-slate-900 rounded p-2 text-xs">
                      <div className="text-purple-400 font-mono">{entry.filePath}</div>
                      {entry.lineRange && (
                        <div className="text-slate-500">Lines: {entry.lineRange}</div>
                      )}
                      <div className="text-slate-400">{entry.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Export Index */}
            <button
              onClick={() => {
                const indexMd = state.codebaseIndex.map(e =>
                  `- **${e.filePath}**${e.lineRange ? ` (${e.lineRange})` : ''}: ${e.description}`
                ).join('\n');
                copyToClipboard(`## Codebase Index\n\n${indexMd}`);
              }}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm transition"
            >
              Copy Index as Markdown
            </button>
          </div>
        )}

        {activeTab === 'ideas' && (
          <div className="text-center py-8 text-slate-500">
            <svg className="w-12 h-12 mx-auto mb-2 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p>Future feature: Capture ideas for other projects</p>
            <p className="text-xs mt-1">Coming when this becomes a full SaaS</p>
          </div>
        )}
      </div>

      {/* Footer - Submit Section */}
      {activeTab === 'edits' && pendingEdits.length > 0 && (
        <div className="border-t border-slate-700 p-3 bg-slate-800/50 space-y-3">
          {/* Stats */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {pendingEdits.length} edit(s), {totalPendingImages} image(s)
            </span>
            {totalPendingImages > 5 && !consolidatedImage && (
              <span className="text-amber-400">⚠️ Over 5 images - consolidate!</span>
            )}
          </div>

          {/* Consolidated Image Preview */}
          {consolidatedImage && (
            <div className="bg-slate-900 rounded-lg p-2 border border-green-500/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-green-400 font-medium">
                  ✓ Consolidated: {consolidatedImage.editCount} edits, {consolidatedImage.imageCount} images
                </span>
                <button
                  onClick={() => setConsolidatedImage(null)}
                  className="text-slate-500 hover:text-red-400 text-xs"
                >
                  ✕
                </button>
              </div>
              <img
                src={consolidatedImage.dataUrl}
                alt="Consolidated preview"
                className="w-full max-h-32 object-contain rounded border border-slate-700"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={copyConsolidatedImage}
                  className="flex-1 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-medium transition"
                >
                  Copy Image
                </button>
                <button
                  onClick={downloadConsolidatedImage}
                  className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition"
                >
                  Download
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {/* Consolidate Button */}
            {totalPendingImages > 0 && (
              <button
                onClick={handleConsolidate}
                disabled={isConsolidating}
                className={`flex-1 py-2 rounded font-medium text-sm transition flex items-center justify-center gap-2 ${
                  consolidatedImage
                    ? 'bg-green-700 hover:bg-green-600 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                {isConsolidating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {consolidatedImage ? 'Reconsolidate' : 'Consolidate Images'}
                  </>
                )}
              </button>
            )}

            {/* Copy Text Button */}
            <button
              onClick={() => copyBatchForClaude(!!consolidatedImage)}
              className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium text-sm transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy Text
            </button>
          </div>

          {/* Instructions */}
          <p className="text-[10px] text-slate-500 text-center">
            {consolidatedImage
              ? '1. Copy text → 2. Paste in Claude → 3. Drag/paste consolidated image'
              : '1. Consolidate images → 2. Copy text → 3. Paste both in Claude'}
          </p>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TOGGLE BUTTON (for adding to any app)
// ═══════════════════════════════════════════════════════════════════════════

export const VibeCoderToggle: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 w-14 h-14 bg-purple-600 hover:bg-purple-500 text-white rounded-full shadow-lg z-40 flex items-center justify-center transition-transform hover:scale-110"
        title="VibeCoder Notepad"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        )}
      </button>

      {/* Notepad Panel */}
      <VibeCoderNotepad isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export default VibeCoderNotepad;
