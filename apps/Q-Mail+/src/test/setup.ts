/**
 * Test setup: runs before every test file (see vitest.config.ts).
 *
 * Q-Mail+ talks to Qortal through the global `qortalRequest` that Hub injects
 * and through relative `fetch('/arbitrary/…')` calls. Neither exists in
 * jsdom, so both are mocked here. Tests register answers per action or per
 * URL, and can assert which calls were made and how many. Nothing here ever
 * publishes, signs, decrypts or spends anything.
 */
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

type QortalHandler = (request: Record<string, any>) => any
const qortalHandlers = new Map<string, QortalHandler>()

export const qortalRequestMock = vi.fn(async (request: Record<string, any>) => {
  const handler = qortalHandlers.get(request?.action)
  if (!handler) throw new Error(`qortalRequest mock: no handler for action ${request?.action}`)
  return handler(request)
})

/** Answer every `qortalRequest({ action })` with `handler(request)`. */
export function mockQortalAction(action: string, handler: QortalHandler | any) {
  qortalHandlers.set(action, typeof handler === 'function' ? handler : () => handler)
}

/** The requests made so far, optionally filtered by action. */
export function qortalCalls(action?: string): Record<string, any>[] {
  return qortalRequestMock.mock.calls
    .map((call) => call[0])
    .filter((request) => !action || request?.action === action)
}

type FetchRoute = { match: string | RegExp; body: any; init?: ResponseInit }
const fetchRoutes: FetchRoute[] = []

export const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const route = fetchRoutes.find((r) =>
    typeof r.match === 'string' ? url.startsWith(r.match) : r.match.test(url)
  )
  if (!route) throw new Error(`fetch mock: no route for ${url}`)
  const body = typeof route.body === 'string' ? route.body : JSON.stringify(route.body)
  return new Response(body, { status: 200, ...route.init })
})

/** Answer `fetch(url)` for URLs that start with `match` (or match the RegExp). */
export function mockFetchRoute(match: string | RegExp, body: any, init?: ResponseInit) {
  fetchRoutes.push({ match, body, init })
}

/** The URLs fetched so far, optionally filtered by prefix. */
export function fetchedUrls(prefix?: string): string[] {
  return fetchMock.mock.calls
    .map((call) => {
      const input = call[0]
      return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    })
    .filter((url) => !prefix || url.startsWith(prefix))
}

const g = globalThis as any
g.qortalRequest = qortalRequestMock
g.qortalRequestWithTimeout = (request: Record<string, any>) => qortalRequestMock(request)
g.fetch = fetchMock
g.global = g
if (typeof window !== 'undefined') {
  ;(window as any)._qdnBase = ''
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
          return false
        },
      }),
    })
  }
}

// vitest runs without `globals`, so Testing Library can't register its own cleanup.
afterEach(() => {
  cleanup()
})

beforeEach(() => {
  qortalHandlers.clear()
  qortalRequestMock.mockClear()
  fetchRoutes.length = 0
  fetchMock.mockClear()
  try {
    window.localStorage.clear()
  } catch {
    /* ignore */
  }
})
