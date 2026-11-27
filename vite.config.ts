import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
const headers = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
const proxy = {
  '/api': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8081', ws: true },
};
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PORT || 4173),
    strictPort: true,
    headers,
    proxy,
  },
  preview: {
    host: '127.0.0.1',
    port: Number(process.env.PORT || 4173),
    strictPort: true,
    headers,
    proxy,
  },
  build: {
    rolldownOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        projects: resolve(import.meta.dirname, 'projects.html'),
      },
    },
  },
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://127.0.0.1:4173/' } },
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
