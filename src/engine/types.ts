// PromptFlow Engine Types
// This is the core data model for the prompt chaining system

export interface WorkflowItem {
  id: number;
  name: string;
  tag: string | null;
}

export interface PromptTemplate {
  id: number;
  name: string;
  template: string;
  outputKey: string;
  outputAction?: 'addToFinal' | 'download';
  // Future: per-prompt model selection
  // provider?: string;
  // model?: string;
}

export interface Placeholder {
  id: number;
  key: string;
  value: string;
  tag?: string; // If present, it's a tagged placeholder
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

export interface ProjectConfig {
  id: string;
  name: string;
  version: string; // For future migrations
  createdAt: string;
  updatedAt: string;

  // LLM Settings
  provider: string;
  model: string;
  apiKeys: {
    anthropic?: string;
    openai?: string;
    gemini?: string;
    zeroGpt?: string;
  };

  // Workflow Configuration
  tags: Tag[];
  placeholders: Placeholder[];
  taggedSnippets: TaggedSnippet[];
  promptTemplates: PromptTemplate[];

  // Output Settings
  fileNameTemplate: string;

  // WordPress Integration (optional)
  wpCredentials?: {
    url: string;
    user: string;
    password: string;
  };
  wpContentType?: 'pages' | 'posts';
  wpTitleTemplate?: string;
}

export interface WorkflowResult {
  item: WorkflowItem;
  finalOutput: string;
  metaTitles: string[];
  metaDescriptions: string[];
  aiScore: number;
  wordCount: number;
  status: 'PASSED' | 'FLAGGED';
  timestamp: string;
  allOutputs: Record<string, string>;

  // WordPress status
  wpStatus?: 'idle' | 'publishing' | 'published' | 'error';
  wpLink?: string;
  wpError?: string;
}

export enum LogStatus {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  WORKING = 'WORKING',
}

export interface LogEntry {
  id: number;
  itemId?: number;
  message: string;
  status: LogStatus;
  timestamp: string;
}

// Default project configuration
export const createDefaultConfig = (name: string = 'Untitled Project'): ProjectConfig => ({
  id: `proj_${Date.now()}`,
  name,
  version: '2.0.0',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),

  provider: 'anthropic',
  model: 'claude-sonnet-4-5-20250514',
  apiKeys: {},

  tags: [
    { id: 1, name: 'B' },
    { id: 2, name: 'E' },
    { id: 3, name: 'G' },
  ],

  placeholders: [
    { id: 1, key: 'city', value: 'Austin' },
    { id: 2, key: 'primary_keyword', value: 'Data Science' },
  ],

  taggedSnippets: [
    {
      id: 1,
      key: 'audience_profile',
      values: {
        'B': 'For Beginners: Students and enthusiasts new to the topic.',
        'E': 'For Experts: Professionals with deep domain knowledge.',
        'G': 'For a General Audience: Everyday people interested in the basics.',
      },
    },
  ],

  promptTemplates: [
    {
      id: 1,
      name: '1. Analyze Input',
      template: 'Generate 5 key talking points for the topic "{item_name}". The primary keyword is "{primary_keyword}".',
      outputKey: 'talking_points',
    },
    {
      id: 2,
      name: '2. Create Outline',
      template: 'Based on these talking points:\n[talking_points]\n\nCreate a detailed outline for a document about "{item_name}".\n\nThe target audience is:\n{{{audience_profile}}}',
      outputKey: 'outline',
    },
    {
      id: 3,
      name: '3. Write Document',
      template: 'Write a full document (~500 words) based on this outline:\n[outline]\n\nThe document is about "{item_name}".\n\nAfter the document, provide:\n---META TITLES---\n1. [Title 1]\n2. [Title 2]\n3. [Title 3]\n\n---META DESCRIPTIONS---\n1. [Summary 1]\n2. [Summary 2]\n3. [Summary 3]',
      outputKey: 'final_document',
      outputAction: 'addToFinal',
    },
  ],

  fileNameTemplate: '{tag}-{item_name}-output',
});
