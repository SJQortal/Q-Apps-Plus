/**
 * Test setup: jsdom, jest-dom matchers, an IndexedDB polyfill, and mocks for
 * everything that only exists inside Qortal Hub (`qortalRequest`,
 * `qortalRequestWithTimeout`) or needs a node (`fetch('/…')`, WebSockets).
 *
 * Tests never reach a node and never call a write action: an action with no
 * registered handler rejects, so a test cannot place an order, change a fee,
 * sign fees or send coins by accident. Register handlers per test with
 * `mockQortalRequest` and `mockFetchRoute`.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

type QortalHandler = (request: Record<string, unknown>) => unknown;

const qortalHandlers = new Map<string, QortalHandler>();

/** Every qortalRequest call, oldest first, for assertions on counts and params. */
export const qortalCalls: Array<Record<string, unknown>> = [];

/** Answer a qortalRequest action. Unregistered actions reject like Hub does. */
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

/** Hub's timeout variant takes the same request plus a timeout in ms. */
const qortalRequestWithTimeoutMock = vi.fn(
  async (request: Record<string, unknown>, _timeout?: number) => qortalRequestMock(request)
);

Object.defineProperty(globalThis, 'qortalRequest', {
  value: qortalRequestMock,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, 'qortalRequestWithTimeout', {
  value: qortalRequestWithTimeoutMock,
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

/**
 * Answer a relative Core call such as `/crosschain/tradeoffers`. `match` is a
 * path prefix or a RegExp. The handler's return value is served as JSON, or as
 * text when it is a string.
 */
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

/**
 * A WebSocket stub that never connects. Tests can reach the instances through
 * `openSockets` to push messages with `emit(data)` or to check they were closed.
 */
export class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readonly url: string;
  readyState = 0;
  closed: { code?: number; reason?: string } | null = null;
  sent: string[] = [];
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { code?: number; reason?: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(code?: number, reason?: string) {
    this.readyState = 3;
    this.closed = { code, reason };
    this.onclose?.({ code, reason });
  }
  /** Simulate the server: open the socket and deliver a message. */
  emit(data: unknown) {
    if (this.readyState === 0) {
      this.readyState = 1;
      this.onopen?.({});
    }
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) });
  }
}
Object.defineProperty(globalThis, 'WebSocket', {
  value: FakeWebSocket,
  writable: true,
  configurable: true,
});
export const openSockets = FakeWebSocket.instances;

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
  FakeWebSocket.instances.length = 0;
  window.localStorage.clear();
  // A fresh IndexedDB per test, so stores written by one test never leak.
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'IDBKeyRange', {
    value: IDBKeyRange,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
