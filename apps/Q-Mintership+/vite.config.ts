import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset URLs: the zip is served from /render/APP/Q-Mintership+/…
  base: '',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Vite 8 (Rolldown): keep the framework in its own long-lived chunks.
        advancedChunks: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|react-router|jotai|scheduler)[\\/]/ },
            { name: 'mui-core', test: /node_modules[\\/](@mui|@emotion)[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5175,
  },
  optimizeDeps: {
    include: ['@mui/material', '@mui/styled-engine', '@mui/system'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
