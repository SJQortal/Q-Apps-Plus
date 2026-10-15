import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/render';
import { fetchCallsFor, mockQortalRequest, qortalCalls, qortalCallsFor } from '../../test/setup';
import { ADDR, PEOPLE } from '../../test/world';
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
    expect(screen.getByText(/^\d+ events since \d+ \w+ \d{4}\.$/)).toBeInTheDocument();
    expect(posts).toEqual([]);
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
  });

  it('loads the 30 days before on request, in bounded block windows', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    const list = await eventsList();
    // Kit was removed about 47 days ago: not in the first 30-day window.
    expect(within(list).queryByText(PEOPLE.kicked.name as string)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Load the 30 days before' }));
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

describe('History page: type filters', () => {
  const INVITE_TITLES =
    /^(Approved for MINTER|Approved and added to MINTER|Invited to MINTER|Nominated for MINTER)$/;

  it('shows one type at a time, each with its count, and All again', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    await screen.findByRole('group', { name: 'MINTER events, newest first' });
    const filters = screen.getByRole('group', { name: 'Show one type of event' });
    // The types in the first 30 days, in their fixed order, after All.
    expect(
      within(filters)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual([
      'All 13',
      'Invites 8',
      'Removals and bans 1',
      'Left MINTER 2',
      'Minter Admin changes 2',
    ]);
    expect(within(filters).getByRole('button', { name: 'All 13' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await userEvent.click(within(filters).getByRole('button', { name: 'Invites 8' }));
    expect(within(filters).getByRole('button', { name: 'Invites 8' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    const list = screen.getByRole('group', { name: 'MINTER events: Invites, newest first' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(8);
    for (const item of items) expect(within(item).getByText(INVITE_TITLES)).toBeInTheDocument();
    expect(within(list).queryByText('Left MINTER')).toBeNull();
    expect(screen.getByText(/^8 of 13 events since \d+ \w+ \d{4}\.$/)).toBeInTheDocument();

    await userEvent.click(within(filters).getByRole('button', { name: 'All 13' }));
    const everything = screen.getByRole('group', { name: 'MINTER events, newest first' });
    expect(within(everything).getAllByText('Left MINTER')).toHaveLength(2);
    expect(screen.getByText(/^13 events since/)).toBeInTheDocument();
  });

  it('opens on the type a link names, as Back from a decision does', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history?type=admins' });
    const list = await screen.findByRole('group', {
      name: 'MINTER events: Minter Admin changes, newest first',
    });
    expect(screen.getByRole('button', { name: 'Minter Admin changes 2' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('No longer a Minter Admin')).toBeInTheDocument();
    expect(within(list).getByText('Made a Minter Admin')).toBeInTheDocument();
  });

  it('says when the chosen type has nothing yet, and shows every type on request', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history?type=liftBan' });
    expect(
      await screen.findByText('Nothing under “Bans lifted” in the last 30 days.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bans lifted 0' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Show all types' }));
    expect(
      await screen.findByRole('group', { name: 'MINTER events, newest first' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Bans lifted/ })).toBeNull();
  });

  it('keeps the type while older days load', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    const filters = await screen.findByRole('group', { name: 'Show one type of event' });
    await userEvent.click(within(filters).getByRole('button', { name: 'Removals and bans 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Load the 30 days before' }));
    // Kit was removed about 47 days ago.
    const kicked = await screen.findByText(PEOPLE.kicked.name as string);
    const list = screen.getByRole('group', {
      name: 'MINTER events: Removals and bans, newest first',
    });
    expect(list).toContainElement(kicked);
    // Removals and bans that happened, and proposals of them that expired or were rejected.
    const titles =
      /^(Removed from MINTER|Banned from MINTER|Proposed: Remove from MINTER|Proposed: Ban from MINTER)$/;
    for (const item of within(list).getAllByRole('listitem'))
      expect(within(item).getByText(titles)).toBeInTheDocument();
    expect(within(list).queryByText('Left MINTER')).toBeNull();
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

  it('points Minter Admins to the encrypted admin board in the original app', async () => {
    await renderPage(<HistoryPage />, { persona: 'admin', path: '/history' });
    mockQortalRequest('OPEN_NEW_TAB', true);
    const open = await screen.findByRole('button', { name: 'Open the original app' });
    await userEvent.click(open);
    expect(qortalCallsFor('OPEN_NEW_TAB')).toEqual([
      { action: 'OPEN_NEW_TAB', qortalLink: 'qortal://APP/Q-Mintership' },
    ]);
  });

  it('shows the encrypted board note to admins only', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    await screen.findByRole('list', { name: 'Cards from the original app, newest first' });
    expect(screen.queryByRole('button', { name: 'Open the original app' })).toBeNull();
  });
});

describe('History page: find a person', () => {
  it('opens a person page by address', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    await userEvent.type(screen.getByLabelText('Find a person'), ADDR.kicked);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByTestId('navigated-away')).toBeInTheDocument();
  });

  it('opens a person page by name, and says when no one has the name', async () => {
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
