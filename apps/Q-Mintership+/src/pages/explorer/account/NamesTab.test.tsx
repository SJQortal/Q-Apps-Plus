/**
 * The account page's Names tab, on the mock world in strict mode: every
 * name (primary first, 20 at a time, each name's record read per row, notes
 * on how names are written, no primary, 500+), the orders and the grid or
 * list (kept on this device), and each name's history beside it (both sides
 * of a sale, the 100 cap). QDN publishes are no longer read here. Reads
 * counted; axe; no writes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../../test/render';
import { expectNoAxeViolations } from '../../../test/axe';
import { fetchCallsFor, mockFetchRoute, qortalCalls } from '../../../test/setup';
import { ADDR, MS_PER_BLOCK, NOW, TIP } from '../../../test/world';
import { answerCore, COLLECTOR, COLLECTOR_NAMES, type World } from '../../../../e2e/world.mjs';
import { queryLoadCounts } from '../../../data/query';
import { explorerAccountPath } from '../../../routes/paths';
import { resetExplorerState } from '../../../state/explorer';
import { formatDate } from '../../../utils/format';
import { visibleName } from '../../../rules/explorer/nameNotes';
import AccountPage from '../AccountPage';
import { readText } from '../../../test/readText';

const T = { timeout: 4000 };
const ROUTE = '/explorer/account/:who/:tab?';
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;
const blockTime = (height: number) => NOW - (TIP - height) * MS_PER_BLOCK;
const SEARCHSIMPLE = '/arbitrary/resources/searchsimple';
/** QDN reads by name (MINTER's status reads its own records by service). */
const byName = () => fetchCallsFor(`${SEARCHSIMPLE}?name=`);

/** The world's own answer to a GET, served the way the test harness serves it. */
function worldAnswer(world: World, url: URL): Response {
  const answer = answerCore(world, url.pathname, url.searchParams);
  if (!answer) throw new Error(`no mock for GET ${url.pathname}${url.search}`);
  if (answer.text !== undefined) return new Response(answer.text, { status: answer.status });
  return new Response(JSON.stringify(answer.body), { status: answer.status });
}

async function open(address: string, setup?: (world: World) => void) {
  const result = await renderPage(<AccountPage />, {
    persona: 'learner',
    path: explorerAccountPath(address, 'names'),
    route: ROUTE,
    strict: true,
    setup,
  });
  const panel = await screen.findByRole('tabpanel', { name: 'Names' }, T);
  return { ...result, panel, user: userEvent.setup() };
}

const region = (name: string | RegExp) => screen.findByRole('region', { name }, T);
/** A list's own items (not the items of the histories inside them). */
const items = (list: HTMLElement) => [...list.querySelectorAll<HTMLElement>(':scope > li')];
/** A row's name: the first line of each list item. */
const rowNames = (list: HTMLElement) =>
  items(list).map((row) => row.querySelector('bdi')?.textContent ?? '');

function noWrites(posts: string[]) {
  expect(posts).toEqual([]);
  expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
}

beforeEach(() => resetExplorerState());
afterEach(() => vi.useRealTimers());

describe('Names: every name', () => {
  it('lists the primary name first, then Core’s order, 20 at a time, each with its record', async () => {
    const { container, user, posts } = await open(COLLECTOR.address);
    const names = await region('Names (30)');
    const list = await within(names).findByRole('list', { name: 'Its names' }, T);
    const first = rowNames(list);
    expect(first).toHaveLength(20);
    // Each name with its own avatar beside it (its first letter until the image loads).
    const avatars = items(list).map(
      (row) => row.querySelector('[aria-hidden="true"]')?.textContent
    );
    expect(avatars.slice(0, 5)).toEqual(['C', 'C', 'C', 'C', 'Q']);
    expect(first.slice(0, 5)).toEqual([
      'Cora Collector',
      'Cora Shelf 01',
      'Cora Shelf 02',
      'Cora Sale',
      'QjyA6 Vault',
    ]);
    const rows = items(list);
    expect(within(rows[0]).getByText('Primary')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('Primary')).toBeNull();

    // Each visible row reads its own record: 20 now, none of the 10 not shown.
    await within(rows[3]).findByText(/For sale at 5 QORT$/, {}, T);
    expect(rows[3]).toHaveTextContent(
      `Registered ${formatDate(blockTime(1_620_000))} · Updated ${formatDate(blockTime(2_450_000))} · For sale at 5 QORT`
    );
    await waitFor(() => expect(queryLoadCounts().xnamedata).toBe(20), T);
    expect(fetchCallsFor('/names/Cora%20Shelf%2025')).toEqual([]);

    // Notes on how a name is written, under it.
    expect(rows[4]).toHaveTextContent(
      "This name starts with the same characters as its owner's address (QjyA6…)."
    );
    expect(rows[5]).toHaveTextContent('This name is written like an address.');
    // The blank character shows as "·", and the name is crossed out (a screen reader hears why).
    expect(rowNames(list)[6]).toBe('Cora·Blank (written with a blank Braille character)');
    expect(rows[6].querySelector('bdi s')).not.toBeNull();
    expect(rows[6]).toHaveTextContent('This name contains an invisible or blank character.');

    await expectNoAxeViolations(container);

    // Show 10 more: the first new row takes the focus, and its record loads.
    await user.click(within(names).getByRole('button', { name: 'Show 10 more' }));
    expect(rowNames(list)).toHaveLength(30);
    expect(items(list)[20]).toHaveFocus();
    expect(within(names).queryByRole('button', { name: /^Show \d+ more$/ })).toBeNull();
    await waitFor(() => expect(queryLoadCounts().xnamedata).toBe(30), T);
    noWrites(posts);
  });

  it('sorts the names, and shows them as a grid (the default) or a list, kept on this device', async () => {
    const { container, user, unmount } = await open(COLLECTOR.address);
    const names = await region('Names (30)');
    const list = await within(names).findByRole('list', { name: 'Its names' }, T);
    const grid = within(names).getByRole('button', { name: 'Grid' });
    const asList = within(names).getByRole('button', { name: 'List' });
    expect(grid).toHaveAttribute('aria-pressed', 'true');
    expect(asList).toHaveAttribute('aria-pressed', 'false');

    const sort = within(names).getByRole('combobox', { name: 'Sort' });
    expect(sort).toHaveValue('primary');
    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
    const az = [...COLLECTOR_NAMES].sort(collator.compare);
    await user.selectOptions(sort, 'az');
    expect(rowNames(list)).toEqual(az.slice(0, 20).map(visibleName));
    await user.selectOptions(sort, 'newest');
    expect(rowNames(list)[0]).toBe(visibleName(COLLECTOR_NAMES.at(-1) ?? ''));
    // Sorting reads nothing more than the names on screen.
    await user.selectOptions(sort, 'za');
    expect(rowNames(list)[0]).toBe(visibleName(az.at(-1) ?? ''));

    await user.click(asList);
    expect(asList).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('qmintershipplus-names-view')).toBe('list');
    await expectNoAxeViolations(container);
    unmount();
    resetExplorerState();
    await open(COLLECTOR.address);
    const again = await region('Names (30)');
    expect(within(again).getByRole('button', { name: 'List' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    window.localStorage.removeItem('qmintershipplus-names-view');
  });

  it('says when it has names but no primary name, and why it can’t pick one', async () => {
    await open(COLLECTOR.address, () =>
      mockFetchRoute(`/names/primary/${COLLECTOR.address}`, { owner: COLLECTOR.address })
    );
    const names = await region('Names (30)');
    expect(
      await within(names).findByText(
        "No primary name. Core gives an account a primary name when it registers or buys a name while it has none; an account can't choose it.",
        {},
        T
      )
    ).toBeInTheDocument();
    const list = within(names).getByRole('list', { name: 'Its names' });
    expect(rowNames(list).slice(0, 3)).toEqual(COLLECTOR_NAMES.slice(0, 3));
    expect(within(list).queryByText('Primary')).toBeNull();
  });

  it('a primary name that couldn’t be read is said with Retry, never as no primary name', async () => {
    let fail = true;
    const { user } = await open(COLLECTOR.address, (world) =>
      mockFetchRoute(`/names/primary/${COLLECTOR.address}`, (url: URL) =>
        fail
          ? new Response('{"error":5,"message":"repository issue"}', { status: 500 })
          : worldAnswer(world, url)
      )
    );
    const names = await region('Names (30)');
    expect(
      await within(names).findByText(/^Couldn't read its primary name\./, {}, T)
    ).toBeInTheDocument();
    expect(within(names).queryByText(/^No primary name/)).toBeNull();
    // The names still show, in Core's order.
    const list = within(names).getByRole('list', { name: 'Its names' });
    expect(rowNames(list).slice(0, 3)).toEqual(COLLECTOR_NAMES.slice(0, 3));
    fail = false;
    await user.click(within(names).getByRole('button', { name: 'Retry' }));
    // (The list is drawn again once the primary name is in.)
    await waitFor(
      () =>
        expect(
          within(within(names).getByRole('list', { name: 'Its names' })).getByText('Primary')
        ).toBeInTheDocument(),
      T
    );
    expect(within(names).queryByText(/^Couldn't read its primary name/)).toBeNull();
  });

  it('says when Core’s list was cut at 500', async () => {
    const bulk = Array.from({ length: 500 }, (_, i) => `Bulk ${String(i).padStart(3, '0')}`);
    await open(ADDR.learner, () => {
      mockFetchRoute(`/names/address/${ADDR.learner}`, (url: URL) => {
        const offset = Number(url.searchParams.get('offset') ?? 0);
        return bulk.slice(offset, offset + 100).map((name) => ({ name, owner: ADDR.learner }));
      });
      mockFetchRoute(`/names/primary/${ADDR.learner}`, { name: 'Bulk 000', owner: ADDR.learner });
      mockFetchRoute(/^\/names\/Bulk/, (url: URL) => ({
        name: decodeURIComponent(url.pathname.split('/').pop() ?? ''),
        owner: ADDR.learner,
        registered: NOW,
        isForSale: false,
      }));
    });
    const names = await region('Names (500+)');
    expect(
      await within(names).findByText('500+ names; the first 500 are listed.', {}, T)
    ).toBeInTheDocument();
    expect(within(names).getByRole('button', { name: 'Show 20 more' })).toBeInTheDocument();
  });

  it('an account with no names says so', async () => {
    await open(ADDR.newcomer);
    const names = await region('Names (0)');
    expect(await within(names).findByText('No registered name.', {}, T)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Published on QDN' })).toBeNull();
    expect(byName()).toEqual([]);
  });
});

describe('Names: each name’s history, beside it', () => {
  it('a name it had: who has it now, and its history newest first, with date and block', async () => {
    const { container, posts } = await open(ADDR.learner);
    const had = await region('Names it had (1)');
    const list = within(had).getByRole('list', { name: 'Names it had' });
    const row = items(list)[0];
    expect(row.querySelector('bdi')?.textContent).toBe('Spare Room');
    // Its own avatar, and who has it now (a step into that account).
    expect(row.querySelector('[aria-hidden="true"]')?.textContent).toBe('S');
    // (She is named in its history too, beside it.)
    const nora = await within(row).findAllByRole(
      'link',
      { name: 'Nora Nominator: explore this account' },
      T
    );
    expect(nora[0]).toHaveAttribute('href', explorerAccountPath(ADDR.nominator));
    expect(readText(row)).toContain('Now owned by Nora Nominator');
    // Its three transactions show beside it, with nothing to open.
    expect(within(row).getByText('History · 3')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /History/ })).toBeNull();
    const history = within(row).getByRole('list', { name: 'The history of “Spare Room”' });
    const rows = within(history).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(readText(rows[0])).toMatch(/^Sold the name “Spare Room” to Nora Nominator for 5 QORT/);
    expect(rows[0]).toHaveTextContent(
      `${formatDate(blockTime(2_351_000) - 20_000)} · block 2,351,000`
    );
    expect(readText(rows[1])).toMatch(/^Listed the name “Spare Room” for sale at 5 QORT/);
    expect(readText(rows[2])).toMatch(/^Registered the name “Spare Room”/);
    // One heavy read of the five name types serves every name's history.
    expect(
      fetchCallsFor(`/transactions/search?address=${ADDR.learner}&txType=REGISTER_NAME`)
    ).toHaveLength(1);
    // No separate history section any more.
    expect(screen.queryByRole('region', { name: 'Name history' })).toBeNull();
    await expectNoAxeViolations(container);
    noWrites(posts);
  });

  it('a name it owns shows its own history: the buyer’s side as a purchase', async () => {
    await open(ADDR.nominator);
    const names = await region(/^Names \(\d+\)$/);
    const list = await within(names).findByRole('list', { name: 'Its names' }, T);
    const row = items(list).find(
      (li) => li.querySelector('bdi')?.textContent === 'Spare Room'
    ) as HTMLElement;
    const history = await within(row).findByRole(
      'list',
      { name: 'The history of “Spare Room”' },
      T
    );
    expect(readText(within(history).getAllByRole('listitem')[0])).toMatch(
      /^Bought the name “Spare Room” from Leo Learner for 5 QORT/
    );
    // It doesn't count among the names it had.
    expect(screen.queryByRole('region', { name: /^Names it had/ })).toBeNull();
  });

  it('says once, over the names, when their history comes from only the newest 100, and reads the rest on request', async () => {
    const hundred = Array.from({ length: 100 }, (_, i) => ({
      type: 'REGISTER_NAME',
      signature: `sig${i}`,
      timestamp: NOW - i * 1_000_000,
      blockHeight: TIP - i * 10,
      txGroupId: 0,
      creatorAddress: COLLECTOR.address,
      name: `Name ${i}`,
    }));
    const older = [
      {
        type: 'REGISTER_NAME',
        signature: 'sig-older',
        timestamp: NOW - 200_000_000,
        blockHeight: TIP - 2_000,
        txGroupId: 0,
        creatorAddress: COLLECTOR.address,
        name: 'Older Name',
      },
    ];
    const { user } = await open(COLLECTOR.address, (world) =>
      mockFetchRoute('/transactions/search', (url: URL) =>
        url.searchParams.get('address') === COLLECTOR.address &&
        url.searchParams.getAll('txType').includes('BUY_NAME')
          ? Number(url.searchParams.get('offset') ?? 0) === 0
            ? hundred
            : older
          : worldAnswer(world, url)
      )
    );
    const names = await region('Names (30)');
    expect(
      await within(names).findByText(
        /^Each name's history comes from its newest 100 name transactions\. \d+ of the names below have none in them\. Older ones aren't read yet\.$/,
        {},
        T
      )
    ).toBeInTheDocument();
    // No "None found" on each card: the line over them says it once.
    expect(within(names).queryByText('None found in its name transactions.')).toBeNull();
    await user.click(within(names).getByRole('button', { name: 'Read its whole name history' }));
    await waitFor(
      () =>
        expect(
          within(names).queryByRole('button', { name: 'Read its whole name history' })
        ).toBeNull(),
      T
    );
    const offsets = fetchCallsFor('/transactions/search')
      .map((call) => new URL(call, 'http://x').searchParams)
      .filter(
        (p) => p.get('address') === COLLECTOR.address && p.getAll('txType').includes('BUY_NAME')
      )
      .map((p) => p.get('offset'));
    expect(offsets).toContain('100');
  });

  it('a history that couldn’t be read is said with Retry, and the names still show', async () => {
    let fail = true;
    const { user } = await open(ADDR.learner, (world) =>
      mockFetchRoute('/transactions/search', (url: URL) =>
        fail && url.searchParams.getAll('txType').includes('BUY_NAME')
          ? new Response('boom', { status: 500 })
          : worldAnswer(world, url)
      )
    );
    const names = await region(/^Names \(\d+\)$/);
    const alert = await within(names).findByRole('alert', {}, T);
    expect(alert).toHaveTextContent(/^Couldn't load its name history\./);
    expect(within(names).queryByRole('list', { name: /^The history of/ })).toBeNull();
    fail = false;
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await region('Names it had (1)')).toBeInTheDocument();
  });
});
