import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { resetQdnResourceCaches } from '../utils/qdnResourceSearch';

// ---------------------------------------------------------------------------
// IndexedDB polyfill for jsdom (jsdom does not ship IDB by default)
// ---------------------------------------------------------------------------
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
global.indexedDB = new IDBFactory();
global.IDBKeyRange = IDBKeyRange;

// ---------------------------------------------------------------------------
// localStorage stub (jsdom provides one, but let's make it spy-able)
// ---------------------------------------------------------------------------
const localStorageStore: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
  }),
  get length() {
    return Object.keys(localStorageStore).length;
  },
  key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ---------------------------------------------------------------------------
// navigator.clipboard stub
// ---------------------------------------------------------------------------
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

Object.defineProperty(global.navigator, 'clipboard', {
  value: {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve('')),
  },
  writable: true,
  configurable: true,
});

// ---------------------------------------------------------------------------
// document.execCommand stub (removed from jsdom 26+)
// ---------------------------------------------------------------------------
if (!('execCommand' in document)) {
  Object.defineProperty(document, 'execCommand', {
    value: vi.fn(() => true),
    writable: true,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// localforage mock — individual instances are controlled per test file
// ---------------------------------------------------------------------------
vi.mock('localforage', () => {
  const store: Record<string, unknown> = {};

  const instance = {
    getItem: vi.fn(async (key: string) => store[key] ?? null),
    setItem: vi.fn(async (key: string, value: unknown) => {
      store[key] = value;
      return value;
    }),
    removeItem: vi.fn(async (key: string) => {
      delete store[key];
    }),
    clear: vi.fn(async () => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
    keys: vi.fn(async () => Object.keys(store)),
    createInstance: vi.fn(() => instance),
  };

  return { default: instance };
});

// ---------------------------------------------------------------------------
// Reset all mocks between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  resetQdnResourceCaches();
});
