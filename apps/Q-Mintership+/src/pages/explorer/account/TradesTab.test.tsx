/**
 * The Explorer's Trades tab (Simon, 2026-10-26), in the mock world: Tara
 * Trader sold QORT 35 times on Q-Trade (28 for Litecoin, 4 Dogecoin, 2
 * Bitcoin, 1 Ravencoin; 18,820.5 QORT) and bought it 7 times (6 Litecoin,
 * 1 DigiByte; 2,845 QORT). Of her 47 trade offers 35 sold, 10 ended without
 * a trade and 2 are open (420 QORT). In Q-Assets: 4 trades, 220 QORT paid,
 * 92 got.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../../test/render';
import { fetchCallsFor, qortalCalls } from '../../../test/setup';
import { ADDR } from '../../../test/world';
import { TRADER } from '../../../../e2e/world.mjs';
import { EXPLORER_PERSON_LINKS, PersonLinkContext } from '../../../components/common/personLinks';
import { explorerAccountPath } from '../../../routes/paths';
import { resetExplorerState } from '../../../state/explorer';
import TradesTab from './TradesTab';

const T = { timeout: 8000 };
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL|ORDER|SEND|TRANSFER/;

beforeEach(() => {
  resetExplorerState();
});

async function trades(address: string) {
  const result = await renderPage(
    <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
      <TradesTab address={address} />
    </PersonLinkContext>,
    {
      persona: 'admin',
      path: explorerAccountPath(address, 'trades'),
      route: '/explorer/account/:who/:tab?',
      strict: true,
    }
  );
  return { ...result, user: userEvent.setup() };
}

const stat = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).closest('div') as HTMLElement;

describe('the Trades tab', () => {
  it('sums up Tara’s trades: QORT sold and bought, her offers, her Q-Asset trades', async () => {
    const { posts } = await trades(TRADER.address);
    expect(await screen.findByText('18,820.5 QORT', {}, T)).toBeInTheDocument();
    expect(stat('QORT sold on Q-Trade')).toHaveTextContent('18,820.5 QORT35 trades');
    expect(stat('QORT bought on Q-Trade')).toHaveTextContent('2,845 QORT7 trades');
    await waitFor(
      () =>
        expect(stat('Trade offers made')).toHaveTextContent(
          '4735 completed · 10 ended without a trade · 2 open'
        ),
      T
    );
    await waitFor(
      () => expect(stat('Q-Asset trades')).toHaveTextContent('4paid 220 QORT · got 92 QORT'),
      T
    );
    expect(screen.getByText(/^On Q-Trade: first trade /)).toHaveTextContent(/with 4 accounts\.$/);
    // Reads only: no Hub request that writes, no POST.
    expect(qortalCalls.filter((call) => WRITES.test(String(call.action)))).toEqual([]);
    expect(posts).toEqual([]);
  });

  it('reads each chain on each side once, and her offers by type', async () => {
    await trades(TRADER.address);
    await screen.findByText('18,820.5 QORT', {}, T);
    await waitFor(
      () => expect(stat('Trade offers made')).toHaveTextContent(/^Trade offers made47/),
      T
    );
    const reads = fetchCallsFor('/crosschain/trades');
    expect(reads).toHaveLength(12);
    for (const chain of ['LITECOIN', 'BITCOIN', 'DIGIBYTE', 'DOGECOIN', 'RAVENCOIN', 'PIRATECHAIN'])
      for (const side of ['sellerPublicKey', 'buyerPublicKey'])
        expect(
          reads.filter((url) => url.includes(`foreignBlockchain=${chain}`) && url.includes(side))
        ).toHaveLength(1);
    // Without a limit: Core pages this list badly.
    expect(reads.filter((url) => /[?&](limit|offset)=/.test(url))).toEqual([]);
    const typed = fetchCallsFor('/transactions/search').filter((url) =>
      url.includes(TRADER.address)
    );
    expect(typed.filter((url) => url.includes('txType=DEPLOY_AT'))).toHaveLength(1);
    expect(typed.filter((url) => url.includes('txType=AT&'))).toHaveLength(1);
  });

  it('lists her Q-Trade trades newest first, 10 at a time, by side and by coin', async () => {
    const { user } = await trades(TRADER.address);
    const list = await screen.findByRole('list', { name: 'Its Q-Trade trades, newest first' }, T);
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    // Her newest: she bought 45 QORT for Litecoin from Pia nine days ago.
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent(
      /^Incoming: Bought 45 QORT for 0\.153 LTC from/
    );
    await user.click(screen.getByRole('button', { name: 'Show more (32 more)' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
    await user.click(screen.getByRole('button', { name: 'Bought (7)' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(7);
    await user.click(screen.getByRole('button', { name: 'Sold (35)' }));
    await user.click(screen.getByRole('combobox', { name: 'Coin' }));
    await user.click(await screen.findByRole('option', { name: 'Dogecoin' }));
    const doge = within(list).getAllByRole('listitem');
    expect(doge).toHaveLength(4);
    for (const row of doge)
      expect(row).toHaveTextContent(/^Outgoing: Sold [\d,.]+ QORT for [\d,.]+ DOGE to/);
    // Each row links to its AT.
    expect(within(doge[0]).getByRole('link', { name: 'Its AT' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/explorer\/account\/A/)
    );
  });

  it('breaks the QORT she sold down by coin, with each coin’s share', async () => {
    await trades(TRADER.address);
    const key = await screen.findByRole(
      'list',
      { name: 'The QORT it sold, by the coin it got' },
      T
    );
    const parts = within(key).getAllByRole('listitem');
    expect(parts.map((li) => li.textContent?.split(' · ')[0])).toEqual([
      'LTC 72 %',
      'BTC 2.4 %',
      'DOGE 25 %',
      'RVN 0.8 %',
    ]);
    expect(parts[0]).toHaveTextContent('13,567 QORT for');
    const byCoin = screen.getByRole('region', { name: 'By coin' });
    expect(within(byCoin).getByRole('heading', { name: 'DigiByte (DGB)' })).toBeInTheDocument();
  });

  it('counts her offers by coin and how they ended', async () => {
    await trades(TRADER.address);
    const offers = await screen.findByRole('region', { name: 'Trade offers it made' }, T);
    const rows = within(
      within(offers).getByRole('list', { name: 'Trade offers by coin' })
    ).getAllByRole('listitem');
    expect(rows.map((li) => li.textContent)).toEqual([
      'Litecoin38 offers: 28 completed · 9 ended without a trade · 1 open',
      'Bitcoin2 offers: 2 completed',
      'Dogecoin6 offers: 4 completed · 1 ended without a trade · 1 open',
      'Ravencoin1 offer: 1 completed',
    ]);
    expect(offers).toHaveTextContent(
      'In all, 47 offers. Of those no longer open, 78 % sold. Its open offers hold 420 QORT.'
    );
  });

  it('shows her trades over time, as a chart and as a table', async () => {
    const { user } = await trades(TRADER.address);
    const chart = await screen.findByRole(
      'listbox',
      { name: /^QORT sold and bought on Q-Trade, by month\./ },
      T
    );
    const months = within(chart).getAllByRole('option');
    // From her first trade's month to her latest's, every month.
    expect(months.length).toBeGreaterThanOrEqual(19);
    expect(months.at(-1)).toHaveAttribute('aria-selected', 'true');
    chart.focus();
    await user.keyboard('{Home}');
    expect(months[0]).toHaveAttribute('aria-selected', 'true');
    expect(months[0]).toHaveAccessibleName(/: sold 120 QORT in 1 trade for LTC; bought none\.$/);
    await user.click(screen.getByRole('button', { name: 'Show as a table' }));
    const table = screen.getByRole('table', { name: 'QORT sold and bought on Q-Trade, by month' });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(10);
  });

  it('adds up her Q-Asset trades by asset and lists them', async () => {
    await trades(TRADER.address);
    const byAsset = await screen.findByRole('region', { name: 'By Q-Asset' }, T);
    const gem = within(byAsset)
      .getByRole('heading', { name: 'GEMCOIN' })
      .closest('li') as HTMLElement;
    expect(gem).toHaveTextContent('Bought10 for 200 QORT · 20 QORT each');
    expect(gem).toHaveTextContent('Sold4 for 92 QORT · 23 QORT each');
    const bean = within(byAsset)
      .getByRole('heading', { name: 'Bean Token' })
      .closest('li') as HTMLElement;
    expect(bean).toHaveTextContent('Bought400 for 20 QORT · 0.05 QORT each');
    const list = screen.getByRole('list', { name: 'Its Q-Asset trades, newest first' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent(
      /^Outgoing: Bought 400 Bean Token from/
    );
  });

  it('names her biggest trades and whom she traded with most', async () => {
    await trades(TRADER.address);
    const highlights = await screen.findByRole('region', { name: 'Highlights' }, T);
    expect(highlights).toHaveTextContent(/Biggest sale2,400 QORT for [\d.]+ LTCto/);
    expect(highlights).toHaveTextContent(/Biggest purchase1,500 QORT for 46,500 DGBfrom/);
    const top = within(highlights).getByRole('list', { name: 'The accounts it traded with most' });
    expect(within(top).getAllByRole('listitem')[0]).toHaveTextContent(
      /Lou Left.*20 trades · .* \(sold to them 18, bought from them 2\)/
    );
  });

  it('says so when an account has never traded', async () => {
    await trades(ADDR.learner);
    expect(await screen.findByText('No trades yet.', {}, T)).toBeInTheDocument();
  });
});
