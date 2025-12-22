import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import llmRouter from './llm-router.js';
import clientsRouter from './routes/clients.js';
import projectsRouter from './routes/projects.js';
import personalProjectsRouter from './routes/personal-projects.js';
import locationsRouter from './routes/locations.js';
import websitesRouter from './routes/websites.js';
import templatesRouter from './routes/templates.js';
import workflowsRouter from './routes/workflows.js';
import articlesRouter from './routes/articles.js';
import gbpRouter from './routes/gbp.js';
import elementorRouter from './routes/elementor.js';
import imagesRouter from './routes/images.js';
import stylelockRouter from './routes/stylelock.js';
import knowledgeRouter from './routes/knowledge.js';
import seoRouter from './routes/seo.js';
import ideasRouter from './routes/ideas.js';
import authRouter from './routes/auth.js';
import { hybridAuth, getClientIp, isIpWhitelisted } from './middleware/auth.js';
import { testConnection, isDatabaseEnabled } from './db/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Increase server timeout for long-running AI requests (5 minutes)
const SERVER_TIMEOUT_MS = 300000;

// CORS for local development
app.use(cors({
  origin: isProduction
    ? true  // Allow all in production (same origin)
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Serve uploaded files statically
const uploadsPath = join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Prevent search engine indexing (add noindex header to all responses)
// This tells Google/Bing/etc to NOT index this site
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// Robots.txt - block all crawlers
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nDisallow: /\n');
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// IP checker - helps debug IP whitelist issues
app.get('/api/my-ip', async (req, res) => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    res.json({
      outboundIp: data.ip,
      message: 'Add this IP to ZeroGPT whitelist'
    });
  } catch (error) {
    res.json({ error: 'Could not determine IP', message: error.message });
  }
});

// Config endpoint - returns default values from environment variables
// These pre-fill the UI fields so you don't have to enter them every time
// Protected by hybridAuth - requires IP whitelist or valid token
app.get('/api/config', hybridAuth, (req, res) => {
  res.json({
    defaults: {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      xaiApiKey: process.env.XAI_API_KEY || '',
      zeroGptApiKey: process.env.ZEROGPT_API_KEY || '',
      wpUrl: process.env.WP_URL || '',
      wpUser: process.env.WP_USER || '',
      wpPassword: process.env.WP_APP_PASSWORD || '',
    },
  });
});

// Auth routes (config, ip-status, me, logout, check)
app.use('/api/auth', authRouter);

// LLM routing - handles all providers (protected)
app.use('/api/llm', hybridAuth, llmRouter);

// Database routes - all protected by hybridAuth
app.use('/api/clients', hybridAuth, clientsRouter);
app.use('/api/projects', hybridAuth, projectsRouter);
app.use('/api/personal-projects', hybridAuth, personalProjectsRouter);
app.use('/api/locations', hybridAuth, locationsRouter);
app.use('/api/websites', hybridAuth, websitesRouter);
app.use('/api/templates', hybridAuth, templatesRouter);
app.use('/api/workflows', hybridAuth, workflowsRouter);
app.use('/api/articles', hybridAuth, articlesRouter);
app.use('/api/gbp', hybridAuth, gbpRouter);
app.use('/api/elementor', hybridAuth, elementorRouter);
app.use('/api/images', hybridAuth, imagesRouter);
app.use('/api/stylelock', hybridAuth, stylelockRouter);
app.use('/api/knowledge', hybridAuth, knowledgeRouter);
app.use('/api/seo', hybridAuth, seoRouter);
app.use('/api/ideas', hybridAuth, ideasRouter);

// Database status endpoint (protected)
app.get('/api/db/status', hybridAuth, async (req, res) => {
  const status = await testConnection();
  res.json({
    enabled: isDatabaseEnabled(),
    ...status
  });
});

// ZeroGPT AI detection proxy (protected)
app.post('/api/zerogpt/detect', hybridAuth, async (req, res) => {
  const { text, apiKey } = req.body;

  // API key can come from request body or environment variable
  const resolvedApiKey = apiKey || process.env.ZEROGPT_API_KEY;

  if (!resolvedApiKey) {
    return res.json({
      success: true,
      score: 0,
      wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
      message: 'No API key - skipping AI detection'
    });
  }

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    const response = await fetch('https://api.zerogpt.com/api/detect/detectText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ApiKey': resolvedApiKey,
      },
      body: JSON.stringify({ input_text: text }),
    });

    const responseText = await response.text();
    console.log('ZeroGPT raw response:', responseText.substring(0, 500));

    if (!responseText) {
      throw new Error('ZeroGPT returned empty response');
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`ZeroGPT returned invalid JSON: ${responseText.substring(0, 200)}`);
    }

    console.log('ZeroGPT parsed data:', JSON.stringify(data, null, 2).substring(0, 500));

    if (!response.ok) {
      throw new Error(data.error?.message || `ZeroGPT API error: ${response.status}`);
    }

    // ZeroGPT returns percentage in different fields depending on API version
    const score = data.data?.is_gpt_generated_probability
      || data.data?.fakePercentage
      || data.data?.fake_percentage
      || data.is_gpt_generated_probability
      || 0;

    console.log('ZeroGPT extracted score:', score);

    res.json({
      success: true,
      score: score,
      wordCount: data.data?.word_count || text.split(/\s+/).filter(Boolean).length,
    });
  } catch (error) {
    console.error('ZeroGPT API error:', error.message);
    res.status(500).json({
      error: error.message,
      score: 0,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    });
  }
});

// WordPress publishing proxy (protected)
app.post('/api/wordpress/publish', hybridAuth, async (req, res) => {
  const { wpUrl, wpUser, wpPassword, contentType, title, content, status } = req.body;

  // Credentials can come from request body or environment variables
  const resolvedUrl = wpUrl || process.env.WP_URL;
  const resolvedUser = wpUser || process.env.WP_USER;
  const resolvedPassword = wpPassword || process.env.WP_APP_PASSWORD;

  if (!resolvedUrl || !resolvedUser || !resolvedPassword) {
    return res.status(400).json({ error: 'WordPress credentials are required' });
  }

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const endpoint = `${resolvedUrl.replace(/\/$/, '')}/wp-json/wp/v2/${contentType || 'posts'}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${resolvedUser}:${resolvedPassword}`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content,
        status: status || 'draft',
      }),
    });

    const responseText = await response.text();

    if (!responseText) {
      throw new Error('WordPress API returned empty response');
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`WordPress API returned invalid JSON: ${responseText.substring(0, 200)}`);
    }

    if (!response.ok) {
      throw new Error(data.message || `WordPress API error: ${response.status}`);
    }

    res.json({
      success: true,
      id: data.id,
      link: data.link,
      status: data.status,
    });
  } catch (error) {
    console.error('WordPress API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// In production, serve the built frontend
if (isProduction) {
  const distPath = join(__dirname, '..', 'dist');
  app.use(express.static(distPath));

  // SPA fallback - send index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`PromptFlow API server running on http://localhost:${PORT}`);
  console.log(`Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`Available providers: anthropic (more coming soon)`);
});

// Set server timeout for long-running AI requests
server.setTimeout(SERVER_TIMEOUT_MS);
server.keepAliveTimeout = SERVER_TIMEOUT_MS;
server.headersTimeout = SERVER_TIMEOUT_MS + 1000;
