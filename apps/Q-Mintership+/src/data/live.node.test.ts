/**
 * Optional check of the data layer against a real node, read-only:
 *
 *   npm run test:live            (QMP_LIVE_NODE defaults to http://127.0.0.1:12391)
 *
 * Every request goes through a GET-only fetch (anything else fails the
 * test), so this can't change anything on the node. It loads what the app's
 * screens load and checks that real Core answers fit the app's shapes and
 * rules. Skipped in the normal test run.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDecisions } from './decisions';
import { loadNominations } from './nominations';
import { loadMyStatus } from './me';
import { loadActivity } from './activity';
import { getAdmins, getGroupInfo, getJoinRequests, getMembers } from './group';
import { resetQueries } from './query';
import { approvalsNeeded } from '../rules/threshold';
import { NULL_OWNER } from './constants';

type Env = { QMP_LIVE_NODE?: string };
const NODE = (
  (globalThis as { process?: { env?: Env } }).process?.env?.QMP_LIVE_NODE ?? ''
).replace(/\/$/, '');

interface NodeResponse {
  statusCode?: number;
  headers: Record<string, string | string[] | undefined>;
  setEncoding(enc: string): void;
  on(event: 'data' | 'end', cb: (chunk: string) => void): void;
}

const gets: string[] = [];
let saved: unknown;

/** fetch over node:http that only ever GETs, so the setup's mock isn't involved. */
async function getOnlyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method !== 'GET') throw new Error(`Refused ${method}: the live check is read-only`);
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, NODE);
  if (/[?&]limit=0(&|$)/.test(url.search))
    throw new Error(`limit=0 is never allowed: ${url.pathname}`);
  gets.push(url.pathname + url.search);
  const mod = (await import(/* @vite-ignore */ `node:${'http'}`)) as {
    get: (
      url: string,
      cb: (res: NodeResponse) => void
    ) => { on(e: 'error', cb: (err: unknown) => void): void };
  };
  return new Promise((resolve, reject) => {
    mod
      .get(`${NODE}${url.pathname}${url.search}`, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (text += chunk));
        res.on('end', () =>
          resolve(
            new Response(text, {
              status: res.statusCode ?? 0,
              headers: { 'Content-Type': String(res.headers['content-type'] ?? 'text/plain') },
            })
          )
        );
      })
      .on('error', reject);
  });
}

describe.skipIf(!NODE)('the data layer on a real node (GET only)', () => {
  beforeAll(() => {
    saved = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      value: getOnlyFetch,
      writable: true,
      configurable: true,
    });
    resetQueries();
  });
  afterAll(() => {
    Object.defineProperty(globalThis, 'fetch', {
      value: saved,
      writable: true,
      configurable: true,
    });
  });

  it('reads MINTER: settings, admins with the null owner, members, join requests', async () => {
    const [info, admins, members, joins] = await Promise.all([
      getGroupInfo(),
      getAdmins(),
      getMembers(),
      getJoinRequests(),
    ]);
    expect(info.groupId).toBe(694);
    expect(admins.admins.some((a) => a.member === NULL_OWNER)).toBe(true);
    expect(admins.signers.length).toBe(admins.admins.length - 1);
    expect(members.members.length).toBe(members.memberCount);
    console.info(
      `MINTER: ${info.approvalThreshold}, delays ${info.minimumBlockDelay}/${info.maximumBlockDelay}, ` +
        `${members.memberCount} members, ${admins.adminCount} admin rows → ${approvalsNeeded(info.approvalThreshold, admins.adminCount)} signatures needed, ` +
        `${joins.length} join requests`
    );
  });

  it('builds the Decisions queue from real pending transactions', async () => {
    const data = await loadDecisions();
    expect(data.now.estimated).toBe(false);
    for (const d of data.decisions) {
      expect(d.tally).not.toBeNull();
      if (d.blockHeight !== null)
        expect(d.window?.expiresAtHeight).toBe(d.blockHeight + data.group.maximumBlockDelay + 1);
    }
    console.info(
      `Decisions: ${data.decisions.length} pending, ${data.unusual.length} flagged; block time ${(data.now.msPerBlock / 1000).toFixed(1)} s; ` +
        data.decisions
          .map(
            (d) =>
              `${d.kind} ${d.tally?.approvalCount}/${d.tally?.needed} ${d.phase} expires@${d.window?.expiresAtHeight}`
          )
          .join('; ')
    );
  });

  it('assembles nominations (records and pending invites)', async () => {
    const data = await loadNominations();
    console.info(
      `Nominations: ${data.all.length} (${data.open.length} open), ${data.ignored.length} records ignored, truncated ${data.truncated}`
    );
    expect(Array.isArray(data.open)).toBe(true);
  });

  it('resolves real accounts into statuses', async () => {
    const admins = await getAdmins();
    const members = await getMembers();
    const joins = await getJoinRequests();
    const adminAddress = admins.signers[0].member;
    const memberAddress = members.members.find(
      (m) => !admins.admins.some((a) => a.member === m.member)
    )?.member;
    const joiner = joins[0]?.joiner;
    const results: string[] = [];
    for (const address of [adminAddress, memberAddress, joiner].filter(Boolean) as string[]) {
      const status = await loadMyStatus(address);
      results.push(`${address.slice(0, 6)}… → ${status.kind} (level ${status.level})`);
    }
    expect((await loadMyStatus(adminAddress)).kind).toBe('admin');
    console.info(`Statuses: ${results.join('; ')}`);
  });

  it('computes Minter Admin Activity for 30 days', async () => {
    const data = await loadActivity({ days: 30 });
    expect(data).toBeTruthy();
    console.info(
      `Activity: ${JSON.stringify(data).length} bytes of results; ${gets.length} GETs so far in this run`
    );
  }, 120_000);

  it('never sent anything but GETs, and never limit=0', () => {
    expect(gets.every((g) => !/[?&]limit=0(&|$)/.test(g))).toBe(true);
    console.info(`Total GETs: ${gets.length}`);
  });
});
