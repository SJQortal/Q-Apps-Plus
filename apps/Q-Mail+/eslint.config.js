import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'e2e',
      // The theme kit is a synced copy of shared/hub-theme (never edited here).
      'src/hub-theme/**',
      // Vendored copy of @qortal/qapp-lib (tsconfig paths); upstream's code.
      'src/qapp-lib/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, qortalRequest: 'readonly', qortalRequestWithTimeout: 'readonly' },
    },
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      // Helpers and styled parts live next to their components on purpose; Fast Refresh
      // boundaries are a dev nicety and the warning was pure noise across the app.
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // eslint-plugin-react-hooks 7 ships the React Compiler's rules in
      // "recommended". Q-Mail+ does not use the compiler, and the upstream code
      // sets state in effects and reads refs during render in 90-odd places;
      // those are rewritten screen by screen in the redesign, not by a lint
      // sweep. Turn them on again when the last upstream screen is gone.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/globals': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  }
);
