/**
 * Without a join request: the approved invite is stored and the nominee's
 * status becomes "approved" (Join now); JOIN_GROUP then makes them a member
 * at once and uses the invite up.
 */
import { decided, isMember, pages, sign } from '../lib/scenario-helpers.mjs';

const myStatus = (page, address) =>
  page.evaluate(async (a) => {
    const { loadMyStatus } = await import('/src/data/me.ts');
    window.__qmpTestnet.query.invalidate('status:');
    return (await loadMyStatus(a, { force: true })).kind;
  }, address);

export default {
  name: 'join-now',
  title: 'Approved without a join request, then Join now: a member at once',
  group: 'main',
  async run(ctx) {
    const groupId = ctx.group('main').groupId;
    const page = pages(ctx, 'main');
    const [label] = await ctx.fresh('jn-', 1, '2');
    const nominee = ctx.account(label);
    ctx.record('nominee', nominee.address);

    const first = await (await page('admin05')).flow('firstSignature', nominee.address);
    ctx.expect(first.invite.status === 'sent' && first.approval?.status === 'sent', 'invite and first signature sent', first);
    const invite = await ctx.waitForConfirmed(first.inviteSignature);
    ctx.record('inviteHeight', invite.blockHeight);
    for (const l of ['admin06', 'admin07', 'admin08']) await sign(ctx, page, l, first.inviteSignature);
    const tx = await decided(ctx, first.inviteSignature);
    ctx.record('approved', [tx.approvalStatus, tx.approvalHeight]);
    ctx.expect(tx.approvalStatus === 'APPROVED', 'Core approves the invite');
    ctx.expect(!(await isMember(ctx, groupId, nominee.address)), 'with no join request, not a member yet');
    const stored = (await ctx.get(`/groups/invites/${nominee.address}`)).some((i) => i.groupId === groupId);
    ctx.expect(stored, 'the approved invite is stored');

    const me = await page(label);
    const before = await myStatus(me.page, nominee.address);
    ctx.record('statusBeforeJoin', before);
    ctx.expect(before === 'approvedInvite', 'the app says: approved, Join now', before);
    const join = await me.flow('joinMinter');
    ctx.expect(join.status === 'sent', 'Join now sends JOIN_GROUP', join);
    const joinTx = await ctx.waitForConfirmed(join.signature);
    ctx.record('joinHeight', joinTx.blockHeight);
    ctx.expect(await isMember(ctx, groupId, nominee.address), 'a member as soon as the join is in a block');
    const after = await myStatus(me.page, nominee.address);
    ctx.record('statusAfterJoin', after);
    ctx.expect(after === 'member', 'the app now says member', after);
    const again = await me.flow('joinMinter');
    ctx.record('joinAgain', again);
    ctx.expect(again.status === 'blocked', 'joining again is refused before Hub');
  },
};
