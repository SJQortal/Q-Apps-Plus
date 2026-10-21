/**
 * Q-Asset trades on an account's Connections and Transactions tabs (Simon,
 * 2026-10-21: "both connections and transactions is missing Q-Assets sales
 * and buys"). The mock world: Pia Promote's sell order of 6 GEMCOIN waited,
 * and Ben Target's buy order for 120 QORT came in and matched it.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../../test/render';
import { qortalCalls } from '../../../test/setup';
import { ADDR } from '../../../test/world';
import { EXPLORER_PERSON_LINKS, PersonLinkContext } from '../../../components/common/personLinks';
import { explorerAccountPath } from '../../../routes/paths';
import { resetExplorerState } from '../../../state/explorer';
import ConnectionsTab from './ConnectionsTab';
import AccountPage from '../AccountPage';

const T = { timeout: 8000 };
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL|ORDER/;
const VIEW_KEY = 'qmintershipplus-connections-view';

beforeEach(() => resetExplorerState());

async function connections(address: string, view: 'list' | 'circle' = 'list') {
  window.localStorage.setItem(VIEW_KEY, view);
  const result = await renderPage(
    <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
      <ConnectionsTab address={address} />
    </PersonLinkContext>,
    {
      persona: 'learner',
      path: explorerAccountPath(address, 'connections'),
      route: '/explorer/account/:who/:tab?',
      strict: true,
    }
  );
  return { ...result, user: userEvent.setup() };
}

describe('Connections: asset trades', () => {
  it('Ben bought 6 GEMCOIN from Pia for 120 QORT, with the two orders behind it', async () => {
    const { user, posts } = await connections(ADDR.banTarget);
    // The section is drawn again as the reads come in: found afresh, not held.
    const list = await screen.findByRole('list', { name: 'Asset trades' }, T);
    await waitFor(
      () => expect(list).toHaveTextContent('Bought 6 GEMCOIN from Pia Promote for 120 QORT'),
      T
    );
    expect(list).toHaveTextContent('block 2,150,400');
    await user.click(within(list).getByRole('button', { name: /^Show the 2 orders/ }));
    // Both orders: Ben's and Pia's.
    const orders = await within(screen.getByRole('list', { name: 'Asset trades' })).findAllByRole(
      'button',
      { name: /placed an order to trade/i },
      T
    );
    expect(orders).toHaveLength(2);
    expect(posts).toEqual([]);
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
  });

  it('Pia sold them to Ben, the same trade from her side', async () => {
    await connections(ADDR.promote);
    const list = await screen.findByRole('list', { name: 'Asset trades' }, T);
    await waitFor(
      () => expect(list).toHaveTextContent('Sold 6 GEMCOIN to Ben Target for 120 QORT'),
      T
    );
  });

  it('on the circle, what came in and what went out both count: one node at the bottom', async () => {
    await connections(ADDR.banTarget, 'circle');
    // Found afresh: the circle is drawn again as the reads come in.
    const both = await screen.findByRole(
      'list',
      { name: /^Sent and received, the most transactions first/ },
      T
    );
    expect(
      within(both).getByRole('button', {
        name: /^Pia Promote, 2 transactions: 1 received, 6 GEMCOIN; 1 sent, 120 QORT/,
      })
    ).toBeInTheDocument();
  });

  it('an account with no filled order says it checked', async () => {
    await connections(ADDR.left);
    expect(
      await screen.findByText(/^Also checked, nothing found: .*asset trades/, {}, T)
    ).toBeInTheDocument();
  });
});

describe('Transactions: an order says how it was filled', () => {
  it('Ben’s order: “Filled: Bought 6 GEMCOIN from Pia Promote…”, and a search for Pia finds it', async () => {
    const { user } = {
      ...(await renderPage(<AccountPage />, {
        persona: 'learner',
        path: explorerAccountPath(ADDR.banTarget, 'transactions'),
        route: '/explorer/account/:who/:tab?',
        strict: true,
      })),
      user: userEvent.setup(),
    };
    const filled = await screen.findAllByText(/^Filled:/, {}, T);
    expect(filled[0].closest('[data-tx-row], div')).toHaveTextContent(
      /Filled: Bought 6 GEMCOIN from Pia Promote for 120 QORT/
    );
    await user.type(screen.getByRole('searchbox'), 'pia');
    await waitFor(
      () =>
        expect(screen.getAllByText(/^Filled:/)[0].parentElement).toHaveTextContent(/Pia Promote/),
      T
    );
  });
});
