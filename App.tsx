import React, { useState, useCallback, useRef, useEffect } from 'react';
import useProjectManager, {
  PromptTemplate, Placeholder, TaggedSnippet, Tag, WpContentType, Project, OptionVariable
} from './src/hooks/useProjectManager';
import { generateLlmContent } from './src/services/llm-service';
import { checkAiScore } from './src/services/zerogpt-service';
import { parseCsv, downloadFile, downloadProjectConfig, loadProjectConfigFromFile } from './src/services/file-utils';
import Icon from './src/components/Icon';
import ProjectTracker from './src/components/ProjectTracker';
import PinLock from './src/components/PinLock';
import AgencyManager from './src/components/AgencyManager';
import ArticleManager from './src/components/ArticleManager';
import TemplateLibrary from './src/components/TemplateLibrary';
import WorkflowNavigation from './src/components/WorkflowNavigation';
import ClientsPage from './src/components/ClientsPage';
import WebsitesPage from './src/components/WebsitesPage';
import Analytics from './src/components/Analytics';
import PendingMetaNotification from './src/components/PendingMetaNotification';

// Types for workflow
interface WorkflowItem {
  id: number;
  name: string;
  tag: string | null;
}

enum LogStatus {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  WORKING = 'WORKING',
}

interface LogEntry {
  id: number;
  itemId?: number;
  message: string;
  status: LogStatus;
  timestamp: string;
}

type WpStatus = 'idle' | 'publishing' | 'published' | 'error';

interface Result {
  item: WorkflowItem;
  finalOutput: string;
  metaTitles: string[];
  metaDescriptions: string[];
  aiScore: number;
  wordCount: number;
  status: 'PASSED' | 'FLAGGED';
  timestamp: string;
  jsonContent: string;
  txtContent: string;
  allOutputs: Record<string, string>;
  wpStatus?: WpStatus;
  wpLink?: string;
  wpError?: string;
}

// Option Variable pending selection types
interface OptionSelection {
  variableKey: string;
  options: string[];
  selectedIndex: number | null;  // null = not selected, -1 = custom
  customValue: string;
}

interface PendingResult {
  id: number;
  item: WorkflowItem;
  finalOutput: string;
  metaTitles: string[];
  metaDescriptions: string[];
  allOutputs: Record<string, string>;
  timestamp: string;
  optionSelections: OptionSelection[];
}

// Make JSZip available from the global scope (force rebuild)
declare const JSZip: any;

const App: React.FC = () => {
    // ========== ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL RETURNS ==========

    // PIN Lock State
    const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
      // Check if already unlocked in this session
      return sessionStorage.getItem('pinUnlocked') === 'true';
    });
    const [pinEnabled, setPinEnabled] = useState<boolean | null>(null);

    // UI State for notifications
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

    // Notification helper function (defined early so it can be passed to useProjectManager)
    const showNotification = useCallback((message: string, type: 'success' | 'info' | 'error') => {
        setNotification({ message, type });
    }, []);

    // App State - useProjectManager hook
    const {
      projects,
      currentProject,
      setCurrentProject,
      saveCurrentProject: saveProjectHook,
      createNewProject: createNewProjectHook,
      deleteProject: deleteProjectHook,
      importProject: importProjectHook,
      exportCurrentProject: exportProjectHook,
    } = useProjectManager(showNotification);

    // Workflow items state
    const [items, setItems] = useState<WorkflowItem[]>([]);
    const [manualItems, setManualItems] = useState('');

    // UI State
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [pendingResults, setPendingResults] = useState<PendingResult[]>([]);
    const [fileName, setFileName] = useState('');
    const [openSections, setOpenSections] = useState<Set<string>>(new Set(['setup']));
    const [newTagName, setNewTagName] = useState('');
    const [selectedPlaceholders, setSelectedPlaceholders] = useState<Set<number>>(new Set());
    const [bulkActionTag, setBulkActionTag] = useState('');
    const [isTrackerOpen, setIsTrackerOpen] = useState(false);
    const [isAgencyOpen, setIsAgencyOpen] = useState(false);
    const [isArticlesOpen, setIsArticlesOpen] = useState(false);
    const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
    const [isWorkflowNavOpen, setIsWorkflowNavOpen] = useState(false);
    const [isClientsOpen, setIsClientsOpen] = useState(false);
    const [isWebsitesOpen, setIsWebsitesOpen] = useState(false);
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [currentWorkflowId, setCurrentWorkflowId] = useState<number | undefined>(undefined);
    const [currentWebsiteId, setCurrentWebsiteId] = useState<number | undefined>(undefined);
    const [filterByClientId, setFilterByClientId] = useState<number | undefined>(undefined);
    const [currentWorkflowContext, setCurrentWorkflowContext] = useState<{
      workflowName?: string;
      clientName?: string;
      websiteName?: string;
      projectName?: string;
      isStandalone?: boolean;
    }>({});
    const [variableContextMenu, setVariableContextMenu] = useState<{promptId: number, x: number, y: number} | null>(null);

    // Auto-save state
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);

    // Refs
    const prevProjectIdRef = useRef<string | null>(null);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const draggedPromptId = useRef<number | null>(null);
    const promptTextareaRefs = useRef<{[key: number]: HTMLTextAreaElement | null}>({});

    // useCallback for logging (must be before conditional returns)
    const addLog = useCallback((message: string, status: LogStatus, itemId?: number) => {
        setLogs(prevLogs => {
            const newLog = { id: prevLogs.length, message, status, itemId, timestamp: new Date().toLocaleTimeString() };
            const updatedLogs = [...prevLogs, newLog];
            setTimeout(() => { logContainerRef.current?.scrollTo(0, logContainerRef.current.scrollHeight); }, 0);
            return updatedLogs;
        });
    }, []);

    // Save workflow to database
    const saveWorkflowToDatabase = useCallback(async (showMessage: boolean = true) => {
        if (!currentWorkflowId || !currentProject) return false;

        setIsSaving(true);
        try {
            const response = await fetch(`/api/workflows/${currentWorkflowId}/state`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: currentProject.state })
            });

            if (response.ok) {
                setHasUnsavedChanges(false);
                setLastSaveTime(new Date());
                if (showMessage) {
                    showNotification('Workflow saved!', 'success');
                }
                return true;
            } else {
                if (showMessage) {
                    showNotification('Failed to save workflow', 'error');
                }
                return false;
            }
        } catch (error) {
            console.error('Error saving workflow:', error);
            if (showMessage) {
                showNotification('Failed to save workflow', 'error');
            }
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [currentWorkflowId, currentProject, showNotification]);

    // Mark changes when project state changes (for auto-save)
    const markUnsavedChanges = useCallback(() => {
        if (currentWorkflowId) {
            setHasUnsavedChanges(true);

            // Clear existing timer
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }

            // Only auto-save if enabled
            const autoSaveEnabled = currentProject?.state?.autoSaveEnabled ?? true;
            const autoSaveSeconds = currentProject?.state?.autoSaveSeconds ?? 3;

            if (autoSaveEnabled) {
                autoSaveTimerRef.current = setTimeout(() => {
                    saveWorkflowToDatabase(false); // Silent save
                }, autoSaveSeconds * 1000);
            }
        }
    }, [currentWorkflowId, saveWorkflowToDatabase, currentProject?.state?.autoSaveEnabled, currentProject?.state?.autoSaveSeconds]);

    // ========== ALL useEffect HOOKS ==========

    // Click-away detection for variable context menu
    useEffect(() => {
        const handleClickAway = (e: MouseEvent) => {
            if (variableContextMenu) {
                setVariableContextMenu(null);
            }
        };
        document.addEventListener('click', handleClickAway);
        return () => document.removeEventListener('click', handleClickAway);
    }, [variableContextMenu]);

    // Check if PIN lock is enabled on mount
    useEffect(() => {
      const checkPinConfig = async () => {
        try {
          const response = await fetch('/api/config');
          const data = await response.json();
          setPinEnabled(data.pinEnabled || false);

          // If PIN not enabled, auto-unlock
          if (!data.pinEnabled) {
            setIsUnlocked(true);
          }
        } catch (error) {
          // If can't fetch config, assume no PIN
          setPinEnabled(false);
          setIsUnlocked(true);
        }
      };
      checkPinConfig();
    }, []);

    // Effect to clear notification after a delay
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Effect to reset local workflow state when the project changes
    useEffect(() => {
        if (currentProject) {
            const currentId = currentProject.id;
            const prevId = prevProjectIdRef.current;

            // If the project ID has changed, reset the workspace.
            if (prevId !== null && prevId !== currentId) {
                setItems([]);
                setManualItems('');
                setLogs([]);
                setResults([]);
                setFileName('');
            }

            // Update the ref to the current project's ID for the next render.
            prevProjectIdRef.current = currentId;
        }
    }, [currentProject]);

    // Effect to trigger auto-save when project state changes
    useEffect(() => {
        if (currentWorkflowId && currentProject) {
            markUnsavedChanges();
        }
        // Cleanup timer on unmount
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [currentProject?.state, currentWorkflowId]); // Only trigger on state changes, not on currentProject change

    // ========== CONDITIONAL RETURNS (after all hooks) ==========

    // Show loading state while checking PIN config
    if (pinEnabled === null) {
      return (
        <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
          <div className="text-cyan-400 text-xl">Loading...</div>
        </div>
      );
    }

    // Show PIN lock screen if enabled and not unlocked
    if (pinEnabled && !isUnlocked) {
      return <PinLock onUnlock={() => setIsUnlocked(true)} />;
    }

    // ========== HELPER FUNCTIONS (after conditional returns is OK) ==========

    // Helper function to update the current project's state
    const setCurrentProjectState = (updater: (prevState: Project['state']) => Project['state']) => {
        if (currentProject) {
            setCurrentProject({
                ...currentProject,
                state: updater(currentProject.state)
            });
        }
    };

    const handleSaveProject = () => {
        saveProjectHook();
    };

    const handleCreateNewProject = () => {
        createNewProjectHook();
    };

    const handleDeleteProject = () => {
        if (!currentProject) return;
        if (window.confirm(`Are you sure you want to delete the project "${currentProject.name}"? This cannot be undone.`)) {
            deleteProjectHook(currentProject.id);
        }
    };

    // --- Data Mutation Handlers (Simulating API Calls) ---

    const handleUpdatePrompt = (id: number, field: keyof PromptTemplate, value: any) => {
        setCurrentProjectState(prev => ({
            ...prev,
            promptTemplates: prev.promptTemplates.map(p => p.id === id ? { ...p, [field]: value } : p)
        }));
    };

    const insertVariableIntoPrompt = (promptId: number, variable: string) => {
        const textarea = promptTextareaRefs.current[promptId];
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentValue = textarea.value;

        // Replace selected text or insert at cursor
        const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);

        handleUpdatePrompt(promptId, 'template', newValue);

        // Close context menu if open
        setVariableContextMenu(null);

        // Restore focus and cursor position after the inserted variable
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + variable.length, start + variable.length);
        }, 0);
    };

    const handleAddPrompt = () => {
        const newPrompt: PromptTemplate = { id: Date.now(), name: 'New Prompt', template: '', outputKey: `new_output_${Date.now()}` };
        setCurrentProjectState(prev => ({ ...prev, promptTemplates: [...prev.promptTemplates, newPrompt] }));
    };
    
    const handleDuplicatePrompt = (id: number) => {
        if (!currentProject) return;
        const promptToDuplicate = currentProject.state.promptTemplates.find(p => p.id === id);
        if (!promptToDuplicate) return;
        const newPrompt: PromptTemplate = {
            ...promptToDuplicate,
            id: Date.now(),
            name: `${promptToDuplicate.name} (Copy)`,
            outputKey: `${promptToDuplicate.outputKey}_copy`
        };
        const index = currentProject.state.promptTemplates.findIndex(p => p.id === id);
        const newPrompts = [...currentProject.state.promptTemplates];
        newPrompts.splice(index + 1, 0, newPrompt);
        setCurrentProjectState(prev => ({ ...prev, promptTemplates: newPrompts }));
    };

    const handleDeletePrompt = (id: number) => {
        setCurrentProjectState(prev => ({ ...prev, promptTemplates: prev.promptTemplates.filter(p => p.id !== id) }));
    };

    const handleReorderPrompts = (draggedId: number, targetId: number) => {
        if (!currentProject) return;
        const draggedIndex = currentProject.state.promptTemplates.findIndex(p => p.id === draggedId);
        const targetIndex = currentProject.state.promptTemplates.findIndex(p => p.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return;
        
        const newPrompts = [...currentProject.state.promptTemplates];
        const [draggedItem] = newPrompts.splice(draggedIndex, 1);
        newPrompts.splice(targetIndex, 0, draggedItem);
        setCurrentProjectState(prev => ({ ...prev, promptTemplates: newPrompts }));
    };

    // Sanitize placeholder name: no brackets, spaces become underscores
    const sanitizePlaceholderName = (value: string): string => {
        return value
            .replace(/[{}\[\]<>?:]/g, '') // Remove brackets and special chars
            .replace(/\s+/g, '_') // Spaces to underscores
            .toLowerCase();
    };

    const handleUpdatePlaceholder = (id: number, field: 'key' | 'value' | 'tag', value: string) => {
        const sanitizedValue = field === 'key' ? sanitizePlaceholderName(value) : value;
        setCurrentProjectState(prev => ({
            ...prev,
            placeholders: prev.placeholders.map(p => p.id === id ? { ...p, [field]: sanitizedValue } : p)
        }));
    };

    const handleAddPlaceholder = (tag?: string) => {
        const newPlaceholder: Placeholder = { id: Date.now(), key: '', value: '', ...(tag && {tag}) };
        setCurrentProjectState(prev => ({ ...prev, placeholders: [...prev.placeholders, newPlaceholder] }));
    };
    
    const handleDeletePlaceholder = (id: number) => {
        setCurrentProjectState(prev => ({ ...prev, placeholders: prev.placeholders.filter(p => p.id !== id) }));
    };
    
    const handleBulkTagPlaceholders = () => {
        if (!bulkActionTag) return;
        setCurrentProjectState(prev => ({
            ...prev,
            placeholders: prev.placeholders.map(p => selectedPlaceholders.has(p.id) ? { ...p, tag: bulkActionTag } : p)
        }));
        setSelectedPlaceholders(new Set());
        setBulkActionTag('');
    };
    
    const handleMakePlaceholderUniversal = (id: number) => {
        setCurrentProjectState(prev => ({
            ...prev,
            placeholders: prev.placeholders.map(p => p.id === id ? { ...p, tag: undefined } : p)
        }));
    };
    
    const handleSnippetChange = (id: number, field: 'key' | 'values', value: any) => {
        setCurrentProjectState(prev => ({
            ...prev,
            taggedSnippets: prev.taggedSnippets.map(s => s.id === id ? (field === 'key' ? { ...s, key: value } : { ...s, values: value }) : s)
        }));
    };
    const addSnippet = () => {
        setCurrentProjectState(prev => ({
            ...prev,
            taggedSnippets: [...prev.taggedSnippets, { id: Date.now(), key: '', values: {} }]
        }));
    };
    const removeSnippet = (id: number) => {
        setCurrentProjectState(prev => ({
            ...prev,
            taggedSnippets: prev.taggedSnippets.filter(s => s.id !== id)
        }));
    };

    // Option Variable handlers
    const handleAddOptionVariable = () => {
        const newOptionVar: OptionVariable = { id: Date.now(), key: '', prompt: '', optionCount: 3 };
        setCurrentProjectState(prev => ({ ...prev, optionVariables: [...(prev.optionVariables || []), newOptionVar] }));
    };

    const handleUpdateOptionVariable = (id: number, field: keyof OptionVariable, value: any) => {
        setCurrentProjectState(prev => ({
            ...prev,
            optionVariables: (prev.optionVariables || []).map(ov => ov.id === id ? { ...ov, [field]: value } : ov)
        }));
    };

    const handleDeleteOptionVariable = (id: number) => {
        setCurrentProjectState(prev => ({
            ...prev,
            optionVariables: (prev.optionVariables || []).filter(ov => ov.id !== id)
        }));
    };

    // Pending Result Selection Handlers
    const handleSelectOption = (pendingId: number, variableKey: string, optionIndex: number) => {
        setPendingResults(prev => prev.map(pr => {
            if (pr.id !== pendingId) return pr;
            return {
                ...pr,
                optionSelections: pr.optionSelections.map(os =>
                    os.variableKey === variableKey ? { ...os, selectedIndex: optionIndex } : os
                )
            };
        }));
    };

    const handleCustomOptionValue = (pendingId: number, variableKey: string, value: string) => {
        setPendingResults(prev => prev.map(pr => {
            if (pr.id !== pendingId) return pr;
            return {
                ...pr,
                optionSelections: pr.optionSelections.map(os =>
                    os.variableKey === variableKey ? { ...os, customValue: value, selectedIndex: -1 } : os
                )
            };
        }));
    };

    const handleFinalizePendingResult = async (pendingId: number) => {
        if (!currentProject) return;
        const pending = pendingResults.find(pr => pr.id === pendingId);
        if (!pending) return;

        // Check all options are selected
        const unresolved = pending.optionSelections.filter(os => os.selectedIndex === null);
        if (unresolved.length > 0) {
            showNotification(`Please select options for: ${unresolved.map(u => u.variableKey).join(', ')}`, 'error');
            return;
        }

        // Apply selections to final output
        let finalizedOutput = pending.finalOutput;
        pending.optionSelections.forEach(os => {
            const selectedValue = os.selectedIndex === -1 ? os.customValue : os.options[os.selectedIndex!];
            // Replace ?key:count? pattern with selected value
            const pattern = new RegExp(`\\?${os.variableKey}:\\d+\\?`, 'g');
            finalizedOutput = finalizedOutput.replace(pattern, selectedValue);
        });

        // Check AI score for finalized content
        addLog(`[${pending.item.name}] Finalizing selections and checking AI score...`, LogStatus.WORKING, pending.item.id);
        const { score: aiScore, wordCount } = await checkAiScore(currentProject.state.apiKeys.zeroGpt, finalizedOutput);
        const status = aiScore >= 40 ? 'FLAGGED' : 'PASSED';

        const txtContent = `${finalizedOutput}\n\n---META TITLES---\n${pending.metaTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n---META DESCRIPTIONS---\n${pending.metaDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`;

        const jsonContent = JSON.stringify({
            item_name: pending.item.name, tag: pending.item.tag, final_output: finalizedOutput, parsed_titles: pending.metaTitles,
            parsed_summaries: pending.metaDescriptions, ai_detection_score: aiScore, flagged: status === 'FLAGGED', word_count: wordCount, timestamp: pending.timestamp,
        }, null, 2);

        // Move to results
        setResults(prev => [...prev, {
            item: pending.item,
            finalOutput: finalizedOutput,
            metaTitles: pending.metaTitles,
            metaDescriptions: pending.metaDescriptions,
            aiScore,
            wordCount,
            status,
            timestamp: pending.timestamp,
            jsonContent,
            txtContent,
            allOutputs: pending.allOutputs,
            wpStatus: 'idle'
        }]);

        // Remove from pending
        setPendingResults(prev => prev.filter(pr => pr.id !== pendingId));
        addLog(`[${pending.item.name}] Finalized! Status: ${status}`, status === 'PASSED' ? LogStatus.SUCCESS : LogStatus.ERROR, pending.item.id);
    };

    const handleAiChooseOption = async (pendingId: number, variableKey: string) => {
        if (!currentProject) return;
        const pending = pendingResults.find(pr => pr.id === pendingId);
        if (!pending) return;
        const selection = pending.optionSelections.find(os => os.variableKey === variableKey);
        if (!selection || selection.options.length === 0) return;

        addLog(`[${pending.item.name}] AI choosing best option for ${variableKey}...`, LogStatus.WORKING, pending.item.id);

        const prompt = `You are selecting the best option from a list. Given this context about "${pending.item.name}", choose the single best option from the following numbered list. Reply with ONLY the number (1, 2, 3, etc.) of the best option:\n\n${selection.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`;

        try {
            const response = await generateLlmContent(
                prompt,
                currentProject.state.provider,
                currentProject.state.model,
                { anthropic: currentProject.state.apiKeys.anthropic, openai: currentProject.state.apiKeys.openai, gemini: currentProject.state.apiKeys.gemini, xai: currentProject.state.apiKeys.xai }
            );
            const chosenNumber = parseInt(response.trim().match(/\d+/)?.[0] || '1');
            const chosenIndex = Math.max(0, Math.min(chosenNumber - 1, selection.options.length - 1));
            handleSelectOption(pendingId, variableKey, chosenIndex);
            addLog(`[${pending.item.name}] AI chose option ${chosenIndex + 1} for ${variableKey}`, LogStatus.SUCCESS, pending.item.id);
        } catch (error) {
            addLog(`[${pending.item.name}] AI selection failed, defaulting to option 1`, LogStatus.ERROR, pending.item.id);
            handleSelectOption(pendingId, variableKey, 0);
        }
    };

    const handleAiChooseAllForPending = async (pendingId: number) => {
        const pending = pendingResults.find(pr => pr.id === pendingId);
        if (!pending) return;
        for (const selection of pending.optionSelections) {
            if (selection.selectedIndex === null) {
                await handleAiChooseOption(pendingId, selection.variableKey);
            }
        }
    };

    const handleAiChooseAllPending = async () => {
        for (const pending of pendingResults) {
            await handleAiChooseAllForPending(pending.id);
        }
    };

    const addTag = () => {
        if (currentProject && newTagName && !currentProject.state.tags.some(t => t.name === newTagName)) {
            setCurrentProjectState(prev => ({
                ...prev,
                tags: [...prev.tags, { id: Date.now(), name: newTagName }]
            }));
            setNewTagName('');
        }
    };
    const removeTag = (id: number) => {
        if (!currentProject) return;
        const tagToRemove = currentProject.state.tags.find(t => t.id === id);
        if(!tagToRemove) return;
        setCurrentProjectState(prev => ({
            ...prev,
            tags: prev.tags.filter(t => t.id !== id),
            placeholders: prev.placeholders.map(p => p.tag === tagToRemove.name ? {...p, tag: undefined} : p)
        }));
    };

    // --- End of Data Mutation Handlers ---

    const loadItems = (itemsData: WorkflowItem[]) => {
        setItems(itemsData);
        addLog(`Successfully loaded ${itemsData.length} items.`, LogStatus.SUCCESS);
        if (itemsData.length > 0) {
            setOpenSections(prev => new Set([...prev, 'loadedItems']));
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileName(file.name);
            const text = await file.text();
            try {
                const parsedItems = parseCsv(text);
                loadItems(parsedItems);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error parsing CSV.';
                addLog(`Error parsing CSV: ${errorMessage}`, LogStatus.ERROR);
            }
        }
    };
    
    const handleManualAddItems = () => {
        if (!currentProject || !manualItems.trim()) {
            addLog('Text area is empty. Please paste items.', LogStatus.ERROR);
            return;
        }

        const itemNames = manualItems.split(/\r?\n/).filter(line => line.trim() !== '');

        const parsedItems: WorkflowItem[] = itemNames.map((itemName, index) => {
            const tagMatch = itemName.match(/\(([^)]+)\)/);
            const tag = tagMatch ? tagMatch[1] : null;
            return { id: index, name: itemName, tag };
        });
        
        loadItems(parsedItems);
    };

    const fillPrompt = (template: string, item: WorkflowItem, dynamicVars: Record<string, string>): string => {
        if (!currentProject) return template;
        let filledTemplate = template;

        const universalPlaceholders = currentProject.state.placeholders.filter(p => !p.tag);
        const taggedPlaceholders = currentProject.state.placeholders.filter(p => p.tag === item.tag);
        
        filledTemplate = filledTemplate.replace(/\[([^\]]+)\]/g, (_, key) => dynamicVars[key.trim()] || `[${key.trim()}]`);
        
        if(item.tag) {
            const itemTag = item.tag;
            currentProject.state.taggedSnippets.forEach(s => {
                const snippetValue = s.values[itemTag] || '';
                filledTemplate = filledTemplate.replace(new RegExp(`{{{${s.key}}}}`, 'g'), snippetValue);
            });
        }
        
        taggedPlaceholders.forEach(p => {
            filledTemplate = filledTemplate.replace(new RegExp(`{${p.key}{${p.tag}}}`, 'g'), p.value);
        });

        universalPlaceholders.forEach(p => {
             filledTemplate = filledTemplate.replace(new RegExp(`{${p.key}}`, 'g'), p.value);
        });

        filledTemplate = filledTemplate.replace(/<item_name>/g, item.name);

        return filledTemplate;
    };
    
    // Helper to clean LLM meta responses - filters out preamble text
    const cleanMetaResponse = (response: string, minLength: number = 20): string[] => {
        // Patterns that indicate preamble/intro text (not actual meta content)
        const preamblePatterns = [
            /^(here\s+(are|is)|based\s+on|the\s+primary|i('ve|'ll| have| will)|let\s+me|sure|okay|certainly)/i,
            /^(\*\*)?option\s*\d+/i,           // "Option 1", "**Option 1**"
            /^\(\d+\s*characters?\)/i,          // "(158 characters)"
            /^\*\*[^*]+\*\*:?\s*$/,             // Lines that are just "**something**"
            /^(meta\s+)?(title|description)s?(\s+options?)?:?\s*$/i,  // "Meta titles:", "Description options"
            /characters?\s*(including|each|long)/i,  // "all between 150-168 characters"
            /target\s+keyword/i,                // "the primary target keyword is..."
        ];

        return response
            .split('\n')
            .map(line => {
                // Remove number prefixes like "1.", "2.", etc.
                let cleaned = line.replace(/^\d+[\.\)\-]\s*/, '').trim();
                // Remove markdown bold/italic
                cleaned = cleaned.replace(/\*\*/g, '').replace(/\*/g, '').trim();
                // Remove leading/trailing quotes
                cleaned = cleaned.replace(/^["']|["']$/g, '').trim();
                return cleaned;
            })
            .filter(line => {
                // Filter out empty lines
                if (line.length < minLength) return false;
                // Filter out preamble patterns
                for (const pattern of preamblePatterns) {
                    if (pattern.test(line)) return false;
                }
                // Filter out lines that look like they contain character counts
                if (/\(\d+\s*characters?\)/.test(line)) return false;
                return true;
            });
    };

    // Generate meta titles and descriptions using separate LLM calls
    const generateMetaSeparately = async (
        articleContent: string,
        provider: string,
        model: string,
        apiKeys: { anthropic: string; openai: string; gemini: string; xai: string },
        metaTitleCount: number,
        metaDescriptionCount: number,
        metaTitlePrompt: string,
        metaDescriptionPrompt: string
    ): Promise<{ metaTitles: string[]; metaDescriptions: string[] }> => {
        let metaTitles: string[] = [];
        let metaDescriptions: string[] = [];

        // Generate meta titles (typically 50-70 chars, use 25 as min filter)
        if (metaTitleCount > 0 && metaTitlePrompt) {
            const titlePrompt = metaTitlePrompt
                .replace(/{count}/g, String(metaTitleCount))
                .replace(/{article_content}/g, articleContent.substring(0, 5000)); // Limit content length

            try {
                const titleResponse = await generateLlmContent(titlePrompt, provider, model, apiKeys);
                metaTitles = cleanMetaResponse(titleResponse, 25).slice(0, metaTitleCount);
            } catch (error) {
                console.error('Failed to generate meta titles:', error);
            }
        }

        // Generate meta descriptions (typically 150-168 chars, use 80 as min filter)
        if (metaDescriptionCount > 0 && metaDescriptionPrompt) {
            const descPrompt = metaDescriptionPrompt
                .replace(/{count}/g, String(metaDescriptionCount))
                .replace(/{article_content}/g, articleContent.substring(0, 5000));

            try {
                const descResponse = await generateLlmContent(descPrompt, provider, model, apiKeys);
                metaDescriptions = cleanMetaResponse(descResponse, 80).slice(0, metaDescriptionCount);
            } catch (error) {
                console.error('Failed to generate meta descriptions:', error);
            }
        }

        return { metaTitles, metaDescriptions };
    };

    // Legacy parser - just returns the text as-is without extracting meta
    const parseFinalOutput = (text: string) => {
        // No longer extract meta from content - it's generated separately
        return { finalOutput: text.trim(), metaTitles: [] as string[], metaDescriptions: [] as string[] };
    };

    const processWorkflow = async () => {
        if (!currentProject || !items.length || !currentProject.state.promptTemplates.length) {
            addLog('Prerequisites not met: Add items and define at least one prompt.', LogStatus.ERROR);
            return;
        }

        // Collect active models
        const activeModels: { model: string; label: string }[] = [
            { model: currentProject.state.model, label: 'Model 1' }
        ];
        if (currentProject.state.model2 && currentProject.state.model2 !== 'not-in-use') {
            activeModels.push({ model: currentProject.state.model2, label: 'Model 2' });
        }
        if (currentProject.state.model3 && currentProject.state.model3 !== 'not-in-use') {
            activeModels.push({ model: currentProject.state.model3, label: 'Model 3' });
        }

        setIsProcessing(true);
        setResults([]);
        setLogs([]);

        const modelNames = activeModels.map(m => m.model.split('-').slice(0, 2).join('-')).join(', ');
        addLog(`Starting batch processing for ${items.length} items using ${activeModels.length} model(s): ${modelNames}...`, LogStatus.INFO);
        const startTime = Date.now();

        for (const item of items) {
            // Run workflow for each active model
            for (const { model: activeModel, label: modelLabel } of activeModels) {
                const promptOutputs: Record<string, string> = {};
                const itemLabel = activeModels.length > 1 ? `${item.name} (${modelLabel})` : item.name;

                try {
                    if (!item.tag) throw new Error(`Item "${item.name}" is missing a tag.`);
                    if (!currentProject.state.tags.find(t => t.name === item.tag)) throw new Error(`Tag "${item.tag}" is not defined.`);

                    addLog(`[${itemLabel}] Starting process...`, LogStatus.WORKING, item.id);

                    for (const prompt of currentProject.state.promptTemplates) {
                        addLog(`[${itemLabel}] Running prompt: "${prompt.name}"...`, LogStatus.INFO, item.id);
                        const filledPrompt = fillPrompt(prompt.template, item, promptOutputs);
                        const output = await generateLlmContent(
                            filledPrompt,
                            currentProject.state.provider,
                            activeModel,
                            { anthropic: currentProject.state.apiKeys.anthropic, openai: currentProject.state.apiKeys.openai, gemini: currentProject.state.apiKeys.gemini, xai: currentProject.state.apiKeys.xai }
                        );
                        if (output.startsWith('Error:')) throw new Error(output);
                        promptOutputs[prompt.outputKey] = output;
                    }
                
                    const finalPrompts = currentProject.state.promptTemplates.filter(p => p.outputAction === 'addToFinal');
                    const mainContentKeys = finalPrompts.length > 0 ? finalPrompts.map(p => p.outputKey) : [currentProject.state.promptTemplates[currentProject.state.promptTemplates.length - 1]?.outputKey].filter(Boolean);

                    const combinedOutput = mainContentKeys.map(key => promptOutputs[key]).join('\n\n---\n\n');

                    const { finalOutput } = parseFinalOutput(combinedOutput);
                    addLog(`[${itemLabel}] Generated final content.`, LogStatus.INFO, item.id);

                    // Check if any prompt has generateMetaFromOutput enabled
                    let metaTitles: string[] = [];
                    let metaDescriptions: string[] = [];

                    const metaSourcePrompt = currentProject.state.promptTemplates.find(p => p.generateMetaFromOutput);
                    if (metaSourcePrompt) {
                        const metaSourceContent = promptOutputs[metaSourcePrompt.outputKey] || finalOutput;
                        addLog(`[${itemLabel}] Generating SEO meta from "${metaSourcePrompt.name}" output...`, LogStatus.WORKING, item.id);

                        const metaResult = await generateMetaSeparately(
                            metaSourceContent,
                            currentProject.state.provider,
                            activeModel,
                            { anthropic: currentProject.state.apiKeys.anthropic, openai: currentProject.state.apiKeys.openai, gemini: currentProject.state.apiKeys.gemini, xai: currentProject.state.apiKeys.xai },
                            currentProject.state.metaTitleCount || 3,
                            currentProject.state.metaDescriptionCount || 3,
                            currentProject.state.metaTitlePrompt || 'Generate {count} SEO meta titles for this article:\n\n{article_content}\n\nFormat as numbered list.',
                            currentProject.state.metaDescriptionPrompt || 'Generate {count} SEO meta descriptions for this article:\n\n{article_content}\n\nFormat as numbered list.'
                        );

                        metaTitles = metaResult.metaTitles;
                        metaDescriptions = metaResult.metaDescriptions;
                        addLog(`[${itemLabel}] Generated ${metaTitles.length} meta titles and ${metaDescriptions.length} meta descriptions.`, LogStatus.SUCCESS, item.id);
                    }

                    // Check for option variables in the final output
                    const optionVarPattern = /\?([^:?]+):(\d+)\?/g;
                    const optionMatches = [...finalOutput.matchAll(optionVarPattern)];
                    const optionVariables = currentProject.state.optionVariables || [];

                    if (optionMatches.length > 0 && optionVariables.length > 0) {
                        // Has option variables - generate options and store as pending
                        addLog(`[${itemLabel}] Found ${optionMatches.length} option variable(s), generating options...`, LogStatus.INFO, item.id);

                        const optionSelections: OptionSelection[] = [];

                        for (const match of optionMatches) {
                            const varKey = match[1];
                            const optionCount = parseInt(match[2]);
                            const optionVar = optionVariables.find(ov => ov.key === varKey);

                            if (optionVar) {
                                addLog(`[${itemLabel}] Generating ${optionCount} options for "${varKey}"...`, LogStatus.WORKING, item.id);

                                // Fill the option variable prompt with context
                                let optionPrompt = optionVar.prompt;
                                optionPrompt = optionPrompt.replace(/<item_name>/g, item.name);
                                // Add instruction to generate numbered list
                                optionPrompt += `\n\nGenerate exactly ${optionCount} options. Format as a numbered list:\n1. [option]\n2. [option]\netc.`;

                                const optionsResponse = await generateLlmContent(
                                    optionPrompt,
                                    currentProject.state.provider,
                                    activeModel,
                                    { anthropic: currentProject.state.apiKeys.anthropic, openai: currentProject.state.apiKeys.openai, gemini: currentProject.state.apiKeys.gemini, xai: currentProject.state.apiKeys.xai }
                                );

                                // Parse the numbered list response
                                const options = optionsResponse
                                    .split('\n')
                                    .map(line => line.replace(/^\d+\.\s*/, '').trim())
                                    .filter(line => line.length > 0)
                                    .slice(0, optionCount);

                                optionSelections.push({
                                    variableKey: varKey,
                                    options,
                                    selectedIndex: null,
                                    customValue: ''
                                });

                                addLog(`[${itemLabel}] Generated ${options.length} options for "${varKey}"`, LogStatus.SUCCESS, item.id);
                            }
                        }

                        const timestamp = new Date().toISOString();

                        // Store as pending result with model info
                        setPendingResults(prev => [...prev, {
                            id: Date.now() + item.id + activeModels.indexOf({ model: activeModel, label: modelLabel }),
                            item: { ...item, name: activeModels.length > 1 ? `${item.name} [${modelLabel}]` : item.name },
                            finalOutput,
                            metaTitles,
                            metaDescriptions,
                            allOutputs: promptOutputs,
                            timestamp,
                            optionSelections
                        }]);

                        addLog(`[${itemLabel}] Added to pending selections (${optionSelections.length} option(s) need selection)`, LogStatus.INFO, item.id);
                    } else {
                        // No option variables - proceed normally
                        addLog(`[${itemLabel}] Checking AI score with ZeroGPT...`, LogStatus.WORKING, item.id);
                        const { score: aiScore, wordCount } = await checkAiScore(currentProject.state.apiKeys.zeroGpt, finalOutput);
                        addLog(`[${itemLabel}] AI score: ${aiScore}%, Word count: ${wordCount}`, LogStatus.INFO, item.id);

                        const status = aiScore >= 40 ? 'FLAGGED' : 'PASSED';
                        const timestamp = new Date().toISOString();

                        // Include model info in content when multi-model testing
                        const modelSuffix = activeModels.length > 1 ? `\n\n---MODEL: ${activeModel}---` : '';
                        const txtContent = `${finalOutput}${modelSuffix}\n\n---META TITLES---\n${metaTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n---META DESCRIPTIONS---\n${metaDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`;

                        const jsonContent = JSON.stringify({
                            item_name: item.name, tag: item.tag, model: activeModel, final_output: finalOutput, parsed_titles: metaTitles,
                            parsed_summaries: metaDescriptions, ai_detection_score: aiScore, flagged: status === 'FLAGGED', word_count: wordCount, timestamp,
                        }, null, 2);

                        // Create result item with model label if multi-model
                        const resultItem = activeModels.length > 1 ? { ...item, name: `${item.name} [${modelLabel}]` } : item;
                        setResults(prev => [...prev, { item: resultItem, finalOutput, metaTitles, metaDescriptions, aiScore, wordCount, status, timestamp, jsonContent, txtContent, allOutputs: promptOutputs, wpStatus: 'idle' }]);
                        addLog(`[${itemLabel}] Process finished. Status: ${status}`, status === 'PASSED' ? LogStatus.SUCCESS : LogStatus.ERROR, item.id);

                        // Save article to database
                        try {
                            await fetch('/api/articles', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    workflowId: currentWorkflowId || null,
                                    websiteId: currentWebsiteId || null,
                                    keyword: item.name,
                                    tag: item.tag,
                                    model: activeModel,
                                    finalContent: finalOutput,
                                    metaTitles,
                                    metaDescriptions,
                                    chainOutputs: promptOutputs,
                                    aiScore,
                                    wordCount,
                                    status: status.toLowerCase()
                                })
                            });
                            addLog(`[${itemLabel}] Article saved to database.`, LogStatus.INFO, item.id);
                        } catch (saveError) {
                            // Don't fail the whole process if saving fails
                            console.error('Failed to save article:', saveError);
                        }
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
                    addLog(`[${itemLabel}] Failed: ${errorMessage}`, LogStatus.ERROR, item.id);
                }
            }
        }
        
        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        addLog(`Batch processing complete in ${duration} minutes.`, LogStatus.SUCCESS);
        setIsProcessing(false);
    };
    
    const fillSimpleTemplate = (template: string, data: Record<string, string | null | undefined>): string => {
        return template.replace(/{([^{}]+)}/g, (match, key) => {
            const trimmedKey = key.trim();
            const value = data[trimmedKey];
            return value !== null && value !== undefined ? String(value) : match;
        });
    };

    const handlePublishToWordPress = async (result: Result, useElementor: boolean = true) => {
        if (!currentProject) return;
        const { url, user, password } = currentProject.state.wpCredentials;
        if (!url || !user || !password) {
            addLog(`[${result.item.name}] WordPress credentials are not set.`, LogStatus.ERROR, result.item.id);
            return;
        }

        const updateResultStatus = (itemId: number, status: WpStatus, link?: string, error?: string) => {
            setResults(prev => prev.map(r => r.item.id === itemId ? { ...r, wpStatus: status, wpLink: link, wpError: error } : r));
        };

        updateResultStatus(result.item.id, 'publishing');
        const publishType = useElementor ? 'Elementor page' : 'WordPress';
        addLog(`[${result.item.name}] Publishing to ${publishType}...`, LogStatus.WORKING, result.item.id);

        try {
            const placeholderData = currentProject.state.placeholders.reduce((acc, p) => {
                if (!p.tag) {
                    acc[p.key] = p.value;
                }
                return acc;
            }, {} as Record<string, string>);

            const templateData = {
                ...placeholderData,
                item_name: result.item.name,
                tag: result.item.tag,
                status: result.status,
            };

            const generatedTitle = fillSimpleTemplate(currentProject.state.wpTitleTemplate, templateData);
            const title = generatedTitle.trim() ? generatedTitle : (result.metaTitles[0] || result.item.name);

            let response;
            let data;

            if (useElementor) {
                // Use Elementor publishing endpoint
                response = await fetch('/api/elementor/publish', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        wpUrl: url,
                        wpUser: user,
                        wpPassword: password,
                        title: title,
                        content: result.finalOutput,
                        status: 'draft',
                        ctaText: 'Book Now!',
                        ctaUrl: '#',
                        includeStatsBar: false,
                    }),
                });

                data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || `Elementor API Error: ${response.statusText}`);
                }

                updateResultStatus(result.item.id, 'published', data.page?.link);
                addLog(`[${result.item.name}] Successfully published as Elementor page!`, LogStatus.SUCCESS, result.item.id);

                // Auto-push SEO meta if count=1 for both
                const metaTitleCount = currentProject.state.metaTitleCount || 3;
                const metaDescCount = currentProject.state.metaDescriptionCount || 3;
                if (metaTitleCount === 1 && metaDescCount === 1 && result.metaTitles.length > 0 && result.metaDescriptions.length > 0 && data.page?.id) {
                    addLog(`[${result.item.name}] Auto-pushing SEO meta to AIOSEO...`, LogStatus.WORKING, result.item.id);
                    try {
                        const seoResponse = await fetch('/api/seo/push-direct', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                wpUrl: url,
                                wpUser: user,
                                wpPassword: password,
                                postId: data.page.id,
                                metaTitle: result.metaTitles[0],
                                metaDescription: result.metaDescriptions[0],
                                seoPlugin: 'aioseo',
                                postType: 'pages'
                            })
                        });
                        if (seoResponse.ok) {
                            addLog(`[${result.item.name}] SEO meta pushed successfully!`, LogStatus.SUCCESS, result.item.id);
                        } else {
                            const seoError = await seoResponse.json();
                            addLog(`[${result.item.name}] SEO push failed: ${seoError.error || 'Unknown error'}`, LogStatus.ERROR, result.item.id);
                        }
                    } catch (seoErr) {
                        addLog(`[${result.item.name}] SEO push error: ${seoErr instanceof Error ? seoErr.message : 'Unknown'}`, LogStatus.ERROR, result.item.id);
                    }
                }
            } else {
                // Use regular WordPress endpoint
                response = await fetch('/api/wordpress/publish', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        wpUrl: url,
                        wpUser: user,
                        wpPassword: password,
                        contentType: currentProject.state.wpContentType,
                        title: title,
                        content: result.finalOutput,
                        status: 'draft',
                    }),
                });

                data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || `WordPress API Error: ${response.statusText}`);
                }

                updateResultStatus(result.item.id, 'published', data.link);
                addLog(`[${result.item.name}] Successfully published to WordPress!`, LogStatus.SUCCESS, result.item.id);

                // Auto-push SEO meta if count=1 for both
                const metaTitleCount2 = currentProject.state.metaTitleCount || 3;
                const metaDescCount2 = currentProject.state.metaDescriptionCount || 3;
                if (metaTitleCount2 === 1 && metaDescCount2 === 1 && result.metaTitles.length > 0 && result.metaDescriptions.length > 0 && data.id) {
                    addLog(`[${result.item.name}] Auto-pushing SEO meta to AIOSEO...`, LogStatus.WORKING, result.item.id);
                    try {
                        const seoResponse = await fetch('/api/seo/push-direct', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                wpUrl: url,
                                wpUser: user,
                                wpPassword: password,
                                postId: data.id,
                                metaTitle: result.metaTitles[0],
                                metaDescription: result.metaDescriptions[0],
                                seoPlugin: 'aioseo',
                                postType: currentProject.state.wpContentType
                            })
                        });
                        if (seoResponse.ok) {
                            addLog(`[${result.item.name}] SEO meta pushed successfully!`, LogStatus.SUCCESS, result.item.id);
                        } else {
                            const seoError = await seoResponse.json();
                            addLog(`[${result.item.name}] SEO push failed: ${seoError.error || 'Unknown error'}`, LogStatus.ERROR, result.item.id);
                        }
                    } catch (seoErr) {
                        addLog(`[${result.item.name}] SEO push error: ${seoErr instanceof Error ? seoErr.message : 'Unknown'}`, LogStatus.ERROR, result.item.id);
                    }
                }
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during publishing.';
            addLog(`[${result.item.name}] Failed to publish: ${errorMessage}`, LogStatus.ERROR, result.item.id);
            updateResultStatus(result.item.id, 'error', undefined, errorMessage);
        }
    };

    const getFilename = (item: WorkflowItem, status: string, extension: string) => {
        if (!currentProject) return `error.${extension}`;
        const sanitizedName = item.name.replace(/\(.\)$/, '').replace(/[^a-z0-9]/gi, '-').toLowerCase();
        const data = {
            tag: item.tag?.toLowerCase() || 'x',
            item_name: sanitizedName,
            status: status.toLowerCase(),
        };
        return fillSimpleTemplate(currentProject.state.fileNameTemplate, data) + `.${extension}`;
    };
    
    const handleDownload = (content: string, filename: string, mimeType: string) => {
        downloadFile(content, filename, mimeType);
    };
    
    const handleDownloadAll = () => {
        if (results.length === 0) return;
        const zip = new JSZip();
        results.forEach(result => {
            zip.file(getFilename(result.item, result.status, 'txt'), result.txtContent);
            zip.file(getFilename(result.item, result.status, 'json'), result.jsonContent);
        });
        zip.generateAsync({ type: "blob" }).then((content: Blob) => {
            const a = document.createElement('a');
            const url = URL.createObjectURL(content);
            a.href = url;
            a.download = `output-batch-${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }).catch((error: unknown) => {
            // FIX: The `addLog` function was being called with an `unknown` error object instead of a string message.
            // This fix ensures a proper string message is constructed from the error before logging.
            let errorMessage: string;
            if (error instanceof Error) {
                errorMessage = `Failed to generate zip file: ${error.message}`;
            } else {
                errorMessage = 'Failed to generate zip file due to an unknown error.';
            }
            addLog(errorMessage, LogStatus.ERROR);
        });
    };
    
    const togglePlaceholderSelection = (id: number) => {
        setSelectedPlaceholders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };
    
    const toggleCollapsible = (section: string) => setOpenSections(prev => {
        const newSet = new Set(prev);
        if (newSet.has(section)) {
            newSet.delete(section);
        } else {
            newSet.add(section);
        }
        return newSet;
    });

    if (!currentProject) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                Loading Project...
            </div>
        );
    }
    
    const renderSection = (title: string, id: string, icon: React.ReactNode, children: React.ReactNode, defaultOpen = false) => (
      <div className="bg-card rounded-xl shadow-glow-cyan card-3d hover:shadow-card-hover border-2 border-brand-cyan">
        <h2 className={`text-xl font-bold flex items-center text-brand-cyan p-5 cursor-pointer`} onClick={() => toggleCollapsible(id)}>
          {icon}
          <span className="ml-3">{title}</span>
           <svg className={`w-5 h-5 ml-auto transform transition-transform ${openSections.has(id) ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </h2>
        <div className={`transition-all duration-300 ease-in-out ${openSections.has(id) ? 'max-h-[5000px]' : 'max-h-0 overflow-hidden'}`}>
            <div className="p-5 pt-0 border-t border-brand-cyan/30">{children}</div>
        </div>
      </div>
    );
    
    const isApiKeyMissing = currentProject.state.provider === 'anthropic' && !currentProject.state.apiKeys.anthropic;
    const isRunDisabled = isProcessing || !items.length || isApiKeyMissing;

    const getRunButtonText = () => {
        if (isProcessing) return 'Processing...';
        if (isApiKeyMissing) return 'Enter Anthropic API Key to Start';
        if (!items.length) return 'Add Items to Start';
        return `Start Workflow (${items.length} items)`;
    };

    return (
        <div className="min-h-screen bg-slate-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
             {notification && (
                <div className={`fixed top-5 right-5 z-50 px-6 py-3 rounded-xl shadow-card-lg text-white transition-all duration-300 border ${notification.type === 'success' ? 'bg-green-600/90 border-green-500' : notification.type === 'info' ? 'bg-brand-cyan/90 border-brand-cyan-light' : 'bg-red-600/90 border-red-500'}`}>
                    {notification.message}
                </div>
            )}
            <ProjectTracker isOpen={isTrackerOpen} onClose={() => setIsTrackerOpen(false)} />
            <AgencyManager isOpen={isAgencyOpen} onClose={() => setIsAgencyOpen(false)} />
            <ClientsPage
                isOpen={isClientsOpen}
                onClose={() => setIsClientsOpen(false)}
                onSelectWebsite={(websiteId) => {
                    setCurrentWebsiteId(websiteId);
                    setIsClientsOpen(false);
                    showNotification('Website selected', 'info');
                }}
                onOpenWorkflowResults={(clientId) => {
                    setFilterByClientId(clientId);
                    setCurrentWebsiteId(undefined);
                    setIsClientsOpen(false);
                    setIsArticlesOpen(true);
                }}
            />
            <WebsitesPage
                isOpen={isWebsitesOpen}
                onClose={() => setIsWebsitesOpen(false)}
                onSelectWebsite={(websiteId) => {
                    setCurrentWebsiteId(websiteId);
                    setIsWebsitesOpen(false);
                    showNotification('Website selected', 'info');
                }}
            />
            <Analytics isOpen={isAnalyticsOpen} onClose={() => setIsAnalyticsOpen(false)} />

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                    <div className="bg-slate-900 rounded-xl border border-brand-cyan/50 shadow-glow-cyan w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
                        <div className="flex items-center justify-between p-4 border-b border-brand-cyan/30">
                            <h2 className="text-xl font-bold text-brand-cyan">Settings</h2>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-4 space-y-6">
                            {/* Auto-Save Settings */}
                            <div className="bg-slate-800/50 p-4 rounded-lg border border-brand-cyan/30">
                                <h3 className="text-lg font-semibold text-brand-cyan mb-3">Auto-Save</h3>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={currentProject.state.autoSaveEnabled ?? true}
                                            onChange={e => setCurrentProjectState(p => ({...p, autoSaveEnabled: e.target.checked}))}
                                            className="w-4 h-4 rounded bg-slate-700 border-brand-cyan text-brand-cyan focus:ring-brand-cyan"
                                        />
                                        <span className="text-white">Enable Auto-Save</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 text-sm">Delay:</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max="60"
                                            value={currentProject.state.autoSaveSeconds ?? 3}
                                            onChange={e => setCurrentProjectState(p => ({...p, autoSaveSeconds: parseInt(e.target.value) || 3}))}
                                            className="w-16 bg-slate-700 border border-brand-cyan/50 rounded px-2 py-1 text-white text-sm"
                                        />
                                        <span className="text-slate-400 text-sm">seconds</span>
                                    </div>
                                </div>
                            </div>

                            {/* Open Router Override */}
                            <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/30">
                                <h3 className="text-lg font-semibold text-purple-400 mb-3">Open Router</h3>
                                <label className="flex items-center gap-2 cursor-pointer mb-3">
                                    <input
                                        type="checkbox"
                                        checked={currentProject.state.useOpenRouter ?? false}
                                        onChange={e => setCurrentProjectState(p => ({...p, useOpenRouter: e.target.checked}))}
                                        className="w-4 h-4 rounded bg-slate-700 border-purple-500 text-purple-500 focus:ring-purple-500"
                                    />
                                    <span className="text-white">Use Open Router (overrides individual API keys)</span>
                                </label>
                                <input
                                    type="password"
                                    placeholder="Open Router API Key"
                                    value={currentProject.state.apiKeys?.openRouter || ''}
                                    onChange={e => setCurrentProjectState(p => ({...p, apiKeys: {...p.apiKeys, openRouter: e.target.value}}))}
                                    className="w-full bg-slate-700 border border-purple-500/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            {/* API Keys */}
                            <div className="bg-slate-800/50 p-4 rounded-lg border border-brand-gold/30">
                                <h3 className="text-lg font-semibold text-brand-gold mb-3">API Keys</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-brand-gold mb-1">Anthropic (Claude)</label>
                                        <input
                                            type="password"
                                            placeholder="sk-ant-..."
                                            value={currentProject.state.apiKeys?.anthropic || ''}
                                            onChange={e => setCurrentProjectState(p => ({...p, apiKeys: {...p.apiKeys, anthropic: e.target.value}}))}
                                            className="w-full bg-slate-700 border border-brand-gold/50 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-brand-gold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-brand-gold mb-1">OpenAI (GPT)</label>
                                        <input
                                            type="password"
                                            placeholder="sk-..."
                                            value={currentProject.state.apiKeys?.openai || ''}
                                            onChange={e => setCurrentProjectState(p => ({...p, apiKeys: {...p.apiKeys, openai: e.target.value}}))}
                                            className="w-full bg-slate-700 border border-brand-gold/50 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-brand-gold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-brand-gold mb-1">Google (Gemini)</label>
                                        <input
                                            type="password"
                                            placeholder="AIza..."
                                            value={currentProject.state.apiKeys?.gemini || ''}
                                            onChange={e => setCurrentProjectState(p => ({...p, apiKeys: {...p.apiKeys, gemini: e.target.value}}))}
                                            className="w-full bg-slate-700 border border-brand-gold/50 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-brand-gold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-brand-gold mb-1">xAI (Grok)</label>
                                        <input
                                            type="password"
                                            placeholder="xai-..."
                                            value={currentProject.state.apiKeys?.grok || ''}
                                            onChange={e => setCurrentProjectState(p => ({...p, apiKeys: {...p.apiKeys, grok: e.target.value}}))}
                                            className="w-full bg-slate-700 border border-brand-gold/50 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-brand-gold"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-slate-400 mb-1">ZeroGPT (AI Detection)</label>
                                        <input
                                            type="password"
                                            placeholder="ZeroGPT API Key"
                                            value={currentProject.state.apiKeys?.zeroGpt || ''}
                                            onChange={e => setCurrentProjectState(p => ({...p, apiKeys: {...p.apiKeys, zeroGpt: e.target.value}}))}
                                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-slate-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-slate-500 text-center">
                                API keys are saved with your workflow and auto-save will sync them to the database.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <ArticleManager
                isOpen={isArticlesOpen}
                onClose={() => {
                    setIsArticlesOpen(false);
                    setFilterByClientId(undefined);
                }}
                filterByWebsite={currentWebsiteId}
                filterByClient={filterByClientId}
                wpCredentials={currentProject?.state.wpCredentials}
                wpContentType={currentProject?.state.wpContentType}
            />
            <TemplateLibrary
                isOpen={isTemplatesOpen}
                onClose={() => setIsTemplatesOpen(false)}
                currentWorkflowId={currentWorkflowId}
                currentWebsiteId={currentWebsiteId}
                onApplyTemplate={(template) => {
                    showNotification(`Applied template: ${template.name}`, 'success');
                    // Reload the current project to get updated data
                }}
            />
            <WorkflowNavigation
                isOpen={isWorkflowNavOpen}
                onClose={() => setIsWorkflowNavOpen(false)}
                currentWorkflowId={currentWorkflowId}
                onSelectWorkflow={async (workflow) => {
                    setCurrentWorkflowId(workflow.id);
                    setCurrentWebsiteId(workflow.website_id || undefined);
                    setCurrentWorkflowContext({
                        workflowName: workflow.name,
                        clientName: workflow.client_name,
                        websiteName: workflow.website_name,
                        isStandalone: !workflow.client_id,
                        projectName: undefined // Will be fetched if needed
                    });

                    // Load workflow state from database
                    try {
                        const response = await fetch(`/api/workflows/${workflow.id}`);
                        if (response.ok) {
                            const data = await response.json();
                            if (data.workflow && data.workflow.state && Object.keys(data.workflow.state).length > 0) {
                                // Load the saved state
                                setCurrentProjectState(() => data.workflow.state);
                                setHasUnsavedChanges(false);
                                showNotification(`Loaded workflow: ${workflow.name}`, 'success');
                            } else {
                                // No saved state, start fresh
                                showNotification(`Loaded workflow: ${workflow.name} (new)`, 'info');
                            }
                        }
                    } catch (error) {
                        console.error('Error loading workflow state:', error);
                        showNotification(`Loaded workflow: ${workflow.name}`, 'info');
                    }
                }}
                onCreateWorkflow={async (name, clientId, websiteId, personalProjectId) => {
                    // Create a new workflow in the database
                    try {
                        const res = await fetch('/api/workflows', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                name: name,
                                clientId: clientId || null,
                                websiteId: websiteId || null,
                                personalProjectId: personalProjectId || null,
                                state: {}
                            })
                        });
                        const data = await res.json();
                        if (data.workflow) {
                            setCurrentWorkflowId(data.workflow.id);
                            if (websiteId) setCurrentWebsiteId(websiteId);
                            setCurrentWorkflowContext({
                                workflowName: name,
                                clientName: data.workflow.client_name,
                                websiteName: data.workflow.website_name,
                                isStandalone: !clientId,
                                projectName: data.workflow.project_name
                            });
                            handleCreateNewProject();
                            showNotification(`Created new workflow: ${name}`, 'success');
                            setIsWorkflowNavOpen(false);
                        } else {
                            showNotification('Failed to create workflow', 'error');
                        }
                    } catch (err) {
                        console.error('Failed to create workflow:', err);
                        showNotification('Failed to create workflow', 'error');
                    }
                }}
            />
            <header className="mb-8 px-2 sm:px-0">
                {/* Top Bar with Logo and Navigation - Mobile: stacked, Desktop: side by side */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                    {/* Logo - Centered on mobile */}
                    <div className="flex items-center justify-center md:justify-start">
                        <div className="flex items-center">
                            {/* Logo SVG - Digi Branded AI style bars */}
                            <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2 md:mr-3 md:w-12 md:h-12">
                                <rect x="4" y="28" width="6" height="16" rx="1" fill="#00B4D8"/>
                                <rect x="12" y="22" width="6" height="22" rx="1" fill="#0096C7"/>
                                <rect x="20" y="16" width="6" height="28" rx="1" fill="#0077B6"/>
                                <rect x="28" y="10" width="6" height="34" rx="1" fill="#005F8A"/>
                                <rect x="36" y="4" width="6" height="40" rx="1" fill="#004A6E"/>
                                <path d="M6 30L14 24L22 18L30 12L38 6" stroke="#F5A623" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                                <circle cx="6" cy="30" r="3" fill="#F5A623"/>
                                <circle cx="14" cy="24" r="3" fill="#F5A623"/>
                                <circle cx="22" cy="18" r="3" fill="#F5A623"/>
                                <circle cx="30" cy="12" r="3" fill="#F5A623"/>
                                <circle cx="38" cy="6" r="3" fill="#F5A623"/>
                            </svg>
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold">
                                    <span className="text-brand-cyan">Prompt</span><span className="text-brand-gold">Flow</span>
                                </h1>
                                <p className="text-[10px] md:text-xs text-slate-400">Advanced Workflow Automator</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Buttons - Grid on mobile (4 columns), flex on desktop */}
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2 md:flex md:gap-2 md:flex-wrap justify-center md:justify-end">
                        <button
                            onClick={() => { setIsTrackerOpen(false); setIsWorkflowNavOpen(false); setIsArticlesOpen(false); setIsTemplatesOpen(false); setIsClientsOpen(false); setIsWebsitesOpen(false); setIsAnalyticsOpen(false); setIsAgencyOpen(true); }}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 bg-slate-900 text-brand-gold font-semibold py-1.5 px-1.5 md:py-2.5 md:px-4 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="Manage Clients & Locations"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span className="text-[10px] md:text-sm">Agency</span>
                        </button>
                        <button
                            onClick={() => { setIsTrackerOpen(false); setIsAgencyOpen(false); setIsArticlesOpen(false); setIsTemplatesOpen(false); setIsWorkflowNavOpen(false); setIsWebsitesOpen(false); setIsAnalyticsOpen(false); setIsClientsOpen(true); }}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 bg-slate-900 text-brand-gold font-semibold py-1.5 px-1.5 md:py-2.5 md:px-4 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="View All Clients"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className="text-[10px] md:text-sm">Clients</span>
                        </button>
                        <button
                            onClick={() => { setIsTrackerOpen(false); setIsAgencyOpen(false); setIsArticlesOpen(false); setIsTemplatesOpen(false); setIsClientsOpen(false); setIsWebsitesOpen(false); setIsAnalyticsOpen(false); setIsWorkflowNavOpen(true); }}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 bg-slate-900 text-brand-gold font-semibold py-1.5 px-1.5 md:py-2.5 md:px-4 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="Browse Workflows"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                            </svg>
                            <span className="text-[10px] md:text-sm">Workflows</span>
                        </button>
                        <button
                            onClick={() => { setIsTrackerOpen(false); setIsAgencyOpen(false); setIsArticlesOpen(false); setIsTemplatesOpen(false); setIsWorkflowNavOpen(false); setIsClientsOpen(false); setIsAnalyticsOpen(false); setIsWebsitesOpen(true); }}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 bg-slate-900 text-brand-gold font-semibold py-1.5 px-1.5 md:py-2.5 md:px-4 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="View All Websites"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                            <span className="text-[10px] md:text-sm">Websites</span>
                        </button>
                        <button
                            onClick={() => { setIsTrackerOpen(false); setIsAgencyOpen(false); setIsWorkflowNavOpen(false); setIsTemplatesOpen(false); setIsClientsOpen(false); setIsWebsitesOpen(false); setIsAnalyticsOpen(false); setIsArticlesOpen(true); }}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 bg-slate-900 text-brand-gold font-semibold py-1.5 px-1.5 md:py-2.5 md:px-4 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="View Workflow Results"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-[10px] md:text-sm whitespace-nowrap">Results</span>
                        </button>
                        <button
                            onClick={() => { setIsTrackerOpen(false); setIsAgencyOpen(false); setIsArticlesOpen(false); setIsWorkflowNavOpen(false); setIsClientsOpen(false); setIsWebsitesOpen(false); setIsAnalyticsOpen(false); setIsTemplatesOpen(true); }}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 bg-slate-900 text-brand-gold font-semibold py-1.5 px-1.5 md:py-2.5 md:px-4 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="Template Library"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[10px] md:text-sm">Templates</span>
                        </button>
                        <button
                            onClick={() => { setIsAgencyOpen(false); setIsArticlesOpen(false); setIsTemplatesOpen(false); setIsWorkflowNavOpen(false); setIsTrackerOpen(false); setIsClientsOpen(false); setIsWebsitesOpen(false); setIsAnalyticsOpen(true); }}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 bg-slate-900 text-brand-gold font-semibold py-1.5 px-1.5 md:py-2.5 md:px-4 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="Analytics Dashboard"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="text-[10px] md:text-sm">Analytics</span>
                        </button>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 bg-slate-900 text-brand-gold font-semibold py-1.5 px-1.5 md:py-2.5 md:px-4 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="Settings"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-[10px] md:text-sm">Settings</span>
                        </button>

                        {/* Pending Meta Notification Bell */}
                        <div className="relative hidden md:block">
                            <PendingMetaNotification
                                onOpenArticle={(articleId) => {
                                    setIsArticlesOpen(true);
                                    // The ArticleManager will handle opening the specific article
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Workflow Context Breadcrumb */}
                {currentWorkflowContext.workflowName && (
                    <div className="bg-card/50 rounded-lg px-4 py-3 border border-slate-700/50 shadow-card">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-sm">
                                {currentWorkflowContext.isStandalone ? (
                                    <>
                                        <span className="px-3 py-1 bg-purple-600/20 border border-purple-500/50 rounded-full text-purple-300 font-medium">
                                            Standalone
                                        </span>
                                        {currentWorkflowContext.projectName && (
                                            <>
                                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                                <span className="text-purple-400">{currentWorkflowContext.projectName}</span>
                                            </>
                                        )}
                                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                        <span className="text-white font-semibold">{currentWorkflowContext.workflowName}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="px-3 py-1 bg-brand-cyan/20 border border-brand-cyan/50 rounded-full text-brand-cyan font-medium">
                                            Client
                                        </span>
                                        {currentWorkflowContext.clientName && (
                                            <>
                                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                                <span className="text-brand-cyan">{currentWorkflowContext.clientName}</span>
                                            </>
                                        )}
                                        {currentWorkflowContext.websiteName && (
                                            <>
                                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                                <span className="text-brand-cyan-light">{currentWorkflowContext.websiteName}</span>
                                            </>
                                        )}
                                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                        <span className="text-white font-semibold">{currentWorkflowContext.workflowName}</span>
                                    </>
                                )}
                            </div>
                            {/* Save Workflow Button */}
                            <div className="flex items-center gap-3">
                                {lastSaveTime && (
                                    <span className="text-xs text-slate-400">
                                        Last saved: {lastSaveTime.toLocaleTimeString()}
                                    </span>
                                )}
                                <button
                                    onClick={() => saveWorkflowToDatabase(true)}
                                    disabled={isSaving || !hasUnsavedChanges}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition ${
                                        isSaving
                                            ? 'bg-slate-700 text-slate-400 cursor-wait'
                                            : hasUnsavedChanges
                                                ? 'bg-yellow-500 hover:bg-yellow-600 text-slate-900'
                                                : 'bg-brand-cyan text-white'
                                    }`}
                                >
                                    {isSaving ? (
                                        <>
                                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Saving...
                                        </>
                                    ) : hasUnsavedChanges ? (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                                            </svg>
                                            Save Workflow
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                            </svg>
                                            Saved
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            <main className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="flex flex-col gap-8">
                    {renderSection('1. Setup & Run', 'setup', <Icon type="settings" className="h-6 w-6"/>,
                        <div className="space-y-3">
                            {/* Row 1: AI Models - Full Width */}
                            <div className="space-y-2">
                                <p className="text-[10px] text-brand-gold mb-1">Test multiple models against the same workflow</p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-brand-gold mb-1 text-center">AI Model 1</label>
                                        <select
                                            value={currentProject.state.model}
                                            onChange={e => setCurrentProjectState(p => ({...p, model: e.target.value}))}
                                            className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-1 py-2 text-white text-xs focus:ring-2 focus:ring-brand-gold"
                                        >
                                            <optgroup label="Claude (Anthropic)">
                                                <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
                                                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                                                <option value="claude-opus-4-5-20251101">Claude Opus 4.5</option>
                                                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                                                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                                                <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                                            </optgroup>
                                            <optgroup label="GPT (OpenAI)">
                                                <option value="gpt-5.2-2025-12-11">GPT-5.2</option>
                                                <option value="gpt-5-mini-2025-08-07">GPT-5 Mini</option>
                                                <option value="gpt-5-nano-2025-08-07">GPT-5 Nano</option>
                                                <option value="gpt-4o">GPT-4o</option>
                                                <option value="gpt-4o-mini">GPT-4o Mini</option>
                                            </optgroup>
                                            <optgroup label="Gemini (Google)">
                                                <option value="gemini-3-pro-preview">Gemini 3.0 Pro (Latest)</option>
                                                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Thinking)</option>
                                                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                                                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Fastest)</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-brand-gold mb-1 text-center">AI Model 2</label>
                                        <select
                                            value={currentProject.state.model2 || 'not-in-use'}
                                            onChange={e => setCurrentProjectState(p => ({...p, model2: e.target.value}))}
                                            className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-1 py-2 text-white text-xs focus:ring-2 focus:ring-brand-gold"
                                        >
                                            <option value="not-in-use">Not In Use</option>
                                            <optgroup label="Claude (Anthropic)">
                                                <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
                                                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                                                <option value="claude-opus-4-5-20251101">Claude Opus 4.5</option>
                                                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                                                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                                                <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                                            </optgroup>
                                            <optgroup label="GPT (OpenAI)">
                                                <option value="gpt-5.2-2025-12-11">GPT-5.2</option>
                                                <option value="gpt-5-mini-2025-08-07">GPT-5 Mini</option>
                                                <option value="gpt-5-nano-2025-08-07">GPT-5 Nano</option>
                                                <option value="gpt-4o">GPT-4o</option>
                                                <option value="gpt-4o-mini">GPT-4o Mini</option>
                                            </optgroup>
                                            <optgroup label="Gemini (Google)">
                                                <option value="gemini-3-pro-preview">Gemini 3.0 Pro (Latest)</option>
                                                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Thinking)</option>
                                                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                                                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Fastest)</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-brand-gold mb-1 text-center">AI Model 3</label>
                                        <select
                                            value={currentProject.state.model3 || 'not-in-use'}
                                            onChange={e => setCurrentProjectState(p => ({...p, model3: e.target.value}))}
                                            className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-1 py-2 text-white text-xs focus:ring-2 focus:ring-brand-gold"
                                        >
                                            <option value="not-in-use">Not In Use</option>
                                            <optgroup label="Claude (Anthropic)">
                                                <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
                                                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                                                <option value="claude-opus-4-5-20251101">Claude Opus 4.5</option>
                                                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                                                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                                                <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                                            </optgroup>
                                            <optgroup label="GPT (OpenAI)">
                                                <option value="gpt-5.2-2025-12-11">GPT-5.2</option>
                                                <option value="gpt-5-mini-2025-08-07">GPT-5 Mini</option>
                                                <option value="gpt-5-nano-2025-08-07">GPT-5 Nano</option>
                                                <option value="gpt-4o">GPT-4o</option>
                                                <option value="gpt-4o-mini">GPT-4o Mini</option>
                                            </optgroup>
                                            <optgroup label="Gemini (Google)">
                                                <option value="gemini-3-pro-preview">Gemini 3.0 Pro (Latest)</option>
                                                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Thinking)</option>
                                                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                                                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Fastest)</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Filename + Import/Export */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-brand-gold mb-1">Filename Template</label>
                                    <input type="text" value={currentProject.state.fileNameTemplate} onChange={e => setCurrentProjectState(p => ({...p, fileNameTemplate: e.target.value}))} className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-brand-gold" />
                                </div>
                                {/* Right side: Import/Export */}
                                <div className="flex flex-col justify-end gap-2">
                                    <label className="block text-xs font-medium text-brand-gold text-center">Import / Export Workflow</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                const exportData = {
                                                    name: currentWorkflowContext.workflowName || currentProject.name,
                                                    exportedAt: new Date().toISOString(),
                                                    state: currentProject.state
                                                };
                                                const filename = `${(currentWorkflowContext.workflowName || currentProject.name).replace(/[^a-z0-9]/gi, '-').toLowerCase()}-workflow.json`;
                                                downloadProjectConfig(exportData, filename);
                                                showNotification('Workflow exported!', 'success');
                                            }}
                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-brand-cyan hover:bg-brand-cyan-dark rounded-lg text-slate-900 font-semibold text-xs transition"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                            Export
                                        </button>
                                        <label className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-brand-cyan hover:bg-brand-cyan-dark rounded-lg text-slate-900 font-semibold text-xs transition cursor-pointer">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                            Import
                                            <input
                                                type="file"
                                                accept=".json"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        try {
                                                            const text = await file.text();
                                                            const data = JSON.parse(text);
                                                            if (data.state) {
                                                                setCurrentProjectState(() => data.state);
                                                                showNotification('Workflow imported!', 'success');
                                                            } else {
                                                                showNotification('Invalid format.', 'error');
                                                            }
                                                        } catch (error) {
                                                            showNotification('Failed to import.', 'error');
                                                        }
                                                    }
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Project Notes + Add Items Row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Project Notes - 2/3 width, 2 columns */}
                                <div className="md:col-span-2 bg-slate-900 p-3 rounded-lg border-2 border-brand-gold">
                                    <h3 className="text-sm font-semibold text-brand-gold mb-2">Project Notes</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        <textarea
                                            value={(currentProject.state.projectNotes || '').split('\n---COL---\n')[0] || ''}
                                            onChange={e => {
                                                const cols = (currentProject.state.projectNotes || '').split('\n---COL---\n');
                                                cols[0] = e.target.value;
                                                setCurrentProjectState(p => ({...p, projectNotes: cols.join('\n---COL---\n')}));
                                            }}
                                            rows={4}
                                            placeholder="Notes column 1..."
                                            className="w-full bg-slate-900 border-2 border-brand-gold rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-brand-gold resize-y"
                                        />
                                        <textarea
                                            value={(currentProject.state.projectNotes || '').split('\n---COL---\n')[1] || ''}
                                            onChange={e => {
                                                const cols = (currentProject.state.projectNotes || '').split('\n---COL---\n');
                                                while (cols.length < 2) cols.push('');
                                                cols[1] = e.target.value;
                                                setCurrentProjectState(p => ({...p, projectNotes: cols.join('\n---COL---\n')}));
                                            }}
                                            rows={4}
                                            placeholder="Notes column 2..."
                                            className="w-full bg-slate-900 border-2 border-brand-gold rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-brand-gold resize-y"
                                        />
                                    </div>
                                </div>
                                {/* Add Items - 1/3 width */}
                                <div className="bg-slate-900 p-3 rounded-lg border border-brand-gold/50">
                                    <label htmlFor="manual-items" className="block text-sm font-medium text-brand-gold mb-1.5 text-center">
                                        To Start This Workflow Add Items <span className="text-xs text-brand-gold/60">(one per line)</span>
                                    </label>
                                    <textarea
                                        id="manual-items"
                                        rows={3}
                                        className="w-full bg-slate-900 border border-brand-gold/30 rounded-lg px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-brand-gold transition-all"
                                        placeholder="Topic A(H)&#10;Topic B(H)"
                                        value={manualItems}
                                        onChange={(e) => setManualItems(e.target.value)}
                                    />
                                    <div className="mt-2 flex flex-col gap-2">
                                        <button
                                            onClick={handleManualAddItems}
                                            className="w-full bg-brand-gold hover:bg-brand-gold-dark text-slate-900 font-bold py-2 px-3 rounded-lg transition text-xs"
                                        >
                                            Add Items from Text
                                        </button>
                                        <label htmlFor="file-upload" className="cursor-pointer text-xs text-center text-brand-gold hover:text-brand-gold-light transition">
                                            {fileName ? `File: ${fileName}` : 'Or, upload CSV'}
                                            <input id="file-upload" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <button onClick={processWorkflow} disabled={isRunDisabled} className={`w-full flex items-center justify-center font-bold py-4 px-6 rounded-xl transition-all btn-press border-2 ${isRunDisabled ? 'bg-slate-900 border-brand-cyan text-brand-cyan/50 cursor-not-allowed' : 'bg-gradient-to-r from-brand-cyan to-brand-cyan-dark hover:from-brand-cyan-dark hover:to-brand-cyan text-white border-transparent shadow-card hover:shadow-glow-cyan'}`}>
                                {isProcessing ? <Icon type="working" className="h-5 w-5 animate-spin mr-2" /> : <Icon type="play" className="h-5 w-5 mr-2" />}
                                {getRunButtonText()}
                            </button>
                        </div>
                    , true)}
                    
                    {items.length > 0 && renderSection('2. Loaded Items', 'loadedItems', <Icon type="document" className="h-6 w-6"/>,
                        <div className="space-y-2">
                            <p className="text-brand-gold">{items.length} item(s) loaded.</p>
                            <div className="max-h-60 overflow-y-auto bg-slate-900 rounded-lg p-2 border border-brand-gold/50">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-brand-gold uppercase bg-slate-900">
                                        <tr>
                                            <th scope="col" className="px-4 py-2.5 rounded-tl-lg">Item Name</th>
                                            <th scope="col" className="px-4 py-2.5 rounded-tr-lg">Tag</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map(s => (
                                            <tr key={s.id} className="border-b border-slate-700/50 hover:bg-slate-900 transition-colors">
                                                <td className="px-4 py-2 font-medium text-white">{s.name}</td>
                                                <td className="px-4 py-2"><span className="px-2 py-0.5 bg-brand-cyan/20 text-brand-cyan rounded-full text-xs">{s.tag || 'N/A'}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    , true)}
                    
                    {renderSection('Publishing (Example: WordPress)', 'wordpress', <Icon type="upload" className="h-6 w-6"/>,
                        <div className="space-y-4 p-4 bg-brand-gold/10 border border-brand-gold/30 rounded-lg">
                            <p className="text-brand-gold text-sm">
                                <strong className="font-bold">Security Warning:</strong> This is for testing only. Application Passwords should be handled by a secure backend in a real application, not entered in the browser.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-brand-gold mb-1.5">WordPress Site URL</label>
                                    <input type="text" placeholder="https://yourdomain.com" value={currentProject.state.wpCredentials.url} onChange={e => setCurrentProjectState(p => ({...p, wpCredentials: {...p.wpCredentials, url: e.target.value}}))} className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2.5 text-white focus:ring-2 focus:ring-brand-gold transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-gold mb-1.5">Content Type</label>
                                    <select value={currentProject.state.wpContentType} onChange={e => setCurrentProjectState(p => ({...p, wpContentType: e.target.value as WpContentType}))} className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2.5 text-white focus:ring-2 focus:ring-brand-gold transition-all">
                                        <option value="pages">Page</option>
                                        <option value="posts">Post</option>
                                    </select>
                                </div>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-brand-gold mb-1.5">Page/Post Title Template</label>
                                <input
                                    type="text"
                                    value={currentProject.state.wpTitleTemplate}
                                    onChange={e => setCurrentProjectState(p => ({...p, wpTitleTemplate: e.target.value}))}
                                    className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2.5 text-white font-mono text-xs focus:ring-2 focus:ring-brand-gold transition-all"
                                />
                                <p className="text-xs text-brand-gold/70 mt-1">
                                    Use variables like {'<item_name>'} or {'{city}'}.
                                </p>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-brand-gold mb-1.5">WordPress Username</label>
                                    <input type="text" placeholder="Your WP Username" value={currentProject.state.wpCredentials.user} onChange={e => setCurrentProjectState(p => ({...p, wpCredentials: {...p.wpCredentials, user: e.target.value}}))} className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2.5 text-white focus:ring-2 focus:ring-brand-gold transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-gold mb-1.5">WP Application Password</label>
                                    <input type="password" placeholder="xxxx xxxx xxxx xxxx" value={currentProject.state.wpCredentials.password} onChange={e => setCurrentProjectState(p => ({...p, wpCredentials: {...p.wpCredentials, password: e.target.value}}))} className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2.5 text-white focus:ring-2 focus:ring-brand-gold transition-all" />
                                </div>
                            </div>
                            <p className="text-xs text-brand-gold/70">Find Application Passwords under `Users &gt; Your Profile` in your WordPress admin dashboard.</p>

                            {/* Meta SEO Generation Settings */}
                            <div className="mt-6 pt-6 border-t border-pink-500/30">
                                <h3 className="text-lg font-semibold text-pink-400 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                    Meta SEO Generation
                                </h3>
                                <p className="text-xs text-pink-400/70 mb-4">
                                    When a prompt has "Generate Meta SEO" enabled, these settings control how meta titles and descriptions are generated.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-medium text-pink-400 mb-1.5">Meta Title Options</label>
                                        <select
                                            value={currentProject.state.metaTitleCount || 3}
                                            onChange={e => setCurrentProjectState(p => ({...p, metaTitleCount: parseInt(e.target.value)}))}
                                            className="w-full bg-slate-900 border border-pink-500/50 rounded-lg px-3 py-2.5 text-white focus:ring-2 focus:ring-pink-500 transition-all"
                                        >
                                            <option value="1">1 (Auto-push to SEO)</option>
                                            <option value="2">2 (Draft mode - select one)</option>
                                            <option value="3">3 (Draft mode - select one)</option>
                                            <option value="5">5 (Draft mode - select one)</option>
                                        </select>
                                        <p className="text-xs text-pink-400/50 mt-1">1 = auto-push, 2+ = choose from options</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-pink-400 mb-1.5">Meta Description Options</label>
                                        <select
                                            value={currentProject.state.metaDescriptionCount || 3}
                                            onChange={e => setCurrentProjectState(p => ({...p, metaDescriptionCount: parseInt(e.target.value)}))}
                                            className="w-full bg-slate-900 border border-pink-500/50 rounded-lg px-3 py-2.5 text-white focus:ring-2 focus:ring-pink-500 transition-all"
                                        >
                                            <option value="1">1 (Auto-push to SEO)</option>
                                            <option value="2">2 (Draft mode - select one)</option>
                                            <option value="3">3 (Draft mode - select one)</option>
                                            <option value="5">5 (Draft mode - select one)</option>
                                        </select>
                                        <p className="text-xs text-pink-400/50 mt-1">1 = auto-push, 2+ = choose from options</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-pink-400 mb-1.5">Meta Title Generation Prompt</label>
                                        <textarea
                                            value={currentProject.state.metaTitlePrompt || ''}
                                            onChange={e => setCurrentProjectState(p => ({...p, metaTitlePrompt: e.target.value}))}
                                            rows={3}
                                            className="w-full bg-slate-900 border border-pink-500/50 rounded-lg px-3 py-2.5 text-white font-mono text-xs focus:ring-2 focus:ring-pink-500 transition-all resize-y"
                                            placeholder="Prompt for generating meta titles..."
                                        />
                                        <p className="text-xs text-pink-400/50 mt-1">Use {'{count}'} and {'{article_content}'} placeholders</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-pink-400 mb-1.5">Meta Description Generation Prompt</label>
                                        <textarea
                                            value={currentProject.state.metaDescriptionPrompt || ''}
                                            onChange={e => setCurrentProjectState(p => ({...p, metaDescriptionPrompt: e.target.value}))}
                                            rows={3}
                                            className="w-full bg-slate-900 border border-pink-500/50 rounded-lg px-3 py-2.5 text-white font-mono text-xs focus:ring-2 focus:ring-pink-500 transition-all resize-y"
                                            placeholder="Prompt for generating meta descriptions..."
                                        />
                                        <p className="text-xs text-pink-400/50 mt-1">Use {'{count}'} and {'{article_content}'} placeholders</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                     {renderSection('3. Tag Manager', 'tags', <Icon type="settings" className="h-6 w-6"/>,
                        <div className="space-y-3">
                             <div className="flex gap-2">
                                <input type="text" placeholder="New Tag Name (e.g. H)" value={newTagName} onChange={e => setNewTagName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-brand-gold transition-all"/>
                                <button onClick={addTag} className="px-4 bg-brand-cyan hover:bg-brand-cyan-dark rounded-lg text-white font-semibold transition">Add</button>
                            </div>
                            <div className="flex flex-wrap gap-2">{currentProject.state.tags.map(t => (<div key={t.id} className="bg-brand-gold/20 border border-brand-gold/50 rounded-full px-3 py-1 flex items-center gap-2 text-sm text-brand-gold"><span>{t.name}</span><button onClick={() => removeTag(t.id)} className="text-brand-gold/60 hover:text-white transition"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>))}</div>
                        </div>
                     )}

                    {renderSection('4. Workflow Variables', 'placeholders', <Icon type="info" className="h-6 w-6"/>,
                        <div className="space-y-6">
                            {/* Workflow Notes Section - 3 columns */}
                            <div className="bg-slate-900 p-4 rounded-lg border-2 border-brand-gold">
                                <h3 className="text-sm font-semibold text-brand-gold mb-2">Workflow Notes</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    <textarea
                                        value={(currentProject.state.workflowNotes || '').split('\n---COL---\n')[0] || ''}
                                        onChange={e => {
                                            const cols = (currentProject.state.workflowNotes || '').split('\n---COL---\n');
                                            cols[0] = e.target.value;
                                            setCurrentProjectState(p => ({...p, workflowNotes: cols.join('\n---COL---\n')}));
                                        }}
                                        rows={3}
                                        placeholder="Notes column 1..."
                                        className="w-full bg-slate-900 border-2 border-brand-gold rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-brand-gold resize-y"
                                    />
                                    <textarea
                                        value={(currentProject.state.workflowNotes || '').split('\n---COL---\n')[1] || ''}
                                        onChange={e => {
                                            const cols = (currentProject.state.workflowNotes || '').split('\n---COL---\n');
                                            while (cols.length < 2) cols.push('');
                                            cols[1] = e.target.value;
                                            setCurrentProjectState(p => ({...p, workflowNotes: cols.join('\n---COL---\n')}));
                                        }}
                                        rows={3}
                                        placeholder="Notes column 2..."
                                        className="w-full bg-slate-900 border-2 border-brand-gold rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-brand-gold resize-y"
                                    />
                                    <textarea
                                        value={(currentProject.state.workflowNotes || '').split('\n---COL---\n')[2] || ''}
                                        onChange={e => {
                                            const cols = (currentProject.state.workflowNotes || '').split('\n---COL---\n');
                                            while (cols.length < 3) cols.push('');
                                            cols[2] = e.target.value;
                                            setCurrentProjectState(p => ({...p, workflowNotes: cols.join('\n---COL---\n')}));
                                        }}
                                        rows={3}
                                        placeholder="Notes column 3..."
                                        className="w-full bg-slate-900 border-2 border-brand-gold rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-brand-gold resize-y"
                                    />
                                </div>
                            </div>

                            {/* Global Variables */}
                            <div className="bg-slate-900 p-4 rounded-lg border-2 border-brand-gold">
                                <h3 className="text-lg font-semibold text-brand-gold mb-2 border-b border-brand-gold/30 pb-1">Global Variables</h3>
                                {selectedPlaceholders.size > 0 && (
                                    <div className="bg-slate-900 p-3 rounded-lg mb-3 flex items-center gap-3 border border-brand-gold/50">
                                        <span className="text-sm font-semibold text-brand-gold">{selectedPlaceholders.size} selected</span>
                                        <select value={bulkActionTag} onChange={e => setBulkActionTag(e.target.value)} className="bg-slate-900 border border-brand-gold/50 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-brand-gold">
                                            <option value="">Select Tag...</option>
                                            {currentProject.state.tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                        </select>
                                        <button onClick={handleBulkTagPlaceholders} disabled={!bulkActionTag} className="px-3 py-1.5 bg-brand-cyan hover:bg-brand-cyan-dark rounded-lg text-white text-sm font-semibold disabled:bg-slate-600 transition">Apply Tag</button>
                                    </div>
                                )}
                                {/* Column Headers */}
                                <div className="grid grid-cols-[auto,1fr,1fr,1fr,auto] gap-2 items-center mb-2 text-xs text-brand-gold/70 font-medium">
                                    <div className="w-4"></div>
                                    <div>Global Variable Placeholder Name</div>
                                    <div>Value</div>
                                    <div>Placeholder (live preview)</div>
                                    <div className="w-10"></div>
                                </div>
                                <div className="space-y-2">
                                {currentProject.state.placeholders.filter(p=>!p.tag).map(p => (<div key={p.id} className="grid grid-cols-[auto,1fr,1fr,1fr,auto] gap-2 items-center">
                                    <input type="checkbox" checked={selectedPlaceholders.has(p.id)} onChange={() => togglePlaceholderSelection(p.id)} className="form-checkbox h-4 w-4 bg-slate-900 border-brand-gold text-brand-gold focus:ring-brand-gold rounded"/>
                                    <input type="text" placeholder="variable_name" value={p.key} onChange={e => handleUpdatePlaceholder(p.id, 'key', e.target.value)} className="bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-gold text-sm transition-all"/>
                                    <input type="text" placeholder="value" value={p.value} onChange={e => handleUpdatePlaceholder(p.id, 'value', e.target.value)} className="bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-gold text-sm transition-all"/>
                                    <div className="bg-slate-900 border border-brand-gold/30 rounded-lg px-3 py-2 text-brand-gold font-mono text-sm">{`{${p.key || ''}}`}</div>
                                    <button onClick={() => handleDeletePlaceholder(p.id)} className="p-2 bg-red-600/50 hover:bg-red-600 rounded-lg text-white transition"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                </div>))}
                                </div>
                                <button onClick={() => handleAddPlaceholder()} className="mt-3 text-brand-gold hover:text-brand-gold-light font-semibold text-sm transition">+ Add Global Variable</button>
                            </div>

                            {/* Tagged Variables */}
                            <div className="bg-slate-900 p-4 rounded-lg border-2 border-brand-gold">
                                <h3 className="text-lg font-semibold text-brand-gold mb-2 border-b border-brand-gold/30 pb-1">Tagged Variables</h3>
                                {currentProject.state.tags.map((tag, tagIndex) => (
                                    <div key={tag.id} className={`mb-4 ${tagIndex > 0 ? 'pt-4 border-t-2 border-brand-gold' : ''}`}>
                                        <p className="font-bold text-brand-gold text-sm mb-2">Tag: {tag.name}</p>
                                        {/* Column Headers */}
                                        <div className="grid grid-cols-[1fr,1fr,1fr,auto] gap-2 items-center mb-2 text-xs text-brand-gold/70 font-medium">
                                            <div>Tag Variable Placeholder Name</div>
                                            <div>Value</div>
                                            <div>Placeholder (live preview)</div>
                                            <div className="w-10"></div>
                                        </div>
                                        <div className="space-y-2">
                                            {currentProject.state.placeholders.filter(p=>p.tag===tag.name).map(p => (<div key={p.id} className="grid grid-cols-[1fr,1fr,1fr,auto] gap-2 items-center">
                                                <input type="text" placeholder="variable_name" value={p.key} onChange={e => handleUpdatePlaceholder(p.id, 'key', e.target.value)} className="bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-gold transition-all"/>
                                                <input type="text" placeholder="value" value={p.value} onChange={e => handleUpdatePlaceholder(p.id, 'value', e.target.value)} className="bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-gold transition-all"/>
                                                <div className="bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2 text-brand-gold font-mono text-sm">{`{${p.key || ''}{${tag.name}}}`}</div>
                                                <div className="relative group">
                                                    <button className="p-2 text-brand-gold hover:text-white transition">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                                                    </button>
                                                    <div className="absolute right-0 bottom-full z-10 mb-2 w-max bg-slate-900 border border-brand-gold/50 text-white text-xs rounded-lg shadow-card-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                                                        <button onClick={() => handleMakePlaceholderUniversal(p.id)} className="block w-full text-left px-3 py-2 hover:bg-slate-700 rounded-t-lg transition">Make Global</button>
                                                        <button onClick={() => handleDeletePlaceholder(p.id)} className="block w-full text-left px-3 py-2 hover:bg-slate-700 rounded-b-lg text-red-400 transition">Delete Variable</button>
                                                    </div>
                                                </div>
                                            </div>))}
                                        </div>
                                        <button onClick={() => handleAddPlaceholder(tag.name)} className="mt-2 text-brand-gold hover:text-brand-gold-light font-semibold text-sm ml-1 transition">+ Add Variable for Tag: {tag.name}</button>
                                    </div>
                                ))}
                            </div>

                            {/* Prompt Output Variables */}
                            <div className="bg-slate-900 p-4 rounded-lg border-2 border-brand-gold">
                                <h3 className="text-lg font-semibold text-brand-gold mb-2 border-b border-brand-gold/30 pb-1">Prompt Output Variables <span className="text-xs text-brand-gold/60 font-mono">[output_key]</span> <span className="text-xs text-brand-gold/60">(Read-only)</span></h3>
                                <p className="text-[10px] text-brand-gold/70 mb-2">These are generated from the 'Output Key' from the Prompt Workflows for use in later prompts like: <span className="font-mono text-brand-gold">[output_key]</span></p>
                                <div className="flex flex-wrap gap-2">{currentProject.state.promptTemplates.map(p=>(<div key={p.id} className="bg-brand-cyan/10 border-2 border-brand-cyan rounded-full px-3 py-1 text-sm font-mono text-brand-cyan">[{p.outputKey}]</div>))}</div>
                            </div>

                            {/* Option Variables */}
                            <div className="bg-slate-900 p-4 rounded-lg border-2 border-brand-gold">
                                <h3 className="text-lg font-semibold text-brand-gold mb-2 border-b border-brand-gold/30 pb-1">Option Variables <span className="text-xs text-brand-gold/60 font-mono">?key:count?</span></h3>
                                <p className="text-xs text-brand-gold/70 mb-2">Generate multiple options for the user to choose from. AI will create the specified number of options based on your prompt.</p>
                                <div className="space-y-3">
                                    {(currentProject.state.optionVariables || []).map(ov => (
                                        <div key={ov.id} className="bg-slate-900 p-3 rounded-lg border border-brand-gold/50 space-y-2">
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="text"
                                                    placeholder="Variable name (e.g., meta_title)"
                                                    value={ov.key}
                                                    onChange={e => handleUpdateOptionVariable(ov.id, 'key', e.target.value)}
                                                    className="flex-1 bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-brand-gold transition-all"
                                                />
                                                <div className="flex items-center gap-2 bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2">
                                                    <span className="text-xs text-brand-gold">Options:</span>
                                                    <input
                                                        type="range"
                                                        min="1"
                                                        max="10"
                                                        value={ov.optionCount}
                                                        onChange={e => handleUpdateOptionVariable(ov.id, 'optionCount', parseInt(e.target.value))}
                                                        className="w-20 accent-yellow-500"
                                                    />
                                                    <span className="text-sm font-bold text-brand-gold w-4">{ov.optionCount}</span>
                                                </div>
                                                <button onClick={() => handleDeleteOptionVariable(ov.id)} className="p-2 bg-red-600/50 hover:bg-red-600 rounded-lg text-white transition">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                </button>
                                            </div>
                                            <textarea
                                                placeholder="Prompt for generating options (e.g., Generate optimized meta titles for this article about <item_name>...)"
                                                value={ov.prompt}
                                                onChange={e => handleUpdateOptionVariable(ov.id, 'prompt', e.target.value)}
                                                rows={3}
                                                className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-gold transition-all resize-y"
                                            />
                                            <div className="text-xs text-brand-gold/70">
                                                Use in prompts as: <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-brand-gold/30">?{ov.key || 'key'}:{ov.optionCount}?</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={handleAddOptionVariable} className="mt-3 text-brand-gold hover:text-brand-gold-light font-semibold text-sm transition">+ Add Option Variable</button>
                            </div>
                        </div>
                    )}

                    {renderSection('5. Conditional Snippets', 'snippets', <Icon type="document" className="h-6 w-6"/>,
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-brand-gold mb-2 border-b border-brand-gold/30 pb-1">Conditional Snippets <span className="text-xs text-brand-gold/60 font-mono">{'{{{key}}}'}</span></h3>
                             {currentProject.state.taggedSnippets.map(s => (
                                <div key={s.id} className="bg-slate-900 p-4 rounded-lg space-y-2 border border-brand-gold/50">
                                    <div className="flex gap-2 items-center">
                                        <input type="text" placeholder={`{{{SnippetName}}}`} value={s.key} onChange={e => handleSnippetChange(s.id, 'key', e.target.value)} className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2.5 font-semibold focus:ring-2 focus:ring-brand-gold transition-all"/>
                                        <button onClick={() => removeSnippet(s.id)} className="p-2.5 bg-red-600/50 hover:bg-red-600 rounded-lg text-white transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                    </div>
                                    <div className={`grid grid-cols-1 md:grid-cols-${Math.min(currentProject.state.tags.length, 3)} gap-2`}>
                                        {currentProject.state.tags.map(tag => (
                                            <div key={tag.id}>
                                                <label className="block text-xs font-medium text-brand-gold mb-1.5">For Tag: <span className="text-brand-gold">{tag.name}</span></label>
                                                <textarea placeholder={`Value for tag: (${tag.name})`} value={s.values[tag.name] || ''} onChange={e => handleSnippetChange(s.id, 'values', { ...s.values, [tag.name]: e.target.value })} rows={3} className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-brand-gold transition-all" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                             ))}
                             <button onClick={addSnippet} className="text-brand-gold hover:text-brand-gold-light font-semibold text-sm transition">+ Add Snippet</button>
                        </div>
                    )}
                </div>

                {/* Right Column */}
                <div className="flex flex-col gap-8">
                    {renderSection('6. Prompt Workflow', 'prompts', <Icon type="document" className="h-6 w-6"/>,
                        <div className="space-y-4">
                            {currentProject.state.promptTemplates.map((prompt, index) => (
                                <div key={prompt.id} draggable onDragStart={() => draggedPromptId.current = prompt.id} onDragOver={e => e.preventDefault()} onDrop={() => handleReorderPrompts(draggedPromptId.current!, prompt.id)}
                                    className="bg-slate-900 p-4 rounded-lg space-y-3 border border-brand-gold/50 cursor-grab active:cursor-grabbing hover:border-brand-gold/70 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <span className="text-brand-gold font-bold text-lg">{index + 1}</span>
                                        <input type="text" value={prompt.name} onChange={e => handleUpdatePrompt(prompt.id, 'name', e.target.value)} placeholder="Prompt Name" className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2.5 font-semibold focus:ring-2 focus:ring-brand-gold transition-all"/>
                                        <input type="text" value={prompt.outputKey} onChange={e => handleUpdatePrompt(prompt.id, 'outputKey', e.target.value)} placeholder="Output Key" className="w-1/3 bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2.5 font-mono text-xs focus:ring-2 focus:ring-brand-gold transition-all" title="Output Placeholder Key"/>
                                        <button onClick={() => handleDuplicatePrompt(prompt.id)} className="p-2 text-brand-gold hover:text-white transition" title="Duplicate Prompt">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                        </button>
                                        <button onClick={() => handleDeletePrompt(prompt.id)} className="p-2.5 bg-red-600/50 hover:bg-red-600 rounded-lg text-white transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                    </div>
                                    <textarea draggable={false} onDragStart={(e) => e.stopPropagation()} ref={el => promptTextareaRefs.current[prompt.id] = el} value={prompt.template} onChange={e => handleUpdatePrompt(prompt.id, 'template', e.target.value)} onContextMenu={(e) => { e.preventDefault(); setVariableContextMenu({ promptId: prompt.id, x: e.clientX, y: e.clientY }); }} rows={8} className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2.5 text-white font-mono text-xs focus:ring-2 focus:ring-brand-gold transition-all resize-y min-h-[100px]"></textarea>
                                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900 rounded-lg border border-brand-gold/30">
                                        <span className="text-xs text-brand-gold/60 w-full mb-1">Click to insert:</span>
                                        {/* Item Name */}
                                        <button type="button" onClick={() => insertVariableIntoPrompt(prompt.id, '<item_name>')} className="px-2 py-1 text-xs font-mono bg-brand-cyan/20 hover:bg-brand-cyan/40 border border-brand-cyan/50 rounded text-brand-cyan transition">{'<item_name>'}</button>
                                        {/* Global Variables - only show if key is not empty */}
                                        {currentProject.state.placeholders.filter(p => !p.tag && p.key).map(p => (
                                            <button key={p.id} type="button" onClick={() => insertVariableIntoPrompt(prompt.id, `{${p.key}}`)} className="px-2 py-1 text-xs font-mono bg-brand-gold/20 hover:bg-brand-gold/40 border border-brand-gold/50 rounded text-brand-gold transition">{`{${p.key}}`}</button>
                                        ))}
                                        {/* Tagged Variables - only show if key is not empty */}
                                        {currentProject.state.placeholders.filter(p => p.tag && p.key).map(p => (
                                            <button key={p.id} type="button" onClick={() => insertVariableIntoPrompt(prompt.id, `{${p.key}{${p.tag}}}`)} className="px-2 py-1 text-xs font-mono bg-orange-500/20 hover:bg-orange-500/40 border border-orange-500/50 rounded text-orange-400 transition">{`{${p.key}{${p.tag}}}`}</button>
                                        ))}
                                        {/* Conditional Snippets - only show if key is not empty */}
                                        {currentProject.state.taggedSnippets.filter(s => s.key).map(s => (
                                            <button key={s.id} type="button" onClick={() => insertVariableIntoPrompt(prompt.id, `{{{${s.key}}}}`)} className="px-2 py-1 text-xs font-mono bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/50 rounded text-purple-400 transition">{`{{{${s.key}}}}`}</button>
                                        ))}
                                        {/* Prompt Output Variables - only show if outputKey is not empty */}
                                        {currentProject.state.promptTemplates.filter(p => p.outputKey).map(p => (
                                            <button key={p.id} type="button" onClick={() => insertVariableIntoPrompt(prompt.id, `[${p.outputKey}]`)} className="px-2 py-1 text-xs font-mono bg-green-500/20 hover:bg-green-500/40 border border-green-500/50 rounded text-green-400 transition">{`[${p.outputKey}]`}</button>
                                        ))}
                                        {/* Option Variables - only show if key is not empty */}
                                        {(currentProject.state.optionVariables || []).filter(ov => ov.key).map(ov => (
                                            <button key={ov.id} type="button" onClick={() => insertVariableIntoPrompt(prompt.id, `?${ov.key}:${ov.optionCount}?`)} className="px-2 py-1 text-xs font-mono bg-pink-500/20 hover:bg-pink-500/40 border border-pink-500/50 rounded text-pink-400 transition">{`?${ov.key}:${ov.optionCount}?`}</button>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-brand-gold">
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-1.5 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={prompt.generateMetaFromOutput || false}
                                                    onChange={e => handleUpdatePrompt(prompt.id, 'generateMetaFromOutput', e.target.checked)}
                                                    className="w-3.5 h-3.5 rounded border-pink-500/50 text-pink-500 focus:ring-pink-500 bg-slate-900"
                                                />
                                                <span className="text-pink-400 group-hover:text-pink-300 transition">Generate Meta SEO</span>
                                            </label>
                                        </div>
                                        <div>
                                            <label htmlFor={`output-action-${prompt.id}`} className="mr-2 font-semibold">Output Action:</label>
                                            <select id={`output-action-${prompt.id}`} value={prompt.outputAction || ''} onChange={e => handleUpdatePrompt(prompt.id, 'outputAction', e.target.value)} className="bg-slate-900 border border-brand-gold/50 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-2 focus:ring-brand-gold transition-all">
                                                <option value="">(none)</option>
                                                <option value="addToFinal">Add to final document</option>
                                                <option value="download">Mark for individual download</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div className="flex justify-between items-center">
                                <button onClick={handleAddPrompt} className="text-brand-gold hover:text-brand-gold-light font-semibold text-sm transition">+ Add Prompt Step</button>
                            </div>
                        </div>
                    )}
                    <div className="bg-card rounded-xl shadow-glow-cyan card-3d border-2 border-brand-cyan">
                        <h2 className={`text-xl font-bold flex items-center text-brand-cyan p-5`}><Icon type="info" className="h-6 w-6"/><span className="ml-3">Processing Log</span></h2>
                        <div className="p-5 pt-0 border-t border-brand-cyan/30">
                            <div ref={logContainerRef} className="h-96 bg-slate-900/70 rounded-lg p-4 overflow-y-auto font-mono text-sm space-y-2 border border-brand-gold/50">
                                {logs.map(log => (<div key={log.id} className={`flex items-start ${{ [LogStatus.INFO]: 'text-blue-400', [LogStatus.SUCCESS]: 'text-green-400', [LogStatus.ERROR]: 'text-red-400', [LogStatus.WORKING]: 'text-yellow-400 animate-pulse'}[log.status]}`}>{{ [LogStatus.INFO]: <Icon type="info" className="h-4 w-4 mr-2 flex-shrink-0"/>, [LogStatus.SUCCESS]: <Icon type="success" className="h-4 w-4 mr-2 flex-shrink-0"/>, [LogStatus.ERROR]: <Icon type="error" className="h-4 w-4 mr-2 flex-shrink-0"/>, [LogStatus.WORKING]: <Icon type="working" className="h-4 w-4 mr-2 flex-shrink-0 animate-spin"/>}[log.status]}<span className="flex-1"><span className="text-gray-500 mr-2">{log.timestamp}</span>{log.message}</span></div>))}
                                {logs.length === 0 && <div className="text-gray-500">Logs will appear here once processing starts.</div>}
                            </div>
                        </div>
                    </div>

                    {/* Pending Selections Section */}
                    {pendingResults.length > 0 && (
                        <div className="bg-card rounded-xl shadow-glow-gold card-3d border-2 border-pink-500">
                            <div className="p-5 flex items-center justify-between border-b border-pink-500/30">
                                <h2 className="text-xl font-bold flex items-center text-pink-400">
                                    <svg className="h-6 w-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    <span>Pending Selections ({pendingResults.length})</span>
                                </h2>
                                <button
                                    onClick={handleAiChooseAllPending}
                                    className="flex items-center bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-bold py-2 px-4 rounded-lg transition-all text-sm"
                                >
                                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                    AI Choose All
                                </button>
                            </div>
                            <div className="p-5 space-y-4">
                                {pendingResults.map(pending => (
                                    <div key={pending.id} className="bg-slate-900 rounded-lg border border-pink-500/50 overflow-hidden">
                                        <div className="p-4 border-b border-pink-500/30 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-bold text-white">{pending.item.name}</h3>
                                                <p className="text-xs text-pink-400/70">{pending.optionSelections.filter(os => os.selectedIndex === null).length} option(s) need selection</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleAiChooseAllForPending(pending.id)}
                                                    className="px-3 py-1.5 bg-pink-500/20 hover:bg-pink-500/40 border border-pink-500/50 rounded-lg text-pink-400 text-sm transition"
                                                >
                                                    AI Choose All
                                                </button>
                                                <button
                                                    onClick={() => handleFinalizePendingResult(pending.id)}
                                                    className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/40 border border-green-500/50 rounded-lg text-green-400 text-sm transition"
                                                >
                                                    Finalize
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-4 space-y-4">
                                            {pending.optionSelections.map(selection => (
                                                <div key={selection.variableKey} className="bg-slate-900 rounded-lg p-3 border border-pink-500/30">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h4 className="font-semibold text-pink-400">?{selection.variableKey}?</h4>
                                                        <button
                                                            onClick={() => handleAiChooseOption(pending.id, selection.variableKey)}
                                                            className="text-xs px-2 py-1 bg-pink-500/20 hover:bg-pink-500/40 border border-pink-500/50 rounded text-pink-400 transition"
                                                        >
                                                            AI Choose
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {selection.options.map((option, idx) => (
                                                            <label
                                                                key={idx}
                                                                className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition ${selection.selectedIndex === idx ? 'bg-pink-500/30 border border-pink-500' : 'bg-slate-900 border border-transparent hover:border-pink-500/50'}`}
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    name={`${pending.id}-${selection.variableKey}`}
                                                                    checked={selection.selectedIndex === idx}
                                                                    onChange={() => handleSelectOption(pending.id, selection.variableKey, idx)}
                                                                    className="mt-1 accent-pink-500"
                                                                />
                                                                <span className="text-sm text-white">{option}</span>
                                                            </label>
                                                        ))}
                                                        {/* Custom option */}
                                                        <label
                                                            className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition ${selection.selectedIndex === -1 ? 'bg-pink-500/30 border border-pink-500' : 'bg-slate-900 border border-transparent hover:border-pink-500/50'}`}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name={`${pending.id}-${selection.variableKey}`}
                                                                checked={selection.selectedIndex === -1}
                                                                onChange={() => handleSelectOption(pending.id, selection.variableKey, -1)}
                                                                className="mt-1 accent-pink-500"
                                                            />
                                                            <div className="flex-1">
                                                                <span className="text-sm text-pink-400/70 block mb-1">Custom:</span>
                                                                <input
                                                                    type="text"
                                                                    value={selection.customValue}
                                                                    onChange={(e) => handleCustomOptionValue(pending.id, selection.variableKey, e.target.value)}
                                                                    placeholder="Enter custom value..."
                                                                    className="w-full bg-slate-900 border border-pink-500/50 rounded px-2 py-1 text-sm text-white focus:ring-1 focus:ring-pink-500 transition"
                                                                    onClick={() => handleSelectOption(pending.id, selection.variableKey, -1)}
                                                                />
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                     {results.length > 0 && <div className="bg-card rounded-xl shadow-glow-cyan card-3d border-2 border-brand-cyan">
                        <div className="p-5 flex items-center justify-between border-b border-brand-cyan/30">
                            <h2 className={`text-xl font-bold flex items-center text-brand-gold`}><Icon type="success" className="h-6 w-6"/><span className="ml-3">Results ({results.length})</span></h2>
                            <button onClick={handleDownloadAll} className="flex items-center bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-dark hover:to-brand-gold text-white font-bold py-2.5 px-4 rounded-lg transition-all shadow-card hover:shadow-glow-gold text-sm btn-press"><Icon type="download" className="h-5 w-5 mr-2"/>Download All as ZIP</button>
                        </div>
                         <div className="p-5">
                            <div className="max-h-[40rem] overflow-y-auto space-y-3 pr-2">
                               {results.map(result => {
                                    const PublishButton = () => {
                                        switch (result.wpStatus) {
                                            case 'publishing':
                                                return <button className="p-2 bg-yellow-600 rounded-md transition" title="Publishing Elementor page..."><Icon type="working" className="h-5 w-5 animate-spin"/></button>;
                                            case 'published':
                                                return <a href={result.wpLink} target="_blank" rel="noopener noreferrer" className="p-2 bg-green-600 hover:bg-green-500 rounded-md transition" title="View Elementor page"><Icon type="success" className="h-5 w-5"/></a>;
                                            case 'error':
                                                return <button onClick={() => handlePublishToWordPress(result, true)} className="p-2 bg-red-600 hover:bg-red-500 rounded-md transition" title={`Error: ${result.wpError}\nClick to retry.`}><Icon type="error" className="h-5 w-5"/></button>;
                                            default:
                                                return <button onClick={() => handlePublishToWordPress(result, true)} className="p-2 bg-green-700 hover:bg-green-600 rounded-md transition" title="Publish as Elementor page"><Icon type="upload" className="h-5 w-5"/></button>;
                                        }
                                    };
                                    return (
                                        <div key={result.item.id} className="bg-slate-900 p-4 rounded-lg border border-brand-gold/30 hover:border-brand-gold/50 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold text-white">{result.item.name}</p>
                                                    <div className="flex items-center text-xs text-slate-400 mt-1">
                                                        <span className={`px-2.5 py-0.5 rounded-full mr-2 text-white font-medium ${result.status === 'PASSED' ? 'bg-green-600/80' : 'bg-red-600/80'}`}>{result.status}</span>
                                                        <span>AI: {result.aiScore}%</span><span className="mx-2 text-slate-600">|</span><span>{result.wordCount} words</span>
                                                    </div>
                                                </div>
                                                <div className="flex space-x-2">
                                                    <button onClick={() => handleDownload(result.txtContent, getFilename(result.item, result.status, 'txt'), 'text/plain')} className="p-2 bg-slate-700 hover:bg-brand-cyan rounded-lg transition" title="Download Combined .txt"><Icon type="document" className="h-5 w-5"/></button>
                                                    <button onClick={() => handleDownload(result.jsonContent, getFilename(result.item, result.status, 'json'), 'application/json')} className="p-2 bg-slate-700 hover:bg-brand-cyan rounded-lg transition" title="Download .json"><Icon type="json" className="h-5 w-5"/></button>
                                                    <PublishButton />
                                                </div>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-brand-gold/20">
                                                <p className="text-xs font-semibold text-brand-gold mb-2">Individual Prompt Outputs:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(result.allOutputs).map(([key, value]) => (
                                                        <button key={key} onClick={() => handleDownload(value, `${key}.txt`, 'text/plain')} className="text-xs bg-slate-700/70 hover:bg-brand-gold/20 text-brand-gold px-3 py-1 rounded-full transition border border-brand-gold/30 hover:border-brand-gold/50">
                                                            Download [{key}]
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>}
                </div>
            </main>

            {/* Floating Variable Context Menu */}
            {variableContextMenu && currentProject && (
                <div
                    style={{ position: 'fixed', left: variableContextMenu.x, top: variableContextMenu.y, zIndex: 9999 }}
                    className="bg-slate-900 border border-brand-gold/50 rounded-lg shadow-xl p-3 max-w-sm max-h-64 overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="text-xs text-brand-gold/60 mb-2 font-semibold">Insert Variable:</div>
                    <div className="flex flex-wrap gap-1.5">
                        {/* Item Name */}
                        <button type="button" onClick={() => insertVariableIntoPrompt(variableContextMenu.promptId, '<item_name>')} className="px-2 py-1 text-xs font-mono bg-brand-cyan/20 hover:bg-brand-cyan/40 border border-brand-cyan/50 rounded text-brand-cyan transition">{'<item_name>'}</button>
                        {/* Global Variables */}
                        {currentProject.state.placeholders.filter(p => !p.tag).map(p => (
                            <button key={p.id} type="button" onClick={() => insertVariableIntoPrompt(variableContextMenu.promptId, `{${p.key}}`)} className="px-2 py-1 text-xs font-mono bg-brand-gold/20 hover:bg-brand-gold/40 border border-brand-gold/50 rounded text-brand-gold transition">{`{${p.key}}`}</button>
                        ))}
                        {/* Tagged Variables */}
                        {currentProject.state.placeholders.filter(p => p.tag).map(p => (
                            <button key={p.id} type="button" onClick={() => insertVariableIntoPrompt(variableContextMenu.promptId, `{${p.key}{${p.tag}}}`)} className="px-2 py-1 text-xs font-mono bg-orange-500/20 hover:bg-orange-500/40 border border-orange-500/50 rounded text-orange-400 transition">{`{${p.key}{${p.tag}}}`}</button>
                        ))}
                        {/* Conditional Snippets */}
                        {currentProject.state.taggedSnippets.map(s => (
                            <button key={s.id} type="button" onClick={() => insertVariableIntoPrompt(variableContextMenu.promptId, `{{{${s.key}}}}`)} className="px-2 py-1 text-xs font-mono bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/50 rounded text-purple-400 transition">{`{{{${s.key}}}}`}</button>
                        ))}
                        {/* Prompt Output Variables */}
                        {currentProject.state.promptTemplates.map(p => (
                            <button key={p.id} type="button" onClick={() => insertVariableIntoPrompt(variableContextMenu.promptId, `[${p.outputKey}]`)} className="px-2 py-1 text-xs font-mono bg-green-500/20 hover:bg-green-500/40 border border-green-500/50 rounded text-green-400 transition">{`[${p.outputKey}]`}</button>
                        ))}
                        {/* Option Variables */}
                        {(currentProject.state.optionVariables || []).map(ov => (
                            <button key={ov.id} type="button" onClick={() => insertVariableIntoPrompt(variableContextMenu.promptId, `?${ov.key}:${ov.optionCount}?`)} className="px-2 py-1 text-xs font-mono bg-pink-500/20 hover:bg-pink-500/40 border border-pink-500/50 rounded text-pink-400 transition">{`?${ov.key}:${ov.optionCount}?`}</button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;