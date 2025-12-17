// Anthropic Claude Provider
// Supports Claude 3.5 Sonnet, Claude 3 Opus, etc.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

// Retry configuration for transient errors (502, 503, 504, 529)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // Start with 2 seconds
const RETRYABLE_STATUS_CODES = [502, 503, 504, 529];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const anthropicProvider = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  envKey: 'ANTHROPIC_API_KEY',
  defaultModel: 'claude-sonnet-4-5-20250929',
  models: [
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5 (Latest)', maxTokens: 8192 },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', maxTokens: 8192 },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', maxTokens: 4096 },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fast)', maxTokens: 4096 },
  ],

  async generate({ model, prompt, apiKey, maxTokens }) {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }

    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': API_VERSION,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        // Get response text first to handle empty responses
        const responseText = await response.text();

        if (!responseText) {
          throw new Error(`Anthropic API returned empty response (status: ${response.status})`);
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          throw new Error(`Anthropic API returned invalid JSON: ${responseText.substring(0, 200)}`);
        }

        if (!response.ok) {
          const errorMessage = data.error?.message || `Anthropic API error: ${response.status}`;

          // Check if this is a retryable error
          if (RETRYABLE_STATUS_CODES.includes(response.status) && attempt < MAX_RETRIES) {
            const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
            console.log(`[Anthropic] Retryable error ${response.status}, attempt ${attempt}/${MAX_RETRIES}. Retrying in ${delay}ms...`);
            await sleep(delay);
            continue;
          }

          throw new Error(errorMessage);
        }

        if (!data.content || !data.content[0]?.text) {
          throw new Error('Unexpected response format from Anthropic API');
        }

        return {
          content: data.content[0].text,
          usage: {
            inputTokens: data.usage?.input_tokens,
            outputTokens: data.usage?.output_tokens,
          },
        };
      } catch (error) {
        lastError = error;

        // For network errors (not HTTP errors), also retry
        if (error.name === 'TypeError' && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`[Anthropic] Network error, attempt ${attempt}/${MAX_RETRIES}. Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  },
};
