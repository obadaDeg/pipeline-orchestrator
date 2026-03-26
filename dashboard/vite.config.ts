import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/dashboard/',
  plugins: [react()],
  build: {
    outDir: '../public/dashboard',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:4000',
      '/pipelines': 'http://localhost:4000',
      '/jobs': 'http://localhost:4000',
      '/teams': 'http://localhost:4000',
      '/webhooks': 'http://localhost:4000',
    },
  },
});
