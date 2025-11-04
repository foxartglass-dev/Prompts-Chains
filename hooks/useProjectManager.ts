import { useState, useEffect } from 'react';
import { Project, ProjectState } from '../types.ts';

const STORAGE_KEY = 'seoWorkflowProjects';

const initialPromptTemplates: Project['state']['promptTemplates'] = [
    { id: 1, name: 'Generate PAA', template: `Generate 12 'People Also Ask' (PAA) questions for the service "{service_name}" in the "{category}" category. The questions should be relevant to a potential customer looking for '{main_category}' in {city}.`, outputKey: 'paa_questions' },
    { id: 2, name: 'Create Outline', template: `Based on these PAA questions:\n[paa_questions]\n\nCreate a detailed article outline for a webpage about "{service_name}" in {city_state}. The main service category is "{main_category}".\n\nThe target audience profile is:\n{{{customer_avatar_details}}}\n\nStructure it with H2s and H3s.`, outputKey: 'outline' },
    { id: 3, name: 'Write Article', template: `Write a full, high-quality article (~1000 words) based on this outline:\n[outline]\n\nThe article is about "{service_name}" which is a type of "{main_category}" service in {city_state}.\n\nIt should be written for the following customer avatar:\n{{{customer_avatar_details}}}\n\nUse the tone and address the pain points described for the avatar.\n\nAfter the article, provide 5 unique meta titles (50-60 chars) and 5 unique meta descriptions (150-168 chars). Format the output strictly as:\n[Full Article Content]\n\n---META TITLES---\n1. [Title 1]\n2. [Title 2]\n3. [Title 3]\n4. [Title 4]\n5. [Title 5]\n\n---META DESCRIPTIONS---\n1. [Description 1]\n2. [Description 2]\n3. [Description 3]\n4. [Description 4]\n5. [Description 5]`, outputKey: 'final_article', outputAction: 'addToFinal' },
];

const initialPlaceholders: Project['state']['placeholders'] = [
    { id: 1, key: 'city', value: 'Hendersonville' },
    { id: 2, key: 'city_state', value: 'Hendersonville, TN' },
    { id: 3, key: 'main_category', value: 'Cleaners' },
    { id: 4, key: 'deep_cleaning_service', value: 'Deep Cleaning', tag: 'H' },
];

const initialTags: Project['state']['tags'] = [
    { id: 1, name: 'H' }, { id: 2, name: 'J' }, { id: 3, name: 'C' },
];

const initialTaggedSnippets: Project['state']['taggedSnippets'] = [
    { id: 1, key: 'customer_avatar_details', values: { 'H': 'For Homeowners: busy, family-oriented, values a clean and safe home environment.', 'J': 'For Businesses: focused on professionalism, reliability, and maintaining a pristine image for clients.', 'C': 'For Contractors: needs rapid, compliant, and thorough cleanup to keep projects on schedule.' } }
];

const initialProjectState: ProjectState = {
  apiKeys: { zeroGpt: '', claude: '' },
  selectedModel: 'gemini',
  fileNameTemplate: '{tag}-{service_name}-final',
  wpCredentials: { url: '', user: '', password: '' },
  wpContentType: 'pages',
  wpTitleTemplate: '{service_name} {city}',
  tags: initialTags,
  placeholders: initialPlaceholders,
  taggedSnippets: initialTaggedSnippets,
  promptTemplates: initialPromptTemplates,
};

const createNewProjectObject = (name: string = "Untitled Project"): Project => ({
  id: `proj_${Date.now()}`,
  name,
  state: JSON.parse(JSON.stringify(initialProjectState)), // Deep copy to avoid reference issues
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
          // If storage is empty or invalid, create a new default project
          const defaultProject = createNewProjectObject("Untitled Project");
          setProjects([defaultProject]);
          setCurrentProject(defaultProject);
        }
      } else {
        // No projects in storage, create a default one
        const defaultProject = createNewProjectObject("Untitled Project");
        setProjects([defaultProject]);
        setCurrentProject(defaultProject);
      }
    } catch (error) {
      console.error("Failed to load projects from local storage:", error);
      // Fallback to a default project on error
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
    
    // If the deleted project was the current one, switch to another
    if (currentProject?.id === projectId) {
        if (updatedProjects.length > 0) {
            setCurrentProject(updatedProjects[0]);
        } else {
            // If it was the last project, create a new default one
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