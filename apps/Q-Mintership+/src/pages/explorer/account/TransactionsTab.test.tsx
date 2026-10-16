/**
 * An account's Transactions tab, inside its account page, on the strict
 * mock world: the family filters (chips, one picker on phones), 50 rows at
 * a time with "Load older" (the rest of a read first, then the next read),
 * what it says it loaded and where focus stays, the coverage line, what
 * the account sent that waits for a block, a busy account's "still
 * checking", and Overview's latest transactions sharing the first read.
 * Read-only: no POST, no write request to Hub.
 */
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigationType } from 'react-router-dom';
import {
  FUNDER,
  MESSAGE_CONTENT,
  answerCore,
  createWorld,
  fakeAddress,
  type World,
} from '../../../../e2e/world.mjs';
import { renderPage } from '../../../test/render';
import { expectNoAxeViolations } from '../../../test/axe';
import { fetchCallsFor, mockFetchRoute, qortalCalls } from '../../../test/setup';
import { ADDR } from '../../../test/world';
import { EXPLORER_PERSON_LINKS, PersonLinkContext } from '../../../components/common/personLinks';
import { explorerAccountPath } from '../../../routes/paths';
import { TX_FAMILIES, typesFor } from '../../../rules/explorer/txFamilies';
import { dateValue, dayStart } from '../../../rules/explorer/accountTxFilters';
import { resetExplorerState } from '../../../state/explorer';
import AccountPage from '../AccountPage';
import { LatestTransactions } from './LatestTransactions';
import TransactionsTab from './TransactionsTab';

/** A list's rows, counted without a role query (cheap on 150 rows). */
const items = (list: HTMLElement) => list.querySelectorAll(':scope > li');
const rowButtons = (list: HTMLElement) => list.querySelectorAll<HTMLElement>('[data-tx-row]');

const T = { timeout: 5000 };

/**
 * The world's own answer to a read this test's route passes on, served the
 * way the harness serves it (its status too). A read the world can't answer
 * fails the test, as strict mode does, instead of coming back as 200 null.
 */
function worldAnswer(world: World, url: URL): Response {
  const answer = answerCore(world, url.pathname, url.searchParams);
  if (!answer) {
    const path = `${url.pathname}${url.search}`;
    onTestFinished(() => {
      throw new Error(`The mock world has no answer for: ${path}`);
    });
    throw new Error(`no mock for GET ${path}`);
  }
  if (answer.text !== undefined) return new Response(answer.text, { status: answer.status });
  return new Response(JSON.stringify(answer.body), { status: answer.status });
}
/** 150 rows, or nine reads in a row: more than the default 15 s on a busy machine. */
const HEAVY = 30_000;
const ROUTE = '/explorer/account/:who/:tab?';
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;

function noWrites(posts: string[]) {
  expect(posts).toEqual([]);
  expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
}

/**
 * The tab's searches for `address` (of `types`; none = All), as
 * URLSearchParams. The page's other reads (MINTER history) search by
 * address too, with types of their own.
 */
function searches(address: string, types: readonly string[] = []): URLSearchParams[] {
  return fetchCallsFor('/transactions/search')
    .map((call) => new URL(call, 'http://x').searchParams)
    .filter(
      (p) =>
        p.get('address') === address &&
        p.get('limit') === '100' &&
        p.getAll('txType').join() === types.join()
    );
}

async function openTab(address: string, setup?: (world: World) => void) {
  const result = await renderPage(<AccountPage />, {
    persona: 'learner',
    path: explorerAccountPath(address, 'transactions'),
    route: ROUTE,
    strict: true,
    setup,
  });
  return { ...result, user: userEvent.setup() };
}

const region = (name: string | RegExp) => screen.findByRole('region', { name }, T);

const originalMatchMedia = window.matchMedia;
beforeEach(() => resetExplorerState());
afterEach(() => {
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

/** A screen `width` px wide, for MUI's breakpoint queries. */
function screenWidth(width: number) {
  window.matchMedia = ((query: string) => {
    const sizes = [...query.matchAll(/\((min|max)-width:\s*([\d.]+)px\)/g)];
    const matches =
      sizes.length > 0 &&
      !/height/.test(query) &&
      sizes.every(([, edge, value]) =>
        edge === 'min' ? width >= Number(value) : width <= Number(value)
      );
    return { ...originalMatchMedia(query), matches };
  }) as typeof window.matchMedia;
}

describe('an account’s transactions', () => {
  it(
    'shows 50, then the rest of the read, then reads older ones; says so; keeps focus',
    async () => {
      const { user, posts } = await openTab(FUNDER.address);
      const all = await region('All transactions');
      const list = await within(all).findByRole('list', { name: 'All transactions' }, T);
      await waitFor(() => expect(items(list)).toHaveLength(50), T);
      expect(rowButtons(list)[0]).toHaveAccessibleName(/^Sent 1 QORT to /);
      expect(
        within(all).getByText("The newest 50 of this account's transactions.")
      ).toBeInTheDocument();

      // By its text: a role query with a name reads every row's name first.
      const older = within(all).getByText('Load older', { selector: 'button' });
      await user.click(older);
      expect(items(list)).toHaveLength(100);
      expect(older).toHaveFocus();
      expect(await screen.findByText('50 older transactions loaded', {}, T)).toBeInTheDocument();
      // The second half of the first read: nothing more was read.
      expect(searches(FUNDER.address)).toHaveLength(1);

      await user.click(older);
      await waitFor(() => expect(items(list)).toHaveLength(150), T);
      expect(older).toHaveFocus();
      const reads = searches(FUNDER.address);
      expect(reads.map((p) => p.get('offset'))).toEqual(['0', '100']);
      expect(reads.every((p) => p.get('limit') === '100' && p.get('reverse') === 'true')).toBe(
        true
      );
      expect(
        within(all).getByText("The newest 150 of this account's transactions.")
      ).toBeInTheDocument();
      noWrites(posts);
    },
    HEAVY
  );

  it('moves focus to the first new row when nothing older is left', async () => {
    const { user } = await openTab(FUNDER.address, (world) =>
      // Hal's newest 70 only: one read holds them all.
      mockFetchRoute('/transactions/search', (url: URL) => {
        const p = url.searchParams;
        if (p.get('address') !== FUNDER.address || p.has('txType')) return worldAnswer(world, url);
        const rows = (world.explorer.rows as Array<{ creatorAddress?: string }>)
          .filter((r) => r.creatorAddress === FUNDER.address)
          .reverse()
          .slice(0, 70);
        return rows.slice(Number(p.get('offset')), Number(p.get('offset')) + 100);
      })
    );
    const all = await region('All transactions');
    const list = await within(all).findByRole('list', { name: 'All transactions' }, T);
    expect(within(all).getByText("The newest 50 of this account's 70 transactions.")).toBeVisible();
    await user.click(within(all).getByText('Load older', { selector: 'button' }));
    expect(items(list)).toHaveLength(70);
    expect(within(all).queryByText('Load older', { selector: 'button' })).toBeNull();
    const rows = rowButtons(list);
    await waitFor(() => expect(rows[50]).toHaveFocus());
    expect(await screen.findByText('20 older transactions loaded', {}, T)).toBeInTheDocument();
    expect(within(all).getByText("All 70 of this account's transactions.")).toBeVisible();
  });

  it(
    'filters by family, one read per family, each with its own empty line',
    async () => {
      const { user, posts } = await openTab(ADDR.kicked);
      await region('All transactions');
      const chips = screen.getByRole('group', { name: 'Show one kind of transaction' });
      for (const family of TX_FAMILIES) {
        await user.click(within(chips).getByRole('button', { name: family.label }));
        expect(within(chips).getByRole('button', { name: family.label })).toHaveAttribute(
          'aria-pressed',
          'true'
        );
        const title = family.key === 'all' ? 'All transactions' : family.label;
        const section = await region(title);
        await waitFor(() => {
          expect(within(section).queryByLabelText(/Loading/)).toBeNull();
          expect(
            within(section).queryByRole('list') ?? within(section).queryByText(/ history\.$/)
          ).not.toBeNull();
        }, T);
        expect(searches(ADDR.kicked, typesFor(family.key)), family.key).toHaveLength(1);
      }
      // Kit has no name transactions: said so.
      await user.click(within(chips).getByRole('button', { name: 'Names' }));
      expect(
        await screen.findByText("No name transactions in this account's history.", {}, T)
      ).toBeInTheDocument();
      // A message is listed without its content.
      await user.click(within(chips).getByRole('button', { name: 'Messages' }));
      const messages = await region('Messages');
      expect(
        await within(messages).findByRole('button', { name: /Sent a message to Lou Left/ }, T)
      ).toBeInTheDocument();
      await user.click(within(messages).getByRole('button', { name: /Sent a message/ }));
      expect(document.body.textContent).not.toContain(MESSAGE_CONTENT);
      // A family read once is kept: back to Messages costs nothing more.
      const before = fetchCallsFor('/transactions/search').length;
      await user.click(within(chips).getByRole('button', { name: 'All' }));
      await user.click(within(chips).getByRole('button', { name: 'Messages' }));
      await region('Messages');
      expect(fetchCallsFor('/transactions/search')).toHaveLength(before);
      noWrites(posts);
    },
    HEAVY
  );

  it('on phones picks the family in one native picker', async () => {
    screenWidth(360);
    const { user } = await openTab(ADDR.kicked);
    await region('All transactions');
    expect(screen.queryByRole('group', { name: 'Show one kind of transaction' })).toBeNull();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Show' }), 'payments');
    const payments = await region('Payments');
    expect(
      await within(payments).findByRole('button', { name: /Received 2 QORT from Lou Left/ }, T)
    ).toBeInTheDocument();
  });

  it('lists what the account sent that waits for a block, in the family picked', async () => {
    // An admin whose approval is still in the mempool (world.mjs: extraAdmins[9]).
    const { user, container } = await openTab(fakeAddress('admin-9'));
    const waiting = await region(/Sent by this account, waiting to be confirmed/);
    expect(within(waiting).getByText(/sent to this account show only once/)).toBeInTheDocument();
    expect(
      await within(waiting).findByRole(
        'button',
        { name: /Approved transaction .*Waiting to be confirmed/ },
        T
      )
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
    await user.click(
      within(screen.getByRole('group', { name: 'Show one kind of transaction' })).getByRole(
        'button',
        { name: 'Payments' }
      )
    );
    await region('Payments');
    expect(screen.queryByRole('region', { name: /waiting to be confirmed/ })).toBeNull();
  });

  it('says it is still checking when a busy account’s search takes over 3 s', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await openTab(FUNDER.address, () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'], shouldAdvanceTime: true });
      mockFetchRoute('/transactions/search', async () => {
        await gate;
        return [];
      });
    });
    const all = await region('All transactions');
    expect(within(all).queryByText('Still checking (busy account)…')).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(3100));
    expect(await within(all).findByText('Still checking (busy account)…', {}, T)).toBeVisible();
    release();
    expect(
      await within(all).findByText("No transactions in this account's history.", {}, T)
    ).toBeInTheDocument();
    expect(within(all).queryByText('Still checking (busy account)…')).toBeNull();
  });
});

/** Where the app is and how it got there. */
function Probe() {
  const location = useLocation();
  const type = useNavigationType();
  return (
    <output data-testid="at">
      {location.pathname}|{type}
    </output>
  );
}

describe('Overview’s latest transactions', () => {
  it('shows the newest 5 from the tab’s own first read, and opens the tab in place', async () => {
    const user = userEvent.setup();
    const { container, posts } = await renderPage(
      <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
        <LatestTransactions address={ADDR.kicked} />
        <Probe />
      </PersonLinkContext>,
      { persona: 'learner', path: explorerAccountPath(ADDR.kicked), route: ROUTE, strict: true }
    );
    const latest = await region('Latest transactions');
    const list = await within(latest).findByRole('list', { name: 'Latest transactions' }, T);
    expect(items(list)).toHaveLength(5);
    await expectNoAxeViolations(container);
    await user.click(within(latest).getByRole('link', { name: 'All transactions' }));
    expect(screen.getByTestId('at')).toHaveTextContent(
      `${explorerAccountPath(ADDR.kicked, 'transactions')}|REPLACE`
    );
    noWrites(posts);
  });

  it('shares the All list’s first read with the Transactions tab', async () => {
    await renderPage(
      <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
        <LatestTransactions address={ADDR.kicked} />
        <TransactionsTab address={ADDR.kicked} />
      </PersonLinkContext>,
      { persona: 'learner', path: '/x', strict: true }
    );
    await within(await region('Latest transactions')).findByRole('list', {}, T);
    await within(await region('All transactions')).findByRole('list', {}, T);
    expect(searches(ADDR.kicked)).toHaveLength(1);
  });

  it('says in one line when an account has none', async () => {
    await renderPage(<LatestTransactions address={fakeAddress('nobody-at-all')} />, {
      persona: 'learner',
      path: '/x',
      strict: true,
    });
    expect(await screen.findByText('No transactions yet.', {}, T)).toBeInTheDocument();
  });
});

describe('an account’s transactions, filtered', () => {
  function Where() {
    const location = useLocation();
    return <output data-testid="where">{location.search}</output>;
  }
  const where = () => new URLSearchParams(screen.getByTestId('where').textContent ?? '');
  async function openFiltered(address: string, query = '') {
    const result = await renderPage(
      <>
        <AccountPage />
        <Where />
      </>,
      {
        persona: 'learner',
        path: `${explorerAccountPath(address, 'transactions')}${query}`,
        route: ROUTE,
        strict: true,
      }
    );
    return { ...result, user: userEvent.setup() };
  }
  const select = (name: string) => screen.getByRole('combobox', { name });
  /** Every search the tab made for `address`, whatever its types. */
  const allSearches = (address: string) =>
    fetchCallsFor('/transactions/search')
      .map((call) => new URL(call, 'http://x').searchParams)
      .filter((p) => p.get('address') === address && p.get('limit') === '100');

  it(
    'orders oldest first (Core’s order) or by the biggest amount (the rows read), kept in the URL',
    async () => {
      const { user, posts } = await openFiltered(FUNDER.address);
      const all = await region('All transactions');
      const list = await within(all).findByRole('list', { name: 'All transactions' }, T);
      const newest = rowButtons(list)[0].textContent;

      await user.selectOptions(select('Order'), 'oldest');
      expect(where().get('order')).toBe('oldest');
      await waitFor(
        () => expect(allSearches(FUNDER.address).at(-1)?.get('reverse')).toBe('false'),
        T
      );
      // The list is drawn anew for each choice: read the section again.
      const section = () => screen.getByRole('region', { name: 'All transactions' });
      await waitFor(
        () =>
          expect(
            within(section()).getByText(/^The oldest 50 of this account's transactions\./)
          ).toBeVisible(),
        T
      );
      expect(
        rowButtons(within(section()).getByRole('list', { name: 'All transactions' }))[0].textContent
      ).not.toBe(newest);
      expect(within(section()).getByText('Load newer', { selector: 'button' })).toBeInTheDocument();
      expect(screen.getByText(/^Showing: All transactions · oldest first$/)).toBeInTheDocument();

      await user.selectOptions(select('Order'), 'amount');
      expect(where().get('order')).toBe('amount');
      await waitFor(
        () =>
          expect(
            within(section()).getByText(/^Biggest amounts first, among the 100 read so far\./)
          ).toBeVisible(),
        T
      );
      // Never a block range: with an address Core would read every transaction in those blocks.
      expect(allSearches(FUNDER.address).some((p) => p.has('startBlock'))).toBe(false);

      await user.click(screen.getByRole('button', { name: 'Clear filters' }));
      expect(where().toString()).toBe('');
      expect(select('Order')).toHaveValue('newest');
      noWrites(posts);
    },
    HEAVY
  );

  it(
    'shows the transactions between two dates, by each one’s own time, from the URL or typed',
    async () => {
      const world = createWorld();
      const funderRows = (world.explorer.rows as Array<{ timestamp: number; signature: string }>)
        .filter((r) => world.explorer.parties.get(r.signature)?.includes(FUNDER.address))
        .sort((a, b) => b.timestamp - a.timestamp);
      // A day in the middle of Hal's rows: from it on.
      const day = dateValue(funderRows[Math.floor(funderRows.length / 2)].timestamp);
      const { user, posts } = await openFiltered(FUNDER.address);
      await region('All transactions');
      await user.selectOptions(select('When'), 'dates');
      const form = screen.getByRole('form', { name: 'Between dates' });
      await user.click(within(form).getByRole('button', { name: 'Show' }));
      expect(within(form).getByRole('alert')).toHaveTextContent(
        'Pick a first day, a last day, or both.'
      );
      fireEvent.change(within(form).getByLabelText('First day'), { target: { value: day } });
      await user.click(within(form).getByRole('button', { name: 'Show' }));
      expect(where().get('when')).toBe('dates');
      expect(where().get('from')).toBe(day);
      const all = await region('All transactions');
      const expected = funderRows.filter((r) => r.timestamp >= dayStart(day)).length;
      await waitFor(() => {
        expect(
          within(all).getByText(
            new RegExp(
              `(All ${expected}|The newest ${Math.min(50, expected)}) of this account's transactions since `
            )
          )
        ).toBeVisible();
      }, T);
      expect(allSearches(FUNDER.address).some((p) => p.has('startBlock'))).toBe(false);
      noWrites(posts);
    },
    HEAVY
  );

  it('picks one of its names, the primary first, and says when a kind is never about a name', async () => {
    const { user } = await openFiltered(ADDR.learner, '?name=Spare%20Room');
    const section = await region('All transactions');
    await waitFor(
      () =>
        expect(
          within(section).getByText(
            "All 3 of this account's name and QDN transactions about “Spare Room”."
          )
        ).toBeVisible(),
      T
    );
    // A name from a link stays picked even when the account no longer has it.
    expect(select('Name')).toHaveValue('Spare Room');
    const options = within(select('Name'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options[0]).toBe('Any name');
    // Only the types that carry a name were asked for.
    const asked = allSearches(ADDR.learner).at(-1)?.getAll('txType') ?? [];
    expect([...asked].sort()).toEqual([
      'ARBITRARY',
      'BUY_NAME',
      'CANCEL_SELL_NAME',
      'REGISTER_NAME',
      'SELL_NAME',
      'UPDATE_NAME',
    ]);

    const chips = screen.getByRole('group', { name: 'Show one kind of transaction' });
    await user.click(within(chips).getByRole('button', { name: 'Payments' }));
    expect(
      await screen.findByText(
        'Payments are never about a name. Pick All, Names or QDN data to see transactions about “Spare Room”.',
        {},
        T
      )
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(where().toString()).toBe('');
    // "Any name" is the empty value: the label stays above it, not on it.
    expect(select('Name')).toHaveValue('');
    expect(document.querySelector('label[data-shrink="false"]')).toBeNull();
  });
});
