/**
 * TestingSlotsSelector Component
 *
 * Horizontal tab bar for switching between Main (Live) prompts and Testing Slots.
 * Supports create, rename, duplicate, delete, and promote-to-main operations.
 *
 * Placed above prompt areas in ImageCreationSection to allow testing
 * prompt variations without affecting live/main prompts.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// ---- Types (mirrored from ImageCreationSection) ----

interface PlaceholderOption {
  id: string;
  text: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
}

interface PlaceholderCategory {
  id: string;
  name: string;
  placeholder: string;
  options: PlaceholderOption[];
  isRandomized?: boolean;
  enabled?: boolean;
  scope?: 'unique' | 'persistent';
}

interface TagBasedRule {
  id: string;
  tag: string;
  title: string;
  text: string;
  order: number;
  globalAppliesTo?: string[];
  appliesTo?: string[];
  createdAt: string;
  updatedAt: string;
}

interface GuidedGptPrompt {
  id: string;
  tag: string;
  name: string;
  model: string;
  guidance: string;
  guardrails: {
    instructions: string;
    uniformDescription: string;
    stylePreferences: string;
    avoidList: string;
    defaultSubject: string;
  };
  globalAppliesTo?: string[];
  createdAt: string;
  updatedAt: string;
}

interface SmartPromptPrompt {
  id: string;
  tag: string;
  name: string;
  guidance: string;
  globalAppliesTo?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TestingSlotContent {
  mainPrompt?: string;
  placeholderCategories?: PlaceholderCategory[];
  guidedPrompt?: string;
  guidedGuardrails?: {
    instructions: string;
    uniformDescription: string;
    stylePreferences: string;
    avoidList: string;
    defaultSubject: string;
  } | null;
  smartPromptGuidance?: string;
  guidedRules?: TagBasedRule[];
  legacyRules?: TagBasedRule[];
  guidedGptPrompts?: GuidedGptPrompt[];
  smartPromptPrompts?: SmartPromptPrompt[];
  matchingRules?: {
    rule1?: string;
    rule2?: string;
    rule3?: string;
    rule4?: string;
    placement?: string;
    smart?: string;
  };
  mainPromptPersistent?: string;
  guidedInstructionsPersistent?: string;
  smartPromptPersistent?: string;
}

export interface TestingSlot {
  id: string;
  number: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastEditedBy?: string;
  content: TestingSlotContent;
}

// ---- Props ----

interface TestingSlotsSelectorProps {
  slots: TestingSlot[];
  activeSlotId: string | null; // null = Main/Live
  onSlotsChange: (slots: TestingSlot[]) => void;
  onActiveSlotChange: (slotId: string | null) => void;
  onPromoteToMain: (slot: TestingSlot) => void;
  // For "Duplicate from Main" - provide current main content
  getMainContent: () => TestingSlotContent;
}

// ---- Helpers ----

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

function getNextSlotNumber(slots: TestingSlot[]): number {
  if (slots.length === 0) return 1;
  return Math.max(...slots.map(s => s.number)) + 1;
}

// ---- Component ----

export default function TestingSlotsSelector({
  slots,
  activeSlotId,
  onSlotsChange,
  onActiveSlotChange,
  onPromoteToMain,
  getMainContent,
}: TestingSlotsSelectorProps) {
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showPromoteConfirm, setShowPromoteConfirm] = useState<string | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState<string | null>(null); // source slot ID or 'main'
  const [contextMenuSlotId, setContextMenuSlotId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  // Form states
  const [newSlotName, setNewSlotName] = useState('');
  const [copyFromMain, setCopyFromMain] = useState(false);
  const [renameName, setRenameName] = useState('');

  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenuSlotId) return;
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuSlotId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenuSlotId]);

  // ---- Slot Operations ----

  const handleCreateSlot = useCallback(() => {
    const name = newSlotName.trim() || `Test ${getNextSlotNumber(slots)}`;
    const now = new Date().toISOString();
    const newSlot: TestingSlot = {
      id: generateId(),
      number: getNextSlotNumber(slots),
      name,
      createdAt: now,
      updatedAt: now,
      createdBy: 'user',
      content: copyFromMain ? { ...getMainContent() } : {},
    };
    onSlotsChange([...slots, newSlot]);
    onActiveSlotChange(newSlot.id);
    setShowCreateDialog(false);
    setNewSlotName('');
    setCopyFromMain(false);
  }, [slots, newSlotName, copyFromMain, onSlotsChange, onActiveSlotChange, getMainContent]);

  const handleRenameSlot = useCallback(() => {
    if (!showRenameDialog) return;
    const name = renameName.trim();
    if (!name) return;
    const updated = slots.map(s =>
      s.id === showRenameDialog ? { ...s, name, updatedAt: new Date().toISOString() } : s
    );
    onSlotsChange(updated);
    setShowRenameDialog(null);
    setRenameName('');
  }, [showRenameDialog, renameName, slots, onSlotsChange]);

  const handleDeleteSlot = useCallback(() => {
    if (!showDeleteConfirm) return;
    const updated = slots.filter(s => s.id !== showDeleteConfirm);
    // Renumber remaining slots
    const renumbered = updated.map((s, i) => ({ ...s, number: i + 1 }));
    onSlotsChange(renumbered);
    // If we deleted the active slot, switch to Main
    if (activeSlotId === showDeleteConfirm) {
      onActiveSlotChange(null);
    }
    setShowDeleteConfirm(null);
  }, [showDeleteConfirm, slots, activeSlotId, onSlotsChange, onActiveSlotChange]);

  const handleDuplicateSlot = useCallback(() => {
    if (!showDuplicateDialog) return;
    const sourceContent = showDuplicateDialog === 'main'
      ? getMainContent()
      : slots.find(s => s.id === showDuplicateDialog)?.content || {};
    const now = new Date().toISOString();
    const sourceName = showDuplicateDialog === 'main'
      ? 'Main'
      : slots.find(s => s.id === showDuplicateDialog)?.name || 'Unknown';
    const newSlot: TestingSlot = {
      id: generateId(),
      number: getNextSlotNumber(slots),
      name: `Copy of ${sourceName}`,
      createdAt: now,
      updatedAt: now,
      createdBy: 'user',
      content: { ...sourceContent },
    };
    onSlotsChange([...slots, newSlot]);
    onActiveSlotChange(newSlot.id);
    setShowDuplicateDialog(null);
  }, [showDuplicateDialog, slots, onSlotsChange, onActiveSlotChange, getMainContent]);

  const handlePromoteToMain = useCallback(() => {
    if (!showPromoteConfirm) return;
    const slot = slots.find(s => s.id === showPromoteConfirm);
    if (slot) {
      onPromoteToMain(slot);
      // Switch view back to Main after promote
      onActiveSlotChange(null);
    }
    setShowPromoteConfirm(null);
  }, [showPromoteConfirm, slots, onPromoteToMain, onActiveSlotChange]);

  const handleContextMenu = (e: React.MouseEvent, slotId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuSlotId(slotId);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const openRenameDialog = (slotId: string) => {
    const slot = slots.find(s => s.id === slotId);
    if (slot) {
      setRenameName(slot.name);
      setShowRenameDialog(slotId);
    }
    setContextMenuSlotId(null);
  };

  const activeSlot = activeSlotId ? slots.find(s => s.id === activeSlotId) : null;

  // ---- Render ----

  return (
    <>
      {/* Slot Selector Tab Bar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 mb-3 overflow-x-auto">
        {/* Main (Live) tab - always first */}
        <button
          onClick={() => onActiveSlotChange(null)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all ${
            !activeSlotId
              ? 'bg-slate-700 text-green-400 border-l-2 border-green-400'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>
          Main (Live)
        </button>

        {/* Divider */}
        {slots.length > 0 && (
          <div className="w-px h-5 bg-slate-600 mx-1"></div>
        )}

        {/* Test slot tabs */}
        {slots.map((slot) => (
          <button
            key={slot.id}
            onClick={() => onActiveSlotChange(slot.id)}
            onContextMenu={(e) => handleContextMenu(e, slot.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all group ${
              activeSlotId === slot.id
                ? 'bg-slate-700 text-orange-400 border-l-2 border-orange-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
            title={`Test ${slot.number}: ${slot.name} — Right-click for options`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block"></span>
            Test {slot.number}: {slot.name.length > 20 ? slot.name.slice(0, 20) + '...' : slot.name}
            {/* Inline menu button */}
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleContextMenu(e, slot.id);
              }}
              className="ml-1 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              &#x22EE;
            </span>
          </button>
        ))}

        {/* Add new slot button */}
        {slots.length < 6 && (
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-slate-500 hover:text-brand-cyan hover:bg-slate-700/50 transition-all"
            title="Create new test slot"
          >
            <span className="text-base leading-none">+</span>
          </button>
        )}
      </div>

      {/* Active test slot banner */}
      {activeSlot && (
        <div className="flex items-center justify-between px-3 py-2 mb-3 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-300 text-xs">
          <span>
            Viewing <strong>Test Slot {activeSlot.number}: &ldquo;{activeSlot.name}&rdquo;</strong> &mdash; changes here don&apos;t affect your live prompts
          </span>
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            <button
              onClick={() => setShowPromoteConfirm(activeSlot.id)}
              className="px-2 py-1 bg-orange-500/20 hover:bg-orange-500/30 rounded text-orange-200 transition-colors"
            >
              Promote to Main
            </button>
            <button
              onClick={() => onActiveSlotChange(null)}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
            >
              Back to Main
            </button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenuSlotId && createPortal(
        <div
          ref={contextMenuRef}
          className="fixed z-[9999] bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[180px]"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
        >
          <button
            onClick={() => openRenameDialog(contextMenuSlotId)}
            className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Rename
          </button>
          <button
            onClick={() => {
              setShowDuplicateDialog(contextMenuSlotId);
              setContextMenuSlotId(null);
            }}
            className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Duplicate
          </button>
          <button
            onClick={() => {
              setShowDuplicateDialog('main');
              setContextMenuSlotId(null);
            }}
            className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Duplicate from Main
          </button>
          <div className="border-t border-slate-700 my-1"></div>
          <button
            onClick={() => {
              setShowPromoteConfirm(contextMenuSlotId);
              setContextMenuSlotId(null);
            }}
            className="w-full text-left px-3 py-2 text-xs text-green-400 hover:bg-slate-700"
          >
            Promote to Main
          </button>
          <div className="border-t border-slate-700 my-1"></div>
          <button
            onClick={() => {
              setShowDeleteConfirm(contextMenuSlotId);
              setContextMenuSlotId(null);
            }}
            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-slate-700"
          >
            Delete
          </button>
        </div>,
        document.body
      )}

      {/* Create Dialog */}
      {showCreateDialog && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 w-[380px] shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-3">Create Test Slot</h3>
            <input
              type="text"
              value={newSlotName}
              onChange={(e) => setNewSlotName(e.target.value)}
              placeholder={`Test ${getNextSlotNumber(slots)}`}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:border-brand-cyan focus:outline-none mb-3"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSlot()}
            />
            <label className="flex items-center gap-2 text-xs text-slate-400 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={copyFromMain}
                onChange={(e) => setCopyFromMain(e.target.checked)}
                className="rounded border-slate-600"
              />
              Copy current Main content into this slot
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowCreateDialog(false); setNewSlotName(''); setCopyFromMain(false); }}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSlot}
                className="px-3 py-1.5 text-xs bg-brand-cyan text-white rounded hover:bg-brand-cyan/80"
              >
                Create
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Rename Dialog */}
      {showRenameDialog && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 w-[380px] shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-3">Rename Test Slot</h3>
            <input
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="Enter new name"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:border-brand-cyan focus:outline-none mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleRenameSlot()}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowRenameDialog(null); setRenameName(''); }}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSlot}
                className="px-3 py-1.5 text-xs bg-brand-cyan text-white rounded hover:bg-brand-cyan/80"
              >
                Rename
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 w-[400px] shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-2">Delete Test Slot?</h3>
            <p className="text-xs text-slate-400 mb-4">
              This test slot and all its content will be deleted. Versions saved to history are preserved.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSlot}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Promote Confirmation */}
      {showPromoteConfirm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 w-[440px] shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-2">Promote to Main?</h3>
            <p className="text-xs text-slate-400 mb-1">
              This will replace your live prompts with the content from <strong className="text-orange-300">
                Test {slots.find(s => s.id === showPromoteConfirm)?.number}: &ldquo;{slots.find(s => s.id === showPromoteConfirm)?.name}&rdquo;
              </strong>.
            </p>
            <p className="text-xs text-green-400/70 mb-4">
              A backup of your current Main will be saved automatically to version history.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPromoteConfirm(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handlePromoteToMain}
                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-500"
              >
                Promote
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Duplicate Dialog */}
      {showDuplicateDialog && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 w-[400px] shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-2">Duplicate Slot</h3>
            <p className="text-xs text-slate-400 mb-4">
              A new test slot will be created with a copy of {showDuplicateDialog === 'main'
                ? 'your Main (Live) content'
                : `"${slots.find(s => s.id === showDuplicateDialog)?.name}" content`
              }.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDuplicateDialog(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDuplicateSlot}
                className="px-3 py-1.5 text-xs bg-brand-cyan text-white rounded hover:bg-brand-cyan/80"
              >
                Duplicate
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
