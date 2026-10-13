/**
 * Testnet runs only (vite.testnet.config.ts puts this in place of
 * src/main.tsx; the app's build never sees it). Before the app loads it:
 *
 * - picks the test account (`?as=admin01`) and the test group
 *   (`?group=main`), and keeps both for this tab;
 * - installs a qortalRequest that asks the dev server's test signer, which
 *   answers as Hub would for that account on the private testnet;
 * - tells the app which group to treat as MINTER (window.__QMP_TESTNET_CONFIG__,
 *   read only when the build was made with __QMP_TESTNET__ on).
 *
 * Then it starts the app as usual, and exposes the app's own write flows and
 * reads to the scenario runner (window.__qmpTestnet).
 */
type Json = Record<string, unknown>;

const params = new URLSearchParams(location.search);
const remember = (key: string, fallback: string): string => {
  const fromUrl = params.get(key);
  if (fromUrl) sessionStorage.setItem(`qmp-testnet-${key}`, fromUrl);
  return fromUrl ?? sessionStorage.getItem(`qmp-testnet-${key}`) ?? fallback;
};
const as = remember('as', 'admin01');
const groupKey = remember('group', 'main');

const w = window as unknown as Json & {
  qortalRequest?: unknown;
  qortalRequestWithTimeout?: unknown;
};

async function start(): Promise<void> {
  const config = (await (
    await fetch(`/qmp-testnet-control/config?group=${encodeURIComponent(groupKey)}`)
  ).json()) as {
    groupId: number | null;
    groupKey: string;
  };
  if (!config.groupId)
    throw new Error(`The testnet has no group "${groupKey}" yet: run testnet/setup.mjs.`);

  w.__QMP_TESTNET_CONFIG__ = { groupId: config.groupId, groupKey, as };

  const qortalRequest = async (request: Json): Promise<unknown> => {
    const res = await fetch('/qmp-testnet-signer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ as, request }),
    });
    const body = (await res.json()) as { ok: boolean; result?: unknown; error?: unknown };
    if (body.ok) return body.result;
    throw body.error;
  };
  w.qortalRequest = qortalRequest;
  w.qortalRequestWithTimeout = (request: Json) => qortalRequest(request);

  await import('../../src/main');

  const [flows, txs, group, query] = await Promise.all([
    import('../../src/writes/flows'),
    import('../../src/data/txs'),
    import('../../src/data/group'),
    import('../../src/data/query'),
  ]);
  w.__qmpTestnet = { as, groupKey, groupId: config.groupId, flows, txs, group, query, ready: true };
}

void start();
