import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { installQortalMock } from './qortalMock';
import { resetQdnCaches } from '../qdn/search';
import { resetRates } from '../money/rates';
import { resetRateNotices } from '../money/useShopCoin';
import { resetPendingOrders } from '../money/pendingOrders';
import { resetOrderReadCaches } from '../orders/reads';
import { resetPublishedIndexes } from '../seller/productIndex';
import { resetSentCatalogues } from '../seller/sentCatalogues';
import { resetPendingDeletes } from '../seller/pendingDeletes';
import { resetDeletedShops } from '../qdn/deleted';
import { resetProductView } from '../utils/productView';
import { resetListWrite } from '../seller/listWrite';
import { resetSentCollections } from '../seller/useCollections';
import { resetFavoritesMemory } from '../favorites/myFavorites';
import { resetFavoriteCountsMemory } from '../favorites/counts';
import { resetHiddenShopsMemory } from '../discovery/hiddenShops';
import { suppressFirstRunForTests } from '../onboarding/Walkthrough';
import { resetRecentlyViewed } from '../discovery/recentlyViewed';
import { resetDeviceDrafts } from '../seller/deviceDrafts';
import { resetBalances, resetShowBalance } from '../wallet/balances';
import { resetDeliveryReads } from '../delivery/checkoutDelivery';

// The first-run walkthrough doesn't open by itself in tests (onboarding tests turn it on).
suppressFirstRunForTests(true);

// waitFor/findBy wait up to 3 s (1 s by default): the whole suite runs ~90 files at once, and on a
// busy machine a page's first render can take longer than 1 s. Passing tests don't wait longer.
configure({ asyncUtilTimeout: 3000 });

// localStorage: jsdom has one, but a plain object store is easier to inspect.
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = String(value);
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(localStorageStore)) delete localStorageStore[k];
  }),
  get length() {
    return Object.keys(localStorageStore).length;
  },
  key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

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

// jsdom has no IntersectionObserver; a stub that never reports an element in
// view keeps "load more" sentinels and lazy images quiet unless a test fires them.
if (typeof (globalThis as any).IntersectionObserver !== 'function') {
  class IntersectionObserverStub {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  (globalThis as any).IntersectionObserver = IntersectionObserverStub;
}

// localforage (consent flag) keeps everything in memory.
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
      for (const k of Object.keys(store)) delete store[k];
    }),
    keys: vi.fn(async () => Object.keys(store)),
    createInstance: vi.fn(() => instance),
  };
  return { default: instance };
});

// Every test starts with a fresh qortalRequest mock that answers nothing and
// refuses write actions; tests add handlers with installQortalMock(...).
beforeEach(() => {
  installQortalMock();
  localStorageMock.clear();
  resetQdnCaches();
  resetRates();
  resetRateNotices();
  resetPendingOrders();
  resetOrderReadCaches();
  // Session memories of the seller tools: each test starts as a new session.
  resetPublishedIndexes();
  resetSentCatalogues();
  resetPendingDeletes();
  resetDeletedShops();
  resetRecentlyViewed();
  resetDeviceDrafts();
  resetBalances();
  resetDeliveryReads();
  resetShowBalance();
  resetProductView();
  resetListWrite();
  resetFavoritesMemory();
  resetFavoriteCountsMemory();
  resetHiddenShopsMemory();
  resetSentCollections();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
