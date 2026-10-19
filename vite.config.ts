/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// BASE_PATH is only needed for GitHub Pages project sites, e.g. BASE_PATH=/apiverse/
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    proxy: {
      '/api/v1': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001', changeOrigin: true },
      '/health': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001', changeOrigin: true },
      '/ready': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001', changeOrigin: true },
      '/docs': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001', changeOrigin: true },
      '/openapi.json': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
