/**
 * Hub's behaviours: a decline sends nothing; the generic decode error sends
 * nothing; a 30-second timeout with a late Accept is found by the lookup and
 * never sent twice.
 */
import { pages, sign } from '../lib/scenario-helpers.mjs';

async function approvalsBy(ctx, publicKey, pendingSignature, fromHeight) {
  const unconfirmed = await ctx.get(`/transactions/unconfirmed?txType=GROUP_APPROVAL&creator=${publicKey}&limit=50`).catch(() => []);
  const confirmed = await ctx.get(
    `/transactions/search?txType=GROUP_APPROVAL&address=${encodeURIComponent(ctx.account('admin03').address)}&confirmationStatus=CONFIRMED&startBlock=${fromHeight}&blockLimit=200&limit=50`
  ).catch(() => []);
  return [...unconfirmed, ...confirmed].filter((t) => t.pendingSignature === pendingSignature);
}

export default {
  name: 'hub-behaviours',
  title: 'Decline, decode error, and a 30 s timeout with a late accept (found, no duplicate)',
  group: 'main',
  async run(ctx) {
    const page = pages(ctx, 'main');
    const [label] = await ctx.fresh('hb-', 1, '1');
    const first = await (await page('admin06')).flow('firstSignature', ctx.account(label).address);
    ctx.expect(first.invite.status === 'sent', 'a decision to sign', first);
    const sig = first.inviteSignature;
    const start = await ctx.height();
    const admin = ctx.account('admin03');
    const signer = await page('admin03');

    await ctx.behaviour('admin03', 'decline', { action: 'SIGN_TRANSACTION' });
    const declined = await signer.flow('signDecision', sig);
    ctx.record('decline', declined);
    ctx.expect(declined.status === 'declined', 'a decline is a cancel, not an error');
    ctx.expect((await approvalsBy(ctx, admin.publicKey, sig, start)).length === 0, 'after a decline nothing was sent');

    await ctx.behaviour('admin03', 'decodeError', { action: 'SIGN_TRANSACTION' });
    const decode = await signer.flow('signDecision', sig);
    ctx.record('decodeError', decode);
    ctx.expect(decode.status === 'failed', "Hub's generic decode error is reported", decode);
    ctx.expect((await approvalsBy(ctx, admin.publicKey, sig, start)).length === 0, 'after the decode error nothing was sent');

    await ctx.behaviour('admin03', 'timeout', { action: 'SIGN_TRANSACTION', lateMs: 40_000 });
    const t0 = Date.now();
    const timedOut = await signer.flow('signDecision', sig);
    ctx.record('timeout', { status: timedOut.status, recovered: timedOut.recovered, seconds: Math.round((Date.now() - t0) / 1000) });
    ctx.expect(timedOut.status === 'sent' && timedOut.recovered === true, 'after the timeout the lookup finds the late transaction');
    const twice = await signer.flow('signDecision', sig);
    ctx.record('afterTimeout', twice);
    ctx.expect(twice.status === 'blocked', 'signing again is refused (already on its way)');
    await ctx.sleep(5_000);
    const rows = await approvalsBy(ctx, admin.publicKey, sig, start);
    ctx.record('approvalsFromAdmin03', rows.length);
    ctx.expect(rows.length === 1, 'exactly one signature: no duplicate');

    // A two-step proposal declined at step 2: the proposal waits, unsigned by its proposer.
    await ctx.behaviour('admin07', 'decline', { action: 'SIGN_TRANSACTION' });
    const [kickLabel] = await ctx.fresh('hb-k-', 1, '1');
    const join = await (await page(kickLabel)).flow('joinMinter');
    ctx.expect(join.status === 'sent', 'a join request to decline later', join);
    await ctx.waitForConfirmed(join.signature);
    const half = await (await page('admin07')).flow('proposeAndSign', {
      kind: 'kick',
      subject: ctx.account(kickLabel).address,
      reason: 'Testnet: decline the second step.',
    });
    ctx.record('declinedStep2', { proposal: half.proposal.status, approval: half.approval?.status });
    ctx.expect(half.proposal.status === 'sent' && half.approval?.status === 'declined', 'step 1 sent, step 2 declined');
    await sign(ctx, page, 'admin08', half.proposalSignature);
  },
};
