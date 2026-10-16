/**
 * An account's Transactions tab, inside its account page, on the strict
 * mock world: the family filters (chips, one picker on phones), 50 rows at
 * a time with "Load older" (the rest of a read first, then the next read),
 * what it says it loaded and where focus stays, the coverage line, what
 * the account sent that waits for a block, a busy account's "still
 * checking", and Overview's latest transactions sharing the first read.
 * Read-only: no POST, no write request to Hub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigationType } from 'react-router-dom';
import {
  FUNDER,
  MESSAGE_CONTENT,
  answerCore,
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
import { resetExplorerState } from '../../../state/explorer';
import AccountPage from '../AccountPage';
import { LatestTransactions } from './LatestTransactions';
import TransactionsTab from './TransactionsTab';

const T = { timeout: 5000 };
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
  it('shows 50, then the rest of the read, then reads older ones; says so; keeps focus', async () => {
    const { user, container, posts } = await openTab(FUNDER.address);
    const all = await region('All transactions');
    const list = await within(all).findByRole('list', { name: 'All transactions' }, T);
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(50), T);
    expect(within(list).getAllByRole('button')[0]).toHaveAccessibleName(/^Sent 1 QORT to /);
    expect(
      within(all).getByText("The newest 50 of this account's transactions.")
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);

    const older = within(all).getByRole('button', { name: 'Load older' });
    await user.click(older);
    expect(within(list).getAllByRole('listitem')).toHaveLength(100);
    expect(older).toHaveFocus();
    expect(await screen.findByText('50 older transactions loaded', {}, T)).toBeInTheDocument();
    // The second half of the first read: nothing more was read.
    expect(searches(FUNDER.address)).toHaveLength(1);

    await user.click(older);
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(150), T);
    expect(older).toHaveFocus();
    const reads = searches(FUNDER.address);
    expect(reads.map((p) => p.get('offset'))).toEqual(['0', '100']);
    expect(reads.every((p) => p.get('limit') === '100' && p.get('reverse') === 'true')).toBe(true);
    expect(
      within(all).getByText("The newest 150 of this account's transactions.")
    ).toBeInTheDocument();
    noWrites(posts);
  });

  it('moves focus to the first new row when nothing older is left', async () => {
    const { user } = await openTab(FUNDER.address, (world) =>
      // Hal's newest 70 only: one read holds them all.
      mockFetchRoute('/transactions/search', (url: URL) => {
        const p = url.searchParams;
        if (p.get('address') !== FUNDER.address || p.has('txType'))
          return answerCore(world, url.pathname, p)?.body;
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
    await user.click(within(all).getByRole('button', { name: 'Load older' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(70);
    expect(within(all).queryByRole('button', { name: 'Load older' })).toBeNull();
    const rows = within(list).getAllByRole('button', { expanded: false });
    await waitFor(() => expect(rows[50]).toHaveFocus());
    expect(await screen.findByText('20 older transactions loaded', {}, T)).toBeInTheDocument();
    expect(within(all).getByText("All 70 of this account's transactions.")).toBeVisible();
  });

  it('filters by family, one read per family, each with its own empty line', async () => {
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
  });

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
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
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
