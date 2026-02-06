// LLM Service - Frontend client for the backend LLM API

const API_BASE = '/api/llm';

// Retry configuration - 3 phases, never gives up
// Phase 1 (Quick recovery): 30s, 60s, 120s        [~3.5 min]
// Phase 2 (Patient wait):   5min intervals x6      [~30 min]
// Phase 3 (Chill mode):     1 hour intervals forever [infinite]
const PHASE1_DELAYS = [30000, 60000, 120000]; // 30s, 60s, 120s
const PHASE2_DELAY = 300000; // 5 min
const PHASE2_COUNT = 6;
const PHASE3_DELAY = 3600000; // 1 hour
const RETRYABLE_STATUSES = [502, 503, 429];
const RETRYABLE_MESSAGES = ['Failed to fetch', 'NetworkError', 'net::ERR_'];

function isRetryableError(error: unknown, status?: number): boolean {
  if (status && RETRYABLE_STATUSES.includes(status)) return true;
  if (error instanceof Error) {
    return RETRYABLE_MESSAGES.some(msg => error.message.includes(msg));
  }
  return false;
}

async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Retry wrapper for fetch calls. Retries on network errors, 502, 503, 429.
 * Does NOT retry on 400, 401, 403, 404 (real errors).
 */
export async function retryFetch(
  fetchFn: () => Promise<Response>,
  options?: { label?: string }
): Promise<Response> {
  const label = options?.label || 'fetch';
  let lastError: unknown;

  // First attempt
  try {
    const response = await fetchFn();
    if (!RETRYABLE_STATUSES.includes(response.status)) {
      return response;
    }
    // Retryable status - fall through to retry loop
    lastError = new Error(`Server error: ${response.status}`);
    console.warn(`[${label}] Got ${response.status}, will retry...`);
  } catch (error) {
    if (!isRetryableError(error)) throw error;
    lastError = error;
    console.warn(`[${label}] ${error instanceof Error ? error.message : 'Network error'}, will retry...`);
  }

  // 3-phase retry loop - never gives up
  const downSince = Date.now();
  let attempt = 0;

  const formatDowntime = () => {
    const ms = Date.now() - downSince;
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = (ms / 3600000).toFixed(1);
    return `${hrs} hours`;
  };

  const tryOnce = async (): Promise<Response | null> => {
    try {
      const response = await fetchFn();
      if (!RETRYABLE_STATUSES.includes(response.status)) {
        return response;
      }
      lastError = new Error(`Server error: ${response.status}`);
      return null;
    } catch (error) {
      if (!isRetryableError(error)) throw error;
      lastError = error;
      return null;
    }
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt++;
    let delay: number;
    let phaseLabel: string;

    if (attempt <= PHASE1_DELAYS.length) {
      // Phase 1: Quick recovery
      delay = PHASE1_DELAYS[attempt - 1];
      phaseLabel = `[Retry ${attempt}/${PHASE1_DELAYS.length}] Quick recovery - waiting ${delay / 1000}s...`;
    } else if (attempt <= PHASE1_DELAYS.length + PHASE2_COUNT) {
      // Phase 2: Patient wait
      delay = PHASE2_DELAY;
      const p2attempt = attempt - PHASE1_DELAYS.length;
      const totalP12 = PHASE1_DELAYS.length + PHASE2_COUNT;
      phaseLabel = `[Retry ${attempt}/${totalP12}] Patient wait - checking every 5min...`;
      if (p2attempt > 1) phaseLabel += ` (server down ${formatDowntime()})`;
    } else {
      // Phase 3: Chill mode - forever
      delay = PHASE3_DELAY;
      phaseLabel = `[Retry ${attempt}] Chill mode - checking every 1 hour... (server down ${formatDowntime()})`;
    }

    // Check server health before waiting
    const healthy = await checkHealth();
    if (healthy) {
      console.log(`[${label}] [Retry ${attempt}] Server is back, retrying now...`);
    } else {
      console.log(`[${label}] ${phaseLabel}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const result = await tryOnce();
    if (result) {
      console.log(`[${label}] Retry ${attempt} succeeded after ${formatDowntime()} of downtime`);
      return result;
    }
    console.warn(`[${label}] Retry ${attempt} failed`);
  }
}

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
    const controller = new AbortController();
    // 5 minute timeout for long AI requests
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    const response = await retryFetch(
      () => fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      }),
      { label: 'LLM generate' }
    );

    clearTimeout(timeoutId);

    // Handle non-JSON responses (like 502 from proxy)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(`Server error (${response.status}): ${text.substring(0, 200)}`);
    }

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
      // Provide more context for timeout errors
      if (error.name === 'AbortError') {
        return 'Error: Request timeout - AI request took too long (5 min limit)';
      }
      return `Error: ${error.message}`;
    }
    return 'Error: An unknown error occurred';
  }
}

/**
 * Detect provider from model ID
 */
function detectProviderFromModel(modelId: string): string {
  if (modelId.startsWith('claude-')) return 'anthropic';
  if (modelId.startsWith('gpt-')) return 'openai';
  if (modelId.startsWith('gemini-')) return 'gemini';
  if (modelId.startsWith('grok-')) return 'xai';
  return 'anthropic'; // default fallback
}

/**
 * Wrapper for the workflow engine - matches the old API signature
 * This makes it easy to swap in the new architecture
 */
export async function generateLlmContent(
  prompt: string,
  provider: string,
  model: string,
  apiKeys: { anthropic?: string; openai?: string; gemini?: string; xai?: string }
): Promise<string> {
  // Auto-detect provider from model ID (more reliable than provider param)
  const detectedProvider = detectProviderFromModel(model);

  // Map detected provider to API key
  const apiKey = apiKeys[detectedProvider as keyof typeof apiKeys];

  return generateContent({
    provider: detectedProvider,
    model,
    prompt,
    apiKey,
    maxTokens: 4096,
  });
}
