/**
 * The Connections tab in the mock world, strict (any read the world can't
 * answer fails): what was recorded between accounts (level moves, reward
 * shares, names, payments), what they have in common, the line of what was
 * checked and found nothing, evidence toggles, Compare, payer bands, Copy
 * findings and Core's own report. Read-only: no POST, no write request.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultStore } from 'jotai';
import { renderPage, type RenderPageOptions } from '../../../test/render';
import { expectNoAxeViolations } from '../../../test/axe';
import { fetchCallsFor, mockFetchRoute, qortalCalls } from '../../../test/setup';
import { ADDR } from '../../../test/world';
import {
  FUNDER,
  MESSAGE_CONTENT,
  OLD_MINTER,
  SPONSEES,
  SPONSOR,
  answerCore,
} from '../../../../e2e/world.mjs';
import { EXPLORER_PERSON_LINKS, PersonLinkContext } from '../../../components/common/personLinks';
import { explorerAccountPath } from '../../../routes/paths';
import { comparePicksAtom, resetExplorerState } from '../../../state/explorer';
import ConnectionsTab from './ConnectionsTab';

const T = { timeout: 5000 };
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;
const VERDICTS =
  /\b(alts?|suspicious|same person|fraud|strong(est)?|weak|consolidation|linked accounts|likel(y|ihood)|score)\b/i;

async function open(address: string, setup?: RenderPageOptions['setup']) {
  const result = await renderPage(
    <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
      <ConnectionsTab address={address} />
    </PersonLinkContext>,
    {
      persona: 'learner',
      path: explorerAccountPath(address, 'connections'),
      route: '/explorer/account/:who/:tab?',
      strict: true,
      setup,
    }
  );
  return { ...result, user: userEvent.setup() };
}

function noWrites(posts: string[]) {
  expect(posts).toEqual([]);
  expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
}

const region = (name: string) => screen.findByRole('region', { name }, T);

beforeEach(() => resetExplorerState());
afterEach(() => vi.useRealTimers());

describe('Connections: payments and first QORT', () => {
  it('Lou Left: payments with Kit each way, first QORT from a busy funder, and what was checked', async () => {
    const { container, posts, user } = await open(ADDR.left);
    expect(
      screen.getByText(/Nothing here shows who runs an account\./, { selector: '[role="note"]' })
    ).toBeInTheDocument();
    const recorded = await region('Recorded between them');
    const sent = await within(recorded).findByRole('list', { name: 'Sent to' }, T);
    await waitFor(
      () => expect(sent).toHaveTextContent('Paid Kit Kicked 6.3 QORT in 2 payments'),
      T
    );
    // Received from: Kit's four payments (exact sum) and Hal's first QORT.
    await user.click(within(recorded).getByRole('button', { name: /^Received from/ }));
    const got = await within(recorded).findByRole('list', { name: 'Received from' }, T);
    await waitFor(
      () => expect(got).toHaveTextContent('Received 120 QORT from Kit Kicked in 4 payments'),
      T
    );
    expect(got).toHaveTextContent('Received 5.4321 QORT from Hal Helper in 1 payment');
    // Hal has sent 640 payments: marked, and named as where its first QORT came from.
    await waitFor(() => expect(got).toHaveTextContent('has sent 500+ payments'), T);
    expect(got).toHaveTextContent('its first QORT came from them');
    expect(recorded).toHaveTextContent(
      'In all 2 QORT payments it sent and all 5 QORT payments it received, and its asset transfers and multi-payments (none).'
    );

    const common = await region('In common');
    await waitFor(
      () =>
        expect(common).toHaveTextContent(
          'First QORT payment received: 5.4321 QORT from Hal Helper. Hal Helper has sent 500+ payments.'
        ),
      T
    );
    expect(
      within(common).getByRole('link', {
        name: 'Who got their first QORT payment from this account',
      })
    ).toHaveAttribute('href', `/explorer/funded/${ADDR.left}`);

    expect(
      await screen.findByText(
        'Also checked, nothing found: level moves, a sponsor, accounts it sponsored, minting with another account now, name sales.',
        {},
        T
      )
    ).toBeInTheDocument();
    // No reward-share or name parts when there are none.
    expect(within(recorded).queryByRole('heading', { name: 'Names' })).toBeNull();
    expect(within(recorded).queryByRole('heading', { name: 'Reward shares' })).toBeNull();
    expect(document.body.textContent).not.toContain(MESSAGE_CONTENT);
    expect(document.body.textContent).not.toMatch(VERDICTS);
    await expectNoAxeViolations(container);
    noWrites(posts);
  });

  it('opens the payments behind a row, each linking to its transaction', async () => {
    const { user, world } = await open(ADDR.left);
    const recorded = await region('Recorded between them');
    await user.click(within(recorded).getByRole('button', { name: /^Received from/ }));
    const toggle = await within(recorded).findByRole(
      'button',
      { name: 'Show the 4 payments with Kit Kicked' },
      T
    );
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('4 payments');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(
      toggle.getAttribute('aria-controls') ?? ''
    ) as HTMLElement;
    const links = await within(panel).findAllByRole('link', { name: /^Open transaction/ }, T);
    expect(links).toHaveLength(4);
    const kitLou = (world.explorer as { sigs: { kitLou: string[] } }).sigs.kitLou;
    expect(links[0]).toHaveAttribute('href', `/explorer/tx/${kitLou[5]}`);
    // (The avatar's letter sits before the name.)
    await waitFor(() => expect(panel).toHaveTextContent(/Received 60 QORT from K?Kit Kicked/), T);
    expect(document.body.textContent).not.toContain(MESSAGE_CONTENT);
  });

  it('Compare picks both accounts and opens them side by side', async () => {
    const { user } = await open(ADDR.left);
    const recorded = await region('Recorded between them');
    const compare = await within(recorded).findByRole(
      'button',
      { name: 'Compare Lou Left with Kit Kicked' },
      T
    );
    await user.click(compare);
    // The compare page isn't mounted here: the router left this route.
    expect(await screen.findByTestId('navigated-away', {}, T)).toBeInTheDocument();
    expect(getDefaultStore().get(comparePicksAtom)).toEqual([ADDR.left, ADDR.kicked]);
  });

  it('MINTER members only: none of Lou’s payments were with members', async () => {
    const { user } = await open(ADDR.left);
    const recorded = await region('Recorded between them');
    const only = within(recorded).getByRole('switch', { name: 'MINTER members only' });
    await waitFor(() => expect(only).toBeEnabled(), T);
    await user.click(only);
    expect(
      await within(recorded).findByText('None with MINTER members in the data checked.', {}, T)
    ).toBeInTheDocument();
  });

  it('folds accounts that have sent 1,000+ payments into one line', async () => {
    const { user } = await open(ADDR.left, (world) =>
      mockFetchRoute('/transactions/payments/between', (url: URL) => {
        // Kit has sent 1,000+ payments here.
        if (url.searchParams.get('senderAddress') === ADDR.kicked && url.searchParams.get('offset'))
          return [{ type: 'PAYMENT' }];
        return answerCore(world, url.pathname, url.searchParams)?.body;
      })
    );
    const recorded = await region('Recorded between them');
    const fold = await within(recorded).findByRole(
      'button',
      { name: '1 more with an account that has sent 1,000+ payments' },
      T
    );
    expect(within(recorded).queryByRole('list', { name: 'Sent to' })).toBeEmptyDOMElement();
    await user.click(fold);
    expect(fold).toHaveAttribute('aria-expanded', 'true');
    const busy = within(recorded).getByRole('list', {
      name: 'Accounts that have sent 1,000+ payments',
    });
    expect(
      await within(busy).findByText('has sent 1,000+ payments', { exact: false }, T)
    ).toBeVisible();
  });

  it('Hal Helper: the newest 100 of 640, 20 rows at a time, and Check older', async () => {
    const { user } = await open(FUNDER.address);
    const recorded = await region('Recorded between them');
    const sent = await within(recorded).findByRole('list', { name: 'Sent to' }, T);
    await waitFor(() => expect(within(sent).getAllByRole('listitem')).toHaveLength(20), T);
    expect(
      within(recorded).getByRole('button', { name: 'Show more (80 more)' })
    ).toBeInTheDocument();
    expect(recorded).toHaveTextContent(
      'In its latest 100 QORT payments sent and no QORT payments received'
    );
    await user.click(within(recorded).getByRole('button', { name: 'Check older payments sent' }));
    expect(await screen.findByText('100 older payments checked.', {}, T)).toBeInTheDocument();
    expect(recorded).toHaveTextContent('its latest 200 QORT payments sent');
    // Payer bands only for the rows on screen (and Hal's own first-QORT lookup).
    expect(fetchCallsFor('/transactions/payments/between?senderAddress=Q').length).toBeLessThan(80);
  });
});

describe('Connections: minting and names', () => {
  it('Kai Target got its minting level from Olga Old, who is level 0 now', async () => {
    const { container } = await open(ADDR.kickTarget);
    const recorded = await region('Recorded between them');
    const level = await within(recorded).findByRole('list', { name: 'Minting level moved' }, T);
    await waitFor(
      () =>
        expect(level).toHaveTextContent(
          'Got its minting level from Olga Old. Olga Old is now level 0.'
        ),
      T
    );
    expect(level).toHaveTextContent('block 2,000,000');
    await expectNoAxeViolations(container);
  });

  it('Olga Old moved its level to Kai Target (read from the raw bytes)', async () => {
    await open(OLD_MINTER.address);
    const recorded = await region('Recorded between them');
    const level = await within(recorded).findByRole('list', { name: 'Minting level moved' }, T);
    await waitFor(
      () => expect(level).toHaveTextContent('Moved its minting level to Kai Target'),
      T
    );
  });

  it('Leo Learner: sponsored by Sid, sold a name, and shares Sid with 4 others', async () => {
    const { container } = await open(ADDR.learner);
    const recorded = await region('Recorded between them');
    const shares = await within(recorded).findByRole('list', { name: 'Reward shares' }, T);
    await waitFor(
      () => expect(shares).toHaveTextContent('Sponsored by Sid Sponsor at 0 % for 7,234 blocks'),
      T
    );
    expect(recorded).toHaveTextContent('Before Oct 2024 most new accounts started minting');
    const names = within(recorded).getByRole('list', { name: 'Names bought or sold' });
    await waitFor(
      () =>
        expect(names).toHaveTextContent('Sold the name “Spare Room” to Nora Nominator for 5 QORT'),
      T
    );
    const common = await region('In common');
    await waitFor(
      () => expect(common).toHaveTextContent('Also sponsored by Sid Sponsor (4 others)'),
      T
    );
    expect(
      within(common).getByRole('link', { name: /The 5 accounts it sponsored/ })
    ).toHaveAttribute('href', `/explorer/sponsees/${SPONSOR.address}`);
    await expectNoAxeViolations(container);
  });

  it('Sid Sponsor: the accounts it sponsored, and minting with Ugo now', async () => {
    await open(SPONSOR.address);
    const recorded = await region('Recorded between them');
    const link = await within(recorded).findByRole('link', { name: /^Sponsored 5 accounts/ }, T);
    expect(link).toHaveAttribute('href', `/explorer/sponsees/${SPONSOR.address}`);
    const shares = within(recorded).getByRole('list', { name: 'Reward shares' });
    await waitFor(
      () => expect(shares).toHaveTextContent(`Minting with ${SPONSEES[3].name} now`),
      T
    );
  });

  it('Avery Admin: MINTER marks from the cached lists', async () => {
    await open(ADDR.admin);
    const recorded = await region('Recorded between them');
    const sent = await within(recorded).findByRole('list', { name: 'Sent to' }, T);
    await waitFor(() => expect(sent).toHaveTextContent('Leo LearnerMINTER member'), T);
  });
});

describe('Connections: nothing found, Copy findings, Core’s report', () => {
  it('an account with no links: only the line of what was checked', async () => {
    const { container, posts } = await open(ADDR.newcomer);
    expect(
      await screen.findByText(
        'Also checked, nothing found: level moves, a sponsor, accounts it sponsored, minting with another account now, name sales, payments, where its first QORT came from.',
        {},
        T
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Recorded between them' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'In common' })).toBeNull();
    await expectNoAxeViolations(container);
    noWrites(posts);
  });

  it('copies the findings: whose, at which block, what was read, each with block and signature', async () => {
    const { user } = await open(ADDR.kickTarget);
    // After userEvent.setup(), which puts its own clipboard in place.
    const writeText = vi.fn(async (text: string) => void text);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const recorded = await region('Recorded between them');
    await waitFor(() => expect(recorded).toHaveTextContent('Olga Old is now level 0'), T);
    await screen.findByText(/^Also checked, nothing found/, {}, T);
    await user.click(screen.getByRole('button', { name: 'Copy findings' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled(), T);
    const text = writeText.mock.calls[0][0] as string;
    expect(text.split('\n')[0]).toBe(
      `Explorer findings for Kai Target (${ADDR.kickTarget}), checked at block 2,757,500`
    );
    expect(text).toMatch(
      /- Got its minting level from Olga Old \(Q\w{5}…\w{4}\)\. Olga Old \(Q\w{5}…\w{4}\) is now level 0 \(block 2,000,000, \w{8}…\)/
    );
    expect(text).toContain('Reward shares, level moves and name sales: all ');
    expect(text).toContain('Also checked, nothing found:');
    expect(text).toContain(
      `qortal://APP/Q-Mintership+/explorer/account/${ADDR.kickTarget}/connections`
    );
    expect(text).not.toMatch(VERDICTS);
    expect(
      await screen.findByText('Findings copied', { selector: '[role="status"]' })
    ).toBeInTheDocument();
  });

  it('Core’s own report only on request, with what its numbers count', async () => {
    const { user } = await open(SPONSOR.address);
    const report = await region('Core’s own report');
    expect(fetchCallsFor('/addresses/sponsorship/')).toEqual([]);
    await user.click(within(report).getByRole('button', { name: 'Load Core’s report' }));
    const lines = await within(report).findByRole('list', { name: 'Core’s report' }, T);
    expect(lines).toHaveTextContent('Accounts it ever made a reward share to: 5');
    expect(lines).toHaveTextContent('Core counts names, not accounts');
    expect(fetchCallsFor('/addresses/sponsorship/')).toHaveLength(1);
  });
});
