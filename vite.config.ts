import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
        // 5 minute timeout for long-running AI requests
        timeout: 300000,
        proxyTimeout: 300000,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Extend socket timeout for AI requests
            proxyReq.socket?.setTimeout(300000);
          });
          proxy.on('error', (err, req, res) => {
            console.error('Proxy error:', err.message);
          });
        },
      },
    },
  },
});
