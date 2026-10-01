/**
 * Deep links and Hub navigation for a name that may contain spaces or `+`.
 * Core injects `_qdnName` with the app's registered name (e.g. "Q-Share+"),
 * so links copied here open in whichever app is running.
 */
/** This app's published name: the fallback in Hub Dev Mode, where `_qdnName` is "". */
const PUBLISHED_APP_NAME = "Q-Share+";

export function currentAppName(): string {
  if (typeof window === "undefined") return PUBLISHED_APP_NAME;
  const injected = (window as Window & { _qdnName?: string })._qdnName;
  if (typeof injected === "string" && injected.trim()) {
    try {
      return decodeURIComponent(injected);
    } catch {
      return injected;
    }
  }
  return PUBLISHED_APP_NAME;
}

/**
 * The app name as Hub writes it in a qortal:// link: raw, with only spaces
 * as %20. Hub never decodes this segment, so "Q-Share%2B" would open a tab
 * whose URL no longer matches the app's `_qdnBase` ("/render/APP/Q-Share+").
 */
function appSegment(): string {
  return currentAppName().replace(/ /g, "%20");
}

export function shareLink(name: string, identifier: string): string {
  return `qortal://APP/${appSegment()}/share/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;
}

export function profileLink(name: string): string {
  return `qortal://APP/${appSegment()}/channel/${encodeURIComponent(name)}`;
}

/** In-app route for a share page. */
export function sharePath(name: string, identifier: string): string {
  return `/share/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;
}

export function profilePath(name: string): string {
  return `/channel/${encodeURIComponent(name)}`;
}

export function avatarUrl(name: string): string {
  return `/arbitrary/THUMBNAIL/${encodeURIComponent(name)}/qortal_avatar`;
}

/** A route param as typed: React Router decodes once, and a stray `%` must not throw. */
export function decodeParam(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
