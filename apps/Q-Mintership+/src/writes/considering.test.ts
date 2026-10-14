import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDecisions } from '../data/decisions';
import { ADDR, installWorld } from '../test/world';
import { fetchCalls, mockQortalRequest, qortalCallsFor } from '../test/setup';
import { myConsideringState } from '../rules/considering';
import { guardConsidering } from './guards';
import { publishConsidering } from './flows';
import { getPendingWrite, writeKeys } from './optimistic';

afterEach(() => vi.useRealTimers());

async function setUp(persona = 'admin') {
  const installed = installWorld(persona);
  const data = await loadDecisions();
  const of = (subject: string) => data.decisions.find((d) => d.subject === subject)!.signature;
  const signer = {
    address: installed.address,
    publicKey: installed.publicKey,
    name: installed.world.accounts.get(installed.address)?.name ?? null,
  };
  return { ...installed, signer, of };
}

describe('publishConsidering', () => {
  it('publishes { v: 1, pendingSignature, note } as JSON under the admin’s name', async () => {
    const { signer, of, posts } = await setUp();
    const pending = of(ADDR.nominatedSigning);
    mockQortalRequest('PUBLISH_QDN_RESOURCE', () => ({ type: 'ARBITRARY', signature: 'Q1' }));
    const outcome = await publishConsidering(
      signer,
      { pendingSignature: pending },
      { note: '  Asking in Q-Chat first. ' }
    );
    expect(outcome).toMatchObject({ status: 'sent', signature: 'Q1' });
    const call = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(call).toMatchObject({
      name: 'Avery Admin',
      service: 'JSON',
      identifier: `qmp-considering-${pending.slice(0, 40)}`,
    });
    expect(String(call.identifier).length).toBeLessThanOrEqual(64);
    expect(JSON.parse(atob(String(call.data64)))).toEqual({
      v: 1,
      pendingSignature: pending,
      note: 'Asking in Q-Chat first.',
    });
    expect(getPendingWrite(writeKeys.considering(pending.slice(0, 40)))?.status).toBe('confirming');
    expect(posts).toEqual([]);
  });

  it('leaves the chain reads alone: the decisions queue isn’t read again after it', async () => {
    const { signer, of } = await setUp();
    mockQortalRequest('PUBLISH_QDN_RESOURCE', () => ({ type: 'ARBITRARY', signature: 'Q3' }));
    const outcome = await publishConsidering(signer, { pendingSignature: of(ADDR.kickTarget) });
    expect(outcome.status).toBe('sent');
    const before = fetchCalls.length;
    await loadDecisions();
    expect(fetchCalls.slice(before)).toEqual([]);
  });

  it('a waiting nomination is keyed by the nominee; clearing publishes cleared: true', async () => {
    const { signer } = await setUp();
    mockQortalRequest('PUBLISH_QDN_RESOURCE', () => ({ type: 'ARBITRARY', signature: 'Q2' }));
    await publishConsidering(signer, { nomineeAddress: ADDR.nominatedWaiting });
    await publishConsidering(signer, { nomineeAddress: ADDR.nominatedWaiting }, { cleared: true });
    const [set, clear] = qortalCallsFor('PUBLISH_QDN_RESOURCE');
    expect(set.identifier).toBe(`qmp-considering-${ADDR.nominatedWaiting}`);
    expect(JSON.parse(atob(String(set.data64)))).toEqual({
      v: 1,
      nomineeAddress: ADDR.nominatedWaiting,
    });
    expect(clear.identifier).toBe(set.identifier);
    expect(JSON.parse(atob(String(clear.data64)))).toEqual({
      v: 1,
      nomineeAddress: ADDR.nominatedWaiting,
      cleared: true,
    });
    expect(getPendingWrite(writeKeys.notConsidering(ADDR.nominatedWaiting))?.status).toBe(
      'confirming'
    );
  });

  it('a note over 280 characters stops before Hub', async () => {
    const { signer, of } = await setUp();
    const outcome = await publishConsidering(
      signer,
      { pendingSignature: of(ADDR.nominatedSigning) },
      { note: 'x'.repeat(281) }
    );
    expect(outcome).toMatchObject({ status: 'blocked', reason: expect.stringMatching(/280/) });
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')).toHaveLength(0);
  });
});

describe('guardConsidering', () => {
  it('only current Minter Admins with a name, on something still open', async () => {
    const { signer, of } = await setUp();
    expect(
      await guardConsidering(signer, { pendingSignature: of(ADDR.nominatedSigning) }, false)
    ).toBeNull();
    expect(await guardConsidering(signer, { pendingSignature: of(ADDR.late) }, false)).toBe(
      'Too late: signatures and rejections can no longer count on this one.'
    );
    expect(
      await guardConsidering(signer, { nomineeAddress: ADDR.nominatedWaiting }, false)
    ).toBeNull();
    // bob+builder's nomination already has its invite: it isn't waiting any more.
    expect(await guardConsidering(signer, { nomineeAddress: ADDR.nominatedSigning }, false)).toBe(
      'This nomination isn’t waiting for a first signature any more.'
    );
    // Clearing is always possible.
    expect(await guardConsidering(signer, { pendingSignature: of(ADDR.late) }, true)).toBeNull();
    expect(
      await guardConsidering(
        { ...signer, name: null },
        { nomineeAddress: ADDR.nominatedWaiting },
        false
      )
    ).toMatch(/registered name/);
    const member = (await setUp('nominator')).signer;
    expect(
      await guardConsidering(member, { nomineeAddress: ADDR.nominatedWaiting }, false)
    ).toMatch(/Only Minter Admins/);
  });
});

describe("the admin's own Considering", () => {
  const me = 'QMe';
  const person = { address: me, name: 'Me', note: null, publishedAt: 1 };
  const write = (status: 'sending' | 'confirming' | 'failed', at = Date.now()) => ({ status, at });

  it('shows what QDN says, until a newer publish from this device', () => {
    expect(myConsideringState([], me, { set: null, clear: null })).toEqual({
      considering: false,
      settled: true,
      busy: false,
      sending: null,
    });
    expect(myConsideringState([person], me, { set: null, clear: null }).considering).toBe(true);
    // Published, not on QDN yet.
    expect(myConsideringState([], me, { set: write('confirming'), clear: null })).toEqual({
      considering: true,
      settled: false,
      busy: true,
      sending: null,
    });
    // On QDN now: settled.
    expect(
      myConsideringState([person], me, { set: write('confirming'), clear: null })
    ).toMatchObject({
      considering: true,
      settled: true,
      busy: false,
    });
    // No longer considering, on its way.
    expect(
      myConsideringState([person], me, {
        set: write('confirming', Date.now() - 2_000),
        clear: write('confirming', Date.now() - 1_000),
      })
    ).toMatchObject({ considering: false, settled: false, busy: true });
    // Hub is open.
    expect(myConsideringState([], me, { set: write('sending'), clear: null }).sending).toBe('set');
    // An old or failed write doesn't count.
    expect(
      myConsideringState([], me, {
        set: write('confirming', Date.now() - 16 * 60_000),
        clear: null,
      }).considering
    ).toBe(false);
    expect(myConsideringState([], me, { set: write('failed'), clear: null }).considering).toBe(
      false
    );
  });
});
