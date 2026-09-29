/**
 * Deep links and Hub navigation for a name that may contain spaces or `+`.
 * Hub injects `_qdnName` with the app's registered name (e.g. "Q-Share+"),
 * so links copied here open in whichever app is running.
 */
const ORIGINAL_APP_NAME = "Q-Share";

export function currentAppName(): string {
  if (typeof window === "undefined") return ORIGINAL_APP_NAME;
  const injected = (window as Window & { _qdnName?: string })._qdnName;
  if (typeof injected === "string" && injected.trim()) {
    try {
      return decodeURIComponent(injected);
    } catch {
      return injected;
    }
  }
  return ORIGINAL_APP_NAME;
}

export function shareLink(name: string, identifier: string): string {
  return `qortal://APP/${encodeURIComponent(currentAppName())}/share/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;
}

export function profileLink(name: string): string {
  return `qortal://APP/${encodeURIComponent(currentAppName())}/channel/${encodeURIComponent(name)}`;
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
