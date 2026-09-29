import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetAppResourceCaches } from '../qortal/appResources';
import { resetHubLocationHistory } from '../qortal/hubLocation';
import { resetAvatarFailures } from '../components/AppIcon';

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
}

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn(() => Promise.resolve()), readText: vi.fn(() => Promise.resolve('')) },
  writable: true,
  configurable: true,
});

beforeEach(() => {
  window.localStorage.clear();
  resetAppResourceCaches();
  resetHubLocationHistory();
  resetAvatarFailures();
  uninstallQortalMock();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/* ---- qortalRequest mock ------------------------------------------------ */

export type Handler = (params: Record<string, unknown>) => unknown;

/**
 * Install a fake host: answers by `action`. Returns the spy so tests can
 * count calls, e.g. how many SEARCH_QDN_RESOURCES a screen makes.
 */
export function installQortalMock(handlers: Record<string, Handler>) {
  const fn = vi.fn(async (params: { action: string } & Record<string, unknown>) => {
    const handler = handlers[params.action];
    if (!handler) throw new Error(`Unhandled qortalRequest action ${params.action}`);
    return handler(params);
  });
  (globalThis as { qortalRequest?: unknown }).qortalRequest = fn;
  return fn;
}

export function uninstallQortalMock() {
  delete (globalThis as { qortalRequest?: unknown }).qortalRequest;
}

export function callsFor(fn: ReturnType<typeof vi.fn>, action: string) {
  return fn.mock.calls.filter((call) => (call[0] as { action: string }).action === action);
}
