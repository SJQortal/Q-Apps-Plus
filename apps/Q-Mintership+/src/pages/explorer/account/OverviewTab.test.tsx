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
import { renderPage, type RenderPageOptions } from '../../../test/render';
import { getDefaultStore } from 'jotai';
import { addPaymentsTo, setMintedTo } from '../../../test/qortWorld';
import { activityFirstReadAtom } from '../../../state/settings';
import { expectNoAxeViolations } from '../../../test/axe';
import { fetchCallsFor, mockFetchRoute, qortalCalls } from '../../../test/setup';
import { ADDR, MS_PER_BLOCK, NOW, TIP } from '../../../test/world';
import { COLLECTOR, FUNDER, SPONSEES, SPONSOR, type World } from '../../../../e2e/world.mjs';
import { explorerAccountPath } from '../../../routes/paths';
import { peekQuery } from '../../../data/query';
import { accountTxKey, type AccountTxList } from '../../../data/explorer/accountTx';
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
    { persona: 'nominator', path: explorerAccountPath(address), route: ROUTE, strict: true, setup }
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
    expect(fact('Blocks minted').value).toBe('1,730,799');
    // How much of the time its node was online, under it, with an ⓘ that says more.
    await waitFor(
      () =>
        expect(fact('Blocks minted').detail).toMatch(
          /^Node online: (\d+%|over 99%|under 1%|Not minting|Not yet|Can’t tell)$/
        ),
      T
    );
    expect(within(facts).getByRole('button', { name: /^About node online: / })).toBeInTheDocument();
    await waitFor(() => expect(fact('Balance').value).toBe('12.5 QORT'), T);
    expect(fact('Balance').detail).toBe('');
    await waitFor(() => expect(fact('First seen').value).not.toBe('Loading'), T);
    expect(fact('First seen').detail).toMatch(/^At block [\d,]+$/);
    await waitFor(() => expect(fact('Groups').value).toBe('In 3 groups'), T);
    // Its QDN transactions, counted in its own list (the one Latest transactions reads).
    await waitFor(() => expect(fact('Transactions').value).not.toBe('Loading'), T);
    const list = peekQuery<AccountTxList>(accountTxKey(ADDR.admin, []));
    const qdn = (list?.rows ?? []).filter((tx) => tx.type === 'ARBITRARY').length;
    const more = list?.done ? '' : '+';
    expect(fact('Transactions').value).toBe(`${list?.rows.length}${more}`);
    expect(fact('Transactions').detail).toMatch(
      new RegExp(`^${qdn}\\${more || '?'}? of them on QDN\\.`)
    );
    // At a glance counts them; the Groups section lists them.
    expect(within(facts).queryByRole('list', { name: 'Its groups' })).toBeNull();
    const groupsSection = await region('Groups (3)');
    const groups = within(groupsSection).getByRole('list', { name: 'Its groups' });
    const rows = within(groups).getAllByRole('listitem');
    // MINTER first; the admin owns and runs the helpers' group.
    // Each group with its avatar (its owner's group THUMBNAIL; the letter until it loads).
    expect(rows.map((row) => row.querySelector('[aria-hidden="true"]')?.textContent)).toEqual([
      'M',
      'Q',
      'Q',
    ]);
    expect(rows.map((row) => readText(row))).toEqual([
      // The grid card ends with the group's own description.
      expect.stringMatching(/^MINTER[\d,]+ membersAdminThe MINTER Group of Qortal$/),
      'Qortal General5,200 membersQortal General (made-up group)',
      'Q-Mintership Helpers40 membersOwnerAdminQ-Mintership Helpers (made-up group)',
    ]);
    expect(within(groupsSection).queryByRole('button', { name: /^Show all/ })).toBeNull();

    // 4. MINTER: the app's own sentence and the way on, to its Minter Profile.
    const minterSection = await region('MINTER');
    expect(await within(minterSection).findByText(/^Minter Admin/, {}, T)).toBeInTheDocument();
    expect(within(minterSection).getByRole('link', { name: 'Minter Profile' })).toHaveAttribute(
      'href',
      explorerAccountPath(ADDR.admin, 'mintership')
    );
    expect(within(minterSection).getAllByRole('link')).toHaveLength(1);

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

    expect(fact('Blocks minted').value).toBe('1,200,000');
    await waitFor(
      () =>
        expect(fact('Blocks minted').detail).toMatch(
          /^Node online: .+Adjustment \+12,000 · Penalty −5,000,000$/
        ),
      T
    );
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
        'Core recorded a minting penalty of −5,000,000 blocks on this account, set by its self-sponsorship check, which holds it at level 0. Core ran that check over the whole chain in December 2022 and February 2024, looking for patterns from the days when accounts were sponsored into minting: sponsored accounts passing their rewards on to the same few accounts, sponsorships given out in bulk, minting levels moved on to other accounts. The chain doesn’t record which pattern matched.'
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

describe('Overview: its groups', () => {
  it('a grid by default, sorted as picked, or a list kept on this device', async () => {
    const { user } = await open(ADDR.admin);
    const section = await region('Groups (3)');
    const names = () =>
      within(within(section).getByRole('list', { name: 'Its groups' }))
        .getAllByRole('listitem')
        .map((row) => readText(row).replace(/\d.*$/, ''));
    await waitFor(() =>
      expect(names()).toEqual(['MINTER', 'Qortal General', 'Q-Mintership Helpers'])
    );
    const grid = within(section).getByRole('button', { name: 'Grid' });
    expect(grid).toHaveAttribute('aria-pressed', 'true');

    const sort = within(section).getByRole('combobox', { name: 'Sort' });
    await user.selectOptions(sort, 'Most members');
    expect(names()).toEqual(['Qortal General', 'MINTER', 'Q-Mintership Helpers']);
    await user.selectOptions(sort, 'Owner and admin first');
    expect(names()).toEqual(['Q-Mintership Helpers', 'MINTER', 'Qortal General']);
    await user.selectOptions(sort, 'Name A–Z');
    expect(names()).toEqual(['MINTER', 'Q-Mintership Helpers', 'Qortal General']);

    await user.click(within(section).getByRole('button', { name: 'List' }));
    expect(within(section).getByRole('button', { name: 'List' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(window.localStorage.getItem('qmintershipplus-groups-view')).toBe('list');
    expect(names()).toEqual(['MINTER', 'Q-Mintership Helpers', 'Qortal General']);
  });
});

describe('Overview: its activity over time', () => {
  it('draws its transactions by family, marks its milestones, lists a period, and goes full screen', async () => {
    const { user, container } = await open(ADDR.admin);
    const activity = await region('Activity');
    const chart = await within(activity).findByRole(
      'group',
      { name: /activity over time\. Use the arrow keys/ },
      T
    );
    // What was read, and each family with its count (a toggle to hide it).
    await waitFor(
      () =>
        expect(
          within(activity).getByText(
            /^All \d+ transactions?, back to its first on .+\. Nothing older to read\.$/
          )
        ).toBeInTheDocument(),
      T
    );
    const legend = within(activity).getByRole('list', {
      name: 'Kinds of transactions: press one to hide or show it',
    });
    const first = within(legend).getAllByRole('button')[0];
    expect(first).toHaveAttribute('aria-pressed', 'true');
    await user.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'false');
    await user.click(first);
    // Its milestones, each a link to what it marks.
    const milestones = await within(activity).findByRole('list', { name: 'Milestones' }, T);
    const links = within(milestones).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links)
      expect(link.getAttribute('href')).toMatch(/^\/(explorer|nominations)\//);
    // Keys: to the last period with transactions, then Enter lists them.
    chart.focus();
    await user.keyboard('{End}');
    expect(
      within(activity).getByText(/: (\d+ transactions?|not read yet)/, {
        selector: '[role="status"]',
      })
    ).toBeInTheDocument();
    for (let i = 0; i < 40; i++) {
      await user.keyboard('{Enter}');
      if (within(activity).queryByRole('button', { name: 'Close the list' })) break;
      await user.keyboard('{ArrowLeft}');
    }
    const close = await within(activity).findByRole('button', { name: 'Close the list' }, T);
    expect(within(activity).getByRole('list', { name: /^Transactions, / })).toBeInTheDocument();
    await expectNoAxeViolations(container);
    await user.click(close);
    // Full screen: the same, in a dialog.
    await user.click(
      within(activity).getByRole('button', { name: 'Show the activity full screen' })
    );
    const dialog = await screen.findByRole('dialog', { name: /^Activity: / }, T);
    expect(within(dialog).getByRole('group', { name: /activity over time/ })).toBeInTheDocument();
  });
});

describe('Overview: its first reward share', () => {
  it('marks the oldest in its whole history, from a one-row read, as the sponsorship era', async () => {
    await open(SPONSOR.address);
    const activity = await region('Activity');
    const milestones = await within(activity).findByRole('list', { name: 'Milestones' }, T);
    await waitFor(
      () =>
        expect(
          within(milestones)
            .getAllByText(/^First reward share/)
            .map((el) => el.textContent)
        ).toEqual(['First reward share (sponsorship era)']),
      T
    );
    // Its first reward share: the oldest one, read on its own (Simon, 2026-10-18).
    const searches = fetchCallsFor('/transactions/search').map(
      (url) => new URL(url, 'http://x').searchParams
    );
    expect(
      searches.some(
        (p) =>
          p.get('txType') === 'REWARD_SHARE' &&
          p.get('address') === SPONSOR.address &&
          p.get('limit') === '1' &&
          p.get('reverse') === 'false'
      )
    ).toBe(true);
  });
});

describe('Overview: Activity’s settings', () => {
  it('reads the number picked at first, and Read older reads as many more', async () => {
    const { user } = await open(FUNDER.address, () =>
      window.localStorage.setItem('qmintershipplus-explorer-activity-first-read', '100')
    );
    const activity = await region('Activity');
    expect(
      await within(activity).findByText(/^Its newest 100 transactions, back to /, {}, T)
    ).toBeInTheDocument();
    expect(within(activity).getByRole('button', { name: 'Read 100 older' })).toBeVisible();
    // The gear, beside it: pick 500.
    await user.click(within(activity).getByRole('button', { name: 'Activity settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Activity settings' });
    await user.click(within(dialog).getByRole('radio', { name: '500' }));
    expect(window.localStorage.getItem('qmintershipplus-explorer-activity-first-read')).toBe('500');
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(
      await within(activity).findByRole('button', { name: 'Read 500 older' }, T)
    ).toBeVisible();
  });

  it('leaves out the kinds of milestones hidden there', async () => {
    const { user } = await open(ADDR.admin);
    const activity = await region('Activity');
    await within(activity).findByRole('list', { name: 'Milestones' }, T);
    await user.click(within(activity).getByRole('button', { name: 'Activity settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Activity settings' });
    for (const box of within(dialog).getAllByRole('checkbox')) await user.click(box);
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(within(activity).queryByRole('list', { name: 'Milestones' })).toBeNull()
    );
  });
});

describe('QORT summaries', () => {
  const mintedComesTo = (address: string, minted: bigint) => (world: World) =>
    setMintedTo(world, address, minted);

  const SLOW = { timeout: 20_000 };
  /** The Overview of `address`, as the admin persona sees it. */
  const visit = (address: string, setup?: RenderPageOptions['setup']) =>
    renderPage(<AccountPage />, {
      persona: 'admin',
      path: explorerAccountPath(address),
      route: ROUTE,
      setup,
    });
  /** At a glance, where the QORT facts are (Simon, 2026-10-17: moved from the Minter Profile). */
  const standing = () => screen.findByRole('region', { name: 'At a glance' }, SLOW);
  async function summaries() {
    const region = await standing();
    return waitFor(() => {
      const dl = region.querySelector('dl');
      expect(dl).not.toBeNull();
      return dl as HTMLElement;
    }, SLOW);
  }
  const value = (dl: HTMLElement, label: string) =>
    (within(dl).getByText(label).nextElementSibling as HTMLElement).textContent ?? '';

  afterEach(() => getDefaultStore().set(activityFirstReadAtom, 1000));

  it('adds up QORT minted, purchased / sold and received / sent from its whole history', async () => {
    await visit(ADDR.admin, mintedComesTo(ADDR.admin, 1_234n));
    const dl = await summaries();
    await waitFor(() => expect(value(dl, 'QORT minted')).toBe('1,234 QORT'), SLOW);
    expect(value(dl, 'QORT received / sent')).toMatch(/^[\d,.]+ \/ [\d,.]+$/);
    // Sold: its completed trades as the seller, read by its public key.
    await waitFor(() => expect(value(dl, 'QORT purchased / sold')).toBe('0 / 0'), SLOW);
    expect(
      fetchCallsFor('/crosschain/trades').some((url) =>
        new URL(url, 'http://x').searchParams.has('sellerPublicKey')
      )
    ).toBe(true);
    // The ⓘ says how it was worked out, beside the label (Simon, 2026-10-18).
    expect(
      within(dl)
        .getByRole('button', { name: /^About QORT minted: 1,234 QORT\. Its balance now, / })
        .closest('dt')
    ).toHaveTextContent('QORT minted');
  });

  it('reads past the first read only when asked, 1,000 at a time', async () => {
    getDefaultStore().set(activityFirstReadAtom, 100);
    const user = userEvent.setup();
    await visit(ADDR.admin, (world) => {
      // 150 small payments in: more than the first read of 100.
      addPaymentsTo(world, ADDR.admin, 150);
      mintedComesTo(ADDR.admin, 50n)(world);
    });
    const region = await standing();
    const rest = await within(region).findByRole('button', { name: 'Read the rest' }, SLOW);
    expect(region).toHaveTextContent(
      /To show the QORT amounts, read the rest of its transactions: they add up its whole history, and [\d,]+\+ have been read so far\./
    );
    const dl = await summaries();
    expect(value(dl, 'QORT minted')).toBe('…');
    await user.click(rest);
    await waitFor(() => expect(value(dl, 'QORT minted')).toBe('50 QORT'), SLOW);
    expect(value(dl, 'QORT received / sent')).toMatch(/^[\d,.]+ \/ [\d,.]+$/);
    const pages = fetchCallsFor('/transactions/search')
      .map((url) => new URL(url, 'http://x').searchParams)
      .filter((p) => p.get('address') === ADDR.admin && !p.get('txType'));
    expect(pages.some((p) => p.get('limit') === '1000')).toBe(true);
  });

  it('says an account that never minted never minted, with nothing to work out', async () => {
    await visit(ADDR.nominatedSigning);
    const dl = await summaries();
    await waitFor(() => expect(value(dl, 'QORT minted')).toBe('Never minted'), SLOW);
    expect(
      within(dl).getByRole('button', {
        name: /^About QORT minted: This account has never minted QORT/,
      })
    ).toBeInTheDocument();
  });
});
