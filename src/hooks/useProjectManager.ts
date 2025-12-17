import { useState, useEffect } from 'react';

// Types inline to avoid circular dependencies
export interface PromptTemplate {
  id: number;
  name: string;
  template: string;
  outputKey: string;
  outputAction?: 'addToFinal' | 'download';
}

export interface Placeholder {
  id: number;
  key: string;
  value: string;
  tag?: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface TaggedSnippet {
  id: number;
  key: string;
  values: { [tagName: string]: string };
}

export interface OptionVariable {
  id: number;
  key: string;
  prompt: string;
  optionCount: number;
}

export type WpContentType = 'pages' | 'posts';

export interface ProjectState {
  apiKeys: {
    zeroGpt: string;
    anthropic: string;
    openai: string;
    gemini: string;
    grok: string;
    openRouter: string;
  };
  useOpenRouter: boolean;
  autoSaveEnabled: boolean;
  autoSaveSeconds: number;
  provider: string;
  model: string;
  model2: string;  // For multi-model testing (empty or 'not-in-use' means disabled)
  model3: string;  // For multi-model testing (empty or 'not-in-use' means disabled)
  fileNameTemplate: string;
  wpCredentials: { url: string; user: string; password: string };
  wpContentType: WpContentType;
  wpTitleTemplate: string;
  tags: Tag[];
  placeholders: Placeholder[];
  taggedSnippets: TaggedSnippet[];
  promptTemplates: PromptTemplate[];
  optionVariables: OptionVariable[];
  projectNotes: string;
  workflowNotes: string;
}

export interface Project {
  id: string;
  name: string;
  state: ProjectState;
}

const STORAGE_KEY = 'promptFlowProjects_v2';

const initialPromptTemplates: PromptTemplate[] = [
  {
    id: 1,
    name: '1. Analyze Input',
    template: 'Generate 5 key talking points for the topic "{item_name}". The primary keyword is "{primary_keyword}".',
    outputKey: 'talking_points',
  },
  {
    id: 2,
    name: '2. Create Outline',
    template: 'Based on these talking points:\n[talking_points]\n\nCreate a detailed outline for a document about "{item_name}".\n\nThe target audience is:\n{{{audience_profile}}}\n\nStructure it with sections and sub-sections.',
    outputKey: 'outline',
  },
  {
    id: 3,
    name: '3. Write Document',
    template: 'Write a full, high-quality document (~500 words) based on this outline:\n[outline]\n\nThe document is about "{item_name}".\n\nIt should be written for the following audience:\n{{{audience_profile}}}\n\nAfter the document, provide 3 potential titles and 3 short summaries. Format the output strictly as:\n[Full Document Content]\n\n---META TITLES---\n1. [Title 1]\n2. [Title 2]\n3. [Title 3]\n\n---META DESCRIPTIONS---\n1. [Summary 1]\n2. [Summary 2]\n3. [Summary 3]',
    outputKey: 'final_document',
    outputAction: 'addToFinal',
  },
];

const initialPlaceholders: Placeholder[] = [
  { id: 1, key: 'city', value: 'Austin' },
  { id: 2, key: 'primary_keyword', value: 'Data Science' },
  { id: 3, key: 'topic_variant', value: 'Machine Learning', tag: 'B' },
  { id: 4, key: 'topic_variant', value: 'Deep Learning', tag: 'E' },
];

const initialTags: Tag[] = [
  { id: 1, name: 'B' },
  { id: 2, name: 'E' },
  { id: 3, name: 'G' },
];

const initialTaggedSnippets: TaggedSnippet[] = [
  {
    id: 1,
    key: 'audience_profile',
    values: {
      'B': 'For Beginners: Students and enthusiasts new to the topic, avoid jargon.',
      'E': 'For Experts: Professionals with deep domain knowledge, use technical terms.',
      'G': 'For a General Audience: Everyday people interested in the basics.',
    },
  },
];

const initialProjectState: ProjectState = {
  apiKeys: { zeroGpt: '', anthropic: '', openai: '', gemini: '', grok: '', openRouter: '' },
  useOpenRouter: false,
  autoSaveEnabled: true,
  autoSaveSeconds: 3,
  provider: 'anthropic',
  model: 'claude-sonnet-4-5-20250929',
  model2: 'not-in-use',
  model3: 'not-in-use',
  fileNameTemplate: '{tag}-{item_name}-output',
  wpCredentials: { url: '', user: '', password: '' },
  wpContentType: 'posts',
  wpTitleTemplate: 'An Introduction to {item_name}',
  tags: initialTags,
  placeholders: initialPlaceholders,
  taggedSnippets: initialTaggedSnippets,
  promptTemplates: initialPromptTemplates,
  optionVariables: [],
  projectNotes: '',
  workflowNotes: '',
};

const createNewProjectObject = (name: string = 'Untitled Project'): Project => ({
  id: `proj_${Date.now()}`,
  name,
  state: JSON.parse(JSON.stringify(initialProjectState)),
});

// Fetch default config from server (reads from .env or Railway env vars)
async function fetchDefaultConfig() {
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const data = await response.json();
      return data.defaults;
    }
  } catch (error) {
    console.log('Could not fetch config defaults (server may not be running)');
  }
  return null;
}

// Apply defaults to a project (fills empty fields with env values)
function applyDefaults(project: Project, defaults: any): Project {
  if (!defaults) return project;

  return {
    ...project,
    state: {
      ...project.state,
      apiKeys: {
        anthropic: project.state.apiKeys.anthropic || defaults.anthropicApiKey || '',
        zeroGpt: project.state.apiKeys.zeroGpt || defaults.zeroGptApiKey || '',
      },
      wpCredentials: {
        url: project.state.wpCredentials.url || defaults.wpUrl || '',
        user: project.state.wpCredentials.user || defaults.wpUser || '',
        password: project.state.wpCredentials.password || defaults.wpPassword || '',
      },
    },
  };
}

const useProjectManager = (
  onSuccess?: (message: string, type: 'success' | 'info' | 'error') => void
) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [envDefaults, setEnvDefaults] = useState<any>(null);

  // Fetch env defaults on mount
  useEffect(() => {
    fetchDefaultConfig().then(setEnvDefaults);
  }, []);

  // Load projects from localStorage
  useEffect(() => {
    try {
      const storedProjects = localStorage.getItem(STORAGE_KEY);
      if (storedProjects) {
        const parsedProjects = JSON.parse(storedProjects);
        if (Array.isArray(parsedProjects) && parsedProjects.length > 0) {
          setProjects(parsedProjects);
          setCurrentProject(parsedProjects[0]);
        } else {
          const defaultProject = createNewProjectObject('Untitled Project');
          setProjects([defaultProject]);
          setCurrentProject(defaultProject);
        }
      } else {
        const defaultProject = createNewProjectObject('Untitled Project');
        setProjects([defaultProject]);
        setCurrentProject(defaultProject);
      }
    } catch (error) {
      console.error('Failed to load projects from local storage:', error);
      const defaultProject = createNewProjectObject('Untitled Project');
      setProjects([defaultProject]);
      setCurrentProject(defaultProject);
    }
  }, []);

  // Apply env defaults to current project when defaults load
  useEffect(() => {
    if (envDefaults && currentProject) {
      const updatedProject = applyDefaults(currentProject, envDefaults);
      if (JSON.stringify(updatedProject) !== JSON.stringify(currentProject)) {
        setCurrentProject(updatedProject);
      }
    }
  }, [envDefaults, currentProject?.id]);

  const saveProjectsToStorage = (updatedProjects: Project[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
    } catch (error) {
      console.error('Failed to save projects to local storage:', error);
    }
  };

  const saveCurrentProject = () => {
    if (!currentProject) return;

    const projectExists = projects.some((p) => p.id === currentProject.id);
    let updatedProjects;

    if (projectExists) {
      updatedProjects = projects.map((p) =>
        p.id === currentProject.id ? currentProject : p
      );
    } else {
      updatedProjects = [...projects, currentProject];
    }

    setProjects(updatedProjects);
    saveProjectsToStorage(updatedProjects);
    onSuccess?.(`Project "${currentProject.name}" saved!`, 'success');
  };

  const createNewProject = () => {
    const newProject = createNewProjectObject();
    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
    setCurrentProject(newProject);
    saveProjectsToStorage(updatedProjects);
    onSuccess?.('New project created.', 'info');
  };

  const deleteProject = (projectId: string) => {
    const projectToDelete = projects.find((p) => p.id === projectId);
    if (!projectToDelete) return;

    const updatedProjects = projects.filter((p) => p.id !== projectId);
    setProjects(updatedProjects);

    if (currentProject?.id === projectId) {
      if (updatedProjects.length > 0) {
        setCurrentProject(updatedProjects[0]);
      } else {
        const newDefault = createNewProjectObject('Untitled Project');
        updatedProjects.push(newDefault);
        setProjects(updatedProjects);
        setCurrentProject(newDefault);
      }
    }
    saveProjectsToStorage(updatedProjects);
    onSuccess?.(`Project "${projectToDelete.name}" deleted.`, 'error');
  };

  // Import a project from JSON
  const importProject = (projectData: Project) => {
    // Generate new ID to avoid conflicts
    const importedProject: Project = {
      ...projectData,
      id: `proj_${Date.now()}`,
      name: projectData.name + ' (Imported)',
    };
    const updatedProjects = [...projects, importedProject];
    setProjects(updatedProjects);
    setCurrentProject(importedProject);
    saveProjectsToStorage(updatedProjects);
    onSuccess?.(`Project "${importedProject.name}" imported!`, 'success');
  };

  // Export current project as JSON object
  const exportCurrentProject = (): Project | null => {
    if (!currentProject) return null;
    // Return a clean copy without sensitive data
    const exportData: Project = {
      ...currentProject,
      state: {
        ...currentProject.state,
        apiKeys: { zeroGpt: '', anthropic: '' }, // Don't export API keys
      },
    };
    return exportData;
  };

  return {
    projects,
    currentProject,
    setCurrentProject,
    saveCurrentProject,
    createNewProject,
    deleteProject,
    importProject,
    exportCurrentProject,
  };
};

export default useProjectManager;
