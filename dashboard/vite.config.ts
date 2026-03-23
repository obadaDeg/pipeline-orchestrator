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
      '/auth': 'http://localhost:3000',
      '/pipelines': 'http://localhost:3000',
      '/jobs': 'http://localhost:3000',
      '/teams': 'http://localhost:3000',
      '/webhooks': 'http://localhost:3000',
    },
  },
});
