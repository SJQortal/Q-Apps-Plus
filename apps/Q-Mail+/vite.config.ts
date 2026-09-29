import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@qortal/qapp-lib': path.resolve(__dirname, 'src/qapp-lib'),
    },
  },
  base: "",
  build: {
    commonjsOptions: {
      esmExternals: true
    },
  },
})
