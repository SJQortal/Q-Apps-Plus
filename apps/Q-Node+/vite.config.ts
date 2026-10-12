import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

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
  build: {
    chunkSizeWarningLimit: 5000,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
