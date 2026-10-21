/**
 * The admin-count safeguards against the chain, on a fresh MINTER-like
 * group (a fresh one each run: 13 admin rows, 6 needed; 12 rows, 5 needed):
 *
 * - before: a removal at 5 of 6 (D1) and an admin removal at 5 of 6 (R).
 *   The app projects that D1 would apply at once if R passes: the chip on
 *   D1 ("Target may drop to 5") and the impact panel on R's card;
 * - the counter: one of D1's signers withdraws (a rejection), so D1 is at
 *   4 of 5 if R passes, and the app no longer flags it;
 * - R passes; Core lowers the target to 5 and D1 stays pending (4 of 5);
 * - after: a device that last saw the old target shows "The target changed
 *   from 6 to 5" on Decisions.
 */
import { appDecision, decided, freshGroup, pages, sign } from '../lib/scenario-helpers.mjs';

const range = (prefix, from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(2, '0')}`);

export default {
  name: 'shift-app',
  title: 'The app flags the trap before it happens, withdrawing defuses it, and the banner explains it after',
  group: 'shift4',
  async run(ctx) {
    const key = await freshGroup('shift-app', { owner: 'admin15', admins: range('admin', 14, 25), members: ['mem13', 'mem14'] });
    const groupId = ctx.group(key).groupId;
    ctx.record('groupId', groupId);
    const page = pages(ctx, key);
    const A = (l) => ctx.account(l).address;
    const propose = async (proposer, proposal, signers) => {
      const out = await (await page(proposer)).flow('proposeAndSign', proposal);
      ctx.expect(out.proposal.status === 'sent' && out.approval?.status === 'sent', `${proposer} proposes ${proposal.kind}`, out);
      await ctx.waitForConfirmed(out.proposalSignature);
      for (const l of signers) await sign(ctx, page, l, out.proposalSignature);
      return out.proposalSignature;
    };

    const d1 = await propose('admin15', { kind: 'kick', subject: A('mem13'), reason: 'Testnet: the trap, with the safeguards.' }, ['admin16', 'admin17', 'admin18', 'admin19']);
    const r = await propose('admin14', { kind: 'removeAdmin', subject: A('admin25') }, ['admin20', 'admin21', 'admin22', 'admin23']);
    // Every signature confirmed.
    await ctx.waitFor(async () => {
      const [a, b] = [await appDecision(await page('admin14'), d1), await appDecision(await page('admin14'), r)];
      return a?.count === 5 && b?.count === 5 ? true : null;
    }, { label: 'both at 5 of 6' });

    // A device that sees the old target now (for the banner later).
    const watcher = await ctx.open('admin17', { group: key, route: '/decisions' });
    await watcher.page.locator(`[id="decision-${d1}"]`).waitFor({ timeout: 120_000 });
    // Then it leaves Decisions (Home doesn't record the target), to come back after the change.
    const at = (path) => new URL(`${path}?as=admin17&group=${key}`, watcher.page.url()).toString();
    await watcher.page.goto(at('/'));

    // Before: the chip on D1 and the impact panel on R.
    const admin = await ctx.open('admin14', { group: key, route: '/decisions' });
    const d1Card = admin.page.locator(`[id="decision-${d1}"]`);
    const rCard = admin.page.locator(`[id="decision-${r}"]`);
    await d1Card.waitFor({ timeout: 120_000 });
    const chip = await d1Card.getByText(/Target may drop to 5/).first().isVisible().catch(() => false);
    const panel = await rCard.getByText(/drops from 6 to 5|from 6 to 5/).first().isVisible().catch(() => false);
    ctx.record('beforeFlip', { chipOnD1: chip, impactOnR: panel });
    ctx.expect(chip, 'D1 carries "Target may drop to 5"');
    ctx.expect(panel, "R's card says the target would drop from 6 to 5");

    // Signing R from the dialog (as an admin who hasn't signed it) needs "I've checked these" before Hub.
    const signer = await ctx.open('admin24', { group: key, route: '/decisions' });
    const rCard24 = signer.page.locator(`[id="decision-${r}"]`);
    await rCard24.waitFor({ timeout: 120_000 });
    await rCard24.getByRole('button', { name: /^Approve/ }).first().click();
    const dialog = signer.page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Continue to Hub' }).click();
    const held = await dialog.getByText(/I’ve checked these/).first().isVisible().catch(() => false);
    ctx.record('ackRequired', held);
    ctx.expect(held, 'Continue to Hub waits for "I\'ve checked these"');
    await dialog.getByRole('button', { name: /Not now|Close|Cancel/ }).first().click().catch(() => {});

    // The counter: admin16 withdraws their signature on D1 before R passes.
    const withdraw = await (await page('admin16')).flow('withdrawSignature', d1);
    ctx.expect(withdraw.status === 'sent', 'admin16 withdraws their signature on D1', withdraw);
    await ctx.waitForConfirmed(withdraw.signature);
    const afterWithdraw = await appDecision(await page('admin14'), d1);
    ctx.record('D1afterWithdraw', afterWithdraw);
    ctx.expect(afterWithdraw.count === 4 && afterWithdraw.rejections === 1, 'D1: 4 signatures, 1 rejection');
    const flagged = await (await page('admin14')).evaluate(async (sig) => {
      const { loadDecisions } = await import('/src/data/decisions.ts');
      const t = await import('/src/rules/targetShift.ts');
      window.__qmpTestnet.query.invalidate('decisions:');
      const data = await loadDecisions({ force: true });
      const state = {
        threshold: data.group.approvalThreshold,
        adminCount: data.admins.adminCount,
        admins: new Set(data.admins.admins.map((a) => a.member)),
        owner: data.group.owner,
      };
      const risk = t.riskFor(sig, t.shiftScenarios(state, t.shiftDecisionsOf(data.decisions)));
      return risk ? JSON.parse(JSON.stringify(risk)) : null;
    }, d1);
    ctx.record('D1riskAfterWithdraw', flagged);
    ctx.check(!flagged || flagged.effect?.effect !== 'applies', 'after the withdrawal the app no longer says D1 would apply at once', flagged);

    // R passes.
    await sign(ctx, page, 'admin24', r);
    const rDone = await decided(ctx, r);
    ctx.record('R', [rDone.approvalStatus, rDone.approvalHeight]);
    const rowsAfter = (await ctx.get(`/groups/members/${groupId}?onlyAdmins=true&limit=100`)).adminCount;
    ctx.expect(rDone.approvalStatus === 'APPROVED' && rowsAfter === 12, 'R applied: 12 admin rows, 5 needed');
    await ctx.waitForHeight(rDone.approvalHeight + 2);
    const d1Tx = await ctx.tx(d1);
    ctx.record('D1afterR', d1Tx.approvalStatus);
    ctx.expect(d1Tx.approvalStatus === 'PENDING', 'D1 did not apply: the withdrawal kept it at 4 of 5');

    // After: the device that last saw 6 comes back to Decisions and is told why it changed.
    await watcher.page.goto(at('/decisions'));
    const banner = watcher.page.getByText(/target changed from 6 to 5/i).first();
    await banner.waitFor({ timeout: 3 * 60_000 });
    ctx.record('banner', await banner.textContent());
    ctx.check(true, 'Decisions says the target changed from 6 to 5, and why');
  },
};
