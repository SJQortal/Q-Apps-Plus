import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeAddress, type World } from '../../../e2e/world.mjs';
import { shortAddress } from '../../utils/format';
import { renderPage } from '../../test/render';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { ADDR } from '../../test/world';
import NominationsPage from './NominationsPage';

afterEach(() => vi.useRealTimers());

const open = (persona: string, setup?: (world: World) => void) =>
  renderPage(<NominationsPage />, {
    persona,
    path: '/nominations?show=ready',
    route: '/nominations',
    setup,
  });

const joinRequest = (joiner: string) => ({ groupId: 694, joiner });

const readyList = () => screen.findByRole('list', { name: 'Ready to mint' }, { timeout: 4000 });

/** A row, found by the name (or short address) its person link shows. */
async function row(label: string): Promise<HTMLElement> {
  const link = await within(await readyList()).findByRole(
    'link',
    { name: `${label}: open their page` },
    { timeout: 4000 }
  );
  return link.closest('li') as HTMLElement;
}

function rowLabels(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole('link', { name: /: open their page$/ })
    .map((a) => a.getAttribute('aria-label')?.replace(/: open their page$/, '') ?? '');
}

describe('Ready to mint', () => {
  it('lists who asked to join, in the node’s order, to everyone, without members or banned', async () => {
    await open('signedOut', (world) => {
      world.joinRequests.push(
        joinRequest(ADDR.kicked),
        joinRequest(ADDR.learner),
        joinRequest(ADDR.banned),
        joinRequest(fakeAddress('old-ban'))
      );
    });
    const kit = await row('Kit Kicked');
    expect(
      await within(kit).findByText('Level 3 · 210,000 blocks minted', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    const list = await readyList();
    await waitFor(() => expect(rowLabels(list)).toContain('bob+builder'));
    expect(rowLabels(list)).toEqual([
      'bob+builder',
      'Uma Urgent',
      'Mia Met',
      shortAddress(fakeAddress('jr-1')),
      shortAddress(fakeAddress('jr-2')),
      shortAddress(fakeAddress('jr-3')),
      'Kit Kicked',
      // A ban that ran out: ready again. The member and the banned account are left out.
      shortAddress(fakeAddress('old-ban')),
    ]);
    expect(
      await within(await row('bob+builder')).findByText('Level 0 · no blocks minted yet')
    ).toBeInTheDocument();
    // Kit was a member once: the row says so, from their MINTER history.
    expect(
      await within(kit).findByText(
        'Former member: removed from MINTER on 26 Aug 2026',
        {},
        { timeout: 4000 }
      )
    ).toBeInTheDocument();
    expect(within(await row('bob+builder')).queryByText(/Former member/)).toBeNull();
    expect(screen.getByText(/They need a nomination from a level 5\+ minter/)).toBeInTheDocument();
    expect(screen.getByText(/this is the order your node lists them in/)).toBeInTheDocument();
    expect(screen.getByText('8 of 8 shown')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ready to mint\s*8/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // Nominations' own search and lists step aside; nobody signed out can nominate.
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Open nominations' })).toBeNull();
    expect(
      await within(await row('Uma Urgent')).findByText('Nominated', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(within(list).queryAllByRole('button')).toHaveLength(0);
  });

  it('shows 20 at a time and reads accounts and names only for the rows shown', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 45 }, (_, i) => fakeAddress(`many-jr-${i}`));
    await open('nominator', (world) => {
      world.joinRequests.push(...many.map(joinRequest));
    });
    const list = await readyList();
    // 6 from the mock world, then 14 of these.
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(20));
    expect(screen.getByText('20 of 51 shown')).toBeInTheDocument();
    // Account, name and MINTER history: three reads per row shown, none for the others.
    const reads = (address: string) =>
      fetchCallsFor(`/addresses/${address}`).length +
      fetchCallsFor(`/names/primary/${address}`).length +
      fetchCallsFor(`/transactions/search?address=${address}`).length;
    await waitFor(() => expect(reads(many[13])).toBe(3));
    expect(many.slice(0, 14).map(reads)).toEqual(new Array(14).fill(3));
    expect(many.slice(14).map(reads)).toEqual(new Array(31).fill(0));

    await user.click(screen.getByRole('button', { name: 'Show 20 more' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(40);
    // Focus moves to the first new row.
    expect(document.activeElement).toHaveAccessibleName(
      `${shortAddress(many[14])}: open their page`
    );
    await waitFor(() => expect(reads(many[33])).toBe(3));
    expect(many.slice(14, 34).map(reads)).toEqual(new Array(20).fill(3));
    expect(many.slice(34).map(reads)).toEqual(new Array(11).fill(0));
    // Rows already read aren't read again.
    expect(many.slice(0, 14).map(reads)).toEqual(new Array(14).fill(3));

    await user.click(screen.getByRole('button', { name: 'Show 11 more' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(51);
    expect(screen.getByText('51 of 51 shown')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Show \d+ more$/ })).toBeNull();
  });

  it('marks former members, kicked or left, and nobody who was never a member', async () => {
    await open('nominator', (world) => {
      world.joinRequests.push(joinRequest(ADDR.left), joinRequest(ADDR.kicked));
      // Bram's ban ended: a former member again, removed by the ban.
      world.bans = world.bans.filter((b: { offender: string }) => b.offender !== ADDR.banned);
      world.joinRequests.push(joinRequest(ADDR.banned));
    });
    expect(
      await within(await row('Lou Left')).findByText(
        /^Former member: left MINTER on \d+ \w+ 2026$/,
        {},
        { timeout: 4000 }
      )
    ).toBeInTheDocument();
    expect(
      await within(await row('Kit Kicked')).findByText(
        'Former member: removed from MINTER on 26 Aug 2026'
      )
    ).toBeInTheDocument();
    expect(
      await within(await row('Bram Banned')).findByText(/^Former member: removed from MINTER on /)
    ).toBeInTheDocument();
    const list = await readyList();
    // The others never were members.
    await waitFor(() => expect(within(list).getAllByText(/^Former member: /)).toHaveLength(3));
  });

  it('reads a row again on Refresh when its level could not be read', async () => {
    const user = userEvent.setup();
    let down = true;
    await open('nominator', (world) => {
      world.joinRequests.push(joinRequest(ADDR.kicked));
      mockFetchRoute(`/addresses/${ADDR.kicked}`, () =>
        down
          ? new Response('', { status: 500 })
          : { address: ADDR.kicked, level: 3, blocksMinted: 210_000 }
      );
    });
    const kit = await row('Kit Kicked');
    expect(
      await within(kit).findByText('Level not available right now', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    const reads = () => fetchCallsFor(`/addresses/${ADDR.kicked}`).length;
    const others = () => fetchCallsFor(`/addresses/${fakeAddress('jr-1')}`).length;
    const [kitBefore, othersBefore] = [reads(), others()];

    // Two minutes later the node answers again.
    down = false;
    vi.setSystemTime(Date.now() + 2 * 60_000);
    await user.click(screen.getByRole('button', { name: 'Refresh nominations' }));
    expect(
      await within(await row('Kit Kicked')).findByText(
        'Level 3 · 210,000 blocks minted',
        {},
        { timeout: 4000 }
      )
    ).toBeInTheDocument();
    expect(reads()).toBe(kitBefore + 1);
    // Rows read a moment ago aren't read again.
    expect(others()).toBe(othersBefore);
  });

  it('offers Nominate to a level 5+ member, and says where they already nominated', async () => {
    const user = userEvent.setup();
    await open('nominator');
    const jr1 = await row(shortAddress(fakeAddress('jr-1')));
    expect(
      await within(await row('bob+builder')).findByText('You nominated them', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(within(await row('Uma Urgent')).getByText('You nominated them')).toBeInTheDocument();
    const mia = await row('Mia Met');
    expect(within(mia).getByText('Nominated')).toBeInTheDocument();
    // Enough Minter Admins have signed already: support would change nothing.
    expect(within(mia).queryByRole('button')).toBeNull();
    expect(within(await readyList()).getAllByRole('button', { name: /^Nominate / })).toHaveLength(
      3
    );

    await user.click(
      within(jr1).getByRole('button', { name: `Nominate ${shortAddress(fakeAddress('jr-1'))}` })
    );
    expect(await screen.findByTestId('navigated-away')).toBeInTheDocument();
  });

  it('lets a Minter Admin add their support where a nomination is still collecting', async () => {
    const user = userEvent.setup();
    await open('admin');
    const uma = await row('Uma Urgent');
    expect(await within(uma).findByText('Nominated', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(within(await row('Mia Met')).queryByRole('button')).toBeNull();
    await user.click(within(uma).getByRole('button', { name: 'Add your support for Uma Urgent' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add your support' });
    expect(within(dialog).getByText('Uma Urgent')).toBeInTheDocument();
  });

  it('offers nothing to a member below level 5', async () => {
    await open('learner');
    await row(shortAddress(fakeAddress('jr-3')));
    expect(
      await within(await row('Uma Urgent')).findByText('Nominated', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    const list = await readyList();
    expect(within(list).queryAllByRole('button')).toHaveLength(0);
  });

  it('shows the signed-in person their own row without an action', async () => {
    await open('newcomerName', (world) => {
      world.joinRequests.push(joinRequest(ADDR.newcomerName));
    });
    const mine = await row('Zoë Newcomer');
    expect(within(mine).getByText('That’s you')).toBeInTheDocument();
    expect(within(mine).queryByRole('button')).toBeNull();
  });

  it('says so when no one has asked to join', async () => {
    await open('nominator', (world) => {
      world.joinRequests.length = 0;
    });
    expect(
      await screen.findByText('No one has asked to join right now', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ready to mint\s*0/ })).toBeInTheDocument();
  });

  it('shows an error with Retry, and loads on Retry', async () => {
    const user = userEvent.setup();
    let down = true;
    await open('nominator', () =>
      mockFetchRoute('/groups/joinrequests/694', () =>
        down ? new Response('', { status: 500 }) : [joinRequest(fakeAddress('jr-1'))]
      )
    );
    expect(
      await screen.findByText('Couldn’t load the people ready to mint.', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    down = false;
    const section = screen.getByRole('region', { name: 'Ready to mint' });
    await user.click(within(section).getByRole('button', { name: 'Retry' }));
    expect(await row(shortAddress(fakeAddress('jr-1')))).toBeInTheDocument();
  });

  it('switches between the open nominations and Ready to mint', async () => {
    const user = userEvent.setup();
    await open('nominator');
    await readyList();
    await user.click(await screen.findByRole('button', { name: /^All\s*\d/ }, { timeout: 4000 }));
    expect(
      await screen.findByRole('list', { name: 'Open nominations' }, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Ready to mint' })).toBeNull();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Ready to mint\s*6/ }));
    expect(await readyList()).toBeInTheDocument();
  });
});
