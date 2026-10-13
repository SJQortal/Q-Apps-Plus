/**
 * The dev server side of a testnet run (vite.testnet.config.ts only; the
 * app's own build never loads this file):
 *
 * - GET /qmp-testnet-node/…   the testnet node's API, GET only (the app
 *   reads Core here in testnet runs, as it reads its own node in Hub);
 * - POST /qmp-testnet-signer  { as, request }: the test signer answers a
 *   qortalRequest as the test account `as` would in Hub (lib/hub.mjs);
 * - /qmp-testnet-control/…    config (group id by key, public account info),
 *   Hub behaviours on demand, and the signer's log for the scenarios;
 * - the signer and every control POST take same-origin JSON on a loopback
 *   host only (lib/request-guard.mjs), so no other page can drive them;
 * - index.html loads testnet/browser/entry.ts instead of src/main.tsx.
 *
 * The node is reached only through the testnet's Unix socket (lib/node.mjs),
 * which refuses to write unless the node says "isTestNet": true.
 */
import { rawGet, assertTestnet } from './lib/node.mjs';
import { hubRequest, hubError, DIALOG_ACTIONS } from './lib/hub.mjs';
import { account, publicAccounts, readWorld } from './lib/world.mjs';
import { signerRequestRefusal } from './lib/request-guard.mjs';

const HUB_TIMEOUT_MS = 30_000;

/** Per account: queued Hub behaviours for its next dialogs. */
const behaviours = new Map();
/** What the signer did, newest last (no keys, no payload bodies). */
const log = [];

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function nextBehaviour(as, action) {
  if (!DIALOG_ACTIONS.has(action) && action !== 'GET_USER_ACCOUNT') return { mode: 'accept' };
  const queue = behaviours.get(as) ?? [];
  const index = queue.findIndex((b) => !b.action || b.action === action);
  if (index < 0) return { mode: 'accept' };
  const [behaviour] = queue.splice(index, 1);
  return behaviour;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signer(req, res) {
  const { as, request } = JSON.parse(await readBody(req));
  let who;
  try {
    who = account(as);
  } catch {
    return sendJson(res, 200, { ok: false, error: hubError(`No test account "${as}"`) });
  }
  const action = request?.action;
  const behaviour = nextBehaviour(as, action);
  const entry = { at: Date.now(), as, action, mode: behaviour.mode, outcome: 'pending' };
  log.push(entry);
  const run = (beforeAccept) =>
    hubRequest(who, request, { mode: behaviour.mode === 'timeout' ? 'accept' : behaviour.mode, beforeAccept })
      .then((result) => {
        entry.outcome = 'ok';
        if (result && typeof result === 'object' && result.signature) {
          entry.signature = result.signature;
          entry.type = result.type;
        }
        return { ok: true, result };
      })
      .catch((error) => {
        entry.outcome = 'error';
        entry.error = error?.message ?? String(error);
        return { ok: false, error: error?.error ? error : hubError(String(error?.message ?? error)) };
      });

  if (behaviour.mode === 'timeout') {
    // Hub answers the app after 30 s and still applies the late Accept.
    const late = behaviour.lateMs ?? 40_000;
    void run(() => sleep(late));
    await sleep(behaviour.timeoutMs ?? HUB_TIMEOUT_MS);
    entry.timedOutForApp = true;
    return sendJson(res, 200, {
      ok: false,
      error: { error: 'timeout', message: `Request timed out after ${HUB_TIMEOUT_MS} ms (action: ${action})` },
    });
  }
  return sendJson(res, 200, await run());
}

async function control(req, res, url) {
  if (url.pathname === '/qmp-testnet-control/config') {
    const world = readWorld();
    const key = url.searchParams.get('group') || 'main';
    const group = world.groups[key];
    return sendJson(res, 200, {
      groupKey: key,
      groupId: group?.groupId ?? null,
      groups: Object.fromEntries(Object.entries(world.groups).map(([k, g]) => [k, g.groupId])),
      names: world.names,
    });
  }
  if (url.pathname === '/qmp-testnet-control/accounts') return sendJson(res, 200, publicAccounts());
  if (url.pathname === '/qmp-testnet-control/log') {
    const since = Number(url.searchParams.get('since') ?? 0);
    return sendJson(res, 200, log.filter((e) => e.at >= since));
  }
  if (url.pathname === '/qmp-testnet-control/behaviour' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req));
    const queue = behaviours.get(body.as) ?? [];
    queue.push({ mode: body.mode, action: body.action, lateMs: body.lateMs, timeoutMs: body.timeoutMs });
    behaviours.set(body.as, queue);
    return sendJson(res, 200, { queued: queue.length });
  }
  if (url.pathname === '/qmp-testnet-control/behaviour/clear' && req.method === 'POST') {
    behaviours.clear();
    return sendJson(res, 200, { cleared: true });
  }
  return sendJson(res, 404, { error: 'unknown control path' });
}

async function nodeProxy(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'The app only reads from the node.' });
  }
  const target = url.pathname.slice('/qmp-testnet-node'.length) + url.search;
  const upstream = await rawGet(target || '/', req.headers.accept || 'application/json');
  res.statusCode = upstream.status;
  for (const header of ['content-type', 'cache-control', 'content-length']) {
    if (upstream.headers[header]) res.setHeader(header, upstream.headers[header]);
  }
  res.end(req.method === 'HEAD' ? undefined : upstream.body);
}

export function testnetPlugin() {
  return {
    name: 'qmp-testnet',
    apply: 'serve',
    async configureServer(server) {
      await assertTestnet({ fresh: true });
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        // Another page open in the browser must not drive the signer (lib/request-guard.mjs).
        const refusal = signerRequestRefusal(req, url.pathname);
        if (refusal) return sendJson(res, 403, { error: refusal });
        const handle = url.pathname.startsWith('/qmp-testnet-node')
          ? nodeProxy(req, res, url)
          : url.pathname === '/qmp-testnet-signer' && req.method === 'POST'
            ? signer(req, res)
            : url.pathname.startsWith('/qmp-testnet-control/')
              ? control(req, res, url)
              : null;
        if (!handle) return next();
        handle.catch((error) => sendJson(res, 500, { error: String(error?.message ?? error) }));
      });
    },
    transformIndexHtml(html) {
      return html.replace('/src/main.tsx', '/testnet/browser/entry.ts');
    },
  };
}
