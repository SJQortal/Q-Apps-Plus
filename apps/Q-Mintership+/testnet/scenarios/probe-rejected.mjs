/**
 * After Core ends a nomination's invite as REJECTED, the app's fresh reads
 * show the nomination as rejected (group "reject").
 */
export default {
  name: 'probe-rejected',
  title: 'A rejected nomination reads as rejected once the reads are fresh',
  group: 'reject',
  async run(ctx) {
    const groupId = ctx.group('reject').groupId;
    const invites = await ctx.get(`/transactions/search?txType=GROUP_INVITE&txGroupId=${groupId}&confirmationStatus=CONFIRMED&limit=50&reverse=true`);
    const rejected = invites.find((t) => t.approvalStatus === 'REJECTED');
    ctx.expect(rejected, 'a rejected invite exists in the group');
    const p = await ctx.open('nom09', { group: 'reject' });
    const states = await p.evaluate(async (address) => {
      const q = window.__qmpTestnet.query;
      for (const k of ['nominations:', 'decisions:', 'pending:', 'history:', 'tx:', 'qdnsearch:']) q.invalidate(k);
      const { loadNominationsFor } = await import('/src/data/nominations.ts');
      return (await loadNominationsFor(address, { force: true })).map((n) => n.state);
    }, rejected.invitee);
    ctx.record('states', states);
    ctx.expect(states.includes('rejected'), 'the nomination reads as rejected', states);
  },
};
