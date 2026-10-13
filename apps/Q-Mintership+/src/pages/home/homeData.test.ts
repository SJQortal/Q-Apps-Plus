/** Home's sums over the shared data, checked against the mock MINTER world. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDecisions } from '../../data/decisions';
import { getAddressHistory } from '../../data/txs';
import { loadNominations } from '../../data/nominations';
import { ADDR, TIP, installWorld } from '../../test/world';
import {
  adminSummary,
  approvedInviteHeight,
  countStates,
  isInvolved,
  levelFraction,
  myNominations,
  supportable,
} from './homeData';

afterEach(() => vi.useRealTimers());

describe('adminSummary', () => {
  it('counts the open decisions an admin signed and the ones waiting, most urgent first', async () => {
    const { publicKey } = installWorld('admin');
    const data = await loadDecisions();
    const summary = adminSummary(data, publicKey);
    expect(summary.open).toHaveLength(8);
    expect(summary.signed).toBe(2);
    expect(summary.waiting).toHaveLength(6);
    expect(summary.waiting[0].kind).toBe('addAdmin');
    expect(summary.waiting.every((d) => d.phase === 'open' || d.phase === 'early')).toBe(true);
    expect(summary.unusual).toBe(1);
  });

  it('treats a signature already on its way from this device as signed', async () => {
    const { publicKey } = installWorld('admin');
    const data = await loadDecisions();
    const first = adminSummary(data, publicKey).waiting[0];
    const summary = adminSummary(data, publicKey, (sig) => sig === first.signature);
    expect(summary.signed).toBe(3);
    expect(summary.waiting.map((d) => d.signature)).not.toContain(first.signature);
  });

  it('a rejection is an answer: not waiting for the admin, and not counted as signed', async () => {
    const { world, address, publicKey } = installWorld('admin');
    const kick = world.pending.find((t: { type: string }) => t.type === 'GROUP_KICK');
    world.approvals.push({
      type: 'GROUP_APPROVAL',
      timestamp: kick.timestamp + 60_000,
      signature: 'REJECTION1',
      txGroupId: 0,
      blockHeight: kick.blockHeight + 3,
      approvalStatus: 'NOT_REQUIRED',
      creatorAddress: address,
      adminPublicKey: publicKey,
      pendingSignature: kick.signature,
      approval: false,
    });
    const data = await loadDecisions();
    const summary = adminSummary(data, publicKey);
    expect(summary.waiting.map((d) => d.signature)).not.toContain(kick.signature);
    expect(summary.waiting).toHaveLength(5);
    expect(summary.signed).toBe(2);
    // One on its way from this device counts the same.
    const ban = summary.waiting.find((d) => d.kind === 'ban')!;
    const next = adminSummary(data, publicKey, undefined, (sig) => sig === ban.signature);
    expect(next.waiting.map((d) => d.signature)).not.toContain(ban.signature);
    expect(next.signed).toBe(2);
  });
});

describe('nominations on Home', () => {
  it("lists a nominator's own nominations, open ones first", async () => {
    installWorld('nominator');
    const data = await loadNominations();
    const mine = myNominations(data.all, ADDR.nominator);
    expect(mine.map((n) => n.state)).toEqual([
      'waiting',
      'signing',
      'signing',
      'lapsed',
      'expired',
    ]);
    expect(countStates(mine.slice(0, 3))).toEqual({ waiting: 1, signing: 2 });
  });

  it('counts supporters and on-chain proposers as involved', async () => {
    installWorld('admin');
    const data = await loadNominations();
    const wren = data.all.find((n) => n.nominee === ADDR.nominatedWaiting);
    const early = data.all.find((n) => n.nominee === ADDR.early);
    expect(wren && isInvolved(wren, ADDR.adminL4)).toBe(true);
    expect(early && isInvolved(early, ADDR.admin)).toBe(true);
    expect(wren && isInvolved(wren, ADDR.admin)).toBe(false);
  });

  it('offers only nominations a signature can still help, never your own', async () => {
    installWorld('admin');
    const data = await loadNominations();
    const offered = supportable(data.open, ADDR.admin).map((n) => n.nominee);
    expect(offered).toContain(ADDR.nominatedWaiting);
    expect(offered).toContain(ADDR.nominatedSigning);
    expect(offered).not.toContain(ADDR.early); // Avery proposed it
    expect(offered).not.toContain(ADDR.met); // enough signatures already
    expect(offered).not.toContain(ADDR.late); // too late to count
    expect(supportable(data.open, ADDR.nominatedWaiting).map((n) => n.nominee)).not.toContain(
      ADDR.nominatedWaiting
    );
  });
});

describe('approvedInviteHeight', () => {
  it("finds the block an account's invite was approved in", async () => {
    installWorld('approved');
    const history = await getAddressHistory(ADDR.approved);
    expect(approvedInviteHeight(history.rows, ADDR.approved)).toBe(TIP - 8_100);
    expect(approvedInviteHeight(history.rows, ADDR.newcomer)).toBeNull();
  });
});

describe('levelFraction', () => {
  it('measures progress through the current level by blocks minted', () => {
    expect(levelFraction(0, 3_600)).toBeCloseTo(0.5);
    expect(levelFraction(6, 980_000)).toBeCloseTo((980_000 - 964_000) / (1_482_400 - 964_000));
    expect(levelFraction(4, 300_000)).toBe(0); // below the level's own start: never negative
    expect(levelFraction(10, 5_000_000)).toBe(1);
  });
});
