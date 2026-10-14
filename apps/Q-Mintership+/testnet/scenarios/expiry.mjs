/**
 * Expiry: a nomination's invite with too few signatures runs out at exactly
 * h + maximumBlockDelay + 1; the app's countdown and window match Core; a
 * signature after the last useful block is refused ("too late"); once
 * expired, the nominee can be nominated again.
 */
export default {
  name: 'expiry',
  title: 'Expiry at h+max+1, the too-late guard, and Nominate again',
  group: 'main',
  async run(ctx) {
    const groupId = ctx.group('main').groupId;
    const info = await ctx.get(`/groups/${groupId}`);
    const [nomineeLabel] = await ctx.fresh('ex-', 1, '2');
    const nominee = ctx.account(nomineeLabel);
    ctx.record('nominee', nominee.address);

    const nominator = await ctx.open('nom02');
    const published = await nominator.flow('publishNomination', {
      nomineeAddress: nominee.address,
      reason: 'Has run a node for months; let this one run out to test expiry.',
      links: [],
    });
    ctx.expect(published.status === 'sent', 'the nomination record is published', published);

    const admin = await ctx.open('admin08');
    const first = await admin.flow('firstSignature', nominee.address);
    ctx.expect(first.invite.status === 'sent' && first.approval?.status === 'sent', 'invite and first signature sent', first);
    const invite = await ctx.waitForConfirmed(first.inviteSignature);
    const h = invite.blockHeight;
    const expected = {
      earliestDecision: h + info.minimumBlockDelay + 1,
      lastUsefulSignature: h + info.maximumBlockDelay - 1,
      expires: h + info.maximumBlockDelay + 1,
    };
    ctx.record('inviteHeight', h);
    ctx.record('expected', expected);

    const appWindow = await admin.evaluate(async (sig) => {
      const { loadDecisions } = await import('/src/data/decisions.ts');
      window.__qmpTestnet.query.invalidate('decisions:');
      const data = await loadDecisions({ force: true });
      const d = data.decisions.find((x) => x.signature === sig);
      return d?.window ?? null;
    }, first.inviteSignature);
    ctx.record('appWindow', appWindow);
    ctx.expect(appWindow?.expiresAtHeight === expected.expires, 'the app expects expiry at h + max + 1', appWindow);
    ctx.expect(
      appWindow?.lastUsefulSignatureHeight === expected.lastUsefulSignature,
      'the app puts the last useful signature at h + max − 1',
      appWindow
    );

    // After the last useful block, a signature is refused before Hub is asked.
    await ctx.waitForHeight(expected.lastUsefulSignature, { timeoutMs: 90 * 60_000 });
    const late = await ctx.open('admin07');
    const tooLate = await late.flow('signDecision', first.inviteSignature);
    ctx.record('tooLateOutcome', tooLate);
    ctx.expect(tooLate.status === 'blocked' && /too late/i.test(tooLate.reason ?? ''), 'a late signature is refused');

    // Core expires it at exactly h + max + 1.
    const expired = await ctx.waitFor(
      async () => {
        const tx = await ctx.tx(first.inviteSignature);
        return tx.approvalStatus === 'EXPIRED' ? tx : null;
      },
      { label: 'Core to expire the invite', timeoutMs: 20 * 60_000 }
    );
    ctx.record('expiredAt', expired.approvalHeight);
    ctx.expect(expired.approvalHeight === expected.expires, 'Core expires it at h + max + 1', {
      approvalHeight: expired.approvalHeight,
      expected: expected.expires,
    });

    // Nominate again: the old record's invite is done, a new first signature is allowed.
    const state = await nominator.evaluate(async (address) => {
      const { loadNominationsFor } = await import('/src/data/nominations.ts');
      window.__qmpTestnet.query.invalidate('nominations:');
      const list = await loadNominationsFor(address, { force: true });
      return list.map((n) => n.state);
    }, nominee.address);
    ctx.record('appNominationStates', state);
    ctx.check(state.includes('expired'), 'the app shows the nomination as expired', state);
    const again = await nominator.flow('publishNomination', {
      nomineeAddress: nominee.address,
      reason: 'Nominating again after the first round ran out; still a good minter.',
      links: [],
    });
    ctx.expect(again.status === 'sent', 'Nominate again publishes a new record', again);
    const second = await admin.flow('firstSignature', nominee.address);
    ctx.expect(second.invite.status === 'sent', 'a new invite can be made after expiry', second.invite);
    ctx.record('secondInvite', second.inviteSignature);
  },
};
