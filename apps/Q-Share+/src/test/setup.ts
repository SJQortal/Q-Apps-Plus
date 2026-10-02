/**
 * Test setup: a global `qortalRequest` mock that answers by action, and a
 * `fetch` mock for the Core endpoints the app reads directly. Tests can
 * register handlers and count calls; nothing here ever reaches a node.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';

type Params = Record<string, unknown> & { action: string };
type Handler = (params: Params) => unknown;

const qortalHandlers = new Map<string, Handler>();
export const qortalCalls: Params[] = [];

/** Answer `action` with a value or a function of the params. */
export function mockQortalAction(action: string, answer: unknown | Handler): void {
  qortalHandlers.set(action, typeof answer === 'function' ? (answer as Handler) : () => answer);
}

export function qortalCallsFor(action: string): Params[] {
  return qortalCalls.filter((c) => c.action === action);
}

const qortalRequestMock = vi.fn(async (params: Params) => {
  qortalCalls.push(params);
  const handler = qortalHandlers.get(params.action);
  if (!handler) throw new Error(`qortalRequest mock: no handler for ${params.action}`);
  return handler(params);
});

Object.defineProperty(globalThis, 'qortalRequest', { value: qortalRequestMock, writable: true, configurable: true });
Object.defineProperty(globalThis, 'qortalRequestWithTimeout', {
  value: vi.fn((params: Params) => qortalRequestMock(params)),
  writable: true,
  configurable: true,
});

type FetchHandler = (url: URL, init?: RequestInit) => unknown;
const fetchHandlers: Array<{ test: (url: URL) => boolean; handler: FetchHandler }> = [];
export const fetchCalls: string[] = [];

/** Answer relative Core URLs (e.g. `/arbitrary/resources/search`) matched by prefix or regex. */
export function mockFetch(match: string | RegExp, answer: unknown | FetchHandler): void {
  const test = (url: URL) =>
    typeof match === 'string' ? url.pathname.startsWith(match) : match.test(url.pathname + url.search);
  fetchHandlers.push({ test, handler: typeof answer === 'function' ? (answer as FetchHandler) : () => answer });
}

export function fetchCallsMatching(match: string | RegExp): string[] {
  return fetchCalls.filter((u) => (typeof match === 'string' ? u.startsWith(match) : match.test(u)));
}

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, 'http://localhost');
  fetchCalls.push(url.pathname + url.search);
  const entry = [...fetchHandlers].reverse().find((h) => h.test(url));
  if (!entry) throw new Error(`fetch mock: no handler for ${url.pathname}`);
  const body = await entry.handler(url, init);
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
});
Object.defineProperty(globalThis, 'fetch', { value: fetchMock, writable: true, configurable: true });

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

if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  Object.defineProperty(globalThis, 'IntersectionObserver', { value: IntersectionObserverStub, writable: true, configurable: true });
}

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

beforeEach(() => {
  qortalHandlers.clear();
  qortalCalls.length = 0;
  fetchHandlers.length = 0;
  fetchCalls.length = 0;
  window.localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});
