import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/anthropic': {
            target: 'https://api.anthropic.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
            headers: {
              'x-api-key': env.ANTHROPIC_API_KEY || '',
              'anthropic-version': '2023-06-01',
            },
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.ANTHROPIC_API_KEY': JSON.stringify(env.ANTHROPIC_API_KEY || ''),
        'process.env.ZEROGPT_API_KEY': JSON.stringify(env.ZEROGPT_API_KEY || ''),
        'process.env.WP_URL': JSON.stringify(env.WP_URL || ''),
        'process.env.WP_USER': JSON.stringify(env.WP_USER || ''),
        'process.env.WP_PASSWORD': JSON.stringify(env.WP_PASSWORD || ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
