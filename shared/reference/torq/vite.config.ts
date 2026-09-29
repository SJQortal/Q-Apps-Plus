import { readFile } from 'node:fs/promises';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';
import { patchQappFeedRefresh } from './src/utils/patchQappFeedRefresh';

function qappFeedRefreshPlugin(): Plugin {
  return {
    name: 'torq-keep-feed-posts',
    enforce: 'pre',
    transform(code, id) {
      const normalized = id.split('\\').join('/').split('?')[0];
      if (!normalized.includes('/qapp-core/') || !normalized.endsWith('/index.mjs')) {
        return null;
      }
      return patchQappFeedRefresh(code);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    qappFeedRefreshPlugin(),
    react(),
    // Gzip compression
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // Only compress files larger than 10kb
      deleteOriginFile: false,
    }),
    // Brotli compression (better compression ratio)
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
      deleteOriginFile: false,
    }),
  ],
  base: '',
  
  // Pre-bundling optimization for faster dev server
  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        {
          name: 'torq-keep-feed-posts',
          setup(build) {
            build.onLoad(
              { filter: /[/\\]qapp-core[/\\]dist[/\\]index\.mjs$/ },
              async (args) => ({
                contents: patchQappFeedRefresh(await readFile(args.path, 'utf8')),
                loader: 'js',
              })
            );
          },
        },
      ],
    },
    include: [
      '@mui/material',
      '@mui/styled-engine',
      '@mui/system',
      '@mui/icons-material',
      'react',
      'react-dom',
      'react-router-dom',
      'pdfjs-dist',
    ],
  },

  build: {
    // Target modern browsers for better optimization
    target: 'es2020',
    
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
      },
    },

    // Increase chunk size warning limit (default is 500kb)
    chunkSizeWarningLimit: 1000,

    // Enable CSS code splitting
    cssCodeSplit: true,

    // Generate sourcemaps for debugging (set to false for smaller builds)
    sourcemap: false,

    // Rollup-specific optimizations
    rollupOptions: {
      output: {
        // Manual chunk splitting strategy
        manualChunks: {
          // React core libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // MUI core components
          'mui-core': [
            '@mui/material',
            '@mui/system',
            '@emotion/react',
            '@emotion/styled',
          ],
          
          // MUI icons (large dependency)
          'mui-icons': ['@mui/icons-material'],
          
          // State management
          'state': ['jotai'],
          
          // Utilities and other libraries
          // mediainfo.js is left out: it loads with the first attached video.
          'utils': ['short-unique-id', 'compressorjs'],
          
          // i18n
          'i18n': ['i18next', 'react-i18next'],

          // The emoji picker, the rich text editor (video details), and PDF.js
          // (with its worker code, see pdfJsHub.ts) are left out: each gets
          // its own chunk, loaded when first needed. Naming them here would
          // pull them back into the first load.
        },
        
        // Optimize chunk file names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },

    // Optimize asset handling
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb as base64
  },

  // Performance optimizations
  server: {
    fs: {
      // Improve dev server performance
      strict: true,
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
