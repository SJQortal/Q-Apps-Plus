import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from '../../test/render';
import { fetchCalls, mockFetchRoute, qortalCalls } from '../../test/setup';
import { SETTINGS_KEYS } from '../../state/settings';
import ActivityPage from './ActivityPage';
import { quarterDone } from './format';

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

/** The admin cards in a section, by their accessible names ("Name: participation 93%"). */
function cardsIn(sectionName: string): string[] {
  const section = screen.getByRole('region', { name: sectionName });
  return within(section)
    .getAllByRole('group')
    .map((card) => card.getAttribute('aria-label') ?? '');
}

async function admins() {
  await screen.findByRole('group', { name: /^Avery Admin:/ });
  return cardsIn('Minter Admin Activity');
}

describe('Activity', () => {
  it('lists every Minter Admin with their numbers and marks the signed-in admin', async () => {
    const { posts } = await renderPage(<ActivityPage />, { persona: 'admin', path: '/activity' });
    const cards = await admins();
    expect(cards).toHaveLength(19);
    const avery = screen.getByRole('group', { name: /^Avery Admin:/ });
    expect(within(avery).getByText('You')).toBeInTheDocument();
    expect(within(avery).getByText('Signed')).toBeInTheDocument();
    expect(within(avery).getByRole('progressbar')).toHaveAccessibleName(/Participation \d+%/);
    expect(screen.getByText(/MINTER decisions were waiting for signatures in the last 30 days/));
    // The group pulse.
    expect(screen.getByText('MINTER members')).toBeInTheDocument();
    expect(screen.getByText(/10 joined, 2 left in the last 30 days/)).toBeInTheDocument();
    expect(screen.getByText('Join requests')).toBeInTheDocument();
    // Read-only: nothing is ever written.
    expect(posts).toEqual([]);
    expect(qortalCalls.every((c) => c.action === 'GET_USER_ACCOUNT')).toBe(true);
  });

  it('shows an admin removed in the window under Former admins', async () => {
    await renderPage(<ActivityPage />, { persona: 'admin', path: '/activity' });
    await admins();
    const former = cardsIn('Former admins');
    expect(former).toHaveLength(1);
    const formerSection = screen.getByRole('region', { name: 'Former admins' });
    expect(await within(formerSection).findByText('Fern Former')).toBeInTheDocument();
    expect(screen.getByText(/^Removed \d+ \w+ 2026$/)).toBeInTheDocument();
  });

  it('is open to everyone: a member who is not an admin sees the same list', async () => {
    await renderPage(<ActivityPage />, { persona: 'learner', path: '/activity' });
    expect(await admins()).toHaveLength(19);
    expect(screen.queryByText('You')).toBeNull();
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/history');
  });

  it('works signed out too', async () => {
    await renderPage(<ActivityPage />, { persona: 'signedOut', path: '/activity' });
    expect(await admins()).toHaveLength(19);
  });

  it('sorts by participation first, then by name or signatures on request', async () => {
    await renderPage(<ActivityPage />, { persona: 'admin', path: '/activity' });
    const byParticipation = await admins();
    const pct = (label: string) => Number(/(\d+)%/.exec(label)?.[1] ?? -1);
    const values = byParticipation.map(pct);
    expect(values).toEqual([...values].sort((a, b) => b - a));

    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'name' } });
    const byName = cardsIn('Minter Admin Activity').map((label) => label.split(':')[0]);
    expect(byName[0]).toBe('Admin A');
    expect(byName).toEqual(
      [...byName].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    );

    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'lastActive' } });
    expect(cardsIn('Minter Admin Activity').at(-1)).toMatch(/^Dex Demote:/);
  });

  it('lists the target’s changes in the window: when, from what to what, and why', async () => {
    await renderPage(<ActivityPage />, { persona: 'learner', path: '/activity' });
    await admins();
    const card = screen.getByRole('heading', { name: 'Target changes' })
      .parentElement as HTMLElement;
    const items = within(card).getAllByRole('listitem');
    // Newest first: Fern removed 12 days ago (21 → 20 seats), an admin added 20 days ago.
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(
      /^9 → 8 signatures on \d+ \w+ 2026: .*Fern Former was removed as a Minter Admin \(21 → 20 admin seats\)\.$/
    );
    expect(items[1]).toHaveTextContent(
      /^8 → 9 signatures on .+ was made a Minter Admin \(20 → 21 admin seats\)\.$/
    );
  });

  it('switches the window and remembers the choice', async () => {
    await renderPage(<ActivityPage />, { persona: 'admin', path: '/activity' });
    await admins();
    expect(screen.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Gus Gone')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '180 days' }));
    expect((await screen.findAllByText('Gus Gone', {}, { timeout: 3000 })).length).toBeGreaterThan(
      0
    );
    expect(screen.getByRole('button', { name: '180 days' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(cardsIn('Former admins')).toHaveLength(2);
    expect(screen.getByText(/in the last 180 days/, { selector: 'p' })).toBeInTheDocument();
    expect(window.localStorage.getItem(SETTINGS_KEYS.activityWindow)).toBe('180');
  });

  it('checks a custom range before using it', async () => {
    await renderPage(<ActivityPage />, { persona: 'admin', path: '/activity' });
    await admins();
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The start date is after the end date.');

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-08-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      await screen.findByText(/were waiting for signatures in this range/, {}, { timeout: 3000 })
    ).toBeInTheDocument();
  });

  it('reads the level spread only when asked', async () => {
    await renderPage(<ActivityPage />, { persona: 'admin', path: '/activity' });
    await admins();
    const accountReads = () => fetchCalls.filter((c) => /^\/addresses\/Q\w+$/.test(c)).length;
    const before = accountReads();
    fireEvent.click(screen.getByRole('button', { name: 'Show levels' }));
    expect(
      await screen.findByText(/members are level 5 or above/, {}, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(screen.getByText('Level 0')).toBeInTheDocument();
    // One read per member (the signed-in account's own read happened before).
    expect(accountReads() - before).toBeGreaterThanOrEqual(60);
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('announces the level read a few times, not once per member', async () => {
    await renderPage(<ActivityPage />, { persona: 'admin', path: '/activity' });
    await admins();
    fireEvent.click(screen.getByRole('button', { name: 'Show levels' }));
    const live = await screen.findByText(/^Reading members' levels: \d+% done\.$/);
    expect(live).toHaveAttribute('role', 'status');
    const heard = new Set([live.textContent]);
    const observer = new MutationObserver(() => heard.add(live.textContent));
    observer.observe(live, { childList: true, characterData: true, subtree: true });
    await screen.findByText(/members are level 5 or above/, {}, { timeout: 3000 });
    observer.disconnect();
    // 60+ member reads, at most four announcements (0, 25, 50, 75 %).
    expect(heard.size).toBeLessThanOrEqual(4);
    expect(quarterDone(10, 40)).toBe(25);
    expect(quarterDone(40, 40)).toBe(75);
    expect(quarterDone(0, 0)).toBe(0);
  });

  it('shows a sortable table from 900 px', async () => {
    window.matchMedia = ((query: string) => ({
      ...originalMatchMedia(query),
      matches: /min-width:\s*900px/.test(query),
    })) as typeof window.matchMedia;
    await renderPage(<ActivityPage />, { persona: 'admin', path: '/activity' });
    const table = await screen.findByRole(
      'table',
      { name: 'Minter Admin Activity' },
      { timeout: 3000 }
    );
    expect(within(table).getAllByRole('row')).toHaveLength(20); // header + 19 admins
    expect(within(table).getByText(/^You · /)).toBeInTheDocument();
    const participation = within(table).getByRole('columnheader', { name: /Participation/ });
    expect(participation).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(within(table).getByRole('button', { name: 'Admin' }));
    expect(within(table).getByRole('columnheader', { name: /Admin/ })).toHaveAttribute(
      'aria-sort',
      'ascending'
    );
    const firstRow = within(table).getAllByRole('row')[1];
    expect(within(firstRow).getByText('Admin A')).toBeInTheDocument();
  });

  it('says what failed and offers Retry when the reads fail', async () => {
    await renderPage(<ActivityPage />, { persona: 'admin', path: '/activity' });
    // On top of the world renderPage installed (searches start after the first reads).
    mockFetchRoute('/transactions/search', () => new Response('down', { status: 500 }));
    expect(
      await screen.findByText("Couldn't load Minter Admin Activity.", {}, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('group', { name: /^Avery Admin:/ })).toBeNull());
  });
});
