import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { qortalRequestMock, resetQortalRequestMock } from './qortalRequestMock';

// Hub injects qortalRequest as a global; tests answer it by action.
Object.defineProperty(globalThis, 'qortalRequest', {
  value: qortalRequestMock,
  writable: true,
  configurable: true,
});

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

beforeEach(() => {
  resetQortalRequestMock();
});

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});
