import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADMIN_POLL_IDS, NULL_OWNER, answerDecrypt, fakeAddress } from '../../../e2e/world.mjs';
import { fromData64 } from '../../data/adminPollRecords';
import { resetPendingPollWrites } from '../../state/adminPolls';
import { resetOptimisticComments } from '../../state/comments';
import { serveAdminPolls, withAdminPolls } from '../../test/adminPolls';
import { expectNoAxeViolations } from '../../test/axe';
import { checkDialogByKeyboard } from '../../test/keyboard';
import { renderPage, type RenderPageOptions } from '../../test/render';
import { fetchCallsFor, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import DecisionsPage from './DecisionsPage';

beforeEach(() => {
  resetPendingPollWrites();
  resetOptimisticComments();
});
afterEach(() => vi.useRealTimers());
vi.setConfig({ testTimeout: 30_000 });

const user = () => userEvent.setup();
const T = { timeout: 6000 };
const OPEN_Q = 'Should only level 5+ minters become Minter Admins?';
const VOTED_Q =
  'Should we remove members who were active before joining MINTER and went inactive after?';
const CLOSED_Q = 'Should Minter Admins review the stale invites together once a month?';
const SHARED_Q = 'Should a nomination wait 48 hours before its first approval?';
const extra = (i: number) => fakeAddress(`admin-${i}`);

async function openDecisions(persona = 'admin', setup?: RenderPageOptions['setup']) {
  const rendered = await renderPage(<DecisionsPage />, {
    persona,
    path: '/decisions',
    route: '/decisions',
    setup: setup ?? withAdminPolls(persona),
  });
  await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ }, T);
  return rendered;
}

const polls = () => screen.findByRole('region', { name: /^Minter Admin polls/ }, T);
const pollCard = (question: string) =>
  screen.findByRole('article', { name: `Minter Admin poll: ${question}` }, T);
const sent = () =>
  mockQortalRequest('PUBLISH_QDN_RESOURCE', (request: Record<string, unknown>) => ({
    type: 'ARBITRARY',
    signature: 'S1',
    identifier: request.identifier,
  }));
const publishes = () => qortalCallsFor('PUBLISH_QDN_RESOURCE');
const signerCount = 19;
/** The Yes / No / Neutral counts of a card's vote columns, in order: "Yes: 3". */
const counts = (card: HTMLElement) =>
  within(card)
    .getAllByRole('heading', { level: 4, name: /^(Yes|No|Neutral)\s*\d+$/ })
    .map((h) => (h.textContent ?? '').replace(/^(\D+?)\s*(\d+)$/, '$1: $2'));
/** Who is in a vote's column, by the names of their links. */
const voters = (card: HTMLElement, vote: string) =>
  within(within(card).getByRole('list', { name: new RegExp(`^Voted ${vote}: `) }))
    .getAllByRole('link')
    .map((a) => a.getAttribute('aria-label')?.replace(/: open their page$/, ''));

describe('Decisions → Minter Admin polls', () => {
  it('Hide already voted on leaves out the polls the admin voted on, with a note to show them', async () => {
    const u = userEvent.setup();
    await openDecisions();
    await pollCard(CLOSED_Q);
    const hide = screen.getByRole('switch', { name: 'Hide already voted on' });
    await u.click(hide);
    const section = await polls();
    // Avery voted on the closed one and on one open one; the other open ones wait for a vote.
    await waitFor(() =>
      expect(
        within(section).queryByRole('article', { name: `Minter Admin poll: ${CLOSED_Q}` })
      ).toBeNull()
    );
    expect(
      within(section).queryByRole('article', { name: `Minter Admin poll: ${VOTED_Q}` })
    ).toBeNull();
    expect(
      within(section).getByRole('article', { name: `Minter Admin poll: ${OPEN_Q}` })
    ).toBeVisible();
    expect(within(section).getByText('2 polls you already voted on are hidden.')).toBeVisible();
    await u.click(
      within(section).getByRole('button', { name: 'Show them: the polls you already voted on' })
    );
    expect(
      await within(section).findByRole('article', { name: `Minter Admin poll: ${CLOSED_Q}` })
    ).toBeVisible();
    expect(hide).not.toBeChecked();
    expect(hide).toHaveFocus();
  });

  it('lists the polls an admin can read: open first (soonest end), then closed', async () => {
    await openDecisions();
    const section = await polls();
    expect(section).toHaveAccessibleName('Minter Admin polls · 4');
    await within(section).findByRole('article', { name: `Minter Admin poll: ${OPEN_Q}` }, T);
    const order = within(section)
      .getAllByRole('article')
      .map((a) => a.getAttribute('aria-label'));
    expect(order).toEqual([
      `Minter Admin poll: ${OPEN_Q}`,
      `Minter Admin poll: ${SHARED_Q}`,
      `Minter Admin poll: ${VOTED_Q}`,
      `Minter Admin poll: ${CLOSED_Q}`,
    ]);
    // Said once above the list, and on every card.
    expect(
      within(section).getAllByText(/Advisory: nothing changes on chain from the result\./)
    ).toHaveLength(5);
    // The one never encrypted to Avery, and a member's, aren't there.
    expect(within(section).queryByText(/never encrypted to Avery/)).toBeNull();
    expect(within(section).queryByText(/someone who is not a Minter Admin/)).toBeNull();
    expect(within(section).getByText('1 poll closed in the last 31 days')).toBeVisible();
  });

  it('a card: who asked, when it ends, the counts and who voted what; no pass or fail', async () => {
    await openDecisions();
    const card = await pollCard(OPEN_Q);
    expect(within(card).getByText('Open')).toBeVisible();
    expect(within(card).getByText('Minter Admins only')).toBeVisible();
    expect(within(card).getByText(/^Asked by/)).toHaveTextContent(/Admin B\s*1 day 23 hours ago/);
    expect(within(card).getByText(/^Ends in 5 days · .*\(about block 2,763,427\)$/)).toBeVisible();
    // Yes, No and Neutral side by side, each with its count and who voted it, by name.
    expect(counts(card)).toEqual(['Yes: 3', 'No: 2', 'Neutral: 1']);
    expect(voters(card, 'Yes')).toEqual(['Admin B', 'Admin C', 'Dex Demote']);
    expect(voters(card, 'No')).toEqual(['Juniper L4', 'Admin F']);
    expect(
      within(card).getByText(`13 of ${signerCount} Minter Admins haven't voted`)
    ).toBeVisible();
    expect(within(card).queryByText(/passed|failed|rejected/i)).toBeNull();
    // Avery hasn't voted: Yes, No and Neutral, each named for the poll.
    for (const v of ['Yes', 'No', 'Neutral'])
      expect(within(card).getByRole('button', { name: `Vote ${v}: ${OPEN_Q}` })).toBeVisible();
    expect(
      within(card).getByRole('button', { name: `Copy link to the poll ${OPEN_Q}` })
    ).toBeVisible();
  });

  it('a poll read from a share says whose copy; a closed one, the vote that came late', async () => {
    await openDecisions();
    const shared = await pollCard(SHARED_Q);
    expect(within(shared).getByText(/Shared by/)).toHaveTextContent(
      /Shared by\s*A?Admin D ΑΩ: you read their copy\./
    );
    expect(counts(shared)).toEqual(['Yes: 1', 'No: 1', 'Neutral: 1']);
    const closed = await pollCard(CLOSED_Q);
    expect(within(closed).getByText('Closed')).toBeVisible();
    expect(within(closed).getByText(/^Ended 4 days ago · /)).toBeVisible();
    expect(within(closed).getByText('1 vote came after the end and doesn’t count.')).toBeVisible();
    expect(within(closed).getByText('You voted Neutral')).toBeVisible();
    // Voting has ended: no buttons.
    expect(within(closed).queryByRole('button', { name: /^Vote / })).toBeNull();
    expect(within(closed).queryByRole('button', { name: /^Change your vote/ })).toBeNull();
  });

  it('a vote the viewer can’t read, and no share carries, is a vote, not in the counts', async () => {
    await openDecisions(
      'admin',
      withAdminPolls('admin', (world) => {
        const signers = world.admins.filter((a: string) => a !== NULL_OWNER);
        world.adminPollRecords.push({
          name: 'Admin N',
          identifier: `qmp-adminvote-${ADMIN_POLL_IDS.shared}`,
          created: Date.now() - 2 * 86_400_000,
          // Encrypted to everyone but Avery (the first admin row), and in no share.
          readers: signers.filter((a: string) => a !== world.admins[0]),
          body: { v: 1, pollId: ADMIN_POLL_IDS.shared, vote: 'yes' },
        });
      })
    );
    const shared = await pollCard(SHARED_Q);
    expect(counts(shared)).toEqual(['Yes: 1', 'No: 1', 'Neutral: 1']);
    expect(
      within(shared).getByText('1 vote you can’t read yet isn’t in these counts.')
    ).toBeVisible();
    expect(
      within(shared).getByText(`15 of ${signerCount} Minter Admins haven't voted`)
    ).toBeVisible();
  });

  it('reads: four searches of 100 for the whole section, bodies decrypted in Hub', async () => {
    await openDecisions();
    await pollCard(OPEN_Q);
    const searches = fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
      p.includes('DOCUMENT_PRIVATE')
    );
    expect(searches).toHaveLength(4);
    expect(searches.every((p) => /limit=100/.test(p) && /reverse=true/.test(p))).toBe(true);
    expect(qortalCallsFor('DECRYPT_DATA').length).toBeGreaterThan(0);
    expect(publishes()).toHaveLength(0);
  });

  it('members see no polls, read none and can’t propose one', async () => {
    await openDecisions('learner');
    expect(screen.queryByRole('region', { name: /^Minter Admin polls/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Propose' })).toBeNull();
    expect(
      fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
        p.includes('DOCUMENT_PRIVATE')
      )
    ).toHaveLength(0);
    expect(qortalCallsFor('DECRYPT_DATA')).toHaveLength(0);
  });

  it('nothing to show: says so, with Ask the Minter Admins', async () => {
    const u = user();
    await openDecisions('admin', () => undefined);
    const section = await polls();
    expect(
      await within(section).findByText('No Minter Admin polls in the last 31 days', {}, T)
    ).toBeVisible();
    await u.click(within(section).getByRole('button', { name: 'Ask the Minter Admins' }));
    expect(await screen.findByRole('dialog', { name: 'Ask the Minter Admins' }, T)).toBeVisible();
  });

  it('Ask from the empty section: focus comes back to its button, not to Propose', async () => {
    const u = user();
    await openDecisions('admin', () => undefined);
    const section = await polls();
    const ask = await within(section).findByRole('button', { name: 'Ask the Minter Admins' }, T);
    // A click that doesn't focus the button, as in Safari: the dialog can't tell who opened it.
    fireEvent.click(ask);
    const form = await screen.findByRole('dialog', { name: 'Ask the Minter Admins' }, T);
    await u.type(
      within(form).getByRole('textbox', { name: 'Question' }),
      'Should we keep a shared minting checklist?'
    );
    await u.click(within(form).getByRole('button', { name: 'Review' }));
    const hub = await screen.findByRole('dialog', { name: 'Ask the Minter Admins' }, T);
    await u.keyboard('{Escape}');
    await waitFor(() => expect(hub).not.toBeInTheDocument(), T);
    await waitFor(() => expect(ask).toHaveFocus(), T);
  });

  it('a poll asked from the empty section: focus goes to the section that now lists it', async () => {
    const u = user();
    // No polls, but the admins' keys are there to encrypt to.
    await openDecisions('admin', (world) => serveAdminPolls(world, 'admin'));
    sent();
    const section = await polls();
    await u.click(await within(section).findByRole('button', { name: 'Ask the Minter Admins' }, T));
    const form = await screen.findByRole('dialog', { name: 'Ask the Minter Admins' }, T);
    await u.type(
      within(form).getByRole('textbox', { name: 'Question' }),
      'Should we keep a shared minting checklist?'
    );
    await u.click(within(form).getByRole('button', { name: 'Review' }));
    const hub = await screen.findByRole('dialog', { name: 'Ask the Minter Admins' }, T);
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    await u.click(await within(hub).findByRole('button', { name: 'Done' }, T));
    await waitFor(() => expect(hub).not.toBeInTheDocument(), T);
    await waitFor(() => expect(section).toHaveFocus(), T);
    expect(screen.getByRole('button', { name: 'Propose' })).not.toHaveFocus();
  });

  it('Hub not decrypting (its wallet locked): says so with Retry, never "no polls"', async () => {
    const u = user();
    let walletLocked = true;
    await openDecisions('admin', (world) => {
      withAdminPolls('admin')(world);
      mockQortalRequest('DECRYPT_DATA', (request: Record<string, unknown>) => {
        if (walletLocked) throw new Error('Wallet not authenticated');
        return answerDecrypt(world, 'admin', request);
      });
    });
    const section = await polls();
    expect(
      await within(section).findByText(/Couldn’t decrypt the Minter Admin polls\./, {}, T)
    ).toBeVisible();
    expect(
      within(section).getByText(/If Hub is locked, unlock it, then try again\./)
    ).toBeVisible();
    expect(within(section).queryByText('No Minter Admin polls in the last 31 days')).toBeNull();
    walletLocked = false;
    await u.click(within(section).getByRole('button', { name: 'Retry' }));
    expect(
      await within(section).findByRole('article', { name: `Minter Admin poll: ${OPEN_Q}` }, T)
    ).toBeVisible();
  });

  it('the section passes axe', async () => {
    await openDecisions();
    await pollCard(OPEN_Q);
    await expectNoAxeViolations(await polls());
  });
});

describe('voting', () => {
  it('Vote Yes: explained first, one encrypted publish, then "Voted Yes ✓ (confirming…)"', async () => {
    const u = user();
    const { world } = await openDecisions();
    sent();
    const card = await pollCard(OPEN_Q);
    await u.click(within(card).getByRole('button', { name: `Vote Yes: ${OPEN_Q}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Vote Yes' });
    expect(within(dialog).getByText(OPEN_Q)).toBeVisible();
    expect(within(dialog).getByText(/only your latest vote counts/)).toBeVisible();
    expect(
      within(dialog).getByText(`Publish your vote, encrypted to the ${signerCount} Minter Admins`)
    ).toBeVisible();
    expect(within(dialog).getByText('It says isEncrypted: true.')).toBeInTheDocument();
    expect(within(dialog).getByText('The service is DOCUMENT_PRIVATE.')).toBeInTheDocument();
    expect(within(dialog).getByText(/Fee: 0.01 QORT/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Advisory: nothing changes on chain/)).toBeVisible();
    expect(publishes()).toHaveLength(0);
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Vote published', {}, T)).toBeVisible();
    const call = publishes()[0];
    expect(call).toMatchObject({
      action: 'PUBLISH_QDN_RESOURCE',
      name: 'Avery Admin',
      service: 'DOCUMENT_PRIVATE',
      identifier: `qmp-adminvote-${ADMIN_POLL_IDS.open}`,
      encrypt: true,
    });
    const keys = world.admins
      .filter((a: string) => a !== NULL_OWNER)
      .map((a: string) => world.accounts.get(a).publicKey);
    expect(new Set(call.publicKeys as string[])).toEqual(new Set(keys));
    expect(fromData64(String(call.data64))).toEqual({
      v: 1,
      pollId: ADMIN_POLL_IDS.open,
      vote: 'yes',
    });
    await u.click(within(dialog).getByRole('button', { name: 'Done' }));
    const after = await pollCard(OPEN_Q);
    expect(await within(after).findByText('You voted Yes ✓ (confirming…)', {}, T)).toBeVisible();
    expect(within(after).getByText('Change your vote:')).toBeVisible();
    expect(
      within(after).getByRole('button', { name: `Change your vote to No: ${OPEN_Q}` })
    ).toBeVisible();
    expect(within(after).queryByRole('button', { name: `Vote Yes: ${OPEN_Q}` })).toBeNull();
    // Focus went back to the card.
    await waitFor(() => expect(after).toHaveFocus(), T);
  });

  it('changing a vote says so, and republishes the same identifier', async () => {
    const u = user();
    await openDecisions();
    sent();
    const card = await pollCard(VOTED_Q);
    expect(within(card).getByText('You voted No ✓')).toBeVisible();
    await u.click(
      within(card).getByRole('button', { name: `Change your vote to Yes: ${VOTED_Q}` })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Change your vote to Yes' });
    expect(within(dialog).getByText(/It replaces your earlier vote/)).toBeVisible();
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Vote changed', {}, T)).toBeVisible();
    expect(publishes()[0].identifier).toBe(`qmp-adminvote-${ADMIN_POLL_IDS.voted}`);
  });

  it('a decline in Hub is a cancel: nothing sent, nothing shown', async () => {
    const u = user();
    await openDecisions();
    const card = await pollCard(OPEN_Q);
    await u.click(within(card).getByRole('button', { name: `Vote No: ${OPEN_Q}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Vote No' });
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(dialog).findByText(/Cancelled in Hub. Nothing was sent./, {}, T)
    ).toBeVisible();
    await u.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(within(await pollCard(OPEN_Q)).queryByText(/confirming/)).toBeNull();
  });

  it('the vote dialog by keyboard: focus in, kept in, back on Escape', async () => {
    const u = user();
    await openDecisions();
    const card = await pollCard(OPEN_Q);
    await checkDialogByKeyboard(
      u,
      within(card).getByRole('button', { name: `Vote Neutral: ${OPEN_Q}` }),
      'Vote Neutral',
      { reach: ['Not now', 'Continue to Hub'] }
    );
  });
});

describe('an admin without a registered name', () => {
  it('is told voting and sharing need one, with where to get it, before any Hub step', async () => {
    await openDecisions('admin', (world) => {
      withAdminPolls('admin')(world);
      world.accounts.get(world.admins[0]).name = null;
    });
    const card = await pollCard(OPEN_Q);
    const note = within(card).getByRole('note', {
      name: 'Voting and sharing need a registered name',
    });
    expect(note).toBeVisible();
    expect(within(note).getByRole('button', { name: 'Register a name' })).toBeVisible();
    expect(within(card).queryByRole('button', { name: /^Vote / })).toBeNull();
    expect(within(card).queryByRole('button', { name: /^Share with/ })).toBeNull();
  });
});

describe('sharing with Minter Admins added since', () => {
  it('names who can’t read it yet, then publishes a copy encrypted to every admin', async () => {
    const u = user();
    const { world } = await openDecisions();
    sent();
    const card = await pollCard(OPEN_Q);
    await u.click(
      within(card).getByRole('button', {
        name: `Share with 2 Minter Admins added since: ${OPEN_Q}`,
      })
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Share with Minter Admins added since',
    });
    expect(within(dialog).getByText(/2 Minter Admins can’t read this poll yet/)).toBeVisible();
    expect(within(dialog).getByRole('link', { name: 'Admin O: open their page' })).toBeVisible();
    expect(within(dialog).getByRole('link', { name: 'Admin P: open their page' })).toBeVisible();
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Shared', {}, T)).toBeVisible();
    const call = publishes()[0];
    expect(call.identifier).toBe(`qmp-adminshare-${ADMIN_POLL_IDS.open}`);
    const body = fromData64(String(call.data64)) as { readers: string[]; comments: unknown[] };
    expect(body.readers).toEqual(world.admins.filter((a: string) => a !== NULL_OWNER));
    expect(body.readers).toEqual(expect.arrayContaining([extra(14), extra(15)]));
    expect(body.comments).toHaveLength(3);
    await u.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(
      await within(await pollCard(OPEN_Q)).findByText('Shared ✓ (confirming…)', {}, T)
    ).toBeVisible();
  });

  it('isn’t offered when every Minter Admin can read it', async () => {
    await openDecisions();
    const card = await pollCard(VOTED_Q);
    expect(within(card).queryByRole('button', { name: /^Share with/ })).toBeNull();
  });
});

describe('a poll just asked', () => {
  it('is listed at once, as publishing, without votes until QDN lists it', async () => {
    const u = user();
    await openDecisions();
    sent();
    await u.click(screen.getByRole('button', { name: 'Propose' }));
    await u.click(await screen.findByRole('menuitem', { name: /Ask the Minter Admins/ }));
    const form = await screen.findByRole('dialog', { name: 'Ask the Minter Admins' }, T);
    await u.type(
      within(form).getByRole('textbox', { name: 'Question' }),
      'Should we keep a shared minting checklist?'
    );
    await u.selectOptions(
      within(form).getByRole('combobox', { name: 'Voting stays open for' }),
      '3'
    );
    await u.click(within(form).getByRole('button', { name: 'Review' }));
    const hub = await screen.findByRole('dialog', { name: 'Ask the Minter Admins' }, T);
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    await u.click(await within(hub).findByRole('button', { name: 'Done' }, T));
    const card = await pollCard('Should we keep a shared minting checklist?');
    expect(within(card).getByText('Publishing…')).toBeVisible();
    expect(within(card).getByText(/^Asked by/)).toHaveTextContent(/Avery Admin/);
    expect(within(card).queryByRole('button', { name: /^Vote / })).toBeNull();
    expect(within(card).queryByRole('button', { name: /^Comments/ })).toBeNull();
    // It ends first, so it is listed first.
    const section = await polls();
    expect(within(section).getAllByRole('article')[0]).toBe(card);
  });
});

describe('comments on a poll', () => {
  it('open the thread: decrypted comments with the reply under its comment; post one', async () => {
    const u = user();
    await openDecisions();
    sent();
    const card = await pollCard(OPEN_Q);
    await u.click(within(card).getByRole('button', { name: `Comments (3): ${OPEN_Q}` }));
    const thread = await within(card).findByRole('region', { name: `Comments on ${OPEN_Q}` }, T);
    expect(
      await within(thread).findByText(/they know how the network works/, { selector: 'p' }, T)
    ).toBeVisible();
    const replies = within(thread).getByRole('list', { name: 'Replies to Admin C' });
    expect(within(replies).getByText(/Level isn't everything/)).toBeVisible();
    // A qortal:// link in a comment is a button, as in public comments.
    expect(within(thread).getByRole('button', { name: /Q-Mintership\+/ })).toBeVisible();

    await u.type(within(thread).getByRole('textbox', { name: 'Write a comment' }), 'Count me in.');
    expect(
      within(thread).getByText(/Encrypted to the Minter Admins, under your name Avery Admin\./)
    ).toBeInTheDocument();
    await u.click(within(thread).getByRole('button', { name: 'Post' }));
    const dialog = await screen.findByRole('dialog', { name: 'Post your comment' });
    expect(
      within(dialog).getByText('The identifier starts with qmp-admincomment-.')
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/only they can read it/)).toBeVisible();
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Comment published', {}, T)).toBeVisible();
    const call = publishes()[0];
    expect(String(call.identifier)).toMatch(
      new RegExp(`^qmp-admincomment-${ADMIN_POLL_IDS.open}-[a-z0-9]{6}$`)
    );
    expect(call).toMatchObject({ encrypt: true, service: 'DOCUMENT_PRIVATE' });
    expect(fromData64(String(call.data64))).toEqual({
      v: 1,
      pollId: ADMIN_POLL_IDS.open,
      text: 'Count me in.',
    });
    await u.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(await within(thread).findByText('Count me in.', {}, T)).toBeVisible();
    expect(
      within(thread).getByText('Publishing… the Minter Admins see it once QDN has it.')
    ).toBeVisible();
    // (Found once the closing dialog no longer hides the page.)
    expect(
      await within(card).findByRole('button', { name: `Comments (4): ${OPEN_Q}` }, T)
    ).toBeVisible();
  });

  it('a comment the viewer can’t decrypt shows from the share that carried it', async () => {
    const u = user();
    await openDecisions();
    const card = await pollCard(SHARED_Q);
    await u.click(within(card).getByRole('button', { name: `Comments (1): ${SHARED_Q}` }));
    const thread = await within(card).findByRole('region', { name: `Comments on ${SHARED_Q}` }, T);
    expect(
      await within(thread).findByText(
        'Two days gives everyone time to look before the clock starts.',
        {},
        T
      )
    ).toBeVisible();
    // Said to be the sharer's copy, not the comment as its author's own record.
    expect(within(thread).getByText(/from Admin D ΑΩ’s copy/)).toBeVisible();
  });
});

describe('comments the viewer can’t read', () => {
  it('the thread says how many weren’t encrypted to them, so the count adds up', async () => {
    const u = user();
    await openDecisions('admin', (world) => {
      withAdminPolls('admin')(world);
      const signers = world.admins.filter((a: string) => a !== NULL_OWNER);
      // Before the share, encrypted to everyone but Avery, and in no share.
      world.adminPollRecords.push({
        name: 'Admin K',
        identifier: `qmp-admincomment-${ADMIN_POLL_IDS.shared}-zz9yy8`,
        created: Date.now() - 2 * 86_400_000,
        readers: signers.filter((a: string) => a !== world.admins[0]),
        body: { v: 1, pollId: ADMIN_POLL_IDS.shared, text: 'Not in any copy.' },
      });
    });
    const card = await pollCard(SHARED_Q);
    await u.click(within(card).getByRole('button', { name: `Comments (2): ${SHARED_Q}` }));
    const thread = await within(card).findByRole('region', { name: `Comments on ${SHARED_Q}` }, T);
    expect(
      await within(thread).findByText(
        '1 comment here wasn’t encrypted to you, and no share carries it.',
        {},
        T
      )
    ).toBeVisible();
    expect(within(thread).getByText(/Two days gives everyone time/)).toBeVisible();
    expect(within(thread).queryByText('Not in any copy.')).toBeNull();
  });
});

describe('Refresh', () => {
  it('reads the polls again with the rest of Decisions', async () => {
    const u = user();
    await openDecisions();
    await pollCard(OPEN_Q);
    const searches = () =>
      fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
        p.includes('DOCUMENT_PRIVATE')
      ).length;
    expect(searches()).toBe(4);
    const decrypted = qortalCallsFor('DECRYPT_DATA').length;
    await u.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(searches()).toBe(8), T);
    // The bodies were decrypted once: nothing again.
    expect(qortalCallsFor('DECRYPT_DATA')).toHaveLength(decrypted);
  });
});
