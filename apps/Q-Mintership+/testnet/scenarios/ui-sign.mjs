/**
 * The screens against real confirmations (60-second blocks): Sign through
 * the Decisions card and its dialog on a phone-sized page, then time
 * "You approved ✓ (confirming…)" until it settles to "You approved ✓", read the ring
 * as signatures land, and check the welcome celebration when the nominee
 * becomes a member, with and without reduced motion.
 */
import { decided, pages, sign } from '../lib/scenario-helpers.mjs';

const ringLabel = (card) =>
  card.locator('[role="img"][aria-label*=" of "], [role="progressbar"]').first().getAttribute('aria-label').catch(() => null);

export default {
  name: 'ui-sign',
  title: 'Sign through the screens: optimistic state, ring, timing on 60 s blocks, the welcome, reduced motion',
  group: 'main',
  async run(ctx) {
    const page = pages(ctx, 'main');
    const [label] = await ctx.fresh('ui-', 1, '2');
    const nominee = ctx.account(label);
    const me = await page(label);
    const join = await me.flow('joinMinter');
    ctx.expect(join.status === 'sent', 'the nominee has a join request', join);
    await ctx.waitForConfirmed(join.signature);
    const first = await (await page('admin01')).flow('firstSignature', nominee.address);
    ctx.expect(first.invite.status === 'sent' && first.approval?.status === 'sent', 'first signature', first);
    const sig = first.inviteSignature;
    await ctx.waitForConfirmed(sig);

    // admin02 signs through the screens, on a phone-sized page.
    const admin = await ctx.open('admin02', { group: 'main', route: '/decisions', viewport: { width: 390, height: 844 } });
    const p = admin.page;
    const card = p.locator(`[id="decision-${sig}"]`);
    await card.waitFor({ timeout: 120_000 });
    const ringBefore = await ringLabel(card);
    const t0 = Date.now();
    await card.getByRole('button', { name: /^Approve/ }).first().click();
    await p.getByRole('button', { name: 'Continue to Hub' }).click();
    await p.getByRole('button', { name: 'Done' }).waitFor({ timeout: 120_000 });
    const tSent = Date.now();
    await p.getByRole('button', { name: 'Done' }).click();
    await card.getByText('You approved ✓ (confirming…)').waitFor({ timeout: 30_000 });
    const tConfirming = Date.now();
    const sentHeight = await ctx.height();
    await card.getByText(/^You approved ✓$/).waitFor({ timeout: 6 * 60_000 });
    const tSettled = Date.now();
    const settledHeight = await ctx.height();
    const ringAfter = await ringLabel(card);
    ctx.record('timing', {
      toHubAnswer_s: Math.round((tSent - t0) / 1000),
      toConfirmingChip_s: Math.round((tConfirming - t0) / 1000),
      toSettled_s: Math.round((tSettled - t0) / 1000),
      blocksWhileConfirming: settledHeight - sentHeight,
    });
    ctx.record('ring', { before: ringBefore, after: ringAfter });
    ctx.check(ringBefore !== ringAfter, 'the ring moved as the signature landed', { ringBefore, ringAfter });
    ctx.check(admin.errors.length === 0, 'no console errors on the Decisions page', admin.errors.slice(0, 3));

    // Two more signatures reach the threshold; watch the nominee's Home turn into the welcome.
    for (const l of ['admin03', 'admin04']) await sign(ctx, page, l, sig);
    // Both devices see the nominee waiting first: the welcome plays once a device saw that.
    const home = await ctx.open(label, { group: 'main', route: '/', viewport: { width: 390, height: 844 } });
    const reduced = await ctx.open(label, { group: 'main', route: '/', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await home.page.getByRole('heading').first().waitFor();
    await reduced.page.getByRole('heading').first().waitFor();
    await ctx.sleep(5_000);
    const tx = await decided(ctx, sig);
    ctx.record('approved', [tx.approvalStatus, tx.approvalHeight]);
    await home.page.reload();
    await home.page.getByText(/Welcome to MINTER/).first().waitFor({ timeout: 4 * 60_000 });
    const confetti = await home.page.evaluate(
      () => [...document.querySelectorAll('[aria-hidden="true"] *')].filter((el) => getComputedStyle(el).animationName !== 'none').length
    );
    ctx.record('celebrationPieces', confetti);
    ctx.check(confetti > 0, 'the celebration plays for a new member');

    // Reduced motion: the same welcome, no animation anywhere.
    const rp = reduced.page;
    await rp.reload();
    await rp.getByText(/Welcome to MINTER/).first().waitFor({ timeout: 2 * 60_000 });
    const animated = await rp.evaluate(
      () => [...document.querySelectorAll('*')].filter((el) => {
        const s = getComputedStyle(el);
        // The app cuts every animation to 0.01 ms under reduced motion (index.css): count real ones.
        return s.animationName !== 'none' && parseFloat(s.animationDuration) > 0.001;
      }).length
    );
    ctx.record('animatedWithReducedMotion', animated);
    ctx.check(animated === 0, 'no animations with reduced motion', animated);
  },
};
