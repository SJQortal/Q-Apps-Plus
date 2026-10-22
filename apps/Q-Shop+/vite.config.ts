/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { APP_NAME, THEME_STORAGE_KEY } from './src/constants/plus.ts'

/** index.html's title and theme key come from src/constants/plus.ts, like the app's words. */
function plusNames(): Plugin {
  const values: Record<string, string> = {
    QSP_APP_NAME: APP_NAME,
    QSP_THEME_STORAGE_KEY: THEME_STORAGE_KEY,
  }
  return {
    name: 'qsp-plus-names',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replace(/%(QSP_[A-Z_]+)%/g, (all, key: string) => values[key] ?? all),
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), plusNames()],
  base: '',
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Whole-app renders (first-load counts, pinned checkout flows) take 1–2 s
    // alone and timed out at vitest's 5 s default on a busy machine.
    testTimeout: 20_000,
  },
})
