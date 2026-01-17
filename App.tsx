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
import SaveTemplatePopup from './src/components/SaveTemplatePopup';
import WorkflowNavigation from './src/components/WorkflowNavigation';
import ClientsPage from './src/components/ClientsPage';
import WebsitesPage from './src/components/WebsitesPage';
import Analytics from './src/components/Analytics';
import PendingMetaNotification from './src/components/PendingMetaNotification';
import IdeasBacklog from './src/components/IdeasBacklog';
import DefaultWorkflowSelector, { DefaultWorkflowConfig } from './src/components/DefaultWorkflowSelector';
import WordPressSettings from './src/components/WordPressSettings';
import ArticlesPage from './src/pages/ArticlesPage';
import BlueprintPage from './src/pages/BlueprintPage';
import ImageCreationSection from './src/components/ImageCreationSection';
import SitePlanningSection from './src/components/SitePlanningSection';
import LocalVikingSection from './src/components/LocalVikingSection';
import { VibeCoderToggle } from './src/components/VibeCoderNotepad';
import HelpButton from './src/components/HelpButton';
import LogViewer from './src/components/LogViewer';
import TestRunnerPopup from './src/components/TestRunnerPopup';

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

// Processing run for history tracking
interface ProcessingRun {
  id: string;
  projectName: string;
  date: string; // ISO date string
  time: string; // HH:MM format
  itemCount: number;
  itemNames: string[];
  logs: LogEntry[];
  results: Result[];
}

type WpStatus = 'idle' | 'publishing' | 'published' | 'error';

// Image Decision Report from the publish API
interface ImageDecisionReport {
  mode: 'bank' | 'live' | 'none';
  model?: string | null;
  quality?: string | null;
  smartMatchingEnabled?: boolean;
  avatar?: string;
  matchPlurals?: boolean;
  matchingRules?: string[];
  images: Array<{
    position: number;
    type: 'hero' | 'inline';
    heading?: string;
    variation?: string;
    wordCount?: number;
    side?: string;
    action?: string;
    mood?: string;
    setting?: string;
    prompt?: string;
    primaryScore?: number;
    secondaryScore?: number;
    matchedPrimary?: string[];
    matchedSecondary?: string[];
  }>;
}

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
  imageDecisionReport?: ImageDecisionReport;
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

    // Console Error Logger - captures errors for easy copy/paste debugging
    const [consoleErrors, setConsoleErrors] = useState<Array<{id: number, time: string, message: string}>>([]);
    const [showErrorLog, setShowErrorLog] = useState(false);

    // Intercept console.error to capture errors
    useEffect(() => {
      const originalError = console.error;
      let errorId = 0;

      console.error = (...args) => {
        // Call original
        originalError.apply(console, args);

        // Capture the error
        const message = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        // Skip browser extension errors
        if (message.includes('runtime.lastError') || message.includes('extension')) return;

        setConsoleErrors(prev => {
          const newErrors = [...prev, {
            id: ++errorId,
            time: new Date().toLocaleTimeString(),
            message: message.substring(0, 500) // Limit length
          }];
          // Keep only last 10 errors
          return newErrors.slice(-10);
        });

        // Auto-show panel when new error arrives
        setShowErrorLog(true);
      };

      return () => {
        console.error = originalError;
      };
    }, []);

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
    const [processingLogCollapsed, setProcessingLogCollapsed] = useState(true);
    const [resultsCollapsed, setResultsCollapsed] = useState(true); // Results section collapsed inside Processing Log
    const [results, setResults] = useState<Result[]>([]);
    const [processingHistory, setProcessingHistory] = useState<ProcessingRun[]>([]); // History of processing runs
    const [showHistory, setShowHistory] = useState(false); // Show history panel
    const [selectedHistoryRun, setSelectedHistoryRun] = useState<ProcessingRun | null>(null); // Selected run to view details
    const [logSortOrder, setLogSortOrder] = useState<'newest' | 'oldest'>('newest'); // Sort order for logs
    const [pendingResults, setPendingResults] = useState<PendingResult[]>([]);
    const [fileName, setFileName] = useState('');
    const [openSections, setOpenSections] = useState<Set<string>>(new Set(['setup']));
    const [imageCreationHeaderControls, setImageCreationHeaderControls] = useState<React.ReactNode>(null);
    const [newTagName, setNewTagName] = useState('');
    const [selectedPlaceholders, setSelectedPlaceholders] = useState<Set<number>>(new Set());
    const [bulkActionTag, setBulkActionTag] = useState('');
    const [isTrackerOpen, setIsTrackerOpen] = useState(false);
    const [isAgencyOpen, setIsAgencyOpen] = useState(false);
    const [isArticlesOpen, setIsArticlesOpen] = useState(false);
    const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
    const [showSaveTemplatePopup, setShowSaveTemplatePopup] = useState(false);
    const [isWorkflowNavOpen, setIsWorkflowNavOpen] = useState(false);
    const [isClientsOpen, setIsClientsOpen] = useState(false);
    const [isWebsitesOpen, setIsWebsitesOpen] = useState(false);
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
    const [isIdeasOpen, setIsIdeasOpen] = useState(false);
    const [isWordPressOpen, setIsWordPressOpen] = useState(false);
    const [isArticlesPageOpen, setIsArticlesPageOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [globalSettings, setGlobalSettings] = useState<{local_viking_api_key?: string}>({});
    const [globalSettingsLoading, setGlobalSettingsLoading] = useState(false);
    const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
    const [isDefaultSelectorOpen, setIsDefaultSelectorOpen] = useState(false);
    const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
    const [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
    const [isTestRunnerOpen, setIsTestRunnerOpen] = useState(false);
    const [testQueue, setTestQueue] = useState<Array<{
      articleMode: 'draft' | 'wordpress';
      metaMode: 'draft' | 'wordpress';
      imageMode: 'off' | 'draft' | 'wordpress';
      imageSource: 'bank' | 'main-prompt' | 'guided-gpt' | 'smart-prompt';
    }>>([]);
    const [isRunningTestSequence, setIsRunningTestSequence] = useState(false);
    const [defaultWorkflow, setDefaultWorkflow] = useState<DefaultWorkflowConfig | null>(() => {
      // Load from localStorage on init
      const saved = localStorage.getItem('promptflow_default_workflow');
      return saved ? JSON.parse(saved) : null;
    });
    const [currentWorkflowId, setCurrentWorkflowId] = useState<number | undefined>(undefined);
    const [currentWebsiteId, setCurrentWebsiteId] = useState<number | undefined>(undefined);
    const [currentWebsiteSeoPlugin, setCurrentWebsiteSeoPlugin] = useState<string>('rankmath');
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

    // Image settings state (for Processing Log tabs)
    const [imageSettings, setImageSettings] = useState<{
        integrationMode: 'bank' | 'live';
        livePromptMode: 'main_prompt' | 'guided_gpt' | 'smart_prompt';
    }>({
        integrationMode: 'bank',
        livePromptMode: 'main_prompt'
    });

    // Batch image counts (for Processing Log tabs - shows results)
    const [batchImageCounts, setBatchImageCounts] = useState<{
        fromBank: number;
        fromLive: number;
    }>({ fromBank: 0, fromLive: 0 });

    // Refs
    const prevProjectIdRef = useRef<string | null>(null);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const draggedPromptId = useRef<number | null>(null);
    const promptTextareaRefs = useRef<{[key: number]: HTMLTextAreaElement | null}>({});

    // useCallback for logging (must be before conditional returns)
    const addLog = useCallback((message: string, status: LogStatus, itemId?: number) => {
        // Auto-expand the processing log when a new log entry is added
        setProcessingLogCollapsed(false);
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
            const autoSaveSeconds = currentProject?.state?.autoSaveSeconds ?? 30;

            if (autoSaveEnabled) {
                autoSaveTimerRef.current = setTimeout(() => {
                    saveWorkflowToDatabase(false); // Silent save
                }, autoSaveSeconds * 1000);
            }
        }
    }, [currentWorkflowId, saveWorkflowToDatabase, currentProject?.state?.autoSaveEnabled, currentProject?.state?.autoSaveSeconds]);

    // ========== ALL useEffect HOOKS ==========

    // Load processing history from localStorage on mount
    useEffect(() => {
        const savedHistory = localStorage.getItem('processingHistory');
        if (savedHistory) {
            try {
                const parsed = JSON.parse(savedHistory);
                // Keep only last 50 runs
                setProcessingHistory(parsed.slice(-50));
            } catch (e) {
                console.error('Failed to parse processing history:', e);
            }
        }
    }, []);

    // Save processing history to localStorage when it changes
    useEffect(() => {
        if (processingHistory.length > 0) {
            localStorage.setItem('processingHistory', JSON.stringify(processingHistory.slice(-50)));
        }
    }, [processingHistory]);

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

    // Click-away detection for More dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (isMoreDropdownOpen && !target.closest('[data-more-dropdown]')) {
                setIsMoreDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMoreDropdownOpen]);

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

    // Save default workflow to localStorage when it changes
    useEffect(() => {
      if (defaultWorkflow) {
        localStorage.setItem('promptflow_default_workflow', JSON.stringify(defaultWorkflow));
      } else {
        localStorage.removeItem('promptflow_default_workflow');
      }
    }, [defaultWorkflow]);

    // Fetch image settings when workflow changes (for Processing Log tabs)
    useEffect(() => {
      if (!currentWorkflowId) return;

      const fetchImageSettings = async () => {
        try {
          const res = await fetch(`/api/image-creation/settings/${currentWorkflowId}`);
          const data = await res.json();
          if (data.success && data.settings) {
            setImageSettings({
              integrationMode: data.settings.integration_mode || 'bank',
              livePromptMode: data.settings.live_prompt_mode || 'main_prompt'
            });
          }
        } catch (error) {
          console.error('Error fetching image settings:', error);
        }
      };

      fetchImageSettings();
    }, [currentWorkflowId]);

    // Auto-load default workflow on startup
    const hasAutoLoadedRef = useRef(false);
    useEffect(() => {
      const autoLoadDefaultWorkflow = async () => {
        // Only auto-load once, and only if unlocked and no workflow currently loaded
        if (hasAutoLoadedRef.current || !isUnlocked || currentWorkflowId) return;

        const saved = localStorage.getItem('promptflow_default_workflow');
        if (!saved) return;

        try {
          const config: DefaultWorkflowConfig = JSON.parse(saved);
          hasAutoLoadedRef.current = true;

          // Load the workflow from the database
          const response = await fetch(`/api/workflows/${config.workflowId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.workflow) {
              setCurrentWorkflowId(data.workflow.id);
              setCurrentWebsiteId(data.workflow.website_id || undefined);
              setCurrentWorkflowContext({
                workflowName: data.workflow.name,
                clientName: data.workflow.client_name,
                websiteName: data.workflow.website_name,
                isStandalone: !data.workflow.client_id,
                projectName: data.workflow.project_name
              });

              let workflowState = data.workflow.state || {};

              // Sync SEO plugin from website if workflow has a website_id
              if (data.workflow.website_id) {
                try {
                  const wsRes = await fetch(`/api/websites/${data.workflow.website_id}`);
                  if (wsRes.ok) {
                    const wsData = await wsRes.json();
                    if (wsData.website?.seo_plugin) {
                      workflowState = { ...workflowState, seoPlugin: wsData.website.seo_plugin };
                    }
                  }
                } catch (wsErr) {
                  console.error('Failed to fetch website SEO plugin:', wsErr);
                }
              }

              // Create or update the project with workflow state
              // Use setCurrentProject directly to ensure state is set even if currentProject was null
              const projectId = currentProject?.id || `workflow-${data.workflow.id}`;
              setCurrentProject({
                id: projectId,
                name: data.workflow.name,
                state: Object.keys(workflowState).length > 0 ? workflowState : (currentProject?.state || {
                  apiKeys: { zeroGpt: '', anthropic: '', openai: '', gemini: '', grok: '', openRouter: '', xai: '' },
                  useOpenRouter: false,
                  autoSaveEnabled: false,
                  autoSaveSeconds: 60,
                  provider: 'anthropic',
                  model: 'claude-sonnet-4-5-20250929',
                  model2: 'not-in-use',
                  model3: 'not-in-use',
                  fileNameTemplate: '{tag}-{item_name}-output',
                  wpCredentials: { url: '', user: '', password: '' },
                  wpContentType: 'pages',
                  wpTitleTemplate: '{item_name}',
                  tags: [],
                  placeholders: [],
                  taggedSnippets: [],
                  promptTemplates: [],
                  optionVariables: [],
                  projectNotes: '',
                  workflowNotes: '',
                  metaTitleCount: 3,
                  metaDescriptionCount: 3,
                  metaTitlePrompt: '',
                  metaDescriptionPrompt: '',
                  wpPublishMode: 'draft',
                  articlePublishMode: 'draft',
                  metaPublishMode: 'draft',
                })
              });
              setHasUnsavedChanges(false);

              showNotification(`Loaded default workflow: ${data.workflow.name}`, 'info');
            }
          } else {
            // Workflow no longer exists, clear the default
            setDefaultWorkflow(null);
          }
        } catch (error) {
          console.error('Error auto-loading default workflow:', error);
        }
      };

      autoLoadDefaultWorkflow();
    }, [isUnlocked]);

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

    // Fetch website's SEO plugin when website changes
    useEffect(() => {
        if (currentWebsiteId) {
            fetch(`/api/websites/${currentWebsiteId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.website?.seo_plugin) {
                        setCurrentWebsiteSeoPlugin(data.website.seo_plugin);
                    }
                })
                .catch(err => console.error('Failed to fetch website SEO plugin:', err));
        }
    }, [currentWebsiteId]);

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

    // Load global settings when Settings modal opens
    useEffect(() => {
        if (isSettingsOpen) {
            setGlobalSettingsLoading(true);
            fetch('/api/global-settings')
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.settings) {
                        setGlobalSettings({
                            local_viking_api_key: data.settings.local_viking_api_key || ''
                        });
                    }
                })
                .catch(err => console.error('Failed to load global settings:', err))
                .finally(() => setGlobalSettingsLoading(false));
        }
    }, [isSettingsOpen]);

    // Save global settings
    const saveGlobalSettings = async () => {
        try {
            setGlobalSettingsLoading(true);
            const res = await fetch('/api/global-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(globalSettings)
            });
            const data = await res.json();
            if (data.success) {
                showNotification('Global settings saved!', 'success');
            } else {
                showNotification('Failed to save settings', 'error');
            }
        } catch (err) {
            console.error('Failed to save global settings:', err);
            showNotification('Failed to save settings', 'error');
        } finally {
            setGlobalSettingsLoading(false);
        }
    };

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
                { anthropic: currentProject.state?.apiKeys?.anthropic, openai: currentProject.state?.apiKeys?.openai, gemini: currentProject.state?.apiKeys?.gemini, xai: currentProject.state?.apiKeys?.xai }
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

            // Check if it's a .txt file - use simple line-by-line parsing
            if (file.name.toLowerCase().endsWith('.txt')) {
                const itemNames = text.split(/\r?\n/).filter(line => line.trim() !== '');
                const parsedItems: WorkflowItem[] = itemNames.map((itemName, index) => {
                    const tagMatch = itemName.match(/\(([^)]+)\)/);
                    const tag = tagMatch ? tagMatch[1] : null;
                    return { id: index, name: itemName.trim(), tag };
                });
                loadItems(parsedItems);
                addLog(`Loaded ${parsedItems.length} items from text file`, LogStatus.SUCCESS);
            } else {
                // CSV parsing
                try {
                    const parsedItems = parseCsv(text);
                    loadItems(parsedItems);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error parsing CSV.';
                    addLog(`Error parsing CSV: ${errorMessage}`, LogStatus.ERROR);
                }
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
            .map(line => {
                // GUARDRAIL: Remove placeholder patterns like [Company Name], {brand}, etc.
                // Strip trailing placeholders (e.g., "Title | [Company Name]" → "Title")
                let cleaned = line.replace(/\s*[\|\-]\s*\[[^\]]+\]\s*$/g, '').trim();
                cleaned = cleaned.replace(/\s*[\|\-]\s*\{[^}]+\}\s*$/g, '').trim();
                // Also remove any remaining brackets anywhere in the text
                cleaned = cleaned.replace(/\[[^\]]*\]/g, '').trim();
                cleaned = cleaned.replace(/\{[^}]*\}/g, '').trim();
                // Clean up any leftover separators at the end
                cleaned = cleaned.replace(/\s*[\|\-]\s*$/g, '').trim();
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
                // GUARDRAIL: Reject any remaining lines with placeholder brackets
                if (/\[[^\]]+\]/.test(line)) return false;
                if (/\{[^}]+\}/.test(line)) return false;
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

    const processWorkflow = async (
        immediateItems?: WorkflowItem[],
        publishModeOverrides?: {
            articlePublishMode?: 'draft' | 'wordpress';
            metaPublishMode?: 'draft' | 'wordpress';
            wpPublishMode?: 'off' | 'draft' | 'wordpress';
        }
    ) => {
        // Use immediateItems if provided (bypasses React state timing issues), otherwise use state
        const itemsToProcess = immediateItems || items;

        // Use overrides if provided (bypasses React state timing issues for test runner)
        const effectiveArticlePublishMode = publishModeOverrides?.articlePublishMode ?? currentProject?.state.articlePublishMode ?? 'draft';
        const effectiveMetaPublishMode = publishModeOverrides?.metaPublishMode ?? currentProject?.state.metaPublishMode ?? 'draft';
        const effectiveWpPublishMode = publishModeOverrides?.wpPublishMode ?? currentProject?.state.wpPublishMode ?? 'draft';

        if (!currentProject || !itemsToProcess.length || !currentProject.state.promptTemplates.length) {
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
        setBatchImageCounts({ fromBank: 0, fromLive: 0 }); // Reset image counts for new batch

        const modelNames = activeModels.map(m => m.model.split('-').slice(0, 2).join('-')).join(', ');
        addLog(`Starting batch processing for ${itemsToProcess.length} items using ${activeModels.length} model(s): ${modelNames}...`, LogStatus.INFO);
        const startTime = Date.now();

        for (const item of itemsToProcess) {
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
                            { anthropic: currentProject.state?.apiKeys?.anthropic, openai: currentProject.state?.apiKeys?.openai, gemini: currentProject.state?.apiKeys?.gemini, xai: currentProject.state?.apiKeys?.xai }
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
                            { anthropic: currentProject.state?.apiKeys?.anthropic, openai: currentProject.state?.apiKeys?.openai, gemini: currentProject.state?.apiKeys?.gemini, xai: currentProject.state?.apiKeys?.xai },
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
                                    { anthropic: currentProject.state?.apiKeys?.anthropic, openai: currentProject.state?.apiKeys?.openai, gemini: currentProject.state?.apiKeys?.gemini, xai: currentProject.state?.apiKeys?.xai }
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

                        // Save article to database and capture the article ID
                        let savedArticleId: string | null = null;
                        try {
                            const articleResponse = await fetch('/api/articles', {
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
                            if (articleResponse.ok) {
                                const articleData = await articleResponse.json();
                                savedArticleId = articleData.article?.id || null;
                            }
                            addLog(`[${itemLabel}] Article saved to database.`, LogStatus.INFO, item.id);
                        } catch (saveError) {
                            // Don't fail the whole process if saving fails
                            console.error('Failed to save article:', saveError);
                        }

                        // Process images and/or publish to WordPress based on modes:
                        // - Article: wordpress → Create WP page
                        // - Article: draft + Image: draft/wordpress → Process images, save to article, don't create WP page
                        // - Article: draft + Image: off → Skip entirely
                        const shouldProcessImages = effectiveWpPublishMode !== 'off';
                        const shouldPublishToWP = effectiveArticlePublishMode === 'wordpress';

                        if (shouldPublishToWP || shouldProcessImages) {
                            const { url, user, password } = currentProject.state.wpCredentials;
                            if (url && user && password) {
                                addLog(`[${itemLabel}] ${shouldPublishToWP ? 'Publishing to WordPress' : 'Processing images'}...`, LogStatus.WORKING, item.id);
                                try {
                                    // Build title from template
                                    const placeholderData = currentProject.state.placeholders.reduce((acc, p) => {
                                        if (!p.tag) acc[p.key] = p.value;
                                        return acc;
                                    }, {} as Record<string, string>);
                                    const templateData = {
                                        ...placeholderData,
                                        item_name: item.name.replace(/\s*\([^)]+\)\s*$/, '').trim(),
                                        tag: item.tag,
                                        status: status,
                                    };
                                    let wpTitle = currentProject.state.wpTitleTemplate;
                                    // Handle both <angle> and {curly} bracket syntax
                                    wpTitle = wpTitle.replace(/<([^<>]+)>/g, (match, key) => {
                                        const val = templateData[key.trim()];
                                        return val !== null && val !== undefined ? String(val) : match;
                                    });
                                    wpTitle = wpTitle.replace(/{([^{}]+)}/g, (match, key) => {
                                        const val = templateData[key.trim()];
                                        return val !== null && val !== undefined ? String(val) : match;
                                    });
                                    const title = wpTitle.trim() || metaTitles[0] || item.name;

                                    // Publish via Elementor (with Image Bank integration if enabled)
                                    // Image toggle (wpPublishMode): 'off' = no images, 'draft'/'wordpress' = include images
                                    const includeImages = effectiveWpPublishMode !== 'off';

                                    // Validate workflowId exists when images are enabled
                                    if (includeImages && !currentWorkflowId) {
                                        addLog(`[${itemLabel}] Error: Workflow not fully loaded. Please wait a moment and try again.`, LogStatus.ERROR, item.id);
                                        return {
                                            success: false,
                                            item,
                                            error: 'Workflow not loaded - cannot process images'
                                        };
                                    }

                                    if (includeImages) {
                                        addLog(`[${itemLabel}] Processing images...`, LogStatus.WORKING, item.id);
                                    }
                                    const publishResponse = await fetch('/api/elementor/publish', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            wpUrl: url,
                                            wpUser: user,
                                            wpPassword: password,
                                            title: title,
                                            content: finalOutput,
                                            status: 'draft',
                                            includeStatsBar: false,
                                            // Image Bank integration - only if Image toggle is not 'off'
                                            workflowId: currentWorkflowId,
                                            keyword: item.name, // Contains tag like "Standard Cleaning(H)"
                                            useImageBank: includeImages,
                                            generateImages: includeImages, // Generate images if enabled (draft mode saves but doesn't embed)
                                            maxImages: includeImages ? 4 : 0,
                                            // Pass article ID so generated images are saved to the article record
                                            articleId: savedArticleId,
                                            // Image Draft Mode: match images and save to article, but DON'T embed in WP page
                                            imageDraftMode: effectiveWpPublishMode === 'draft',
                                            // Skip WP page creation when Article is on draft (just process images)
                                            skipWpPageCreation: !shouldPublishToWP,
                                        }),
                                    });
                                    const publishData = await publishResponse.json();

                                    // Success conditions:
                                    // 1. WP page created (publishData.page?.id)
                                    // 2. Images processed (publishData.imagesProcessed)
                                    // 3. Draft mode completed (skipWpPageCreation was true, even if no images)
                                    const isDraftModeSuccess = !shouldPublishToWP && publishResponse.ok;
                                    if (publishResponse.ok && (publishData.page?.id || publishData.imagesProcessed || isDraftModeSuccess)) {
                                        // Log image results with detailed mode info
                                        const report = publishData.imageDecisionReport;
                                        const modeLabel = report?.mode === 'bank' ? '📦 Bank' : report?.mode === 'live' ? '⚡ Live' : '❌ None';
                                        const promptModeLabel = report?.livePromptMode === 'main_prompt' ? 'Main Prompt' :
                                                               report?.livePromptMode === 'guided_gpt' ? 'Guided GPT' :
                                                               report?.livePromptMode === 'smart_prompt' ? 'Smart Prompt' : '';

                                        if (publishData.imagesFromBank > 0) {
                                            addLog(`[${itemLabel}] ${modeLabel}: ${publishData.imagesFromBank} images pulled from Image Bank`, LogStatus.SUCCESS, item.id);
                                            setBatchImageCounts(prev => ({ ...prev, fromBank: prev.fromBank + publishData.imagesFromBank }));
                                        } else if (publishData.totalImages > 0) {
                                            const liveDetails = promptModeLabel ? ` (${promptModeLabel})` : '';
                                            addLog(`[${itemLabel}] ${modeLabel}${liveDetails}: Generated ${publishData.totalImages} images`, LogStatus.SUCCESS, item.id);
                                            setBatchImageCounts(prev => ({ ...prev, fromLive: prev.fromLive + publishData.totalImages }));
                                        } else if (includeImages) {
                                            // No images found - provide context on why
                                            const noImageReason = report?.mode === 'bank'
                                                ? 'No matching images in Bank'
                                                : report?.mode === 'live'
                                                    ? 'Image generation skipped or failed'
                                                    : 'Images not enabled';
                                            addLog(`[${itemLabel}] ${modeLabel}: ${noImageReason}`, LogStatus.INFO, item.id);
                                        } else if (!shouldPublishToWP) {
                                            // Draft mode with images off
                                            addLog(`[${itemLabel}] Draft mode: Article processed (no images)`, LogStatus.INFO, item.id);
                                        }
                                        // Log actual image save status from server
                                        if (publishData.imageSaveStatus) {
                                            const status = publishData.imageSaveStatus;
                                            if (status.saved && status.verifiedCount > 0) {
                                                addLog(`[${itemLabel}] ✅ Images saved to database: ${status.verifiedCount} images (article ${status.articleId})`, LogStatus.SUCCESS, item.id);
                                            } else if (status.saved && status.count > 0 && status.verifiedCount === 0) {
                                                addLog(`[${itemLabel}] ⚠️ IMAGE SAVE FAILED! Tried ${status.count} images but DB has 0. Error: ${status.error || 'Unknown'}`, LogStatus.ERROR, item.id);
                                            } else if (status.error) {
                                                addLog(`[${itemLabel}] ❌ Image save error: ${status.error}`, LogStatus.ERROR, item.id);
                                            } else if (!savedArticleId) {
                                                addLog(`[${itemLabel}] ⚠️ No article ID - images not saved to database`, LogStatus.ERROR, item.id);
                                            }
                                        } else if (savedArticleId && publishData.totalImages > 0) {
                                            // Fallback for older API response format
                                            addLog(`[${itemLabel}] Images saved to article record for viewing in Articles page`, LogStatus.INFO, item.id);
                                        }
                                        // Log Draft Bank status (new feature)
                                        if (publishData.draftBankSaveStatus) {
                                            const draftBank = publishData.draftBankSaveStatus;
                                            if (draftBank.saved && draftBank.count > 0) {
                                                addLog(`[${itemLabel}] ✅ Draft Bank: ${draftBank.count} images saved${draftBank.passThrough ? ' (pass-through)' : ''}`, LogStatus.SUCCESS, item.id);
                                            } else if (draftBank.error) {
                                                addLog(`[${itemLabel}] ❌ Draft Bank: ${draftBank.error}`, LogStatus.ERROR, item.id);
                                            }
                                        }

                                        // Summary status row
                                        const articleOk = publishData.imageSaveStatus?.saved && publishData.imageSaveStatus?.verifiedCount > 0;
                                        const draftBankOk = publishData.draftBankSaveStatus?.saved && publishData.draftBankSaveStatus?.count > 0;
                                        const websiteOk = !!publishData.page?.id;
                                        const statusLine = [
                                            `Article ${articleOk ? '✅' : '❌'}`,
                                            `Draft Bank ${draftBankOk ? '✅' : '❌'}`,
                                            `Website ${websiteOk ? '✅' : '⏸️'}`
                                        ].join(' | ');
                                        addLog(`[${itemLabel}] STATUS: ${statusLine}`, websiteOk || articleOk ? LogStatus.SUCCESS : LogStatus.INFO, item.id);

                                        // Update result with WP link and image decision report
                                        setResults(prev => prev.map(r =>
                                            r.item.id === resultItem.id
                                                ? { ...r, wpStatus: 'published' as WpStatus, wpLink: publishData.page?.link, imageDecisionReport: publishData.imageDecisionReport }
                                                : r
                                        ));

                                        // Auto-push SEO meta ONLY if:
                                        // 1. Meta toggle is 'wordpress' AND
                                        // 2. BOTH dropdown counts are 1 (meaning auto-push, not draft/choose mode)
                                        // If either dropdown is 2+, meta stays in draft for user selection
                                        const metaTitleCount = currentProject?.state.metaTitleCount || 3;
                                        const metaDescCount = currentProject?.state.metaDescriptionCount || 3;
                                        if (effectiveMetaPublishMode === 'wordpress' &&
                                            metaTitleCount === 1 && metaDescCount === 1 &&
                                            metaTitles.length > 0 && metaDescriptions.length > 0) {
                                            addLog(`[${itemLabel}] Auto-pushing SEO meta...`, LogStatus.WORKING, item.id);
                                            try {
                                                const seoResponse = await fetch('/api/seo/push-direct', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        wpUrl: url,
                                                        wpUser: user,
                                                        wpPassword: password,
                                                        postId: publishData.page.id,
                                                        metaTitle: metaTitles[0],
                                                        metaDescription: metaDescriptions[0],
                                                        seoPlugin: currentWebsiteSeoPlugin || 'rankmath',
                                                        postType: 'pages'
                                                    })
                                                });
                                                if (seoResponse.ok) {
                                                    addLog(`[${itemLabel}] SEO meta pushed successfully!`, LogStatus.SUCCESS, item.id);
                                                } else {
                                                    const seoError = await seoResponse.json();
                                                    addLog(`[${itemLabel}] SEO push warning: ${seoError.error || 'Unknown'}`, LogStatus.ERROR, item.id);
                                                }
                                            } catch (seoErr) {
                                                addLog(`[${itemLabel}] SEO push error: ${seoErr instanceof Error ? seoErr.message : 'Unknown'}`, LogStatus.ERROR, item.id);
                                            }
                                        }
                                    } else {
                                        addLog(`[${itemLabel}] WordPress publish failed: ${publishData.error || 'Unknown error'}`, LogStatus.ERROR, item.id);
                                    }
                                } catch (publishErr) {
                                    addLog(`[${itemLabel}] Auto-publish error: ${publishErr instanceof Error ? publishErr.message : 'Unknown'}`, LogStatus.ERROR, item.id);
                                }
                            } else {
                                addLog(`[${itemLabel}] Skipping auto-publish: WordPress credentials not configured.`, LogStatus.ERROR, item.id);
                            }
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

        // Save run to processing history
        const now = new Date();
        const historyRun: ProcessingRun = {
            id: `run-${Date.now()}`,
            projectName: currentProject?.state?.name || 'Unnamed Project',
            date: now.toISOString().split('T')[0],
            time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            itemCount: itemsToProcess.length,
            itemNames: itemsToProcess.map(i => i.name),
            logs: [...logs, { id: Date.now(), message: `Batch processing complete in ${duration} minutes.`, status: LogStatus.SUCCESS, timestamp: now.toLocaleTimeString() }],
            results: [] // Results will be updated via setResults, we capture current state
        };
        setProcessingHistory(prev => [...prev, historyRun]);
    };

    // Test Runner - runs test sequence using the REAL workflow paths
    const runTestSequence = async (steps: Array<{
      articleMode: 'draft' | 'wordpress';
      metaMode: 'draft' | 'wordpress';
      imageMode: 'off' | 'draft' | 'wordpress';
      imageSource: 'bank' | 'main-prompt' | 'guided-gpt' | 'smart-prompt';
    }>, keyword: string, tag: string) => {
      if (!currentWorkflowId) {
        showNotification('No workflow selected', 'error');
        return;
      }

      setIsRunningTestSequence(true);
      addLog(`🧪 Starting Test Sequence with ${steps.length} steps for "${keyword}" (${tag})...`, LogStatus.INFO);

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        addLog(`🧪 Test Step ${i + 1}/${steps.length}: Article=${step.articleMode}, Meta=${step.metaMode}, Image=${step.imageMode}, Source=${step.imageSource}`, LogStatus.INFO);

        try {
          // 1. Update UI to show current publish modes (for user visibility)
          setCurrentProjectState(prev => ({
            ...prev,
            articlePublishMode: step.articleMode,
            metaPublishMode: step.metaMode,
            wpPublishMode: step.imageMode  // Note: state uses wpPublishMode not imagePublishMode
          }));

          // 2. Update image creation settings via API (same as clicking Bank/Live buttons)
          const imageSettings: Record<string, string> = {};

          if (step.imageSource === 'bank') {
            imageSettings.integration_mode = 'bank';
            // Use bank_first to enable fallback to generate when bank is empty
            imageSettings.smart_matching_mode = 'bank_first';
          } else {
            // Generate Live modes (main-prompt, guided-gpt, smart-prompt)
            imageSettings.integration_mode = 'live';
            imageSettings.smart_matching_mode = 'generate_only';
            // Set the live prompt mode
            if (step.imageSource === 'main-prompt') {
              imageSettings.live_prompt_mode = 'main_prompt';
            } else if (step.imageSource === 'guided-gpt') {
              imageSettings.live_prompt_mode = 'guided_gpt';
            } else if (step.imageSource === 'smart-prompt') {
              imageSettings.live_prompt_mode = 'smart_prompt';
            }
          }

          // Save settings via API
          console.log('[Test Mode] Saving image settings:', imageSettings);
          const saveResponse = await fetch(`/api/image-creation/settings/${currentWorkflowId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(imageSettings)
          });
          const saveResult = await saveResponse.json();
          console.log('[Test Mode] Save response:', saveResult);
          if (!saveResponse.ok) {
            console.error('[Test Mode] Save failed:', saveResult);
          }

          // Small delay to ensure settings are saved
          await new Promise(resolve => setTimeout(resolve, 500));

          // 3. Create a test item and run the workflow
          const testItem: WorkflowItem = {
            id: Date.now(),
            name: `${keyword}(${tag})`,
            tag: tag
          };

          // Add item to items list
          setItems([testItem]);

          // 4. Run the workflow with explicit overrides (bypasses React state timing issues)
          // These overrides are passed directly to processWorkflow, not through React state
          await processWorkflow([testItem], {
            articlePublishMode: step.articleMode,
            metaPublishMode: step.metaMode,
            wpPublishMode: step.imageMode
          });

          addLog(`✅ Test Step ${i + 1} completed`, LogStatus.SUCCESS);

        } catch (error: any) {
          addLog(`❌ Test Step ${i + 1} failed: ${error.message}`, LogStatus.ERROR);
        }

        // Wait between tests
        if (i < steps.length - 1) {
          addLog(`⏳ Waiting 2 seconds before next test...`, LogStatus.INFO);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      setIsRunningTestSequence(false);
      addLog(`🧪 Test Sequence Complete! Ran ${steps.length} tests.`, LogStatus.SUCCESS);
      showNotification(`Test sequence complete - ${steps.length} tests run`, 'success');
    };

    // Helper to strip tag suffix like "(H)" from item names
    const stripTagFromName = (name: string): string => {
        return name.replace(/\s*\([^)]+\)\s*$/, '').trim();
    };

    const fillSimpleTemplate = (template: string, data: Record<string, string | null | undefined>): string => {
        // Support both <angle brackets> and {curly braces} syntax
        let result = template;
        // First pass: handle <angle brackets>
        result = result.replace(/<([^<>]+)>/g, (match, key) => {
            const trimmedKey = key.trim();
            const value = data[trimmedKey];
            return value !== null && value !== undefined ? String(value) : match;
        });
        // Second pass: handle {curly braces}
        result = result.replace(/{([^{}]+)}/g, (match, key) => {
            const trimmedKey = key.trim();
            const value = data[trimmedKey];
            return value !== null && value !== undefined ? String(value) : match;
        });
        return result;
    };

    const handlePublishToWordPress = async (result: Result, useElementor: boolean = true) => {
        if (!currentProject) return;
        const { url, user, password } = currentProject.state.wpCredentials;
        if (!url || !user || !password) {
            addLog(`[${result.item.name}] WordPress credentials are not set.`, LogStatus.ERROR, result.item.id);
            return;
        }

        const updateResultStatus = (itemId: number, status: WpStatus, link?: string, error?: string, imageReport?: ImageDecisionReport) => {
            setResults(prev => prev.map(r => r.item.id === itemId ? { ...r, wpStatus: status, wpLink: link, wpError: error, imageDecisionReport: imageReport || r.imageDecisionReport } : r));
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
                item_name: stripTagFromName(result.item.name),
                tag: result.item.tag,
                status: result.status,
            };

            const generatedTitle = fillSimpleTemplate(currentProject.state.wpTitleTemplate, templateData);
            const title = generatedTitle.trim() ? generatedTitle : (result.metaTitles[0] || result.item.name);

            let response;
            let data;

            if (useElementor) {
                // Validate workflowId exists for image bank lookup
                if (!currentWorkflowId) {
                    addLog(`[${result.item.name}] Error: Workflow not fully loaded. Please wait a moment and try again.`, LogStatus.ERROR, result.item.id);
                    throw new Error('Workflow not loaded - cannot process images');
                }

                // Use Elementor publishing endpoint (with Image Bank integration)
                addLog(`[${result.item.name}] Processing images...`, LogStatus.WORKING, result.item.id);
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
                        includeStatsBar: false,
                        // Image Bank integration
                        workflowId: currentWorkflowId,
                        keyword: result.item.name, // Contains tag like "Standard Cleaning(H)"
                        useImageBank: true,
                        maxImages: 4,
                        isManualPush: true,
                    }),
                });

                data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || `Elementor API Error: ${response.statusText}`);
                }

                // Log image results with detailed mode info
                const report = data.imageDecisionReport;
                const modeLabel = report?.mode === 'bank' ? '📦 Bank' : report?.mode === 'live' ? '⚡ Live' : '❌ None';
                const promptModeLabel = report?.livePromptMode === 'main_prompt' ? 'Main Prompt' :
                                       report?.livePromptMode === 'guided_gpt' ? 'Guided GPT' :
                                       report?.livePromptMode === 'smart_prompt' ? 'Smart Prompt' : '';

                if (data.imagesFromBank > 0) {
                    addLog(`[${result.item.name}] ${modeLabel}: ${data.imagesFromBank} images pulled from Image Bank`, LogStatus.SUCCESS, result.item.id);
                } else if (data.totalImages > 0) {
                    const liveDetails = promptModeLabel ? ` (${promptModeLabel})` : '';
                    addLog(`[${result.item.name}] ${modeLabel}${liveDetails}: Generated ${data.totalImages} images`, LogStatus.SUCCESS, result.item.id);
                }

                updateResultStatus(result.item.id, 'published', data.page?.link, undefined, data.imageDecisionReport);
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
                                seoPlugin: currentWebsiteSeoPlugin || 'rankmath',
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
                                seoPlugin: currentWebsiteSeoPlugin || 'rankmath',
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
    
    const renderSection = (title: React.ReactNode, id: string, icon: React.ReactNode, children: React.ReactNode, defaultOpen = false, rightContent?: React.ReactNode) => (
      <div className="bg-card rounded-xl shadow-glow-cyan card-3d hover:shadow-card-hover border-2 border-brand-cyan relative z-0">
        <h2 className={`text-xl font-bold flex items-center text-brand-cyan py-2 px-4 cursor-pointer`} onClick={() => toggleCollapsible(id)}>
          {icon}
          <span className="ml-3 shrink-0">{title}</span>
          {rightContent && <div className="ml-4 flex-1 flex items-center justify-end gap-3" onClick={e => e.stopPropagation()}>{rightContent}</div>}
           <svg className={`w-5 h-5 ml-3 shrink-0 transform transition-transform ${openSections.has(id) ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </h2>
        <div className={`transition-all duration-300 ease-in-out ${openSections.has(id) ? '' : 'max-h-0 overflow-hidden'}`}>
            <div className="p-5 pt-0 border-t border-brand-cyan/30">{children}</div>
        </div>
      </div>
    );

    // Helper function to format website URL (remove https:// and trailing slashes)
    const formatWebsiteUrl = (url: string | undefined) => {
      if (!url) return '';
      return url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    };
    
    const isApiKeyMissing = currentProject.state.provider === 'anthropic' && !currentProject.state?.apiKeys?.anthropic;
    const isRunDisabled = isProcessing || !items.length || isApiKeyMissing;

    const getRunButtonText = () => {
        if (isProcessing) return 'Processing...';
        if (isApiKeyMissing) return 'Enter Anthropic API Key to Start';
        if (!items.length) return 'Add Items to Start';
        return `Start Workflow (${items.length} items)`;
    };

    return (
        <div className="min-h-screen bg-slate-900 text-gray-200 font-sans pt-1 pb-4 px-4 sm:pt-2 sm:pb-6 sm:px-6 lg:pt-2 lg:pb-8 lg:px-8">
             {notification && (
                <div className={`fixed top-5 right-5 z-50 px-6 py-3 rounded-xl shadow-card-lg text-white transition-all duration-300 border ${notification.type === 'success' ? 'bg-green-600/90 border-green-500' : notification.type === 'info' ? 'bg-brand-cyan/90 border-brand-cyan-light' : 'bg-red-600/90 border-red-500'}`}>
                    {notification.message}
                </div>
            )}

            {/* Console Error Log Panel - for easy copy/paste debugging */}
            {consoleErrors.length > 0 && (
              <div className={`fixed top-0 left-0 right-0 z-[100] transition-transform duration-300 ${showErrorLog ? 'translate-y-0' : '-translate-y-full'}`}>
                <div className="bg-red-900/95 border-b-2 border-red-500 shadow-lg">
                  <div className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-red-300 font-bold text-sm">⚠️ Console Errors ({consoleErrors.length})</span>
                      <button
                        onClick={() => {
                          const errorText = consoleErrors.map(e => `[${e.time}] ${e.message}`).join('\n\n');
                          navigator.clipboard.writeText(errorText);
                          alert('Errors copied to clipboard!');
                        }}
                        className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-white text-xs"
                      >
                        📋 Copy All
                      </button>
                      <button
                        onClick={() => setConsoleErrors([])}
                        className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-white text-xs"
                      >
                        🗑️ Clear
                      </button>
                    </div>
                    <button
                      onClick={() => setShowErrorLog(false)}
                      className="text-red-300 hover:text-white text-xl font-bold px-2"
                    >
                      ×
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto px-4 pb-3">
                    {consoleErrors.map(err => (
                      <div key={err.id} className="text-xs font-mono bg-red-950 rounded px-2 py-1 mb-1 text-red-200">
                        <span className="text-red-400">[{err.time}]</span> {err.message}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Toggle button when hidden */}
              </div>
            )}
            {consoleErrors.length > 0 && !showErrorLog && (
              <button
                onClick={() => setShowErrorLog(true)}
                className="fixed top-2 left-2 z-[100] px-3 py-1 bg-red-600 hover:bg-red-500 rounded-full text-white text-xs font-bold animate-pulse"
              >
                ⚠️ {consoleErrors.length} Errors
              </button>
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

            {/* Ideas Backlog */}
            <IdeasBacklog isOpen={isIdeasOpen} onClose={() => setIsIdeasOpen(false)} />
            <WordPressSettings isOpen={isWordPressOpen} onClose={() => setIsWordPressOpen(false)} />
            <ArticlesPage
              isOpen={isArticlesPageOpen}
              onClose={() => setIsArticlesPageOpen(false)}
              defaultWebsiteId={currentProject?.website_id || undefined}
              workflowId={currentWorkflowId}
            />

            {/* System Blueprint - Reference for AI agents */}
            <BlueprintPage
              isOpen={isBlueprintOpen}
              onClose={() => setIsBlueprintOpen(false)}
            />

            {/* Test Runner Popup */}
            <TestRunnerPopup
              isOpen={isTestRunnerOpen}
              onClose={() => setIsTestRunnerOpen(false)}
              onRunTest={(steps, keyword, tag) => {
                // Convert steps to the format expected by runTestSequence
                const formattedSteps = steps.map(s => ({
                  articleMode: s.articleMode,
                  metaMode: s.metaMode,
                  imageMode: s.imageMode,
                  imageSource: s.imageSource
                }));
                runTestSequence(formattedSteps, keyword, tag);
              }}
              currentArticleMode={currentProject?.state?.articlePublishMode || 'draft'}
              currentMetaMode={currentProject?.state?.metaPublishMode || 'draft'}
              currentImageMode={currentProject?.state?.imagePublishMode || 'draft'}
              availableTags={currentProject?.state?.tags || []}
              workflowId={currentProject?.id}
            />

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
                                            value={currentProject.state.autoSaveSeconds ?? 30}
                                            onChange={e => setCurrentProjectState(p => ({...p, autoSaveSeconds: parseInt(e.target.value) || 30}))}
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

                            {/* Local Viking API Key (Global) */}
                            <div className="bg-slate-800/50 p-4 rounded-lg border border-green-500/30">
                                <h3 className="text-lg font-semibold text-green-400 mb-3">Local Viking</h3>
                                <p className="text-xs text-slate-400 mb-3">
                                    This API key is used for all websites. Location ID is set per-website in Agency Manager.
                                </p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-green-400 mb-1">Local Viking API Key</label>
                                        <input
                                            type="password"
                                            placeholder="Your Local Viking API key"
                                            value={globalSettings.local_viking_api_key || ''}
                                            onChange={e => setGlobalSettings(prev => ({ ...prev, local_viking_api_key: e.target.value }))}
                                            className="w-full bg-slate-700 border border-green-500/50 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-green-500"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Find this in Local Viking → Settings → API Keys</p>
                                    </div>
                                    <button
                                        onClick={saveGlobalSettings}
                                        disabled={globalSettingsLoading}
                                        className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-white text-sm font-medium transition"
                                    >
                                        {globalSettingsLoading ? 'Saving...' : 'Save Local Viking Settings'}
                                    </button>
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
            {/* Save as Template Popup */}
            {showSaveTemplatePopup && (
                <SaveTemplatePopup
                    isOpen={showSaveTemplatePopup}
                    onClose={() => setShowSaveTemplatePopup(false)}
                    currentState={currentProject.state}
                    workflowName={currentWorkflowContext.workflowName || currentProject.name}
                    workflowId={currentWorkflowId}
                    onSave={async (templateData) => {
                        try {
                            const res = await fetch('/api/templates', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(templateData)
                            });
                            if (res.ok) {
                                showNotification('Template saved!', 'success');
                                setShowSaveTemplatePopup(false);
                            } else {
                                const err = await res.json();
                                showNotification(err.error || 'Failed to save template', 'error');
                            }
                        } catch (error) {
                            showNotification('Failed to save template', 'error');
                        }
                    }}
                />
            )}
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
                            let workflowState = data.workflow?.state || {};

                            // Sync SEO plugin from website if workflow has a website_id
                            if (workflow.website_id) {
                                try {
                                    const wsRes = await fetch(`/api/websites/${workflow.website_id}`);
                                    if (wsRes.ok) {
                                        const wsData = await wsRes.json();
                                        if (wsData.website?.seo_plugin) {
                                            // Sync website's seo_plugin to workflow state
                                            workflowState = { ...workflowState, seoPlugin: wsData.website.seo_plugin };
                                        }
                                    }
                                } catch (wsErr) {
                                    console.error('Failed to fetch website SEO plugin:', wsErr);
                                }
                            }

                            // Create or update the project with workflow state
                            // Use setCurrentProject directly to ensure state is set even if currentProject was null
                            const projectId = currentProject?.id || `workflow-${workflow.id}`;
                            setCurrentProject({
                                id: projectId,
                                name: workflow.name,
                                state: Object.keys(workflowState).length > 0 ? workflowState : (currentProject?.state || {
                                    apiKeys: { zeroGpt: '', anthropic: '', openai: '', gemini: '', grok: '', openRouter: '', xai: '' },
                                    useOpenRouter: false,
                                    autoSaveEnabled: false,
                                    autoSaveSeconds: 60,
                                    provider: 'anthropic',
                                    model: 'claude-sonnet-4-5-20250929',
                                    model2: 'not-in-use',
                                    model3: 'not-in-use',
                                    fileNameTemplate: '{tag}-{item_name}-output',
                                    wpCredentials: { url: '', user: '', password: '' },
                                    wpContentType: 'pages',
                                    wpTitleTemplate: '{item_name}',
                                    tags: [],
                                    placeholders: [],
                                    taggedSnippets: [],
                                    promptTemplates: [],
                                    optionVariables: [],
                                    projectNotes: '',
                                    workflowNotes: '',
                                    metaTitleCount: 3,
                                    metaDescriptionCount: 3,
                                    metaTitlePrompt: '',
                                    metaDescriptionPrompt: '',
                                    wpPublishMode: 'draft',
                                    articlePublishMode: 'draft',
                                    metaPublishMode: 'draft',
                                })
                            });
                            setHasUnsavedChanges(false);
                            if (Object.keys(workflowState).length > 0) {
                                showNotification(`Loaded workflow: ${workflow.name}`, 'success');
                            } else {
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
            <header className="mb-1 px-2 sm:px-0">
                {/* Top Bar with Logo and Navigation - Mobile: stacked, Desktop: side by side */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    {/* Logo + Default Workflow grouped together on left */}
                    <div className="flex items-center justify-center md:justify-start gap-3">
                        {/* Logo - Centered on mobile */}
                        <div className="flex flex-col items-center md:items-start">
                            {/* Top row: Graph icon + PromptFlow logo image */}
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
                                {/* PromptFlow logo image */}
                                <img src="/promptflow-logo.png" alt="PromptFlow" className="h-8 md:h-10" />
                            </div>
                            {/* Tagline underneath, centered */}
                            <p className="text-[10px] md:text-xs text-slate-400 mt-1 text-center md:text-left w-full">Advanced Workflow Automator</p>
                        </div>

                        {/* Default Workflow Button - positioned next to logo, wider */}
                        <div className="relative hidden md:block">
                            <button
                                onClick={() => setIsDefaultSelectorOpen(!isDefaultSelectorOpen)}
                                className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1.5 bg-slate-900 text-brand-gold font-semibold py-1 px-1 md:py-1.5 md:px-4 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                                title="Set default workflow for auto-load on startup"
                            >
                                <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                </svg>
                                {defaultWorkflow ? (
                                    <span className="text-[10px] md:text-sm flex items-center gap-1">
                                        <span className="flex flex-col items-center leading-tight">
                                            <span className="text-brand-gold">Default</span>
                                            <span className="text-brand-gold text-[8px] md:text-[10px]">Workflow</span>
                                        </span>
                                        <span className="text-slate-500">|</span>
                                        <span className="text-brand-cyan">{(defaultWorkflow.clientName || 'Personal').slice(0, 30)}{(defaultWorkflow.clientName || '').length > 30 ? '...' : ''}</span>
                                        <span className="text-slate-500">-</span>
                                        <span className="text-brand-gold">{(() => {
                                            const url = defaultWorkflow.websiteName || 'N/A';
                                            const clean = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
                                            return clean.slice(0, 50) + (clean.length > 50 ? '...' : '');
                                        })()}</span>
                                        <span className="text-slate-500">-</span>
                                        <span className="text-brand-gold">{defaultWorkflow.workflowName.slice(0, 45)}{defaultWorkflow.workflowName.length > 45 ? '...' : ''}</span>
                                    </span>
                                ) : (
                                    <span className="text-[10px] md:text-sm flex flex-col items-center leading-tight">
                                        <span className="text-brand-gold">Default</span>
                                        <span className="text-brand-gold text-[8px] md:text-[10px]">Workflow</span>
                                    </span>
                                )}
                                <svg className={`h-3 w-3 md:h-4 md:w-4 text-brand-cyan ml-1 transition-transform ${isDefaultSelectorOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* Dropdown selector */}
                            <DefaultWorkflowSelector
                                isOpen={isDefaultSelectorOpen}
                                onClose={() => setIsDefaultSelectorOpen(false)}
                                currentDefault={defaultWorkflow}
                                onSetDefault={(config) => {
                                    setDefaultWorkflow(config);
                                    if (config) {
                                        showNotification(`Default workflow set: ${config.workflowName}`, 'success');
                                    } else {
                                        showNotification('Default workflow cleared', 'info');
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* Navigation Buttons - Grid on mobile (4 columns), flex on desktop */}
                    <div className="grid grid-cols-4 gap-1 sm:gap-1.5 md:flex md:gap-1.5 md:flex-wrap justify-center md:justify-end">
                        <button
                            onClick={() => { setIsTrackerOpen(false); setIsWorkflowNavOpen(false); setIsArticlesOpen(false); setIsTemplatesOpen(false); setIsClientsOpen(false); setIsWebsitesOpen(false); setIsAnalyticsOpen(false); setIsWordPressOpen(false); setIsAgencyOpen(true); }}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1.5 bg-slate-900 text-brand-gold font-semibold py-1 px-1 md:py-1.5 md:px-2.5 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="Manage Clients & Locations"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span className="text-[10px] md:text-sm">Agency</span>
                        </button>
                        <button
                            onClick={() => { setIsTrackerOpen(false); setIsAgencyOpen(false); setIsArticlesOpen(false); setIsTemplatesOpen(false); setIsWorkflowNavOpen(false); setIsWebsitesOpen(false); setIsAnalyticsOpen(false); setIsWordPressOpen(false); setIsClientsOpen(true); }}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1.5 bg-slate-900 text-brand-gold font-semibold py-1 px-1 md:py-1.5 md:px-2.5 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="View All Clients"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className="text-[10px] md:text-sm">Clients</span>
                        </button>
                        <button
                            onClick={() => { setIsTrackerOpen(false); setIsAgencyOpen(false); setIsArticlesOpen(false); setIsTemplatesOpen(false); setIsWorkflowNavOpen(false); setIsClientsOpen(false); setIsAnalyticsOpen(false); setIsWordPressOpen(false); setIsWebsitesOpen(true); }}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1.5 bg-slate-900 text-brand-gold font-semibold py-1 px-1 md:py-1.5 md:px-2.5 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="View All Websites"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                            <span className="text-[10px] md:text-sm">Websites</span>
                        </button>
                        <button
                            onClick={() => { setIsTrackerOpen(false); setIsAgencyOpen(false); setIsArticlesOpen(false); setIsTemplatesOpen(false); setIsClientsOpen(false); setIsWebsitesOpen(false); setIsAnalyticsOpen(false); setIsWordPressOpen(false); setIsWorkflowNavOpen(true); }}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1.5 bg-slate-900 text-brand-gold font-semibold py-1 px-1 md:py-1.5 md:px-2.5 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="Browse Workflows"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                            </svg>
                            <span className="text-[10px] md:text-sm">Workflows</span>
                        </button>
                        <button
                            onClick={() => { setIsTrackerOpen(false); setIsAgencyOpen(false); setIsWorkflowNavOpen(false); setIsTemplatesOpen(false); setIsClientsOpen(false); setIsWebsitesOpen(false); setIsAnalyticsOpen(false); setIsWordPressOpen(false); setIsArticlesOpen(true); }}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1.5 bg-slate-900 text-brand-gold font-semibold py-1 px-1 md:py-1.5 md:px-2.5 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="View Workflow Results"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-[10px] md:text-sm whitespace-nowrap">Results</span>
                        </button>
                        <button
                            onClick={() => { setIsAgencyOpen(false); setIsArticlesOpen(false); setIsTemplatesOpen(false); setIsWorkflowNavOpen(false); setIsTrackerOpen(false); setIsClientsOpen(false); setIsWebsitesOpen(false); setIsAnalyticsOpen(false); setIsIdeasOpen(false); setIsWordPressOpen(true); }}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1.5 bg-slate-900 text-brand-gold font-semibold py-1 px-1 md:py-1.5 md:px-2.5 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="WordPress Settings"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                            <span className="text-[10px] md:text-sm">WordPress</span>
                        </button>
                        <button
                            onClick={() => { setIsAgencyOpen(false); setIsArticlesOpen(false); setIsTemplatesOpen(false); setIsWorkflowNavOpen(false); setIsTrackerOpen(false); setIsClientsOpen(false); setIsWebsitesOpen(false); setIsAnalyticsOpen(false); setIsIdeasOpen(false); setIsWordPressOpen(false); setIsArticlesPageOpen(true); }}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1.5 bg-slate-900 text-brand-gold font-semibold py-1 px-1 md:py-1.5 md:px-2.5 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="WordPress Articles Management"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                            </svg>
                            <span className="text-[10px] md:text-sm">Articles</span>
                        </button>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1.5 bg-slate-900 text-brand-gold font-semibold py-1 px-1 md:py-1.5 md:px-2.5 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2"
                            title="Settings"
                        >
                            <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-[10px] md:text-sm">Settings</span>
                        </button>
                        {/* More Dropdown */}
                        <div className="relative flex" data-more-dropdown>
                            <button
                                onClick={() => setIsMoreDropdownOpen(!isMoreDropdownOpen)}
                                className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1.5 bg-slate-900 text-brand-gold font-semibold py-1 px-1 md:py-1.5 md:px-2.5 rounded-lg transition hover:shadow-glow-gold btn-press border border-brand-gold md:border-2 h-full"
                                title="More Options"
                            >
                                <svg className="h-4 w-4 md:h-5 md:w-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                                </svg>
                                <span className="text-[10px] md:text-sm">More</span>
                            </button>
                            {isMoreDropdownOpen && (
                                <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-brand-gold rounded-lg shadow-2xl z-50 min-w-[160px]">
                                    <button
                                        onClick={() => { setIsMoreDropdownOpen(false); setIsTrackerOpen(false); setIsAgencyOpen(false); setIsArticlesOpen(false); setIsWorkflowNavOpen(false); setIsClientsOpen(false); setIsWebsitesOpen(false); setIsAnalyticsOpen(false); setIsTemplatesOpen(true); }}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-brand-gold hover:bg-slate-700 transition rounded-t-lg"
                                    >
                                        <svg className="h-4 w-4 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-sm font-medium">Templates</span>
                                    </button>
                                    <button
                                        onClick={() => { setIsMoreDropdownOpen(false); setIsAgencyOpen(false); setIsArticlesOpen(false); setIsTemplatesOpen(false); setIsWorkflowNavOpen(false); setIsTrackerOpen(false); setIsClientsOpen(false); setIsWebsitesOpen(false); setIsIdeasOpen(false); setIsAnalyticsOpen(true); }}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-brand-gold hover:bg-slate-700 transition"
                                    >
                                        <svg className="h-4 w-4 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                        <span className="text-sm font-medium">Analytics</span>
                                    </button>
                                    <button
                                        onClick={() => { setIsMoreDropdownOpen(false); setIsAgencyOpen(false); setIsArticlesOpen(false); setIsTemplatesOpen(false); setIsWorkflowNavOpen(false); setIsTrackerOpen(false); setIsClientsOpen(false); setIsWebsitesOpen(false); setIsAnalyticsOpen(false); setIsIdeasOpen(true); }}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-brand-gold hover:bg-slate-700 transition"
                                    >
                                        <svg className="h-4 w-4 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                        <span className="text-sm font-medium">Ideas</span>
                                    </button>
                                    <button
                                        onClick={() => { setIsMoreDropdownOpen(false); setIsAgencyOpen(false); setIsArticlesOpen(false); setIsTemplatesOpen(false); setIsWorkflowNavOpen(false); setIsTrackerOpen(false); setIsClientsOpen(false); setIsWebsitesOpen(false); setIsAnalyticsOpen(false); setIsIdeasOpen(false); setIsBlueprintOpen(true); }}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-brand-gold hover:bg-slate-700 transition rounded-b-lg"
                                    >
                                        <svg className="h-4 w-4 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                                        </svg>
                                        <span className="text-sm font-medium">Blueprint</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </header>

            <main className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="flex flex-col gap-8">
                    {renderSection(<span className="flex flex-col leading-tight"><span>1. Setup</span><span>&amp; Run</span></span>, 'setup', <Icon type="settings" className="h-6 w-6"/>,
                        <div className="space-y-3">
                            {/* Row 1: AI Models - Full Width */}
                            <div className="space-y-2 pt-2">
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-brand-gold mb-1.5 text-center">AI Model 1</label>
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
                                        <label className="flex items-center justify-center gap-1 text-sm font-medium text-brand-gold mb-1.5">
                                            AI Model 2
                                            <span className="relative group cursor-help">
                                                <svg className="w-3.5 h-3.5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-brand-gold text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-brand-gold/50 z-30">Test 2 or 3 models against same workflow</span>
                                            </span>
                                        </label>
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
                                        <label className="flex items-center justify-center gap-1 text-sm font-medium text-brand-gold mb-1.5">
                                            AI Model 3
                                            <span className="relative group cursor-help">
                                                <svg className="w-3.5 h-3.5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-brand-gold text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-brand-gold/50 z-30">Test 2 or 3 models against same workflow</span>
                                            </span>
                                        </label>
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

                            {/* Row 2: Filename + Import/Export/Save Template */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-brand-gold mb-1.5">Filename Template</label>
                                    <input type="text" value={currentProject.state.fileNameTemplate} onChange={e => setCurrentProjectState(p => ({...p, fileNameTemplate: e.target.value}))} className="w-full bg-slate-900 border border-brand-gold/50 rounded-lg px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-brand-gold" />
                                </div>
                                {/* Import/Export JSON */}
                                <div className="flex flex-col justify-end gap-1">
                                    <label className="block text-sm font-medium text-gray-400 text-center">Import / Export JSON</label>
                                    <div className="flex gap-1">
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
                                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-brand-cyan hover:bg-brand-cyan-dark rounded text-slate-900 font-medium text-xs transition"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                            Export
                                        </button>
                                        <label className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-brand-cyan hover:bg-brand-cyan-dark rounded text-slate-900 font-medium text-xs transition cursor-pointer">
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
                                {/* Save as Template */}
                                <div className="flex flex-col justify-end gap-1">
                                    <label className="block text-sm font-medium text-gray-400 text-center">Save to Library</label>
                                    <button
                                        onClick={() => setShowSaveTemplatePopup(true)}
                                        className="flex items-center justify-center gap-1 px-3 py-1.5 bg-brand-gold hover:bg-brand-gold-dark rounded text-slate-900 font-medium text-xs transition"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                                        Save as Template
                                    </button>
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
                                        <div className="flex items-center justify-center gap-2">
                                            <label htmlFor="file-upload" className="cursor-pointer text-xs text-brand-gold hover:text-brand-gold-light transition">
                                                {fileName ? `File: ${fileName}` : 'Or, upload TXT file'}
                                                <input id="file-upload" type="file" accept=".txt,.csv" onChange={handleFileChange} className="hidden" />
                                            </label>
                                            {/* Small Test Mode Button */}
                                            <button
                                                onClick={() => setIsTestRunnerOpen(true)}
                                                disabled={isRunningTestSequence}
                                                className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold rounded transition"
                                                title="Test image pipelines"
                                            >
                                                {isRunningTestSequence ? '...' : 'Test'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => processWorkflow()} disabled={isRunDisabled} className={`w-full flex items-center justify-center font-bold py-4 px-6 rounded-xl transition-all btn-press border-2 ${isRunDisabled ? 'bg-slate-900 border-brand-cyan text-brand-cyan/50 cursor-not-allowed' : 'bg-gradient-to-r from-brand-cyan to-brand-cyan-dark hover:from-brand-cyan-dark hover:to-brand-cyan text-slate-900 border-transparent shadow-card hover:shadow-glow-cyan'}`}>
                                {isProcessing ? <Icon type="working" className="h-5 w-5 animate-spin mr-2" /> : <Icon type="play" className="h-5 w-5 mr-2" />}
                                {getRunButtonText()}
                            </button>
                        </div>
                    , true,
                    <>
                        {/* Workflow Context - Matches Default dropdown style */}
                        {currentWorkflowContext.workflowName && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 border-2 border-brand-gold rounded-lg flex-nowrap">
                                <svg className="h-4 w-4 text-brand-cyan flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="flex flex-col items-center leading-tight">
                                    <span className="text-brand-gold text-sm font-semibold">Current</span>
                                    <span className="text-brand-gold text-[10px]">Workflow</span>
                                </span>
                                <span className="text-slate-500">|</span>
                                {currentWorkflowContext.isStandalone ? (
                                    <>
                                        <span className="text-purple-400 text-sm font-medium">Standalone</span>
                                        <span className="text-slate-500">-</span>
                                        <span className="text-brand-gold text-sm font-semibold">{currentWorkflowContext.workflowName}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-brand-cyan text-sm font-medium whitespace-nowrap">
                                            {(currentWorkflowContext.clientName || 'Client').length > 20
                                                ? (currentWorkflowContext.clientName || 'Client').substring(0, 20) + '...'
                                                : currentWorkflowContext.clientName || 'Client'}
                                        </span>
                                        <span className="text-slate-500">-</span>
                                        <span className="text-brand-gold text-sm font-medium whitespace-nowrap">
                                            {formatWebsiteUrl(currentWorkflowContext.websiteName)}
                                        </span>
                                        <span className="text-slate-500">-</span>
                                        <span className="text-brand-gold text-sm font-semibold whitespace-nowrap">{currentWorkflowContext.workflowName}</span>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Notification Button */}
                        <div className="ml-2">
                            <PendingMetaNotification
                                onOpenArticle={(articleId) => {
                                    setIsArticlesOpen(true);
                                }}
                            />
                        </div>

                        {/* Save Button - Always clickable, shows last save time */}
                        {currentWorkflowContext.workflowName && (
                            <button
                                onClick={() => saveWorkflowToDatabase(true)}
                                disabled={isSaving}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg font-semibold transition border-2 text-xs cursor-pointer hover:opacity-80 ${
                                    hasUnsavedChanges
                                        ? 'bg-yellow-500 text-slate-900 border-yellow-500'
                                        : 'bg-brand-cyan text-slate-900 border-brand-cyan'
                                }`}
                                title="Click to save now"
                            >
                                {isSaving ? (
                                    <>
                                        <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span className="font-bold">Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                                        </svg>
                                        <span className="font-bold">
                                            {hasUnsavedChanges ? 'Save' : 'Saved'}
                                        </span>
                                        {lastSaveTime && (
                                            <span className="text-[10px] opacity-75">{lastSaveTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        )}
                                    </>
                                )}
                            </button>
                        )}
                    </>
                    )}

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
                    
                    {renderSection('Publishing to WordPress', 'wordpress', <Icon type="upload" className="h-6 w-6"/>,
                        <div className="space-y-4 pt-2">
                            {/* Condensed Row: Page/Post Title Template + Type + Model + Quality + SEO Plugin */}
                            <div className="flex items-end gap-3">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-brand-gold mb-1.5">Page/Post Title Template</label>
                                    <input
                                        type="text"
                                        value={currentProject.state.wpTitleTemplate}
                                        onChange={e => setCurrentProjectState(p => ({...p, wpTitleTemplate: e.target.value}))}
                                        className="w-full bg-slate-900 border-2 border-brand-gold rounded-lg px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-brand-gold transition-all"
                                        placeholder="<item_name> or {city}"
                                    />
                                </div>
                                <div className="w-20">
                                    <label className="block text-sm font-medium text-brand-gold mb-1.5 text-center text-xs">Type</label>
                                    <select value={currentProject.state.wpContentType} onChange={e => setCurrentProjectState(p => ({...p, wpContentType: e.target.value as WpContentType}))} className="w-full bg-slate-900 border-2 border-brand-gold rounded-lg px-2 py-2 text-white text-xs focus:ring-2 focus:ring-brand-gold transition-all">
                                        <option value="pages">Page</option>
                                        <option value="posts">Post</option>
                                    </select>
                                </div>
                                <div className="w-28">
                                    <label className="block text-sm font-medium text-brand-gold mb-1.5 text-center text-xs">Model</label>
                                    <select
                                        value={currentProject.state.imageModel || 'flux-1.1-pro'}
                                        onChange={e => setCurrentProjectState(p => ({...p, imageModel: e.target.value}))}
                                        className="w-full bg-slate-900 border-2 border-brand-gold rounded-lg px-1 py-2 text-white text-xs focus:ring-2 focus:ring-brand-gold transition-all"
                                    >
                                        <option value="flux-1.1-pro">Flux 1.1</option>
                                        <option value="seedream-4">Seedream 4</option>
                                        <option value="ideogram-v3-turbo">Ideogram v3</option>
                                        <option value="gpt-image-1.5">GPT Img</option>
                                    </select>
                                </div>
                                <div className="w-20">
                                    <label className="block text-sm font-medium text-brand-gold mb-1.5 text-center text-xs">Quality</label>
                                    <select
                                        value={currentProject.state.imageQuality || 'low'}
                                        onChange={e => setCurrentProjectState(p => ({...p, imageQuality: e.target.value as 'low' | 'medium' | 'high'}))}
                                        className="w-full bg-slate-900 border-2 border-brand-gold rounded-lg px-1 py-2 text-white text-xs focus:ring-2 focus:ring-brand-gold transition-all"
                                    >
                                        {(currentProject.state.imageModel === 'gpt-image-1.5') ? (
                                            <>
                                                <option value="low">Low</option>
                                                <option value="medium">Med</option>
                                                <option value="high">High</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="low">60%</option>
                                                <option value="medium">80%</option>
                                                <option value="high">100%</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div className="w-28">
                                    <label className="block text-sm font-medium text-brand-gold mb-1.5 text-center text-xs">SEO Plugin</label>
                                    <div
                                        className="w-full bg-slate-800 border-2 border-slate-600 rounded-lg px-2 py-2 text-white text-xs text-center cursor-default"
                                        title="Change in Websites settings"
                                    >
                                        {(() => {
                                            const plugin = currentWebsiteSeoPlugin || 'rankmath';
                                            const names: Record<string, string> = {
                                                'aioseo': 'All in One SEO',
                                                'yoast': 'Yoast SEO',
                                                'rankmath': 'Rank Math',
                                                'seopress': 'SEOPress',
                                                'none': 'Direct to WP'
                                            };
                                            return names[plugin] || plugin;
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* WordPress Credentials Section */}
                            <h3 className="text-lg font-semibold text-brand-gold mb-4 flex items-center gap-2 mt-4">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                                WordPress Admin Credentials
                            </h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-brand-gold mb-1.5">WordPress Username</label>
                                    <input type="text" placeholder="Your WP Username" value={currentProject.state.wpCredentials.user} onChange={e => setCurrentProjectState(p => ({...p, wpCredentials: {...p.wpCredentials, user: e.target.value}}))} className="w-full bg-slate-900 border-2 border-brand-gold rounded-lg px-3 py-2.5 text-white focus:ring-2 focus:ring-brand-gold transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-gold mb-1.5">WP Application Password</label>
                                    <input type="password" placeholder="xxxx xxxx xxxx xxxx" value={currentProject.state.wpCredentials.password} onChange={e => setCurrentProjectState(p => ({...p, wpCredentials: {...p.wpCredentials, password: e.target.value}}))} className="w-full bg-slate-900 border-2 border-brand-gold rounded-lg px-3 py-2.5 text-white focus:ring-2 focus:ring-brand-gold transition-all" />
                                </div>
                            </div>
                            <p className="text-xs text-brand-gold/70">Find Application Passwords under `Users &gt; Your Profile` in your WordPress admin dashboard.</p>

                            {/* Meta SEO Generation Settings */}
                            <div className="mt-6 pt-6 border-t border-brand-gold">
                                <h3 className="text-lg font-semibold text-brand-gold mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                    Meta SEO Generation
                                </h3>
                                <p className="text-xs text-brand-gold/70 mb-4">
                                    When a prompt has "Generate Meta SEO" enabled, these settings control how meta titles and descriptions are generated.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-medium text-brand-gold mb-1.5">Meta Title Options</label>
                                        <select
                                            value={currentProject.state.metaTitleCount || 3}
                                            onChange={e => setCurrentProjectState(p => ({...p, metaTitleCount: parseInt(e.target.value)}))}
                                            className="w-full bg-slate-900 border border-brand-gold rounded-lg px-3 py-2.5 text-white focus:ring-2 focus:ring-brand-gold transition-all"
                                        >
                                            <option value="1">1 (Auto-push to SEO)</option>
                                            <option value="2">2 (Draft mode - select one)</option>
                                            <option value="3">3 (Draft mode - select one)</option>
                                            <option value="5">5 (Draft mode - select one)</option>
                                        </select>
                                        <p className="text-xs text-brand-gold/50 mt-1">1 = auto-push, 2+ = choose from options</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-brand-gold mb-1.5">Meta Description Options</label>
                                        <select
                                            value={currentProject.state.metaDescriptionCount || 3}
                                            onChange={e => setCurrentProjectState(p => ({...p, metaDescriptionCount: parseInt(e.target.value)}))}
                                            className="w-full bg-slate-900 border border-brand-gold rounded-lg px-3 py-2.5 text-white focus:ring-2 focus:ring-brand-gold transition-all"
                                        >
                                            <option value="1">1 (Auto-push to SEO)</option>
                                            <option value="2">2 (Draft mode - select one)</option>
                                            <option value="3">3 (Draft mode - select one)</option>
                                            <option value="5">5 (Draft mode - select one)</option>
                                        </select>
                                        <p className="text-xs text-brand-gold/50 mt-1">1 = auto-push, 2+ = choose from options</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-brand-gold mb-1.5">Meta Title Generation Prompt</label>
                                        <textarea
                                            value={currentProject.state.metaTitlePrompt || ''}
                                            onChange={e => setCurrentProjectState(p => ({...p, metaTitlePrompt: e.target.value}))}
                                            rows={3}
                                            className="w-full bg-slate-900 border border-brand-gold rounded-lg px-3 py-2.5 text-white font-mono text-xs focus:ring-2 focus:ring-brand-gold transition-all resize-y"
                                            placeholder="Prompt for generating meta titles..."
                                        />
                                        <p className="text-xs text-brand-gold/50 mt-1">Use {'{count}'} and {'{article_content}'} placeholders</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-brand-gold mb-1.5">Meta Description Generation Prompt</label>
                                        <textarea
                                            value={currentProject.state.metaDescriptionPrompt || ''}
                                            onChange={e => setCurrentProjectState(p => ({...p, metaDescriptionPrompt: e.target.value}))}
                                            rows={3}
                                            className="w-full bg-slate-900 border border-brand-gold rounded-lg px-3 py-2.5 text-white font-mono text-xs focus:ring-2 focus:ring-brand-gold transition-all resize-y"
                                            placeholder="Prompt for generating meta descriptions..."
                                        />
                                        <p className="text-xs text-brand-gold/50 mt-1">Use {'{count}'} and {'{article_content}'} placeholders</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    , false,
                    /* rightContent - Always visible toggles in header */
                    <div className="flex items-center gap-3">
                        {/* WordPress Site URL - compact */}
                        <input
                            type="text"
                            placeholder="https://site.com"
                            value={currentProject.state.wpCredentials.url}
                            onChange={e => setCurrentProjectState(p => ({...p, wpCredentials: {...p.wpCredentials, url: e.target.value}}))}
                            className="w-48 bg-slate-900 border border-brand-gold/50 rounded px-2 py-1 text-white text-xs focus:ring-1 focus:ring-brand-gold"
                        />
                        {/* Article Toggle */}
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-brand-gold/70">Article:</span>
                            <div className="flex rounded overflow-hidden border border-brand-gold/50">
                                <button
                                    type="button"
                                    onClick={() => setCurrentProjectState(p => ({
                                        ...p,
                                        articlePublishMode: 'draft',
                                        wpPublishMode: p.wpPublishMode === 'wordpress' ? 'draft' : p.wpPublishMode,
                                        metaPublishMode: 'draft'
                                    }))}
                                    className={`px-1.5 py-0.5 text-[10px] font-medium transition-all ${
                                        (currentProject.state.articlePublishMode || 'draft') === 'draft'
                                            ? 'bg-brand-gold text-black'
                                            : 'bg-slate-900 text-white hover:bg-slate-800'
                                    }`}
                                >Draft</button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentProjectState(p => ({...p, articlePublishMode: 'wordpress'}))}
                                    className={`px-1.5 py-0.5 text-[10px] font-medium transition-all ${
                                        currentProject.state.articlePublishMode === 'wordpress'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-slate-900 text-white hover:bg-slate-800'
                                    }`}
                                >WP</button>
                            </div>
                        </div>
                        {/* Meta Toggle */}
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-brand-gold/70">Meta:</span>
                            <div className="flex rounded overflow-hidden border border-brand-gold/50">
                                <button
                                    type="button"
                                    onClick={() => setCurrentProjectState(p => ({...p, metaPublishMode: 'draft'}))}
                                    className={`px-1.5 py-0.5 text-[10px] font-medium transition-all ${
                                        (currentProject.state.metaPublishMode || 'draft') === 'draft'
                                            ? 'bg-brand-gold text-black'
                                            : 'bg-slate-900 text-white hover:bg-slate-800'
                                    }`}
                                >Draft</button>
                                <button
                                    type="button"
                                    disabled={(currentProject.state.articlePublishMode || 'draft') === 'draft'}
                                    onClick={() => setCurrentProjectState(p => ({...p, metaPublishMode: 'wordpress'}))}
                                    className={`px-1.5 py-0.5 text-[10px] font-medium transition-all ${
                                        currentProject.state.metaPublishMode === 'wordpress'
                                            ? 'bg-green-600 text-white'
                                            : (currentProject.state.articlePublishMode || 'draft') === 'draft'
                                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                                : 'bg-slate-900 text-white hover:bg-slate-800'
                                    }`}
                                >WP</button>
                            </div>
                        </div>
                        {/* Image Toggle */}
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-brand-gold/70">Image:</span>
                            <div className="flex rounded overflow-hidden border border-brand-gold/50">
                                <button
                                    type="button"
                                    onClick={() => setCurrentProjectState(p => ({...p, wpPublishMode: 'off'}))}
                                    className={`px-1.5 py-0.5 text-[10px] font-medium transition-all ${
                                        (currentProject.state.wpPublishMode || 'off') === 'off'
                                            ? 'bg-red-600 text-white'
                                            : 'bg-slate-900 text-white hover:bg-slate-800'
                                    }`}
                                >Off</button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentProjectState(p => ({...p, wpPublishMode: 'draft'}))}
                                    className={`px-1.5 py-0.5 text-[10px] font-medium transition-all ${
                                        currentProject.state.wpPublishMode === 'draft'
                                            ? 'bg-brand-gold text-black'
                                            : 'bg-slate-900 text-white hover:bg-slate-800'
                                    }`}
                                >Draft</button>
                                <button
                                    type="button"
                                    disabled={(currentProject.state.articlePublishMode || 'draft') === 'draft'}
                                    onClick={() => setCurrentProjectState(p => ({...p, wpPublishMode: 'wordpress'}))}
                                    className={`px-1.5 py-0.5 text-[10px] font-medium transition-all ${
                                        currentProject.state.wpPublishMode === 'wordpress'
                                            ? 'bg-green-600 text-white'
                                            : (currentProject.state.articlePublishMode || 'draft') === 'draft'
                                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                                : 'bg-slate-900 text-white hover:bg-slate-800'
                                    }`}
                                >WP</button>
                            </div>
                        </div>
                    </div>
                    )}

                     {renderSection('3. Tag Manager', 'tags', <Icon type="settings" className="h-6 w-6"/>,
                        <div className="space-y-3">
                             <div className="flex gap-2">
                                <input type="text" placeholder="New Tag Name (e.g. H)" value={newTagName} onChange={e => setNewTagName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} className="w-full bg-slate-900 border border-brand-gold rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-brand-gold transition-all"/>
                                <button onClick={addTag} className="px-4 bg-brand-cyan hover:bg-brand-cyan-dark rounded-lg text-white font-semibold transition">Add</button>
                            </div>
                            <div className="flex flex-wrap gap-2">{currentProject.state.tags.map(t => (<div key={t.id} className="bg-brand-cyan/20 border border-brand-cyan/50 rounded-full px-3 py-1 flex items-center gap-2 text-sm text-brand-cyan"><span>{t.name}</span><button onClick={() => removeTag(t.id)} className="text-brand-cyan/60 hover:text-white transition"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>))}</div>
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
                    {/* Processing Log - at the very top, collapsible */}
                    <div className="bg-card rounded-xl shadow-glow-cyan card-3d border-2 border-brand-cyan relative z-10">
                        <div className="flex items-center justify-between p-5">
                            <button
                                onClick={() => setProcessingLogCollapsed(!processingLogCollapsed)}
                                className="flex-1 text-xl font-bold flex items-center text-brand-cyan hover:text-brand-cyan/80 transition-colors"
                            >
                                <Icon type="info" className="h-6 w-6"/>
                                <span className="ml-3">Processing Log</span>
                                {logs.length > 0 && (
                                    <span className="ml-2 text-xs bg-brand-cyan/20 text-brand-cyan px-2 py-0.5 rounded-full font-normal">
                                        {logs.length} entries
                                    </span>
                                )}
                                <svg className={`w-5 h-5 ml-2 transition-transform ${processingLogCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowHistory(!showHistory)}
                                    className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${showHistory ? 'bg-brand-cyan text-slate-900' : 'bg-slate-700 text-brand-cyan hover:bg-slate-600'}`}
                                >
                                    History
                                </button>
                                <button
                                    onClick={() => setLogSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                                    className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-700 text-brand-cyan hover:bg-slate-600 transition"
                                    title={`Currently showing ${logSortOrder === 'newest' ? 'newest first' : 'oldest first'}`}
                                >
                                    Sorting
                                </button>
                            </div>
                        </div>
                        {!processingLogCollapsed && (
                        <div className="p-5 pt-0 border-t border-brand-cyan/30">
                            {/* History Panel */}
                            {showHistory && (
                            <div className="mb-4 bg-slate-800/50 rounded-lg border border-brand-cyan/30 p-3">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-brand-cyan">Processing History</h3>
                                    <button
                                        onClick={() => setShowHistory(false)}
                                        className="text-slate-400 hover:text-white text-xs"
                                    >
                                        Close
                                    </button>
                                </div>
                                {processingHistory.length === 0 ? (
                                    <p className="text-slate-400 text-sm">No processing runs yet.</p>
                                ) : (
                                    <div className="max-h-[300px] overflow-y-auto space-y-2">
                                        {[...processingHistory].reverse().map(run => (
                                            <button
                                                key={run.id}
                                                onClick={() => {
                                                    setSelectedHistoryRun(run);
                                                    setShowHistory(false);
                                                    // Load the run's logs into the current view
                                                    setLogs(run.logs);
                                                }}
                                                className={`w-full text-left p-2 rounded-lg transition ${
                                                    selectedHistoryRun?.id === run.id
                                                        ? 'bg-brand-cyan/20 border border-brand-cyan/50'
                                                        : 'bg-slate-900/50 hover:bg-slate-700/50 border border-transparent'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-white">{run.projectName}</span>
                                                    <span className="text-xs text-brand-cyan">{run.itemCount} items</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                                    <span>{run.date}</span>
                                                    <span>•</span>
                                                    <span>{run.time}</span>
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500 truncate">
                                                    {run.itemNames.slice(0, 3).join(', ')}{run.itemNames.length > 3 ? ` +${run.itemNames.length - 3} more` : ''}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {processingHistory.length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (confirm('Clear all processing history?')) {
                                                setProcessingHistory([]);
                                                localStorage.removeItem('processingHistory');
                                            }
                                        }}
                                        className="mt-2 text-xs text-red-400 hover:text-red-300"
                                    >
                                        Clear History
                                    </button>
                                )}
                            </div>
                            )}
                            {/* Mode Indicators */}
                            <div className="flex flex-wrap gap-2 mb-3 text-xs font-mono">
                                <span className={`px-2 py-1 rounded ${currentProject?.state?.articlePublishMode === 'wordpress' ? 'bg-green-600/30 text-green-400' : 'bg-amber-600/30 text-amber-400'}`}>
                                    Article: {currentProject?.state?.articlePublishMode === 'wordpress' ? 'WP' : 'Draft'}
                                </span>
                                <span className={`px-2 py-1 rounded ${currentProject?.state?.metaPublishMode === 'wordpress' ? 'bg-green-600/30 text-green-400' : 'bg-amber-600/30 text-amber-400'}`}>
                                    Meta: {currentProject?.state?.metaPublishMode === 'wordpress' ? 'WP' : 'Draft'}
                                </span>
                                <span className={`px-2 py-1 rounded ${
                                    currentProject?.state?.wpPublishMode === 'wordpress' ? 'bg-green-600/30 text-green-400' :
                                    currentProject?.state?.wpPublishMode === 'draft' ? 'bg-amber-600/30 text-amber-400' :
                                    'bg-slate-600/30 text-slate-400'
                                }`}>
                                    Image: {currentProject?.state?.wpPublishMode === 'wordpress' ? 'WP' : currentProject?.state?.wpPublishMode === 'draft' ? 'Draft' : 'Off'}
                                </span>
                                {/* Image Source Counts (when images enabled) - shows actual results */}
                                {currentProject?.state?.wpPublishMode !== 'off' && (
                                    <>
                                        <span className={`px-2 py-1 rounded ${batchImageCounts.fromBank > 0 ? 'bg-brand-gold/30 text-brand-gold' : 'bg-slate-600/30 text-slate-400'}`}>
                                            📦 Bank: {batchImageCounts.fromBank}
                                        </span>
                                        <span className={`px-2 py-1 rounded ${batchImageCounts.fromLive > 0 ? 'bg-brand-cyan/30 text-brand-cyan' : 'bg-slate-600/30 text-slate-400'}`}>
                                            ⚡ Live: {batchImageCounts.fromLive}
                                        </span>
                                    </>
                                )}
                            </div>
                            {/* Logs - expanded to show all (max-h with auto, no fixed h-96) */}
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-slate-400">
                                    {selectedHistoryRun ? `Viewing: ${selectedHistoryRun.projectName} (${selectedHistoryRun.date})` : 'Current Session'}
                                </span>
                                {selectedHistoryRun && (
                                    <button
                                        onClick={() => {
                                            setSelectedHistoryRun(null);
                                            setLogs([]);
                                        }}
                                        className="text-xs text-brand-cyan hover:text-brand-cyan/80"
                                    >
                                        Back to Current
                                    </button>
                                )}
                            </div>
                            <div ref={logContainerRef} className="max-h-[600px] min-h-[200px] bg-slate-900 rounded-lg p-4 overflow-y-auto font-mono text-sm space-y-2 border border-brand-gold/50">
                                {(logSortOrder === 'oldest' ? logs : [...logs].reverse()).map(log => (<div key={log.id} className={`flex items-start ${{ [LogStatus.INFO]: 'text-blue-400', [LogStatus.SUCCESS]: 'text-green-400', [LogStatus.ERROR]: 'text-red-400', [LogStatus.WORKING]: 'text-yellow-400 animate-pulse'}[log.status]}`}>{{ [LogStatus.INFO]: <Icon type="info" className="h-4 w-4 mr-2 flex-shrink-0"/>, [LogStatus.SUCCESS]: <Icon type="success" className="h-4 w-4 mr-2 flex-shrink-0"/>, [LogStatus.ERROR]: <Icon type="error" className="h-4 w-4 mr-2 flex-shrink-0"/>, [LogStatus.WORKING]: <Icon type="working" className="h-4 w-4 mr-2 flex-shrink-0 animate-spin"/>}[log.status]}<span className="flex-1"><span className="text-gray-500 mr-2">{log.timestamp}</span>{log.message}</span></div>))}
                                {logs.length === 0 && <div className="text-gray-500">Logs will appear here once processing starts.</div>}
                            </div>

                            {/* Results Section - Nested inside Processing Log */}
                            {results.length > 0 && (
                            <div className="mt-4 bg-slate-800/50 rounded-lg border border-brand-gold/30">
                                <button
                                    onClick={() => setResultsCollapsed(!resultsCollapsed)}
                                    className="w-full flex items-center justify-between p-3 hover:bg-slate-800/70 transition-colors rounded-t-lg"
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon type="success" className="h-5 w-5 text-brand-gold"/>
                                        <span className="text-sm font-semibold text-brand-gold">Results ({results.length})</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={(e) => { e.stopPropagation(); handleDownloadAll(); }} className="flex items-center bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-dark hover:to-brand-gold text-white font-bold py-1.5 px-3 rounded-lg transition-all text-xs">
                                            <Icon type="download" className="h-4 w-4 mr-1"/>Download All as ZIP
                                        </button>
                                        <svg className={`w-4 h-4 text-brand-gold transition-transform ${resultsCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </button>
                                {!resultsCollapsed && (
                                <div className="p-3 pt-0 border-t border-brand-gold/20">
                                    <div className="max-h-[30rem] overflow-y-auto space-y-3 pr-2">
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
                                                    {/* Image Decision Report */}
                                                    {result.imageDecisionReport && result.imageDecisionReport.mode !== 'none' && (
                                                        <details className="mt-3 pt-3 border-t border-brand-cyan/20">
                                                            <summary className="text-xs font-semibold text-brand-cyan mb-2 cursor-pointer hover:text-brand-cyan/80 flex items-center gap-2">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                                Image Processing Log ({result.imageDecisionReport.images.length} images)
                                                            </summary>
                                                            <div className="bg-slate-800/50 rounded-lg p-3 mt-2 text-xs space-y-2">
                                                                <div className="flex flex-wrap gap-2 text-slate-300 pb-2 border-b border-slate-700">
                                                                    <span className="bg-brand-cyan/20 px-2 py-0.5 rounded text-brand-cyan">
                                                                        Mode: {result.imageDecisionReport.mode === 'live' ? 'Generate Live' : 'Pull from Bank'}
                                                                    </span>
                                                                    {result.imageDecisionReport.model && (
                                                                        <span className="bg-purple-500/20 px-2 py-0.5 rounded text-purple-400">
                                                                            Model: {result.imageDecisionReport.model}
                                                                        </span>
                                                                    )}
                                                                    {result.imageDecisionReport.quality && (
                                                                        <span className="bg-green-500/20 px-2 py-0.5 rounded text-green-400">
                                                                            Quality: {result.imageDecisionReport.quality}
                                                                        </span>
                                                                    )}
                                                                    {result.imageDecisionReport.smartMatchingEnabled && (
                                                                        <span className="bg-orange-500/20 px-2 py-0.5 rounded text-orange-400">
                                                                            Smart Matching: ON
                                                                        </span>
                                                                    )}
                                                                    {result.imageDecisionReport.avatar && (
                                                                        <span className="bg-pink-500/20 px-2 py-0.5 rounded text-pink-400">
                                                                            Avatar: {result.imageDecisionReport.avatar}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {result.imageDecisionReport.matchingRules && result.imageDecisionReport.matchingRules.length > 0 && (
                                                                    <div className="text-slate-400 text-[10px] pb-2 border-b border-slate-700">
                                                                        <span className="text-brand-gold">Rules Applied:</span>
                                                                        <ol className="list-decimal list-inside mt-1 space-y-0.5">
                                                                            {result.imageDecisionReport.matchingRules.map((rule, idx) => (
                                                                                <li key={idx}>{rule}</li>
                                                                            ))}
                                                                        </ol>
                                                                    </div>
                                                                )}
                                                                {result.imageDecisionReport.images.map((img, idx) => (
                                                                    <div key={idx} className="bg-slate-900/50 rounded p-2 border border-slate-700">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <span className={`font-semibold ${img.type === 'hero' ? 'text-brand-gold' : 'text-brand-cyan'}`}>
                                                                                {img.type === 'hero' ? '🖼️ HERO' : `📷 Image #${idx}`}
                                                                                {img.heading && ` - ${img.heading}`}
                                                                            </span>
                                                                            {img.side && <span className="text-slate-500">Side: {img.side}</span>}
                                                                        </div>
                                                                        {result.imageDecisionReport?.mode === 'live' && (
                                                                            <div className="space-y-1 text-slate-400">
                                                                                {img.action && <div><span className="text-slate-500">Action:</span> {img.action}</div>}
                                                                                {img.mood && <div><span className="text-slate-500">Mood:</span> {img.mood}</div>}
                                                                                {img.wordCount !== undefined && <div><span className="text-slate-500">Word Count:</span> {img.wordCount}</div>}
                                                                                {img.prompt && (
                                                                                    <details className="mt-1">
                                                                                        <summary className="text-slate-500 cursor-pointer hover:text-slate-300">View Prompt</summary>
                                                                                        <div className="mt-1 p-2 bg-slate-800 rounded text-[10px] text-slate-300 max-h-20 overflow-y-auto">{img.prompt}</div>
                                                                                    </details>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        {result.imageDecisionReport?.mode === 'bank' && (
                                                                            <div className="space-y-1 text-slate-400">
                                                                                {img.variation && <div><span className="text-slate-500">Variation:</span> {img.variation}</div>}
                                                                                {img.primaryScore !== undefined && (
                                                                                    <div className="flex gap-3">
                                                                                        <span><span className="text-green-400">Primary Score:</span> {img.primaryScore}</span>
                                                                                        <span><span className="text-blue-400">Secondary Score:</span> {img.secondaryScore || 0}</span>
                                                                                    </div>
                                                                                )}
                                                                                {img.matchedPrimary && img.matchedPrimary.length > 0 && (
                                                                                    <div><span className="text-green-400">Primary Keywords:</span> {img.matchedPrimary.join(', ')}</div>
                                                                                )}
                                                                                {img.matchedSecondary && img.matchedSecondary.length > 0 && (
                                                                                    <div><span className="text-blue-400">Secondary Keywords:</span> {img.matchedSecondary.join(', ')}</div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                )}
                            </div>
                            )}
                        </div>
                        )}
                    </div>

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
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={prompt.generateMetaFromOutput || false}
                                                    onChange={e => handleUpdatePrompt(prompt.id, 'generateMetaFromOutput', e.target.checked)}
                                                    className="w-4 h-4 rounded border-2 border-brand-gold text-brand-gold focus:ring-brand-gold bg-slate-900 accent-brand-gold"
                                                />
                                                <span className="text-brand-gold font-semibold text-sm group-hover:text-brand-gold-light transition">Generate Meta SEO</span>
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

                    {/* 7. Image Creation Section */}
                    {renderSection('7. Image Creation', 'imageCreation',
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>,
                        <ImageCreationSection
                            workflowId={currentWorkflowId}
                            tags={currentProject?.state.tags || []}
                            showNotification={showNotification}
                            addLog={addLog}
                            onHeaderControlsReady={setImageCreationHeaderControls}
                        />,
                        false,
                        imageCreationHeaderControls
                    )}

                    {/* 8. Site Planning Section */}
                    {renderSection('8. Site Planning', 'sitePlanning',
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                        </svg>,
                        <SitePlanningSection
                            workflowId={currentWorkflowId}
                            websiteId={currentProject?.website_id || undefined}
                            showNotification={showNotification}
                            onOpenArticles={() => setIsArticlesPageOpen(true)}
                            imagePublishMode={currentProject?.state?.imagePublishMode || 'draft'}
                            articlePublishMode={currentProject?.state?.articlePublishMode || 'draft'}
                            metaPublishMode={currentProject?.state?.metaPublishMode || 'draft'}
                            onImagePublishModeChange={(mode) => setCurrentProjectState(prev => ({ ...prev, imagePublishMode: mode }))}
                            onArticlePublishModeChange={(mode) => setCurrentProjectState(prev => ({ ...prev, articlePublishMode: mode }))}
                            onMetaPublishModeChange={(mode) => setCurrentProjectState(prev => ({ ...prev, metaPublishMode: mode }))}
                            onStartWorkflow={(sitePlanItems) => {
                                // Convert site plan items to workflow items and start processing
                                const workflowItems = sitePlanItems.map((item, index) => ({
                                    id: index,
                                    name: item.name,
                                    tag: item.tag
                                }));
                                // Load items to display in UI
                                loadItems(workflowItems);
                                // Pass items directly to processWorkflow to bypass React state timing issues
                                processWorkflow(workflowItems);
                            }}
                        />
                    )}

                    {/* 9. Local Viking - Rank Tracking & GBP Automation */}
                    {renderSection('9. Local Viking', 'localViking',
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>,
                        <LocalVikingSection
                            websiteId={currentProject?.website_id || undefined}
                            showNotification={showNotification}
                        />
                    )}

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

            {/* VibeCoder Notepad - Floating toggle button */}
            <VibeCoderToggle />

            {/* Help Button - Opens User Manual */}
            <HelpButton position="bottom-left" />

            {/* Logs Button - Opens Session Logs Viewer */}
            <button
                onClick={() => setIsLogViewerOpen(true)}
                className="fixed bottom-4 left-16 z-40 p-2 bg-slate-700 hover:bg-slate-600 rounded-full shadow-lg transition-colors"
                title="View Session Logs"
            >
                <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            </button>

            {/* Log Viewer Modal */}
            <LogViewer isOpen={isLogViewerOpen} onClose={() => setIsLogViewerOpen(false)} />
        </div>
    );
};

export default App;