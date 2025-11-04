
export interface Service {
  id: number;
  service_name: string;
  tag: string | null;
  category: string | null;
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
  serviceId?: number;
  message: string;
  status: LogStatus;
  timestamp: string;
}

export type WpStatus = 'idle' | 'publishing' | 'published' | 'error';
export type WpContentType = 'pages' | 'posts';

export interface Result {
  service: Service;
  article: string;
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