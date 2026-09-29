import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '',
  resolve: {
    alias: [
      // qapp-core imports an icon name that MUI 9 removed (docs/PLATFORM.md).
      {
        find: /^@mui\/icons-material\/ErrorOutline$/,
        replacement: '@mui/icons-material/ErrorOutlineOutlined',
      },
    ],
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
