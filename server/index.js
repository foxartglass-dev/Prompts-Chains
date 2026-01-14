// MUST be first import - captures all console output for in-app logs
import './services/console-capture.js';

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
import wpBrowserRouter from './routes/wp-browser.js';
import imageVersionsRouter from './routes/image-versions.js';
import imageCreationRouter from './routes/image-creation.js';
import sitePlanningRouter from './routes/site-planning.js';
import promptEngineeringRouter from './routes/prompt-engineering.js';
import humanFeedbackRouter from './routes/human-feedback.js';
import imageBankRouter from './routes/image-bank.js';
import draftImageBankRouter from './routes/draft-image-bank.js';
import wpHealthRouter from './routes/wp-health.js';
import localVikingRouter from './routes/local-viking.js';
import globalSettingsRouter from './routes/global-settings.js';
import promptAssistantRouter from './routes/prompt-assistant.js';
import logsRouter from './routes/logs.js';
import dripFeedRouter from './routes/drip-feed.js';
import testPresetsRouter from './routes/test-presets.js';
import { initDripFeedScheduler } from './services/drip-feed-scheduler.js';
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

app.use(express.json({ limit: '100mb' }));  // Increased for base64 image data
app.use(express.urlencoded({ limit: '100mb', extended: true }));  // Also increase for form data

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

// Helper: Get client IP address
function getClientIp(req) {
  // Check various headers for the real IP (behind proxies like Railway)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
}

// Helper: Check if IP is whitelisted
function isIpWhitelisted(ip) {
  const whitelist = process.env.IP_WHITELIST || '';
  if (!whitelist) return false;

  // Split by comma and trim each IP
  const whitelistedIps = whitelist.split(',').map(ip => ip.trim());

  // Check if client IP matches any whitelisted IP
  // Also handle IPv6 localhost variants
  const normalizedIp = ip?.replace('::ffff:', '') || '';
  return whitelistedIps.some(wip =>
    wip === ip || wip === normalizedIp || normalizedIp.endsWith(wip)
  );
}

// Config endpoint - returns default values from environment variables
// These pre-fill the UI fields so you don't have to enter them every time
app.get('/api/config', (req, res) => {
  const clientIp = getClientIp(req);
  const ipWhitelisted = isIpWhitelisted(clientIp);

  // PIN is required only if:
  // 1. APP_PIN is set AND
  // 2. Client IP is NOT in the whitelist
  const pinRequired = !!process.env.APP_PIN && !ipWhitelisted;

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
    // Tell frontend if PIN lock is required for this IP
    pinEnabled: pinRequired,
    // Debug info (can remove in production)
    clientIp: clientIp,
    ipWhitelisted: ipWhitelisted,
  });
});

// PIN Lock authentication
app.post('/api/auth/verify-pin', (req, res) => {
  const { pin } = req.body;
  const correctPin = process.env.APP_PIN;

  // If no PIN is set, always allow access
  if (!correctPin) {
    return res.json({ success: true, message: 'PIN not configured - access granted' });
  }

  if (!pin) {
    return res.status(400).json({ success: false, error: 'PIN is required' });
  }

  // Simple PIN comparison (in production, you'd want to hash this)
  if (pin === correctPin) {
    res.json({ success: true, message: 'PIN verified' });
  } else {
    res.status(401).json({ success: false, error: 'Invalid PIN' });
  }
});

// LLM routing - handles all providers
app.use('/api/llm', llmRouter);

// Database routes (clients, projects, locations, websites, templates, workflows, articles)
app.use('/api/clients', clientsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/personal-projects', personalProjectsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/websites', websitesRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/gbp', gbpRouter);
app.use('/api/elementor', elementorRouter);
app.use('/api/images', imagesRouter);
app.use('/api/stylelock', stylelockRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/seo', seoRouter);
app.use('/api/ideas', ideasRouter);
app.use('/api/wp-browser', wpBrowserRouter);
app.use('/api/image-versions', imageVersionsRouter);
app.use('/api/image-creation', imageCreationRouter);
app.use('/api/site-planning', sitePlanningRouter);
app.use('/api/prompt-engineering', promptEngineeringRouter);
app.use('/api/feedback', humanFeedbackRouter);
app.use('/api/image-bank', imageBankRouter);
app.use('/api/draft-image-bank', draftImageBankRouter);
app.use('/api/wp-health', wpHealthRouter);
app.use('/api/local-viking', localVikingRouter);
app.use('/api/global-settings', globalSettingsRouter);
app.use('/api/prompt-assistant', promptAssistantRouter);
app.use('/api/logs', logsRouter);
app.use('/api/drip-feed', dripFeedRouter);
app.use('/api/test-presets', testPresetsRouter);

// Database status endpoint
app.get('/api/db/status', async (req, res) => {
  const status = await testConnection();
  res.json({
    enabled: isDatabaseEnabled(),
    ...status
  });
});

// ZeroGPT AI detection proxy (avoids CORS issues)
app.post('/api/zerogpt/detect', async (req, res) => {
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

// WordPress publishing proxy (avoids CORS issues)
app.post('/api/wordpress/publish', async (req, res) => {
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

  // Initialize drip feed scheduler for auto-publishing
  initDripFeedScheduler();
});

// Set server timeout for long-running AI requests
server.setTimeout(SERVER_TIMEOUT_MS);
server.keepAliveTimeout = SERVER_TIMEOUT_MS;
server.headersTimeout = SERVER_TIMEOUT_MS + 1000;
