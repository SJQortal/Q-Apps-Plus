/**
 * Test setup: jsdom, jest-dom matchers, and mocks for everything that only
 * exists inside Qortal Hub (`qortalRequest`) or needs a node (`fetch('/…')`).
 *
 * Tests never reach a real node and never call a write action: an action
 * without a registered handler rejects, so a publish, sign, vote, invite,
 * approve or join can only ever hit a mock. Register handlers per test with
 * `mockQortalRequest` and `mockFetchRoute`.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

type QortalHandler = (request: Record<string, unknown>) => unknown;

const qortalHandlers = new Map<string, QortalHandler>();

/** Every qortalRequest call, oldest first, for assertions on counts and params. */
export const qortalCalls: Array<Record<string, unknown>> = [];

/** Answer a qortalRequest action. Unregistered actions reject like Hub does. */
export function mockQortalRequest(action: string, handler: QortalHandler): void;
export function mockQortalRequest(action: string, value: unknown): void;
export function mockQortalRequest(action: string, handler: QortalHandler | unknown): void {
  qortalHandlers.set(
    action,
    typeof handler === 'function' ? (handler as QortalHandler) : () => handler
  );
}

export function qortalCallsFor(action: string): Array<Record<string, unknown>> {
  return qortalCalls.filter((call) => call.action === action);
}

const qortalRequestMock = vi.fn(async (request: Record<string, unknown>) => {
  qortalCalls.push(request);
  const handler = qortalHandlers.get(String(request.action));
  if (!handler) {
    throw new Error(`qortalRequest mock: no handler for ${String(request.action)}`);
  }
  return handler(request);
});

Object.defineProperty(globalThis, 'qortalRequest', {
  value: qortalRequestMock,
  writable: true,
  configurable: true,
});

type FetchHandler = (url: URL, init?: RequestInit) => unknown;
interface FetchRoute {
  test: (path: string) => boolean;
  handler: FetchHandler;
}
const fetchRoutes: FetchRoute[] = [];

/** Every fetch call, oldest first, as the path plus query that was requested. */
export const fetchCalls: string[] = [];

/** Every fetch call with its init, for asserting method, headers and body. */
export const fetchRequests: Array<{ path: string; init?: RequestInit }> = [];

/**
 * Answer a relative Core call such as `/names/forsale`. `match` is a path prefix
 * or a RegExp. The handler's return value is served as JSON, or as text when
 * it is a string, or as-is when it is a Response.
 */
export function mockFetchRoute(match: string | RegExp, handler: FetchHandler): void;
export function mockFetchRoute(match: string | RegExp, value: unknown): void;
export function mockFetchRoute(match: string | RegExp, handler: FetchHandler | unknown): void {
  fetchRoutes.unshift({
    test: (path) => (typeof match === 'string' ? path.startsWith(match) : match.test(path)),
    handler: typeof handler === 'function' ? (handler as FetchHandler) : () => handler,
  });
}

export function fetchCallsFor(match: string | RegExp): string[] {
  return fetchCalls.filter((path) =>
    typeof match === 'string' ? path.startsWith(match) : match.test(path)
  );
}

function toResponse(value: unknown): Response {
  if (value instanceof Response) return value;
  if (typeof value === 'string') return new Response(value, { status: 200 });
  return new Response(JSON.stringify(value ?? null), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, 'http://localhost');
  const path = url.pathname + url.search;
  fetchCalls.push(path);
  fetchRequests.push({ path, init });
  const route = fetchRoutes.find((candidate) => candidate.test(url.pathname));
  if (!route) {
    return new Response(JSON.stringify({ error: 404, message: `no route for ${path}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return toResponse(await route.handler(url, init));
});

Object.defineProperty(globalThis, 'fetch', {
  value: fetchMock,
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

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof window.ResizeObserver === 'undefined') {
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: ResizeObserverStub,
  });
}

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
if (typeof window.IntersectionObserver === 'undefined') {
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: IntersectionObserverStub,
  });
}

beforeEach(() => {
  qortalHandlers.clear();
  qortalCalls.length = 0;
  fetchRoutes.length = 0;
  fetchCalls.length = 0;
  fetchRequests.length = 0;
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
