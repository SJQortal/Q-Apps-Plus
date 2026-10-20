/**
 * Doubles, on a fresh copy of group "rules" (5 admin rows at PCT40, 2
 * needed): the same admin change waiting twice, checked against the chain.
 *
 * A1  nom11 proposes themselves as Minter Admin in the app.
 * A2  the same proposal again, sent the way another app would (the app's own
 *     guard refuses a second one): the app marks A2 as the double of A1, and
 *     leaves it out of what waits for an admin's signature.
 *     A1 passes: nom11 is a Minter Admin, and A2 is a double because they
 *     already are one. Signed anyway, Core approves A2 and the admin rows
 *     stay as they were.
 * R1  admin03 proposes removing admin05 in the app.
 * R2  the same removal again, sent the way another app would: the double of
 *     R1. R1 passes: admin05 isn't a Minter Admin, R2 is a double because
 *     there is nothing to remove, the app won't sign it, and three
 *     rejections end it as REJECTED.
 */
import { hubRequest } from '../lib/hub.mjs';
import { decided, freshGroup, isAdmin, pages, sign } from '../lib/scenario-helpers.mjs';

export default {
  name: 'doubles',
  title: 'Doubles: the same admin change waiting twice, marked against the chain; a double that passes changes nothing',
  group: 'rules',
  async run(ctx) {
    const key = await freshGroup('rules');
    const groupId = ctx.group(key).groupId;
    const page = pages(ctx, key);
    const A = (l) => ctx.account(l).address;
    const rows = async () => (await ctx.get(`/groups/members/${groupId}?onlyAdmins=true&limit=100`)).adminCount;
    const needed = async () => Math.ceil(((await rows()) * 40) / 100);
    // The app's own view of the queue (fresh reads), as `label` sees it.
    const view = (label) =>
      page(label).then((p) =>
        p.evaluate(async () => {
          window.__qmpTestnet.query.invalidate('decisions:');
          const { loadDecisions } = await import('/src/data/decisions.ts');
          const data = await loadDecisions({ force: true });
          return data.decisions.map((d) => ({ signature: d.signature, kind: d.kind, phase: d.phase, double: d.double ?? null }));
        })
      );
    const of = (list, sig) => list.find((d) => d.signature === sig) ?? null;
    // Another app's proposal: straight to the signer, without the app's guards.
    const raw = async (label, action, subject) => {
      const tx = await hubRequest(ctx.account(label), { action, groupId, qortalAddress: subject, txGroupId: groupId });
      return (await ctx.waitForConfirmed(tx.signature)).signature;
    };

    ctx.record('adminRowsBefore', await rows());

    // A1 and A2: the same addition twice.
    const a1 = await (await page('nom11')).flow('proposeAndSign', { kind: 'addAdmin', subject: A('nom11') });
    ctx.expect(a1.proposal.status === 'sent', 'A1: nom11 proposes themselves as Minter Admin', a1.proposal);
    const a1Tx = await ctx.waitForConfirmed(a1.proposalSignature);
    const again = await (await page('nom11')).flow('proposeAndSign', { kind: 'addAdmin', subject: A('nom11') });
    ctx.record('appRefusesSecond', again.proposal);
    ctx.expect(again.proposal.status === 'blocked', 'the app refuses a second proposal of the same change before Hub');
    const a2 = await raw('nom11', 'ADD_GROUP_ADMIN', A('nom11'));
    const a2Tx = await ctx.tx(a2);
    ctx.record('A', { a1: a1Tx.blockHeight, a2: a2Tx.blockHeight });

    const v1 = await view('admin03');
    ctx.record('marksWhileBothWait', { a1: of(v1, a1.proposalSignature)?.double, a2: of(v1, a2)?.double });
    ctx.expect(!of(v1, a1.proposalSignature)?.double, 'A1 (the older one) is not a double');
    ctx.expect(
      of(v1, a2)?.double?.reason === 'duplicate' && of(v1, a2)?.double?.otherSignature === a1.proposalSignature,
      'A2 is the double of A1, with a link to it'
    );
    // On screen: the chip on A2's own page, and the queue counts only A1 as waiting.
    const onPage = await ctx.open('admin03', { group: key, route: `/decisions/${encodeURIComponent(a2)}` });
    await onPage.page.locator('.MuiChip-root', { hasText: 'Double' }).first().waitFor({ timeout: 60_000 });
    ctx.check(true, "A2's own page shows the Double chip");
    const queue = await ctx.open('admin04', { group: key, route: '/decisions' });
    await queue.page.getByText(/1 decision waiting for your signature/i).first().waitFor({ timeout: 60_000 });
    ctx.check(true, 'the queue counts only A1 as waiting for a signature');

    for (const l of ['admin02', 'admin03', 'admin04'].slice(0, await needed())) await sign(ctx, page, l, a1.proposalSignature);
    const a1Done = await decided(ctx, a1.proposalSignature);
    ctx.record('A1outcome', [a1Done.approvalStatus, a1Done.approvalHeight]);
    ctx.expect(a1Done.approvalStatus === 'APPROVED' && (await isAdmin(ctx, groupId, A('nom11'))), 'A1 passes: nom11 is a Minter Admin');
    const rowsAfterA1 = await rows();
    const v2 = await view('admin03');
    ctx.record('A2after', of(v2, a2)?.double);
    ctx.expect(of(v2, a2)?.double?.reason === 'alreadyInEffect', 'A2 is now a double because nom11 already is a Minter Admin');

    // Signed anyway, A2 changes nothing on chain.
    for (const l of ['admin02', 'admin03', 'admin04', 'admin05'].slice(0, await needed())) await sign(ctx, page, l, a2);
    const a2Done = await decided(ctx, a2);
    ctx.record('A2outcome', [a2Done.approvalStatus, a2Done.approvalHeight]);
    ctx.expect(a2Done.approvalStatus === 'APPROVED', 'Core approves A2');
    ctx.expect((await rows()) === rowsAfterA1, 'the admin rows stay as they were: it changed nothing', { before: rowsAfterA1, after: await rows() });

    // R1 and R2: the same removal twice.
    const r1 = await (await page('admin03')).flow('proposeAndSign', { kind: 'removeAdmin', subject: A('admin05') });
    ctx.expect(r1.proposal.status === 'sent' && r1.approval?.status === 'sent', 'R1: admin03 proposes removing admin05 and signs it');
    await ctx.waitForConfirmed(r1.proposalSignature);
    const r2 = await raw('admin04', 'REMOVE_GROUP_ADMIN', A('admin05'));
    const v3 = await view('admin02');
    ctx.expect(of(v3, r2)?.double?.reason === 'duplicate' && of(v3, r2)?.double?.otherSignature === r1.proposalSignature, 'R2 is the double of R1');
    const n = await needed();
    for (const l of ['admin02', 'nom11', 'admin04'].slice(0, n - 1)) await sign(ctx, page, l, r1.proposalSignature);
    const r1Done = await decided(ctx, r1.proposalSignature);
    ctx.record('R1outcome', [r1Done.approvalStatus, r1Done.approvalHeight]);
    ctx.expect(r1Done.approvalStatus === 'APPROVED' && !(await isAdmin(ctx, groupId, A('admin05'))), 'R1 passes: admin05 is no longer a Minter Admin');
    const v4 = await view('admin02');
    ctx.record('R2after', of(v4, r2)?.double);
    ctx.expect(of(v4, r2)?.double?.reason === 'alreadyInEffect', 'R2 is now a double: admin05 isn’t a Minter Admin');
    const signR2 = await (await page('admin02')).flow('signDecision', r2);
    ctx.record('signR2', signR2);
    ctx.expect(signR2.status === 'blocked', 'the app won’t sign a removal of someone who isn’t a Minter Admin');
    for (const l of ['admin02', 'admin03', 'nom11', 'admin04'].slice(0, await needed())) {
      const res = await (await page(l)).flow('rejectDecision', r2);
      ctx.expect(res.status === 'sent', `${l} rejects R2`, res);
    }
    const r2Done = await decided(ctx, r2);
    ctx.record('R2outcome', [r2Done.approvalStatus, r2Done.approvalHeight]);
    ctx.expect(r2Done.approvalStatus === 'REJECTED', 'enough rejections end R2 as REJECTED');
    ctx.record('adminRowsAtEnd', await rows());
    ctx.check([onPage, queue].every((v) => v.errors.length === 0), 'no console errors on the Decisions pages', [onPage, queue].map((v) => v.errors.slice(0, 2)));
  },
};
