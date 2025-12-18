// OpenAI GPT Provider
// Supports GPT-5.2, GPT-5 Mini, GPT-5 Nano, GPT-4o, etc.

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Retry configuration for transient errors (502, 503, 504, 529)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const RETRYABLE_STATUS_CODES = [502, 503, 504, 529];

// Timeout for API requests (5 minutes to handle long generations)
const REQUEST_TIMEOUT_MS = 300000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const openaiProvider = {
  id: 'openai',
  name: 'OpenAI GPT',
  envKey: 'OPENAI_API_KEY',
  defaultModel: 'gpt-5.2-2025-12-11',
  models: [
    { id: 'gpt-5.2-2025-12-11', name: 'GPT-5.2 (Latest)', maxTokens: 128000 },
    { id: 'gpt-5-mini-2025-08-07', name: 'GPT-5 Mini (Fast)', maxTokens: 128000 },
    { id: 'gpt-5-nano-2025-08-07', name: 'GPT-5 Nano (Fastest)', maxTokens: 128000 },
    { id: 'gpt-4o', name: 'GPT-4o', maxTokens: 16384 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', maxTokens: 16384 },
  ],

  async generate({ model, prompt, apiKey, maxTokens }) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(OPENAI_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_completion_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Get response text first to handle empty responses
        const responseText = await response.text();

        if (!responseText) {
          throw new Error(`OpenAI API returned empty response (status: ${response.status})`);
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          throw new Error(`OpenAI API returned invalid JSON: ${responseText.substring(0, 200)}`);
        }

        if (!response.ok) {
          const errorMessage = data.error?.message || `OpenAI API error: ${response.status}`;

          // Check if this is a retryable error
          if (RETRYABLE_STATUS_CODES.includes(response.status) && attempt < MAX_RETRIES) {
            const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            console.log(`[OpenAI] Retryable error ${response.status}, attempt ${attempt}/${MAX_RETRIES}. Retrying in ${delay}ms...`);
            await sleep(delay);
            continue;
          }

          throw new Error(errorMessage);
        }

        if (!data.choices || !data.choices[0]?.message?.content) {
          throw new Error('Unexpected response format from OpenAI API');
        }

        return {
          content: data.choices[0].message.content,
          usage: {
            inputTokens: data.usage?.prompt_tokens,
            outputTokens: data.usage?.completion_tokens,
          },
        };
      } catch (error) {
        lastError = error;

        // For network errors, also retry
        if (error.name === 'TypeError' && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`[OpenAI] Network error, attempt ${attempt}/${MAX_RETRIES}. Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  },
};
