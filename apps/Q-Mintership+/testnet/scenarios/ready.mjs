/**
 * Show you're ready to mint (JOIN_GROUP from a newcomer), then a nomination
 * with a supporter, then the first signature and signatures to the
 * threshold: the newcomer is a member at once. The guard refuses a second
 * join request.
 */
import { decided, isMember, pages, sign } from '../lib/scenario-helpers.mjs';

export default {
  name: 'ready',
  title: "Show you're ready to mint, nominate and support, approved: a member at once",
  group: 'main',
  async run(ctx) {
    const groupId = ctx.group('main').groupId;
    const page = pages(ctx, 'main');
    const [label] = await ctx.fresh('rd-', 1, '2');
    const newcomer = ctx.account(label);
    ctx.record('newcomer', newcomer.address);

    const me = await page(label);
    const ready = await me.flow('joinMinter');
    ctx.expect(ready.status === 'sent', "Show you're ready to mint sends JOIN_GROUP", ready);
    const readyTx = await ctx.waitForConfirmed(ready.signature);
    ctx.record('readyHeight', readyTx.blockHeight);
    const again = await me.flow('joinMinter');
    ctx.record('secondJoin', again);
    ctx.expect(again.status === 'blocked', 'a second join request is refused before Hub');

    const listed = await (await page('nom03')).evaluate(async (address) => {
      const { loadReadyToMint } = await import('/src/data/readyToMint.ts');
      const data = await loadReadyToMint({ force: true }).catch((e) => ({ error: String(e) }));
      const rows = data.rows ?? data.entries ?? data.items ?? [];
      return rows.some((r) => (r.address ?? r.joiner ?? r) === address) || JSON.stringify(data).includes(address);
    }, newcomer.address);
    ctx.check(listed, 'Nominations → Ready to mint lists the newcomer');

    const nomination = await (await page('nom03')).flow('publishNomination', {
      nomineeAddress: newcomer.address,
      reason: 'Showed they are ready to mint and keeps their node online around the clock.',
      links: [],
    });
    ctx.expect(nomination.status === 'sent', 'nominated', nomination);
    // Supports need the nomination to be readable first.
    await ctx.waitFor(
      async () => (await ctx.get(`/arbitrary/resources/searchsimple?service=JSON&identifier=qmp-nomination-${newcomer.address}&prefix=false&limit=5`))?.length > 0,
      { label: 'the nomination record' }
    );
    const support = await (await page('nom04')).flow('publishSupport', newcomer.address, 'I have seen them help in Q-Chat too.');
    ctx.expect(support.status === 'sent', 'supported', support);
    const supporters = await ctx.waitFor(
      async () =>
        (await page('nom04')).evaluate(async (address) => {
          const { loadNominationsFor } = await import('/src/data/nominations.ts');
          window.__qmpTestnet.query.invalidate('nominations:');
          window.__qmpTestnet.query.invalidate('qdnsearch:');
          const list = await loadNominationsFor(address, { force: true });
          const open = list.find((n) => n.state === 'waiting' || n.state === 'signing');
          return open && open.supporters.length ? open.supporters.length : null;
        }, newcomer.address),
      { label: 'the support in the app' }
    );
    ctx.record('supporters', supporters);

    const first = await (await page('admin02')).flow('firstSignature', newcomer.address);
    ctx.expect(first.invite.status === 'sent' && first.approval?.status === 'sent', 'first signature', first);
    const invite = await ctx.waitForConfirmed(first.inviteSignature);
    ctx.record('inviteHeight', invite.blockHeight);
    for (const l of ['admin03', 'admin04', 'admin05']) await sign(ctx, page, l, first.inviteSignature);
    const tx = await decided(ctx, first.inviteSignature);
    ctx.record('approved', [tx.approvalStatus, tx.approvalHeight]);
    ctx.expect(tx.approvalStatus === 'APPROVED', 'approved');
    ctx.expect(await isMember(ctx, groupId, newcomer.address), 'a member at once (the join request was in)');
  },
};
