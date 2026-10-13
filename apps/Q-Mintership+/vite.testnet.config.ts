/**
 * Dev-only: the app against the private testnet (docs/apps/Q-Mintership+.md →
 * Testnet). `npm run dev:testnet`, then open e.g.
 * http://127.0.0.1:5176/?as=admin01&group=main.
 *
 * It turns __QMP_TESTNET__ on, adds the test signer and the testnet read
 * proxy (testnet/vite-plugin.mjs), and loads testnet/browser/entry.ts first.
 * It serves only: it refuses to build, so no build can ever contain any of it.
 */
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.ts';
import { testnetPlugin } from './testnet/vite-plugin.mjs';

export default defineConfig(({ command }) => {
  if (command !== 'serve') {
    throw new Error(
      'vite.testnet.config.ts is for the testnet dev server only; it never builds the app.'
    );
  }
  return mergeConfig(base, {
    define: { __QMP_TESTNET__: 'true' },
    plugins: [testnetPlugin()],
    server: { host: '127.0.0.1', port: 5176, strictPort: true },
  });
});
