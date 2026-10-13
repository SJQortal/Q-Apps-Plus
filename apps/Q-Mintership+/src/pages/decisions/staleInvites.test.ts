import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDecisions } from '../../data/decisions';
import {
  findApprovedInvite,
  loadStaleInviteDetails,
  loadStaleInvites,
} from '../../data/staleInvites';
import type { TxRow } from '../../data/types';
import { ADDR, NOW, installWorld } from '../../test/world';
import { mockQortalRequest, qortalCallsFor } from '../../test/setup';
import {
  cancelAll,
  cancelAllSummary,
  isRecentInvite,
  ownSignatureItem,
  waitingCancelInvitees,
} from './staleRules';
import { guardCancelInvite } from '../../writes/guards';
import { base58Decode, base58Encode } from '../../qortal/base58';
import type { Signer } from '../../writes/runner';
import { fakeAddress, fakeKey, type World } from '../../../e2e/world.mjs';

afterEach(() => vi.useRealTimers());

/** A cancellation Hub just sent: on the node at once, unconfirmed (Core's JSON leaves out its target). */
function cancelTx(world: World, admin: Signer, signature: string) {
  return {
    type: 'CANCEL_GROUP_INVITE',
    timestamp: Date.now(),
    reference: world.pending[0].reference,
    fee: '0.01000000',
    signature,
    txGroupId: 694,
    approvalStatus: 'PENDING',
    creatorAddress: admin.address,
    adminPublicKey: admin.publicKey,
  };
}

describe('stale invites', () => {
  it('lists stored invites of people who are not members', async () => {
    installWorld('admin');
    const list = await loadStaleInvites();
    expect(list.rows.map((r) => r.invitee)).toContain(ADDR.approved);
    expect(list.rows).toHaveLength(4);
    expect(list.alreadyMembers).toBe(1);
    // The member's own stored invite comes apart, for Propose.
    expect(list.memberRows.map((r) => r.invitee)).toEqual([fakeAddress('member-5')]);
  });

  it('finds when each was approved, from the invitee history', async () => {
    installWorld('admin');
    const list = await loadStaleInvites();
    const details = await loadStaleInviteDetails(list.rows);
    const ada = details.find((d) => d.invitee === ADDR.approved);
    expect(ada?.approvedHeight).toBeGreaterThan(0);
    expect(ada?.approvedAt).toBeLessThan(NOW);
    expect(isRecentInvite(ada, NOW)).toBe(true);
    const unknown = details.find((d) => d.invitee !== ADDR.approved);
    expect(unknown?.approvedAt).toBeNull();
    expect(isRecentInvite(unknown, NOW)).toBe(false);
  });

  it('picks the newest approved invite by the stored inviter', () => {
    const row = { groupId: 694, inviter: 'QA', invitee: 'QX' };
    const tx = (extra: Partial<TxRow>): TxRow => ({
      type: 'GROUP_INVITE',
      timestamp: 1,
      signature: 's',
      txGroupId: 694,
      groupId: 694,
      invitee: 'QX',
      ...extra,
    });
    const history = [
      tx({ signature: 'old', timestamp: 1, creatorAddress: 'QA', approvalStatus: 'APPROVED' }),
      tx({ signature: 'new', timestamp: 3, creatorAddress: 'QA', approvalStatus: 'APPROVED' }),
      tx({ signature: 'other', timestamp: 4, creatorAddress: 'QB', approvalStatus: 'APPROVED' }),
      tx({ signature: 'expired', timestamp: 5, creatorAddress: 'QA', approvalStatus: 'EXPIRED' }),
    ];
    expect(findApprovedInvite(history, row)?.signature).toBe('new');
    expect(findApprovedInvite([], row)).toBeNull();
  });

  it('knows whose invite already has a cancellation waiting, and refuses a second one', async () => {
    const { address, publicKey } = installWorld('admin');
    const data = await loadDecisions();
    expect([...waitingCancelInvitees(data.decisions)]).toEqual([fakeAddress('stale-1')]);
    const admin = { address, publicKey };
    expect(await guardCancelInvite(admin, fakeAddress('stale-1'))).toBe(
      'Cancelling this invite is already waiting for signatures.'
    );
    expect(await guardCancelInvite(admin, fakeAddress('stale-2'))).toBeNull();
  });

  it('"Propose cancelling all" goes one by one and stops at a cancel in Hub', async () => {
    const { address, publicKey } = installWorld('admin');
    const list = await loadStaleInvites();
    let n = 0;
    mockQortalRequest('CANCEL_GROUP_INVITE', () => {
      n++;
      if (n === 2) throw { error: 'User declined request', message: 'User declined request' };
      return { type: 'CANCEL_GROUP_INVITE', signature: `C${n}` };
    });
    const seen: string[] = [];
    const outcomes = await cancelAll({ address, publicKey }, list.rows, (i, o) => {
      if (o) seen.push(`${i}:${o.status}`);
    });
    // The node never shows the first one, so no signature follows it; the run goes on.
    expect(outcomes[0]).toMatchObject({
      status: 'sent',
      partial:
        'Proposed ✓. Your signature didn’t go through: Your node doesn’t show it yet. Sign it in the queue once it’s in a block.',
    });
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(0);
    // The second row's cancellation is already waiting: stopped before Hub.
    expect(list.rows[1].invitee).toBe(fakeAddress('stale-1'));
    expect(outcomes.map((o) => o.status)).toEqual(['sent', 'blocked', 'declined']);
    expect(seen).toEqual(['0:sent', '1:blocked', '2:declined']);
    expect(qortalCallsFor('CANCEL_GROUP_INVITE')).toHaveLength(2);
    expect(qortalCallsFor('CANCEL_GROUP_INVITE')[0]).toMatchObject({
      groupId: 694,
      txGroupId: 694,
      qortalAddress: list.rows[0].invitee,
    });
  });

  it('"Propose cancelling all" signs each cancellation straight after proposing it', async () => {
    const { world, address, publicKey } = installWorld('admin');
    const admin = { address, publicKey };
    const rows = (await loadStaleInvites()).rows.filter((r) =>
      [fakeAddress('stale-2'), fakeAddress('stale-3')].includes(r.invitee)
    );
    const sent: string[] = [];
    mockQortalRequest('CANCEL_GROUP_INVITE', (req: Record<string, unknown>) => {
      const signature = fakeKey(`cancel-${sent.length}`, 64);
      sent.push(signature);
      world.pending.push(cancelTx(world, admin, signature));
      world.cancelTargets.set(signature, { groupId: 694, invitee: req.qortalAddress });
      return { type: 'CANCEL_GROUP_INVITE', signature };
    });
    let signed = 0;
    mockQortalRequest('SIGN_TRANSACTION', () => {
      signed++;
      if (signed === 2) throw { error: 'User declined request', message: 'User declined request' };
      return { type: 'GROUP_APPROVAL', signature: `OWN${signed}` };
    });
    const progress: string[] = [];
    const outcomes = await cancelAll(admin, rows, (i, o, p) => {
      if (o) progress.push(`${i}:${o.status}`);
      else if (p && typeof p !== 'string' && p.stage === 'waitingForHub')
        progress.push(`${i}:step${(p.step ?? 0) + 1}${p.signature ? `:${p.signature}` : ''}`);
    });
    // Step 2 of each item says which transaction it signs.
    expect(progress).toEqual([
      '0:step1',
      `0:step2:${sent[0]}`,
      '0:sent',
      '1:step1',
      `1:step2:${sent[1]}`,
      '1:sent',
    ]);
    expect(outcomes[0]).toEqual({
      status: 'sent',
      tx: { type: 'CANCEL_GROUP_INVITE', signature: sent[0] },
      signature: sent[0],
      recovered: false,
    });
    // The second signature was cancelled in Hub: proposed, not signed, and the run stops.
    expect(outcomes[1]).toMatchObject({
      status: 'sent',
      signature: sent[1],
      stopped: true,
      partial: expect.stringMatching(/You cancelled your signature in Hub/),
    });
    // Each signature is on exactly the cancellation just proposed.
    const signedSigs = qortalCallsFor('SIGN_TRANSACTION').map((c) =>
      base58Encode(base58Decode(String(c.unsignedBytes)).slice(112, 176))
    );
    expect(signedSigs).toEqual(sent);
  });

  it('"Propose cancelling all" checks every fee first, and stops before Hub when they can’t all be paid', async () => {
    const { world, address, publicKey } = installWorld('admin');
    const rows = (await loadStaleInvites()).rows.filter((r) =>
      [fakeAddress('stale-2'), fakeAddress('stale-3')].includes(r.invitee)
    );
    world.accounts.get(address).balance = 0.03;
    const reports: string[] = [];
    const outcomes = await cancelAll({ address, publicKey }, rows, (i, o) => {
      if (o) reports.push(`${i}:${o.status}`);
    });
    expect(outcomes).toEqual([
      {
        status: 'blocked',
        reason:
          'All 2 with your signatures need 0.04 QORT in fees, and your confirmed balance is 0.03 QORT. Propose them one at a time instead.',
        stopped: true,
      },
    ]);
    expect(reports).toEqual(['0:blocked']);
    expect(qortalCallsFor('CANCEL_GROUP_INVITE')).toHaveLength(0);
  });

  it('words each item and the summary of a run with signatures', () => {
    const sent = { status: 'sent' as const, tx: null, signature: 'P', recovered: false };
    expect(
      ownSignatureItem({
        proposal: { status: 'declined' },
        approval: null,
        proposalSignature: null,
      })
    ).toEqual({ status: 'declined' });
    expect(
      ownSignatureItem({
        proposal: sent,
        approval: { ...sent, signature: 'A', recovered: true },
        proposalSignature: 'P',
      })
    ).toEqual({ ...sent, recovered: true });
    expect(
      ownSignatureItem({
        proposal: sent,
        approval: { status: 'blocked', reason: 'Your node doesn’t show it yet.' },
        proposalSignature: 'P',
      })
    ).toEqual({
      ...sent,
      partial:
        'Proposed ✓. Your signature didn’t go through: Your node doesn’t show it yet. Sign it in the queue once it’s in a block.',
    });
    expect(cancelAllSummary({ total: 3, sent: 3, partial: 0, stopped: false })).toBe(
      '3 of 3 proposed and signed. Each counts once it is in a block.'
    );
    expect(cancelAllSummary({ total: 4, sent: 1, partial: 1, stopped: true })).toBe(
      '1 of 4 proposed and signed. 1 more was proposed without your signature: sign it in the queue once it’s in a block. You cancelled one in Hub, so the rest were not sent. Each counts once it is in a block.'
    );
    expect(cancelAllSummary({ total: 2, sent: 0, partial: 2, stopped: false })).toBe(
      '0 of 2 proposed and signed. 2 more were proposed without your signature: sign them in the queue once they’re in a block.'
    );
  });

  it('after a Hub timeout, never takes the previous cancellation for this one', async () => {
    const { world, address, publicKey } = installWorld('admin');
    const rows = (await loadStaleInvites()).rows.filter((r) =>
      [fakeAddress('stale-2'), fakeAddress('stale-3')].includes(r.invitee)
    );
    const first = fakeKey('first-cancel', 64);
    let n = 0;
    mockQortalRequest('CANCEL_GROUP_INVITE', () => {
      n++;
      if (n === 1) {
        // The first proposal reaches the mempool (no block yet).
        world.pending.push({
          type: 'CANCEL_GROUP_INVITE',
          timestamp: Date.now(),
          reference: world.pending[0].reference,
          fee: '0.01000000',
          signature: first,
          txGroupId: 694,
          approvalStatus: 'PENDING',
          creatorAddress: address,
          adminPublicKey: publicKey,
        });
        world.cancelTargets.set(first, { groupId: 694, invitee: rows[0].invitee });
        return { type: 'CANCEL_GROUP_INVITE', signature: first };
      }
      throw { error: 'timeout', message: 'Request timed out after 30000 ms' };
    });
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'OWN' }));
    const outcomes = await cancelAll({ address, publicKey }, rows, () => {});
    expect(outcomes[0]).toMatchObject({ status: 'sent', signature: first });
    // The second one timed out and never showed up: not "sent" with the first one's transaction.
    expect(outcomes[1].status).toBe('unknown');
  });
});
