/**
 * Transactions on Qortal on the strict mock world: results at once
 * (Payments, the latest 1,000 blocks), every search confirmed with a block
 * range and 20 rows, what waits for a block apart, the type and blocks in
 * the URL (read with appParam, written in place), "from a block", and
 * "Show older" with its live-region words and focus. Read-only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigationType } from 'react-router-dom';
import { FUNDER, TIP, answerCore, type World } from '../../../e2e/world.mjs';
import { renderPage } from '../../test/render';
import { expectNoAxeViolations } from '../../test/axe';
import { fetchCallsFor, mockFetchRoute, qortalCalls } from '../../test/setup';
import TransactionsPage from './TransactionsPage';

/** A list's rows, counted without a role query (cheap on 150 rows). */
const items = (list: HTMLElement) => list.querySelectorAll(':scope > li');
const rowButtons = (list: HTMLElement) => list.querySelectorAll<HTMLElement>('[data-tx-row]');

const T = { timeout: 4000 };
const ROUTE = '/explorer/transactions';
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;

function Probe() {
  const location = useLocation();
  const type = useNavigationType();
  return (
    <output data-testid="at">
      {location.search}|{type}
    </output>
  );
}

async function open(search = '', setup?: (world: World) => void) {
  const user = userEvent.setup();
  const result = await renderPage(
    <>
      <TransactionsPage />
      <Probe />
    </>,
    { persona: 'learner', path: `${ROUTE}${search}`, route: ROUTE, strict: true, setup }
  );
  return { ...result, user };
}

const searches = () =>
  fetchCallsFor('/transactions/search').map((call) => new URL(call, 'http://x').searchParams);

/** Every search Core can answer: confirmed, a block range, 20 rows. */
function everySearchBounded() {
  for (const p of searches()) {
    expect(p.get('confirmationStatus')).toBe('CONFIRMED');
    expect(Number(p.get('blockLimit'))).toBeGreaterThan(0);
    expect(Number(p.get('startBlock'))).toBeGreaterThan(0);
    expect(p.get('limit')).toBe('20');
    expect(p.get('address')).toBeNull();
  }
}

function noWrites(posts: string[]) {
  expect(posts).toEqual([]);
  expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
}

const results = () => screen.findByRole('region', { name: 'Confirmed transactions' }, T);

afterEach(() => vi.useRealTimers());

describe('Transactions on Qortal', () => {
  it('searches at once: payments in the latest 1,000 blocks, offering more blocks', async () => {
    const { user, container, posts } = await open();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Transactions on Qortal' }, T)
    ).toBeVisible();
    const found = await results();
    expect(
      await within(found).findByText('No payments in blocks 2,756,501–2,757,500.', {}, T)
    ).toBeVisible();
    const [first] = searches();
    expect(first.getAll('txType')).toEqual(['PAYMENT', 'TRANSFER_ASSET', 'MULTI_PAYMENT']);
    expect(first.get('startBlock')).toBe(String(TIP - 999));
    expect(first.get('blockLimit')).toBe('1000');
    expect(first.get('offset')).toBe('0');
    expect(first.get('reverse')).toBe('true');
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveValue('payments');
    expect(screen.getByRole('combobox', { name: 'Blocks' })).toHaveValue('1000');
    await expectNoAxeViolations(container);

    await user.click(
      within(found).getByRole('button', { name: 'Look in the latest 10,000 blocks' })
    );
    expect(screen.getByTestId('at')).toHaveTextContent('?blocks=10000|REPLACE');
    await waitFor(() => expect(searches().some((p) => p.get('blockLimit') === '10000')).toBe(true));
    expect(
      searches()
        .find((p) => p.get('blockLimit') === '10000')
        ?.get('startBlock')
    ).toBe(String(TIP - 9999));
    everySearchBounded();
    noWrites(posts);
  });

  it('lists what waits for a block apart from the confirmed ones', async () => {
    const { container } = await open('?type=groups');
    const found = await results();
    const confirmed = await within(found).findByRole('list', { name: 'Confirmed transactions' }, T);
    expect(items(confirmed).length).toBeGreaterThan(0);
    const waiting = await screen.findByRole('region', { name: /Waiting to be confirmed/ }, T);
    expect(
      within(waiting).getAllByRole('button', { name: /Waiting to be confirmed/ })
    ).toHaveLength(2);
    const mempool = fetchCallsFor('/transactions/unconfirmed').map(
      (call) => new URL(call, 'http://x').searchParams
    );
    expect(mempool).toHaveLength(1);
    expect(mempool[0].get('limit')).toBe('20');
    expect(mempool[0].get('blockLimit')).toBeNull();
    expect(mempool[0].getAll('txType')).toContain('GROUP_APPROVAL');
    await expectNoAxeViolations(container);
    everySearchBounded();
  });

  it('reads the type through Hub’s appended query, and writes a new one in place', async () => {
    const { user } = await open('?type=names?theme=dark&lang=en');
    await results();
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveValue('names');
    await waitFor(() =>
      expect(searches()[0].getAll('txType')).toEqual([
        'REGISTER_NAME',
        'UPDATE_NAME',
        'SELL_NAME',
        'CANCEL_SELL_NAME',
        'BUY_NAME',
      ])
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'REGISTER_NAME');
    expect(screen.getByTestId('at')).toHaveTextContent('type=REGISTER_NAME');
    expect(screen.getByTestId('at')).toHaveTextContent('|REPLACE');
    await waitFor(() =>
      expect(searches().some((p) => p.getAll('txType').join() === 'REGISTER_NAME')).toBe(true)
    );
    expect(
      await screen.findByText(
        'No transactions of the type “Name registration” in blocks 2,756,501–2,757,500.',
        {},
        T
      )
    ).toBeVisible();
    // Every type at once: every type offered (never messages), still 20 rows in a block range.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'all');
    await waitFor(() =>
      expect(searches().some((p) => p.getAll('txType').includes('PAYMENT'))).toBe(true)
    );
    const all = searches().find((p) => p.getAll('txType').length > 30)!;
    expect(all.getAll('txType')).not.toContain('MESSAGE');
    expect(all.getAll('txType')).not.toContain('CHAT');
    everySearchBounded();
  });

  it('offers no chain-wide list of messages', async () => {
    await open('?type=messages');
    await results();
    const type = screen.getByRole('combobox', { name: 'Type' });
    // A link asking for messages opens the default (Payments).
    expect(type).toHaveValue('payments');
    const offered = [...type.querySelectorAll('option')].map((o) => o.getAttribute('value'));
    expect(offered).not.toContain('messages');
    expect(offered).not.toContain('MESSAGE');
    expect(offered).not.toContain('CHAT');
    expect(searches().every((p) => !p.getAll('txType').includes('MESSAGE'))).toBe(true);
  });

  it('searches 10,000 blocks from a block typed in, and checks what is typed', async () => {
    const { user } = await open();
    await results();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Blocks' }), 'from');
    const field = screen.getByRole('textbox', { name: 'From block' });
    expect(field).toHaveAttribute('inputmode', 'numeric');
    await user.type(field, 'abc');
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a block number');
    await user.clear(field);
    await user.type(field, '9999999');
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The chain is at block 2,757,500.');
    await user.clear(field);
    await user.type(field, '2640000');
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByTestId('at')).toHaveTextContent('?blocks=from-2640000|REPLACE');
    const found = await results();
    expect(
      await within(found).findByText('All 5 payments in blocks 2,640,000–2,649,999.', {}, T)
    ).toBeVisible();
    const from = searches().find((p) => p.get('startBlock') === '2640000');
    expect(from?.get('blockLimit')).toBe('10000');
    // An older range has no mempool list.
    expect(screen.queryByRole('region', { name: /Waiting to be confirmed/ })).toBeNull();
    everySearchBounded();
  });

  it('shows older pages of 20, says what came, and keeps focus until none are left', async () => {
    const { user, posts } = await open('', (world) =>
      // 45 of Hal's payments in the range: pages of 20, 20 and 5.
      mockFetchRoute('/transactions/search', (url: URL) => {
        const p = url.searchParams;
        if (p.has('address')) return answerCore(world, url.pathname, p)?.body;
        const rows = (world.explorer.rows as Array<{ creatorAddress?: string }>)
          .filter((r) => r.creatorAddress === FUNDER.address)
          .slice(0, 45)
          .reverse();
        const offset = Number(p.get('offset'));
        return rows.slice(offset, offset + Number(p.get('limit')));
      })
    );
    const found = await results();
    const list = await within(found).findByRole('list', { name: 'Confirmed transactions' }, T);
    expect(items(list)).toHaveLength(20);
    expect(within(found).getByText(/^The newest 20 payments in blocks/)).toBeVisible();
    // By its text: a role query with a name reads every row's name first.
    const older = within(found).getByText('Show older', { selector: 'button' });
    await user.click(older);
    await waitFor(() => expect(items(list)).toHaveLength(40), T);
    expect(older).toHaveFocus();
    expect(await screen.findByText('20 older payments loaded', {}, T)).toBeInTheDocument();
    await user.click(older);
    await waitFor(() => expect(items(list)).toHaveLength(45), T);
    expect(within(found).queryByText('Show older', { selector: 'button' })).toBeNull();
    const rows = rowButtons(list);
    await waitFor(() => expect(rows[40]).toHaveFocus());
    expect(await screen.findByText('5 older payments loaded', {}, T)).toBeInTheDocument();
    expect(within(found).getByText(/^All 45 payments in blocks/)).toBeVisible();
    expect(searches().map((p) => p.get('offset'))).toEqual(['0', '20', '40']);
    everySearchBounded();
    noWrites(posts);
  });
});
