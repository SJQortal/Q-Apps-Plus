/**
 * Nominate (QDN) → Accept (JOIN_GROUP) → first signature (invite + own
 * signature, signed while the invite is still unconfirmed) → signatures to
 * the threshold → Core approves it by itself and, with the join request
 * already in, the nominee is a member at once.
 */
export default {
  name: 'nominate-join',
  title: 'Nominate, accept, first signature, signatures to the threshold, member at once',
  group: 'main',
  async run(ctx) {
    const groupId = ctx.group('main').groupId;
    const [nomineeLabel] = await ctx.fresh('nj-', 1, '2');
    const nominee = ctx.account(nomineeLabel);
    ctx.record('nominee', nominee.address);

    // 1. Nominate: a level 5 member publishes the record (QDN on the testnet).
    const nominator = await ctx.open('nom01');
    const published = await nominator.flow('publishNomination', {
      nomineeAddress: nominee.address,
      reason: 'Runs a well-kept node and helps newcomers every week in Q-Chat.',
      links: [],
    });
    ctx.expect(published.status === 'sent', 'the nomination record is published', published);
    const record = await ctx.waitFor(
      async () => {
        const rows = await ctx.get(
          `/arbitrary/resources/searchsimple?service=JSON&identifier=qmp-nomination-${nominee.address}&prefix=false&limit=5`
        );
        return rows?.[0] ?? null;
      },
      { label: 'the nomination record on QDN' }
    );
    ctx.record('nominationRecord', { name: record.name, identifier: record.identifier });
    const body = await ctx.waitFor(
      async () => ctx.get(`/arbitrary/JSON/${encodeURIComponent(record.name)}/${record.identifier}`).catch(() => null),
      { label: 'the record body' }
    );
    ctx.expect(body?.v === 1 && body?.nomineeAddress === nominee.address, 'the record body has the contract shape', body);

    // 2. The nominee accepts: JOIN_GROUP makes a join request.
    const me = await ctx.open(nomineeLabel);
    const join = await me.flow('joinMinter');
    ctx.expect(join.status === 'sent', 'Accept nomination sends JOIN_GROUP', join);
    const joinTx = await ctx.waitForConfirmed(join.signature);
    ctx.record('joinRequestHeight', joinTx.blockHeight);
    const requests = await ctx.get(`/groups/joinrequests/${groupId}`);
    ctx.expect(requests.some((r) => r.joiner === nominee.address), 'Core lists the join request');

    // 3. First signature: the invite and the admin's own signature, signed before the invite is in a block.
    const admin1 = await ctx.open('admin01');
    const first = await admin1.flow('firstSignature', nominee.address);
    ctx.expect(first.invite.status === 'sent', 'the GROUP_INVITE is sent', first.invite);
    ctx.expect(first.approval?.status === 'sent', 'the first admin signs it', first.approval);
    const inviteSig = first.inviteSignature;
    const approvalAtSend = await ctx.tx(first.approval.signature);
    const inviteAtSend = await ctx.tx(inviteSig);
    ctx.record('signedWhileUnconfirmed', typeof inviteAtSend.blockHeight !== 'number');
    const inviteTx = await ctx.waitForConfirmed(inviteSig);
    const approval1 = await ctx.waitForConfirmed(first.approval.signature);
    ctx.record('invite', { signature: inviteSig, blockHeight: inviteTx.blockHeight, txGroupId: inviteTx.txGroupId });
    ctx.record('firstApprovalHeight', approval1.blockHeight);
    ctx.expect(inviteTx.txGroupId === groupId, 'the invite waits for the group\'s admins (txGroupId = group)');
    ctx.expect(approvalAtSend && approvalAtSend.approval === true, 'the first signature is an approval');

    // 4. Signatures to the threshold (9 admin rows at PCT40: 4).
    const info = await ctx.get(`/groups/${groupId}`);
    const admins = await ctx.get(`/groups/members/${groupId}?onlyAdmins=true&limit=100`);
    const needed = Math.ceil((admins.adminCount * 40) / 100);
    ctx.record('adminRows', admins.adminCount);
    ctx.record('needed', needed);
    ctx.expect(info.approvalThreshold === 'PCT40', 'the group is PCT40');
    const signers = ['admin02', 'admin03', 'admin04'].slice(0, needed - 1);
    for (const label of signers) {
      const page = await ctx.open(label);
      const out = await page.flow('signDecision', inviteSig);
      ctx.expect(out.status === 'sent', `${label} signs`, out);
      await page.close();
    }
    // The app's own view before Core decides: k of n and the expected block.
    const view = await admin1.evaluate(async (sig) => {
      const t = window.__qmpTestnet;
      const { loadDecisions } = await import('/src/data/decisions.ts');
      t.query.invalidate('decisions:');
      const data = await loadDecisions({ force: true });
      const d = data.decisions.find((x) => x.signature === sig);
      return d && { count: d.tally.approvalCount, projected: d.tally.projectedApprovalCount, needed: d.tally.needed, phase: d.phase, window: d.window };
    }, inviteSig);
    ctx.record('appViewAfterSigning', view);
    ctx.expect(view?.needed === needed, 'the app needs the same number of signatures as Core', view);

    // 5. Core approves it by itself; the join request makes the nominee a member at once.
    const approved = await ctx.waitFor(
      async () => {
        const tx = await ctx.tx(inviteSig);
        return tx.approvalStatus === 'APPROVED' ? tx : null;
      },
      { label: 'Core to approve the invite' }
    );
    ctx.record('approvalHeight', approved.approvalHeight);
    ctx.expect(
      approved.approvalHeight >= inviteTx.blockHeight + info.minimumBlockDelay + 1,
      'approval comes no earlier than h + minimumBlockDelay + 1',
      { h: inviteTx.blockHeight, approvalHeight: approved.approvalHeight }
    );
    const member = await ctx.get(`/groups/member/${nominee.address}`).catch(() => []);
    const isMember = (Array.isArray(member) ? member : []).some((g) => g.groupId === groupId);
    ctx.expect(isMember, 'the nominee is a member at once (the join request was in)');
    const stillRequest = (await ctx.get(`/groups/joinrequests/${groupId}`)).some((r) => r.joiner === nominee.address);
    ctx.expect(!stillRequest, 'the join request is used up');
  },
};
