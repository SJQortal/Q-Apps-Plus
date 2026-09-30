/**
 * The router's basename. Core injects `_qdnBase` with the app name decoded
 * ("/render/APP/Q-Share+"), but Hub loads the frame with the name exactly as
 * the qortal:// link spelled it, so the URL can read "/render/APP/Q-Share%2B/…".
 * React Router only strips a basename the path starts with (ignoring case),
 * and renders nothing otherwise: a blank app.
 */

function decoded(value: string): string {
  try {
    return decodeURIComponent(value).toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

/** The start of `pathname` that names the same app as `qdnBase`, as the URL spells it; null if none. */
function appPrefix(pathname: string, qdnBase: string): string | null {
  const next = pathname.charAt(qdnBase.length);
  if (pathname.toLowerCase().startsWith(qdnBase.toLowerCase()) && (!next || next === "/")) {
    return pathname.slice(0, qdnBase.length);
  }
  // "/render/APP/Q-Share+" has 4 parts once split on "/"; take as many from the path.
  const prefix = pathname.split("/").slice(0, qdnBase.split("/").length).join("/");
  return decoded(prefix) === decoded(qdnBase) ? prefix : null;
}

/**
 * `qdnBase` when `pathname` starts with it; the pathname's own leading
 * segments when they spell the same app differently (e.g. %2B for +);
 * "" in Hub Dev Mode, where `_qdnBase` is "".
 */
export function resolveRouterBase(pathname: string, qdnBase: string | undefined): string {
  if (!qdnBase) return "";
  const prefix = appPrefix(pathname, qdnBase);
  return prefix === null || prefix.toLowerCase() === qdnBase.toLowerCase() ? qdnBase : prefix;
}

/**
 * The basename for this page load. When the URL spells the app name
 * differently from Core, it is first rewritten (no new history entry) to
 * Core's spelling: q-apps.js reports each route to Hub by stripping
 * `_qdnBase`, and Hub's Back and Copy link rely on those paths. The basename
 * returned always matches the path as it reads after the rewrite.
 */
export function routerBaseForPage(
  qdnBase: string | undefined,
  location: Location = window.location,
  history: History = window.history
): string {
  if (!qdnBase) return "";
  const prefix = appPrefix(location.pathname, qdnBase);
  if (prefix === null || prefix === qdnBase) return qdnBase;
  try {
    history.replaceState(history.state, "", qdnBase + location.pathname.slice(prefix.length) + location.search + location.hash);
    // Check the path that resulted: the browser percent-encodes non-ASCII in a
    // replaceState path, while Core injects `_qdnBase` raw ("/render/APP/Café").
    return resolveRouterBase(location.pathname, qdnBase);
  } catch {
    return resolveRouterBase(location.pathname, qdnBase);
  }
}
