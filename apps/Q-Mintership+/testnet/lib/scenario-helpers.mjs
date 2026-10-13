/**
 * Small helpers the testnet scenarios share (dev-only).
 */

/** One browser page per test account, opened once per scenario. */
export function pages(ctx, group) {
  const open = {};
  return async (label) => (open[label] ??= await ctx.open(label, { group }));
}

/**
 * A proposal with its proposer's own signature (the app's proposeAndSign),
 * confirmed, then signatures from `signers` (the app's signDecision).
 */
export async function proposeSigned(ctx, page, proposer, proposal, signers = []) {
  const p = await page(proposer);
  const out = await p.flow('proposeAndSign', proposal);
  ctx.expect(
    out.proposal.status === 'sent' && out.approval?.status === 'sent',
    `${proposer} proposes ${proposal.kind} and signs it (two Hub steps)`,
    out
  );
  const tx = await ctx.waitForConfirmed(out.proposalSignature);
  for (const label of signers) await sign(ctx, page, label, out.proposalSignature);
  return { sig: out.proposalSignature, height: tx.blockHeight, txGroupId: tx.txGroupId };
}

export async function sign(ctx, page, label, sig) {
  const res = await (await page(label)).flow('signDecision', sig);
  ctx.expect(res.status === 'sent', `${label} signs`, res);
  return res;
}

/** Wait until Core has decided `sig`; returns its transaction. */
export function decided(ctx, sig, timeoutMs = 20 * 60_000) {
  return ctx.waitFor(
    async () => {
      const tx = await ctx.tx(sig);
      return tx.approvalStatus && tx.approvalStatus !== 'PENDING' ? tx : null;
    },
    { label: `Core to decide ${sig.slice(0, 8)}…`, timeoutMs }
  );
}

/** The app's own view of one decision (fresh reads). */
export function appDecision(page, sig) {
  return page.evaluate(async (s) => {
    const { loadDecisions } = await import('/src/data/decisions.ts');
    window.__qmpTestnet.query.invalidate('decisions:');
    const data = await loadDecisions({ force: true });
    const d = data.decisions.find((x) => x.signature === s);
    return d
      ? {
          count: d.tally?.approvalCount,
          rejections: d.tally?.rejectionCount,
          needed: d.tally?.needed,
          adminRows: d.tally?.totalAdmins,
          phase: d.phase,
          applyAtHeight: d.applyAtHeight,
          window: d.window,
        }
      : null;
  }, sig);
}

export async function isMember(ctx, groupId, address) {
  const groups = await ctx.get(`/groups/member/${address}`).catch(() => []);
  return (Array.isArray(groups) ? groups : []).some((g) => g.groupId === groupId);
}

export async function isAdmin(ctx, groupId, address) {
  const admins = await ctx.get(`/groups/members/${groupId}?onlyAdmins=true&limit=100`);
  return (admins.members ?? []).some((m) => m.member === address);
}

export async function banOf(ctx, groupId, address) {
  const bans = await ctx.get(`/groups/bans/${groupId}`);
  return (bans ?? []).find((b) => b.offender === address) ?? null;
}
