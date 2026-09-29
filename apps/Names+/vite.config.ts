import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
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
  server: {
    host: '0.0.0.0',
    port: 5174,
  },
  optimizeDeps: {
    include: ['@mui/material', '@mui/styled-engine', '@mui/system'],
  },
});
