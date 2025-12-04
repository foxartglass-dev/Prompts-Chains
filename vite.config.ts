import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Expose env vars to frontend (will be replaced at build time)
      'import.meta.env.VITE_ANTHROPIC_API_KEY': JSON.stringify(env.ANTHROPIC_API_KEY || ''),
      'import.meta.env.VITE_ZEROGPT_API_KEY': JSON.stringify(env.ZEROGPT_API_KEY || ''),
      'import.meta.env.VITE_WP_URL': JSON.stringify(env.WP_URL || ''),
      'import.meta.env.VITE_WP_USER': JSON.stringify(env.WP_USER || ''),
      'import.meta.env.VITE_WP_PASSWORD': JSON.stringify(env.WP_PASSWORD || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@engine': path.resolve(__dirname, './src/engine'),
        '@services': path.resolve(__dirname, './src/services'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
