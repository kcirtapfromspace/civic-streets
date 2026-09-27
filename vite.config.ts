import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      // 1Password's mounted .env emits file events when its secrets are read.
      ignored: ['**/.env'],
    },
  },
  build: {
    outDir: 'dist',
  },
});
