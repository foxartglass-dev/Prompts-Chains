import React, { useState, useCallback, useRef, useEffect } from 'react';
import useProjectManager, {
  PromptTemplate, Placeholder, TaggedSnippet, Tag, WpContentType, Project
} from './src/hooks/useProjectManager';
import { generateLlmContent } from './src/services/llm-service';
import { checkAiScore } from './src/services/zerogpt-service';
import { parseCsv, downloadFile, downloadProjectConfig, loadProjectConfigFromFile } from './src/services/file-utils';
import Icon from './src/components/Icon';
import ProjectTracker from './src/components/ProjectTracker';

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

// Make JSZip available from the global scope
declare const JSZip: any;

const App: React.FC = () => {
    // UI State for notifications
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

    // Effect to clear notification after a delay
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);
    
    const showNotification = (message: string, type: 'success' | 'info' | 'error') => {
        setNotification({ message, type });
    };

    // App State
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

    // Helper function to update the current project's state
    const setCurrentProjectState = (updater: (prevState: Project['state']) => Project['state']) => {
        if (currentProject) {
            setCurrentProject({
                ...currentProject,
                state: updater(currentProject.state)
            });
        }
    };
    
    const [items, setItems] = useState<WorkflowItem[]>([]);
    const [manualItems, setManualItems] = useState('');
    
    // UI State
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [fileName, setFileName] = useState('');
    const [activeCollapsible, setActiveCollapsible] = useState<string | null>('setup');
    const [newTagName, setNewTagName] = useState('');
    const [selectedPlaceholders, setSelectedPlaceholders] = useState<Set<number>>(new Set());
    const [bulkActionTag, setBulkActionTag] = useState('');
    const [isTrackerOpen, setIsTrackerOpen] = useState(false);
    
    const prevProjectIdRef = useRef<string | null>(null);

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


    const logContainerRef = useRef<HTMLDivElement>(null);
    const draggedPromptId = useRef<number | null>(null);

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
    
    const addLog = useCallback((message: string, status: LogStatus, itemId?: number) => {
        setLogs(prevLogs => {
            const newLog = { id: prevLogs.length, message, status, itemId, timestamp: new Date().toLocaleTimeString() };
            const updatedLogs = [...prevLogs, newLog];
            setTimeout(() => { logContainerRef.current?.scrollTo(0, logContainerRef.current.scrollHeight); }, 0);
            return updatedLogs;
        });
    }, []);

    // --- Data Mutation Handlers (Simulating API Calls) ---

    const handleUpdatePrompt = (id: number, field: keyof PromptTemplate, value: any) => {
        setCurrentProjectState(prev => ({
            ...prev,
            promptTemplates: prev.promptTemplates.map(p => p.id === id ? { ...p, [field]: value } : p)
        }));
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

    const handleUpdatePlaceholder = (id: number, field: 'key' | 'value' | 'tag', value: string) => {
        setCurrentProjectState(prev => ({
            ...prev,
            placeholders: prev.placeholders.map(p => p.id === id ? { ...p, [field]: value } : p)
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
            setActiveCollapsible('loadedItems');
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

        filledTemplate = filledTemplate.replace(/{item_name}/g, item.name);

        return filledTemplate;
    };
    
    const parseFinalOutput = (text: string) => {
        const metaTitlesSeparator = '---META TITLES---';
        const metaDescriptionsSeparator = '---META DESCRIPTIONS---';
        const articleEnd = text.indexOf(metaTitlesSeparator);
        const finalOutput = articleEnd !== -1 ? text.substring(0, articleEnd).trim() : text;
        const titlesStart = text.indexOf(metaTitlesSeparator);
        const descriptionsStart = text.indexOf(metaDescriptionsSeparator);
        let metaTitles: string[] = [];
        if(titlesStart !== -1){
            const titlesBlock = text.substring(titlesStart + metaTitlesSeparator.length, descriptionsStart !== -1 ? descriptionsStart : undefined).trim();
            metaTitles = titlesBlock.split('\n').map(line => line.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
        }
        let metaDescriptions: string[] = [];
        if(descriptionsStart !== -1){
            const descriptionsBlock = text.substring(descriptionsStart + metaDescriptionsSeparator.length).trim();
            metaDescriptions = descriptionsBlock.split('\n').map(line => line.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
        }
        return { finalOutput, metaTitles, metaDescriptions };
    };

    const processWorkflow = async () => {
        if (!currentProject || !items.length || !currentProject.state.promptTemplates.length) {
            addLog('Prerequisites not met: Add items and define at least one prompt.', LogStatus.ERROR);
            return;
        }

        setIsProcessing(true);
        setResults([]);
        setLogs([]);
        addLog(`Starting batch processing for ${items.length} items using ${currentProject.state.provider}/${currentProject.state.model}...`, LogStatus.INFO);
        const startTime = Date.now();

        for (const item of items) {
            const promptOutputs: Record<string, string> = {};
            try {
                if (!item.tag) throw new Error(`Item "${item.name}" is missing a tag.`);
                if (!currentProject.state.tags.find(t => t.name === item.tag)) throw new Error(`Tag "${item.tag}" is not defined.`);
                
                addLog(`[${item.name}] Starting process...`, LogStatus.WORKING, item.id);

                for (const prompt of currentProject.state.promptTemplates) {
                    addLog(`[${item.name}] Running prompt: "${prompt.name}"...`, LogStatus.INFO, item.id);
                    const filledPrompt = fillPrompt(prompt.template, item, promptOutputs);
                    const output = await generateLlmContent(
                        filledPrompt,
                        currentProject.state.provider,
                        currentProject.state.model,
                        { anthropic: currentProject.state.apiKeys.anthropic }
                    );
                    if (output.startsWith('Error:')) throw new Error(output);
                    promptOutputs[prompt.outputKey] = output;
                }
                
                const finalPrompts = currentProject.state.promptTemplates.filter(p => p.outputAction === 'addToFinal');
                const mainContentKeys = finalPrompts.length > 0 ? finalPrompts.map(p => p.outputKey) : [currentProject.state.promptTemplates[currentProject.state.promptTemplates.length - 1]?.outputKey].filter(Boolean);
                
                const combinedOutput = mainContentKeys.map(key => promptOutputs[key]).join('\n\n---\n\n');
                
                const { finalOutput, metaTitles, metaDescriptions } = parseFinalOutput(combinedOutput);
                addLog(`[${item.name}] Generated final content.`, LogStatus.INFO, item.id);

                addLog(`[${item.name}] Checking AI score with ZeroGPT...`, LogStatus.WORKING, item.id);
                const { score: aiScore, wordCount } = await checkAiScore(currentProject.state.apiKeys.zeroGpt, finalOutput);
                addLog(`[${item.name}] AI score: ${aiScore}%, Word count: ${wordCount}`, LogStatus.INFO, item.id);

                const status = aiScore >= 40 ? 'FLAGGED' : 'PASSED';
                const timestamp = new Date().toISOString();
                
                const txtContent = `${finalOutput}\n\n---META TITLES---\n${metaTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n---META DESCRIPTIONS---\n${metaDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`;
                
                const jsonContent = JSON.stringify({
                    item_name: item.name, tag: item.tag, final_output: finalOutput, parsed_titles: metaTitles,
                    parsed_summaries: metaDescriptions, ai_detection_score: aiScore, flagged: status === 'FLAGGED', word_count: wordCount, timestamp,
                }, null, 2);

                setResults(prev => [...prev, { item, finalOutput, metaTitles, metaDescriptions, aiScore, wordCount, status, timestamp, jsonContent, txtContent, allOutputs: promptOutputs, wpStatus: 'idle' }]);
                addLog(`[${item.name}] Process finished. Status: ${status}`, status === 'PASSED' ? LogStatus.SUCCESS : LogStatus.ERROR, item.id);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
                addLog(`[${item.name}] Failed: ${errorMessage}`, LogStatus.ERROR, item.id);
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

    const handlePublishToWordPress = async (result: Result) => {
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
        addLog(`[${result.item.name}] Publishing to WordPress...`, LogStatus.WORKING, result.item.id);

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

            // Use backend proxy to avoid CORS issues
            const response = await fetch('/api/wordpress/publish', {
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
                    status: 'draft', // Default to draft for safety
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `WordPress API Error: ${response.statusText}`);
            }

            updateResultStatus(result.item.id, 'published', data.link);
            addLog(`[${result.item.name}] Successfully published to WordPress!`, LogStatus.SUCCESS, result.item.id);

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
    
    const toggleCollapsible = (section: string) => setActiveCollapsible(activeCollapsible === section ? null : section);

    if (!currentProject) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                Loading Project...
            </div>
        );
    }
    
    const renderSection = (title: string, id: string, icon: React.ReactNode, children: React.ReactNode, defaultOpen = false) => (
      <div className="bg-gray-800 rounded-lg shadow-lg">
        <h2 className={`text-xl font-bold flex items-center text-cyan-400 p-6 cursor-pointer`} onClick={() => toggleCollapsible(id)}>
          {icon}
          <span className="ml-3">{title}</span>
           <svg className={`w-5 h-5 ml-auto transform transition-transform ${(activeCollapsible === id || (!activeCollapsible && defaultOpen && id === 'setup')) ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </h2>
        <div className={`transition-all duration-300 ease-in-out ${(activeCollapsible === id || (!activeCollapsible && defaultOpen && id === 'setup')) ? 'max-h-[5000px]' : 'max-h-0 overflow-hidden'}`}>
            <div className="p-6 pt-0">{children}</div>
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
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
             {notification && (
                <div className={`fixed top-5 right-5 z-50 px-6 py-3 rounded-lg shadow-lg text-white transition-opacity duration-300 ${notification.type === 'success' ? 'bg-green-600' : notification.type === 'info' ? 'bg-cyan-600' : 'bg-red-600'}`}>
                    {notification.message}
                </div>
            )}
            <ProjectTracker isOpen={isTrackerOpen} onClose={() => setIsTrackerOpen(false)} />
            <header className="mb-8 flex items-center justify-between">
                <div className="text-left">
                    <h1 className="text-4xl font-bold text-white tracking-tight">PromptFlow: Advanced Workflow Automator</h1>
                    <p className="text-gray-400 mt-2">Visually chain AI prompts, use variables, and process lists of data to generate customized content at scale.</p>
                </div>
                <button 
                    onClick={() => setIsTrackerOpen(true)}
                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-cyan-300 font-bold py-2 px-4 rounded-lg transition"
                    title="Show Project Tracker"
                >
                    <Icon type="document" className="h-5 w-5" />
                    <span>Project Tracker</span>
                </button>
            </header>

            <main className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="flex flex-col gap-8">
                    {renderSection('1. Setup & Run', 'setup', <Icon type="settings" className="h-6 w-6"/>,
                        <div className="space-y-4">
                             {/* API Keys and Model Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">ZeroGPT API Key (Optional)</label>
                                    <input type="password" placeholder="ZeroGPT API Key" value={currentProject.state.apiKeys.zeroGpt} onChange={e => setCurrentProjectState(p => ({...p, apiKeys: {...p.apiKeys, zeroGpt: e.target.value}}))} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Anthropic API Key (Required)</label>
                                    <input type="password" placeholder="sk-ant-..." value={currentProject.state.apiKeys.anthropic} onChange={e => setCurrentProjectState(p => ({...p, apiKeys: {...p.apiKeys, anthropic: e.target.value}}))} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500" />
                                </div>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">AI Model</label>
                                <select
                                    value={currentProject.state.model}
                                    onChange={e => setCurrentProjectState(p => ({...p, model: e.target.value}))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (Latest)</option>
                                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                                    <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                                    <option value="claude-3-haiku-20240307">Claude 3 Haiku (Fast)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Filename Template</label>
                                <input type="text" value={currentProject.state.fileNameTemplate} onChange={e => setCurrentProjectState(p => ({...p, fileNameTemplate: e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-cyan-500" />
                            </div>
                            
                            {/* Project Management */}
                             <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 space-y-3">
                                <h3 className="text-lg font-semibold text-gray-300">Project Management</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={handleCreateNewProject} className="w-full text-center px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-white font-semibold text-sm">+ New Project</button>
                                    <select 
                                        onChange={(e) => {
                                            const project = projects.find(p => p.id === e.target.value);
                                            if(project) setCurrentProject(project);
                                        }} 
                                        value={currentProject.id}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
                                    >
                                        <option value="" disabled>Load Project</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                     <input
                                        type="text"
                                        placeholder="Enter project name..."
                                        value={currentProject.name === 'Untitled Project' ? '' : currentProject.name}
                                        onChange={e => setCurrentProject({...currentProject, name: e.target.value || 'Untitled Project'})}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
                                    />
                                    <button onClick={handleSaveProject} className="px-4 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white font-semibold">Save</button>
                                    <button onClick={handleDeleteProject} className="p-2 bg-red-600 hover:bg-red-700 rounded-md text-white transition" title="Delete current project">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>
                                {/* JSON Export/Import */}
                                <div className="flex gap-2 mt-2">
                                    <button
                                        onClick={() => {
                                            const data = exportProjectHook();
                                            if (data) {
                                                const filename = `${currentProject.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-config.json`;
                                                downloadProjectConfig(data, filename);
                                                showNotification('Project exported to JSON!', 'success');
                                            }
                                        }}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-white text-sm transition"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                        Export JSON
                                    </button>
                                    <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-white text-sm transition cursor-pointer">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                        Import JSON
                                        <input
                                            type="file"
                                            accept=".json"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    try {
                                                        const data = await loadProjectConfigFromFile(file) as Project;
                                                        importProjectHook(data);
                                                    } catch (error) {
                                                        showNotification('Failed to import project. Invalid JSON.', 'error');
                                                    }
                                                }
                                                e.target.value = '';
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>


                            {/* Item Input */}
                            <div>
                                <label htmlFor="manual-items" className="block text-sm font-medium text-gray-400 mb-1">
                                    Add Items (one per line)
                                </label>
                                <textarea
                                    id="manual-items"
                                    rows={6}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono text-sm focus:ring-2 focus:ring-cyan-500"
                                    placeholder="Topic A(H)&#10;Topic B(H)&#10;Product X(J)"
                                    value={manualItems}
                                    onChange={(e) => setManualItems(e.target.value)}
                                />
                                <div className="mt-2 flex items-center justify-between">
                                    <button
                                        onClick={handleManualAddItems}
                                        className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md transition text-sm"
                                    >
                                        Add Items from Text
                                    </button>
                                    <label htmlFor="file-upload" className="cursor-pointer text-sm text-cyan-400 hover:text-cyan-300">
                                        {fileName ? `File: ${fileName}` : 'Or, upload a CSV file'}
                                        <input id="file-upload" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                                    </label>
                                </div>
                            </div>
                            <button onClick={processWorkflow} disabled={isRunDisabled} className="w-full flex items-center justify-center bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-md transition disabled:bg-gray-500 disabled:cursor-not-allowed">
                                {isProcessing ? <Icon type="working" className="h-5 w-5 animate-spin mr-2" /> : <Icon type="play" className="h-5 w-5 mr-2" />}
                                {getRunButtonText()}
                            </button>
                        </div>
                    , true)}
                    
                    {items.length > 0 && renderSection('2. Loaded Items', 'loadedItems', <Icon type="document" className="h-6 w-6"/>,
                        <div className="space-y-2">
                            <p className="text-gray-300">{items.length} item(s) loaded.</p>
                            <div className="max-h-60 overflow-y-auto bg-gray-900/50 rounded-md p-2 border border-gray-700">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                                        <tr>
                                            <th scope="col" className="px-4 py-2">Item Name</th>
                                            <th scope="col" className="px-4 py-2">Tag</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map(s => (
                                            <tr key={s.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                                                <td className="px-4 py-2 font-medium text-white">{s.name}</td>
                                                <td className="px-4 py-2">{s.tag || 'N/A'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    , true)}
                    
                    {renderSection('Publishing (Example: WordPress)', 'wordpress', <Icon type="upload" className="h-6 w-6"/>,
                        <div className="space-y-4 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                            <p className="text-yellow-300 text-sm">
                                <strong className="font-bold">Security Warning:</strong> This is for testing only. Application Passwords should be handled by a secure backend in a real application, not entered in the browser.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">WordPress Site URL</label>
                                    <input type="text" placeholder="https://yourdomain.com" value={currentProject.state.wpCredentials.url} onChange={e => setCurrentProjectState(p => ({...p, wpCredentials: {...p.wpCredentials, url: e.target.value}}))} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Content Type</label>
                                    <select value={currentProject.state.wpContentType} onChange={e => setCurrentProjectState(p => ({...p, wpContentType: e.target.value as WpContentType}))} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500">
                                        <option value="pages">Page</option>
                                        <option value="posts">Post</option>
                                    </select>
                                </div>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Page/Post Title Template</label>
                                <input
                                    type="text"
                                    value={currentProject.state.wpTitleTemplate}
                                    onChange={e => setCurrentProjectState(p => ({...p, wpTitleTemplate: e.target.value}))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-cyan-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Use variables like {'{item_name}'} or {'{city}'}.
                                </p>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">WordPress Username</label>
                                    <input type="text" placeholder="Your WP Username" value={currentProject.state.wpCredentials.user} onChange={e => setCurrentProjectState(p => ({...p, wpCredentials: {...p.wpCredentials, user: e.target.value}}))} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">WP Application Password</label>
                                    <input type="password" placeholder="xxxx xxxx xxxx xxxx" value={currentProject.state.wpCredentials.password} onChange={e => setCurrentProjectState(p => ({...p, wpCredentials: {...p.wpCredentials, password: e.target.value}}))} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500" />
                                </div>
                            </div>
                            <p className="text-xs text-gray-400">Find Application Passwords under `Users &gt; Your Profile` in your WordPress admin dashboard.</p>
                        </div>
                    )}

                     {renderSection('3. Tag Manager', 'tags', <Icon type="settings" className="h-6 w-6"/>,
                        <div className="space-y-3">
                             <div className="flex gap-2">
                                <input type="text" placeholder="New Tag Name (e.g. H)" value={newTagName} onChange={e => setNewTagName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2"/>
                                <button onClick={addTag} className="px-4 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white font-semibold">Add</button>
                            </div>
                            <div className="flex flex-wrap gap-2">{currentProject.state.tags.map(t => (<div key={t.id} className="bg-gray-700 rounded-full px-3 py-1 flex items-center gap-2 text-sm"><span>{t.name}</span><button onClick={() => removeTag(t.id)} className="text-gray-400 hover:text-white"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>))}</div>
                        </div>
                     )}

                    {renderSection('4. Workflow Variables', 'placeholders', <Icon type="info" className="h-6 w-6"/>, 
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-300 mb-2 border-b border-gray-700 pb-1">Global Variables</h3>
                                {selectedPlaceholders.size > 0 && (
                                    <div className="bg-gray-900/50 p-3 rounded-md mb-3 flex items-center gap-3">
                                        <span className="text-sm font-semibold">{selectedPlaceholders.size} selected</span>
                                        <select value={bulkActionTag} onChange={e => setBulkActionTag(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm">
                                            <option value="">Select Tag...</option>
                                            {currentProject.state.tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                        </select>
                                        <button onClick={handleBulkTagPlaceholders} disabled={!bulkActionTag} className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white text-sm font-semibold disabled:bg-gray-500">Apply Tag</button>
                                    </div>
                                )}
                                <div className="space-y-2">
                                {currentProject.state.placeholders.filter(p=>!p.tag).map(p => (<div key={p.id} className="grid grid-cols-[auto,1fr,1fr,auto] gap-2 items-center">
                                    <input type="checkbox" checked={selectedPlaceholders.has(p.id)} onChange={() => togglePlaceholderSelection(p.id)} className="form-checkbox h-4 w-4 bg-gray-700 border-gray-600 text-cyan-600 focus:ring-cyan-500 rounded"/>
                                    <input type="text" placeholder="{key}" value={p.key} onChange={e => handleUpdatePlaceholder(p.id, 'key', e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 text-sm"/>
                                    <input type="text" placeholder="value" value={p.value} onChange={e => handleUpdatePlaceholder(p.id, 'value', e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 text-sm"/>
                                    <button onClick={() => handleDeletePlaceholder(p.id)} className="p-2 bg-red-600/50 hover:bg-red-600 rounded-md text-white transition"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2
 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                </div>))}
                                </div>
                                <button onClick={() => handleAddPlaceholder()} className="mt-2 text-cyan-400 hover:text-cyan-300 font-semibold text-sm">+ Add Global Variable</button>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-300 mb-2 border-b border-gray-700 pb-1">Tagged Variables</h3>
                                {currentProject.state.tags.map(tag => (
                                    <div key={tag.id} className="mb-4">
                                        <p className="font-bold text-cyan-400 text-sm mb-2">Tag: {tag.name}</p>
                                        <div className="space-y-2">
                                            {currentProject.state.placeholders.filter(p=>p.tag===tag.name).map(p => (<div key={p.id} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center">
                                                <input type="text" placeholder={`{key{${tag.name}}}`} value={p.key} onChange={e => handleUpdatePlaceholder(p.id, 'key', e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"/>
                                                <input type="text" placeholder="value" value={p.value} onChange={e => handleUpdatePlaceholder(p.id, 'value', e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"/>
                                                <div className="relative group">
                                                    <button className="p-2 text-gray-400 hover:text-white">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                                                    </button>
                                                    <div className="absolute right-0 bottom-full z-10 mb-2 w-max bg-gray-900 border border-gray-700 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                                                        <button onClick={() => handleMakePlaceholderUniversal(p.id)} className="block w-full text-left px-3 py-2 hover:bg-gray-700 rounded-t">Make Global</button>
                                                        <button onClick={() => handleDeletePlaceholder(p.id)} className="block w-full text-left px-3 py-2 hover:bg-gray-700 rounded-b text-red-400">Delete Variable</button>
                                                    </div>
                                                </div>
                                            </div>))}
                                        </div>
                                        <button onClick={() => handleAddPlaceholder(tag.name)} className="mt-2 text-cyan-400 hover:text-cyan-300 font-semibold text-sm ml-1">+ Add Variable for Tag: {tag.name}</button>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-300 mb-2 border-b border-gray-700 pb-1">Prompt Output Variables <span className="text-xs text-gray-500">(Read-only)</span></h3>
                                <p className="text-xs text-gray-400 mb-2">These are generated from the 'Output Key' in your Prompt Workflow steps. Use them in later prompts like: <span className="font-mono bg-gray-900/50 p-1 rounded">[output_key]</span></p>
                                <div className="flex flex-wrap gap-2">{currentProject.state.promptTemplates.map(p=>(<div key={p.id} className="bg-gray-700 rounded-full px-3 py-1 text-sm font-mono">[{p.outputKey}]</div>))}</div>
                            </div>
                        </div>
                    )}
                    
                    {renderSection('5. Conditional Snippets', 'snippets', <Icon type="document" className="h-6 w-6"/>, 
                        <div className="space-y-4">
                             {currentProject.state.taggedSnippets.map(s => (
                                <div key={s.id} className="bg-gray-900/50 p-4 rounded-lg space-y-2">
                                    <div className="flex gap-2 items-center">
                                        <input type="text" placeholder={`{{{SnippetName}}}`} value={s.key} onChange={e => handleSnippetChange(s.id, 'key', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 font-semibold"/>
                                        <button onClick={() => removeSnippet(s.id)} className="p-2 bg-red-600/50 hover:bg-red-600 rounded-md text-white transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                    </div>
                                    <div className={`grid grid-cols-1 md:grid-cols-${Math.min(currentProject.state.tags.length, 3)} gap-2`}>
                                        {currentProject.state.tags.map(tag => (
                                            <div key={tag.id}>
                                                <label className="block text-xs font-medium text-gray-400 mb-1">For Tag: {tag.name}</label>
                                                <textarea placeholder={`Value for tag: (${tag.name})`} value={s.values[tag.name] || ''} onChange={e => handleSnippetChange(s.id, 'values', { ...s.values, [tag.name]: e.target.value })} rows={3} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-cyan-500" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                             ))}
                             <button onClick={addSnippet} className="text-cyan-400 hover:text-cyan-300 font-semibold text-sm">+ Add Snippet</button>
                        </div>
                    )}
                </div>

                {/* Right Column */}
                <div className="flex flex-col gap-8">
                    {renderSection('6. Prompt Workflow', 'prompts', <Icon type="document" className="h-6 w-6"/>, 
                        <div className="space-y-4">
                            {currentProject.state.promptTemplates.map((prompt, index) => (
                                <div key={prompt.id} draggable onDragStart={() => draggedPromptId.current = prompt.id} onDragOver={e => e.preventDefault()} onDrop={() => handleReorderPrompts(draggedPromptId.current!, prompt.id)}
                                    className="bg-gray-900/50 p-4 rounded-lg space-y-3 border border-gray-700 cursor-grab active:cursor-grabbing">
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400 font-bold">{index + 1}</span>
                                        <input type="text" value={prompt.name} onChange={e => handleUpdatePrompt(prompt.id, 'name', e.target.value)} placeholder="Prompt Name" className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 font-semibold"/>
                                        <input type="text" value={prompt.outputKey} onChange={e => handleUpdatePrompt(prompt.id, 'outputKey', e.target.value)} placeholder="Output Key" className="w-1/3 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 font-mono text-xs" title="Output Placeholder Key"/>
                                        <button onClick={() => handleDuplicatePrompt(prompt.id)} className="p-2 text-cyan-400 hover:text-white" title="Duplicate Prompt">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                        </button>
                                        <button onClick={() => handleDeletePrompt(prompt.id)} className="p-2 bg-red-600/50 hover:bg-red-600 rounded-md text-white transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                    </div>
                                    <textarea value={prompt.template} onChange={e => handleUpdatePrompt(prompt.id, 'template', e.target.value)} rows={8} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono text-xs"></textarea>
                                    <div className="text-right text-xs text-gray-400">
                                        <label htmlFor={`output-action-${prompt.id}`} className="mr-2 font-semibold">Output Action:</label>
                                        <select id={`output-action-${prompt.id}`} value={prompt.outputAction || ''} onChange={e => handleUpdatePrompt(prompt.id, 'outputAction', e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-xs text-gray-300">
                                            <option value="">(none)</option>
                                            <option value="addToFinal">Add to final document</option>
                                            <option value="download">Mark for individual download</option>
                                        </select>
                                    </div>
                                </div>
                            ))}
                            <div className="flex justify-between items-center">
                                <button onClick={handleAddPrompt} className="text-cyan-400 hover:text-cyan-300 font-semibold text-sm">+ Add Prompt Step</button>
                            </div>
                        </div>
                    )}
                    <div className="bg-gray-800 rounded-lg shadow-lg">
                        <h2 className={`text-xl font-bold flex items-center text-cyan-400 p-6`}><Icon type="info" className="h-6 w-6"/><span className="ml-3">Processing Log</span></h2>
                        <div className="p-6 pt-0">
                            <div ref={logContainerRef} className="h-96 bg-gray-900 rounded-md p-4 overflow-y-auto font-mono text-sm space-y-2 border border-gray-700">
                                {logs.map(log => (<div key={log.id} className={`flex items-start ${{ [LogStatus.INFO]: 'text-blue-400', [LogStatus.SUCCESS]: 'text-green-400', [LogStatus.ERROR]: 'text-red-400', [LogStatus.WORKING]: 'text-yellow-400 animate-pulse'}[log.status]}`}>{{ [LogStatus.INFO]: <Icon type="info" className="h-4 w-4 mr-2 flex-shrink-0"/>, [LogStatus.SUCCESS]: <Icon type="success" className="h-4 w-4 mr-2 flex-shrink-0"/>, [LogStatus.ERROR]: <Icon type="error" className="h-4 w-4 mr-2 flex-shrink-0"/>, [LogStatus.WORKING]: <Icon type="working" className="h-4 w-4 mr-2 flex-shrink-0 animate-spin"/>}[log.status]}<span className="flex-1"><span className="text-gray-500 mr-2">{log.timestamp}</span>{log.message}</span></div>))}
                                {logs.length === 0 && <div className="text-gray-500">Logs will appear here once processing starts.</div>}
                            </div>
                        </div>
                    </div>
                     {results.length > 0 && <div className="bg-gray-800 rounded-lg shadow-lg">
                        <div className="p-6 flex items-center justify-between">
                            <h2 className={`text-xl font-bold flex items-center text-cyan-400`}><Icon type="success" className="h-6 w-6"/><span className="ml-3">Results ({results.length})</span></h2>
                            <button onClick={handleDownloadAll} className="flex items-center bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition text-sm"><Icon type="download" className="h-5 w-5 mr-2"/>Download All as ZIP</button>
                        </div>
                         <div className="p-6 pt-0">
                            <div className="max-h-[40rem] overflow-y-auto space-y-3 pr-2">
                               {results.map(result => {
                                    const PublishButton = () => {
                                        switch (result.wpStatus) {
                                            case 'publishing':
                                                return <button className="p-2 bg-yellow-600 rounded-md transition" title="Publishing..."><Icon type="working" className="h-5 w-5 animate-spin"/></button>;
                                            case 'published':
                                                return <a href={result.wpLink} target="_blank" rel="noopener noreferrer" className="p-2 bg-green-600 hover:bg-green-500 rounded-md transition" title="View on WordPress"><Icon type="success" className="h-5 w-5"/></a>;
                                            case 'error':
                                                return <button onClick={() => handlePublishToWordPress(result)} className="p-2 bg-red-600 hover:bg-red-500 rounded-md transition" title={`Error: ${result.wpError}\nClick to retry.`}><Icon type="error" className="h-5 w-5"/></button>;
                                            default:
                                                return <button onClick={() => handlePublishToWordPress(result)} className="p-2 bg-gray-600 hover:bg-cyan-600 rounded-md transition" title="Publish to WordPress"><Icon type="upload" className="h-5 w-5"/></button>;
                                        }
                                    };
                                    return (
                                        <div key={result.item.id} className="bg-gray-700 p-4 rounded-md">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold text-white">{result.item.name}</p>
                                                    <div className="flex items-center text-xs text-gray-400 mt-1">
                                                        <span className={`px-2 py-0.5 rounded-full mr-2 text-white ${result.status === 'PASSED' ? 'bg-green-600' : 'bg-red-600'}`}>{result.status}</span>
                                                        <span>AI: {result.aiScore}%</span><span className="mx-2">|</span><span>{result.wordCount} words</span>
                                                    </div>
                                                </div>
                                                <div className="flex space-x-2">
                                                    <button onClick={() => handleDownload(result.txtContent, getFilename(result.item, result.status, 'txt'), 'text/plain')} className="p-2 bg-gray-600 hover:bg-cyan-600 rounded-md transition" title="Download Combined .txt"><Icon type="document" className="h-5 w-5"/></button>
                                                    <button onClick={() => handleDownload(result.jsonContent, getFilename(result.item, result.status, 'json'), 'application/json')} className="p-2 bg-gray-600 hover:bg-cyan-600 rounded-md transition" title="Download .json"><Icon type="json" className="h-5 w-5"/></button>
                                                    <PublishButton />
                                                </div>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-gray-600/50">
                                                <p className="text-xs font-semibold text-gray-400 mb-2">Individual Prompt Outputs:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(result.allOutputs).map(([key, value]) => (
                                                        <button key={key} onClick={() => handleDownload(value, `${key}.txt`, 'text/plain')} className="text-xs bg-gray-600/70 hover:bg-gray-600 text-cyan-300 px-3 py-1 rounded-full transition">
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
        </div>
    );
};

export default App;