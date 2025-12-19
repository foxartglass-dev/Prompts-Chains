import express from 'express';

const router = express.Router();

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

// Helper function to make API call with retry logic for transient errors
async function callAnthropicWithRetry(apiKey, body, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2024-01-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      // Retry on 502, 503, 529 (overloaded) errors
      if ([502, 503, 529].includes(response.status) && attempt < maxRetries) {
        console.log(`Anthropic API returned ${response.status}, retrying (attempt ${attempt}/${maxRetries})...`);
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return { response, data };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        console.log(`Anthropic API fetch error, retrying (attempt ${attempt}/${maxRetries})...`);
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

// POST /api/claude - Proxy requests to Anthropic API
router.post('/', async (req, res) => {
  const apiKey = req.headers['x-api-key'] || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(400).json({
      error: {
        message: 'Anthropic API key is required. Provide via x-api-key header or ANTHROPIC_API_KEY env var.'
      }
    });
  }

  try {
    const { model, max_tokens, messages } = req.body;

    const { response, data } = await callAnthropicWithRetry(apiKey, {
      model: model || process.env.CLAUDE_MODEL || DEFAULT_MODEL,
      max_tokens: max_tokens || 4096,
      messages: messages,
    });

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Anthropic API proxy error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Internal proxy server error'
      }
    });
  }
});

export default router;
