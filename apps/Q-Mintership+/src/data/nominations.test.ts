import { describe, expect, it } from 'vitest';
import { ADDR, MS_PER_BLOCK, NOW, TIP, installWorld } from '../test/world';
import { loadNominations } from './nominations';

const DAY = 86_400_000;
const DAY_BLOCKS = Math.round(DAY / MS_PER_BLOCK);

describe('the nominations read: rounds an older invite decided', () => {
  // Simon, 2026-11-17: QQQ Test's October round, rejected two days later, read as lapsed:
  // its invite was older than the last two waiting windows, the only invites the read took.
  it('reads invites back to its oldest record, so a round an old invite decided is decided', async () => {
    const { world } = installWorld('learner');
    const nominee = ADDR.lapsed;
    // The lapsed person's record moves 40 days back, and an invite answered it a day later.
    const record = world.records.find(
      (r: { identifier: string }) => r.identifier === `qmp-nomination-${nominee}`
    );
    if (!record) throw new Error('no record');
    record.created = NOW - 40 * DAY;
    (record.body as { created: number }).created = NOW - 40 * DAY;
    const h = TIP - 39 * DAY_BLOCKS;
    world.decided.push({
      type: 'GROUP_INVITE',
      timestamp: NOW - 39 * DAY,
      reference: 'old-invite-reference',
      fee: '0.01000000',
      signature: 'oldInviteSignatureForTheLapsedPersonRejectedLongAgo1111111111111111111111',
      txGroupId: 694,
      blockHeight: h,
      approvalStatus: 'REJECTED',
      approvalHeight: h + 2 * DAY_BLOCKS,
      creatorAddress: ADDR.admin,
      adminPublicKey: world.accounts.get(ADDR.admin)?.publicKey,
      groupId: 694,
      invitee: nominee,
      timeToLive: 864_000,
    });
    const data = await loadNominations();
    const n = data.all.find((x) => x.nominee === nominee);
    expect(n?.state).toBe('rejected');
    expect(n?.latestInvite?.approvalStatus).toBe('REJECTED');
  });
});
