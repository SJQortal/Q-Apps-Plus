/**
 * The Explorer's Assets tab and the Overview's Q-Assets (Simon, 2026-10-21),
 * in the mock world: Ben Target holds five assets (three priced: 🐉 at 75
 * QORT, GEMCOIN at 20, Bean Token at 0.5) and owns Moonrise No. 1 and Ben’s
 * Tickets, which he holds none of. Avatars are published as the Q-Assets
 * app does; Kit Kicked's image for Nora's Bean Token is not the owner's.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useLocation } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../../test/render';
import { fetchCallsFor, mockFetchRoute, qortalCalls } from '../../../test/setup';
import { ADDR } from '../../../test/world';
import { EXPLORER_PERSON_LINKS, PersonLinkContext } from '../../../components/common/personLinks';
import { explorerAccountPath } from '../../../routes/paths';
import { resetExplorerState } from '../../../state/explorer';
import AssetsTab from './AssetsTab';
import OverviewTab from './OverviewTab';

const T = { timeout: 8000 };
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL|ORDER|SEND|TRANSFER/;

beforeEach(() => {
  resetExplorerState();
  window.localStorage.removeItem('qmintershipplus-assets-view');
});

/** The page's query, where a test can read it. */
function Search() {
  return <span data-testid="search">{useLocation().search}</span>;
}

async function assets(address: string, search = '') {
  const result = await renderPage(
    <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
      <AssetsTab address={address} />
      <Search />
    </PersonLinkContext>,
    {
      persona: 'learner',
      path: `${explorerAccountPath(address, 'assets')}${search}`,
      route: '/explorer/account/:who/:tab?',
      strict: true,
    }
  );
  return { ...result, user: userEvent.setup() };
}

const cards = () =>
  within(screen.getByRole('list', { name: 'Its Q-Assets' }))
    .getAllByRole('button', { name: /: details$/ })
    .map((button) => button.getAttribute('aria-label')?.replace(/: details$/, ''));

describe('the Assets tab', () => {
  it('Ben’s five assets: a summary, then the cards, worth most first, unpriced last', async () => {
    const { posts } = await assets(ADDR.banTarget);
    await screen.findByRole('heading', { name: 'Q-Assets (5)' }, T);
    // 2 🐉 at 75 = 150, 6 GEMCOIN at 20 = 120, 25.5 Bean Token at 0.5 = 12.75.
    expect(await screen.findByText('≈ 282.75 QORT', {}, T)).toBeInTheDocument();
    expect(
      screen.getByText('3 of 5 have traded for QORT; the rest aren’t counted.')
    ).toBeInTheDocument();
    expect(screen.getByText('2 assets')).toBeInTheDocument();
    await waitFor(
      () =>
        expect(cards()).toEqual([
          '🐉',
          'GEMCOIN',
          'Bean Token',
          'Moonrise No. 1',
          'The Harbour Lighthouse Restoration Fund',
        ]),
      T
    );
    const key = screen.getByRole('list', { name: 'How their worth splits' });
    expect(key).toHaveTextContent('🐉 53 %');
    expect(key).toHaveTextContent('GEMCOIN 42 %');
    expect(posts).toEqual([]);
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
  });

  it('each card: how much, its share of all, its last trade and what the holding is worth', async () => {
    await assets(ADDR.banTarget);
    const gem = (await screen.findByRole('button', { name: 'GEMCOIN: details' }, T)).closest('li')!;
    await waitFor(() => expect(gem).toHaveTextContent('≈ 120 QORT'), T);
    expect(gem).toHaveTextContent('Holds6');
    expect(gem).toHaveTextContent('0.6 % of 1,000');
    expect(gem).toHaveTextContent('20 QORT each');
    expect(gem).toHaveTextContent('#77 · by Pia Promote');
    const moon = screen.getByRole('button', { name: 'Moonrise No. 1: details' }).closest('li')!;
    expect(moon).toHaveTextContent('100 % of 1');
    expect(moon).toHaveTextContent('Never traded for QORT');
    expect(within(moon).getByText('Its own')).toBeInTheDocument();
    expect(within(moon).getByText('Whole units')).toBeInTheDocument();
    const fund = screen
      .getByRole('button', { name: 'The Harbour Lighthouse Restoration Fund: details' })
      .closest('li')!;
    expect(fund).toHaveTextContent('under 0.01 % of 10,000,000,000');
  });

  it('avatars: the owner’s own Q-Assets image, never anyone else’s; a coin otherwise', async () => {
    const { container } = await assets(ADDR.banTarget);
    await screen.findByRole('button', { name: 'GEMCOIN: details' }, T);
    await waitFor(
      () =>
        expect(
          container.querySelector(
            'img[src^="/arbitrary/IMAGE/Pia%20Promote/asset77_GEMCOIN_aavatar"]'
          )
        ).not.toBeNull(),
      T
    );
    expect(
      container.querySelector(`img[src*="${encodeURIComponent('asset79_🐉_aavatar')}"]`)
    ).not.toBeNull();
    // Kit's image for Bean Token is found by the search, and never shown.
    expect(container.querySelector('img[src*="Kit%20Kicked"]')).toBeNull();
    const bean = screen.getByRole('button', { name: 'Bean Token: details' }).closest('li')!;
    expect(bean).toHaveTextContent('BT');
    // One search for every asset avatar.
    expect(fetchCallsFor('/arbitrary/resources/search')).toHaveLength(1);
  });

  it('searches by name or number, sorts, and shows a list', async () => {
    const { user } = await assets(ADDR.banTarget);
    await screen.findByRole('button', { name: 'GEMCOIN: details' }, T);
    await user.type(screen.getByRole('searchbox'), 'bean');
    expect(await screen.findByText('1 of 5 match “bean”.', {}, T)).toBeInTheDocument();
    await waitFor(() => expect(cards()).toEqual(['Bean Token']), T);
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), '#79');
    await waitFor(() => expect(cards()).toEqual(['🐉']), T);
    await user.clear(screen.getByRole('searchbox'));
    await waitFor(() => expect(cards()).toHaveLength(5), T);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'Name, A to Z');
    await waitFor(
      () =>
        expect(cards()).toEqual([
          '🐉',
          'Bean Token',
          'GEMCOIN',
          'Moonrise No. 1',
          'The Harbour Lighthouse Restoration Fund',
        ]),
      T
    );
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(window.localStorage.getItem('qmintershipplus-assets-view')).toBe('list');
    expect(cards()).toHaveLength(5);
  });

  it('opens an asset: its holders, where Ben stands, and who bought from whom', async () => {
    const { user } = await assets(ADDR.banTarget);
    await user.click(await screen.findByRole('button', { name: 'GEMCOIN: details' }, T));
    const dialog = await screen.findByRole('dialog', { name: 'GEMCOIN' }, T);
    expect(screen.getByTestId('search')).toHaveTextContent('?asset=77');
    expect(dialog).toHaveTextContent('Gems for Pia’s promotions');
    expect(
      await within(dialog).findByText('This account: #2 of 3 holders.', {}, T)
    ).toBeInTheDocument();
    const holders = within(dialog).getByRole('list', { name: 'Biggest holders' });
    expect(within(holders).getAllByRole('listitem')).toHaveLength(3);
    expect(within(holders).getByText('This account')).toBeInTheDocument();
    const trades = await within(dialog).findByRole('list', { name: 'Latest trades with QORT' }, T);
    // (Each name has its avatar's letter before it.)
    expect(trades).toHaveTextContent(/Ben Target bought 6 GEMCOIN from P?Pia Promote for 120 QORT/);
    expect(trades).toHaveTextContent('20 QORT each');
    expect(within(dialog).getByRole('link', { name: 'Find in its transactions' })).toHaveAttribute(
      'href',
      `${explorerAccountPath(ADDR.banTarget, 'transactions')}?q=GEMCOIN`
    );
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), T);
    expect(screen.getByTestId('search')).toBeEmptyDOMElement();
  });

  it('assets it owns and holds none of, and a link straight to one', async () => {
    await assets(ADDR.banTarget, '?asset=82');
    const dialog = await screen.findByRole('dialog', { name: 'Ben’s Tickets' }, T);
    expect(dialog).toHaveTextContent('This account holdsNone');
    expect(
      await within(dialog).findByText('This account: Not among its holders.', {}, T)
    ).toBeInTheDocument();
    // Behind the dialog, the page lists it.
    const owned = screen.getByRole('list', { name: 'Assets it owns, holding none', hidden: true });
    expect(
      within(owned).getByRole('button', { name: 'Ben’s Tickets: details', hidden: true })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Assets it owns, holding none (1)', hidden: true })
    ).toBeInTheDocument();
  });

  it('an account with none says so', async () => {
    await assets(ADDR.left);
    expect(await screen.findByText('Holds no Q-Assets.', {}, T)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Q-Assets (0)' })).toBeInTheDocument();
  });

  it('a holdings read that fails says so, with Retry', async () => {
    await renderPage(<AssetsTab address={ADDR.banTarget} />, {
      persona: 'learner',
      path: explorerAccountPath(ADDR.banTarget, 'assets'),
      route: '/explorer/account/:who/:tab?',
      setup: () => mockFetchRoute('/assets/balances', () => new Response('down', { status: 500 })),
    });
    expect(await screen.findByText('Couldn’t load its Q-Assets.', {}, T)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

describe('the Overview’s Q-Assets, under At a glance', () => {
  it('Avery’s, worth most first, each opening in the Assets tab', async () => {
    await renderPage(
      <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
        <OverviewTab address={ADDR.admin} />
      </PersonLinkContext>,
      {
        persona: 'learner',
        path: explorerAccountPath(ADDR.admin),
        route: '/explorer/account/:who/:tab?',
        strict: true,
      }
    );
    const glance = await screen.findByRole('region', { name: 'At a glance' }, T);
    const section = await screen.findByRole('region', { name: 'Q-Assets' }, T);
    // Right under At a glance.
    expect(glance.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const tiles = await within(section).findByRole(
      'list',
      { name: 'Its Q-Assets, worth most first' },
      T
    );
    await waitFor(
      () =>
        expect(
          within(tiles)
            .getAllByRole('link')
            .map((a) => a.textContent)
        ).toEqual([
          'GGEMCOIN2 · ≈ 40 QORT',
          'BTBean Token10 · ≈ 5 QORT',
          'LQLegacy-QORA512.25',
          'QFQORT-from-QORA3.5',
        ]),
      T
    );
    expect(within(tiles).getAllByRole('link')[0]).toHaveAttribute(
      'href',
      `${explorerAccountPath(ADDR.admin, 'assets')}?asset=77`
    );
    expect(within(section).getByRole('link', { name: /Open Assets/ })).toBeInTheDocument();
  });

  it('none: one line', async () => {
    await renderPage(<OverviewTab address={ADDR.left} />, {
      persona: 'learner',
      path: explorerAccountPath(ADDR.left),
      route: '/explorer/account/:who/:tab?',
      strict: true,
    });
    const section = await screen.findByRole('region', { name: 'Q-Assets' }, T);
    expect(await within(section).findByText('Holds no Q-Assets.', {}, T)).toBeInTheDocument();
  });
});
