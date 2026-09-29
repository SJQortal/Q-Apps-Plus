import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '',
  server: {
    host: '0.0.0.0',
    port: 5174,
  },
  optimizeDeps: {
    include: ['@mui/material', '@mui/styled-engine', '@mui/system'],
  },
});
