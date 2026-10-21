/**
 * Bulk sign: one admin signs 26 decisions in a row, each its own Hub step.
 * Core takes at most 25 unconfirmed transactions per account, so the app
 * stops the 26th before Hub is asked (unless a block confirmed some
 * meanwhile, which the scenario records).
 */
import { makeGroup, freshAccounts } from '../lib/world.mjs';
import { pages } from '../lib/scenario-helpers.mjs';

export default {
  name: 'bulk',
  title: "Bulk sign 26 decisions: Core's 25-unconfirmed limit is caught before Hub",
  group: 'bulk',
  async run(ctx) {
    const g = await makeGroup('bulk', { owner: 'low06', admins: ['low06', 'nom13', 'nom14', 'nom15'], members: [] });
    const groupId = g.groupId;
    ctx.record('groupId', groupId);
    const invitees = freshAccounts('bk-', 26).map((l) => ctx.account(l).address);
    const sigs = [];
    for (const [i, address] of invitees.entries()) {
      const by = i % 2 ? 'nom15' : 'nom14';
      const res = await ctx.hub(by, { action: 'INVITE_TO_GROUP', groupId, inviteeAddress: address, inviteTime: 864000, txGroupId: groupId });
      sigs.push(res.signature);
    }
    for (const s of sigs) await ctx.waitForConfirmed(s);
    ctx.record('decisions', sigs.length);

    const page = pages(ctx, 'bulk');
    const signer = await page('nom13');
    const before = await ctx.height();
    const pending = await ctx.get(`/transactions/unconfirmed?creator=${ctx.account('nom13').publicKey}&limit=50`);
    ctx.record('unconfirmedBefore', pending.length);
    const outcomes = await signer.evaluate(async (list) => {
      const t = window.__qmpTestnet;
      const s = { address: (await window.qortalRequest({ action: 'GET_USER_ACCOUNT' })).address };
      s.publicKey = (await window.qortalRequest({ action: 'GET_USER_ACCOUNT' })).publicKey;
      const out = await t.flows.bulkSign(s, list, () => {});
      return out.map((o) => ({ status: o.status, reason: o.reason ?? o.message ?? null }));
    }, sigs);
    const after = await ctx.height();
    const sent = outcomes.filter((o) => o.status === 'sent').length;
    const blocked = outcomes.filter((o) => o.status === 'blocked');
    ctx.record('bulk', { sent, blocked: blocked.length, firstBlockedReason: blocked[0]?.reason ?? null, blocksDuringRun: after - before });
    ctx.expect(outcomes.length === 26, 'the bulk run went through every decision (no decline)');
    if (after === before) {
      ctx.expect(sent === 25 - pending.length, 'exactly up to the limit were sent', { sent });
      ctx.expect(blocked.length >= 1 && /25/.test(blocked[0].reason ?? ''), "the rest are stopped with Core's 25 limit in plain words", blocked[0]);
    } else {
      ctx.check(false, 'a block landed during the run, so the limit may not have been reached', { sent, blocks: after - before });
    }
  },
};
