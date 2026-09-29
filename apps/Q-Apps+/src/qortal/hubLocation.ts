/**
 * Where the app lives under Hub's /render/APP/<Name> prefix, and how to tell
 * Hub which path is showing. Ported from Torq's src/utils/hubLocation.ts.
 */
const RENDER_BASE_RE = /^\/render\/(?:APP|WEBSITE)\/[^/]+/i;

export const SELF_APP_NAME = 'Q-Apps+';

export function resolveQdnBase(): string {
  if (typeof window === 'undefined') return '';
  const injected = window._qdnBase;
  if (typeof injected === 'string' && injected.trim()) return injected.replace(/\/$/, '');
  const match = window.location.pathname.match(RENDER_BASE_RE);
  return match ? match[0] : '';
}

/** The name this app was published under (usually Q-Apps+), decoded. */
export function currentQortalAppName(): string {
  if (typeof window === 'undefined') return SELF_APP_NAME;
  const injected = window._qdnName?.trim();
  if (injected) return injected;
  const parts = resolveQdnBase().split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  if (last) {
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  }
  return SELF_APP_NAME;
}

export function currentQortalService(): 'APP' | 'WEBSITE' {
  if (typeof window === 'undefined') return 'APP';
  return window._qdnService?.toUpperCase() === 'WEBSITE' ? 'WEBSITE' : 'APP';
}

/** Strip the render prefix and any query, leaving a clean client path. */
export function normalizeHubPath(path: string): string {
  const [pathname] = String(path || '').split(/[?#]/);
  let next = pathname || '/';
  const base = resolveQdnBase();
  if (base && (next === base || next.startsWith(`${base}/`))) {
    next = next.slice(base.length) || '/';
  }
  next = next.replace(RENDER_BASE_RE, '') || '/';
  if (!next.startsWith('/')) next = `/${next}`;
  if (next === '/index.html') next = '/';
  if (next.length > 1) next = next.replace(/\/$/, '');
  return next;
}

/** Hub's copy-link is `qortal://APP/<name><path>`; home must be empty. */
export function hubDisplayPath(path: string): string {
  const normalized = normalizeHubPath(path);
  return normalized === '/' ? '' : normalized;
}

let historyPaths: string[] = [];
let historyIndex = -1;

function hubParentWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  try {
    if (window.parent && window.parent !== window) return window.parent;
  } catch {
    return null;
  }
  return null;
}

function postToHub(data: Record<string, unknown>) {
  const target = hubParentWindow();
  if (!target) return;
  target.postMessage({ requestedHandler: 'UI', ...data }, '*');
}

export function resetHubLocationHistory() {
  historyPaths = [];
  historyIndex = -1;
}

/** Report a route change so Hub's back button and deep links keep working. */
export function notifyHubDisplayedPath(path: string) {
  const normalized = hubDisplayPath(path);
  postToHub({
    action: 'QDN_RESOURCE_DISPLAYED',
    service: currentQortalService(),
    name: currentQortalAppName(),
    path: normalized,
  });
  if (historyPaths[historyIndex] !== normalized) {
    historyPaths = historyPaths.slice(0, historyIndex + 1);
    historyPaths.push(normalized);
    historyIndex = historyPaths.length - 1;
  }
  postToHub({
    action: 'NAVIGATION_HISTORY',
    payload: {
      customQDNHistoryPaths: historyPaths,
      currentIndex: historyIndex,
      isDOMContentLoaded: historyPaths.length === 1,
    },
  });
}
