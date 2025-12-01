import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import claudeRoutes from './routes/claude.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PROXY_PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/claude', claudeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Anthropic proxy server running on http://localhost:${PORT}`);
  console.log(`Claude API endpoint: http://localhost:${PORT}/api/claude`);
});
