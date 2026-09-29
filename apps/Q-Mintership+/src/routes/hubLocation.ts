/**
 * Where the app lives inside Hub or GO. Hub serves a published app at
 * /render/APP/<Name>/… and injects window._qdnBase; outside Hub the app runs
 * at the site root. Ported from Torq's utils/hubLocation.ts.
 */
const RENDER_BASE_RE = /^\/render\/(?:APP|WEBSITE)\/[^/]+/i;

export const APP_NAME = 'Q-Mintership+';

interface QdnWindow extends Window {
  _qdnBase?: string;
  _qdnName?: string;
  _qdnService?: string;
}

function qdnWindow(): QdnWindow | undefined {
  if (typeof window === 'undefined') return undefined;
  return window as QdnWindow;
}

/** The `/render/APP/<Name>` prefix, or '' outside Hub. */
export function resolveQdnBase(pathname?: string): string {
  const injected = qdnWindow()?._qdnBase;
  if (typeof injected === 'string' && injected.trim()) {
    return injected.replace(/\/$/, '');
  }
  const path = pathname ?? (typeof window === 'undefined' ? '' : window.location.pathname);
  const match = path.match(RENDER_BASE_RE);
  return match ? match[0] : '';
}

/** The name this app was published under, decoded (`+` stays `+`). */
export function currentQortalAppName(): string {
  const injected = qdnWindow()?._qdnName?.trim();
  if (injected) {
    try {
      return decodeURIComponent(injected);
    } catch {
      return injected;
    }
  }
  const base = resolveQdnBase();
  const fromBase = base.split('/').filter(Boolean).at(-1);
  if (fromBase) {
    try {
      return decodeURIComponent(fromBase);
    } catch {
      return fromBase;
    }
  }
  return APP_NAME;
}

export function currentQortalService(): 'APP' | 'WEBSITE' {
  const injected = qdnWindow()?._qdnService?.toUpperCase();
  return injected === 'WEBSITE' ? 'WEBSITE' : 'APP';
}

/** Strip the render base and any query/hash: Hub concatenates reported paths into its own URL. */
export function normalizeHubPath(path: string): string {
  const [pathname] = String(path || '').split(/[?#]/);
  let next = pathname || '/';
  const base = resolveQdnBase();
  if (base && (next === base || next.startsWith(`${base}/`))) {
    next = next.slice(base.length) || '/';
  }
  next = next.replace(RENDER_BASE_RE, '') || '/';
  if (!next.startsWith('/')) next = `/${next}`;
  if (next.length > 1) next = next.replace(/\/$/, '');
  return next;
}

/** A `qortal://APP/Q-Mintership+/<path>` link for sharing. */
export function buildAppLink(path: string): string {
  const normalized = normalizeHubPath(path);
  const suffix = normalized === '/' ? '' : normalized;
  return `qortal://APP/${encodeURIComponent(currentQortalAppName())}${suffix}`;
}

function hubParentWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  try {
    if (window.parent && window.parent !== window) return window.parent;
  } catch {
    return null;
  }
  return null;
}

/** Tell Hub which path is on screen, so its back button and copy-link work. */
export function notifyHubDisplayedPath(path: string): void {
  const target = hubParentWindow();
  if (!target) return;
  const normalized = normalizeHubPath(path);
  target.postMessage(
    {
      requestedHandler: 'UI',
      action: 'QDN_RESOURCE_DISPLAYED',
      service: currentQortalService(),
      name: currentQortalAppName(),
      path: normalized === '/' ? '' : normalized,
    },
    '*'
  );
}
