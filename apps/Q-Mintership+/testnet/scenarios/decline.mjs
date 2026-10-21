/**
 * Decline a join request, on a fresh copy of group "rules" (5 admin rows at
 * PCT40, 2 needed): a kick of someone who asked to join and isn't a member,
 * checked against the chain.
 *
 * - A fresh account sends JOIN_GROUP: Core lists its join request, and the
 *   app's Ready to mint lists it.
 * - admin03 proposes declining it in the app (proposeAndSign, a kick with
 *   `decline`) and signs it: the app titles it "Decline a join request", and
 *   Ready to mint says a decline is waiting. The guard refuses a second
 *   decline, a decline of an account that never asked, and one of a member.
 * - Minter Admins sign until Core decides it: the join request is gone from
 *   /groups/joinrequests and from Ready to mint, the account was never a
 *   member and its status isn't a former member, History reads "Join
 *   request declined", and the decision's own page still says what it was.
 * - The account sends a new JOIN_GROUP: a new join request appears.
 */
import { decided, freshGroup, isMember, pages, sign } from '../lib/scenario-helpers.mjs';

export default {
  name: 'decline',
  title: 'Decline a join request: a kick of someone on Ready to mint, signed until Core decides; they can ask again',
  group: 'rules',
  async run(ctx) {
    const key = await freshGroup('rules');
    const groupId = ctx.group(key).groupId;
    const page = pages(ctx, key);
    const A = (l) => ctx.account(l).address;
    const rows = async () => (await ctx.get(`/groups/members/${groupId}?onlyAdmins=true&limit=100`)).adminCount;
    const needed = async () => Math.ceil(((await rows()) * 40) / 100);
    const [asker, quiet] = await ctx.fresh('dc-', 2, '1');
    const who = A(asker);
    ctx.record('asker', who);
    const joinRequests = async () => ((await ctx.get(`/groups/joinrequests/${groupId}`)) ?? []).map((r) => r.joiner);
    // The app's Ready to mint (its own loader, fresh reads), as `label` sees it.
    const readyToMint = (label) =>
      page(label).then((p) =>
        p.evaluate(async () => {
          const q = window.__qmpTestnet.query;
          q.invalidate('group:');
          q.invalidate('ready:');
          const { loadReadyToMint } = await import('/src/data/readyToMint.ts');
          return (await loadReadyToMint({ force: true })).people;
        })
      );
    const decline = (label, subject, reason = 'Testnet: asked to join with no node online') =>
      page(label).then((p) => p.flow('proposeAndSign', { kind: 'kick', subject, reason, decline: true }));

    // They ask to join.
    const join = await (await page(asker)).flow('joinMinter');
    ctx.expect(join.status === 'sent', "the account shows it's ready to mint (JOIN_GROUP)", join);
    await ctx.waitForConfirmed(join.signature);
    ctx.expect((await joinRequests()).includes(who), 'Core lists the join request');
    ctx.expect((await readyToMint('admin03')).includes(who), 'the app’s Ready to mint lists them');

    // admin03 proposes declining it, and signs it.
    const out = await decline('admin03', who);
    ctx.record('decline', { proposal: out.proposal.status, approval: out.approval?.status, withSignature: out.withSignature });
    ctx.expect(out.proposal.status === 'sent' && out.approval?.status === 'sent', 'admin03 proposes declining it and signs it (two Hub steps)', out);
    const sig = out.proposalSignature;
    const kick = await ctx.waitForConfirmed(sig);
    ctx.expect(kick.type === 'GROUP_KICK' && kick.member === who && kick.txGroupId === groupId, 'it is a GROUP_KICK of the account, waiting for the Minter Admins', kick);
    const titled = await (await page('admin04')).evaluate(async (s) => {
      window.__qmpTestnet.query.invalidate('decisions:');
      window.__qmpTestnet.query.invalidate('group:');
      const { loadDecisions } = await import('/src/data/decisions.ts');
      const { decisionTitle } = await import('/src/rules/decision.ts');
      const d = (await loadDecisions({ force: true })).decisions.find((x) => x.signature === s);
      return d ? { decline: d.decline ?? false, title: decisionTitle(d) } : null;
    }, sig);
    ctx.record('waiting', titled);
    ctx.expect(titled?.decline === true && titled.title === 'Decline a join request', 'the app titles it Decline a join request', titled);
    const listView = await ctx.open('admin04', { group: key, route: '/nominations?show=ready' });
    await listView.page.getByRole('link', { name: /^A decline is waiting for Minter Admins/ }).first().waitFor({ timeout: 60_000 });
    ctx.check(true, 'Ready to mint says a decline is waiting');

    // The guard.
    const second = await decline('admin04', who);
    const neverAsked = await decline('admin04', A(quiet));
    const member = await decline('admin04', A('mem12'));
    ctx.record('guards', { second: second.proposal, neverAsked: neverAsked.proposal, member: member.proposal });
    ctx.expect(second.proposal.status === 'blocked', 'a second decline of the same join request is refused before Hub');
    ctx.expect(neverAsked.proposal.status === 'blocked', 'an account that never asked to join has no join request to decline');
    ctx.expect(member.proposal.status === 'blocked', 'a member has no join request to decline');

    // Minter Admins sign until Core decides it.
    for (const l of ['admin04', 'admin05', 'admin02'].slice(0, (await needed()) - 1)) await sign(ctx, page, l, sig);
    const done = await decided(ctx, sig);
    ctx.record('outcome', [done.approvalStatus, done.approvalHeight]);
    ctx.expect(done.approvalStatus === 'APPROVED', 'Core approves the decline');

    // The join request is gone, and nothing calls it a removal.
    ctx.expect(!(await joinRequests()).includes(who), 'Core no longer lists the join request');
    ctx.expect(!(await isMember(ctx, groupId, who)), 'the account is not a member (it never was)');
    ctx.expect(!(await readyToMint('admin03')).includes(who), 'the app’s Ready to mint no longer lists them');
    const after = await (await page('admin03')).evaluate(
      async ({ address, s }) => {
        const q = window.__qmpTestnet.query;
        for (const prefix of ['status:', 'history:', 'group:', 'decisionlink:', 'tx:', 'former:']) q.invalidate(prefix);
        const { loadMyStatus } = await import('/src/data/me.ts');
        const { getFormerMember } = await import('/src/data/readyToMint.ts');
        const { getAddressHistory } = await import('/src/data/txs.ts');
        const { getChainNow } = await import('/src/data/chain.ts');
        const { buildTimeline, eventsAbout, withOwnSubject } = await import('/src/data/timeline.ts');
        const { loadDecisionLink } = await import('/src/data/decisionLink.ts');
        const status = await loadMyStatus(address, { force: true });
        const former = await getFormerMember(address);
        const [history, now] = await Promise.all([getAddressHistory(address, { force: true }), getChainNow()]);
        const events = eventsAbout(buildTimeline(withOwnSubject(history.rows, address), { msPerBlock: now.msPerBlock, maximumBlockDelay: 10_080 }), address);
        const link = await loadDecisionLink(s, { force: true });
        return {
          kind: status.kind,
          removal: status.removal,
          declinedAt: status.declinedAt,
          former,
          titles: events.map((e) => e.title),
          link: { kind: link.kind, decline: link.decline ?? false },
        };
      },
      { address: who, s: sig }
    );
    ctx.record('afterDecline', after);
    ctx.expect(after.kind !== 'formerKicked' && after.kind !== 'formerLeft' && after.removal === null, 'their status is not a former member', after);
    ctx.expect(after.former === null, 'Ready to mint would mark no former member', after.former);
    ctx.expect(typeof after.declinedAt === 'number', 'their status knows the join request was declined');
    ctx.expect(after.titles[0] === 'Join request declined' && !after.titles.includes('Removed from MINTER'), 'their timeline reads Join request declined', after.titles);
    ctx.expect(after.link.kind === 'decided' && after.link.decline === true, 'the decision’s own page still titles it a decline', after.link);

    // They can ask again.
    const again = await (await page(asker)).flow('joinMinter');
    ctx.expect(again.status === 'sent', 'the account sends a new JOIN_GROUP', again);
    await ctx.waitForConfirmed(again.signature);
    ctx.expect((await joinRequests()).includes(who), 'a new join request appears');
    ctx.expect((await readyToMint('admin03')).includes(who), 'Ready to mint lists them again');
    ctx.check(listView.errors.length === 0, 'no console errors on Ready to mint', listView.errors.slice(0, 2));
  },
};
