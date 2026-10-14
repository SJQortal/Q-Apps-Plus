/**
 * The private testnet node, reached only through its Unix socket
 * (~/.qmp-testnet/api.sock). The node itself runs in a network namespace
 * with nothing but loopback (testnet/testnet.mjs start), so it can't reach
 * any peer, and this client can't reach any other node: there is no TCP
 * URL here to point at mainnet.
 *
 * Every POST first checks GET /admin/info says "isTestNet": true, and
 * refuses otherwise. POSTs that write (process) re-check every time.
 */
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

export const TESTNET_HOME = process.env.QMP_TESTNET_HOME || path.join(os.homedir(), '.qmp-testnet');
export const SOCKET_PATH = path.join(TESTNET_HOME, 'api.sock');

export class NodeError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function request(method, pathAndQuery, { body, contentType, accept = 'application/json', timeoutMs = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: SOCKET_PATH,
        method,
        path: pathAndQuery,
        headers: {
          Accept: accept,
          ...(body !== undefined ? { 'Content-Type': contentType || 'application/json' } : {}),
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) })
        );
      }
    );
    req.on('timeout', () => req.destroy(new Error(`Testnet node timed out: ${method} ${pathAndQuery}`)));
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

/** Raw GET, for the dev server's read proxy: status, headers and body. */
export function rawGet(pathAndQuery, accept) {
  return request('GET', pathAndQuery, { accept });
}

export async function getText(pathAndQuery) {
  const res = await request('GET', pathAndQuery, { accept: 'text/plain' });
  const text = res.body.toString('utf8');
  if (res.status < 200 || res.status >= 300) throw new NodeError(`GET ${pathAndQuery}: ${res.status} ${text}`, res.status, text);
  return text;
}

export async function getJson(pathAndQuery) {
  const res = await request('GET', pathAndQuery);
  const text = res.body.toString('utf8');
  if (res.status < 200 || res.status >= 300) throw new NodeError(`GET ${pathAndQuery}: ${res.status} ${text}`, res.status, text);
  return text ? JSON.parse(text) : null;
}

let verifiedAt = 0;

/** Refuses (throws) unless the node says it is a testnet. */
export async function assertTestnet({ fresh = false } = {}) {
  if (!fresh && Date.now() - verifiedAt < 10_000) return;
  const info = await getJson('/admin/info');
  if (!info || info.isTestNet !== true) {
    verifiedAt = 0;
    throw new Error('Refusing to write: this node does not say "isTestNet": true.');
  }
  verifiedAt = Date.now();
}

/**
 * POST to the testnet node. `write: true` (process, publish) re-checks
 * isTestNet first, every time.
 */
export async function post(pathAndQuery, body, { contentType = 'application/json', write = false } = {}) {
  await assertTestnet({ fresh: write });
  const res = await request('POST', pathAndQuery, { body, contentType });
  const text = res.body.toString('utf8');
  return { status: res.status, text, json: safeJson(text) };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function height() {
  return Number(await getText('/blocks/height'));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wait until the chain reaches `target` (polls every 2 s). */
export async function waitForHeight(target, { timeoutMs = 30 * 60_000 } = {}) {
  const start = Date.now();
  for (;;) {
    const h = await height();
    if (h >= target) return h;
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for block ${target} (at ${h})`);
    await sleep(2_000);
  }
}

/** Wait until a transaction is in a block; returns its JSON. */
export async function waitForConfirmed(signature, { timeoutMs = 10 * 60_000 } = {}) {
  const start = Date.now();
  for (;;) {
    const tx = await getJson(`/transactions/signature/${encodeURIComponent(signature)}`).catch(() => null);
    if (tx && typeof tx.blockHeight === 'number') return tx;
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${signature.slice(0, 12)}… to confirm`);
    await sleep(2_000);
  }
}
