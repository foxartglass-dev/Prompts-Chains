import { useState, useEffect } from 'react';
import { Project, ProjectState } from '../types.ts';

const STORAGE_KEY = 'promptFlowProjects';

const initialPromptTemplates: Project['state']['promptTemplates'] = [
    { id: 1, name: '1. Analyze Input', template: `Generate 5 key talking points for the topic "{item_name}". The primary keyword is "{primary_keyword}".`, outputKey: 'talking_points' },
    { id: 2, name: '2. Create Outline', template: `Based on these talking points:\n[talking_points]\n\nCreate a detailed outline for a document about "{item_name}".\n\nThe target audience is:\n{{{audience_profile}}}\n\nStructure it with sections and sub-sections.`, outputKey: 'outline' },
    { id: 3, name: '3. Write Document', template: `Write a full, high-quality document (~500 words) based on this outline:\n[outline]\n\nThe document is about "{item_name}".\n\nIt should be written for the following audience:\n{{{audience_profile}}}\n\nAfter the document, provide 3 potential titles and 3 short summaries. Format the output strictly as:\n[Full Document Content]\n\n---META TITLES---\n1. [Title 1]\n2. [Title 2]\n3. [Title 3]\n\n---META DESCRIPTIONS---\n1. [Summary 1]\n2. [Summary 2]\n3. [Summary 3]`, outputKey: 'final_document', outputAction: 'addToFinal' },
];

const initialPlaceholders: Project['state']['placeholders'] = [
    { id: 1, key: 'city', value: 'Austin' },
    { id: 2, key: 'primary_keyword', value: 'Data Science' },
    { id: 3, key: 'topic_variant', value: 'Machine Learning', tag: 'B' },
    { id: 4, key: 'topic_variant', value: 'Deep Learning', tag: 'E' },
];

const initialTags: Project['state']['tags'] = [
    { id: 1, name: 'B' }, { id: 2, name: 'E' }, { id: 3, name: 'G' },
];

const initialTaggedSnippets: Project['state']['taggedSnippets'] = [
    { id: 1, key: 'audience_profile', values: { 'B': 'For Beginners: Students and enthusiasts new to the topic, avoid jargon.', 'E': 'For Experts: Professionals with deep domain knowledge, use technical terms.', 'G': 'For a General Audience: Everyday people interested in the basics.' } }
];

// Load defaults from environment variables (set in .env.local)
const getEnvDefaults = () => ({
  anthropicKey: (typeof process !== 'undefined' && process.env?.ANTHROPIC_API_KEY) || '',
  zeroGptKey: (typeof process !== 'undefined' && process.env?.ZEROGPT_API_KEY) || '',
  wpUrl: (typeof process !== 'undefined' && process.env?.WP_URL) || '',
  wpUser: (typeof process !== 'undefined' && process.env?.WP_USER) || '',
  wpPassword: (typeof process !== 'undefined' && process.env?.WP_PASSWORD) || '',
});

const initialProjectState: ProjectState = {
  apiKeys: {
    zeroGpt: getEnvDefaults().zeroGptKey,
    claude: getEnvDefaults().anthropicKey
  },
  selectedModel: 'claude-sonnet-4-5',
  fileNameTemplate: '{tag}-{item_name}-output',
  wpCredentials: {
    url: getEnvDefaults().wpUrl,
    user: getEnvDefaults().wpUser,
    password: getEnvDefaults().wpPassword
  },
  wpContentType: 'posts',
  wpTitleTemplate: 'An Introduction to {item_name}',
  tags: initialTags,
  placeholders: initialPlaceholders,
  taggedSnippets: initialTaggedSnippets,
  promptTemplates: initialPromptTemplates,
};

const createNewProjectObject = (name: string = "Untitled Project"): Project => ({
  id: `proj_${Date.now()}`,
  name,
  state: JSON.parse(JSON.stringify(initialProjectState)),
});

const useProjectManager = (
    onSuccess?: (message: string, type: 'success' | 'info' | 'error') => void
) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  useEffect(() => {
    try {
      const storedProjects = localStorage.getItem(STORAGE_KEY);
      if (storedProjects) {
        const parsedProjects = JSON.parse(storedProjects);
        if (Array.isArray(parsedProjects) && parsedProjects.length > 0) {
          setProjects(parsedProjects);
          setCurrentProject(parsedProjects[0]);
        } else {
          const defaultProject = createNewProjectObject("Untitled Project");
          setProjects([defaultProject]);
          setCurrentProject(defaultProject);
        }
      } else {
        const defaultProject = createNewProjectObject("Untitled Project");
        setProjects([defaultProject]);
        setCurrentProject(defaultProject);
      }
    } catch (error) {
      console.error("Failed to load projects from local storage:", error);
      const defaultProject = createNewProjectObject("Untitled Project");
      setProjects([defaultProject]);
      setCurrentProject(defaultProject);
    }
  }, []);

  const saveProjectsToStorage = (updatedProjects: Project[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
    } catch (error) {
      console.error("Failed to save projects to local storage:", error);
    }
  };

  const saveCurrentProject = () => {
    if (!currentProject) return;

    const projectExists = projects.some(p => p.id === currentProject.id);
    let updatedProjects;

    if (projectExists) {
        updatedProjects = projects.map(p => p.id === currentProject.id ? currentProject : p);
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
    const projectToDelete = projects.find(p => p.id === projectId);
    if (!projectToDelete) return;

    const updatedProjects = projects.filter(p => p.id !== projectId);
    setProjects(updatedProjects);

    if (currentProject?.id === projectId) {
        if (updatedProjects.length > 0) {
            setCurrentProject(updatedProjects[0]);
        } else {
            const newDefault = createNewProjectObject("Untitled Project");
            updatedProjects.push(newDefault);
            setProjects(updatedProjects);
            setCurrentProject(newDefault);
        }
    }
    saveProjectsToStorage(updatedProjects);
    onSuccess?.(`Project "${projectToDelete.name}" deleted.`, 'error');
  };

  return { projects, currentProject, setCurrentProject, saveCurrentProject, createNewProject, deleteProject };
};

export default useProjectManager;
