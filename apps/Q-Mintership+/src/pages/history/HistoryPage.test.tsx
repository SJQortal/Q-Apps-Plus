import { afterEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/render';
import { fetchCallsFor, mockQortalRequest, qortalCalls, qortalCallsFor } from '../../test/setup';
import { ADDR, NOW, PEOPLE, TIP } from '../../test/world';
import { historySeenKey, readHistorySeen } from '../../data/historySeen';
import { DECLINED, addDecline, answerDecrypt } from '../../../e2e/world.mjs';
import { withAdminPolls } from '../../test/adminPolls';
import { expectNoAxeViolations } from '../../test/axe';
import HistoryPage from './HistoryPage';

const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;

/** The on-chain list, expanded when it has more than the first dozen events. */
async function eventsList() {
  const list = await screen.findByRole('group', { name: 'MINTER events, newest first' });
  const all = screen.queryByRole('button', { name: /^Show all \d+$/ });
  if (all) await userEvent.click(all);
  return list;
}

describe('History page: on chain', () => {
  it('lists the last 30 days of decided MINTER changes, with who and by whom', async () => {
    const { posts } = await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    const list = await eventsList();
    // Other mock history (Activity's) adds more events; check these ones are among them.
    expect(within(list).getAllByText('Left MINTER').length).toBeGreaterThanOrEqual(1);
    expect(within(list).getAllByText('Approved for MINTER').length).toBeGreaterThanOrEqual(2);
    expect(within(list).getByText(PEOPLE.left.name as string)).toBeInTheDocument();
    expect(within(list).getByText(PEOPLE.recentlyJoined.name as string)).toBeInTheDocument();
    // An expired nomination is history; still-open ones are not.
    const expired = within(list)
      .getByText(PEOPLE.expired.name as string)
      .closest('li') as HTMLElement;
    expect(within(expired).getByText('Nominated for MINTER')).toBeInTheDocument();
    expect(within(expired).getByText('Expired')).toBeInTheDocument();
    expect(within(list).queryByText('Collecting approvals')).toBeNull();
    expect(within(list).queryByText(PEOPLE.urgent.name as string)).toBeNull();
    expect(screen.getByText(/^\d+ events in the last 30 days\.$/)).toBeInTheDocument();
    expect(screen.getByLabelText('When')).toHaveValue('30');
    expect(posts).toEqual([]);
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
  });

  it('shows the last 60 days on request, in bounded block windows', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    const list = await eventsList();
    // Kit was removed about 47 days ago: not in the first 30-day window.
    expect(within(list).queryByText(PEOPLE.kicked.name as string)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Show the last 60 days' }));
    expect(screen.getByLabelText('When')).toHaveValue('60');
    const kicked = await screen.findByText(PEOPLE.kicked.name as string);
    const item = kicked.closest('li') as HTMLElement;
    expect(within(item).getByText('Removed from MINTER')).toBeInTheDocument();
    expect(within(item).getByText(/Reason: “Kicked by Minter Admins”/)).toBeInTheDocument();
    expect(within(item).getByText(/proposed by/)).toBeInTheDocument();
    for (const path of fetchCallsFor('/transactions/search')) {
      const params = new URL(path, 'http://x').searchParams;
      expect(Number(params.get('limit'))).toBeGreaterThan(0);
      if (!params.get('address')) expect(Number(params.get('blockLimit'))).toBeGreaterThan(0);
    }
  });
});

describe('History page: who proposed an invite', () => {
  // Simon, 2026-10-26: a nominee's decided invite says who nominated them, not the Minter
  // Admin whose invite was the first approval.
  it('names the nominator of an invite that answered a nomination, the Minter Admin otherwise', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    const list = await eventsList();
    const expired = within(list)
      .getByText(PEOPLE.expired.name as string)
      .closest('li') as HTMLElement;
    expect(await within(expired).findByText(/proposed by/, { exact: false })).toHaveTextContent(
      /proposed by\s*N?Nora Nominator/
    );
    // Approved without a nomination record: its Minter Admin proposed it.
    const joined = within(list)
      .getByText(PEOPLE.recentlyJoined.name as string)
      .closest('li') as HTMLElement;
    expect(within(joined).getByText(/proposed by/, { exact: false })).not.toHaveTextContent(
      'Nora Nominator'
    );
  });
});

describe('History page: filters', () => {
  const INVITE_TITLES =
    /^(Approved for MINTER|Approved and added to MINTER|Invited to MINTER|Nominated for MINTER)$/;
  const typeSearches = (type: string) =>
    fetchCallsFor('/transactions/search').filter((path) => {
      const params = new URL(path, 'http://x').searchParams;
      return params.get('txGroupId') === '694' && params.getAll('txType').join() === type;
    });

  it('offers every type, and shows one at a time', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    await screen.findByRole('group', { name: 'MINTER events, newest first' });
    const filters = screen.getByRole('group', { name: 'Show one type of event' });
    expect(
      within(filters)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual([
      'All',
      'Invites',
      'Join requests',
      'Joined MINTER',
      'Declined requests',
      'Removals',
      'Bans',
      'Left MINTER',
      'Bans lifted',
      'Cancelled invites',
      'Minter Admin changes',
    ]);
    expect(within(filters).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByLabelText('When')).toHaveValue('30');

    await userEvent.click(within(filters).getByRole('button', { name: 'Left MINTER' }));
    const list = await screen.findByRole('group', {
      name: 'MINTER events: Left MINTER, newest first',
    });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    for (const item of within(list).getAllByRole('listitem'))
      expect(within(item).getByText('Left MINTER')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show the last 60 days' })).toBeInTheDocument();

    await userEvent.click(within(filters).getByRole('button', { name: 'All' }));
    expect(
      await screen.findByRole('group', { name: 'MINTER events, newest first' })
    ).toBeInTheDocument();
  });

  it('finds older bans with a longer period, in one search by type', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    const filters = await screen.findByRole('group', { name: 'Show one type of event' });
    await userEvent.click(within(filters).getByRole('button', { name: 'Bans' }));
    // No ban in the last 30 days; a 7-day ban 39 days ago; Bram, about 61 days ago.
    expect(
      await screen.findByText('Nothing under “Bans” in the last 30 days.')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show the last 60 days' }));
    const sixty = await screen.findByRole('group', { name: 'MINTER events: Bans, newest first' });
    expect(await within(sixty).findByText(/For 7 days/)).toBeInTheDocument();
    expect(within(sixty).queryByText(PEOPLE.banned.name as string)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Show the last 120 days' }));
    expect(await screen.findByText(/^\d+ events? in the last 120 days\.$/)).toBeInTheDocument();
    const list = screen.getByRole('group', { name: 'MINTER events: Bans, newest first' });
    // Bram was banned about 61 days ago.
    const bram = await within(list).findByText(PEOPLE.banned.name as string);
    const item = bram.closest('li') as HTMLElement;
    expect(within(item).getByText('Banned from MINTER')).toBeInTheDocument();
    expect(within(item).getByText(/Permanent/)).toBeInTheDocument();
    for (const each of within(list).getAllByRole('listitem'))
      expect(
        within(each).getByText(/^(Banned from MINTER|Proposed: Ban from MINTER)$/)
      ).toBeInTheDocument();
    expect(screen.getByText(/^\d+ events? in the last 120 days\.$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show the last year' })).toBeInTheDocument();
    const searches = typeSearches('GROUP_BAN');
    expect(searches.length).toBeGreaterThanOrEqual(3);
    for (const path of searches) {
      const params = new URL(path, 'http://x').searchParams;
      expect(Number(params.get('startBlock'))).toBeGreaterThan(1);
      expect(Number(params.get('blockLimit'))).toBeGreaterThan(0);
      expect(Number(params.get('limit'))).toBeGreaterThan(0);
    }
  });

  it('tells removals from declined join requests, each in one search', async () => {
    await renderPage(<HistoryPage />, {
      persona: 'learner',
      path: '/history?type=removal&period=60',
      setup: (world) => void addDecline(world),
    });
    const removals = await screen.findByRole('group', {
      name: 'MINTER events: Removals, newest first',
    });
    // Kit was removed about 47 days ago.
    expect(await within(removals).findByText(PEOPLE.kicked.name as string)).toBeInTheDocument();
    expect(within(removals).queryByText(DECLINED.name)).toBeNull();
    expect(within(removals).queryByText('Join request declined')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Declined requests' }));
    const declined = await screen.findByRole('group', {
      name: 'MINTER events: Declined requests, newest first',
    });
    expect(await within(declined).findByText(DECLINED.name)).toBeInTheDocument();
    expect(within(declined).getAllByText('Join request declined').length).toBeGreaterThanOrEqual(1);
    expect(within(declined).queryByText(PEOPLE.kicked.name as string)).toBeNull();
  });

  it('opens on the type and period a link names, as Back from a decision does', async () => {
    await renderPage(<HistoryPage />, {
      persona: 'learner',
      path: '/history?type=admins&period=30',
    });
    const list = await screen.findByRole('group', {
      name: 'MINTER events: Minter Admin changes, newest first',
    });
    expect(screen.getByRole('button', { name: 'Minter Admin changes' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByLabelText('When')).toHaveValue('30');
    expect(await within(list).findByText('No longer a Minter Admin')).toBeInTheDocument();
    expect(within(list).getByText('Made a Minter Admin')).toBeInTheDocument();
    expect(screen.getByText(/in the last 30 days\.$/)).toBeInTheDocument();
  });

  it('a period reads the windows it covers, and none past it', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    await screen.findByRole('group', { name: 'MINTER events, newest first' });
    expect(screen.queryByText(PEOPLE.kicked.name as string)).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('When'), 'Last 60 days');
    await screen.findByText(/^\d+ events in the last 60 days\.$/);
    await eventsList();
    // Kit, 47 days ago, is in; Bram's ban, 61 days ago, is not.
    expect(await screen.findByText(PEOPLE.kicked.name as string)).toBeInTheDocument();
    expect(screen.queryByText(PEOPLE.banned.name as string)).toBeNull();
    expect(screen.getByText(/^\d+ events in the last 60 days\.$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show the last 120 days' })).toBeInTheDocument();
  });

  it('offers no Any time; after a year, the dates in When go further back, or all of it', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history?type=ban&period=365' });
    const when = await screen.findByLabelText('When');
    expect([...(when as HTMLSelectElement).options].map((o) => o.textContent)).toEqual([
      'Last 30 days',
      'Last 60 days',
      'Last 120 days',
      'Last year',
      'From a date…',
      'Scan all History',
    ]);
    const list = await screen.findByRole('group', { name: 'MINTER events: Bans, newest first' });
    expect(await within(list).findByText(PEOPLE.banned.name as string)).toBeInTheDocument();
    // After a year, the end offers no longer period: When has the dates.
    expect(screen.queryByRole('button', { name: /^Show the last/ })).toBeNull();
  });

  it('scans all of History back to MINTER’s start, in bounded windows', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    const filters = await screen.findByRole('group', { name: 'Show one type of event' });
    await userEvent.click(within(filters).getByRole('button', { name: 'Bans' }));
    expect(
      await screen.findByText('Nothing under “Bans” in the last 30 days.')
    ).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('When'), 'Scan all History');
    expect(screen.getByLabelText('When')).toHaveValue('all');
    const list = await screen.findByRole('group', { name: 'MINTER events: Bans, newest first' });
    // Bram's ban, about 61 days ago, is in; nothing offers a longer period after all of it.
    expect(await within(list).findByText(PEOPLE.banned.name as string)).toBeInTheDocument();
    expect(await screen.findByText(/^\d+ events? since MINTER began\.$/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Show the last/ })).toBeNull();
    // Every type over all of it, too: 30-day windows back to MINTER's start.
    await userEvent.click(within(filters).getByRole('button', { name: 'All' }));
    expect(
      await screen.findByText(/^\d+ events since MINTER began\.$/, {}, { timeout: 6000 })
    ).toBeInTheDocument();
    for (const path of fetchCallsFor('/transactions/search')) {
      const params = new URL(path, 'http://x').searchParams;
      expect(Number(params.get('limit'))).toBeGreaterThan(0);
      if (!params.get('address')) expect(Number(params.get('blockLimit'))).toBeGreaterThan(0);
    }
  });

  it('shows what happened from a date', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history?type=invite' });
    await screen.findByRole('group', { name: 'MINTER events: Invites, newest first' });
    await userEvent.selectOptions(screen.getByLabelText('When'), 'From a date…');
    const from = screen.getByLabelText('From');
    // Before MINTER began: refused, with the date it began.
    await userEvent.clear(from);
    await userEvent.type(from, '2020-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/^MINTER started on /);
    const date = new Date(NOW - 20 * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    await userEvent.clear(from);
    await userEvent.type(from, value);
    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    const list = await screen.findByRole('group', { name: 'MINTER events: Invites, newest first' });
    expect(await screen.findByText(/^\d+ events? since \d+ \w+ \d{4}\.$/)).toBeInTheDocument();
    for (const item of within(list).getAllByRole('listitem'))
      expect(within(item).getByText(INVITE_TITLES)).toBeInTheDocument();
  });
});

describe('History page: filters on a phone', () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('picks the type and the period from two pickers instead of a wall of chips', async () => {
    // 390 px: below MUI's sm breakpoint (600).
    window.matchMedia = ((query: string) => {
      const sizes = [...query.matchAll(/\((min|max)-width:\s*([\d.]+)px\)/g)];
      const matches =
        sizes.length > 0 &&
        sizes.every(([, edge, value]) =>
          edge === 'min' ? 390 >= Number(value) : 390 <= Number(value)
        );
      return { ...originalMatchMedia(query), matches };
    }) as typeof window.matchMedia;
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    await screen.findByRole('group', { name: 'MINTER events, newest first' });
    expect(screen.queryByRole('group', { name: 'Show one type of event' })).toBeNull();
    const show = screen.getByLabelText('Show');
    expect(show).toHaveValue('all');
    await userEvent.selectOptions(show, 'Bans');
    expect(
      await screen.findByText('Nothing under “Bans” in the last 30 days.')
    ).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('When'), 'Last 120 days');
    const list = await screen.findByRole('group', { name: 'MINTER events: Bans, newest first' });
    expect(await within(list).findByText(PEOPLE.banned.name as string)).toBeInTheDocument();
    expect(screen.getByText(/in the last 120 days\.$/)).toBeInTheDocument();
  });
});

describe('History page: links to decisions', () => {
  /** The list item that names `name` and has `title`. */
  function itemOf(list: HTMLElement, title: string, name: string): HTMLElement {
    return within(list)
      .getAllByText(title)
      .map((t) => t.closest('li') as HTMLElement)
      .find((li) => within(li).queryByText(name)) as HTMLElement;
  }

  it('links each decided change to its decision’s own page, named for what it opens', async () => {
    const { world } = await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    const list = await eventsList();
    const signatureFor = (invitee: string) =>
      (world.decided as Array<{ type: string; invitee?: string; signature: string }>).find(
        (t) => t.type === 'GROUP_INVITE' && t.invitee === invitee
      )?.signature;

    const expiredName = PEOPLE.expired.name as string;
    const joinedName = PEOPLE.recentlyJoined.name as string;
    // Names come from the cached name reads, the link's name with them.
    await within(list).findByText(expiredName);
    await within(list).findByText(joinedName);
    const expired = itemOf(list, 'Nominated for MINTER', expiredName);
    const toExpired = within(expired).getByRole('link', {
      name: new RegExp(
        `^Open the decision: Nominated for MINTER, ${expiredName}, expired \\d{1,2} \\w{3} \\d{4}$`
      ),
    });
    expect(toExpired).toHaveTextContent(/^Open the decision$/);
    expect(toExpired).toHaveAttribute('href', `/decisions/${signatureFor(ADDR.expired)}`);

    const approved = itemOf(list, 'Approved for MINTER', joinedName);
    expect(
      within(approved).getByRole('link', {
        name: new RegExp(`^Open the decision: Approved for MINTER, ${joinedName}, \\d`),
      })
    ).toHaveAttribute('href', `/decisions/${signatureFor(ADDR.recentlyJoined)}`);

    // Joins and leaves need no decision: no link.
    const left = itemOf(list, 'Left MINTER', PEOPLE.left.name as string);
    expect(within(left).queryByRole('link', { name: /Open the decision/ })).toBeNull();

    await userEvent.click(toExpired);
    expect(await screen.findByTestId('navigated-away')).toBeInTheDocument();
  });
});

describe('History page: the target', () => {
  it('says what each approved admin change did to the target', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    const list = await eventsList();
    // Fern was removed 12 days ago (21 → 20 admin seats); an admin was added 20 days ago.
    await within(list).findAllByText('Fern Former');
    const fern = within(list)
      .getAllByText('No longer a Minter Admin')
      .map((title) => title.closest('li') as HTMLElement)
      .find((item) => within(item).queryByText('Fern Former')) as HTMLElement;
    expect(within(fern).getByText('No longer a Minter Admin')).toBeInTheDocument();
    expect(
      await within(fern).findByText('Target 9 → 8 approvals (21 → 20 admin seats)')
    ).toBeInTheDocument();
    expect(
      within(list).getByText('Target 8 → 9 approvals (20 → 21 admin seats)')
    ).toBeInTheDocument();
  });
});

describe('History page: the original app', () => {
  it('lists the old cards newest first, 20 at a time, without the copy under a card id', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    const list = await screen.findByRole('list', {
      name: 'Cards from the original app, newest first',
    });
    expect(
      await within(list).findByText(`${PEOPLE.nominatedSigning.name} for the MINTER group`)
    ).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
    expect(screen.getByText('Showing 20 of 27 cards.')).toBeInTheDocument();
    expect(screen.queryByText('Not the real card')).toBeNull();
    const first = within(list).getAllByRole('link')[0];
    expect(first).toHaveAttribute('href', '/history/card/Minter-board-card-bQ7xK2');

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(27);
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('filters to Minter Admin proposals', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    await screen.findByRole('list', { name: 'Cards from the original app, newest first' });
    await userEvent.click(screen.getByRole('button', { name: 'Admin proposals' }));
    const list = screen.getByRole('list', { name: 'Cards from the original app, newest first' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(await within(list).findByText('Admin proposal: add')).toBeInTheDocument();
    expect(await within(list).findByText('Admin proposal: remove')).toBeInTheDocument();
    expect(
      within(list).getByText(/Remove Dex Demote as a Minter Admin · by Admin D ΑΩ/)
    ).toBeInTheDocument();
  });

  it('reads the encrypted Admin Board for Minter Admins, saying when its cards were proposed', async () => {
    await renderPage(<HistoryPage />, {
      persona: 'admin',
      path: '/history',
      setup: (world) =>
        mockQortalRequest('DECRYPT_DATA', (request: Record<string, unknown>) =>
          answerDecrypt(world, 'admin', request)
        ),
    });
    await screen.findByRole('list', { name: 'Cards from the original app, newest first' });
    expect(qortalCallsFor('DECRYPT_DATA')).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Admin Board' }));
    expect(
      screen.getByText(
        /^The original Minter Admin board: cards proposed in the original Q-Mintership/
      )
    ).toBeInTheDocument();
    const list = await screen.findByRole('list', {
      name: 'Cards from the original app, newest first',
    });
    expect(await within(list).findByText('Remove Member 12 from MINTER?')).toBeInTheDocument();
    expect(within(list).getByText(/About Member 12 · by Admin B/)).toBeInTheDocument();
    expect(await within(list).findByText('How we review removals')).toBeInTheDocument();
    expect(within(list).getByText(/^Topic · by Admin C/)).toBeInTheDocument();
    // Posted before Avery was a Minter Admin, and one sealed for no one.
    expect(await within(list).findAllByText('Not encrypted to you')).toHaveLength(2);
    expect(within(list).getAllByRole('link')).toHaveLength(4);
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
  });

  it('offers the Admin Board to Minter Admins only, and decrypts nothing for others', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    await screen.findByRole('list', { name: 'Cards from the original app, newest first' });
    expect(screen.queryByRole('button', { name: 'Admin Board' })).toBeNull();
    expect(qortalCallsFor('DECRYPT_DATA')).toEqual([]);
    expect(
      fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) => p.includes('MAIL_PRIVATE'))
    ).toEqual([]);
  });
});

describe('History page: the closed Minter Admin polls', () => {
  const T = { timeout: 8000 };
  const CLOSED_Q = 'Should Minter Admins review the stale invites together once a month?';
  const ARCHIVED_Q = 'Should the Minter Admins meet in Q-Chat once a quarter?';
  const OPEN_Q = 'Should only level 5+ minters become Minter Admins?';
  const pollReads = () =>
    fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
      /identifier=qmp-admin(poll|vote|comment|share)-/.test(p)
    );
  const pollRow = (list: HTMLElement, question: string) =>
    within(list)
      .getByRole('link', { name: `Open the poll: ${question}` })
      .closest('li') as HTMLElement;

  // Simon, 2026-10-23: "i want minter admin polls to show in history like all the other polls".
  it('a Minter Admin sees each poll that closed in the period among the events', async () => {
    await renderPage(<HistoryPage />, {
      persona: 'admin',
      path: '/history',
      setup: withAdminPolls('admin'),
    });
    const list = await eventsList();
    const link = await within(list).findByRole('link', { name: `Open the poll: ${CLOSED_Q}` }, T);
    expect(link).toHaveAttribute('href', '/decisions/polls/review03');
    const row = pollRow(list, CLOSED_Q);
    expect(within(row).getByText('Minter Admin poll')).toBeInTheDocument();
    expect(within(row).getByText('Minter Admins only')).toBeInTheDocument();
    expect(within(row).getByText(CLOSED_Q)).toBeInTheDocument();
    expect(within(row).getByText(/^Closed \d+ \w+ 2026 · asked by/)).toHaveTextContent('Admin C');
    expect(
      within(row).getByText('Yes 3 · No 1 · Neutral 1 · You voted Neutral')
    ).toBeInTheDocument();
    // Its month holds the events around it, newest first.
    const rows = within(link.closest('ul') as HTMLElement).getAllByRole('listitem');
    expect(rows.length).toBeGreaterThan(1);
    // Open polls stay on Decisions; the one that closed two months ago is past 30 days.
    expect(within(list).queryByText(OPEN_Q)).toBeNull();
    expect(within(list).queryByText(ARCHIVED_Q)).toBeNull();
    // Its type among the others.
    expect(screen.getByRole('button', { name: 'Minter Admin polls' })).toBeInTheDocument();
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
    await expectNoAxeViolations(document.body);
  });

  it('Minter Admin polls alone, over all of it, as Decisions’ Closed polls opens it', async () => {
    await renderPage(<HistoryPage />, {
      persona: 'admin',
      path: '/history?type=polls&period=all',
      setup: withAdminPolls('admin'),
    });
    const list = await screen.findByRole(
      'group',
      { name: 'MINTER events: Minter Admin polls, newest first' },
      T
    );
    await within(list).findByRole('link', { name: `Open the poll: ${ARCHIVED_Q}` }, T);
    expect(
      within(list)
        .getAllByRole('link')
        .filter((a) => a.getAttribute('aria-label')?.startsWith('Open the poll'))
        .map((a) => a.getAttribute('aria-label'))
    ).toEqual([`Open the poll: ${CLOSED_Q}`, `Open the poll: ${ARCHIVED_Q}`]);
    expect(within(list).queryByRole('link', { name: /^Open the decision/ })).toBeNull();
    const archived = pollRow(list, ARCHIVED_Q);
    expect(
      within(archived).getByText('Yes 3 · No 1 · Neutral 0 · You voted Yes')
    ).toBeInTheDocument();
    expect(screen.getByText(/^2 polls /)).toBeInTheDocument();
  });

  it('a member sees no polls and no such type, and nothing of them is read or decrypted', async () => {
    await renderPage(<HistoryPage />, {
      persona: 'learner',
      path: '/history?type=polls',
      setup: withAdminPolls('learner'),
    });
    // A link to the polls opens on All for them.
    const list = await eventsList();
    expect(list).toHaveAccessibleName('MINTER events, newest first');
    expect(screen.queryByRole('button', { name: 'Minter Admin polls' })).toBeNull();
    expect(within(list).queryByText('Minter Admin poll')).toBeNull();
    expect(pollReads()).toEqual([]);
    expect(qortalCallsFor('DECRYPT_DATA')).toEqual([]);
  });
});

describe('History page: find a person', () => {
  it('opens a Minter Profile by address', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    await userEvent.type(screen.getByLabelText('Find a person'), ADDR.kicked);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByTestId('navigated-away')).toBeInTheDocument();
  });

  it('opens a Minter Profile by name, and says when no one has the name', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    const field = screen.getByLabelText('Find a person');
    await userEvent.type(field, 'Nobody By This Name');
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(
      await screen.findByText(/No account has the name “Nobody By This Name”/)
    ).toBeInTheDocument();
    await userEvent.clear(field);
    await userEvent.type(field, PEOPLE.kicked.name as string);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByTestId('navigated-away')).toBeInTheDocument();
    expect(fetchCallsFor('/names/Kit%20Kicked')).toHaveLength(1);
  });

  it('asks for something to look up', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByText('Type a name or a Q… address.')).toBeInTheDocument();
  });
});

describe('History page: what is new for a Minter Admin', () => {
  it('marks what its tab counted as new, and says how many', async () => {
    await renderPage(<HistoryPage />, {
      persona: 'admin',
      path: '/history',
      // This device last saw History 6,000 blocks ago: three changes were decided since.
      setup: () =>
        window.localStorage.setItem(
          historySeenKey(ADDR.admin),
          JSON.stringify({ v: 1, height: TIP - 6_000 })
        ),
    });
    expect(
      await screen.findByText(
        '3 changes new since you last looked, marked New.',
        {},
        { timeout: 4000 }
      )
    ).toBeInTheDocument();
    const list = await eventsList();
    const fresh = list.querySelectorAll('li[data-new]');
    expect(fresh).toHaveLength(3);
    for (const item of fresh)
      expect(within(item as HTMLElement).getByText('New')).toBeInTheDocument();
    // Seen now: its tab stops counting them.
    expect(readHistorySeen(ADDR.admin)).toBe(TIP);
  });

  it('marks nothing for someone who isn’t a Minter Admin', async () => {
    await renderPage(<HistoryPage />, {
      persona: 'learner',
      path: '/history',
      setup: () =>
        window.localStorage.setItem(
          historySeenKey(ADDR.learner),
          JSON.stringify({ v: 1, height: TIP - 6_000 })
        ),
    });
    const list = await eventsList();
    expect(list.querySelectorAll('li[data-new]')).toHaveLength(0);
    expect(screen.queryByText(/new since you last looked/)).toBeNull();
  });
});
