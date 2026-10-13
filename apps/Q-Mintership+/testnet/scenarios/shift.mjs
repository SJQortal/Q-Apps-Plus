/**
 * The admin-count trap, on chain. Group "shift": 13 admin rows (12 admins and
 * the null owner) at PCT40 need 6 signatures; with 12 rows, 5.
 *
 * D1  remove Jonny (a member), proposed first, 5 of 6
 * R   remove one Minter Admin, proposed next, 5 of 6
 * D2  remove another member, proposed last, 5 of 6
 *
 * Then R gets its 6th signature. When Core applies R, the target drops to 5
 * and D1 and D2 apply with no new signature: one in the same block as R, the
 * other in the next, depending on the order Core evaluates them in.
 */
export default {
  name: 'shift',
  title: 'Admin-count trap: an admin removal lowers the target and two removals apply with no new signature',
  group: 'shift',
  async run(ctx) {
    const groupId = ctx.group('shift').groupId;
    const jonny = ctx.account('mem09');
    const other = ctx.account('mem10');
    const leaving = ctx.account('admin25');
    const admins0 = await ctx.get(`/groups/members/${groupId}?onlyAdmins=true&limit=100`);
    ctx.record('adminRowsBefore', admins0.adminCount);
    ctx.expect(admins0.adminCount === 13, '13 admin rows (12 admins and the null owner): 6 needed');

    const page = {};
    const open = async (label) => (page[label] ??= await ctx.open(label, { group: 'shift' }));

    // Proposes (with the proposer's own signature) and adds signatures until `count`.
    const propose = async (proposer, proposal, signers) => {
      const p = await open(proposer);
      const out = await p.flow('proposeAndSign', proposal);
      ctx.expect(out.proposal.status === 'sent' && out.approval?.status === 'sent', `${proposer} proposes and signs ${proposal.kind}`, out);
      const sig = out.proposalSignature;
      const tx = await ctx.waitForConfirmed(sig);
      for (const label of signers) {
        const s = await open(label);
        const res = await s.flow('signDecision', sig);
        ctx.expect(res.status === 'sent', `${label} signs ${proposal.kind}`, res);
      }
      return { sig, height: tx.blockHeight };
    };

    const d1 = await propose(
      'admin15',
      { kind: 'kick', subject: jonny.address, reason: 'Testnet: the admin-count trap (first removal).' },
      ['admin16', 'admin17', 'admin18', 'admin19']
    );
    ctx.record('D1', d1);
    const r = await propose('admin14', { kind: 'removeAdmin', subject: leaving.address }, [
      'admin20',
      'admin21',
      'admin22',
      'admin23',
    ]);
    ctx.record('R', r);
    const d2 = await propose(
      'admin16',
      { kind: 'kick', subject: other.address, reason: 'Testnet: the admin-count trap (second removal).' },
      ['admin17', 'admin18', 'admin19', 'admin20']
    );
    ctx.record('D2', d2);
    ctx.expect(d1.height < r.height && r.height < d2.height, 'D1, R and D2 are confirmed in that order', {
      d1: d1.height,
      r: r.height,
      d2: d2.height,
    });

    // Every signature confirmed and every decision past its minimum delay: none applies at 5 of 6.
    const info = await ctx.get(`/groups/${groupId}`);
    await ctx.waitForHeight(d2.height + info.minimumBlockDelay + 2);
    for (const [name, d] of Object.entries({ D1: d1, R: r, D2: d2 })) {
      const tx = await ctx.tx(d.sig);
      ctx.expect(tx.approvalStatus === 'PENDING', `${name} is still pending at 5 of 6`, tx.approvalStatus);
    }

    // The app's own count before the flip.
    const before = await page.admin14.evaluate(async (sigs) => {
      const { loadDecisions } = await import('/src/data/decisions.ts');
      window.__qmpTestnet.query.invalidate('decisions:');
      const data = await loadDecisions({ force: true });
      return sigs.map((s) => {
        const d = data.decisions.find((x) => x.signature === s);
        return d && { count: d.tally.approvalCount, needed: d.tally.needed };
      });
    }, [d1.sig, r.sig, d2.sig]);
    ctx.record('appBefore', before);
    ctx.expect(before.every((x) => x?.count === 5 && x?.needed === 6), 'the app shows 5 of 6 on all three', before);

    // R's 6th signature.
    const sixth = await (await open('admin24')).flow('signDecision', r.sig);
    ctx.expect(sixth.status === 'sent', "admin24 gives R its 6th signature", sixth);
    const sixthTx = await ctx.waitForConfirmed(sixth.signature);
    ctx.record('sixthSignatureHeight', sixthTx.blockHeight);

    const approved = async (sig) =>
      ctx.waitFor(
        async () => {
          const tx = await ctx.tx(sig);
          return tx.approvalStatus !== 'PENDING' ? tx : null;
        },
        { label: 'a decision', timeoutMs: 10 * 60_000 }
      );
    const [rTx, d1Tx, d2Tx] = [await approved(r.sig), await approved(d1.sig), await approved(d2.sig)];
    const outcome = {
      R: { status: rTx.approvalStatus, at: rTx.approvalHeight },
      D1: { status: d1Tx.approvalStatus, at: d1Tx.approvalHeight },
      D2: { status: d2Tx.approvalStatus, at: d2Tx.approvalHeight },
    };
    ctx.record('outcome', outcome);
    const admins1 = await ctx.get(`/groups/members/${groupId}?onlyAdmins=true&limit=100`);
    ctx.record('adminRowsAfter', admins1.adminCount);
    ctx.expect(rTx.approvalStatus === 'APPROVED', 'R is approved at 6 of 6');
    ctx.expect(admins1.adminCount === 12, 'the admin rows drop to 12: 5 needed');
    ctx.expect(
      d1Tx.approvalStatus === 'APPROVED' && d2Tx.approvalStatus === 'APPROVED',
      'D1 and D2 are approved with no new signature'
    );
    ctx.expect(
      [d1Tx.approvalHeight, d2Tx.approvalHeight].every((h) => h === rTx.approvalHeight || h === rTx.approvalHeight + 1),
      'each applies in the same block as R or the next',
      outcome
    );
    ctx.record('sameBlock', {
      D1: d1Tx.approvalHeight === rTx.approvalHeight,
      D2: d2Tx.approvalHeight === rTx.approvalHeight,
    });
    const members = await ctx.get(`/groups/members/${groupId}?limit=100`);
    const left = (members.members ?? []).map((m) => m.member);
    ctx.expect(!left.includes(jonny.address) && !left.includes(other.address), 'both members are out of the group');
  },
};
