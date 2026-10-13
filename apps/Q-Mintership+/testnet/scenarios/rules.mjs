/**
 * Group "rules" (5 admin rows at PCT40, 2 needed): the app's rules for admin
 * changes, public comments, and the shareable links.
 *
 * - A member proposes themselves as Minter Admin: one Hub step, no own
 *   signature; the admins sign it; with a statement posted as its comment.
 * - A Minter Admin proposes another member: the proposal and their signature.
 * - A Minter Admin steps down: their own removal, signed by them and others.
 * - The guards: a member can't propose another member or remove an admin;
 *   nobody can propose removing the null owner.
 * - Comments on a decision: post, reply, edit, delete, and a Minter Admin's
 *   hide, read back from QDN as the app reads them.
 * - Links: /decisions/<signature> (waiting and decided), the old
 *   /decisions?d=<signature>, and /nominations/<address>.
 */
import { decided, freshGroup, isAdmin, pages, sign } from '../lib/scenario-helpers.mjs';
import { NULL_OWNER } from '../lib/world.mjs';

export default {
  name: 'rules',
  title: 'Admin-change rules (become, propose another, step down, guards), comments, shareable links',
  group: 'rules',
  async run(ctx) {
    const key = await freshGroup('rules');
    const groupId = ctx.group(key).groupId;
    const page = pages(ctx, key);
    const A = (l) => ctx.account(l).address;
    const rows = async () => (await ctx.get(`/groups/members/${groupId}?onlyAdmins=true&limit=100`)).adminCount;
    const needed = async () => Math.ceil(((await rows()) * 40) / 100);

    // A member proposes themselves: one Hub step, no own signature.
    const self = await (await page('nom11')).flow('proposeAndSign', { kind: 'addAdmin', subject: A('nom11') });
    ctx.record('becomeAdmin', { proposal: self.proposal.status, withSignature: self.withSignature, approval: self.approval });
    ctx.expect(self.proposal.status === 'sent' && self.withSignature === false && !self.approval, 'a member proposes themselves in one Hub step');
    const becomeSig = self.proposalSignature;
    const becomeTx = await ctx.waitForConfirmed(becomeSig);
    ctx.expect(becomeTx.txGroupId === groupId, 'it waits for the Minter Admins');

    // Their statement, as the proposal's first comment.
    const comment = (label, fn, arg) =>
      page(label).then((p) =>
        p.evaluate(
          async ({ fn: f, arg: a, signer }) => {
            const w = await import('/src/writes/comments.ts');
            const r = await import('/src/data/commentRecords.ts');
            const author = { ...signer, name: signer.name };
            const key = r.decisionCommentKey(a.sig);
            if (f === 'post') return w.postComment(author, { key, text: a.text, replyTo: a.replyTo ?? null });
            if (f === 'edit') return w.editComment(author, { name: signer.name, identifier: a.identifier, key, replyTo: a.replyTo ?? null }, a.text);
            if (f === 'delete') return w.deleteComment(author, { name: signer.name, identifier: a.identifier, key, replyTo: a.replyTo ?? null });
            if (f === 'hide') return w.setCommentHidden(author, { name: a.name, identifier: a.identifier, key }, true);
            throw new Error(f);
          },
          { fn, arg, signer: p.signer }
        )
      );
    const statement = await comment('nom11', 'post', { sig: becomeSig, text: 'I read Decisions every day and know the minting rules well.' });
    ctx.expect(statement.outcome.status === 'sent', 'the statement is posted as a comment', statement.outcome);

    for (const l of ['admin02', 'admin03'].slice(0, await needed())) await sign(ctx, page, l, becomeSig);
    const becomeDone = await decided(ctx, becomeSig);
    ctx.record('becomeOutcome', [becomeDone.approvalStatus, becomeDone.approvalHeight]);
    ctx.expect(await isAdmin(ctx, groupId, A('nom11')), 'the member is now a Minter Admin');
    ctx.record('adminRowsAfterBecome', await rows());

    // An admin proposes another member: the proposal and their own signature.
    const other = await (await page('admin03')).flow('proposeAndSign', { kind: 'addAdmin', subject: A('mem12') });
    ctx.expect(other.proposal.status === 'sent' && other.withSignature === true && other.approval?.status === 'sent', 'an admin proposes another member and signs it');
    await ctx.waitForConfirmed(other.proposalSignature);
    // Guards while it waits.
    const g1 = await (await page('nom12')).flow('proposeAndSign', { kind: 'addAdmin', subject: A('low05') });
    const g2 = await (await page('nom12')).flow('proposeAndSign', { kind: 'removeAdmin', subject: A('admin02') });
    const g3 = await (await page('admin02')).flow('proposeAndSign', { kind: 'removeAdmin', subject: NULL_OWNER });
    ctx.record('guards', { memberProposesOther: g1.proposal, memberRemovesAdmin: g2.proposal, removeOwner: g3.proposal });
    ctx.expect(g1.proposal.status === 'blocked', 'a member can only propose themselves');
    ctx.expect(g2.proposal.status === 'blocked', 'only Minter Admins may propose removing another admin');
    ctx.expect(g3.proposal.status === 'blocked', "MINTER's owner account can't be removed");
    const n2 = await needed();
    for (const l of ['admin04', 'admin05', 'admin02'].slice(0, n2 - 1)) await sign(ctx, page, l, other.proposalSignature);
    const otherDone = await decided(ctx, other.proposalSignature);
    ctx.record('proposeOtherOutcome', [otherDone.approvalStatus, otherDone.approvalHeight]);
    ctx.expect(await isAdmin(ctx, groupId, A('mem12')), 'the member proposed by an admin is a Minter Admin');

    // An admin steps down: their own removal, signed by them, then by others.
    const down = await (await page('admin05')).flow('proposeAndSign', { kind: 'removeAdmin', subject: A('admin05') });
    ctx.expect(down.proposal.status === 'sent' && down.withSignature === true && down.approval?.status === 'sent', 'an admin steps down (their own signature included)');
    await ctx.waitForConfirmed(down.proposalSignature);
    const n3 = await needed();
    for (const l of ['admin02', 'admin03', 'admin04'].slice(0, n3 - 1)) await sign(ctx, page, l, down.proposalSignature);
    const downDone = await decided(ctx, down.proposalSignature);
    ctx.record('stepDownOutcome', [downDone.approvalStatus, downDone.approvalHeight]);
    ctx.expect(!(await isAdmin(ctx, groupId, A('admin05'))), 'they are no longer a Minter Admin');
    ctx.record('adminRowsAtEnd', await rows());

    // Comments on the first decision: reply, edit, delete, and a hide.
    const c1 = await comment('nom12', 'post', { sig: becomeSig, text: 'Good choice; they helped me with my node.' });
    ctx.expect(c1.outcome.status === 'sent', 'a member comments', c1.outcome);
    const reply = await comment('admin02', 'post', { sig: becomeSig, text: 'Agreed.', replyTo: c1.identifier });
    ctx.expect(reply.outcome.status === 'sent', 'an admin replies', reply.outcome);
    const edit = await comment('nom12', 'edit', { sig: becomeSig, identifier: c1.identifier, text: 'Good choice; they helped me set up my node last month.' });
    ctx.expect(edit.outcome.status === 'sent', 'the comment is edited (same identifier)', edit.outcome);
    const c2 = await comment('low05', 'post', { sig: becomeSig, text: 'Off-topic remark to be hidden.' });
    ctx.expect(c2.outcome.status === 'sent', 'another comment', c2.outcome);
    const c3 = await comment('mem12', 'post', { sig: becomeSig, text: 'This one will be deleted.' });
    ctx.expect(c3.outcome.status === 'sent', 'a comment to delete', c3.outcome);
    const del = await comment('mem12', 'delete', { sig: becomeSig, identifier: c3.identifier });
    ctx.expect(del.outcome.status === 'sent', 'it is deleted (republished as deleted)', del.outcome);
    const hide = await comment('admin03', 'hide', { sig: becomeSig, identifier: c2.identifier, name: (await page('low05')).signer.name });
    ctx.expect(hide.outcome.status === 'sent', 'a Minter Admin hides a comment', hide.outcome);

    const readThread = () =>
      page('admin04').then((p) =>
        p.evaluate(async (sig) => {
          const q = window.__qmpTestnet.query;
          q.invalidate('comments:');
          q.invalidate('qdnsearch:');
          const { loadCommentThread } = await import('/src/data/comments.ts');
          const { commentTarget } = await import('/src/data/commentThread.ts');
          const data = await loadCommentThread(commentTarget('decision', sig), 20, { force: true });
          return {
            rows: data.rows.length,
            bodies: [...data.bodies.values()].map((b) => JSON.parse(JSON.stringify(b))),
            hides: [...data.hides.entries()],
          };
        }, becomeSig)
      );
    const thread = await ctx.waitFor(
      async () => {
        const t = await readThread();
        const texts = JSON.stringify(t.bodies);
        const ok =
          t.rows >= 5 &&
          texts.includes('set up my node last month') &&
          texts.includes('"deleted":true') &&
          t.hides.some(([, hidden]) => hidden === true);
        return ok ? t : null;
      },
      { label: 'the comments as the app reads them', timeoutMs: 10 * 60_000 }
    );
    ctx.record('thread', { rows: thread.rows, hides: thread.hides.length });
    ctx.expect(JSON.stringify(thread.bodies).includes('"replyTo"'), 'the reply points at its comment');

    // Links.
    const viewer = await ctx.open('nom12', { group: key, route: `/decisions/${encodeURIComponent(becomeSig)}` });
    await viewer.page.getByText(/Decided|Approved/).first().waitFor({ timeout: 60_000 });
    ctx.check(true, 'a decided decision opens on its own page');
    const old = await ctx.open('nom12', { group: key, route: `/decisions?d=${encodeURIComponent(becomeSig)}` });
    await old.page.waitForURL(new RegExp(`/decisions/${becomeSig.slice(0, 20)}`), { timeout: 30_000 });
    ctx.check(true, 'an old /decisions?d= link opens the decision page');
    const [newcomer] = await ctx.fresh('rl-', 1, '1');
    const nomination = await (await page('nom12')).flow('publishNomination', {
      nomineeAddress: A(newcomer),
      reason: 'A careful node runner; a nomination to open on its own page.',
      links: [],
    });
    ctx.expect(nomination.status === 'sent', 'a nomination to link to', nomination);
    const np = await ctx.open('nom11', { group: key, route: `/nominations/${A(newcomer)}` });
    await np.page.getByText(/careful node runner/).first().waitFor({ timeout: 5 * 60_000 });
    ctx.check(true, 'the nomination opens on its own page with its reason');
    ctx.check([viewer, old, np].every((v) => v.errors.length === 0), 'no console errors on the link pages', [viewer, old, np].map((v) => v.errors.slice(0, 2)));
  },
};
