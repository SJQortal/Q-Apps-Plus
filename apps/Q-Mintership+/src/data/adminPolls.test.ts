import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_POLL_IDS,
  NULL_OWNER,
  addAdminPolls,
  answerDecrypt,
  fakeAddress,
  mockEncrypt,
} from '../../e2e/world.mjs';
import { serveAdminPolls } from '../test/adminPolls';
import { fetchCallsFor, mockFetchRoute, mockQortalRequest, qortalCallsFor } from '../test/setup';
import { ADDR, installWorld } from '../test/world';
import { assemblePolls } from '../rules/adminPolls';
import {
  encryptionTargets,
  getPublicKey,
  loadAdminPolls,
  loadPollThread,
  pollContext,
  pollThreadKey,
  retryPollDecrypts,
} from './adminPolls';
import { invalidate } from './query';

describe('loadPollThread: a poll’s comments, once opened', () => {
  it('decrypts the newest comments and the ones their replies answer, once per version', async () => {
    const { address, made } = (() => {
      const installed = installWorld('admin');
      const made = addAdminPolls(installed.world);
      serveAdminPolls(installed.world, 'admin');
      return { ...installed, made };
    })();
    const data = await loadAdminPolls(address);
    const views = assemblePolls(data.sources, pollContext(data));
    const open = views.find((v) => v.id === ADMIN_POLL_IDS.open)!;
    expect(open.commentRows).toHaveLength(3);
    const before = qortalCallsFor('DECRYPT_DATA').length;
    // Only the newest comment: the reply's parent isn't among them, so it is read too.
    const newestOnly = await loadPollThread(address, open.id, open.commentRows.slice(1), 1);
    const reply = open.commentRows.find((r) => r.name === 'Juniper L4')!;
    const parent = open.commentRows.find((r) => r.identifier === made.comments.reply)!;
    expect(open.commentRows.slice(1)[0].ref).toBe(reply.ref);
    expect(newestOnly.get(reply.ref)?.status).toBe('ok');
    expect(newestOnly.get(parent.ref)?.status).toBe('ok');
    const read = qortalCallsFor('DECRYPT_DATA').length - before;
    expect(read).toBe(2);
    // The same bodies again: nothing new is decrypted.
    await loadPollThread(address, open.id, open.commentRows, 3);
    expect(qortalCallsFor('DECRYPT_DATA').length - before).toBe(3);
    expect(pollThreadKey(address, open.id, open.commentRows, 20)).toMatch(
      new RegExp(`^adminpolls:thread:${address}:${open.id}:20:3:\\d+$`)
    );
  });
});

afterEach(() => vi.useRealTimers());

const HOUR = 3_600_000;
const DAY = 86_400_000;
const extra = (i: number) => fakeAddress(`admin-${i}`);

function setup(persona = 'admin', options: { decrypt?: boolean } = {}) {
  const installed = installWorld(persona);
  const made = addAdminPolls(installed.world);
  serveAdminPolls(installed.world, persona, options);
  return { ...installed, made };
}

async function views(viewer: string, force = false) {
  const data = await loadAdminPolls(viewer, { force });
  return { data, views: assemblePolls(data.sources, pollContext(data)) };
}

const decrypts = () => qortalCallsFor('DECRYPT_DATA').length;
const searches = () =>
  fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) => p.includes('DOCUMENT_PRIVATE'));

describe('loadAdminPolls: what an admin reads', () => {
  it('four searches (one per prefix), newest first, 100 a page, the last 62 days', async () => {
    const { address } = setup();
    await loadAdminPolls(address);
    const calls = searches();
    expect(calls).toHaveLength(4);
    const after = Math.floor((Date.now() - 62 * DAY) / HOUR) * HOUR;
    for (const prefix of [
      'qmp-adminpoll-',
      'qmp-adminvote-',
      'qmp-admincomment-',
      'qmp-adminshare-',
    ]) {
      const call = calls.find((p) => p.includes(`identifier=${prefix}`)) as string;
      const params = new URL(call, 'http://x').searchParams;
      expect(params.get('service')).toBe('DOCUMENT_PRIVATE');
      expect(params.get('prefix')).toBe('true');
      expect(params.get('reverse')).toBe('true');
      expect(params.get('limit')).toBe('100');
      expect(params.get('offset')).toBe('0');
      expect(Number(params.get('after'))).toBe(after);
    }
    // Never "everything".
    expect(calls.some((p) => /limit=0\b/.test(p))).toBe(false);
  });

  it('lists the polls the admin can read, open first (soonest end), then the closed ones', async () => {
    const { address } = setup();
    const { views: list } = await views(address);
    expect(list.map((v) => [v.id, v.open])).toEqual([
      [ADMIN_POLL_IDS.open, true],
      [ADMIN_POLL_IDS.shared, true],
      [ADMIN_POLL_IDS.voted, true],
      [ADMIN_POLL_IDS.closed, false],
    ]);
    const [open, shared, voted, closed] = list;
    expect(open.publisher.name).toBe('Admin B');
    expect(open.counts).toEqual({ yes: 3, no: 2, neutral: 1 });
    expect(open.myVote).toBeNull();
    expect(open.missing).toEqual([extra(14), extra(15)]);
    expect(open.commentRows).toHaveLength(3);
    // Read from Admin D's share: the votes Avery can't read come from it.
    expect(shared.sharedBy?.name).toBe('Admin D ΑΩ');
    expect(shared.publisher.name).toBe('Admin K');
    expect(shared.counts).toEqual({ yes: 1, no: 1, neutral: 1 });
    expect(shared.votes.map((v) => [v.name, v.via])).toEqual([
      ['Admin K', 'share'],
      ['Admin L', 'share'],
      ['Admin M', 'direct'],
    ]);
    expect(shared.missing).toEqual([]);
    expect(voted.myVote?.vote).toBe('no');
    expect(closed.counts).toEqual({ yes: 3, no: 1, neutral: 1 });
    expect(closed.late.map((v) => v.name)).toEqual(['Admin I']);
  });

  it('decrypts each body once per version for the session; locked ones aren’t asked again', async () => {
    const { address } = setup();
    await loadAdminPolls(address);
    const first = decrypts();
    expect(first).toBeGreaterThan(0);
    // Every DECRYPT_DATA carries only the encrypted data (no dialog, no public key).
    for (const call of qortalCallsFor('DECRYPT_DATA'))
      expect(Object.keys(call).sort()).toEqual(['action', 'encryptedData']);
    invalidate('adminpolls:');
    await loadAdminPolls(address, { force: true });
    expect(decrypts()).toBe(first);
    expect(searches()).toHaveLength(8);
    // The poll that was never encrypted to Avery was tried once, then left alone.
    const lockedReads = fetchCallsFor(`/arbitrary/DOCUMENT_PRIVATE/Admin%20N/`);
    expect(lockedReads).toHaveLength(1);
    expect(lockedReads[0]).toMatch(/\?encoding=base64$/);
  });

  it('reads bodies only from current Minter Admins’ names', async () => {
    const { address } = setup();
    await loadAdminPolls(address);
    expect(fetchCallsFor('/arbitrary/DOCUMENT_PRIVATE/Nora%20Nominator/')).toHaveLength(0);
    // Nora's name was checked once (who owns it), nothing more.
    expect(fetchCallsFor('/names/Nora%20Nominator')).toHaveLength(1);
  });

  it('reads a share only where something is missing for the viewer', async () => {
    const { address, world } = setup();
    // A share of a poll Avery reads in full and that every admin can read already.
    world.adminPollRecords.push({
      name: 'Admin A',
      identifier: `qmp-adminshare-${ADMIN_POLL_IDS.voted}`,
      created: Date.now() - HOUR,
      readers: world.admins.filter((a: string) => a !== NULL_OWNER),
      body: { v: 1 },
    });
    await loadAdminPolls(address);
    expect(fetchCallsFor(`/arbitrary/DOCUMENT_PRIVATE/Admin%20A/qmp-adminshare-`)).toHaveLength(0);
    // The shared poll Avery can't read: its share is read.
    expect(
      fetchCallsFor(
        `/arbitrary/DOCUMENT_PRIVATE/${encodeURIComponent('Admin D ΑΩ')}/qmp-adminshare-${ADMIN_POLL_IDS.shared}`
      )
    ).toHaveLength(1);
  });

  it('skips what can’t be decrypted quietly: another admin sees other polls', async () => {
    const { address } = setup('adminL4');
    const { views: list } = await views(address);
    // Juniper reads the poll Avery couldn't, and the shared one from its own body.
    expect(list.map((v) => v.id)).toContain(ADMIN_POLL_IDS.locked);
    const shared = list.find((v) => v.id === ADMIN_POLL_IDS.shared);
    expect(shared?.sharedBy).toBeNull();
    expect(list.find((v) => v.id === ADMIN_POLL_IDS.open)?.myVote?.vote).toBe('no');
  });

  it('a non-admin reads nothing at all', async () => {
    const { address } = setup('nominator');
    const data = await loadAdminPolls(address);
    expect(data.sources).toEqual([]);
    expect(searches()).toHaveLength(0);
    expect(decrypts()).toBe(0);
  });

  it('outside a Hub that can decrypt: nothing is shown, and that is said, not "no polls"', async () => {
    const { address } = setup('admin', { decrypt: false });
    const { data, views: list } = await views(address);
    expect(list).toEqual([]);
    expect(data.undecrypted).toBeGreaterThan(0);
  });

  it('Hub’s wallet locked: not cached as locked; asked again after a wait, or at once on Retry', async () => {
    const { address, world } = setup();
    let walletLocked = true;
    mockQortalRequest('DECRYPT_DATA', (request: Record<string, unknown>) => {
      if (walletLocked) throw new Error('Wallet not authenticated');
      return answerDecrypt(world, 'admin', request);
    });
    const first = await views(address);
    expect(first.views).toEqual([]);
    // Five polls from current admins Hub didn't decrypt (the one never encrypted to
    // Avery among them: Hub didn't say so this time).
    expect(first.data.undecrypted).toBe(5);
    const asked = decrypts();
    walletLocked = false;
    // A background refresh within the wait doesn't ask Hub again.
    invalidate('adminpolls:');
    expect((await views(address, true)).views).toEqual([]);
    expect(decrypts()).toBe(asked);
    // Retry (or Refresh): asked again now, and the polls are back.
    retryPollDecrypts();
    invalidate('adminpolls:');
    const after = await views(address, true);
    expect(after.views.map((v) => v.id)).toContain(ADMIN_POLL_IDS.open);
    expect(after.views).toHaveLength(4);
    expect(after.data.undecrypted).toBe(0);
  });

  it('“Unable to decrypt” is final for the session: not encrypted to this viewer', async () => {
    const { address } = setup();
    const { data } = await views(address);
    // The poll never encrypted to Avery: locked, so not counted as a Hub failure.
    expect(data.undecrypted).toBe(0);
    const asked = decrypts();
    retryPollDecrypts();
    invalidate('adminpolls:');
    await views(address, true);
    expect(decrypts()).toBe(asked);
  });

  it('a Hub timeout on DECRYPT_DATA is asked again on the next read', async () => {
    const { address, world } = setup();
    let busy = true;
    mockQortalRequest('DECRYPT_DATA', (request: Record<string, unknown>) => {
      if (busy) throw { error: 'timeout', message: 'Request timed out after 30000 ms' };
      return answerDecrypt(world, 'admin', request);
    });
    expect((await views(address)).views).toEqual([]);
    busy = false;
    invalidate('adminpolls:');
    expect((await views(address, true)).views.length).toBe(4);
  });

  it('a body that isn’t on the node yet is tried again later, not on every read', async () => {
    const { address } = setup();
    const path = `/arbitrary/DOCUMENT_PRIVATE/Admin%20B/qmp-adminpoll-${ADMIN_POLL_IDS.open}`;
    let there = false;
    const original = fetchCallsFor(path).length;
    mockFetchRoute(path, (url: URL) =>
      there ? mockEncrypt([], url.search) : new Response('', { status: 404 })
    );
    const before = await views(address);
    expect(before.views.map((v) => v.id)).not.toContain(ADMIN_POLL_IDS.open);
    const ladder = fetchCallsFor(path).length - original;
    expect(ladder).toBeGreaterThan(1);
    there = true;
    invalidate('adminpolls:');
    await views(address, true);
    expect(fetchCallsFor(path).length - original).toBe(ladder);
  });
});

describe('public keys', () => {
  it('reads each admin’s key once per session; an account without one has none', async () => {
    setup();
    const key = await getPublicKey(ADDR.adminL4);
    expect(key).toBeTruthy();
    await getPublicKey(ADDR.adminL4);
    expect(fetchCallsFor(`/addresses/publickey/${ADDR.adminL4}`)).toHaveLength(1);
    const nobody = fakeAddress('no-key-at-all');
    mockFetchRoute(`/addresses/publickey/${nobody}`, 'false');
    expect(await getPublicKey(nobody)).toBeNull();
  });

  it('encrypts to every admin who can sign (never the null owner), the writer included', async () => {
    const { address, publicKey, world } = setup();
    // One admin has no public key on chain: left out.
    world.accounts.get(extra(9)).publicKey = undefined;
    const { readers, publicKeys } = await encryptionTargets({ address, publicKey });
    const signers = world.admins.filter((a: string) => a !== NULL_OWNER && a !== extra(9));
    expect(readers).toEqual(signers);
    expect(readers).not.toContain(NULL_OWNER);
    expect(publicKeys).toHaveLength(signers.length);
    expect(publicKeys).toContain(publicKey);
    expect(publicKeys).toContain(world.accounts.get(ADDR.adminL4).publicKey);
    // The writer's own key isn't read from the node.
    expect(fetchCallsFor(`/addresses/publickey/${address}`)).toHaveLength(0);
    // Admins are read fresh for a write.
    expect(fetchCallsFor('/groups/members/694').length).toBeGreaterThan(0);
  });
});
