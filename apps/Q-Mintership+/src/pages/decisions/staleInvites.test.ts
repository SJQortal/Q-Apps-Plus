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
import { cancelAll, isRecentInvite, waitingCancelInvitees } from './staleRules';
import { guardCancelInvite } from '../../writes/guards';
import { fakeAddress } from '../../../e2e/world.mjs';

afterEach(() => vi.useRealTimers());

describe('stale invites', () => {
  it('lists stored invites of people who are not members', async () => {
    installWorld('admin');
    const list = await loadStaleInvites();
    expect(list.rows.map((r) => r.invitee)).toContain(ADDR.approved);
    expect(list.rows).toHaveLength(4);
    expect(list.alreadyMembers).toBe(1);
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
});
