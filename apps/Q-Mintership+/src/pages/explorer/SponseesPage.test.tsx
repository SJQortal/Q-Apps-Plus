/**
 * A sponsor's sponsees, in the mock world (strict): the summary with its
 * denominators, a row per account with MINTER, minting and level facts,
 * picking up to 4 for Compare, and the two checks across the set with
 * progress and Stop. Read-only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, type RenderPageOptions } from '../../test/render';
import { expectNoAxeViolations } from '../../test/axe';
import { mockFetchRoute, qortalCalls } from '../../test/setup';
import { ADDR } from '../../test/world';
import { SPONSEES, SPONSOR, answerCore } from '../../../e2e/world.mjs';
import { explorerSponseesPath } from '../../routes/paths';
import { resetExplorerState } from '../../state/explorer';
import SponseesPage from './SponseesPage';

const T = { timeout: 5000 };
const ROUTE = '/explorer/sponsees/:address';

async function open(address = SPONSOR.address, setup?: RenderPageOptions['setup']) {
  const result = await renderPage(<SponseesPage />, {
    persona: 'learner',
    path: explorerSponseesPath(address),
    route: ROUTE,
    strict: true,
    setup,
  });
  return { ...result, user: userEvent.setup() };
}

const list = () => screen.findByRole('list', { name: `Accounts ${SPONSOR.name} sponsored` }, T);

beforeEach(() => resetExplorerState());
afterEach(() => vi.useRealTimers());

describe('the accounts a sponsor sponsored', () => {
  it('counts them with their denominators and lists each with its facts', async () => {
    const { container, posts } = await open();
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: `Accounts ${SPONSOR.name} sponsored` },
        T
      )
    ).toBeVisible();
    expect((await list()).children).toHaveLength(5);
    await waitFor(
      () =>
        expect(
          screen.getByText(/^5 accounts sponsored, /, { selector: '[role="status"]' })
        ).toHaveTextContent(
          /^5 accounts sponsored, \w{3} \d{4} – \w{3} \d{4}: 1 in MINTER now, 1 minting now, 0 with a minting penalty\.$/
        ),
      T
    );
    const leo = await screen.findByRole('list', { name: 'About Leo Learner' }, T);
    expect(leo).toHaveTextContent(/In MINTER since/);
    await waitFor(() => expect(leo).toHaveTextContent('Level 2'), T);
    const ugo = await screen.findByRole('list', { name: `About ${SPONSEES[3].name}` }, T);
    expect(ugo).toHaveTextContent('Minting now');
    expect(
      screen.getByText(/at 0 % \(block 1,380,000\), removed 120,000 blocks later/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Before Oct 2024 most new accounts started minting/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy a link to this list' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
    expect(posts).toEqual([]);
    expect(
      qortalCalls.filter((c) => /INVITE|KICK|BAN|JOIN|SIGN|PUBLISH/.test(String(c.action)))
    ).toEqual([]);
  });

  it('picks up to 4 accounts, then Compare opens them', async () => {
    const { user } = await open();
    await list();
    const compare = screen.getByRole('button', { name: /^Compare/ });
    expect(compare).toBeDisabled();
    // In the order of their first share: Leo, Sam, Tia, the one without a name, Ugo.
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(5);
    await waitFor(() => expect(boxes[0]).toHaveAccessibleName('Pick Leo Learner to compare'), T);
    for (const box of boxes.slice(0, 4)) await user.click(box);
    expect(compare).toHaveTextContent('Compare 4');
    expect(boxes[4]).toBeDisabled();
    await user.click(boxes[3]);
    expect(boxes[4]).toBeEnabled();
    await user.click(compare);
    expect(await screen.findByTestId('navigated-away', {}, T)).toBeInTheDocument();
  });

  it('checks who made their first QORT payment, on request', async () => {
    const { user } = await open();
    await list();
    const card = screen.getByRole('region', { name: 'Who made their first QORT payment' });
    await user.click(within(card).getByRole('button', { name: 'Check 5 accounts' }));
    expect(await within(card).findByText('Checked all 5 accounts.', {}, T)).toBeInTheDocument();
    // One button through the run (Check, Stop, Check again): it keeps the focus.
    expect(within(card).getByRole('button', { name: 'Check again' })).toHaveFocus();
    const payers = within(card).getByRole('list', { name: 'First QORT payments by payer' });
    await waitFor(
      () =>
        expect(payers).toHaveTextContent(
          /H?Hal Helper made the first QORT payment to 2 of these 5 accounts\. H?Hal Helper has sent 500\+ payments\./
        ),
      T
    );
    expect(card).toHaveTextContent('1 account had another first transaction');
  });

  it('stops starting new accounts when asked', async () => {
    const { user } = await open(SPONSOR.address, (world) =>
      // Slow transaction reads, so the check is still running when Stop is pressed.
      mockFetchRoute('/transactions/', async (url: URL) => {
        await new Promise((r) => setTimeout(r, 250));
        const answer = answerCore(world, url.pathname, url.searchParams);
        if (!answer) throw new Error(`no mock for ${url.pathname}`);
        return new Response(answer.text !== undefined ? answer.text : JSON.stringify(answer.body), {
          status: answer.status,
        });
      })
    );
    await list();
    const card = screen.getByRole('region', { name: 'Who made their first QORT payment' });
    await user.click(within(card).getByRole('button', { name: 'Check 5 accounts' }));
    await user.click(await within(card).findByRole('button', { name: 'Stop' }, T));
    expect(
      await within(card).findByText(/^Stopped after [0-4] of 5 accounts\.$/, {}, T)
    ).toBeInTheDocument();
  });

  it('checks where their QORT went, on request', async () => {
    const { user } = await open();
    await list();
    const card = screen.getByRole('region', { name: 'Where their QORT went' });
    await user.click(within(card).getByRole('button', { name: 'Check 5 accounts' }));
    expect(await within(card).findByText('Checked all 5 accounts.', {}, T)).toBeInTheDocument();
    expect(
      within(card).getByText('No QORT payments sent among those checked.')
    ).toBeInTheDocument();
  });

  it('a sponsor of no one, and an address that isn’t one', async () => {
    const first = await open(ADDR.left);
    expect(
      await screen.findByText('Lou Left made no reward shares to other accounts.', {}, T)
    ).toBeInTheDocument();
    first.unmount();
    await open('not-an-address');
    expect(
      await screen.findByText("This isn't a valid Qortal address. A letter may be wrong.", {}, T)
    ).toBeInTheDocument();
  });
});
