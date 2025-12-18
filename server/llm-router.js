import express from 'express';
import { anthropicProvider } from './providers/anthropic.js';
import { openaiProvider } from './providers/openai.js';
import { geminiProvider } from './providers/gemini.js';
// Future providers:
// import { grokProvider } from './providers/grok.js';

const router = express.Router();

// Registry of available LLM providers
const providers = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  // grok: grokProvider,
};

// Helper to detect provider from model ID
function detectProviderFromModel(modelId) {
  if (modelId.startsWith('claude-')) return 'anthropic';
  if (modelId.startsWith('gpt-')) return 'openai';
  if (modelId.startsWith('gemini-')) return 'gemini';
  return null;
}

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
  const { provider: requestedProviderId, model, prompt, apiKey, maxTokens } = req.body;

  if (!prompt) {
    return res.status(400).json({
      error: 'Missing required field: prompt is required'
    });
  }

  // Auto-detect provider from model ID if model is provided
  const detectedProviderId = model ? detectProviderFromModel(model) : null;
  const providerId = detectedProviderId || requestedProviderId || 'anthropic';

  const provider = providers[providerId];
  if (!provider) {
    return res.status(400).json({
      error: `Unknown provider: ${providerId}. Available: ${Object.keys(providers).join(', ')}`
    });
  }

  // API key can come from request body or environment variable
  const resolvedApiKey = apiKey || process.env[provider.envKey];

  // Debug logging (shows first 8 chars of key for troubleshooting)
  const keyPreview = resolvedApiKey ? `${resolvedApiKey.substring(0, 8)}...` : 'NONE';
  const keySource = apiKey ? 'request' : 'env';
  console.log(`[${providerId}] Model: ${model}, Key source: ${keySource}, Key preview: ${keyPreview}`);

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
