import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Q-Apps+ is served by Hub/GO from /render/APP/Q-Apps+/, so assets are relative.
export default defineConfig({
  plugins: [react()],
  base: '',
  server: { host: '0.0.0.0', port: 5180 },
  optimizeDeps: {
    include: ['@mui/material', '@mui/styled-engine', '@mui/system'],
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Vite 8 (Rolldown) codeSplitting: group the vendor code so app changes don't
        // invalidate the React and MUI chunks between releases.
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'mui-core', test: /node_modules[\\/](@mui|@emotion)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
