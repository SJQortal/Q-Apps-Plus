import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { APP_NAME, THEME_STORAGE_KEY } from './src/constants/plus.ts';

/** index.html's title and theme key come from src/constants/plus.ts, like the app's words. */
function plusNames(): Plugin {
  const values: Record<string, string> = {
    QMP_APP_NAME: APP_NAME,
    QMP_THEME_STORAGE_KEY: THEME_STORAGE_KEY,
  };
  return {
    name: 'qmp-plus-names',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replace(/%(QMP_[A-Z_]+)%/g, (all, key: string) => values[key] ?? all),
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), plusNames()],
  // Off in every build and test run; only vite.testnet.config.ts turns it on, for its dev server.
  define: { __QMP_TESTNET__: 'false' },
  // Relative asset URLs: the zip is served from /render/APP/<its name>/…
  base: '',
  build: {
    target: 'es2020',
    // pdf.js (about 1.7 MB) is the one chunk above 900 KB: its own, loaded with the first PDF opened.
    chunkSizeWarningLimit: 1800,
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
    // Only the app's own rules, read as text by motion.test.tsx; other CSS stays empty.
    css: { include: [/[\\/]src[\\/]index\.css/] },
    // The page tests take about a second each; on a busy machine some passed 5 s.
    testTimeout: 15_000,
  },
});
