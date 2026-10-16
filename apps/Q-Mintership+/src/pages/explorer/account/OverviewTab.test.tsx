/**
 * The account page's Overview, on the mock world in strict mode (a read the
 * world can't answer fails the test): the summary sentence and its links,
 * the facts, MINTER, minting, notes, an account with no public key, a
 * section that fails on its own, and no writes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigationType } from 'react-router-dom';
import { renderPage } from '../../../test/render';
import { expectNoAxeViolations } from '../../../test/axe';
import { fetchCallsFor, mockFetchRoute, qortalCalls } from '../../../test/setup';
import { ADDR, MS_PER_BLOCK, NOW, TIP } from '../../../test/world';
import { COLLECTOR, SPONSEES, SPONSOR } from '../../../../e2e/world.mjs';
import { explorerAccountPath, personPath } from '../../../routes/paths';
import { resetExplorerState } from '../../../state/explorer';
import { formatDate } from '../../../utils/format';
import AccountPage from '../AccountPage';
import { monthYear } from './overview/overviewWords';
import { readText } from '../../../test/readText';

const T = { timeout: 4000 };
const ROUTE = '/explorer/account/:who/:tab?';
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;
const blockTime = (height: number) => NOW - (TIP - height) * MS_PER_BLOCK;

function Probe() {
  const location = useLocation();
  const type = useNavigationType();
  return (
    <output data-testid="at">
      {location.pathname}|{type}
    </output>
  );
}

async function open(address: string, setup?: () => void) {
  const result = await renderPage(
    <>
      <AccountPage />
      <Probe />
    </>,
    { persona: 'learner', path: explorerAccountPath(address), route: ROUTE, strict: true, setup }
  );
  return { ...result, user: userEvent.setup() };
}

const panel = () => screen.findByRole('tabpanel', { name: 'Overview' }, T);
const region = (name: string) => screen.findByRole('region', { name }, T);
/** A fact's value (the dd after its dt), and its second line when it has one. */
const fact = (label: string) => {
  const dt = screen.getByText(label, { selector: 'dt' });
  return {
    value: dt.nextElementSibling?.textContent ?? '',
    detail: dt.nextElementSibling?.nextElementSibling?.textContent ?? '',
  };
};

function noWrites(posts: string[]) {
  expect(posts).toEqual([]);
  expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
}

beforeEach(() => resetExplorerState());
afterEach(() => vi.useRealTimers());

describe('Overview: a Minter Admin minting now', () => {
  it('sums the account up, lists its facts, MINTER and minting; passes axe; writes nothing', async () => {
    const { container, posts } = await open(ADDR.admin);
    const overview = await panel();

    // 1. The summary sentence, its parts linking to their tabs.
    const names = await within(overview).findByRole('link', { name: 'owns 3 names' }, T);
    expect(names).toHaveAttribute('href', explorerAccountPath(ADDR.admin, 'names'));
    const minter = await within(overview).findByRole(
      'link',
      { name: /^Minter Admin, in MINTER/ },
      T
    );
    expect(minter).toHaveAttribute('href', explorerAccountPath(ADDR.admin, 'mintership'));
    const summary = names.closest('p') as HTMLElement;
    await waitFor(() => expect(summary).toHaveTextContent(/· last sent a transaction .+ ago$/), T);
    expect(summary.textContent).toMatch(
      /^Level 7 · Minter Admin, in MINTER( since \w{3} \d{4})? · owns 3 names · first seen \w{3} \d{4} · last sent/
    );

    // 3. Facts.
    const facts = await region('At a glance');
    expect(fact('Level').value).toBe('7');
    expect(fact('Level').detail).toBe('442,801 blocks to level 8');
    expect(
      within(facts).getByRole('progressbar', { name: /^Progress to level 8: \d+%$/ })
    ).toBeInTheDocument();
    expect(fact('Blocks minted')).toEqual({ value: '1,730,799', detail: '' });
    await waitFor(() => expect(fact('Balance').value).toBe('12.5 QORT'), T);
    expect(fact('Balance').detail).toBe('');
    await waitFor(() => expect(fact('First seen').value).not.toBe('Loading'), T);
    expect(fact('First seen').detail).toMatch(/^At block [\d,]+$/);
    await waitFor(() => expect(fact('Groups').value).toBe('In 3 groups'), T);
    const groups = within(facts).getByRole('list', { name: 'Its groups' });
    const rows = within(groups).getAllByRole('listitem');
    // MINTER first; the admin owns and runs the helpers' group.
    // Each group with its avatar (its owner's group THUMBNAIL; the letter until it loads).
    expect(rows.map((row) => row.querySelector('[aria-hidden="true"]')?.textContent)).toEqual([
      'M',
      'Q',
      'Q',
    ]);
    expect(rows.map((row) => readText(row))).toEqual([
      expect.stringMatching(/^MINTER[\d,]+ membersAdmin$/),
      'Qortal General5,200 members',
      'Q-Mintership Helpers40 membersOwnerAdmin',
    ]);
    expect(within(facts).queryByRole('button', { name: /^Show all/ })).toBeNull();

    // 4. MINTER: the person page's sentence and the two ways on.
    const minterSection = await region('MINTER');
    expect(await within(minterSection).findByText(/^Minter Admin/, {}, T)).toBeInTheDocument();
    expect(within(minterSection).getByRole('link', { name: 'Mintership' })).toHaveAttribute(
      'href',
      explorerAccountPath(ADDR.admin, 'mintership')
    );
    expect(within(minterSection).getByRole('link', { name: 'MINTER profile' })).toHaveAttribute(
      'href',
      personPath(ADDR.admin)
    );

    // 5. Minting.
    const minting = await region('Minting');
    expect(await within(minting).findByText('Minting now.', {}, T)).toBeInTheDocument();
    expect(
      await within(minting).findByText(
        `Last signed a block: ${formatDate(blockTime(TIP - 3))} (block 2,757,497).`,
        {},
        T
      )
    ).toBeInTheDocument();

    // 7. No notes for an ordinary account.
    expect(screen.queryByRole('region', { name: 'Notes' })).toBeNull();

    await expectNoAxeViolations(container);
    noWrites(posts);
  });

  it('opens a tab from the summary in place, with the focus on that tab', async () => {
    const { user } = await open(ADDR.admin);
    const overview = await panel();
    await user.click(await within(overview).findByRole('link', { name: 'owns 3 names' }, T));
    await waitFor(
      () =>
        expect(screen.getByTestId('at')).toHaveTextContent(
          `${explorerAccountPath(ADDR.admin, 'names')}|REPLACE`
        ),
      T
    );
    const tab = screen.getByRole('tab', { name: 'Names' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(tab).toHaveFocus();
  });
});

describe('Overview: penalty, notes and a busy name list', () => {
  it('says what Core recorded, with the numbers, and counts the notes on its other names', async () => {
    const { container, user, posts } = await open(COLLECTOR.address);
    const overview = await panel();
    const summary = (
      await within(overview).findByRole('link', { name: 'owns 30 names' }, T)
    ).closest('p') as HTMLElement;
    await waitFor(
      () =>
        expect(summary).toHaveTextContent(
          `Level 0 · not in MINTER · owns 30 names · first seen ${monthYear(blockTime(1_500_000))} · last sent a transaction 2 days ago`
        ),
      T
    );

    expect(fact('Blocks minted')).toEqual({
      value: '1,200,000',
      detail: 'Adjustment +12,000 · Penalty −5,000,000',
    });
    await waitFor(() => expect(fact('Balance').value).toBe('6,480.54 QORT'), T);
    expect(fact('Balance').detail).toBe('Exactly 6,480.54123456 QORT');
    await waitFor(() => expect(fact('First seen').value).toBe(formatDate(blockTime(1_500_000))), T);
    expect(fact('First seen').detail).toBe('At block 1,500,000');

    const minting = await region('Minting');
    expect(await within(minting).findByText('Not minting right now.', {}, T)).toBeInTheDocument();
    expect(
      await within(minting).findByText('Last signed a block: none found.', {}, T)
    ).toBeInTheDocument();

    const notes = await region('Notes');
    expect(
      within(notes).getByText(
        "Core recorded a minting penalty of −5,000,000 blocks on this account. The chain doesn't record why."
      )
    ).toBeInTheDocument();
    const others = await within(notes).findByRole(
      'link',
      { name: '3 of its 29 other names have notes' },
      T
    );
    expect(others).toHaveAttribute('href', explorerAccountPath(COLLECTOR.address, 'names'));
    await expectNoAxeViolations(container);
    await user.click(others);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Names' })).toHaveFocus(), T);
    noWrites(posts);
  });

  it('notes how its primary name is written', async () => {
    const odd = 'QCora...Maps';
    await open(COLLECTOR.address, () => {
      mockFetchRoute(`/names/primary/${COLLECTOR.address}`, {
        name: odd,
        owner: COLLECTOR.address,
      });
    });
    const notes = await region('Notes');
    expect(
      await within(notes).findByText(
        (_, el) =>
          el?.tagName === 'P' &&
          readText(el) === `About its primary name “${odd}”: This name is written like an address.`,
        {},
        T
      )
    ).toBeInTheDocument();
    // The other two of its three names with notes.
    expect(
      within(notes).getByRole('link', { name: '2 of its 29 other names have notes' })
    ).toBeVisible();
  });
});

describe('Overview: accounts that never sent anything', () => {
  it('reads naturally with no public key and no name: no "last sent", no signed blocks', async () => {
    const unnamed = SPONSEES[2].address;
    const { posts } = await open(unnamed);
    const overview = await panel();
    await waitFor(
      () =>
        expect(within(overview).getByText(/^Level 0 · /)).toHaveTextContent(
          /^Level 0 · not in MINTER · no registered name · first seen \w{3} \d{4}$/
        ),
      T
    );
    expect(within(overview).queryByRole('link', { name: /names?$/ })).toBeNull();
    const minting = await region('Minting');
    expect(await within(minting).findByText('Not minting right now.', {}, T)).toBeInTheDocument();
    expect(within(minting).queryByText(/Last signed/)).toBeNull();
    expect(fetchCallsFor('/transactions/creator/')).toEqual([]);
    expect(fetchCallsFor(`/blocks/signer/${unnamed}`)).toEqual([]);
    noWrites(posts);
  });

  it('names the account it mints with through a reward share', async () => {
    await open(SPONSEES[3].address);
    const minting = await region('Minting');
    const line = await within(minting).findByText(/^Minting now with/, {}, T);
    // (Its letter avatar reads "S" before the name.)
    expect(line).toHaveTextContent(/^Minting now with S?Sid Sponsor \(a reward share\)\.$/);
    expect(
      within(line).getByRole('link', { name: 'Sid Sponsor: explore this account' })
    ).toHaveAttribute('href', explorerAccountPath(SPONSOR.address));
  });
});

describe('Overview: the last block it signed', () => {
  it('dates it from the block itself when Core’s answer has no time (as on mainnet)', async () => {
    await open(ADDR.nominator, () =>
      mockFetchRoute(`/blocks/signer/${ADDR.nominator}`, [
        { height: TIP - 12, signature: 'sig', minterPublicKey: 'key', onlineAccountsCount: 360 },
      ])
    );
    const minting = await region('Minting');
    expect(
      await within(minting).findByText(
        `Last signed a block: ${formatDate(blockTime(TIP - 12))} (block 2,757,488).`,
        {},
        T
      )
    ).toBeInTheDocument();
    expect(fetchCallsFor(`/blocks/byheight/${TIP - 12}`)).toHaveLength(1);
  });
});

describe('Overview: one section failing', () => {
  it('shows what failed with Retry, and the rest of the page', async () => {
    let fail = true;
    const { user } = await open(ADDR.nominator, () => {
      mockFetchRoute(`/addresses/balance/${ADDR.nominator}`, () =>
        fail ? new Response('{"error":5,"message":"repository issue"}', { status: 500 }) : '12.5'
      );
    });
    const facts = await region('At a glance');
    const alert = await within(facts).findByText(/^Couldn't load its balance\./, {}, T);
    expect(fact('Level').value).toBe('6');
    expect(await screen.findByText('Minting now.', {}, T)).toBeInTheDocument();
    fail = false;
    await user.click(
      within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Retry' })
    );
    await waitFor(() => expect(fact('Balance').value).toBe('12.5 QORT'), T);
  });
});
