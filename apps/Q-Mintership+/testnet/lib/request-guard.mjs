/**
 * Who may drive the test signer and its controls (testnet/vite-plugin.mjs):
 * same-origin JSON on a loopback host only, so another web page open in the
 * same browser while `npm run dev:testnet` runs can't sign as a test account
 * or queue Hub behaviours.
 *
 * - Content-Type must be application/json: a page elsewhere can't send that
 *   without a CORS preflight, and the preflight (an OPTIONS) is refused here
 *   too.
 * - An Origin, when there is one, must be this server's own: whatever a page
 *   elsewhere sends carries its Origin.
 * - The Host must be a loopback name, so a name rebound to 127.0.0.1 fails.
 *   The plugin's middlewares run before Vite's own, so this can't rely on
 *   Vite's host check.
 *
 * A request with no Origin (testnet/run.mjs, from Node) still gets through.
 * GET and HEAD (config, accounts, the log) are read-only and not guarded.
 *
 * Dev-only: never part of the app's build.
 */

const LOOPBACK = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;

/** The paths that sign or change something. */
export function isGuardedPath(pathname) {
  return pathname === '/qmp-testnet-signer' || pathname.startsWith('/qmp-testnet-control/');
}

/** Why a request to a guarded path is refused, or null when it may go on. */
export function signerRequestRefusal(req, pathname) {
  if (!isGuardedPath(pathname)) return null;
  if (req.method === 'GET' || req.method === 'HEAD') return null;
  const header = (name) => {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const host = String(header('host') ?? '');
  const origin = header('origin');
  const type = String(header('content-type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!LOOPBACK.test(host)) return 'The test signer answers on 127.0.0.1 or localhost only.';
  if (type !== 'application/json' || (origin && origin !== `http://${host}`))
    return 'The test signer takes same-origin JSON requests only.';
  return null;
}
