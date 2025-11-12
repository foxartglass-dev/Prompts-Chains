
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

export type WpStatus = 'idle' | 'publishing' | 'published' | 'error';
export type WpContentType = 'pages' | 'posts';

export interface Result {
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

// Types for Project State Management
export interface ProjectState {
  apiKeys: { zeroGpt: string; claude: string; };
  selectedModel: 'gemini' | 'claude';
  fileNameTemplate: string;
  wpCredentials: { url: string; user: string; password: string; };
  wpContentType: WpContentType;
  wpTitleTemplate: string;
  tags: Tag[];
  placeholders: Placeholder[];
  taggedSnippets: TaggedSnippet[];
  promptTemplates: PromptTemplate[];
}

export interface Project {
  id: string;
  name: string;
  state: ProjectState;
}

// WordPress Connection Configuration
export interface WpConnection {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
}

// App-wide Settings (not project-specific)
export interface AppSettings {
  // ZeroGPT Configuration
  zeroGpt: {
    enabled: boolean;
    apiKey: string;
    threshold: number;
    maxRetries: number;
    retryStepId?: number;
    onFlagged: 'exclude' | 'include_with_flag' | 'regenerate';
  };

  // WordPress Configuration
  wordpress: {
    connections: WpConnection[];
    defaultConnection?: string;
    defaultPostType: 'posts' | 'pages';
    defaultStatus: 'draft' | 'publish' | 'private';
    titleTemplate: string;
    fieldMapping?: Record<string, string>;
    retries: number;
    retryDelay: number;
  };

  // Execution Configuration
  execution: {
    concurrency: number;
    batchSize: number;
    batchDelay: number;
    timeout: number;
    logVerbosity: 'minimal' | 'normal' | 'verbose';
    stopOnError: boolean;
    providerRetry: {
      enabled: boolean;
      maxAttempts: number;
      backoffMs: number;
    };
  };

  // Provider Configuration
  providers: {
    defaultProvider: 'gemini' | 'claude' | 'openai';
    apiKeys: {
      gemini: string;
      claude: string;
      openai?: string;
    };
    modelOverrides: {
      gemini: string;
      claude: string;
      openai?: string;
    };
    perStepProviders?: Record<number, {
      provider: 'gemini' | 'claude' | 'openai';
      model?: string;
    }>;
  };

  // File Output Configuration
  files: {
    nameTemplate: string;
    formats: {
      txt: boolean;
      json: boolean;
      csv: boolean;
    };
    zipCompression: boolean;
  };
}