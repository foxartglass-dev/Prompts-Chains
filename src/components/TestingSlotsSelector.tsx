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
    rule1_title?: string;
    rule2?: string;
    rule2_title?: string;
    rule3?: string;
    rule3_title?: string;
    rule4?: string;
    rule4_title?: string;
    placement?: string;
    smart?: string;
  };
  mainPromptPersistent?: string;
  guidedInstructionsPersistent?: string;
  smartPromptPersistent?: string;
  // Test run results
  testResults?: Array<{
    id: string;
    timestamp: string;
    articleContent: string;
    keyword: string;
    tag: string;
    model: string;
  }>;
  // Test images generated during testing
  testImages?: Array<{
    id: string;
    url: string;
    timestamp: string;
    number: number;
    projectName?: string;
    createdBy?: string;
    prompt?: string;
    model?: string;
  }>;
}

export interface TestingSlotProject {
  id: string;
  name: string;
  createdAt: string;
  color?: string; // Optional color for visual grouping
}

export interface TestingSlot {
  id: string;
  number: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastEditedBy?: string;
  projectId?: string; // Optional project grouping
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
  // Project management
  projects?: TestingSlotProject[];
  onProjectsChange?: (projects: TestingSlotProject[]) => void;
  // Run test callback
  onRunTest?: () => void;
  testRunning?: boolean;
  // Username system
  usernames?: string[];
  onUsernamesChange?: (usernames: string[]) => void;
}

const MAX_SLOTS = 20;
const PROJECT_COLORS = ['orange', 'blue', 'purple', 'pink', 'teal', 'yellow', 'red', 'emerald'] as const;

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
  projects = [],
  onProjectsChange,
  onRunTest,
  testRunning = false,
  usernames = [],
  onUsernamesChange,
}: TestingSlotsSelectorProps) {
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showPromoteConfirm, setShowPromoteConfirm] = useState<string | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState<string | null>(null); // source slot ID or 'main'
  const [contextMenuSlotId, setContextMenuSlotId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [activeProjectFilter, setActiveProjectFilter] = useState<string | null>(null); // null = show all
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffActiveTab, setDiffActiveTab] = useState('mainPrompt');

  // Form states
  const [newSlotName, setNewSlotName] = useState('');
  const [copyFromMain, setCopyFromMain] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newSlotProjectId, setNewSlotProjectId] = useState<string>('');
  const [newSlotUsername, setNewSlotUsername] = useState<string>('');
  const [addingUsername, setAddingUsername] = useState(false);
  const [newUsernameInput, setNewUsernameInput] = useState('');

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
      createdBy: newSlotUsername || 'user',
      projectId: newSlotProjectId || undefined,
      content: copyFromMain ? { ...getMainContent() } : {},
    };
    onSlotsChange([...slots, newSlot]);
    onActiveSlotChange(newSlot.id);
    setShowCreateDialog(false);
    setNewSlotName('');
    setCopyFromMain(false);
    setNewSlotProjectId('');
  }, [slots, newSlotName, copyFromMain, newSlotProjectId, newSlotUsername, onSlotsChange, onActiveSlotChange, getMainContent]);

  const handleCreateProject = useCallback(() => {
    const name = newProjectName.trim();
    if (!name || !onProjectsChange) return;
    const newProject: TestingSlotProject = {
      id: generateId(),
      name,
      createdAt: new Date().toISOString(),
      color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
    };
    onProjectsChange([...projects, newProject]);
    setNewProjectName('');
    setShowProjectDialog(false);
  }, [newProjectName, projects, onProjectsChange]);

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

  // Filter slots by active project
  const filteredSlots = activeProjectFilter
    ? slots.filter(s => s.projectId === activeProjectFilter)
    : slots;

  // Get project for a slot
  const getProjectForSlot = (slot: TestingSlot) =>
    slot.projectId ? projects.find(p => p.id === slot.projectId) : null;

  // ---- Render ----

  return (
    <>
      {/* Project Filter Bar */}
      {projects.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1.5 mb-1 overflow-x-auto">
          <span className="text-[10px] text-slate-500 mr-1">Projects:</span>
          <button
            onClick={() => setActiveProjectFilter(null)}
            className={`px-2 py-0.5 text-[10px] rounded-full transition ${
              !activeProjectFilter
                ? 'bg-slate-600 text-white font-medium'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            All ({slots.length})
          </button>
          {projects.map(project => {
            const count = slots.filter(s => s.projectId === project.id).length;
            return (
              <button
                key={project.id}
                onClick={() => setActiveProjectFilter(activeProjectFilter === project.id ? null : project.id)}
                className={`px-2 py-0.5 text-[10px] rounded-full transition ${
                  activeProjectFilter === project.id
                    ? 'bg-orange-600 text-white font-medium'
                    : 'bg-slate-800 text-orange-400/70 hover:bg-slate-700 hover:text-orange-300'
                }`}
              >
                {project.name} ({count})
              </button>
            );
          })}
          <button
            onClick={() => setShowProjectDialog(true)}
            className="px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-brand-cyan transition"
            title="Create new project"
          >
            + Project
          </button>
        </div>
      )}

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
        {filteredSlots.length > 0 && (
          <div className="w-px h-5 bg-slate-600 mx-1"></div>
        )}

        {/* Test slot tabs */}
        {filteredSlots.map((slot) => {
          const project = getProjectForSlot(slot);
          return (
            <button
              key={slot.id}
              onClick={() => onActiveSlotChange(slot.id)}
              onContextMenu={(e) => handleContextMenu(e, slot.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all group ${
                activeSlotId === slot.id
                  ? 'bg-slate-700 text-orange-400 border-l-2 border-orange-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
              title={`Test ${slot.number}: ${slot.name}${project ? ` (${project.name})` : ''}${slot.createdBy && slot.createdBy !== 'user' ? ` by ${slot.createdBy}` : ''} — ${new Date(slot.createdAt).toLocaleDateString()} ${new Date(slot.createdAt).toLocaleTimeString()} — Right-click for options`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block"></span>
              {project && <span className="text-[8px] px-1 py-0 rounded bg-orange-500/20 text-orange-300/70">{project.name.slice(0, 8)}</span>}
              {slot.createdBy && slot.createdBy !== 'user' && <span className="text-[8px] px-1 py-0 rounded bg-purple-500/20 text-purple-300/70">{slot.createdBy.slice(0, 6)}</span>}
              T{slot.number}: {slot.name.length > 18 ? slot.name.slice(0, 18) + '...' : slot.name}
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
          );
        })}

        {/* Add new slot button */}
        {slots.length < MAX_SLOTS && (
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-slate-500 hover:text-brand-cyan hover:bg-slate-700/50 transition-all"
            title="Create new test slot"
          >
            <span className="text-base leading-none">+</span>
          </button>
        )}
        {/* No projects yet? Show + Project in tab bar */}
        {projects.length === 0 && onProjectsChange && slots.length > 0 && (
          <button
            onClick={() => setShowProjectDialog(true)}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] text-slate-500 hover:text-purple-400 hover:bg-slate-700/50 transition-all ml-1"
            title="Group slots into projects"
          >
            + Project
          </button>
        )}
        {/* Slot count */}
        <span className="text-[9px] text-slate-600 ml-auto whitespace-nowrap">{slots.length}/{MAX_SLOTS}</span>
      </div>

      {/* Active test slot banner */}
      {activeSlot && (
        <div className="flex items-center justify-between px-3 py-2 mb-3 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-300 text-xs">
          <span>
            {getProjectForSlot(activeSlot) && (
              <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-200 mr-2 text-[10px]">{getProjectForSlot(activeSlot)?.name}</span>
            )}
            Viewing <strong>Test Slot {activeSlot.number}: &ldquo;{activeSlot.name}&rdquo;</strong> &mdash; changes here don&apos;t affect your live prompts
          </span>
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            {onRunTest && (
              <button
                onClick={onRunTest}
                disabled={testRunning}
                className="px-2 py-1 bg-brand-cyan/20 hover:bg-brand-cyan/30 disabled:bg-slate-700 disabled:cursor-not-allowed rounded text-brand-cyan transition-colors flex items-center gap-1"
              >
                {testRunning ? (
                  <><div className="w-3 h-3 border-2 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin"></div> Running...</>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Run Test
                  </>
                )}
              </button>
            )}
            {/* Test results count */}
            {(activeSlot.content?.testResults || []).length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-brand-cyan/20 text-brand-cyan">
                {(activeSlot.content?.testResults || []).length} results
              </span>
            )}
            {/* Created by badge */}
            {activeSlot.createdBy && activeSlot.createdBy !== 'user' && (
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-500/20 text-purple-300">
                {activeSlot.createdBy}
              </span>
            )}
            <button
              onClick={() => { setDiffActiveTab('mainPrompt'); setShowDiffModal(true); }}
              className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 rounded text-blue-300 transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
              Compare to Main
            </button>
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
          {/* Assign to Project */}
          {projects.length > 0 && (
            <>
              <div className="border-t border-slate-700 my-1"></div>
              <div className="px-3 py-1 text-[10px] text-slate-500">Move to Project:</div>
              {projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => {
                    const updated = slots.map(s =>
                      s.id === contextMenuSlotId ? { ...s, projectId: project.id } : s
                    );
                    onSlotsChange(updated);
                    setContextMenuSlotId(null);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 ${
                    slots.find(s => s.id === contextMenuSlotId)?.projectId === project.id
                      ? 'text-orange-400 font-medium' : 'text-slate-300'
                  }`}
                >
                  {project.name} {slots.find(s => s.id === contextMenuSlotId)?.projectId === project.id ? '✓' : ''}
                </button>
              ))}
              <button
                onClick={() => {
                  const updated = slots.map(s =>
                    s.id === contextMenuSlotId ? { ...s, projectId: undefined } : s
                  );
                  onSlotsChange(updated);
                  setContextMenuSlotId(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700"
              >
                No Project
              </button>
            </>
          )}
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
            {/* Project selector */}
            {projects.length > 0 && (
              <select
                value={newSlotProjectId}
                onChange={(e) => setNewSlotProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white mb-3 focus:border-brand-cyan focus:outline-none"
              >
                <option value="">No Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            {/* Username selector */}
            {(usernames.length > 0 || onUsernamesChange) && (
              <div className="mb-3">
                <label className="block text-[10px] text-slate-500 mb-1">Created by</label>
                {!addingUsername ? (
                  <div className="flex gap-2">
                    <select
                      value={newSlotUsername}
                      onChange={(e) => setNewSlotUsername(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">Select user...</option>
                      {usernames.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                    {onUsernamesChange && (
                      <button
                        onClick={() => setAddingUsername(true)}
                        className="px-2 py-1 text-[10px] bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 rounded transition"
                        title="Add new user"
                      >
                        + User
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newUsernameInput}
                      onChange={(e) => setNewUsernameInput(e.target.value)}
                      placeholder="Enter name..."
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newUsernameInput.trim()) {
                          const name = newUsernameInput.trim();
                          if (!usernames.includes(name)) {
                            onUsernamesChange?.([...usernames, name]);
                          }
                          setNewSlotUsername(name);
                          setNewUsernameInput('');
                          setAddingUsername(false);
                        }
                        if (e.key === 'Escape') {
                          setAddingUsername(false);
                          setNewUsernameInput('');
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const name = newUsernameInput.trim();
                        if (name) {
                          if (!usernames.includes(name)) {
                            onUsernamesChange?.([...usernames, name]);
                          }
                          setNewSlotUsername(name);
                        }
                        setNewUsernameInput('');
                        setAddingUsername(false);
                      }}
                      className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-500 transition"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAddingUsername(false); setNewUsernameInput(''); }}
                      className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
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
                onClick={() => { setShowCreateDialog(false); setNewSlotName(''); setCopyFromMain(false); setNewSlotUsername(''); }}
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

      {/* Create Project Dialog */}
      {showProjectDialog && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 w-[380px] shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-2">Create Project</h3>
            <p className="text-xs text-slate-400 mb-3">
              Group test slots by project to organize different testing scenarios (e.g., &ldquo;Janitorial B-Roll&rdquo;, &ldquo;Auto Dealership&rdquo;, &ldquo;Medical Office&rdquo;).
            </p>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
            />
            {/* Existing projects list */}
            {projects.length > 0 && (
              <div className="mb-4">
                <span className="text-[10px] text-slate-500 block mb-1">Existing projects:</span>
                <div className="flex flex-wrap gap-1">
                  {projects.map(p => (
                    <span key={p.id} className="px-2 py-0.5 text-[10px] rounded bg-orange-500/20 text-orange-300">
                      {p.name} ({slots.filter(s => s.projectId === p.id).length} slots)
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowProjectDialog(false); setNewProjectName(''); }}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Diff Preview Modal - Compare Test Slot vs Main */}
      {showDiffModal && activeSlot && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70" onClick={() => setShowDiffModal(false)}>
          <div className="bg-slate-900 border border-slate-600 rounded-xl w-[90vw] max-w-[1200px] h-[80vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-white">Compare to Main</h3>
                <span className="px-2 py-0.5 text-[10px] rounded bg-orange-500/20 text-orange-300">
                  T{activeSlot.number}: {activeSlot.name}
                </span>
                {activeSlot.createdBy && activeSlot.createdBy !== 'user' && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-500/20 text-purple-300">{activeSlot.createdBy}</span>
                )}
                <span className="text-[10px] text-slate-500">
                  {new Date(activeSlot.updatedAt).toLocaleDateString()} {new Date(activeSlot.updatedAt).toLocaleTimeString()}
                </span>
              </div>
              <button onClick={() => setShowDiffModal(false)} className="text-slate-400 hover:text-white transition p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Section Tabs */}
            <div className="flex items-center gap-1 px-5 py-2 border-b border-slate-800 overflow-x-auto">
              {([
                ['mainPrompt', 'Main Prompt'],
                ['categories', 'Categories'],
                ['guidedGuardrails', 'Guided Guardrails'],
                ['guidedRules', 'Guided Rules'],
                ['smartPrompt', 'Smart Prompt'],
                ['persistent', 'Persistent Text'],
                ['matchingRules', 'Matching Rules'],
              ] as [string, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDiffActiveTab(key)}
                  className={`px-3 py-1.5 text-xs rounded whitespace-nowrap transition ${
                    diffActiveTab === key
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {label}
                  {(() => {
                    const mainContent = getMainContent();
                    const slotContent = activeSlot.content || {};
                    let mainVal = '', slotVal = '';
                    if (key === 'mainPrompt') { mainVal = mainContent.mainPrompt || ''; slotVal = slotContent.mainPrompt || ''; }
                    else if (key === 'categories') { mainVal = JSON.stringify(mainContent.placeholderCategories || []); slotVal = JSON.stringify(slotContent.placeholderCategories || []); }
                    else if (key === 'guidedGuardrails') { mainVal = JSON.stringify(mainContent.guidedGuardrails || {}); slotVal = JSON.stringify(slotContent.guidedGuardrails || {}); }
                    else if (key === 'guidedRules') { mainVal = JSON.stringify(mainContent.guidedRules || []); slotVal = JSON.stringify(slotContent.guidedRules || []); }
                    else if (key === 'smartPrompt') { mainVal = mainContent.smartPromptGuidance || ''; slotVal = slotContent.smartPromptGuidance || ''; }
                    else if (key === 'persistent') { mainVal = (mainContent.mainPromptPersistent || '') + (mainContent.guidedInstructionsPersistent || '') + (mainContent.smartPromptPersistent || ''); slotVal = (slotContent.mainPromptPersistent || '') + (slotContent.guidedInstructionsPersistent || '') + (slotContent.smartPromptPersistent || ''); }
                    else if (key === 'matchingRules') { mainVal = JSON.stringify(mainContent.matchingRules || {}); slotVal = JSON.stringify(slotContent.matchingRules || {}); }
                    if (mainVal === slotVal) return <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-400 inline-block" title="Identical"></span>;
                    if (!slotVal || slotVal === '{}' || slotVal === '[]') return <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" title="Empty in slot"></span>;
                    return <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" title="Modified"></span>;
                  })()}
                </button>
              ))}
            </div>

            {/* Diff Content */}
            <div className="flex-1 overflow-auto p-5">
              {(() => {
                const mainContent = getMainContent();
                const slotContent = activeSlot.content || {};

                // Helper to render a side-by-side text diff
                const renderTextDiff = (mainText: string, slotText: string, label: string) => {
                  const isIdentical = mainText === slotText;
                  const mainEmpty = !mainText.trim();
                  const slotEmpty = !slotText.trim();

                  if (isIdentical) {
                    return (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 text-[10px] rounded bg-green-500/20 text-green-400 font-medium">Identical</span>
                          <span className="text-xs text-slate-500">{label}</span>
                        </div>
                        <pre className="text-xs text-slate-400 whitespace-pre-wrap bg-slate-800/50 rounded-lg p-4 border border-slate-700 max-h-[50vh] overflow-auto">{mainText || '(empty)'}</pre>
                      </div>
                    );
                  }

                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-400 font-medium">Modified</span>
                        <span className="text-xs text-slate-500">{label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[10px] text-green-400 font-medium mb-1.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                            Main (Live)
                          </div>
                          <pre className="text-xs whitespace-pre-wrap bg-slate-800/50 rounded-lg p-4 border border-green-500/20 max-h-[50vh] overflow-auto text-slate-300">{mainEmpty ? <span className="text-slate-600 italic">(empty)</span> : mainText}</pre>
                        </div>
                        <div>
                          <div className="text-[10px] text-orange-400 font-medium mb-1.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                            Test Slot T{activeSlot.number}
                          </div>
                          <pre className="text-xs whitespace-pre-wrap bg-slate-800/50 rounded-lg p-4 border border-orange-500/20 max-h-[50vh] overflow-auto text-slate-300">{slotEmpty ? <span className="text-slate-600 italic">(empty)</span> : slotText}</pre>
                        </div>
                      </div>
                    </div>
                  );
                };

                // Helper to render structured data diff (rules, categories, etc.)
                const renderStructuredDiff = (mainData: any[], slotData: any[], label: string, itemLabel: (item: any) => string) => {
                  const mainJson = JSON.stringify(mainData);
                  const slotJson = JSON.stringify(slotData);
                  const isIdentical = mainJson === slotJson;

                  if (isIdentical) {
                    return (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 text-[10px] rounded bg-green-500/20 text-green-400 font-medium">Identical</span>
                          <span className="text-xs text-slate-500">{label} ({mainData.length} items)</span>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 max-h-[50vh] overflow-auto space-y-1">
                          {mainData.length === 0 ? <span className="text-xs text-slate-600 italic">(none)</span> : mainData.map((item, i) => (
                            <div key={i} className="text-xs text-slate-400 py-1 border-b border-slate-700/50 last:border-0">{itemLabel(item)}</div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-400 font-medium">Modified</span>
                        <span className="text-xs text-slate-500">{label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[10px] text-green-400 font-medium mb-1.5">Main (Live) — {mainData.length} items</div>
                          <div className="bg-slate-800/50 rounded-lg p-3 border border-green-500/20 max-h-[50vh] overflow-auto space-y-1">
                            {mainData.length === 0 ? <span className="text-xs text-slate-600 italic">(none)</span> : mainData.map((item, i) => (
                              <div key={i} className="text-xs text-slate-300 py-1 border-b border-slate-700/50 last:border-0">{itemLabel(item)}</div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-orange-400 font-medium mb-1.5">Test Slot T{activeSlot.number} — {slotData.length} items</div>
                          <div className="bg-slate-800/50 rounded-lg p-3 border border-orange-500/20 max-h-[50vh] overflow-auto space-y-1">
                            {slotData.length === 0 ? <span className="text-xs text-slate-600 italic">(none)</span> : slotData.map((item, i) => (
                              <div key={i} className="text-xs text-slate-300 py-1 border-b border-slate-700/50 last:border-0">{itemLabel(item)}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                };

                switch (diffActiveTab) {
                  case 'mainPrompt':
                    return renderTextDiff(mainContent.mainPrompt || '', slotContent.mainPrompt || '', 'Main Prompt');
                  case 'categories':
                    return renderStructuredDiff(
                      mainContent.placeholderCategories || [],
                      slotContent.placeholderCategories || [],
                      'Placeholder Categories',
                      (cat: PlaceholderCategory) => `${cat.placeholder}: ${cat.name} (${cat.options?.length || 0} options${cat.enabled === false ? ', disabled' : ''})`
                    );
                  case 'guidedGuardrails': {
                    const mg = mainContent.guidedGuardrails;
                    const sg = slotContent.guidedGuardrails;
                    const fields = ['instructions', 'uniformDescription', 'stylePreferences', 'avoidList', 'defaultSubject'] as const;
                    return (
                      <div className="space-y-4">
                        {fields.map(field => (
                          <div key={field}>
                            {renderTextDiff(
                              (mg as any)?.[field] || '',
                              (sg as any)?.[field] || '',
                              field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  case 'guidedRules':
                    return renderStructuredDiff(
                      mainContent.guidedRules || [],
                      slotContent.guidedRules || [],
                      'Guided GPT Rules',
                      (rule: TagBasedRule) => `[${rule.tag}] ${rule.title}: ${rule.text.substring(0, 100)}${rule.text.length > 100 ? '...' : ''}`
                    );
                  case 'smartPrompt':
                    return renderTextDiff(mainContent.smartPromptGuidance || '', slotContent.smartPromptGuidance || '', 'Smart Prompt Guidance');
                  case 'persistent':
                    return (
                      <div className="space-y-4">
                        {renderTextDiff(mainContent.mainPromptPersistent || '', slotContent.mainPromptPersistent || '', 'Main Prompt Persistent')}
                        {renderTextDiff(mainContent.guidedInstructionsPersistent || '', slotContent.guidedInstructionsPersistent || '', 'Guided Instructions Persistent')}
                        {renderTextDiff(mainContent.smartPromptPersistent || '', slotContent.smartPromptPersistent || '', 'Smart Prompt Persistent')}
                      </div>
                    );
                  case 'matchingRules': {
                    const mr = mainContent.matchingRules || {};
                    const sr = slotContent.matchingRules || {};
                    const ruleKeys = ['rule1', 'rule2', 'rule3', 'rule4'] as const;
                    return (
                      <div className="space-y-4">
                        {ruleKeys.map(key => (
                          <div key={key}>
                            {renderTextDiff(
                              (mr as any)?.[key] || '',
                              (sr as any)?.[key] || '',
                              `${(mr as any)?.[`${key}_title`] || key.toUpperCase()}`
                            )}
                          </div>
                        ))}
                        {renderTextDiff((mr as any)?.placement || '', (sr as any)?.placement || '', 'Placement')}
                        {renderTextDiff((mr as any)?.smart || '', (sr as any)?.smart || '', 'Smart')}
                      </div>
                    );
                  }
                  default:
                    return <div className="text-slate-500 text-sm">Select a section to compare.</div>;
                }
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
