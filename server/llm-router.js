import express from 'express';
import { anthropicProvider } from './providers/anthropic.js';
// Future providers:
// import { openaiProvider } from './providers/openai.js';
// import { geminiProvider } from './providers/gemini.js';
// import { grokProvider } from './providers/grok.js';

const router = express.Router();

// Registry of available LLM providers
const providers = {
  anthropic: anthropicProvider,
  // openai: openaiProvider,
  // gemini: geminiProvider,
  // grok: grokProvider,
};

// List available providers and their models
router.get('/providers', (req, res) => {
  const available = Object.entries(providers).map(([key, provider]) => ({
    id: key,
    name: provider.name,
    models: provider.models,
  }));
  res.json({ providers: available });
});

// Universal generate endpoint
// POST /api/llm/generate
// Body: { provider: 'anthropic', model: 'claude-sonnet-4-5', prompt: '...', apiKey: '...' }
router.post('/generate', async (req, res) => {
  const { provider: providerId, model, prompt, apiKey, maxTokens } = req.body;

  if (!providerId || !prompt) {
    return res.status(400).json({
      error: 'Missing required fields: provider and prompt are required'
    });
  }

  const provider = providers[providerId];
  if (!provider) {
    return res.status(400).json({
      error: `Unknown provider: ${providerId}. Available: ${Object.keys(providers).join(', ')}`
    });
  }

  // API key can come from request body or environment variable
  const resolvedApiKey = apiKey || process.env[provider.envKey];
  if (!resolvedApiKey) {
    return res.status(400).json({
      error: `API key required for ${providerId}. Provide in request or set ${provider.envKey} env var.`
    });
  }

  try {
    const result = await provider.generate({
      model: model || provider.defaultModel,
      prompt,
      apiKey: resolvedApiKey,
      maxTokens: maxTokens || 4096,
    });

    res.json({
      success: true,
      provider: providerId,
      model: model || provider.defaultModel,
      content: result.content,
      usage: result.usage,
    });
  } catch (error) {
    console.error(`[${providerId}] Error:`, error.message);
    res.status(500).json({
      error: error.message,
      provider: providerId,
    });
  }
});

export default router;
