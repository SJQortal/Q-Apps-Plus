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
    expect(within(list).getByText('Left MINTER')).toBeInTheDocument();
    expect(within(list).getAllByText('Approved for MINTER').length).toBeGreaterThanOrEqual(2);
    expect(within(list).getByText(PEOPLE.left.name as string)).toBeInTheDocument();
    expect(within(list).getByText(PEOPLE.recentlyJoined.name as string)).toBeInTheDocument();
    // An expired nomination is history; still-open ones are not.
    const expired = within(list)
      .getByText(PEOPLE.expired.name as string)
      .closest('li') as HTMLElement;
    expect(within(expired).getByText('Nominated for MINTER')).toBeInTheDocument();
    expect(within(expired).getByText('Expired')).toBeInTheDocument();
    expect(within(list).queryByText('Collecting signatures')).toBeNull();
    expect(within(list).queryByText(PEOPLE.urgent.name as string)).toBeNull();
    expect(screen.getByText(/^\d+ events since \d+ \w+ \d{4}\.$/)).toBeInTheDocument();
    expect(posts).toEqual([]);
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
  });

  it('loads the 30 days before on request, in bounded block windows', async () => {
    await renderPage(<HistoryPage />, { persona: 'learner', path: '/history' });
    await eventsList();
    expect(screen.queryByText('Removed from MINTER')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Load the 30 days before' }));
    const removed = await screen.findByText('Removed from MINTER');
    const item = removed.closest('li') as HTMLElement;
    expect(within(item).getByText(PEOPLE.kicked.name as string)).toBeInTheDocument();
    expect(within(item).getByText(/Reason: “Kicked by Minter Admins”/)).toBeInTheDocument();
    expect(within(item).getByText(/proposed by/)).toBeInTheDocument();
    for (const path of fetchCallsFor('/transactions/search')) {
      const params = new URL(path, 'http://x').searchParams;
      expect(Number(params.get('limit'))).toBeGreaterThan(0);
      if (!params.get('address')) expect(Number(params.get('blockLimit'))).toBeGreaterThan(0);
    }
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
