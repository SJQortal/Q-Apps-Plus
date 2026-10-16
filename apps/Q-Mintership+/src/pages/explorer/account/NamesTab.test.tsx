/**
 * The account page's Names tab, on the mock world in strict mode: every
 * name (primary first, 20 at a time, each name's record read per row, notes
 * on how names are written, no primary, 500+), the name history (both sides
 * of a sale, the 100 cap), and QDN publishes (the first 10 names searched by
 * themselves, the rest on request with Stop; counts per service, encrypted
 * ones never listed). Reads counted; axe; no writes.
 */
import { useState } from 'react';
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
import { QdnPublished } from './names/QdnPublished';
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
/** A row's name: the first line of each list item. */
const rowNames = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((row) => row.querySelector('bdi')?.textContent ?? '');

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
    const avatars = within(list)
      .getAllByRole('listitem')
      .map((row) => row.querySelector('[aria-hidden="true"]')?.textContent);
    expect(avatars.slice(0, 5)).toEqual(['C', 'C', 'C', 'C', 'Q']);
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

describe('Names: each name opens to its history', () => {
  it('a name it had: who has it now, and its history newest first, with date and block', async () => {
    const { container, user, posts } = await open(ADDR.learner);
    const had = await region('Names it had (1)');
    const list = within(had).getByRole('list', { name: 'Names it had' });
    const row = within(list).getAllByRole('listitem')[0];
    expect(row.querySelector('bdi')?.textContent).toBe('Spare Room');
    // Its own avatar, and who has it now (a step into that account).
    expect(row.querySelector('[aria-hidden="true"]')?.textContent).toBe('S');
    expect(
      await within(row).findByRole('link', { name: 'Nora Nominator: explore this account' }, T)
    ).toHaveAttribute('href', explorerAccountPath(ADDR.nominator));
    expect(readText(row)).toContain('Now owned by Nora Nominator');
    // Closed at first; one press opens its three transactions.
    const toggle = within(row).getByRole('button', {
      name: 'Show the history of “Spare Room” (3 transactions)',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('History · 3');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Hide the history of “Spare Room” (3 transactions)');
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

  it('a name it owns opens to its own history: the buyer’s side as a purchase', async () => {
    const { user } = await open(ADDR.nominator);
    const names = await region(/^Names \(\d+\)$/);
    const list = await within(names).findByRole('list', { name: 'Its names' }, T);
    const row = within(list)
      .getAllByRole('listitem')
      .find((li) => li.querySelector('bdi')?.textContent === 'Spare Room') as HTMLElement;
    await user.click(
      await within(row).findByRole(
        'button',
        { name: 'Show the history of “Spare Room” (1 transaction)' },
        T
      )
    );
    const history = within(row).getByRole('list', { name: 'The history of “Spare Room”' });
    expect(readText(within(history).getAllByRole('listitem')[0])).toMatch(
      /^Bought the name “Spare Room” from Leo Learner for 5 QORT/
    );
    // It doesn't count among the names it had.
    expect(screen.queryByRole('region', { name: /^Names it had/ })).toBeNull();
  });

  it('says when each name’s history comes from only the newest 100', async () => {
    const hundred = Array.from({ length: 100 }, (_, i) => ({
      type: 'REGISTER_NAME',
      signature: `sig${i}`,
      timestamp: NOW - i * 1_000_000,
      blockHeight: TIP - i * 10,
      txGroupId: 0,
      creatorAddress: COLLECTOR.address,
      name: `Name ${i}`,
    }));
    await open(COLLECTOR.address, (world) =>
      mockFetchRoute('/transactions/search', (url: URL) =>
        url.searchParams.get('address') === COLLECTOR.address &&
        url.searchParams.getAll('txType').includes('BUY_NAME')
          ? hundred
          : worldAnswer(world, url)
      )
    );
    const names = await region('Names (30)');
    expect(
      await within(names).findByText(
        "Each name's history comes from its newest 100 name transactions; older ones aren't read.",
        {},
        T
      )
    ).toBeInTheDocument();
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
    expect(within(names).queryByRole('button', { name: /^Show the history/ })).toBeNull();
    fail = false;
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await region('Names it had (1)')).toBeInTheDocument();
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
          readText(el) ===
            '“Cora Shelf 23” has more than 100 resources: its newest 100 are counted.'
      )
    ).toBeInTheDocument();

    const newest = within(qdn).getByRole('list', { name: 'Newest resources' });
    const rows = within(newest).getAllByRole('listitem');
    expect(rows).toHaveLength(20);
    expect(readText(rows[0])).toContain(
      'A video (VIDEO)shelf-tour-2Under “Cora Shelf 25” · 45.8 MB'
    );
    expect(readText(rows[2])).toMatch(
      /^JSON data \(JSON\)cora-prefsUnder “Cora Collector” · 310 bytes/
    );
    expect(readText(rows[4])).toMatch(/^An app \(APP\)defaultUnder “Cora Collector” · 2.3 MB/);
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
    // The same button turns into Stop, and keeps the focus.
    expect(within(qdn).getByRole('button', { name: 'Stop' })).toHaveFocus();
    // Said once as it starts; the running count is on screen and in the bar.
    expect(within(qdn).getByRole('status')).toHaveTextContent(/^Searching 20 names on QDN…$/);
    expect(within(qdn).getByText(/^Searching: \d+ of 20 names$/)).not.toHaveAttribute('role');
    expect(
      within(qdn).getByRole('progressbar', { name: 'Searching its names on QDN' })
    ).toBeVisible();
    expect(
      await within(qdn).findByText('Searched all 30 names.', { selector: 'p' }, T)
    ).toBeInTheDocument();
    expect(within(qdn).getByRole('status')).toHaveTextContent(/^Searched all 30 names\.$/);
    expect(byName()).toHaveLength(30);
    expect(most).toBe(4);
    // Nothing left to search: the button goes, and the line of what was searched takes the focus.
    expect(within(qdn).getByText('Searched all 30 names.', { selector: 'p' })).toHaveFocus();
    // The old name's image is found now.
    const counts = within(qdn).getByRole('list', { name: 'Resources per service' });
    expect(within(counts).getByText('IMAGE 1')).toBeInTheDocument();
    expect(within(qdn).getByText('108+ resources')).toBeInTheDocument();
    expect(within(qdn).queryByRole('button', { name: /^Search \d+ more/ })).toBeNull();
    expect(within(qdn).queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('Stop lets the names being read finish and starts no more', async () => {
    // The reads by name wait at a gate that opens only after Stop, so
    // exactly the first 4 are running when it is pressed, however slow the
    // machine is.
    let gated = false;
    let held = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { user } = await open(COLLECTOR.address, (world) =>
      mockFetchRoute(SEARCHSIMPLE, async (url: URL) => {
        if (gated && url.searchParams.get('name')) {
          held += 1;
          await gate;
        }
        return worldAnswer(world, url);
      })
    );
    const qdn = await region('Published on QDN');
    const more = await within(qdn).findByRole('button', { name: 'Search 20 more names' }, T);
    gated = true;
    await user.click(more);
    await waitFor(() => expect(held).toBe(4), T);
    await user.click(within(qdn).getByRole('button', { name: 'Stop' }));
    release();
    expect(
      await within(qdn).findByText('Searched 14 of 30 names.', { selector: 'p' }, T)
    ).toBeInTheDocument();
    expect(held).toBe(4);
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
    expect(
      await within(qdn).findByText(/^Searched 10 of 30 names\./, { selector: 'p' }, T)
    ).toBeInTheDocument();
    expect(within(qdn).queryByText(/^Couldn't search/)).toBeNull();
  });

  it('counts only the names it is given when the section stays on screen for another account', async () => {
    // Back from one account's Names tab to another's keeps this section mounted.
    function Reused() {
      const [other, setOther] = useState(false);
      const name = other ? 'Nobody Here' : 'Cora Collector';
      return (
        <>
          <button type="button" onClick={() => setOther(true)}>
            Other account
          </button>
          <QdnPublished names={[name]} primary={name} truncated={false} />
        </>
      );
    }
    const { posts } = await renderPage(<Reused />, { persona: 'learner', strict: true });
    const user = userEvent.setup();
    const qdn = await region('Published on QDN');
    expect(await within(qdn).findByText(/^\d+ resources$/, {}, T)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Other account' }));
    expect(
      await within(qdn).findByText('Nothing published under the name searched.', {}, T)
    ).toBeInTheDocument();
    expect(within(qdn).queryByText(/resources?$/)).toBeNull();
    expect(within(qdn).queryByText(/Cora Collector/)).toBeNull();
    noWrites(posts);
  });
});
