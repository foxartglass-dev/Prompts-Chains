// LLM Service - Frontend client for the backend LLM API

const API_BASE = '/api/llm';

export interface LlmProvider {
  id: string;
  name: string;
  models: { id: string; name: string; maxTokens: number }[];
}

export interface GenerateRequest {
  provider: string;
  model: string;
  prompt: string;
  apiKey?: string;
  maxTokens?: number;
}

export interface GenerateResponse {
  success: boolean;
  provider: string;
  model: string;
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Get list of available LLM providers and their models
 */
export async function getProviders(): Promise<LlmProvider[]> {
  try {
    const response = await fetch(`${API_BASE}/providers`);
    if (!response.ok) {
      throw new Error('Failed to fetch providers');
    }
    const data = await response.json();
    return data.providers;
  } catch (error) {
    console.error('Error fetching providers:', error);
    // Return default if backend unavailable
    return [{
      id: 'anthropic',
      name: 'Anthropic Claude',
      models: [
        { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', maxTokens: 8192 },
      ],
    }];
  }
}

/**
 * Generate content using an LLM
 */
export async function generateContent(request: GenerateRequest): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `API error: ${response.status}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Generation failed');
    }

    return data.content;
  } catch (error) {
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }
    return 'Error: An unknown error occurred';
  }
}

/**
 * Wrapper for the workflow engine - matches the old API signature
 * This makes it easy to swap in the new architecture
 */
export async function generateLlmContent(
  prompt: string,
  provider: string,
  model: string,
  apiKeys: { anthropic?: string; openai?: string; gemini?: string }
): Promise<string> {
  // Map provider to API key
  const apiKey = apiKeys[provider as keyof typeof apiKeys];

  return generateContent({
    provider,
    model,
    prompt,
    apiKey,
    maxTokens: 4096,
  });
}
