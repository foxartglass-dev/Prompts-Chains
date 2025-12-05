import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import llmRouter from './llm-router.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// CORS for local development
app.use(cors({
  origin: isProduction
    ? true  // Allow all in production (same origin)
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Config endpoint - returns default values from environment variables
// These pre-fill the UI fields so you don't have to enter them every time
app.get('/api/config', (req, res) => {
  res.json({
    defaults: {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
      zeroGptApiKey: process.env.ZEROGPT_API_KEY || '',
      wpUrl: process.env.WP_URL || '',
      wpUser: process.env.WP_USER || '',
      wpPassword: process.env.WP_APP_PASSWORD || '',
    }
  });
});

// LLM routing - handles all providers
app.use('/api/llm', llmRouter);

// In production, serve the built frontend
if (isProduction) {
  const distPath = join(__dirname, '..', 'dist');
  app.use(express.static(distPath));

  // SPA fallback - send index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`PromptFlow API server running on http://localhost:${PORT}`);
  console.log(`Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`Available providers: anthropic (more coming soon)`);
});
