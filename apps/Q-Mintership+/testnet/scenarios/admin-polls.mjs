/**
 * Minter Admin polls, on a fresh copy of group "rules" (admin02 to admin05
 * and the null owner, 2 signatures needed): questions for the Minter Admins,
 * advisory only, encrypted to them by the test signer with Hub's own group
 * encryption (lib/encryption.mjs).
 *
 * P  admin02 asks a poll in the app: encrypted to the four Minter Admins who
 *    can sign. Its QDN record is there for anyone; its content isn't.
 * V  admin03 votes Yes, admin04 No, admin05 Neutral: admin02 reads 1/1/1
 *    and who voted what.
 * M  nom11, a member who isn't a Minter Admin, can't read it: the app lists
 *    nothing for them, the app's own decrypt is "locked", Hub's DECRYPT_DATA
 *    fails, and the poll's link reads "This is for Minter Admins only".
 * C  admin04 comments (encrypted the same way); admin05 reads it.
 * N  nom12 becomes a Minter Admin (proposes themselves; admin02 and admin03
 *    sign). The poll wasn't encrypted to them, so they can't read it until
 *    admin03 shares it with the Minter Admins added since. From the share
 *    they read the poll, its votes and the comment, then vote Yes: 2/1/1.
 * E  a 1-day poll ends a day of measured blocks after it was asked; with the
 *    page's clock moved past that end, the app refuses a vote before Hub.
 */
import { decided, freshGroup, isAdmin, pages, sign } from '../lib/scenario-helpers.mjs';

const DAY = 86_400_000;
const QUESTION = 'Should only level 5+ minters become Minter Admins?';
const DETAILS = 'Testnet poll. Advisory: nothing changes on chain from the result.';
const COMMENT = 'Testnet: I lean towards yes, with a grace period for the current admins.';
const SHORT_QUESTION = 'Testnet: a one-day poll, to check that voting ends with it.';

/** One poll as the viewer of page `p` reads it in the app (fresh reads), or null when it isn't listed. */
function readView(p, pollId) {
  return p.evaluate(
    async ({ id, viewer }) => {
      const q = window.__qmpTestnet.query;
      for (const k of ['group:', 'adminpolls:', 'qdnsearch:']) q.invalidate(k);
      const { loadAdminPolls, pollContext } = await import('/src/data/adminPolls.ts');
      const { assemblePolls } = await import('/src/rules/adminPolls.ts');
      const data = await loadAdminPolls(viewer, { force: true });
      const v = assemblePolls(data.sources, pollContext(data)).find((x) => x.id === id);
      if (!v) return null;
      return {
        question: v.poll.question,
        createdAt: v.poll.createdAt,
        endsAt: v.poll.endsAt,
        publisher: v.publisher.name,
        sharedBy: v.sharedBy?.name ?? null,
        open: v.open,
        counts: v.counts,
        votes: v.votes
          .map((x) => ({ name: x.name, vote: x.vote, via: x.via }))
          .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
        myVote: v.myVote?.vote ?? null,
        readers: [...v.readers].sort(),
        missing: v.missing,
        commentRows: v.commentRows.length,
        shareComments: v.shareComments.map((c) => ({ name: c.name, text: c.text })),
      };
    },
    { id: pollId, viewer: p.signer.address }
  );
}

export default {
  name: 'admin-polls',
  title: 'Minter Admin polls: ask, vote (1/1/1), a member locked out, comments, a share for a new admin (2/1/1), the end of voting',
  group: 'rules',
  async run(ctx) {
    const key = await freshGroup('rules');
    const groupId = ctx.group(key).groupId;
    const page = pages(ctx, key);
    const A = (l) => ctx.account(l).address;
    const nameOf = async (l) => (await page(l)).signer.name;
    const rows = async () => (await ctx.get(`/groups/members/${groupId}?onlyAdmins=true&limit=100`)).adminCount;
    const needed = async () => Math.ceil(((await rows()) * 40) / 100);
    const flow = async (label, name, ...args) => (await page(label)).flow(name, ...args);
    // A poll write (one Hub step), confirmed.
    const sent = async (write, what) => {
      ctx.expect(write.outcome.status === 'sent', what, write.outcome);
      return ctx.waitForConfirmed(write.outcome.signature);
    };
    const view = (label, pollId) => page(label).then((p) => readView(p, pollId));
    // Wait until `label` reads the poll and `ok` holds (QDN lists a record once it is in a block).
    const seen = (label, pollId, ok, what) =>
      ctx.waitFor(
        async () => {
          const v = await view(label, pollId);
          return v && ok(v) ? v : null;
        },
        { label: what, timeoutMs: 10 * 60_000 }
      );
    // The app's own decrypt of one record for `label` ('ok', 'locked', 'unavailable' or 'invalid').
    const bodyStatus = (label, row) =>
      ctx.waitFor(
        async () => {
          const p = await page(label);
          const status = await p.evaluate(
            async ({ viewer, r }) => {
              const { readPollBody } = await import('/src/data/adminPolls.ts');
              return (await readPollBody(viewer, r)).status;
            },
            { viewer: p.signer.address, r: row }
          );
          return status === 'unavailable' ? null : status;
        },
        { label: `${label}'s read of ${row.identifier}`, timeoutMs: 10 * 60_000 }
      );
    // The thread of a poll as `label` reads it: each comment's name and text.
    const thread = (label, pollId) =>
      page(label).then((p) =>
        p.evaluate(
          async ({ id, viewer }) => {
            const q = window.__qmpTestnet.query;
            for (const k of ['group:', 'adminpolls:', 'qdnsearch:']) q.invalidate(k);
            const { loadAdminPolls, loadPollThread, pollContext } = await import('/src/data/adminPolls.ts');
            const { assemblePolls } = await import('/src/rules/adminPolls.ts');
            const data = await loadAdminPolls(viewer, { force: true });
            const v = assemblePolls(data.sources, pollContext(data)).find((x) => x.id === id);
            if (!v) return [];
            const bodies = await loadPollThread(viewer, id, v.commentRows, 20, { force: true });
            return v.commentRows.map((row) => {
              const body = bodies.get(row.ref);
              return { name: row.name, status: body?.status ?? 'none', text: body?.status === 'ok' ? (body.value?.text ?? null) : null };
            });
          },
          { id: pollId, viewer: p.signer.address }
        )
      );
    const opened = [];
    const openPage = async (label, route) => {
      const v = await ctx.open(label, { group: key, route });
      opened.push(v);
      return v;
    };
    const shows = (locator) => locator.first().waitFor({ timeout: 120_000 }).then(() => true, () => false);

    const asker = await nameOf('admin02');
    const voters = { admin03: 'yes', admin04: 'no', admin05: 'neutral' };
    const names = Object.fromEntries(await Promise.all(['admin03', 'admin04', 'admin05', 'nom12'].map(async (l) => [l, await nameOf(l)])));

    // P: admin02 asks.
    const ask = await flow('admin02', 'publishAdminPoll', { question: QUESTION, details: DETAILS, durationDays: 7 });
    const askTx = await sent(ask, 'P: admin02 asks the Minter Admins (one Hub step, encrypted)');
    const pollId = ask.pollId;
    ctx.record('poll', { pollId, identifier: ask.identifier, height: askTx.blockHeight, endsAt: ask.poll?.endsAt, endHeight: ask.poll?.endHeight });
    const admins = ['admin02', 'admin03', 'admin04', 'admin05'].map(A).sort();
    ctx.expect(
      JSON.stringify([...(ask.poll?.readers ?? [])].sort()) === JSON.stringify(admins),
      'it is encrypted to the four Minter Admins who can sign (not the null owner, not members)',
      ask.poll?.readers
    );
    const pollRow = { name: asker, identifier: ask.identifier, created: ask.poll?.createdAt ?? Date.now() };
    const encrypted = await (await page('admin02')).evaluate(
      async ({ n, id }) => {
        const { fetchQdnText } = await import('/src/data/qdn.ts');
        return (await fetchQdnText('DOCUMENT_PRIVATE', n, id, { encoding: 'base64' })).trim();
      },
      { n: asker, id: ask.identifier }
    );
    ctx.expect(
      Buffer.from(encrypted, 'base64').subarray(0, 24).toString('latin1') === 'qortalGroupEncryptedData',
      'on QDN the record is there for anyone, its content encrypted as Hub encrypts it'
    );
    const opensFor05 = await ctx.hub('admin05', { action: 'DECRYPT_DATA', encryptedData: encrypted });
    ctx.expect(
      JSON.parse(Buffer.from(opensFor05, 'base64').toString('utf8')).question === QUESTION,
      "Hub's DECRYPT_DATA opens it for another Minter Admin (admin05)"
    );
    const first = await seen('admin02', pollId, () => true, 'admin02 to read their poll');
    ctx.expect(first.open && first.question === QUESTION && first.publisher === asker, 'admin02 reads it as open, asked by them', first);

    // V: three votes, one Hub step each.
    await Promise.all(Object.keys(voters).map((l) => seen(l, pollId, (v) => v.open, `${l} to read the poll`)));
    await Promise.all(
      Object.entries(voters).map(async ([l, v]) => sent(await flow(l, 'voteAdminPoll', pollId, v), `V: ${l} votes ${v}`))
    );
    const tallied = await seen('admin02', pollId, (v) => v.votes.length === 3, 'admin02 to read the three votes');
    ctx.record('countsFor02', { counts: tallied.counts, votes: tallied.votes });
    ctx.expect(
      tallied.counts.yes === 1 && tallied.counts.no === 1 && tallied.counts.neutral === 1,
      'admin02 reads 1 Yes, 1 No, 1 Neutral',
      tallied.counts
    );
    const expectedVotes = Object.entries(voters)
      .map(([l, vote]) => ({ name: names[l], vote }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    ctx.expect(
      JSON.stringify(tallied.votes.map(({ name, vote }) => ({ name, vote }))) === JSON.stringify(expectedVotes),
      'and who voted what',
      tallied.votes
    );
    ctx.expect(tallied.myVote === null, 'admin02 hasn’t voted', tallied.myVote);
    const askerPage = await openPage('admin02', `/decisions/polls/${pollId}`);
    ctx.check(await shows(askerPage.page.getByText(QUESTION)), 'the poll’s link opens it on its own page for admin02');

    // M: a member who isn't a Minter Admin.
    const member = await (await page('nom11')).evaluate(async (viewer) => {
      const q = window.__qmpTestnet.query;
      for (const k of ['group:', 'adminpolls:', 'qdnsearch:']) q.invalidate(k);
      const { loadAdminPolls } = await import('/src/data/adminPolls.ts');
      const data = await loadAdminPolls(viewer, { force: true });
      return { listed: data.sources.length, isSigner: data.signers.includes(viewer) };
    }, A('nom11'));
    ctx.record('nom11List', member);
    ctx.expect(member.listed === 0 && !member.isSigner, 'M: the app lists no Minter Admin polls for nom11 and reads none', member);
    const nom11Body = await bodyStatus('nom11', pollRow);
    ctx.expect(nom11Body === 'locked', 'the app’s own decrypt as nom11 is locked: the poll isn’t encrypted to them', nom11Body);
    const nom11Hub = await ctx
      .hub('nom11', { action: 'DECRYPT_DATA', encryptedData: encrypted })
      .then(() => 'decrypted', (e) => e?.message ?? String(e));
    ctx.expect(nom11Hub === 'Unable to decrypt', "Hub's DECRYPT_DATA fails for nom11", nom11Hub);
    const memberPage = await openPage('nom11', `/decisions/polls/${pollId}`);
    ctx.check(await shows(memberPage.page.getByText('This is for Minter Admins only')), 'nom11’s link to the poll reads “This is for Minter Admins only”');

    // C: a comment, encrypted like the poll, read by another admin.
    await sent(await flow('admin04', 'commentAdminPoll', pollId, { text: COMMENT }), 'C: admin04 comments on the poll');
    const comments = await ctx.waitFor(
      async () => {
        const t = await thread('admin05', pollId);
        return t.some((c) => c.text === COMMENT) ? t : null;
      },
      { label: 'admin05 to read the comment', timeoutMs: 10 * 60_000 }
    );
    ctx.record('threadFor05', comments);
    ctx.expect(comments.some((c) => c.name === names.admin04 && c.text === COMMENT), 'admin05 reads admin04’s comment');

    // N: nom12 becomes a Minter Admin.
    const self = await flow('nom12', 'proposeAndSign', { kind: 'addAdmin', subject: A('nom12') });
    ctx.expect(self.proposal.status === 'sent' && self.withSignature === false, 'N: nom12 proposes themselves as Minter Admin (one Hub step)', self.proposal);
    await ctx.waitForConfirmed(self.proposalSignature);
    for (const l of ['admin02', 'admin03'].slice(0, await needed())) await sign(ctx, page, l, self.proposalSignature);
    const became = await decided(ctx, self.proposalSignature);
    ctx.record('nom12Becomes', [became.approvalStatus, became.approvalHeight]);
    ctx.expect(became.approvalStatus === 'APPROVED' && (await isAdmin(ctx, groupId, A('nom12'))), 'nom12 is a Minter Admin');

    // Not encrypted to them: nothing to read until someone shares it.
    const nom12Body = await bodyStatus('nom12', pollRow);
    ctx.expect(nom12Body === 'locked', 'the poll itself stays locked for nom12 (it was encrypted before they were an admin)', nom12Body);
    const unshared = await view('nom12', pollId);
    ctx.expect(unshared === null, 'the app doesn’t list it for nom12 yet', unshared);
    const sharer = await seen('admin03', pollId, (v) => v.missing.includes(A('nom12')), 'admin03 to see nom12 among the Minter Admins added since');
    ctx.record('missingBeforeShare', sharer.missing);
    const sharePage = await openPage('admin03', `/decisions/polls/${pollId}`);
    ctx.check(
      await shows(sharePage.page.getByRole('button', { name: /Share with 1 Minter Admin added since/ })),
      'admin03’s poll page offers “Share with 1 Minter Admin added since”'
    );
    const share = await flow('admin03', 'shareAdminPoll', pollId);
    await sent(share, 'admin03 shares the poll with the Minter Admins added since (one Hub step)');
    ctx.expect(share.readers.includes(A('nom12')), 'the share is encrypted to nom12 too', share.readers);
    const fromShare = await seen('nom12', pollId, (v) => v.sharedBy === names.admin03 && v.votes.length === 3, 'nom12 to read the poll from admin03’s share');
    ctx.record('nom12FromShare', fromShare);
    ctx.expect(fromShare.question === QUESTION && fromShare.publisher === asker, 'nom12 reads the poll, asked by admin02, shared by admin03');
    ctx.expect(
      fromShare.counts.yes === 1 && fromShare.counts.no === 1 && fromShare.counts.neutral === 1,
      'with its votes from the share: 1 Yes, 1 No, 1 Neutral',
      fromShare.counts
    );
    ctx.expect(fromShare.shareComments.some((c) => c.name === names.admin04 && c.text === COMMENT), 'and admin04’s comment', fromShare.shareComments);
    const sharedPage = await openPage('nom12', `/decisions/polls/${pollId}`);
    ctx.check(await shows(sharedPage.page.getByText(/Shared by/)), 'nom12’s poll page says it is shared by admin03');

    await sent(await flow('nom12', 'voteAdminPoll', pollId, 'yes'), 'nom12 votes Yes');
    const after02 = await seen('admin02', pollId, (v) => v.votes.length === 4, 'admin02 to count nom12’s vote');
    ctx.record('countsAfterShare', { admin02: after02.counts });
    ctx.expect(
      after02.counts.yes === 2 && after02.counts.no === 1 && after02.counts.neutral === 1,
      'admin02 reads 2 Yes, 1 No, 1 Neutral',
      after02.counts
    );
    ctx.expect(after02.missing.length === 0, 'every Minter Admin can read it now (the poll or the share)', after02.missing);
    const after12 = await seen('nom12', pollId, (v) => v.myVote === 'yes', 'nom12 to read their own vote');
    ctx.expect(
      after12.counts.yes === 2 && after12.counts.no === 1 && after12.counts.neutral === 1,
      'nom12 reads 2/1/1 too',
      after12.counts
    );

    // E: the end of voting, on a 1-day poll.
    const short = await flow('admin05', 'publishAdminPoll', { question: SHORT_QUESTION, durationDays: 1 });
    await sent(short, 'E: admin05 asks a 1-day poll');
    const lasts = short.poll.endsAt - short.poll.createdAt;
    ctx.record('oneDayPoll', { pollId: short.pollId, endsAt: short.poll.endsAt, endHeight: short.poll.endHeight, lastsMs: lasts });
    ctx.expect(lasts >= DAY && lasts < DAY + 10 * 60_000, 'it ends a day of measured blocks after it was asked', lasts);
    // A page of its own: its clock moves.
    const clock = await openPage('admin04', '/');
    const open = await ctx.waitFor(
      async () => {
        const v = await readView(clock, short.pollId);
        return v?.open ? v : null;
      },
      { label: 'admin04 to read the 1-day poll', timeoutMs: 10 * 60_000 }
    );
    ctx.expect(open.open, 'admin04 reads it as open');
    const guard = await clock.evaluate(async (poll) => {
      const { guardPollOpen } = await import('/src/writes/adminPolls.ts');
      return { before: guardPollOpen(poll, poll.endsAt - 1), at: guardPollOpen(poll, poll.endsAt) };
    }, short.poll);
    ctx.record('endGuard', guard);
    ctx.expect(guard.before === null && typeof guard.at === 'string', 'voting is open until its end and closed from it', guard);
    const late = await clock.evaluate(
      async ({ id, signer, shift }) => {
        const realNow = Date.now;
        Date.now = () => realNow.call(Date) + shift;
        try {
          return (await window.__qmpTestnet.flows.voteAdminPoll(signer, id, 'yes')).outcome;
        } finally {
          Date.now = realNow;
        }
      },
      { id: short.pollId, signer: clock.signer, shift: short.poll.endsAt + 60_000 - Date.now() }
    );
    ctx.record('voteAfterEnd', late);
    ctx.expect(late.status === 'blocked' && /ended/.test(late.reason), 'with the clock past its end, the app refuses a vote before Hub', late);

    ctx.check(
      opened.every((v) => v.errors.length === 0),
      'no console errors on the poll pages',
      opened.map((v) => v.errors.slice(0, 2))
    );
  },
};
