import { afterEach, describe, expect, it, vi } from 'vitest';
import { base58Encode } from '../qortal/base58';
import { addConsidering, fakeAddress } from '../../e2e/world.mjs';
import { ADDR, installWorld } from '../test/world';
import { fetchCallsFor } from '../test/setup';
import {
  CONSIDERING_PREFIX,
  IDENTIFIER_MAX,
  buildConsidering,
  consideringIdentifier,
  consideringKey,
  consideringKeyOf,
  parseConsidering,
} from './records';
import { consideringCountText, consideringFor, type ConsideringEntry } from '../rules/considering';
import { answersFromTally, loadConsidering } from './considering';
import { tallyApprovals } from '../rules/tally';
import { loadDecisions } from './decisions';

afterEach(() => vi.useRealTimers());

const SIG = base58Encode(new Uint8Array(64).fill(9));
const OTHER_SIG = base58Encode(new Uint8Array(64).fill(10));
const NOMINEE = 'QNomiUy6sUiEnaN87dWmE92g1uQjrvPgrW';

describe('Considering records (qmp-considering-<key>)', () => {
  it('keys a decision by the first 40 characters of its signature, a waiting nomination by the address', () => {
    expect(consideringKey({ pendingSignature: SIG })).toBe(SIG.slice(0, 40));
    expect(consideringKey({ nomineeAddress: NOMINEE })).toBe(NOMINEE);
    const forDecision = consideringIdentifier({ pendingSignature: SIG });
    expect(forDecision).toBe(`${CONSIDERING_PREFIX}${SIG.slice(0, 40)}`);
    expect(forDecision.length).toBeLessThanOrEqual(IDENTIFIER_MAX);
    expect(forDecision).toHaveLength(56);
    expect(consideringIdentifier({ nomineeAddress: NOMINEE })).toHaveLength(50);
    expect(() => consideringKey({ pendingSignature: 'not-a-signature' })).toThrow();
    expect(() => consideringKey({ nomineeAddress: 'Qshort' })).toThrow();
  });

  it('reads the key back only from identifiers this app writes', () => {
    expect(consideringKeyOf(consideringIdentifier({ pendingSignature: SIG }))).toBe(
      SIG.slice(0, 40)
    );
    expect(consideringKeyOf(`${CONSIDERING_PREFIX}${NOMINEE}`)).toBe(NOMINEE);
    expect(consideringKeyOf(`${CONSIDERING_PREFIX}${SIG.slice(0, 39)}`)).toBeNull();
    expect(consideringKeyOf(`${CONSIDERING_PREFIX}${SIG.slice(0, 40)}0`)).toBeNull();
    expect(consideringKeyOf(`qmp-support-${NOMINEE}`)).toBeNull();
  });

  it('builds { v: 1, pendingSignature | nomineeAddress, note?, cleared? }', () => {
    expect(buildConsidering({ pendingSignature: SIG })).toEqual({ v: 1, pendingSignature: SIG });
    expect(
      buildConsidering({ nomineeAddress: NOMINEE }, { note: '  Asking them first.  ' })
    ).toEqual({ v: 1, nomineeAddress: NOMINEE, note: 'Asking them first.' });
    // Cleared drops the note: "no longer considering" says nothing else.
    expect(buildConsidering({ pendingSignature: SIG }, { note: 'x', cleared: true })).toEqual({
      v: 1,
      pendingSignature: SIG,
      cleared: true,
    });
    expect(() => buildConsidering({ pendingSignature: SIG }, { note: 'x'.repeat(281) })).toThrow(
      /280/
    );
    expect(
      buildConsidering({ pendingSignature: SIG }, { note: 'x'.repeat(280) }).note
    ).toHaveLength(280);
  });

  it('parses what it builds, and refuses a body that does not match its identifier', () => {
    const decisionId = consideringIdentifier({ pendingSignature: SIG });
    const waitingId = consideringIdentifier({ nomineeAddress: NOMINEE });
    const built = buildConsidering({ pendingSignature: SIG }, { note: 'Soon.' });
    expect(parseConsidering(built, decisionId)).toEqual(built);
    expect(parseConsidering({ v: 1, nomineeAddress: NOMINEE }, waitingId)).toEqual({
      v: 1,
      nomineeAddress: NOMINEE,
    });
    // Another transaction's signature under this key; another nominee; no target.
    expect(parseConsidering({ v: 1, pendingSignature: OTHER_SIG }, decisionId)).toBeNull();
    expect(parseConsidering({ v: 1, nomineeAddress: ADDR.admin }, waitingId)).toBeNull();
    expect(parseConsidering({ v: 1 }, waitingId)).toBeNull();
    expect(parseConsidering({ v: 2, nomineeAddress: NOMINEE }, waitingId)).toBeNull();
    expect(parseConsidering(null, waitingId)).toBeNull();
    expect(
      parseConsidering({ v: 1, nomineeAddress: NOMINEE }, `qmp-support-${NOMINEE}`)
    ).toBeNull();
    // A decision's record may name the nominee as a hint.
    expect(
      parseConsidering({ v: 1, pendingSignature: SIG, nomineeAddress: NOMINEE }, decisionId)
    ).toEqual({ v: 1, pendingSignature: SIG, nomineeAddress: NOMINEE });
  });

  it('keeps cleared, drops a note that is too long, and ignores unknown fields', () => {
    const waitingId = consideringIdentifier({ nomineeAddress: NOMINEE });
    expect(
      parseConsidering({ v: 1, nomineeAddress: NOMINEE, cleared: true, note: 'x' }, waitingId)
    ).toEqual({ v: 1, nomineeAddress: NOMINEE, cleared: true });
    expect(
      parseConsidering({ v: 1, nomineeAddress: NOMINEE, note: 'x'.repeat(281) }, waitingId)
    ).toEqual({ v: 1, nomineeAddress: NOMINEE });
    expect(
      parseConsidering({ v: 1, nomineeAddress: NOMINEE, cleared: 'yes', extra: 1 }, waitingId)
    ).toEqual({ v: 1, nomineeAddress: NOMINEE });
  });
});

const A = { name: 'Admin A', address: 'QA' };
const B = { name: 'Admin B', address: 'QB' };
const entry = (
  publisher: { name: string; address: string },
  record: ConsideringEntry['record'],
  publishedAt: number
): ConsideringEntry => ({ publisher, record, publishedAt });

describe('who is considering', () => {
  it("each admin's latest publish counts, and cleared means no longer", () => {
    const entries = [
      entry(A, { v: 1, pendingSignature: SIG, note: 'first' }, 10),
      entry(A, { v: 1, pendingSignature: SIG, note: 'second' }, 20),
      entry(B, { v: 1, pendingSignature: SIG }, 15),
      entry(B, { v: 1, pendingSignature: SIG, cleared: true }, 25),
    ];
    expect(consideringFor(entries, { pendingSignature: SIG })).toEqual([
      { address: 'QA', name: 'Admin A', note: 'second', publishedAt: 20 },
    ]);
    // Considering again after clearing.
    const again = [...entries, entry(B, { v: 1, pendingSignature: SIG }, 30)];
    expect(consideringFor(again, { pendingSignature: SIG }).map((p) => p.name)).toEqual([
      'Admin A',
      'Admin B',
    ]);
  });

  it('a later Sign, Reject or Withdraw on chain by the same admin replaces it', () => {
    const entries = [
      entry(A, { v: 1, pendingSignature: SIG }, 100),
      entry(B, { v: 1, pendingSignature: SIG }, 100),
    ];
    const answers = [
      { address: 'QA', timestamp: 150 }, // answered after: gone
      { address: 'QB', timestamp: 50 }, // answered before considering: stays
    ];
    expect(consideringFor(entries, { pendingSignature: SIG }, answers).map((p) => p.name)).toEqual([
      'Admin B',
    ]);
  });

  it('after a rejection: a record from before it stays hidden, one from after shows until the next answer', () => {
    const answer = (approval: boolean, timestamp: number, seed: number) => ({
      signature: `answer-${seed}`,
      pendingSignature: SIG,
      adminPublicKey: 'pk-A',
      creatorAddress: 'QA',
      approval,
      timestamp,
      blockHeight: seed,
    });
    const tally = (rows: ReturnType<typeof answer>[]) =>
      tallyApprovals({ pendingSignature: SIG, rows, threshold: 'PCT40', totalAdmins: 20 });
    const before = entry(A, { v: 1, pendingSignature: SIG, note: 'before' }, 50);
    const after = entry(A, { v: 1, pendingSignature: SIG, note: 'again' }, 150);
    const rejected = tally([answer(false, 100, 1)]);
    // Considering, then a rejection: the rejection replaces it.
    expect(consideringFor([before], { pendingSignature: SIG }, answersFromTally(rejected))).toEqual(
      []
    );
    // Considering again after the rejection: it shows.
    expect(
      consideringFor([before, after], { pendingSignature: SIG }, answersFromTally(rejected))
    ).toEqual([{ address: 'QA', name: 'Admin A', note: 'again', publishedAt: 150 }]);
    // Then a signature: it is gone again.
    const signed = tally([answer(false, 100, 1), answer(true, 200, 2)]);
    expect(
      consideringFor([before, after], { pendingSignature: SIG }, answersFromTally(signed))
    ).toEqual([]);
  });

  it('matches its own target only', () => {
    const entries = [
      entry(A, { v: 1, pendingSignature: OTHER_SIG }, 10),
      entry(B, { v: 1, nomineeAddress: NOMINEE }, 10),
    ];
    expect(consideringFor(entries, { pendingSignature: SIG })).toEqual([]);
    expect(consideringFor(entries, { nomineeAddress: NOMINEE }).map((p) => p.name)).toEqual([
      'Admin B',
    ]);
    expect(consideringFor(entries, {})).toEqual([]);
  });

  it("carries a nomination's record over to its invite, from this round only", () => {
    const entries = [
      entry(A, { v: 1, nomineeAddress: NOMINEE }, 500), // this round
      entry(B, { v: 1, nomineeAddress: NOMINEE }, 100), // an earlier round
    ];
    const target = { pendingSignature: SIG, nomineeAddress: NOMINEE, since: 400 };
    expect(consideringFor(entries, target).map((p) => p.name)).toEqual(['Admin A']);
    // Cleared on the decision afterwards: the newest publish wins.
    const cleared = [...entries, entry(A, { v: 1, pendingSignature: SIG, cleared: true }, 600)];
    expect(consideringFor(cleared, target)).toEqual([]);
  });

  it('says how many', () => {
    expect(consideringCountText(1)).toBe('1 Minter Admin is considering');
    expect(consideringCountText(3)).toBe('3 Minter Admins are considering');
  });
});

describe('loadConsidering', () => {
  it('reads one bounded prefix search, newest first, and keeps current Minter Admins only', async () => {
    const { world } = installWorld('learner');
    const keys = addConsidering(world);
    const data = await loadConsidering();
    const searches = fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
      p.includes('qmp-considering-')
    );
    expect(searches).toHaveLength(1);
    expect(searches[0]).toMatch(/limit=100/);
    expect(searches[0]).toMatch(/reverse=true/);
    expect(searches[0]).toMatch(/prefix=true/);
    expect(searches[0]).not.toMatch(/limit=0\b/);
    const by = (name: string) => data.entries.filter((e) => e.publisher.name === name);
    // Not an admin, long ago, body and key disagree: all left out.
    expect(by('Nora Nominator')).toEqual([]);
    expect(by('Admin O')).toEqual([]);
    expect(by('Admin P')).toEqual([]);
    expect(data.entries.map((e) => e.publisher.name).sort()).toEqual([
      'Admin B',
      'Admin K',
      'Admin L',
      'Admin M',
      'Admin N',
    ]);
    // Bodies are read only for those candidates.
    expect(fetchCallsFor(/^\/arbitrary\/JSON\//).length).toBeLessThanOrEqual(7);

    const decisions = await loadDecisions();
    const invite = decisions.decisions.find((d) => d.signature === keys.inviteSignature)!;
    const people = consideringFor(
      data.entries,
      { pendingSignature: invite.signature, nomineeAddress: ADDR.nominatedSigning },
      answersFromTally(invite.tally)
    );
    expect(people.map((p) => [p.name, p.note])).toEqual([
      ['Admin K', 'Waiting to hear back from them in Q-Chat about their node.'],
      ['Admin L', null],
    ]);
    const waiting = consideringFor(data.entries, { nomineeAddress: ADDR.nominatedWaiting });
    expect(waiting.map((p) => p.name)).toEqual(['Admin M']);
  });

  it('drops a record once its publisher is no longer a Minter Admin', async () => {
    const { world } = installWorld('learner');
    addConsidering(world);
    world.admins = world.admins.filter((a: string) => a !== fakeAddress('admin-10'));
    const data = await loadConsidering();
    expect(data.entries.some((e) => e.publisher.name === 'Admin K')).toBe(false);
  });

  it('reads nothing more when there are no records', async () => {
    installWorld('learner');
    const data = await loadConsidering();
    expect(data.entries).toEqual([]);
    expect(fetchCallsFor(/^\/arbitrary\/JSON\/[^/]+\/qmp-considering-/)).toEqual([]);
  });
});
