import type { To } from 'react-router-dom';
import { TORQ_APP_NAME } from './quitterCompat';

const RENDER_BASE_RE = /^\/render\/(?:APP|WEBSITE)\/[^/]+/i;

type QdnWindow = Window & {
  _qdnBase?: string;
  _qdnName?: string;
  _qdnService?: string;
  _qdnIdentifier?: string;
};

let historyPaths: string[] = [];
let historyIndex = -1;
let skipNextHistoryEntry = false;

function qdnWindow(): QdnWindow | undefined {
  if (typeof window === 'undefined') return undefined;
  return window as QdnWindow;
}

export function resolveQdnBase(): string {
  const injected = qdnWindow()?._qdnBase;
  if (typeof injected === 'string' && injected.trim()) {
    return injected.replace(/\/$/, '');
  }
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(RENDER_BASE_RE);
  return match ? match[0] : '';
}

export function currentQortalAppName(): string {
  const injected = qdnWindow()?._qdnName?.trim();
  if (injected) return injected;
  const base = resolveQdnBase();
  const fromBase = base.split('/').filter(Boolean).at(-1);
  if (fromBase) {
    try {
      return decodeURIComponent(fromBase);
    } catch {
      return fromBase;
    }
  }
  return TORQ_APP_NAME;
}

export function currentQortalService(): 'APP' | 'WEBSITE' {
  const injected = qdnWindow()?._qdnService?.toUpperCase();
  if (injected === 'WEBSITE') return 'WEBSITE';
  return 'APP';
}

export function normalizeHubPath(path: string): string {
  // Hub refresh does `/render/{service}/{name}${path}?theme=&identifier=&time=`.
  // Any `?` we report is concatenated into that URL and corrupts `identifier`.
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

/** Hub copy-link is `qortal://APP/{name}{path}`. Home must be empty, not `/?theme=`. */
export function hubDisplayPath(path: string): string {
  const normalized = normalizeHubPath(path);
  return normalized === '/' ? '' : normalized;
}

function hubResourceIdentifier(): string | undefined {
  const identifier = String(qdnWindow()?._qdnIdentifier || '').trim();
  if (!identifier || identifier === 'null' || identifier === 'undefined') {
    return undefined;
  }
  if (identifier.startsWith('?') || /[&=]/.test(identifier)) {
    return undefined;
  }
  return identifier;
}

export function toAppPath(path: To): To {
  if (typeof path !== 'string') return path;
  return normalizeHubPath(path);
}

export function buildPublishedPostLink(name: string, identifier: string): string {
  return `qortal://APP/${currentQortalAppName()}/post/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;
}

/** A reply link opens the parent conversation and focuses that reply. */
export function buildSharedPostLink(
  name: string,
  identifier: string,
  parent?: { name?: string; identifier?: string } | null
): string {
  const parentName = parent?.name?.trim() || '';
  const parentId = parent?.identifier?.trim() || '';
  if (parentName && parentId && parentId !== identifier) {
    return `${buildPublishedPostLink(parentName, parentId)}/reply/${encodeURIComponent(identifier)}`;
  }
  return buildPublishedPostLink(name, identifier);
}

export function markHubNavigationAsNonManual() {
  skipNextHistoryEntry = true;
}

function hubParentWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  if (window.parent && window.parent !== window) return window.parent;
  if (window.top && window.top !== window) return window.top;
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
  skipNextHistoryEntry = false;
}

export function notifyHubDisplayedPath(path: string) {
  const normalized = hubDisplayPath(path);
  const identifier = hubResourceIdentifier();
  postToHub({
    action: 'QDN_RESOURCE_DISPLAYED',
    service: currentQortalService(),
    name: currentQortalAppName(),
    path: normalized,
    ...(identifier ? { identifier } : {}),
  });

  if (skipNextHistoryEntry) {
    skipNextHistoryEntry = false;
    return;
  }

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
