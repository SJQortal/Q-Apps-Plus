/**
 * Where the app lives inside Hub or GO. Hub serves a published app at
 * /render/APP/<Name>/… and injects window._qdnBase; outside Hub the app runs
 * at the site root. Ported from Torq's utils/hubLocation.ts.
 */
import { APP_NAME, LINK_APP_NAME } from '../constants/plus';

const RENDER_BASE_RE = /^\/render\/(?:APP|WEBSITE)\/[^/]+/i;

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

function decodedLower(value: string): string {
  try {
    return decodeURIComponent(value).toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

/** The start of `pathname` that names the same app as `qdnBase`, as the URL spells it; null if none. */
function appPrefix(pathname: string, qdnBase: string): string | null {
  const next = pathname.charAt(qdnBase.length);
  if (pathname.toLowerCase().startsWith(qdnBase.toLowerCase()) && (!next || next === '/')) {
    return pathname.slice(0, qdnBase.length);
  }
  // "/render/APP/Q-Mintership+" has 4 parts once split on "/"; take as many from the path.
  const prefix = pathname.split('/').slice(0, qdnBase.split('/').length).join('/');
  return decodedLower(prefix) === decodedLower(qdnBase) ? prefix : null;
}

/**
 * The router's basename for `pathname`: `qdnBase` when the path starts with
 * it; the path's own leading segments when they spell the same app
 * differently (Core injects `_qdnBase` decoded, "/render/APP/Q-Mintership+",
 * but Hub loads the frame with the name as the qortal:// link spelled it,
 * e.g. "Q-Mintership%2B"); "" when there is no base.
 */
export function resolveRouterBase(pathname: string, qdnBase: string | undefined): string {
  if (!qdnBase) return '';
  const prefix = appPrefix(pathname, qdnBase);
  return prefix === null || prefix.toLowerCase() === qdnBase.toLowerCase() ? qdnBase : prefix;
}

/**
 * The basename for this page load (ported from Q-Share+). When the URL
 * spells the app name differently from Core, it is first rewritten (no new
 * history entry) to Core's spelling, so the paths reported to Hub (its Back
 * and Copy link) strip cleanly. The basename always matches the path as it
 * reads after the rewrite; React Router shows a 404 for one that doesn't.
 */
export function routerBaseForPage(
  qdnBase: string | undefined = resolveQdnBase(),
  location: Location = window.location,
  history: History = window.history
): string {
  if (!qdnBase) return '';
  const prefix = appPrefix(location.pathname, qdnBase);
  if (prefix === null || prefix === qdnBase) return qdnBase;
  try {
    history.replaceState(
      history.state,
      '',
      qdnBase + location.pathname.slice(prefix.length) + location.search + location.hash
    );
  } catch {
    // Keep the URL as it is: the basename below still matches it.
  }
  // Check the path that resulted: the browser percent-encodes non-ASCII in a
  // replaceState path, while Core injects `_qdnBase` raw.
  return resolveRouterBase(location.pathname, qdnBase);
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

/**
 * One of the app's own query values (`?who=`, `?show=`, `?d=`). Hub's
 * `?theme=…&lang=…` can be appended to a URL that already has a query, which
 * leaves a second "?" inside the last value ("Q…?theme=dark"): from there on
 * it isn't the app's.
 */
export function appParam(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  if (value === null) return null;
  return value.split('?')[0] || null;
}

/**
 * A `qortal://APP/Q-Mintership+/<path>` link for sharing. Hub never decodes
 * the app name, so its `+` stays literal (docs/QORTAL.md → Deep links).
 */
export function buildAppLink(path: string): string {
  const normalized = normalizeHubPath(path);
  const suffix = normalized === '/' ? '' : normalized;
  return `qortal://APP/${LINK_APP_NAME}${suffix}`;
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
