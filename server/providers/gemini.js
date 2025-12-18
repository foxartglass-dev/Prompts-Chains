// Google Gemini Provider
// Supports Gemini 3.0, 2.5 Pro, 2.5 Flash, etc.

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Retry configuration for transient errors (502, 503, 504, 529)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const RETRYABLE_STATUS_CODES = [502, 503, 504, 529];

// Timeout for API requests (5 minutes to handle long generations)
const REQUEST_TIMEOUT_MS = 300000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const geminiProvider = {
  id: 'gemini',
  name: 'Google Gemini',
  envKey: 'GEMINI_API_KEY',
  defaultModel: 'gemini-2.5-flash',
  models: [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (Latest)', maxTokens: 65536 },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Thinking)', maxTokens: 65536 },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast)', maxTokens: 65536 },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (Fastest)', maxTokens: 65536 },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', maxTokens: 8192 },
  ],

  async generate({ model, prompt, apiKey, maxTokens }) {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        // Gemini uses a different URL structure
        const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }]
              }
            ],
            generationConfig: {
              maxOutputTokens: maxTokens,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Get response text first to handle empty responses
        const responseText = await response.text();

        if (!responseText) {
          throw new Error(`Gemini API returned empty response (status: ${response.status})`);
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          throw new Error(`Gemini API returned invalid JSON: ${responseText.substring(0, 200)}`);
        }

        if (!response.ok) {
          const errorMessage = data.error?.message || `Gemini API error: ${response.status}`;

          // Check if this is a retryable error
          if (RETRYABLE_STATUS_CODES.includes(response.status) && attempt < MAX_RETRIES) {
            const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            console.log(`[Gemini] Retryable error ${response.status}, attempt ${attempt}/${MAX_RETRIES}. Retrying in ${delay}ms...`);
            await sleep(delay);
            continue;
          }

          throw new Error(errorMessage);
        }

        // Gemini response structure
        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
          // Check for blocked content
          if (data.candidates?.[0]?.finishReason === 'SAFETY') {
            throw new Error('Content was blocked by Gemini safety filters');
          }
          throw new Error('Unexpected response format from Gemini API');
        }

        return {
          content: data.candidates[0].content.parts[0].text,
          usage: {
            inputTokens: data.usageMetadata?.promptTokenCount,
            outputTokens: data.usageMetadata?.candidatesTokenCount,
          },
        };
      } catch (error) {
        lastError = error;

        // For network errors, also retry
        if (error.name === 'TypeError' && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`[Gemini] Network error, attempt ${attempt}/${MAX_RETRIES}. Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  },
};
