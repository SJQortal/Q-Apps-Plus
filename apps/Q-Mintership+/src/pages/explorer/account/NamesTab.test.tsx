/**
 * The account page's Names tab, on the mock world in strict mode: every
 * name (primary first, 20 at a time, each name's record read per row, notes
 * on how names are written, no primary, 500+), the name history (both sides
 * of a sale, the 100 cap), and QDN publishes (the first 10 names searched by
 * themselves, the rest on request with Stop; counts per service, encrypted
 * ones never listed). Reads counted; axe; no writes.
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
import AccountPage from '../AccountPage';

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
/** A row's name: the first line of each list item. */
const rowNames = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((row) => row.firstElementChild?.firstElementChild?.textContent ?? '');

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
    expect(first.slice(0, 5)).toEqual([
      'Cora Collector',
      'Cora Shelf 01',
      'Cora Shelf 02',
      'Cora Sale',
      'QjyA6 Vault',
    ]);
    const rows = within(list).getAllByRole('listitem');
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
    // The blank character shows as "·".
    expect(rowNames(list)[6]).toBe('Cora·Blank');
    expect(rows[6]).toHaveTextContent('This name contains an invisible or blank character.');

    await expectNoAxeViolations(container);

    // Show 10 more: the first new row takes the focus, and its record loads.
    await user.click(within(names).getByRole('button', { name: 'Show 10 more' }));
    expect(rowNames(list)).toHaveLength(30);
    expect(within(list).getAllByRole('listitem')[20]).toHaveFocus();
    expect(within(names).queryByRole('button', { name: /^Show \d+ more$/ })).toBeNull();
    await waitFor(() => expect(queryLoadCounts().xnamedata).toBe(30), T);
    noWrites(posts);
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
    const qdn = await region('Published on QDN');
    expect(
      await within(qdn).findByText(/^Searched 10 of 500\+ names\./, {}, T)
    ).toBeInTheDocument();
    expect(within(qdn).getByRole('button', { name: 'Search 490 more names' })).toBeInTheDocument();
  });

  it('an account with no names says so', async () => {
    await open(ADDR.newcomer);
    const names = await region('Names (0)');
    expect(await within(names).findByText('No registered name.', {}, T)).toBeInTheDocument();
    const qdn = await region('Published on QDN');
    expect(
      within(qdn).getByText('QDN resources are published under names, and it has none.')
    ).toBeInTheDocument();
    expect(byName()).toEqual([]);
  });
});

describe('Names: name history', () => {
  it('tells the seller’s side of a sale as a sale, newest first, with date and block', async () => {
    const { container } = await open(ADDR.learner);
    const history = await region('Name history');
    const list = await within(history).findByRole('list', { name: 'Its name transactions' }, T);
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    await waitFor(() =>
      expect(rows[0]).toHaveTextContent(
        /^Sold the name “Spare Room” to N?Nora Nominator for 5 QORT/
      )
    );
    expect(
      within(rows[0]).getByRole('link', { name: 'Nora Nominator: explore this account' })
    ).toHaveAttribute('href', explorerAccountPath(ADDR.nominator));
    expect(rows[0]).toHaveTextContent(
      `${formatDate(blockTime(2_351_000) - 20_000)} · block 2,351,000`
    );
    expect(rows[1]).toHaveTextContent(/^Listed the name “Spare Room” for sale at 5 QORT/);
    expect(rows[2]).toHaveTextContent(/^Registered the name “Spare Room”/);
    expect(within(history).getByText('3 name transactions.')).toBeInTheDocument();
    // One heavy read, of the five name types.
    expect(
      fetchCallsFor(`/transactions/search?address=${ADDR.learner}&txType=REGISTER_NAME`)
    ).toHaveLength(1);
    await expectNoAxeViolations(container);
  });

  it('and the buyer’s side as a purchase', async () => {
    await open(ADDR.nominator);
    const history = await region('Name history');
    const list = await within(history).findByRole('list', { name: 'Its name transactions' }, T);
    await waitFor(() =>
      expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent(
        /^Bought the name “Spare Room” from L?Leo Learner for 5 QORT/
      )
    );
  });

  it('says when it read only the newest 100', async () => {
    const hundred = Array.from({ length: 100 }, (_, i) => ({
      type: 'REGISTER_NAME',
      signature: `sig${i}`,
      timestamp: NOW - i * 1_000_000,
      blockHeight: TIP - i * 10,
      txGroupId: 0,
      creatorAddress: COLLECTOR.address,
      name: `Name ${i}`,
    }));
    const { user } = await open(COLLECTOR.address, (world) =>
      mockFetchRoute('/transactions/search', (url: URL) =>
        url.searchParams.get('address') === COLLECTOR.address &&
        url.searchParams.getAll('txType').includes('BUY_NAME')
          ? hundred
          : worldAnswer(world, url)
      )
    );
    const history = await region('Name history');
    expect(
      await within(history).findByText('The newest 100 name transactions.', {}, T)
    ).toBeInTheDocument();
    const list = within(history).getByRole('list', { name: 'Its name transactions' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
    await user.click(within(history).getByRole('button', { name: 'Show 20 more' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(40);
    expect(within(list).getAllByRole('listitem')[20]).toHaveFocus();
  });
});

describe('Names: published on QDN', () => {
  it('searches the primary name and the 9 newest by itself, counts per service, lists the newest', async () => {
    const { container, posts } = await open(COLLECTOR.address);
    const qdn = await region('Published on QDN');
    expect(
      await within(qdn).findByText(
        'Searched 10 of 30 names. First the primary name and the 9 registered most recently.',
        {},
        T
      )
    ).toBeInTheDocument();
    // One read per name: the 10, and nothing else until asked.
    const reads = byName();
    expect(reads).toHaveLength(10);
    expect(reads).toContain(`${SEARCHSIMPLE}?name=Cora%20Collector&limit=100&reverse=true`);
    expect(reads).toContain(`${SEARCHSIMPLE}?name=Cora%20Shelf%2017&limit=100&reverse=true`);
    expect(reads).not.toContain(`${SEARCHSIMPLE}?name=Cora%20Shelf%2016&limit=100&reverse=true`);

    expect(within(qdn).getByText('107+ resources')).toBeInTheDocument();
    const counts = within(qdn).getByRole('list', { name: 'Resources per service' });
    expect(
      within(counts)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual(['APP 1', 'DOCUMENT 100+', 'JSON 2', 'MAIL_PRIVATE 2 (encrypted)', 'VIDEO 2']);
    expect(
      within(qdn).getByText(
        (_, el) =>
          el?.tagName === 'P' &&
          el.textContent ===
            '“Cora Shelf 23” has more than 100 resources: its newest 100 are counted.'
      )
    ).toBeInTheDocument();

    const newest = within(qdn).getByRole('list', { name: 'Newest resources' });
    const rows = within(newest).getAllByRole('listitem');
    expect(rows).toHaveLength(20);
    expect(rows[0]).toHaveTextContent('A video (VIDEO)shelf-tour-2Under “Cora Shelf 25” · 45.8 MB');
    expect(rows[2]).toHaveTextContent(
      /^JSON data \(JSON\)cora-prefsUnder “Cora Collector” · 310 bytes/
    );
    expect(rows[4]).toHaveTextContent(/^An app \(APP\)defaultUnder “Cora Collector” · 2.3 MB/);
    expect(
      within(qdn).getByText('2 encrypted resources are counted above and not listed.')
    ).toBeInTheDocument();
    // An encrypted resource's identifier never shows.
    expect(container.textContent).not.toMatch(/qortal_qmail_cora_secret/);

    expect(within(qdn).getByRole('button', { name: 'Show 20 more' })).toBeInTheDocument();
    expect(within(qdn).getByRole('button', { name: 'Search 20 more names' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
    noWrites(posts);
  });

  it('searches the rest on request, 4 at a time, with progress, until every name is covered', async () => {
    let running = 0;
    let most = 0;
    const { user } = await open(COLLECTOR.address, (world) =>
      mockFetchRoute(SEARCHSIMPLE, async (url: URL) => {
        // Only the reads by name (MINTER's status reads its own records by service).
        if (!url.searchParams.get('name')) return worldAnswer(world, url);
        running += 1;
        most = Math.max(most, running);
        await new Promise((r) => setTimeout(r, 5));
        running -= 1;
        return worldAnswer(world, url);
      })
    );
    const qdn = await region('Published on QDN');
    await user.click(await within(qdn).findByRole('button', { name: 'Search 20 more names' }, T));
    expect(within(qdn).getByRole('status')).toHaveTextContent(/^Searching: \d+ of 20 names$/);
    expect(
      within(qdn).getByRole('progressbar', { name: 'Searching its names on QDN' })
    ).toBeVisible();
    expect(await within(qdn).findByText('Searched all 30 names.', {}, T)).toBeInTheDocument();
    expect(byName()).toHaveLength(30);
    expect(most).toBe(4);
    // The old name's image is found now.
    const counts = within(qdn).getByRole('list', { name: 'Resources per service' });
    expect(within(counts).getByText('IMAGE 1')).toBeInTheDocument();
    expect(within(qdn).getByText('108+ resources')).toBeInTheDocument();
    expect(within(qdn).queryByRole('button', { name: /^Search \d+ more/ })).toBeNull();
    expect(within(qdn).queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('Stop lets the names being read finish and starts no more', async () => {
    let slow = false;
    const { user } = await open(COLLECTOR.address, (world) =>
      mockFetchRoute(SEARCHSIMPLE, async (url: URL) => {
        if (slow) await new Promise((r) => setTimeout(r, 150));
        return worldAnswer(world, url);
      })
    );
    const qdn = await region('Published on QDN');
    const more = await within(qdn).findByRole('button', { name: 'Search 20 more names' }, T);
    slow = true;
    await user.click(more);
    await user.click(within(qdn).getByRole('button', { name: 'Stop' }));
    expect(await within(qdn).findByText('Searched 14 of 30 names.', {}, T)).toBeInTheDocument();
    expect(byName()).toHaveLength(14);
    expect(within(qdn).getByRole('button', { name: 'Search 16 more names' })).toBeInTheDocument();
  });

  it('says which names it couldn’t search, with Retry', async () => {
    let fail = true;
    const { user } = await open(COLLECTOR.address, (world) =>
      mockFetchRoute(SEARCHSIMPLE, (url: URL) =>
        fail && url.searchParams.get('name') === 'Cora Shelf 25'
          ? new Response('{"error":5,"message":"repository issue"}', { status: 500 })
          : worldAnswer(world, url)
      )
    );
    const qdn = await region('Published on QDN');
    expect(await within(qdn).findByText(/^Couldn't search 1 name\./, {}, T)).toBeInTheDocument();
    expect(within(qdn).getByText(/^Searched 9 of 30 names\./)).toBeInTheDocument();
    fail = false;
    await user.click(within(qdn).getByRole('button', { name: 'Retry' }));
    expect(await within(qdn).findByText(/^Searched 10 of 30 names\./, {}, T)).toBeInTheDocument();
    expect(within(qdn).queryByText(/^Couldn't search/)).toBeNull();
  });
});
