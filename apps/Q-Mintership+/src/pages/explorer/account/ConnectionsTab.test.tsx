/**
 * The Connections tab in the mock world, strict (any read the world can't
 * answer fails): what was recorded between accounts (level moves, reward
 * shares, names, payments), what they have in common, the line of what was
 * checked and found nothing, evidence toggles, Compare, payer bands, Copy
 * findings and Core's own report. Read-only: no POST, no write request.
 */
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultStore } from 'jotai';
import { renderPage, type RenderPageOptions } from '../../../test/render';
import { expectNoAxeViolations } from '../../../test/axe';
import {
  fetchCallsFor,
  mockFetchRoute,
  mockQortalRequest,
  qortalCalls,
  qortalCallsFor,
} from '../../../test/setup';
import { ADDR } from '../../../test/world';
import {
  FUNDER,
  MESSAGE_CONTENT,
  OLD_MINTER,
  SPONSEES,
  SPONSOR,
  answerCore,
  type World,
} from '../../../../e2e/world.mjs';
import { EXPLORER_PERSON_LINKS, PersonLinkContext } from '../../../components/common/personLinks';
import { explorerAccountPath } from '../../../routes/paths';
import { queryLoadCounts } from '../../../data/query';
import { comparePicksAtom, resetExplorerState } from '../../../state/explorer';
import ConnectionsTab from './ConnectionsTab';
import { readText } from '../../../test/readText';

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

/**
 * The links search for `who` fills all 5 pages (its own rows first, then
 * account-flag rows that link nothing), so the read stops at its ceiling.
 */
function cappedLinks(world: World, who: string) {
  mockFetchRoute('/transactions/search', (url: URL) => {
    const sp = url.searchParams;
    const own = answerCore(world, url.pathname, sp)?.body;
    if (sp.get('address') !== who || !sp.getAll('txType').includes('REWARD_SHARE')) return own;
    const offset = Number(sp.get('offset') ?? 0);
    const real = offset === 0 && Array.isArray(own) ? own : [];
    const filler = Array.from({ length: 100 - real.length }, (_, i) => ({
      type: 'ACCOUNT_FLAGS',
      timestamp: 1_600_000_000_000 + offset + i,
      signature: `filler${offset + i}`,
      blockHeight: 1_000 + offset + i,
      creatorAddress: ADDR.admin,
      target: who,
    }));
    return [...real, ...filler];
  });
}

beforeEach(() => resetExplorerState());
afterEach(() => vi.useRealTimers());

describe('Connections: payments and first QORT', () => {
  it('Lou Left: payments with Kit each way, first QORT from a busy funder, and what was checked', async () => {
    const { container, posts, user } = await open(ADDR.left);
    const note = screen.getByText(
      /Nothing here shows who runs an account, as there is no KYC on Qortal\./,
      { selector: '[role="note"]' }
    );
    const recorded = await region('Recorded between them');
    // The facts first; the note and Copy findings after them, at the bottom.
    expect(recorded.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      note.compareDocumentPosition(screen.getByRole('button', { name: 'Copy findings' })) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
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
      'Read: every QORT payment it sent (2), every QORT payment it received (5) and every asset transfer and multi-payment (none).'
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

  it('tags the first-incoming account by what it sent: a reward share is not its first QORT', async () => {
    const ugo = SPONSEES[3].address;
    await open(ugo, (world) => {
      // Sid, whose reward share was Ugo's first incoming transaction, pays it later.
      const x = world.explorer as {
        rows: Array<Record<string, unknown>>;
        bySig: Map<string, unknown>;
        parties: Map<string, string[]>;
      };
      const row = {
        type: 'PAYMENT',
        timestamp: 1_700_000_000_000,
        fee: '0.01000000',
        signature:
          'sidPaysUgo1111111111111111111111111111111111111111111111111111111111111111111111111',
        txGroupId: 0,
        blockHeight: 2_710_000,
        approvalStatus: 'NOT_REQUIRED',
        creatorAddress: SPONSOR.address,
        senderPublicKey: world.accounts.get(SPONSOR.address)?.publicKey,
        recipient: ugo,
        amount: '3.00000000',
      };
      x.rows.push(row);
      x.bySig.set(row.signature, row);
      x.parties.set(row.signature, [SPONSOR.address, ugo]);
    });
    const recorded = await region('Recorded between them');
    const got = await within(recorded).findByRole('list', { name: 'Received from' }, T);
    await waitFor(() => expect(got).toHaveTextContent('Received 3 QORT from Sid Sponsor'), T);
    await waitFor(
      () => expect(got).toHaveTextContent('its first incoming transaction came from them'),
      T
    );
    expect(got).not.toHaveTextContent('its first QORT came from them');
    const common = await region('In common');
    await waitFor(
      () =>
        expect(common).toHaveTextContent(
          'Its first incoming transaction: a 0 % reward share from Sid Sponsor'
        ),
      T
    );
  });

  it('Show more and Show all hand the focus to the first row they add', async () => {
    const { user } = await open(FUNDER.address, (world) =>
      mockFetchRoute('/transactions/payments/between', (url: URL) =>
        // 25 payments from Kit, for the evidence list's Show all.
        url.searchParams.get('recipientAddress') === FUNDER.address &&
        !url.searchParams.get('senderAddress') &&
        url.searchParams.get('limit') === '100' &&
        !Number(url.searchParams.get('offset'))
          ? Array.from({ length: 25 }, (_, i) => ({
              type: 'PAYMENT',
              timestamp: 1_700_000_000_000 + i,
              signature: `kitPays${'z'.repeat(70)}${'123456789ABCDEFGHJKLMNPQR'[i]}`,
              blockHeight: 2_700_000 + i,
              creatorAddress: ADDR.kicked,
              recipient: FUNDER.address,
              amount: '1.00000000',
            }))
          : answerCore(world, url.pathname, url.searchParams)?.body
      )
    );
    const recorded = await region('Recorded between them');
    const sent = await within(recorded).findByRole('list', { name: 'Sent to' }, T);
    await waitFor(() => expect(within(sent).getAllByRole('listitem')).toHaveLength(20), T);
    await user.click(within(recorded).getByRole('button', { name: 'Show more (80 more)' }));
    await waitFor(() => expect(within(sent).getAllByRole('listitem')).toHaveLength(40), T);
    expect(within(sent).getAllByRole('listitem')[20]).toHaveFocus();

    // Kit's 25 payments to Hal: the evidence shows 20, then all.
    await user.click(within(recorded).getByRole('button', { name: /^Received from/ }));
    const toggle = await within(recorded).findByRole(
      'button',
      { name: 'Show the 25 payments with Kit Kicked' },
      T
    );
    await user.click(toggle);
    const panel = document.getElementById(
      toggle.getAttribute('aria-controls') ?? ''
    ) as HTMLElement;
    const evidence = within(panel).getByRole('list');
    expect(within(evidence).getAllByRole('listitem')).toHaveLength(20);
    await user.click(within(panel).getByRole('button', { name: 'Show all 25' }));
    expect(within(evidence).getAllByRole('listitem')).toHaveLength(25);
    expect(within(evidence).getAllByRole('listitem')[20]).toHaveFocus();
  });

  it('AT addresses come 20 at a time too, with Show more, never cut silently', async () => {
    const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const ats = Array.from({ length: 25 }, (_, i) => `A${'x'.repeat(32)}${B58[i]}`);
    const { user } = await open(ADDR.newcomer, (world) =>
      mockFetchRoute('/transactions/payments/between', (url: URL) =>
        url.searchParams.get('senderAddress') === ADDR.newcomer
          ? ats.map((at, i) => ({
              type: 'PAYMENT',
              timestamp: 1_700_000_000_000 + i,
              signature: `toAt${B58[i]}${'z'.repeat(80)}`,
              blockHeight: 2_700_000 + i,
              creatorAddress: ADDR.newcomer,
              recipient: at,
              amount: '1.00000000',
            }))
          : answerCore(world, url.pathname, url.searchParams)?.body
      )
    );
    const recorded = await region('Recorded between them');
    const list = await within(recorded).findByRole(
      'list',
      { name: 'AT addresses (automated contracts)' },
      T
    );
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
    expect(within(recorded).getByRole('button', { name: /^Sent to · 25$/ })).toBeInTheDocument();
    await user.click(
      within(recorded).getByRole('button', { name: 'Show more AT addresses (5 more)' })
    );
    expect(within(list).getAllByRole('listitem')).toHaveLength(25);
    expect(within(list).getAllByRole('listitem')[20]).toHaveFocus();
    expect(within(recorded).queryByRole('button', { name: /^Show more AT/ })).toBeNull();
  });

  it('Compare with no room for both says so and picks neither', async () => {
    const { user, posts } = await open(ADDR.left);
    const store = getDefaultStore();
    const three = [ADDR.admin, ADDR.nominator, ADDR.learner];
    store.set(comparePicksAtom, three);
    const recorded = await region('Recorded between them');
    await user.click(
      await within(recorded).findByRole('button', { name: 'Compare Lou Left with Kit Kicked' }, T)
    );
    expect(
      await screen.findByText('Compare holds 4 accounts. Remove one first.', {}, T)
    ).toBeInTheDocument();
    expect(store.get(comparePicksAtom)).toEqual(three);
    expect(screen.queryByTestId('navigated-away')).toBeNull();
    noWrites(posts);
  });

  it('Compare with one of the two picked already adds the other', async () => {
    const { user, posts } = await open(ADDR.left);
    const store = getDefaultStore();
    store.set(comparePicksAtom, [ADDR.admin, ADDR.left, ADDR.learner]);
    const recorded = await region('Recorded between them');
    await user.click(
      await within(recorded).findByRole('button', { name: 'Compare Lou Left with Kit Kicked' }, T)
    );
    expect(await screen.findByTestId('navigated-away', {}, T)).toBeInTheDocument();
    expect(store.get(comparePicksAtom)).toEqual([ADDR.admin, ADDR.left, ADDR.learner, ADDR.kicked]);
    noWrites(posts);
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
        return worldAnswer(world, url);
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
      'Read: its latest 100 QORT payments sent, every QORT payment it received (none)'
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
    const { container, user } = await open(ADDR.kickTarget);
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
    // The transaction behind it says the same, from Kai's side.
    await user.click(within(level).getByRole('button', { name: /^Show the 1 transaction with/ }));
    const open1 = await within(level).findByRole('link', { name: /^Open transaction/ }, T);
    const evidence = open1.closest('li');
    await waitFor(
      () => expect(evidence).toHaveTextContent(/^Incoming: Got its minting level from O?Olga Old/),
      T
    );
    // It sent nothing: the payments open on what it received.
    const got = await within(recorded).findByRole('list', { name: 'Received from' }, T);
    await waitFor(
      () => expect(got).toHaveTextContent('Received 2 QORT from Avery Admin in 1 payment'),
      T
    );
    expect(within(recorded).getByRole('button', { name: /^Received from/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
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
    // Q-Minter's history page explains reward shares, in a new Hub tab.
    mockQortalRequest('OPEN_NEW_TAB', () => true);
    await userEvent.click(
      within(recorded).getByRole('button', { name: 'How reward shares worked: Q-Minter' })
    );
    expect(qortalCallsFor('OPEN_NEW_TAB').map((c) => c.qortalLink)).toEqual([
      'qortal://WEBSITE/Q-Minter/#/history',
    ]);
    const names = within(recorded).getByRole('list', { name: 'Names bought or sold' });
    await waitFor(
      () =>
        expect(readText(names)).toContain(
          'Sold the name “Spare Room” to Nora Nominator for 5 QORT'
        ),
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

  it('a part that couldn’t be read is named with Retry, and left out of what was checked', async () => {
    const { user } = await open(ADDR.newcomer, (world) =>
      mockFetchRoute('/transactions/search', (url: URL) =>
        url.searchParams.getAll('txType').includes('TRANSFER_ASSET')
          ? new Response('{"error":5,"message":"repository issue"}', { status: 500 })
          : answerCore(world, url.pathname, url.searchParams)?.body
      )
    );
    const writeText = vi.fn(async (text: string) => void text);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const recorded = await region('Recorded between them');
    expect(
      await within(recorded).findByText(
        /^Couldn’t read its asset transfers and multi-payments\./,
        {},
        T
      )
    ).toBeInTheDocument();
    expect(within(recorded).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    // Payments: not claimed as none found.
    expect(
      await screen.findByText(
        'Also checked, nothing found: level moves, a sponsor, accounts it sponsored, minting with another account now, name sales, where its first QORT came from.',
        {},
        T
      )
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy findings' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled(), T);
    expect(writeText.mock.calls[0][0]).toContain(
      '- Couldn’t read its asset transfers and multi-payments.'
    );
  });

  it('links read to their ceiling: said on the tab, and only level moves claimed as none', async () => {
    const { user } = await open(ADDR.newcomer, (world) => cappedLinks(world, ADDR.newcomer));
    const writeText = vi.fn(async (text: string) => void text);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    expect(
      await screen.findByText(
        'Also checked, nothing found: level moves, minting with another account now, payments, where its first QORT came from.',
        {},
        T
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'In its newest 500 reward shares, level moves and name sales, nothing found: a sponsor, accounts it sponsored, name sales.'
      )
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy findings' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled(), T);
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain('Reward shares, level moves and name sales: its newest 500');
    expect(text).toContain(
      'In its newest 500 reward shares, level moves and name sales, nothing found: a sponsor, accounts it sponsored, name sales.'
    );
  });

  it('Sid Sponsor, links read to their ceiling: what was found, and a line that there may be older ones', async () => {
    await open(SPONSOR.address, (world) => cappedLinks(world, SPONSOR.address));
    const recorded = await region('Recorded between them');
    expect(
      await within(recorded).findByText(
        'From its newest 500 reward shares, level moves and name sales: there may be older ones. Every level move was read.',
        {},
        T
      )
    ).toBeInTheDocument();
    expect(
      await within(recorded).findByRole('link', { name: /^Sponsored 5 accounts/ }, T)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        'In its newest 500 reward shares, level moves and name sales, nothing found: a sponsor, name sales.',
        {},
        T
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Also checked, nothing found:.*a sponsor/)).toBeNull();
  });

  it('In common and In Q-Mintership read nothing until they near the screen', async () => {
    // Nothing ever comes into view here.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      }
    );
    try {
      const { posts } = await open(ADDR.nominator);
      const recorded = await region('Recorded between them');
      await within(recorded).findByRole('list', { name: 'Sent to' }, T);
      await screen.findByText(/^Also checked, nothing found/, {}, T);
      const loads = queryLoadCounts();
      expect(loads.xmade).toBeUndefined();
      expect(loads.nominations).toBeUndefined();
      expect(loads.communityvotes).toBeUndefined();
      expect(loads.xfirst).toBeUndefined();
      noWrites(posts);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('Core’s own report only on request, with what its numbers count', async () => {
    const { user } = await open(SPONSOR.address);
    const report = await region('Core’s own report');
    expect(fetchCallsFor('/addresses/sponsorship/')).toEqual([]);
    await user.click(within(report).getByRole('button', { name: 'Load Core’s report' }));
    const lines = await within(report).findByRole('list', { name: 'Core’s report' }, T);
    // The button went: what it loaded holds the focus.
    expect(lines.parentElement).toHaveFocus();
    expect(lines).toHaveTextContent('Accounts it ever made a reward share to: 5');
    expect(lines).toHaveTextContent('Core counts names, not accounts');
    expect(fetchCallsFor('/addresses/sponsorship/')).toHaveLength(1);
  });
});

describe('Connections: as a circle', () => {
  it('draws what came in on the left and what went out on the right; an avatar lists its transactions', async () => {
    const { container, user, world } = await open(ADDR.left);
    await region('Recorded between them');
    await user.click(screen.getByRole('button', { name: 'Circle' }));
    expect(screen.getByRole('button', { name: 'Circle' })).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('qmintershipplus-connections-view')).toBe('circle');
    const circle = await region('Connections circle');
    expect(screen.queryByRole('region', { name: 'Recorded between them' })).toBeNull();
    // Each side its own list and heading: Kit paid each way, so on both sides.
    const received = await within(circle).findByRole(
      'list',
      { name: 'Received from, the most transactions first' },
      T
    );
    const sent = within(circle).getByRole('list', { name: 'Sent to, the most transactions first' });
    expect(within(circle).getByRole('heading', { name: 'Received from' })).toBeInTheDocument();
    expect(within(circle).getByRole('heading', { name: 'Sent to' })).toBeInTheDocument();
    expect(
      within(received).getByRole('button', {
        name: 'Kit Kicked, 4 transactions received: show them',
      })
    ).toBeInTheDocument();
    expect(
      within(received).getByRole('button', {
        name: 'Hal Helper, 1 transaction received: show them',
      })
    ).toBeInTheDocument();
    expect(
      within(sent).getByRole('button', { name: 'Kit Kicked, 2 transactions sent: show them' })
    ).toBeInTheDocument();
    // Nothing links away: pressing an avatar lists its transactions.
    expect(within(circle).queryAllByRole('link')).toEqual([]);
    await expectNoAxeViolations(container);

    await user.click(
      within(received).getByRole('button', { name: /^Kit Kicked, 4 transactions received/ })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Received from Kit Kicked' }, T);
    // What was recorded, as the list says it (the avatar's letter is hidden from reading).
    expect(readText(dialog)).toContain('Received 120 QORT from Kit Kicked in 4 payments');
    const rows = within(dialog).getByRole('list', {
      name: 'Received from Kit Kicked: its transactions',
    });
    expect(rows.querySelectorAll('[data-tx-row]')).toHaveLength(4);
    expect(within(dialog).getByRole('link', { name: 'Explore Kit Kicked' })).toHaveAttribute(
      'href',
      explorerAccountPath(ADDR.kicked)
    );
    expect(world).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), T);

    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(await region('Recorded between them')).toBeInTheDocument();
    expect(window.localStorage.getItem('qmintershipplus-connections-view')).toBe('list');
  });

  it('puts the links that aren’t transfers in a row under the circle', async () => {
    const { user } = await open(ADDR.learner);
    await region('Recorded between them');
    await user.click(screen.getByRole('button', { name: 'Circle' }));
    const circle = await region('Connections circle');
    const others = await within(circle).findByRole('list', { name: 'Other links' }, T);
    // Named by what it shows first (the name, then the count), as axe asks.
    const sid = within(others).getByRole('button', {
      name: /^Sid Sponsor \d+ transactions?: show them$/,
    });
    await user.click(sid);
    const dialog = await screen.findByRole('dialog', { name: 'Sid Sponsor: other links' }, T);
    expect(dialog).toHaveTextContent('Sid Sponsor');
  });
});

describe('Connections: searched', () => {
  const field = () =>
    screen.findByRole('searchbox', { name: /^Search this account’s connections/ }, T);
  const said = () => screen.getByText(/rows? match|Nothing (matches|in this account)/);

  it('narrows every list to the rows that show what was typed; the rest step aside', async () => {
    const { user, posts, container } = await open(ADDR.left);
    const recorded = await region('Recorded between them');
    await within(recorded).findByRole('list', { name: 'Sent to' }, T);
    await region('In common');
    await user.type(await field(), 'kit');
    await waitFor(() => expect(said()).toHaveTextContent('2 rows match “kit”.'), T);
    // Payments: Kit each way, and the counts are what was found.
    expect(within(recorded).getByRole('button', { name: /^Sent to · 1/ })).toBeInTheDocument();
    expect(
      within(recorded).getByRole('button', { name: /^Received from · 1/ })
    ).toBeInTheDocument();
    expect(within(recorded).getByRole('list', { name: 'Sent to' })).toHaveTextContent(
      'Paid Kit Kicked 6.3 QORT in 2 payments'
    );
    // In common (Hal Helper's first QORT) has nothing about Kit: gone.
    expect(screen.queryByRole('region', { name: 'In common' })).toBeNull();
    // Nor the line of what was checked: it isn't about the search.
    expect(screen.queryByText(/^Also checked, nothing found/)).toBeNull();

    // Received from, searched too.
    await user.click(within(recorded).getByRole('button', { name: /^Received from/ }));
    const got = await within(recorded).findByRole('list', { name: 'Received from' }, T);
    expect(got).toHaveTextContent('Received 120 QORT from Kit Kicked in 4 payments');
    expect(got).not.toHaveTextContent('Hal Helper');
    await expectNoAxeViolations(container);
    noWrites(posts);
  });

  it('finds a slip as similar, under its own heading', async () => {
    const { user } = await open(ADDR.left);
    const recorded = await region('Recorded between them');
    await within(recorded).findByRole('list', { name: 'Sent to' }, T);
    await user.type(await field(), 'kitt kickd');
    await waitFor(
      () =>
        expect(said()).toHaveTextContent(
          'Nothing matches “kitt kickd” exactly; 2 rows are similar.'
        ),
      T
    );
    expect(
      within(recorded).getByRole('heading', { name: /^Similar to “kitt kickd”/ })
    ).toBeInTheDocument();
    expect(
      within(recorded).getByRole('list', { name: 'Sent to, similar to “kitt kickd”' })
    ).toHaveTextContent('Kit Kicked');
  });

  it('finds an account by a name it holds besides the one shown, and says so', async () => {
    const { user } = await open(ADDR.nominator);
    const recorded = await region('Recorded between them');
    await within(recorded).findByRole('list', { name: 'Sent to' }, T);
    await user.type(await field(), 'AA Ma');
    // Its row shows Avery Admin; Core's name search finds "AA Maps", which Avery holds. Until
    // that search answers nothing matches, so the section is drawn anew: read it again.
    const sent = () =>
      within(screen.getByRole('region', { name: 'Recorded between them' })).getByRole('list', {
        name: 'Sent to',
      });
    // Sent to and Received from: Avery each way, nobody else.
    await waitFor(() => expect(said()).toHaveTextContent('2 rows match “AA Ma”.'), T);
    expect(sent()).toHaveTextContent('Avery Admin');
    expect(sent()).toHaveTextContent('holds the name “AA Maps”');
    expect(sent()).not.toHaveTextContent('Leo Learner');
  });

  it('says when nothing matches, and Clear brings every list back', async () => {
    const { user } = await open(ADDR.left);
    await region('Recorded between them');
    await user.type(await field(), 'zzzz');
    await waitFor(
      () =>
        expect(said()).toHaveTextContent('Nothing in this account’s connections matches “zzzz”.'),
      T
    );
    expect(screen.queryByRole('region', { name: 'Recorded between them' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Clear the search' }));
    expect(await region('Recorded between them')).toBeInTheDocument();
  });
});
