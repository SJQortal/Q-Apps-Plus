/**
 * Reject and Withdraw (both GROUP_APPROVAL with approval false), group
 * "reject": 7 admin rows at PCT40, 3 needed, for signatures and rejections
 * alike.
 *
 * D  sign, reject, withdraw then sign again: only each admin's latest
 *    decision counts; the guards refuse a second Reject and a Withdraw
 *    without a signature; approved at 3 signatures with 1 rejection.
 * E  three rejections reach the target: Core ends it as REJECTED, and the
 *    nomination behind it shows as rejected.
 * F  3 signatures and 3 rejections: approvals are checked first and win.
 * C  Considering on D: published (with a note), cleared, published again,
 *    then superseded once the same admin signs.
 */
import { appDecision, decided, freshGroup, pages, sign } from '../lib/scenario-helpers.mjs';

export default {
  name: 'reject',
  title: 'Reject, Withdraw (sign, withdraw, sign again), rejections reaching the target, a tie',
  group: 'reject',
  async run(ctx) {
    const key = await freshGroup('reject');
    const page = pages(ctx, key);
    const [n1, n2, n3] = await ctx.fresh('rj-', 3, '1');
    const A = (l) => ctx.account(l).address;
    const flow = async (label, name, ...args) => (await page(label)).flow(name, ...args);
    const confirm = async (out, what) => {
      ctx.expect(out.status === 'sent', what, out);
      return ctx.waitForConfirmed(out.signature);
    };

    // D: sign, reject, withdraw, sign again.
    const d = await flow('admin26', 'firstSignature', A(n1));
    ctx.expect(d.invite.status === 'sent' && d.approval?.status === 'sent', 'D: proposed with the first signature');
    const dSig = d.inviteSignature;
    const dTx = await ctx.waitForConfirmed(dSig);
    ctx.record('D', { height: dTx.blockHeight });
    await confirm(await flow('admin27', 'rejectDecision', dSig), 'admin27 rejects D');
    const rejectAgain = await flow('admin27', 'rejectDecision', dSig);
    ctx.record('rejectAgain', rejectAgain);
    ctx.expect(rejectAgain.status === 'blocked', 'a second Reject from the same admin is refused before Hub');
    const withdrawUnsigned = await flow('admin29', 'withdrawSignature', dSig);
    ctx.record('withdrawWithoutSignature', withdrawUnsigned);
    ctx.expect(withdrawUnsigned.status === 'blocked', 'Withdraw without a signature is refused before Hub');
    await confirm(await flow('admin28', 'signDecision', dSig), 'admin28 signs D');
    const v1 = await appDecision(await page('admin26'), dSig);
    await confirm(await flow('admin28', 'withdrawSignature', dSig), 'admin28 withdraws their signature');
    const v2 = await appDecision(await page('admin26'), dSig);
    await confirm(await flow('admin28', 'signDecision', dSig), 'admin28 signs again');
    const v3 = await appDecision(await page('admin26'), dSig);
    ctx.record('Dcounts', { afterSign: v1, afterWithdraw: v2, afterSignAgain: v3 });
    ctx.expect(v1.count === 2 && v1.rejections === 1, 'after the signature: 2 signatures, 1 rejection', v1);
    ctx.expect(v2.count === 1 && v2.rejections === 2, 'after withdrawing: 1 signature, 2 rejections (latest counts)', v2);
    ctx.expect(v3.count === 2 && v3.rejections === 1, 'after signing again: 2 signatures, 1 rejection', v3);
    // C: Considering on D (a QDN record under admin29's name), then superseded by a signature.
    const considering = (label) =>
      page(label).then((p) =>
        p.evaluate(async (sig) => {
          const q = window.__qmpTestnet.query;
          q.invalidate('considering:');
          q.invalidate('qdnsearch:');
          q.invalidate('decisions:');
          const { loadConsidering, answersFromTally } = await import('/src/data/considering.ts');
          const { consideringFor } = await import('/src/rules/considering.ts');
          const { loadDecisions } = await import('/src/data/decisions.ts');
          const [data, queue] = await Promise.all([loadConsidering({ force: true }), loadDecisions({ force: true })]);
          const d = queue.decisions.find((x) => x.signature === sig);
          return consideringFor(data.entries, { pendingSignature: sig }, answersFromTally(d?.tally)).map(
            (person) => ({ name: person.name ?? person.address, note: person.note ?? null })
          );
        }, dSig)
      );
    const consider = async (options, what) => {
      const p = await page('admin29');
      const out = await p.evaluate(
        ({ sig, options: o, signer }) => window.__qmpTestnet.flows.publishConsidering(signer, { pendingSignature: sig }, o),
        { sig: dSig, options, signer: p.signer }
      );
      ctx.expect(out.status === 'sent', what, out);
      return out;
    };
    await consider({ note: 'Reading their node history first.' }, 'admin29 publishes Considering with a note');
    const seen = await ctx.waitFor(async () => {
      const list = await considering('admin26');
      return list.length ? list : null;
    }, { label: 'Considering to show on the card' });
    ctx.record('consideringShown', seen);
    await consider({ cleared: true }, 'admin29 says No longer considering');
    const cleared = await ctx.waitFor(async () => ((await considering('admin26')).length === 0 ? 'gone' : null), {
      label: 'Considering to clear',
    });
    ctx.record('consideringCleared', cleared);
    await consider({ note: 'Back to it.' }, 'admin29 considers it again');
    await ctx.waitFor(async () => ((await considering('admin26')).length ? 'back' : null), { label: 'Considering again' });
    await sign(ctx, page, 'admin29', dSig);
    const superseded = await ctx.waitFor(async () => ((await considering('admin26')).length === 0 ? 'superseded' : null), {
      label: 'the signature to supersede Considering',
    });
    ctx.record('consideringAfterSignature', superseded);
    const dDone = await decided(ctx, dSig);
    ctx.record('Doutcome', [dDone.approvalStatus, dDone.approvalHeight]);
    ctx.expect(dDone.approvalStatus === 'APPROVED', 'D is approved at 3 signatures with 1 rejection');

    // E: a nomination with three rejections ends as REJECTED.
    const nominated = await flow('nom09', 'publishNomination', {
      nomineeAddress: A(n2),
      reason: 'A nomination the admins will reject, to test the rejected outcome.',
      links: [],
    });
    ctx.expect(nominated.status === 'sent', 'E: a nomination record', nominated);
    const e = await flow('admin26', 'firstSignature', A(n2));
    ctx.expect(e.invite.status === 'sent', 'E: proposed with the first signature');
    const eTx = await ctx.waitForConfirmed(e.inviteSignature);
    for (const l of ['admin27', 'admin28', 'admin29']) await confirm(await flow(l, 'rejectDecision', e.inviteSignature), `${l} rejects E`);
    const eDone = await decided(ctx, e.inviteSignature);
    ctx.record('Eoutcome', { height: eTx.blockHeight, status: eDone.approvalStatus, at: eDone.approvalHeight });
    ctx.expect(eDone.approvalStatus === 'REJECTED', 'E ends as REJECTED when rejections reach the target');
    const states = await (await page('nom09')).evaluate(async (address) => {
      const { loadNominationsFor } = await import('/src/data/nominations.ts');
      for (const k of ['nominations:', 'decisions:', 'pending:', 'history:', 'tx:']) window.__qmpTestnet.query.invalidate(k);
      return (await loadNominationsFor(address, { force: true })).map((n) => n.state);
    }, A(n2));
    ctx.record('Enomination', states);
    ctx.check(states.includes('rejected'), 'the nomination shows as rejected', states);

    // F: a tie, 3 and 3: approvals win.
    const f = await flow('admin26', 'firstSignature', A(n3));
    ctx.expect(f.invite.status === 'sent', 'F: proposed with the first signature');
    const fTx = await ctx.waitForConfirmed(f.inviteSignature);
    await Promise.all([
      ...['admin27', 'admin28'].map((l) => flow(l, 'signDecision', f.inviteSignature)),
      ...['admin29', 'admin30', 'low04'].map((l) => flow(l, 'rejectDecision', f.inviteSignature)),
    ]).then((outs) => outs.forEach((o, i) => ctx.expect(o.status === 'sent', `F answer ${i + 1} sent`, o)));
    const fDone = await decided(ctx, f.inviteSignature);
    ctx.record('Foutcome', { height: fTx.blockHeight, status: fDone.approvalStatus, at: fDone.approvalHeight });
    ctx.expect(fDone.approvalStatus === 'APPROVED', 'F: 3 signatures and 3 rejections, approved (approvals win a tie)');
  },
};
