import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import llmRouter from './llm-router.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS for local development
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// LLM routing - handles all providers
app.use('/api/llm', llmRouter);

// Future: Auth routes would go here
// app.use('/api/auth', authRouter);

// Future: Database routes would go here
// app.use('/api/projects', projectsRouter);

app.listen(PORT, () => {
  console.log(`PromptFlow API server running on http://localhost:${PORT}`);
  console.log(`Available providers: anthropic (more coming soon)`);
});
